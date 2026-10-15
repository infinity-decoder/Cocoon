/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { Money } from '../../domain/money';
import { Category, Budget, Wallet } from '../../core/types';
import { FinancialCalculationService } from './FinancialCalculationService';

export interface FinancialTotals {
  monthIncome: number;
  monthExpense: number;
  todayIncome: number;
  todayExpenses: number;
  netLiquidBalance: number;
  totalAssets: number;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface CategoryBreakdownResult {
  list: CategoryBreakdownItem[];
  total: number;
}

export interface DoughnutSegment {
  name: string;
  amount: number;
  color: string;
  percentage: number;
  strokeDasharray: string;
  strokeDashoffset: number;
}

export class SummaryQueryService {
  /**
   * Retrieves high-level monthly and daily totals combining SQLite records and Money domain accuracy.
   */
  public static async getFinancialTotals(
    conn: DatabaseConnection,
    monthStr: string,
    todayStr: string,
    currencyCode = 'PKR'
  ): Promise<FinancialTotals> {
    // 1. Fetch all transactions for this month and today in a targeted SQL query
    const txRows = await conn.query<{
      type: string;
      amount: number;
      date: string;
    }>(
      `SELECT type, amount, date FROM transactions 
       WHERE date LIKE ? OR date LIKE ?`,
      [`${monthStr}%`, `${todayStr}%`]
    );

    let monthIncomeScaled = 0n;
    let monthExpenseScaled = 0n;
    let todayIncomeScaled = 0n;
    let todayExpenseScaled = 0n;

    for (const row of txRows) {
      const amtScaled = Money.fromDecimal(Number(row.amount), currencyCode).scaledUnits;
      const isMonth = row.date.startsWith(monthStr);
      const isToday = row.date.startsWith(todayStr);

      if (isMonth) {
        if (row.type === 'income' || row.type === 'savings_withdraw') {
          monthIncomeScaled += amtScaled;
        } else if (row.type === 'expense' || row.type === 'savings_deposit') {
          monthExpenseScaled += amtScaled;
        }
      }

      if (isToday) {
        if (row.type === 'income' || row.type === 'savings_withdraw') {
          todayIncomeScaled += amtScaled;
        } else if (row.type === 'expense' || row.type === 'savings_deposit') {
          todayExpenseScaled += amtScaled;
        }
      }
    }

    // 2. Fetch wallets for total net assets
    const walletRows = await conn.query<{ balance: number }>(
      'SELECT balance FROM wallets'
    );
    let totalAssetsScaled = 0n;
    for (const w of walletRows) {
      totalAssetsScaled += Money.fromDecimal(Number(w.balance), currencyCode).scaledUnits;
    }

    const netLiquidScaled = monthIncomeScaled - monthExpenseScaled;

    return {
      monthIncome: Money.fromScaled(monthIncomeScaled, currencyCode).toDecimal(),
      monthExpense: Money.fromScaled(monthExpenseScaled, currencyCode).toDecimal(),
      todayIncome: Money.fromScaled(todayIncomeScaled, currencyCode).toDecimal(),
      todayExpenses: Money.fromScaled(todayExpenseScaled, currencyCode).toDecimal(),
      netLiquidBalance: Money.fromScaled(netLiquidScaled, currencyCode).toDecimal(),
      totalAssets: Money.fromScaled(totalAssetsScaled, currencyCode).toDecimal()
    };
  }

  /**
   * Computes category breakdown for the active month using indexed SQLite queries and categories metadata.
   */
  public static async getCategoryBreakdown(
    conn: DatabaseConnection,
    categories: Category[],
    monthStr: string,
    viewType: 'expense' | 'income'
  ): Promise<CategoryBreakdownResult> {
    const targetTypes = viewType === 'expense' 
      ? ['expense', 'savings_deposit'] 
      : ['income', 'savings_withdraw'];

    const txRows = await conn.query<{ category: string; amount: number }>(
      `SELECT category, amount FROM transactions 
       WHERE date LIKE ? AND (type = ? OR type = ?)`,
      [`${monthStr}%`, targetTypes[0], targetTypes[1]]
    );

    const categoryMap = new Map<string, number>();
    let total = 0;

    for (const tx of txRows) {
      const amt = Number(tx.amount);
      total += amt;
      const catName = tx.category || 'Uncategorized';
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + amt);
    }

    const list: CategoryBreakdownItem[] = [];

    categoryMap.forEach((amt, catName) => {
      const matchedCat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      const percentage = total > 0 ? (amt / total) * 100 : 0;

      list.push({
        id: matchedCat?.id || `cat-${catName}`,
        name: catName,
        icon: matchedCat?.icon || 'Tag',
        color: matchedCat?.color || '#94A3B8',
        amount: amt,
        percentage
      });
    });

    list.sort((a, b) => b.amount - a.amount);

    return { list, total };
  }

  /**
   * Computes SVG doughnut segments for dashboard visualization.
   */
  public static computeDoughnutSegments(
    breakdownList: CategoryBreakdownItem[],
    totalAmount: number
  ): DoughnutSegment[] {
    const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40
    let cumulativePercent = 0;

    if (totalAmount <= 0 || breakdownList.length === 0) {
      return [];
    }

    return breakdownList.map(item => {
      const pct = item.amount / totalAmount;
      const dashLength = pct * CIRCUMFERENCE;
      const dashSpace = CIRCUMFERENCE - dashLength;
      const offset = -(cumulativePercent * CIRCUMFERENCE);
      cumulativePercent += pct;

      return {
        name: item.name,
        amount: item.amount,
        color: item.color,
        percentage: Math.round(pct * 100),
        strokeDasharray: `${dashLength.toFixed(2)} ${dashSpace.toFixed(2)}`,
        strokeDashoffset: offset
      };
    });
  }

  /**
   * Checks category spending against defined monthly budget.
   */
  public static async checkBudgetThreshold(
    conn: DatabaseConnection,
    categoryName: string,
    monthStr: string,
    categories: Category[],
    budgets: Budget[]
  ): Promise<{ exceeded: boolean; ratio: number; budgetAmount: number; spent: number } | null> {
    const matchedCategory = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!matchedCategory) return null;

    const budget = budgets.find(b => b.categoryId === matchedCategory.id);
    if (!budget || budget.amount <= 0) return null;

    const rows = await conn.query<{ amount: number }>(
      `SELECT amount FROM transactions 
       WHERE category = ? AND date LIKE ? AND (type = 'expense' OR type = 'savings_deposit')`,
      [categoryName, `${monthStr}%`]
    );

    const spent = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const ratio = spent / budget.amount;

    return {
      exceeded: spent >= budget.amount,
      ratio,
      budgetAmount: budget.amount,
      spent
    };
  }
}
