/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration010: Migration = {
  version: 10,
  name: '010_high_volume_indexing_and_keyset',
  description: 'High-volume covering indexes, keyset pagination composites, and barcode direct-seek structures for 100k+ scale.',
  async up(conn: DatabaseConnection): Promise<void> {
    const ddl = `
      -- 1. Party Ledger Khata covering index for SQL-level running balance aggregations (index-only scan)
      CREATE INDEX IF NOT EXISTS idx_party_ledger_balance_covering
      ON party_ledger_entries(workspace_id, party_id, is_reversed, receivable_amount_scaled, payable_amount_scaled);

      -- 2. Party Ledger Keyset pagination composite index (eliminates OFFSET penalty for deep ledgers)
      CREATE INDEX IF NOT EXISTS idx_party_ledger_keyset
      ON party_ledger_entries(workspace_id, party_id, entry_date DESC, id DESC);

      -- 3. Accounting Journal Lines covering index for instant trial balance and account ledger rollups
      CREATE INDEX IF NOT EXISTS idx_journal_lines_covering
      ON journal_lines(account_id, created_at, debit_amount_scaled, credit_amount_scaled);

      -- 4. Accounting Journal Lines party covering index
      CREATE INDEX IF NOT EXISTS idx_journal_lines_party_covering
      ON journal_lines(party_id, created_at, debit_amount_scaled, credit_amount_scaled);

      -- 5. Journal Entries Keyset pagination composite index
      CREATE INDEX IF NOT EXISTS idx_journal_entries_keyset
      ON journal_entries(workspace_id, entry_date DESC, id DESC);

      -- 6. Transactions Keyset pagination composite indexes for personal finance & cash journals
      CREATE INDEX IF NOT EXISTS idx_transactions_date_id
      ON transactions(date DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_wallet_date_id
      ON transactions(wallet_id, date DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_cat_date
      ON transactions(category, date DESC);

      -- 7. Direct Barcode lookup index on products table
      CREATE INDEX IF NOT EXISTS idx_products_ws_barcode
      ON products(workspace_id, barcode)
      WHERE barcode IS NOT NULL AND barcode != '';

      -- 8. Active product catalog browse index (workspace, archive status, active status, name)
      CREATE INDEX IF NOT EXISTS idx_products_ws_active_name
      ON products(workspace_id, is_archived, is_active, name);

      -- 9. Product Barcode covering index for instant sub-millisecond barcode scan at POS
      CREATE INDEX IF NOT EXISTS idx_barcodes_ws_norm_covering
      ON product_barcodes(workspace_id, normalized_barcode, product_id, packaging_unit, conversion_factor, price_scaled);

      -- 10. Stock Movements Keyset pagination and covering index for product movements
      CREATE INDEX IF NOT EXISTS idx_stock_movements_keyset
      ON stock_movements(workspace_id, product_id, effective_date DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_qty_covering
      ON stock_movements(workspace_id, product_id, is_reversed, quantity_delta, unit_cost_scaled);

      -- 11. Audit Events Keyset pagination index for immutable event streaming
      CREATE INDEX IF NOT EXISTS idx_audit_events_keyset
      ON audit_events(workspace_id, timestamp DESC, id DESC);

      -- 12. Documents Keyset pagination index for sales and purchase registers
      CREATE INDEX IF NOT EXISTS idx_documents_keyset
      ON documents(workspace_id, document_type, issue_date DESC, id DESC);
    `;

    await conn.execute(ddl);
  }
};
