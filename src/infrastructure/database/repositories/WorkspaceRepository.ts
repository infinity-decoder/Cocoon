/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export interface WorkspaceRecord {
  id: string;
  name: string;
  type: 'personal' | 'business' | 'enterprise';
  currencyCode: string;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class WorkspaceRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<WorkspaceRecord | null> {
    const rows = await this.conn.query<{
      id: string;
      name: string;
      type: 'personal' | 'business' | 'enterprise';
      currency_code: string;
      tax_id: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, name, type, currency_code, tax_id, address, phone, email, is_active, created_at, updated_at FROM workspaces WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      currencyCode: r.currency_code,
      taxId: r.tax_id,
      address: r.address,
      phone: r.phone,
      email: r.email,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async findAllActive(): Promise<WorkspaceRecord[]> {
    const rows = await this.conn.query<{
      id: string;
      name: string;
      type: 'personal' | 'business' | 'enterprise';
      currency_code: string;
      tax_id: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, name, type, currency_code, tax_id, address, phone, email, is_active, created_at, updated_at FROM workspaces WHERE is_active = 1 ORDER BY created_at ASC'
    );

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      currencyCode: r.currency_code,
      taxId: r.tax_id,
      address: r.address,
      phone: r.phone,
      email: r.email,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async create(record: Omit<WorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<WorkspaceRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('ws');
    const created: WorkspaceRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO workspaces (id, name, type, currency_code, tax_id, address, phone, email, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.name,
        created.type,
        created.currencyCode,
        created.taxId || null,
        created.address || null,
        created.phone || null,
        created.email || null,
        created.isActive ? 1 : 0,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }
}
