/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';

export interface Migration {
  version: number;
  name: string;
  description?: string;
  up(conn: DatabaseConnection): Promise<void>;
  down?(conn: DatabaseConnection): Promise<void>;
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}

export interface MigrationExecutionResult {
  success: boolean;
  version: number;
  name: string;
  durationMs: number;
  error?: string;
}

export interface MigrationSummary {
  appliedCount: number;
  latestVersion: number;
  results: MigrationExecutionResult[];
}
