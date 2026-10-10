/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, Wallet, Transaction, SavingsGoal, BillReminder, AppSettings } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  // --- INCOME CATEGORIES ---
  { id: 'inc-salary', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false, isEnabled: true },
  { id: 'inc-freelance', name: 'Freelance', type: 'income', icon: 'Laptop', color: '#3B82F6', isCustom: false, isEnabled: true },
  { id: 'inc-investment', name: 'Investment Returns', type: 'income', icon: 'TrendingUp', color: '#8B5CF6', isCustom: false, isEnabled: true },
  { id: 'inc-gifts', name: 'Gifts Received', type: 'income', icon: 'Gift', color: '#EC4899', isCustom: false, isEnabled: true },
  { id: 'inc-rental', name: 'Rental Income', type: 'income', icon: 'Home', color: '#F59E0B', isCustom: false, isEnabled: true },
  { id: 'inc-dividends', name: 'Dividends', type: 'income', icon: 'Percent', color: '#6366F1', isCustom: false, isEnabled: true },
  { id: 'inc-business', name: 'Business Revenue', type: 'income', icon: 'DollarSign', color: '#059669', isCustom: false, isEnabled: true },
  { id: 'inc-refunds', name: 'Refunds', type: 'income', icon: 'RotateCcw', color: '#14B8A6', isCustom: false, isEnabled: true },

  // --- EXPENSE CATEGORIES ---
  { id: 'exp-food', name: 'Food & Groceries', type: 'expense', icon: 'Pizza', color: '#EF4444', isCustom: false, isEnabled: true },
  { id: 'exp-transport', name: 'Transport & Fuel', type: 'expense', icon: 'Car', color: '#3B82F6', isCustom: false, isEnabled: true },
  { id: 'exp-shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#EC4899', isCustom: false, isEnabled: true },
  { id: 'exp-utilities', name: 'Utilities', type: 'expense', icon: 'Zap', color: '#F59E0B', isCustom: false, isEnabled: true },
  { id: 'exp-rent', name: 'Rent/Mortgage', type: 'expense', icon: 'Home', color: '#8B5CF6', isCustom: false, isEnabled: true },
  { id: 'exp-insurance', name: 'Insurance', type: 'expense', icon: 'Shield', color: '#64748B', isCustom: false, isEnabled: true },
  { id: 'exp-healthcare', name: 'Healthcare', type: 'expense', icon: 'Stethoscope', color: '#10B981', isCustom: false, isEnabled: true },
  { id: 'exp-education', name: 'Education', type: 'expense', icon: 'Pencil', color: '#6366F1', isCustom: false, isEnabled: true },
  { id: 'exp-entertainment', name: 'Entertainment', type: 'expense', icon: 'Film', color: '#A855F7', isCustom: false, isEnabled: true },
  { id: 'exp-dining', name: 'Dining Out', type: 'expense', icon: 'Coffee', color: '#F97316', isCustom: false, isEnabled: true },
  { id: 'exp-subscriptions', name: 'Subscriptions', type: 'expense', icon: 'Tv', color: '#306EE8', isCustom: false, isEnabled: true },
  { id: 'exp-pets', name: 'Pets', type: 'expense', icon: 'Heart', color: '#14B8A6', isCustom: false, isEnabled: true },
  { id: 'exp-childcare', name: 'Childcare', type: 'expense', icon: 'Baby', color: '#06B6D4', isCustom: false, isEnabled: true },
  { id: 'exp-taxes', name: 'Taxes', type: 'expense', icon: 'Scale', color: '#94A3B8', isCustom: false, isEnabled: true },
  { id: 'exp-loans', name: 'EMI/Loans', type: 'expense', icon: 'CreditCard', color: '#BE123C', isCustom: false, isEnabled: true },
  { id: 'exp-gifts-exp', name: 'Gifts', type: 'expense', icon: 'Gift', color: '#DB2777', isCustom: false, isEnabled: true },
  { id: 'exp-charity', name: 'Charity', type: 'expense', icon: 'HeartHandshake', color: '#0D9488', isCustom: false, isEnabled: true }
];

