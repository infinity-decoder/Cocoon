import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sqlitePool } from '../../infrastructure/database/sqliteConnectionPool';
import { initializeDatabaseSchema } from '../../infrastructure/database/schema';
import { PersonalFinanceService } from './PersonalFinanceService';
import { TransactionQueryService } from './TransactionQueryService';
import { SummaryQueryService } from './SummaryQueryService';

describe('Application: PersonalFinanceService & Query Services', () => {
  const dbName = 'test_personal_finance_db';

  beforeEach(async () => {
    const conn = await sqlitePool.getConnection(dbName);
    await initializeDatabaseSchema(conn);
    // Reset data
    await conn.execute(`
      DELETE FROM transactions;
      DELETE FROM wallets;
      DELETE FROM categories;
      DELETE FROM budgets;
      DELETE FROM savings_goals;
      DELETE FROM app_settings;
    `);

    // Seed test wallets
    await conn.run('INSERT INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)', [
      'w-cash', 'Cash In Hand', 'cash', 1000, '#10B981'
    ]);
    await conn.run('INSERT INTO wallets (id, name, type, balance, color) VALUES (?, ?, ?, ?, ?)', [
      'w-bank', 'Bank Account', 'bank', 5000, '#3B82F6'
    ]);

    // Seed test categories
    await conn.run('INSERT INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      'cat-food', 'Groceries', 'expense', 'Utensils', '#F59E0B', null, 0, 1
    ]);
    await conn.run('INSERT INTO categories (id, name, type, icon, color, parent_id, is_custom, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      'cat-salary', 'Salary', 'income', 'Briefcase', '#10B981', null, 0, 1
    ]);
  });

  it('adds an expense transaction with targeted database write and updates wallet balance', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const tx = await PersonalFinanceService.addTransaction(conn, {
      type: 'expense',
      amount: 250,
      category: 'Groceries',
      walletId: 'w-cash',
      date: '2026-10-15T10:00:00.000Z',
      note: 'Fresh market produce'
    });

    assert.ok(tx.id.startsWith('tx_'));
    assert.equal(tx.amount, 250);

    // Verify transaction exists in database
    const rows = await conn.query<any>('SELECT * FROM transactions WHERE id = ?', [tx.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, 'Fresh market produce');

    // Verify wallet balance decremented (1000 - 250 = 750)
    const walletRows = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(walletRows[0].balance), 750);
  });

  it('adds an income transaction and increments wallet balance', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const tx = await PersonalFinanceService.addTransaction(conn, {
      type: 'income',
      amount: 1500,
      category: 'Salary',
      walletId: 'w-bank',
      date: '2026-10-15T12:00:00.000Z',
      note: 'Client payment'
    });

    assert.ok(tx.id.startsWith('tx_'));

    // Verify bank balance incremented (5000 + 1500 = 6500)
    const walletRows = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-bank']);
    assert.equal(Number(walletRows[0].balance), 6500);
  });

  it('handles wallet-to-wallet transfer correctly', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const tx = await PersonalFinanceService.addTransaction(conn, {
      type: 'transfer',
      amount: 500,
      category: 'Transfer',
      walletId: 'w-bank',
      toWalletId: 'w-cash',
      date: '2026-10-15T14:00:00.000Z',
      note: 'ATM withdrawal'
    });

    assert.ok(tx.id);

    // Bank decrements (5000 - 500 = 4500)
    const [bank] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-bank']);
    assert.equal(Number(bank.balance), 4500);

    // Cash increments (1000 + 500 = 1500)
    const [cash] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cash.balance), 1500);
  });

  it('edits a transaction and adjusts wallet differences accurately', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const tx = await PersonalFinanceService.addTransaction(conn, {
      type: 'expense',
      amount: 200,
      category: 'Groceries',
      walletId: 'w-cash',
      date: '2026-10-15T10:00:00.000Z'
    });

    // Cash wallet now 800
    const [cashBefore] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashBefore.balance), 800);

    // Edit transaction to 350 (+150 expense)
    const updated = await PersonalFinanceService.editTransaction(conn, {
      id: tx.id,
      amount: 350,
      note: 'Updated with snacks'
    });

    assert.equal(updated.amount, 350);
    assert.equal(updated.note, 'Updated with snacks');

    // Cash wallet should be 1000 - 350 = 650
    const [cashAfter] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashAfter.balance), 650);
  });

  it('deletes a transaction and reverses its wallet balance impact', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const tx = await PersonalFinanceService.addTransaction(conn, {
      type: 'expense',
      amount: 400,
      category: 'Groceries',
      walletId: 'w-cash',
      date: '2026-10-15T10:00:00.000Z'
    });

    // Cash is 600
    const [cash1] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cash1.balance), 600);

    // Delete transaction
    await PersonalFinanceService.deleteTransaction(conn, tx.id);

    // Cash returns to 1000
    const [cash2] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cash2.balance), 1000);

    // Transaction is gone
    const txRows = await conn.query<any>('SELECT * FROM transactions WHERE id = ?', [tx.id]);
    assert.equal(txRows.length, 0);
  });

  it('supports paginated transaction queries with SQL limit and offset', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    // Insert 15 transactions
    for (let i = 1; i <= 15; i++) {
      const day = i.toString().padStart(2, '0');
      await conn.run(
        `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
         VALUES (?, 'expense', ?, 'PKR', ?, ?, 'Groceries', 'w-cash', 'Cash')`,
        [`tx_${i.toString().padStart(3, '0')}`, i * 10, `2026-10-${day}T12:00:00.000Z`, `Item ${i}`]
      );
    }

    // Query Page 0 with PageSize 5
    const page0 = await TransactionQueryService.queryTransactions(conn, {
      page: 0,
      pageSize: 5
    });

    assert.equal(page0.totalCount, 15);
    assert.equal(page0.items.length, 5);
    assert.equal(page0.hasMore, true);
    // Deterministic sorting (date desc): latest day first
    assert.equal(page0.items[0].note, 'Item 15');

    // Query Page 1 with PageSize 5
    const page1 = await TransactionQueryService.queryTransactions(conn, {
      page: 1,
      pageSize: 5
    });

    assert.equal(page1.items.length, 5);
    assert.equal(page1.items[0].note, 'Item 10');

    // Query Page 2 with PageSize 5 (last page)
    const page2 = await TransactionQueryService.queryTransactions(conn, {
      page: 2,
      pageSize: 5
    });

    assert.equal(page2.items.length, 5);
    assert.equal(page2.items[4].note, 'Item 1');
    assert.equal(page2.hasMore, false);
  });

  it('filters transactions by search term and date range via SQL', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_special_1', 'expense', 150, 'PKR', '2026-10-05T12:00:00.000Z', 'Carpet cleaning', 'Home', 'w-cash', 'Cash')`
    );
    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_special_2', 'expense', 250, 'PKR', '2026-10-10T12:00:00.000Z', 'Dry cleaning', 'Laundry', 'w-cash', 'Cash')`
    );
    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_special_3', 'expense', 350, 'PKR', '2026-10-12T12:00:00.000Z', 'Car repair', 'Auto', 'w-cash', 'Cash')`
    );

    // Search for "cleaning"
    const searchRes = await TransactionQueryService.queryTransactions(conn, {
      searchTerm: 'cleaning'
    });
    assert.equal(searchRes.totalCount, 2);

    // Date range filter: 2026-10-08 to 2026-10-11
    const dateRes = await TransactionQueryService.queryTransactions(conn, {
      startDate: '2026-10-08',
      endDate: '2026-10-11'
    });
    assert.equal(dateRes.totalCount, 1);
    assert.equal(dateRes.items[0].id, 'tx_special_2');
  });

  it('computes financial totals and category breakdown directly via SummaryQueryService', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_sum_1', 'income', 10000, 'PKR', '2026-10-15T08:00:00.000Z', 'Consulting', 'Salary', 'w-bank', 'Bank')`
    );
    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_sum_2', 'expense', 2000, 'PKR', '2026-10-15T09:00:00.000Z', 'Food', 'Groceries', 'w-cash', 'Cash')`
    );
    await conn.run(
      `INSERT INTO transactions (id, type, amount, currency, date, note, category, wallet_id, payment_method) 
       VALUES ('tx_sum_3', 'expense', 1500, 'PKR', '2026-10-15T11:00:00.000Z', 'Fuel', 'Auto', 'w-cash', 'Cash')`
    );

    const totals = await SummaryQueryService.getFinancialTotals(conn, '2026-10', '2026-10-15');
    assert.equal(totals.monthIncome, 10000);
    assert.equal(totals.monthExpense, 3500);
    assert.equal(totals.todayIncome, 10000);
    assert.equal(totals.todayExpenses, 3500);
    assert.equal(totals.netLiquidBalance, 6500);

    const breakdown = await SummaryQueryService.getCategoryBreakdown(
      conn,
      [
        { id: 'cat-food', name: 'Groceries', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, isEnabled: true },
        { id: 'cat-auto', name: 'Auto', type: 'expense', icon: 'Car', color: '#3B82F6', isCustom: false, isEnabled: true }
      ],
      '2026-10',
      'expense'
    );

    assert.equal(breakdown.total, 3500);
    assert.equal(breakdown.list.length, 2);
    assert.equal(breakdown.list[0].name, 'Groceries');
    assert.equal(breakdown.list[0].amount, 2000);
  });

  it('transfers and withdraws from Vault savings goal with integrity enforcement', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    // Deposit 300 to savings goal
    const depRes = await PersonalFinanceService.transferToSavings(
      conn,
      'savings',
      300,
      'w-cash'
    );

    assert.equal(depRes.goal.currentAmount, 300);
    // Cash decremented (1000 - 300 = 700)
    const [cashRow] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashRow.balance), 700);

    // Withdraw 100 from savings goal back to cash
    const wdrRes = await PersonalFinanceService.withdrawFromSavings(
      conn,
      'savings',
      100,
      'w-cash'
    );

    assert.equal(wdrRes.goal.currentAmount, 200);
    // Cash incremented (700 + 100 = 800)
    const [cashRow2] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashRow2.balance), 800);

    // Reject withdrawal exceeding available savings
    await assert.rejects(async () => {
      await PersonalFinanceService.withdrawFromSavings(conn, 'savings', 500, 'w-cash');
    }, /Insufficient savings balance/);
  });

  it('manages budgets and settings without full-state serialization', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    const budget = await PersonalFinanceService.setBudget(conn, 'cat-food', 5000, true, '2026-10');
    assert.equal(budget.amount, 5000);
    assert.equal(budget.rollover, true);

    // Verify budget row in SQLite
    const bRows = await conn.query<any>('SELECT * FROM budgets WHERE category_id = ?', ['cat-food']);
    assert.equal(bRows.length, 1);
    assert.equal(Number(bRows[0].amount), 5000);

    // Update targeted settings
    await PersonalFinanceService.updateSettings(conn, {
      userName: 'Test User',
      currencySymbol: '$'
    });

    const sRows = await conn.query<any>('SELECT * FROM app_settings WHERE key = ?', ['userName']);
    assert.equal(sRows.length, 1);
    assert.equal(JSON.parse(sRows[0].value), 'Test User');
  });

  it('rolls back database modifications if an error occurs mid-operation', async () => {
    const conn = await sqlitePool.getConnection(dbName);

    // Initial wallet balance
    const [cashBefore] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashBefore.balance), 1000);

    // Attempt to add a transaction with invalid negative amount
    await assert.rejects(async () => {
      await PersonalFinanceService.addTransaction(conn, {
        type: 'expense',
        amount: -50,
        category: 'Groceries',
        walletId: 'w-cash'
      });
    }, /must be greater than zero/);

    // Assert wallet balance was untouched
    const [cashAfter] = await conn.query<any>('SELECT balance FROM wallets WHERE id = ?', ['w-cash']);
    assert.equal(Number(cashAfter.balance), 1000);
  });
});

