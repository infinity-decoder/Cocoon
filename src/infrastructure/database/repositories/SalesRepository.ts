/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { DocumentWithLines, DocumentRecord } from './DocumentRepository';
import { DocumentLineItem } from '../../../domain/documents/Invoice';

export interface SalesReturnRecord {
  id: string;
  workspaceId: string;
  returnNumber: string;
  originalDocumentId: string;
  partyId?: string | null;
  partyName: string;
  returnDate: string;
  subtotalScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  refundAmountScaled: bigint;
  settlementType: 'cash_refund' | 'bank_refund' | 'store_credit' | 'receivable_credit';
  refundAccountId?: string | null;
  paymentId?: string | null;
  journalEntryId?: string | null;
  reason: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesReturnLineRecord {
  id: string;
  salesReturnId: string;
  originalLineId: string;
  productId?: string | null;
  description: string;
  returnedQuantity: number;
  packageUnit: string;
  canonicalQuantity: number;
  unitPriceScaled: bigint;
  unitCostScaled: bigint;
  taxRatePercent: number;
  taxScaled: bigint;
  totalScaled: bigint;
  itemCondition: 'resellable' | 'damaged' | 'scrap';
  stockMovementId?: string | null;
  notes?: string | null;
}

export interface SalesReturnWithLines extends SalesReturnRecord {
  lines: SalesReturnLineRecord[];
}

export interface SalesDocumentFilter {
  partyId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  isPos?: boolean;
  page?: number;
  pageSize?: number;
}

export class SalesRepository {
  constructor(private conn: DatabaseConnection) {}

  /**
   * Fast lookup of an existing sales invoice by workspace and client idempotency key.
   * Guarantees that duplicate requests / double-taps return the already committed record.
   */
  public async findDocumentByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<DocumentWithLines | null> {
    if (!idempotencyKey || !idempotencyKey.trim()) return null;

    const docRows = await this.conn.query<any>(
      `SELECT id, workspace_id, document_type, document_number, party_id, party_name,
              issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
              tax_scaled, total_scaled, paid_amount_scaled, status, notes,
              attachment_relative_path, is_archived, created_at, updated_at,
              idempotency_key, payment_method, is_pos, cashier_name
       FROM documents 
       WHERE workspace_id = ? AND idempotency_key = ? 
       LIMIT 1`,
      [workspaceId, idempotencyKey.trim()]
    );

    if (docRows.length === 0) return null;
    return await this.populateDocumentLines(docRows[0]);
  }

  /**
   * Generates a unique, sequential invoice number under the business profile's numbering policy.
   * Atomically increments next_invoice_sequence to prevent collision and avoid raw timestamps alone.
   */
  public async getNextInvoiceNumber(workspaceId: string): Promise<string> {
    const profileRows = await this.conn.query<any>(
      `SELECT invoice_prefix, next_invoice_sequence 
       FROM business_profiles 
       WHERE workspace_id = ? 
       LIMIT 1`,
      [workspaceId]
    );

    let prefix = 'INV';
    let nextSeq = 1;

    if (profileRows.length > 0) {
      prefix = profileRows[0].invoice_prefix?.trim() || 'INV';
      nextSeq = Number(profileRows[0].next_invoice_sequence || 1);
    }

    // Atomically increment sequence for next caller
    await this.conn.run(
      `UPDATE business_profiles 
       SET next_invoice_sequence = next_invoice_sequence + 1, updated_at = ? 
       WHERE workspace_id = ?`,
      [new Date().toISOString(), workspaceId]
    );

    // Format invoice number e.g., INV-00001
    const padded = nextSeq.toString().padStart(5, '0');
    return `${prefix}-${padded}`;
  }

