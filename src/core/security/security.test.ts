/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveKeyFromPin,
  encryptDataAesGcm,
  decryptDataAesGcm,
  generateRandomBytes,
  timingSafeEqual,
  hashPinPbkdf2,
  verifyPinHash,
  bytesToHex,
  sha256Hex
} from './cryptoUtils';
import { KeyManagementService } from './keyManagementService';
import { SecurityLockoutService } from './securityLockoutService';
import { DatabaseEncryptionVerifier } from './databaseEncryptionVerifier';
import { AuditTrailService } from '../../application/services/AuditTrailService';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';

// Mock Storage for Node environment
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Ensure globalThis.localStorage is available in test environment
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

describe('Security: Cryptographic Utilities & Envelope Encryption', () => {
  it('derives consistent AES-256 key from PIN and salt using PBKDF2 (100k rounds)', async () => {
    const pin = '123456';
    const salt = generateRandomBytes(16);

    const kek1 = await deriveKeyFromPin(pin, salt);
    assert.equal(kek1.algorithm.name, 'AES-GCM');
    assert.equal((kek1.algorithm as any).length, 256);

    const hash1 = await hashPinPbkdf2(pin, salt);
    const hash2 = await hashPinPbkdf2(pin, salt);
    assert.equal(hash1, hash2, 'PBKDF2 hash must be deterministic for identical PIN and salt');

    const differentSalt = generateRandomBytes(16);
    const hash3 = await hashPinPbkdf2(pin, differentSalt);
    assert.notEqual(hash1, hash3, 'Different salts must yield completely different hashes');
  });

  it('performs constant-time comparison immune to early-exit timing leaks', () => {
    const hashA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const hashB = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const hashC = 'f3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    assert.equal(timingSafeEqual(hashA, hashB), true);
    assert.equal(timingSafeEqual(hashA, hashC), false);
    assert.equal(timingSafeEqual(hashA, 'short'), false);
  });

  it('verifies PIN hash correctly using PBKDF2', async () => {
    const pin = '882200';
    const salt = generateRandomBytes(16);
    const saltHex = bytesToHex(salt);
    const expectedHash = await hashPinPbkdf2(pin, salt);

    const isValid = await verifyPinHash(pin, saltHex, expectedHash);
    assert.equal(isValid, true);

    const isInvalid = await verifyPinHash('000000', saltHex, expectedHash);
    assert.equal(isInvalid, false);
  });

  it('encrypts and decrypts Master DEK using KEK with AES-256-GCM authentication tag', async () => {
    const rawDek = generateRandomBytes(32);
    const pin = '987654';
    const salt = generateRandomBytes(16);
    const kek = await deriveKeyFromPin(pin, salt);

    const { ciphertextHex, ivHex } = await encryptDataAesGcm(rawDek, kek);
    assert.ok(ciphertextHex.length > 0);
    assert.ok(ivHex.length === 24); // 12 bytes = 24 hex chars

    // Successful unwrapping with authentic key
    const decryptedDek = await decryptDataAesGcm(ciphertextHex, ivHex, kek);
    assert.deepEqual(decryptedDek, rawDek, 'Decrypted DEK must exactly match original plaintext DEK');

    // Wrong key must be rejected by AES-GCM authentication tag verification
    const wrongKek = await deriveKeyFromPin('000000', salt);
    await assert.rejects(
      async () => {
        await decryptDataAesGcm(ciphertextHex, ivHex, wrongKek);
      },
      /operation-failed|OperationError|Authentication tag/i
    );
  });
});

