/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { 
  PartyRepository, 
  PartyRecord,
  PaymentRepository,
  PaymentRecord,
  PaymentWithAllocations,
  PartyLedgerRepository,
  PartyStatementResult,
  JournalEntryRepository,
  DocumentRepository,
  AccountRepository
} from '../../infrastructure/database/repositories';
import { EntityId } from '../../domain/primitives/EntityId';
import { 
  validateRequiredString, 
  validatePositiveAmount,
  assertValid 
} from '../validation/financialValidation';
import { CrossWorkspaceIsolationError, WorkspaceService } from './WorkspaceService';

export interface CreatePartyParams {
  name: string;
  type: 'customer' | 'supplier' | 'both';
  companyName?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  creditLimitScaled?: bigint;
  currencyCode?: string;
  openingBalanceScaled?: bigint;
  openingBalanceType?: 'receivable' | 'payable' | 'zero';
  openingBalanceDate?: string;
}

export interface RecordPaymentParams {
  partyId: string;
  paymentType: 'customer_receipt' | 'supplier_payment' | 'customer_refund' | 'supplier_refund';
  amountScaled: bigint;
  paymentDate: string;
  paymentMethod: string;
  accountId?: string;
  referenceNumber?: string;
  notes?: string;
  attachmentPath?: string;
  allocations?: Array<{
    documentId: string;
    amountScaled: bigint;
  }>;
}

export interface LegacyDueImportRecord {
  partyName: string;
  role: 'customer' | 'supplier' | 'both';
  companyName?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimitScaled?: bigint;
  dueType: 'receivable' | 'payable' | 'zero';
  dueAmountScaled: bigint;
  asOfDate: string;
  referenceNotes?: string;
}

export interface LegacyDueImportResult {
  totalImported: number;
  totalReceivablesImportedScaled: bigint;
  totalPayablesImportedScaled: bigint;
  parties: PartyRecord[];
}