  /**
   * Populates document line items for a document record row.
   */
  private async populateDocumentLines(docRow: any): Promise<DocumentWithLines> {
    const lineRows = await this.conn.query<any>(
      `SELECT id, document_id, item_id, description, quantity, unit_price_scaled,
              discount_scaled, tax_rate_percent, tax_scaled, total_scaled,
              package_unit, cost_price_scaled, returned_quantity
       FROM document_lines 
       WHERE document_id = ?`,
      [docRow.id]
    );

    const lines: DocumentLineItem[] = lineRows.map(l => ({
      id: l.id,
      itemId: l.item_id || undefined,
      description: l.description,
      quantity: Number(l.quantity),
      unitPriceScaled: BigInt(l.unit_price_scaled || 0),
      discountScaled: BigInt(l.discount_scaled || 0),
      taxRatePercent: Number(l.tax_rate_percent || 0),
      taxScaled: BigInt(l.tax_scaled || 0),
      totalScaled: BigInt(l.total_scaled || 0),
      packageUnit: l.package_unit || 'pcs',
      costPriceScaled: BigInt(l.cost_price_scaled || 0),
      returnedQuantity: Number(l.returned_quantity || 0)
    }));

    const doc: DocumentRecord = {
      id: docRow.id,
      workspaceId: docRow.workspace_id,
      documentType: docRow.document_type,
      documentNumber: docRow.document_number,
      partyId: docRow.party_id,
      partyName: docRow.party_name,
      issueDate: docRow.issue_date,
      dueDate: docRow.due_date,
      currencyCode: docRow.currency_code,
      subtotalScaled: BigInt(docRow.subtotal_scaled || 0),
      discountScaled: BigInt(docRow.discount_scaled || 0),
      taxScaled: BigInt(docRow.tax_scaled || 0),
      totalScaled: BigInt(docRow.total_scaled || 0),
      paidAmountScaled: BigInt(docRow.paid_amount_scaled || 0),
      status: docRow.status,
      notes: docRow.notes,
      attachmentRelativePath: docRow.attachment_relative_path,
      isArchived: Boolean(docRow.is_archived),
      createdAt: docRow.created_at,
      updatedAt: docRow.updated_at
    };

    return { ...doc, lines };
  }

  /**
   * Queries sales invoices with filtering, indexing, and pagination.
   */
  public async findSalesDocuments(
    workspaceId: string,
    filter: SalesDocumentFilter
  ): Promise<{ documents: DocumentWithLines[]; total: number }> {
    const conditions: string[] = ['workspace_id = ?', "document_type = 'sales_invoice'", 'is_archived = 0'];
    const params: any[] = [workspaceId];

    if (filter.partyId) {
      conditions.push('party_id = ?');
      params.push(filter.partyId);
    }

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (filter.startDate) {
      conditions.push('issue_date >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push('issue_date <= ?');
      params.push(filter.endDate);
    }

    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = `%${filter.searchQuery.trim()}%`;
      conditions.push('(document_number LIKE ? OR party_name LIKE ? OR notes LIKE ?)');
      params.push(q, q, q);
    }

    if (filter.isPos !== undefined) {
      conditions.push('is_pos = ?');
      params.push(filter.isPos ? 1 : 0);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await this.conn.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM documents WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 10);
    const offset = (page - 1) * pageSize;

    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, document_type, document_number, party_id, party_name,
              issue_date, due_date, currency_code, subtotal_scaled, discount_scaled,
              tax_scaled, total_scaled, paid_amount_scaled, status, notes,
              attachment_relative_path, is_archived, created_at, updated_at,
              idempotency_key, payment_method, is_pos, cashier_name
       FROM documents 
       WHERE ${whereClause} 
       ORDER BY issue_date DESC, document_number DESC 
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const documents: DocumentWithLines[] = [];
    for (const r of rows) {
      documents.push(await this.populateDocumentLines(r));
    }

    return { documents, total };
  }

  /**
   * Retrieves the cumulative quantity already returned for a sales invoice line.
   */
  public async getReturnedQuantityForLine(lineId: string): Promise<number> {
    const rows = await this.conn.query<{ total_returned: number | null }>(
      `SELECT SUM(returned_quantity) as total_returned 
       FROM sales_return_lines 
       WHERE original_line_id = ?`,
      [lineId]
    );
    return rows[0]?.total_returned ? Number(rows[0].total_returned) : 0;
  }

