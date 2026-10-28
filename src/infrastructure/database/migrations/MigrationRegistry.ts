/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Migration } from './types';
import { migration001 } from './001_initial_personal_finance';
import { migration002 } from './002_business_workspaces_ledger_parties';
import { migration003 } from './003_business_workspaces_and_isolation';
import { migration004 } from './004_parties_khata_payments_allocations';
import { migration005 } from './005_accounting_core_and_linked_transfers';
import { migration006 } from './006_product_catalog_and_inventory_domain';
import { migration007 } from './007_purchases_orders_receipts_bills';
import { migration008 } from './008_sales_pos_returns_idempotency';
import { migration009 } from './009_security_audit_trail_and_actor_permissions';
import { migration010 } from './010_high_volume_indexing_and_keyset';

/**
 * Immutable, ordered registry of database migrations.
 * Migrations must never be modified or removed once released;
 * subsequent changes must be introduced via new migrations.
 */
export const MIGRATION_REGISTRY: readonly Migration[] = Object.freeze([
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010
]);

export function getMigrationByVersion(version: number): Migration | undefined {
  return MIGRATION_REGISTRY.find(m => m.version === version);
}

export function getLatestMigrationVersion(): number {
  if (MIGRATION_REGISTRY.length === 0) return 0;
  return MIGRATION_REGISTRY[MIGRATION_REGISTRY.length - 1].version;
}
