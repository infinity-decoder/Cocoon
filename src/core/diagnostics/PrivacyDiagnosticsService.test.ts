/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrivacyDiagnosticsService } from './PrivacyDiagnosticsService';

describe('Core: Privacy-Conscious Diagnostics Service', () => {
  let diag: PrivacyDiagnosticsService;

  beforeEach(() => {
    PrivacyDiagnosticsService.resetInstance();
    diag = PrivacyDiagnosticsService.getInstance();
    diag.clearBuffer();
  });

  it('redacts sensitive personal and financial data in string sanitization', () => {
    const sensitiveInput = 'Customer Ahmed Khan (ahmed@example.com, +92-300-1234567) paid PKR 150,000.00 for Invoice INV-1002 using pin="9988" and key=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const sanitized = PrivacyDiagnosticsService.sanitizeString(sensitiveInput);

    assert.doesNotMatch(sanitized, /ahmed@example\.com/);
    assert.doesNotMatch(sanitized, /\+92-300-1234567/);
    assert.doesNotMatch(sanitized, /PKR\s*150,000\.00/);
    assert.doesNotMatch(sanitized, /pin="9988"/);
    assert.doesNotMatch(sanitized, /a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2/);

    assert.match(sanitized, /\[EMAIL_REDACTED\]/);
    assert.match(sanitized, /\[PHONE_REDACTED\]/);
    assert.match(sanitized, /\[AMOUNT_REDACTED\]/);
    assert.match(sanitized, /\[SECRET_REDACTED\]/);
    assert.match(sanitized, /\[KEY_REDACTED\]/);
  });

  it('tracks operational migration events without exposing schema contents', () => {
    diag.recordMigration(10, 'success', 42.5);
    diag.recordMigration(11, 'failure', 15.2, 'ERR_SQLITE_CONSTRAINT');

    const events = diag.getRecentEvents();
    assert.equal(events.length, 2);

    assert.equal(events[0].eventType, 'MIGRATION_EXECUTION');
    assert.equal(events[0].status, 'success');
    assert.equal(events[0].metadata?.migrationVersion, 10);
    assert.equal(events[0].code, 'OK');

    assert.equal(events[1].eventType, 'MIGRATION_EXECUTION');
    assert.equal(events[1].status, 'failure');
    assert.equal(events[1].metadata?.migrationVersion, 11);
    assert.equal(events[1].code, 'ERR_SQLITE_CONSTRAINT');
  });

  it('tracks backup operations with size and format version but zero row contents', () => {
    diag.recordBackupOperation('export', 'success', 128, 524288, '3.0.0');
    diag.recordBackupOperation('restore', 'failure', 64, undefined, '2.0.0');

    const events = diag.getRecentEvents();
    assert.equal(events.length, 2);

    assert.equal(events[0].eventType, 'BACKUP_OPERATION');
    assert.equal(events[0].metadata?.action, 'export');
    assert.equal(events[0].metadata?.formatVersion, '3.0.0');
    assert.equal(events[0].metadata?.archiveSizeKb, 512);

    // Verify no financial descriptions or party details exist in the metadata
    assert.equal(events[0].metadata?.customer, undefined);
    assert.equal(events[0].metadata?.amount, undefined);
  });

  it('records slow operations that exceed defined latency thresholds', () => {
    diag.recordSlowOperation('SELECT_LEDGER_ENTRIES', 215, 150);
    // Fast operation under threshold should be ignored to avoid spam
    diag.recordSlowOperation('BARCODE_LOOKUP', 1.2, 150);

    const events = diag.getRecentEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'SLOW_OPERATION');
    assert.equal(events[0].durationMs, 215);
    assert.equal(events[0].metadata?.thresholdMs, 150);
    assert.equal(events[0].metadata?.exceededByMs, 65);
  });

  it('generates a redacted crash report containing operational telemetry and scrubbed stack traces', () => {
    const error = new Error('Database transaction failed while processing payment from user@test.com with token="sec_12345"');
    error.name = 'TransactionCommitError';

    const report = diag.generateRedactedCrashReport(error, '1.2.0');

    assert.equal(report.errorName, 'TransactionCommitError');
    assert.doesNotMatch(report.sanitizedMessage, /user@test\.com/);
    assert.doesNotMatch(report.sanitizedMessage, /token="sec_12345"/);
    assert.match(report.sanitizedMessage, /\[EMAIL_REDACTED\]/);
    assert.match(report.sanitizedMessage, /\[SECRET_REDACTED\]/);
    assert.equal(report.appVersion, '1.2.0');
    assert.ok(Array.isArray(report.operationalDiagnostics));
  });
});
