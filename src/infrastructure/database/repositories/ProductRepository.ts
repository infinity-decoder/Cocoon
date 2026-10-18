/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { ProductUnit } from '../../../domain/inventory/InventoryItem';

export interface ProductRecord {
  id: string;
  workspaceId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: ProductUnit;
  costPriceScaled: bigint;
  salePriceScaled: bigint;
  wholesalePriceScaled?: bigint | null;
  currentStockQuantity: number;
  minStockAlert: number;
  currencyCode: string;
  isArchived: boolean;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  taxRatePercent: number;
  taxCode?: string | null;
  hasBatchTracking: boolean;
  hasSerialTracking: boolean;
  reorderThreshold: number;
  weightedAvgCostScaled: bigint;
  isActive: boolean;
  defaultSupplierId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductBarcodeRecord {
  id: string;
  workspaceId: string;
  productId: string;
  barcode: string;
  normalizedBarcode: string;
  packagingUnit: string;
  conversionFactor: number;
  priceScaled?: bigint | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductUnitConversionRecord {
  id: string;
  workspaceId: string;
  productId: string;
  unitName: string;
  canonicalUnit: string;
  conversionFactor: number;
  salePriceScaled?: bigint | null;
  purchasePriceScaled?: bigint | null;
  barcode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockLocationRecord {
  id: string;
  workspaceId: string;
  name: string;
  code: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementSourceType =
  | 'opening_stock'
  | 'goods_received'
  | 'sale_issue'
  | 'sales_return'
  | 'purchase_return'
  | 'damaged_wasted'
  | 'stock_adjustment'
  | 'stock_transfer'
  | 'reversal';

export interface StockMovementRecord {
  id: string;
  workspaceId: string;
  productId: string;
  locationId?: string | null;
  quantityDelta: number;
  canonicalUnit: string;
  sourceType: StockMovementSourceType;
  sourceId?: string | null;
  effectiveDate: string;
  unitCostScaled: bigint;
  totalCostScaled: bigint;
  batchNumber?: string | null;
  expiryDate?: string | null;
  serialNumber?: string | null;
  reason?: string | null;
  reversalOfMovementId?: string | null;
  isReversed: boolean;
  idempotencyKey?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ProductPriceHistoryRecord {
  id: string;
  workspaceId: string;
  productId: string;
  priceType: 'cost' | 'sale' | 'wholesale';
  oldPriceScaled: bigint;
  newPriceScaled: bigint;
  effectiveDate: string;
  changeReason?: string | null;
  changedBy: string;
  createdAt: string;
}

export interface ProductSupplierRecord {
  id: string;
  workspaceId: string;
  productId: string;
  supplierPartyId: string;
  supplierProductCode?: string | null;
  supplierCostPriceScaled: bigint;
  leadTimeDays: number;
  isPreferred: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface ProductFilterOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  brand?: string;
  isLowStock?: boolean;
  includeArchived?: boolean;
}

export class ProductRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<ProductRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM products WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findBySku(workspaceId: string, sku: string): Promise<ProductRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM products WHERE workspace_id = ? AND UPPER(sku) = UPPER(?) AND is_archived = 0 LIMIT 1`,
      [workspaceId, sku.trim()]
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(workspaceId: string, includeArchived = false): Promise<ProductRecord[]> {
    const sql = includeArchived
      ? `SELECT * FROM products WHERE workspace_id = ? ORDER BY name ASC`
      : `SELECT * FROM products WHERE workspace_id = ? AND is_archived = 0 AND is_active = 1 ORDER BY name ASC`;

    const rows = await this.conn.query<any>(sql, [workspaceId]);
    return rows.map(r => this.mapRow(r));
  }

  public async findByWorkspacePaged(
    workspaceId: string,
    options: ProductFilterOptions = {}
  ): Promise<{ items: ProductRecord[]; totalCount: number }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['workspace_id = ?'];
    const params: any[] = [workspaceId];

    if (!options.includeArchived) {
      conditions.push('is_archived = 0 AND is_active = 1');
    }

    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(name) LIKE ? OR LOWER(COALESCE(sku, "")) LIKE ? OR LOWER(COALESCE(barcode, "")) LIKE ? OR LOWER(COALESCE(category, "")) LIKE ?)');
      params.push(q, q, q, q);
    }

    if (options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.brand) {
      conditions.push('brand = ?');
      params.push(options.brand);
    }

    if (options.isLowStock) {
      conditions.push('current_stock_quantity <= min_stock_alert');
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await this.conn.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE ${whereClause}`,
      params
    );
    const totalCount = Number(countRows[0]?.count ?? 0);

    const rows = await this.conn.query<any>(
      `SELECT * FROM products WHERE ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return {
      items: rows.map(r => this.mapRow(r)),
      totalCount
    };
  }

  public async create(record: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ProductRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('prod');
    const created: ProductRecord = {
      ...record,
      id,
      description: record.description || null,
      category: record.category || null,
      brand: record.brand || null,
      imageUrl: record.imageUrl || null,
      taxRatePercent: record.taxRatePercent ?? 0,
      taxCode: record.taxCode || null,
      hasBatchTracking: Boolean(record.hasBatchTracking),
      hasSerialTracking: Boolean(record.hasSerialTracking),
      reorderThreshold: record.reorderThreshold ?? record.minStockAlert ?? 5,
      weightedAvgCostScaled: record.weightedAvgCostScaled ?? record.costPriceScaled ?? 0n,
      isActive: record.isActive !== undefined ? record.isActive : true,
      defaultSupplierId: record.defaultSupplierId || null,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO products (
        id, workspace_id, name, sku, barcode, unit, cost_price_scaled, sale_price_scaled,
        wholesale_price_scaled, current_stock_quantity, min_stock_alert, currency_code,
        is_archived, description, category, brand, image_url, tax_rate_percent, tax_code,
        has_batch_tracking, has_serial_tracking, reorder_threshold, weighted_avg_cost_scaled,
        is_active, default_supplier_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.name,
        created.sku || null,
        created.barcode || null,
        created.unit,
        Number(created.costPriceScaled),
        Number(created.salePriceScaled),
        created.wholesalePriceScaled !== undefined && created.wholesalePriceScaled !== null ? Number(created.wholesalePriceScaled) : null,
        created.currentStockQuantity,
        created.minStockAlert,
        created.currencyCode,
        created.isArchived ? 1 : 0,
        created.description,
        created.category,
        created.brand,
        created.imageUrl,
        created.taxRatePercent,
        created.taxCode,
        created.hasBatchTracking ? 1 : 0,
        created.hasSerialTracking ? 1 : 0,
        created.reorderThreshold,
        Number(created.weightedAvgCostScaled),
        created.isActive ? 1 : 0,
        created.defaultSupplierId,
        created.createdAt,
        created.updatedAt
      ]
    );

    // If barcode is present, insert into product_barcodes table as primary barcode
    if (created.barcode && created.barcode.trim()) {
      const normalized = created.barcode.trim().toUpperCase();
      const pbcId = generateEntityId('pbc');
      await this.conn.run(
        `INSERT OR IGNORE INTO product_barcodes (
           id, workspace_id, product_id, barcode, normalized_barcode,
           packaging_unit, conversion_factor, price_scaled, is_primary, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, 1, ?, ?)`,
        [pbcId, created.workspaceId, created.id, created.barcode.trim(), normalized, created.unit, Number(created.salePriceScaled), now, now]
      );
    }

    return created;
  }

  public async update(id: string, updates: Partial<ProductRecord>): Promise<ProductRecord> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Product ${id} not found.`);
    }

    const updated: ProductRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.conn.run(
      `UPDATE products SET
        name = ?, sku = ?, barcode = ?, unit = ?, cost_price_scaled = ?,
        sale_price_scaled = ?, wholesale_price_scaled = ?, current_stock_quantity = ?,
        min_stock_alert = ?, currency_code = ?, is_archived = ?, description = ?,
        category = ?, brand = ?, image_url = ?, tax_rate_percent = ?, tax_code = ?,
        has_batch_tracking = ?, has_serial_tracking = ?, reorder_threshold = ?,
        weighted_avg_cost_scaled = ?, is_active = ?, default_supplier_id = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.sku || null,
        updated.barcode || null,
        updated.unit,
        Number(updated.costPriceScaled),
        Number(updated.salePriceScaled),
        updated.wholesalePriceScaled !== undefined && updated.wholesalePriceScaled !== null ? Number(updated.wholesalePriceScaled) : null,
        updated.currentStockQuantity,
        updated.minStockAlert,
        updated.currencyCode,
        updated.isArchived ? 1 : 0,
        updated.description || null,
        updated.category || null,
        updated.brand || null,
        updated.imageUrl || null,
        updated.taxRatePercent,
        updated.taxCode || null,
        updated.hasBatchTracking ? 1 : 0,
        updated.hasSerialTracking ? 1 : 0,
        updated.reorderThreshold,
        Number(updated.weightedAvgCostScaled),
        updated.isActive ? 1 : 0,
        updated.defaultSupplierId || null,
        updated.updatedAt,
        id
      ]
    );

    return updated;
  }

  public async archive(id: string): Promise<void> {
    await this.update(id, { isArchived: true, isActive: false });
  }

  // --- Barcodes ---

  public async addBarcode(barcode: Omit<ProductBarcodeRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ProductBarcodeRecord> {
    const now = new Date().toISOString();
    const id = barcode.id || generateEntityId('pbc');
    const normalized = barcode.normalizedBarcode || barcode.barcode.trim().toUpperCase();

    // Check if barcode already exists in workspace
    const existing = await this.findByNormalizedBarcode(barcode.workspaceId, normalized);
    if (existing && existing.productId !== barcode.productId) {
      throw new Error(`Barcode "${barcode.barcode}" is already assigned to another product in this workspace.`);
    }

    const rec: ProductBarcodeRecord = {
      ...barcode,
      id,
      normalizedBarcode: normalized,
      createdAt: now,
      updatedAt: now
    };

    if (rec.isPrimary) {
      await this.conn.run(
        `UPDATE product_barcodes SET is_primary = 0 WHERE workspace_id = ? AND product_id = ?`,
        [rec.workspaceId, rec.productId]
      );
      await this.conn.run(
        `UPDATE products SET barcode = ? WHERE id = ?`,
        [rec.barcode, rec.productId]
      );
    }

    await this.conn.run(
      `INSERT INTO product_barcodes (
        id, workspace_id, product_id, barcode, normalized_barcode,
        packaging_unit, conversion_factor, price_scaled, is_primary, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, normalized_barcode) DO UPDATE SET
        packaging_unit = excluded.packaging_unit,
        conversion_factor = excluded.conversion_factor,
        price_scaled = excluded.price_scaled,
        is_primary = excluded.is_primary,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        rec.id,
        rec.workspaceId,
        rec.productId,
        rec.barcode,
        rec.normalizedBarcode,
        rec.packagingUnit,
        rec.conversionFactor,
        rec.priceScaled !== undefined && rec.priceScaled !== null ? Number(rec.priceScaled) : null,
        rec.isPrimary ? 1 : 0,
        rec.notes || null,
        rec.createdAt,
        rec.updatedAt
      ]
    );

    return rec;
  }

