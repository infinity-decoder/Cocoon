/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../money/Money';

export type ProductUnit = 'pcs' | 'kg' | 'g' | 'ltr' | 'ml' | 'meter' | 'box' | 'pack' | 'dozen';

export interface InventoryItemProps {
  id: string;
  workspaceId: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit: ProductUnit;
  costPriceScaled: bigint;
  salePriceScaled: bigint;
  wholesalePriceScaled?: bigint;
  currentStockQuantity: number;
  minStockAlert: number;
  currencyCode: string;
  isArchived: boolean;
  description?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  taxRatePercent?: number;
  taxCode?: string;
  hasBatchTracking?: boolean;
  hasSerialTracking?: boolean;
  reorderThreshold?: number;
  weightedAvgCostScaled?: bigint;
  isActive?: boolean;
  defaultSupplierId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Standard unit conversion utility for retail mart operations.
 * Handles piece, pack, carton, box, dozen, weight (kg, g), and volume (ltr, ml).
 */
export function convertStandardUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  customConversionFactor?: number
): number {
  if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return quantity;
  }

  // If a custom product-level conversion factor is provided (e.g. 1 carton = 24 pcs)
  if (customConversionFactor && customConversionFactor > 0) {
    return quantity * customConversionFactor;
  }

  const normalizedFrom = fromUnit.toLowerCase().trim();
  const normalizedTo = toUnit.toLowerCase().trim();

  // Metric weight conversions
  if (normalizedFrom === 'kg' && normalizedTo === 'g') return quantity * 1000;
  if (normalizedFrom === 'g' && normalizedTo === 'kg') return quantity / 1000;

  // Metric volume conversions
  if (normalizedFrom === 'ltr' && normalizedTo === 'ml') return quantity * 1000;
  if (normalizedFrom === 'ml' && normalizedTo === 'ltr') return quantity / 1000;

  // Packaging conversions
  if (normalizedFrom === 'dozen' && normalizedTo === 'pcs') return quantity * 12;
  if (normalizedFrom === 'pcs' && normalizedTo === 'dozen') return quantity / 12;

  // Default fallback
  return quantity;
}

export class InventoryItem {
  private _props: InventoryItemProps;

  constructor(props: InventoryItemProps) {
    this._props = { ...props };
  }

  public get id(): string {
    return this._props.id;
  }

  public get workspaceId(): string {
    return this._props.workspaceId;
  }

  public get name(): string {
    return this._props.name;
  }

  public get barcode(): string | undefined {
    return this._props.barcode;
  }

  public get sku(): string | undefined {
    return this._props.sku;
  }

  public get unit(): ProductUnit {
    return this._props.unit;
  }

  public get currentStock(): number {
    return this._props.currentStockQuantity;
  }

  public get isLowStock(): boolean {
    const threshold = this._props.reorderThreshold ?? this._props.minStockAlert;
    return this._props.currentStockQuantity <= threshold;
  }

  public get costPrice(): Money {
    return Money.fromScaled(this._props.costPriceScaled, this._props.currencyCode);
  }

  public get weightedAvgCost(): Money {
    const scaled = this._props.weightedAvgCostScaled ?? this._props.costPriceScaled;
    return Money.fromScaled(scaled, this._props.currencyCode);
  }

  public get salePrice(): Money {
    return Money.fromScaled(this._props.salePriceScaled, this._props.currencyCode);
  }

  public get wholesalePrice(): Money | undefined {
    if (this._props.wholesalePriceScaled === undefined || this._props.wholesalePriceScaled === null) return undefined;
    return Money.fromScaled(this._props.wholesalePriceScaled, this._props.currencyCode);
  }

  public get category(): string | undefined {
    return this._props.category;
  }

  public get brand(): string | undefined {
    return this._props.brand;
  }

  public get description(): string | undefined {
    return this._props.description;
  }

  public get taxRatePercent(): number {
    return this._props.taxRatePercent ?? 0;
  }

  public get hasBatchTracking(): boolean {
    return Boolean(this._props.hasBatchTracking);
  }

  public get hasSerialTracking(): boolean {
    return Boolean(this._props.hasSerialTracking);
  }

  public get isActive(): boolean {
    return this._props.isActive !== false && !this._props.isArchived;
  }

  public get props(): Readonly<InventoryItemProps> {
    return Object.freeze({ ...this._props });
  }

  /**
   * Adjusts stock quantity on purchase receipt, sales checkout, or inventory count.
   */
  public adjustStock(quantityDelta: number): InventoryItem {
    const nextQty = this._props.currentStockQuantity + quantityDelta;
    return new InventoryItem({
      ...this._props,
      currentStockQuantity: Math.max(0, nextQty),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Evaluates total asset value of this stock item on hand based on weighted average cost.
   * Supports measured decimal quantities (e.g. 2.75 kg or 1.5 litres) with zero precision loss.
   */
  public calculateTotalAssetValue(): Money {
    return this.weightedAvgCost.multiplyByQuantity(this._props.currentStockQuantity);
  }
}