export class PartyKhataService {
  /**
   * Checks for duplicate parties by phone or matching name within the workspace.
   */
  public static async checkDuplicates(
    conn: DatabaseConnection,
    workspaceId: string,
    name: string,
    phone?: string
  ): Promise<PartyRecord[]> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    const partyRepo = new PartyRepository(conn);
    return await partyRepo.findDuplicates(workspaceId, name, phone);
  }

  /**
   * Creates a party with support for customers, suppliers, distributors (role: 'both'),
   * and optional opening balance.
   */
  public static async createParty(
    conn: DatabaseConnection,
    workspaceId: string,
    params: CreatePartyParams
  ): Promise<PartyRecord> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.name, 'Party Name'));
    assertValid(validateRequiredString(params.type, 'Party Role'));

    const partyRepo = new PartyRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    let party: PartyRecord;

    await conn.executeTransaction(async () => {
      // 1. Create Party Record
      party = await partyRepo.create({
        workspaceId,
        name: params.name.trim(),
        type: params.type,
        companyName: params.companyName?.trim() || null,
        contactPersonName: params.contactPersonName?.trim() || null,
        contactPersonPhone: params.contactPersonPhone?.trim() || null,
        phone: params.phone?.trim() || null,
        email: params.email?.trim() || null,
        address: params.address?.trim() || null,
        taxNumber: params.taxNumber?.trim() || null,
        notes: params.notes?.trim() || null,
        creditLimitScaled: params.creditLimitScaled ?? 0n,
        currencyCode: params.currencyCode || 'PKR',
        openingBalanceScaled: params.openingBalanceScaled ?? 0n,
        openingBalanceType: params.openingBalanceType ?? 'zero',
        openingBalanceDate: params.openingBalanceDate || null,
        isActive: true
      });

      // 2. If opening balance is specified, create ledger and accounting entries
      const obAmount = params.openingBalanceScaled ?? 0n;
      const obType = params.openingBalanceType ?? 'zero';
      const obDate = params.openingBalanceDate || new Date().toISOString().split('T')[0];

      if (obAmount > 0n && obType !== 'zero') {
        const jeId = EntityId.generate('je');
        const jeNumber = `OB-${party.id.slice(-6).toUpperCase()}`;

        if (obType === 'receivable') {
          // Customer opening balance: Debit Accounts Receivable (1200), Credit Owner Equity (3000)
          await journalRepo.createWithLines(
            {
              id: jeId,
              workspaceId,
              entryNumber: jeNumber,
              entryDate: obDate,
              description: `Opening Balance for Customer: ${party.name}`,
              referenceType: 'party_opening_balance',
              referenceId: party.id,
              isPosted: true
            },
            [
              {
                accountId: `acc_${workspaceId}_1200`,
                debitAmountScaled: obAmount,
                creditAmountScaled: 0n,
                description: `Customer Opening Receivable - ${party.name}`,
                partyId: party.id
              },
              {
                accountId: `acc_${workspaceId}_3000`,
                debitAmountScaled: 0n,
                creditAmountScaled: obAmount,
                description: `Opening Balance Equity offset - ${party.name}`,
                partyId: party.id
              }
            ]
          );

          // Record in Party Ledger
          await ledgerRepo.recordEntry({
            workspaceId,
            partyId: party.id,
            entryDate: obDate,
            entryType: 'opening_balance',
            journalEntryId: jeId,
            referenceNumber: jeNumber,
            description: 'Opening Balance (Receivable)',
            receivableAmountScaled: obAmount,
            payableAmountScaled: 0n
          });
        } else if (obType === 'payable') {
          // Supplier opening balance: Debit Owner Equity (3000), Credit Accounts Payable (2010)
          await journalRepo.createWithLines(
            {
              id: jeId,
              workspaceId,
              entryNumber: jeNumber,
              entryDate: obDate,
              description: `Opening Balance for Supplier: ${party.name}`,
              referenceType: 'party_opening_balance',
              referenceId: party.id,
              isPosted: true
            },
            [
              {
                accountId: `acc_${workspaceId}_3000`,
                debitAmountScaled: obAmount,
                creditAmountScaled: 0n,
                description: `Opening Balance Equity offset - ${party.name}`,
                partyId: party.id
              },
              {
                accountId: `acc_${workspaceId}_2010`,
                debitAmountScaled: 0n,
                creditAmountScaled: obAmount,
                description: `Supplier Opening Payable - ${party.name}`,
                partyId: party.id
              }
            ]
          );

          // Record in Party Ledger
          await ledgerRepo.recordEntry({
            workspaceId,
            partyId: party.id,
            entryDate: obDate,
            entryType: 'opening_balance',
            journalEntryId: jeId,
            referenceNumber: jeNumber,
            description: 'Opening Balance (Payable)',
            receivableAmountScaled: 0n,
            payableAmountScaled: obAmount
          });
        }
      }
    });

    return party!;
  }

  /**
   * Sets or adjusts an opening balance for an existing party.
   */
  public static async setOpeningBalance(
    conn: DatabaseConnection,
    workspaceId: string,
    partyId: string,
    params: {
      amountScaled: bigint;
      type: 'receivable' | 'payable';
      date?: string;
      notes?: string;
    }
  ): Promise<void> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validatePositiveAmount(Number(params.amountScaled), 'Opening Balance Amount'));

    const partyRepo = new PartyRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    const party = await partyRepo.findById(partyId);
    if (!party) throw new Error(`Party ${partyId} not found.`);
    if (party.workspaceId !== workspaceId) {
      throw new CrossWorkspaceIsolationError(`Party ${partyId} does not belong to workspace ${workspaceId}.`);
    }

    const obDate = params.date || new Date().toISOString().split('T')[0];
    const jeId = EntityId.generate('je');
    const jeNumber = `OB-${party.id.slice(-6).toUpperCase()}`;

    await conn.executeTransaction(async () => {
      await partyRepo.update(partyId, {
        openingBalanceScaled: params.amountScaled,
        openingBalanceType: params.type,
        openingBalanceDate: obDate
      });

      if (params.type === 'receivable') {
        await journalRepo.createWithLines(
          {
            id: jeId,
            workspaceId,
            entryNumber: jeNumber,
            entryDate: obDate,
            description: `Opening Balance for ${party.name}`,
            referenceType: 'party_opening_balance',
            referenceId: party.id,
            isPosted: true
          },
          [
            {
              accountId: `acc_${workspaceId}_1200`,
              debitAmountScaled: params.amountScaled,
              creditAmountScaled: 0n,
              description: `A/R Opening Balance - ${party.name}`,
              partyId: party.id
            },
            {
              accountId: `acc_${workspaceId}_3000`,
              debitAmountScaled: 0n,
              creditAmountScaled: params.amountScaled,
              description: `Equity Offset - ${party.name}`,
              partyId: party.id
            }
          ]
        );

        await ledgerRepo.recordEntry({
          workspaceId,
          partyId,
          entryDate: obDate,
          entryType: 'opening_balance',
          journalEntryId: jeId,
          referenceNumber: jeNumber,
          description: `Opening Balance (${params.notes || 'Receivable'})`,
          receivableAmountScaled: params.amountScaled,
          payableAmountScaled: 0n
        });
      } else {
        await journalRepo.createWithLines(
          {
            id: jeId,
            workspaceId,
            entryNumber: jeNumber,
            entryDate: obDate,
            description: `Opening Balance for ${party.name}`,
            referenceType: 'party_opening_balance',
            referenceId: party.id,
            isPosted: true
          },
          [
            {
              accountId: `acc_${workspaceId}_3000`,
              debitAmountScaled: params.amountScaled,
              creditAmountScaled: 0n,
              description: `Equity Offset - ${party.name}`,
              partyId: party.id
            },
            {
              accountId: `acc_${workspaceId}_2010`,
              debitAmountScaled: 0n,
              creditAmountScaled: params.amountScaled,
              description: `A/P Opening Balance - ${party.name}`,
              partyId: party.id
            }
          ]
        );

        await ledgerRepo.recordEntry({
          workspaceId,
          partyId,
          entryDate: obDate,
          entryType: 'opening_balance',
          journalEntryId: jeId,
          referenceNumber: jeNumber,
          description: `Opening Balance (${params.notes || 'Payable'})`,
          receivableAmountScaled: 0n,
          payableAmountScaled: params.amountScaled
        });
      }
    });
  }

  /**
   * Supports migration of legacy dues with an explicit import mapping.
   * Creates or matches parties, sets their opening balance as of a specified date,
   * generates corresponding double-entry opening equity journal entries,
   * and populates the party ledger without distorting current-period sales or purchases.
   */
  public static async importLegacyDues(
    conn: DatabaseConnection,
    workspaceId: string,
    importRecords: LegacyDueImportRecord[]
  ): Promise<LegacyDueImportResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);

    const partyRepo = new PartyRepository(conn);
    const parties: PartyRecord[] = [];
    let totalReceivables = 0n;
    let totalPayables = 0n;

    for (const record of importRecords) {
      assertValid(validateRequiredString(record.partyName, 'Legacy Due Party Name'));
      assertValid(validateRequiredString(record.role, 'Legacy Due Role'));

      const existing = await partyRepo.findByName(workspaceId, record.partyName.trim());
      let party: PartyRecord;

      if (existing) {
        party = existing;
        if (record.dueAmountScaled > 0n && record.dueType !== 'zero') {
          await this.setOpeningBalance(conn, workspaceId, party.id, {
            amountScaled: record.dueAmountScaled,
            type: record.dueType === 'receivable' ? 'receivable' : 'payable',
            date: record.asOfDate,
            notes: record.referenceNotes || 'Legacy Due Migration'
          });
        }
      } else {
        party = await this.createParty(conn, workspaceId, {
          name: record.partyName,
          type: record.role,
          companyName: record.companyName,
          contactPersonName: record.contactPersonName,
          contactPersonPhone: record.contactPersonPhone,
          phone: record.phone,
          email: record.email,
          address: record.address,
          creditLimitScaled: record.creditLimitScaled,
          openingBalanceScaled: record.dueAmountScaled,
          openingBalanceType: record.dueType,
          openingBalanceDate: record.asOfDate,
          notes: record.referenceNotes
        });
      }

      parties.push(party);
      if (record.dueType === 'receivable') {
        totalReceivables += record.dueAmountScaled;
      } else if (record.dueType === 'payable') {
        totalPayables += record.dueAmountScaled;
      }
    }

    return {
      totalImported: parties.length,
      totalReceivablesImportedScaled: totalReceivables,
      totalPayablesImportedScaled: totalPayables,
      parties
    };
  }

  /**
   * Records a payment (customer receipt or supplier payment) with multi-invoice allocations.
   * Updates document paid amounts, posts accounting journal entries, and updates the party ledger.
   */
  public static async recordPayment(
    conn: DatabaseConnection,
    workspaceId: string,
    params: RecordPaymentParams
  ): Promise<PaymentWithAllocations> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.partyId, 'Party ID'));
    assertValid(validatePositiveAmount(Number(params.amountScaled), 'Payment Amount'));

    const partyRepo = new PartyRepository(conn);
    const paymentRepo = new PaymentRepository(conn);
    const docRepo = new DocumentRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    // 1. ISOLATION CHECK: Validate party belongs to this workspace
    const party = await partyRepo.findById(params.partyId);
    if (!party) throw new Error(`Party ${params.partyId} not found.`);
    if (party.workspaceId !== workspaceId) {
      throw new CrossWorkspaceIsolationError(
        `Party ${party.id} belongs to workspace "${party.workspaceId}", not active workspace "${workspaceId}".`
      );
    }

    // 2. ISOLATION & VALIDATION CHECK on Document Allocations
    const allocations = params.allocations || [];
    for (const alloc of allocations) {
      const doc = await docRepo.findById(alloc.documentId);
      if (!doc) throw new Error(`Document ${alloc.documentId} not found.`);
      if (doc.workspaceId !== workspaceId) {
        throw new CrossWorkspaceIsolationError(
          `Document ${doc.id} belongs to workspace "${doc.workspaceId}", not active workspace "${workspaceId}".`
        );
      }
      if (doc.partyId && doc.partyId !== party.id) {
        throw new Error(`Document ${doc.id} belongs to a different party (${doc.partyId}), cannot allocate.`);
      }
    }

    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;
    const paymentId = EntityId.generate('pay');
    const jeId = EntityId.generate('je');

    let createdPayment: PaymentWithAllocations;

    await conn.executeTransaction(async () => {
      // 3. Create Payment with Allocations in payments and payment_allocations tables
      createdPayment = await paymentRepo.createWithAllocations(
        {
          id: paymentId,
          workspaceId,
          partyId: party.id,
          paymentNumber,
          paymentType: params.paymentType,
          paymentDate: params.paymentDate,
          paymentMethod: params.paymentMethod,
          accountId: params.accountId || null,
          amountScaled: params.amountScaled,
          referenceNumber: params.referenceNumber || null,
          notes: params.notes || null,
          attachmentPath: params.attachmentPath || null
        },
        allocations
      );

      // 4. Post Double-Entry Accounting Journal Entry
      const cashOrBankAccId = params.accountId || `acc_${workspaceId}_1010`; // Default to Cash on Hand

      if (params.paymentType === 'customer_receipt') {
        // Customer receipt: Debit Cash/Bank (1010), Credit Accounts Receivable (1200)
        await journalRepo.createWithLines(
          {
            id: jeId,
            workspaceId,
            entryNumber: `JE-${paymentNumber}`,
            entryDate: params.paymentDate,
            description: `Payment Received from Customer ${party.name}`,
            referenceType: 'payment',
            referenceId: paymentId,
            isPosted: true
          },
          [
            {
              accountId: cashOrBankAccId,
              debitAmountScaled: params.amountScaled,
              creditAmountScaled: 0n,
              description: `Payment received via ${params.paymentMethod} - ${party.name}`
            },
            {
              accountId: `acc_${workspaceId}_1200`,
              debitAmountScaled: 0n,
              creditAmountScaled: params.amountScaled,
              description: `Reduction of A/R - ${party.name}`,
              partyId: party.id
            }
          ]
        );

        // Record in Party Ledger: Credit to customer (payable movement reduces what they owe)
        await ledgerRepo.recordEntry({
          workspaceId,
          partyId: party.id,
          entryDate: params.paymentDate,
          entryType: 'payment_received',
          paymentId,
          journalEntryId: jeId,
          referenceNumber: paymentNumber,
          description: `Payment Received (${params.paymentMethod}) ${params.referenceNumber ? `Ref: ${params.referenceNumber}` : ''}`,
          receivableAmountScaled: 0n,
          payableAmountScaled: params.amountScaled
        });
      } else if (params.paymentType === 'supplier_payment') {
        // Supplier payment: Debit Accounts Payable (2010), Credit Cash/Bank (1010)
        await journalRepo.createWithLines(
          {
            id: jeId,
            workspaceId,
            entryNumber: `JE-${paymentNumber}`,
            entryDate: params.paymentDate,
            description: `Payment to Supplier ${party.name}`,
            referenceType: 'payment',
            referenceId: paymentId,
            isPosted: true
          },
          [
            {
              accountId: `acc_${workspaceId}_2010`,
              debitAmountScaled: params.amountScaled,
              creditAmountScaled: 0n,
              description: `Reduction of A/P - ${party.name}`,
              partyId: party.id
            },
            {
              accountId: cashOrBankAccId,
              debitAmountScaled: 0n,
              creditAmountScaled: params.amountScaled,
              description: `Payment paid via ${params.paymentMethod} to ${party.name}`
            }
          ]
        );

        // Record in Party Ledger: Debit to supplier (receivable movement reduces what we owe them)
        await ledgerRepo.recordEntry({
          workspaceId,
          partyId: party.id,
          entryDate: params.paymentDate,
          entryType: 'supplier_payment',
          paymentId,
          journalEntryId: jeId,
          referenceNumber: paymentNumber,
          description: `Payment to Supplier (${params.paymentMethod}) ${params.referenceNumber ? `Ref: ${params.referenceNumber}` : ''}`,
          receivableAmountScaled: params.amountScaled,
          payableAmountScaled: 0n
        });
      }
    });

    return createdPayment!;
  }

  /**
   * Reverses a posted payment through an audited reversal process,
   * restoring document unpaid amounts and reversing ledger and journal entries.
   */
  public static async reversePayment(
    conn: DatabaseConnection,
    workspaceId: string,
    paymentId: string,
    reason: string
  ): Promise<PaymentRecord> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(reason, 'Reversal Reason'));

    const paymentRepo = new PaymentRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new Error(`Payment ${paymentId} not found.`);
    if (payment.workspaceId !== workspaceId) {
      throw new CrossWorkspaceIsolationError(`Payment ${paymentId} does not belong to workspace ${workspaceId}.`);
    }

    const reversalJeId = EntityId.generate('je');
    const reversalNumber = `REV-${payment.paymentNumber}`;
    const now = new Date().toISOString().split('T')[0];

    let reversedPayment: PaymentRecord;

    await conn.executeTransaction(async () => {
      // 1. Post compensating reversal entry in journal
      const cashOrBankAccId = payment.accountId || `acc_${workspaceId}_1010`;

      if (payment.paymentType === 'customer_receipt') {
        // Reverse customer receipt: Debit A/R (1200), Credit Cash/Bank (1010)
        await journalRepo.createWithLines(
          {
            id: reversalJeId,
            workspaceId,
            entryNumber: `JE-${reversalNumber}`,
            entryDate: now,
            description: `Reversal of Payment ${payment.paymentNumber}: ${reason}`,
            referenceType: 'payment_reversal',
            referenceId: paymentId,
            isPosted: true
          },
          [
            {
              accountId: `acc_${workspaceId}_1200`,
              debitAmountScaled: payment.amountScaled,
              creditAmountScaled: 0n,
              description: `A/R Restored due to Payment Reversal (${payment.paymentNumber})`,
              partyId: payment.partyId
            },
            {
              accountId: cashOrBankAccId,
              debitAmountScaled: 0n,
              creditAmountScaled: payment.amountScaled,
              description: `Compensating debit reversal for ${payment.paymentNumber}`
            }
          ]
        );
      } else if (payment.paymentType === 'supplier_payment') {
        // Reverse supplier payment: Debit Cash/Bank (1010), Credit A/P (2010)
        await journalRepo.createWithLines(
          {
            id: reversalJeId,
            workspaceId,
            entryNumber: `JE-${reversalNumber}`,
            entryDate: now,
            description: `Reversal of Supplier Payment ${payment.paymentNumber}: ${reason}`,
            referenceType: 'payment_reversal',
            referenceId: paymentId,
            isPosted: true
          },
          [
            {
              accountId: cashOrBankAccId,
              debitAmountScaled: payment.amountScaled,
              creditAmountScaled: 0n,
              description: `Compensating credit reversal for ${payment.paymentNumber}`
            },
            {
              accountId: `acc_${workspaceId}_2010`,
              debitAmountScaled: 0n,
              creditAmountScaled: payment.amountScaled,
              description: `A/P Restored due to Payment Reversal (${payment.paymentNumber})`,
              partyId: payment.partyId
            }
          ]
        );
      }

      // 2. Mark payment reversed in repository (releases document allocations)
      reversedPayment = await paymentRepo.reversePayment(paymentId, reason, reversalJeId);

      // 3. Mark party ledger entry reversed
      await ledgerRepo.reverseEntryByReference(workspaceId, 'payment', paymentId);
    });

    return reversedPayment!;
  }

  /**
   * Records a sales invoice or purchase bill into the party's Khata ledger.
   */
  public static async recordDocumentInKhata(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      documentId: string;
      partyId: string;
      documentNumber: string;
      documentType: 'sales_invoice' | 'purchase_bill';
      totalScaled: bigint;
      issueDate: string;
      dueDate?: string;
    }
  ): Promise<void> {
    const ledgerRepo = new PartyLedgerRepository(conn);

    // Idempotency check: prevent duplicate ledger posting if already recorded
    const existing = await conn.query<any>(
      'SELECT id FROM party_ledger_entries WHERE workspace_id = ? AND document_id = ? LIMIT 1',
      [workspaceId, params.documentId]
    );
    if (existing.length > 0) return;

    if (params.documentType === 'sales_invoice') {
      // Sales Invoice: increases receivable (money customer owes)
      await ledgerRepo.recordEntry({
        workspaceId,
        partyId: params.partyId,
        entryDate: params.issueDate,
        entryType: 'credit_sale',
        documentId: params.documentId,
        referenceNumber: params.documentNumber,
        description: `Credit Sale Invoice ${params.documentNumber}`,
        receivableAmountScaled: params.totalScaled,
        payableAmountScaled: 0n,
        dueDate: params.dueDate || null
      });
    } else if (params.documentType === 'purchase_bill') {
      // Purchase Bill: increases payable (money business owes supplier)
      await ledgerRepo.recordEntry({
        workspaceId,
        partyId: params.partyId,
        entryDate: params.issueDate,
        entryType: 'credit_purchase',
        documentId: params.documentId,
        referenceNumber: params.documentNumber,
        description: `Purchase Bill ${params.documentNumber}`,
        receivableAmountScaled: 0n,
        payableAmountScaled: params.totalScaled,
        dueDate: params.dueDate || null
      });
    }
  }

  /**
   * Retrieves a party's chronological statement (Khata) with pagination and running balances.
   */
  public static async getPartyStatement(
    conn: DatabaseConnection,
    workspaceId: string,
    partyId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<PartyStatementResult> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    const ledgerRepo = new PartyLedgerRepository(conn);
    return await ledgerRepo.getPartyStatement(workspaceId, partyId, options);
  }

  /**
   * Derives authoritative current balance for a party from ledger events.
   */
  public static async getDerivedPartyBalance(
    conn: DatabaseConnection,
    workspaceId: string,
    partyId: string
  ) {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    const ledgerRepo = new PartyLedgerRepository(conn);
    return await ledgerRepo.getDerivedPartyBalance(workspaceId, partyId);
  }

  /**
   * Verifies that total customer receivables match the Accounts Receivable control account (1200),
   * and total supplier payables match the Accounts Payable control account (2010).
   */
  public static async reconcileWithControlAccounts(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<{
    isReconciled: boolean;
    customerLedgerTotalScaled: bigint;
    controlAccountReceivableScaled: bigint;
    supplierLedgerTotalScaled: bigint;
    controlAccountPayableScaled: bigint;
  }> {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);

    const partyRepo = new PartyRepository(conn);
    const ledgerRepo = new PartyLedgerRepository(conn);
    const allParties = await partyRepo.findByWorkspace(workspaceId, undefined, true);

    let customerSum = 0n;
    let supplierSum = 0n;

    for (const p of allParties) {
      const bal = await ledgerRepo.getDerivedPartyBalance(workspaceId, p.id);
      if (bal.netBalanceScaled > 0n) {
        customerSum += bal.netBalanceScaled;
      } else if (bal.netBalanceScaled < 0n) {
        supplierSum += -bal.netBalanceScaled;
      }
    }

    // Query journal line sums for A/R (acc_${workspaceId}_1200) and A/P (acc_${workspaceId}_2010)
    const arRows = await conn.query<any>(
      `SELECT SUM(debit_amount_scaled) as total_debit, SUM(credit_amount_scaled) as total_credit
       FROM journal_lines
       WHERE account_id = ?`,
      [`acc_${workspaceId}_1200`]
    );

    const apRows = await conn.query<any>(
      `SELECT SUM(debit_amount_scaled) as total_debit, SUM(credit_amount_scaled) as total_credit
       FROM journal_lines
       WHERE account_id = ?`,
      [`acc_${workspaceId}_2010`]
    );

    const arNet = BigInt(arRows[0]?.total_debit || 0) - BigInt(arRows[0]?.total_credit || 0);
    const apNet = BigInt(apRows[0]?.total_credit || 0) - BigInt(apRows[0]?.total_debit || 0);

    const isReconciled = customerSum === arNet && supplierSum === apNet;

    return {
      isReconciled,
      customerLedgerTotalScaled: customerSum,
      controlAccountReceivableScaled: arNet,
      supplierLedgerTotalScaled: supplierSum,
      controlAccountPayableScaled: apNet
    };
  }
}
