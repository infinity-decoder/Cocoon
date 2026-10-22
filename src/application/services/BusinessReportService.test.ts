/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { DatabaseConnection } from '../../infrastructure/database/types';
import { WorkspaceService } from './WorkspaceService';
import { SaleService } from './SaleService';
import { InventoryService } from './InventoryService';
import { PartyKhataService } from './PartyKhataService';
import { PurchaseService } from './PurchaseService';
import { BusinessReportService } from './BusinessReportService';
import { AccountRepository } from '../../infrastructure/database/repositories/AccountRepository';
import { PartyRepository } from '../../infrastructure/database/repositories/PartyRepository';
import { DocumentRepository } from '../../infrastructure/database/repositories/DocumentRepository';
import { JournalEntryRepository } from '../../infrastructure/database/repositories/JournalEntryRepository';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';

describe('Application Services: BusinessReportService (Authoritative Reports & WhatsApp Reminders)', () => {
  let conn: DatabaseConnection;
  let workspaceId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let testProductId: string;
  let lowStockProductId: string;
  let customerId: string;
  let supplierId: string;

  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const c = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(c, MIGRATION_REGISTRY);
    return c;
  }

  beforeEach(async () => {
    conn = await createTestDb(`test_reports_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);

    // 1. Create a business workspace (seeds chart of accounts)
    const ws = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'OmniStore Traders',
      businessType: 'retail',
      currencyCode: 'PKR',
      legalName: 'OmniStore Traders PVT LTD',
      taxId: 'TRN-555666777',
      invoicePrefix: 'INV'
    });
    workspaceId = ws.id;

    // 2. Look up accounts
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const cashAcc = accounts.find(a => a.accountCode === '1010');
    const bankAcc = accounts.find(a => a.accountCode === '1020');
    const capitalAcc = accounts.find(a => a.accountCode === '3000' || a.subCategory === 'capital');
    assert.ok(cashAcc, 'Cash 1010 must be seeded');
    assert.ok(bankAcc, 'Bank 1020 must be seeded');
    assert.ok(capitalAcc, 'Capital 3000 must be seeded');
    cashAccountId = cashAcc.id;
    bankAccountId = bankAcc.id;

    // 3. Record initial owner capital contribution of Rs. 100,000 into Bank (Debit Bank, Credit Capital)
    // Note: Do NOT treat owner contribution as sales revenue!
    const jeRepo = new JournalEntryRepository(conn);
    await jeRepo.createWithLines(
      {
        workspaceId,
        entryNumber: 'JE-CAP-001',
        entryDate: '2026-01-01',
        sourceType: 'manual_journal',
        description: 'Initial Owner Capital Injection',
        isPosted: true
      },
      [
        {
          accountId: bankAccountId,
          debitAmountScaled: 1000000000n, // Rs. 100,000
          creditAmountScaled: 0n,
          description: 'Owner Capital Deposit to Bank'
        },
        {
          accountId: capitalAcc.id,
          debitAmountScaled: 0n,
          creditAmountScaled: 1000000000n,
          description: 'Owner Equity Capital'
        }
      ]
    );

    // 4. Create Parties: Customer & Supplier
    const cust = await PartyKhataService.createParty(conn, workspaceId, {
      name: 'Alpha Wholesale Corp',
      type: 'customer',
      phone: '+923001234567',
      email: 'alpha@example.com',
      creditLimitScaled: 500000000n
    });
    customerId = cust.id;

    const supp = await PartyKhataService.createParty(conn, workspaceId, {
      name: 'Prime Distributing LLC',
      type: 'supplier',
      phone: '+923009876543',
      email: 'prime@example.com'
    });
    supplierId = supp.id;

    // 5. Create Products: Standard Product with Stock & Low Stock Product
    const prod1 = await InventoryService.createProduct(conn, workspaceId, {
      name: 'Super Steel Widget',
      sku: 'WIDGET-001',
      barcode: '8901234567890',
      category: 'Hardware',
      unit: 'pcs',
      costPriceScaled: 500000n,      // Rs. 50.00
      salePriceScaled: 1000000n,     // Rs. 100.00
      initialStockQuantity: 100,     // 100 units
      reorderThreshold: 10
    });
    testProductId = prod1.id;

    const prod2 = await InventoryService.createProduct(conn, workspaceId, {
      name: 'Rare Copper Bolt',
      sku: 'BOLT-002',
      unit: 'pcs',
      costPriceScaled: 200000n,      // Rs. 20.00
      salePriceScaled: 400000n,      // Rs. 40.00
      initialStockQuantity: 3,       // Low stock!
      reorderThreshold: 15,
      defaultSupplierId: supplierId
    });
    lowStockProductId = prod2.id;

    // 6. Post Opening Inventory Asset journal entry: Debit 1300 Inventory Asset, Credit 3000 Capital
    const invAcc = accounts.find(a => a.accountCode === '1300')!;
    await jeRepo.createWithLines(
      {
        workspaceId,
        entryNumber: 'JE-OPEN-INV-001',
        entryDate: '2026-01-01',
        sourceType: 'opening_balance',
        description: 'Opening Inventory Asset Initial Valuation',
        isPosted: true
      },
      [
        {
          accountId: invAcc.id,
          debitAmountScaled: 50600000n, // Rs. 5,060 (100 * 50 + 3 * 20)
          creditAmountScaled: 0n,
          description: 'Opening Inventory Asset'
        },
        {
          accountId: capitalAcc.id,
          debitAmountScaled: 0n,
          creditAmountScaled: 50600000n,
          description: 'Owner Capital - Inventory Contribution'
        }
      ]
    );
  });

  it('1. Verifies Cash Sale, Credit Sale, Partial Payment, and Sales Return accounting integrity', async () => {
    // A. Cash Sale via POS: 10 units of WIDGET @ Rs. 100 = Rs. 1,000 cash
    const cashSaleRes = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      isWalkIn: true,
      idempotencyKey: 'IDEMP-SALE-CASH-101',
      items: [
        {
          productId: testProductId,
          description: 'Super Steel Widget',
          quantity: 10,
          packageUnit: 'pcs',
          unitPriceScaled: 1000000n // Rs. 100.00
        }
      ],
      depositAccountId: cashAccountId
    });
    assert.equal(cashSaleRes.totalScaled, 10000000n);
    assert.equal(cashSaleRes.remainingBalanceScaled, 0n);

    // B. Credit Sale to registered customer: 20 units @ Rs. 100 = Rs. 2,000 credit (Due in 15 days)
    const creditSaleRes = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'credit',
      customerId,
      idempotencyKey: 'IDEMP-SALE-CREDIT-102',
      items: [
        {
          productId: testProductId,
          description: 'Super Steel Widget',
          quantity: 20,
          packageUnit: 'pcs',
          unitPriceScaled: 1000000n // Rs. 100.00
        }
      ]
    });
    assert.equal(creditSaleRes.totalScaled, 20000000n);
    assert.equal(creditSaleRes.remainingBalanceScaled, 20000000n);

    // C. Partial Payment from Customer: pays Rs. 800 into Cash, leaving Rs. 1,200 due
    const payRes = await PartyKhataService.recordPayment(conn, workspaceId, {
      partyId: customerId,
      paymentType: 'customer_receipt',
      amountScaled: 8000000n, // Rs. 800.00
      paymentDate: '2026-01-15',
      paymentMethod: 'cash',
      accountId: cashAccountId,
      notes: 'Partial payment against credit sale',
      allocations: [
        {
          documentId: creditSaleRes.document.id,
          amountScaled: 8000000n
        }
      ]
    });
    assert.ok(payRes.id);

    // Check remaining document balance
    const docRepo = new DocumentRepository(conn);
    const updatedDoc = await docRepo.findById(creditSaleRes.document.id);
    assert.equal(updatedDoc?.paidAmountScaled, 8000000n);
    assert.equal(updatedDoc?.status, 'partial');

    // D. Sales Return: Return 2 units resellable from Cash Sale, refund Rs. 200 via cash
    const returnRes = await SaleService.recordSalesReturn(conn, workspaceId, {
      originalDocumentId: cashSaleRes.document.id,
      returnDate: '2026-01-18',
      settlementType: 'cash_refund',
      refundAccountId: cashAccountId,
      reason: 'Customer ordered wrong size',
      lines: [
        {
          originalLineId: cashSaleRes.document.lines[0].id,
          productId: testProductId,
          description: 'Super Steel Widget',
          returnedQuantity: 2,
          packageUnit: 'pcs',
          itemCondition: 'resellable'
        }
      ]
    });
    assert.ok(returnRes.id);

    // 2. Verify Trial Balance: Must be completely balanced (Total Debits == Total Credits)
    const tb = await BusinessReportService.getTrialBalanceReport(conn, workspaceId);
    assert.equal(tb.isBalanced, true, 'Trial balance must balance total debits with total credits');
    assert.equal(tb.totalDebitsScaled, tb.totalCreditsScaled, 'Total debits must match total credits');

    // 3. Verify Balance Sheet: Assets == Liabilities + Equity
    const bs = await BusinessReportService.getBalanceSheetReport(conn, workspaceId);
    assert.equal(bs.isBalanced, true, 'Balance sheet must strictly balance (Assets = Liab + Equity)');
    assert.equal(bs.imbalanceScaled, 0n, 'Imbalance must be 0n');

    // 4. Verify Gross Profit Report
    // Gross sales = 1000 + 2000 = 3000
    // Returns = 200 -> Net Sales = 2800
    // COGS issues = 10 * 50 + 20 * 50 = 1500
    // Resellable COGS reversed = 2 * 50 = 100 -> Net COGS = 1400
    // Gross Profit = 2800 - 1400 = 1400 (50.00% margin)
    const gp = await BusinessReportService.getGrossProfitReport(conn, workspaceId);
    assert.equal(gp.grossSalesScaled, 30000000n, 'Gross sales should be Rs. 3,000');
    assert.equal(gp.salesReturnsScaled, 2000000n, 'Sales returns should be Rs. 200');
    assert.equal(gp.netSalesScaled, 28000000n, 'Net sales should be Rs. 2,800');
    assert.equal(gp.cogsScaled, 15000000n, 'COGS issues should be Rs. 1,500');
    assert.equal(gp.cogsReturnsReversedScaled, 1000000n, 'COGS returns reversed should be Rs. 100');
    assert.equal(gp.netCogsScaled, 14000000n, 'Net COGS should be Rs. 1,400');
    assert.equal(gp.grossProfitScaled, 14000000n, 'Gross profit should be Rs. 1,400');
    assert.equal(gp.grossProfitMarginPercent, 50, 'Margin should be exactly 50%');

    // 5. Verify Profit & Loss Report
    const pl = await BusinessReportService.getProfitAndLossReport(conn, workspaceId);
    assert.equal(pl.grossProfitScaled, 14000000n);
    assert.equal(pl.netProfitOrLossScaled, 14000000n, 'Net profit should match gross profit with zero operating expenses');

    // 6. Verify Customer Aging Report and Control Account Reconciliation
    // Customer has 1 invoice with total 2000, paid 800, balance 1200
    const aging = await BusinessReportService.getCustomerAgingReport(conn, workspaceId, '2026-01-30');
    assert.equal(aging.customers.length, 1);
    assert.equal(aging.customers[0].partyName, 'Alpha Wholesale Corp');
    assert.equal(aging.customers[0].totalDueScaled, 12000000n, 'Total due should be Rs. 1,200');
    assert.equal(aging.totalReceivableAgingScaled, 12000000n);
    assert.equal(aging.isReconciled, true, 'Customer aging must reconcile with Accounts Receivable 1200 control account');
    assert.equal(aging.discrepancyScaled, 0n);

    // 7. Verify Daybook Report
    const daybook = await BusinessReportService.getDaybook(conn, workspaceId);
    assert.ok(daybook.entries.length > 0);
    assert.ok(daybook.closingBalanceScaled > 0n);

    // 8. Verify Stock on Hand & Inventory Valuation
    // Started with 100, sold 10 (cash) + 20 (credit) = 30 out, returned 2 resellable = 72 on hand
    const stockReport = await BusinessReportService.getStockOnHandReport(conn, workspaceId);
    const widgetStock = stockReport.items.find(i => i.productId === testProductId);
    assert.ok(widgetStock);
    assert.equal(widgetStock.currentStock, 72, 'Widget stock should be 72 units');

    const invVal = await BusinessReportService.getInventoryValuationReport(conn, workspaceId);
    assert.equal(invVal.isReconciled, true, 'Inventory valuation must reconcile with 1300 control account');
    assert.equal(invVal.discrepancyScaled, 0n);

    // 9. Verify Low Stock Alert Report
    // Rare Copper Bolt had initialStock 3 <= threshold 15
    const lowStock = await BusinessReportService.getLowStockReport(conn, workspaceId);
    assert.ok(lowStock.some(item => item.productId === lowStockProductId));
    const copperBolt = lowStock.find(item => item.productId === lowStockProductId)!;
    assert.equal(copperBolt.currentStock, 3);
    assert.equal(copperBolt.reorderThreshold, 15);
    assert.equal(copperBolt.deficitQuantity, 12);
    assert.equal(copperBolt.estimatedReorderCostScaled, 2400000n); // 12 * Rs. 20.00 = Rs. 240.00

    // 10. Verify Reviewable WhatsApp Reminder Builder
    const reminder = await BusinessReportService.buildWhatsAppReminder(conn, workspaceId, customerId, 'Rs.');
    assert.equal(reminder.customerName, 'Alpha Wholesale Corp');
    assert.equal(reminder.phone, '+923001234567');
    assert.equal(reminder.verifiedBalanceScaled, 12000000n, 'Reminder balance must match verified ledger balance of Rs. 1,200');
    assert.equal(reminder.invoices.length, 1);
    assert.equal(reminder.invoices[0].invoiceNumber, creditSaleRes.invoiceNumber);
    assert.equal(reminder.invoices[0].dueAmountScaled, 12000000n);

    // Verify wa.me URL encoding
    assert.ok(reminder.whatsappUrl.startsWith('https://wa.me/923001234567?text='));
    assert.ok(reminder.messageText.includes('Alpha Wholesale Corp'));
    assert.ok(reminder.messageText.includes('1,200.00'));
    assert.ok(reminder.disclosure.includes('Notice: Opening WhatsApp opens the third-party WhatsApp application'));
  });

  it('2. Verifies Purchases, Supplier Dues, and Audit History reports', async () => {
    // Record a credit purchase bill from Prime Distributing LLC: 20 units @ Rs. 30 = Rs. 600
    const billRes = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-01-05',
      dueDate: '2026-02-05',
      billNumber: 'SUPP-INV-9988',
      receiveStockNow: true,
      lines: [
        {
          productId: testProductId,
          description: 'Super Steel Widget',
          quantity: 20,
          packageUnit: 'pcs',
          unitCostScaled: 300000n
        }
      ]
    });
    assert.ok(billRes.id);

    // Purchases report
    const purchasesReport = await BusinessReportService.getPurchasesReport(conn, workspaceId);
    assert.equal(purchasesReport.totalNetPurchasesScaled, 6000000n);
    assert.equal(purchasesReport.bills.length, 1);
    assert.equal(purchasesReport.bills[0].supplierName, 'Prime Distributing LLC');

    // Supplier Dues report
    const supplierDues = await BusinessReportService.getSupplierDuesReport(conn, workspaceId, '2026-01-10');
    assert.equal(supplierDues.totalDueScaled, 6000000n);
    assert.equal(supplierDues.isReconciled, true, 'Supplier dues must reconcile to Accounts Payable 2010 control account');
    assert.equal(supplierDues.discrepancyScaled, 0n);

    // Audit History report
    const audit = await BusinessReportService.getAuditHistoryReport(conn, workspaceId);
    assert.ok(audit.totalCount > 0);
    assert.ok(audit.logs.length > 0);
  });
});
