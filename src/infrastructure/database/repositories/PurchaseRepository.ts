/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
export type GoodsReceiptStatus = 'received' | 'reconciled' | 'reversed';
export type PurchaseReceiptStatus = 'unreceived' | 'partially_received' | 'received';
export type PurchasePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type PurchasePostingStatus = 'draft' | 'posted' | 'voided' | 'reversed';
export type LandedCostAllocationMethod = 'none' | 'by_value' | 'by_quantity';
export type PurchaseReturnSettlementType = 'credit_note' | 'cash_refund' | 'bank_refund';

export interface PurchaseOrderRecord {
  id: string;
  workspaceId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currencyCode: string;
  orderStatus: PurchaseOrderStatus;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLineRecord {
  id: string;
  orderId: string;
  productId?: string | null;
  itemType: 'inventory' | 'expense';
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  packageUnit: string;
  unitCostScaled: bigint;
  discountScaled: bigint;
  taxRatePercent: number;
  taxScaled: bigint;
  totalScaled: bigint;
  notes?: string | null;
}

export interface PurchaseOrderWithLines extends PurchaseOrderRecord {
  lines: PurchaseOrderLineRecord[];
}

export interface GoodsReceiptRecord {
  id: string;
  workspaceId: string;
  receiptNumber: string;
  purchaseOrderId?: string | null;
  supplierId: string;
  supplierName: string;
  receiptDate: string;
  locationId?: string | null;
  receiptStatus: GoodsReceiptStatus;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptLineRecord {
  id: string;
  receiptId: string;
  purchaseOrderLineId?: string | null;
  productId: string;
  description: string;
  receivedQuantity: number;
  shortQuantity: number;
  damagedQuantity: number;
  packageUnit: string;
  canonicalQuantity: number;
  unitCostScaled: bigint;
  stockMovementId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
}

export interface GoodsReceiptWithLines extends GoodsReceiptRecord {
  lines: GoodsReceiptLineRecord[];
}

export interface PurchaseBillRecord {
  id: string;
  workspaceId: string;
  billNumber: string;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  supplierId: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  currencyCode: string;
  receiptStatus: PurchaseReceiptStatus;
  paymentStatus: PurchasePaymentStatus;
  postingStatus: PurchasePostingStatus;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  landedCostScaled: bigint;
  landedCostAllocationMethod: LandedCostAllocationMethod;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  journalEntryId?: string | null;
  notes?: string | null;
  attachmentPath?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseBillLineRecord {
  id: string;
  billId: string;
  purchaseOrderLineId?: string | null;
  productId?: string | null;
  itemType: 'inventory' | 'expense';
  accountId?: string | null;
  description: string;
  quantity: number;
  packageUnit: string;
  unitCostScaled: bigint;
  allocatedLandedCostScaled: bigint;
  effectiveUnitCostScaled: bigint;
  discountScaled: bigint;
  taxRatePercent: number;
  taxScaled: bigint;
  totalScaled: bigint;
  stockMovementId?: string | null;
  notes?: string | null;
}

export interface PurchaseBillWithLines extends PurchaseBillRecord {
  lines: PurchaseBillLineRecord[];
}

export interface PurchaseReturnRecord {
  id: string;
  workspaceId: string;
  returnNumber: string;
  originalBillId: string;
  supplierId: string;
  supplierName: string;
  returnDate: string;
  currencyCode: string;
  subtotalScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  refundAmountScaled: bigint;
  settlementType: PurchaseReturnSettlementType;
  journalEntryId?: string | null;
  reason: string;
  allowOverReturn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReturnLineRecord {
  id: string;
  returnId: string;
  originalBillLineId: string;
  productId: string;
  description: string;
  returnedQuantity: number;
  packageUnit: string;
  canonicalQuantity: number;
  unitCostScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  stockMovementId?: string | null;
  notes?: string | null;
}

export interface PurchaseReturnWithLines extends PurchaseReturnRecord {
  lines: PurchaseReturnLineRecord[];
}

export interface PurchaseFilterOptions {
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class PurchaseRepository {
  constructor(private conn: DatabaseConnection) {}

  // --------------------------------------------------------------------------
  // Purchase Orders
  // --------------------------------------------------------------------------

  public async createPurchaseOrder(
    order: Omit<PurchaseOrderRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<PurchaseOrderLineRecord, 'id' | 'orderId'>[]
  ): Promise<PurchaseOrderWithLines> {
    const orderId = order.id || generateEntityId('po');
    const now = new Date().toISOString();

    const createdOrder: PurchaseOrderRecord = {
      ...order,
      id: orderId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: PurchaseOrderLineRecord[] = lines.map(l => ({
      ...l,
      id: generateEntityId('pol'),
      orderId
    }));

    await this.conn.executeTransaction(async () => {
      await this.conn.run(
        `INSERT INTO purchase_orders (
          id, workspace_id, order_number, supplier_id, supplier_name,
          order_date, expected_delivery_date, currency_code, order_status,
          subtotal_scaled, discount_scaled, tax_scaled, total_scaled,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdOrder.id,
          createdOrder.workspaceId,
          createdOrder.orderNumber,
          createdOrder.supplierId,
          createdOrder.supplierName,
          createdOrder.orderDate,
          createdOrder.expectedDeliveryDate || null,
          createdOrder.currencyCode,
          createdOrder.orderStatus,
          Number(createdOrder.subtotalScaled),
          Number(createdOrder.discountScaled),
          Number(createdOrder.taxScaled),
          Number(createdOrder.totalScaled),
          createdOrder.notes || null,
          createdOrder.createdAt,
          createdOrder.updatedAt
        ]
      );

      for (const line of createdLines) {
        await this.conn.run(
          `INSERT INTO purchase_order_lines (
            id, order_id, product_id, item_type, description,
            ordered_quantity, received_quantity, package_unit,
            unit_cost_scaled, discount_scaled, tax_rate_percent,
            tax_scaled, total_scaled, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.id,
            line.orderId,
            line.productId || null,
            line.itemType,
            line.description,
            line.orderedQuantity,
            line.receivedQuantity,
            line.packageUnit,
            Number(line.unitCostScaled),
            Number(line.discountScaled),
            line.taxRatePercent,
            Number(line.taxScaled),
            Number(line.totalScaled),
            line.notes || null
          ]
        );
      }
    });

    return {
      ...createdOrder,
      lines: createdLines
    };
  }

  public async findPurchaseOrderById(id: string): Promise<PurchaseOrderWithLines | null> {
    const orderRows = await this.conn.query<any>(
      `SELECT id, workspace_id, order_number, supplier_id, supplier_name,
              order_date, expected_delivery_date, currency_code, order_status,
              subtotal_scaled, discount_scaled, tax_scaled, total_scaled,
              notes, created_at, updated_at
       FROM purchase_orders WHERE id = ? LIMIT 1`,
      [id]
    );

    if (orderRows.length === 0) return null;
    const order = this.mapOrderRow(orderRows[0]);

    const lineRows = await this.conn.query<any>(
      `SELECT id, order_id, product_id, item_type, description,
              ordered_quantity, received_quantity, package_unit,
              unit_cost_scaled, discount_scaled, tax_rate_percent,
              tax_scaled, total_scaled, notes
       FROM purchase_order_lines WHERE order_id = ?`,
      [id]
    );

    const lines = lineRows.map(r => this.mapOrderLineRow(r));
    return { ...order, lines };
  }

  public async findPurchaseOrders(
    workspaceId: string,
    options: PurchaseFilterOptions = {}
  ): Promise<{ orders: PurchaseOrderWithLines[]; total: number }> {
    let whereSql = `WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (options.supplierId) {
      whereSql += ` AND supplier_id = ?`;
      params.push(options.supplierId);
    }
    if (options.startDate) {
      whereSql += ` AND order_date >= ?`;
      params.push(options.startDate);
    }
    if (options.endDate) {
      whereSql += ` AND order_date <= ?`;
      params.push(options.endDate);
    }
    if (options.status) {
      whereSql += ` AND order_status = ?`;
      params.push(options.status);
    }
    if (options.search) {
      whereSql += ` AND (order_number LIKE ? OR supplier_name LIKE ? OR notes LIKE ?)`;
      const s = `%${options.search}%`;
      params.push(s, s, s);
    }

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as cnt FROM purchase_orders ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.cnt || 0);

    let querySql = `
      SELECT id, workspace_id, order_number, supplier_id, supplier_name,
             order_date, expected_delivery_date, currency_code, order_status,
             subtotal_scaled, discount_scaled, tax_scaled, total_scaled,
             notes, created_at, updated_at
      FROM purchase_orders
      ${whereSql}
      ORDER BY order_date DESC, created_at DESC
    `;

    if (options.limit !== undefined) {
      querySql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await this.conn.query<any>(querySql, params);
    const orders: PurchaseOrderWithLines[] = [];

    for (const r of rows) {
      const order = this.mapOrderRow(r);
      const lineRows = await this.conn.query<any>(
        `SELECT id, order_id, product_id, item_type, description,
                ordered_quantity, received_quantity, package_unit,
                unit_cost_scaled, discount_scaled, tax_rate_percent,
                tax_scaled, total_scaled, notes
         FROM purchase_order_lines WHERE order_id = ?`,
        [order.id]
      );
      orders.push({
        ...order,
        lines: lineRows.map(lr => this.mapOrderLineRow(lr))
      });
    }

    return { orders, total };
  }

  public async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus): Promise<void> {
    await this.conn.run(
      `UPDATE purchase_orders SET order_status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  }

  public async updatePurchaseOrderLineReceivedQuantity(
    lineId: string,
    additionalReceivedQty: number
  ): Promise<void> {
    await this.conn.run(
      `UPDATE purchase_order_lines
       SET received_quantity = received_quantity + ?
       WHERE id = ?`,
      [additionalReceivedQty, lineId]
    );
  }

  // --------------------------------------------------------------------------
  // Goods Receipts
  // --------------------------------------------------------------------------

  public async createGoodsReceipt(
    receipt: Omit<GoodsReceiptRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<GoodsReceiptLineRecord, 'id' | 'receiptId'>[]
  ): Promise<GoodsReceiptWithLines> {
    const receiptId = receipt.id || generateEntityId('grn');
    const now = new Date().toISOString();

    const createdReceipt: GoodsReceiptRecord = {
      ...receipt,
      id: receiptId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: GoodsReceiptLineRecord[] = lines.map(l => ({
      ...l,
      id: generateEntityId('grnl'),
      receiptId
    }));

    await this.conn.executeTransaction(async () => {
      await this.conn.run(
        `INSERT INTO goods_receipts (
          id, workspace_id, receipt_number, purchase_order_id, supplier_id,
          supplier_name, receipt_date, location_id, receipt_status,
          notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdReceipt.id,
          createdReceipt.workspaceId,
          createdReceipt.receiptNumber,
          createdReceipt.purchaseOrderId || null,
          createdReceipt.supplierId,
          createdReceipt.supplierName,
          createdReceipt.receiptDate,
          createdReceipt.locationId || null,
          createdReceipt.receiptStatus,
          createdReceipt.notes || null,
          createdReceipt.createdBy,
          createdReceipt.createdAt,
          createdReceipt.updatedAt
        ]
      );

      for (const line of createdLines) {
        await this.conn.run(
          `INSERT INTO goods_receipt_lines (
            id, receipt_id, purchase_order_line_id, product_id, description,
            received_quantity, short_quantity, damaged_quantity, package_unit,
            canonical_quantity, unit_cost_scaled, stock_movement_id,
            batch_number, expiry_date, serial_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.id,
            line.receiptId,
            line.purchaseOrderLineId || null,
            line.productId,
            line.description,
            line.receivedQuantity,
            line.shortQuantity,
            line.damagedQuantity,
            line.packageUnit,
            line.canonicalQuantity,
            Number(line.unitCostScaled),
            line.stockMovementId || null,
            line.batchNumber || null,
            line.expiryDate || null,
            line.serialNumber || null,
            line.notes || null
          ]
        );
      }
    });

    return {
      ...createdReceipt,
      lines: createdLines
    };
  }

  public async findGoodsReceiptById(id: string): Promise<GoodsReceiptWithLines | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, receipt_number, purchase_order_id, supplier_id,
              supplier_name, receipt_date, location_id, receipt_status,
              notes, created_by, created_at, updated_at
       FROM goods_receipts WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    const receipt = this.mapReceiptRow(rows[0]);

    const lineRows = await this.conn.query<any>(
      `SELECT id, receipt_id, purchase_order_line_id, product_id, description,
              received_quantity, short_quantity, damaged_quantity, package_unit,
              canonical_quantity, unit_cost_scaled, stock_movement_id,
              batch_number, expiry_date, serial_number, notes
       FROM goods_receipt_lines WHERE receipt_id = ?`,
      [id]
    );

    return {
      ...receipt,
      lines: lineRows.map(r => this.mapReceiptLineRow(r))
    };
  }

