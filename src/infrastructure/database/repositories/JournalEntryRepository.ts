/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export interface JournalLineItem {
  id?: string;
  accountId: string;
  debitAmountScaled: bigint;
  creditAmountScaled: bigint;
  description?: string | null;
  partyId?: string | null;
}

export interface JournalEntryHeader {
  id?: string;
  workspaceId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  isPosted?: boolean;
}

export interface JournalEntryWithLines extends JournalEntryHeader {
  id: string;
  lines: (JournalLineItem & { id: string })[];
  createdAt: string;
  updatedAt: string;
}

export class JournalEntryRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<JournalEntryWithLines | null> {
    const entryRows = await this.conn.query<{
      id: string;
      workspace_id: string;
      entry_number: string;
      entry_date: string;
      description: string;
      reference_type: string | null;
      reference_id: string | null;
      is_posted: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, entry_number, entry_date, description, reference_type, reference_id, is_posted, created_at, updated_at
       FROM journal_entries WHERE id = ? LIMIT 1`,
      [id]
    );

    if (entryRows.length === 0) return null;
    const e = entryRows[0];

    const lineRows = await this.conn.query<{
      id: string;
      journal_entry_id: string;
      account_id: string;
      debit_amount_scaled: number | string;
      credit_amount_scaled: number | string;
      description: string | null;
      party_id: string | null;
    }>(
      `SELECT id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled, description, party_id
       FROM journal_lines WHERE journal_entry_id = ? ORDER BY debit_amount_scaled DESC, id ASC`,
      [id]
    );

    return {
      id: e.id,
      workspaceId: e.workspace_id,
      entryNumber: e.entry_number,
      entryDate: e.entry_date,
      description: e.description,
      referenceType: e.reference_type,
      referenceId: e.reference_id,
      isPosted: Boolean(e.is_posted),
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      lines: lineRows.map(l => ({
        id: l.id,
        accountId: l.account_id,
        debitAmountScaled: BigInt(l.debit_amount_scaled || 0),
        creditAmountScaled: BigInt(l.credit_amount_scaled || 0),
        description: l.description,
        partyId: l.party_id
      }))
    };
  }

  public async createWithLines(
    entry: JournalEntryHeader,
    lines: JournalLineItem[]
  ): Promise<JournalEntryWithLines> {
    if (!lines || lines.length < 2) {
      throw new Error('A double-entry journal entry must have at least two journal lines.');
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

    const result = await this.conn.executeTransaction(async txConn => {
      // 1. Insert Entry Header
      await txConn.run(
        `INSERT INTO journal_entries (id, workspace_id, entry_number, entry_date, description, reference_type, reference_id, is_posted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          entry.workspaceId,
          entry.entryNumber,
          entry.entryDate,
          entry.description,
          entry.referenceType || null,
          entry.referenceId || null,
          isPosted ? 1 : 0,
          now,
          now
        ]
      );

      // 2. Insert Lines
      const createdLines: (JournalLineItem & { id: string })[] = [];
      for (const line of lines) {
        const lineId = line.id || generateEntityId('jl');
        await txConn.run(
          `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_amount_scaled, credit_amount_scaled, description, party_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lineId,
            entryId,
            line.accountId,
            Number(line.debitAmountScaled),
            Number(line.creditAmountScaled),
            line.description || null,
            line.partyId || null,
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
        isPosted,
        lines: createdLines,
        createdAt: now,
        updatedAt: now
      };
    });

    return result;
  }
}
