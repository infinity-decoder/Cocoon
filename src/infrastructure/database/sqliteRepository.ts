/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from './types';
import { 
  AppState, 
  Transaction, 
  Category, 
  Wallet, 
  Budget, 
  SavingsGoal, 
  BillReminder, 
  AppSettings 
} from '../../core/types';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, DEFAULT_WALLETS } from '../../core/constants';

/**
 * Loads the complete AppState from the SQLite database using indexed queries.
 */
export async function loadAppStateFromDatabase(conn: DatabaseConnection): Promise<AppState> {
  // 1. Wallets
  const walletRows = await conn.query<{
    id: string;
    name: string;
    type: 'cash' | 'bank' | 'card' | 'savings';
    balance: number;
    color: string;
  }>('SELECT id, name, type, balance, color FROM wallets');

  const wallets: Wallet[] = walletRows.length > 0 
    ? walletRows.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type,
        balance: Number(w.balance),
        color: w.color
      }))
    : DEFAULT_WALLETS;

  // 2. Categories & Subcategories
  const categoryRows = await conn.query<{
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
    parent_id: string | null;
    is_custom: number;
    is_enabled: number;
  }>('SELECT id, name, type, icon, color, parent_id, is_custom, is_enabled FROM categories');

  const allCategories: Category[] = categoryRows.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    parentId: c.parent_id ?? null,
    isCustom: Boolean(c.is_custom),
    isEnabled: Boolean(c.is_enabled)
  }));

  const categories = allCategories.filter(c => !c.parentId);
  const subCategories = allCategories.filter(c => !!c.parentId);

  // 3. Transactions
  const txRows = await conn.query<{
    id: string;
    type: any;
    amount: number;
    currency: string;
    date: string;
    note: string | null;
    category: string;
    sub_category: string | null;
    wallet_id: string;
    to_wallet_id: string | null;
    payment_method: string;
    attachment: string | null;
    is_recurring: number;
    recurrence: any;
    savings_goal_id: string | null;
  }>('SELECT id, type, amount, currency, date, note, category, sub_category, wallet_id, to_wallet_id, payment_method, attachment, is_recurring, recurrence, savings_goal_id FROM transactions ORDER BY date DESC');

  const transactions: Transaction[] = txRows.map(t => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    date: t.date,
    note: t.note ?? '',
    category: t.category,
    subCategory: t.sub_category ?? undefined,
    walletId: t.wallet_id,
    toWalletId: t.to_wallet_id ?? undefined,
    paymentMethod: t.payment_method,
    attachment: t.attachment ?? undefined,
    isRecurring: Boolean(t.is_recurring),
    recurrence: t.recurrence ?? undefined,
    savingsGoalId: t.savings_goal_id ?? undefined
  }));

  // 4. Budgets
  const budgetRows = await conn.query<{
    id: string;
    category_id: string;
    amount: number;
    month: string;
    rollover: number;
  }>('SELECT id, category_id, amount, month, rollover FROM budgets');

  const budgets: Budget[] = budgetRows.map(b => ({
    id: b.id,
    categoryId: b.category_id,
    amount: Number(b.amount),
    month: b.month,
    rollover: Boolean(b.rollover)
  }));

  // 5. Savings Goals
  const savingsRows = await conn.query<{
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    color: string;
    deadline: string | null;
  }>('SELECT id, name, target_amount, current_amount, color, deadline FROM savings_goals');

  const savingsGoals: SavingsGoal[] = savingsRows.map(s => ({
    id: s.id,
    name: s.name,
    targetAmount: Number(s.target_amount),
    currentAmount: Number(s.current_amount),
    color: s.color,
    deadline: s.deadline ?? undefined
  }));

  // 6. Bill Reminders
  const reminderRows = await conn.query<{
    id: string;
    title: string;
    amount: number;
    due_date: string;
    category_id: string;
    is_paid: number;
    recurrence: any;
  }>('SELECT id, title, amount, due_date, category_id, is_paid, recurrence FROM bill_reminders');

  const reminders: BillReminder[] = reminderRows.map(r => ({
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    dueDate: r.due_date,
    categoryId: r.category_id,
    isPaid: Boolean(r.is_paid),
    recurrence: r.recurrence
  }));

  // 7. App Settings
  const settingsRows = await conn.query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const settingsMap: Record<string, any> = {};
  for (const row of settingsRows) {
    try {
      settingsMap[row.key] = JSON.parse(row.value);
    } catch {
      settingsMap[row.key] = row.value;
    }
  }

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settingsMap
  };

  return {
    transactions,
    categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
    subCategories,
    wallets,
    budgets,
    savingsGoals,
    reminders,
    settings
  };
}

/**
 * Saves or syncs the complete AppState to SQLite in a single transaction using prepared statements.
 */
