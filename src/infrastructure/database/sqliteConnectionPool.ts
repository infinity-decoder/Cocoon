/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DatabaseConnection, RunResult } from './types';
import { COCOON_DATABASE_NAME } from './schema';

/**
 * Adapter wrapping Capacitor SQLite plugin's SQLiteDBConnection.
 */
class CapacitorSqliteConnectionAdapter implements DatabaseConnection {
  private db: SQLiteDBConnection;

  constructor(db: SQLiteDBConnection) {
    this.db = db;
  }

  async open(): Promise<void> {
    const openRes = await this.db.isDBOpen();
    if (!openRes.result) {
      await this.db.open();
    }
    await this.db.execute('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  }

  async close(): Promise<void> {
    const openRes = await this.db.isDBOpen();
    if (openRes.result) {
      await this.db.close();
    }
  }

  async isDBOpen(): Promise<boolean> {
    const res = await this.db.isDBOpen();
    return !!res.result;
  }

  async execute(statements: string): Promise<void> {
    await this.db.execute(statements);
  }

  async run(statement: string, values?: any[]): Promise<RunResult> {
    const res = await this.db.run(statement, values ?? []);
    return {
      changes: res.changes?.changes,
      lastId: res.changes?.lastId
    };
  }

  async query<T = any>(statement: string, values?: any[]): Promise<T[]> {
    const res = await this.db.query(statement, values ?? []);
    return (res.values as T[]) ?? [];
  }

  async beginTransaction(): Promise<void> {
    await this.db.beginTransaction();
  }

  async commitTransaction(): Promise<void> {
    await this.db.commitTransaction();
  }

  async rollbackTransaction(): Promise<void> {
    await this.db.rollbackTransaction();
  }

  async isTransactionActive(): Promise<boolean> {
    const res = await this.db.isTransactionActive();
    return !!res.result;
  }

  async executeTransaction<T>(action: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    const alreadyActive = await this.isTransactionActive();
    if (alreadyActive) {
      return await action(this);
    }

    await this.beginTransaction();
    try {
      const result = await action(this);
      await this.commitTransaction();
      return result;
    } catch (err) {
      try {
        await this.rollbackTransaction();
      } catch (rollbackErr) {
        console.error('Error during transaction rollback:', rollbackErr);
      }
      throw err;
    }
  }
}

/**
 * Node.js SQLite adapter utilizing Node 22's native DatabaseSync.
 * Used during automated test runs, CI environments, and SSR/local scripts.
 */
class NodeSqliteConnectionAdapter implements DatabaseConnection {
  private dbInstance: any = null;
  private inTransaction: boolean = false;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.dbInstance) {
      // Dynamic import of node:sqlite to prevent bundler errors on client-side builds
      const { DatabaseSync } = await import('node:sqlite');
      this.dbInstance = new DatabaseSync(':memory:');
      this.dbInstance.exec('PRAGMA foreign_keys = ON;');
    }
  }

  async open(): Promise<void> {
    await this.ensureInitialized();
  }

  async close(): Promise<void> {
    if (this.dbInstance) {
      try {
        this.dbInstance.close();
      } catch {
        // closed
      }
      this.dbInstance = null;
    }
  }

  async isDBOpen(): Promise<boolean> {
    return this.dbInstance !== null;
  }

  async execute(statements: string): Promise<void> {
    await this.ensureInitialized();
    this.dbInstance.exec(statements);
  }

  async run(statement: string, values?: any[]): Promise<RunResult> {
    await this.ensureInitialized();
    const stmt = this.dbInstance.prepare(statement);
    const result = stmt.run(...(values ?? []));
    return {
      changes: Number(result.changes),
      lastId: Number(result.lastInsertRowid)
    };
  }

  async query<T = any>(statement: string, values?: any[]): Promise<T[]> {
    await this.ensureInitialized();
    const stmt = this.dbInstance.prepare(statement);
    const rows = stmt.all(...(values ?? []));
    return rows as T[];
  }

  async beginTransaction(): Promise<void> {
    await this.ensureInitialized();
    this.dbInstance.exec('BEGIN TRANSACTION;');
    this.inTransaction = true;
  }

  async commitTransaction(): Promise<void> {
    await this.ensureInitialized();
    this.dbInstance.exec('COMMIT;');
    this.inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    await this.ensureInitialized();
    this.dbInstance.exec('ROLLBACK;');
    this.inTransaction = false;
  }

  async isTransactionActive(): Promise<boolean> {
    return this.inTransaction;
  }

  async executeTransaction<T>(action: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    const alreadyActive = await this.isTransactionActive();
    if (alreadyActive) {
      return await action(this);
    }

    await this.beginTransaction();
    try {
      const result = await action(this);
      await this.commitTransaction();
      return result;
    } catch (err) {
      try {
        await this.rollbackTransaction();
      } catch {
        // Ignore secondary rollback error
      }
      throw err;
    }
  }
}

