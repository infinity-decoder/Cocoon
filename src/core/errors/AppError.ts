/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'ENTITY_NOT_FOUND'
  | 'DUPLICATE_ENTITY'
  | 'DATABASE_ERROR'
  | 'MIGRATION_ERROR'
  | 'BACKUP_CORRUPTED'
  | 'BACKUP_CHECKSUM_MISMATCH'
  | 'UNAUTHORIZED_ACCESS'
  | 'INSUFFICIENT_FUNDS'
  | 'WORKSPACE_MISMATCH'
  | 'UNEXPECTED_ERROR';

export interface AppErrorDetails {
  field?: string;
  expected?: unknown;
  actual?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: AppErrorDetails;
  public readonly timestamp: string;

  constructor(code: AppErrorCode, message: string, details?: AppErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  public static validation(message: string, details?: AppErrorDetails): AppError {
    return new AppError('VALIDATION_FAILED', message, details);
  }

  public static notFound(entity: string, id: string): AppError {
    return new AppError('ENTITY_NOT_FOUND', `${entity} with ID "${id}" was not found.`, { field: 'id', actual: id });
  }

  public static database(message: string, context?: Record<string, unknown>): AppError {
    return new AppError('DATABASE_ERROR', message, { context });
  }

  public static backup(message: string, details?: AppErrorDetails): AppError {
    return new AppError('BACKUP_CORRUPTED', message, details);
  }
}

/**
 * Result wrapper for railway-oriented error handling across services
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function Ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function Err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}
