/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryItem } from './InventoryItem';
import { Money } from '../money/Money';

describe('Domain: InventoryItem Entity', () => {
  it('tracks product barcode, adjusts stock accurately, and calculates asset valuation', () => {
    const item = new InventoryItem({
      id: 'prod-1',
      workspaceId: 'biz-1',
      name: 'Wireless Optical Mouse',
      sku: 'SKU-MOU-01',
      barcode: '8901234567890',
      unit: 'pcs',
      costPriceScaled: 8000000n, // 800.00 PKR cost
      salePriceScaled: 12000000n, // 1,200.00 PKR retail price
      currentStockQuantity: 15,
      minStockAlert: 5,
      currencyCode: 'PKR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    assert.equal(item.barcode, '8901234567890');
    assert.equal(item.sku, 'SKU-MOU-01');
    assert.equal(item.currentStock, 15);
    assert.equal(item.isLowStock, false);

    // Total asset value: 15 * 800 = 12,000 PKR
    const assetVal = item.calculateTotalAssetValue();
    assert.equal(assetVal.toDecimalNumber(), 12000);

    // Customer buys 12 units -> stock becomes 3 (below min alert 5)
    const afterSale = item.adjustStock(-12);
    assert.equal(afterSale.currentStock, 3);
    assert.equal(afterSale.isLowStock, true);

    // Restock 20 units -> stock becomes 23
    const afterRestock = afterSale.adjustStock(20);
    assert.equal(afterRestock.currentStock, 23);
    assert.equal(afterRestock.isLowStock, false);
  });

  it('correctly calculates asset valuation for fractional measured goods (kg, litres)', () => {
    // 2.75 kg of Basmati Rice @ 320.00 PKR / kg = 880.00 PKR asset value
    const bulkRice = new InventoryItem({
      id: 'prod-rice',
      workspaceId: 'biz-1',
      name: 'Super Kernel Basmati Rice',
      unit: 'kg',
      costPriceScaled: 3200000n, // 320.00 PKR per kg
      salePriceScaled: 4000000n, // 400.00 PKR per kg
      currentStockQuantity: 2.75,
      minStockAlert: 1.0,
      currencyCode: 'PKR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    const assetValue = bulkRice.calculateTotalAssetValue();
    assert.equal(assetValue.toDecimal(), 880.0);
    assert.equal(assetValue.format(), '₨ 880.00');
  });
});
