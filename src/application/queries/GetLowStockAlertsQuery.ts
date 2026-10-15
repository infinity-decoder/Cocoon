/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InventoryItem } from '../../domain/inventory/InventoryItem';

export interface LowStockAlertItem {
  id: string;
  name: string;
  barcode?: string;
  currentStock: number;
  minStockAlert: number;
  unit: string;
  deficitQuantity: number;
}

export class GetLowStockAlertsQueryHandler {
  public execute(items: InventoryItem[]): LowStockAlertItem[] {
    return items
      .filter(item => item.isLowStock)
      .map(item => ({
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        currentStock: item.currentStock,
        minStockAlert: item.props.minStockAlert,
        unit: item.unit,
        deficitQuantity: Math.max(0, item.props.minStockAlert - item.currentStock)
      }));
  }
}
