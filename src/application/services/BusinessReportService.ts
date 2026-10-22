/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { WorkspaceService } from './WorkspaceService';
import { AccountRepository, AccountBalanceResult } from '../../infrastructure/database/repositories/AccountRepository';
import { PartyLedgerRepository, PartyStatementResult } from '../../infrastructure/database/repositories/PartyLedgerRepository';

// --- Types for Reports ---

export interface DaybookEntry {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  partyName?: string;
  inflowScaled: bigint;  // Debit to cash/bank
  outflowScaled: bigint; // Credit to cash/bank
  runningBalanceScaled: bigint;
}

export interface DaybookReportResult {
  startDate: string;
  endDate: string;
  openingBalanceScaled: bigint;
  totalInflowScaled: bigint;
  totalOutflowScaled: bigint;
  closingBalanceScaled: bigint;
  entries: DaybookEntry[];
  totalCount: number;
}

export interface SalesReportLine {
  documentId: string;
  documentNumber: string;
  date: string;
  partyId?: string;
  partyName: string;
  status: string;
  isPos: boolean;
  itemCount: number;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  remainingDueScaled: bigint;
}

export interface SalesReportResult {
  totalGrossSalesScaled: bigint;
  totalDiscountScaled: bigint;
  totalTaxScaled: bigint;
  totalNetSalesScaled: bigint;
  totalPaidScaled: bigint;
  totalReceivablesScaled: bigint;
  totalReturnsScaled: bigint;
  invoices: SalesReportLine[];
  totalCount: number;
}

export interface PurchasesReportLine {
  billId: string;
  billNumber: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  status: string;
  itemCount: number;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  remainingDueScaled: bigint;
}

export interface PurchasesReportResult {
  totalGrossPurchasesScaled: bigint;
  totalDiscountScaled: bigint;
  totalTaxScaled: bigint;
  totalNetPurchasesScaled: bigint;
  totalPaidScaled: bigint;
  totalPayablesScaled: bigint;
  totalReturnsScaled: bigint;
  bills: PurchasesReportLine[];
  totalCount: number;
}

export interface CustomerAgingBucket {
  partyId: string;
  partyName: string;
  phone?: string;
  currentScaled: bigint;       // 0 - 30 days
  days31To60Scaled: bigint;    // 31 - 60 days
  days61To90Scaled: bigint;    // 61 - 90 days
  over90DaysScaled: bigint;    // 90+ days
  totalDueScaled: bigint;
  overdueInvoicesCount: number;
  invoices: Array<{
    documentId: string;
    documentNumber: string;
    issueDate: string;
    dueDate: string;
    daysOverdue: number;
    totalScaled: bigint;
    paidScaled: bigint;
    balanceDueScaled: bigint;
  }>;
}

export interface CustomerAgingReportResult {
  asOfDate: string;
  totalReceivableAgingScaled: bigint;
  controlAccountReceivableScaled: bigint;
  isReconciled: boolean;
  discrepancyScaled: bigint;
  customers: CustomerAgingBucket[];
}

export interface SupplierDueItem {
  partyId: string;
  partyName: string;
  billId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  totalScaled: bigint;
  paidScaled: bigint;
  dueAmountScaled: bigint;
}

export interface SupplierDuesReportResult {
  asOfDate: string;
  totalDueScaled: bigint;
  controlAccountPayableScaled: bigint;
  isReconciled: boolean;
  discrepancyScaled: bigint;
  suppliers: Array<{
    partyId: string;
    partyName: string;
    totalDueScaled: bigint;
    overdueDueScaled: bigint;
    bills: SupplierDueItem[];
  }>;
}

export interface StockOnHandItem {
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  isLowStock: boolean;
  costPriceScaled: bigint;
  salePriceScaled: bigint;
}

export interface InventoryValuationItem {
  productId: string;
  productName: string;
  sku?: string;
  unit: string;
  currentStock: number;
  weightedAvgCostScaled: bigint;
  totalValuationScaled: bigint;
}

export interface InventoryValuationReportResult {
  asOfDate: string;
  totalValuationScaled: bigint;
  controlAccountInventoryScaled: bigint;
  isReconciled: boolean;
  discrepancyScaled: bigint;
  items: InventoryValuationItem[];
}

export interface LowStockAlertItem {
  productId: string;
  productName: string;
  sku?: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  deficitQuantity: number;
  costPriceScaled: bigint;
  estimatedReorderCostScaled: bigint;
  defaultSupplierId?: string;
}

export interface GrossProfitReportResult {
  startDate: string;
  endDate: string;
  grossSalesScaled: bigint;
  salesDiscountsScaled: bigint;
  salesReturnsScaled: bigint;
  netSalesScaled: bigint;
  cogsScaled: bigint;
  cogsReturnsReversedScaled: bigint;
  netCogsScaled: bigint;
  grossProfitScaled: bigint;
  grossProfitMarginPercent: number;
}

export interface ProfitAndLossReportResult {
  startDate: string;
  endDate: string;
  revenue: {
    salesRevenueScaled: bigint;
    otherIncomeScaled: bigint;
    salesReturnsDeductionScaled: bigint;
    totalRevenueScaled: bigint;
  };
  cogs: {
    inventoryCogsScaled: bigint;
    cogsReturnsReversedScaled: bigint;
    netCogsScaled: bigint;
  };
  grossProfitScaled: bigint;
  operatingExpenses: Array<{
    accountId: string;
    accountCode: string;
    name: string;
    amountScaled: bigint;
  }>;
  totalOperatingExpensesScaled: bigint;
  netOperatingIncomeScaled: bigint;
  netProfitOrLossScaled: bigint;
}

export interface CashBankSummaryItem {
  accountId: string;
  accountCode: string;
  name: string;
  subCategory: 'cash' | 'bank';
  openingBalanceScaled: bigint;
  totalDebitScaled: bigint;  // Inflows
  totalCreditScaled: bigint; // Outflows
  closingBalanceScaled: bigint;
}

export interface TrialBalanceReportResult {
  asOfDate: string;
  balances: AccountBalanceResult[];
  totalDebitsScaled: bigint;
  totalCreditsScaled: bigint;
  isBalanced: boolean;
}

