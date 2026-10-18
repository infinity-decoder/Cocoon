/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';
import { WorkspaceService } from './WorkspaceService';
import { InventoryService } from './InventoryService';
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';

describe('Application Service: Product Catalog & Inventory Domain', () => {
  async function setupTestDb() {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_inventory_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);

    // Create Business A and Business B workspaces
    const bizA = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Alpha Supermart',
      currencyCode: 'PKR',
      businessType: 'retail'
    });

    const bizB = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Beta Grocery',
      currencyCode: 'PKR',
      businessType: 'retail'
    });

    return { conn, bizA, bizB };
  }

  it('creates product with catalog metadata, unit conversions, and opening stock atomically', async () => {
    const { conn, bizA } = await setupTestDb();
    const repo = new ProductRepository(conn);

    // Create product sold by piece, packaged in cartons (1 carton = 24 pcs)
    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Organic Milk 1L',
      sku: 'MILK-1L',
      barcode: '8901234567890',
      unit: 'pcs',
      costPriceScaled: 2000000n, // 200 PKR
      salePriceScaled: 2500000n, // 250 PKR
      initialStockQuantity: 100, // 100 pcs opening stock
      minStockAlert: 15,
      category: 'Dairy',
      brand: 'FarmFresh',
      taxRatePercent: 5,
      unitConversions: [
        {
          unitName: 'carton',
          conversionFactor: 24,
          salePriceScaled: 57600000n, // 24 * 240 = 5760 PKR (bulk discount)
          barcode: '8901234567899'
        }
      ]
    });

    assert.equal(product.name, 'Organic Milk 1L');
    assert.equal(product.sku, 'MILK-1L');
    assert.equal(product.currentStockQuantity, 100);
    assert.equal(product.category, 'Dairy');
    assert.equal(product.brand, 'FarmFresh');
    assert.equal(product.taxRatePercent, 5);
    assert.equal(product.weightedAvgCostScaled, 2000000n);

    // Verify stock movements ledger contains the opening stock entry
    const movements = await repo.findMovementsByProductId(product.id);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].sourceType, 'opening_stock');
    assert.equal(movements[0].quantityDelta, 100);
    assert.equal(movements[0].unitCostScaled, 2000000n);

    // Verify barcodes registered (piece barcode and carton barcode)
    const barcodes = await repo.findBarcodesByProductId(product.id);
    assert.equal(barcodes.length, 2);
    const cartonBarcode = barcodes.find(b => b.barcode === '8901234567899');
    assert.notEqual(cartonBarcode, undefined);
    assert.equal(cartonBarcode?.conversionFactor, 24);
    assert.equal(cartonBarcode?.packagingUnit, 'carton');
  });

  it('enforces SKU uniqueness per workspace and allows duplicate SKU across different workspaces', async () => {
    const { conn, bizA, bizB } = await setupTestDb();

    // 1. Create product in Biz A
    await InventoryService.createProduct(conn, bizA.id, {
      name: 'Soda Can 330ml',
      sku: 'SODA-330',
      unit: 'pcs',
      costPriceScaled: 500000n,
      salePriceScaled: 700000n
    });

    // 2. Reject duplicate SKU within same workspace Biz A
    await assert.rejects(
      async () => {
        await InventoryService.createProduct(conn, bizA.id, {
          name: 'Diet Soda Can 330ml',
          sku: 'SODA-330', // Duplicate SKU in Biz A!
          unit: 'pcs',
          costPriceScaled: 500000n,
          salePriceScaled: 700000n
        });
      },
      /already in use/
    );

    // 3. Allow same SKU in different workspace Biz B
    const prodB = await InventoryService.createProduct(conn, bizB.id, {
      name: 'Soda Can 330ml',
      sku: 'SODA-330', // Valid in Biz B!
      unit: 'pcs',
      costPriceScaled: 480000n,
      salePriceScaled: 650000n
    });

    assert.notEqual(prodB, null);
    assert.equal(prodB.sku, 'SODA-330');
  });

  it('correctly converts packaged quantities to canonical stock units (carton to pieces, kg to grams)', async () => {
    const { conn, bizA } = await setupTestDb();
    const repo = new ProductRepository(conn);

    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Instant Noodles Pack',
      unit: 'pcs',
      costPriceScaled: 400000n, // 40 PKR
      salePriceScaled: 600000n,
      initialStockQuantity: 0,
      unitConversions: [
        {
          unitName: 'carton',
          conversionFactor: 36 // 1 carton = 36 pieces
        }
      ]
    });

    // 1. Receive 5 cartons from supplier -> should add 5 * 36 = 180 pieces
    await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'goods_received',
      quantity: 5,
      packageUnit: 'carton',
      unitCostScaled: 400000n
    });

    let current = await repo.findById(product.id);
    assert.equal(current?.currentStockQuantity, 180);

    // 2. Sell 2 cartons -> should issue 2 * 36 = 72 pieces
    await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'sale_issue',
      quantity: -2,
      packageUnit: 'carton'
    });

    current = await repo.findById(product.id);
    assert.equal(current?.currentStockQuantity, 108);

    // 3. Sell 8 individual pieces -> should issue 8 pieces
    await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'sale_issue',
      quantity: -8,
      packageUnit: 'pcs'
    });

    current = await repo.findById(product.id);
    assert.equal(current?.currentStockQuantity, 100);

    // Verify stock ledger reconciliation
    const reconciled = await repo.reconcileStockFromMovements(product.id);
    assert.equal(reconciled, 100);
  });

  it('calculates Moving Weighted Average Cost accurately including landed costs, and locks historical COGS', async () => {
    const { conn, bizA } = await setupTestDb();
    const repo = new ProductRepository(conn);

    // Initial: 10 units @ 100 PKR
    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Cooking Oil 1L',
      unit: 'pcs',
      costPriceScaled: 1000000n, // 100 PKR
      salePriceScaled: 1500000n,
      initialStockQuantity: 10
    });

    assert.equal(product.currentStockQuantity, 10);
    assert.equal(product.weightedAvgCostScaled, 1000000n);

    // Step 1: Receive 10 more units @ 120 PKR + 10 PKR landed cost (freight) = 130 PKR effective
    // New total valuation = (10 * 100) + (10 * 130) = 1000 + 1300 = 2300 PKR
    // New average cost = 2300 / 20 = 115 PKR (1150000n)
    await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'goods_received',
      quantity: 10,
      unitCostScaled: 1200000n,
      landedCostScaled: 100000n // freight
    });

    let updated = await repo.findById(product.id);
    assert.equal(updated?.currentStockQuantity, 20);
    assert.equal(updated?.weightedAvgCostScaled, 1150000n);

    // Step 2: Sale of 5 units. COGS must be recorded at 115 PKR (total COGS = 575 PKR)
    const saleMovement = await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'sale_issue',
      quantity: -5
    });

    assert.equal(saleMovement.unitCostScaled, 1150000n);
    assert.equal(saleMovement.totalCostScaled, 5750000n);

    // Step 3: Purchase price later jumps to 200 PKR.
    // Ensure the earlier sale's historical COGS remains locked at 115 PKR!
    await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'goods_received',
      quantity: 15,
      unitCostScaled: 2000000n
    });

    const movements = await repo.findMovementsByProductId(product.id);
    const saleInLedger = movements.find(m => m.id === saleMovement.id);
    assert.equal(saleInLedger?.unitCostScaled, 1150000n); // Locked!
    assert.equal(saleInLedger?.totalCostScaled, 5750000n); // Unaltered!
  });

  it('performs audited stock movement reversals, preserving history and flipping quantities', async () => {
    const { conn, bizA } = await setupTestDb();
    const repo = new ProductRepository(conn);

    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Fresh Apples',
      unit: 'kg',
      costPriceScaled: 1500000n,
      salePriceScaled: 2200000n,
      initialStockQuantity: 50 // 50 kg
    });

    // 1. Erroneously record 10 kg damaged/wasted goods
    const wasteMovement = await InventoryService.recordStockMovement(conn, bizA.id, {
      productId: product.id,
      sourceType: 'damaged_wasted',
      quantity: -10,
      reason: 'Entered by mistake'
    });

    let prod = await repo.findById(product.id);
    assert.equal(prod?.currentStockQuantity, 40);

    // 2. Perform audited reversal
    const reversalMovement = await InventoryService.reverseStockMovement(
      conn,
      bizA.id,
      wasteMovement.id,
      'Physical inspection confirmed fruit was undamaged'
    );

    assert.equal(reversalMovement.quantityDelta, 10); // Negated (-(-10) = +10)
    assert.equal(reversalMovement.sourceType, 'reversal');
    assert.equal(reversalMovement.reversalOfMovementId, wasteMovement.id);

    // Stock on hand restored to 50
    prod = await repo.findById(product.id);
    assert.equal(prod?.currentStockQuantity, 50);

    // 3. Cannot reverse the same movement twice
    await assert.rejects(
      async () => {
        await InventoryService.reverseStockMovement(conn, bizA.id, wasteMovement.id, 'Second reversal');
      },
      /already been reversed/
    );
  });

  it('transfers stock atomically between locations and rejects same-location transfers', async () => {
    const { conn, bizA } = await setupTestDb();
    const repo = new ProductRepository(conn);

    // Create a second location: Warehouse
    const warehouseLoc = await repo.createLocation({
      workspaceId: bizA.id,
      name: 'Back Warehouse',
      code: 'WAREHOUSE',
      isDefault: false,
      isActive: true
    });

    const defaultLoc = await repo.getDefaultLocation(bizA.id);
    assert.notEqual(defaultLoc, null);

    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Basmati Rice 5kg',
      unit: 'pcs',
      costPriceScaled: 12000000n,
      salePriceScaled: 16000000n,
      initialStockQuantity: 100
    });

    // 1. Transfer 30 bags from Main Store to Warehouse
    const transfer = await InventoryService.transferStockBetweenLocations(conn, bizA.id, {
      productId: product.id,
      fromLocationId: defaultLoc!.id,
      toLocationId: warehouseLoc.id,
      quantity: 30,
      reason: 'Shift excess stock to back warehouse'
    });

    assert.equal(transfer.outboundMovement.quantityDelta, -30);
    assert.equal(transfer.outboundMovement.locationId, defaultLoc!.id);
    assert.equal(transfer.inboundMovement.quantityDelta, 30);
    assert.equal(transfer.inboundMovement.locationId, warehouseLoc.id);

    // Net stock on hand remains 100
    const prod = await repo.findById(product.id);
    assert.equal(prod?.currentStockQuantity, 100);

    // 2. Reject transfer where source and destination are identical
    await assert.rejects(
      async () => {
        await InventoryService.transferStockBetweenLocations(conn, bizA.id, {
          productId: product.id,
          fromLocationId: defaultLoc!.id,
          toLocationId: defaultLoc!.id,
          quantity: 10
        });
      },
      /cannot be identical/
    );
  });

  it('performs fast indexed barcode lookup and retrieves product with packaging unit and conversion factor', async () => {
    const { conn, bizA } = await setupTestDb();

    // Create a product with carton barcode
    const product = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Sparkling Mineral Water',
      barcode: '1112223334445', // Piece barcode
      unit: 'pcs',
      costPriceScaled: 800000n,
      salePriceScaled: 1200000n, // 120 PKR per bottle
      unitConversions: [
        {
          unitName: 'pack',
          conversionFactor: 6,
          salePriceScaled: 6600000n, // 660 PKR for 6-pack (110 each)
          barcode: '9998887776665' // Pack barcode
        }
      ]
    });

    // 1. Scan piece barcode
    const pieceLookup = await InventoryService.lookupBarcode(conn, bizA.id, '1112223334445');
    assert.notEqual(pieceLookup, null);
    assert.equal(pieceLookup?.product.id, product.id);
    assert.equal(pieceLookup?.packagingUnit, 'pcs');
    assert.equal(pieceLookup?.conversionFactor, 1.0);
    assert.equal(pieceLookup?.unitPriceScaled, 1200000n);

    // 2. Scan pack barcode
    const packLookup = await InventoryService.lookupBarcode(conn, bizA.id, '9998887776665');
    assert.notEqual(packLookup, null);
    assert.equal(packLookup?.product.id, product.id);
    assert.equal(packLookup?.packagingUnit, 'pack');
    assert.equal(packLookup?.conversionFactor, 6);
    assert.equal(packLookup?.unitPriceScaled, 6600000n);

    // 3. Scan unknown barcode -> returns null
    const unknownLookup = await InventoryService.lookupBarcode(conn, bizA.id, '0000000000000');
    assert.equal(unknownLookup, null);
  });

  it('strictly enforces business boundaries between Business A and Business B', async () => {
    const { conn, bizA, bizB } = await setupTestDb();
    const repo = new ProductRepository(conn);

    const prodA = await InventoryService.createProduct(conn, bizA.id, {
      name: 'Product Exclusively In A',
      unit: 'pcs',
      costPriceScaled: 1000000n,
      salePriceScaled: 1500000n,
      initialStockQuantity: 20
    });

    // Business B cannot query or record movements on Business A's product
    await assert.rejects(
      async () => {
        await InventoryService.recordStockMovement(conn, bizB.id, {
          productId: prodA.id,
          sourceType: 'sale_issue',
          quantity: -5
        });
      },
      /not found in this workspace/
    );

    // Business B listing does not include Business A's products
    const listB = await repo.findByWorkspace(bizB.id);
    assert.equal(listB.some(p => p.id === prodA.id), false);
  });
});
