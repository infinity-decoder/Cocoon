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
import { PostingService } from './PostingService';
import { InterWorkspaceTransferService } from './InterWorkspaceTransferService';
import { AccountRepository } from '../../infrastructure/database/repositories/AccountRepository';
import { JournalEntryRepository } from '../../infrastructure/database/repositories/JournalEntryRepository';
import { TransferRepository } from '../../infrastructure/database/repositories/TransferRepository';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from '../../infrastructure/database/migrations/002_business_workspaces_ledger_parties';

describe('Application Service: Accounting Core & Linked Transfers', () => {
  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);
    return conn;
  }

  it('enforces that every posted journal balances and rejects unbalanced entries', async () => {
    const conn = await createTestDb(`test_journal_balance_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Alpha Traders',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const accCash = `acc_${biz.id}_1010`;
    const accSales = `acc_${biz.id}_4010`;

    // 1. Unbalanced entry must fail
    await assert.rejects(
      async () => {
        await PostingService.postJournal(conn, {
          workspaceId: biz.id,
          entryDate: '2026-10-15',
          description: 'Unbalanced Cash Sale',
          sourceType: 'manual',
          lines: [
            { accountId: accCash, debitAmountScaled: 100000000n, creditAmountScaled: 0n },
            { accountId: accSales, debitAmountScaled: 0n, creditAmountScaled: 80000000n } // 8,000 vs 10,000!
          ]
        });
      },
      /Journal entry is unbalanced/
    );

    // Verify nothing was inserted (rollback verified)
    const journalRepo = new JournalEntryRepository(conn);
    const { totalCount } = await journalRepo.findByWorkspace(biz.id);
    assert.equal(totalCount, 0);

    // 2. Balanced entry succeeds
    const posted = await PostingService.postJournal(conn, {
      workspaceId: biz.id,
      entryDate: '2026-10-15',
      description: 'Balanced Cash Sale',
      sourceType: 'manual',
      lines: [
        { accountId: accCash, debitAmountScaled: 100000000n, creditAmountScaled: 0n },
        { accountId: accSales, debitAmountScaled: 0n, creditAmountScaled: 100000000n }
      ]
    });

    assert.equal(posted.isPosted, true);
    assert.equal(posted.status, 'posted');
    assert.equal(posted.lines.length, 2);

    // Verify trial balance is balanced
    const tb = await WorkspaceService.getTrialBalance(conn, biz.id);
    assert.equal(tb.isBalanced, true);
    assert.equal(tb.totalDebitsScaled, 100000000n);
    assert.equal(tb.totalCreditsScaled, 100000000n);
  });

  it('Owner contributes capital: business debits cash/bank and credits owner capital without counting as revenue', async () => {
    const conn = await createTestDb(`test_owner_capital_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Falcon Logistics',
      businessType: 'services',
      currencyCode: 'PKR'
    });

    const personalWsId = DEFAULT_PERSONAL_WORKSPACE_ID;
    const personalCashAcc = `acc_${personalWsId}_1010`;
    const bizBankAcc = `acc_${biz.id}_1020`;

    // 100,000 PKR Capital contribution
    const result = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: personalWsId,
      destinationWorkspaceId: biz.id,
      sourceAccountId: personalCashAcc,
      destinationAccountId: bizBankAcc,
      amountScaled: 1000000000n, // 100,000.00 PKR
      transferDate: '2026-10-01',
      transferType: 'owner_capital',
      note: 'Seed capital injection'
    });

    assert.equal(result.transfer.status, 'completed');
    assert.equal(result.transfer.transferType, 'owner_capital');

    // Verify Business accounts
    const accRepo = new AccountRepository(conn);
    const bizBankBal = await accRepo.getAccountBalance(biz.id, bizBankAcc);
    assert.equal(bizBankBal?.netBalanceScaled, 1000000000n); // 100,000 in bank

    const bizCapitalBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_3000`);
    assert.equal(bizCapitalBal?.netBalanceScaled, 1000000000n); // 100,000 in Owner Capital

    // CRITICAL: Owner funding must NOT be counted as business revenue!
    const bizSalesBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_4010`);
    assert.equal(bizSalesBal?.netBalanceScaled, 0n);

    const summary = await WorkspaceService.getBusinessSummary(conn, biz.id);
    assert.equal(summary.totalSalesScaled, 0n);

    // Verify Personal accounts reflect reduction in personal cash
    const personalCashBal = await accRepo.getAccountBalance(personalWsId, personalCashAcc);
    assert.equal(personalCashBal?.totalCreditScaled, 1000000000n);

    // Verify statements show linked references
    assert.equal(result.sourceJournal.referenceType, 'inter_workspace_transfer');
    assert.equal(result.sourceJournal.referenceId, result.transfer.id);
    assert.equal(result.destinationJournal.referenceType, 'inter_workspace_transfer');
    assert.equal(result.destinationJournal.referenceId, result.transfer.id);
  });

  it('Owner lends money to business: credits Due to Owner liability without counting as revenue', async () => {
    const conn = await createTestDb(`test_owner_loan_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Crescent Textile',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const personalWsId = DEFAULT_PERSONAL_WORKSPACE_ID;
    const personalCashAcc = `acc_${personalWsId}_1010`;
    const bizBankAcc = `acc_${biz.id}_1020`;

    // 50,000 PKR Owner Loan
    const result = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: personalWsId,
      destinationWorkspaceId: biz.id,
      sourceAccountId: personalCashAcc,
      destinationAccountId: bizBankAcc,
      amountScaled: 500000000n, // 50,000.00 PKR
      transferDate: '2026-10-02',
      transferType: 'owner_loan',
      note: 'Emergency working capital loan'
    });

    const accRepo = new AccountRepository(conn);
    // Destination: Due to Owner (2030)
    const dueToOwnerBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_2030`);
    assert.equal(dueToOwnerBal?.netBalanceScaled, 500000000n);
    assert.equal(dueToOwnerBal?.type, 'liability');

    // Revenue must remain 0
    const bizSalesBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_4010`);
    assert.equal(bizSalesBal?.netBalanceScaled, 0n);

    // Personal: Due from Business (1400)
    const dueFromBizBal = await accRepo.getAccountBalance(personalWsId, `acc_${personalWsId}_1400`);
    assert.equal(dueFromBizBal?.netBalanceScaled, 500000000n);
    assert.equal(dueFromBizBal?.type, 'asset');
  });

  it('Owner withdraws money: distinguished as drawing or loan repayment without misclassifying as operating expense', async () => {
    const conn = await createTestDb(`test_owner_drawings_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Omega Electronics',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const personalWsId = DEFAULT_PERSONAL_WORKSPACE_ID;
    const personalCashAcc = `acc_${personalWsId}_1010`;
    const bizCashAcc = `acc_${biz.id}_1010`;

    // 1. Owner drawing (equity withdrawal): 20,000 PKR
    const drawingResult = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: biz.id,
      destinationWorkspaceId: personalWsId,
      sourceAccountId: bizCashAcc,
      destinationAccountId: personalCashAcc,
      amountScaled: 200000000n,
      transferDate: '2026-10-05',
      transferType: 'owner_drawing',
      note: 'Monthly owner living drawing'
    });

    const accRepo = new AccountRepository(conn);
    const drawingAccBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_3010`);
    assert.equal(drawingAccBal?.netBalanceScaled, 200000000n);
    assert.equal(drawingAccBal?.type, 'equity');

    // Must NOT be misclassified as an operating expense (Operating Expenses 5020 / 6000 is 0)
    const opexBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_5020`);
    assert.equal(opexBal?.netBalanceScaled, 0n);

    // 2. Owner loan repayment: 15,000 PKR
    const repaymentResult = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: biz.id,
      destinationWorkspaceId: personalWsId,
      sourceAccountId: bizCashAcc,
      destinationAccountId: personalCashAcc,
      amountScaled: 150000000n,
      transferDate: '2026-10-06',
      transferType: 'owner_loan_repayment',
      note: 'Partial repayment of owner loan'
    });

    const dueToBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_2030`);
    assert.equal(dueToBal?.totalDebitScaled, 150000000n);
  });

  it('Owner pays supplier directly on behalf of business: settles supplier obligation without duplicating purchase expense', async () => {
    const conn = await createTestDb(`test_owner_direct_supplier_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'SuperMart',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const personalWsId = DEFAULT_PERSONAL_WORKSPACE_ID;
    const personalCashAcc = `acc_${personalWsId}_1010`;

    // Owner settles 35,000 PKR vendor obligation directly from personal wallet
    const result = await InterWorkspaceTransferService.recordOwnerDirectSupplierPayment(conn, {
      businessWorkspaceId: biz.id,
      personalWorkspaceId: personalWsId,
      personalCashAccountId: personalCashAcc,
      amountScaled: 350000000n,
      paymentDate: '2026-10-08',
      fundingType: 'owner_loan',
      note: 'Owner paid supplier invoice via personal cheque'
    });

    assert.equal(result.transfer.status, 'completed');

    const accRepo = new AccountRepository(conn);
    // Business debited A/P (2010) and credited Due to Owner (2030)
    const apBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_2010`);
    assert.equal(apBal?.totalDebitScaled, 350000000n);

    const dueToBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_2030`);
    assert.equal(dueToBal?.netBalanceScaled, 350000000n);

    // Operating expenses are untouched (no duplicate expense)
    const opexBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_5020`);
    assert.equal(opexBal?.netBalanceScaled, 0n);
  });

  it('Intra-workspace transfer between cash and bank: records two asset sides without income or expense', async () => {
    const conn = await createTestDb(`test_cash_bank_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Apex Wholesale',
      businessType: 'wholesale',
      currencyCode: 'PKR'
    });

    const cashAcc = `acc_${biz.id}_1010`;
    const bankAcc = `acc_${biz.id}_1020`;

    // Deposit 40,000 PKR cash to bank
    const transferEntry = await PostingService.postAccountTransfer(conn, {
      workspaceId: biz.id,
      sourceAccountId: cashAcc,
      destinationAccountId: bankAcc,
      amountScaled: 400000000n,
      transferDate: '2026-10-10',
      description: 'Cash deposit to Habib Bank'
    });

    assert.equal(transferEntry.isPosted, true);

    const accRepo = new AccountRepository(conn);
    const bankBal = await accRepo.getAccountBalance(biz.id, bankAcc);
    assert.equal(bankBal?.netBalanceScaled, 400000000n);

    const cashBal = await accRepo.getAccountBalance(biz.id, cashAcc);
    assert.equal(cashBal?.netBalanceScaled, -400000000n);

    // Income and expenses must be 0
    const salesBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_4010`);
    assert.equal(salesBal?.netBalanceScaled, 0n);
    const expBal = await accRepo.getAccountBalance(biz.id, `acc_${biz.id}_5020`);
    assert.equal(expBal?.netBalanceScaled, 0n);
  });

  it('Transfer atomicity and idempotency: failed paired transfers leave neither side committed, retrying does not duplicate', async () => {
    const conn = await createTestDb(`test_atomicity_idempotency_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'SafeTech Systems',
      businessType: 'services',
      currencyCode: 'PKR'
    });

    const personalWsId = DEFAULT_PERSONAL_WORKSPACE_ID;
    const personalCashAcc = `acc_${personalWsId}_1010`;
    const bizBankAcc = `acc_${biz.id}_1020`;
    const idempotencyKey = 'xfer_idempotency_key_test_123';

    // 1. Same-workspace transfer must be rejected
    await assert.rejects(
      async () => {
        await InterWorkspaceTransferService.recordTransfer(conn, {
          sourceWorkspaceId: biz.id,
          destinationWorkspaceId: biz.id, // Rejected!
          sourceAccountId: `acc_${biz.id}_1010`,
          destinationAccountId: bizBankAcc,
          amountScaled: 100000000n,
          transferDate: '2026-10-12',
          transferType: 'owner_capital'
        });
      },
      /Same-workspace transfer rejected/
    );

    // 2. Successful paired transfer with idempotencyKey
    const firstAttempt = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: personalWsId,
      destinationWorkspaceId: biz.id,
      sourceAccountId: personalCashAcc,
      destinationAccountId: bizBankAcc,
      amountScaled: 600000000n,
      transferDate: '2026-10-12',
      transferType: 'owner_capital',
      idempotencyKey
    });

    assert.equal(firstAttempt.transfer.amountScaled, 600000000n);

    // 3. Retry with same idempotencyKey: must return existing without duplicate posting!
    const secondAttempt = await InterWorkspaceTransferService.recordTransfer(conn, {
      sourceWorkspaceId: personalWsId,
      destinationWorkspaceId: biz.id,
      sourceAccountId: personalCashAcc,
      destinationAccountId: bizBankAcc,
      amountScaled: 600000000n,
      transferDate: '2026-10-12',
      transferType: 'owner_capital',
      idempotencyKey
    });

    assert.equal(secondAttempt.transfer.id, firstAttempt.transfer.id);

    // Verify there are not 2 transfers in database
    const transferRepo = new TransferRepository(conn);
    const { totalCount } = await transferRepo.findByWorkspace(biz.id);
    assert.equal(totalCount, 1);
  });

  it('Auditability & reversals: posted journals are immutable, reversals flip debits/credits and prevent double reversal', async () => {
    const conn = await createTestDb(`test_reversals_${Date.now()}`);
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Audited Commerce',
      businessType: 'retail',
      currencyCode: 'PKR'
    });

    const cashAcc = `acc_${biz.id}_1010`;
    const salesAcc = `acc_${biz.id}_4010`;

    // 1. Post original journal entry
    const original = await PostingService.postJournal(conn, {
      workspaceId: biz.id,
      entryDate: '2026-10-14',
      description: 'Sale to be reversed',
      sourceType: 'manual',
      lines: [
        { accountId: cashAcc, debitAmountScaled: 250000000n, creditAmountScaled: 0n },
        { accountId: salesAcc, debitAmountScaled: 0n, creditAmountScaled: 250000000n }
      ]
    });

    assert.equal(original.status, 'posted');

    // 2. Reverse original journal entry
    const reversal = await PostingService.reverseJournal(
      conn,
      biz.id,
      original.id,
      'Customer returned item for full cash refund'
    );

    assert.equal(reversal.sourceType, 'reversal');
    assert.equal(reversal.reversalOfEntryId, original.id);

    // Verify debits and credits were flipped in reversal
    const revCashLine = reversal.lines.find(l => l.accountId === cashAcc);
    const revSalesLine = reversal.lines.find(l => l.accountId === salesAcc);
    assert.equal(revCashLine?.creditAmountScaled, 250000000n);
    assert.equal(revSalesLine?.debitAmountScaled, 250000000n);

    // 3. Original entry is marked reversed and cannot be reversed again
    const journalRepo = new JournalEntryRepository(conn);
    const updatedOriginal = await journalRepo.findById(original.id);
    assert.equal(updatedOriginal?.status, 'reversed');
    assert.equal(updatedOriginal?.reversedByEntryId, reversal.id);

    await assert.rejects(
      async () => {
        await PostingService.reverseJournal(
          conn,
          biz.id,
          original.id,
          'Attempting duplicate reversal'
        );
      },
      /already been reversed/
    );

    // Net balance should be back to 0
    const accRepo = new AccountRepository(conn);
    const cashBal = await accRepo.getAccountBalance(biz.id, cashAcc);
    assert.equal(cashBal?.netBalanceScaled, 0n);
  });
});
