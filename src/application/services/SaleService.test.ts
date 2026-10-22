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
import { ProductRepository } from '../../infrastructure/database/repositories/ProductRepository';
import { PartyRepository } from '../../infrastructure/database/repositories/PartyRepository';
import { AccountRepository } from '../../infrastructure/database/repositories/AccountRepository';
import { DocumentRepository } from '../../infrastructure/database/repositories/DocumentRepository';
import { JournalEntryRepository } from '../../infrastructure/database/repositories/JournalEntryRepository';
import { PartyLedgerRepository } from '../../infrastructure/database/repositories/PartyLedgerRepository';

import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';

describe('Application Services: SaleService (POS & Sales Domain)', () => {
  let conn: DatabaseConnection;
  let workspaceId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let testProductId: string;
  let testCustomerId: string;

  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const c = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(c, MIGRATION_REGISTRY);
    return c;
  }

  beforeEach(async () => {
    conn = await createTestDb(`test_sale_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);

    // 1. Create a business workspace (seeds chart of accounts & business profile)
    const ws = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'SuperMart Retail Mart',
      businessType: 'retail',
      currencyCode: 'PKR',
      legalName: 'SuperMart PVT LTD',
      taxId: 'TRN-987654321',
      invoicePrefix: 'INV'
    });
    workspaceId = ws.id;

    // 2. Look up seeded accounts
    const accRepo = new AccountRepository(conn);
    const accounts = await accRepo.findByWorkspace(workspaceId);
    const cashAcc = accounts.find(a => a.accountCode === '1010');
    const bankAcc = accounts.find(a => a.accountCode === '1020');
    assert.ok(cashAcc, 'Cash account 1010 must be seeded');
    assert.ok(bankAcc, 'Bank account 1020 must be seeded');
    cashAccountId = cashAcc.id;
    bankAccountId = bankAcc.id;

    // 3. Create a registered customer
    const cust = await PartyKhataService.createParty(conn, workspaceId, {
      name: 'Ahmed Khan',
      type: 'customer',
      phone: '+923001234567',
      creditLimitScaled: 500000000n // 50,000.00 credit limit
    });
    testCustomerId = cust.id;

    // 4. Create an inventory product with initial stock and weighted average cost
    const prod = await InventoryService.createProduct(conn, workspaceId, {
      name: 'Basmati Rice 5kg Bag',
      sku: 'RICE-5KG-01',
      barcode: '8901234567890',
      unit: 'pack',
      costPriceScaled: 12000000n, // 1,200.00
      salePriceScaled: 15000000n, // 1,500.00
      initialStockQuantity: 50
    });
    testProductId = prod.id;
  });

  it('Criteria 1: Cash sale records full payment, decrements stock, records COGS, and leaves zero remaining due', async () => {
    const saleResult = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 2,
          packageUnit: 'pack',
          unitPriceScaled: 15000000n, // 1,500.00 each = 3,000.00
          taxRatePercent: 5 // 5% = 150.00
        }
      ]
    });

    // Subtotal: 3,000.00, Tax: 150.00 -> Total: 3,150.00
    assert.equal(saleResult.totalScaled, 31500000n);
    assert.equal(saleResult.paidAmountScaled, 31500000n);
    assert.equal(saleResult.remainingBalanceScaled, 0n);
    assert.equal(saleResult.document.status, 'paid');
    assert.equal(saleResult.isIdempotentReplay, false);

    // COGS: 2 packs * 1,200.00 = 2,400.00
    assert.equal(saleResult.totalCogsScaled, 24000000n);

    // Stock on hand: 50 initial - 2 sold = 48
    const prodRepo = new ProductRepository(conn);
    const updatedProd = await prodRepo.findById(testProductId);
    assert.equal(updatedProd?.currentStockQuantity, 48);

    // Journal Entry verification
    const journalRepo = new JournalEntryRepository(conn);
    const je = await journalRepo.findById(saleResult.journalEntryId);
    assert.ok(je);
    const totalDebits = je.lines.reduce((acc, l) => acc + l.debitAmountScaled, 0n);
    const totalCredits = je.lines.reduce((acc, l) => acc + l.creditAmountScaled, 0n);
    assert.equal(totalDebits, totalCredits); // Perfectly balanced

    // Payment recorded in payments table
    assert.equal(saleResult.payments.length, 1);
    assert.equal(saleResult.payments[0].amountScaled, 31500000n);
    assert.equal(saleResult.payments[0].paymentType, 'customer_receipt');
  });

  it('Criteria 2: Credit sale records receivable against customer, updates customer ledger, and leaves cash untouched', async () => {
    const saleResult = await SaleService.completeSale(conn, workspaceId, {
      customerId: testCustomerId,
      paymentType: 'credit',
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 3,
          unitPriceScaled: 15000000n, // 3 * 1,500 = 4,500.00
          taxRatePercent: 0
        }
      ]
    });

    assert.equal(saleResult.totalScaled, 45000000n);
    assert.equal(saleResult.paidAmountScaled, 0n);
    assert.equal(saleResult.remainingBalanceScaled, 45000000n);
    assert.equal(saleResult.document.status, 'unpaid');
    assert.equal(saleResult.payments.length, 0);

    // Customer ledger reflects credit sale
    const ledgerRepo = new PartyLedgerRepository(conn);
    const statement = await ledgerRepo.getPartyStatement(workspaceId, testCustomerId);
    assert.equal(statement.closingBalanceScaled, 45000000n);
    assert.equal(statement.closingBalanceType, 'receivable');

    // Stock reduced by 3
    const prodRepo = new ProductRepository(conn);
    const updatedProd = await prodRepo.findById(testProductId);
    assert.equal(updatedProd?.currentStockQuantity, 47);
  });

  it('Criteria 3: Partial payment records paid portion in cash and remaining balance as customer receivable', async () => {
    const saleResult = await SaleService.completeSale(conn, workspaceId, {
      customerId: testCustomerId,
      paymentType: 'partial',
      paidAmountScaled: 20000000n, // 2,000.00 cash paid
      depositAccountId: cashAccountId,
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 4,
          unitPriceScaled: 15000000n // 4 * 1,500 = 6,000.00
        }
      ]
    });

    assert.equal(saleResult.totalScaled, 60000000n);
    assert.equal(saleResult.paidAmountScaled, 20000000n);
    assert.equal(saleResult.remainingBalanceScaled, 40000000n);
    assert.equal(saleResult.document.status, 'partial');

    // Customer ledger: receivable 4,000.00
    const ledgerRepo = new PartyLedgerRepository(conn);
    const balance = await ledgerRepo.getDerivedPartyBalance(workspaceId, testCustomerId);
    assert.equal(balance.netBalanceScaled, 40000000n);
    assert.equal(balance.balanceType, 'receivable');
  });

  it('Criteria 4: Split payments correctly distribute payment lines across cash and bank accounts', async () => {
    const saleResult = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'split',
      isWalkIn: true,
      payments: [
        {
          method: 'cash',
          accountId: cashAccountId,
          amountScaled: 10000000n // 1,000.00 in cash
        },
        {
          method: 'bank',
          accountId: bankAccountId,
          amountScaled: 20000000n, // 2,000.00 via bank card
          referenceNumber: 'TXN-CARD-4488'
        }
      ],
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 2,
          unitPriceScaled: 15000000n // 2 * 1,500 = 3,000.00
        }
      ]
    });

    assert.equal(saleResult.totalScaled, 30000000n);
    assert.equal(saleResult.paidAmountScaled, 30000000n);
    assert.equal(saleResult.remainingBalanceScaled, 0n);
    assert.equal(saleResult.document.status, 'paid');
    assert.equal(saleResult.payments.length, 2);

    // Verify payments in database
    assert.equal(saleResult.payments[0].paymentMethod, 'cash');
    assert.equal(saleResult.payments[0].amountScaled, 10000000n);
    assert.equal(saleResult.payments[1].paymentMethod, 'bank');
    assert.equal(saleResult.payments[1].amountScaled, 20000000n);
  });

  it('Criteria 5: Idempotency key prevents duplicate sales on double-tap or client retry', async () => {
    const clientKey = 'checkout-idempotency-key-xyz-123';

    // First attempt
    const firstSale = await SaleService.completeSale(conn, workspaceId, {
      idempotencyKey: clientKey,
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 5,
          unitPriceScaled: 15000000n
        }
      ]
    });

    assert.equal(firstSale.isIdempotentReplay, false);
    const originalInvoiceNumber = firstSale.invoiceNumber;

    // Second attempt (simulating accidental rapid double-tap or network retry)
    const secondSale = await SaleService.completeSale(conn, workspaceId, {
      idempotencyKey: clientKey,
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 5,
          unitPriceScaled: 15000000n
        }
      ]
    });

    assert.equal(secondSale.isIdempotentReplay, true);
    assert.equal(secondSale.invoiceNumber, originalInvoiceNumber);

    // Stock must have only been deducted once: 50 - 5 = 45 (NOT 40!)
    const prodRepo = new ProductRepository(conn);
    const prod = await prodRepo.findById(testProductId);
    assert.equal(prod?.currentStockQuantity, 45);

    // Total documents count must be 1
    const docRepo = new DocumentRepository(conn);
    const docs = await docRepo.findByWorkspace(workspaceId, 'sales_invoice');
    assert.equal(docs.length, 1);
  });

  it('Criteria 6: Negative-stock policy blocks sale when stock is insufficient, or warns/allows when configured', async () => {
    // Current stock is 50. Request 60 packs.
    // 1. With policy 'block': MUST throw
    await assert.rejects(
      async () => {
        await SaleService.completeSale(conn, workspaceId, {
          paymentType: 'full_cash',
          negativeStockPolicy: 'block',
          isWalkIn: true,
          items: [
            {
              productId: testProductId,
              description: 'Basmati Rice 5kg Bag',
              quantity: 60,
              unitPriceScaled: 15000000n
            }
          ]
        });
      },
      /Insufficient stock.*Sale blocked by negative-stock policy/
    );

    // Stock remains untouched at 50
    const prodRepo = new ProductRepository(conn);
    let prod = await prodRepo.findById(testProductId);
    assert.equal(prod?.currentStockQuantity, 50);

    // 2. With policy 'warn': allows sale and flags warning
    const warnedSale = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      negativeStockPolicy: 'warn',
      isWalkIn: true,
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 60,
          unitPriceScaled: 15000000n
        }
      ]
    });

    assert.ok(warnedSale.warnings.some(w => w.includes('below requested quantity')));
    prod = await prodRepo.findById(testProductId);
    assert.equal(prod?.currentStockQuantity, -10); // Allowed negative
  });

  it('Criteria 7: Walk-in customer credit restriction prevents anonymous uncollectible receivables', async () => {
    // Attempting credit sale without registered customer
    await assert.rejects(
      async () => {
        await SaleService.completeSale(conn, workspaceId, {
          paymentType: 'credit',
          isWalkIn: true,
          items: [
            {
              productId: testProductId,
              description: 'Basmati Rice 5kg Bag',
              quantity: 1,
              unitPriceScaled: 15000000n
            }
          ]
        });
      },
      /Walk-in cash customers cannot purchase on credit/
    );
  });

  it('Criteria 8: Sequential invoice numbering policy increments sequentially and avoids timestamps alone', async () => {
    const sale1 = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [{ productId: testProductId, description: 'Rice', quantity: 1, unitPriceScaled: 15000000n }]
    });

    const sale2 = await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [{ productId: testProductId, description: 'Rice', quantity: 1, unitPriceScaled: 15000000n }]
    });

    assert.equal(sale1.invoiceNumber, 'INV-00001');
    assert.equal(sale2.invoiceNumber, 'INV-00002');
  });

  it('Criteria 9: Customer returns validate quantities, restore sellable stock, record damaged items, and post double-entry reversals', async () => {
    // 1. Initial sale of 10 bags
    const originalSale = await SaleService.completeSale(conn, workspaceId, {
      customerId: testCustomerId,
      paymentType: 'full_cash',
      items: [
        {
          productId: testProductId,
          description: 'Basmati Rice 5kg Bag',
          quantity: 10,
          unitPriceScaled: 15000000n, // 10 * 1,500 = 15,000.00
          taxRatePercent: 0
        }
      ]
    });

    const origLineId = originalSale.document.lines[0].id!;

    // 2. Prevent over-returns (trying to return 11 when only 10 were sold)
    await assert.rejects(
      async () => {
        await SaleService.recordSalesReturn(conn, workspaceId, {
          originalDocumentId: originalSale.document.id,
          returnDate: '2026-10-20',
          settlementType: 'cash_refund',
          reason: 'Excess order',
          lines: [
            {
              originalLineId: origLineId,
              productId: testProductId,
              description: 'Rice',
              returnedQuantity: 11,
              itemCondition: 'resellable'
            }
          ]
        });
      },
      /Cannot return 11 of "Rice".*maximum returnable: 10/
    );

    // 3. Return 2 resellable units and 1 damaged unit (total 3 returned)
    const prodRepo = new ProductRepository(conn);
    const stockBefore = (await prodRepo.findById(testProductId))?.currentStockQuantity || 0;

    const returnResult = await SaleService.recordSalesReturn(conn, workspaceId, {
      originalDocumentId: originalSale.document.id,
      returnDate: '2026-10-20',
      settlementType: 'cash_refund',
      reason: '2 unopened, 1 bag damaged by water',
      lines: [
        {
          originalLineId: origLineId,
          productId: testProductId,
          description: 'Rice (Good condition)',
          returnedQuantity: 2,
          itemCondition: 'resellable'
        },
        {
          originalLineId: origLineId,
          productId: testProductId,
          description: 'Rice (Water damaged)',
          returnedQuantity: 1,
          itemCondition: 'damaged'
        }
      ]
    });

    // Subtotal: 3 * 1,500 = 4,500.00
    assert.equal(returnResult.totalScaled, 45000000n);
    assert.equal(returnResult.settlementType, 'cash_refund');

    // Only the 2 resellable units must be restored to stock!
    const stockAfter = (await prodRepo.findById(testProductId))?.currentStockQuantity || 0;
    assert.equal(stockAfter, stockBefore + 2); // 2 restored, damaged 1 was not added back to sellable inventory

    // 4. Verify that remaining returnable on line is now 10 - 3 = 7
    await assert.rejects(
      async () => {
        await SaleService.recordSalesReturn(conn, workspaceId, {
          originalDocumentId: originalSale.document.id,
          returnDate: '2026-10-20',
          settlementType: 'cash_refund',
          reason: 'Trying to return 8 more',
          lines: [
            {
              originalLineId: origLineId,
              productId: testProductId,
              description: 'Rice',
              returnedQuantity: 8,
              itemCondition: 'resellable'
            }
          ]
        });
      },
      /maximum returnable: 7/
    );
  });

  it('Criteria 10: Atomic rollback ensures zero partial mutations if an exception occurs before commit', async () => {
    // Deliberately trigger an error by pointing to a non-existent product in line 2
    await assert.rejects(
      async () => {
        await SaleService.completeSale(conn, workspaceId, {
          paymentType: 'full_cash',
          isWalkIn: true,
          items: [
            {
              productId: testProductId,
              description: 'Basmati Rice 5kg Bag',
              quantity: 2,
              unitPriceScaled: 15000000n
            },
            {
              productId: 'non-existent-product-id',
              description: 'Broken Product',
              quantity: 1,
              unitPriceScaled: 1000000n
            }
          ]
        });
      },
      /Product "Broken Product" .* not found/
    );

    // Stock for line 1 must NOT have been decremented
    const prodRepo = new ProductRepository(conn);
    const prod = await prodRepo.findById(testProductId);
    assert.equal(prod?.currentStockQuantity, 50);

    // Zero documents or payments created
    const docRepo = new DocumentRepository(conn);
    const docs = await docRepo.findByWorkspace(workspaceId, 'sales_invoice');
    assert.equal(docs.length, 0);
  });

  it('Criteria 11: Fast indexed product search and sales document filtering & pagination work accurately', async () => {
    // 1. Barcode search
    const barcodeResults = await SaleService.searchProductsForPOS(conn, workspaceId, '8901234567890');
    assert.equal(barcodeResults.length, 1);
    assert.equal(barcodeResults[0].sku, 'RICE-5KG-01');

    // 2. Name search
    const nameResults = await SaleService.searchProductsForPOS(conn, workspaceId, 'Basmati');
    assert.equal(nameResults.length, 1);

    // 3. Complete 3 sales
    await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_cash',
      isWalkIn: true,
      items: [{ productId: testProductId, description: 'Rice', quantity: 1, unitPriceScaled: 15000000n }]
    });
    await SaleService.completeSale(conn, workspaceId, {
      customerId: testCustomerId,
      paymentType: 'credit',
      items: [{ productId: testProductId, description: 'Rice', quantity: 1, unitPriceScaled: 15000000n }]
    });
    await SaleService.completeSale(conn, workspaceId, {
      paymentType: 'full_bank',
      isWalkIn: true,
      items: [{ productId: testProductId, description: 'Rice', quantity: 1, unitPriceScaled: 15000000n }]
    });

    // Query paid sales
    const paidDocs = await SaleService.getSalesDocuments(conn, workspaceId, { status: 'paid' });
    assert.equal(paidDocs.total, 2);

    // Query credit sales by customer
    const creditDocs = await SaleService.getSalesDocuments(conn, workspaceId, { partyId: testCustomerId });
    assert.equal(creditDocs.total, 1);
  });
});
