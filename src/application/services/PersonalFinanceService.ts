/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { 
  Transaction, 
  Category, 
  Budget, 
  SavingsGoal, 
  AppSettings,
  Wallet
} from '../../core/types';
import { EntityId } from '../../domain/primitives/EntityId';
import { 
  validatePositiveAmount, 
  validateRequiredString, 
  validateCanonicalDate,
  assertValid
} from '../validation/financialValidation';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, DEFAULT_WALLETS, DEFAULT_SUBCATEGORIES } from '../../core/constants';

export interface CreateTransactionCommand {
  id?: string;
  type: Transaction['type'];
  amount: number;
  currency?: string;
  date?: string;
  note?: string;
  category: string;
  subCategory?: string;
  walletId: string;
  toWalletId?: string;
  paymentMethod?: string;
  attachment?: string;
  isRecurring?: boolean;
  recurrence?: any;
  savingsGoalId?: string;
}

export interface UpdateTransactionCommand {
  id: string;
  type?: Transaction['type'];
  amount?: number;
  currency?: string;
  date?: string;
  note?: string;
  category?: string;
  subCategory?: string;
  walletId?: string;
  toWalletId?: string;
  paymentMethod?: string;
  attachment?: string;
}

export class PersonalFinanceService {
  /**
   * Adds a transaction with targeted database writes across `transactions` and `wallets`.
   * Enforces validation, stable IDs, and atomic execution.
   */
  public static async addTransaction(
    conn: DatabaseConnection,
    cmd: CreateTransactionCommand
  ): Promise<Transaction> {
    // 1. Validation
    assertValid(validatePositiveAmount(cmd.amount, 'Transaction Amount'));
    assertValid(validateRequiredString(cmd.category, 'Category'));
    assertValid(validateRequiredString(cmd.walletId, 'Source Wallet'));
    if (cmd.date) {
      assertValid(validateCanonicalDate(cmd.date, 'Transaction Date'));
    }

    const txId = cmd.id && EntityId.isValid(cmd.id) ? cmd.id : EntityId.generate('tx');
    const txDate = cmd.date || new Date().toISOString();
    const finalAmount = Number(cmd.amount);
    const currency = cmd.currency || 'PKR';

    const transaction: Transaction = {
      id: txId,
      type: cmd.type || 'expense',
      amount: finalAmount,
      currency,
      date: txDate,
      note: cmd.note || '',
      category: cmd.category,
      subCategory: cmd.subCategory,
      walletId: cmd.walletId,
      toWalletId: cmd.toWalletId,
      paymentMethod: cmd.paymentMethod || 'Cash',
      attachment: cmd.attachment,
      isRecurring: cmd.isRecurring || false,
      recurrence: cmd.recurrence,
      savingsGoalId: cmd.savingsGoalId
    };

    // 2. Targeted SQLite transaction
    await conn.executeTransaction(async () => {
      // Insert transaction record
      await conn.run(
        `INSERT OR REPLACE INTO transactions (
          id, type, amount, currency, date, note, category, sub_category, 
          wallet_id, to_wallet_id, payment_method, attachment, 
          is_recurring, recurrence, savings_goal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.id,
          transaction.type,
          transaction.amount,
          transaction.currency,
          transaction.date,
          transaction.note || null,
          transaction.category,
          transaction.subCategory || null,
          transaction.walletId,
          transaction.toWalletId || null,
          transaction.paymentMethod,
          transaction.attachment || null,
          transaction.isRecurring ? 1 : 0,
          transaction.recurrence || null,
          transaction.savingsGoalId || null
        ]
      );

      // Targeted wallet updates
      if (transaction.type === 'transfer' && transaction.toWalletId) {
        await conn.run(
          'UPDATE wallets SET balance = balance - ? WHERE id = ?',
          [finalAmount, transaction.walletId]
        );
        await conn.run(
          'UPDATE wallets SET balance = balance + ? WHERE id = ?',
          [finalAmount, transaction.toWalletId]
        );
      } else if (transaction.type === 'income' || transaction.type === 'savings_withdraw') {
        await conn.run(
          'UPDATE wallets SET balance = balance + ? WHERE id = ?',
          [finalAmount, transaction.walletId]
        );
      } else if (transaction.type === 'expense' || transaction.type === 'savings_deposit') {
        await conn.run(
          'UPDATE wallets SET balance = balance - ? WHERE id = ?',
          [finalAmount, transaction.walletId]
        );
      }
    });

    return transaction;
  }

  /**
   * Modifies an existing transaction and synchronizes affected wallet balances atomically.
   */
  public static async editTransaction(
    conn: DatabaseConnection,
    cmd: UpdateTransactionCommand
  ): Promise<Transaction> {
    assertValid(validateRequiredString(cmd.id, 'Transaction ID'));
    if (cmd.amount !== undefined) {
      assertValid(validatePositiveAmount(cmd.amount, 'Updated Amount'));
    }

    let updatedTx: Transaction | null = null;

    await conn.executeTransaction(async () => {
      // 1. Fetch current transaction
      const existingRows = await conn.query<any>(
        'SELECT * FROM transactions WHERE id = ?',
        [cmd.id]
      );
      if (existingRows.length === 0) {
        throw new Error(`Transaction with id "${cmd.id}" not found.`);
      }

      const old = existingRows[0];
      const oldAmount = Number(old.amount);
      const newAmount = cmd.amount !== undefined ? Number(cmd.amount) : oldAmount;
      const diff = newAmount - oldAmount;

      // 2. Adjust wallet if amount changed
      if (diff !== 0) {
        if (old.type === 'transfer' && old.to_wallet_id) {
          await conn.run('UPDATE wallets SET balance = balance - ? WHERE id = ?', [diff, old.wallet_id]);
          await conn.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [diff, old.to_wallet_id]);
        } else if (old.type === 'income' || old.type === 'savings_withdraw') {
          await conn.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [diff, old.wallet_id]);
        } else if (old.type === 'expense' || old.type === 'savings_deposit') {
          await conn.run('UPDATE wallets SET balance = balance - ? WHERE id = ?', [diff, old.wallet_id]);
        }
      }

      // 3. Update transaction row
      const note = cmd.note !== undefined ? cmd.note : old.note;
      const category = cmd.category !== undefined ? cmd.category : old.category;
      const subCategory = cmd.subCategory !== undefined ? cmd.subCategory : old.sub_category;
      const date = cmd.date !== undefined ? cmd.date : old.date;
      const paymentMethod = cmd.paymentMethod !== undefined ? cmd.paymentMethod : old.payment_method;

      await conn.run(
        `UPDATE transactions SET 
          amount = ?, note = ?, category = ?, sub_category = ?, date = ?, payment_method = ?
         WHERE id = ?`,
        [newAmount, note || null, category, subCategory || null, date, paymentMethod, cmd.id]
      );

      updatedTx = {
        id: old.id,
        type: old.type,
        amount: newAmount,
        currency: old.currency || 'PKR',
        date,
        note: note ?? '',
        category,
        subCategory: subCategory ?? undefined,
        walletId: old.wallet_id,
        toWalletId: old.to_wallet_id ?? undefined,
        paymentMethod,
        attachment: old.attachment ?? undefined,
        isRecurring: Boolean(old.is_recurring),
        recurrence: old.recurrence ?? undefined,
        savingsGoalId: old.savings_goal_id ?? undefined
      };
    });

    if (!updatedTx) {
      throw new Error('Failed to update transaction.');
    }
    return updatedTx;
  }

  /**
   * Deletes a transaction and reverses its wallet balance impact atomically.
   */
  public static async deleteTransaction(
    conn: DatabaseConnection,
    id: string
  ): Promise<void> {
    await conn.executeTransaction(async () => {
      const rows = await conn.query<any>('SELECT * FROM transactions WHERE id = ?', [id]);
      if (rows.length === 0) return;

      const tx = rows[0];
      const amt = Number(tx.amount);

      // Reversal
      if (tx.type === 'transfer' && tx.to_wallet_id) {
        await conn.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amt, tx.wallet_id]);
        await conn.run('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amt, tx.to_wallet_id]);
      } else if (tx.type === 'income' || tx.type === 'savings_withdraw') {
        await conn.run('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amt, tx.wallet_id]);
      } else if (tx.type === 'expense' || tx.type === 'savings_deposit') {
        await conn.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amt, tx.wallet_id]);
      }

      // Reversal for savings goals if linked
      if (tx.savings_goal_id) {
        if (tx.type === 'savings_deposit') {
          await conn.run('UPDATE savings_goals SET current_amount = current_amount - ? WHERE id = ?', [amt, tx.savings_goal_id]);
        } else if (tx.type === 'savings_withdraw') {
          await conn.run('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?', [amt, tx.savings_goal_id]);
        }
      }

      await conn.run('DELETE FROM transactions WHERE id = ?', [id]);
    });
  }

  /**
   * Transfers funds from a wallet into a Vault savings goal.
   */
  public static async transferToSavings(
    conn: DatabaseConnection,
    goalId: string,
    amount: number,
    fromWalletId: string,
    currencySymbol = 'Rs.'
  ): Promise<{ transaction: Transaction; goal: SavingsGoal }> {
    assertValid(validatePositiveAmount(amount, 'Vault Transfer Amount'));

    let createdTx: Transaction | null = null;
    let updatedGoal: SavingsGoal | null = null;

    await conn.executeTransaction(async () => {
      // 1. Deduct from wallet
      await conn.run(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [amount, fromWalletId]
      );

      // 2. Fetch or create savings goal
      const goalRows = await conn.query<any>('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
      let goalName = 'Savings';
      let goalColor = '#10B981';
      let targetAmt = 0;
      let currentAmt = 0;

      if (goalRows.length > 0) {
        const g = goalRows[0];
        goalName = g.name;
        goalColor = g.color;
        targetAmt = Number(g.target_amount);
        currentAmt = Number(g.current_amount) + amount;
        await conn.run(
          'UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?',
          [amount, goalId]
        );
      } else {
        currentAmt = amount;
        await conn.run(
          'INSERT OR REPLACE INTO savings_goals (id, name, target_amount, current_amount, color, deadline) VALUES (?, ?, ?, ?, ?, ?)',
          [goalId, goalName, targetAmt, currentAmt, goalColor, null]
        );
      }

      updatedGoal = {
        id: goalId,
        name: goalName,
        targetAmount: targetAmt,
        currentAmount: currentAmt,
        color: goalColor
      };

      // 3. Insert transaction
      const txId = EntityId.generate('tx');
      createdTx = {
        id: txId,
        type: 'savings_deposit',
        amount,
        currency: currencySymbol,
        date: new Date().toISOString(),
        note: `Vault deposit: "${goalName}"`,
        category: 'Savings Deposit',
        walletId: fromWalletId,
        paymentMethod: 'Vault Deposit',
        isRecurring: false,
        savingsGoalId: goalId
      };

      await conn.run(
        `INSERT INTO transactions (
          id, type, amount, currency, date, note, category, sub_category, 
          wallet_id, to_wallet_id, payment_method, attachment, 
          is_recurring, recurrence, savings_goal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdTx.id,
          createdTx.type,
          createdTx.amount,
          createdTx.currency,
          createdTx.date,
          createdTx.note,
          createdTx.category,
          null,
          createdTx.walletId,
          null,
          createdTx.paymentMethod,
          null,
          0,
          null,
          goalId
        ]
      );
    });

    if (!createdTx || !updatedGoal) {
      throw new Error('Savings deposit failed.');
    }

    return { transaction: createdTx, goal: updatedGoal };
  }

