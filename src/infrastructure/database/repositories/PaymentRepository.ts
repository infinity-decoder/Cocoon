/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type PaymentType = 'customer_receipt' | 'supplier_payment' | 'customer_refund' | 'supplier_refund';

export interface PaymentRecord {
  id: string;
  workspaceId: string;
  partyId: string;
  paymentNumber: string;
  paymentType: PaymentType;
  paymentDate: string;
  paymentMethod: string;
  accountId?: string | null;
  amountScaled: bigint;
  allocatedAmountScaled: bigint;
  unallocatedAmountScaled: bigint;
  referenceNumber?: string | null;
  notes?: string | null;
  attachmentPath?: string | null;
  isReversed: boolean;
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversalJournalEntryId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocationRecord {
  id: string;
  workspaceId: string;
  paymentId: string;
  documentId: string;
  allocatedAmountScaled: bigint;
  createdAt: string;
}

export interface PaymentWithAllocations extends PaymentRecord {
  allocations: PaymentAllocationRecord[];
}

export class PaymentRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<PaymentWithAllocations | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, party_id, payment_number, payment_type, payment_date,
              payment_method, account_id, amount_scaled, allocated_amount_scaled,
              unallocated_amount_scaled, reference_number, notes, attachment_path,
              is_reversed, reversal_reason, reversed_at, reversal_journal_entry_id,
              created_at, updated_at
       FROM payments WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    const payment = this.mapPaymentRow(rows[0]);

    const allocRows = await this.conn.query<any>(
      `SELECT id, workspace_id, payment_id, document_id, allocated_amount_scaled, created_at
       FROM payment_allocations WHERE payment_id = ?`,
      [id]
    );

