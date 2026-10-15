/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from '../types';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_SUBCATEGORIES, 
  DEFAULT_WALLETS, 
  DEFAULT_SAVINGS_GOALS, 
  DEFAULT_REMINDERS, 
  DEFAULT_SETTINGS 
} from '../constants';
import { sqlitePool } from '../../infrastructure/database/sqliteConnectionPool';
import { databaseService } from '../../infrastructure/database/DatabaseService';
import { 
  loadAppStateFromDatabase, 
  saveAppStateToDatabase 
} from '../../infrastructure/database/sqliteRepository';
import { 
  runZeroLossMigration, 
  STORAGE_CUTOVER_KEY, 
  SQLITE_MIGRATED_KEY 
} from '../../infrastructure/database/migrationRunner';

// Primary and legacy storage keys for local-first backwards compatibility
export const PRIMARY_STORAGE_KEY = 'cocoon_app_state';
export const LEGACY_STORAGE_KEY = 'finflow_app_state';

/**
 * Checks whether SQLite is currently the authoritative store.
 */
export function isAuthoritativeStoreSqlite(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_CUTOVER_KEY) === 'sqlite';
  } catch {
    return false;
  }
}

/**
 * Returns clean initial state populated with initial defaults and dummy ledger.
 */
export function getInitialState(): AppState {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    subCategories: DEFAULT_SUBCATEGORIES,
    wallets: DEFAULT_WALLETS,
    budgets: [],
    savingsGoals: DEFAULT_SAVINGS_GOALS,
    reminders: DEFAULT_REMINDERS,
    settings: DEFAULT_SETTINGS
  };
}

/**
 * Loads the current AppState from storage.
 * Used for initial synchronous render in React components.
 */
export function loadAppState(): AppState {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? (localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY))
      : null;

    if (!raw) {
      const initial = getInitialState();
      saveAppState(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);

    // Schema validation and missing-field safety hydration
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES,
      subCategories: Array.isArray(parsed.subCategories) ? parsed.subCategories : DEFAULT_SUBCATEGORIES,
      wallets: Array.isArray(parsed.wallets) && parsed.wallets.length > 0 ? parsed.wallets : DEFAULT_WALLETS,
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      savingsGoals: (() => {
        const rawGoals = Array.isArray(parsed.savingsGoals) && parsed.savingsGoals.length > 0 ? parsed.savingsGoals : DEFAULT_SAVINGS_GOALS;
        if (!rawGoals.some((g: any) => g.id === 'savings')) {
          return [{ id: 'savings', name: 'Savings', targetAmount: 0, currentAmount: 0, color: '#10B981' }, ...rawGoals];
        }
        return rawGoals;
      })(),
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
    };
  } catch (error) {
    console.error('Failed to load local app state:', error);
    return getInitialState();
  }
}

/**
 * Loads the authoritative AppState from SQLite if cutover is active,
 * otherwise falls back to local storage.
 */
export async function loadAppStateAsync(): Promise<AppState> {
  if (isAuthoritativeStoreSqlite()) {
    try {
      const conn = await sqlitePool.getConnection();
      return await loadAppStateFromDatabase(conn);
    } catch (err) {
      console.error('Failed to load authoritative AppState from SQLite; using recovery fallback:', err);
      return loadAppState();
    }
  }
  return loadAppState();
}

/**
 * Persists the AppState.
 * When SQLite cutover is active, SQLite is authoritative.
 * LocalStorage is maintained strictly as an auxiliary recovery cache.
 */
export function saveAppState(state: AppState): void {
  // 1. Auxiliary recovery backup in localStorage (prevents crash on abrupt termination)
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(state);
      localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    }
  } catch (error) {
    console.error('Failed to save auxiliary backup to localStorage:', error);
  }

  // 2. Authoritative persistence in SQLite
  if (isAuthoritativeStoreSqlite()) {
    sqlitePool.getConnection()
      .then(conn => saveAppStateToDatabase(conn, state))
      .catch(err => {
        console.error('Authoritative SQLite write error in saveAppState:', err);
      });
  }
}

/**
 * Asynchronously persists state directly into SQLite authoritative store.
 */
export async function saveAppStateAsync(state: AppState): Promise<void> {
  // Auxiliary recovery cache
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(state);
      localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    }
  } catch {
    // Non-fatal
  }

  const conn = await sqlitePool.getConnection();
  await saveAppStateToDatabase(conn, state);
}

/**
 * Bootstraps database connection and runs zero-loss migration runner.
 * Returns authoritative AppState.
 */
export async function initDatabaseAndMigrate(): Promise<AppState> {
  try {
    const conn = await databaseService.getInitializedConnection();
    await runZeroLossMigration(conn);
    return await loadAppStateFromDatabase(conn);
  } catch (err) {
    console.error('initDatabaseAndMigrate error:', err);
    return loadAppState();
  }
}