export const DEFAULT_SUBCATEGORIES: Category[] = [
  // --- EXPENSE SUBCATEGORIES ---
  // Food subcategories
  { id: 'sub-groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#EF4444', parentId: 'exp-food', isCustom: false, isEnabled: true },
  { id: 'sub-snacks', name: 'Snacks & Cafes', type: 'expense', icon: 'Coffee', color: '#EF4444', parentId: 'exp-food', isCustom: false, isEnabled: true },
  
  // Transport subcategories
  { id: 'sub-uber', name: 'Indrive / Rideshare', type: 'expense', icon: 'Car', color: '#3B82F6', parentId: 'exp-transport', isCustom: false, isEnabled: true },
  { id: 'sub-fuel', name: 'Car Fuel', type: 'expense', icon: 'Fuel', color: '#3B82F6', parentId: 'exp-transport', isCustom: false, isEnabled: true },

  // Utilities subcategories
  { id: 'sub-electricity', name: 'KElectricity', type: 'expense', icon: 'Zap', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true },
  { id: 'sub-water', name: 'Water Tanker', type: 'expense', icon: 'Droplet', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true },
  { id: 'sub-wifi', name: 'PTCL Fiber / Internet', type: 'expense', icon: 'Wifi', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true },

  // --- INCOME SUBCATEGORIES ---
  // Salary subcategories
  { id: 'sub-salary-fulltime', name: 'Full-time Job', type: 'income', icon: 'Briefcase', color: '#10B981', parentId: 'inc-salary', isCustom: false, isEnabled: true },
  { id: 'sub-salary-bonus', name: 'Bonus & Overtime', type: 'income', icon: 'Award', color: '#10B981', parentId: 'inc-salary', isCustom: false, isEnabled: true },

  // Freelance subcategories
  { id: 'sub-freelance-client', name: 'Direct Clients', type: 'income', icon: 'Laptop', color: '#3B82F6', parentId: 'inc-freelance', isCustom: false, isEnabled: true },
  { id: 'sub-freelance-market', name: 'Upwork / Fiverr', type: 'income', icon: 'Globe', color: '#3B82F6', parentId: 'inc-freelance', isCustom: false, isEnabled: true },

  // Investment Returns subcategories
  { id: 'sub-invest-stocks', name: 'Stock Portfolio', type: 'income', icon: 'TrendingUp', color: '#8B5CF6', parentId: 'inc-investment', isCustom: false, isEnabled: true },
  { id: 'sub-invest-crypto', name: 'Crypto Yield', type: 'income', icon: 'Percent', color: '#8B5CF6', parentId: 'inc-investment', isCustom: false, isEnabled: true },

  // Business Revenue subcategories
  { id: 'sub-biz-sales', name: 'Product Sales', type: 'income', icon: 'DollarSign', color: '#059669', parentId: 'inc-business', isCustom: false, isEnabled: true },
  { id: 'sub-biz-services', name: 'Consulting Services', type: 'income', icon: 'Compass', color: '#059669', parentId: 'inc-business', isCustom: false, isEnabled: true }
];

export const DEFAULT_WALLETS: Wallet[] = [
  { id: 'wallet-cash', name: 'Cash In Hand', type: 'cash', balance: 0.00, color: '#10B981' },
  { id: 'wallet-bank', name: 'Bank Account', type: 'bank', balance: 0.00, color: '#3B82F6' }
];

export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Digital Wallet',
  'NayaPay',
  'Cryptocurrency',
  'Bank Transfer',
  'Cheque'
] as const;

export const DEFAULT_SAVINGS_GOALS: SavingsGoal[] = [
  { id: 'savings', name: 'Savings', targetAmount: 0, currentAmount: 0, color: '#10B981' }
];

export const DEFAULT_REMINDERS: BillReminder[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '₨',
  currencyCode: 'PKR',
  currencyFormat: 'symbol-amount',
  decimalPlaces: 0,
  firstDayOfWeek: 'monday',
  biometricsEnabled: false,
  accentColor: '#10B981',
  themeMode: 'dark',
  backupSchedule: 'weekly',
  isFirstTime: true
};

export const generateDummyTransactions = (): Transaction[] => {
  return [];
};
