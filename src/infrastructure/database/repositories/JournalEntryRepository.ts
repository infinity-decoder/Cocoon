/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type JournalSourceType =
  | 'manual'
  | 'transfer'
  | 'inter_workspace_transfer'
  | 'invoice'
  | 'payment'
  | 'reversal'
  | 'opening_balance';

export type JournalStatus = 'draft' | 'posted' | 'reversed';

export interface JournalLineItem {
  id?: string;
  accountId: string;
  debitAmountScaled: bigint;
  creditAmountScaled: bigint;
  currencyCode?: string;
  description?: string | null;
  partyId?: string | null;
  productId?: string | null;
  idempotencyKey?: string | null;
}

export interface JournalEntryHeader {
  id?: string;
  workspaceId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType?: JournalSourceType;
  sourceId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  status?: JournalStatus;
  reversalOfEntryId?: string | null;
  reversedByEntryId?: string | null;
  reversalReason?: string | null;
  idempotencyKey?: string | null;
  auditActor?: string;
  isPosted?: boolean;
}

export interface JournalEntryWithLines extends JournalEntryHeader {
  id: string;
  status: JournalStatus;
  sourceType: JournalSourceType;
  lines: (JournalLineItem & { id: string })[];
  createdAt: string;
  updatedAt: string;
}

export class JournalEntryRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<JournalEntryWithLines | null> {
    const entryRows = await this.conn.query<any>(
      `SELECT id, workspace_id, entry_number, entry_date, description, source_type, source_id,
              reference_type, reference_id, status, is_posted, reversal_of_entry_id, reversed_by_entry_id,
              reversal_reason, idempotency_key, audit_actor, created_at, updated_at
       FROM journal_entries WHERE id = ? LIMIT 1`,
      [id]
    );

    if (entryRows.length === 0) return null;
    const e = entryRows[0];

    const lineRows = await this.conn.query<any>(
      `SELECT id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled, currency_code,
              description, party_id, product_id, idempotency_key
       FROM journal_lines WHERE journal_entry_id = ? ORDER BY debit_amount_scaled DESC, id ASC`,
      [id]
    );

