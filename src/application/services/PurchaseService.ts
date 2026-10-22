/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import {
  PurchaseRepository,
  PurchaseOrderWithLines,
  GoodsReceiptWithLines,
  PurchaseBillWithLines,
  PurchaseReturnWithLines,
  PurchaseOrderStatus,
  PurchaseReceiptStatus,
  PurchasePaymentStatus,
  PurchasePostingStatus,
  LandedCostAllocationMethod,
  PurchaseReturnSettlementType,
  PurchaseFilterOptions
} from '../../infrastructure/database/repositories/PurchaseRepository';
import {
  PartyRepository,
  AccountRepository,
  DocumentRepository,
  PaymentRepository,
  PartyLedgerRepository
} from '../../infrastructure/database/repositories';
import { InventoryService } from './InventoryService';
import { PostingService } from './PostingService';
import { WorkspaceService } from './WorkspaceService';
import { generateEntityId } from '../../domain/primitives/EntityId';
import { convertStandardUnit } from '../../domain/inventory/InventoryItem';
import { assertValid, validateRequiredString } from '../validation/financialValidation';

export interface CreatePurchaseOrderInput {
  orderNumber?: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currencyCode?: string;
  notes?: string;
  lines: Array<{
    productId?: string;
    itemType?: 'inventory' | 'expense';
    description: string;
    orderedQuantity: number;
    packageUnit?: string;
    unitCostScaled: bigint;
    discountScaled?: bigint;
    taxRatePercent?: number;
    notes?: string;
  }>;
}

export interface RecordGoodsReceiptInput {
  receiptNumber?: string;
  purchaseOrderId?: string;
  supplierId: string;
  receiptDate: string;
  locationId?: string;
  notes?: string;
  createdBy?: string;
  lines: Array<{
    purchaseOrderLineId?: string;
    productId: string;
    description: string;
    receivedQuantity: number;
    shortQuantity?: number;
    damagedQuantity?: number;
    packageUnit?: string;
    unitCostScaled?: bigint;
    batchNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
    notes?: string;
  }>;
}

export interface CreatePurchaseBillInput {
  billNumber?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  supplierId: string;
  billDate: string;
  dueDate: string;
  currencyCode?: string;
  notes?: string;
  attachmentPath?: string;
  receiveStockNow?: boolean; // True if direct bill without prior goods receipt
  locationId?: string;
  landedCostScaled?: bigint; // Shipping, freight, customs
  landedCostAllocationMethod?: LandedCostAllocationMethod;
  lines: Array<{
    purchaseOrderLineId?: string;
    productId?: string;
    itemType?: 'inventory' | 'expense';
    accountId?: string;
    description: string;
    quantity: number;
    packageUnit?: string;
    unitCostScaled: bigint;
    discountScaled?: bigint;
    taxRatePercent?: number;
    notes?: string;
  }>;
  immediatePayment?: {
    accountId: string; // Cash or Bank account ID
    amountScaled: bigint;
    paymentMethod?: string;
    referenceNumber?: string;
    notes?: string;
  };
}

export interface RecordPurchaseReturnInput {
  returnNumber?: string;
  originalBillId: string;
  returnDate: string;
  reason: string;
  settlementType?: PurchaseReturnSettlementType;
  refundAccountId?: string; // If cash/bank refund immediately
  allowOverReturn?: boolean;
  lines: Array<{
    originalBillLineId: string;
    productId: string;
    description: string;
    returnedQuantity: number;
    packageUnit?: string;
    notes?: string;
  }>;
}

export interface RecordSupplierPaymentInput {
  billId: string;
  amountScaled: bigint;
  paymentDate: string;
  paymentMethod?: string;
  accountId: string; // Cash on Hand (1010) or Bank Account (1020)
  referenceNumber?: string;
  notes?: string;
}

export interface PurchaseSummaryMetrics {
  totalPurchasesScaled: bigint;
  outstandingPayablesScaled: bigint;
  pendingReceiptsCount: number;
  totalReturnsScaled: bigint;
  currencyCode: string;
}

export class PurchaseService {
  // --------------------------------------------------------------------------
  // 1. Purchase Orders
  // --------------------------------------------------------------------------

