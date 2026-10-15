import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FinancialCalculationService } from './FinancialCalculationService';
import { Transaction } from '../../core/types';

describe('Application Service: FinancialCalculationService', () => {
  it('computes exact monthly income, expense and net liquid balance', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'income',
        amount: 150000.5,
        currency: 'PKR',
        date: '2026-10-01T10:00:00Z',
        note: 'October salary',
        category: 'Salary',
        walletId: 'w-1',
        paymentMethod: 'Bank Transfer',
        isRecurring: false
      },
      {
        id: 'tx-2',
        type: 'expense',
        amount: 35000.25,
        currency: 'PKR',
        date: '2026-10-05T10:00:00Z',
        note: 'Office rent',
        category: 'Rent',
        walletId: 'w-1',
        paymentMethod: 'Bank Transfer',
        isRecurring: false
      },
      {
        id: 'tx-3',
        type: 'expense',
        amount: 1200.75,
        currency: 'PKR',
        date: '2026-10-12T08:00:00Z',
        note: 'Groceries and snacks',
        category: 'Food',
        walletId: 'w-1',
        paymentMethod: 'Cash',
        isRecurring: false
      }
    ];

    const totals = FinancialCalculationService.computeTotals(transactions, '2026-10', '2026-10-12', 'PKR');

    assert.equal(totals.monthIncome.toDecimal(), 150000.5);
    assert.equal(totals.monthExpense.toDecimal(), 36201.0);
    assert.equal(totals.netLiquidBalance.toDecimal(), 113799.5);
    assert.equal(totals.todayExpenses.toDecimal(), 1200.75);
  });

  it('accurately evaluates budget thresholds', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'expense',
        amount: 8500,
        currency: 'PKR',
        date: '2026-10-02T10:00:00Z',
        note: 'Market purchase',
        category: 'Groceries',
        walletId: 'w-1',
        paymentMethod: 'Cash',
        isRecurring: false
      }
    ];

    const budgetStatus = FinancialCalculationService.checkBudget('Groceries', 10000, transactions, '2026-10', 'PKR');

    assert.equal(budgetStatus.exceeded, false);
    assert.equal(budgetStatus.spent.toDecimal(), 8500);
    assert.equal(budgetStatus.remaining.toDecimal(), 1500);
    assert.equal(budgetStatus.ratio, 0.85);
  });
});
