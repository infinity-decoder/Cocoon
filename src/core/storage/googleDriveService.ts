/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from '../types';
import { exportBackupAsJson, importBackupFromJson } from './backupService';

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

/**
 * Uploads local-first database file to Google Drive
 */
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

/**
 * Restores database backup file from Google Drive
 */
export async function downloadFromGoogleDrive(accessToken: string): Promise<AppState> {
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
  return importBackupFromJson(backupText);
}