  public async findBarcodesByProductId(productId: string): Promise<ProductBarcodeRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM product_barcodes WHERE product_id = ? ORDER BY is_primary DESC, created_at ASC`,
      [productId]
    );
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      barcode: r.barcode,
      normalizedBarcode: r.normalized_barcode,
      packagingUnit: r.packaging_unit,
      conversionFactor: Number(r.conversion_factor),
      priceScaled: r.price_scaled != null ? BigInt(r.price_scaled) : null,
      isPrimary: Boolean(r.is_primary),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async findByNormalizedBarcode(workspaceId: string, normalizedBarcode: string): Promise<ProductBarcodeRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM product_barcodes WHERE workspace_id = ? AND normalized_barcode = ? LIMIT 1`,
      [workspaceId, normalizedBarcode.trim().toUpperCase()]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      barcode: r.barcode,
      normalizedBarcode: r.normalized_barcode,
      packagingUnit: r.packaging_unit,
      conversionFactor: Number(r.conversion_factor),
      priceScaled: r.price_scaled != null ? BigInt(r.price_scaled) : null,
      isPrimary: Boolean(r.is_primary),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async deleteBarcode(id: string): Promise<void> {
    await this.conn.run(`DELETE FROM product_barcodes WHERE id = ?`, [id]);
  }

