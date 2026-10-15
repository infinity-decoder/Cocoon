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
  createdAt: string;
  updatedAt: string;
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
    return this._props.currentStockQuantity <= this._props.minStockAlert;
  }

  public get costPrice(): Money {
    return Money.fromScaled(this._props.costPriceScaled, this._props.currencyCode);
  }

  public get salePrice(): Money {
    return Money.fromScaled(this._props.salePriceScaled, this._props.currencyCode);
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
   * Evaluates total asset value of this stock item on hand based on cost price.
   * Supports measured decimal quantities (e.g. 2.75 kg or 1.5 litres) with zero precision loss.
   */
  public calculateTotalAssetValue(): Money {
    return this.costPrice.multiplyByQuantity(this._props.currentStockQuantity);
  }
}
