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
  DEFAULT_SETTINGS, 
  generateDummyTransactions 
} from '../constants';

// Primary and legacy storage keys for local-first backwards compatibility
export const PRIMARY_STORAGE_KEY = 'cocoon_app_state';
export const LEGACY_STORAGE_KEY = 'finflow_app_state';

/**
 * Returns clean initial state populated with initial defaults and dummy ledger.
 */
export function getInitialState(): AppState {
  return {
    transactions: generateDummyTransactions(),
    categories: DEFAULT_CATEGORIES,
    subCategories: DEFAULT_SUBCATEGORIES,
    wallets: DEFAULT_WALLETS,
    budgets: [
      { id: 'b-food', categoryId: 'exp-food', amount: 500, month: '2026-07', rollover: true },
      { id: 'b-transport', categoryId: 'exp-transport', amount: 200, month: '2026-07', rollover: false },
      { id: 'b-shopping', categoryId: 'exp-shopping', amount: 300, month: '2026-07', rollover: false }
    ],
    savingsGoals: DEFAULT_SAVINGS_GOALS,
    reminders: DEFAULT_REMINDERS,
    settings: DEFAULT_SETTINGS
  };
}

/**
 * Loads the current AppState from localStorage, falling back to legacy keys or initial state.
 */
export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
 * Persists the AppState to local-first storage across both active and legacy keys.
 */
export function saveAppState(state: AppState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save local app state:', error);
  }
}
