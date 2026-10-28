/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type PartyLedgerEntryType =
  | 'opening_balance'
  | 'credit_sale'
  | 'credit_purchase'
  | 'payment_received'
  | 'supplier_payment'
  | 'sales_return'
  | 'purchase_return'
  | 'credit_note'
  | 'debit_note'
  | 'adjustment';

export interface PartyLedgerEntryRecord {
  id: string;
  workspaceId: string;
  partyId: string;
  entryDate: string;
  entryType: PartyLedgerEntryType;
  documentId?: string | null;
  paymentId?: string | null;
  journalEntryId?: string | null;
  referenceNumber: string;
  description: string;
  receivableAmountScaled: bigint;
  payableAmountScaled: bigint;
  runningBalanceScaled: bigint;
  dueDate?: string | null;
  isReversed: boolean;
  createdAt: string;
}

export interface PartyStatementResult {
  partyId: string;
  openingBalanceScaled: bigint;
  openingBalanceType: 'receivable' | 'payable' | 'zero';
  entries: PartyLedgerEntryRecord[];
  totalReceivablesScaled: bigint;
  totalPayablesScaled: bigint;
  closingBalanceScaled: bigint;
  closingBalanceType: 'receivable' | 'payable' | 'zero';
  totalCount: number;
}

export class PartyLedgerRepository {
  constructor(private conn: DatabaseConnection) {}

