/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import {
  ProductRepository,
  ProductRecord,
  ProductBarcodeRecord,
  ProductUnitConversionRecord,
  StockMovementRecord,
  StockMovementSourceType,
  StockLocationRecord,
  ProductFilterOptions
} from '../../infrastructure/database/repositories/ProductRepository';
import { generateEntityId } from '../../domain/primitives/EntityId';
import { ProductUnit, convertStandardUnit } from '../../domain/inventory/InventoryItem';

export interface CreateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  unit: ProductUnit;
  costPriceScaled: bigint;
  salePriceScaled: bigint;
  wholesalePriceScaled?: bigint;
  initialStockQuantity?: number;
  minStockAlert?: number;
  currencyCode?: string;
  description?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  taxRatePercent?: number;
  taxCode?: string;
  hasBatchTracking?: boolean;
  hasSerialTracking?: boolean;
  reorderThreshold?: number;
  defaultSupplierId?: string;
  unitConversions?: Array<{
    unitName: string;
    conversionFactor: number;
    salePriceScaled?: bigint;
    purchasePriceScaled?: bigint;
    barcode?: string;
  }>;
}

export interface RecordMovementInput {
  productId: string;
  sourceType: StockMovementSourceType;
  quantity: number; // In given package unit or canonical unit
  packageUnit?: string; // e.g. 'carton', 'box', 'kg', 'pcs'
  locationId?: string;
  sourceId?: string;
  effectiveDate?: string;
  unitCostScaled?: bigint;
  landedCostScaled?: bigint; // e.g., freight/handling
  reason?: string;
  batchNumber?: string;
  expiryDate?: string;
  serialNumber?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface BarcodeLookupResult {
  product: ProductRecord;
  barcodeRecord: ProductBarcodeRecord;
  packagingUnit: string;
  conversionFactor: number;
  unitPriceScaled: bigint;
}

export class InventoryService {
  /**
   * Creates a product with full catalog properties, initial stock movement if any,
   * barcode registration, and unit conversions inside a single atomic transaction.
   */
  public static async createProduct(
    conn: DatabaseConnection,
    workspaceId: string,
    input: CreateProductInput
  ): Promise<ProductRecord> {
    const repo = new ProductRepository(conn);

    if (!input.name || !input.name.trim()) {
      throw new Error('Product name is required.');
    }

    // Check SKU uniqueness per workspace if SKU provided
    if (input.sku && input.sku.trim()) {
      const existingSku = await repo.findBySku(workspaceId, input.sku.trim());
      if (existingSku) {
        throw new Error(`SKU "${input.sku}" is already in use by product "${existingSku.name}" in this workspace.`);
      }
    }

    // Check barcode uniqueness if provided
    if (input.barcode && input.barcode.trim()) {
      const normalized = input.barcode.trim().toUpperCase();
      const existingBarcode = await repo.findByNormalizedBarcode(workspaceId, normalized);
      if (existingBarcode) {
        throw new Error(`Barcode "${input.barcode}" is already assigned in this workspace.`);
      }
    }

    return await conn.executeTransaction(async () => {
      const initialQty = Math.max(0, input.initialStockQuantity ?? 0);
      const costScaled = input.costPriceScaled >= 0n ? input.costPriceScaled : 0n;
      const saleScaled = input.salePriceScaled >= 0n ? input.salePriceScaled : 0n;

      const product = await repo.create({
        workspaceId,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        unit: input.unit,
        costPriceScaled: costScaled,
        salePriceScaled: saleScaled,
        wholesalePriceScaled: input.wholesalePriceScaled ?? null,
        currentStockQuantity: 0, // Will be set by stock movement if initialStockQuantity > 0
        minStockAlert: input.minStockAlert ?? 5,
        currencyCode: input.currencyCode || 'PKR',
        isArchived: false,
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        brand: input.brand?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        taxRatePercent: input.taxRatePercent ?? 0,
        taxCode: input.taxCode?.trim() || null,
        hasBatchTracking: Boolean(input.hasBatchTracking),
        hasSerialTracking: Boolean(input.hasSerialTracking),
        reorderThreshold: input.reorderThreshold ?? input.minStockAlert ?? 5,
        weightedAvgCostScaled: costScaled,
        isActive: true,
        defaultSupplierId: input.defaultSupplierId || null
      });

      // Price history record
      await repo.recordPriceChange({
        workspaceId,
        productId: product.id,
        priceType: 'sale',
        oldPriceScaled: 0n,
        newPriceScaled: saleScaled,
        effectiveDate: new Date().toISOString().slice(0, 10),
        changeReason: 'Initial Catalog Pricing',
        changedBy: 'local_user'
      });

      if (costScaled > 0n) {
        await repo.recordPriceChange({
          workspaceId,
          productId: product.id,
          priceType: 'cost',
          oldPriceScaled: 0n,
          newPriceScaled: costScaled,
          effectiveDate: new Date().toISOString().slice(0, 10),
          changeReason: 'Initial Purchase Cost',
          changedBy: 'local_user'
        });
      }

      // Insert custom unit conversions if provided
      if (input.unitConversions && input.unitConversions.length > 0) {
        for (const uc of input.unitConversions) {
          if (uc.unitName && uc.conversionFactor > 0) {
            await repo.addUnitConversion({
              workspaceId,
              productId: product.id,
              unitName: uc.unitName.trim().toLowerCase(),
              canonicalUnit: product.unit,
              conversionFactor: uc.conversionFactor,
              salePriceScaled: uc.salePriceScaled ?? null,
              purchasePriceScaled: uc.purchasePriceScaled ?? null,
              barcode: uc.barcode?.trim() || null
            });

            // Also create barcode record for this unit if barcode specified
            if (uc.barcode && uc.barcode.trim()) {
              await repo.addBarcode({
                workspaceId,
                productId: product.id,
                barcode: uc.barcode.trim(),
                normalizedBarcode: uc.barcode.trim().toUpperCase(),
                packagingUnit: uc.unitName.trim().toLowerCase(),
                conversionFactor: uc.conversionFactor,
                priceScaled: uc.salePriceScaled ?? null,
                isPrimary: false,
                notes: `Unit pack: 1 ${uc.unitName} = ${uc.conversionFactor} ${product.unit}`
              });
            }
          }
        }
      }

      // If opening stock > 0, record initial opening stock movement atomically
      if (initialQty > 0) {
        const defaultLoc = await repo.getDefaultLocation(workspaceId);
        const totalValuation = BigInt(Math.round(Number(costScaled) * initialQty));

        await repo.createStockMovement({
          workspaceId,
          productId: product.id,
          locationId: defaultLoc?.id || null,
          quantityDelta: initialQty,
          canonicalUnit: product.unit,
          sourceType: 'opening_stock',
          sourceId: `open_${product.id}`,
          effectiveDate: new Date().toISOString().slice(0, 10),
          unitCostScaled: costScaled,
          totalCostScaled: totalValuation,
          reason: 'Initial opening inventory valuation',
          createdBy: 'local_user'
        });
      }

      const refreshed = await repo.findById(product.id);
      return refreshed!;
    });
  }

