/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { DocumentType, DocumentStatus, DocumentLineItem } from '../../../domain/documents/Invoice';

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  documentType: DocumentType;
  documentNumber: string;
  partyId?: string | null;
  partyName: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  status: DocumentStatus;
  paymentMethod?: string | null;
  isPos?: boolean;
  cashierName?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  attachmentRelativePath?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentWithLines extends DocumentRecord {
  lines: DocumentLineItem[];
}

export class DocumentRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<DocumentWithLines | null> {
    const docRows = await this.conn.query<any>(
      `SELECT id, workspace_id, document_type, document_number, party_id, party_name,
              issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
              tax_scaled, total_scaled, paid_amount_scaled, status, notes,
              attachment_relative_path, is_archived, created_at, updated_at
       FROM documents WHERE id = ? LIMIT 1`,
      [id]
    );

    if (docRows.length === 0) return null;
    const doc = this.mapDocRow(docRows[0]);

    const lineRows = await this.conn.query<any>(
      `SELECT id, document_id, item_id, description, quantity, unit_price_scaled,
              discount_scaled, tax_rate_percent, tax_scaled, total_scaled
       FROM document_lines WHERE document_id = ?`,
      [id]
    );

    const lines: DocumentLineItem[] = lineRows.map(l => ({
      id: l.id,
      itemId: l.item_id || undefined,
      productId: l.item_id || undefined,
      packageUnit: l.package_unit || undefined,
      costPriceScaled: l.cost_price_scaled ? BigInt(l.cost_price_scaled) : undefined,
      returnedQuantity: l.returned_quantity !== undefined ? Number(l.returned_quantity) : undefined,
      description: l.description,
      quantity: Number(l.quantity),
      unitPriceScaled: BigInt(l.unit_price_scaled),
      discountScaled: BigInt(l.discount_scaled),
      taxRatePercent: Number(l.tax_rate_percent),
      taxScaled: BigInt(l.tax_scaled),
      totalScaled: BigInt(l.total_scaled)
    }));

    return { ...doc, lines };
  }

  public async findByWorkspace(workspaceId: string, filterType?: DocumentType): Promise<DocumentWithLines[]> {
    const sql = filterType
      ? `SELECT id, workspace_id, document_type, document_number, party_id, party_name,
                issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
                tax_scaled, total_scaled, paid_amount_scaled, status, notes,
                attachment_relative_path, is_archived, created_at, updated_at
         FROM documents WHERE workspace_id = ? AND document_type = ? ORDER BY issue_date DESC, document_number DESC`
      : `SELECT id, workspace_id, document_type, document_number, party_id, party_name,
                issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
                tax_scaled, total_scaled, paid_amount_scaled, status, notes,
                attachment_relative_path, is_archived, created_at, updated_at
         FROM documents WHERE workspace_id = ? ORDER BY issue_date DESC, document_number DESC`;

    const params = filterType ? [workspaceId, filterType] : [workspaceId];
    const docRows = await this.conn.query<any>(sql, params);

    return docRows.map(r => ({
      ...this.mapDocRow(r),
      lines: []
    }));
  }

  public async createWithLines(
    doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<DocumentLineItem, 'id'>[]
  ): Promise<DocumentWithLines> {
    const docId = doc.id || generateEntityId('doc');
    const now = new Date().toISOString();

    const createdDoc: DocumentRecord = {
      ...doc,
      id: docId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: DocumentLineItem[] = lines.map(l => ({
      ...l,
      id: generateEntityId('dline')
    }));

    await this.conn.executeTransaction(async () => {
      await this.conn.run(
        `INSERT INTO documents (
          id, workspace_id, document_type, document_number, party_id, party_name,
          issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
          tax_scaled, total_scaled, paid_amount_scaled, status, notes,
          attachment_relative_path, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdDoc.id,
          createdDoc.workspaceId,
          createdDoc.documentType,
          createdDoc.documentNumber,
          createdDoc.partyId || null,
          createdDoc.partyName,
          createdDoc.issueDate,
          createdDoc.dueDate,
          createdDoc.currencyCode,
          Number(createdDoc.subtotalScaled),
          Number(createdDoc.discountScaled),
          Number(createdDoc.taxScaled),
          Number(createdDoc.totalScaled),
          Number(createdDoc.paidAmountScaled),
          createdDoc.status,
          createdDoc.notes || null,
          createdDoc.attachmentRelativePath || null,
          createdDoc.isArchived ? 1 : 0,
          createdDoc.createdAt,
          createdDoc.updatedAt
        ]
      );

      for (const line of createdLines) {
        await this.conn.run(
          `INSERT INTO document_lines (
            id, document_id, item_id, description, quantity, unit_price_scaled,
            discount_scaled, tax_rate_percent, tax_scaled, total_scaled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.id,
            createdDoc.id,
            line.itemId || null,
            line.description,
            line.quantity,
            Number(line.unitPriceScaled),
            Number(line.discountScaled),
            line.taxRatePercent,
            Number(line.taxScaled),
            Number(line.totalScaled)
          ]
        );
      }
    });

    return {
      ...createdDoc,
      lines: createdLines
    };
  }

  public async archive(id: string): Promise<void> {
    await this.conn.run(
      'UPDATE documents SET is_archived = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  private mapDocRow(r: any): DocumentRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      documentType: r.document_type,
      documentNumber: r.document_number,
      partyId: r.party_id,
      partyName: r.party_name,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      currencyCode: r.currency_code,
      subtotalScaled: BigInt(r.subtotal_scaled ?? 0),
      discountScaled: BigInt(r.discount_scaled ?? 0),
      taxScaled: BigInt(r.tax_scaled ?? 0),
      totalScaled: BigInt(r.total_scaled ?? 0),
      paidAmountScaled: BigInt(r.paid_amount_scaled ?? 0),
      status: r.status,
      paymentMethod: r.payment_method,
      isPos: Boolean(r.is_pos),
      cashierName: r.cashier_name,
      idempotencyKey: r.idempotency_key,
      notes: r.notes,
      attachmentRelativePath: r.attachment_relative_path,
      isArchived: Boolean(r.is_archived),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