  public async findGoodsReceipts(
    workspaceId: string,
    options: PurchaseFilterOptions & { purchaseOrderId?: string } = {}
  ): Promise<{ receipts: GoodsReceiptWithLines[]; total: number }> {
    let whereSql = `WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (options.purchaseOrderId) {
      whereSql += ` AND purchase_order_id = ?`;
      params.push(options.purchaseOrderId);
    }
    if (options.supplierId) {
      whereSql += ` AND supplier_id = ?`;
      params.push(options.supplierId);
    }
    if (options.startDate) {
      whereSql += ` AND receipt_date >= ?`;
      params.push(options.startDate);
    }
    if (options.endDate) {
      whereSql += ` AND receipt_date <= ?`;
      params.push(options.endDate);
    }
    if (options.status) {
      whereSql += ` AND receipt_status = ?`;
      params.push(options.status);
    }
    if (options.search) {
      whereSql += ` AND (receipt_number LIKE ? OR supplier_name LIKE ? OR notes LIKE ?)`;
      const s = `%${options.search}%`;
      params.push(s, s, s);
    }

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as cnt FROM goods_receipts ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.cnt || 0);

    let querySql = `
      SELECT id, workspace_id, receipt_number, purchase_order_id, supplier_id,
             supplier_name, receipt_date, location_id, receipt_status,
             notes, created_by, created_at, updated_at
      FROM goods_receipts
      ${whereSql}
      ORDER BY receipt_date DESC, created_at DESC
    `;

    if (options.limit !== undefined) {
      querySql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await this.conn.query<any>(querySql, params);
    const receipts: GoodsReceiptWithLines[] = [];

    for (const r of rows) {
      const receipt = this.mapReceiptRow(r);
      const lineRows = await this.conn.query<any>(
        `SELECT id, receipt_id, purchase_order_line_id, product_id, description,
                received_quantity, short_quantity, damaged_quantity, package_unit,
                canonical_quantity, unit_cost_scaled, stock_movement_id,
                batch_number, expiry_date, serial_number, notes
         FROM goods_receipt_lines WHERE receipt_id = ?`,
        [receipt.id]
      );
      receipts.push({
        ...receipt,
        lines: lineRows.map(lr => this.mapReceiptLineRow(lr))
      });
    }

    return { receipts, total };
  }

  // --------------------------------------------------------------------------
  // Purchase Bills
  // --------------------------------------------------------------------------

  public async createPurchaseBill(
    bill: Omit<PurchaseBillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<PurchaseBillLineRecord, 'id' | 'billId'>[]
  ): Promise<PurchaseBillWithLines> {
    const billId = bill.id || generateEntityId('bill');
    const now = new Date().toISOString();

    const createdBill: PurchaseBillRecord = {
      ...bill,
      id: billId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: PurchaseBillLineRecord[] = lines.map(l => ({
      ...l,
      id: generateEntityId('pbl'),
      billId
    }));

    await this.conn.executeTransaction(async () => {
      await this.conn.run(
        `INSERT INTO purchase_bills (
          id, workspace_id, bill_number, purchase_order_id, goods_receipt_id,
          supplier_id, supplier_name, bill_date, due_date, currency_code,
          receipt_status, payment_status, posting_status,
          subtotal_scaled, discount_scaled, tax_scaled, landed_cost_scaled,
          landed_cost_allocation_method, total_scaled, paid_amount_scaled,
          journal_entry_id, notes, attachment_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdBill.id,
          createdBill.workspaceId,
          createdBill.billNumber,
          createdBill.purchaseOrderId || null,
          createdBill.goodsReceiptId || null,
          createdBill.supplierId,
          createdBill.supplierName,
          createdBill.billDate,
          createdBill.dueDate,
          createdBill.currencyCode,
          createdBill.receiptStatus,
          createdBill.paymentStatus,
          createdBill.postingStatus,
          Number(createdBill.subtotalScaled),
          Number(createdBill.discountScaled),
          Number(createdBill.taxScaled),
          Number(createdBill.landedCostScaled),
          createdBill.landedCostAllocationMethod,
          Number(createdBill.totalScaled),
          Number(createdBill.paidAmountScaled),
          createdBill.journalEntryId || null,
          createdBill.notes || null,
          createdBill.attachmentPath || null,
          createdBill.createdAt,
          createdBill.updatedAt
        ]
      );

