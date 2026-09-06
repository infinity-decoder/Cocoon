/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'income' | 'expense' | 'transfer' | 'savings_deposit' | 'savings_withdraw';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string; // ISO format: YYYY-MM-DDTHH:mm:ss
  note: string;
  category: string; // Category name or ID
  subCategory?: string; // Optional sub-category name
  walletId: string; // Source wallet
  toWalletId?: string; // Destination wallet (for transfers)
  paymentMethod: string; // Cash, Credit Card, UPI, etc.
  attachment?: string; // base64 or object URL of a photo
  isRecurring: boolean;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  savingsGoalId?: string; // Associated savings goal (for savings transfers)
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string; // Lucide icon name
  color: string; // Hex color code or tailwind color class
  parentId?: string | null; // For sub-categories
  isCustom: boolean;
  isEnabled: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'savings';
  balance: number;
  color: string; // Tailwind color class or hex
}

export interface Budget {
  id: string;
  categoryId: string; // Category ID
  amount: number;
  month: string; // YYYY-MM format
  rollover: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  deadline?: string;
}

export interface BillReminder {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  categoryId: string;
  isPaid: boolean;
  recurrence: 'monthly' | 'one-time';
}

export type BackupSchedule = 'daily' | 'weekly' | 'monthly' | 'none';

export interface AppSettings {
  currencySymbol: string;
  currencyCode: string;
  currencyFormat: 'symbol-amount' | 'amount-symbol';
  decimalPlaces: number;
  firstDayOfWeek: 'monday' | 'sunday';
  pinCode?: string; // Local security PIN
  biometricsEnabled: boolean;
  accentColor: string; // Hex color code
  themeMode: 'light' | 'dark' | 'system';
  backupSchedule: BackupSchedule;
  isFirstTime: boolean;
  vaultPassword?: string; // Persistent passcode for savings vault
}