    return {
      id: e.id,
      workspaceId: e.workspace_id,
      entryNumber: e.entry_number,
      entryDate: e.entry_date,
      description: e.description,
      sourceType: (e.source_type as JournalSourceType) || 'manual',
      sourceId: e.source_id,
      referenceType: e.reference_type,
      referenceId: e.reference_id,
      status: (e.status as JournalStatus) || (e.is_posted ? 'posted' : 'draft'),
      isPosted: Boolean(e.is_posted),
      reversalOfEntryId: e.reversal_of_entry_id,
      reversedByEntryId: e.reversed_by_entry_id,
      reversalReason: e.reversal_reason,
      idempotencyKey: e.idempotency_key,
      auditActor: e.audit_actor || 'local_user',
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      lines: lineRows.map(l => ({
        id: l.id,
        accountId: l.account_id,
        debitAmountScaled: BigInt(l.debit_amount_scaled || 0),
        creditAmountScaled: BigInt(l.credit_amount_scaled || 0),
        currencyCode: l.currency_code || 'PKR',
        description: l.description,
        partyId: l.party_id,
        productId: l.product_id,
        idempotencyKey: l.idempotency_key
      }))
    };
  }

  public async findByIdempotencyKey(workspaceId: string, idempotencyKey: string): Promise<JournalEntryWithLines | null> {
    const entryRows = await this.conn.query<any>(
      `SELECT id FROM journal_entries WHERE workspace_id = ? AND idempotency_key = ? LIMIT 1`,
      [workspaceId, idempotencyKey]
    );

    if (entryRows.length === 0) return null;
    return this.findById(entryRows[0].id);
  }

  public async findByWorkspace(
    workspaceId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ entries: JournalEntryWithLines[]; totalCount: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as count FROM journal_entries WHERE workspace_id = ?`,
      [workspaceId]
    );
    const totalCount = Number(countRows[0]?.count || 0);

    const rows = await this.conn.query<any>(
      `SELECT id FROM journal_entries WHERE workspace_id = ? ORDER BY entry_date DESC, entry_number DESC LIMIT ? OFFSET ?`,
      [workspaceId, pageSize, offset]
    );

    const entries: JournalEntryWithLines[] = [];
    for (const r of rows) {
      const entry = await this.findById(r.id);
      if (entry) entries.push(entry);
    }

    return { entries, totalCount };
  }

  public async createWithLines(
    entry: JournalEntryHeader,
    lines: JournalLineItem[]
  ): Promise<JournalEntryWithLines> {
    if (!lines || lines.length < 2) {
      throw new Error('A double-entry journal entry must have at least two journal lines.');
    }

    // Check idempotency first if key provided
    if (entry.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(entry.workspaceId, entry.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // Enforce accounting equation: Total Debits === Total Credits
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const line of lines) {
      if (line.debitAmountScaled < 0n || line.creditAmountScaled < 0n) {
        throw new Error('Debit and credit amounts cannot be negative.');
      }
      if (line.debitAmountScaled > 0n && line.creditAmountScaled > 0n) {
        throw new Error('A single journal line cannot contain both debit and credit amounts.');
      }
      totalDebit += line.debitAmountScaled;
      totalCredit += line.creditAmountScaled;
    }

    if (totalDebit === 0n || totalDebit !== totalCredit) {
      throw new Error(
        `Journal entry is unbalanced: Total Debits (${totalDebit}) != Total Credits (${totalCredit}).`
      );
    }

    const now = new Date().toISOString();
    const entryId = entry.id || generateEntityId('je');
    const isPosted = entry.isPosted !== undefined ? entry.isPosted : true;
    const status: JournalStatus = entry.status || (isPosted ? 'posted' : 'draft');
    const sourceType: JournalSourceType = entry.sourceType || 'manual';
    const auditActor = entry.auditActor || 'local_user';

    const result = await this.conn.executeTransaction(async txConn => {
      // 1. Insert Entry Header
      await txConn.run(
        `INSERT INTO journal_entries (
          id, workspace_id, entry_number, entry_date, description, source_type, source_id,
          reference_type, reference_id, status, is_posted, reversal_of_entry_id, reversed_by_entry_id,
          reversal_reason, idempotency_key, audit_actor, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          entry.workspaceId,
          entry.entryNumber,
          entry.entryDate,
          entry.description,
          sourceType,
          entry.sourceId || null,
          entry.referenceType || null,
          entry.referenceId || null,
          status,
          isPosted ? 1 : 0,
          entry.reversalOfEntryId || null,
          entry.reversedByEntryId || null,
          entry.reversalReason || null,
          entry.idempotencyKey || null,
          auditActor,
          now,
          now
        ]
      );

      // 2. Insert Lines
      const createdLines: (JournalLineItem & { id: string })[] = [];
      for (const line of lines) {
        const lineId = line.id || generateEntityId('jl');
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
            line.idempotencyKey || null,
            now
          ]
        );
        createdLines.push({
          ...line,
          id: lineId
        });
      }

      return {
        ...entry,
        id: entryId,
        sourceType,
        status,
        isPosted,
        auditActor,
        lines: createdLines,
        createdAt: now,
        updatedAt: now
      };
    });

    return result;
  }

  /**
   * Reverses an existing posted journal entry by creating a compensating reversal entry.
   * Original entry is marked as 'reversed' and cannot be reversed again.
   * All debits become credits and all credits become debits.
   */
  public async reverseEntry(
    entryId: string,
    reason: string,
    auditActor = 'local_user'
  ): Promise<JournalEntryWithLines> {
    const original = await this.findById(entryId);
    if (!original) {
      throw new Error(`Journal entry ${entryId} not found.`);
    }

    if (original.status === 'reversed' || original.reversedByEntryId) {
      throw new Error(`Journal entry ${original.entryNumber} has already been reversed.`);
    }

    const now = new Date().toISOString();
    const reversalEntryId = generateEntityId('je');
    const reversalEntryNumber = `REV-${original.entryNumber}`;

    // Flip debits and credits
    const reversalLines: JournalLineItem[] = original.lines.map(line => ({
      accountId: line.accountId,
      debitAmountScaled: line.creditAmountScaled, // Flipped!
      creditAmountScaled: line.debitAmountScaled, // Flipped!
      currencyCode: line.currencyCode,
      description: `Reversal of ${line.description || original.entryNumber}`,
      partyId: line.partyId,
      productId: line.productId
    }));

    return await this.conn.executeTransaction(async txConn => {
      // 1. Insert compensating reversing entry
      await txConn.run(
        `INSERT INTO journal_entries (
          id, workspace_id, entry_number, entry_date, description, source_type, source_id,
          reference_type, reference_id, status, is_posted, reversal_of_entry_id, reversed_by_entry_id,
          reversal_reason, audit_actor, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        [
          reversalEntryId,
          original.workspaceId,
          reversalEntryNumber,
          now.split('T')[0],
          `Compensating Reversal for ${original.entryNumber}: ${reason}`,
          'reversal',
          original.id,
          'journal_entry_reversal',
          original.id,
          'posted',
          1,
          original.id,
          reason,
          auditActor,
          now,
          now
        ]
      );

      // 2. Mark original entry as reversed now that reversal entry exists
      await txConn.run(
        `UPDATE journal_entries SET status = 'reversed', reversed_by_entry_id = ?, reversal_reason = ?, updated_at = ? WHERE id = ?`,
        [reversalEntryId, reason, now, original.id]
      );

      // 3. Insert reversal lines
      const createdLines: (JournalLineItem & { id: string })[] = [];
      for (const line of reversalLines) {
        const lineId = generateEntityId('jl');
        await txConn.run(
          `INSERT INTO journal_lines (
            id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled,
            currency_code, description, party_id, product_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lineId,
            reversalEntryId,
            line.accountId,
            Number(line.debitAmountScaled),
            Number(line.creditAmountScaled),
            line.currencyCode || 'PKR',
            line.description || null,
            line.partyId || null,
            line.productId || null,
            now
          ]
        );
        createdLines.push({
          ...line,
          id: lineId
        });
      }

      return {
        id: reversalEntryId,
        workspaceId: original.workspaceId,
        entryNumber: reversalEntryNumber,
        entryDate: now.split('T')[0],
        description: `Compensating Reversal for ${original.entryNumber}: ${reason}`,
        sourceType: 'reversal' as JournalSourceType,
        sourceId: original.id,
        referenceType: 'journal_entry_reversal',
        referenceId: original.id,
        status: 'posted' as JournalStatus,
        isPosted: true,
        reversalOfEntryId: original.id,
        reversalReason: reason,
        auditActor,
        lines: createdLines,
        createdAt: now,
        updatedAt: now
      };
    });
  }
}
