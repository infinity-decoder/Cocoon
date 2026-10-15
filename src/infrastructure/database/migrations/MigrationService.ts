/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { AppliedMigration, Migration, MigrationExecutionResult, MigrationSummary } from './types';
import { MIGRATION_REGISTRY } from './MigrationRegistry';

export class MigrationService {
  /**
   * Ensures the schema_migrations bookkeeping table exists.
   */
  public async ensureMigrationsTable(conn: DatabaseConnection): Promise<void> {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  /**
   * Retrieves all applied migration records ordered by version.
   */
  public async getAppliedMigrations(conn: DatabaseConnection): Promise<AppliedMigration[]> {
    await this.ensureMigrationsTable(conn);
    const rows = await conn.query<{ version: number; name: string; applied_at: string }>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
    );
    return rows.map(r => ({
      version: Number(r.version),
      name: r.name,
      appliedAt: r.applied_at
    }));
  }

  /**
   * Returns list of migrations that have not yet been applied.
   */
  public async getPendingMigrations(
    conn: DatabaseConnection,
    registry: readonly Migration[] = MIGRATION_REGISTRY
  ): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations(conn);
    const appliedVersions = new Set(applied.map(a => a.version));
    return registry.filter(m => !appliedVersions.has(m.version));
  }

  /**
   * Executes all pending migrations sequentially inside isolated database transactions.
   * If any migration fails, its transaction rolls back completely and execution halts.
   */
  public async runPendingMigrations(
    conn: DatabaseConnection,
    registry: readonly Migration[] = MIGRATION_REGISTRY
  ): Promise<MigrationSummary> {
    await this.ensureMigrationsTable(conn);
    const pending = await this.getPendingMigrations(conn, registry);
    const results: MigrationExecutionResult[] = [];

    for (const migration of pending) {
      const startTime = Date.now();
      try {
        await conn.executeTransaction(async txConn => {
          // 1. Run migration up statements
          await migration.up(txConn);

          // 2. Record successful migration in schema_migrations
          const now = new Date().toISOString();
          await txConn.run(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
            [migration.version, migration.name, now]
          );

          // 3. Record audit log if audit table exists
          try {
            await txConn.run(
              'INSERT INTO migration_audit_log (id, migration_name, status, records_migrated, checksum, message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                `mig_${migration.version}_${Date.now()}`,
                migration.name,
                'SUCCESS',
                0,
                'N/A',
                `Migration ${migration.version} (${migration.name}) applied successfully.`,
                now
              ]
            );
          } catch {
            // Non-fatal if migration_audit_log is created later
          }
        });

        results.push({
          success: true,
          version: migration.version,
          name: migration.name,
          durationMs: Date.now() - startTime
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          success: false,
          version: migration.version,
          name: migration.name,
          durationMs: Date.now() - startTime,
          error: errorMsg
        });

        throw new Error(
          `Migration failed at version ${migration.version} (${migration.name}): ${errorMsg}. Transaction was rolled back safely.`
        );
      }
    }

    const applied = await this.getAppliedMigrations(conn);
    const latestVersion = applied.length > 0 ? applied[applied.length - 1].version : 0;

    return {
      appliedCount: results.filter(r => r.success).length,
      latestVersion,
      results
    };
  }
}

export const migrationService = new MigrationService();
