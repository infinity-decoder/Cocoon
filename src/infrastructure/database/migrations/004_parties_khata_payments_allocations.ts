/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration004: Migration = {
  version: 4,
  name: '004_parties_khata_payments_allocations',
  description: 'Schema expansion for parties khata, opening balances, multi-role parties, payments, payment allocations, and chronological party ledger entries.',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Expand parties table with company details, contact person, notes, and opening balance metadata
    const partyCols = [
      'company_name TEXT',
      'contact_person_name TEXT',
      'contact_person_phone TEXT',
      'notes TEXT',
      'opening_balance_scaled INTEGER NOT NULL DEFAULT 0',
      'opening_balance_type TEXT DEFAULT \'zero\'',
      'opening_balance_date TEXT',
      'attachment_path TEXT'
    ];

    for (const colDef of partyCols) {
      try {
        await conn.execute(`ALTER TABLE parties ADD COLUMN ${colDef};`);
      } catch (err: any) {
        // Ignore if column already exists in schema
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // Non-duplicate errors in environments without ALTER support can continue
        }
      }
    }

    // 2. DDL for payments, payment allocations, and party ledger entries
    const ddl = `
-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  payment_number TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK(payment_type IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund')),
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_scaled INTEGER NOT NULL CHECK(amount_scaled > 0),
  allocated_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(allocated_amount_scaled >= 0),
  unallocated_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(unallocated_amount_scaled >= 0),
  reference_number TEXT,
  notes TEXT,
  attachment_path TEXT,
  is_reversed INTEGER NOT NULL DEFAULT 0,
  reversal_reason TEXT,
  reversed_at TEXT,
  reversal_journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, payment_number)
);

-- Payment Allocations table (One payment applied to one or multiple invoices/bills)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  allocated_amount_scaled INTEGER NOT NULL CHECK(allocated_amount_scaled > 0),
  created_at TEXT NOT NULL
);

-- Chronological Party Ledger (Khata) Entries
CREATE TABLE IF NOT EXISTS party_ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN (
    'opening_balance', 'credit_sale', 'credit_purchase', 
    'payment_received', 'supplier_payment', 'sales_return', 
    'purchase_return', 'credit_note', 'debit_note', 'adjustment'
  )),
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  reference_number TEXT NOT NULL,
  description TEXT NOT NULL,
  receivable_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(receivable_amount_scaled >= 0),
  payable_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(payable_amount_scaled >= 0),
  running_balance_scaled INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  is_reversed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Performance and Scoped Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_payments_ws_party ON payments(workspace_id, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(workspace_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_doc ON payment_allocations(document_id);
CREATE INDEX IF NOT EXISTS idx_party_ledger_ws_party ON party_ledger_entries(workspace_id, party_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_party_ledger_doc ON party_ledger_entries(document_id);
CREATE INDEX IF NOT EXISTS idx_party_ledger_payment ON party_ledger_entries(payment_id);
    `;

    await conn.execute(ddl);
  }
};
