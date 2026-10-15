/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from '../../core/types';
import { Money } from '../../domain/money/Money';

export interface FinancialSummaryResult {
  totalIncome: Money;
  totalExpense: Money;
  netSavings: Money;
  currencyCode: string;
}

export class GetFinancialSummaryQueryHandler {
  public execute(transactions: Transaction[], currencyCode = 'PKR'): FinancialSummaryResult {
    let incomeScaled = 0n;
    let expenseScaled = 0n;

    for (const tx of transactions) {
      const txMoney = Money.fromDecimal(tx.amount, tx.currency || currencyCode);
      if (tx.type === 'income') {
        incomeScaled += txMoney.scaledUnits;
      } else if (tx.type === 'expense') {
        expenseScaled += txMoney.scaledUnits;
      }
    }

    return {
      totalIncome: Money.fromScaled(incomeScaled, currencyCode),
      totalExpense: Money.fromScaled(expenseScaled, currencyCode),
      netSavings: Money.fromScaled(incomeScaled - expenseScaled, currencyCode),
      currencyCode
    };
  }
}