describe('Security: Key Management Service (Envelope Encryption & Zero Plaintext)', () => {
  let kms: KeyManagementService;

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    kms = KeyManagementService.getInstance();
    kms.wipeKeys();
  });

  it('initializes key envelope without persisting plaintext PIN', async () => {
    const pin = '789012';
    const { dekHex } = await kms.setupPinAndEnvelope(pin);
    assert.ok(dekHex);

    const envelope = kms.getKeyEnvelope();
    assert.ok(envelope);
    assert.ok(envelope.saltHex);
    assert.ok(envelope.encryptedDekHex);
    assert.ok(envelope.ivHex);
    assert.ok(envelope.pinHashHex);

    // Inspect persisted storage
    const stored = JSON.parse(globalThis.localStorage.getItem('cocoon_key_envelope') || '{}');
    assert.equal(typeof stored.pinCode, 'undefined', 'Plaintext PIN must NEVER be stored');
    assert.equal(typeof stored.pin, 'undefined', 'Plaintext PIN must NEVER be stored');
    assert.ok(stored.encryptedDekHex, 'Encrypted DEK must be persisted');
  });

  it('unwraps active DEK with correct PIN and rejects incorrect PIN', async () => {
    const pin = '456123';
    const { dekHex } = await kms.setupPinAndEnvelope(pin);

    // Lock session (clear active in-memory DEK)
    kms.lockSession();
    assert.equal(kms.getActiveDecryptedKey(), null);

    // Unlock with valid PIN
    const unlockRes = await kms.unlockWithPin(pin);
    assert.equal(unlockRes.success, true);
    assert.equal(unlockRes.dekHex, dekHex);
    assert.equal(kms.getActiveDecryptedKey(), dekHex);

    // Re-lock and attempt with invalid PIN
    kms.lockSession();
    const invalidRes = await kms.unlockWithPin('000000');
    assert.equal(invalidRes.success, false);
    assert.equal(kms.getActiveDecryptedKey(), null, 'Failed attempt must not hydrate active DEK into memory');
  });

  it('verifies PIN for sensitive operational authorization', async () => {
    const pin = '112233';
    await kms.setupPinAndEnvelope(pin);

    assert.equal(await kms.reauthenticateSensitiveOperation(pin), true);
    assert.equal(await kms.reauthenticateSensitiveOperation('999999'), false);
  });
});

describe('Security: Rate-Limiting & Exponential Backoff Lockout', () => {
  let lockoutService: SecurityLockoutService;

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    lockoutService = SecurityLockoutService.getInstance();
    lockoutService.resetLockout();
  });

  it('allows up to 3 failed attempts before imposing lockout delay', () => {
    const s1 = lockoutService.recordFailedAttempt();
    assert.equal(s1.isLockedOut, false);
    assert.equal(s1.remainingSeconds, 0);

    const s2 = lockoutService.recordFailedAttempt();
    assert.equal(s2.isLockedOut, false);
    assert.equal(s2.remainingSeconds, 0);

    const s3 = lockoutService.recordFailedAttempt();
    assert.equal(s3.isLockedOut, false);
    assert.equal(s3.remainingSeconds, 0);
  });

  it('enforces progressive backoff on 4+ failures (30s, 60s, 300s, 900s, 1800s)', () => {
    // 1-3 attempts
    lockoutService.recordFailedAttempt();
    lockoutService.recordFailedAttempt();
    lockoutService.recordFailedAttempt();

    // 4th attempt: 30s lockout
    const s4 = lockoutService.recordFailedAttempt();
    assert.equal(s4.isLockedOut, true);
    assert.ok(s4.remainingSeconds <= 30 && s4.remainingSeconds >= 29);

    // 5th attempt: 60s lockout
    const s5 = lockoutService.recordFailedAttempt();
    assert.equal(s5.isLockedOut, true);
    assert.ok(s5.remainingSeconds <= 60 && s5.remainingSeconds >= 59);

    // 6th attempt: 300s (5 min) lockout
    const s6 = lockoutService.recordFailedAttempt();
    assert.equal(s6.isLockedOut, true);
    assert.ok(s6.remainingSeconds <= 300 && s6.remainingSeconds >= 299);

    // 7th attempt: 900s (15 min) lockout
    const s7 = lockoutService.recordFailedAttempt();
    assert.equal(s7.isLockedOut, true);
    assert.ok(s7.remainingSeconds <= 900 && s7.remainingSeconds >= 899);

    // 8th attempt: 1800s (30 min) lockout
    const s8 = lockoutService.recordFailedAttempt();
    assert.equal(s8.isLockedOut, true);
    assert.ok(s8.remainingSeconds <= 1800 && s8.remainingSeconds >= 1799);
  });

  it('resets lockout state upon successful unlock', () => {
    lockoutService.recordFailedAttempt();
    lockoutService.recordFailedAttempt();
    lockoutService.recordFailedAttempt();
    lockoutService.recordFailedAttempt();
    assert.equal(lockoutService.getStatus().isLockedOut, true);

    lockoutService.resetLockout();
    assert.equal(lockoutService.getStatus().isLockedOut, false);
    assert.equal(lockoutService.getStatus().remainingSeconds, 0);
  });
});