  /**
   * Withdraws funds from a Vault savings goal to main wallet.
   */
  public static async withdrawFromSavings(
    conn: DatabaseConnection,
    goalId: string,
    amount: number,
    toWalletId: string,
    currencySymbol = 'Rs.'
  ): Promise<{ transaction: Transaction; goal: SavingsGoal }> {
    assertValid(validatePositiveAmount(amount, 'Vault Withdrawal Amount'));

    let createdTx: Transaction | null = null;
    let updatedGoal: SavingsGoal | null = null;

    await conn.executeTransaction(async () => {
      const goalRows = await conn.query<any>('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
      if (goalRows.length === 0) {
        throw new Error('Savings goal not found.');
      }
      const g = goalRows[0];
      const currentAmt = Number(g.current_amount);
      if (currentAmt < amount) {
        throw new Error('Insufficient savings balance in vault goal.');
      }

      const nextAmt = Math.max(0, currentAmt - amount);
      await conn.run('UPDATE savings_goals SET current_amount = ? WHERE id = ?', [nextAmt, goalId]);

      // Add to wallet
      await conn.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, toWalletId]);

      updatedGoal = {
        id: g.id,
        name: g.name,
        targetAmount: Number(g.target_amount),
        currentAmount: nextAmt,
        color: g.color,
        deadline: g.deadline ?? undefined
      };

      const txId = EntityId.generate('tx');
      createdTx = {
        id: txId,
        type: 'savings_withdraw',
        amount,
        currency: currencySymbol,
        date: new Date().toISOString(),
        note: `Vault withdrawal to main income: "${g.name}"`,
        category: 'Savings Withdrawal',
        walletId: toWalletId,
        paymentMethod: 'Vault Withdrawal',
        isRecurring: false,
        savingsGoalId: goalId
      };

      await conn.run(
        `INSERT INTO transactions (
          id, type, amount, currency, date, note, category, sub_category, 
          wallet_id, to_wallet_id, payment_method, attachment, 
          is_recurring, recurrence, savings_goal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdTx.id,
          createdTx.type,
          createdTx.amount,
          createdTx.currency,
          createdTx.date,
          createdTx.note,
          createdTx.category,
          null,
          createdTx.walletId,
          null,
          createdTx.paymentMethod,
          null,
          0,
          null,
          goalId
        ]
      );
    });

    if (!createdTx || !updatedGoal) {
      throw new Error('Savings withdrawal failed.');
    }

    return { transaction: createdTx, goal: updatedGoal };
  }

  /**
   * Sets or updates category monthly budget with targeted SQLite write.
   */
  public static async setBudget(
    conn: DatabaseConnection,
    categoryId: string,
    amount: number,
    rollover: boolean,
    month: string
  ): Promise<Budget> {
    assertValid(validatePositiveAmount(amount, 'Budget Amount'));
    assertValid(validateRequiredString(categoryId, 'Budget Category'));

    const existingRows = await conn.query<any>(
      'SELECT id FROM budgets WHERE category_id = ?',
      [categoryId]
    );

    const budgetId = existingRows.length > 0 ? existingRows[0].id : EntityId.generate('b');

    await conn.run(
      'INSERT OR REPLACE INTO budgets (id, category_id, amount, month, rollover) VALUES (?, ?, ?, ?, ?)',
      [budgetId, categoryId, amount, month, rollover ? 1 : 0]
    );

    return {
      id: budgetId,
      categoryId,
      amount,
      month,
      rollover
    };
  }

  /**
   * Deletes a monthly budget.
   */
  public static async deleteBudget(
    conn: DatabaseConnection,
    budgetId: string
  ): Promise<void> {
    await conn.run('DELETE FROM budgets WHERE id = ?', [budgetId]);
  }

  /**
   * Adds a savings goal.
   */
  public static async addSavingsGoal(
    conn: DatabaseConnection,
    goalData: Omit<SavingsGoal, 'id' | 'currentAmount'>
  ): Promise<SavingsGoal> {
    const goalId = EntityId.generate('goal');
    const newGoal: SavingsGoal = {
      id: goalId,
      currentAmount: 0,
      name: goalData.name,
      targetAmount: Number(goalData.targetAmount),
      color: goalData.color,
      deadline: goalData.deadline
    };

    await conn.run(
      'INSERT OR REPLACE INTO savings_goals (id, name, target_amount, current_amount, color, deadline) VALUES (?, ?, ?, ?, ?, ?)',
      [newGoal.id, newGoal.name, newGoal.targetAmount, 0, newGoal.color, newGoal.deadline || null]
    );

    return newGoal;
  }

  /**
   * Edits an existing savings goal.
   */
  public static async editSavingsGoal(
    conn: DatabaseConnection,
    goalId: string,
    updates: Partial<SavingsGoal>
  ): Promise<SavingsGoal> {
    const rows = await conn.query<any>('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
    if (rows.length === 0) throw new Error('Goal not found');
    const existing = rows[0];

    const updated: SavingsGoal = {
      id: goalId,
      name: updates.name ?? existing.name,
      targetAmount: updates.targetAmount !== undefined ? Number(updates.targetAmount) : Number(existing.target_amount),
      currentAmount: updates.currentAmount !== undefined ? Number(updates.currentAmount) : Number(existing.current_amount),
      color: updates.color ?? existing.color,
      deadline: updates.deadline !== undefined ? updates.deadline : existing.deadline
    };

    await conn.run(
      'UPDATE savings_goals SET name = ?, target_amount = ?, color = ?, deadline = ? WHERE id = ?',
      [updated.name, updated.targetAmount, updated.color, updated.deadline || null, goalId]
    );

    return updated;
  }

  /**
   * Deletes a savings goal and salvages its accrued funds back into main savings.
   */
  public static async deleteSavingsGoal(
    conn: DatabaseConnection,
    goalId: string
  ): Promise<void> {
    if (goalId === 'savings') return; // Cannot delete base vault

    await conn.executeTransaction(async () => {
      const rows = await conn.query<any>('SELECT current_amount FROM savings_goals WHERE id = ?', [goalId]);
      if (rows.length === 0) return;
      const salvaged = Number(rows[0].current_amount || 0);

      if (salvaged > 0) {
        // Ensure default 'savings' goal exists
        const baseRows = await conn.query<any>('SELECT id FROM savings_goals WHERE id = ?', ['savings']);
        if (baseRows.length === 0) {
          await conn.run(
            'INSERT INTO savings_goals (id, name, target_amount, current_amount, color) VALUES (?, ?, ?, ?, ?)',
            ['savings', 'Savings', 0, salvaged, '#10B981']
          );
        } else {
          await conn.run(
            'UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?',
            [salvaged, 'savings']
          );
        }
      }

      await conn.run('DELETE FROM savings_goals WHERE id = ?', [goalId]);
    });
  }

  /**
   * Adds a custom category.
   */
  public static async addCategory(
    conn: DatabaseConnection,
    catData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>
  ): Promise<Category> {
    const id = EntityId.generate('cat');
    const category: Category = {
      id,
      name: catData.name,
      type: catData.type,
      icon: catData.icon,
      color: catData.color,
      parentId: catData.parentId || null,
      isCustom: true,
      isEnabled: true
    };

    await conn.run(
      'INSERT OR REPLACE INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [category.id, category.name, category.type, category.icon, category.color, category.parentId, 1, 1]
    );

    return category;
  }

  /**
   * Deletes a category and its subcategories.
   */
  public static async deleteCategory(
    conn: DatabaseConnection,
    id: string
  ): Promise<void> {
    await conn.executeTransaction(async () => {
      await conn.run('DELETE FROM categories WHERE parent_id = ?', [id]);
      await conn.run('DELETE FROM categories WHERE id = ?', [id]);
    });
  }

  /**
   * Adds a subcategory.
   */
  public static async addSubCategory(
    conn: DatabaseConnection,
    subCatData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>
  ): Promise<Category> {
    const id = EntityId.generate('subcat');
    const subCat: Category = {
      id,
      name: subCatData.name,
      type: subCatData.type,
      icon: subCatData.icon,
      color: subCatData.color,
      parentId: subCatData.parentId || null,
      isCustom: true,
      isEnabled: true
    };

    await conn.run(
      'INSERT OR REPLACE INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [subCat.id, subCat.name, subCat.type, subCat.icon, subCat.color, subCat.parentId, 1, 1]
    );

    return subCat;
  }

  /**
   * Deletes a subcategory.
   */
  public static async deleteSubCategory(
    conn: DatabaseConnection,
    id: string
  ): Promise<void> {
    await conn.run('DELETE FROM categories WHERE id = ?', [id]);
  }

  /**
   * Saves targeted app settings updates into SQLite without full state rewriting.
   */
  public static async updateSettings(
    conn: DatabaseConnection,
    updates: Partial<AppSettings>
  ): Promise<void> {
    await conn.executeTransaction(async () => {
      for (const [key, val] of Object.entries(updates)) {
        // SECURITY: Never write plaintext PIN into database
        if (key === 'pinCode') continue;
        await conn.run(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          [key, JSON.stringify(val)]
        );
      }
    });
  }

  /**
   * Resets personal financial data.
   */
  public static async resetPersonalData(conn: DatabaseConnection): Promise<void> {
    await conn.executeTransaction(async () => {
      await conn.run('DELETE FROM transactions;');
      await conn.run('DELETE FROM budgets;');
      await conn.run('DELETE FROM savings_goals;');
      await conn.run('DELETE FROM bill_reminders;');
      await conn.run('DELETE FROM app_settings;');

      // Reset wallets to 0
      for (const w of DEFAULT_WALLETS) {
        await conn.run(
          'INSERT OR REPLACE INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)',
          [w.id, w.name, w.type, 0, w.color]
        );
      }

      // Default savings goal
      await conn.run(
        'INSERT OR REPLACE INTO savings_goals (id, name, target_amount, current_amount, color, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        ['savings', 'Savings', 0, 0, '#10B981', null]
      );
    });
  }
}