  /**
   * Creates a Purchase Order.
   * STRICT GUARANTEE: Does NOT inflate on-hand stock and does NOT post journal entries.
   */
  public static async createPurchaseOrder(
    conn: DatabaseConnection,
    workspaceId: string,
    input: CreatePurchaseOrderInput
  ): Promise<PurchaseOrderWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    assertValid(validateRequiredString(input.supplierId, 'Supplier'));
    assertValid(validateRequiredString(input.orderDate, 'Order Date'));

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Purchase order must contain at least one line item.');
    }

    const partyRepo = new PartyRepository(conn);
    const supplier = await partyRepo.findById(input.supplierId);
    if (!supplier || supplier.workspaceId !== workspaceId) {
      throw new Error(`Supplier ${input.supplierId} not found in this workspace.`);
    }

    const repo = new PurchaseRepository(conn);
    const orderNumber = input.orderNumber?.trim() || `PO-${Date.now().toString().slice(-6)}`;
    const currency = input.currencyCode || supplier.currencyCode || 'PKR';

    let subtotalScaled = 0n;
    let discountScaled = 0n;
    let taxScaled = 0n;

    const calculatedLines = input.lines.map(line => {
      if (line.orderedQuantity <= 0) {
        throw new Error(`Line quantity must be greater than zero for "${line.description}".`);
      }
      if (line.unitCostScaled < 0n) {
        throw new Error(`Line unit cost cannot be negative for "${line.description}".`);
      }

      const lineGross = BigInt(Math.round(line.orderedQuantity * Number(line.unitCostScaled)));
      const lineDiscount = line.discountScaled || 0n;
      const taxableBase = lineGross > lineDiscount ? lineGross - lineDiscount : 0n;
      const rate = line.taxRatePercent || 0;
      const lineTax = BigInt(Math.round(Number(taxableBase) * (rate / 100)));
      const lineTotal = taxableBase + lineTax;

      subtotalScaled += lineGross;
      discountScaled += lineDiscount;
      taxScaled += lineTax;

      return {
        productId: line.productId || null,
        itemType: line.itemType || 'inventory',
        description: line.description,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: 0,
        packageUnit: line.packageUnit || 'pcs',
        unitCostScaled: line.unitCostScaled,
        discountScaled: lineDiscount,
        taxRatePercent: rate,
        taxScaled: lineTax,
        totalScaled: lineTotal,
        notes: line.notes || null
      };
    });

    const totalScaled = subtotalScaled - discountScaled + taxScaled;

    return await repo.createPurchaseOrder(
      {
        workspaceId,
        orderNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderDate: input.orderDate,
        expectedDeliveryDate: input.expectedDeliveryDate || null,
        currencyCode: currency,
        orderStatus: 'ordered',
        subtotalScaled,
        discountScaled,
        taxScaled,
        totalScaled,
        notes: input.notes || null
      },
      calculatedLines
    );
  }

  // --------------------------------------------------------------------------
  // 2. Goods Receipts (Delivery Note)
  // --------------------------------------------------------------------------

  /**
   * Records receipt of goods against a purchase order or direct receipt.
   * Creates atomic stock movements only for quantities actually received.
   * Tracks shortages and damaged/rejected goods explicitly.
   */
  public static async recordGoodsReceipt(
    conn: DatabaseConnection,
    workspaceId: string,
    input: RecordGoodsReceiptInput
  ): Promise<GoodsReceiptWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    assertValid(validateRequiredString(input.supplierId, 'Supplier'));
    assertValid(validateRequiredString(input.receiptDate, 'Receipt Date'));

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Goods receipt must contain at least one line item.');
    }

    const partyRepo = new PartyRepository(conn);
    const supplier = await partyRepo.findById(input.supplierId);
    if (!supplier || supplier.workspaceId !== workspaceId) {
      throw new Error(`Supplier ${input.supplierId} not found in this workspace.`);
    }

    const repo = new PurchaseRepository(conn);
    const receiptNumber = input.receiptNumber?.trim() || `GRN-${Date.now().toString().slice(-6)}`;

    // Verify PO if provided
    let po: PurchaseOrderWithLines | null = null;
    if (input.purchaseOrderId) {
      po = await repo.findPurchaseOrderById(input.purchaseOrderId);
      if (!po || po.workspaceId !== workspaceId) {
        throw new Error(`Purchase order ${input.purchaseOrderId} not found.`);
      }
    }

    return await conn.executeTransaction(async () => {
      const receiptLinesToCreate: any[] = [];

      for (const line of input.lines) {
        if (line.receivedQuantity <= 0) {
          throw new Error(`Received quantity must be greater than zero for "${line.description}".`);
        }

        // Calculate canonical quantity conversion
        let canonicalQuantity = line.receivedQuantity;
        const pkgUnit = line.packageUnit || 'pcs';

        // Fetch product to determine canonical unit & conversions
        const product = await conn.query<any>(
          `SELECT id, unit, cost_price_scaled, weighted_avg_cost_scaled FROM products WHERE id = ? AND workspace_id = ?`,
          [line.productId, workspaceId]
        );
        if (product.length === 0) {
          throw new Error(`Product ${line.productId} not found in workspace.`);
        }
        const prod = product[0];

        if (pkgUnit.toLowerCase() !== prod.unit.toLowerCase()) {
          const conversions = await conn.query<any>(
            `SELECT conversion_factor FROM product_unit_conversions WHERE product_id = ? AND LOWER(unit_name) = LOWER(?)`,
            [line.productId, pkgUnit]
          );
          if (conversions.length > 0) {
            canonicalQuantity = line.receivedQuantity * Number(conversions[0].conversion_factor);
          } else {
            canonicalQuantity = line.receivedQuantity * convertStandardUnit(1, pkgUnit, prod.unit);
          }
        }

        const unitCostScaled = line.unitCostScaled !== undefined ? line.unitCostScaled : BigInt(prod.cost_price_scaled || 0);

        // Atomic stock movement
        const movement = await InventoryService.recordStockMovement(conn, workspaceId, {
          productId: line.productId,
          sourceType: 'goods_received',
          quantity: canonicalQuantity,
          packageUnit: prod.unit,
          locationId: input.locationId,
          sourceId: receiptNumber,
          effectiveDate: input.receiptDate,
          unitCostScaled,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          serialNumber: line.serialNumber,
          reason: `Goods receipt ${receiptNumber} from supplier ${supplier.name}`
        });

        receiptLinesToCreate.push({
          purchaseOrderLineId: line.purchaseOrderLineId || null,
          productId: line.productId,
          description: line.description,
          receivedQuantity: line.receivedQuantity,
          shortQuantity: line.shortQuantity || 0,
          damagedQuantity: line.damagedQuantity || 0,
          packageUnit: pkgUnit,
          canonicalQuantity,
          unitCostScaled,
          stockMovementId: movement.id,
          batchNumber: line.batchNumber || null,
          expiryDate: line.expiryDate || null,
          serialNumber: line.serialNumber || null,
          notes: line.notes || null
        });

        // Update PO line received quantity if linked
        if (line.purchaseOrderLineId) {
          await repo.updatePurchaseOrderLineReceivedQuantity(
            line.purchaseOrderLineId,
            line.receivedQuantity
          );
        }
      }

      // Create Goods Receipt document
      const createdGRN = await repo.createGoodsReceipt(
        {
          workspaceId,
          receiptNumber,
          purchaseOrderId: input.purchaseOrderId || null,
          supplierId: supplier.id,
          supplierName: supplier.name,
          receiptDate: input.receiptDate,
          locationId: input.locationId || null,
          receiptStatus: 'received',
          notes: input.notes || null,
          createdBy: input.createdBy || 'local_user'
        },
        receiptLinesToCreate
      );

      // If linked to PO, recompute PO status
      if (po) {
        const refreshedPo = await repo.findPurchaseOrderById(po.id);
        if (refreshedPo) {
          const allFullyReceived = refreshedPo.lines.every(l => l.receivedQuantity >= l.orderedQuantity);
          const anyReceived = refreshedPo.lines.some(l => l.receivedQuantity > 0);
          const newStatus: PurchaseOrderStatus = allFullyReceived
            ? 'received'
            : anyReceived
            ? 'partially_received'
            : 'ordered';
          await repo.updatePurchaseOrderStatus(po.id, newStatus);
        }
      }

      return createdGRN;
    });
  }

  // --------------------------------------------------------------------------
  // 3. Purchase Bills (Supplier Bills)
  // --------------------------------------------------------------------------

  /**
   * Creates and posts a Purchase Bill.
   * Can be direct purchase or linked to PO/GRN.
   * Atomically:
   * 1. Allocates landed costs across inventory lines.
   * 2. Creates stock movements for inventory received on bill.
   * 3. Posts double-entry Journal Entry (Debit Inventory/Expenses, Credit Accounts Payable/Cash).
   * 4. Updates supplier Khata payable balance.
   * 5. Syncs with documents table for payment allocation compatibility.
   */
  public static async createPurchaseBill(
    conn: DatabaseConnection,
    workspaceId: string,
    input: CreatePurchaseBillInput
  ): Promise<PurchaseBillWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    assertValid(validateRequiredString(input.supplierId, 'Supplier'));
    assertValid(validateRequiredString(input.billDate, 'Bill Date'));
    assertValid(validateRequiredString(input.dueDate, 'Due Date'));

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Purchase bill must contain at least one line item.');
    }

    const partyRepo = new PartyRepository(conn);
    const supplier = await partyRepo.findById(input.supplierId);
    if (!supplier || supplier.workspaceId !== workspaceId) {
      throw new Error(`Supplier ${input.supplierId} not found in this workspace.`);
    }

    const repo = new PurchaseRepository(conn);
    const billNumber = input.billNumber?.trim() || `BILL-${Date.now().toString().slice(-6)}`;
    const currency = input.currencyCode || supplier.currencyCode || 'PKR';
    const landedCost = input.landedCostScaled || 0n;
    const allocationMethod = input.landedCostAllocationMethod || 'by_value';

    // 1. Calculate raw line amounts
    let rawSubtotalScaled = 0n;
    let totalDiscountScaled = 0n;
    let totalTaxScaled = 0n;
    let totalInventoryValue = 0n;
    let totalInventoryQuantity = 0;

    const parsedLines = input.lines.map(line => {
      if (line.quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for "${line.description}".`);
      }
      if (line.unitCostScaled < 0n) {
        throw new Error(`Unit cost cannot be negative for "${line.description}".`);
      }

      const gross = BigInt(Math.round(line.quantity * Number(line.unitCostScaled)));
      const discount = line.discountScaled || 0n;
      const taxable = gross > discount ? gross - discount : 0n;
      const rate = line.taxRatePercent || 0;
      const tax = BigInt(Math.round(Number(taxable) * (rate / 100)));
      const lineTotal = taxable + tax;

      rawSubtotalScaled += gross;
      totalDiscountScaled += discount;
      totalTaxScaled += tax;

      const isInv = (line.itemType || 'inventory') === 'inventory' && Boolean(line.productId);
      if (isInv) {
        totalInventoryValue += gross;
        totalInventoryQuantity += line.quantity;
      }

      return {
        ...line,
        itemType: line.itemType || (line.productId ? 'inventory' : 'expense'),
        gross,
        discount,
        taxRatePercent: rate,
        tax,
        lineTotal
      };
    });

    // 2. Allocate landed cost to inventory lines
    let allocatedSum = 0n;
    const linesWithLandedCost = parsedLines.map((line, idx) => {
      let allocatedLandedCost = 0n;
      const isInv = line.itemType === 'inventory' && Boolean(line.productId);

      if (landedCost > 0n && isInv) {
        if (allocationMethod === 'by_quantity' && totalInventoryQuantity > 0) {
          allocatedLandedCost = BigInt(
            Math.round(Number(landedCost) * (line.quantity / totalInventoryQuantity))
          );
        } else if (totalInventoryValue > 0n) {
          allocatedLandedCost = BigInt(
            Math.round(Number(landedCost) * (Number(line.gross) / Number(totalInventoryValue)))
          );
        }
        // Rounding adjustment for last inventory line
        if (idx === parsedLines.length - 1 || allocatedSum + allocatedLandedCost > landedCost) {
          allocatedLandedCost = landedCost - allocatedSum;
        }
        allocatedSum += allocatedLandedCost;
      }

      const effectiveUnitCost = line.quantity > 0
        ? line.unitCostScaled + BigInt(Math.round(Number(allocatedLandedCost) / line.quantity))
        : line.unitCostScaled;

      return {
        ...line,
        allocatedLandedCost,
        effectiveUnitCost
      };
    });

    const billTotalScaled = rawSubtotalScaled - totalDiscountScaled + totalTaxScaled + landedCost;

    // Accounts lookup
    const accountRepo = new AccountRepository(conn);
    const accounts = await accountRepo.findByWorkspace(workspaceId);

    const inventoryAccount = accounts.find(a => a.accountCode === '1300' || a.subCategory === 'inventory') || accounts.find(a => a.type === 'asset');
    const payableAccount = accounts.find(a => a.accountCode === '2010' || a.subCategory === 'supplier_payables') || accounts.find(a => a.type === 'liability');
    const defaultExpenseAccount = accounts.find(a => a.accountCode === '5020' || a.accountCode === '6000') || accounts.find(a => a.type === 'expense');
    const cashAccount = accounts.find(a => a.accountCode === '1010') || accounts[0];

    if (!inventoryAccount || !payableAccount) {
      throw new Error('Chart of accounts missing required Inventory Asset or Accounts Payable account.');
    }

    return await conn.executeTransaction(async () => {
      // 3. Stock movements if direct bill (receiveStockNow) and not already received via goodsReceiptId
      const receiveStock = input.receiveStockNow !== false && !input.goodsReceiptId;
      const createdLinesToSave: any[] = [];
      let totalInventoryDebit = 0n;
      let totalExpenseDebit = 0n;

      for (const line of linesWithLandedCost) {
        let stockMovementId: string | null = null;

        if (receiveStock && line.itemType === 'inventory' && line.productId) {
          // Canonical unit conversion
          const prodRows = await conn.query<any>(
            `SELECT id, unit FROM products WHERE id = ? AND workspace_id = ?`,
            [line.productId, workspaceId]
          );
          if (prodRows.length === 0) {
            throw new Error(`Product ${line.productId} not found.`);
          }
          const prod = prodRows[0];
          const pkgUnit = line.packageUnit || 'pcs';

          let canonicalQuantity = line.quantity;
          if (pkgUnit.toLowerCase() !== prod.unit.toLowerCase()) {
            const conv = await conn.query<any>(
              `SELECT conversion_factor FROM product_unit_conversions WHERE product_id = ? AND LOWER(unit_name) = LOWER(?)`,
              [line.productId, pkgUnit]
            );
            if (conv.length > 0) {
              canonicalQuantity = line.quantity * Number(conv[0].conversion_factor);
            } else {
              canonicalQuantity = line.quantity * convertStandardUnit(1, pkgUnit, prod.unit);
            }
          }

          const movement = await InventoryService.recordStockMovement(conn, workspaceId, {
            productId: line.productId,
            sourceType: 'goods_received',
            quantity: canonicalQuantity,
            packageUnit: prod.unit,
            locationId: input.locationId,
            sourceId: billNumber,
            effectiveDate: input.billDate,
            unitCostScaled: line.effectiveUnitCost,
            reason: `Direct purchase bill ${billNumber}`
          });
          stockMovementId = movement.id;
        }

        if (line.itemType === 'inventory') {
          totalInventoryDebit += (line.gross - line.discount + line.allocatedLandedCost);
        } else {
          totalExpenseDebit += (line.gross - line.discount);
        }

        createdLinesToSave.push({
          purchaseOrderLineId: line.purchaseOrderLineId || null,
          productId: line.productId || null,
          itemType: line.itemType,
          accountId: line.accountId || (line.itemType === 'inventory' ? inventoryAccount.id : (defaultExpenseAccount?.id || inventoryAccount.id)),
          description: line.description,
          quantity: line.quantity,
          packageUnit: line.packageUnit || 'pcs',
          unitCostScaled: line.unitCostScaled,
          allocatedLandedCostScaled: line.allocatedLandedCost,
          effectiveUnitCostScaled: line.effectiveUnitCost,
          discountScaled: line.discount,
          taxRatePercent: line.taxRatePercent,
          taxScaled: line.tax,
          totalScaled: line.lineTotal + line.allocatedLandedCost,
          stockMovementId,
          notes: line.notes || null
        });
      }

      // Add tax to inventory or tax line
      if (totalTaxScaled > 0n) {
        totalInventoryDebit += totalTaxScaled;
      }

      // 4. Double-Entry Posting
      // Debit: Inventory Asset (and/or Operating Expenses)
      // Credit: Accounts Payable (supplier liability)
      const journalLines: Array<{
        accountId: string;
        debitAmountScaled: bigint;
        creditAmountScaled: bigint;
        partyId?: string;
        description?: string;
      }> = [];

      if (totalInventoryDebit > 0n) {
        journalLines.push({
          accountId: inventoryAccount.id,
          debitAmountScaled: totalInventoryDebit,
          creditAmountScaled: 0n,
          description: `Inventory purchase - Bill ${billNumber}`
        });
      }

      if (totalExpenseDebit > 0n) {
        const expAccId = defaultExpenseAccount?.id || inventoryAccount.id;
        journalLines.push({
          accountId: expAccId,
          debitAmountScaled: totalExpenseDebit,
          creditAmountScaled: 0n,
          description: `Non-stock expense - Bill ${billNumber}`
        });
      }

      journalLines.push({
        accountId: payableAccount.id,
        debitAmountScaled: 0n,
        creditAmountScaled: billTotalScaled,
        partyId: supplier.id,
        description: `Supplier Payable - Bill ${billNumber}`
      });

      const journalEntry = await PostingService.postJournal(conn, {
        workspaceId,
        entryDate: input.billDate,
        description: `Purchase Bill ${billNumber} from ${supplier.name}`,
        sourceType: 'purchase_bill',
        referenceType: 'purchase_bill',
        referenceId: billNumber,
        lines: journalLines
      });

      // 5. Create Purchase Bill record
      const receiptStatus: PurchaseReceiptStatus = receiveStock || input.goodsReceiptId ? 'received' : 'unreceived';
      const createdBill = await repo.createPurchaseBill(
        {
          workspaceId,
          billNumber,
          purchaseOrderId: input.purchaseOrderId || null,
          goodsReceiptId: input.goodsReceiptId || null,
          supplierId: supplier.id,
          supplierName: supplier.name,
          billDate: input.billDate,
          dueDate: input.dueDate,
          currencyCode: currency,
          receiptStatus,
          paymentStatus: 'unpaid',
          postingStatus: 'posted',
          subtotalScaled: rawSubtotalScaled,
          discountScaled: totalDiscountScaled,
          taxScaled: totalTaxScaled,
          landedCostScaled: landedCost,
          landedCostAllocationMethod: allocationMethod,
          totalScaled: billTotalScaled,
          paidAmountScaled: 0n,
          journalEntryId: journalEntry.id,
          notes: input.notes || null,
          attachmentPath: input.attachmentPath || null
        },
        createdLinesToSave
      );

      // 6. Sync with documents table for standard payment allocation lookup
      const docRepo = new DocumentRepository(conn);
      await docRepo.createWithLines(
        {
          id: createdBill.id,
          workspaceId,
          documentType: 'purchase_bill',
          documentNumber: billNumber,
          partyId: supplier.id,
          partyName: supplier.name,
          issueDate: input.billDate,
          dueDate: input.dueDate,
          currencyCode: currency,
          subtotalScaled: rawSubtotalScaled,
          discountScaled: totalDiscountScaled,
          taxScaled: totalTaxScaled + landedCost,
          totalScaled: billTotalScaled,
          paidAmountScaled: 0n,
          status: 'unpaid',
          notes: input.notes || null,
          attachmentRelativePath: input.attachmentPath || null,
          isArchived: false
        },
        createdLinesToSave.map(l => ({
          itemId: l.productId || undefined,
          description: l.description,
          quantity: l.quantity,
          unitPriceScaled: l.effectiveUnitCostScaled,
          discountScaled: l.discountScaled,
          taxRatePercent: l.taxRatePercent,
          taxScaled: l.taxScaled,
          totalScaled: l.totalScaled
        }))
      );

      // 7. Record Credit Purchase in Party Ledger (Khata)
      const partyLedgerRepo = new PartyLedgerRepository(conn);
      await partyLedgerRepo.recordEntry({
        workspaceId,
        partyId: supplier.id,
        entryDate: input.billDate,
        entryType: 'credit_purchase',
        documentId: createdBill.id,
        journalEntryId: journalEntry.id,
        referenceNumber: billNumber,
        description: `Credit Purchase Bill ${billNumber}`,
        receivableAmountScaled: 0n,
        payableAmountScaled: billTotalScaled,
        dueDate: input.dueDate
      });

      // 8. If immediate payment requested, record payment atomically
      if (input.immediatePayment && input.immediatePayment.amountScaled > 0n) {
        await this.recordSupplierPayment(conn, workspaceId, {
          billId: createdBill.id,
          amountScaled: input.immediatePayment.amountScaled,
          paymentDate: input.billDate,
          paymentMethod: input.immediatePayment.paymentMethod || 'Cash',
          accountId: input.immediatePayment.accountId,
          referenceNumber: input.immediatePayment.referenceNumber,
          notes: input.immediatePayment.notes || `Immediate payment on Bill ${billNumber}`
        });
      }

      // Re-fetch created bill with updated paid amounts
      const refreshed = await repo.findPurchaseBillById(createdBill.id);
      return refreshed!;
    });
  }

  // --------------------------------------------------------------------------
  // 4. Purchase Returns & Supplier Credit Notes
  // --------------------------------------------------------------------------

  /**
   * Records a return of goods to the supplier.
   * STRICT GUARANTEES:
   * 1. References original purchase bill.
   * 2. Validates returnable quantity (cannot exceed received - already returned unless allowOverReturn: true).
   * 3. Decreases on-hand stock through an atomic 'purchase_return' stock movement.
   * 4. Debits Accounts Payable (2010), Credits Inventory Asset (1300).
   * 5. Reduces supplier payable balance in party ledger.
   * 6. Preserves complete audit trail.
   */
  public static async recordPurchaseReturn(
    conn: DatabaseConnection,
    workspaceId: string,
    input: RecordPurchaseReturnInput
  ): Promise<PurchaseReturnWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    assertValid(validateRequiredString(input.originalBillId, 'Original Bill ID'));
    assertValid(validateRequiredString(input.returnDate, 'Return Date'));
    assertValid(validateRequiredString(input.reason, 'Return Reason'));

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Purchase return must contain at least one line item.');
    }

    const repo = new PurchaseRepository(conn);
    const bill = await repo.findPurchaseBillById(input.originalBillId);
    if (!bill || bill.workspaceId !== workspaceId) {
      throw new Error(`Original purchase bill ${input.originalBillId} not found.`);
    }

    const returnNumber = input.returnNumber?.trim() || `PR-${Date.now().toString().slice(-6)}`;
    const settlementType = input.settlementType || 'credit_note';

    // Account lookups
    const accountRepo = new AccountRepository(conn);
    const accounts = await accountRepo.findByWorkspace(workspaceId);
    const inventoryAccount = accounts.find(a => a.accountCode === '1300' || a.subCategory === 'inventory') || accounts.find(a => a.type === 'asset');
    const payableAccount = accounts.find(a => a.accountCode === '2010' || a.subCategory === 'supplier_payables') || accounts.find(a => a.type === 'liability');
    const cashAccount = accounts.find(a => a.accountCode === '1010' || a.subCategory === 'cash') || accounts.find(a => a.type === 'asset');

    if (!inventoryAccount || !payableAccount || !cashAccount) {
      throw new Error('Chart of accounts missing required Inventory Asset, Accounts Payable, or Cash account.');
    }

    return await conn.executeTransaction(async () => {
      let subtotalScaled = 0n;
      let taxScaled = 0n;
      const returnLinesToSave: any[] = [];

      for (const line of input.lines) {
        if (line.returnedQuantity <= 0) {
          throw new Error(`Returned quantity must be greater than zero for "${line.description}".`);
        }

        // Validate against original bill line
        const billLine = bill.lines.find(bl => bl.id === line.originalBillLineId);
        if (!billLine) {
          throw new Error(`Original bill line ${line.originalBillLineId} not found on bill ${bill.billNumber}.`);
        }

        // Check already returned quantity
        const alreadyReturned = await repo.getReturnedQuantityForBillLine(line.originalBillLineId);
        const returnable = billLine.quantity - alreadyReturned;

        if (line.returnedQuantity > returnable && !input.allowOverReturn) {
          throw new Error(
            `Cannot return ${line.returnedQuantity} of "${line.description}". Original received: ${billLine.quantity}, already returned: ${alreadyReturned}, max returnable: ${returnable}.`
          );
        }

        // Canonical quantity conversion
        const prodRows = await conn.query<any>(
          `SELECT id, unit FROM products WHERE id = ? AND workspace_id = ?`,
          [line.productId, workspaceId]
        );
        if (prodRows.length === 0) {
          throw new Error(`Product ${line.productId} not found.`);
        }
        const prod = prodRows[0];
        const pkgUnit = line.packageUnit || billLine.packageUnit || 'pcs';

        let canonicalQuantity = line.returnedQuantity;
        if (pkgUnit.toLowerCase() !== prod.unit.toLowerCase()) {
          const conv = await conn.query<any>(
            `SELECT conversion_factor FROM product_unit_conversions WHERE product_id = ? AND LOWER(unit_name) = LOWER(?)`,
            [line.productId, pkgUnit]
          );
          if (conv.length > 0) {
            canonicalQuantity = line.returnedQuantity * Number(conv[0].conversion_factor);
          } else {
            canonicalQuantity = line.returnedQuantity * convertStandardUnit(1, pkgUnit, prod.unit);
          }
        }

        // Unit cost from original purchase
        const unitCost = billLine.effectiveUnitCostScaled > 0n ? billLine.effectiveUnitCostScaled : billLine.unitCostScaled;
        const lineSubtotal = BigInt(Math.round(line.returnedQuantity * Number(unitCost)));
        const rate = billLine.taxRatePercent || 0;
        const lineTax = BigInt(Math.round(Number(lineSubtotal) * (rate / 100)));
        const lineTotal = lineSubtotal + lineTax;

        subtotalScaled += lineSubtotal;
        taxScaled += lineTax;

        // Atomic stock decrease via purchase_return movement
        const movement = await InventoryService.recordStockMovement(conn, workspaceId, {
          productId: line.productId,
          sourceType: 'purchase_return',
          quantity: -canonicalQuantity, // Outbound return to supplier
          packageUnit: prod.unit,
          sourceId: returnNumber,
          effectiveDate: input.returnDate,
          unitCostScaled: unitCost,
          reason: `Purchase Return ${returnNumber} against Bill ${bill.billNumber}: ${input.reason}`
        });

        returnLinesToSave.push({
          originalBillLineId: line.originalBillLineId,
          productId: line.productId,
          description: line.description,
          returnedQuantity: line.returnedQuantity,
          packageUnit: pkgUnit,
          canonicalQuantity,
          unitCostScaled: unitCost,
          taxScaled: lineTax,
          totalScaled: lineTotal,
          stockMovementId: movement.id,
          notes: line.notes || null
        });
      }

      const totalReturnScaled = subtotalScaled + taxScaled;

      // Double-entry posting:
      // Debit: Accounts Payable (reducing supplier liability / creating credit note)
      // Credit: Inventory Asset (reducing inventory valuation)
      const journalLines: Array<{
        accountId: string;
        debitAmountScaled: bigint;
        creditAmountScaled: bigint;
        partyId?: string;
        description?: string;
      }> = [
        {
          accountId: payableAccount.id,
          debitAmountScaled: totalReturnScaled,
          creditAmountScaled: 0n,
          partyId: bill.supplierId,
          description: `Debit Note / Return ${returnNumber} on Bill ${bill.billNumber}`
        },
        {
          accountId: inventoryAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalReturnScaled,
          description: `Inventory reduction from Return ${returnNumber}`
        }
      ];

      // If immediate cash or bank refund was paid by the supplier:
      if (settlementType === 'cash_refund' || settlementType === 'bank_refund') {
        const refundAccount = input.refundAccountId
          ? accounts.find(a => a.id === input.refundAccountId) || cashAccount
          : cashAccount;

        // Debit: Cash/Bank (receiving cash refund from supplier)
        // Credit: Accounts Payable (clearing the debit balance created above)
        journalLines.push({
          accountId: refundAccount.id,
          debitAmountScaled: totalReturnScaled,
          creditAmountScaled: 0n,
          description: `Cash refund received from supplier for Return ${returnNumber}`
        });
        journalLines.push({
          accountId: payableAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalReturnScaled,
          partyId: bill.supplierId,
          description: `Clear supplier payable for cash refund on Return ${returnNumber}`
        });
      }

      const journalEntry = await PostingService.postJournal(conn, {
        workspaceId,
        entryDate: input.returnDate,
        description: `Purchase Return ${returnNumber} to ${bill.supplierName}`,
        sourceType: 'purchase_return',
        referenceType: 'purchase_return',
        referenceId: returnNumber,
        lines: journalLines
      });

      // Create Purchase Return record
      const createdReturn = await repo.createPurchaseReturn(
        {
          workspaceId,
          returnNumber,
          originalBillId: bill.id,
          supplierId: bill.supplierId,
          supplierName: bill.supplierName,
          returnDate: input.returnDate,
          currencyCode: bill.currencyCode,
          subtotalScaled,
          taxScaled,
          totalScaled: totalReturnScaled,
          refundAmountScaled: settlementType !== 'credit_note' ? totalReturnScaled : 0n,
          settlementType,
          journalEntryId: journalEntry.id,
          reason: input.reason,
          allowOverReturn: input.allowOverReturn || false
        },
        returnLinesToSave
      );

      // Sync to documents table as purchase_return first
      const docRepo = new DocumentRepository(conn);
      await docRepo.createWithLines(
        {
          id: createdReturn.id,
          workspaceId,
          documentType: 'purchase_return',
          documentNumber: returnNumber,
          partyId: bill.supplierId,
          partyName: bill.supplierName,
          issueDate: input.returnDate,
          dueDate: input.returnDate,
          currencyCode: bill.currencyCode,
          subtotalScaled,
          discountScaled: 0n,
          taxScaled,
          totalScaled: totalReturnScaled,
          paidAmountScaled: totalReturnScaled,
          status: 'paid',
          notes: input.reason,
          isArchived: false
        },
        returnLinesToSave.map(l => ({
          itemId: l.productId,
          description: l.description,
          quantity: l.returnedQuantity,
          unitPriceScaled: l.unitCostScaled,
          discountScaled: 0n,
          taxRatePercent: 0,
          taxScaled: l.taxScaled,
          totalScaled: l.totalScaled
        }))
      );

      // Record entry in Party Ledger (Khata): debit movement reduces what we owe supplier
      const partyLedgerRepo = new PartyLedgerRepository(conn);
      await partyLedgerRepo.recordEntry({
        workspaceId,
        partyId: bill.supplierId,
        entryDate: input.returnDate,
        entryType: 'purchase_return',
        documentId: createdReturn.id,
        journalEntryId: journalEntry.id,
        referenceNumber: returnNumber,
        description: `Purchase Return ${returnNumber} (Bill ${bill.billNumber})`,
        receivableAmountScaled: totalReturnScaled,
        payableAmountScaled: 0n
      });

      // Also adjust original purchase bill paid amount / balance if credit note offsets it
      const nextPaid = bill.paidAmountScaled + totalReturnScaled;
      const nextPaymentStatus: PurchasePaymentStatus =
        nextPaid >= bill.totalScaled ? 'paid' : nextPaid > 0n ? 'partially_paid' : 'unpaid';
      await repo.updatePurchaseBillPaidAmount(bill.id, nextPaid, nextPaymentStatus);

      return createdReturn;
    });
  }

  // --------------------------------------------------------------------------
  // 5. Supplier Payments & Invoice Allocations
  // --------------------------------------------------------------------------

  /**
   * Records a payment to a supplier against a purchase bill.
   * Atomically:
   * 1. Validates amount does not exceed remaining unpaid balance.
   * 2. Debits Accounts Payable (2010), Credits Cash on Hand (1010) or Bank (1020).
   * 3. Updates bill paidAmountScaled and paymentStatus.
   * 4. Updates document record for compatibility.
   * 5. Records in payments & payment_allocations.
   * 6. Records 'supplier_payment' in party ledger.
   */
  public static async recordSupplierPayment(
    conn: DatabaseConnection,
    workspaceId: string,
    input: RecordSupplierPaymentInput
  ): Promise<{ bill: PurchaseBillWithLines; paymentId: string }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    assertValid(validateRequiredString(input.billId, 'Bill ID'));
    assertValid(validateRequiredString(input.paymentDate, 'Payment Date'));

    if (input.amountScaled <= 0n) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const repo = new PurchaseRepository(conn);
    const bill = await repo.findPurchaseBillById(input.billId);
    if (!bill || bill.workspaceId !== workspaceId) {
      throw new Error(`Purchase bill ${input.billId} not found.`);
    }

    const remaining = bill.totalScaled - bill.paidAmountScaled;
    if (input.amountScaled > remaining) {
      throw new Error(
        `Payment amount (${input.amountScaled}) exceeds remaining unpaid balance (${remaining}) for Bill ${bill.billNumber}.`
      );
    }

    const accountRepo = new AccountRepository(conn);
    const paymentAccount = await accountRepo.findById(input.accountId);
    if (!paymentAccount || paymentAccount.workspaceId !== workspaceId) {
      throw new Error(`Payment account ${input.accountId} not found in workspace.`);
    }

    const accounts = await accountRepo.findByWorkspace(workspaceId);
    const payableAccount = accounts.find(a => a.accountCode === '2010' || a.subCategory === 'supplier_payables') || accounts.find(a => a.type === 'liability');
    if (!payableAccount) {
      throw new Error('Accounts Payable account (2010) not found in Chart of Accounts.');
    }

    const paymentNumber = `SPAY-${Date.now().toString().slice(-6)}`;

    return await conn.executeTransaction(async () => {
      // 1. Post double-entry Journal Entry:
      // Debit: Accounts Payable (reducing supplier liability)
      // Credit: Cash / Bank Account (outflow of funds)
      const journalLines = [
        {
          accountId: payableAccount.id,
          debitAmountScaled: input.amountScaled,
          creditAmountScaled: 0n,
          partyId: bill.supplierId,
          description: `Supplier Payment for Bill ${bill.billNumber}`
        },
        {
          accountId: paymentAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: input.amountScaled,
          description: `Payment to ${bill.supplierName} - Bill ${bill.billNumber}`
        }
      ];

      const journalEntry = await PostingService.postJournal(conn, {
        workspaceId,
        entryDate: input.paymentDate,
        description: `Payment to ${bill.supplierName} - Bill ${bill.billNumber}`,
        sourceType: 'supplier_payment',
        referenceType: 'supplier_payment',
        referenceId: paymentNumber,
        lines: journalLines
      });

      // 2. Update Purchase Bill status and paid amount
      const nextPaid = bill.paidAmountScaled + input.amountScaled;
      const nextPaymentStatus: PurchasePaymentStatus =
        nextPaid >= bill.totalScaled ? 'paid' : 'partially_paid';

      await repo.updatePurchaseBillPaidAmount(bill.id, nextPaid, nextPaymentStatus);

      // 3. Update documents table record
      await conn.run(
        `UPDATE documents
         SET paid_amount_scaled = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          Number(nextPaid),
          nextPaymentStatus === 'paid' ? 'paid' : 'partial',
          new Date().toISOString(),
          bill.id
        ]
      );

      // 4. Create Payment Record and Allocation
      const paymentRepo = new PaymentRepository(conn);
      const paymentRecord = await paymentRepo.createWithAllocations(
        {
          workspaceId,
          partyId: bill.supplierId,
          paymentNumber,
          paymentType: 'supplier_payment',
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod || 'Cash',
          accountId: paymentAccount.id,
          amountScaled: input.amountScaled,
          referenceNumber: input.referenceNumber || bill.billNumber,
          notes: input.notes || `Payment for Bill ${bill.billNumber}`
        },
        [
          {
            documentId: bill.id,
            amountScaled: input.amountScaled
          }
        ]
      );

      // 5. Record entry in Party Ledger (Khata): debit movement reduces what we owe supplier
      const partyLedgerRepo = new PartyLedgerRepository(conn);
      await partyLedgerRepo.recordEntry({
        workspaceId,
        partyId: bill.supplierId,
        entryDate: input.paymentDate,
        entryType: 'supplier_payment',
        documentId: bill.id,
        paymentId: paymentRecord.id,
        journalEntryId: journalEntry.id,
        referenceNumber: paymentNumber,
        description: `Payment for Bill ${bill.billNumber} via ${paymentAccount.name}`,
        receivableAmountScaled: input.amountScaled,
        payableAmountScaled: 0n
      });

      const updatedBill = await repo.findPurchaseBillById(bill.id);
      return {
        bill: updatedBill!,
        paymentId: paymentRecord.id
      };
    });
  }

  // --------------------------------------------------------------------------
  // 6. Summary Metrics & Query Helpers
  // --------------------------------------------------------------------------

  public static async getPurchaseSummary(
    conn: DatabaseConnection,
    workspaceId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<PurchaseSummaryMetrics> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, false);

    let billWhere = `WHERE workspace_id = ? AND posting_status = 'posted'`;
    const billParams: any[] = [workspaceId];
    if (periodStart) {
      billWhere += ` AND bill_date >= ?`;
      billParams.push(periodStart);
    }
    if (periodEnd) {
      billWhere += ` AND bill_date <= ?`;
      billParams.push(periodEnd);
    }

    const billRows = await conn.query<any>(
      `SELECT SUM(total_scaled) as total_purchases,
              SUM(total_scaled - paid_amount_scaled) as outstanding_payables
       FROM purchase_bills ${billWhere}`,
      billParams
    );

    const poRows = await conn.query<any>(
      `SELECT COUNT(*) as pending_count
       FROM purchase_orders
       WHERE workspace_id = ? AND order_status IN ('ordered', 'partially_received')`,
      [workspaceId]
    );

    let retWhere = `WHERE workspace_id = ?`;
    const retParams: any[] = [workspaceId];
    if (periodStart) {
      retWhere += ` AND return_date >= ?`;
      retParams.push(periodStart);
    }
    if (periodEnd) {
      retWhere += ` AND return_date <= ?`;
      retParams.push(periodEnd);
    }

    const retRows = await conn.query<any>(
      `SELECT SUM(total_scaled) as total_returns FROM purchase_returns ${retWhere}`,
      retParams
    );

    return {
      totalPurchasesScaled: BigInt(billRows[0]?.total_purchases || 0),
      outstandingPayablesScaled: BigInt(billRows[0]?.outstanding_payables || 0),
      pendingReceiptsCount: Number(poRows[0]?.pending_count || 0),
      totalReturnsScaled: BigInt(retRows[0]?.total_returns || 0),
      currencyCode: 'PKR'
    };
  }

  public static async listPurchaseOrders(
    conn: DatabaseConnection,
    workspaceId: string,
    options: PurchaseFilterOptions = {}
  ): Promise<{ orders: PurchaseOrderWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, false);
    const repo = new PurchaseRepository(conn);
    return await repo.findPurchaseOrders(workspaceId, options);
  }

  public static async listPurchaseBills(
    conn: DatabaseConnection,
    workspaceId: string,
    options: PurchaseFilterOptions & {
      receiptStatus?: PurchaseReceiptStatus;
      paymentStatus?: PurchasePaymentStatus;
      postingStatus?: PurchasePostingStatus;
      purchaseOrderId?: string;
    } = {}
  ): Promise<{ bills: PurchaseBillWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, false);
    const repo = new PurchaseRepository(conn);
    return await repo.findPurchaseBills(workspaceId, options);
  }

  public static async listGoodsReceipts(
    conn: DatabaseConnection,
    workspaceId: string,
    options: PurchaseFilterOptions & { purchaseOrderId?: string } = {}
  ): Promise<{ receipts: GoodsReceiptWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, false);
    const repo = new PurchaseRepository(conn);
    return await repo.findGoodsReceipts(workspaceId, options);
  }

  public static async listPurchaseReturns(
    conn: DatabaseConnection,
    workspaceId: string,
    options: PurchaseFilterOptions & { originalBillId?: string } = {}
  ): Promise<{ returns: PurchaseReturnWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, false);
    const repo = new PurchaseRepository(conn);
    return await repo.findPurchaseReturns(workspaceId, options);
  }
}
