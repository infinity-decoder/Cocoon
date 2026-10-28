/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { Transaction } from '../../core/types';

export interface TransactionQueryParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  type?: 'all' | 'income' | 'expense' | 'transfer' | 'savings_deposit' | 'savings_withdraw';
  category?: string;
  walletId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  month?: string; // YYYY-MM prefix
}

export interface PaginatedTransactionsResult {
  items: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class TransactionQueryService {
  /**
   * Executes a paginated, SQL-filtered transaction query with deterministic secondary sorting.
   * Eliminates full-table JavaScript scans on the client.
   */
  public static async queryTransactions(
    conn: DatabaseConnection,
    params: TransactionQueryParams = {}
  ): Promise<PaginatedTransactionsResult> {
    const page = Math.max(0, params.page ?? 0);
    const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20));
    const offset = page * pageSize;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    // Search term across note, category, or amount
    if (params.searchTerm && params.searchTerm.trim() !== '') {
      const term = `%${params.searchTerm.trim().toLowerCase()}%`;
      conditions.push('(LOWER(COALESCE(note, \'\')) LIKE ? OR LOWER(category) LIKE ? OR CAST(amount AS TEXT) LIKE ?)');
      values.push(term, term, term);
    }

    // Type filter
    if (params.type && params.type !== 'all') {
      if (params.type === 'expense') {
        conditions.push('(type = ? OR type = ?)');
        values.push('expense', 'savings_deposit');
      } else if (params.type === 'income') {
        conditions.push('(type = ? OR type = ?)');
        values.push('income', 'savings_withdraw');
      } else {
        conditions.push('type = ?');
        values.push(params.type);
      }
    }

