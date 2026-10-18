/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';
import { WorkspaceService, CrossWorkspaceIsolationError } from './WorkspaceService';
import { PartyKhataService } from './PartyKhataService';
import { PaymentRepository } from '../../infrastructure/database/repositories/PaymentRepository';
import { PartyLedgerRepository } from '../../infrastructure/database/repositories/PartyLedgerRepository';

describe('Application Service: Party Management, Khata & Ledger Module', () => {
  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);
    return conn;
  }

  it('supports customers, suppliers, and multi-role parties (distributors) without silent merge', async () => {
    const conn = await createTestDb(`test_party_roles_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Falcon Distribution Hub',
      businessType: 'distributor',
      currencyCode: 'PKR'
    });

    // 1. Create a customer party
    const customer = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Ali Retailer',
      type: 'customer',
      phone: '03001234567',
      companyName: 'Ali Store Ltd',
      contactPersonName: 'Ali Raza',
      contactPersonPhone: '03009876543',
      creditLimitScaled: 1000000000n // 100,000.00 PKR
    });

    assert.equal(customer.type, 'customer');
    assert.equal(customer.companyName, 'Ali Store Ltd');
    assert.equal(customer.contactPersonName, 'Ali Raza');
    assert.equal(customer.creditLimitScaled, 1000000000n);

    // 2. Create a supplier party
    const supplier = await PartyKhataService.createParty(conn, biz.id, {
      name: 'National Foods Mills',
      type: 'supplier',
      phone: '03112223344',
      companyName: 'National Foods Ltd',
      address: 'Plot 42, Industrial Zone'
    });

    assert.equal(supplier.type, 'supplier');

    // 3. Create a multi-role distributor party (both customer & supplier)
    const multiRole = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Metro Wholesale & Logistics',
      type: 'both',
      phone: '03215554433',
      companyName: 'Metro Cash & Carry',
      notes: 'Acts as bulk supplier of staples and buyer of packaged goods'
    });

    assert.equal(multiRole.type, 'both');

    // 4. Test duplicate search warning flow (identifies potential duplicates without silently merging)
    const duplicates = await PartyKhataService.checkDuplicates(conn, biz.id, 'Ali Retailer', '03001234567');
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].id, customer.id);
  });

  it('handles opening balances cleanly without distorting current-period sales or purchases', async () => {
    const conn = await createTestDb(`test_party_ob_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Sunrise Trading Co',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    // 1. Create customer with opening receivable balance (50,000.00 PKR)
    const customer = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Hamza Brothers',
      type: 'customer',
      openingBalanceScaled: 500000000n, // 50,000.00 PKR
      openingBalanceType: 'receivable',
      openingBalanceDate: '2026-01-01'
    });

    // Verify balance in Khata ledger
    const custBalance = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, customer.id);
    assert.equal(custBalance.receivableTotalScaled, 500000000n);
    assert.equal(custBalance.payableTotalScaled, 0n);
    assert.equal(custBalance.netBalanceScaled, 500000000n);
    assert.equal(custBalance.balanceType, 'receivable');

    // Verify statement shows opening balance entry
    const statement = await PartyKhataService.getPartyStatement(conn, biz.id, customer.id);
    assert.equal(statement.entries.length, 1);
    assert.equal(statement.entries[0].entryType, 'opening_balance');
    assert.equal(statement.entries[0].receivableAmountScaled, 500000000n);
    assert.equal(statement.entries[0].runningBalanceScaled, 500000000n);

    // 2. Create supplier with opening payable balance (30,000.00 PKR)
    const supplier = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Packaging World',
      type: 'supplier',
      openingBalanceScaled: 300000000n, // 30,000.00 PKR
      openingBalanceType: 'payable',
      openingBalanceDate: '2026-01-01'
    });

    const suppBalance = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, supplier.id);
    assert.equal(suppBalance.payableTotalScaled, 300000000n);
    assert.equal(suppBalance.netBalanceScaled, -300000000n);
    assert.equal(suppBalance.balanceType, 'payable');

    // 3. CRITICAL: Verify opening balances do NOT distort sales or purchase reports!
    const summary = await WorkspaceService.getBusinessSummary(conn, biz.id);
    assert.equal(summary.totalSalesScaled, 0n, 'Opening balance must not be counted as sales revenue');
    assert.equal(summary.totalPurchasesScaled, 0n, 'Opening balance must not be counted as purchases');
    assert.equal(summary.receivablesScaled, 500000000n);
    assert.equal(summary.payablesScaled, 300000000n);

    // 4. Verify opening balances reconcile with accounting control accounts (A/R 1200 and A/P 2010)
    const recon = await PartyKhataService.reconcileWithControlAccounts(conn, biz.id);
    assert.equal(recon.isReconciled, true);
    assert.equal(recon.customerLedgerTotalScaled, 500000000n);
    assert.equal(recon.controlAccountReceivableScaled, 500000000n);
    assert.equal(recon.supplierLedgerTotalScaled, 300000000n);
    assert.equal(recon.controlAccountPayableScaled, 300000000n);
  });

  it('supports receiving payments, multi-invoice allocations, partial payments, and unallocated credits', async () => {
    const conn = await createTestDb(`test_party_payments_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Bismillah Electronics',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const customer = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Tariq Commercial Stores',
      type: 'customer'
    });

    // Create Invoice 1: 15,000.00 PKR
    const inv1 = await WorkspaceService.createDocument(conn, biz.id, {
      documentType: 'sales_invoice',
      documentNumber: 'INV-1001',
      partyId: customer.id,
      partyName: customer.name,
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      lines: [
        { description: 'LED TV 43"', quantity: 1, unitPriceScaled: 150000000n }
      ]
    });

    // Record invoice in Khata
    await PartyKhataService.recordDocumentInKhata(conn, biz.id, {
      documentId: inv1.id,
      partyId: customer.id,
      documentNumber: inv1.documentNumber,
      documentType: 'sales_invoice',
      totalScaled: inv1.totalScaled,
      issueDate: inv1.issueDate,
      dueDate: inv1.dueDate
    });

    // Create Invoice 2: 25,000.00 PKR
    const inv2 = await WorkspaceService.createDocument(conn, biz.id, {
      documentType: 'sales_invoice',
      documentNumber: 'INV-1002',
      partyId: customer.id,
      partyName: customer.name,
      issueDate: '2026-10-05',
      dueDate: '2026-10-20',
      lines: [
        { description: 'Smart Refrigerator', quantity: 1, unitPriceScaled: 250000000n }
      ]
    });

    await PartyKhataService.recordDocumentInKhata(conn, biz.id, {
      documentId: inv2.id,
      partyId: customer.id,
      documentNumber: inv2.documentNumber,
      documentType: 'sales_invoice',
      totalScaled: inv2.totalScaled,
      issueDate: inv2.issueDate,
      dueDate: inv2.dueDate
    });

    // Customer balance before payment: 40,000.00 PKR
    let bal = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, customer.id);
    assert.equal(bal.netBalanceScaled, 400000000n);

    // Record a single payment of 35,000.00 PKR allocated across both invoices:
    // 15,000.00 to inv1 (fully paid), 15,000.00 to inv2 (partial payment), 5,000.00 unallocated advance
    const payment = await PartyKhataService.recordPayment(conn, biz.id, {
      partyId: customer.id,
      paymentType: 'customer_receipt',
      amountScaled: 350000000n, // 35,000.00 PKR
      paymentDate: '2026-10-10',
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'TXN-998877',
      notes: 'Partial settlement for invoices 1001 & 1002 plus credit deposit',
      allocations: [
        { documentId: inv1.id, amountScaled: 150000000n },
        { documentId: inv2.id, amountScaled: 150000000n }
      ]
    });

    assert.equal(payment.amountScaled, 350000000n);
    assert.equal(payment.allocatedAmountScaled, 300000000n);
    assert.equal(payment.unallocatedAmountScaled, 50000000n);
    assert.equal(payment.allocations.length, 2);

    // Verify Invoice 1 is marked paid and Invoice 2 is partial
    const docRepo = conn;
    const docs = await WorkspaceService.getDocuments(conn, biz.id);
    const updatedInv1 = docs.find(d => d.id === inv1.id);
    const updatedInv2 = docs.find(d => d.id === inv2.id);

    assert.equal(updatedInv1?.status, 'paid');
    assert.equal(updatedInv1?.paidAmountScaled, 150000000n);
    assert.equal(updatedInv2?.status, 'partial');
    assert.equal(updatedInv2?.paidAmountScaled, 150000000n);

    // Customer balance after payment: 40,000 - 35,000 = 5,000.00 PKR remaining receivable
    bal = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, customer.id);
    assert.equal(bal.netBalanceScaled, 50000000n);

    // Chronological statement check
    const statement = await PartyKhataService.getPartyStatement(conn, biz.id, customer.id);
    assert.equal(statement.entries.length, 3); // inv1, inv2, payment
    assert.equal(statement.closingBalanceScaled, 50000000n);
  });

  it('reverses a posted payment through an audited reversal process, preserving history', async () => {
    const conn = await createTestDb(`test_payment_reversal_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Prime Traders',
      businessType: 'services',
      currencyCode: 'PKR'
    });

    const supplier = await PartyKhataService.createParty(conn, biz.id, {
      name: 'Apex Raw Materials',
      type: 'supplier'
    });

    // Create purchase bill of 20,000.00 PKR
    const bill = await WorkspaceService.createDocument(conn, biz.id, {
      documentType: 'purchase_bill',
      documentNumber: 'BILL-501',
      partyId: supplier.id,
      partyName: supplier.name,
      issueDate: '2026-10-02',
      dueDate: '2026-10-16',
      lines: [
        { description: 'Raw Materials Batch 1', quantity: 1, unitPriceScaled: 200000000n }
      ]
    });

    await PartyKhataService.recordDocumentInKhata(conn, biz.id, {
      documentId: bill.id,
      partyId: supplier.id,
      documentNumber: bill.documentNumber,
      documentType: 'purchase_bill',
      totalScaled: bill.totalScaled,
      issueDate: bill.issueDate,
      dueDate: bill.dueDate
    });

    // Make supplier payment of 20,000.00 PKR
    const payment = await PartyKhataService.recordPayment(conn, biz.id, {
      partyId: supplier.id,
      paymentType: 'supplier_payment',
      amountScaled: 200000000n,
      paymentDate: '2026-10-05',
      paymentMethod: 'Cheque',
      referenceNumber: 'CHQ-10020',
      allocations: [
        { documentId: bill.id, amountScaled: 200000000n }
      ]
    });

    let bal = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, supplier.id);
    assert.equal(bal.netBalanceScaled, 0n);

    // Audit Reversal: Cheque bounced
    const reversed = await PartyKhataService.reversePayment(
      conn,
      biz.id,
      payment.id,
      'Cheque returned by bank due to signature mismatch'
    );

    assert.equal(reversed.isReversed, true);
    assert.equal(reversed.reversalReason, 'Cheque returned by bank due to signature mismatch');
    assert.notEqual(reversed.reversedAt, null);

    // History preserved: Payment record is NOT erased, it is marked reversed!
    const paymentRepo = new PaymentRepository(conn);
    const fetchedPayment = await paymentRepo.findById(payment.id);
    assert.notEqual(fetchedPayment, null);
    assert.equal(fetchedPayment?.isReversed, true);

    // Bill is restored to unpaid
    const docs = await WorkspaceService.getDocuments(conn, biz.id);
    const restoredBill = docs.find(d => d.id === bill.id);
    assert.equal(restoredBill?.status, 'unpaid');
    assert.equal(restoredBill?.paidAmountScaled, 0n);

    // Supplier balance is restored to 20,000.00 PKR payable
    bal = await PartyKhataService.getDerivedPartyBalance(conn, biz.id, supplier.id);
    assert.equal(bal.payableTotalScaled, 200000000n);
    assert.equal(bal.netBalanceScaled, -200000000n);
  });

  it('strictly isolates parties between Business A and Business B', async () => {
    const conn = await createTestDb(`test_party_isolation_${Date.now()}`);

    const bizA = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Alpha Wholesale',
      businessType: 'wholesale',
      currencyCode: 'PKR'
    });

    const bizB = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Beta Mart',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const partyA = await PartyKhataService.createParty(conn, bizA.id, {
      name: 'Confidential Client Alpha',
      type: 'customer'
    });

    const partyB = await PartyKhataService.createParty(conn, bizB.id, {
      name: 'Private Supplier Beta',
      type: 'supplier'
    });

    // 1. Business A cannot see Business B's parties
    const bizAParties = await WorkspaceService.getParties(conn, bizA.id);
    const bizBParties = await WorkspaceService.getParties(conn, bizB.id);

    assert.equal(bizAParties.some(p => p.id === partyB.id), false);
    assert.equal(bizBParties.some(p => p.id === partyA.id), false);

    // 2. Business A cannot record payments against Business B's party
    await assert.rejects(
      async () => {
        await PartyKhataService.recordPayment(conn, bizA.id, {
          partyId: partyB.id, // Belong to bizB
          paymentType: 'customer_receipt',
          amountScaled: 50000000n,
          paymentDate: '2026-10-10',
          paymentMethod: 'Cash'
        });
      },
      CrossWorkspaceIsolationError
    );

    // 3. Business B cannot set opening balance for Business A's party
    await assert.rejects(
      async () => {
        await PartyKhataService.setOpeningBalance(conn, bizB.id, partyA.id, {
          amountScaled: 100000000n,
          type: 'receivable'
        });
      },
      CrossWorkspaceIsolationError
    );
  });

  it('supports migration of legacy dues with explicit import mapping and control account reconciliation', async () => {
    const conn = await createTestDb(`test_legacy_dues_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Legacy Migration Enterprises',
      businessType: 'services',
      currencyCode: 'PKR'
    });

    // Explicit import mapping records representing legacy dues from previous software/books
    const legacyRecords = [
      {
        partyName: 'Old Customer Alpha',
        role: 'customer' as const,
        phone: '03001112233',
        companyName: 'Alpha Corp',
        dueType: 'receivable' as const,
        dueAmountScaled: 250000000n, // 25,000.00 PKR
        asOfDate: '2026-01-01',
        referenceNotes: 'Migrated from Tally 2025 closing',
        creditLimitScaled: 500000000n
      },
      {
        partyName: 'Old Vendor Beta',
        role: 'supplier' as const,
        phone: '03004445566',
        companyName: 'Beta Suppliers',
        dueType: 'payable' as const,
        dueAmountScaled: 150000000n, // 15,000.00 PKR
        asOfDate: '2026-01-01',
        referenceNotes: 'Migrated from manual ledger',
        creditLimitScaled: 0n
      },
      {
        partyName: 'Dual Distributor Gamma',
        role: 'both' as const,
        phone: '03007778899',
        companyName: 'Gamma Distribution',
        dueType: 'receivable' as const,
        dueAmountScaled: 80000000n, // 8,000.00 PKR
        asOfDate: '2026-01-01',
        referenceNotes: 'Net opening due',
        creditLimitScaled: 1000000000n
      }
    ];

    const result = await PartyKhataService.importLegacyDues(conn, biz.id, legacyRecords);

    assert.equal(result.totalImported, 3);
    assert.equal(result.totalReceivablesImportedScaled, 330000000n); // 25,000 + 8,000 = 33,000
    assert.equal(result.totalPayablesImportedScaled, 150000000n); // 15,000

    // Verify opening balances do NOT count as sales or purchases
    const summary = await WorkspaceService.getBusinessSummary(conn, biz.id);
    assert.equal(summary.totalSalesScaled, 0n);
    assert.equal(summary.totalPurchasesScaled, 0n);

    // Verify control accounts reconciliation
    const recon = await PartyKhataService.reconcileWithControlAccounts(conn, biz.id);
    assert.equal(recon.isReconciled, true);
    assert.equal(recon.customerLedgerTotalScaled, 330000000n);
    assert.equal(recon.controlAccountReceivableScaled, 330000000n);
    assert.equal(recon.supplierLedgerTotalScaled, 150000000n);
    assert.equal(recon.controlAccountPayableScaled, 150000000n);

    // Verify statements
    const stmt = await PartyKhataService.getPartyStatement(conn, biz.id, result.parties[0].id);
    assert.equal(stmt.entries.length, 1);
    assert.equal(stmt.entries[0].entryType, 'opening_balance');
    assert.equal(stmt.entries[0].receivableAmountScaled, 250000000n);
    assert.equal(stmt.entries[0].runningBalanceScaled, 250000000n);
  });
});

