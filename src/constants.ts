/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, Wallet, Transaction, SavingsGoal, BillReminder, AppSettings } from './types';

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
  // Food subcategories
  { id: 'sub-groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#EF4444', parentId: 'exp-food', isCustom: false, isEnabled: true },
  { id: 'sub-snacks', name: 'Snacks & Cafes', type: 'expense', icon: 'Coffee', color: '#EF4444', parentId: 'exp-food', isCustom: false, isEnabled: true },
  
  // Transport subcategories
  { id: 'sub-uber', name: 'Indrive / Rideshare', type: 'expense', icon: 'Car', color: '#3B82F6', parentId: 'exp-transport', isCustom: false, isEnabled: true },
  { id: 'sub-fuel', name: 'Car Fuel', type: 'expense', icon: 'Fuel', color: '#3B82F6', parentId: 'exp-transport', isCustom: false, isEnabled: true },

  // Utilities subcategories
  { id: 'sub-electricity', name: 'KElectricity', type: 'expense', icon: 'Zap', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true },
  { id: 'sub-water', name: 'Water Tanker', type: 'expense', icon: 'Droplet', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true },
  { id: 'sub-wifi', name: 'PTCL Fiber / Internet', type: 'expense', icon: 'Wifi', color: '#F59E0B', parentId: 'exp-utilities', isCustom: false, isEnabled: true }
];

export const DEFAULT_WALLETS: Wallet[] = [
  { id: 'wallet-cash', name: 'Cash In Hand', type: 'cash', balance: 18500.00, color: '#10B981' },
  { id: 'wallet-bank', name: 'HBL Checking Account', type: 'bank', balance: 245000.00, color: '#3B82F6' },
  { id: 'wallet-credit', name: 'Alfalah Credit Card', type: 'card', balance: -15400.00, color: '#EF4444' },
  { id: 'wallet-savings', name: 'Meezan Savings Vault', type: 'savings', balance: 150000.00, color: '#8B5CF6' }
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
];

export const DEFAULT_SAVINGS_GOALS: SavingsGoal[] = [
  { id: 'goal-vacation', name: 'Northern Areas Trip', targetAmount: 85000, currentAmount: 45000, color: '#3B82F6', deadline: '2026-10-15' },
  { id: 'goal-emergency', name: 'Emergency Fund', targetAmount: 200000, currentAmount: 150000, color: '#10B981' },
  { id: 'goal-laptop', name: 'New M3 Macbook Pro', targetAmount: 450000, currentAmount: 180000, color: '#F59E0B' }
];

export const DEFAULT_REMINDERS: BillReminder[] = [
  { id: 'rem-rent', title: 'Home Monthly Rent', amount: 35000, dueDate: '2026-07-01', categoryId: 'exp-rent', isPaid: true, recurrence: 'monthly' },
  { id: 'rem-wifi', title: 'StormFiber Broadband Bill', amount: 3500, dueDate: '2026-07-10', categoryId: 'exp-utilities', isPaid: false, recurrence: 'monthly' },
  { id: 'rem-gym', title: 'Bodyfit Gym Fee', amount: 4500, dueDate: '2026-07-15', categoryId: 'exp-subscriptions', isPaid: false, recurrence: 'monthly' }
];

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
  const transactions: Transaction[] = [];
  const now = new Date();
  
  // Salary 28 days ago
  const t1Date = new Date();
  t1Date.setDate(now.getDate() - 28);
  transactions.push({
    id: 'tx-salary-1',
    type: 'income',
    amount: 180000,
    currency: 'PKR',
    date: t1Date.toISOString(),
    note: 'Monthly Corporate Salary Transfer',
    category: 'Salary',
    walletId: 'wallet-bank',
    paymentMethod: 'Bank Transfer',
    isRecurring: true,
    recurrence: 'monthly'
  });

  // Freelance project 14 days ago
  const t2Date = new Date();
  t2Date.setDate(now.getDate() - 14);
  transactions.push({
    id: 'tx-freelance',
    type: 'income',
    amount: 45000,
    currency: 'PKR',
    date: t2Date.toISOString(),
    note: 'Web Dashboard Design Completion',
    category: 'Freelance',
    walletId: 'wallet-bank',
    paymentMethod: 'Bank Transfer',
    isRecurring: false
  });

  // Rent 25 days ago
  const tRentDate = new Date();
  tRentDate.setDate(now.getDate() - 25);
  transactions.push({
    id: 'tx-rent',
    type: 'expense',
    amount: 35000,
    currency: 'PKR',
    date: tRentDate.toISOString(),
    note: 'Apartment Rent payment',
    category: 'Rent/Mortgage',
    walletId: 'wallet-bank',
    paymentMethod: 'Bank Transfer',
    isRecurring: true,
    recurrence: 'monthly'
  });

  // Food / Groceries
  const tFood1 = new Date();
  tFood1.setDate(now.getDate() - 8);
  transactions.push({
    id: 'tx-food-1',
    type: 'expense',
    amount: 12500,
    currency: 'PKR',
    date: tFood1.toISOString(),
    note: 'Monthly groceries haul from Imtiaz Super Store',
    category: 'Food & Groceries',
    subCategory: 'Groceries',
    walletId: 'wallet-bank',
    paymentMethod: 'Debit Card',
    isRecurring: false
  });

  // Dining Out
  const tDining = new Date();
  tDining.setDate(now.getDate() - 4);
  transactions.push({
    id: 'tx-dining-1',
    type: 'expense',
    amount: 4800,
    currency: 'PKR',
    date: tDining.toISOString(),
    note: 'Family Dinner at Kababjees',
    category: 'Dining Out',
    walletId: 'wallet-credit',
    paymentMethod: 'Credit Card',
    isRecurring: false
  });

  // Fuel / transport
  const tTrans1 = new Date();
  tTrans1.setDate(now.getDate() - 3);
  transactions.push({
    id: 'tx-trans-1',
    type: 'expense',
    amount: 6500,
    currency: 'PKR',
    date: tTrans1.toISOString(),
    note: 'Car Fuel Full Tank Refill',
    category: 'Transport & Fuel',
    subCategory: 'Car Fuel',
    walletId: 'wallet-credit',
    paymentMethod: 'Credit Card',
    isRecurring: false
  });

  // Electricity Bill
  const tUtil1 = new Date();
  tUtil1.setDate(now.getDate() - 12);
  transactions.push({
    id: 'tx-util-1',
    type: 'expense',
    amount: 18400,
    currency: 'PKR',
    date: tUtil1.toISOString(),
    note: 'Monthly KE Electric Bill payment',
    category: 'Utilities (Electricity/Water)',
    subCategory: 'Electricity',
    walletId: 'wallet-bank',
    paymentMethod: 'UPI / Instant Transfer',
    isRecurring: false
  });

  // Netflix Subscription
  const tSub1 = new Date();
  tSub1.setDate(now.getDate() - 1);
  transactions.push({
    id: 'tx-sub-1',
    type: 'expense',
    amount: 1500,
    currency: 'PKR',
    date: tSub1.toISOString(),
    note: 'Netflix Premium Monthly Subscription',
    category: 'Subscriptions',
    walletId: 'wallet-credit',
    paymentMethod: 'Credit Card',
    isRecurring: true,
    recurrence: 'monthly'
  });

  return transactions;
};