    // Category filter
    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      values.push(params.category);
    }

    // Wallet filter
    if (params.walletId && params.walletId !== 'all') {
      conditions.push('(wallet_id = ? OR to_wallet_id = ?)');
      values.push(params.walletId, params.walletId);
    }

    // Payment method filter
    if (params.paymentMethod && params.paymentMethod !== 'all') {
      conditions.push('payment_method = ?');
      values.push(params.paymentMethod);
    }

    // Date filters
    if (params.month) {
      conditions.push('date LIKE ?');
      values.push(`${params.month}%`);
    }

    if (params.startDate) {
      conditions.push('date >= ?');
      values.push(params.startDate);
    }

    if (params.endDate) {
      // Inclusive end date
      const endInclusive = params.endDate.includes('T') ? params.endDate : `${params.endDate}T23:59:59.999Z`;
      conditions.push('date <= ?');
      values.push(endInclusive);
    }

    // Amount range
    if (params.minAmount !== undefined && params.minAmount !== null && !isNaN(params.minAmount)) {
      conditions.push('amount >= ?');
      values.push(params.minAmount);
    }

    if (params.maxAmount !== undefined && params.maxAmount !== null && !isNaN(params.maxAmount)) {
      conditions.push('amount <= ?');
      values.push(params.maxAmount);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total matching count query
    const countSql = `SELECT count(*) as total FROM transactions WHERE ${whereClause}`;
    const countRows = await conn.query<{ total: number; count?: number }>(countSql, [...values]);
    const totalCount = Number(countRows[0]?.total ?? countRows[0]?.count ?? 0);

    // 2. Paginated rows query with stable secondary tie-breaker
    const rowsSql = `
      SELECT 
        id, type, amount, currency, date, note, category, sub_category, 
        wallet_id, to_wallet_id, payment_method, attachment, 
        is_recurring, recurrence, savings_goal_id
      FROM transactions
      WHERE ${whereClause}
      ORDER BY date DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const queryValues = [...values, pageSize, offset];
    const rows = await conn.query<any>(rowsSql, queryValues);

    const items: Transaction[] = rows.map(r => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      currency: r.currency || 'PKR',
      date: r.date,
      note: r.note ?? '',
      category: r.category,
      subCategory: r.sub_category ?? undefined,
      walletId: r.wallet_id,
      toWalletId: r.to_wallet_id ?? undefined,
      paymentMethod: r.payment_method,
      attachment: r.attachment ?? undefined,
      isRecurring: Boolean(r.is_recurring),
      recurrence: r.recurrence ?? undefined,
      savingsGoalId: r.savings_goal_id ?? undefined
    }));

    return {
      items,
      totalCount,
      page,
      pageSize,
      hasMore: offset + items.length < totalCount
    };
  }

  /**
   * Retrieves single transaction by ID.
   */
  public static async getTransactionById(
    conn: DatabaseConnection,
    id: string
  ): Promise<Transaction | null> {
    const rows = await conn.query<any>(
      `SELECT id, type, amount, currency, date, note, category, sub_category, 
              wallet_id, to_wallet_id, payment_method, attachment, 
              is_recurring, recurrence, savings_goal_id 
       FROM transactions WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      currency: r.currency || 'PKR',
      date: r.date,
      note: r.note ?? '',
      category: r.category,
      subCategory: r.sub_category ?? undefined,
      walletId: r.wallet_id,
      toWalletId: r.to_wallet_id ?? undefined,
      paymentMethod: r.payment_method,
      attachment: r.attachment ?? undefined,
      isRecurring: Boolean(r.is_recurring),
      recurrence: r.recurrence ?? undefined,
      savingsGoalId: r.savings_goal_id ?? undefined
    };
  }

  /**
   * Loads transactions for statement export (CSV / PDF) bounded by scope.
   */
  public static async getTransactionsForExport(
    conn: DatabaseConnection,
    options: {
      scope: 'monthly' | 'yearly' | 'all';
      month?: string; // YYYY-MM
      filterType?: 'combined' | 'expense' | 'income';
    }
  ): Promise<Transaction[]> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (options.scope === 'monthly' && options.month) {
      conditions.push('date LIKE ?');
      values.push(`${options.month}%`);
    } else if (options.scope === 'yearly' && options.month) {
      const year = options.month.slice(0, 4);
      conditions.push('date LIKE ?');
      values.push(`${year}%`);
    }

    if (options.filterType === 'expense') {
      conditions.push('(type = ? OR type = ?)');
      values.push('expense', 'savings_deposit');
    } else if (options.filterType === 'income') {
      conditions.push('(type = ? OR type = ?)');
      values.push('income', 'savings_withdraw');
    }

    const sql = `
      SELECT id, type, amount, currency, date, note, category, sub_category, 
             wallet_id, to_wallet_id, payment_method, attachment, 
             is_recurring, recurrence, savings_goal_id 
      FROM transactions 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY date DESC, id DESC
    `;

    const rows = await conn.query<any>(sql, values);
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      currency: r.currency || 'PKR',
      date: r.date,
      note: r.note ?? '',
      category: r.category,
      subCategory: r.sub_category ?? undefined,
      walletId: r.wallet_id,
      toWalletId: r.to_wallet_id ?? undefined,
      paymentMethod: r.payment_method,
      attachment: r.attachment ?? undefined,
      isRecurring: Boolean(r.is_recurring),
      recurrence: r.recurrence ?? undefined,
      savingsGoalId: r.savings_goal_id ?? undefined
    }));
  }

  /**
   * Keyset pagination query utilizing composite index (date DESC, id DESC)
   * Prevents OFFSET performance degradation when paginating deep into 100,000+ transactions.
   */
  public static async queryTransactionsKeyset(
    conn: DatabaseConnection,
    params: TransactionQueryParams & {
      cursor?: { date: string; id: string };
      limit?: number;
    } = {}
  ): Promise<{
    items: Transaction[];
    nextCursor: { date: string; id: string } | null;
    hasMore: boolean;
  }> {
    const limit = Math.max(1, Math.min(100, params.limit ?? 25));
    const fetchLimit = limit + 1;
    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (params.cursor) {
      conditions.push('(date < ? OR (date = ? AND id < ?))');
      values.push(params.cursor.date, params.cursor.date, params.cursor.id);
    }

    if (params.walletId && params.walletId !== 'all') {
      conditions.push('(wallet_id = ? OR to_wallet_id = ?)');
      values.push(params.walletId, params.walletId);
    }

    if (params.type && params.type !== 'all') {
      if (params.type === 'expense') {
        conditions.push('(type = ? OR type = ?)');
        values.push('expense', 'savings_deposit');
      } else if (params.type === 'income') {
        conditions.push('(type = ? OR type = ?)');
        values.push('income', 'savings_withdraw');
      } else {
        conditions.push('type = ?');
        values.push(params.type);
      }
    }

    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      values.push(params.category);
    }

    const sql = `
      SELECT id, type, amount, currency, date, note, category, sub_category, 
             wallet_id, to_wallet_id, payment_method, attachment, 
             is_recurring, recurrence, savings_goal_id 
      FROM transactions 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY date DESC, id DESC
      LIMIT ?
    `;

    const rows = await conn.query<any>(sql, [...values, fetchLimit]);
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const items: Transaction[] = resultRows.map(r => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      currency: r.currency || 'PKR',
      date: r.date,
      note: r.note ?? '',
      category: r.category,
      subCategory: r.sub_category ?? undefined,
      walletId: r.wallet_id,
      toWalletId: r.to_wallet_id ?? undefined,
      paymentMethod: r.payment_method,
      attachment: r.attachment ?? undefined,
      isRecurring: Boolean(r.is_recurring),
      recurrence: r.recurrence ?? undefined,
      savingsGoalId: r.savings_goal_id ?? undefined
    }));

    const nextCursor = hasMore && items.length > 0
      ? { date: items[items.length - 1].date, id: items[items.length - 1].id }
      : null;

    return { items, nextCursor, hasMore };
  }
}