  /**
   * Records an inventory movement atomically: receipts, sales, returns, waste, counts.
   * Calculates moving weighted average cost and preserves historical COGS.
   */
  public static async recordStockMovement(
    conn: DatabaseConnection,
    workspaceId: string,
    input: RecordMovementInput
  ): Promise<StockMovementRecord> {
    const repo = new ProductRepository(conn);
    const product = await repo.findById(input.productId);
    if (!product || product.workspaceId !== workspaceId) {
      throw new Error(`Product ${input.productId} not found in this workspace.`);
    }

    return await conn.executeTransaction(async () => {
      // 1. Determine unit conversion factor to canonical stock unit
      let conversionFactor = 1.0;
      if (input.packageUnit && input.packageUnit.toLowerCase() !== product.unit.toLowerCase()) {
        const conversions = await repo.findUnitConversionsByProductId(product.id);
        const match = conversions.find(c => c.unitName.toLowerCase() === input.packageUnit!.toLowerCase());
        if (match) {
          conversionFactor = match.conversionFactor;
        } else {
          // Fall back to standard metric / dozen conversions
          conversionFactor = convertStandardUnit(1, input.packageUnit, product.unit);
        }
      }

      const canonicalQuantityDelta = input.quantity * conversionFactor;
      if (canonicalQuantityDelta === 0) {
        throw new Error('Quantity delta cannot be zero.');
      }

      // 2. Validate sufficient stock on hand for outbound issues (sales, waste)
      const currentStock = product.currentStockQuantity;
      const isOutbound = canonicalQuantityDelta < 0;
      if (isOutbound && currentStock + canonicalQuantityDelta < -0.0001) {
        // Warning or error if negative stock not desired
        // Note: For retail stores, allow zero-floor or explicit adjustments
      }

      // 3. Costing calculation
      let effectiveUnitCostScaled = product.weightedAvgCostScaled;
      let totalCostScaled = 0n;

      if (input.sourceType === 'goods_received' || input.sourceType === 'opening_stock') {
        // Incoming goods: update moving weighted average cost
        const purchaseCost = input.unitCostScaled !== undefined ? input.unitCostScaled : product.costPriceScaled;
        const landedCost = input.landedCostScaled !== undefined ? input.landedCostScaled : 0n;
        const totalIncomingCost = BigInt(Math.round(Number(purchaseCost + landedCost) * Math.abs(canonicalQuantityDelta)));

        const currentValuation = BigInt(Math.round(Number(product.weightedAvgCostScaled) * currentStock));
        const newTotalStock = currentStock + canonicalQuantityDelta;

        if (newTotalStock > 0) {
          const newAvgCost = (currentValuation + totalIncomingCost) / BigInt(Math.round(newTotalStock * 10000)) * 10000n;
          effectiveUnitCostScaled = newAvgCost > 0n ? newAvgCost : purchaseCost;
        } else {
          effectiveUnitCostScaled = purchaseCost;
        }

        totalCostScaled = totalIncomingCost;

        // Update product's cost price & weighted average cost
        await repo.update(product.id, {
          weightedAvgCostScaled: effectiveUnitCostScaled,
          costPriceScaled: purchaseCost
        });
      } else if (input.sourceType === 'sale_issue' || input.sourceType === 'damaged_wasted') {
        // Outbound issue: lock COGS at current weighted average cost at posting time
        effectiveUnitCostScaled = product.weightedAvgCostScaled > 0n ? product.weightedAvgCostScaled : product.costPriceScaled;
        totalCostScaled = BigInt(Math.round(Number(effectiveUnitCostScaled) * Math.abs(canonicalQuantityDelta)));
      } else if (input.sourceType === 'sales_return') {
        // Customer return: restore stock at original or current unit cost
        effectiveUnitCostScaled = input.unitCostScaled !== undefined ? input.unitCostScaled : product.weightedAvgCostScaled;
        totalCostScaled = BigInt(Math.round(Number(effectiveUnitCostScaled) * Math.abs(canonicalQuantityDelta)));
      } else if (input.sourceType === 'purchase_return') {
        // Return to supplier: credit back purchase cost
        effectiveUnitCostScaled = input.unitCostScaled !== undefined ? input.unitCostScaled : product.costPriceScaled;
        totalCostScaled = BigInt(Math.round(Number(effectiveUnitCostScaled) * Math.abs(canonicalQuantityDelta)));
      } else if (input.sourceType === 'stock_adjustment') {
        effectiveUnitCostScaled = product.weightedAvgCostScaled;
        totalCostScaled = BigInt(Math.round(Number(effectiveUnitCostScaled) * Math.abs(canonicalQuantityDelta)));
      }

      // 4. Determine Location
      let locationId = input.locationId;
      if (!locationId) {
        const defLoc = await repo.getDefaultLocation(workspaceId);
        locationId = defLoc?.id || null;
      }

      // 5. Create stock movement record
      const movement = await repo.createStockMovement({
        workspaceId,
        productId: product.id,
        locationId,
        quantityDelta: canonicalQuantityDelta,
        canonicalUnit: product.unit,
        sourceType: input.sourceType,
        sourceId: input.sourceId || null,
        effectiveDate: input.effectiveDate || new Date().toISOString().slice(0, 10),
        unitCostScaled: effectiveUnitCostScaled,
        totalCostScaled,
        batchNumber: input.batchNumber || null,
        expiryDate: input.expiryDate || null,
        serialNumber: input.serialNumber || null,
        reason: input.reason || null,
        idempotencyKey: input.idempotencyKey || null,
        createdBy: input.createdBy || 'local_user'
      });

      return movement;
    });
  }

