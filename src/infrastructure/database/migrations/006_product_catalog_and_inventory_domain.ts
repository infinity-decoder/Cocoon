/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export const migration006: Migration = {
  version: 6,
  name: '006_product_catalog_and_inventory_domain',
  description: 'Product catalog enhancements, multi-unit conversions, barcodes, stock movements ledger, inventory costing and locations.',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Expand products table with catalog metadata, tax, tracking, and costing
    const productColumns = [
      'description TEXT',
      'category TEXT',
      'brand TEXT',
      'image_url TEXT',
      'tax_rate_percent REAL NOT NULL DEFAULT 0',
      'tax_code TEXT',
      'has_batch_tracking INTEGER NOT NULL DEFAULT 0',
      'has_serial_tracking INTEGER NOT NULL DEFAULT 0',
      'reorder_threshold REAL NOT NULL DEFAULT 5',
      'weighted_avg_cost_scaled INTEGER NOT NULL DEFAULT 0',
      'is_active INTEGER NOT NULL DEFAULT 1',
      'default_supplier_id TEXT REFERENCES parties(id) ON DELETE SET NULL'
    ];

    for (const colDef of productColumns) {
      try {
        await conn.execute(`ALTER TABLE products ADD COLUMN ${colDef};`);
      } catch (err: any) {
        if (!/duplicate column/i.test(err?.message || '') && !/already exists/i.test(err?.message || '')) {
          // ignore duplicate column on rerun
        }
      }
    }

    // SKU index per workspace
    await conn.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_workspace_sku
      ON products(workspace_id, sku)
      WHERE sku IS NOT NULL AND sku != '';
    `);

    // 2. Stock Locations table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS stock_locations (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, code)
      );

      CREATE INDEX IF NOT EXISTS idx_stock_locations_ws ON stock_locations(workspace_id);
    `);

    // 3. Product Barcodes table (supporting multiple barcodes per product with packaging unit and conversion)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_barcodes (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        barcode TEXT NOT NULL,
        normalized_barcode TEXT NOT NULL,
        packaging_unit TEXT NOT NULL DEFAULT 'pcs',
        conversion_factor REAL NOT NULL DEFAULT 1.0,
        price_scaled INTEGER,
        is_primary INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_barcodes_workspace_code
      ON product_barcodes(workspace_id, normalized_barcode);

      CREATE INDEX IF NOT EXISTS idx_barcodes_product
      ON product_barcodes(product_id);
    `);

    // 4. Product Unit Conversions table (e.g., 1 carton = 24 pcs, 1 box = 12 pcs, 1 kg = 1000 g)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_unit_conversions (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        unit_name TEXT NOT NULL,
        canonical_unit TEXT NOT NULL,
        conversion_factor REAL NOT NULL CHECK(conversion_factor > 0),
        sale_price_scaled INTEGER,
        purchase_price_scaled INTEGER,
        barcode TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, product_id, unit_name)
      );

      CREATE INDEX IF NOT EXISTS idx_unit_conversions_prod
      ON product_unit_conversions(product_id);
    `);

    // 5. Stock Movements Ledger table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        location_id TEXT REFERENCES stock_locations(id) ON DELETE RESTRICT,
        quantity_delta REAL NOT NULL,
        canonical_unit TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN (
          'opening_stock', 'goods_received', 'sale_issue', 'sales_return',
          'purchase_return', 'damaged_wasted', 'stock_adjustment', 'stock_transfer', 'reversal'
        )),
        source_id TEXT,
        effective_date TEXT NOT NULL,
        unit_cost_scaled INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_scaled >= 0),
        total_cost_scaled INTEGER NOT NULL DEFAULT 0,
        batch_number TEXT,
        expiry_date TEXT,
        serial_number TEXT,
        reason TEXT,
        reversal_of_movement_id TEXT REFERENCES stock_movements(id) ON DELETE SET NULL,
        is_reversed INTEGER NOT NULL DEFAULT 0,
        idempotency_key TEXT,
        created_by TEXT NOT NULL DEFAULT 'local_user',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stock_movements_ws_prod_date
      ON stock_movements(workspace_id, product_id, effective_date);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_source
      ON stock_movements(source_type, source_id);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_reversal
      ON stock_movements(reversal_of_movement_id);
    `);

    // 6. Product Price History table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_price_history (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        price_type TEXT NOT NULL CHECK(price_type IN ('cost', 'sale', 'wholesale')),
        old_price_scaled INTEGER NOT NULL,
        new_price_scaled INTEGER NOT NULL,
        effective_date TEXT NOT NULL,
        change_reason TEXT,
        changed_by TEXT NOT NULL DEFAULT 'local_user',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_prod
      ON product_price_history(product_id, effective_date);
    `);

    // 7. Product Suppliers Association table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_suppliers (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        supplier_party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        supplier_product_code TEXT,
        supplier_cost_price_scaled INTEGER NOT NULL DEFAULT 0,
        lead_time_days INTEGER NOT NULL DEFAULT 0,
        is_preferred INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id, product_id, supplier_party_id)
      );

      CREATE INDEX IF NOT EXISTS idx_product_suppliers_prod
      ON product_suppliers(product_id);
    `);

    // 8. Seed default location for existing workspaces
    const workspaces = await conn.query<{ id: string }>('SELECT id FROM workspaces');
    const now = new Date().toISOString();
    for (const ws of workspaces) {
      const locId = `loc_${ws.id}_default`;
      await conn.run(
        `INSERT OR IGNORE INTO stock_locations (id, workspace_id, name, code, description, is_default, is_active, created_at, updated_at)
         VALUES (?, ?, 'Main Store', 'MAIN', 'Default primary store and inventory location', 1, 1, ?, ?)`,
        [locId, ws.id, now, now]
      );
    }

    // 9. Backfill product_barcodes from existing products with barcodes
    const productsWithBarcode = await conn.query<{ id: string; workspace_id: string; barcode: string; unit: string; sale_price_scaled: number }>(
      `SELECT id, workspace_id, barcode, unit, sale_price_scaled FROM products WHERE barcode IS NOT NULL AND barcode != ''`
    );
    for (const p of productsWithBarcode) {
      const normalized = p.barcode.trim().toUpperCase();
      const barcodeId = generateEntityId('pbc');
      await conn.run(
        `INSERT OR IGNORE INTO product_barcodes (
           id, workspace_id, product_id, barcode, normalized_barcode,
           packaging_unit, conversion_factor, price_scaled, is_primary, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, 1, ?, ?)`,
        [barcodeId, p.workspace_id, p.id, p.barcode.trim(), normalized, p.unit || 'pcs', p.sale_price_scaled, now, now]
      );
    }
  }
};
