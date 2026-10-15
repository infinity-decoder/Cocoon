/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MigrationService } from './MigrationService';
import { Migration } from './types';
import { migration001 } from './001_initial_personal_finance';
import { migration002, DEFAULT_PERSONAL_WORKSPACE_ID } from './002_business_workspaces_ledger_parties';
import { SqliteConnectionPool } from '../sqliteConnectionPool';
import { DatabaseService } from '../DatabaseService';
import {
  WorkspaceRepository,
  AccountRepository,
  PartyRepository,
  JournalEntryRepository
} from '../repositories';

describe('Infrastructure: Database Schema & Migration Framework', () => {
  it('fresh database creation applies migrations 1 and 2 sequentially', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_fresh_db_${Date.now()}`);
    const migService = new MigrationService();

    const summary = await migService.runPendingMigrations(conn, [migration001, migration002]);

    assert.equal(summary.appliedCount, 2);
    assert.equal(summary.latestVersion, 2);

    // Verify applied migrations in schema_migrations
    const applied = await migService.getAppliedMigrations(conn);
    assert.equal(applied.length, 2);
    assert.equal(applied[0].version, 1);
    assert.equal(applied[0].name, '001_initial_personal_finance');
    assert.equal(applied[1].version, 2);
    assert.equal(applied[1].name, '002_business_workspaces_ledger_parties');

    // Verify default personal workspace and system accounts were seeded
    const wsRepo = new WorkspaceRepository(conn);
    const personalWs = await wsRepo.findById(DEFAULT_PERSONAL_WORKSPACE_ID);
    assert.notEqual(personalWs, null);
    assert.equal(personalWs?.name, 'Personal Workspace');
    assert.equal(personalWs?.type, 'personal');

    const accRepo = new AccountRepository(conn);
    const cashAcc = await accRepo.findByCode(DEFAULT_PERSONAL_WORKSPACE_ID, '1010');
    assert.notEqual(cashAcc, null);
    assert.equal(cashAcc?.name, 'Cash on Hand');
    assert.equal(cashAcc?.type, 'asset');
  });

  it('sequential migration: starts at version 1 and upgrades cleanly to version 2', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_sequential_db_${Date.now()}`);
    const migService = new MigrationService();

    // 1. Apply only version 1
    const summary1 = await migService.runPendingMigrations(conn, [migration001]);
    assert.equal(summary1.appliedCount, 1);
    assert.equal(summary1.latestVersion, 1);

    // Verify only 1 is recorded
    let applied = await migService.getAppliedMigrations(conn);
    assert.equal(applied.length, 1);

    // 2. Later, upgrade with migration 2
    const summary2 = await migService.runPendingMigrations(conn, [migration001, migration002]);
    assert.equal(summary2.appliedCount, 1); // Only migration 2 was pending
    assert.equal(summary2.latestVersion, 2);

    applied = await migService.getAppliedMigrations(conn);
    assert.equal(applied.length, 2);
    assert.equal(applied[1].version, 2);
  });

  it('a deliberately failed migration rolls back safely without corrupting schema_migrations', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_failed_rollback_${Date.now()}`);
    const migService = new MigrationService();

    // Step 1: Migration 1 succeeds
    await migService.runPendingMigrations(conn, [migration001]);

    // Step 2: Define a faulty migration 2 that throws halfway through
    const faultyMigration: Migration = {
      version: 2,
      name: '002_faulty_migration',
      async up(c) {
        await c.execute('CREATE TABLE temp_rollback_probe (id TEXT PRIMARY KEY);');
        await c.run('INSERT INTO temp_rollback_probe (id) VALUES (?)', ['probe_1']);
        // Deliberate failure
        throw new Error('Simulated disk I/O failure during table creation.');
      }
    };

    // Attempt migration run
    await assert.rejects(
      async () => {
        await migService.runPendingMigrations(conn, [migration001, faultyMigration]);
      },
      /Simulated disk I\/O failure/
    );

    // Verify rollback:
    // 1. schema_migrations must still only reflect version 1
    const applied = await migService.getAppliedMigrations(conn);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].version, 1);

    // 2. The temporary table from the failed migration must not exist or be committed
    const probeCheck = await conn.query("SELECT name FROM sqlite_master WHERE type='table' AND name='temp_rollback_probe';");
    assert.equal(probeCheck.length, 0);
  });

  it('enforces foreign key constraints strictly', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_fk_enforcement_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [migration001, migration002]);

    const partyRepo = new PartyRepository(conn);

    // Attempt to insert a party referencing a non-existent workspace ID
    await assert.rejects(
      async () => {
        await partyRepo.create({
          workspaceId: 'non_existent_workspace_id_9999',
          name: 'Invalid Party',
          type: 'customer',
          creditLimitScaled: 50000000n,
          currencyCode: 'PKR',
          isActive: true
        });
      },
      /FOREIGN KEY constraint failed/i
    );
  });

  it('enforces unique constraints on business identifiers (e.g. workspace account codes)', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_unique_enforcement_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [migration001, migration002]);

    const accRepo = new AccountRepository(conn);

    // Code '1010' already exists for DEFAULT_PERSONAL_WORKSPACE_ID
    await assert.rejects(
      async () => {
        await accRepo.create({
          workspaceId: DEFAULT_PERSONAL_WORKSPACE_ID,
          accountCode: '1010', // Duplicate code in same workspace
          name: 'Duplicate Cash Account',
          type: 'asset',
          currencyCode: 'PKR',
          isSystem: false,
          isActive: true
        });
      },
      /UNIQUE constraint failed/i
    );
  });

  it('enforces check constraints on financial amounts and double-entry debits/credits', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_check_enforcement_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [migration001, migration002]);

    const journalRepo = new JournalEntryRepository(conn);

    // Attempting to create an unbalanced journal entry throws domain validation error
    await assert.rejects(
      async () => {
        await journalRepo.createWithLines(
          {
            workspaceId: DEFAULT_PERSONAL_WORKSPACE_ID,
            entryNumber: 'JE-2026-001',
            entryDate: '2026-10-15',
            description: 'Unbalanced Journal Entry'
          },
          [
            {
              accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_1010`,
              debitAmountScaled: 1000000n, // 100 PKR debit
              creditAmountScaled: 0n
            },
            {
              accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_4000`,
              debitAmountScaled: 0n,
              creditAmountScaled: 500000n // 50 PKR credit (unbalanced!)
            }
          ]
        );
      },
      /Journal entry is unbalanced/
    );

    // Direct SQL attempt violating CHECK((debit_amount_scaled > 0 AND credit_amount_scaled = 0)...)
    const validEntry = await journalRepo.createWithLines(
      {
        workspaceId: DEFAULT_PERSONAL_WORKSPACE_ID,
        entryNumber: 'JE-CHECK-001',
        entryDate: '2026-10-15',
        description: 'Valid Entry for Check Probe'
      },
      [
        {
          accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_1010`,
          debitAmountScaled: 100000n,
          creditAmountScaled: 0n
        },
        {
          accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_4000`,
          debitAmountScaled: 0n,
          creditAmountScaled: 100000n
        }
      ]
    );

    await assert.rejects(
      async () => {
        await conn.run(
          `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            'jl_invalid_both',
            validEntry.id,
            `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_1010`,
            100000,
            100000, // Both debit and credit are non-zero, violating the CHECK constraint!
            '2026-10-15T00:00:00Z'
          ]
        );
      },
      /CHECK constraint failed/i
    );
  });

  it('guarantees single-flight concurrent initialization without race conditions', async () => {
    const dbName = `test_concurrent_singleflight_${Date.now()}`;
    const pool = SqliteConnectionPool.getInstance();
    const migService = new MigrationService();
    const service = new DatabaseService(pool, migService, dbName);

    // Simulate 10 simultaneous React components calling getInitializedConnection at the exact same millisecond
    const callers = Array.from({ length: 10 }, () => service.getInitializedConnection());
    const connections = await Promise.all(callers);

    // All callers must receive an active, open connection
    for (const conn of connections) {
      const isOpen = await conn.isDBOpen();
      assert.equal(isOpen, true);
    }

    // Verify migrations were applied exactly once (not duplicated)
    const applied = await migService.getAppliedMigrations(connections[0]);
    assert.equal(applied.length, 2);
  });

  it('runs sanitized health-check diagnostic without leaking sensitive data', async () => {
    const dbName = `test_health_diag_${Date.now()}`;
    const pool = SqliteConnectionPool.getInstance();
    const migService = new MigrationService();
    const service = new DatabaseService(pool, migService, dbName);

    const diagnostic = await service.checkHealth();

    assert.equal(diagnostic.isHealthy, true);
    assert.equal(diagnostic.status, 'healthy');
    assert.equal(diagnostic.integrityCheckPassed, true);
    assert.equal(diagnostic.foreignKeysEnforced, true);
    assert.equal(diagnostic.appliedMigrationsCount, 2);
    assert.equal(diagnostic.latestMigrationVersion, 2);
    assert.equal(typeof diagnostic.timestamp, 'string');
    assert.equal(typeof diagnostic.journalMode, 'string');
  });

  it('persists and retrieves double-entry journal entries using integer-scaled Money units', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_double_entry_money_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, [migration001, migration002]);

    const journalRepo = new JournalEntryRepository(conn);
    const partyRepo = new PartyRepository(conn);

    // Create a customer party with 50,000.00 PKR credit limit (500,000,000 scaled units)
    const customer = await partyRepo.create({
      workspaceId: DEFAULT_PERSONAL_WORKSPACE_ID,
      name: 'Ahmed Trading Corp',
      type: 'customer',
      phone: '03001234567',
      creditLimitScaled: 500000000n, // 50,000.00 PKR
      currencyCode: 'PKR',
      isActive: true
    });

    assert.equal(customer.creditLimitScaled, 500000000n);

    // Record a sale: Debit Accounts Receivable (1200) 25,000.00 PKR, Credit Sales Revenue (4000) 25,000.00 PKR
    const saleAmountScaled = 250000000n; // 25,000.00 PKR
    const entry = await journalRepo.createWithLines(
      {
        workspaceId: DEFAULT_PERSONAL_WORKSPACE_ID,
        entryNumber: 'INV-2026-0001',
        entryDate: '2026-10-15',
        description: 'Credit Sale to Ahmed Trading Corp',
        referenceType: 'sale',
        referenceId: 'inv-101'
      },
      [
        {
          accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_1200`,
          debitAmountScaled: saleAmountScaled,
          creditAmountScaled: 0n,
          partyId: customer.id,
          description: 'A/R Customer Invoice'
        },
        {
          accountId: `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_4000`,
          debitAmountScaled: 0n,
          creditAmountScaled: saleAmountScaled,
          description: 'Sales Revenue'
        }
      ]
    );

    assert.equal(entry.entryNumber, 'INV-2026-0001');
    assert.equal(entry.lines.length, 2);

    // Retrieve by ID
    const retrieved = await journalRepo.findById(entry.id);
    assert.notEqual(retrieved, null);
    const arLine = retrieved?.lines.find(l => l.accountId.endsWith('1200'));
    const revLine = retrieved?.lines.find(l => l.accountId.endsWith('4000'));
    assert.equal(arLine?.debitAmountScaled, saleAmountScaled);
    assert.equal(revLine?.creditAmountScaled, saleAmountScaled);
    assert.equal(arLine?.partyId, customer.id);
  });
});