    const allocations = allocRows.map(r => this.mapAllocationRow(r));
    return { ...payment, allocations };
  }

  public async findByWorkspace(workspaceId: string): Promise<PaymentRecord[]> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, party_id, payment_number, payment_type, payment_date,
              payment_method, account_id, amount_scaled, allocated_amount_scaled,
              unallocated_amount_scaled, reference_number, notes, attachment_path,
              is_reversed, reversal_reason, reversed_at, reversal_journal_entry_id,
              created_at, updated_at
       FROM payments WHERE workspace_id = ? ORDER BY payment_date DESC, payment_number DESC`,
      [workspaceId]
    );

    return rows.map(r => this.mapPaymentRow(r));
  }

  public async findByParty(workspaceId: string, partyId: string): Promise<PaymentWithAllocations[]> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, party_id, payment_number, payment_type, payment_date,
              payment_method, account_id, amount_scaled, allocated_amount_scaled,
              unallocated_amount_scaled, reference_number, notes, attachment_path,
              is_reversed, reversal_reason, reversed_at, reversal_journal_entry_id,
              created_at, updated_at
       FROM payments WHERE workspace_id = ? AND party_id = ? ORDER BY payment_date DESC, id DESC`,
      [workspaceId, partyId]
    );

    const result: PaymentWithAllocations[] = [];
    for (const r of rows) {
      const payment = this.mapPaymentRow(r);
      const allocRows = await this.conn.query<any>(
        `SELECT id, workspace_id, payment_id, document_id, allocated_amount_scaled, created_at
         FROM payment_allocations WHERE payment_id = ?`,
        [payment.id]
      );
      result.push({
        ...payment,
        allocations: allocRows.map(ar => this.mapAllocationRow(ar))
      });
    }

    return result;
  }

  public async createWithAllocations(
    payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'isReversed' | 'allocatedAmountScaled' | 'unallocatedAmountScaled'> & { id?: string },
    allocations: Array<{ documentId: string; amountScaled: bigint }>
  ): Promise<PaymentWithAllocations> {
    const paymentId = payment.id || generateEntityId('pay');
    const now = new Date().toISOString();

    let totalAllocatedScaled = 0n;
    for (const alloc of allocations) {
      totalAllocatedScaled += alloc.amountScaled;
    }

    if (totalAllocatedScaled > payment.amountScaled) {
      throw new Error(`Total allocated amount (${totalAllocatedScaled}) cannot exceed payment amount (${payment.amountScaled}).`);
    }

    const unallocatedScaled = payment.amountScaled - totalAllocatedScaled;

    const createdPayment: PaymentRecord = {
      ...payment,
      id: paymentId,
      allocatedAmountScaled: totalAllocatedScaled,
      unallocatedAmountScaled: unallocatedScaled,
      isReversed: false,
      reversalReason: null,
      reversedAt: null,
      reversalJournalEntryId: null,
      createdAt: now,
      updatedAt: now
    };

    const createdAllocations: PaymentAllocationRecord[] = allocations.map(a => ({
      id: generateEntityId('alloc'),
      workspaceId: payment.workspaceId,
      paymentId,
      documentId: a.documentId,
      allocatedAmountScaled: a.amountScaled,
      createdAt: now
    }));

    await this.conn.executeTransaction(async () => {
      // 1. Insert Payment
      await this.conn.run(
        `INSERT INTO payments (
          id, workspace_id, party_id, payment_number, payment_type, payment_date,
          payment_method, account_id, amount_scaled, allocated_amount_scaled,
          unallocated_amount_scaled, reference_number, notes, attachment_path,
          is_reversed, reversal_reason, reversed_at, reversal_journal_entry_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdPayment.id,
          createdPayment.workspaceId,
          createdPayment.partyId,
          createdPayment.paymentNumber,
          createdPayment.paymentType,
          createdPayment.paymentDate,
          createdPayment.paymentMethod,
          createdPayment.accountId || null,
          Number(createdPayment.amountScaled),
          Number(createdPayment.allocatedAmountScaled),
          Number(createdPayment.unallocatedAmountScaled),
          createdPayment.referenceNumber || null,
          createdPayment.notes || null,
          createdPayment.attachmentPath || null,
          0,
          null,
          null,
          null,
          createdPayment.createdAt,
          createdPayment.updatedAt
        ]
      );

      // 2. Insert Allocations & update document paid amounts and statuses
      for (const alloc of createdAllocations) {
        await this.conn.run(
          `INSERT INTO payment_allocations (id, workspace_id, payment_id, document_id, allocated_amount_scaled, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            alloc.id,
            alloc.workspaceId,
            alloc.paymentId,
            alloc.documentId,
            Number(alloc.allocatedAmountScaled),
            alloc.createdAt
          ]
        );

        // Update document paid_amount_scaled and status
        const docRows = await this.conn.query<any>('SELECT total_scaled, paid_amount_scaled FROM documents WHERE id = ?', [alloc.documentId]);
        if (docRows.length > 0) {
          const doc = docRows[0];
          const newPaid = BigInt(doc.paid_amount_scaled || 0) + alloc.allocatedAmountScaled;
          const total = BigInt(doc.total_scaled || 0);
          const nextStatus = newPaid >= total ? 'paid' : newPaid > 0n ? 'partial' : 'unpaid';

          await this.conn.run(
            'UPDATE documents SET paid_amount_scaled = ?, status = ?, updated_at = ? WHERE id = ?',
            [Number(newPaid), nextStatus, now, alloc.documentId]
          );
        }
      }
    });

    return {
      ...createdPayment,
      allocations: createdAllocations
    };
  }

  /**
   * Reverse a posted payment through an audited reversal process,
   * preserving history while releasing document allocations.
   */
  public async reversePayment(
    paymentId: string,
    reason: string,
    reversalJournalEntryId?: string
  ): Promise<PaymentRecord> {
    const existing = await this.findById(paymentId);
    if (!existing) {
      throw new Error(`Payment ${paymentId} not found.`);
    }
    if (existing.isReversed) {
      throw new Error(`Payment ${paymentId} has already been reversed.`);
    }

    const now = new Date().toISOString();

    await this.conn.executeTransaction(async () => {
      // 1. Mark payment as reversed
      await this.conn.run(
        `UPDATE payments SET
          is_reversed = 1,
          reversal_reason = ?,
          reversed_at = ?,
          reversal_journal_entry_id = ?,
          updated_at = ?
         WHERE id = ?`,
        [reason, now, reversalJournalEntryId || null, now, paymentId]
      );

      // 2. Release allocations on documents
      for (const alloc of existing.allocations) {
        const docRows = await this.conn.query<any>('SELECT total_scaled, paid_amount_scaled FROM documents WHERE id = ?', [alloc.documentId]);
        if (docRows.length > 0) {
          const doc = docRows[0];
          const curPaid = BigInt(doc.paid_amount_scaled || 0);
          const newPaid = curPaid > alloc.allocatedAmountScaled ? curPaid - alloc.allocatedAmountScaled : 0n;
          const total = BigInt(doc.total_scaled || 0);
          const nextStatus = newPaid >= total ? 'paid' : newPaid > 0n ? 'partial' : 'unpaid';

          await this.conn.run(
            'UPDATE documents SET paid_amount_scaled = ?, status = ?, updated_at = ? WHERE id = ?',
            [Number(newPaid), nextStatus, now, alloc.documentId]
          );
        }
      }
    });

    return {
      ...existing,
      isReversed: true,
      reversalReason: reason,
      reversedAt: now,
      reversalJournalEntryId: reversalJournalEntryId || null,
      updatedAt: now
    };
  }

  private mapPaymentRow(r: any): PaymentRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      partyId: r.party_id,
      paymentNumber: r.payment_number,
      paymentType: r.payment_type,
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method,
      accountId: r.account_id,
      amountScaled: BigInt(r.amount_scaled || 0),
      allocatedAmountScaled: BigInt(r.allocated_amount_scaled || 0),
      unallocatedAmountScaled: BigInt(r.unallocated_amount_scaled || 0),
      referenceNumber: r.reference_number,
      notes: r.notes,
      attachmentPath: r.attachment_path,
      isReversed: Boolean(r.is_reversed),
      reversalReason: r.reversal_reason,
      reversedAt: r.reversed_at,
      reversalJournalEntryId: r.reversal_journal_entry_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapAllocationRow(r: any): PaymentAllocationRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      paymentId: r.payment_id,
      documentId: r.document_id,
      allocatedAmountScaled: BigInt(r.allocated_amount_scaled || 0),
      createdAt: r.created_at
    };
  }
}