  /**
   * Creates a customer sales return record with itemized return lines.
   */
  public async createSalesReturn(
    salesReturn: Omit<SalesReturnRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    lines: Omit<SalesReturnLineRecord, 'id' | 'salesReturnId'>[]
  ): Promise<SalesReturnWithLines> {
    const returnId = salesReturn.id || generateEntityId('sret');
    const now = new Date().toISOString();

    const record: SalesReturnRecord = {
      ...salesReturn,
      id: returnId,
      createdAt: now,
      updatedAt: now
    };

    const createdLines: SalesReturnLineRecord[] = lines.map(l => ({
      ...l,
      id: generateEntityId('sretl'),
      salesReturnId: returnId
    }));

    await this.conn.run(
      `INSERT INTO sales_returns (
        id, workspace_id, return_number, original_document_id, party_id, party_name,
        return_date, subtotal_scaled, tax_scaled, total_scaled, refund_amount_scaled,
        settlement_type, refund_account_id, payment_id, journal_entry_id, reason, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.workspaceId,
        record.returnNumber,
        record.originalDocumentId,
        record.partyId || null,
        record.partyName,
        record.returnDate,
        Number(record.subtotalScaled),
        Number(record.taxScaled),
        Number(record.totalScaled),
        Number(record.refundAmountScaled),
        record.settlementType,
        record.refundAccountId || null,
        record.paymentId || null,
        record.journalEntryId || null,
        record.reason,
        record.notes || null,
        record.createdAt,
        record.updatedAt
      ]
    );

    for (const l of createdLines) {
      await this.conn.run(
        `INSERT INTO sales_return_lines (
          id, sales_return_id, original_line_id, product_id, description,
          returned_quantity, package_unit, canonical_quantity, unit_price_scaled,
          unit_cost_scaled, tax_rate_percent, tax_scaled, total_scaled,
          item_condition, stock_movement_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          l.id,
          l.salesReturnId,
          l.originalLineId,
          l.productId || null,
          l.description,
          l.returnedQuantity,
          l.packageUnit,
          l.canonicalQuantity,
          Number(l.unitPriceScaled),
          Number(l.unitCostScaled),
          l.taxRatePercent,
          Number(l.taxScaled),
          Number(l.totalScaled),
          l.itemCondition,
          l.stockMovementId || null,
          l.notes || null
        ]
      );

      // Update original line item's returned_quantity cache
      await this.conn.run(
        `UPDATE document_lines 
         SET returned_quantity = returned_quantity + ? 
         WHERE id = ?`,
        [l.returnedQuantity, l.originalLineId]
      );
    }

    return { ...record, lines: createdLines };
  }

  /**
   * Retrieves sales returns for a workspace.
   */
  public async findSalesReturns(
    workspaceId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ returns: SalesReturnWithLines[]; total: number }> {
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.max(1, options?.pageSize || 10);
    const offset = (page - 1) * pageSize;

    const countRows = await this.conn.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM sales_returns WHERE workspace_id = ?`,
      [workspaceId]
    );
    const total = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

    const returnRows = await this.conn.query<any>(
      `SELECT * FROM sales_returns WHERE workspace_id = ? ORDER BY return_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [workspaceId, pageSize, offset]
    );

    const returns: SalesReturnWithLines[] = [];
    for (const r of returnRows) {
      const lineRows = await this.conn.query<any>(
        `SELECT * FROM sales_return_lines WHERE sales_return_id = ?`,
        [r.id]
      );
      returns.push({
        id: r.id,
        workspaceId: r.workspace_id,
        returnNumber: r.return_number,
        originalDocumentId: r.original_document_id,
        partyId: r.party_id,
        partyName: r.party_name,
        returnDate: r.return_date,
        subtotalScaled: BigInt(r.subtotal_scaled || 0),
        taxScaled: BigInt(r.tax_scaled || 0),
        totalScaled: BigInt(r.total_scaled || 0),
        refundAmountScaled: BigInt(r.refund_amount_scaled || 0),
        settlementType: r.settlement_type,
        refundAccountId: r.refund_account_id,
        paymentId: r.payment_id,
        journalEntryId: r.journal_entry_id,
        reason: r.reason,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lines: lineRows.map(l => ({
          id: l.id,
          salesReturnId: l.sales_return_id,
          originalLineId: l.original_line_id,
          productId: l.product_id,
          description: l.description,
          returnedQuantity: Number(l.returned_quantity),
          packageUnit: l.package_unit || 'pcs',
          canonicalQuantity: Number(l.canonical_quantity),
          unitPriceScaled: BigInt(l.unit_price_scaled || 0),
          unitCostScaled: BigInt(l.unit_cost_scaled || 0),
          taxRatePercent: Number(l.tax_rate_percent || 0),
          taxScaled: BigInt(l.tax_scaled || 0),
          totalScaled: BigInt(l.total_scaled || 0),
          itemCondition: l.item_condition,
          stockMovementId: l.stock_movement_id,
          notes: l.notes
        }))
      });
    }

    return { returns, total };
  }
}
