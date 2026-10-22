/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration007: Migration = {
  version: 7,
  name: '007_purchases_orders_receipts_bills',
  description: 'Purchasing domain: purchase orders, partial goods receipts, purchase bills with landed cost, purchase returns, and supplier payment allocations.',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Purchase Orders
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        order_number TEXT NOT NULL,
        supplier_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
        supplier_name TEXT NOT NULL,
        order_date TEXT NOT NULL,
        expected_delivery_date TEXT,
        currency_code TEXT NOT NULL DEFAULT 'PKR',
        order_status TEXT NOT NULL DEFAULT 'ordered' CHECK(order_status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
        subtotal_scaled INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_scaled >= 0),
        discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL DEFAULT 0 CHECK(total_scaled >= 0),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, order_number)
      );

      CREATE INDEX IF NOT EXISTS idx_po_workspace_date ON purchase_orders(workspace_id, order_date);
      CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(workspace_id, order_status);
    `);

    // 2. Purchase Order Lines
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_lines (
        id TEXT PRIMARY KEY NOT NULL,
        order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        item_type TEXT NOT NULL DEFAULT 'inventory' CHECK(item_type IN ('inventory', 'expense')),
        description TEXT NOT NULL,
        ordered_quantity REAL NOT NULL CHECK(ordered_quantity > 0),
        received_quantity REAL NOT NULL DEFAULT 0 CHECK(received_quantity >= 0),
        package_unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost_scaled INTEGER NOT NULL CHECK(unit_cost_scaled >= 0),
        discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
        tax_rate_percent REAL NOT NULL DEFAULT 0 CHECK(tax_rate_percent >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL CHECK(total_scaled >= 0),
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pol_order ON purchase_order_lines(order_id);
      CREATE INDEX IF NOT EXISTS idx_pol_product ON purchase_order_lines(product_id);
    `);

    // 3. Goods Receipts / Delivery Notes
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS goods_receipts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        receipt_number TEXT NOT NULL,
        purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        supplier_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
        supplier_name TEXT NOT NULL,
        receipt_date TEXT NOT NULL,
        location_id TEXT REFERENCES stock_locations(id) ON DELETE SET NULL,
        receipt_status TEXT NOT NULL DEFAULT 'received' CHECK(receipt_status IN ('received', 'reconciled', 'reversed')),
        notes TEXT,
        created_by TEXT NOT NULL DEFAULT 'local_user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, receipt_number)
      );

      CREATE INDEX IF NOT EXISTS idx_grn_workspace_date ON goods_receipts(workspace_id, receipt_date);
      CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(purchase_order_id);
      CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_receipts(supplier_id);
    `);

    // 4. Goods Receipt Lines
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS goods_receipt_lines (
        id TEXT PRIMARY KEY NOT NULL,
        receipt_id TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        purchase_order_line_id TEXT REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        description TEXT NOT NULL,
        received_quantity REAL NOT NULL CHECK(received_quantity > 0),
        short_quantity REAL NOT NULL DEFAULT 0 CHECK(short_quantity >= 0),
        damaged_quantity REAL NOT NULL DEFAULT 0 CHECK(damaged_quantity >= 0),
        package_unit TEXT NOT NULL DEFAULT 'pcs',
        canonical_quantity REAL NOT NULL CHECK(canonical_quantity > 0),
        unit_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_scaled >= 0),
        stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
        batch_number TEXT,
        expiry_date TEXT,
        serial_number TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_grnl_receipt ON goods_receipt_lines(receipt_id);
      CREATE INDEX IF NOT EXISTS idx_grnl_product ON goods_receipt_lines(product_id);
      CREATE INDEX IF NOT EXISTS idx_grnl_pol ON goods_receipt_lines(purchase_order_line_id);
    `);

    // 5. Purchase Bills
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_bills (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        bill_number TEXT NOT NULL,
        purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        goods_receipt_id TEXT REFERENCES goods_receipts(id) ON DELETE SET NULL,
        supplier_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
        supplier_name TEXT NOT NULL,
        bill_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'PKR',
        receipt_status TEXT NOT NULL DEFAULT 'received' CHECK(receipt_status IN ('unreceived', 'partially_received', 'received')),
        payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partially_paid', 'paid')),
        posting_status TEXT NOT NULL DEFAULT 'posted' CHECK(posting_status IN ('draft', 'posted', 'voided', 'reversed')),
        subtotal_scaled INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_scaled >= 0),
        discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        landed_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(landed_cost_scaled >= 0),
        landed_cost_allocation_method TEXT NOT NULL DEFAULT 'by_value' CHECK(landed_cost_allocation_method IN ('none', 'by_value', 'by_quantity')),
        total_scaled INTEGER NOT NULL DEFAULT 0 CHECK(total_scaled >= 0),
        paid_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount_scaled >= 0),
        journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
        notes TEXT,
        attachment_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, bill_number)
      );

      CREATE INDEX IF NOT EXISTS idx_bills_workspace_date ON purchase_bills(workspace_id, bill_date);
      CREATE INDEX IF NOT EXISTS idx_bills_supplier ON purchase_bills(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON purchase_bills(workspace_id, payment_status);
      CREATE INDEX IF NOT EXISTS idx_bills_po ON purchase_bills(purchase_order_id);
    `);

    // 6. Purchase Bill Lines
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_bill_lines (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
        purchase_order_line_id TEXT REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        item_type TEXT NOT NULL DEFAULT 'inventory' CHECK(item_type IN ('inventory', 'expense')),
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL CHECK(quantity > 0),
        package_unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost_scaled INTEGER NOT NULL CHECK(unit_cost_scaled >= 0),
        allocated_landed_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(allocated_landed_cost_scaled >= 0),
        effective_unit_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(effective_unit_cost_scaled >= 0),
        discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
        tax_rate_percent REAL NOT NULL DEFAULT 0 CHECK(tax_rate_percent >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL CHECK(total_scaled >= 0),
        stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pbl_bill ON purchase_bill_lines(bill_id);
      CREATE INDEX IF NOT EXISTS idx_pbl_product ON purchase_bill_lines(product_id);
    `);

    // 7. Purchase Returns (Debit Notes)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        return_number TEXT NOT NULL,
        original_bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE RESTRICT,
        supplier_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
        supplier_name TEXT NOT NULL,
        return_date TEXT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'PKR',
        subtotal_scaled INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_scaled >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL DEFAULT 0 CHECK(total_scaled >= 0),
        refund_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount_scaled >= 0),
        settlement_type TEXT NOT NULL DEFAULT 'credit_note' CHECK(settlement_type IN ('credit_note', 'cash_refund', 'bank_refund')),
        journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        allow_over_return INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, return_number)
      );

      CREATE INDEX IF NOT EXISTS idx_pr_workspace_date ON purchase_returns(workspace_id, return_date);
      CREATE INDEX IF NOT EXISTS idx_pr_original_bill ON purchase_returns(original_bill_id);
      CREATE INDEX IF NOT EXISTS idx_pr_supplier ON purchase_returns(supplier_id);
    `);

    // 8. Purchase Return Lines
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS purchase_return_lines (
        id TEXT PRIMARY KEY NOT NULL,
        return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        original_bill_line_id TEXT NOT NULL REFERENCES purchase_bill_lines(id) ON DELETE RESTRICT,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        description TEXT NOT NULL,
        returned_quantity REAL NOT NULL CHECK(returned_quantity > 0),
        package_unit TEXT NOT NULL DEFAULT 'pcs',
        canonical_quantity REAL NOT NULL CHECK(canonical_quantity > 0),
        unit_cost_scaled INTEGER NOT NULL CHECK(unit_cost_scaled >= 0),
        tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
        total_scaled INTEGER NOT NULL CHECK(total_scaled >= 0),
        stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_prl_return ON purchase_return_lines(return_id);
      CREATE INDEX IF NOT EXISTS idx_prl_product ON purchase_return_lines(product_id);
      CREATE INDEX IF NOT EXISTS idx_prl_bill_line ON purchase_return_lines(original_bill_line_id);
    `);
  }
};