export interface BalanceSheetReportResult {
  asOfDate: string;
  assets: {
    currentAssets: Array<{ accountCode: string; name: string; balanceScaled: bigint }>;
    totalCurrentAssetsScaled: bigint;
    nonCurrentAssets: Array<{ accountCode: string; name: string; balanceScaled: bigint }>;
    totalNonCurrentAssetsScaled: bigint;
    totalAssetsScaled: bigint;
  };
  liabilities: {
    currentLiabilities: Array<{ accountCode: string; name: string; balanceScaled: bigint }>;
    totalCurrentLiabilitiesScaled: bigint;
    longTermLiabilities: Array<{ accountCode: string; name: string; balanceScaled: bigint }>;
    totalLongTermLiabilitiesScaled: bigint;
    totalLiabilitiesScaled: bigint;
  };
  equity: {
    capitalScaled: bigint;
    drawingsScaled: bigint;
    retainedEarningsScaled: bigint;
    currentPeriodEarningsScaled: bigint;
    totalEquityScaled: bigint;
  };
  totalLiabilitiesAndEquityScaled: bigint;
  isBalanced: boolean;
  imbalanceScaled: bigint;
}

export interface AuditHistoryLogItem {
  id: string;
  timestamp: string;
  type: string;
  referenceNumber: string;
  actor: string;
  description: string;
  amountScaled?: bigint;
  isReversal: boolean;
}

export interface WhatsAppReminderDetails {
  customerName: string;
  phone: string;
  verifiedBalanceScaled: bigint;
  currencySymbol: string;
  invoices: Array<{
    invoiceNumber: string;
    dueDate: string;
    dueAmountScaled: bigint;
  }>;
  messageText: string;
  whatsappUrl: string;
  disclosure: string;
}

