/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { 
  TransferRepository, 
  InterWorkspaceTransferRecord, 
  TransferType,
  TransferStatus,
  AccountRepository,
  JournalEntryRepository,
  JournalEntryWithLines
} from '../../infrastructure/database/repositories';
import { EntityId } from '../../domain/primitives/EntityId';
import { 
  validateRequiredString, 
  validatePositiveAmount,
  assertValid 
} from '../validation/financialValidation';
import { CrossWorkspaceIsolationError, WorkspaceService } from './WorkspaceService';
import { PostingService } from './PostingService';

export interface CreateInterWorkspaceTransferParams {
  sourceWorkspaceId: string;
  destinationWorkspaceId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountScaled: bigint;
  transferDate: string;
  transferType: TransferType;
  currencyCode?: string;
  note?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface OwnerDirectSupplierPaymentParams {
  businessWorkspaceId: string;
  personalWorkspaceId: string;
  personalCashAccountId: string;
  businessPayableAccountId?: string;
  supplierPartyId?: string;
  documentId?: string;
  amountScaled: bigint;
  paymentDate: string;
  fundingType: 'owner_loan' | 'owner_capital'; // Credit "Due to Owner" (2030) vs "Owner Capital" (3000)
  note?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export class InterWorkspaceTransferService {
  /**
   * Executes a linked inter-workspace transfer within a single atomic SQLite transaction.
   * Creates paired journal entries on both workspaces or neither side.
   * Strictly rejects same-workspace transfers.
   * Retrying with the same idempotency key does not duplicate the transfer.
   */
  public static async recordTransfer(
    conn: DatabaseConnection,
    params: CreateInterWorkspaceTransferParams
  ): Promise<{
    transfer: InterWorkspaceTransferRecord;
    sourceJournal: JournalEntryWithLines;
    destinationJournal: JournalEntryWithLines;
  }> {
    assertValid(validateRequiredString(params.sourceWorkspaceId, 'Source Workspace ID'));
    assertValid(validateRequiredString(params.destinationWorkspaceId, 'Destination Workspace ID'));
    assertValid(validateRequiredString(params.sourceAccountId, 'Source Account ID'));
    assertValid(validateRequiredString(params.destinationAccountId, 'Destination Account ID'));
    assertValid(validatePositiveAmount(Number(params.amountScaled), 'Transfer Amount'));
    assertValid(validateRequiredString(params.transferDate, 'Transfer Date'));
    assertValid(validateRequiredString(params.transferType, 'Transfer Type'));

    // Reject same-workspace transfers
    if (params.sourceWorkspaceId === params.destinationWorkspaceId) {
      throw new Error(
        'Same-workspace transfer rejected. Use account-to-account transfer for internal movements.'
      );
    }

    const transferRepo = new TransferRepository(conn);
    const accRepo = new AccountRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    // Check idempotency first
    if (params.idempotencyKey) {
      const existing = await transferRepo.findByIdempotencyKey(params.idempotencyKey);
      if (existing) {
        const srcJe = existing.sourceJournalEntryId ? await journalRepo.findById(existing.sourceJournalEntryId) : null;
        const destJe = existing.destinationJournalEntryId ? await journalRepo.findById(existing.destinationJournalEntryId) : null;
        if (srcJe && destJe) {
          return {
            transfer: existing,
            sourceJournal: srcJe,
            destinationJournal: destJe
          };
        }
      }
    }

    // Validate both workspaces exist and are active
    const [srcWs, destWs] = await Promise.all([
      WorkspaceService.validateWorkspaceAccess(conn, params.sourceWorkspaceId),
      WorkspaceService.validateWorkspaceAccess(conn, params.destinationWorkspaceId)
    ]);

    // Validate accounts
    const [srcAcc, destAcc] = await Promise.all([
      accRepo.findById(params.sourceAccountId),
      accRepo.findById(params.destinationAccountId)
    ]);

    if (!srcAcc || srcAcc.workspaceId !== params.sourceWorkspaceId) {
      throw new CrossWorkspaceIsolationError(
        `Source account ${params.sourceAccountId} does not belong to source workspace ${params.sourceWorkspaceId}.`
      );
    }
    if (!destAcc || destAcc.workspaceId !== params.destinationWorkspaceId) {
      throw new CrossWorkspaceIsolationError(
        `Destination account ${params.destinationAccountId} does not belong to destination workspace ${params.destinationWorkspaceId}.`
      );
    }

    const transferId = EntityId.generate('xfer');
    const transferSeq = Date.now().toString().slice(-6);
    const transferNumber = `TXF-${transferSeq}`;
    const currencyCode = params.currencyCode || srcWs.currencyCode || 'PKR';
    const createdBy = params.createdBy || 'local_user';

    // Build paired journal lines according to transfer type
    const sourceJeId = EntityId.generate('je');
    const destJeId = EntityId.generate('je');
    const sourceJeNum = `JE-${srcWs.name.slice(0, 3).toUpperCase()}-${transferSeq}-OUT`;
    const destJeNum = `JE-${destWs.name.slice(0, 3).toUpperCase()}-${transferSeq}-IN`;

    let sourceLines: Array<{
      accountId: string;
      debitAmountScaled: bigint;
      creditAmountScaled: bigint;
      description: string;
    }> = [];

    let destLines: Array<{
      accountId: string;
      debitAmountScaled: bigint;
      creditAmountScaled: bigint;
      description: string;
    }> = [];

    const amount = params.amountScaled;

    switch (params.transferType) {
      case 'owner_capital': {
        // Source (Personal/Owner): Credit Personal Cash/Bank, Debit Investment in Business (Asset 1400 or Equity)
        // Find or fallback to Due from Business / Investment account
        const srcInvestmentAcc = await accRepo.findByCode(params.sourceWorkspaceId, '1400')
          || await accRepo.findByCode(params.sourceWorkspaceId, '3000')
          || srcAcc;

        sourceLines = [
          {
            accountId: srcInvestmentAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Capital Investment into ${destWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Cash sent for Capital to ${destWs.name} (Ref: ${transferNumber})`
          }
        ];

        // Destination (Business): Debit Business Cash/Bank, Credit Owner Capital (Equity 3000)
        // Revenue is NOT touched!
        const destCapitalAcc = await accRepo.findByCode(params.destinationWorkspaceId, '3000') || destAcc;

        destLines = [
          {
            accountId: destAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Cash received from Owner Capital (${srcWs.name}) (Ref: ${transferNumber})`
          },
          {
            accountId: destCapitalAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Owner Capital Contribution from ${srcWs.name} (Ref: ${transferNumber})`
          }
        ];
        break;
      }

      case 'owner_loan': {
        // Source (Personal): Credit Personal Cash, Debit Due from Business (Asset 1400)
        const srcDueFromAcc = await accRepo.findByCode(params.sourceWorkspaceId, '1400') || srcAcc;

        sourceLines = [
          {
            accountId: srcDueFromAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Loan to Business ${destWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Cash disbursed for Loan to ${destWs.name} (Ref: ${transferNumber})`
          }
        ];

        // Destination (Business): Debit Business Cash, Credit Due to Owner / Owner Loan (Liability 2030)
        // Revenue is NOT touched!
        const destDueToAcc = await accRepo.findByCode(params.destinationWorkspaceId, '2030') || destAcc;

        destLines = [
          {
            accountId: destAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Loan received from Owner (${srcWs.name}) (Ref: ${transferNumber})`
          },
          {
            accountId: destDueToAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Due to Owner (Loan from ${srcWs.name}) (Ref: ${transferNumber})`
          }
        ];
        break;
      }

      case 'owner_drawing': {
        // Source (Business): Credit Business Cash, Debit Owner Drawings (Equity 3010) - NOT an operating expense!
        const srcDrawingAcc = await accRepo.findByCode(params.sourceWorkspaceId, '3010')
          || await accRepo.findByCode(params.sourceWorkspaceId, '3000')
          || srcAcc;

        sourceLines = [
          {
            accountId: srcDrawingAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Owner Drawing to ${destWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Cash withdrawn by Owner for ${destWs.name} (Ref: ${transferNumber})`
          }
        ];

        // Destination (Personal): Debit Personal Cash, Credit Owner Equity/Drawings (Equity 3000)
        const destEquityAcc = await accRepo.findByCode(params.destinationWorkspaceId, '3000') || destAcc;

        destLines = [
          {
            accountId: destAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Drawing received from Business (${srcWs.name}) (Ref: ${transferNumber})`
          },
          {
            accountId: destEquityAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Personal Equity from Business Drawing (Ref: ${transferNumber})`
          }
        ];
        break;
      }

      case 'owner_loan_repayment': {
        // Source (Business): Credit Business Cash, Debit Due to Owner (Liability 2030) - NOT an operating expense!
        const srcDueToAcc = await accRepo.findByCode(params.sourceWorkspaceId, '2030') || srcAcc;

        sourceLines = [
          {
            accountId: srcDueToAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Repayment of Owner Loan to ${destWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Cash paid for Owner Loan Repayment to ${destWs.name} (Ref: ${transferNumber})`
          }
        ];

        // Destination (Personal): Debit Personal Cash, Credit Due from Business (Asset 1400)
        const destDueFromAcc = await accRepo.findByCode(params.destinationWorkspaceId, '1400') || destAcc;

        destLines = [
          {
            accountId: destAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Loan repayment received from ${srcWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: destDueFromAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Due from Business settled by ${srcWs.name} (Ref: ${transferNumber})`
          }
        ];
        break;
      }

      case 'internal_funding':
      case 'other':
      default: {
        const srcInterWsAcc = await accRepo.findByCode(params.sourceWorkspaceId, '1400') || srcAcc;
        const destInterWsAcc = await accRepo.findByCode(params.destinationWorkspaceId, '2040') || destAcc;

        sourceLines = [
          {
            accountId: srcInterWsAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Inter-workspace funding to ${destWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Funds transfer to ${destWs.name} (Ref: ${transferNumber})`
          }
        ];

        destLines = [
          {
            accountId: destAcc.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Inter-workspace funds from ${srcWs.name} (Ref: ${transferNumber})`
          },
          {
            accountId: destInterWsAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Due to ${srcWs.name} funding (Ref: ${transferNumber})`
          }
        ];
        break;
      }
    }

    // Atomic execution of paired records
    let createdTransfer: InterWorkspaceTransferRecord;
    let sourceJournal: JournalEntryWithLines;
    let destinationJournal: JournalEntryWithLines;

    await conn.executeTransaction(async txConn => {
      // 1. Post Source Journal Entry
      sourceJournal = await journalRepo.createWithLines(
        {
          id: sourceJeId,
          workspaceId: params.sourceWorkspaceId,
          entryNumber: sourceJeNum,
          entryDate: params.transferDate,
          description: `Inter-Workspace Transfer to ${destWs.name}: ${params.note || params.transferType.replace('_', ' ')}`,
          sourceType: 'inter_workspace_transfer',
          sourceId: transferId,
          referenceType: 'inter_workspace_transfer',
          referenceId: transferId,
          isPosted: true,
          auditActor: createdBy
        },
        sourceLines
      );

      // 2. Post Destination Journal Entry
      destinationJournal = await journalRepo.createWithLines(
        {
          id: destJeId,
          workspaceId: params.destinationWorkspaceId,
          entryNumber: destJeNum,
          entryDate: params.transferDate,
          description: `Inter-Workspace Transfer from ${srcWs.name}: ${params.note || params.transferType.replace('_', ' ')}`,
          sourceType: 'inter_workspace_transfer',
          sourceId: transferId,
          referenceType: 'inter_workspace_transfer',
          referenceId: transferId,
          isPosted: true,
          auditActor: createdBy
        },
        destLines
      );

      // 3. Create Transfer Record
      createdTransfer = await transferRepo.create({
        id: transferId,
        transferNumber,
        sourceWorkspaceId: params.sourceWorkspaceId,
        destinationWorkspaceId: params.destinationWorkspaceId,
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        amountScaled: params.amountScaled,
        currencyCode,
        transferDate: params.transferDate,
        transferType: params.transferType,
        note: params.note || null,
        status: 'completed',
        sourceJournalEntryId: sourceJeId,
        destinationJournalEntryId: destJeId,
        idempotencyKey: params.idempotencyKey || null,
        createdBy
      });
    });

    return {
      transfer: createdTransfer!,
      sourceJournal: sourceJournal!,
      destinationJournal: destinationJournal!
    };
  }

  /**
   * Owner pays supplier directly on behalf of business:
   * Business records settlement of supplier obligation (Debit A/P 2010) and credits
   * Due to Owner (2030) or Owner Capital (3000).
   * Personal books record credit to Personal Cash/Bank and debit to Due from Business (1400).
   * Does NOT duplicate the purchase expense or stock increase!
   */
  public static async recordOwnerDirectSupplierPayment(
    conn: DatabaseConnection,
    params: OwnerDirectSupplierPaymentParams
  ): Promise<{
    transfer: InterWorkspaceTransferRecord;
    businessJournal: JournalEntryWithLines;
    personalJournal: JournalEntryWithLines;
  }> {
    assertValid(validateRequiredString(params.businessWorkspaceId, 'Business Workspace ID'));
    assertValid(validateRequiredString(params.personalWorkspaceId, 'Personal Workspace ID'));
    assertValid(validateRequiredString(params.personalCashAccountId, 'Personal Cash Account ID'));
    assertValid(validatePositiveAmount(Number(params.amountScaled), 'Payment Amount'));
    assertValid(validateRequiredString(params.paymentDate, 'Payment Date'));

    const accRepo = new AccountRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);
    const transferRepo = new TransferRepository(conn);

    const [bizWs, personalWs] = await Promise.all([
      WorkspaceService.validateWorkspaceAccess(conn, params.businessWorkspaceId),
      WorkspaceService.validateWorkspaceAccess(conn, params.personalWorkspaceId)
    ]);

    const personalCashAcc = await accRepo.findById(params.personalCashAccountId);
    if (!personalCashAcc || personalCashAcc.workspaceId !== params.personalWorkspaceId) {
      throw new CrossWorkspaceIsolationError('Personal cash account does not belong to personal workspace.');
    }

    // Business Accounts:
    // Debit Accounts Payable (2010)
    const apAccount = params.businessPayableAccountId
      ? await accRepo.findById(params.businessPayableAccountId)
      : await accRepo.findByCode(params.businessWorkspaceId, '2010');

    if (!apAccount) {
      throw new Error('Business Accounts Payable account not found.');
    }

    // Credit Due to Owner (2030) or Owner Capital (3000)
    const liabilityOrEquityCode = params.fundingType === 'owner_loan' ? '2030' : '3000';
    const bizFundingAccount = await accRepo.findByCode(params.businessWorkspaceId, liabilityOrEquityCode);
    if (!bizFundingAccount) {
      throw new Error(`Business account ${liabilityOrEquityCode} not found.`);
    }

    // Personal Accounts:
    // Debit Due from Business (1400) or Investment
    const personalDueFromAccount = await accRepo.findByCode(params.personalWorkspaceId, '1400')
      || await accRepo.findByCode(params.personalWorkspaceId, '3000')
      || personalCashAcc;

    const transferId = EntityId.generate('xfer');
    const transferSeq = Date.now().toString().slice(-6);
    const transferNumber = `TXF-DIR-${transferSeq}`;
    const amount = params.amountScaled;

    const bizJeId = EntityId.generate('je');
    const personalJeId = EntityId.generate('je');

    let createdTransfer: InterWorkspaceTransferRecord;
    let bizJournal: JournalEntryWithLines;
    let personalJournal: JournalEntryWithLines;

    await conn.executeTransaction(async txConn => {
      // 1. Business Journal: Debit A/P, Credit Due to Owner (or Capital)
      bizJournal = await journalRepo.createWithLines(
        {
          id: bizJeId,
          workspaceId: params.businessWorkspaceId,
          entryNumber: `JE-BIZ-${transferSeq}-SUPP`,
          entryDate: params.paymentDate,
          description: `Direct Supplier Payment by Owner (${params.note || 'Settlement'})`,
          sourceType: 'inter_workspace_transfer',
          sourceId: transferId,
          referenceType: 'owner_direct_supplier_payment',
          referenceId: params.documentId || transferId,
          isPosted: true,
          auditActor: params.createdBy || 'local_user'
        },
        [
          {
            accountId: apAccount.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Supplier liability settled by owner`,
            partyId: params.supplierPartyId
          },
          {
            accountId: bizFundingAccount.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: params.fundingType === 'owner_loan' ? 'Due to Owner (Direct payment)' : 'Owner Capital (Direct payment)'
          }
        ]
      );

      // 2. Personal Journal: Debit Due from Business (or Investment), Credit Personal Cash
      personalJournal = await journalRepo.createWithLines(
        {
          id: personalJeId,
          workspaceId: params.personalWorkspaceId,
          entryNumber: `JE-PERS-${transferSeq}-SUPP`,
          entryDate: params.paymentDate,
          description: `Paid Supplier on behalf of ${bizWs.name} (${params.note || 'Direct settlement'})`,
          sourceType: 'inter_workspace_transfer',
          sourceId: transferId,
          referenceType: 'owner_direct_supplier_payment',
          referenceId: params.documentId || transferId,
          isPosted: true,
          auditActor: params.createdBy || 'local_user'
        },
        [
          {
            accountId: personalDueFromAccount.id,
            debitAmountScaled: amount,
            creditAmountScaled: 0n,
            description: `Due from Business (${bizWs.name}) for supplier payment`
          },
          {
            accountId: personalCashAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: amount,
            description: `Personal cash disbursed for ${bizWs.name} supplier`
          }
        ]
      );

      // 3. Transfer record
      createdTransfer = await transferRepo.create({
        id: transferId,
        transferNumber,
        sourceWorkspaceId: params.personalWorkspaceId,
        destinationWorkspaceId: params.businessWorkspaceId,
        sourceAccountId: personalCashAcc.id,
        destinationAccountId: apAccount.id,
        amountScaled: amount,
        currencyCode: personalWs.currencyCode || 'PKR',
        transferDate: params.paymentDate,
        transferType: params.fundingType,
        note: params.note || 'Owner direct supplier payment',
        status: 'completed',
        sourceJournalEntryId: personalJeId,
        destinationJournalEntryId: bizJeId,
        idempotencyKey: params.idempotencyKey || null,
        createdBy: params.createdBy || 'local_user'
      });
    });

    return {
      transfer: createdTransfer!,
      businessJournal: bizJournal!,
      personalJournal: personalJournal!
    };
  }

  /**
   * Reverses an inter-workspace transfer atomically on both workspaces.
   */
  public static async reverseTransfer(
    conn: DatabaseConnection,
    transferId: string,
    reason: string,
    auditActor = 'local_user'
  ): Promise<void> {
    assertValid(validateRequiredString(transferId, 'Transfer ID'));
    assertValid(validateRequiredString(reason, 'Reversal Reason'));

    const transferRepo = new TransferRepository(conn);
    const journalRepo = new JournalEntryRepository(conn);

    const transfer = await transferRepo.findById(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found.`);
    }

    if (transfer.status === 'reversed') {
      throw new Error(`Transfer ${transfer.transferNumber} has already been reversed.`);
    }

    await conn.executeTransaction(async () => {
      // 1. Reverse source journal entry
      if (transfer.sourceJournalEntryId) {
        await journalRepo.reverseEntry(transfer.sourceJournalEntryId, reason, auditActor);
      }

      // 2. Reverse destination journal entry
      if (transfer.destinationJournalEntryId) {
        await journalRepo.reverseEntry(transfer.destinationJournalEntryId, reason, auditActor);
      }

      // 3. Mark transfer as reversed
      await transferRepo.updateStatus(transferId, 'reversed', {
        reversalReason: reason
      });
    });
  }

  /**
   * Retrieves transfers for a specific workspace.
   */
  public static async getTransfers(
    conn: DatabaseConnection,
    workspaceId: string,
    options?: { page?: number; pageSize?: number }
  ) {
    await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
    const transferRepo = new TransferRepository(conn);
    return await transferRepo.findByWorkspace(workspaceId, options);
  }
}