/**
 * In-memory / Mock fallback connection for standard web preview when native SQLite is absent.
 */
export class MemoryDatabaseAdapter implements DatabaseConnection {
  private isOpen: boolean = false;
  private inTransaction: boolean = false;
  private tables: Map<string, Map<string, any>> = new Map();
  private settings: Map<string, string> = new Map();

  private snapshotTables: Map<string, Map<string, any>> | null = null;
  private snapshotSettings: Map<string, string> | null = null;

  async open(): Promise<void> {
    this.isOpen = true;
  }

  async close(): Promise<void> {
    this.isOpen = false;
  }

  async isDBOpen(): Promise<boolean> {
    return this.isOpen;
  }

  async execute(statements: string): Promise<void> {
    this.isOpen = true;
    const createMatches = statements.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
    for (const match of createMatches) {
      if (!this.tables.has(match[1].toLowerCase())) {
        this.tables.set(match[1].toLowerCase(), new Map());
      }
    }

    // Support DELETE statements in batch execute
    const deleteMatches = statements.matchAll(/DELETE\s+FROM\s+(\w+)/gi);
    for (const match of deleteMatches) {
      const tableName = match[1].toLowerCase();
      if (this.tables.has(tableName)) {
        this.tables.get(tableName)!.clear();
      }
    }
  }

