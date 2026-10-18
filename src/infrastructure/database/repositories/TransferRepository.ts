/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type TransferType =
  | 'owner_capital'
  | 'owner_loan'
  | 'owner_drawing'
  | 'owner_loan_repayment'
  | 'internal_funding'
  | 'other';

export type TransferStatus = 'pending' | 'completed' | 'cancelled' | 'reversed';

export interface InterWorkspaceTransferRecord {
  id: string;
  transferNumber: string;
  sourceWorkspaceId: string;
  destinationWorkspaceId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountScaled: bigint;
  currencyCode: string;
  transferDate: string;
  transferType: TransferType;
  note?: string | null;
  status: TransferStatus;
  sourceJournalEntryId?: string | null;
  destinationJournalEntryId?: string | null;
  reversalTransferId?: string | null;
  reversalReason?: string | null;
  idempotencyKey?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class TransferRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<InterWorkspaceTransferRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, transfer_number, source_workspace_id, destination_workspace_id,
              source_account_id, destination_account_id, amount_scaled, currency_code,
              transfer_date, transfer_type, note, status, source_journal_entry_id,
              destination_journal_entry_id, reversal_transfer_id, reversal_reason,
              idempotency_key, created_by, created_at, updated_at
       FROM inter_workspace_transfers WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<InterWorkspaceTransferRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, transfer_number, source_workspace_id, destination_workspace_id,
              source_account_id, destination_account_id, amount_scaled, currency_code,
              transfer_date, transfer_type, note, status, source_journal_entry_id,
              destination_journal_entry_id, reversal_transfer_id, reversal_reason,
              idempotency_key, created_by, created_at, updated_at
       FROM inter_workspace_transfers WHERE idempotency_key = ? LIMIT 1`,
      [idempotencyKey]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(
    workspaceId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ transfers: InterWorkspaceTransferRecord[]; totalCount: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRows = await this.conn.query<any>(
      `SELECT COUNT(*) as count FROM inter_workspace_transfers
       WHERE source_workspace_id = ? OR destination_workspace_id = ?`,
      [workspaceId, workspaceId]
    );
    const totalCount = Number(countRows[0]?.count || 0);

    const rows = await this.conn.query<any>(
      `SELECT id, transfer_number, source_workspace_id, destination_workspace_id,
              source_account_id, destination_account_id, amount_scaled, currency_code,
              transfer_date, transfer_type, note, status, source_journal_entry_id,
              destination_journal_entry_id, reversal_transfer_id, reversal_reason,
              idempotency_key, created_by, created_at, updated_at
       FROM inter_workspace_transfers
       WHERE source_workspace_id = ? OR destination_workspace_id = ?
       ORDER BY transfer_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [workspaceId, workspaceId, pageSize, offset]
    );

    return {
      transfers: rows.map(r => this.mapRow(r)),
      totalCount
    };
  }

  public async create(record: Omit<InterWorkspaceTransferRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<InterWorkspaceTransferRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('xfer');

    const created: InterWorkspaceTransferRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO inter_workspace_transfers (
        id, transfer_number, source_workspace_id, destination_workspace_id,
        source_account_id, destination_account_id, amount_scaled, currency_code,
        transfer_date, transfer_type, note, status, source_journal_entry_id,
        destination_journal_entry_id, reversal_transfer_id, reversal_reason,
        idempotency_key, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.transferNumber,
        created.sourceWorkspaceId,
        created.destinationWorkspaceId,
        created.sourceAccountId,
        created.destinationAccountId,
        Number(created.amountScaled),
        created.currencyCode,
        created.transferDate,
        created.transferType,
        created.note || null,
        created.status,
        created.sourceJournalEntryId || null,
        created.destinationJournalEntryId || null,
        created.reversalTransferId || null,
        created.reversalReason || null,
        created.idempotencyKey || null,
        created.createdBy,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }

  public async updateStatus(
    id: string,
    status: TransferStatus,
    extra?: { reversalTransferId?: string; reversalReason?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.conn.run(
      `UPDATE inter_workspace_transfers SET
        status = ?, reversal_transfer_id = COALESCE(?, reversal_transfer_id),
        reversal_reason = COALESCE(?, reversal_reason), updated_at = ?
       WHERE id = ?`,
      [status, extra?.reversalTransferId || null, extra?.reversalReason || null, now, id]
    );
  }

  private mapRow(r: any): InterWorkspaceTransferRecord {
    return {
      id: r.id,
      transferNumber: r.transfer_number,
      sourceWorkspaceId: r.source_workspace_id,
      destinationWorkspaceId: r.destination_workspace_id,
      sourceAccountId: r.source_account_id,
      destinationAccountId: r.destination_account_id,
      amountScaled: BigInt(r.amount_scaled || 0),
      currencyCode: r.currency_code,
      transferDate: r.transfer_date,
      transferType: r.transfer_type as TransferType,
      note: r.note,
      status: r.status as TransferStatus,
      sourceJournalEntryId: r.source_journal_entry_id,
      destinationJournalEntryId: r.destination_journal_entry_id,
      reversalTransferId: r.reversal_transfer_id,
      reversalReason: r.reversal_reason,
      idempotencyKey: r.idempotency_key,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
