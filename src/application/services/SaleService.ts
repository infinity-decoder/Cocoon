/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import {
  SalesRepository,
  SalesReturnWithLines,
  SalesDocumentFilter
} from '../../infrastructure/database/repositories/SalesRepository';
import { DocumentRepository, DocumentWithLines } from '../../infrastructure/database/repositories/DocumentRepository';
import { ProductRepository, ProductRecord } from '../../infrastructure/database/repositories/ProductRepository';
import { PartyRepository, PartyRecord } from '../../infrastructure/database/repositories/PartyRepository';
import { AccountRepository, AccountRecord } from '../../infrastructure/database/repositories/AccountRepository';
import { PaymentRepository, PaymentWithAllocations } from '../../infrastructure/database/repositories/PaymentRepository';
import { PartyLedgerRepository } from '../../infrastructure/database/repositories/PartyLedgerRepository';
import { JournalEntryRepository } from '../../infrastructure/database/repositories/JournalEntryRepository';
import { InventoryService } from './InventoryService';
import { convertStandardUnit } from '../../domain/inventory/InventoryItem';
import { WorkspaceService } from './WorkspaceService';
import { generateEntityId } from '../../domain/primitives/EntityId';
import { auditTrailService } from './AuditTrailService';

export interface SplitPaymentLine {
  method: 'cash' | 'bank' | 'card' | 'other';
  accountId: string; // Target Cash on Hand (1010) or Bank Account (1020)
  amountScaled: bigint;
  referenceNumber?: string;
  notes?: string;
}

export interface CompleteSaleItemInput {
  productId: string;
  description: string;
  quantity: number;
  packageUnit?: string;
  unitPriceScaled: bigint;
  discountScaled?: bigint;
  taxRatePercent?: number;
  notes?: string;
}

export interface CompleteSaleInput {
  idempotencyKey?: string;
  customerId?: string | null;
  customerName?: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode?: string;
  paymentType: 'full_cash' | 'full_bank' | 'split' | 'credit' | 'partial';
  payments?: SplitPaymentLine[];
  depositAccountId?: string;
  paidAmountScaled?: bigint;
  negativeStockPolicy?: 'block' | 'warn' | 'allow';
  isWalkIn?: boolean;
  cashierName?: string;
  notes?: string;
  items: CompleteSaleItemInput[];
}

export interface CompleteSaleResult {
  document: DocumentWithLines;
  invoiceNumber: string;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  remainingBalanceScaled: bigint;
  totalCogsScaled: bigint;
  payments: PaymentWithAllocations[];
  journalEntryId: string;
  isIdempotentReplay: boolean;
  warnings: string[];
  receiptData: {
    businessName: string;
    legalName?: string;
    taxIdentifier?: string;
    invoiceNumber: string;
    date: string;
    cashierName?: string;
    customerName: string;
    currencySymbol: string;
    lines: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitPriceScaled: bigint;
      discountScaled: bigint;
      taxScaled: bigint;
      totalScaled: bigint;
    }>;
    subtotalScaled: bigint;
    discountScaled: bigint;
    taxScaled: bigint;
    totalScaled: bigint;
    paidAmountScaled: bigint;
    changeOrDueScaled: bigint;
    paymentMethod: string;
  };
}

export interface SalesReturnItemInput {
  originalLineId: string;
  productId: string;
  description: string;
  returnedQuantity: number;
  packageUnit?: string;
  itemCondition: 'resellable' | 'damaged' | 'scrap';
  notes?: string;
}

export interface RecordSalesReturnInput {
  originalDocumentId: string;
  returnNumber?: string;
  returnDate: string;
  settlementType: 'cash_refund' | 'bank_refund' | 'store_credit' | 'receivable_credit';
  refundAccountId?: string;
  reason: string;
  notes?: string;
  allowOverReturn?: boolean;
  lines: SalesReturnItemInput[];
}

