/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiagnosticEventType =
  | 'MIGRATION_EXECUTION'
  | 'DATABASE_INIT'
  | 'BACKUP_OPERATION'
  | 'SLOW_OPERATION'
  | 'APP_CRASH'
  | 'SECURITY_EVENT';

export interface DiagnosticEvent {
  id: string;
  eventType: DiagnosticEventType;
  timestamp: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  durationMs?: number;
  code?: string;
  category?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SanitizedCrashReport {
  errorName: string;
  sanitizedMessage: string;
  sanitizedStack?: string;
  timestamp: string;
  platform: string;
  appVersion: string;
  operationalDiagnostics: DiagnosticEvent[];
}

export class PrivacyDiagnosticsService {
  private static instance: PrivacyDiagnosticsService | null = null;
  private ringBuffer: DiagnosticEvent[] = [];
  private readonly maxBufferSize = 250;

  private constructor() {}

  public static getInstance(): PrivacyDiagnosticsService {
    if (!PrivacyDiagnosticsService.instance) {
      PrivacyDiagnosticsService.instance = new PrivacyDiagnosticsService();
    }
    return PrivacyDiagnosticsService.instance;
  }

  /**
   * Resets the singleton instance (useful for unit tests).
   */
  public static resetInstance(): void {
    PrivacyDiagnosticsService.instance = null;
  }

  /**
   * Sanitizes text to remove any inadvertent personal or financial data
   * (emails, phone numbers, numeric currency values, passwords, auth tokens).
   */
  public static sanitizeString(text: string): string {
    if (!text) return '';

    return text
      // Redact potential emails
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL_REDACTED]')
      // Redact phone numbers (international, dashes, spaces)
      .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g, '[PHONE_REDACTED]')
      // Redact potential currency amounts (e.g., PKR 50,000.00, $1,200.50, 4500.00)
      .replace(/(?:PKR|USD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d+)?/gi, '[AMOUNT_REDACTED]')
      // Redact high-entropy hex strings (e.g. raw 256-bit encryption keys)
      .replace(/\b[0-9a-fA-F]{32,64}\b/g, '[KEY_REDACTED]')
      // Redact passwords and tokens
      .replace(/(?:password|pin|token|secret|kek|dek)[=:]\s*['"]?[^\s,'"]+/gi, '[SECRET_REDACTED]');
  }

  /**
   * Records a database migration execution event.
   */
  public recordMigration(version: number, status: 'success' | 'failure', durationMs: number, errorCode?: string): void {
    this.addEvent({
      id: this.generateId(),
      eventType: 'MIGRATION_EXECUTION',
      timestamp: new Date().toISOString(),
      status,
      durationMs,
      code: errorCode || (status === 'success' ? 'OK' : 'ERR_MIGRATION_FAILED'),
      metadata: {
        migrationVersion: version,
        isSuccess: status === 'success'
      }
    });
  }

  /**
   * Records a database initialization event.
   */
  public recordDatabaseInit(engine: 'sqlite' | 'memory', status: 'success' | 'failure', durationMs: number, failureCategory?: string): void {
    this.addEvent({
      id: this.generateId(),
      eventType: 'DATABASE_INIT',
      timestamp: new Date().toISOString(),
      status,
      durationMs,
      category: failureCategory,
      metadata: {
        engine,
        isSuccess: status === 'success'
      }
    });
  }

  /**
   * Records a backup or restore lifecycle event (strictly operational metrics, zero financial rows).
   */
  public recordBackupOperation(
    action: 'export' | 'restore' | 'verify',
    status: 'success' | 'failure',
    durationMs: number,
    archiveSizeBytes?: number,
    formatVersion?: string
  ): void {
    this.addEvent({
      id: this.generateId(),
      eventType: 'BACKUP_OPERATION',
      timestamp: new Date().toISOString(),
      status,
      durationMs,
      metadata: {
        action,
        formatVersion: formatVersion || 'unknown',
        archiveSizeKb: archiveSizeBytes ? Math.round(archiveSizeBytes / 1024) : 0,
        isSuccess: status === 'success'
      }
    });
  }

  /**
   * Records slow queries or long operations exceeding target thresholds.
   */
  public recordSlowOperation(operationTag: string, durationMs: number, thresholdMs = 150): void {
    if (durationMs < thresholdMs) return;

    this.addEvent({
      id: this.generateId(),
      eventType: 'SLOW_OPERATION',
      timestamp: new Date().toISOString(),
      status: 'warning',
      durationMs,
      category: PrivacyDiagnosticsService.sanitizeString(operationTag),
      metadata: {
        thresholdMs,
        exceededByMs: Math.round(durationMs - thresholdMs)
      }
    });
  }

  /**
   * Generates a user-consented, fully redacted crash report safe for review.
   */
  public generateRedactedCrashReport(error: Error | any, appVersion = '1.0.0'): SanitizedCrashReport {
    const rawMessage = error?.message || String(error);
    const rawStack = error?.stack || '';

    const sanitizedMessage = PrivacyDiagnosticsService.sanitizeString(rawMessage);
    const sanitizedStack = PrivacyDiagnosticsService.sanitizeString(rawStack);

    const report: SanitizedCrashReport = {
      errorName: error?.name || 'Error',
      sanitizedMessage,
      sanitizedStack: sanitizedStack ? sanitizedStack.slice(0, 2000) : undefined,
      timestamp: new Date().toISOString(),
      platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js/Android',
      appVersion,
      operationalDiagnostics: this.getRecentEvents(30)
    };

    this.addEvent({
      id: this.generateId(),
      eventType: 'APP_CRASH',
      timestamp: report.timestamp,
      status: 'failure',
      category: report.errorName,
      code: 'APP_CRASH_CAPTURED'
    });

    return report;
  }

  /**
   * Retrieves recent sanitized diagnostic events from the local buffer.
   */
  public getRecentEvents(count = 50): DiagnosticEvent[] {
    return this.ringBuffer.slice(-count);
  }

  /**
   * Clears in-memory diagnostics buffer.
   */
  public clearBuffer(): void {
    this.ringBuffer = [];
  }

  private addEvent(event: DiagnosticEvent): void {
    this.ringBuffer.push(event);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
  }

  private generateId(): string {
    return `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}