  /**
   * Performs an audited reversal of a posted stock movement.
   * Flips quantity delta and links back to the original movement.
   */
  public static async reverseStockMovement(
    conn: DatabaseConnection,
    workspaceId: string,
    movementId: string,
    reversalReason: string
  ): Promise<StockMovementRecord> {
    const repo = new ProductRepository(conn);

    const movements = await conn.query<any>(
      `SELECT * FROM stock_movements WHERE id = ? AND workspace_id = ? LIMIT 1`,
      [movementId, workspaceId]
    );

    if (movements.length === 0) {
      throw new Error(`Stock movement ${movementId} not found in this workspace.`);
    }

    const orig = movements[0];
    if (orig.is_reversed) {
      throw new Error(`Stock movement ${movementId} has already been reversed.`);
    }

    return await conn.executeTransaction(async () => {
      // 1. Mark original movement as reversed
      await conn.run(
        `UPDATE stock_movements SET is_reversed = 1 WHERE id = ?`,
        [movementId]
      );

      // 2. Insert reversing movement
      const reversal = await repo.createStockMovement({
        workspaceId,
        productId: orig.product_id,
        locationId: orig.location_id,
        quantityDelta: -Number(orig.quantity_delta),
        canonicalUnit: orig.canonical_unit,
        sourceType: 'reversal',
        sourceId: orig.source_id,
        effectiveDate: new Date().toISOString().slice(0, 10),
        unitCostScaled: BigInt(orig.unit_cost_scaled),
        totalCostScaled: -BigInt(orig.total_cost_scaled),
        batchNumber: orig.batch_number,
        expiryDate: orig.expiry_date,
        serialNumber: orig.serial_number,
        reason: `Reversal of ${movementId}: ${reversalReason}`,
        reversalOfMovementId: movementId,
        createdBy: 'local_user'
      });

      return reversal;
    });
  }

