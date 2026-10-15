/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { Money } from '../../../domain/money/Money';

export interface PartyRecord {
  id: string;
  workspaceId: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  creditLimitScaled: bigint;
  paymentTermId?: string | null;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PartyRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<PartyRecord | null> {
    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      name: string;
      type: 'customer' | 'supplier' | 'both';
      phone: string | null;
      email: string | null;
      address: string | null;
      tax_number: string | null;
      credit_limit_scaled: number | string;
      payment_term_id: string | null;
      currency_code: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, name, type, phone, email, address, tax_number,
              credit_limit_scaled, payment_term_id, currency_code, is_active, created_at, updated_at
       FROM parties WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(
    workspaceId: string,
    filterType?: 'customer' | 'supplier' | 'both'
  ): Promise<PartyRecord[]> {
    let sql = `SELECT id, workspace_id, name, type, phone, email, address, tax_number,
                      credit_limit_scaled, payment_term_id, currency_code, is_active, created_at, updated_at
               FROM parties WHERE workspace_id = ? AND is_active = 1`;
    const params: any[] = [workspaceId];

    if (filterType) {
      sql += ' AND (type = ? OR type = \'both\')';
      params.push(filterType);
    }
    sql += ' ORDER BY name ASC LIMIT 100';

    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      name: string;
      type: 'customer' | 'supplier' | 'both';
      phone: string | null;
      email: string | null;
      address: string | null;
      tax_number: string | null;
      credit_limit_scaled: number | string;
      payment_term_id: string | null;
      currency_code: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(sql, params);

    return rows.map(r => this.mapRow(r));
  }

  public async create(record: Omit<PartyRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<PartyRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('party');
    const created: PartyRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO parties (id, workspace_id, name, type, phone, email, address, tax_number,
                            credit_limit_scaled, payment_term_id, currency_code, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.name,
        created.type,
        created.phone || null,
        created.email || null,
        created.address || null,
        created.taxNumber || null,
        Number(created.creditLimitScaled),
        created.paymentTermId || null,
        created.currencyCode,
        created.isActive ? 1 : 0,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }

  private mapRow(r: {
    id: string;
    workspace_id: string;
    name: string;
    type: 'customer' | 'supplier' | 'both';
    phone: string | null;
    email: string | null;
    address: string | null;
    tax_number: string | null;
    credit_limit_scaled: number | string;
    payment_term_id: string | null;
    currency_code: string;
    is_active: number;
    created_at: string;
    updated_at: string;
  }): PartyRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type,
      phone: r.phone,
      email: r.email,
      address: r.address,
      taxNumber: r.tax_number,
      creditLimitScaled: BigInt(r.credit_limit_scaled || 0),
      paymentTermId: r.payment_term_id,
      currencyCode: r.currency_code,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