export async function saveAppStateToDatabase(conn: DatabaseConnection, state: AppState): Promise<void> {
  await conn.executeTransaction(async () => {
    // 1. Wallets
    for (const w of state.wallets) {
      await conn.run(
        'INSERT OR REPLACE INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)',
        [w.id, w.name, w.type, w.balance, w.color]
      );
    }

    // 2. Categories
    for (const c of state.categories) {
      await conn.run(
        'INSERT OR REPLACE INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.name, c.type, c.icon, c.color, c.parentId ?? null, c.isCustom ? 1 : 0, c.isEnabled ? 1 : 0]
      );
    }

    // Subcategories
    for (const sc of state.subCategories || []) {
      await conn.run(
        'INSERT OR REPLACE INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [sc.id, sc.name, sc.type, sc.icon, sc.color, sc.parentId ?? null, sc.isCustom ? 1 : 0, sc.isEnabled ? 1 : 0]
      );
    }

    // 3. Transactions
    for (const t of state.transactions) {
      await conn.run(
        'INSERT OR REPLACE INTO transactions (id, type, amount, currency, date, note, category, sub_category, wallet_id, to_wallet_id, payment_method, attachment, is_recurring, recurrence, savings_goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          t.id,
          t.type,
          t.amount,
          t.currency,
          t.date,
          t.note || null,
          t.category,
          t.subCategory || null,
          t.walletId,
          t.toWalletId || null,
          t.paymentMethod,
          t.attachment || null,
          t.isRecurring ? 1 : 0,
          t.recurrence || null,
          t.savingsGoalId || null
        ]
      );
    }

    // 4. Budgets
    for (const b of state.budgets) {
      await conn.run(
        'INSERT OR REPLACE INTO budgets (id, category_id, amount, month, rollover) VALUES (?, ?, ?, ?, ?)',
        [b.id, b.categoryId, b.amount, b.month, b.rollover ? 1 : 0]
      );
    }

    // 5. Savings Goals
    for (const s of state.savingsGoals) {
      await conn.run(
        'INSERT OR REPLACE INTO savings_goals (id, name, target_amount, current_amount, color, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [s.id, s.name, s.targetAmount, s.currentAmount, s.color, s.deadline || null]
      );
    }

    // 6. Reminders
    for (const r of state.reminders) {
      await conn.run(
        'INSERT OR REPLACE INTO bill_reminders (id, title, amount, due_date, category_id, is_paid, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.title, r.amount, r.dueDate, r.categoryId, r.isPaid ? 1 : 0, r.recurrence]
      );
    }

    // 7. Settings
    if (state.settings) {
      for (const [k, v] of Object.entries(state.settings)) {
        // SECURITY POLICY: Never persist raw/plaintext PIN in app_settings database table
        if (k === 'pinCode') continue;
        await conn.run(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          [k, JSON.stringify(v)]
        );
      }
    }
  });
}

/**
 * Inserts a single transaction into SQLite with parameter binding.
 */
export async function insertTransaction(conn: DatabaseConnection, tx: Transaction): Promise<void> {
  await conn.run(
    'INSERT OR REPLACE INTO transactions (id, type, amount, currency, date, note, category, sub_category, wallet_id, to_wallet_id, payment_method, attachment, is_recurring, recurrence, savings_goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      tx.id,
      tx.type,
      tx.amount,
      tx.currency,
      tx.date,
      tx.note || null,
      tx.category,
      tx.subCategory || null,
      tx.walletId,
      tx.toWalletId || null,
      tx.paymentMethod,
      tx.attachment || null,
      tx.isRecurring ? 1 : 0,
      tx.recurrence || null,
      tx.savingsGoalId || null
    ]
  );
}

/**
 * Deletes a transaction from SQLite by ID.
 */
export async function deleteTransaction(conn: DatabaseConnection, id: string): Promise<void> {
  await conn.run('DELETE FROM transactions WHERE id = ?', [id]);
}

/**
 * Retrieves entity record counts from the database for verification.
 */
export async function getDatabaseRecordCounts(conn: DatabaseConnection): Promise<{
  transactions: number;
  wallets: number;
  categories: number;
  budgets: number;
  savingsGoals: number;
  reminders: number;
}> {
  const [txRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM transactions');
  const [walletsRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM wallets');
  const [catRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM categories');
  const [budgetsRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM budgets');
  const [savingsRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM savings_goals');
  const [remindersRes] = await conn.query<{ count: number }>('SELECT count(*) as count FROM bill_reminders');

  return {
    transactions: Number(txRes?.count ?? 0),
    wallets: Number(walletsRes?.count ?? 0),
    categories: Number(catRes?.count ?? 0),
    budgets: Number(budgetsRes?.count ?? 0),
    savingsGoals: Number(savingsRes?.count ?? 0),
    reminders: Number(remindersRes?.count ?? 0)
  };
}