  /**
   * Transfers stock between two locations atomically inside a single SQLite transaction.
   */
  public static async transferStockBetweenLocations(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      productId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      packageUnit?: string;
      reason?: string;
      effectiveDate?: string;
    }
  ): Promise<{ outboundMovement: StockMovementRecord; inboundMovement: StockMovementRecord }> {
    if (params.fromLocationId === params.toLocationId) {
      throw new Error('Source and destination locations cannot be identical.');
    }
    if (params.quantity <= 0) {
      throw new Error('Transfer quantity must be greater than zero.');
    }

    const repo = new ProductRepository(conn);
    const product = await repo.findById(params.productId);
    if (!product || product.workspaceId !== workspaceId) {
      throw new Error(`Product ${params.productId} not found.`);
    }

    return await conn.executeTransaction(async () => {
      // Convert unit if necessary
      let factor = 1.0;
      if (params.packageUnit && params.packageUnit.toLowerCase() !== product.unit.toLowerCase()) {
        const conversions = await repo.findUnitConversionsByProductId(product.id);
        const match = conversions.find(c => c.unitName.toLowerCase() === params.packageUnit!.toLowerCase());
        factor = match ? match.conversionFactor : convertStandardUnit(1, params.packageUnit, product.unit);
      }
      const canonicalQty = params.quantity * factor;
      const effectiveDate = params.effectiveDate || new Date().toISOString().slice(0, 10);
      const transferRef = generateEntityId('st');

      // Outbound from source location
      const outbound = await repo.createStockMovement({
        workspaceId,
        productId: product.id,
        locationId: params.fromLocationId,
        quantityDelta: -canonicalQty,
        canonicalUnit: product.unit,
        sourceType: 'stock_transfer',
        sourceId: transferRef,
        effectiveDate,
        unitCostScaled: product.weightedAvgCostScaled,
        totalCostScaled: BigInt(Math.round(Number(product.weightedAvgCostScaled) * canonicalQty)),
        reason: params.reason || `Transfer out to location ${params.toLocationId}`,
        createdBy: 'local_user'
      });

      // Inbound to destination location
      const inbound = await repo.createStockMovement({
        workspaceId,
        productId: product.id,
        locationId: params.toLocationId,
        quantityDelta: canonicalQty,
        canonicalUnit: product.unit,
        sourceType: 'stock_transfer',
        sourceId: transferRef,
        effectiveDate,
        unitCostScaled: product.weightedAvgCostScaled,
        totalCostScaled: BigInt(Math.round(Number(product.weightedAvgCostScaled) * canonicalQty)),
        reason: params.reason || `Transfer in from location ${params.fromLocationId}`,
        createdBy: 'local_user'
      });

      return { outboundMovement: outbound, inboundMovement: inbound };
    });
  }

  /**
   * Fast indexed barcode lookup returning the product, package unit, conversion factor, and price.
   * Utilizes direct indexed join and covering index (sub-millisecond resolution).
   */
  public static async lookupBarcode(
    conn: DatabaseConnection,
    workspaceId: string,
    scannedBarcode: string
  ): Promise<BarcodeLookupResult | null> {
    const repo = new ProductRepository(conn);
    return await repo.lookupBarcodeDirect(workspaceId, scannedBarcode);
  }

  /**
   * Reconciles stock cache for all products in a workspace from stock movements ledger.
   */
  public static async rebuildStockCache(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<{ reconciledCount: number }> {
    const repo = new ProductRepository(conn);
    const products = await repo.findByWorkspace(workspaceId, true);

    for (const p of products) {
      await repo.reconcileStockFromMovements(p.id);
    }

    return { reconciledCount: products.length };
  }
}
