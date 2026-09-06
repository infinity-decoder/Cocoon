/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, Category, Wallet, Budget, SavingsGoal, BillReminder, AppSettings } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, DEFAULT_WALLETS, DEFAULT_SAVINGS_GOALS, DEFAULT_REMINDERS, DEFAULT_SETTINGS, generateDummyTransactions } from './constants';

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  subCategories: Category[];
  wallets: Wallet[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  reminders: BillReminder[];
  settings: AppSettings;
}

const STORAGE_KEY = 'finflow_app_state';

export function getInitialState(): AppState {
  return {
    transactions: generateDummyTransactions(),
    categories: DEFAULT_CATEGORIES,
    subCategories: DEFAULT_SUBCATEGORIES,
    wallets: DEFAULT_WALLETS,
    budgets: [
      { id: 'b-food', categoryId: 'exp-food', amount: 500, month: '2026-07', rollover: true },
      { id: 'b-transport', categoryId: 'exp-transport', amount: 200, month: '2026-07', rollover: false },
      { id: 'b-shop', categoryId: 'exp-shopping', amount: 300, month: '2026-07', rollover: false }
    ],
    savingsGoals: DEFAULT_SAVINGS_GOALS,
    reminders: DEFAULT_REMINDERS,
    settings: DEFAULT_SETTINGS
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      saveAppState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    
    // Validate schema loosely or fill in missing fields
    return {
      transactions: parsed.transactions || [],
      categories: parsed.categories || DEFAULT_CATEGORIES,
      subCategories: parsed.subCategories || DEFAULT_SUBCATEGORIES,
      wallets: parsed.wallets || DEFAULT_WALLETS,
      budgets: parsed.budgets || [],
      savingsGoals: parsed.savingsGoals || [],
      reminders: parsed.reminders || [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings }
    };
  } catch (error) {
    console.error('Failed to load local app state:', error);
    return getInitialState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save local app state:', error);
  }
}

// Generate the local backup file
export function exportBackupAsJson(state: AppState): string {
  // Wrap state with backup metadata
  const backup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    appName: 'Cocoon',
    data: state
  };
  return JSON.stringify(backup, null, 2);
}

// Import and validate from json string
export function importBackupFromJson(jsonString: string): AppState {
  const parsed = JSON.parse(jsonString);
  if (!parsed || (parsed.appName !== 'Cocoon' && parsed.appName !== 'FinFlow Tracker') || !parsed.data) {
    throw new Error('Invalid backup file. Must be a valid Cocoon or FinFlow backup.');
  }
  return parsed.data;
}

// Helper: Make a multipart boundary body for Google Drive upload
function createMultipartBody(metadata: object, content: string, boundary: string): string {
  return (
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  );
}

// Upload local-first database file to Google Drive
export async function uploadToGoogleDrive(state: AppState, accessToken: string): Promise<string> {
  const backupJson = exportBackupAsJson(state);
  const boundary = 'foo_bar_boundary';
  
  const metadata = {
    name: 'cocoon_backup.json',
    mimeType: 'application/json',
    description: 'Encrypted local-first database backup for Cocoon personal finance tracker by Infinity Decoder'
  };

  const body = createMultipartBody(metadata, backupJson, boundary);

  // Search for existing file first to replace/overwrite it
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=(name='cocoon_backup.json' or name='finflow_backup.json')+and+trashed=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  const listData = await listRes.json();
  const existingFile = listData.files && listData.files[0];
  
  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';
  
  if (existingFile) {
    // Update existing file instead of duplicating
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = 'PATCH';
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const result = await res.json();
  return result.id || 'success';
}

// Restore database backup file from Google Drive
export async function downloadFromGoogleDrive(accessToken: string): Promise<AppState> {
  // Search for the file in drive (look for cocoon_backup.json first, fallback to finflow_backup.json)
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=(name='cocoon_backup.json' or name='finflow_backup.json')+and+trashed=false&fields=files(id,name,modifiedTime)&orderBy=name desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!searchRes.ok) {
    throw new Error('Failed to query files in Google Drive.');
  }

  const searchData = await searchRes.json();
  const files = searchData.files || [];
  if (files.length === 0) {
    throw new Error('No Cocoon backup file (cocoon_backup.json) found in your Google Drive. Please make a backup first.');
  }

  // Get file content
  const fileId = files[0].id;
  const contentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!contentRes.ok) {
    throw new Error('Failed to download backup file content from Google Drive.');
  }

  const backupText = await contentRes.text();
  const state = importBackupFromJson(backupText);
  return state;
}
