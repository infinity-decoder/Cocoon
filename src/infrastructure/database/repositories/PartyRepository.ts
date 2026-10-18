/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export interface PartyRecord {
  id: string;
  workspaceId: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  companyName?: string | null;
  contactPersonName?: string | null;
  contactPersonPhone?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  creditLimitScaled: bigint;
  paymentTermId?: string | null;
  currencyCode: string;
  openingBalanceScaled: bigint;
  openingBalanceType: 'receivable' | 'payable' | 'zero';
  openingBalanceDate?: string | null;
  attachmentPath?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PartyRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<PartyRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, name, type, company_name, contact_person_name, contact_person_phone,
              phone, email, address, tax_number, notes, credit_limit_scaled, payment_term_id,
              currency_code, opening_balance_scaled, opening_balance_type, opening_balance_date,
              attachment_path, is_active, created_at, updated_at
       FROM parties WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByName(workspaceId: string, name: string): Promise<PartyRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, name, type, company_name, contact_person_name, contact_person_phone,
              phone, email, address, tax_number, notes, credit_limit_scaled, payment_term_id,
              currency_code, opening_balance_scaled, opening_balance_type, opening_balance_date,
              attachment_path, is_active, created_at, updated_at
       FROM parties WHERE workspace_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
      [workspaceId, name]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(
    workspaceId: string,
    filterType?: 'customer' | 'supplier' | 'both',
    includeArchived = false
  ): Promise<PartyRecord[]> {
    let sql = `SELECT id, workspace_id, name, type, company_name, contact_person_name, contact_person_phone,
                      phone, email, address, tax_number, notes, credit_limit_scaled, payment_term_id,
                      currency_code, opening_balance_scaled, opening_balance_type, opening_balance_date,
                      attachment_path, is_active, created_at, updated_at
               FROM parties WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (!includeArchived) {
      sql += ' AND is_active = 1';
    }

    if (filterType) {
      sql += ' AND (type = ? OR type = \'both\')';
      params.push(filterType);
    }
    sql += ' ORDER BY name ASC LIMIT 200';

    const rows = await this.conn.query<any>(sql, params);
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Duplicate detection to warn users when a party with identical phone or similar name exists
   */
  public async findDuplicates(
    workspaceId: string,
    name: string,
    phone?: string | null
  ): Promise<PartyRecord[]> {
    const sanitizedPhone = phone?.trim();
    const sanitizedName = name.trim().toLowerCase();

    const allParties = await this.findByWorkspace(workspaceId, undefined, true);
    return allParties.filter(p => {
      const nameMatch = p.name.trim().toLowerCase() === sanitizedName;
      const phoneMatch = sanitizedPhone && p.phone && p.phone.trim() === sanitizedPhone;
      return nameMatch || phoneMatch;
    });
  }

  public async create(record: Omit<PartyRecord, 'id' | 'createdAt' | 'updatedAt' | 'openingBalanceScaled' | 'openingBalanceType'> & {
    id?: string;
    openingBalanceScaled?: bigint;
    openingBalanceType?: 'receivable' | 'payable' | 'zero';
  }): Promise<PartyRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('party');
    const created: PartyRecord = {
      ...record,
      id,
      companyName: record.companyName || null,
      contactPersonName: record.contactPersonName || null,
      contactPersonPhone: record.contactPersonPhone || null,
      notes: record.notes || null,
      openingBalanceScaled: record.openingBalanceScaled ?? 0n,
      openingBalanceType: record.openingBalanceType ?? 'zero',
      openingBalanceDate: record.openingBalanceDate || null,
      attachmentPath: record.attachmentPath || null,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO parties (
        id, workspace_id, name, type, company_name, contact_person_name, contact_person_phone,
        phone, email, address, tax_number, notes, credit_limit_scaled, payment_term_id,
        currency_code, opening_balance_scaled, opening_balance_type, opening_balance_date,
        attachment_path, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.name,
        created.type,
        created.companyName || null,
        created.contactPersonName || null,
        created.contactPersonPhone || null,
        created.phone || null,
        created.email || null,
        created.address || null,
        created.taxNumber || null,
        created.notes || null,
        Number(created.creditLimitScaled),
        created.paymentTermId || null,
        created.currencyCode,
        Number(created.openingBalanceScaled),
        created.openingBalanceType,
        created.openingBalanceDate || null,
        created.attachmentPath || null,
        created.isActive ? 1 : 0,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }

  public async update(id: string, updates: Partial<PartyRecord>): Promise<PartyRecord> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Party with id ${id} not found.`);
    }

    const updated: PartyRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.conn.run(
      `UPDATE parties SET
        name = ?, type = ?, company_name = ?, contact_person_name = ?, contact_person_phone = ?,
        phone = ?, email = ?, address = ?, tax_number = ?, notes = ?, credit_limit_scaled = ?,
        payment_term_id = ?, currency_code = ?, opening_balance_scaled = ?, opening_balance_type = ?,
        opening_balance_date = ?, attachment_path = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.type,
        updated.companyName || null,
        updated.contactPersonName || null,
        updated.contactPersonPhone || null,
        updated.phone || null,
        updated.email || null,
        updated.address || null,
        updated.taxNumber || null,
        updated.notes || null,
        Number(updated.creditLimitScaled),
        updated.paymentTermId || null,
        updated.currencyCode,
        Number(updated.openingBalanceScaled),
        updated.openingBalanceType,
        updated.openingBalanceDate || null,
        updated.attachmentPath || null,
        updated.isActive ? 1 : 0,
        updated.updatedAt,
        id
      ]
    );

    return updated;
  }

  public async archive(id: string): Promise<void> {
    await this.update(id, { isActive: false });
  }

  public async unarchive(id: string): Promise<void> {
    await this.update(id, { isActive: true });
  }

  private mapRow(r: any): PartyRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type,
      companyName: r.company_name,
      contactPersonName: r.contact_person_name,
      contactPersonPhone: r.contact_person_phone,
      phone: r.phone,
      email: r.email,
      address: r.address,
      taxNumber: r.tax_number,
      notes: r.notes,
      creditLimitScaled: BigInt(r.credit_limit_scaled || 0),
      paymentTermId: r.payment_term_id,
      currencyCode: r.currency_code,
      openingBalanceScaled: BigInt(r.opening_balance_scaled || 0),
      openingBalanceType: r.opening_balance_type || 'zero',
      openingBalanceDate: r.opening_balance_date,
      attachmentPath: r.attachment_path,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
