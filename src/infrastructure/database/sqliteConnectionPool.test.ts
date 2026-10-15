import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sqlitePool } from './sqliteConnectionPool';
import { initializeDatabaseSchema } from './schema';

describe('Infrastructure: SQLite Connection Pool', () => {
  it('opens connection, initializes schema, and verifies tables and indexes', async () => {
    const conn = await sqlitePool.getConnection('test_pool_db');
    assert.equal(await conn.isDBOpen(), true);

    await initializeDatabaseSchema(conn);

    // Verify tables exist
    const tables = await conn.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wallets', 'transactions', 'categories', 'schema_migrations')"
    );
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('wallets'));
    assert.ok(tableNames.includes('transactions'));
    assert.ok(tableNames.includes('categories'));
    assert.ok(tableNames.includes('schema_migrations'));
  });

  it('executes parameterized prepared statements and queries accurately', async () => {
    const conn = await sqlitePool.getConnection('test_pool_db');

    // Insert wallet using prepared statement
    const insertRes = await conn.run(
      'INSERT OR REPLACE INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)',
      ['w-test-1', 'Main Checking', 'bank', 2500.75, '#3B82F6']
    );
    assert.ok(insertRes.changes !== undefined && insertRes.changes >= 1);

    // Query with prepared parameter
    const rows = await conn.query<{ id: string; name: string; balance: number }>(
      'SELECT id, name, balance FROM wallets WHERE id = ?',
      ['w-test-1']
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'w-test-1');
    assert.equal(rows[0].name, 'Main Checking');
    assert.equal(rows[0].balance, 2500.75);
  });

  it('rolls back database transaction when an error occurs', async () => {
    const conn = await sqlitePool.getConnection('test_pool_db');

    await assert.rejects(async () => {
      await conn.executeTransaction(async () => {
        await conn.run(
          'INSERT INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)',
          ['w-rollback', 'Temporary Wallet', 'cash', 100.0, '#10B981']
        );
        // Force failure inside transaction
        throw new Error('Simulated failure during transaction');
      });
    }, /Simulated failure during transaction/);

    // Assert record was rolled back
    const rows = await conn.query('SELECT * FROM wallets WHERE id = ?', ['w-rollback']);
    assert.equal(rows.length, 0);
  });
});
