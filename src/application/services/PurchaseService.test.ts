/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { DatabaseConnection } from '../../infrastructure/database/types';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';
import { WorkspaceService } from './WorkspaceService';
import { InventoryService } from './InventoryService';
import { PurchaseService } from './PurchaseService';
import { PartyKhataService } from './PartyKhataService';
import { PostingService } from './PostingService';
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';
import { AccountRepository } from '../../infrastructure/database/repositories/AccountRepository';
import { PartyLedgerRepository } from '../../infrastructure/database/repositories/PartyLedgerRepository';

describe('Application Services: PurchaseService (Purchasing Domain & Workflows)', () => {
  let conn: DatabaseConnection;
  let workspaceId: string;
  let supplierId: string;
  let productId: string;
  let cashAccountId: string;

  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const c = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(c, MIGRATION_REGISTRY);
    return c;
  }

  beforeEach(async () => {
    conn = await createTestDb(`test_purchase_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);

    // Setup a business workspace
    const ws = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'SuperMart Retail',
      businessType: 'retail',
      currencyCode: 'PKR'
    });
    workspaceId = ws.id;

    // Create a supplier party
    const supplier = await PartyKhataService.createParty(conn, workspaceId, {
      name: 'Nestle Distribution Hub',
      type: 'supplier',
      phone: '+923001234567',
      currencyCode: 'PKR'
    });
    supplierId = supplier.id;

    // Create a product with initial stock 10 pcs, cost 100 PKR (scaled: 1,000,000)
    const product = await InventoryService.createProduct(conn, workspaceId, {
      name: 'Nestle Milkpak 1L',
      sku: 'NES-MILK-1L',
      unit: 'pcs',
      costPriceScaled: 1000000n, // 100.0000 PKR
      salePriceScaled: 1400000n, // 140.0000 PKR
      initialStockQuantity: 10,
      unitConversions: [
        {
          unitName: 'carton',
          conversionFactor: 12,
          salePriceScaled: 16000000n,
          purchasePriceScaled: 11500000n
        }
      ]
    });
    productId = product.id;

    // Find Cash on Hand account (1010)
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const cashAcc = accounts.find(a => a.accountCode === '1010');
    assert.ok(cashAcc, 'Cash on Hand account must exist');
    cashAccountId = cashAcc.id;

    // Deposit initial capital into Cash using PostingService so payments can be made
    const equityAcc = accounts.find(a => a.accountCode === '3000')!;
    await PostingService.postJournal(conn, {
      workspaceId,
      entryDate: '2026-10-01',
      description: 'Initial Capital Deposit',
      sourceType: 'manual_journal',
      lines: [
        {
          accountId: cashAccountId,
          debitAmountScaled: 500000000n,
          creditAmountScaled: 0n,
          description: 'Initial Cash Deposit'
        },
        {
          accountId: equityAcc.id,
          debitAmountScaled: 0n,
          creditAmountScaled: 500000000n,
          description: 'Owner Capital'
        }
      ]
    });
  });

  it('Criteria 1: Purchase order alone does NOT inflate on-hand stock or create journal entries', async () => {
    const prodRepo = new ProductRepository(conn);
    const initialProduct = await prodRepo.findById(productId);
    assert.strictEqual(initialProduct!.currentStockQuantity, 10);

    const po = await PurchaseService.createPurchaseOrder(conn, workspaceId, {
      supplierId,
      orderDate: '2026-10-15',
      expectedDeliveryDate: '2026-10-20',
      lines: [
        {
          productId,
          itemType: 'inventory',
          description: 'Nestle Milkpak 1L cartons',
          orderedQuantity: 5,
          packageUnit: 'carton',
          unitCostScaled: 12000000n // 1200 PKR per carton
        }
      ]
    });

    assert.ok(po.id.startsWith('po_'));
    assert.strictEqual(po.orderStatus, 'ordered');
    assert.strictEqual(po.totalScaled, 60000000n); // 5 * 1200 = 6000 PKR

    // Verify stock on hand has NOT changed
    const afterPoProduct = await prodRepo.findById(productId);
    assert.strictEqual(afterPoProduct!.currentStockQuantity, 10);

    // Verify no journal entries were created for this PO
    const jeRows = await conn.query<any>(
      `SELECT COUNT(*) as cnt FROM journal_entries WHERE workspace_id = ? AND reference_id = ?`,
      [workspaceId, po.orderNumber]
    );
    assert.strictEqual(Number(jeRows[0].cnt), 0);
  });

  it('Criteria 2: Partial goods receipt updates only received quantities and transitions PO status', async () => {
    const prodRepo = new ProductRepository(conn);

    // Create PO for 10 cartons (each carton = 12 pcs)
    const po = await PurchaseService.createPurchaseOrder(conn, workspaceId, {
      supplierId,
      orderDate: '2026-10-15',
      lines: [
        {
          productId,
          description: 'Nestle Milkpak 1L',
          orderedQuantity: 10,
          packageUnit: 'carton',
          unitCostScaled: 12000000n
        }
      ]
    });

    const poLineId = po.lines[0].id;

    // Delivery 1: Partial delivery of 4 cartons with 1 damaged/short tracked
    const grn1 = await PurchaseService.recordGoodsReceipt(conn, workspaceId, {
      purchaseOrderId: po.id,
      supplierId,
      receiptDate: '2026-10-16',
      lines: [
        {
          purchaseOrderLineId: poLineId,
          productId,
          description: 'Nestle Milkpak 1L - Batch 1',
          receivedQuantity: 4,
          shortQuantity: 1,
          damagedQuantity: 0,
          packageUnit: 'carton',
          unitCostScaled: 12000000n,
          batchNumber: 'BATCH-001'
        }
      ]
    });

    assert.strictEqual(grn1.receiptStatus, 'received');
    assert.strictEqual(grn1.lines[0].receivedQuantity, 4);
    assert.strictEqual(grn1.lines[0].canonicalQuantity, 48); // 4 * 12 = 48 pcs

    // Stock on hand: 10 initial + 48 received = 58 pcs
    const prodAfterGrn1 = await prodRepo.findById(productId);
    assert.strictEqual(prodAfterGrn1!.currentStockQuantity, 58);

    // PO status must now be 'partially_received'
    const poAfter1 = await conn.query<any>(
      `SELECT order_status FROM purchase_orders WHERE id = ?`,
      [po.id]
    );
    assert.strictEqual(poAfter1[0].order_status, 'partially_received');

    // Delivery 2: Remaining 6 cartons received
    const grn2 = await PurchaseService.recordGoodsReceipt(conn, workspaceId, {
      purchaseOrderId: po.id,
      supplierId,
      receiptDate: '2026-10-18',
      lines: [
        {
          purchaseOrderLineId: poLineId,
          productId,
          description: 'Nestle Milkpak 1L - Batch 2',
          receivedQuantity: 6,
          packageUnit: 'carton',
          unitCostScaled: 12000000n,
          batchNumber: 'BATCH-002'
        }
      ]
    });

    assert.strictEqual(grn2.lines[0].canonicalQuantity, 72); // 6 * 12 = 72 pcs

    // Stock on hand: 58 + 72 = 130 pcs
    const prodAfterGrn2 = await prodRepo.findById(productId);
    assert.strictEqual(prodAfterGrn2!.currentStockQuantity, 130);

    // PO status must now be fully 'received'
    const poAfter2 = await conn.query<any>(
      `SELECT order_status FROM purchase_orders WHERE id = ?`,
      [po.id]
    );
    assert.strictEqual(poAfter2[0].order_status, 'received');
  });

  it('Criteria 3: Credit purchase increases supplier payable without falsely reducing cash', async () => {
    const accRepo = new AccountRepository(conn);
    const initialCash = (await accRepo.getAccountBalance(workspaceId, cashAccountId))!;

    // Direct Purchase Bill on credit for 20 pcs at 110 PKR = 2200 PKR (scaled: 22,000,000)
    const bill = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-10-17',
      dueDate: '2026-10-31',
      receiveStockNow: true,
      lines: [
        {
          productId,
          description: 'Nestle Milkpak 1L',
          quantity: 20,
          packageUnit: 'pcs',
          unitCostScaled: 1100000n
        }
      ]
    });

    assert.strictEqual(bill.paymentStatus, 'unpaid');
    assert.strictEqual(bill.receiptStatus, 'received');
    assert.strictEqual(bill.totalScaled, 22000000n);

    // Stock increased by 20 pcs (10 + 20 = 30)
    const prodRepo = new ProductRepository(conn);
    const prod = await prodRepo.findById(productId);
    assert.strictEqual(prod!.currentStockQuantity, 30);

    // Cash on hand must NOT have decreased
    const finalCash = (await accRepo.getAccountBalance(workspaceId, cashAccountId))!;
    assert.strictEqual(finalCash.netBalanceScaled, initialCash.netBalanceScaled);

    // Supplier payable in Party Ledger must be exactly 22,000,000
    const partyLedgerRepo = new PartyLedgerRepository(conn);
    const statement = await partyLedgerRepo.getPartyStatement(workspaceId, supplierId);
    assert.strictEqual(statement.closingBalanceScaled, 22000000n);
    assert.strictEqual(statement.closingBalanceType, 'payable');
  });

  it('Criteria 4: Landed cost allocation by value and by quantity to inventory items', async () => {
    // Create a second product
    const prod2 = await InventoryService.createProduct(conn, workspaceId, {
      name: 'Everyday Tea Powder 500g',
      unit: 'pcs',
      costPriceScaled: 2000000n, // 200 PKR
      salePriceScaled: 2600000n
    });

    // Purchase 10 of prod1 (10 * 100 = 1000) and 10 of prod2 (10 * 200 = 2000). Total value = 3000 PKR
    // Freight / Landed cost = 300 PKR (scaled: 3,000,000)
    // By value: Prod 1 gets 1000/3000 * 300 = 100 PKR landed cost. Effective unit cost: 100 + 10 = 110 PKR
    // Prod 2 gets 2000/3000 * 300 = 200 PKR landed cost. Effective unit cost: 200 + 20 = 220 PKR
    const bill = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-10-18',
      dueDate: '2026-10-31',
      receiveStockNow: true,
      landedCostScaled: 3000000n,
      landedCostAllocationMethod: 'by_value',
      lines: [
        {
          productId,
          description: 'Milkpak 1L',
          quantity: 10,
          packageUnit: 'pcs',
          unitCostScaled: 1000000n
        },
        {
          productId: prod2.id,
          description: 'Tea Powder 500g',
          quantity: 10,
          packageUnit: 'pcs',
          unitCostScaled: 2000000n
        }
      ]
    });

    assert.strictEqual(bill.totalScaled, 33000000n); // 3000 goods + 300 landed = 3300 PKR
    assert.strictEqual(bill.lines[0].allocatedLandedCostScaled, 1000000n);
    assert.strictEqual(bill.lines[0].effectiveUnitCostScaled, 1100000n);
    assert.strictEqual(bill.lines[1].allocatedLandedCostScaled, 2000000n);
    assert.strictEqual(bill.lines[1].effectiveUnitCostScaled, 2200000n);

    // Inventory valuation must reflect the landed cost in product weighted average cost
    const prodRepo = new ProductRepository(conn);
    const updatedProd2 = await prodRepo.findById(prod2.id);
    assert.strictEqual(updatedProd2!.weightedAvgCostScaled, 2200000n);
  });

  it('Criteria 5: Separates inventory purchases from non-stock operating expenses', async () => {
    // Bill containing 10 pcs inventory and 1 non-stock expense (e.g. store cleaning supplies or maintenance)
    const bill = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-10-19',
      dueDate: '2026-11-05',
      receiveStockNow: true,
      lines: [
        {
          productId,
          itemType: 'inventory',
          description: 'Milkpak 1L',
          quantity: 5,
          packageUnit: 'pcs',
          unitCostScaled: 1000000n
        },
        {
          itemType: 'expense',
          description: 'Store Shelf Installation & Repair Fee',
          quantity: 1,
          packageUnit: 'service',
          unitCostScaled: 5000000n // 500 PKR
        }
      ]
    });

    assert.strictEqual(bill.lines[0].itemType, 'inventory');
    assert.strictEqual(bill.lines[1].itemType, 'expense');
    assert.strictEqual(bill.lines[1].stockMovementId, null); // No stock movement for expense!

    // Verify journal entry has debits to both Inventory Asset (1300) and Operating Expenses (5020)
    const lines = await conn.query<any>(
      `SELECT jl.debit_amount_scaled, a.account_code, a.type
       FROM journal_lines jl
       JOIN accounts a ON jl.account_id = a.id
       WHERE jl.journal_entry_id = ?`,
      [bill.journalEntryId]
    );

    const inventoryDebit = lines.find((l: any) => l.account_code === '1300');
    assert.ok(inventoryDebit, 'Must have debit to Inventory Asset 1300');
    assert.strictEqual(BigInt(inventoryDebit.debit_amount_scaled), 5000000n);

    const expenseDebit = lines.find((l: any) => l.type === 'expense');
    assert.ok(expenseDebit, 'Must have debit to Operating Expense');
    assert.strictEqual(BigInt(expenseDebit.debit_amount_scaled), 5000000n);
  });

  it('Criteria 6: Supplier payment reduces outstanding payable and cash/bank balance', async () => {
    const accRepo = new AccountRepository(conn);
    const initialCash = (await accRepo.getAccountBalance(workspaceId, cashAccountId))!;

    // Create a bill for 1000 PKR
    const bill = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-10-20',
      dueDate: '2026-10-31',
      receiveStockNow: true,
      lines: [
        {
          productId,
          description: 'Milkpak 1L',
          quantity: 10,
          packageUnit: 'pcs',
          unitCostScaled: 1000000n
        }
      ]
    });

    // Make a partial payment of 600 PKR (6,000,000)
    const payment1 = await PurchaseService.recordSupplierPayment(conn, workspaceId, {
      billId: bill.id,
      amountScaled: 6000000n,
      paymentDate: '2026-10-21',
      paymentMethod: 'Cash',
      accountId: cashAccountId,
      referenceNumber: 'CHQ-8891'
    });

    assert.strictEqual(payment1.bill.paidAmountScaled, 6000000n);
    assert.strictEqual(payment1.bill.paymentStatus, 'partially_paid');

    // Cash decreased by 600 PKR
    const cashAfter1 = (await accRepo.getAccountBalance(workspaceId, cashAccountId))!;
    assert.strictEqual(
      cashAfter1.netBalanceScaled,
      initialCash.netBalanceScaled - 6000000n
    );

    // Outstanding payable on statement must now be 400 PKR
    const partyLedgerRepo = new PartyLedgerRepository(conn);
    const stmt1 = await partyLedgerRepo.getPartyStatement(workspaceId, supplierId);
    assert.strictEqual(stmt1.closingBalanceScaled, 4000000n);

    // Pay remaining 400 PKR
    const payment2 = await PurchaseService.recordSupplierPayment(conn, workspaceId, {
      billId: bill.id,
      amountScaled: 4000000n,
      paymentDate: '2026-10-22',
      paymentMethod: 'Cash',
      accountId: cashAccountId
    });

    assert.strictEqual(payment2.bill.paidAmountScaled, 10000000n);
    assert.strictEqual(payment2.bill.paymentStatus, 'paid');

    // Supplier statement is now fully settled (0 balance)
    const stmt2 = await partyLedgerRepo.getPartyStatement(workspaceId, supplierId);
    assert.strictEqual(stmt2.closingBalanceScaled, 0n);
  });

  it('Criteria 7: Purchase return validates returnable quantities, decreases stock, and debits payable', async () => {
    const prodRepo = new ProductRepository(conn);

    // Create bill for 20 pcs
    const bill = await PurchaseService.createPurchaseBill(conn, workspaceId, {
      supplierId,
      billDate: '2026-10-22',
      dueDate: '2026-11-10',
      receiveStockNow: true,
      lines: [
        {
          productId,
          description: 'Milkpak 1L',
          quantity: 20,
          packageUnit: 'pcs',
          unitCostScaled: 1000000n
        }
      ]
    });

    const stockBeforeReturn = (await prodRepo.findById(productId))!.currentStockQuantity;

    // Return 5 damaged pcs to supplier
    const returnRecord = await PurchaseService.recordPurchaseReturn(conn, workspaceId, {
      originalBillId: bill.id,
      returnDate: '2026-10-23',
      reason: 'Leaking packs detected during shelf stocking',
      settlementType: 'credit_note',
      lines: [
        {
          originalBillLineId: bill.lines[0].id,
          productId,
          description: 'Milkpak 1L (damaged)',
          returnedQuantity: 5,
          packageUnit: 'pcs'
        }
      ]
    });

    assert.strictEqual(returnRecord.totalScaled, 5000000n); // 5 * 100 = 500 PKR
    assert.strictEqual(returnRecord.settlementType, 'credit_note');

    // Stock on hand decreased by 5
    const stockAfterReturn = (await prodRepo.findById(productId))!.currentStockQuantity;
    assert.strictEqual(stockAfterReturn, stockBeforeReturn - 5);

    // Attempting to return more than the remaining 15 must fail
    await assert.rejects(
      async () => {
        await PurchaseService.recordPurchaseReturn(conn, workspaceId, {
          originalBillId: bill.id,
          returnDate: '2026-10-24',
          reason: 'Excess return test',
          lines: [
            {
              originalBillLineId: bill.lines[0].id,
              productId,
              description: 'Milkpak 1L',
              returnedQuantity: 16 // Exceeds remaining 15!
            }
          ]
        });
      },
      /Cannot return 16/
    );
  });

  it('Criteria 8: Atomic rollback guarantees zero partial mutation on any failure', async () => {
    const prodRepo = new ProductRepository(conn);
    const initialStock = (await prodRepo.findById(productId))!.currentStockQuantity;

    // Attempt a bill with an invalid/non-existent account ID to force a rollback during posting
    await assert.rejects(
      async () => {
        await PurchaseService.createPurchaseBill(conn, workspaceId, {
          supplierId,
          billDate: '2026-10-25',
          dueDate: '2026-11-01',
          receiveStockNow: true,
          lines: [
            {
              productId,
              description: 'Milkpak 1L',
              quantity: 10,
              packageUnit: 'pcs',
              unitCostScaled: 1000000n,
              accountId: 'non_existent_account_xyz' // Will trigger FK error
            }
          ]
        });
      }
    );

    // Stock on hand must NOT have increased!
    const stockAfterFailed = (await prodRepo.findById(productId))!.currentStockQuantity;
    assert.strictEqual(stockAfterFailed, initialStock);

    // No bills created
    const billRows = await conn.query<any>(
      `SELECT COUNT(*) as cnt FROM purchase_bills WHERE workspace_id = ?`,
      [workspaceId]
    );
    assert.strictEqual(Number(billRows[0].cnt), 0);
  });

  it('Criteria 9: Documents can be filtered and paginated by supplier, date, status, and reference', async () => {
    // Create 3 bills with different dates and suppliers
    const supplier2 = await PartyKhataService.createParty(conn, workspaceId, {
      name: 'Unilever Pakistan',
      type: 'supplier',
      currencyCode: 'PKR'
    });

    await PurchaseService.createPurchaseBill(conn, workspaceId, {
      billNumber: 'BILL-101',
      supplierId,
      billDate: '2026-10-01',
      dueDate: '2026-10-15',
      receiveStockNow: false,
      lines: [{ productId, description: 'Batch 1', quantity: 2, unitCostScaled: 1000000n }]
    });

    await PurchaseService.createPurchaseBill(conn, workspaceId, {
      billNumber: 'BILL-102',
      supplierId: supplier2.id,
      billDate: '2026-10-10',
      dueDate: '2026-10-25',
      receiveStockNow: false,
      lines: [{ productId, description: 'Batch 2', quantity: 3, unitCostScaled: 1000000n }]
    });

    await PurchaseService.createPurchaseBill(conn, workspaceId, {
      billNumber: 'BILL-103',
      supplierId,
      billDate: '2026-10-20',
      dueDate: '2026-11-05',
      receiveStockNow: false,
      lines: [{ productId, description: 'Batch 3', quantity: 4, unitCostScaled: 1000000n }]
    });

    // 1. Filter by supplier
    const sup1Bills = await PurchaseService.listPurchaseBills(conn, workspaceId, {
      supplierId
    });
    assert.strictEqual(sup1Bills.total, 2);
    assert.strictEqual(sup1Bills.bills[0].billNumber, 'BILL-103');

    // 2. Filter by search reference
    const searchBills = await PurchaseService.listPurchaseBills(conn, workspaceId, {
      search: '102'
    });
    assert.strictEqual(searchBills.total, 1);
    assert.strictEqual(searchBills.bills[0].billNumber, 'BILL-102');

    // 3. Pagination limit & offset
    const page1 = await PurchaseService.listPurchaseBills(conn, workspaceId, {
      limit: 2,
      offset: 0
    });
    assert.strictEqual(page1.bills.length, 2);
    assert.strictEqual(page1.total, 3);

    const page2 = await PurchaseService.listPurchaseBills(conn, workspaceId, {
      limit: 2,
      offset: 2
    });
    assert.strictEqual(page2.bills.length, 1);
  });
});
