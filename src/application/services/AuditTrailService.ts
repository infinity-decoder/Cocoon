/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { DatabaseService } from '../../infrastructure/database/DatabaseService';
import { sha256Hex } from '../../core/security/cryptoUtils';

export type ActorRole = 'owner' | 'admin' | 'cashier';

export interface AuditEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  actorId: string;
  actorRole: ActorRole;
  sourceEntity: string;
  sourceId: string;
  action: string;
  summary: string;
  detailsJson?: string;
  prevHash?: string | null;
  hash: string;
  timestamp: string;
}

export interface StaffPermission {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  role: ActorRole;
  canPostSales: boolean;
  canViewReports: boolean;
  canEditSettings: boolean;
  canReverseDocuments: boolean;
  canAdjustStock: boolean;
  createdAt: string;
}

export class AuditTrailService {
  private static instance: AuditTrailService;

  public static getInstance(): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService();
    }
    return AuditTrailService.instance;
  }

  /**
   * Sanitizes metadata to ensure secrets, PINs, tokens, and raw keys
   * are NEVER recorded in the audit trail.
   */
  public sanitizeDetails(data: Record<string, any>): string {
    const sensitiveKeys = ['pin', 'pincode', 'password', 'vaultpassword', 'key', 'dek', 'token', 'secret'];
    const sanitized: Record<string, any> = {};

    for (const [k, v] of Object.entries(data)) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        try {
          sanitized[k] = JSON.parse(this.sanitizeDetails(v));
        } catch {
          sanitized[k] = String(v);
        }
      } else {
        sanitized[k] = v;
      }
    }

    return JSON.stringify(sanitized);
  }

  /**
   * Appends an immutable audit event to the tamper-evident hash chain.
   */
  public async logEvent(
    conn: DatabaseConnection,
    eventData: {
      workspaceId: string;
      eventType: string;
      actorId?: string;
      actorRole?: ActorRole;
      sourceEntity: string;
      sourceId: string;
      action: string;
      summary: string;
      details?: Record<string, any>;
    }
  ): Promise<AuditEvent> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const actorId = eventData.actorId || 'actor_owner';
    const actorRole = eventData.actorRole || 'owner';
    const detailsJson = eventData.details ? this.sanitizeDetails(eventData.details) : '{}';

    // Retrieve previous event hash for this workspace
    let prevHash = 'GENESIS';
    try {
      const prevRows = await conn.query<{ hash: string }>(
        'SELECT hash FROM audit_events WHERE workspace_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1',
        [eventData.workspaceId]
      );
      if (prevRows.length > 0 && prevRows[0].hash) {
        prevHash = prevRows[0].hash;
      }
    } catch {
      // Table may be empty
    }

    // Compute cryptographic SHA-256 hash chaining
    const payloadToHash = `${prevHash}:${id}:${eventData.workspaceId}:${eventData.eventType}:${actorId}:${eventData.sourceEntity}:${eventData.sourceId}:${eventData.action}:${eventData.summary}:${detailsJson}:${timestamp}`;
    const hash = await sha256Hex(payloadToHash);

    await conn.run(
      `INSERT INTO audit_events (
        id, workspace_id, event_type, actor_id, actor_role, source_entity,
        source_id, entity_type, entity_id, action, summary, details_json, metadata, prev_hash, hash, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        eventData.workspaceId,
        eventData.eventType,
        actorId,
        actorRole,
        eventData.sourceEntity,
        eventData.sourceId,
        eventData.sourceEntity,
        eventData.sourceId,
        eventData.action,
        eventData.summary,
        detailsJson,
        detailsJson,
        prevHash,
        hash,
        timestamp
      ]
    );

    return {
      id,
      workspaceId: eventData.workspaceId,
      eventType: eventData.eventType,
      actorId,
      actorRole,
      sourceEntity: eventData.sourceEntity,
      sourceId: eventData.sourceId,
      action: eventData.action,
      summary: eventData.summary,
      detailsJson,
      prevHash,
      hash,
      timestamp
    };
  }

  /**
   * Verifies the tamper-evident hash chain for a workspace.
   * If any event record was modified, deleted, or inserted externally, returns valid = false.
   */
  public async verifyChain(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<{ valid: boolean; brokenAtEventId?: string; totalEvents: number }> {
    const rows = await conn.query<{
      id: string;
      workspace_id: string;
      event_type: string;
      actor_id: string;
      actor_role: ActorRole;
      source_entity: string;
      source_id: string;
      action: string;
      summary: string;
      details_json: string;
      prev_hash: string | null;
      hash: string;
      timestamp: string;
    }>(
      'SELECT * FROM audit_events WHERE workspace_id = ? ORDER BY timestamp ASC, id ASC',
      [workspaceId]
    );

    let expectedPrevHash = 'GENESIS';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // 1. Verify prev_hash matches preceding event's hash
      if (row.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          brokenAtEventId: row.id,
          totalEvents: rows.length
        };
      }

      // 2. Recompute hash
      const payloadToHash = `${row.prev_hash}:${row.id}:${row.workspace_id}:${row.event_type}:${row.actor_id}:${row.source_entity}:${row.source_id}:${row.action}:${row.summary}:${row.details_json}:${row.timestamp}`;
      const recomputedHash = await sha256Hex(payloadToHash);

      if (recomputedHash !== row.hash) {
        return {
          valid: false,
          brokenAtEventId: row.id,
          totalEvents: rows.length
        };
      }

      expectedPrevHash = row.hash;
    }

    return {
      valid: true,
      totalEvents: rows.length
    };
  }

  /**
   * Role-Based Access Control (RBAC) permission evaluation.
   */
  public canPerformAction(
    role: ActorRole,
    action: 'POST_SALE' | 'VIEW_REPORTS' | 'EDIT_SETTINGS' | 'REVERSE_DOCUMENT' | 'ADJUST_STOCK'
  ): boolean {
    if (role === 'owner') return true;
    if (role === 'admin') {
      return action !== 'EDIT_SETTINGS'; // Only owner can edit root security settings
    }
    if (role === 'cashier') {
      return action === 'POST_SALE' || action === 'VIEW_REPORTS';
    }
    return false;
  }
}

export const auditTrailService = AuditTrailService.getInstance();
