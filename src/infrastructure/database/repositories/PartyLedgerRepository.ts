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
    const rows = await this.conn.query<any>(
      `SELECT receivable_amount_scaled, payable_amount_scaled
       FROM party_ledger_entries
       WHERE workspace_id = ? AND party_id = ? AND is_reversed = 0`,
      [workspaceId, partyId]
    );

    let recTotal = 0n;
    let payTotal = 0n;

    for (const r of rows) {
      recTotal += BigInt(r.receivable_amount_scaled || 0);
      payTotal += BigInt(r.payable_amount_scaled || 0);
    }

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
   * Retrieves chronological party statement with pagination, running balances, and opening balance.
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

    // 2. Fetch all entries ordered by date ASC, id ASC for stable deterministic sequence
    const allRows = await this.conn.query<any>(
      `SELECT id, workspace_id, party_id, entry_date, entry_type, document_id, payment_id,
              journal_entry_id, reference_number, description, receivable_amount_scaled,
              payable_amount_scaled, running_balance_scaled, due_date, is_reversed, created_at
       FROM party_ledger_entries
       WHERE workspace_id = ? AND party_id = ?
       ORDER BY entry_date ASC, id ASC`,
      [workspaceId, partyId]
    );

    const totalCount = allRows.length;
    let runningCalc = 0n;
    let totalRec = 0n;
    let totalPay = 0n;

    const mappedEntries: PartyLedgerEntryRecord[] = allRows.map(r => {
      const rec = BigInt(r.receivable_amount_scaled || 0);
      const pay = BigInt(r.payable_amount_scaled || 0);
      const isRev = Boolean(r.is_reversed);

      if (!isRev) {
        runningCalc += rec - pay;
        totalRec += rec;
        totalPay += pay;
      }

      return {
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
        receivableAmountScaled: rec,
        payableAmountScaled: pay,
        runningBalanceScaled: runningCalc,
        dueDate: r.due_date,
        isReversed: isRev,
        createdAt: r.created_at
      };
    });

    const paginatedEntries = mappedEntries.slice(offset, offset + pageSize);
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