export class SaleService {
  /**
   * Completes a POS or Sales Invoice transaction atomically.
   * Enforces all 12 complete-sale transaction stages:
   * 1. Cart, prices, discounts, taxes & customer validation.
   * 2. Workspace and chart of accounts validation.
   * 3. Stock availability & negative-stock policy checking.
   * 4. Atomic sequential invoice numbering policy.
   * 5. Client idempotency key check (zero duplicate sales on double-tap/retry).
   * 6. Insertion of document and line items.
   * 7. Insertion of stock movements & locked COGS.
   * 8. Insertion of payment records & allocations.
   * 9. Double-entry balanced journal entry posting (revenue, tax, cash/A/R, inventory, COGS).
   * 10. Atomic database transaction with full rollback on any failure.
   * 11. Success only after committed database state.
   * 12. Generates receipt metadata and refreshed financial numbers.
   */
  public static async completeSale(
    conn: DatabaseConnection,
    workspaceId: string,
    input: CompleteSaleInput
  ): Promise<CompleteSaleResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const salesRepo = new SalesRepository(conn);
    const productRepo = new ProductRepository(conn);
    const partyRepo = new PartyRepository(conn);
    const accountRepo = new AccountRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);
    const paymentRepo = new PaymentRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);

    // -------------------------------------------------------------
    // STAGE 5: Idempotency Check (Double-Tap & Retry Protection)
    // -------------------------------------------------------------
    if (input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await salesRepo.findDocumentByIdempotencyKey(workspaceId, input.idempotencyKey.trim());
      if (existing) {
        // Return existing committed document safely without duplicating records
        const remaining = existing.totalScaled - existing.paidAmountScaled;
        return {
          document: existing,
          invoiceNumber: existing.documentNumber,
          totalScaled: existing.totalScaled,
          paidAmountScaled: existing.paidAmountScaled,
          remainingBalanceScaled: remaining > 0n ? remaining : 0n,
          totalCogsScaled: 0n,
          payments: [],
          journalEntryId: '',
          isIdempotentReplay: true,
          warnings: ['Replayed existing sale transaction from idempotency key.'],
          receiptData: {
            businessName: 'Business',
            invoiceNumber: existing.documentNumber,
            date: existing.issueDate,
            customerName: existing.partyName,
            currencySymbol: existing.currencyCode,
            lines: existing.lines.map(l => ({
              description: l.description,
              quantity: l.quantity,
              unit: l.packageUnit || 'pcs',
              unitPriceScaled: l.unitPriceScaled,
              discountScaled: l.discountScaled,
              taxScaled: l.taxScaled,
              totalScaled: l.totalScaled
            })),
            subtotalScaled: existing.subtotalScaled,
            discountScaled: existing.discountScaled,
            taxScaled: existing.taxScaled,
            totalScaled: existing.totalScaled,
            paidAmountScaled: existing.paidAmountScaled,
            changeOrDueScaled: remaining > 0n ? remaining : 0n,
            paymentMethod: 'Recorded'
          }
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 1: Cart, Quantities, Prices, Discounts, Taxes & Customer
    // -------------------------------------------------------------
    if (!input.items || input.items.length === 0) {
      throw new Error('Sales cart cannot be empty. Please add at least one product.');
    }

    let isWalkIn = Boolean(input.isWalkIn);
    let customer: PartyRecord | null = null;

    if (input.customerId) {
      customer = await partyRepo.findById(input.customerId);
      if (!customer || customer.workspaceId !== workspaceId) {
        throw new Error(`Customer ${input.customerId} not found in this workspace.`);
      }
      if (!customer.isActive) {
        throw new Error(`Customer "${customer.name}" is inactive.`);
      }
      isWalkIn = false;
    }

    // Calculate line totals and accumulate document totals
    let subtotalScaled = 0n;
    let totalDiscountScaled = 0n;
    let totalTaxScaled = 0n;

    const validatedLines: Array<{
      productId: string;
      product: ProductRecord;
      description: string;
      quantity: number;
      packageUnit: string;
      canonicalQuantity: number;
      unitPriceScaled: bigint;
      discountScaled: bigint;
      taxRatePercent: number;
      taxScaled: bigint;
      totalScaled: bigint;
      unitCostScaled: bigint;
      notes?: string;
    }> = [];

    const warnings: string[] = [];

    // Fetch workspace profile for negative stock policy
    const bpRows = await conn.query<any>(
      `SELECT business_type, legal_name, tax_identifier, invoice_prefix, next_invoice_sequence, negative_stock_policy, allow_walk_in_credit 
       FROM business_profiles 
       WHERE workspace_id = ? 
       LIMIT 1`,
      [workspaceId]
    );

    const businessProfile = bpRows[0] || {};
    const effectiveStockPolicy = input.negativeStockPolicy || businessProfile.negative_stock_policy || 'block';

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error(`Item "${item.description}" quantity must be greater than zero.`);
      }
      if (item.unitPriceScaled < 0n) {
        throw new Error(`Unit price for "${item.description}" cannot be negative.`);
      }

      const product = await productRepo.findById(item.productId);
      if (!product || product.workspaceId !== workspaceId) {
        throw new Error(`Product "${item.description}" (ID: ${item.productId}) not found.`);
      }
      if (product.isArchived) {
        throw new Error(`Product "${product.name}" is inactive/archived and cannot be sold.`);
      }

      const pkgUnit = item.packageUnit || product.unit;
      let canonicalQuantity = item.quantity;

      // Unit conversion to canonical stock unit
      if (pkgUnit.toLowerCase() !== product.unit.toLowerCase()) {
        const conversions = await productRepo.findUnitConversionsByProductId(product.id);
        const match = conversions.find(c => c.unitName.toLowerCase() === pkgUnit.toLowerCase());
        if (match) {
          canonicalQuantity = item.quantity * match.conversionFactor;
        } else {
          canonicalQuantity = item.quantity * convertStandardUnit(1, pkgUnit, product.unit);
        }
      }

      // -------------------------------------------------------------
      // STAGE 3: Check Stock & Negative-Stock Policy
      // -------------------------------------------------------------
      const currentStock = product.currentStockQuantity;
      if (currentStock < canonicalQuantity) {
        if (effectiveStockPolicy === 'block') {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${currentStock} ${product.unit}, Requested: ${canonicalQuantity} ${product.unit}. Sale blocked by negative-stock policy.`
          );
        } else if (effectiveStockPolicy === 'warn') {
          warnings.push(
            `Warning: Stock for "${product.name}" is below requested quantity (Available: ${currentStock}, Sold: ${canonicalQuantity}). Stock will drop below zero.`
          );
        }
      }

      // Line calculations
      const lineSubtotal = BigInt(Math.round(item.quantity * Number(item.unitPriceScaled)));
      const lineDiscount = item.discountScaled ? BigInt(item.discountScaled) : 0n;
      if (lineDiscount > lineSubtotal) {
        throw new Error(`Discount cannot exceed line subtotal for "${item.description}".`);
      }
      const netSubtotal = lineSubtotal - lineDiscount;
      const rate = item.taxRatePercent || 0;
      const lineTax = BigInt(Math.round(Number(netSubtotal) * (rate / 100)));
      const lineTotal = netSubtotal + lineTax;

      subtotalScaled += lineSubtotal;
      totalDiscountScaled += lineDiscount;
      totalTaxScaled += lineTax;

      // Determine unit cost for COGS (lock at weighted average cost at posting time)
      const unitCost = product.weightedAvgCostScaled > 0n ? product.weightedAvgCostScaled : product.costPriceScaled;

      validatedLines.push({
        productId: product.id,
        product,
        description: item.description || product.name,
        quantity: item.quantity,
        packageUnit: pkgUnit,
        canonicalQuantity,
        unitPriceScaled: item.unitPriceScaled,
        discountScaled: lineDiscount,
        taxRatePercent: rate,
        taxScaled: lineTax,
        totalScaled: lineTotal,
        unitCostScaled: unitCost,
        notes: item.notes
      });
    }

    const totalScaled = subtotalScaled - totalDiscountScaled + totalTaxScaled;

    // -------------------------------------------------------------
    // STAGE 2: Validate Business & Chart of Accounts
    // -------------------------------------------------------------
    const accounts = await accountRepo.findByWorkspace(workspaceId);
    const cashAccount = accounts.find(a => a.accountCode === '1010' || a.subCategory === 'cash') || accounts.find(a => a.type === 'asset');
    const bankAccount = accounts.find(a => a.accountCode === '1020' || a.subCategory === 'bank') || cashAccount;
    const receivableAccount = accounts.find(a => a.accountCode === '1200' || a.subCategory === 'receivables') || accounts.find(a => a.type === 'asset');
    const inventoryAccount = accounts.find(a => a.accountCode === '1300' || a.subCategory === 'inventory') || accounts.find(a => a.type === 'asset');
    const taxAccount = accounts.find(a => a.accountCode === '2020' || a.subCategory === 'taxes_payable') || accounts.find(a => a.type === 'liability');
    const revenueAccount = accounts.find(a => a.accountCode === '4010' || a.subCategory === 'sales') || accounts.find(a => a.type === 'revenue');
    const cogsAccount = accounts.find(a => a.accountCode === '5010' || a.subCategory === 'cogs') || accounts.find(a => a.type === 'expense');

    if (!cashAccount || !receivableAccount || !inventoryAccount || !taxAccount || !revenueAccount || !cogsAccount) {
      throw new Error('Chart of accounts missing required system accounts (Cash, A/R, Inventory, Tax, Revenue, or COGS).');
    }

    // -------------------------------------------------------------
    // Payment Method & Credit Calculations
    // -------------------------------------------------------------
    let paidAmountScaled = 0n;
    const paymentAllocationsToCreate: Array<{
      accountId: string;
      amountScaled: bigint;
      method: string;
      reference?: string;
      notes?: string;
    }> = [];

    if (input.paymentType === 'full_cash') {
      paidAmountScaled = totalScaled;
      paymentAllocationsToCreate.push({
        accountId: input.depositAccountId || cashAccount.id,
        amountScaled: totalScaled,
        method: 'cash',
        notes: 'Full cash payment at POS checkout'
      });
    } else if (input.paymentType === 'full_bank') {
      paidAmountScaled = totalScaled;
      paymentAllocationsToCreate.push({
        accountId: input.depositAccountId || bankAccount?.id || cashAccount.id,
        amountScaled: totalScaled,
        method: 'bank',
        notes: 'Full digital/bank payment at POS checkout'
      });
    } else if (input.paymentType === 'credit') {
      paidAmountScaled = 0n;
    } else if (input.paymentType === 'partial') {
      paidAmountScaled = input.paidAmountScaled || 0n;
      if (paidAmountScaled > totalScaled) {
        throw new Error('Paid amount cannot exceed total invoice amount in partial payment mode.');
      }
      if (paidAmountScaled > 0n) {
        paymentAllocationsToCreate.push({
          accountId: input.depositAccountId || cashAccount.id,
          amountScaled: paidAmountScaled,
          method: 'cash',
          notes: 'Partial payment received at sale'
        });
      }
    } else if (input.paymentType === 'split') {
      if (!input.payments || input.payments.length === 0) {
        throw new Error('Split payment mode requires at least one payment allocation.');
      }
      for (const p of input.payments) {
        if (p.amountScaled <= 0n) {
          throw new Error('Split payment line amount must be greater than zero.');
        }
        paidAmountScaled += p.amountScaled;
        paymentAllocationsToCreate.push({
          accountId: p.accountId || (p.method === 'bank' ? bankAccount?.id || cashAccount.id : cashAccount.id),
          amountScaled: p.amountScaled,
          method: p.method,
          reference: p.referenceNumber,
          notes: p.notes || `Split ${p.method} payment`
        });
      }
      if (paidAmountScaled > totalScaled) {
        throw new Error('Total split payments cannot exceed invoice total.');
      }
    }

    const remainingBalanceScaled = totalScaled - paidAmountScaled;

    // Strict walk-in credit check:
    // "Walk-in sales must have an explicit policy; do not silently attach credit to an anonymous customer if that would make debt collection impossible."
    if (remainingBalanceScaled > 0n && (isWalkIn || !customer)) {
      throw new Error(
        'Walk-in cash customers cannot purchase on credit. Please select or register a customer to record accounts receivable.'
      );
    }

    // Verify credit limit if customer is registered and remaining balance > 0
    if (customer && remainingBalanceScaled > 0n && customer.creditLimitScaled > 0n) {
      const currentOutstanding = await ledgerRepo.getDerivedPartyBalance(workspaceId, customer.id);
      const currentReceivable = currentOutstanding.balanceType === 'receivable' ? currentOutstanding.netBalanceScaled : 0n;
      if (currentReceivable + remainingBalanceScaled > customer.creditLimitScaled) {
        throw new Error(
          `Credit limit exceeded for "${customer.name}". Current A/R: ${currentReceivable}, Credit limit: ${customer.creditLimitScaled}.`
        );
      }
    }

    const now = new Date().toISOString();
    const issueDate = input.issueDate || now.slice(0, 10);
    const dueDate = input.dueDate || issueDate;
    const currency = input.currencyCode || 'PKR';
    const customerDisplayName = customer ? customer.name : (input.customerName || 'Walk-in Customer');

    const docStatus = paidAmountScaled >= totalScaled ? 'paid' : paidAmountScaled > 0n ? 'partial' : 'unpaid';

    // -------------------------------------------------------------
    // STAGES 4, 6, 7, 8, 9, 10: Atomic Execution & Rollback
    // -------------------------------------------------------------
    return await conn.executeTransaction(async () => {
      // Stage 4: Unique sequential invoice number under business policy
      const invoiceNumber = await salesRepo.getNextInvoiceNumber(workspaceId);
      const docId = generateEntityId('inv');

      // Stage 6: Insert Sales Document
      await conn.run(
        `INSERT INTO documents (
          id, workspace_id, document_type, document_number, party_id, party_name,
          issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
          tax_scaled, total_scaled, paid_amount_scaled, status, notes,
          attachment_relative_path, is_archived, created_at, updated_at,
          idempotency_key, payment_method, is_pos, cashier_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          workspaceId,
          'sales_invoice',
          invoiceNumber,
          customer ? customer.id : null,
          customerDisplayName,
          issueDate,
          dueDate,
          currency,
          Number(subtotalScaled),
          Number(totalDiscountScaled),
          Number(totalTaxScaled),
          Number(totalScaled),
          Number(paidAmountScaled),
          docStatus,
          input.notes || null,
          null,
          0,
          now,
          now,
          input.idempotencyKey ? input.idempotencyKey.trim() : null,
          input.paymentType,
          1, // is_pos
          input.cashierName || 'Counter Cashier'
        ]
      );

      // Stage 6 & 7: Insert Document Lines & Record Stock Movements
      let totalCogsScaled = 0n;
      const createdLines: any[] = [];

      for (const line of validatedLines) {
        const lineId = generateEntityId('dline');

        // Insert line item
        await conn.run(
          `INSERT INTO document_lines (
            id, document_id, item_id, description, quantity, unit_price_scaled,
            discount_scaled, tax_rate_percent, tax_scaled, total_scaled,
            package_unit, cost_price_scaled, returned_quantity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lineId,
            docId,
            line.productId,
            line.description,
            line.quantity,
            Number(line.unitPriceScaled),
            Number(line.discountScaled),
            line.taxRatePercent,
            Number(line.taxScaled),
            Number(line.totalScaled),
            line.packageUnit,
            Number(line.unitCostScaled),
            0
          ]
        );

        // Stage 7: Stock Movement (outbound sale_issue)
        const movement = await InventoryService.recordStockMovement(conn, workspaceId, {
          productId: line.productId,
          sourceType: 'sale_issue',
          quantity: -line.canonicalQuantity,
          packageUnit: line.product.unit,
          sourceId: invoiceNumber,
          effectiveDate: issueDate,
          unitCostScaled: line.unitCostScaled,
          reason: `POS Sale: ${invoiceNumber} (${line.description})`
        });

        const lineCogs = BigInt(Math.round(Number(line.unitCostScaled) * Math.abs(line.canonicalQuantity)));
        totalCogsScaled += lineCogs;

        createdLines.push({
          id: lineId,
          itemId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPriceScaled: line.unitPriceScaled,
          discountScaled: line.discountScaled,
          taxRatePercent: line.taxRatePercent,
          taxScaled: line.taxScaled,
          totalScaled: line.totalScaled,
          packageUnit: line.packageUnit,
          costPriceScaled: line.unitCostScaled,
          returnedQuantity: 0,
          stockMovementId: movement.id
        });
      }

      // Stage 8: Insert Payment Records and Allocations
      const createdPayments: PaymentWithAllocations[] = [];

      let effectivePartyId = customer ? customer.id : null;
      if (!effectivePartyId && paymentAllocationsToCreate.length > 0) {
        const walkInParty = await SaleService.getOrCreateWalkInParty(conn, workspaceId);
        effectivePartyId = walkInParty.id;
      }

      for (const payAlloc of paymentAllocationsToCreate) {
        const paymentNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
        const paymentId = generateEntityId('pay');

        await conn.run(
          `INSERT INTO payments (
            id, workspace_id, party_id, payment_number, payment_type, payment_date,
            payment_method, account_id, amount_scaled, allocated_amount_scaled,
            unallocated_amount_scaled, reference_number, notes, is_reversed,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            workspaceId,
            effectivePartyId!,
            paymentNumber,
            'customer_receipt',
            issueDate,
            payAlloc.method,
            payAlloc.accountId,
            Number(payAlloc.amountScaled),
            Number(payAlloc.amountScaled),
            0,
            payAlloc.reference || invoiceNumber,
            payAlloc.notes || null,
            0,
            now,
            now
          ]
        );

        const allocId = generateEntityId('palloc');
        await conn.run(
          `INSERT INTO payment_allocations (
            id, workspace_id, payment_id, document_id, allocated_amount_scaled, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            allocId,
            workspaceId,
            paymentId,
            docId,
            Number(payAlloc.amountScaled),
            now
          ]
        );

        createdPayments.push({
          id: paymentId,
          workspaceId,
          partyId: effectivePartyId!,
          paymentNumber,
          paymentType: 'customer_receipt',
          paymentDate: issueDate,
          paymentMethod: payAlloc.method,
          accountId: payAlloc.accountId,
          amountScaled: payAlloc.amountScaled,
          allocatedAmountScaled: payAlloc.amountScaled,
          unallocatedAmountScaled: 0n,
          referenceNumber: payAlloc.reference || invoiceNumber,
          notes: payAlloc.notes || null,
          isReversed: false,
          createdAt: now,
          updatedAt: now,
          allocations: [{
            id: allocId,
            workspaceId,
            paymentId,
            documentId: docId,
            allocatedAmountScaled: payAlloc.amountScaled,
            createdAt: now
          }]
        });
      }

      // Stage 9: Balanced Double-Entry Journal Entry
      // Debits:
      //   Cash/Bank accounts: paid amount
      //   Accounts Receivable (1200): remaining credit amount
      //   COGS (5010): totalCogsScaled
      // Credits:
      //   Sales Revenue (4010): subtotal - discount
      //   Taxes Payable (2020): taxScaled
      //   Inventory Asset (1300): totalCogsScaled
      const journalLines: Array<{
        accountId: string;
        debitAmountScaled: bigint;
        creditAmountScaled: bigint;
        partyId?: string;
        description?: string;
      }> = [];

      // 1. Paid cash/bank debits
      for (const p of paymentAllocationsToCreate) {
        journalLines.push({
          accountId: p.accountId,
          debitAmountScaled: p.amountScaled,
          creditAmountScaled: 0n,
          description: `Cash/Bank receipt for Invoice ${invoiceNumber}`
        });
      }

      // 2. Remaining receivable debit
      if (remainingBalanceScaled > 0n) {
        journalLines.push({
          accountId: receivableAccount.id,
          debitAmountScaled: remainingBalanceScaled,
          creditAmountScaled: 0n,
          partyId: customer ? customer.id : undefined,
          description: `Receivable from ${customerDisplayName} on Invoice ${invoiceNumber}`
        });
      }

      // 3. COGS debit
      if (totalCogsScaled > 0n) {
        journalLines.push({
          accountId: cogsAccount.id,
          debitAmountScaled: totalCogsScaled,
          creditAmountScaled: 0n,
          description: `COGS for Invoice ${invoiceNumber}`
        });
      }

      // 4. Sales Revenue credit (net of discounts)
      const netRevenue = subtotalScaled - totalDiscountScaled;
      if (netRevenue > 0n) {
        journalLines.push({
          accountId: revenueAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: netRevenue,
          partyId: customer ? customer.id : undefined,
          description: `Sales Revenue from Invoice ${invoiceNumber}`
        });
      }

      // 5. Taxes Payable credit
      if (totalTaxScaled > 0n) {
        journalLines.push({
          accountId: taxAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalTaxScaled,
          description: `Sales Tax on Invoice ${invoiceNumber}`
        });
      }

      // 6. Inventory Asset credit
      if (totalCogsScaled > 0n) {
        journalLines.push({
          accountId: inventoryAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalCogsScaled,
          description: `Inventory reduction for Invoice ${invoiceNumber}`
        });
      }

      const totalDebits = journalLines.reduce((acc, l) => acc + l.debitAmountScaled, 0n);
      const totalCredits = journalLines.reduce((acc, l) => acc + l.creditAmountScaled, 0n);

      if (totalDebits !== totalCredits) {
        throw new Error(
          `Internal Accounting Imbalance: Debits (${totalDebits}) do not equal Credits (${totalCredits}). Transaction rolled back.`
        );
      }

      const jeNumber = `JE-${Date.now().toString().slice(-6)}`;
      const je = await journalRepo.createWithLines(
        {
          workspaceId,
          entryNumber: jeNumber,
          entryDate: issueDate,
          description: `POS Sale: ${invoiceNumber} (${customerDisplayName})`,
          referenceType: 'sales_invoice',
          referenceId: docId,
          sourceType: 'sales_invoice',
          isPosted: true
        },
        journalLines
      );

      // Record in Party Ledger if customer is registered
      if (customer && (remainingBalanceScaled > 0n || paidAmountScaled > 0n)) {
        await ledgerRepo.recordEntry({
          workspaceId,
          partyId: customer.id,
          entryDate: issueDate,
          entryType: 'credit_sale',
          documentId: docId,
          journalEntryId: je.id,
          referenceNumber: invoiceNumber,
          description: `Sale Invoice ${invoiceNumber}`,
          receivableAmountScaled: totalScaled,
          payableAmountScaled: 0n,
          dueDate
        });

        if (paidAmountScaled > 0n) {
          await ledgerRepo.recordEntry({
            workspaceId,
            partyId: customer.id,
            entryDate: issueDate,
            entryType: 'payment_received',
            documentId: docId,
            journalEntryId: je.id,
            referenceNumber: invoiceNumber,
            description: `Payment received for Invoice ${invoiceNumber}`,
            receivableAmountScaled: 0n,
            payableAmountScaled: paidAmountScaled
          });
        }
      }

      const committedDoc: DocumentWithLines = {
        id: docId,
        workspaceId,
        documentType: 'sales_invoice',
        documentNumber: invoiceNumber,
        partyId: customer ? customer.id : null,
        partyName: customerDisplayName,
        issueDate,
        dueDate,
        currencyCode: currency,
        subtotalScaled,
        discountScaled: totalDiscountScaled,
        taxScaled: totalTaxScaled,
        totalScaled,
        paidAmountScaled,
        status: docStatus,
        notes: input.notes || null,
        attachmentRelativePath: null,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        lines: createdLines
      };

      // Stage 12: Receipt Metadata
      const receiptData = {
        businessName: businessProfile.legal_name || 'Retail Mart POS',
        legalName: businessProfile.legal_name,
        taxIdentifier: businessProfile.tax_identifier,
        invoiceNumber,
        date: issueDate,
        cashierName: input.cashierName || 'POS Terminal 1',
        customerName: customerDisplayName,
        currencySymbol: currency === 'PKR' ? '₨' : currency,
        lines: validatedLines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.packageUnit,
          unitPriceScaled: l.unitPriceScaled,
          discountScaled: l.discountScaled,
          taxScaled: l.taxScaled,
          totalScaled: l.totalScaled
        })),
        subtotalScaled,
        discountScaled: totalDiscountScaled,
        taxScaled: totalTaxScaled,
        totalScaled,
        paidAmountScaled,
        changeOrDueScaled: remainingBalanceScaled > 0n ? remainingBalanceScaled : 0n,
        paymentMethod: input.paymentType.replace('_', ' ').toUpperCase()
      };

      // Cryptographic Audit Trail Event
      await auditTrailService.logEvent(conn, {
        workspaceId,
        eventType: 'SALE_POSTED',
        actorId: input.cashierName || 'counter_cashier',
        actorRole: 'cashier',
        sourceEntity: 'document',
        sourceId: docId,
        action: 'POST_SALE',
        summary: `POS Sale posted: ${invoiceNumber} total ${Number(totalScaled) / 10000} ${currency}`,
        details: {
          invoiceNumber,
          customerName: customerDisplayName,
          totalScaled: Number(totalScaled),
          paidAmountScaled: Number(paidAmountScaled),
          linesCount: validatedLines.length
        }
      });

      return {
        document: committedDoc,
        invoiceNumber,
        totalScaled,
        paidAmountScaled,
        remainingBalanceScaled,
        totalCogsScaled,
        payments: createdPayments,
        journalEntryId: je.id,
        isIdempotentReplay: false,
        warnings,
        receiptData
      };
    });
  }

  /**
   * Records a customer sales return and refund atomically.
   * - Validates returned quantities against original sale lines (no over-returns).
   * - Restores stock only for items in resellable condition.
   * - Damaged items are recorded appropriately as damaged waste without returning to sellable inventory.
   * - Reverses revenue, tax, and COGS according to accounting rules.
   * - Refunds customer through cash/bank payment or credits receivable.
   * - Maintains complete historical audit trail without mutating original invoice.
   */
  public static async recordSalesReturn(
    conn: DatabaseConnection,
    workspaceId: string,
    input: RecordSalesReturnInput
  ): Promise<SalesReturnWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const docRepo = new DocumentRepository(conn);
    const salesRepo = new SalesRepository(conn);
    const productRepo = new ProductRepository(conn);
    const accountRepo = new AccountRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);

    const originalDoc = await docRepo.findById(input.originalDocumentId);
    if (!originalDoc || originalDoc.workspaceId !== workspaceId) {
      throw new Error(`Original sales invoice ${input.originalDocumentId} not found.`);
    }

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Sales return must include at least one item line.');
    }

    // Chart of Accounts lookups
    const accounts = await accountRepo.findByWorkspace(workspaceId);
    const cashAccount = accounts.find(a => a.accountCode === '1010' || a.subCategory === 'cash') || accounts.find(a => a.type === 'asset');
    const bankAccount = accounts.find(a => a.accountCode === '1020' || a.subCategory === 'bank') || cashAccount;
    const receivableAccount = accounts.find(a => a.accountCode === '1200' || a.subCategory === 'receivables') || accounts.find(a => a.type === 'asset');
    const inventoryAccount = accounts.find(a => a.accountCode === '1300' || a.subCategory === 'inventory') || accounts.find(a => a.type === 'asset');
    const taxAccount = accounts.find(a => a.accountCode === '2020' || a.subCategory === 'taxes_payable') || accounts.find(a => a.type === 'liability');
    const revenueAccount = accounts.find(a => a.accountCode === '4010' || a.subCategory === 'sales') || accounts.find(a => a.type === 'revenue');
    const cogsAccount = accounts.find(a => a.accountCode === '5010' || a.subCategory === 'cogs') || accounts.find(a => a.type === 'expense');

    if (!cashAccount || !receivableAccount || !inventoryAccount || !taxAccount || !revenueAccount || !cogsAccount) {
      throw new Error('Chart of accounts missing required accounts for sales return processing.');
    }

    const returnNumber = input.returnNumber?.trim() || `SR-${Date.now().toString().slice(-6)}`;

    return await conn.executeTransaction(async () => {
      let subtotalScaled = 0n;
      let taxScaled = 0n;
      let totalCogsReversedScaled = 0n;
      const linesToSave: any[] = [];

      for (const line of input.lines) {
        if (line.returnedQuantity <= 0) {
          throw new Error(`Returned quantity must be greater than zero for "${line.description}".`);
        }

        const origLine = originalDoc.lines.find(l => l.id === line.originalLineId);
        if (!origLine) {
          throw new Error(`Original invoice line ${line.originalLineId} not found in Invoice ${originalDoc.documentNumber}.`);
        }

        // Prevent over-returns
        const alreadyReturned = await salesRepo.getReturnedQuantityForLine(line.originalLineId);
        const maxReturnable = origLine.quantity - alreadyReturned;

        if (line.returnedQuantity > maxReturnable && !input.allowOverReturn) {
          throw new Error(
            `Cannot return ${line.returnedQuantity} of "${line.description}". Original sold: ${origLine.quantity}, already returned: ${alreadyReturned}, maximum returnable: ${maxReturnable}.`
          );
        }

        const product = await productRepo.findById(line.productId);
        if (!product || product.workspaceId !== workspaceId) {
          throw new Error(`Product ${line.productId} not found.`);
        }

        const pkgUnit = line.packageUnit || origLine.packageUnit || product.unit;
        let canonicalQuantity = line.returnedQuantity;

        if (pkgUnit.toLowerCase() !== product.unit.toLowerCase()) {
          const conversions = await productRepo.findUnitConversionsByProductId(product.id);
          const match = conversions.find(c => c.unitName.toLowerCase() === pkgUnit.toLowerCase());
          if (match) {
            canonicalQuantity = line.returnedQuantity * match.conversionFactor;
          } else {
            canonicalQuantity = line.returnedQuantity * convertStandardUnit(1, pkgUnit, product.unit);
          }
        }

        const unitPrice = origLine.unitPriceScaled;
        const lineSubtotal = BigInt(Math.round(line.returnedQuantity * Number(unitPrice)));
        const rate = origLine.taxRatePercent || 0;
        const lineTax = BigInt(Math.round(Number(lineSubtotal) * (rate / 100)));
        const lineTotal = lineSubtotal + lineTax;

        subtotalScaled += lineSubtotal;
        taxScaled += lineTax;

        const unitCost = origLine.costPriceScaled || product.weightedAvgCostScaled;
        let stockMovementId: string | null = null;

        // Restore stock ONLY for items in resellable condition
        if (line.itemCondition === 'resellable') {
          const movement = await InventoryService.recordStockMovement(conn, workspaceId, {
            productId: product.id,
            sourceType: 'sales_return',
            quantity: canonicalQuantity, // Positive delta restores stock on hand
            packageUnit: product.unit,
            sourceId: returnNumber,
            effectiveDate: input.returnDate,
            unitCostScaled: unitCost,
            reason: `Customer Return ${returnNumber} on Invoice ${originalDoc.documentNumber}: ${input.reason}`
          });
          stockMovementId = movement.id;
          totalCogsReversedScaled += BigInt(Math.round(Number(unitCost) * canonicalQuantity));
        } else {
          // Damaged or scrap item: does not restore sellable inventory
          stockMovementId = null;
        }

        linesToSave.push({
          originalLineId: line.originalLineId,
          productId: line.productId,
          description: line.description,
          returnedQuantity: line.returnedQuantity,
          packageUnit: pkgUnit,
          canonicalQuantity,
          unitPriceScaled: unitPrice,
          unitCostScaled: unitCost,
          taxRatePercent: rate,
          taxScaled: lineTax,
          totalScaled: lineTotal,
          itemCondition: line.itemCondition,
          stockMovementId,
          notes: line.notes || null
        });
      }

      const totalReturnScaled = subtotalScaled + taxScaled;

      // Settlement and payment refund
      let paymentId: string | null = null;
      let targetRefundAccount = cashAccount;

      if (input.settlementType === 'bank_refund') {
        targetRefundAccount = input.refundAccountId
          ? accounts.find(a => a.id === input.refundAccountId) || bankAccount || cashAccount
          : bankAccount || cashAccount;
      } else if (input.settlementType === 'cash_refund') {
        targetRefundAccount = input.refundAccountId
          ? accounts.find(a => a.id === input.refundAccountId) || cashAccount
          : cashAccount;
      }

      const now = new Date().toISOString();

      if (input.settlementType === 'cash_refund' || input.settlementType === 'bank_refund') {
        paymentId = generateEntityId('pay');
        const refundPaymentNumber = `REF-${Date.now().toString().slice(-6)}`;

        let refundPartyId = originalDoc.partyId;
        if (!refundPartyId) {
          const walkInParty = await SaleService.getOrCreateWalkInParty(conn, workspaceId);
          refundPartyId = walkInParty.id;
        }

        await conn.run(
          `INSERT INTO payments (
            id, workspace_id, party_id, payment_number, payment_type, payment_date,
            payment_method, account_id, amount_scaled, allocated_amount_scaled,
            unallocated_amount_scaled, reference_number, notes, is_reversed,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            workspaceId,
            refundPartyId,
            refundPaymentNumber,
            'customer_refund',
            input.returnDate,
            input.settlementType === 'bank_refund' ? 'bank' : 'cash',
            targetRefundAccount.id,
            Number(totalReturnScaled),
            Number(totalReturnScaled),
            0,
            returnNumber,
            `Refund for Return ${returnNumber} on Invoice ${originalDoc.documentNumber}`,
            0,
            now,
            now
          ]
        );
      }

      // Balanced Double-Entry Journal Entry:
      // Debits:
      //   Sales Revenue (4010): subtotal return
      //   Taxes Payable (2020): tax return
      //   Inventory Asset (1300): totalCogsReversedScaled (if resellable)
      // Credits:
      //   Cash/Bank (if cash/bank refund) OR Accounts Receivable (if receivable credit)
      //   COGS (5010): totalCogsReversedScaled (if resellable)
      const journalLines: Array<{
        accountId: string;
        debitAmountScaled: bigint;
        creditAmountScaled: bigint;
        partyId?: string;
        description?: string;
      }> = [];

      // 1. Debit Sales Revenue (reversing revenue)
      if (subtotalScaled > 0n) {
        journalLines.push({
          accountId: revenueAccount.id,
          debitAmountScaled: subtotalScaled,
          creditAmountScaled: 0n,
          partyId: originalDoc.partyId || undefined,
          description: `Sales Return ${returnNumber} - Reversal of Revenue`
        });
      }

      // 2. Debit Taxes Payable (reversing tax liability)
      if (taxScaled > 0n) {
        journalLines.push({
          accountId: taxAccount.id,
          debitAmountScaled: taxScaled,
          creditAmountScaled: 0n,
          description: `Sales Return ${returnNumber} - Tax Credit`
        });
      }

      // 3. Credit Cash/Bank (refund) OR Credit Accounts Receivable
      if (input.settlementType === 'cash_refund' || input.settlementType === 'bank_refund') {
        journalLines.push({
          accountId: targetRefundAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalReturnScaled,
          description: `Cash/Bank Refund to customer for Return ${returnNumber}`
        });
      } else {
        // Receivable credit or store credit
        journalLines.push({
          accountId: receivableAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalReturnScaled,
          partyId: originalDoc.partyId || undefined,
          description: `Credit Note / A/R reduction for Return ${returnNumber}`
        });
      }

      // 4. Resellable inventory COGS restoration
      if (totalCogsReversedScaled > 0n) {
        journalLines.push({
          accountId: inventoryAccount.id,
          debitAmountScaled: totalCogsReversedScaled,
          creditAmountScaled: 0n,
          description: `Inventory restored from Return ${returnNumber}`
        });
        journalLines.push({
          accountId: cogsAccount.id,
          debitAmountScaled: 0n,
          creditAmountScaled: totalCogsReversedScaled,
          description: `COGS reversed from Return ${returnNumber}`
        });
      }

      const totalDebits = journalLines.reduce((acc, l) => acc + l.debitAmountScaled, 0n);
      const totalCredits = journalLines.reduce((acc, l) => acc + l.creditAmountScaled, 0n);

      if (totalDebits !== totalCredits) {
        throw new Error(
          `Accounting imbalance on return: Debits (${totalDebits}) do not equal Credits (${totalCredits}).`
        );
      }

      const jeNumber = `JE-RET-${Date.now().toString().slice(-6)}`;
      const je = await journalRepo.createWithLines(
        {
          workspaceId,
          entryNumber: jeNumber,
          entryDate: input.returnDate,
          description: `Sales Return: ${returnNumber} on Invoice ${originalDoc.documentNumber}`,
          referenceType: 'sales_return',
          referenceId: originalDoc.id,
          sourceType: 'sales_return',
          isPosted: true
        },
        journalLines
      );

      // Record in Party Ledger if customer is registered and receivable credit
      if (originalDoc.partyId && (input.settlementType === 'receivable_credit' || input.settlementType === 'store_credit')) {
        await ledgerRepo.recordEntry({
          workspaceId,
          partyId: originalDoc.partyId,
          entryDate: input.returnDate,
          entryType: 'sales_return',
          documentId: originalDoc.id,
          journalEntryId: je.id,
          referenceNumber: returnNumber,
          description: `Credit Note for Return ${returnNumber} on Invoice ${originalDoc.documentNumber}`,
          receivableAmountScaled: 0n,
          payableAmountScaled: totalReturnScaled // reduces customer's receivable balance
        });
      }

      // Create sales return record and lines
      const createdReturn = await salesRepo.createSalesReturn(
        {
          workspaceId,
          returnNumber,
          originalDocumentId: originalDoc.id,
          partyId: originalDoc.partyId,
          partyName: originalDoc.partyName,
          returnDate: input.returnDate,
          subtotalScaled,
          taxScaled,
          totalScaled: totalReturnScaled,
          refundAmountScaled: totalReturnScaled,
          settlementType: input.settlementType,
          refundAccountId: targetRefundAccount.id,
          paymentId,
          journalEntryId: je.id,
          reason: input.reason,
          notes: input.notes
        },
        linesToSave
      );

      // Cryptographic Audit Trail Event
      await auditTrailService.logEvent(conn, {
        workspaceId,
        eventType: 'SALES_RETURN_POSTED',
        actorId: 'counter_cashier',
        actorRole: 'cashier',
        sourceEntity: 'sales_return',
        sourceId: createdReturn.id,
        action: 'REVERSE_DOCUMENT',
        summary: `Sales Return processed: ${returnNumber} total ${Number(totalReturnScaled) / 10000}`,
        details: {
          returnNumber,
          originalDocumentId: originalDoc.id,
          totalScaled: Number(totalReturnScaled),
          reason: input.reason
        }
      });

      return createdReturn;
    });
  }

  /**
   * Fast indexed product search by name, SKU, or barcode for the POS terminal.
   */
  public static async searchProductsForPOS(
    conn: DatabaseConnection,
    workspaceId: string,
    query: string
  ): Promise<Array<ProductRecord & { barcode?: string }>> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    const productRepo = new ProductRepository(conn);
    const trimmed = query?.trim() || '';

    if (!trimmed) {
      const rows = await conn.query<any>(
        `SELECT * FROM products WHERE workspace_id = ? AND is_archived = 0 ORDER BY name ASC LIMIT 30`,
        [workspaceId]
      );
      return rows.map(r => productRepo.mapRow(r));
    }

    const q = `%${trimmed}%`;
    const rows = await conn.query<any>(
      `SELECT DISTINCT p.* 
       FROM products p
       LEFT JOIN product_barcodes b ON b.product_id = p.id
       WHERE p.workspace_id = ? 
         AND p.is_archived = 0
         AND (
           p.name LIKE ? 
           OR p.sku LIKE ? 
           OR p.barcode LIKE ? 
           OR b.barcode LIKE ?
           OR b.normalized_barcode = ?
         )
       ORDER BY p.name ASC 
       LIMIT 30`,
      [workspaceId, q, q, q, q, trimmed.toUpperCase()]
    );

    return rows.map(r => productRepo.mapRow(r));
  }

  /**
   * Retrieves sales documents with filters and pagination.
   */
  public static async getSalesDocuments(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: SalesDocumentFilter
  ): Promise<{ documents: DocumentWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    const repo = new SalesRepository(conn);
    return await repo.findSalesDocuments(workspaceId, filter);
  }

  /**
   * Retrieves sales returns for a workspace.
   */
  public static async getSalesReturns(
    conn: DatabaseConnection,
    workspaceId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ returns: SalesReturnWithLines[]; total: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    const repo = new SalesRepository(conn);
    return await repo.findSalesReturns(workspaceId, options);
  }

  /**
   * Retrieves or creates the system default "Walk-in Customer" party for retail cash sales.
   */
  public static async getOrCreateWalkInParty(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<PartyRecord> {
    const partyRepo = new PartyRepository(conn);
    const existing = await partyRepo.findByWorkspace(workspaceId);
    const walkIn = existing.find(
      p => p.name.trim().toLowerCase() === 'walk-in customer' && (p.type === 'customer' || p.type === 'both')
    );
    if (walkIn) return walkIn;

    return await partyRepo.create({
      workspaceId,
      name: 'Walk-in Customer',
      type: 'customer',
      notes: 'Standard walk-in customer for retail counter sales',
      isActive: true,
      currencyCode: 'PKR',
      creditLimitScaled: 0n,
      openingBalanceScaled: 0n,
      openingBalanceType: 'zero'
    });
  }
}

