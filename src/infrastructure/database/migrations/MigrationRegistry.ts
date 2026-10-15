/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Migration } from './types';
import { migration001 } from './001_initial_personal_finance';
import { migration002 } from './002_business_workspaces_ledger_parties';

/**
 * Immutable, ordered registry of database migrations.
 * Migrations must never be modified or removed once released;
 * subsequent changes must be introduced via new migrations.
 */
export const MIGRATION_REGISTRY: readonly Migration[] = Object.freeze([
  migration001,
  migration002
]);

export function getMigrationByVersion(version: number): Migration | undefined {
  return MIGRATION_REGISTRY.find(m => m.version === version);
}

export function getLatestMigrationVersion(): number {
  if (MIGRATION_REGISTRY.length === 0) return 0;
  return MIGRATION_REGISTRY[MIGRATION_REGISTRY.length - 1].version;
}
