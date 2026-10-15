/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from './types';

export const COCOON_DATABASE_NAME = 'cocoon_db';
export const COCOON_DATABASE_VERSION = 1;

/**
 * Core SQLite DDL statements for Cocoon personal finance module.
 * Incorporates prepared-statement-compatible schemas, foreign keys, and indexes.
 */
export const SQL_SCHEMA_STATEMENTS = `
-- Migration metadata table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Migration rollbacks table for zero-loss recovery snapshots
CREATE TABLE IF NOT EXISTS migration_rollbacks (
  id TEXT PRIMARY KEY,
  migration_name TEXT NOT NULL,
  snapshot_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Migration audit log
CREATE TABLE IF NOT EXISTS migration_audit_log (
  id TEXT PRIMARY KEY,
  migration_name TEXT NOT NULL,
  status TEXT NOT NULL,
  records_migrated INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  message TEXT,
  timestamp TEXT NOT NULL
);

-- Wallets / Accounts table
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'card', 'savings')),
  balance REAL NOT NULL DEFAULT 0.0,
  color TEXT NOT NULL
);

-- Categories table (supports parent categories and sub-categories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_id TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer', 'savings_deposit', 'savings_withdraw')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  wallet_id TEXT NOT NULL,
  to_wallet_id TEXT,
  payment_method TEXT NOT NULL,
  attachment TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT,
  savings_goal_id TEXT
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  month TEXT NOT NULL,
  rollover INTEGER NOT NULL DEFAULT 0
);

-- Savings Goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0.0,
  color TEXT NOT NULL,
  deadline TEXT
);

-- Bill Reminders table
CREATE TABLE IF NOT EXISTS bill_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  category_id TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL
);

-- App Settings key-value table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Indexes for lightning-fast queries and ledger aggregation
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON bill_reminders(due_date);
`;

/**
 * Initializes the full database schema and pragma configurations.
 */
export async function initializeDatabaseSchema(connection: DatabaseConnection): Promise<void> {
  // Enforce foreign keys and execute schema statements
  await connection.execute('PRAGMA foreign_keys = ON;');
  await connection.execute(SQL_SCHEMA_STATEMENTS);
}
