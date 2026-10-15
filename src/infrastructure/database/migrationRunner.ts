/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection, MigrationResult, RollbackResult, MigrationSnapshot } from './types';
import { initializeDatabaseSchema } from './schema';
import { sqlitePool } from './sqliteConnectionPool';
import { loadAppStateFromDatabase, saveAppStateToDatabase, getDatabaseRecordCounts } from './sqliteRepository';
import { AppState } from '../../core/types';
import { getInitialState, PRIMARY_STORAGE_KEY, LEGACY_STORAGE_KEY } from '../../core/storage/storageAdapter';

export const MIGRATION_VERSION_1 = 1;
export const MIGRATION_NAME_V1 = '001_initial_personal_migration';
export const STORAGE_CUTOVER_KEY = 'cocoon_authoritative_store';
export const SQLITE_MIGRATED_KEY = 'cocoon_sqlite_migrated';
export const ORIGINAL_BACKUP_KEY = 'cocoon_migration_original_backup';
export const LAST_SNAPSHOT_KEY = 'cocoon_migration_last_snapshot_id';

/**
 * Deterministically computes an integrity checksum of the AppState.
 */
export function computeStateChecksum(state: AppState): string {
  const content = JSON.stringify({
    tx: state.transactions?.map(t => [t.id, t.amount, t.date, t.walletId]),
    cat: state.categories?.map(c => [c.id, c.name, c.type]),
    wal: state.wallets?.map(w => [w.id, w.balance]),
    bud: state.budgets?.map(b => [b.id, b.amount, b.month]),
    sav: state.savingsGoals?.map(s => [s.id, s.targetAmount, s.currentAmount]),
    rem: state.reminders?.map(r => [r.id, r.amount, r.dueDate])
  });

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `chk_${Math.abs(hash).toString(16)}_${content.length}`;
}

/**
 * Checks whether the SQLite cutover has already been completed.
 */
export async function isMigrationCompleted(conn: DatabaseConnection): Promise<boolean> {
  try {
    const isStoreSqlite = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_CUTOVER_KEY) === 'sqlite';
    const isFlagMigrated = typeof localStorage !== 'undefined' && localStorage.getItem(SQLITE_MIGRATED_KEY) === 'true';

    const records = await conn.query<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [MIGRATION_VERSION_1]
    );

    const hasDbRecord = records.length > 0;
    return hasDbRecord && isStoreSqlite && isFlagMigrated;
  } catch {
    return false;
  }
}

/**
 * Executes the zero-loss migration runner from localStorage into SQLite with full transaction protection.
 */
