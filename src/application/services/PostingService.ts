/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { 
  JournalEntryRepository, 
  JournalEntryWithLines, 
  JournalSourceType,
  JournalStatus,
  AccountRepository 
} from '../../infrastructure/database/repositories';
import { EntityId } from '../../domain/primitives/EntityId';
import { 
  validateRequiredString, 
  validatePositiveAmount,
  assertValid 
} from '../validation/financialValidation';
import { CrossWorkspaceIsolationError, WorkspaceService } from './WorkspaceService';

export interface PostJournalCommand {
  workspaceId: string;
  entryDate: string;
  description: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  auditActor?: string;
  lines: Array<{
    accountId: string;
    debitAmountScaled: bigint;
    creditAmountScaled: bigint;
    currencyCode?: string;
    description?: string;
    partyId?: string;
    productId?: string;
  }>;
}

export interface IntraWorkspaceTransferCommand {
  workspaceId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountScaled: bigint;
  transferDate: string;
  description?: string;
  referenceNumber?: string;
  idempotencyKey?: string;
  auditActor?: string;
}

export class PostingService {
  /**
   * Complete 8-step posting lifecycle:
   * 1. Validate command and source document.
   * 2. Begin SQLite transaction.
   * 3. Verify source status and idempotency key.
   * 4. Create journal entry and lines.
   * 5. Validate aggregate balance and workspace ownership.
   * 6. Mark source and journal posted as required.
   * 7. Commit.
   * 8. Trigger post-commit hooks (UI query invalidation).
   */
  public static async postJournal(
    conn: DatabaseConnection,
    command: PostJournalCommand,
    onPostCommitHook?: () => Promise<void> | void
  ): Promise<JournalEntryWithLines> {
    // 1. Validate command and source
    assertValid(validateRequiredString(command.workspaceId, 'Workspace ID'));
    assertValid(validateRequiredString(command.entryDate, 'Entry Date'));
    assertValid(validateRequiredString(command.description, 'Description'));

    if (!command.lines || command.lines.length < 2) {
      throw new Error('A double-entry journal entry must have at least two journal lines.');
    }

    // Pre-validate line amounts
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const line of command.lines) {
      if (line.debitAmountScaled < 0n || line.creditAmountScaled < 0n) {
        throw new Error('Debit and credit amounts cannot be negative.');
      }
      if (line.debitAmountScaled > 0n && line.creditAmountScaled > 0n) {
        throw new Error('A single journal line cannot contain both debit and credit amounts.');
      }
      if (line.debitAmountScaled === 0n && line.creditAmountScaled === 0n) {
        throw new Error('Journal line amount cannot be zero.');
      }
      totalDebit += line.debitAmountScaled;
      totalCredit += line.creditAmountScaled;
    }

    // Strict aggregate balance enforcement
    if (totalDebit === 0n || totalDebit !== totalCredit) {
      throw new Error(
        `Journal entry is unbalanced: Total Debits (${totalDebit}) != Total Credits (${totalCredit}).`
      );
    }

    const journalRepo = new JournalEntryRepository(conn);
    const accRepo = new AccountRepository(conn);

    // 2. Begin SQLite transaction
    let postedEntry: JournalEntryWithLines;