describe('Security: Database Encryption Verifier', () => {
  it('correctly detects unencrypted plaintext SQLite header ("SQLite format 3\\0")', () => {
    const plaintextHeader = new Uint8Array([
      0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
      0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00
    ]);

    const isEncrypted = DatabaseEncryptionVerifier.isHeaderEncrypted(plaintextHeader);
    assert.equal(isEncrypted, false, 'Plaintext header must not be reported as encrypted');
  });

  it('verifies non-plaintext header when SQLCipher encryption is active', () => {
    const encryptedHeader = new Uint8Array([
      0x9e, 0x41, 0xd2, 0x88, 0x14, 0x7b, 0x2c, 0xfe,
      0x39, 0x11, 0xa6, 0x80, 0x54, 0xef, 0x12, 0x67
    ]);

    const isEncrypted = DatabaseEncryptionVerifier.isHeaderEncrypted(encryptedHeader);
    assert.equal(isEncrypted, true, 'Ciphertext header must be verified as encrypted');
  });
});

describe('Security: Audit Trail & Tamper-Evident Hash Chaining', () => {
  it('redacts sensitive keys (PIN, passwords, tokens, keys) from audit records', () => {
    const auditService = AuditTrailService.getInstance();
    const payload = {
      action: 'UPDATE_SETTINGS',
      pinCode: '123456',
      vaultPassword: 'secretPassword!',
      sessionToken: 'xyz-token',
      safeParam: 'allowed_value'
    };

    const sanitized = JSON.parse(auditService.sanitizeDetails(payload));
    assert.equal(sanitized.pinCode, '[REDACTED]');
    assert.equal(sanitized.vaultPassword, '[REDACTED]');
    assert.equal(sanitized.sessionToken, '[REDACTED]');
    assert.equal(sanitized.safeParam, 'allowed_value');
  });

  it('records tamper-evident linked audit events and verifies hash chain', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_audit_chain_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [...MIGRATION_REGISTRY]);

    const auditService = AuditTrailService.getInstance();
    const workspaceId = 'ws_personal_default';

    // Log Event 1
    const ev1 = await auditService.logEvent(conn, {
      workspaceId,
      eventType: 'DOCUMENT_POSTED',
      actorId: 'usr_owner',
      actorRole: 'owner',
      sourceEntity: 'sale',
      sourceId: 'sale_001',
      action: 'POST_SALE',
      summary: 'Cash sale of PKR 1500'
    });

    // Log Event 2
    const ev2 = await auditService.logEvent(conn, {
      workspaceId,
      eventType: 'STOCK_ADJUSTED',
      actorId: 'usr_owner',
      actorRole: 'owner',
      sourceEntity: 'product',
      sourceId: 'prod_001',
      action: 'ADJUST_STOCK',
      summary: 'Inventory recount +5 units'
    });

    // ev2 prevHash must equal ev1 hash
    assert.equal(ev2.prevHash, ev1.hash, 'Second event prevHash must match first event hash');

    // Chain must verify clean
    const verifyResult = await auditService.verifyChain(conn, workspaceId);
    assert.equal(verifyResult.valid, true);
    assert.equal(verifyResult.totalEvents, 2);

    // Simulate external database tampering (e.g., unauthorized row modification)
    await conn.run(
      `UPDATE audit_events SET summary = 'Tampered summary' WHERE id = ?`,
      [ev1.id]
    );

    // Verification must detect the tampering and fail
    const tamperedResult = await auditService.verifyChain(conn, workspaceId);
    assert.equal(tamperedResult.valid, false, 'Tampered event hash mismatch must be detected');
    assert.equal(tamperedResult.brokenAtEventId, ev1.id);
  });
});

