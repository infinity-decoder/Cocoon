/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backupArchiveService, BackupArchiveBundle } from './BackupArchiveService';
import { attachmentStorage } from './AttachmentStorageService';
import { AppState } from '../../core/types';
import { isEncryptedBackup, peekBackupHeader } from '../../core/security/backupCrypto';
import { SqliteConnectionPool } from '../database/sqliteConnectionPool';
import { MigrationService } from '../database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../database/migrations/MigrationRegistry';

describe('Infrastructure: BackupArchiveService', () => {
  it('bundles SQLite state and relative attachments into a verifiable backup archive', async () => {
    // 1. Save an attachment using AttachmentStorageService
    const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const relPath = await attachmentStorage.saveAttachment(fakeBase64, 'invoices', 'test_inv_01.png');
    assert.ok(relPath.startsWith('attachments/invoices/'));

    // 2. Prepare sample AppState referencing this attachment
    const sampleState: AppState = {
      transactions: [
        {
          id: 'tx-att-1',
          type: 'expense',
          amount: 250,
          currency: 'PKR',
          date: '2026-10-12T10:00:00Z',
          note: 'Office Supplies',
          category: 'Office',
          walletId: 'w-cash',
          paymentMethod: 'Cash',
          attachment: relPath,
          isRecurring: false
        }
      ],
      categories: [],
      subCategories: [],
      wallets: [
        { id: 'w-cash', name: 'Cash Register', type: 'cash', balance: 5000, color: '#10B981' }
      ],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '₨',
        currencyCode: 'PKR',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    // 3. Export archive
    const archiveJson = await backupArchiveService.exportFullBackupArchive(sampleState);
    assert.ok(archiveJson);

    const parsed = JSON.parse(archiveJson);
    assert.equal(parsed.manifest.appName, 'Cocoon');
    assert.ok(parsed.manifest.archiveFormatVersion === '3.0.0' || parsed.manifest.archiveFormatVersion === '2.0.0');
    assert.ok(parsed.manifest.attachmentCount >= 1);
    assert.ok(parsed.attachments[relPath]);

    // 4. Import archive and verify restoration
    const restored = await backupArchiveService.importBackupArchive(archiveJson);
    assert.equal(restored.state.transactions.length, 1);
    assert.equal(restored.state.transactions[0].id, 'tx-att-1');
    assert.equal(restored.state.transactions[0].attachment, relPath);
    assert.ok(restored.attachmentsRestored >= 1);

    // 5. Verify restored attachment is readable
    const readBack = await attachmentStorage.readAttachment(relPath);
    assert.ok(readBack);
    assert.ok(readBack.includes('data:image/png;base64,'));
  });

  it('maintains backwards compatibility with legacy v1.0.0 JSON backups', async () => {
    const legacyBackup = JSON.stringify({
      version: '1.0.0',
      exportedAt: '2026-09-01T00:00:00Z',
      appName: 'Cocoon',
      data: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: {}
      }
    });

    const result = await backupArchiveService.importBackupArchive(legacyBackup);
    assert.equal(result.archiveVersion, '1.0.0');
    assert.equal(result.attachmentsRestored, 0);
    assert.ok(result.state);
  });

  it('exports password-protected backup (AES-256-GCM) and restores with correct password', async () => {
    const sampleState: AppState = {
      transactions: [
        {
          id: 'tx-sec-1',
          type: 'income',
          amount: 15000,
          currency: 'PKR',
          date: '2026-10-15T12:00:00Z',
          note: 'Consulting Fee',
          category: 'Services',
          walletId: 'w-bank',
          paymentMethod: 'Bank Transfer',
          isRecurring: false
        }
      ],
      categories: [],
      subCategories: [],
      wallets: [{ id: 'w-bank', name: 'Main Bank', type: 'bank', balance: 50000, color: '#2563EB' }],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '₨',
        currencyCode: 'PKR',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    const passphrase = 'SuperSecretPassphrase!2026';
    const encryptedJson = await backupArchiveService.exportFullBackupArchive({
      stateOverride: sampleState,
      passphrase
    });

    // Verify it is an encrypted container
    assert.equal(isEncryptedBackup(encryptedJson), true);

    // Verify unencrypted header preview
    const header = peekBackupHeader(encryptedJson);
    assert.ok(header);
    assert.equal(header.appName, 'Cocoon');
    assert.equal(header.isEncrypted, true);
    assert.equal(header.currencyCode, 'PKR');

    // Inspect without password first: should report needsPassphrase
    const inspectWithoutPass = await backupArchiveService.inspectBackup(encryptedJson);
    assert.equal(inspectWithoutPass.isEncrypted, true);
    assert.equal(inspectWithoutPass.needsPassphrase, true);
    assert.equal(inspectWithoutPass.isValid, false);

    // Inspect with correct password: dry-run should pass
    const inspectWithPass = await backupArchiveService.inspectBackup(encryptedJson, passphrase);
    assert.equal(inspectWithPass.isValid, true);
    assert.equal(inspectWithPass.needsPassphrase, false);
    assert.equal(inspectWithPass.recordCounts.transactions, 1);

    // Restore with correct password
    const restored = await backupArchiveService.importBackupArchive(encryptedJson, passphrase);
    assert.equal(restored.state.transactions.length, 1);
    assert.equal(restored.state.transactions[0].id, 'tx-sec-1');
    assert.equal(restored.state.transactions[0].amount, 15000);
  });

  it('rejects restore when incorrect passphrase is provided', async () => {
    const sampleState: AppState = {
      transactions: [],
      categories: [],
      subCategories: [],
      wallets: [],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '₨',
        currencyCode: 'PKR',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    const encryptedJson = await backupArchiveService.exportFullBackupArchive({
      stateOverride: sampleState,
      passphrase: 'CorrectPassword123'
    });

    // Attempting with wrong password
    const inspectWrong = await backupArchiveService.inspectBackup(encryptedJson, 'WrongPassword999');
    assert.equal(inspectWrong.isValid, false);
    assert.match(inspectWrong.errors[0], /incorrect passphrase|Authentication failed/i);

    await assert.rejects(
      async () => {
        await backupArchiveService.importBackupArchive(encryptedJson, 'WrongPassword999');
      },
      /incorrect passphrase|Authentication failed/i
    );
  });

  it('rejects tampered or corrupted encrypted backup files', async () => {
    const sampleState: AppState = {
      transactions: [],
      categories: [],
      subCategories: [],
      wallets: [],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '₨',
        currencyCode: 'PKR',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    const passphrase = 'IntegrityCheckPass1!';
    const encryptedJson = await backupArchiveService.exportFullBackupArchive({
      stateOverride: sampleState,
      passphrase
    });

    const parsed = JSON.parse(encryptedJson);
    // Flip a character in the ciphertext to simulate data tampering
    const originalCipher = parsed.ciphertextHex;
    const tamperedCipher = originalCipher.slice(0, 10) + (originalCipher[10] === 'a' ? 'b' : 'a') + originalCipher.slice(11);
    parsed.ciphertextHex = tamperedCipher;

    const tamperedJson = JSON.stringify(parsed);

    // GCM authentication tag verification MUST fail
    await assert.rejects(
      async () => {
        await backupArchiveService.importBackupArchive(tamperedJson, passphrase);
      },
      /tampered backup payload|Authentication failed/i
    );
  });

  it('rejects truncated backup file safely', async () => {
    const truncatedJson = '{"manifest": {"archiveFormatVersion": "3.0.0", "appName": "Cocoon"'; // Incomplete JSON
    const report = await backupArchiveService.inspectBackup(truncatedJson);
    assert.equal(report.isValid, false);
    assert.match(report.errors[0], /not valid JSON/i);
  });

  it('rejects unsupported future schema version with clear notification', async () => {
    const futureBackup = JSON.stringify({
      manifest: {
        archiveFormatVersion: '3.0.0',
        appName: 'Cocoon',
        appVersion: '9.9.9',
        schemaVersion: 999, // Future unsupported version
        backupId: 'future_bkp',
        exportedAt: '2030-01-01T00:00:00Z',
        currencyMetadata: { baseCurrency: 'PKR', currencyScale: 100, decimalPlaces: 2 },
        checksum: 'abc',
        attachmentCount: 0,
        recordCounts: {}
      },
      state: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: {}
      },
      attachments: {}
    });

    const report = await backupArchiveService.inspectBackup(futureBackup);
    assert.equal(report.isValid, false);
    assert.match(report.errors[0], /Unsupported schema version 999/i);
  });

  it('detects corrupted attachment with mismatched SHA-256 checksum', async () => {
    const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const relPath = 'attachments/invoices/corrupt_test.png';

    const corruptedBundle: BackupArchiveBundle = {
      manifest: {
        archiveFormatVersion: '3.0.0',
        appName: 'Cocoon',
        appVersion: '0.0.1',
        schemaVersion: 9,
        backupId: 'corrupt_att_test',
        exportedAt: new Date().toISOString(),
        currencyMetadata: { baseCurrency: 'PKR', currencyScale: 100, decimalPlaces: 2 },
        checksum: 'any',
        attachmentCount: 1,
        attachmentsMeta: [
          {
            path: relPath,
            mimeType: 'image/png',
            sizeBytes: 100,
            sha256: 'deadbeef00000000000000000000000000000000000000000000000000000000' // Deliberately wrong hash
          }
        ],
        recordCounts: {}
      },
      state: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: {}
      } as any,
      attachments: {
        [relPath]: `data:image/png;base64,${fakeBase64}`
      }
    };

    const report = await backupArchiveService.inspectBackup(JSON.stringify(corruptedBundle));
    assert.equal(report.isValid, false);
    assert.match(report.errors[0], /checksum mismatch/i);
  });

  it('restores enterprise relational tables, account balances, and journals accurately', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const sandboxConn = await pool.getConnection(`test_restore_ent_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(sandboxConn, [...MIGRATION_REGISTRY]);

    const testBundle: BackupArchiveBundle = {
      manifest: {
        archiveFormatVersion: '3.0.0',
        appName: 'Cocoon',
        appVersion: '0.0.1',
        schemaVersion: 9,
        backupId: 'ent_bkp_test',
        exportedAt: new Date().toISOString(),
        currencyMetadata: { baseCurrency: 'PKR', currencyScale: 100, decimalPlaces: 2 },
        checksum: 'chk_valid',
        attachmentCount: 0,
        recordCounts: { accounts: 2, journal_entries: 1, parties: 1 }
      },
      state: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [{ id: 'w-cash', name: 'Cash', type: 'cash', balance: 25000, color: '#10B981' }],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: { currencyCode: 'PKR', decimalPlaces: 2 }
      } as any,
      enterprise: {
        workspaces: [
          {
            id: 'ws_test_restore',
            name: 'Wholesale Depot',
            type: 'business',
            currency_code: 'PKR',
            is_active: 1,
            created_at: '2026-01-01',
            updated_at: '2026-01-01'
          }
        ],
        accounts: [
          {
            id: 'acc_ws_cash',
            workspace_id: 'ws_test_restore',
            account_code: '1010',
            name: 'Main Cash Register',
            type: 'asset',
            currency_code: 'PKR',
            is_system: 1,
            is_active: 1,
            created_at: '2026-01-01',
            updated_at: '2026-01-01'
          },
          {
            id: 'acc_ws_sales',
            workspace_id: 'ws_test_restore',
            account_code: '4000',
            name: 'Wholesale Sales Revenue',
            type: 'revenue',
            currency_code: 'PKR',
            is_system: 1,
            is_active: 1,
            created_at: '2026-01-01',
            updated_at: '2026-01-01'
          }
        ],
        parties: [
          {
            id: 'party_cust_01',
            workspace_id: 'ws_test_restore',
            name: 'Ahmed Brothers',
            type: 'customer',
            phone: '03001234567',
            email: 'ahmed@example.com',
            address: 'Lahore, Pakistan',
            credit_limit_scaled: 5000000,
            currency_code: 'PKR',
            is_active: 1,
            created_at: '2026-01-01',
            updated_at: '2026-01-01'
          }
        ],
        journalEntries: [
          {
            id: 'je_sale_01',
            workspace_id: 'ws_test_restore',
            entry_number: 'JE-2026-001',
            entry_date: '2026-01-10',
            description: 'Cash Sale Wholesale',
            source_type: 'pos_sale',
            source_id: 'pos_01',
            status: 'posted',
            is_posted: 1,
            created_at: '2026-01-10',
            updated_at: '2026-01-10'
          }
        ],
        journalLines: [
          {
            id: 'jl_01_dr',
            journal_entry_id: 'je_sale_01',
            account_id: 'acc_ws_cash',
            party_id: 'party_cust_01',
            debit_amount_scaled: 500000, // PKR 5,000.00
            credit_amount_scaled: 0,
            currency_code: 'PKR',
            description: 'Cash received',
            created_at: '2026-01-10'
          },
          {
            id: 'jl_01_cr',
            journal_entry_id: 'je_sale_01',
            account_id: 'acc_ws_sales',
            party_id: 'party_cust_01',
            debit_amount_scaled: 0,
            credit_amount_scaled: 500000, // PKR 5,000.00
            currency_code: 'PKR',
            description: 'Sales revenue recognized',
            created_at: '2026-01-10'
          }
        ]
      },
      attachments: {}
    };

    // Execute restore on connection
    const execResult = await backupArchiveService.executeRestore(testBundle, sandboxConn);
    assert.equal(execResult.success, true);

    // Verify restored records in database
    const restoredAccounts = await sandboxConn.query<{ account_code: string; name: string }>(
      'SELECT account_code, name FROM accounts WHERE workspace_id = ? ORDER BY account_code ASC',
      ['ws_test_restore']
    );
    assert.equal(restoredAccounts.length, 2);
    assert.equal(restoredAccounts[0].account_code, '1010');
    assert.equal(restoredAccounts[1].account_code, '4000');

    const restoredJournals = await sandboxConn.query<{ entry_number: string }>(
      'SELECT entry_number FROM journal_entries WHERE workspace_id = ?',
      ['ws_test_restore']
    );
    assert.equal(restoredJournals.length, 1);
    assert.equal(restoredJournals[0].entry_number, 'JE-2026-001');

    const restoredLines = await sandboxConn.query<{ debit_amount_scaled: number; credit_amount_scaled: number }>(
      'SELECT debit_amount_scaled, credit_amount_scaled FROM journal_lines WHERE journal_entry_id = ?',
      ['je_sale_01']
    );
    assert.equal(restoredLines.length, 2);
    assert.equal(Number(restoredLines[0].debit_amount_scaled), 500000);
    assert.equal(Number(restoredLines[1].credit_amount_scaled), 500000);

    await sandboxConn.close();
  });

  it('rolls back safely to prior database if an unexpected error occurs during restore', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const sandboxConn = await pool.getConnection(`test_rollback_safety_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(sandboxConn, [...MIGRATION_REGISTRY]);

    // Insert an initial state into sandbox
    await sandboxConn.run(
      `INSERT INTO wallets (id, name, type, balance, color)
       VALUES ('w_pre_restore', 'Original Safe Wallet', 'cash', 99999, '#10B981')`
    );

    // Prepare a malformed bundle whose journal lines intentionally violate foreign key constraint
    const malformedBundle: BackupArchiveBundle = {
      manifest: {
        archiveFormatVersion: '3.0.0',
        appName: 'Cocoon',
        appVersion: '0.0.1',
        schemaVersion: 9,
        backupId: 'fail_test',
        exportedAt: new Date().toISOString(),
        currencyMetadata: { baseCurrency: 'PKR', currencyScale: 100, decimalPlaces: 2 },
        checksum: 'chk',
        attachmentCount: 0,
        recordCounts: {}
      },
      state: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: {}
      } as any,
      enterprise: {
        journalLines: [
          {
            id: 'jl_bad_fk',
            journal_entry_id: 'non_existent_je_9999',
            account_id: 'non_existent_acc_9999',
            debit_amount_scaled: 100,
            credit_amount_scaled: 0,
            currency_code: 'PKR',
            created_at: '2026-01-01'
          }
        ]
      },
      attachments: {}
    };

    // Execution must fail and trigger rollback
    await assert.rejects(
      async () => {
        await backupArchiveService.executeRestore(malformedBundle, sandboxConn);
      },
      /Restore failed and was rolled back safely/i
    );

    // Prior original wallet MUST still exist untouched!
    const probe = await sandboxConn.query<{ name: string }>('SELECT name FROM wallets WHERE id = ?', ['w_pre_restore']);
    assert.equal(probe.length, 1);
    assert.equal(probe[0].name, 'Original Safe Wallet');

    await sandboxConn.close();
  });
});