export class BusinessReportService {
  /**
   * 1. Daybook: Cash and Bank inflows and outflows for a selected period.
   * Derived strictly from posted double-entry journal lines.
   */
  public static async getDaybook(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
  ): Promise<DaybookReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const startDate = filter.startDate || '1970-01-01';
    const endDate = filter.endDate || '2099-12-31';
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 20);
    const offset = (page - 1) * pageSize;

    // 1. Calculate opening balance before startDate for all cash & bank accounts
    const openingRows = await conn.query<{ net_opening: number | null }>(
      `SELECT SUM(jl.debit_amount_scaled - jl.credit_amount_scaled) as net_opening
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       WHERE je.workspace_id = ?
         AND (je.is_posted = 1 OR je.status = 'posted')
         AND (a.account_code LIKE '101%' OR a.account_code LIKE '102%' OR a.sub_category IN ('cash', 'bank'))
         AND je.entry_date < ?`,
      [workspaceId, startDate]
    );
    const openingBalanceScaled = BigInt(openingRows[0]?.net_opening || 0);

    // 2. Count period entries
    const countRows = await conn.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       WHERE je.workspace_id = ?
         AND (je.is_posted = 1 OR je.status = 'posted')
         AND (a.account_code LIKE '101%' OR a.account_code LIKE '102%' OR a.sub_category IN ('cash', 'bank'))
         AND je.entry_date >= ? AND je.entry_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const totalCount = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

    // 3. Query period entries ordered by entry_date, entry_number
    const rows = await conn.query<any>(
      `SELECT jl.id, jl.journal_entry_id, je.entry_number, je.entry_date, je.description as entry_desc,
              jl.account_id, a.account_code, a.name as account_name,
              jl.debit_amount_scaled, jl.credit_amount_scaled, jl.description as line_desc,
              p.name as party_name
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       LEFT JOIN parties p ON jl.party_id = p.id
       WHERE je.workspace_id = ?
         AND (je.is_posted = 1 OR je.status = 'posted')
         AND (a.account_code LIKE '101%' OR a.account_code LIKE '102%' OR a.sub_category IN ('cash', 'bank'))
         AND je.entry_date >= ? AND je.entry_date <= ?
       ORDER BY je.entry_date ASC, je.entry_number ASC, jl.id ASC
       LIMIT ? OFFSET ?`,
      [workspaceId, startDate, endDate, pageSize, offset]
    );

    let running = openingBalanceScaled;
    let totalInflowScaled = 0n;
    let totalOutflowScaled = 0n;

    const entries: DaybookEntry[] = [];
    for (const r of rows) {
      const debit = BigInt(r.debit_amount_scaled || 0);
      const credit = BigInt(r.credit_amount_scaled || 0);
      totalInflowScaled += debit;
      totalOutflowScaled += credit;
      running += (debit - credit);

      entries.push({
        journalEntryId: r.journal_entry_id,
        entryNumber: r.entry_number,
        entryDate: r.entry_date,
        accountId: r.account_id,
        accountCode: r.account_code,
        accountName: r.account_name,
        description: r.line_desc || r.entry_desc,
        partyName: r.party_name || undefined,
        inflowScaled: debit,
        outflowScaled: credit,
        runningBalanceScaled: running
      });
    }

    // 4. Calculate period closing balance
    const periodClosingRows = await conn.query<{ net_closing: number | null }>(
      `SELECT SUM(jl.debit_amount_scaled - jl.credit_amount_scaled) as net_closing
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       WHERE je.workspace_id = ?
         AND (je.is_posted = 1 OR je.status = 'posted')
         AND (a.account_code LIKE '101%' OR a.account_code LIKE '102%' OR a.sub_category IN ('cash', 'bank'))
         AND je.entry_date <= ?`,
      [workspaceId, endDate]
    );
    const closingBalanceScaled = BigInt(periodClosingRows[0]?.net_closing || 0);

    return {
      startDate,
      endDate,
      openingBalanceScaled,
      totalInflowScaled,
      totalOutflowScaled,
      closingBalanceScaled,
      entries,
      totalCount
    };
  }

  /**
   * 2. Sales Report: Posted sales by date, product, customer and status.
   * Excludes drafts and voided documents, accounts for discounts, taxes, and sales returns.
   */
  public static async getSalesReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: {
      startDate?: string;
      endDate?: string;
      customerId?: string;
      productId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<SalesReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const conditions: string[] = ["d.workspace_id = ?", "d.document_type = 'sales_invoice'", "d.is_archived = 0", "d.status != 'draft'"];
    const params: any[] = [workspaceId];

    if (filter.startDate) {
      conditions.push("d.issue_date >= ?");
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push("d.issue_date <= ?");
      params.push(filter.endDate);
    }
    if (filter.customerId) {
      conditions.push("d.party_id = ?");
      params.push(filter.customerId);
    }
    if (filter.status && filter.status !== 'all') {
      conditions.push("d.status = ?");
      params.push(filter.status);
    }
    if (filter.productId) {
      conditions.push("EXISTS (SELECT 1 FROM document_lines dl WHERE dl.document_id = d.id AND dl.item_id = ?)");
      params.push(filter.productId);
    }

    const whereClause = conditions.join(" AND ");

    // Aggregates
    const aggRows = await conn.query<any>(
      `SELECT 
         COUNT(*) as total_count,
         SUM(subtotal_scaled) as gross_sales,
         SUM(discount_scaled) as discounts,
         SUM(tax_scaled) as taxes,
         SUM(total_scaled) as net_sales,
         SUM(paid_amount_scaled) as paid_amount
       FROM documents d
       WHERE ${whereClause}`,
      params
    );

    const totalCount = aggRows[0]?.total_count ? Number(aggRows[0].total_count) : 0;
    const totalGrossSalesScaled = BigInt(aggRows[0]?.gross_sales || 0);
    const totalDiscountScaled = BigInt(aggRows[0]?.discounts || 0);
    const totalTaxScaled = BigInt(aggRows[0]?.taxes || 0);
    const totalNetSalesScaled = BigInt(aggRows[0]?.net_sales || 0);
    const totalPaidScaled = BigInt(aggRows[0]?.paid_amount || 0);
    const totalReceivablesScaled = totalNetSalesScaled - totalPaidScaled;

    // Sales Returns within date range
    const retConditions: string[] = ["workspace_id = ?"];
    const retParams: any[] = [workspaceId];
    if (filter.startDate) {
      retConditions.push("return_date >= ?");
      retParams.push(filter.startDate);
    }
    if (filter.endDate) {
      retConditions.push("return_date <= ?");
      retParams.push(filter.endDate);
    }
    const retRows = await conn.query<{ ret_total: number | null }>(
      `SELECT SUM(total_scaled) as ret_total FROM sales_returns WHERE ${retConditions.join(" AND ")}`,
      retParams
    );
    const totalReturnsScaled = BigInt(retRows[0]?.ret_total || 0);

    // Pagination
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 15);
    const offset = (page - 1) * pageSize;

    const docRows = await conn.query<any>(
      `SELECT d.id, d.document_number, d.issue_date, d.party_id, d.party_name, d.status,
              d.is_pos, d.subtotal_scaled, d.discount_scaled, d.tax_scaled, d.total_scaled,
              d.paid_amount_scaled,
              (SELECT COUNT(*) FROM document_lines dl WHERE dl.document_id = d.id) as item_count
       FROM documents d
       WHERE ${whereClause}
       ORDER BY d.issue_date DESC, d.document_number DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const invoices: SalesReportLine[] = docRows.map(r => {
      const tot = BigInt(r.total_scaled || 0);
      const paid = BigInt(r.paid_amount_scaled || 0);
      return {
        documentId: r.id,
        documentNumber: r.document_number,
        date: r.issue_date,
        partyId: r.party_id || undefined,
        partyName: r.party_name || 'Walk-in Cash Customer',
        status: r.status,
        isPos: Boolean(r.is_pos),
        itemCount: Number(r.item_count || 0),
        subtotalScaled: BigInt(r.subtotal_scaled || 0),
        discountScaled: BigInt(r.discount_scaled || 0),
        taxScaled: BigInt(r.tax_scaled || 0),
        totalScaled: tot,
        paidAmountScaled: paid,
        remainingDueScaled: tot - paid
      };
    });

    return {
      totalGrossSalesScaled,
      totalDiscountScaled,
      totalTaxScaled,
      totalNetSalesScaled,
      totalPaidScaled,
      totalReceivablesScaled,
      totalReturnsScaled,
      invoices,
      totalCount
    };
  }

  /**
   * 3. Purchases Report: Purchases by date, supplier and product.
   */
  public static async getPurchasesReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: {
      startDate?: string;
      endDate?: string;
      supplierId?: string;
      productId?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<PurchasesReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const conditions: string[] = ["pb.workspace_id = ?", "pb.posting_status = 'posted'"];
    const params: any[] = [workspaceId];

    if (filter.startDate) {
      conditions.push("pb.bill_date >= ?");
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push("pb.bill_date <= ?");
      params.push(filter.endDate);
    }
    if (filter.supplierId) {
      conditions.push("pb.supplier_id = ?");
      params.push(filter.supplierId);
    }
    if (filter.productId) {
      conditions.push("EXISTS (SELECT 1 FROM purchase_bill_lines pbl WHERE pbl.bill_id = pb.id AND pbl.product_id = ?)");
      params.push(filter.productId);
    }

    const whereClause = conditions.join(" AND ");

    const aggRows = await conn.query<any>(
      `SELECT 
         COUNT(*) as total_count,
         SUM(subtotal_scaled) as gross_purchases,
         SUM(discount_scaled) as discounts,
         SUM(tax_scaled) as taxes,
         SUM(total_scaled) as net_purchases,
         SUM(paid_amount_scaled) as paid_amount
       FROM purchase_bills pb
       WHERE ${whereClause}`,
      params
    );

    const totalCount = aggRows[0]?.total_count ? Number(aggRows[0].total_count) : 0;
    const totalGrossPurchasesScaled = BigInt(aggRows[0]?.gross_purchases || 0);
    const totalDiscountScaled = BigInt(aggRows[0]?.discounts || 0);
    const totalTaxScaled = BigInt(aggRows[0]?.taxes || 0);
    const totalNetPurchasesScaled = BigInt(aggRows[0]?.net_purchases || 0);
    const totalPaidScaled = BigInt(aggRows[0]?.paid_amount || 0);
    const totalPayablesScaled = totalNetPurchasesScaled - totalPaidScaled;

    // Purchase Returns
    const retConditions: string[] = ["workspace_id = ?"];
    const retParams: any[] = [workspaceId];
    if (filter.startDate) {
      retConditions.push("return_date >= ?");
      retParams.push(filter.startDate);
    }
    if (filter.endDate) {
      retConditions.push("return_date <= ?");
      retParams.push(filter.endDate);
    }
    const retRows = await conn.query<{ ret_total: number | null }>(
      `SELECT SUM(total_scaled) as ret_total FROM purchase_returns WHERE ${retConditions.join(" AND ")}`,
      retParams
    );
    const totalReturnsScaled = BigInt(retRows[0]?.ret_total || 0);

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 15);
    const offset = (page - 1) * pageSize;

    const billRows = await conn.query<any>(
      `SELECT pb.id, pb.bill_number, pb.bill_date, pb.supplier_id, pb.supplier_name, pb.payment_status as status,
              pb.subtotal_scaled, pb.discount_scaled, pb.tax_scaled, pb.total_scaled,
              pb.paid_amount_scaled,
              (SELECT COUNT(*) FROM purchase_bill_lines pbl WHERE pbl.bill_id = pb.id) as item_count
       FROM purchase_bills pb
       WHERE ${whereClause}
       ORDER BY pb.bill_date DESC, pb.bill_number DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const bills: PurchasesReportLine[] = billRows.map(r => {
      const tot = BigInt(r.total_scaled || 0);
      const paid = BigInt(r.paid_amount_scaled || 0);
      return {
        billId: r.id,
        billNumber: r.bill_number,
        date: r.bill_date,
        supplierId: r.supplier_id || undefined,
        supplierName: r.supplier_name,
        status: r.status,
        itemCount: Number(r.item_count || 0),
        subtotalScaled: BigInt(r.subtotal_scaled || 0),
        discountScaled: BigInt(r.discount_scaled || 0),
        taxScaled: BigInt(r.tax_scaled || 0),
        totalScaled: tot,
        paidAmountScaled: paid,
        remainingDueScaled: tot - paid
      };
    });

    return {
      totalGrossPurchasesScaled,
      totalDiscountScaled,
      totalTaxScaled,
      totalNetPurchasesScaled,
      totalPaidScaled,
      totalPayablesScaled,
      totalReturnsScaled,
      bills,
      totalCount
    };
  }

  /**
   * 4. Customer Aging Report: Current and overdue receivables grouped by configurable age buckets.
   * Defines age buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days based on invoice due dates.
   * Reconciles total aging to Accounts Receivable control account (1200).
   */
  public static async getCustomerAgingReport(
    conn: DatabaseConnection,
    workspaceId: string,
    asOfDate?: string
  ): Promise<CustomerAgingReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const targetMs = new Date(effectiveDate).getTime();

    // 1. Fetch all unpaid and partially paid sales invoices with valid registered party
    const docRows = await conn.query<any>(
      `SELECT d.id, d.document_number, d.party_id, p.name as party_name, p.phone,
              d.issue_date, d.due_date, d.total_scaled, d.paid_amount_scaled
       FROM documents d
       JOIN parties p ON d.party_id = p.id
       WHERE d.workspace_id = ?
         AND d.document_type = 'sales_invoice'
         AND d.is_archived = 0
         AND d.status IN ('unpaid', 'partial')
         AND d.total_scaled > d.paid_amount_scaled
       ORDER BY p.name ASC, d.due_date ASC`,
      [workspaceId]
    );

    const customerMap = new Map<string, CustomerAgingBucket>();

    for (const r of docRows) {
      const partyId = r.party_id;
      const total = BigInt(r.total_scaled || 0);
      const paid = BigInt(r.paid_amount_scaled || 0);
      const balanceDue = total - paid;
      if (balanceDue <= 0n) continue;

      const dueMs = new Date(r.due_date || r.issue_date).getTime();
      const diffDays = Math.floor((targetMs - dueMs) / (1000 * 60 * 60 * 24));

      if (!customerMap.has(partyId)) {
        customerMap.set(partyId, {
          partyId,
          partyName: r.party_name,
          phone: r.phone || undefined,
          currentScaled: 0n,
          days31To60Scaled: 0n,
          days61To90Scaled: 0n,
          over90DaysScaled: 0n,
          totalDueScaled: 0n,
          overdueInvoicesCount: 0,
          invoices: []
        });
      }

      const bucket = customerMap.get(partyId)!;
      bucket.totalDueScaled += balanceDue;

      if (diffDays <= 30) {
        bucket.currentScaled += balanceDue;
      } else if (diffDays <= 60) {
        bucket.days31To60Scaled += balanceDue;
        bucket.overdueInvoicesCount++;
      } else if (diffDays <= 90) {
        bucket.days61To90Scaled += balanceDue;
        bucket.overdueInvoicesCount++;
      } else {
        bucket.over90DaysScaled += balanceDue;
        bucket.overdueInvoicesCount++;
      }

      bucket.invoices.push({
        documentId: r.id,
        documentNumber: r.document_number,
        issueDate: r.issue_date,
        dueDate: r.due_date,
        daysOverdue: Math.max(0, diffDays),
        totalScaled: total,
        paidScaled: paid,
        balanceDueScaled: balanceDue
      });
    }

    const customers = Array.from(customerMap.values());
    const totalReceivableAgingScaled = customers.reduce((acc, c) => acc + c.totalDueScaled, 0n);

    // 2. Control account reconciliation (Accounts Receivable 1200)
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const arAcc = accounts.find(a => a.accountCode === '1200' || a.subCategory === 'receivables');
    let controlAccountReceivableScaled = 0n;

    if (arAcc) {
      const arBal = await accRepo.getAccountBalance(workspaceId, arAcc.id);
      controlAccountReceivableScaled = arBal?.netBalanceScaled || 0n;
    }

    const discrepancyScaled = totalReceivableAgingScaled - controlAccountReceivableScaled;
    const isReconciled = discrepancyScaled === 0n;

    return {
      asOfDate: effectiveDate,
      totalReceivableAgingScaled,
      controlAccountReceivableScaled,
      isReconciled,
      discrepancyScaled,
      customers
    };
  }

  /**
   * 5. Supplier Dues Report: Amounts payable by supplier and due date.
   * Reconciles to Accounts Payable control account (2010).
   */
  public static async getSupplierDuesReport(
    conn: DatabaseConnection,
    workspaceId: string,
    asOfDate?: string
  ): Promise<SupplierDuesReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const targetMs = new Date(effectiveDate).getTime();

    const billRows = await conn.query<any>(
      `SELECT pb.id, pb.bill_number, pb.supplier_id, pb.supplier_name, pb.bill_date, pb.due_date,
              pb.total_scaled, pb.paid_amount_scaled
       FROM purchase_bills pb
       WHERE pb.workspace_id = ?
         AND pb.posting_status = 'posted'
         AND pb.payment_status IN ('unpaid', 'partially_paid')
         AND pb.total_scaled > pb.paid_amount_scaled
       ORDER BY pb.supplier_name ASC, pb.due_date ASC`,
      [workspaceId]
    );

    const supplierMap = new Map<string, {
      partyId: string;
      partyName: string;
      totalDueScaled: bigint;
      overdueDueScaled: bigint;
      bills: SupplierDueItem[];
    }>();

    for (const r of billRows) {
      const partyId = r.supplier_id || 'unknown';
      const total = BigInt(r.total_scaled || 0);
      const paid = BigInt(r.paid_amount_scaled || 0);
      const due = total - paid;
      if (due <= 0n) continue;

      const dueMs = new Date(r.due_date || r.bill_date).getTime();
      const daysRemaining = Math.floor((dueMs - targetMs) / (1000 * 60 * 60 * 24));
      const isOverdue = daysRemaining < 0;

      if (!supplierMap.has(partyId)) {
        supplierMap.set(partyId, {
          partyId,
          partyName: r.supplier_name,
          totalDueScaled: 0n,
          overdueDueScaled: 0n,
          bills: []
        });
      }

      const s = supplierMap.get(partyId)!;
      s.totalDueScaled += due;
      if (isOverdue) {
        s.overdueDueScaled += due;
      }

      s.bills.push({
        partyId,
        partyName: r.supplier_name,
        billId: r.id,
        billNumber: r.bill_number,
        billDate: r.bill_date,
        dueDate: r.due_date,
        daysRemaining,
        isOverdue,
        totalScaled: total,
        paidScaled: paid,
        dueAmountScaled: due
      });
    }

    const suppliers = Array.from(supplierMap.values());
    const totalDueScaled = suppliers.reduce((acc, s) => acc + s.totalDueScaled, 0n);

    // Control account reconciliation (Accounts Payable 2010)
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const apAcc = accounts.find(a => a.accountCode === '2010' || a.subCategory === 'supplier_payables');
    let controlAccountPayableScaled = 0n;

    if (apAcc) {
      const apBal = await accRepo.getAccountBalance(workspaceId, apAcc.id);
      controlAccountPayableScaled = apBal?.netBalanceScaled || 0n;
    }

    const discrepancyScaled = totalDueScaled - controlAccountPayableScaled;
    const isReconciled = discrepancyScaled === 0n;

    return {
      asOfDate: effectiveDate,
      totalDueScaled,
      controlAccountPayableScaled,
      isReconciled,
      discrepancyScaled,
      suppliers
    };
  }

  /**
   * 6. Stock on Hand Report: Quantity by product and status.
   * Reconciles to sum of stock movements.
   */
  public static async getStockOnHandReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: { category?: string; page?: number; pageSize?: number } = {}
  ): Promise<{ items: StockOnHandItem[]; totalCount: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const conditions: string[] = ["workspace_id = ?", "is_archived = 0"];
    const params: any[] = [workspaceId];

    if (filter.category) {
      conditions.push("category = ?");
      params.push(filter.category);
    }

    const countRows = await conn.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM products WHERE ${conditions.join(" AND ")}`,
      params
    );
    const totalCount = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 20);
    const offset = (page - 1) * pageSize;

    const rows = await conn.query<any>(
      `SELECT id, name, sku, barcode, unit, current_stock_quantity, reorder_threshold,
              min_stock_alert, cost_price_scaled, sale_price_scaled
       FROM products
       WHERE ${conditions.join(" AND ")}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const items: StockOnHandItem[] = rows.map(r => {
      const currentStock = Number(r.current_stock_quantity || 0);
      const threshold = Number(r.reorder_threshold ?? r.min_stock_alert ?? 5);
      return {
        productId: r.id,
        productName: r.name,
        sku: r.sku || undefined,
        barcode: r.barcode || undefined,
        unit: r.unit,
        currentStock,
        reorderThreshold: threshold,
        isLowStock: currentStock <= threshold,
        costPriceScaled: BigInt(r.cost_price_scaled || 0),
        salePriceScaled: BigInt(r.sale_price_scaled || 0)
      };
    });

    return { items, totalCount };
  }

  /**
   * 7. Inventory Valuation Report: Stock value using weighted average costing.
   * Reconciles to Inventory asset control account (1300).
   */
  public static async getInventoryValuationReport(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<InventoryValuationReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const rows = await conn.query<any>(
      `SELECT id, name, sku, unit, current_stock_quantity, weighted_avg_cost_scaled, cost_price_scaled
       FROM products
       WHERE workspace_id = ? AND is_archived = 0
       ORDER BY name ASC`,
      [workspaceId]
    );

    let totalValuationScaled = 0n;
    const items: InventoryValuationItem[] = [];

    for (const r of rows) {
      const qty = Number(r.current_stock_quantity || 0);
      const unitCost = BigInt(r.weighted_avg_cost_scaled || r.cost_price_scaled || 0);
      const itemVal = BigInt(Math.max(0, Math.round(qty * Number(unitCost))));
      totalValuationScaled += itemVal;

      items.push({
        productId: r.id,
        productName: r.name,
        sku: r.sku || undefined,
        unit: r.unit,
        currentStock: qty,
        weightedAvgCostScaled: unitCost,
        totalValuationScaled: itemVal
      });
    }

    // Reconcile with Inventory control account (1300)
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const invAcc = accounts.find(a => a.accountCode === '1300' || a.subCategory === 'inventory');
    let controlAccountInventoryScaled = 0n;

    if (invAcc) {
      const bal = await accRepo.getAccountBalance(workspaceId, invAcc.id);
      controlAccountInventoryScaled = bal?.netBalanceScaled || 0n;
    }

    const discrepancyScaled = totalValuationScaled - controlAccountInventoryScaled;
    const isReconciled = discrepancyScaled === 0n;

    return {
      asOfDate: new Date().toISOString().slice(0, 10),
      totalValuationScaled,
      controlAccountInventoryScaled,
      isReconciled,
      discrepancyScaled,
      items
    };
  }

  /**
   * 8. Low Stock Report: Items at or below reorder threshold.
   */
  public static async getLowStockReport(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<LowStockAlertItem[]> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const rows = await conn.query<any>(
      `SELECT id, name, sku, unit, current_stock_quantity, reorder_threshold, min_stock_alert,
              cost_price_scaled, default_supplier_id
       FROM products
       WHERE workspace_id = ?
         AND is_archived = 0
         AND current_stock_quantity <= COALESCE(reorder_threshold, min_stock_alert, 5)
       ORDER BY (current_stock_quantity - COALESCE(reorder_threshold, min_stock_alert, 5)) ASC`,
      [workspaceId]
    );

    return rows.map(r => {
      const stock = Number(r.current_stock_quantity || 0);
      const threshold = Number(r.reorder_threshold ?? r.min_stock_alert ?? 5);
      const deficit = Math.max(0, threshold - stock);
      const costScaled = BigInt(r.cost_price_scaled || 0);
      const reorderCost = BigInt(Math.round(deficit * Number(costScaled)));

      return {
        productId: r.id,
        productName: r.name,
        sku: r.sku || undefined,
        unit: r.unit,
        currentStock: stock,
        reorderThreshold: threshold,
        deficitQuantity: deficit,
        costPriceScaled: costScaled,
        estimatedReorderCostScaled: reorderCost,
        defaultSupplierId: r.default_supplier_id || undefined
      };
    });
  }

  /**
   * 9. Gross Profit Report: Net sales less COGS under accounting rules.
   * Does NOT calculate profit as sales minus supplier cash payments!
   */
  public static async getGrossProfitReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: { startDate?: string; endDate?: string } = {}
  ): Promise<GrossProfitReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const startDate = filter.startDate || '1970-01-01';
    const endDate = filter.endDate || '2099-12-31';

    // 1. Gross sales and discounts from sales invoices
    const salesRows = await conn.query<any>(
      `SELECT SUM(subtotal_scaled) as gross_sales, SUM(discount_scaled) as discounts
       FROM documents
       WHERE workspace_id = ? AND document_type = 'sales_invoice' AND is_archived = 0 AND status != 'draft'
         AND issue_date >= ? AND issue_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const grossSalesScaled = BigInt(salesRows[0]?.gross_sales || 0);
    const salesDiscountsScaled = BigInt(salesRows[0]?.discounts || 0);

    // 2. Sales returns deduction
    const retRows = await conn.query<{ ret_subtotal: number | null }>(
      `SELECT SUM(subtotal_scaled) as ret_subtotal
       FROM sales_returns
       WHERE workspace_id = ? AND return_date >= ? AND return_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const salesReturnsScaled = BigInt(retRows[0]?.ret_subtotal || 0);

    const netSalesScaled = grossSalesScaled - salesDiscountsScaled - salesReturnsScaled;

    // 3. COGS from posted inventory sales movements
    const cogsRows = await conn.query<{ cogs_total: number | null }>(
      `SELECT SUM(total_cost_scaled) as cogs_total
       FROM stock_movements
       WHERE workspace_id = ? AND source_type = 'sale_issue'
         AND effective_date >= ? AND effective_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const cogsScaled = BigInt(cogsRows[0]?.cogs_total || 0);

    // 4. COGS returned / reversed on resellable returns
    const cogsRevRows = await conn.query<{ cogs_rev: number | null }>(
      `SELECT SUM(srl.unit_cost_scaled * srl.returned_quantity) as cogs_rev
       FROM sales_return_lines srl
       JOIN sales_returns sr ON srl.sales_return_id = sr.id
       WHERE sr.workspace_id = ? AND srl.item_condition = 'resellable'
         AND sr.return_date >= ? AND sr.return_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const cogsReturnsReversedScaled = BigInt(cogsRevRows[0]?.cogs_rev || 0);

    const netCogsScaled = cogsScaled - cogsReturnsReversedScaled;
    const grossProfitScaled = netSalesScaled - netCogsScaled;

    let grossProfitMarginPercent = 0;
    if (netSalesScaled > 0n) {
      grossProfitMarginPercent = Number((grossProfitScaled * 10000n) / netSalesScaled) / 100;
    }

    return {
      startDate,
      endDate,
      grossSalesScaled,
      salesDiscountsScaled,
      salesReturnsScaled,
      netSalesScaled,
      cogsScaled,
      cogsReturnsReversedScaled,
      netCogsScaled,
      grossProfitScaled,
      grossProfitMarginPercent
    };
  }

  /**
   * 10. Profit and Loss Report: Income and expenses for a selected period.
   */
  public static async getProfitAndLossReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: { startDate?: string; endDate?: string } = {}
  ): Promise<ProfitAndLossReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const startDate = filter.startDate || '1970-01-01';
    const endDate = filter.endDate || '2099-12-31';

    // Gross profit base
    const gp = await this.getGrossProfitReport(conn, workspaceId, filter);

    // Other income accounts
    const otherIncomeRows = await conn.query<{ other_inc: number | null }>(
      `SELECT SUM(jl.credit_amount_scaled - jl.debit_amount_scaled) as other_inc
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       WHERE je.workspace_id = ? AND (je.is_posted = 1 OR je.status = 'posted')
         AND a.type = 'revenue' AND a.account_code NOT LIKE '401%' AND a.sub_category != 'sales'
         AND je.entry_date >= ? AND je.entry_date <= ?`,
      [workspaceId, startDate, endDate]
    );
    const otherIncomeScaled = BigInt(otherIncomeRows[0]?.other_inc || 0);

    // Operating expenses by account
    const expRows = await conn.query<any>(
      `SELECT a.id, a.account_code, a.name, SUM(jl.debit_amount_scaled - jl.credit_amount_scaled) as net_exp
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN accounts a ON jl.account_id = a.id
       WHERE je.workspace_id = ? AND (je.is_posted = 1 OR je.status = 'posted')
         AND a.type = 'expense' AND a.account_code NOT LIKE '501%' AND a.sub_category != 'cogs'
         AND je.entry_date >= ? AND je.entry_date <= ?
       GROUP BY a.id, a.account_code, a.name
       HAVING net_exp > 0
       ORDER BY a.account_code ASC`,
      [workspaceId, startDate, endDate]
    );

    let totalOperatingExpensesScaled = 0n;
    const operatingExpenses = expRows.map(r => {
      const amt = BigInt(r.net_exp || 0);
      totalOperatingExpensesScaled += amt;
      return {
        accountId: r.id,
        accountCode: r.account_code,
        name: r.name,
        amountScaled: amt
      };
    });

    const totalRevenueScaled = gp.netSalesScaled + otherIncomeScaled;
    const netOperatingIncomeScaled = gp.grossProfitScaled - totalOperatingExpensesScaled;
    const netProfitOrLossScaled = netOperatingIncomeScaled + otherIncomeScaled;

    return {
      startDate,
      endDate,
      revenue: {
        salesRevenueScaled: gp.grossSalesScaled - gp.salesDiscountsScaled,
        otherIncomeScaled,
        salesReturnsDeductionScaled: gp.salesReturnsScaled,
        totalRevenueScaled
      },
      cogs: {
        inventoryCogsScaled: gp.cogsScaled,
        cogsReturnsReversedScaled: gp.cogsReturnsReversedScaled,
        netCogsScaled: gp.netCogsScaled
      },
      grossProfitScaled: gp.grossProfitScaled,
      operatingExpenses,
      totalOperatingExpensesScaled,
      netOperatingIncomeScaled,
      netProfitOrLossScaled
    };
  }

  /**
   * 11. Cash/Bank Summary: Balances from posted accounting records.
   */
  public static async getCashBankSummary(
    conn: DatabaseConnection,
    workspaceId: string,
    asOfDate?: string
  ): Promise<CashBankSummaryItem[]> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const accRepo = new AccountRepository(conn);
    const allAccounts = await accRepo.findByWorkspace(workspaceId);

    const cashBankAccounts = allAccounts.filter(
      a => a.accountCode.startsWith('101') || a.accountCode.startsWith('102') || a.subCategory === 'cash' || a.subCategory === 'bank'
    );

    const summary: CashBankSummaryItem[] = [];

    for (const acc of cashBankAccounts) {
      const rows = await conn.query<any>(
        `SELECT SUM(jl.debit_amount_scaled) as debits, SUM(jl.credit_amount_scaled) as credits
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE jl.account_id = ? AND je.workspace_id = ? AND (je.is_posted = 1 OR je.status = 'posted')
           AND je.entry_date <= ?`,
        [acc.id, workspaceId, effectiveDate]
      );

      const debits = BigInt(rows[0]?.debits || 0);
      const credits = BigInt(rows[0]?.credits || 0);
      const closing = debits - credits;

      summary.push({
        accountId: acc.id,
        accountCode: acc.accountCode,
        name: acc.name,
        subCategory: acc.subCategory as 'cash' | 'bank',
        openingBalanceScaled: 0n,
        totalDebitScaled: debits,
        totalCreditScaled: credits,
        closingBalanceScaled: closing
      });
    }

    return summary;
  }

  /**
   * 12. Trial Balance: Debit and credit balances by account.
   */
  public static async getTrialBalanceReport(
    conn: DatabaseConnection,
    workspaceId: string,
    asOfDate?: string
  ): Promise<TrialBalanceReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);

    const balances: AccountBalanceResult[] = [];
    let totalDebitsScaled = 0n;
    let totalCreditsScaled = 0n;

    for (const acc of accounts) {
      const rows = await conn.query<any>(
        `SELECT SUM(jl.debit_amount_scaled) as debits, SUM(jl.credit_amount_scaled) as credits
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE jl.account_id = ? AND je.workspace_id = ? AND (je.is_posted = 1 OR je.status = 'posted')
           AND je.entry_date <= ?`,
        [acc.id, workspaceId, effectiveDate]
      );

      const debits = BigInt(rows[0]?.debits || 0);
      const credits = BigInt(rows[0]?.credits || 0);
      totalDebitsScaled += debits;
      totalCreditsScaled += credits;

      const isDebitNormal = acc.type === 'asset' || acc.type === 'expense' || acc.subCategory === 'owner_drawings';
      const normalBalanceType = isDebitNormal ? 'debit' : 'credit';
      const net = isDebitNormal ? debits - credits : credits - debits;

      balances.push({
        accountId: acc.id,
        accountCode: acc.accountCode,
        name: acc.name,
        type: acc.type,
        subCategory: acc.subCategory,
        normalBalanceType,
        totalDebitScaled: debits,
        totalCreditScaled: credits,
        netBalanceScaled: net
      });
    }

    return {
      asOfDate: effectiveDate,
      balances,
      totalDebitsScaled,
      totalCreditsScaled,
      isBalanced: totalDebitsScaled === totalCreditsScaled
    };
  }

  /**
   * 13. Balance Sheet: Assets, Liabilities, and Equity as of a given date.
   * Guarantees fundamental balance: Assets = Liabilities + Equity.
   */
  public static async getBalanceSheetReport(
    conn: DatabaseConnection,
    workspaceId: string,
    asOfDate?: string
  ): Promise<BalanceSheetReportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const tb = await this.getTrialBalanceReport(conn, workspaceId, effectiveDate);

    // Current Assets
    const currentAssets: Array<{ accountCode: string; name: string; balanceScaled: bigint }> = [];
    let totalCurrentAssetsScaled = 0n;

    // Non-current Assets
    const nonCurrentAssets: Array<{ accountCode: string; name: string; balanceScaled: bigint }> = [];
    let totalNonCurrentAssetsScaled = 0n;

    // Current Liabilities
    const currentLiabilities: Array<{ accountCode: string; name: string; balanceScaled: bigint }> = [];
    let totalCurrentLiabilitiesScaled = 0n;

    // Long-term Liabilities
    const longTermLiabilities: Array<{ accountCode: string; name: string; balanceScaled: bigint }> = [];
    let totalLongTermLiabilitiesScaled = 0n;

    // Equity items
    let capitalScaled = 0n;
    let drawingsScaled = 0n;
    let retainedEarningsScaled = 0n;

    for (const b of tb.balances) {
      if (b.type === 'asset') {
        if (b.accountCode.startsWith('10') || b.accountCode.startsWith('12') || b.accountCode.startsWith('13')) {
          currentAssets.push({ accountCode: b.accountCode, name: b.name, balanceScaled: b.netBalanceScaled });
          totalCurrentAssetsScaled += b.netBalanceScaled;
        } else {
          nonCurrentAssets.push({ accountCode: b.accountCode, name: b.name, balanceScaled: b.netBalanceScaled });
          totalNonCurrentAssetsScaled += b.netBalanceScaled;
        }
      } else if (b.type === 'liability') {
        if (b.accountCode.startsWith('20')) {
          currentLiabilities.push({ accountCode: b.accountCode, name: b.name, balanceScaled: b.netBalanceScaled });
          totalCurrentLiabilitiesScaled += b.netBalanceScaled;
        } else {
          longTermLiabilities.push({ accountCode: b.accountCode, name: b.name, balanceScaled: b.netBalanceScaled });
          totalLongTermLiabilitiesScaled += b.netBalanceScaled;
        }
      } else if (b.type === 'equity') {
        if (b.accountCode === '3000' || b.subCategory === 'capital') {
          capitalScaled += b.netBalanceScaled;
        } else if (b.accountCode === '3010' || b.subCategory === 'owner_drawings') {
          drawingsScaled += b.netBalanceScaled;
        } else {
          retainedEarningsScaled += b.netBalanceScaled;
        }
      }
    }

    const totalAssetsScaled = totalCurrentAssetsScaled + totalNonCurrentAssetsScaled;
    const totalLiabilitiesScaled = totalCurrentLiabilitiesScaled + totalLongTermLiabilitiesScaled;

    // Current period net income from P&L as of effective date
    const pl = await this.getProfitAndLossReport(conn, workspaceId, { endDate: effectiveDate });
    const currentPeriodEarningsScaled = pl.netProfitOrLossScaled;

    // Total Equity = Capital - Drawings + Retained Earnings + Current Period Net Profit
    const totalEquityScaled = capitalScaled - drawingsScaled + retainedEarningsScaled + currentPeriodEarningsScaled;
    const totalLiabilitiesAndEquityScaled = totalLiabilitiesScaled + totalEquityScaled;
    const imbalanceScaled = totalAssetsScaled - totalLiabilitiesAndEquityScaled;

    return {
      asOfDate: effectiveDate,
      assets: {
        currentAssets,
        totalCurrentAssetsAssets: totalCurrentAssetsScaled,
        totalCurrentAssetsScaled,
        nonCurrentAssets,
        totalNonCurrentAssetsScaled,
        totalAssetsScaled
      } as any,
      liabilities: {
        currentLiabilities,
        totalCurrentLiabilitiesScaled,
        longTermLiabilities,
        totalLongTermLiabilitiesScaled,
        totalLiabilitiesScaled
      },
      equity: {
        capitalScaled,
        drawingsScaled,
        retainedEarningsScaled,
        currentPeriodEarningsScaled,
        totalEquityScaled
      },
      totalLiabilitiesAndEquityScaled,
      isBalanced: imbalanceScaled === 0n,
      imbalanceScaled
    };
  }

  /**
   * 14. Party Statements: Opening balance, movements, payments and closing balance.
   */
  public static async getPartyStatementReport(
    conn: DatabaseConnection,
    workspaceId: string,
    partyId: string,
    filter: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
  ): Promise<PartyStatementResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    const ledgerRepo = new PartyLedgerRepository(conn);
    return await ledgerRepo.getPartyStatement(workspaceId, partyId, filter);
  }

  /**
   * 15. Audit / History Report: Relevant changes, reversals, and adjustments.
   */
  public static async getAuditHistoryReport(
    conn: DatabaseConnection,
    workspaceId: string,
    filter: { page?: number; pageSize?: number } = {}
  ): Promise<{ logs: AuditHistoryLogItem[]; totalCount: number }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 25);
    const offset = (page - 1) * pageSize;

    const countRows = await conn.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM journal_entries WHERE workspace_id = ?`,
      [workspaceId]
    );
    const totalCount = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

    const rows = await conn.query<any>(
      `SELECT id, entry_number, entry_date, description, source_type, status,
              reversal_of_entry_id, reversal_reason, audit_actor, created_at
       FROM journal_entries
       WHERE workspace_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [workspaceId, pageSize, offset]
    );

    const logs: AuditHistoryLogItem[] = rows.map(r => ({
      id: r.id,
      timestamp: r.created_at || r.entry_date,
      type: r.source_type,
      referenceNumber: r.entry_number,
      actor: r.audit_actor || 'System',
      description: r.reversal_reason ? `REVERSAL: ${r.reversal_reason}` : r.description,
      isReversal: Boolean(r.reversal_of_entry_id || r.status === 'reversed')
    }));

    return { logs, totalCount };
  }

  /**
   * Reviewable WhatsApp Reminder Builder
   * Formulates a compliant wa.me URL and message body with transparent delivery disclosure.
   */
  public static async buildWhatsAppReminder(
    conn: DatabaseConnection,
    workspaceId: string,
    customerId: string,
    currencySymbol = 'Rs.'
  ): Promise<WhatsAppReminderDetails> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    // 1. Get customer details
    const partyRows = await conn.query<any>(
      `SELECT id, name, phone FROM parties WHERE id = ? AND workspace_id = ?`,
      [customerId, workspaceId]
    );
    if (partyRows.length === 0) {
      throw new Error(`Customer ${customerId} not found.`);
    }
    const customer = partyRows[0];
    const rawPhone = customer.phone?.replace(/[^0-9]/g, '') || '';

    // 2. Fetch overdue sales invoices
    const today = new Date().toISOString().slice(0, 10);
    const docRows = await conn.query<any>(
      `SELECT id, document_number, due_date, total_scaled, paid_amount_scaled
       FROM documents
       WHERE workspace_id = ?
         AND party_id = ?
         AND document_type = 'sales_invoice'
         AND is_archived = 0
         AND status IN ('unpaid', 'partial')
         AND total_scaled > paid_amount_scaled
       ORDER BY due_date ASC`,
      [workspaceId, customerId]
    );

    const invoices: Array<{ invoiceNumber: string; dueDate: string; dueAmountScaled: bigint }> = [];
    let verifiedBalanceScaled = 0n;

    for (const r of docRows) {
      const due = BigInt(r.total_scaled || 0) - BigInt(r.paid_amount_scaled || 0);
      if (due > 0n) {
        verifiedBalanceScaled += due;
        invoices.push({
          invoiceNumber: r.document_number,
          dueDate: r.due_date,
          dueAmountScaled: due
        });
      }
    }

    const formatAmount = (scaled: bigint) => (Number(scaled) / 10000).toLocaleString('en-US', { minimumFractionDigits: 2 });

    // 3. Compose message
    const lines = [
      `Dear ${customer.name},`,
      `This is a friendly reminder regarding your outstanding payment balance of ${currencySymbol} ${formatAmount(verifiedBalanceScaled)}.`,
      ``,
      `Pending Invoices:`
    ];

    for (const inv of invoices) {
      lines.push(`• Invoice #${inv.invoiceNumber} (Due: ${inv.dueDate}): ${currencySymbol} ${formatAmount(inv.dueAmountScaled)}`);
    }

    lines.push(``);
    lines.push(`Kindly arrange settlement at your earliest convenience. If you have already made payment, please disregard this note.`);
    lines.push(`Thank you!`);

    const messageText = lines.join('\n');
    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

    const disclosure =
      'Notice: Opening WhatsApp opens the third-party WhatsApp application. Cocoon does not guarantee message delivery and cannot read private replies without a separately authorized messaging integration.';

    return {
      customerName: customer.name,
      phone: customer.phone || 'No phone recorded',
      verifiedBalanceScaled,
      currencySymbol,
      invoices,
      messageText,
      whatsappUrl,
      disclosure
    };
  }
}