describe('Security: Role-Based Access Control (RBAC)', () => {
  it('enforces role restrictions (cashier cannot reverse documents or edit settings)', () => {
    const auditService = AuditTrailService.getInstance();

    // Cashier role permissions
    assert.equal(auditService.canPerformAction('cashier', 'POST_SALE'), true);
    assert.equal(auditService.canPerformAction('cashier', 'VIEW_REPORTS'), true);
    assert.equal(auditService.canPerformAction('cashier', 'REVERSE_DOCUMENT'), false);
    assert.equal(auditService.canPerformAction('cashier', 'EDIT_SETTINGS'), false);
    assert.equal(auditService.canPerformAction('cashier', 'ADJUST_STOCK'), false);

    // Admin role permissions
    assert.equal(auditService.canPerformAction('admin', 'POST_SALE'), true);
    assert.equal(auditService.canPerformAction('admin', 'REVERSE_DOCUMENT'), true);
    assert.equal(auditService.canPerformAction('admin', 'ADJUST_STOCK'), true);
    assert.equal(auditService.canPerformAction('admin', 'EDIT_SETTINGS'), false);

    // Owner role permissions
    assert.equal(auditService.canPerformAction('owner', 'POST_SALE'), true);
    assert.equal(auditService.canPerformAction('owner', 'REVERSE_DOCUMENT'), true);
    assert.equal(auditService.canPerformAction('owner', 'ADJUST_STOCK'), true);
    assert.equal(auditService.canPerformAction('owner', 'EDIT_SETTINGS'), true);
  });
});

describe('Security: Transaction Rollback on Failure (Atomicity Guarantee)', () => {
  it('rolls back completely without creating partial financial records', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_rollback_atomicity_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [...MIGRATION_REGISTRY]);

    const workspaceId = 'ws_personal_default';
    const initialAccounts = await conn.query('SELECT * FROM accounts WHERE workspace_id = ?', [workspaceId]);

    // Attempt a transaction where step 2 deliberately fails
    await assert.rejects(
      async () => {
        await conn.executeTransaction(async () => {
          // Step 1: Insert an account
          await conn.run(
            `INSERT INTO accounts (id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at)
             VALUES (?, ?, '9999', 'Temporary Account', 'asset', 'PKR', 0, 1, '2026-01-01', '2026-01-01')`,
            ['acc_temporary_rollback_test', workspaceId]
          );

          // Step 2: Deliberate failure violating foreign key constraint on journal_entries
          await conn.run(
            `INSERT INTO journal_entries (id, workspace_id, entry_number, entry_date, description, created_at, updated_at)
             VALUES ('je_fail', 'non_existent_workspace_id_9999', 'JE-FAIL', '2026-01-01', 'Fail', '2026-01-01', '2026-01-01')`
          );
        });
      },
      /FOREIGN KEY constraint failed/i
    );

    // Verify account from Step 1 was rolled back and never committed
    const probe = await conn.query('SELECT * FROM accounts WHERE id = ?', ['acc_temporary_rollback_test']);
    assert.equal(probe.length, 0, 'Rolled back account must not exist');

    const finalAccounts = await conn.query('SELECT * FROM accounts WHERE workspace_id = ?', [workspaceId]);
    assert.equal(finalAccounts.length, initialAccounts.length, 'Database state must be identical to pre-transaction state');
  });
});