  async run(statement: string, values?: any[]): Promise<RunResult> {
    this.isOpen = true;
    const v = values ?? [];
    const trimmed = statement.trim();

    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+wallets/i.test(trimmed)) {
      const table = this.getTable('wallets');
      table.set(v[0], { id: v[0], name: v[1], type: v[2], balance: v[3], color: v[4] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+categories/i.test(trimmed)) {
      const table = this.getTable('categories');
      table.set(v[0], {
        id: v[0],
        name: v[1],
        type: v[2],
        icon: v[3],
        color: v[4],
        parent_id: v[5],
        is_custom: v[6],
        is_enabled: v[7]
      });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+transactions/i.test(trimmed)) {
      const table = this.getTable('transactions');
      table.set(v[0], {
        id: v[0],
        type: v[1],
        amount: v[2],
        currency: v[3],
        date: v[4],
        note: v[5],
        category: v[6],
        sub_category: v[7],
        wallet_id: v[8],
        to_wallet_id: v[9],
        payment_method: v[10],
        attachment: v[11],
        is_recurring: v[12],
        recurrence: v[13],
        savings_goal_id: v[14]
      });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+budgets/i.test(trimmed)) {
      const table = this.getTable('budgets');
      table.set(v[0], { id: v[0], category_id: v[1], amount: v[2], month: v[3], rollover: v[4] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+savings_goals/i.test(trimmed)) {
      const table = this.getTable('savings_goals');
      table.set(v[0], { id: v[0], name: v[1], target_amount: v[2], current_amount: v[3], color: v[4], deadline: v[5] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+bill_reminders/i.test(trimmed)) {
      const table = this.getTable('bill_reminders');
      table.set(v[0], { id: v[0], title: v[1], amount: v[2], due_date: v[3], category_id: v[4], is_paid: v[5], recurrence: v[6] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+app_settings/i.test(trimmed)) {
      this.settings.set(v[0], v[1]);
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+schema_migrations/i.test(trimmed)) {
      const table = this.getTable('schema_migrations');
      table.set(String(v[0]), { version: v[0], name: v[1], applied_at: v[2] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+migration_rollbacks/i.test(trimmed)) {
      const table = this.getTable('migration_rollbacks');
      table.set(v[0], { id: v[0], migration_name: v[1], snapshot_data: v[2], created_at: v[3], is_active: v[4] });
      return { changes: 1 };
    }
    if (/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+migration_audit_log/i.test(trimmed)) {
      const table = this.getTable('migration_audit_log');
      table.set(v[0], { id: v[0], migration_name: v[1], status: v[2], records_migrated: v[3], checksum: v[4], message: v[5], timestamp: v[6] });
      return { changes: 1 };
    }

    // Generic INSERT fallback
    const insertGeneralMatch = trimmed.match(/INSERT(?:\s+OR\s+(?:REPLACE|IGNORE))?\s+INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s+VALUES/i);
    if (insertGeneralMatch) {
      const tableName = insertGeneralMatch[1].toLowerCase();
      const table = this.getTable(tableName);
      if (insertGeneralMatch[2]) {
        const cols = insertGeneralMatch[2].split(',').map(c => c.trim().toLowerCase());
        const row: Record<string, any> = {};
        cols.forEach((col, idx) => {
          row[col] = v[idx];
        });
        const idKey = row.id ?? v[0] ?? `row_${table.size + 1}`;
        table.set(String(idKey), row);
      } else {
        table.set(String(v[0] ?? `row_${table.size + 1}`), { ...v });
      }
      return { changes: 1 };
    }

    if (/DELETE\s+FROM\s+(\w+)/i.test(trimmed)) {
      const match = trimmed.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(\w+)\s*=\s*\?)?/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const table = this.getTable(tableName);
        if (v.length > 0 && v[0] !== undefined) {
          table.delete(String(v[0]));
        } else {
          table.clear();
        }
      }
      return { changes: 1 };
    }

    // Generic UPDATE fallback
    const updateMatch = trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.*?)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (updateMatch) {
      const tableName = updateMatch[1].toLowerCase();
      const targetId = String(v[v.length - 1]);
      const table = this.getTable(tableName);
      const existing = table.get(targetId) || { id: targetId };
      const setParts = updateMatch[2].split(',').map(p => p.trim().split('=')[0].trim().toLowerCase());
      setParts.forEach((col, idx) => {
        existing[col] = v[idx];
      });
      table.set(targetId, existing);
      return { changes: 1 };
    }

    return { changes: 1 };
  }

  async query<T = any>(statement: string, values?: any[]): Promise<T[]> {
    this.isOpen = true;
    const trimmed = statement.trim();
    const v = values ?? [];

    if (/PRAGMA\s+foreign_keys/i.test(trimmed)) {
      return [{ foreign_keys: 1 }] as any[];
    }
    if (/PRAGMA\s+journal_mode/i.test(trimmed)) {
      return [{ journal_mode: 'WAL' }] as any[];
    }
    if (/PRAGMA\s+integrity_check/i.test(trimmed)) {
      return [{ integrity_check: 'ok' }] as any[];
    }
    if (/PRAGMA\s+foreign_key_check/i.test(trimmed)) {
      return [] as any[];
    }

    if (/FROM\s+schema_migrations/i.test(trimmed)) {
      const rows = Array.from(this.getTable('schema_migrations').values());
      if (v.length > 0) {
        return rows.filter(r => r.version === v[0]) as T[];
      }
      return rows as T[];
    }
    if (/FROM\s+migration_rollbacks/i.test(trimmed)) {
      const rows = Array.from(this.getTable('migration_rollbacks').values());
      if (v.length > 0) {
        return rows.filter(r => r.id === v[0]) as T[];
      }
      return rows as T[];
    }
    if (/FROM\s+migration_audit_log/i.test(trimmed)) {
      return Array.from(this.getTable('migration_audit_log').values()) as T[];
    }
    if (/FROM\s+app_settings/i.test(trimmed)) {
      const all = Array.from(this.settings.entries()).map(([key, value]) => ({ key, value }));
      if (/WHERE\s+key\s*=\s*\?/i.test(trimmed) && v.length > 0) {
        return all.filter(r => r.key === v[0]) as T[];
      }
      return all as T[];
    }

    // Determine target table
    const tableMatch = trimmed.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1].toLowerCase() : '';
    if (tableName && this.tables.has(tableName)) {
      let rows = Array.from(this.getTable(tableName).values());

      // Filter by ID
      if (/WHERE\s+id\s*=\s*\?/i.test(trimmed) && v.length > 0) {
        rows = rows.filter(r => String(r.id) === String(v[0]));
      } else if (/WHERE\s+category_id\s*=\s*\?/i.test(trimmed) && v.length > 0) {
        rows = rows.filter(r => String(r.category_id || r.categoryId) === String(v[0]));
      }

      // Check if this is a count query
      if (/SELECT\s+count\(\*\)(?:\s+(?:as\s+)?(\w+))?/i.test(trimmed)) {
        const countAliasMatch = trimmed.match(/SELECT\s+count\(\*\)(?:\s+as\s+(\w+))?/i);
        const colName = (countAliasMatch && countAliasMatch[1]) ? countAliasMatch[1] : 'count';
        return [{ [colName]: rows.length, count: rows.length, total: rows.length }] as any[];
      }

      // Sort
      if (/ORDER\s+BY\s+date\s+DESC/i.test(trimmed)) {
        rows.sort((a, b) => {
          const dateDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
          if (dateDiff !== 0) return dateDiff;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
      }

      // Pagination with LIMIT and OFFSET
      const limitOffsetMatch = trimmed.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i);
      if (limitOffsetMatch) {
        let limit = 20;
        let offset = 0;
        if (limitOffsetMatch[1] === '?') {
          limit = Number(v[v.length - 2]);
        } else {
          limit = Number(limitOffsetMatch[1]);
        }
        if (limitOffsetMatch[2] === '?') {
          offset = Number(v[v.length - 1]);
        } else if (limitOffsetMatch[2]) {
          offset = Number(limitOffsetMatch[2]);
        }
        rows = rows.slice(offset, offset + limit);
      }

      return rows as T[];
    }

    return [];
  }

  async beginTransaction(): Promise<void> {
    this.inTransaction = true;
    this.snapshotTables = new Map();
    for (const [k, val] of this.tables.entries()) {
      this.snapshotTables.set(k, new Map(val));
    }
    this.snapshotSettings = new Map(this.settings);
  }

  async commitTransaction(): Promise<void> {
    this.inTransaction = false;
    this.snapshotTables = null;
    this.snapshotSettings = null;
  }

  async rollbackTransaction(): Promise<void> {
    if (this.snapshotTables) {
      this.tables = this.snapshotTables;
      this.snapshotTables = null;
    }
    if (this.snapshotSettings) {
      this.settings = this.snapshotSettings;
      this.snapshotSettings = null;
    }
    this.inTransaction = false;
  }

  async isTransactionActive(): Promise<boolean> {
    return this.inTransaction;
  }

  async executeTransaction<T>(action: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    const alreadyActive = await this.isTransactionActive();
    if (alreadyActive) {
      return await action(this);
    }

    await this.beginTransaction();
    try {
      const result = await action(this);
      await this.commitTransaction();
      return result;
    } catch (err) {
      await this.rollbackTransaction();
      throw err;
    }
  }

  private getTable(name: string): Map<string, any> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    return this.tables.get(name)!;
  }
}

/**
 * SQLite Connection Pool and Lifecycle Manager.
 * Handles single-instance database connections, connection pooling, and multi-platform driver selection.
 */
export class SqliteConnectionPool {
  private static instance: SqliteConnectionPool;
  private connections: Map<string, DatabaseConnection> = new Map();
  private sqlitePlugin: SQLiteConnection | null = null;

  private constructor() {}

  public static getInstance(): SqliteConnectionPool {
    if (!SqliteConnectionPool.instance) {
      SqliteConnectionPool.instance = new SqliteConnectionPool();
    }
    return SqliteConnectionPool.instance;
  }

  /**
   * Retrieves an active, opened connection for the specified database name from the pool.
   */
  public async getConnection(dbName: string = COCOON_DATABASE_NAME): Promise<DatabaseConnection> {
    if (this.connections.has(dbName)) {
      const existing = this.connections.get(dbName)!;
      const isOpen = await existing.isDBOpen();
      if (isOpen) {
        return existing;
      }
      await existing.open();
      return existing;
    }

    const connection = await this.createConnectionInstance(dbName);
    await connection.open();
    this.connections.set(dbName, connection);
    return connection;
  }

  /**
   * Releases and closes a pooled connection by database name.
   */
  public async releaseConnection(dbName: string = COCOON_DATABASE_NAME): Promise<void> {
    const connection = this.connections.get(dbName);
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.warn(`Error closing connection for ${dbName}:`, err);
      }
      this.connections.delete(dbName);
    }
  }

  /**
   * Closes all connections in the pool.
   */
  public async closeAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    for (const name of names) {
      await this.releaseConnection(name);
    }
    if (this.sqlitePlugin) {
      try {
        await this.sqlitePlugin.closeAllConnections();
      } catch {
        // Closed
      }
    }
  }

  /**
   * Factory creating the appropriate driver adapter based on runtime environment.
   */
  private async createConnectionInstance(dbName: string): Promise<DatabaseConnection> {
    // 1. Native Capacitor on Android or iOS
    if (Capacitor.isNativePlatform()) {
      if (!this.sqlitePlugin) {
        this.sqlitePlugin = new SQLiteConnection(CapacitorSQLite);
      }

      const isConn = await this.sqlitePlugin.isConnection(dbName, false);
      let dbConn: SQLiteDBConnection;
      if (isConn.result) {
        dbConn = await this.sqlitePlugin.retrieveConnection(dbName, false);
      } else {
        dbConn = await this.sqlitePlugin.createConnection(
          dbName,
          false,
          'no-encryption',
          1,
          false
        );
      }
      return new CapacitorSqliteConnectionAdapter(dbConn);
    }

    // 2. Node.js environment (Unit & Integration tests)
    const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
    if (isNode) {
      try {
        const nodeAdapter = new NodeSqliteConnectionAdapter(dbName);
        await nodeAdapter.open();
        return nodeAdapter;
      } catch (nodeErr) {
        console.warn('Node sqlite adapter initialization fallback:', nodeErr);
      }
    }

    // 3. Web preview / browser environment
    return new MemoryDatabaseAdapter();
  }
}

export const sqlitePool = SqliteConnectionPool.getInstance();