      for (const line of createdLines) {
        await this.conn.run(
          `INSERT INTO purchase_bill_lines (
            id, bill_id, purchase_order_line_id, product_id, item_type,
            account_id, description, quantity, package_unit,
            unit_cost_scaled, allocated_landed_cost_scaled, effective_unit_cost_scaled,
            discount_scaled, tax_rate_percent, tax_scaled, total_scaled,
            stock_movement_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.id,
            line.billId,
            line.purchaseOrderLineId || null,
            line.productId || null,
            line.itemType,
            line.accountId || null,
            line.description,
            line.quantity,
            line.packageUnit,
            Number(line.unitCostScaled),
            Number(line.allocatedLandedCostScaled),
            Number(line.effectiveUnitCostScaled),
            Number(line.discountScaled),
            line.taxRatePercent,
            Number(line.taxScaled),
            Number(line.totalScaled),
            line.stockMovementId || null,
            line.notes || null
          ]
        );
      }
    });

    return {
      ...createdBill,
      lines: createdLines
    };
  }

  public async findPurchaseBillById(id: string): Promise<PurchaseBillWithLines | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, bill_number, purchase_order_id, goods_receipt_id,
              supplier_id, supplier_name, bill_date, due_date, currency_code,
              receipt_status, payment_status, posting_status,
              subtotal_scaled, discount_scaled, tax_scaled, landed_cost_scaled,
              landed_cost_allocation_method, total_scaled, paid_amount_scaled,
              journal_entry_id, notes, attachment_path, created_at, updated_at
       FROM purchase_bills WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    const bill = this.mapBillRow(rows[0]);

    const lineRows = await this.conn.query<any>(
      `SELECT id, bill_id, purchase_order_line_id, product_id, item_type,
              account_id, description, quantity, package_unit,
              unit_cost_scaled, allocated_landed_cost_scaled, effective_unit_cost_scaled,
              discount_scaled, tax_rate_percent, tax_scaled, total_scaled,
              stock_movement_id, notes
       FROM purchase_bill_lines WHERE bill_id = ?`,
      [id]
    );

    return {
      ...bill,
      lines: lineRows.map(r => this.mapBillLineRow(r))
    };
  }

  public async findPurchaseBills(
    workspaceId: string,
    options: PurchaseFilterOptions & {
      receiptStatus?: PurchaseReceiptStatus;
      paymentStatus?: PurchasePaymentStatus;
      postingStatus?: PurchasePostingStatus;
      purchaseOrderId?: string;
    } = {}
  ): Promise<{ bills: PurchaseBillWithLines[]; total: number }> {
    let whereSql = `WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (options.purchaseOrderId) {
      whereSql += ` AND purchase_order_id = ?`;
      params.push(options.purchaseOrderId);
    }
    if (options.supplierId) {
      whereSql += ` AND supplier_id = ?`;
      params.push(options.supplierId);
    }
    if (options.startDate) {
      whereSql += ` AND bill_date >= ?`;
      params.push(options.startDate);
    }
    if (options.endDate) {
      whereSql += ` AND bill_date <= ?`;
      params.push(options.endDate);
    }
    if (options.receiptStatus) {
      whereSql += ` AND receipt_status = ?`;
      params.push(options.receiptStatus);
    }
    if (options.paymentStatus) {
      whereSql += ` AND payment_status = ?`;
      params.push(options.paymentStatus);
    }
    if (options.postingStatus) {
      whereSql += ` AND posting_status = ?`;
      params.push(options.postingStatus);
    }
    if (options.search) {
      whereSql += ` AND (bill_number LIKE ? OR supplier_name LIKE ? OR notes LIKE ?)`;
      const s = `%${options.search}%`;
      params.push(s, s, s);
    }

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as cnt FROM purchase_bills ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.cnt || 0);

    let querySql = `
      SELECT id, workspace_id, bill_number, purchase_order_id, goods_receipt_id,
             supplier_id, supplier_name, bill_date, due_date, currency_code,
             receipt_status, payment_status, posting_status,
             subtotal_scaled, discount_scaled, tax_scaled, landed_cost_scaled,
             landed_cost_allocation_method, total_scaled, paid_amount_scaled,
             journal_entry_id, notes, attachment_path, created_at, updated_at
      FROM purchase_bills
      ${whereSql}
      ORDER BY bill_date DESC, created_at DESC
    `;

    if (options.limit !== undefined) {
      querySql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await this.conn.query<any>(querySql, params);
    const bills: PurchaseBillWithLines[] = [];

    for (const r of rows) {
      const bill = this.mapBillRow(r);
      const lineRows = await this.conn.query<any>(
        `SELECT id, bill_id, purchase_order_line_id, product_id, item_type,
                account_id, description, quantity, package_unit,
                unit_cost_scaled, allocated_landed_cost_scaled, effective_unit_cost_scaled,
                discount_scaled, tax_rate_percent, tax_scaled, total_scaled,
                stock_movement_id, notes
         FROM purchase_bill_lines WHERE bill_id = ?`,
        [bill.id]
      );
      bills.push({
        ...bill,
        lines: lineRows.map(lr => this.mapBillLineRow(lr))
      });
    }

    return { bills, total };
  }

  public async updatePurchaseBillPaidAmount(
    id: string,
    paidAmountScaled: bigint,
    paymentStatus: PurchasePaymentStatus
  ): Promise<void> {
    await this.conn.run(
      `UPDATE purchase_bills
       SET paid_amount_scaled = ?, payment_status = ?, updated_at = ?
       WHERE id = ?`,
      [Number(paidAmountScaled), paymentStatus, new Date().toISOString(), id]
    );
  }

  public async updatePurchaseBillReceiptStatus(
    id: string,
    receiptStatus: PurchaseReceiptStatus
  ): Promise<void> {
    await this.conn.run(
      `UPDATE purchase_bills SET receipt_status = ?, updated_at = ? WHERE id = ?`,
      [receiptStatus, new Date().toISOString(), id]
    );
  }

  public async updatePurchaseBillPostingStatus(
    id: string,
    postingStatus: PurchasePostingStatus
  ): Promise<void> {
    await this.conn.run(
      `UPDATE purchase_bills SET posting_status = ?, updated_at = ? WHERE id = ?`,
      [postingStatus, new Date().toISOString(), id]
    );
  }

  // --------------------------------------------------------------------------
  // Purchase Returns
  // --------------------------------------------------------------------------

  public async createPurchaseReturn(
    ret: Omit<PurchaseReturnRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<PurchaseReturnLineRecord, 'id' | 'returnId'>[]
  ): Promise<PurchaseReturnWithLines> {
    const returnId = ret.id || generateEntityId('pret');
    const now = new Date().toISOString();

    const createdReturn: PurchaseReturnRecord = {
      ...ret,
      id: returnId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: PurchaseReturnLineRecord[] = lines.map(l => ({
      ...l,
      id: generateEntityId('pretl'),
      returnId
    }));

    await this.conn.executeTransaction(async () => {
      await this.conn.run(
        `INSERT INTO purchase_returns (
          id, workspace_id, return_number, original_bill_id, supplier_id,
          supplier_name, return_date, currency_code, subtotal_scaled,
          tax_scaled, total_scaled, refund_amount_scaled, settlement_type,
          journal_entry_id, reason, allow_over_return, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdReturn.id,
          createdReturn.workspaceId,
          createdReturn.returnNumber,
          createdReturn.originalBillId,
          createdReturn.supplierId,
          createdReturn.supplierName,
          createdReturn.returnDate,
          createdReturn.currencyCode,
          Number(createdReturn.subtotalScaled),
          Number(createdReturn.taxScaled),
          Number(createdReturn.totalScaled),
          Number(createdReturn.refundAmountScaled),
          createdReturn.settlementType,
          createdReturn.journalEntryId || null,
          createdReturn.reason,
          createdReturn.allowOverReturn ? 1 : 0,
          createdReturn.createdAt,
          createdReturn.updatedAt
        ]
      );

      for (const line of createdLines) {
        await this.conn.run(
          `INSERT INTO purchase_return_lines (
            id, return_id, original_bill_line_id, product_id, description,
            returned_quantity, package_unit, canonical_quantity,
            unit_cost_scaled, tax_scaled, total_scaled, stock_movement_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.id,
            line.returnId,
            line.originalBillLineId,
            line.productId,
            line.description,
            line.returnedQuantity,
            line.packageUnit,
            line.canonicalQuantity,
            Number(line.unitCostScaled),
            Number(line.taxScaled),
            Number(line.totalScaled),
            line.stockMovementId || null,
            line.notes || null
          ]
        );
      }
    });

    return {
      ...createdReturn,
      lines: createdLines
    };
  }

  public async findPurchaseReturnById(id: string): Promise<PurchaseReturnWithLines | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, return_number, original_bill_id, supplier_id,
              supplier_name, return_date, currency_code, subtotal_scaled,
              tax_scaled, total_scaled, refund_amount_scaled, settlement_type,
              journal_entry_id, reason, allow_over_return, created_at, updated_at
       FROM purchase_returns WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    const ret = this.mapReturnRow(rows[0]);

    const lineRows = await this.conn.query<any>(
      `SELECT id, return_id, original_bill_line_id, product_id, description,
              returned_quantity, package_unit, canonical_quantity,
              unit_cost_scaled, tax_scaled, total_scaled, stock_movement_id, notes
       FROM purchase_return_lines WHERE return_id = ?`,
      [id]
    );

    return {
      ...ret,
      lines: lineRows.map(r => this.mapReturnLineRow(r))
    };
  }