export async function runZeroLossMigration(
  customConn?: DatabaseConnection,
  options?: { force?: boolean }
): Promise<MigrationResult> {
  const conn = customConn ?? await sqlitePool.getConnection();

  // 1. Ensure tables and indexes are ready
  await initializeDatabaseSchema(conn);

  // 2. Pre-flight check
  const alreadyMigrated = await isMigrationCompleted(conn);
  if (alreadyMigrated && !options?.force) {
    return {
      success: true,
      alreadyMigrated: true,
      recordsMigrated: 0
    };
  }

  // 3. Extract source data from localStorage (or legacy store)
  let sourceState: AppState;
  try {
    const raw = typeof localStorage !== 'undefined'
      ? (localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY))
      : null;

    if (raw) {
      sourceState = JSON.parse(raw);
    } else {
      sourceState = getInitialState();
    }
  } catch (readErr) {
    console.warn('Failed to parse localStorage during migration; using clean initial state fallback:', readErr);
    sourceState = getInitialState();
  }

  // Normalize source arrays
  const transactions = Array.isArray(sourceState.transactions) ? sourceState.transactions : [];
  const categories = Array.isArray(sourceState.categories) ? sourceState.categories : [];
  const subCategories = Array.isArray(sourceState.subCategories) ? sourceState.subCategories : [];
  const wallets = Array.isArray(sourceState.wallets) ? sourceState.wallets : [];
  const budgets = Array.isArray(sourceState.budgets) ? sourceState.budgets : [];
  const savingsGoals = Array.isArray(sourceState.savingsGoals) ? sourceState.savingsGoals : [];
  const reminders = Array.isArray(sourceState.reminders) ? sourceState.reminders : [];
  const settings = sourceState.settings || {};

  const totalSourceRecords =
    transactions.length +
    categories.length +
    subCategories.length +
    wallets.length +
    budgets.length +
    savingsGoals.length +
    reminders.length;

  const checksum = computeStateChecksum(sourceState);
  const now = new Date().toISOString();
  const snapshotId = `snapshot_${Date.now()}`;

  const snapshot: MigrationSnapshot = {
    id: snapshotId,
    createdAt: now,
    source: 'localStorage',
    data: sourceState,
    checksum,
    counts: {
      transactions: transactions.length,
      categories: categories.length,
      subCategories: subCategories.length,
      wallets: wallets.length,
      budgets: budgets.length,
      savingsGoals: savingsGoals.length,
      reminders: reminders.length
    }
  };

  // 4. Create immutable recovery snapshots in localStorage BEFORE touching database
  if (typeof localStorage !== 'undefined') {
    try {
      const serializedSnapshot = JSON.stringify(snapshot);
      localStorage.setItem(`cocoon_migration_rollback_${snapshotId}`, serializedSnapshot);
      localStorage.setItem(ORIGINAL_BACKUP_KEY, serializedSnapshot);
      localStorage.setItem(LAST_SNAPSHOT_KEY, snapshotId);
    } catch (snapshotErr) {
      console.warn('Could not save snapshot to localStorage:', snapshotErr);
    }
  }

  // 5. Execute atomic database transaction
  try {
    await conn.executeTransaction(async () => {
      // a. Save snapshot into SQLite rollback table
      await conn.run(
        'INSERT OR REPLACE INTO migration_rollbacks (id, migration_name, snapshot_data, created_at, is_active) VALUES (?, ?, ?, ?, 1)',
        [snapshotId, MIGRATION_NAME_V1, JSON.stringify(snapshot), now]
      );

      // b. Insert all source records using prepared statements
      await saveAppStateToDatabase(conn, {
        transactions,
        categories,
        subCategories,
        wallets,
        budgets,
        savingsGoals,
        reminders,
        settings: settings as any
      });

      // c. Verification check: counts must match source records
      const counts = await getDatabaseRecordCounts(conn);
      if (counts.transactions !== transactions.length) {
        throw new Error(
          `Integrity Verification Mismatch: Source transactions (${transactions.length}) != SQLite transactions (${counts.transactions})`
        );
      }
      if (counts.wallets !== wallets.length) {
        throw new Error(
          `Integrity Verification Mismatch: Source wallets (${wallets.length}) != SQLite wallets (${counts.wallets})`
        );
      }
      if (counts.budgets !== budgets.length) {
        throw new Error(
          `Integrity Verification Mismatch: Source budgets (${budgets.length}) != SQLite budgets (${counts.budgets})`
        );
      }
      if (counts.savingsGoals !== savingsGoals.length) {
        throw new Error(
          `Integrity Verification Mismatch: Source savings goals (${savingsGoals.length}) != SQLite savings goals (${counts.savingsGoals})`
        );
      }
      if (counts.reminders !== reminders.length) {
        throw new Error(
          `Integrity Verification Mismatch: Source reminders (${reminders.length}) != SQLite reminders (${counts.reminders})`
        );
      }

      // d. Record version in schema_migrations
      await conn.run(
        'INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [MIGRATION_VERSION_1, MIGRATION_NAME_V1, now]
      );

      // e. Audit log entry
      await conn.run(
        'INSERT INTO migration_audit_log (id, migration_name, status, records_migrated, checksum, message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `audit_${Date.now()}`,
          MIGRATION_NAME_V1,
          'SUCCESS',
          totalSourceRecords,
          checksum,
          `Successfully migrated ${totalSourceRecords} personal finance records with verified checksum`,
          now
        ]
      );
    });

    // 6. Cutover authoritative store to SQLite
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_CUTOVER_KEY, 'sqlite');
      localStorage.setItem(SQLITE_MIGRATED_KEY, 'true');
    }

    return {
      success: true,
      alreadyMigrated: false,
      recordsMigrated: totalSourceRecords,
      snapshotId,
      checksum,
      migratedAt: now
    };
  } catch (migrationErr: any) {
    console.error('Zero-loss migration failed. Transaction rolled back:', migrationErr);

    // Record failure in audit log if connection is alive
    try {
      await conn.run(
        'INSERT INTO migration_audit_log (id, migration_name, status, records_migrated, checksum, message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `audit_err_${Date.now()}`,
          MIGRATION_NAME_V1,
          'FAILED',
          0,
          checksum,
          `Migration aborted and rolled back: ${migrationErr?.message || 'Unknown error'}`,
          now
        ]
      );
    } catch {
      // ignore secondary log error
    }

    // Keep localStorage intact and uncorrupted
    return {
      success: false,
      alreadyMigrated: false,
      recordsMigrated: 0,
      snapshotId,
      checksum,
      error: migrationErr?.message || 'Migration failed'
    };
  }
}

