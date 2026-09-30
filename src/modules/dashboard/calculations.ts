/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, Category, Budget } from '../../core/types';

export interface CategoryBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface CategoryBreakdownResult {
  list: CategoryBreakdownItem[];
  total: number;
}

export interface DoughnutSegmentItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
  isRemaining: boolean;
}

/**
 * Calculates monthly and daily totals for income and expenses
 */
export function computeFinancialTotals(
  transactions: Transaction[],
  currentMonth: string,
  todayStr: string
) {
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
  const todayTransactions = transactions.filter(t => t.date.startsWith(todayStr));

  const monthIncome = currentMonthTransactions
    .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpense = currentMonthTransactions
    .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
    .reduce((sum, t) => sum + t.amount, 0);

  const todayIncome = todayTransactions
    .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  const todayExpenses = todayTransactions
    .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    monthIncome,
    monthExpense,
    todayIncome,
    todayExpenses,
    netLiquidBalance: monthIncome - monthExpense
  };
}

/**
 * Groups monthly transactions by category for expense or income
 */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  currentMonth: string,
  toggle: 'expense' | 'income'
): CategoryBreakdownResult {
  const monthTxs = transactions.filter(t => t.date.startsWith(currentMonth));
  const filtered = monthTxs.filter(t => {
    if (toggle === 'expense') {
      return t.type === 'expense' || t.type === 'savings_deposit';
    } else {
      return t.type === 'income' || t.type === 'savings_withdraw';
    }
  });

  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  const groups: Record<string, { amount: number; color: string; icon: string }> = {};

  filtered.forEach(t => {
    if (!groups[t.category]) {
      const catMeta = categories.find(c => c.name === t.category);
      groups[t.category] = {
        amount: 0,
        color: catMeta?.color || '#64748B',
        icon: catMeta?.icon || 'Home'
      };
    }
    groups[t.category].amount += t.amount;
  });

  const list: CategoryBreakdownItem[] = Object.entries(groups).map(([name, data]) => ({
    name,
    amount: data.amount,
    percentage: total > 0 ? (data.amount / total) * 100 : 0,
    color: data.color,
    icon: data.icon
  }));

  list.sort((a, b) => b.amount - a.amount);

  return {
    list,
    total
  };
}

/**
 * Computes segments for the responsive SVG donut chart
 */
export function computeDoughnutSegments(
  categoryList: CategoryBreakdownItem[],
  monthIncome: number,
  monthExpense: number,
  toggle: 'expense' | 'income'
): DoughnutSegmentItem[] {
  if (toggle === 'income') {
    return categoryList.map(item => ({
      ...item,
      isRemaining: false
    }));
  }

  // Expense mode:
  if (monthIncome > 0) {
    const list: DoughnutSegmentItem[] = categoryList.map(item => ({
      name: item.name,
      amount: item.amount,
      percentage: (item.amount / monthIncome) * 100,
      color: item.color,
      icon: item.icon,
      isRemaining: false
    }));

    if (monthIncome > monthExpense) {
      const remainingAmount = monthIncome - monthExpense;
      list.push({
        name: 'Remaining Balance',
        amount: remainingAmount,
        percentage: (remainingAmount / monthIncome) * 100,
        color: 'rgba(20, 184, 166, 0.4)',
        icon: 'TrendingUp',
        isRemaining: true
      });
    }
    return list;
  }

  // Fallback if monthIncome <= 0:
  return categoryList.map(item => ({
    ...item,
    isRemaining: false
  }));
}

/**
 * Checks category spending against configured budget limits
 */
export function checkBudgetThreshold(
  catName: string,
  currentMonth: string,
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[]
): { exceeded: boolean; ratio: number; budgetAmount: number } | null {
  const matchingCat = categories.find(c => c.name === catName);
  if (!matchingCat) return null;

  const budgetLimit = budgets.find(b => b.categoryId === matchingCat.id || b.categoryId === matchingCat.name);
  if (!budgetLimit || budgetLimit.amount <= 0) return null;

  const totalSpent = transactions
    .filter(t => t.type === 'expense' && t.category === catName && t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  const ratio = totalSpent / budgetLimit.amount;
  return {
    exceeded: totalSpent >= budgetLimit.amount,
    ratio,
    budgetAmount: budgetLimit.amount
  };
}