    postedEntry = await conn.executeTransaction(async txConn => {
      // 3. Verify idempotency key if provided
      if (command.idempotencyKey) {
        const existing = await journalRepo.findByIdempotencyKey(command.workspaceId, command.idempotencyKey);
        if (existing) {
          return existing; // Idempotent return without duplicate posting
        }
      }

      // 5 (Part A). Validate workspace ownership for every referenced account
      for (const line of command.lines) {
        const acc = await accRepo.findById(line.accountId);
        if (!acc) {
          throw new Error(`Account ${line.accountId} does not exist.`);
        }
        if (acc.workspaceId !== command.workspaceId) {
          throw new CrossWorkspaceIsolationError(
            `Account ${line.accountId} does not belong to workspace ${command.workspaceId}.`
          );
        }
        if (!acc.isActive) {
          throw new Error(`Account ${acc.name} (${acc.accountCode}) is deactivated.`);
        }

        // Optional party ownership check
        if (line.partyId) {
          const partyRows = await txConn.query<any>(
            `SELECT workspace_id FROM parties WHERE id = ? LIMIT 1`,
            [line.partyId]
          );
          if (partyRows.length > 0 && partyRows[0].workspace_id !== command.workspaceId) {
            throw new CrossWorkspaceIsolationError(
              `Party ${line.partyId} does not belong to workspace ${command.workspaceId}.`
            );
          }
        }

        // Optional product ownership check
        if (line.productId) {
          const prodRows = await txConn.query<any>(
            `SELECT workspace_id FROM products WHERE id = ? LIMIT 1`,
            [line.productId]
          );
          if (prodRows.length > 0 && prodRows[0].workspace_id !== command.workspaceId) {
            throw new CrossWorkspaceIsolationError(
              `Product ${line.productId} does not belong to workspace ${command.workspaceId}.`
            );
          }
        }
      }

      // 4. Create journal entry and lines
      const now = new Date().toISOString();
      const entryId = EntityId.generate('je');
      const entrySeqRows = await txConn.query<any>(
        `SELECT COUNT(*) as count FROM journal_entries WHERE workspace_id = ?`,
        [command.workspaceId]
      );
      const seqNum = Number(entrySeqRows[0]?.count || 0) + 1;
      const entryNumber = `JE-${String(seqNum).padStart(5, '0')}`;

      // Insert Journal Header
      await txConn.run(
        `INSERT INTO journal_entries (
          id, workspace_id, entry_number, entry_date, description, source_type, source_id,
          reference_type, reference_id, status, is_posted, idempotency_key, audit_actor,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', 1, ?, ?, ?, ?)`,
        [
          entryId,
          command.workspaceId,
          entryNumber,
          command.entryDate,
          command.description,
          command.sourceType,
          command.sourceId || null,
          command.referenceType || null,
          command.referenceId || null,
          command.idempotencyKey || null,
          command.auditActor || 'local_user',
          now,
          now
        ]
      );

      // Insert Journal Lines
      const createdLines: any[] = [];
      for (const line of command.lines) {
        const lineId = EntityId.generate('jl');
        await txConn.run(
          `INSERT INTO journal_lines (
            id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled,
            currency_code, description, party_id, product_id, idempotency_key, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lineId,
            entryId,
            line.accountId,
            Number(line.debitAmountScaled),
            Number(line.creditAmountScaled),
            line.currencyCode || 'PKR',
            line.description || null,
            line.partyId || null,
            line.productId || null,
            command.idempotencyKey || null,
            now
          ]
        );
        createdLines.push({
          ...line,
          id: lineId
        });
      }

      // 6. Mark source posted as required if source ID given
      if (command.sourceType === 'invoice' && command.sourceId) {
        await txConn.run(
          `UPDATE documents SET status = 'unpaid', updated_at = ? WHERE id = ? AND workspace_id = ?`,
          [now, command.sourceId, command.workspaceId]
        );
      }

      return {
        id: entryId,
        workspaceId: command.workspaceId,
        entryNumber,
        entryDate: command.entryDate,
        description: command.description,
        sourceType: command.sourceType,
        sourceId: command.sourceId || null,
        referenceType: command.referenceType || null,
        referenceId: command.referenceId || null,
        status: 'posted' as JournalStatus,
        isPosted: true,
        idempotencyKey: command.idempotencyKey || null,
        auditActor: command.auditActor || 'local_user',
        lines: createdLines,
        createdAt: now,
        updatedAt: now
      };
    });

    // 7. Commit completed by executeTransaction
    // 8. Update/invalidate affected UI queries only after commit
    if (onPostCommitHook) {
      try {
        await onPostCommitHook();
      } catch (hookErr) {
        console.warn('Post-commit UI hook warning:', hookErr);
      }
    }

    return postedEntry;
  }

  /**
   * Reverses a posted journal entry with full audit trail and immutability preservation.
   */
  public static async reverseJournal(
    conn: DatabaseConnection,
    workspaceId: string,
    entryId: string,
    reason: string,
    auditActor = 'local_user',
    onPostCommitHook?: () => Promise<void> | void
  ): Promise<JournalEntryWithLines> {
    assertValid(validateRequiredString(workspaceId, 'Workspace ID'));
    assertValid(validateRequiredString(entryId, 'Journal Entry ID'));
    assertValid(validateRequiredString(reason, 'Reversal Reason'));

    const journalRepo = new JournalEntryRepository(conn);
    const original = await journalRepo.findById(entryId);
    if (!original) {
      throw new Error(`Journal entry ${entryId} not found.`);
    }
    if (original.workspaceId !== workspaceId) {
      throw new CrossWorkspaceIsolationError(`Journal entry ${entryId} does not belong to workspace ${workspaceId}.`);
    }

    const reversed = await journalRepo.reverseEntry(entryId, reason, auditActor);

    if (onPostCommitHook) {
      try {
        await onPostCommitHook();
      } catch (hookErr) {
        console.warn('Post-commit UI hook warning:', hookErr);
      }
    }

    return reversed;
  }

  /**
   * Intra-workspace account-to-account transfer (e.g. transfer between business cash and bank).
   * Records the two account sides without counting it as income or expense!
   */
  public static async postAccountTransfer(
    conn: DatabaseConnection,
    command: IntraWorkspaceTransferCommand,
    onPostCommitHook?: () => Promise<void> | void
  ): Promise<JournalEntryWithLines> {
    await WorkspaceService.validateWorkspaceAccess(conn, command.workspaceId);
    assertValid(validateRequiredString(command.sourceAccountId, 'Source Account ID'));
    assertValid(validateRequiredString(command.destinationAccountId, 'Destination Account ID'));
    assertValid(validatePositiveAmount(Number(command.amountScaled), 'Transfer Amount'));

    if (command.sourceAccountId === command.destinationAccountId) {
      throw new Error('Source and destination accounts must be different for a transfer.');
    }

    const accRepo = new AccountRepository(conn);
    const srcAcc = await accRepo.findById(command.sourceAccountId);
    const destAcc = await accRepo.findById(command.destinationAccountId);

    if (!srcAcc || srcAcc.workspaceId !== command.workspaceId) {
      throw new CrossWorkspaceIsolationError(`Source account does not belong to workspace ${command.workspaceId}.`);
    }
    if (!destAcc || destAcc.workspaceId !== command.workspaceId) {
      throw new CrossWorkspaceIsolationError(`Destination account does not belong to workspace ${command.workspaceId}.`);
    }

    // Verify neither account is revenue or expense
    if (srcAcc.type === 'revenue' || srcAcc.type === 'expense' || destAcc.type === 'revenue' || destAcc.type === 'expense') {
      throw new Error('Account transfers must be between balance-sheet accounts (cash, bank, etc.), not revenue or expense.');
    }

    const desc = command.description || `Transfer from ${srcAcc.name} to ${destAcc.name}`;
    const refNum = command.referenceNumber || `XFER-${Date.now().toString().slice(-6)}`;

    // Debit destination (receiving asset), Credit source (giving asset)
    return await this.postJournal(
      conn,
      {
        workspaceId: command.workspaceId,
        entryDate: command.transferDate,
        description: desc,
        sourceType: 'transfer',
        sourceId: refNum,
        referenceType: 'account_transfer',
        referenceId: refNum,
        idempotencyKey: command.idempotencyKey,
        auditActor: command.auditActor,
        lines: [
          {
            accountId: destAcc.id,
            debitAmountScaled: command.amountScaled,
            creditAmountScaled: 0n,
            description: `Transfer in from ${srcAcc.name}`
          },
          {
            accountId: srcAcc.id,
            debitAmountScaled: 0n,
            creditAmountScaled: command.amountScaled,
            description: `Transfer out to ${destAcc.name}`
          }
        ]
      },
      onPostCommitHook
    );
  }
}
