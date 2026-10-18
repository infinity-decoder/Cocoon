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

  public async findAll(includeArchived = false): Promise<WorkspaceRecord[]> {
    const sql = includeArchived
      ? 'SELECT id, name, type, currency_code, tax_id, address, phone, email, is_active, created_at, updated_at FROM workspaces ORDER BY created_at ASC'
      : 'SELECT id, name, type, currency_code, tax_id, address, phone, email, is_active, created_at, updated_at FROM workspaces WHERE is_active = 1 ORDER BY created_at ASC';

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
    }>(sql);

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

  public async update(id: string, updates: Partial<WorkspaceRecord>): Promise<WorkspaceRecord> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workspace with id ${id} not found.`);
    }

    const updated: WorkspaceRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.conn.run(
      `UPDATE workspaces SET 
        name = ?, currency_code = ?, tax_id = ?, address = ?, 
        phone = ?, email = ?, is_active = ?, updated_at = ? 
       WHERE id = ?`,
      [
        updated.name,
        updated.currencyCode,
        updated.taxId || null,
        updated.address || null,
        updated.phone || null,
        updated.email || null,
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

  public async hasFinancialHistory(id: string): Promise<boolean> {
    const [jeCounts, docCounts] = await Promise.all([
      this.conn.query<{ count: number }>('SELECT count(*) as count FROM journal_entries WHERE workspace_id = ?', [id]),
      this.conn.query<{ count: number }>('SELECT count(*) as count FROM documents WHERE workspace_id = ?', [id])
    ]);

    const jeTotal = jeCounts.length > 0 ? Number(jeCounts[0].count) : 0;
    const docTotal = docCounts.length > 0 ? Number(docCounts[0].count) : 0;
    return jeTotal > 0 || docTotal > 0;
  }

  public async delete(id: string): Promise<void> {
    const hasHistory = await this.hasFinancialHistory(id);
    if (hasHistory) {
      throw new Error(`Cannot delete workspace ${id}: it contains financial history. Archive it instead to preserve audit records.`);
    }
    await this.conn.run('DELETE FROM workspaces WHERE id = ?', [id]);
  }
}
