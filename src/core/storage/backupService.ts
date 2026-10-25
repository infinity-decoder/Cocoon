/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from '../types';
import { isEncryptedBackup } from '../security/backupCrypto';

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
 * Validates and restores AppState from an imported JSON file string.
 * Supports legacy v1.0.0, intermediate v2.0.0, and modern v3.0.0 bundle payloads.
 */
export function importBackupFromJson(jsonString: string): AppState {
  if (isEncryptedBackup(jsonString)) {
    throw new Error('This backup is encrypted with AES-256-GCM. Please use the secure restore dialog with your passphrase.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format. Please select a valid .json file.');
  }

  // Handle modern v2/v3 bundle
  if (parsed.manifest && parsed.state) {
    return parsed.state as AppState;
  }

  // Handle legacy v1.0.0 format
  if (
    !parsed || 
    typeof parsed !== 'object' || 
    !('data' in parsed) ||
    !parsed.data
  ) {
    throw new Error('Invalid backup file. Must be a valid Cocoon backup.');
  }

  const typedParsed = parsed as { appName?: string; data: AppState };
  if (typedParsed.appName !== 'Cocoon' && typedParsed.appName !== 'FinFlow Tracker') {
    throw new Error('Invalid backup file. Must be a valid Cocoon backup.');
  }

  return typedParsed.data;
}
