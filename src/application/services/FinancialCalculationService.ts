/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../../domain/money';
import { Transaction } from '../../core/types';

export interface FinancialTotalsResult {
  monthIncome: Money;
  monthExpense: Money;
  todayIncome: Money;
  todayExpenses: Money;
  netLiquidBalance: Money;
}

/**
 * Domain Service for exact financial metric calculations.
 * Completely decoupled from React components and UI state.
 */
export class FinancialCalculationService {
  public static computeTotals(
    transactions: Transaction[],
    currentMonth: string,
    todayStr: string,
    currencyCode = 'PKR'
  ): FinancialTotalsResult {
    let monthIncome = Money.zero(currencyCode);
    let monthExpense = Money.zero(currencyCode);
    let todayIncome = Money.zero(currencyCode);
    let todayExpenses = Money.zero(currencyCode);

    for (const tx of transactions) {
      const isCurrentMonth = tx.date.startsWith(currentMonth);
      const isToday = tx.date.startsWith(todayStr);

      if (!isCurrentMonth && !isToday) continue;

      const txMoney = Money.fromDecimal(tx.amount, currencyCode);

      if (isCurrentMonth) {
        if (tx.type === 'income' || tx.type === 'savings_withdraw') {
          monthIncome = monthIncome.add(txMoney);
        } else if (tx.type === 'expense' || tx.type === 'savings_deposit') {
          monthExpense = monthExpense.add(txMoney);
        }
      }

      if (isToday) {
        if (tx.type === 'income' || tx.type === 'savings_withdraw') {
          todayIncome = todayIncome.add(txMoney);
        } else if (tx.type === 'expense' || tx.type === 'savings_deposit') {
          todayExpenses = todayExpenses.add(txMoney);
        }
      }
    }

    const netLiquidBalance = monthIncome.subtract(monthExpense);

    return {
      monthIncome,
      monthExpense,
      todayIncome,
      todayExpenses,
      netLiquidBalance
    };
  }

  public static checkBudget(
    categoryName: string,
    budgetAmount: number,
    transactions: Transaction[],
    currentMonth: string,
    currencyCode = 'PKR'
  ): { exceeded: boolean; ratio: number; remaining: Money; spent: Money } {
    const budgetMoney = Money.fromDecimal(budgetAmount, currencyCode);
    let spent = Money.zero(currencyCode);

    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.category === categoryName && tx.date.startsWith(currentMonth)) {
        spent = spent.add(Money.fromDecimal(tx.amount, currencyCode));
      }
    }

    const remaining = budgetMoney.subtract(spent);
    const ratio = budgetAmount > 0 ? spent.toDecimal() / budgetAmount : 0;

    return {
      exceeded: spent.scaledUnits >= budgetMoney.scaledUnits,
      ratio,
      remaining,
      spent
    };
  }
}
