/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { Migration } from './types';

export const migration009: Migration = {
  version: 9,
  name: '009_security_audit_trail_and_actor_permissions',
  description: 'Cryptographic audit trail with hash chaining, immutable security event logging, and actor role-based permissions (RBAC).',
  async up(conn: DatabaseConnection): Promise<void> {
    // 1. Immutable Application-Level Audit Trail Table (Upgrade from Migration 002 if present)
    const tableInfo = await conn.query<{ name: string }>(`PRAGMA table_info(audit_events)`);
    if (tableInfo.length === 0) {
      await conn.execute(`
        CREATE TABLE audit_events (
          id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL DEFAULT 'SYSTEM_EVENT',
          actor_id TEXT NOT NULL DEFAULT 'system',
          actor_role TEXT NOT NULL DEFAULT 'owner' CHECK(actor_role IN ('owner', 'admin', 'cashier')),
          source_entity TEXT NOT NULL DEFAULT '',
          source_id TEXT NOT NULL DEFAULT '',
          entity_type TEXT NOT NULL DEFAULT '',
          entity_id TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          details_json TEXT,
          metadata TEXT,
          prev_hash TEXT,
          hash TEXT NOT NULL DEFAULT '',
          timestamp TEXT NOT NULL
        );
      `);
    } else {
      const existingCols = tableInfo.map(c => c.name);
      const colsToAdd: [string, string][] = [
        ['event_type', "TEXT NOT NULL DEFAULT 'SYSTEM_EVENT'"],
        ['actor_id', "TEXT NOT NULL DEFAULT 'system'"],
        ['actor_role', "TEXT NOT NULL DEFAULT 'owner'"],
        ['source_entity', "TEXT NOT NULL DEFAULT ''"],
        ['source_id', "TEXT NOT NULL DEFAULT ''"],
        ['summary', "TEXT NOT NULL DEFAULT ''"],
        ['details_json', "TEXT"],
        ['prev_hash', "TEXT"],
        ['hash', "TEXT NOT NULL DEFAULT ''"]
      ];

      for (const [col, colDef] of colsToAdd) {
        if (!existingCols.includes(col)) {
          await conn.execute(`ALTER TABLE audit_events ADD COLUMN ${col} ${colDef};`);
        }
      }

      if (existingCols.includes('entity_type')) {
        await conn.execute(`UPDATE audit_events SET source_entity = entity_type WHERE source_entity = '' OR source_entity IS NULL;`);
      }
      if (existingCols.includes('entity_id')) {
        await conn.execute(`UPDATE audit_events SET source_id = entity_id WHERE source_id = '' OR source_id IS NULL;`);
      }
      if (existingCols.includes('metadata')) {
        await conn.execute(`UPDATE audit_events SET details_json = metadata WHERE details_json IS NULL;`);
      }
      if (existingCols.includes('action')) {
        await conn.execute(`UPDATE audit_events SET summary = action WHERE summary = '' OR summary IS NULL;`);
      }
    }

    await conn.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_events_ws_time ON audit_events(workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_events_source ON audit_events(source_entity, source_id);
    `);

    // 2. Multi-Actor & Staff Role Permissions (RBAC) Table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS staff_permissions (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'cashier')),
        can_post_sales INTEGER NOT NULL DEFAULT 1,
        can_view_reports INTEGER NOT NULL DEFAULT 1,
        can_edit_settings INTEGER NOT NULL DEFAULT 0,
        can_reverse_documents INTEGER NOT NULL DEFAULT 0,
        can_adjust_stock INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id, actor_id)
      );

      CREATE INDEX IF NOT EXISTS idx_staff_permissions_ws ON staff_permissions(workspace_id);
    `);
  }
};