  public async findPurchaseReturns(
    workspaceId: string,
    options: PurchaseFilterOptions & { originalBillId?: string } = {}
  ): Promise<{ returns: PurchaseReturnWithLines[]; total: number }> {
    let whereSql = `WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (options.originalBillId) {
      whereSql += ` AND original_bill_id = ?`;
      params.push(options.originalBillId);
    }
    if (options.supplierId) {
      whereSql += ` AND supplier_id = ?`;
      params.push(options.supplierId);
    }
    if (options.startDate) {
      whereSql += ` AND return_date >= ?`;
      params.push(options.startDate);
    }
    if (options.endDate) {
      whereSql += ` AND return_date <= ?`;
      params.push(options.endDate);
    }
    if (options.search) {
      whereSql += ` AND (return_number LIKE ? OR supplier_name LIKE ? OR reason LIKE ?)`;
      const s = `%${options.search}%`;
      params.push(s, s, s);
    }

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as cnt FROM purchase_returns ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.cnt || 0);

    let querySql = `
      SELECT id, workspace_id, return_number, original_bill_id, supplier_id,
             supplier_name, return_date, currency_code, subtotal_scaled,
             tax_scaled, total_scaled, refund_amount_scaled, settlement_type,
             journal_entry_id, reason, allow_over_return, created_at, updated_at
      FROM purchase_returns
      ${whereSql}
      ORDER BY return_date DESC, created_at DESC
    `;

    if (options.limit !== undefined) {
      querySql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await this.conn.query<any>(querySql, params);
    const returns: PurchaseReturnWithLines[] = [];

    for (const r of rows) {
      const ret = this.mapReturnRow(r);
      const lineRows = await this.conn.query<any>(
        `SELECT id, return_id, original_bill_line_id, product_id, description,
                returned_quantity, package_unit, canonical_quantity,
                unit_cost_scaled, tax_scaled, total_scaled, stock_movement_id, notes
         FROM purchase_return_lines WHERE return_id = ?`,
        [ret.id]
      );
      returns.push({
        ...ret,
        lines: lineRows.map(lr => this.mapReturnLineRow(lr))
      });
    }

    return { returns, total };
  }

  public async getReturnedQuantityForBillLine(billLineId: string): Promise<number> {
    const rows = await this.conn.query<any>(
      `SELECT SUM(returned_quantity) as total_returned
       FROM purchase_return_lines
       WHERE original_bill_line_id = ?`,
      [billLineId]
    );

    return Number(rows[0]?.total_returned || 0);
  }

  // --------------------------------------------------------------------------
  // Row Mappers
  // --------------------------------------------------------------------------

  private mapOrderRow(r: any): PurchaseOrderRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      orderNumber: r.order_number,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      orderDate: r.order_date,
      expectedDeliveryDate: r.expected_delivery_date,
      currencyCode: r.currency_code,
      orderStatus: r.order_status,
      subtotalScaled: BigInt(r.subtotal_scaled ?? 0),
      discountScaled: BigInt(r.discount_scaled ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapOrderLineRow(r: any): PurchaseOrderLineRecord {
    return {
      id: r.id,
      orderId: r.order_id,
      productId: r.product_id,
      itemType: r.item_type,
      description: r.description,
      orderedQuantity: Number(r.ordered_quantity),
      receivedQuantity: Number(r.received_quantity || 0),
      packageUnit: r.package_unit,
      unitCostScaled: BigInt(r.unit_cost_scaled ?? 0),
      discountScaled: BigInt(r.discount_scaled ?? 0),
      taxRatePercent: Number(r.tax_rate_percent ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      notes: r.notes
    };
  }

  private mapReceiptRow(r: any): GoodsReceiptRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      receiptNumber: r.receipt_number,
      purchaseOrderId: r.purchase_order_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      receiptDate: r.receipt_date,
      locationId: r.location_id,
      receiptStatus: r.receipt_status,
      notes: r.notes,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapReceiptLineRow(r: any): GoodsReceiptLineRecord {
    return {
      id: r.id,
      receiptId: r.receipt_id,
      purchaseOrderLineId: r.purchase_order_line_id,
      productId: r.product_id,
      description: r.description,
      receivedQuantity: Number(r.received_quantity),
      shortQuantity: Number(r.short_quantity || 0),
      damagedQuantity: Number(r.damaged_quantity || 0),
      packageUnit: r.package_unit,
      canonicalQuantity: Number(r.canonical_quantity),
      unitCostScaled: BigInt(r.unit_cost_scaled ?? 0),
      stockMovementId: r.stock_movement_id,
      batchNumber: r.batch_number,
      expiryDate: r.expiry_date,
      serialNumber: r.serial_number,
      notes: r.notes
    };
  }

  private mapBillRow(r: any): PurchaseBillRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      billNumber: r.bill_number,
      purchaseOrderId: r.purchase_order_id,
      goodsReceiptId: r.goods_receipt_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      billDate: r.bill_date,
      dueDate: r.due_date,
      currencyCode: r.currency_code,
      receiptStatus: r.receipt_status,
      paymentStatus: r.payment_status,
      postingStatus: r.posting_status,
      subtotalScaled: BigInt(r.subtotal_scaled ?? 0),
      discountScaled: BigInt(r.discount_scaled ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      landedCostScaled: BigInt(r.landed_cost_scaled ?? 0),
      landedCostAllocationMethod: r.landed_cost_allocation_method,
      totalScaled: BigInt(r.total_scaled ?? 0),
      paidAmountScaled: BigInt(r.paid_amount_scaled ?? 0),
      journalEntryId: r.journal_entry_id,
      notes: r.notes,
      attachmentPath: r.attachment_path,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapBillLineRow(r: any): PurchaseBillLineRecord {
    return {
      id: r.id,
      billId: r.bill_id,
      purchaseOrderLineId: r.purchase_order_line_id,
      productId: r.product_id,
      itemType: r.item_type,
      accountId: r.account_id,
      description: r.description,
      quantity: Number(r.quantity),
      packageUnit: r.package_unit,
      unitCostScaled: BigInt(r.unit_cost_scaled ?? 0),
      allocatedLandedCostScaled: BigInt(r.allocated_landed_cost_scaled ?? 0),
      effectiveUnitCostScaled: BigInt(r.effective_unit_cost_scaled ?? 0),
      discountScaled: BigInt(r.discount_scaled ?? 0),
      taxRatePercent: Number(r.tax_rate_percent ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      stockMovementId: r.stock_movement_id,
      notes: r.notes
    };
  }

  private mapReturnRow(r: any): PurchaseReturnRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      returnNumber: r.return_number,
      originalBillId: r.original_bill_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      returnDate: r.return_date,
      currencyCode: r.currency_code,
      subtotalScaled: BigInt(r.subtotal_scaled ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      refundAmountScaled: BigInt(r.refund_amount_scaled ?? 0),
      settlementType: r.settlement_type,
      journalEntryId: r.journal_entry_id,
      reason: r.reason,
      allowOverReturn: Boolean(r.allow_over_return),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapReturnLineRow(r: any): PurchaseReturnLineRecord {
    return {
      id: r.id,
      returnId: r.return_id,
      originalBillLineId: r.original_bill_line_id,
      productId: r.product_id,
      description: r.description,
      returnedQuantity: Number(r.returned_quantity),
      packageUnit: r.package_unit,
      canonicalQuantity: Number(r.canonical_quantity),
      unitCostScaled: BigInt(r.unit_cost_scaled ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      stockMovementId: r.stock_movement_id,
      notes: r.notes
    };
  }
}
