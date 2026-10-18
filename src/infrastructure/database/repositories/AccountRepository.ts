/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountSubCategory =
  | 'cash'
  | 'bank'
  | 'receivables'
  | 'inventory'
  | 'other_assets'
  | 'supplier_payables'
  | 'taxes_payable'
  | 'owner_loans_payable'
  | 'other_liabilities'
  | 'capital'
  | 'retained_earnings'
  | 'owner_drawings'
  | 'other_equity'
  | 'sales'
  | 'other_income'
  | 'cogs'
  | 'operating_expenses'
  | 'other_expenses';

export type ReportMapping = 'balance_sheet' | 'income_statement';

export interface AccountRecord {
  id: string;
  workspaceId: string;
  accountCode: string;
  name: string;
  type: AccountType;
  subCategory: AccountSubCategory;
  reportMapping: ReportMapping;
  description?: string | null;
  parentAccountId?: string | null;
  currencyCode: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalanceResult {
  accountId: string;
  accountCode: string;
  name: string;
  type: AccountType;
  subCategory: AccountSubCategory;
  normalBalanceType: 'debit' | 'credit';
  totalDebitScaled: bigint;
  totalCreditScaled: bigint;
  netBalanceScaled: bigint;
}

export class AccountRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findById(id: string): Promise<AccountRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, account_code, name, type, sub_category, report_mapping, description, parent_account_id,
              currency_code, is_system, is_active, created_at, updated_at
       FROM accounts WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async findByWorkspace(workspaceId: string, includeArchived = false): Promise<AccountRecord[]> {
    let sql = `SELECT id, workspace_id, account_code, name, type, sub_category, report_mapping, description, parent_account_id,
                      currency_code, is_system, is_active, created_at, updated_at
               FROM accounts WHERE workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (!includeArchived) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY account_code ASC';

    const rows = await this.conn.query<any>(sql, params);
    return rows.map(r => this.mapRow(r));
  }

  public async findByCode(workspaceId: string, code: string): Promise<AccountRecord | null> {
    const rows = await this.conn.query<any>(
      `SELECT id, workspace_id, account_code, name, type, sub_category, report_mapping, description, parent_account_id,
              currency_code, is_system, is_active, created_at, updated_at
       FROM accounts WHERE workspace_id = ? AND account_code = ? LIMIT 1`,
      [workspaceId, code]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  public async create(record: Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt' | 'subCategory' | 'reportMapping'> & {
    id?: string;
    subCategory?: AccountSubCategory;
    reportMapping?: ReportMapping;
  }): Promise<AccountRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('acc');
    const subCategory = record.subCategory || this.inferDefaultSubCategory(record.type, record.accountCode);
    const reportMapping = record.reportMapping || (record.type === 'revenue' || record.type === 'expense' ? 'income_statement' : 'balance_sheet');

    const created: AccountRecord = {
      ...record,
      id,
      subCategory,
      reportMapping,
      description: record.description || null,
      parentAccountId: record.parentAccountId || null,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO accounts (
        id, workspace_id, account_code, name, type, sub_category, report_mapping, description, parent_account_id,
        currency_code, is_system, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.accountCode,
        created.name,
        created.type,
        created.subCategory,
        created.reportMapping,
        created.description || null,
        created.parentAccountId || null,
        created.currencyCode,
        created.isSystem ? 1 : 0,
        created.isActive ? 1 : 0,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }

  public async update(id: string, updates: Partial<Omit<AccountRecord, 'id' | 'workspaceId' | 'createdAt'>>): Promise<AccountRecord> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Account ${id} not found.`);
    }

    const updated: AccountRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.conn.run(
      `UPDATE accounts SET
        name = ?, type = ?, sub_category = ?, report_mapping = ?, description = ?,
        parent_account_id = ?, currency_code = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.type,
        updated.subCategory,
        updated.reportMapping,
        updated.description || null,
        updated.parentAccountId || null,
        updated.currencyCode,
        updated.isActive ? 1 : 0,
        updated.updatedAt,
        id
      ]
    );

    return updated;
  }

  /**
   * Derives authoritative account balance from all posted journal lines.
   */
  public async getAccountBalance(workspaceId: string, accountId: string): Promise<AccountBalanceResult | null> {
    const acc = await this.findById(accountId);
    if (!acc || acc.workspaceId !== workspaceId) return null;

    const rows = await this.conn.query<any>(
      `SELECT SUM(jl.debit_amount_scaled) as total_debit, SUM(jl.credit_amount_scaled) as total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       WHERE jl.account_id = ? AND je.workspace_id = ? AND (je.is_posted = 1 OR je.status = 'posted')`,
      [accountId, workspaceId]
    );

    const totalDebitScaled = BigInt(rows[0]?.total_debit || 0);
    const totalCreditScaled = BigInt(rows[0]?.total_credit || 0);

    const isDebitNormal = acc.type === 'asset' || acc.type === 'expense' || acc.subCategory === 'owner_drawings';
    const normalBalanceType: 'debit' | 'credit' = isDebitNormal ? 'debit' : 'credit';
    const netBalanceScaled = isDebitNormal
      ? totalDebitScaled - totalCreditScaled
      : totalCreditScaled - totalDebitScaled;

    return {
      accountId: acc.id,
      accountCode: acc.accountCode,
      name: acc.name,
      type: acc.type,
      subCategory: acc.subCategory,
      normalBalanceType,
      totalDebitScaled,
      totalCreditScaled,
      netBalanceScaled
    };
  }

  /**
   * Retrieves trial balance for all active accounts in the workspace.
   */
  public async getTrialBalance(workspaceId: string): Promise<{
    balances: AccountBalanceResult[];
    totalDebitsScaled: bigint;
    totalCreditsScaled: bigint;
    isBalanced: boolean;
  }> {
    const accounts = await this.findByWorkspace(workspaceId, false);
    const balances: AccountBalanceResult[] = [];
    let totalDebitsScaled = 0n;
    let totalCreditsScaled = 0n;

    for (const acc of accounts) {
      const bal = await this.getAccountBalance(workspaceId, acc.id);
      if (bal) {
        balances.push(bal);
        totalDebitsScaled += bal.totalDebitScaled;
        totalCreditsScaled += bal.totalCreditScaled;
      }
    }

    return {
      balances,
      totalDebitsScaled,
      totalCreditsScaled,
      isBalanced: totalDebitsScaled === totalCreditsScaled
    };
  }

  private inferDefaultSubCategory(type: AccountType, code: string): AccountSubCategory {
    switch (type) {
      case 'asset':
        if (code.startsWith('101')) return 'cash';
        if (code.startsWith('102')) return 'bank';
        if (code.startsWith('120')) return 'receivables';
        if (code.startsWith('130')) return 'inventory';
        return 'other_assets';
      case 'liability':
        if (code.startsWith('201')) return 'supplier_payables';
        if (code.startsWith('202')) return 'taxes_payable';
        if (code.startsWith('203')) return 'owner_loans_payable';
        return 'other_liabilities';
      case 'equity':
        if (code.startsWith('301')) return 'owner_drawings';
        if (code.startsWith('302')) return 'retained_earnings';
        return 'capital';
      case 'revenue':
        if (code.startsWith('401') || code.startsWith('400')) return 'sales';
        return 'other_income';
      case 'expense':
        if (code.startsWith('501') || code.startsWith('500')) return 'cogs';
        if (code.startsWith('502') || code.startsWith('600')) return 'operating_expenses';
        return 'other_expenses';
    }
  }

  private mapRow(r: any): AccountRecord {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      accountCode: r.account_code,
      name: r.name,
      type: r.type,
      subCategory: r.sub_category || this.inferDefaultSubCategory(r.type, r.account_code),
      reportMapping: r.report_mapping || (r.type === 'revenue' || r.type === 'expense' ? 'income_statement' : 'balance_sheet'),
      description: r.description,
      parentAccountId: r.parent_account_id,
      currencyCode: r.currency_code,
      isSystem: Boolean(r.is_system),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
