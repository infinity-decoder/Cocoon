/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration008: Migration = {
  version: 8,
  name: '008_sales_pos_returns_idempotency',
  description: 'Sales & POS domain: idempotency keys, payment splits, negative stock policies, sales returns, item conditions, and invoice sequence integrity.',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Extend documents table with idempotency key, payment method, pos flag, and cashier
    const docCols = [
      'idempotency_key TEXT',
      'payment_method TEXT DEFAULT \'cash\'',
      'is_pos INTEGER NOT NULL DEFAULT 0',
      'cashier_name TEXT'
    ];
    for (const col of docCols) {
      try {
        await conn.execute(`ALTER TABLE documents ADD COLUMN ${col};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore already existing
        }
      }
    }

    // 2. Extend document_lines table with package unit, cost price at posting, and returned quantity
    const docLineCols = [
      'package_unit TEXT NOT NULL DEFAULT \'pcs\'',
      'cost_price_scaled INTEGER NOT NULL DEFAULT 0',
      'returned_quantity REAL NOT NULL DEFAULT 0'
    ];
    for (const col of docLineCols) {
      try {
        await conn.execute(`ALTER TABLE document_lines ADD COLUMN ${col};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore already existing
        }
      }
    }

    // 3. Extend business_profiles table with negative_stock_policy and walk-in credit policy
    const bpCols = [
      'negative_stock_policy TEXT NOT NULL DEFAULT \'block\'',
      'allow_walk_in_credit INTEGER NOT NULL DEFAULT 0'
    ];
    for (const col of bpCols) {
      try {
        await conn.execute(`ALTER TABLE business_profiles ADD COLUMN ${col};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore already existing
        }
      }
    }

    // 4. Sales Returns and Return Lines Tables
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        return_number TEXT NOT NULL,
        original_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
        party_id TEXT REFERENCES parties(id) ON DELETE RESTRICT,
        party_name TEXT NOT NULL,
        return_date TEXT NOT NULL,
        subtotal_scaled INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_scaled >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL DEFAULT 0 CHECK(total_scaled >= 0),
        refund_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount_scaled >= 0),
        settlement_type TEXT NOT NULL CHECK(settlement_type IN ('cash_refund', 'bank_refund', 'store_credit', 'receivable_credit')),
        refund_account_id TEXT REFERENCES accounts(id),
        payment_id TEXT REFERENCES payments(id),
        journal_entry_id TEXT REFERENCES journal_entries(id),
        reason TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, return_number)
      );

      CREATE TABLE IF NOT EXISTS sales_return_lines (
        id TEXT PRIMARY KEY NOT NULL,
        sales_return_id TEXT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        original_line_id TEXT NOT NULL REFERENCES document_lines(id),
        product_id TEXT REFERENCES products(id),
        description TEXT NOT NULL,
        returned_quantity REAL NOT NULL CHECK(returned_quantity > 0),
        package_unit TEXT NOT NULL DEFAULT 'pcs',
        canonical_quantity REAL NOT NULL CHECK(canonical_quantity > 0),
        unit_price_scaled INTEGER NOT NULL CHECK(unit_price_scaled >= 0),
        unit_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_scaled >= 0),
        tax_rate_percent REAL NOT NULL DEFAULT 0,
        tax_scaled INTEGER NOT NULL DEFAULT 0,
        total_scaled INTEGER NOT NULL CHECK(total_scaled >= 0),
        item_condition TEXT NOT NULL DEFAULT 'resellable' CHECK(item_condition IN ('resellable', 'damaged', 'scrap')),
        stock_movement_id TEXT REFERENCES stock_movements(id),
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sales_returns_ws_date ON sales_returns(workspace_id, return_date);
      CREATE INDEX IF NOT EXISTS idx_sales_returns_original_doc ON sales_returns(original_document_id);
      CREATE INDEX IF NOT EXISTS idx_sales_return_lines_return ON sales_return_lines(sales_return_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_idempotency ON documents(workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    `);
  }
};
