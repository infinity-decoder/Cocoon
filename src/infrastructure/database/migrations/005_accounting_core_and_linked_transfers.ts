/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from './002_business_workspaces_ledger_parties';

export const migration005: Migration = {
  version: 5,
  name: '005_accounting_core_and_linked_transfers',
  description: 'Chart of accounts categories and report mapping, immutable journal posting model with idempotency, and inter-workspace transfer workflow with paired transactions.',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Expand accounts table with sub_category, report_mapping, description, parent_account_id
    const accountCols = [
      'sub_category TEXT',
      "report_mapping TEXT NOT NULL DEFAULT 'balance_sheet'",
      'description TEXT',
      'parent_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL'
    ];

    for (const colDef of accountCols) {
      try {
        await conn.execute(`ALTER TABLE accounts ADD COLUMN ${colDef};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore duplicate column on rerun
        }
      }
    }

    // 2. Expand journal_entries with source tracking, status, reversal references, idempotency, and actor
    const journalCols = [
      "source_type TEXT NOT NULL DEFAULT 'manual'",
      'source_id TEXT',
      "status TEXT NOT NULL DEFAULT 'posted'",
      'reversal_of_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL',
      'reversed_by_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL',
      'reversal_reason TEXT',
      'idempotency_key TEXT',
      "audit_actor TEXT NOT NULL DEFAULT 'local_user'"
    ];

    for (const colDef of journalCols) {
      try {
        await conn.execute(`ALTER TABLE journal_entries ADD COLUMN ${colDef};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore duplicate column
        }
      }
    }

    // 3. Expand journal_lines with product dimension and idempotency key
    const lineCols = [
      'product_id TEXT REFERENCES products(id) ON DELETE SET NULL',
      "currency_code TEXT NOT NULL DEFAULT 'PKR'",
      'idempotency_key TEXT'
    ];

    for (const colDef of lineCols) {
      try {
        await conn.execute(`ALTER TABLE journal_lines ADD COLUMN ${colDef};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore duplicate column
        }
      }
    }

    // 4. Create inter_workspace_transfers table
    const ddl = `
CREATE TABLE IF NOT EXISTS inter_workspace_transfers (
  id TEXT PRIMARY KEY NOT NULL,
  transfer_number TEXT NOT NULL,
  source_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  destination_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  source_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  destination_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_scaled INTEGER NOT NULL CHECK(amount_scaled > 0),
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  transfer_date TEXT NOT NULL,
  transfer_type TEXT NOT NULL CHECK(transfer_type IN ('owner_capital', 'owner_loan', 'owner_drawing', 'owner_loan_repayment', 'internal_funding', 'other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'cancelled', 'reversed')),
  source_journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  destination_journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  reversal_transfer_id TEXT REFERENCES inter_workspace_transfers(id) ON DELETE SET NULL,
  reversal_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'local_user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(source_workspace_id != destination_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_source ON inter_workspace_transfers(source_workspace_id);
CREATE INDEX IF NOT EXISTS idx_transfers_dest ON inter_workspace_transfers(destination_workspace_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON inter_workspace_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_transfers_idempotency ON inter_workspace_transfers(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_journal_entries_idempotency ON journal_entries(workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounts_category ON accounts(workspace_id, type, sub_category);
    `;

    await conn.execute(ddl);

    // 5. Update existing system accounts to fill in sub_category and report_mapping
    const standardMapping: Record<string, { subCategory: string; reportMapping: 'balance_sheet' | 'income_statement' }> = {
      '1010': { subCategory: 'cash', reportMapping: 'balance_sheet' },
      '1020': { subCategory: 'bank', reportMapping: 'balance_sheet' },
      '1200': { subCategory: 'receivables', reportMapping: 'balance_sheet' },
      '1300': { subCategory: 'inventory', reportMapping: 'balance_sheet' },
      '1400': { subCategory: 'other_assets', reportMapping: 'balance_sheet' },
      '1500': { subCategory: 'other_assets', reportMapping: 'balance_sheet' },
      '2010': { subCategory: 'supplier_payables', reportMapping: 'balance_sheet' },
      '2020': { subCategory: 'taxes_payable', reportMapping: 'balance_sheet' },
      '2030': { subCategory: 'owner_loans_payable', reportMapping: 'balance_sheet' },
      '2040': { subCategory: 'other_liabilities', reportMapping: 'balance_sheet' },
      '2050': { subCategory: 'other_liabilities', reportMapping: 'balance_sheet' },
      '3000': { subCategory: 'capital', reportMapping: 'balance_sheet' },
      '3010': { subCategory: 'owner_drawings', reportMapping: 'balance_sheet' },
      '3020': { subCategory: 'retained_earnings', reportMapping: 'balance_sheet' },
      '4000': { subCategory: 'sales', reportMapping: 'income_statement' },
      '4010': { subCategory: 'sales', reportMapping: 'income_statement' },
      '4020': { subCategory: 'other_income', reportMapping: 'income_statement' },
      '4090': { subCategory: 'other_income', reportMapping: 'income_statement' },
      '5000': { subCategory: 'cogs', reportMapping: 'income_statement' },
      '5010': { subCategory: 'cogs', reportMapping: 'income_statement' },
      '6000': { subCategory: 'operating_expenses', reportMapping: 'income_statement' },
      '5020': { subCategory: 'operating_expenses', reportMapping: 'income_statement' },
      '5090': { subCategory: 'other_expenses', reportMapping: 'income_statement' }
    };

    for (const [code, meta] of Object.entries(standardMapping)) {
      await conn.run(
        `UPDATE accounts SET sub_category = ?, report_mapping = ? WHERE account_code = ? AND (sub_category IS NULL OR sub_category = '')`,
        [meta.subCategory, meta.reportMapping, code]
      );
    }

    // Seed missing standard accounts for default personal workspace
    const personalAccounts = [
      { code: '1400', name: 'Due from Business / Investment', type: 'asset', subCategory: 'other_assets', reportMapping: 'balance_sheet' },
      { code: '2030', name: 'Owner Loans Payable', type: 'liability', subCategory: 'owner_loans_payable', reportMapping: 'balance_sheet' },
      { code: '3010', name: 'Owner Drawings', type: 'equity', subCategory: 'owner_drawings', reportMapping: 'balance_sheet' }
    ];

    const now = new Date().toISOString();
    for (const acc of personalAccounts) {
      const accId = `acc_${DEFAULT_PERSONAL_WORKSPACE_ID}_${acc.code}`;
      await conn.run(
        `INSERT OR IGNORE INTO accounts (id, workspace_id, account_code, name, type, sub_category, report_mapping, currency_code, is_system, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PKR', 1, 1, ?, ?)`,
        [accId, DEFAULT_PERSONAL_WORKSPACE_ID, acc.code, acc.name, acc.type, acc.subCategory, acc.reportMapping, now, now]
      );
    }
  }
};
