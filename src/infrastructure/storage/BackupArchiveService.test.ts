/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backupArchiveService } from './BackupArchiveService';
import { attachmentStorage } from './AttachmentStorageService';
import { AppState } from '../../core/types';

describe('Infrastructure: BackupArchiveService', () => {
  it('bundles SQLite state and relative attachments into a verifiable backup archive', async () => {
    // 1. Save an attachment using AttachmentStorageService
    const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const relPath = await attachmentStorage.saveAttachment(fakeBase64, 'invoices', 'test_inv_01.png');
    assert.ok(relPath.startsWith('attachments/invoices/'));

    // 2. Prepare sample AppState referencing this attachment
    const sampleState: AppState = {
      transactions: [
        {
          id: 'tx-att-1',
          type: 'expense',
          amount: 250,
          currency: 'PKR',
          date: '2026-10-12T10:00:00Z',
          note: 'Office Supplies',
          category: 'Office',
          walletId: 'w-cash',
          paymentMethod: 'Cash',
          attachment: relPath,
          isRecurring: false
        }
      ],
      categories: [],
      subCategories: [],
      wallets: [
        { id: 'w-cash', name: 'Cash Register', type: 'cash', balance: 5000, color: '#10B981' }
      ],
      budgets: [],
      savingsGoals: [],
      reminders: [],
      settings: {
        currencySymbol: '₨',
        currencyCode: 'PKR',
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

    // 3. Export archive
    const archiveJson = await backupArchiveService.exportFullBackupArchive(sampleState);
    assert.ok(archiveJson);

    const parsed = JSON.parse(archiveJson);
    assert.equal(parsed.manifest.appName, 'Cocoon');
    assert.equal(parsed.manifest.archiveFormatVersion, '2.0.0');
    assert.ok(parsed.manifest.attachmentCount >= 1);
    assert.ok(parsed.attachments[relPath]);

    // 4. Import archive and verify restoration
    const restored = await backupArchiveService.importBackupArchive(archiveJson);
    assert.equal(restored.state.transactions.length, 1);
    assert.equal(restored.state.transactions[0].id, 'tx-att-1');
    assert.equal(restored.state.transactions[0].attachment, relPath);
    assert.ok(restored.attachmentsRestored >= 1);

    // 5. Verify restored attachment is readable
    const readBack = await attachmentStorage.readAttachment(relPath);
    assert.ok(readBack);
    assert.ok(readBack.includes('data:image/png;base64,'));
  });

  it('maintains backwards compatibility with legacy v1.0.0 JSON backups', async () => {
    const legacyBackup = JSON.stringify({
      version: '1.0.0',
      exportedAt: '2026-09-01T00:00:00Z',
      appName: 'Cocoon',
      data: {
        transactions: [],
        categories: [],
        subCategories: [],
        wallets: [],
        budgets: [],
        savingsGoals: [],
        reminders: [],
        settings: {}
      }
    });

    const result = await backupArchiveService.importBackupArchive(legacyBackup);
    assert.equal(result.archiveVersion, '1.0.0');
    assert.equal(result.attachmentsRestored, 0);
    assert.ok(result.state);
  });
});
