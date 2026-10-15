import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sqlitePool } from './sqliteConnectionPool';
import { 
  runZeroLossMigration, 
  rollbackMigration, 
  computeStateChecksum, 
  isMigrationCompleted,
  STORAGE_CUTOVER_KEY,
  SQLITE_MIGRATED_KEY
} from './migrationRunner';
import { loadAppStateFromDatabase, getDatabaseRecordCounts } from './sqliteRepository';
import { PRIMARY_STORAGE_KEY } from '../../core/storage/storageAdapter';
import { AppState } from '../../core/types';

// Mock localStorage in Node.js environment
const mockStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => { mockStorage.set(k, String(v)); },
  removeItem: (k: string) => { mockStorage.delete(k); },
  clear: () => { mockStorage.clear(); }
};

describe('Infrastructure: Zero-Loss Migration Runner', () => {
  beforeEach(async () => {
    mockStorage.clear();
  });

  it('computes deterministic checksum for financial state', () => {
    const sampleState: AppState = {
      transactions: [
        {
          id: 'tx-1',
          type: 'income',
          amount: 5000,
          currency: 'USD',
          date: '2026-10-01T10:00:00Z',
          note: 'Salary',
          category: 'Salary',
          walletId: 'w-1',
          paymentMethod: 'Bank Transfer',
          isRecurring: false
        }
      ],
      categories: [
        { id: 'cat-1', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false, isEnabled: true }
      ],
      subCategories: [],
      wallets: [
        { id: 'w-1', name: 'Main Account', type: 'bank', balance: 5000, color: '#3B82F6' }
      ],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '$',
        currencyCode: 'USD',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    const checksum1 = computeStateChecksum(sampleState);
    const checksum2 = computeStateChecksum(sampleState);
    assert.equal(checksum1, checksum2);
    assert.ok(checksum1.startsWith('chk_'));
  });

  it('migrates personal financial records from localStorage to SQLite with zero data loss', async () => {
    const testDb = await sqlitePool.getConnection('test_migration_db');

    const sourceState: AppState = {
      transactions: [
        {
          id: 'tx-mig-1',
          type: 'expense',
          amount: 45.50,
          currency: 'USD',
          date: '2026-10-10T12:00:00Z',
          note: 'Groceries',
          category: 'Food',
          walletId: 'w-cash',
          paymentMethod: 'Cash',
          isRecurring: false
        },
        {
          id: 'tx-mig-2',
          type: 'income',
          amount: 1200.00,
          currency: 'USD',
          date: '2026-10-11T09:00:00Z',
          note: 'Freelance invoice',
          category: 'Consulting',
          walletId: 'w-bank',
          paymentMethod: 'Bank Transfer',
          isRecurring: false
        }
      ],
      categories: [
        { id: 'c-food', name: 'Food', type: 'expense', icon: 'Utensils', color: '#EF4444', isCustom: false, isEnabled: true },
        { id: 'c-consult', name: 'Consulting', type: 'income', icon: 'Laptop', color: '#10B981', isCustom: true, isEnabled: true }
      ],
      subCategories: [],
      wallets: [
        { id: 'w-cash', name: 'Cash', type: 'cash', balance: 150.00, color: '#10B981' },
        { id: 'w-bank', name: 'Bank Account', type: 'bank', balance: 4500.00, color: '#3B82F6' }
      ],
      budgets: [
        { id: 'b-food-oct', categoryId: 'c-food', amount: 500.00, month: '2026-10', rollover: false }
      ],
      savingsGoals: [
        { id: 'sg-emergency', name: 'Emergency Fund', targetAmount: 10000, currentAmount: 3500, color: '#6366F1' }
      ],
      reminders: [
        { id: 'rem-wifi', title: 'Internet Bill', amount: 60.00, dueDate: '2026-10-25', categoryId: 'c-food', isPaid: false, recurrence: 'monthly' }
      ],
      settings: {
        currencySymbol: '$',
        currencyCode: 'USD',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: true,
        accentColor: '#3B82F6',
        themeMode: 'dark',
        backupSchedule: 'daily',
        isFirstTime: false
      }
    };

    // Store in localStorage as source
    mockStorage.set(PRIMARY_STORAGE_KEY, JSON.stringify(sourceState));

    // Run migration
    const result = await runZeroLossMigration(testDb, { force: true });
    assert.equal(result.success, true);
    assert.equal(result.alreadyMigrated, false);
    assert.ok(result.recordsMigrated >= 9);

    // Verify database counts match source counts
    const counts = await getDatabaseRecordCounts(testDb);
    assert.equal(counts.transactions, 2);
    assert.equal(counts.wallets, 2);
    assert.equal(counts.budgets, 1);
    assert.equal(counts.savingsGoals, 1);
    assert.equal(counts.reminders, 1);

    // Verify cutover flags
    assert.equal(mockStorage.get(STORAGE_CUTOVER_KEY), 'sqlite');
    assert.equal(mockStorage.get(SQLITE_MIGRATED_KEY), 'true');

    // Verify loaded AppState from SQLite matches source
    const loadedState = await loadAppStateFromDatabase(testDb);
    assert.equal(loadedState.transactions.length, 2);
    assert.equal(loadedState.transactions[0].id, 'tx-mig-2'); // Sorted by date DESC
    assert.equal(loadedState.wallets.length, 2);
    assert.equal(loadedState.budgets.length, 1);
    assert.equal(loadedState.savingsGoals.length, 1);
    assert.equal(loadedState.reminders.length, 1);
    assert.equal(loadedState.settings.currencyCode, 'USD');

    // Subsequent migration check reports already migrated
    const secondRun = await runZeroLossMigration(testDb);
    assert.equal(secondRun.alreadyMigrated, true);
  });

  it('provides verified rollback path returning state cleanly to localStorage', async () => {
    const testDb = await sqlitePool.getConnection('test_rollback_db');

    const initialState: AppState = {
      transactions: [
        {
          id: 'tx-rb-1',
          type: 'expense',
          amount: 19.99,
          currency: 'USD',
          date: '2026-10-12T08:00:00Z',
          note: 'Coffee',
          category: 'Food',
          walletId: 'w-cash',
          paymentMethod: 'Cash',
          isRecurring: false
        }
      ],
      categories: [
        { id: 'c-food', name: 'Food', type: 'expense', icon: 'Utensils', color: '#EF4444', isCustom: false, isEnabled: true }
      ],
      subCategories: [],
      wallets: [
        { id: 'w-cash', name: 'Wallet', type: 'cash', balance: 50.00, color: '#10B981' }
      ],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '$',
        currencyCode: 'USD',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    mockStorage.set(PRIMARY_STORAGE_KEY, JSON.stringify(initialState));

    // Execute migration
    const migResult = await runZeroLossMigration(testDb, { force: true });
    assert.equal(migResult.success, true);
    assert.equal(mockStorage.get(STORAGE_CUTOVER_KEY), 'sqlite');

    // Execute rollback
    const rollbackRes = await rollbackMigration(migResult.snapshotId, testDb);
    assert.equal(rollbackRes.success, true);
    assert.equal(rollbackRes.recordsRestored, 1);

    // Verify cutover flag reverted safely
    assert.equal(mockStorage.get(STORAGE_CUTOVER_KEY), 'localstorage');
    assert.equal(mockStorage.get(SQLITE_MIGRATED_KEY), 'false');

    // Verify localStorage has restored records
    const restoredRaw = mockStorage.get(PRIMARY_STORAGE_KEY);
    assert.ok(restoredRaw);
    const restoredState = JSON.parse(restoredRaw!);
    assert.equal(restoredState.transactions.length, 1);
    assert.equal(restoredState.transactions[0].id, 'tx-rb-1');
  });

  it('verifies MemoryDatabaseAdapter used in browser preview executes zero-loss migration for 18 records without mismatch', async () => {
    const memoryDb = new (await import('./sqliteConnectionPool')).MemoryDatabaseAdapter();
    await memoryDb.open();

    const eighteenTxs = Array.from({ length: 18 }, (_, idx) => ({
      id: `tx-browser-${idx + 1}`,
      type: idx % 2 === 0 ? ('expense' as const) : ('income' as const),
      amount: 10 + idx,
      currency: 'USD',
      date: `2026-10-${String(idx + 1).padStart(2, '0')}T10:00:00Z`,
      note: `Transaction ${idx + 1}`,
      category: 'Food',
      walletId: 'w-cash',
      paymentMethod: 'Cash',
      isRecurring: false
    }));

    const browserState: AppState = {
      transactions: eighteenTxs,
      categories: [
        { id: 'c-food', name: 'Food', type: 'expense', icon: 'Utensils', color: '#EF4444', isCustom: false, isEnabled: true }
      ],
      subCategories: [],
      wallets: [
        { id: 'w-cash', name: 'Cash', type: 'cash', balance: 500, color: '#10B981' },
        { id: 'w-bank', name: 'Bank', type: 'bank', balance: 2500, color: '#3B82F6' }
      ],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '$',
        currencyCode: 'USD',
        currencyFormat: 'symbol-amount',
        decimalPlaces: 2,
        firstDayOfWeek: 'monday',
        biometricsEnabled: false,
        accentColor: '#10B981',
        themeMode: 'light',
        backupSchedule: 'weekly',
        isFirstTime: false
      }
    };

    mockStorage.set(PRIMARY_STORAGE_KEY, JSON.stringify(browserState));

    // Execute migration with MemoryDatabaseAdapter
    const migResult = await runZeroLossMigration(memoryDb, { force: true });
    assert.equal(migResult.success, true);
    assert.equal(migResult.alreadyMigrated, false);

    // Verify record counts
    const counts = await (await import('./sqliteRepository')).getDatabaseRecordCounts(memoryDb);
    assert.equal(counts.transactions, 18);
    assert.equal(counts.wallets, 2);

    // Verify loaded state from memory DB
    const loaded = await (await import('./sqliteRepository')).loadAppStateFromDatabase(memoryDb);
    assert.equal(loaded.transactions.length, 18);
    assert.equal(loaded.wallets.length, 2);
  });
});
