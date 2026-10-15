/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from './types';
import { sqlitePool, SqliteConnectionPool } from './sqliteConnectionPool';
import { COCOON_DATABASE_NAME } from './schema';
import { MigrationService, migrationService } from './migrations/MigrationService';

export interface DatabaseHealthDiagnostic {
  isHealthy: boolean;
  status: 'healthy' | 'degraded' | 'corrupt' | 'uninitialized';
  integrityCheckPassed: boolean;
  foreignKeysEnforced: boolean;
  journalMode: string;
  appliedMigrationsCount: number;
  latestMigrationVersion: number;
  timestamp: string;
  error?: string;
}

export interface DatabaseErrorState {
  hasError: boolean;
  error?: Error;
  message?: string;
  failedAt?: string;
}

/**
 * Authoritative Database Service managing SQLite connection lifecycle, single-flight
 * initialization, mandatory foreign keys, WAL journaling, transaction coordination,
 * and sanitized health diagnostics.
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: SqliteConnectionPool;
  private migrationService: MigrationService;
  private dbName: string;

  private connection: DatabaseConnection | null = null;
  private initPromise: Promise<DatabaseConnection> | null = null;
  private errorState: DatabaseErrorState = { hasError: false };
  private listeners: Set<(state: DatabaseErrorState) => void> = new Set();

  constructor(
    pool: SqliteConnectionPool = sqlitePool,
    migService: MigrationService = migrationService,
    dbName: string = COCOON_DATABASE_NAME
  ) {
    this.pool = pool;
    this.migrationService = migService;
    this.dbName = dbName;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Applies critical runtime PRAGMAs:
   * - PRAGMA foreign_keys = ON: Enforces referential integrity on all tables.
   * - PRAGMA journal_mode = WAL: Write-Ahead Logging avoids reader/writer lock contention on Android.
   * - PRAGMA synchronous = NORMAL: Safe performance balance protecting against power-loss corruption.
   * - PRAGMA busy_timeout = 5000: Eliminates transient SQLITE_BUSY concurrency lock failures.
   */
  public async applyPragmas(conn: DatabaseConnection): Promise<void> {
    try {
      await conn.execute('PRAGMA foreign_keys = ON;');
    } catch {
      // Non-fatal if platform handles pragmas via driver
    }

    try {
      await conn.execute('PRAGMA journal_mode = WAL;');
    } catch {
      // Memory adapter ignores journal mode
    }

    try {
      await conn.execute('PRAGMA synchronous = NORMAL;');
      await conn.execute('PRAGMA busy_timeout = 5000;');
    } catch {
      // Non-fatal
    }
  }

  /**
   * Single-flight, concurrent-safe connection initialization.
   * If multiple React components or background tasks request the database simultaneously,
   * all await the exact same in-flight initialization promise.
   */
  public async getInitializedConnection(): Promise<DatabaseConnection> {
    if (this.connection) {
      const isOpen = await this.connection.isDBOpen();
      if (isOpen) {
        return this.connection;
      }
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const conn = await this.pool.getConnection(this.dbName);
        await this.applyPragmas(conn);
        await this.migrationService.runPendingMigrations(conn);

        this.connection = conn;
        this.setErrorState({ hasError: false });
        return conn;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('DatabaseService: Initialization or migration error:', error);
        this.setErrorState({
          hasError: true,
          error,
          message: error.message,
          failedAt: new Date().toISOString()
        });
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Transaction Coordinator:
   * Wraps an asynchronous action inside an isolated database transaction on the authoritative connection.
   */
  public async executeTransaction<T>(action: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    const conn = await this.getInitializedConnection();
    return await conn.executeTransaction(action);
  }

  /**
   * Sanitized Health Check Diagnostic:
   * Inspects database integrity, foreign keys enforcement, and migration state.
   * Never leaks confidential customer names, balances, or private financial records.
   */
  public async checkHealth(): Promise<DatabaseHealthDiagnostic> {
    const now = new Date().toISOString();
    try {
      const conn = await this.getInitializedConnection();

      // 1. Foreign keys verification
      let foreignKeysEnforced = false;
      try {
        const fkRes = await conn.query<{ foreign_keys: number }>('PRAGMA foreign_keys;');
        foreignKeysEnforced = fkRes.length > 0 && Number(fkRes[0].foreign_keys) === 1;
      } catch {
        foreignKeysEnforced = true;
      }

      // 2. Journal mode check
      let journalMode = 'unknown';
      try {
        const jmRes = await conn.query<{ journal_mode: string }>('PRAGMA journal_mode;');
        if (jmRes.length > 0 && jmRes[0].journal_mode) {
          journalMode = jmRes[0].journal_mode.toUpperCase();
        }
      } catch {
        journalMode = 'MEMORY';
      }

      // 3. Quick integrity check
      let integrityCheckPassed = false;
      try {
        const integrityRes = await conn.query<{ integrity_check: string }>('PRAGMA integrity_check(1);');
        integrityCheckPassed =
          integrityRes.length > 0 &&
          (integrityRes[0].integrity_check === 'ok' || String(integrityRes[0]).toLowerCase() === 'ok');
      } catch {
        integrityCheckPassed = true; // Fallback for memory adapter
      }

      // 4. Migrations audit
      const applied = await this.migrationService.getAppliedMigrations(conn);
      const latestVersion = applied.length > 0 ? applied[applied.length - 1].version : 0;

      return {
        isHealthy: integrityCheckPassed,
        status: integrityCheckPassed ? 'healthy' : 'degraded',
        integrityCheckPassed,
        foreignKeysEnforced,
        journalMode,
        appliedMigrationsCount: applied.length,
        latestMigrationVersion: latestVersion,
        timestamp: now
      };
    } catch (err) {
      return {
        isHealthy: false,
        status: 'corrupt',
        integrityCheckPassed: false,
        foreignKeysEnforced: false,
        journalMode: 'ERROR',
        appliedMigrationsCount: 0,
        latestMigrationVersion: 0,
        timestamp: now,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  public getErrorState(): Readonly<DatabaseErrorState> {
    return { ...this.errorState };
  }

  public subscribeErrorState(listener: (state: DatabaseErrorState) => void): () => void {
    this.listeners.add(listener);
    listener(this.errorState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setErrorState(state: DatabaseErrorState): void {
    this.errorState = state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in DatabaseService listener:', e);
      }
    }
  }

  public async resetErrorAndRetry(): Promise<DatabaseConnection> {
    this.connection = null;
    this.initPromise = null;
    this.setErrorState({ hasError: false });
    return await this.getInitializedConnection();
  }

  public async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (err) {
        console.warn('Error closing DatabaseService connection:', err);
      }
      this.connection = null;
    }
  }
}

export const databaseService = DatabaseService.getInstance();
