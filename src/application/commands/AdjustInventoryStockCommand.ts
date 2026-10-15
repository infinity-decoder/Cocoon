/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InventoryItem } from '../../domain/inventory/InventoryItem';

export interface AdjustInventoryStockInput {
  item: InventoryItem;
  quantityDelta: number; // positive for restock / purchase, negative for sale
  reason?: string;
}

export class AdjustInventoryStockCommandHandler {
  public execute(input: AdjustInventoryStockInput): InventoryItem {
    return input.item.adjustStock(input.quantityDelta);
  }
}
