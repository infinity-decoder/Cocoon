/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const DEFAULT_PERSONAL_WORKSPACE_ID = 'ws_personal_default';

export const migration002: Migration = {
  version: 2,
  name: '002_business_workspaces_ledger_parties',
  description: 'Schema expansion for business workspaces, double-entry ledger accounts, journal entries, parties, payment terms, and audit events.',
  async up(conn: DatabaseConnection): Promise<void> {
    const ddl = `
-- 1. Multi-tenant Workspaces table (Personal & Business profiles)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('personal', 'business', 'enterprise')),
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Payment Terms table
CREATE TABLE IF NOT EXISTS payment_terms (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_days INTEGER NOT NULL DEFAULT 0 CHECK(due_days >= 0),
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 3. Parties table (Customers, Suppliers, Counterparties)
CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('customer', 'supplier', 'both')),
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit_scaled INTEGER NOT NULL DEFAULT 0 CHECK(credit_limit_scaled >= 0),
  payment_term_id TEXT REFERENCES payment_terms(id) ON DELETE SET NULL,
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Double-Entry Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, account_code)
);

-- 5. Double-Entry Journal Entries (Header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  is_posted INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, entry_number)
);

-- 6. Double-Entry Journal Lines (Debit/Credit records)
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY NOT NULL,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(debit_amount_scaled >= 0),
  credit_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(credit_amount_scaled >= 0),
  description TEXT,
  party_id TEXT REFERENCES parties(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  CHECK((debit_amount_scaled > 0 AND credit_amount_scaled = 0) OR (credit_amount_scaled > 0 AND debit_amount_scaled = 0))
);

-- 7. Audit Events table
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  timestamp TEXT NOT NULL
);

-- 8. Document Attachments metadata table
CREATE TABLE IF NOT EXISTS document_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_workspace_type ON accounts(workspace_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_parties_workspace_type ON parties(workspace_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_parties_workspace_phone ON parties(workspace_id, phone);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(workspace_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_date ON journal_lines(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_lines_party ON journal_lines(party_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_doc ON document_attachments(document_type, document_id);
    `;

    await conn.execute(ddl);

    // 10. Seed default personal workspace and core Chart of Accounts if not present
    const now = new Date().toISOString();
    await conn.run(
      `INSERT OR IGNORE INTO workspaces (id, name, type, currency_code, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [DEFAULT_PERSONAL_WORKSPACE_ID, 'Personal Workspace', 'personal', 'PKR', now, now]
    );

    // Seed default payment terms for personal workspace
    const defaultTerms = [
      { id: `pt_${DEFAULT_PERSONAL_WORKSPACE_ID}_immediate`, name: 'Due on Receipt', dueDays: 0, isDefault: 1 },
      { id: `pt_${DEFAULT_PERSONAL_WORKSPACE_ID}_net15`, name: 'Net 15', dueDays: 15, isDefault: 0 },
      { id: `pt_${DEFAULT_PERSONAL_WORKSPACE_ID}_net30`, name: 'Net 30', dueDays: 30, isDefault: 0 }
    ];

    for (const term of defaultTerms) {
      await conn.run(
        `INSERT OR IGNORE INTO payment_terms (id, workspace_id, name, due_days, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [term.id, DEFAULT_PERSONAL_WORKSPACE_ID, term.name, term.dueDays, term.isDefault, now]
      );
    }

    // Seed default Chart of Accounts for the personal workspace
    const systemAccounts = [
      { code: '1010', name: 'Cash on Hand', type: 'asset' },
      { code: '1020', name: 'Bank Accounts', type: 'asset' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset' },
      { code: '1300', name: 'Inventory Asset', type: 'asset' },
      { code: '2010', name: 'Accounts Payable', type: 'liability' },
      { code: '3000', name: 'Owner Equity', type: 'equity' },
      { code: '4000', name: 'General Revenue', type: 'revenue' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
      { code: '6000', name: 'Operating Expenses', type: 'expense' }
    ];

    for (const acc of systemAccounts) {
      const accId = `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_${acc.code}`;
      await conn.run(
        `INSERT OR IGNORE INTO accounts (id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'PKR', 1, 1, ?, ?)`,
        [accId, DEFAULT_PERSONAL_WORKSPACE_ID, acc.code, acc.name, acc.type, now, now]
      );
    }
  }
};
