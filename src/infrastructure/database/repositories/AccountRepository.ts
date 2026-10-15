/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export interface AccountRecord {
  id: string;
  workspaceId: string;
  accountCode: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  currencyCode: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AccountRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<AccountRecord | null> {
    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      account_code: string;
      name: string;
      type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      currency_code: string;
      is_system: number;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at FROM accounts WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(workspaceId: string): Promise<AccountRecord[]> {
    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      account_code: string;
      name: string;
      type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      currency_code: string;
      is_system: number;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at FROM accounts WHERE workspace_id = ? AND is_active = 1 ORDER BY account_code ASC',
      [workspaceId]
    );

    return rows.map(r => this.mapRow(r));
  }

  public async findByCode(workspaceId: string, code: string): Promise<AccountRecord | null> {
    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      account_code: string;
      name: string;
      type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      currency_code: string;
      is_system: number;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at FROM accounts WHERE workspace_id = ? AND account_code = ? LIMIT 1',
      [workspaceId, code]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async create(record: Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<AccountRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('acc');
    const created: AccountRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO accounts (id, workspace_id, account_code, name, type, currency_code, is_system, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.accountCode,
        created.name,
        created.type,
        created.currencyCode,
        created.isSystem ? 1 : 0,
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
    account_code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    currency_code: string;
    is_system: number;
    is_active: number;
    created_at: string;
    updated_at: string;
  }): AccountRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      accountCode: r.account_code,
      name: r.name,
      type: r.type,
      currencyCode: r.currency_code,
      isSystem: Boolean(r.is_system),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