  // --- Unit Conversions ---

  public async addUnitConversion(conversion: Omit<ProductUnitConversionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ProductUnitConversionRecord> {
    const now = new Date().toISOString();
    const id = conversion.id || generateEntityId('puc');
    const rec: ProductUnitConversionRecord = {
      ...conversion,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO product_unit_conversions (
        id, workspace_id, product_id, unit_name, canonical_unit,
        conversion_factor, sale_price_scaled, purchase_price_scaled, barcode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, product_id, unit_name) DO UPDATE SET
        conversion_factor = excluded.conversion_factor,
        sale_price_scaled = excluded.sale_price_scaled,
        purchase_price_scaled = excluded.purchase_price_scaled,
        barcode = excluded.barcode,
        updated_at = excluded.updated_at`,
      [
        rec.id,
        rec.workspaceId,
        rec.productId,
        rec.unitName,
        rec.canonicalUnit,
        rec.conversionFactor,
        rec.salePriceScaled !== undefined && rec.salePriceScaled !== null ? Number(rec.salePriceScaled) : null,
        rec.purchasePriceScaled !== undefined && rec.purchasePriceScaled !== null ? Number(rec.purchasePriceScaled) : null,
        rec.barcode || null,
        rec.createdAt,
        rec.updatedAt
      ]
    );

    return rec;
  }

  public async findUnitConversionsByProductId(productId: string): Promise<ProductUnitConversionRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM product_unit_conversions WHERE product_id = ? ORDER BY unit_name ASC`,
      [productId]
    );
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      unitName: r.unit_name,
      canonicalUnit: r.canonical_unit,
      conversionFactor: Number(r.conversion_factor),
      salePriceScaled: r.sale_price_scaled != null ? BigInt(r.sale_price_scaled) : null,
      purchasePriceScaled: r.purchase_price_scaled != null ? BigInt(r.purchase_price_scaled) : null,
      barcode: r.barcode,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async deleteUnitConversion(id: string): Promise<void> {
    await this.conn.run(`DELETE FROM product_unit_conversions WHERE id = ?`, [id]);
  }

  // --- Stock Locations ---

  public async getLocations(workspaceId: string): Promise<StockLocationRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM stock_locations WHERE workspace_id = ? AND is_active = 1 ORDER BY is_default DESC, name ASC`,
      [workspaceId]
    );
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      code: r.code,
      description: r.description,
      isDefault: Boolean(r.is_default),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getDefaultLocation(workspaceId: string): Promise<StockLocationRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM stock_locations WHERE workspace_id = ? AND is_default = 1 LIMIT 1`,
      [workspaceId]
    );
    if (rows.length === 0) {
      const now = new Date().toISOString();
      const locId = `loc_${workspaceId}_default`;
      await this.conn.run(
        `INSERT OR IGNORE INTO stock_locations (id, workspace_id, name, code, description, is_default, is_active, created_at, updated_at)
         VALUES (?, ?, 'Main Store', 'MAIN', 'Default primary store and inventory location', 1, 1, ?, ?)`,
        [locId, workspaceId, now, now]
      );
      return {
        id: locId,
        workspaceId,
        name: 'Main Store',
        code: 'MAIN',
        description: 'Default primary store and inventory location',
        isDefault: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
    }
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      code: r.code,
      description: r.description,
      isDefault: Boolean(r.is_default),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async createLocation(loc: Omit<StockLocationRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<StockLocationRecord> {
    const now = new Date().toISOString();
    const id = loc.id || generateEntityId('loc');
    const rec: StockLocationRecord = {
      ...loc,
      id,
      createdAt: now,
      updatedAt: now
    };

    if (rec.isDefault) {
      await this.conn.run(
        `UPDATE stock_locations SET is_default = 0 WHERE workspace_id = ?`,
        [rec.workspaceId]
      );
    }

    await this.conn.run(
      `INSERT INTO stock_locations (
        id, workspace_id, name, code, description, is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.id,
        rec.workspaceId,
        rec.name,
        rec.code,
        rec.description || null,
        rec.isDefault ? 1 : 0,
        rec.isActive ? 1 : 0,
        rec.createdAt,
        rec.updatedAt
      ]
    );

    return rec;
  }

  // --- Stock Movements Ledger ---

  public async createStockMovement(movement: Omit<StockMovementRecord, 'id' | 'createdAt' | 'isReversed'> & { id?: string }): Promise<StockMovementRecord> {
    const now = new Date().toISOString();
    const id = movement.id || generateEntityId('sm');
    const rec: StockMovementRecord = {
      ...movement,
      id,
      isReversed: false,
      createdAt: now
    };

    await this.conn.run(
      `INSERT INTO stock_movements (
        id, workspace_id, product_id, location_id, quantity_delta, canonical_unit,
        source_type, source_id, effective_date, unit_cost_scaled, total_cost_scaled,
        batch_number, expiry_date, serial_number, reason, reversal_of_movement_id,
        is_reversed, idempotency_key, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        rec.id,
        rec.workspaceId,
        rec.productId,
        rec.locationId || null,
        rec.quantityDelta,
        rec.canonicalUnit,
        rec.sourceType,
        rec.sourceId || null,
        rec.effectiveDate,
        Number(rec.unitCostScaled),
        Number(rec.totalCostScaled),
        rec.batchNumber || null,
        rec.expiryDate || null,
        rec.serialNumber || null,
        rec.reason || null,
        rec.reversalOfMovementId || null,
        rec.idempotencyKey || null,
        rec.createdBy || 'local_user',
        rec.createdAt
      ]
    );

    // Atomically update cached stock on product
    await this.reconcileStockFromMovements(rec.productId);

    return rec;
  }

  public async findMovementsByProductId(productId: string): Promise<StockMovementRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY effective_date DESC, created_at DESC, id DESC`,
      [productId]
    );
    return rows.map(r => this.mapMovementRow(r));
  }

  public async findMovementsByWorkspace(
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<StockMovementRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM stock_movements WHERE workspace_id = ? ORDER BY effective_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [workspaceId, limit, offset]
    );
    return rows.map(r => this.mapMovementRow(r));
  }

  public async reconcileStockFromMovements(productId: string): Promise<number> {
    const rows = await this.conn.query<{ net_stock: number | null }>(
      `SELECT SUM(quantity_delta) as net_stock FROM stock_movements WHERE product_id = ?`,
      [productId]
    );
    const netStock = Math.max(0, Number(rows[0]?.net_stock ?? 0));

    await this.conn.run(
      `UPDATE products SET current_stock_quantity = ?, updated_at = ? WHERE id = ?`,
      [netStock, new Date().toISOString(), productId]
    );

    return netStock;
  }

  // --- Price History ---

  public async recordPriceChange(history: Omit<ProductPriceHistoryRecord, 'id' | 'createdAt'> & { id?: string }): Promise<ProductPriceHistoryRecord> {
    const now = new Date().toISOString();
    const id = history.id || generateEntityId('pph');
    const rec: ProductPriceHistoryRecord = {
      ...history,
      id,
      createdAt: now
    };

    await this.conn.run(
      `INSERT INTO product_price_history (
        id, workspace_id, product_id, price_type, old_price_scaled,
        new_price_scaled, effective_date, change_reason, changed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.id,
        rec.workspaceId,
        rec.productId,
        rec.priceType,
        Number(rec.oldPriceScaled),
        Number(rec.newPriceScaled),
        rec.effectiveDate,
        rec.changeReason || null,
        rec.changedBy || 'local_user',
        rec.createdAt
      ]
    );

    return rec;
  }

  public async getPriceHistory(productId: string): Promise<ProductPriceHistoryRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM product_price_history WHERE product_id = ? ORDER BY effective_date DESC, created_at DESC`,
      [productId]
    );
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      priceType: r.price_type,
      oldPriceScaled: BigInt(r.old_price_scaled),
      newPriceScaled: BigInt(r.new_price_scaled),
      effectiveDate: r.effective_date,
      changeReason: r.change_reason,
      changedBy: r.changed_by,
      createdAt: r.created_at
    }));
  }

  // --- Suppliers ---

  public async addSupplierAssociation(sup: Omit<ProductSupplierRecord, 'id' | 'createdAt'> & { id?: string }): Promise<ProductSupplierRecord> {
    const now = new Date().toISOString();
    const id = sup.id || generateEntityId('psup');
    const rec: ProductSupplierRecord = {
      ...sup,
      id,
      createdAt: now
    };

    if (rec.isPreferred) {
      await this.conn.run(
        `UPDATE product_suppliers SET is_preferred = 0 WHERE workspace_id = ? AND product_id = ?`,
        [rec.workspaceId, rec.productId]
      );
    }

    await this.conn.run(
      `INSERT INTO product_suppliers (
        id, workspace_id, product_id, supplier_party_id, supplier_product_code,
        supplier_cost_price_scaled, lead_time_days, is_preferred, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, product_id, supplier_party_id) DO UPDATE SET
        supplier_product_code = excluded.supplier_product_code,
        supplier_cost_price_scaled = excluded.supplier_cost_price_scaled,
        lead_time_days = excluded.lead_time_days,
        is_preferred = excluded.is_preferred,
        notes = excluded.notes`,
      [
        rec.id,
        rec.workspaceId,
        rec.productId,
        rec.supplierPartyId,
        rec.supplierProductCode || null,
        Number(rec.supplierCostPriceScaled),
        rec.leadTimeDays,
        rec.isPreferred ? 1 : 0,
        rec.notes || null,
        rec.createdAt
      ]
    );

    return rec;
  }

  public async getSuppliersByProductId(productId: string): Promise<ProductSupplierRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT * FROM product_suppliers WHERE product_id = ? ORDER BY is_preferred DESC, created_at ASC`,
      [productId]
    );
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      supplierPartyId: r.supplier_party_id,
      supplierProductCode: r.supplier_product_code,
      supplierCostPriceScaled: BigInt(r.supplier_cost_price_scaled ?? 0),
      leadTimeDays: Number(r.lead_time_days ?? 0),
      isPreferred: Boolean(r.is_preferred),
      notes: r.notes,
      createdAt: r.created_at
    }));
  }

  // --- Row Mappers ---

  private mapRow(r: any): ProductRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      unit: r.unit,
      costPriceScaled: BigInt(r.cost_price_scaled ?? 0),
      salePriceScaled: BigInt(r.sale_price_scaled ?? 0),
      wholesalePriceScaled: r.wholesale_price_scaled != null ? BigInt(r.wholesale_price_scaled) : null,
      currentStockQuantity: Number(r.current_stock_quantity ?? 0),
      minStockAlert: Number(r.min_stock_alert ?? 0),
      currencyCode: r.currency_code,
      isArchived: Boolean(r.is_archived),
      description: r.description,
      category: r.category,
      brand: r.brand,
      imageUrl: r.image_url,
      taxRatePercent: Number(r.tax_rate_percent ?? 0),
      taxCode: r.tax_code,
      hasBatchTracking: Boolean(r.has_batch_tracking),
      hasSerialTracking: Boolean(r.has_serial_tracking),
      reorderThreshold: Number(r.reorder_threshold ?? r.min_stock_alert ?? 5),
      weightedAvgCostScaled: BigInt(r.weighted_avg_cost_scaled ?? r.cost_price_scaled ?? 0),
      isActive: r.is_active !== undefined && r.is_active !== null ? Boolean(r.is_active) : !r.is_archived,
      defaultSupplierId: r.default_supplier_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapMovementRow(r: any): StockMovementRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      productId: r.product_id,
      locationId: r.location_id,
      quantityDelta: Number(r.quantity_delta),
      canonicalUnit: r.canonical_unit,
      sourceType: r.source_type,
      sourceId: r.source_id,
      effectiveDate: r.effective_date,
      unitCostScaled: BigInt(r.unit_cost_scaled ?? 0),
      totalCostScaled: BigInt(r.total_cost_scaled ?? 0),
      batchNumber: r.batch_number,
      expiryDate: r.expiry_date,
      serialNumber: r.serial_number,
      reason: r.reason,
      reversalOfMovementId: r.reversal_of_movement_id,
      isReversed: Boolean(r.is_reversed),
      idempotencyKey: r.idempotency_key,
      createdBy: r.created_by,
      createdAt: r.created_at
    };
  }
}
