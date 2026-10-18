/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration003: Migration = {
  version: 3,
  name: '003_business_workspaces_and_isolation',
  description: 'Schema expansion for business profiles, products/inventory, documents, document lines, and cross-business isolation.',
  async up(conn: DatabaseConnection): Promise<void> {
    const ddl = `
-- 1. Business Profiles linked 1-to-1 with workspaces
CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL DEFAULT 'retail' CHECK(business_type IN ('retail', 'wholesale', 'services', 'general', 'distributor')),
  legal_name TEXT,
  tax_identifier TEXT,
  registration_number TEXT,
  logo_url TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_sequence INTEGER NOT NULL DEFAULT 1 CHECK(next_invoice_sequence >= 1),
  settings_json TEXT NOT NULL DEFAULT '{}',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Products and Inventory Items
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK(unit IN ('pcs', 'kg', 'g', 'ltr', 'ml', 'meter', 'box', 'pack', 'dozen')),
  cost_price_scaled INTEGER NOT NULL DEFAULT 0 CHECK(cost_price_scaled >= 0),
  sale_price_scaled INTEGER NOT NULL DEFAULT 0 CHECK(sale_price_scaled >= 0),
  wholesale_price_scaled INTEGER CHECK(wholesale_price_scaled >= 0),
  current_stock_quantity REAL NOT NULL DEFAULT 0,
  min_stock_alert REAL NOT NULL DEFAULT 5,
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Invoices, Bills and Transaction Documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('sales_invoice', 'purchase_bill', 'sales_return', 'purchase_return', 'receipt')),
  document_number TEXT NOT NULL,
  party_id TEXT REFERENCES parties(id) ON DELETE RESTRICT,
  party_name TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  subtotal_scaled INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_scaled >= 0),
  discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
  tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
  total_scaled INTEGER NOT NULL DEFAULT 0 CHECK(total_scaled >= 0),
  paid_amount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount_scaled >= 0),
  status TEXT NOT NULL CHECK(status IN ('draft', 'unpaid', 'partial', 'paid', 'cancelled')),
  notes TEXT,
  attachment_relative_path TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, document_number)
);

-- 4. Document Line Items
CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_price_scaled INTEGER NOT NULL CHECK(unit_price_scaled >= 0),
  discount_scaled INTEGER NOT NULL DEFAULT 0 CHECK(discount_scaled >= 0),
  tax_rate_percent REAL NOT NULL DEFAULT 0 CHECK(tax_rate_percent >= 0),
  tax_scaled INTEGER NOT NULL DEFAULT 0 CHECK(tax_scaled >= 0),
  total_scaled INTEGER NOT NULL CHECK(total_scaled >= 0)
);

-- 5. Indexes for Fast Scoped Queries
CREATE INDEX IF NOT EXISTS idx_business_profiles_ws ON business_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_ws_archived ON products(workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_products_ws_barcode ON products(workspace_id, barcode);
CREATE INDEX IF NOT EXISTS idx_documents_ws_type ON documents(workspace_id, document_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_documents_ws_party ON documents(workspace_id, party_id);
CREATE INDEX IF NOT EXISTS idx_document_lines_doc ON document_lines(document_id);
    `;

    await conn.execute(ddl);
  }
};