  public async recordEntry(
    entry: Omit<PartyLedgerEntryRecord, 'id' | 'createdAt' | 'isReversed' | 'runningBalanceScaled'> & { id?: string }
  ): Promise<PartyLedgerEntryRecord> {
    const id = entry.id || generateEntityId('ple');
    const now = new Date().toISOString();

    // Compute new running balance based on previous balance
    const lastBalance = await this.getDerivedPartyBalance(entry.workspaceId, entry.partyId);
    // Net receivable balance: positive means customer owes business; negative means business owes party
    const delta = entry.receivableAmountScaled - entry.payableAmountScaled;
    const runningBalanceScaled = lastBalance.netBalanceScaled + delta;

    const record: PartyLedgerEntryRecord = {
      ...entry,
      id,
      runningBalanceScaled,
      isReversed: false,
      createdAt: now
    };

    await this.conn.run(
      `INSERT INTO party_ledger_entries (
        id, workspace_id, party_id, entry_date, entry_type, document_id, payment_id,
        journal_entry_id, reference_number, description, receivable_amount_scaled,
        payable_amount_scaled, running_balance_scaled, due_date, is_reversed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.workspaceId,
        record.partyId,
        record.entryDate,
        record.entryType,
        record.documentId || null,
        record.paymentId || null,
        record.journalEntryId || null,
        record.referenceNumber,
        record.description,
        Number(record.receivableAmountScaled),
        Number(record.payableAmountScaled),
        Number(record.runningBalanceScaled),
        record.dueDate || null,
        0,
        record.createdAt
      ]
    );

    return record;
  }

  /**
   * Derives authoritative party balance strictly from posted non-reversed ledger movements.
   * Net balance: positive = receivable (owed to business), negative = payable (business owes).
   * Aggregates directly in SQLite engine utilizing covering index idx_party_ledger_balance_covering.
   */
  public async getDerivedPartyBalance(
    workspaceId: string,
    partyId: string
  ): Promise<{
    receivableTotalScaled: bigint;
    payableTotalScaled: bigint;
    netBalanceScaled: bigint;
    balanceType: 'receivable' | 'payable' | 'zero';
  }> {
    const rows = await this.conn.query<{
      rec_total: number | string | null;
      pay_total: number | string | null;
    }>(
      `SELECT 
         COALESCE(SUM(receivable_amount_scaled), 0) AS rec_total,
         COALESCE(SUM(payable_amount_scaled), 0) AS pay_total
       FROM party_ledger_entries
       WHERE workspace_id = ? AND party_id = ? AND is_reversed = 0`,
      [workspaceId, partyId]
    );

    const recTotal = BigInt(rows[0]?.rec_total || 0);
    const payTotal = BigInt(rows[0]?.pay_total || 0);
    const net = recTotal - payTotal;
    const balanceType: 'receivable' | 'payable' | 'zero' =
      net > 0n ? 'receivable' : net < 0n ? 'payable' : 'zero';

    return {
      receivableTotalScaled: recTotal,
      payableTotalScaled: payTotal,
      netBalanceScaled: net,
      balanceType
    };
  }

  /**
   * Retrieves chronological party statement with SQL-level running balances and pagination.
   * Calculates totals and running balances inside SQLite via window functions without unbounded JS memory allocation.
   */
  public async getPartyStatement(
    workspaceId: string,
    partyId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<PartyStatementResult> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, options?.pageSize ?? 50);
    const offset = (page - 1) * pageSize;

    // 1. Fetch party for opening balance metadata
    const partyRows = await this.conn.query<any>(
      'SELECT opening_balance_scaled, opening_balance_type FROM parties WHERE id = ? LIMIT 1',
      [partyId]
    );

    const openingBalanceScaled = partyRows.length > 0 ? BigInt(partyRows[0].opening_balance_scaled || 0) : 0n;
    const openingBalanceType = partyRows.length > 0 ? (partyRows[0].opening_balance_type || 'zero') : 'zero';

    // 2. Aggregate count and totals in SQL using index-only scan
    const aggRows = await this.conn.query<any>(
      `SELECT 
         COUNT(*) as total_count,
         COALESCE(SUM(CASE WHEN is_reversed = 0 THEN receivable_amount_scaled ELSE 0 END), 0) as total_rec,
         COALESCE(SUM(CASE WHEN is_reversed = 0 THEN payable_amount_scaled ELSE 0 END), 0) as total_pay
       FROM party_ledger_entries
       WHERE workspace_id = ? AND party_id = ?`,
      [workspaceId, partyId]
    );

    const totalCount = Number(aggRows[0]?.total_count || 0);
    const totalRec = BigInt(aggRows[0]?.total_rec || 0);
    const totalPay = BigInt(aggRows[0]?.total_pay || 0);

    // 3. Retrieve only requested page with running balance computed in SQLite via window functions
    const pageRows = await this.conn.query<any>(
      `WITH ordered_entries AS (
         SELECT id, workspace_id, party_id, entry_date, entry_type, document_id, payment_id,
                journal_entry_id, reference_number, description, receivable_amount_scaled,
                payable_amount_scaled, due_date, is_reversed, created_at,
                SUM(CASE WHEN is_reversed = 0 THEN receivable_amount_scaled - payable_amount_scaled ELSE 0 END)
                  OVER (ORDER BY entry_date ASC, id ASC) AS running_balance_scaled
         FROM party_ledger_entries
         WHERE workspace_id = ? AND party_id = ?
       )
       SELECT * FROM ordered_entries
       ORDER BY entry_date ASC, id ASC
       LIMIT ? OFFSET ?`,
      [workspaceId, partyId, pageSize, offset]
    );

    const paginatedEntries: PartyLedgerEntryRecord[] = pageRows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      partyId: r.party_id,
      entryDate: r.entry_date,
      entryType: r.entry_type,
      documentId: r.document_id,
      paymentId: r.payment_id,
      journalEntryId: r.journal_entry_id,
      referenceNumber: r.reference_number,
      description: r.description,
      receivableAmountScaled: BigInt(r.receivable_amount_scaled || 0),
      payableAmountScaled: BigInt(r.payable_amount_scaled || 0),
      runningBalanceScaled: BigInt(r.running_balance_scaled || 0),
      dueDate: r.due_date,
      isReversed: Boolean(r.is_reversed),
      createdAt: r.created_at
    }));

    const closingNet = totalRec - totalPay;
    const closingType: 'receivable' | 'payable' | 'zero' =
      closingNet > 0n ? 'receivable' : closingNet < 0n ? 'payable' : 'zero';

    return {
      partyId,
      openingBalanceScaled,
      openingBalanceType,
      entries: paginatedEntries,
      totalReceivablesScaled: totalRec,
      totalPayablesScaled: totalPay,
      closingBalanceScaled: closingNet < 0n ? -closingNet : closingNet,
      closingBalanceType: closingType,
      totalCount
    };
  }

  /**
   * High-volume keyset-paginated statement seeker avoiding OFFSET degradation on deep histories.
   */
  public async getPartyStatementKeyset(
    workspaceId: string,
    partyId: string,
    cursor?: { entryDate: string; id: string },
    limit = 50
  ): Promise<{
    entries: PartyLedgerEntryRecord[];
    nextCursor: { entryDate: string; id: string } | null;
    hasMore: boolean;
  }> {
    const fetchLimit = limit + 1;
    let rows: any[];

    if (cursor) {
      rows = await this.conn.query<any>(
        `WITH ordered_entries AS (
           SELECT id, workspace_id, party_id, entry_date, entry_type, document_id, payment_id,
                  journal_entry_id, reference_number, description, receivable_amount_scaled,
                  payable_amount_scaled, due_date, is_reversed, created_at,
                  SUM(CASE WHEN is_reversed = 0 THEN receivable_amount_scaled - payable_amount_scaled ELSE 0 END)
                    OVER (ORDER BY entry_date ASC, id ASC) AS running_balance_scaled
           FROM party_ledger_entries
           WHERE workspace_id = ? AND party_id = ?
         )
         SELECT * FROM ordered_entries
         WHERE entry_date > ? OR (entry_date = ? AND id > ?)
         ORDER BY entry_date ASC, id ASC
         LIMIT ?`,
        [workspaceId, partyId, cursor.entryDate, cursor.entryDate, cursor.id, fetchLimit]
      );
    } else {
      rows = await this.conn.query<any>(
        `WITH ordered_entries AS (
           SELECT id, workspace_id, party_id, entry_date, entry_type, document_id, payment_id,
                  journal_entry_id, reference_number, description, receivable_amount_scaled,
                  payable_amount_scaled, due_date, is_reversed, created_at,
                  SUM(CASE WHEN is_reversed = 0 THEN receivable_amount_scaled - payable_amount_scaled ELSE 0 END)
                    OVER (ORDER BY entry_date ASC, id ASC) AS running_balance_scaled
           FROM party_ledger_entries
           WHERE workspace_id = ? AND party_id = ?
         )
         SELECT * FROM ordered_entries
         ORDER BY entry_date ASC, id ASC
         LIMIT ?`,
        [workspaceId, partyId, fetchLimit]
      );
    }

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const entries: PartyLedgerEntryRecord[] = items.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      partyId: r.party_id,
      entryDate: r.entry_date,
      entryType: r.entry_type,
      documentId: r.document_id,
      paymentId: r.payment_id,
      journalEntryId: r.journal_entry_id,
      referenceNumber: r.reference_number,
      description: r.description,
      receivableAmountScaled: BigInt(r.receivable_amount_scaled || 0),
      payableAmountScaled: BigInt(r.payable_amount_scaled || 0),
      runningBalanceScaled: BigInt(r.running_balance_scaled || 0),
      dueDate: r.due_date,
      isReversed: Boolean(r.is_reversed),
      createdAt: r.created_at
    }));

    const nextCursor = hasMore && entries.length > 0
      ? { entryDate: entries[entries.length - 1].entryDate, id: entries[entries.length - 1].id }
      : null;

    return { entries, nextCursor, hasMore };
  }

  /**
   * Reverse a specific ledger entry linked to a reversed payment or document.
   */
  public async reverseEntryByReference(
    workspaceId: string,
    refType: 'document' | 'payment',
    refId: string
  ): Promise<void> {
    const col = refType === 'document' ? 'document_id' : 'payment_id';
    await this.conn.run(
      `UPDATE party_ledger_entries SET is_reversed = 1 WHERE workspace_id = ? AND ${col} = ?`,
      [workspaceId, refId]
    );
  }
}
