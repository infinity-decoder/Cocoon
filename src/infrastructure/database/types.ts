/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Transaction, Category, Wallet, Budget, SavingsGoal, BillReminder, AppSettings } from '../../core/types';

export interface RunResult {
  changes?: number;
  lastId?: number;
}

export interface DatabaseConnection {
  open(): Promise<void>;
  close(): Promise<void>;
  isDBOpen(): Promise<boolean>;
  execute(statements: string): Promise<void>;
  run(statement: string, values?: any[]): Promise<RunResult>;
  query<T = any>(statement: string, values?: any[]): Promise<T[]>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  isTransactionActive(): Promise<boolean>;
  executeTransaction<T>(action: (conn: DatabaseConnection) => Promise<T>): Promise<T>;
}

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
}

export interface MigrationAuditRecord {
  id: string;
  migrationName: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  recordsMigrated: number;
  checksum: string;
  message?: string;
  timestamp: string;
}

export interface MigrationSnapshot {
  id: string;
  createdAt: string;
  source: 'localStorage' | 'sqlite';
  data: AppState;
  checksum: string;
  counts: {
    transactions: number;
    categories: number;
    subCategories: number;
    wallets: number;
    budgets: number;
    savingsGoals: number;
    reminders: number;
  };
}

export interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  recordsMigrated: number;
  snapshotId?: string;
  checksum?: string;
  error?: string;
  migratedAt?: string;
}

export interface RollbackResult {
  success: boolean;
  snapshotId?: string;
  recordsRestored: number;
  error?: string;
  rolledBackAt?: string;
}