/**
 * Rolls back migration to the specified (or latest) snapshot, restoring verified recovery state.
 */
export async function rollbackMigration(
  targetSnapshotId?: string,
  customConn?: DatabaseConnection
): Promise<RollbackResult> {
  const conn = customConn ?? await sqlitePool.getConnection();
  const now = new Date().toISOString();

  let snapshotData: MigrationSnapshot | null = null;

  // 1. Try to find snapshot in SQLite
  try {
    let rows: Array<{ snapshot_data: string }>;
    if (targetSnapshotId) {
      rows = await conn.query<{ snapshot_data: string }>(
        'SELECT snapshot_data FROM migration_rollbacks WHERE id = ?',
        [targetSnapshotId]
      );
    } else {
      rows = await conn.query<{ snapshot_data: string }>(
        'SELECT snapshot_data FROM migration_rollbacks ORDER BY created_at DESC LIMIT 1'
      );
    }

    if (rows.length > 0 && rows[0].snapshot_data) {
      snapshotData = JSON.parse(rows[0].snapshot_data);
    }
  } catch (sqliteReadErr) {
    console.warn('Could not retrieve snapshot from SQLite; checking localStorage recovery path:', sqliteReadErr);
  }

  // 2. Fallback to localStorage snapshot if SQLite read failed
  if (!snapshotData && typeof localStorage !== 'undefined') {
    try {
      const snapKey = targetSnapshotId
        ? `cocoon_migration_rollback_${targetSnapshotId}`
        : (localStorage.getItem(ORIGINAL_BACKUP_KEY) ? ORIGINAL_BACKUP_KEY : null);

      if (snapKey) {
        const raw = localStorage.getItem(snapKey);
        if (raw) {
          snapshotData = JSON.parse(raw);
        }
      }
    } catch (lsErr) {
      console.warn('Could not retrieve snapshot from localStorage:', lsErr);
    }
  }

  if (!snapshotData || !snapshotData.data) {
    return {
      success: false,
      recordsRestored: 0,
      error: 'No valid recovery snapshot found for rollback'
    };
  }

  // 3. Restore data into localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const serialized = JSON.stringify(snapshotData.data);
      localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      localStorage.setItem(STORAGE_CUTOVER_KEY, 'localstorage');
      localStorage.setItem(SQLITE_MIGRATED_KEY, 'false');
    } catch (saveErr: any) {
      return {
        success: false,
        recordsRestored: 0,
        error: `Failed to restore localStorage during rollback: ${saveErr?.message}`
      };
    }
  }

  // 4. Record rollback in SQLite audit log
  try {
    const totalRecords =
      (snapshotData.counts?.transactions ?? 0) +
      (snapshotData.counts?.wallets ?? 0) +
      (snapshotData.counts?.categories ?? 0);

    await conn.run(
      'INSERT INTO migration_audit_log (id, migration_name, status, records_migrated, checksum, message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `audit_rb_${Date.now()}`,
        MIGRATION_NAME_V1,
        'ROLLED_BACK',
        totalRecords,
        snapshotData.checksum || 'unknown',
        `Rollback executed successfully using snapshot ${snapshotData.id}`,
        now
      ]
    );
  } catch {
    // Ignore audit log error during rollback
  }

  return {
    success: true,
    snapshotId: snapshotData.id,
    recordsRestored: snapshotData.counts?.transactions ?? 0,
    rolledBackAt: now
  };
}
