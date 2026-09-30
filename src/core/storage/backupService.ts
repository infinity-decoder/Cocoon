/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from '../types';

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  appName: string;
  data: AppState;
}

/**
 * Generate formatted JSON backup string of user financial state
 */
export function exportBackupAsJson(state: AppState): string {
  const backup: BackupMetadata = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    appName: 'Cocoon',
    data: state
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and restores AppState from an imported JSON file string
 */
export function importBackupFromJson(jsonString: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format. Please select a valid .json file.');
  }

  if (
    !parsed || 
    typeof parsed !== 'object' || 
    !('data' in parsed) ||
    !parsed.data
  ) {
    throw new Error('Invalid backup file. Must be a valid Cocoon or FinFlow backup.');
  }

  const typedParsed = parsed as { appName?: string; data: AppState };
  if (typedParsed.appName !== 'Cocoon' && typedParsed.appName !== 'FinFlow Tracker') {
    throw new Error('Invalid backup file. Must be a valid Cocoon or FinFlow backup.');
  }

  return typedParsed.data;
}
