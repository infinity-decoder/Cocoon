/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../types';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { BusinessType } from '../../../domain/businesses/Business';

export interface BusinessProfileRecord {
  id: string;
  workspaceId: string;
  businessType: BusinessType;
  legalName?: string | null;
  taxIdentifier?: string | null;
  registrationNumber?: string | null;
  logoUrl?: string | null;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  settingsJson: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export class BusinessProfileRepository {
  constructor(private conn: DatabaseConnection) {}

  public async findByWorkspaceId(workspaceId: string): Promise<BusinessProfileRecord | null> {
    const rows = await this.conn.query<{
      id: string;
      workspace_id: string;
      business_type: BusinessType;
      legal_name: string | null;
      tax_identifier: string | null;
      registration_number: string | null;
      logo_url: string | null;
      invoice_prefix: string;
      next_invoice_sequence: number;
      settings_json: string;
      is_archived: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, workspace_id, business_type, legal_name, tax_identifier, registration_number,
              logo_url, invoice_prefix, next_invoice_sequence, settings_json, is_archived, created_at, updated_at
       FROM business_profiles WHERE workspace_id = ? LIMIT 1`,
      [workspaceId]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      businessType: r.business_type,
      legalName: r.legal_name,
      taxIdentifier: r.tax_identifier,
      registrationNumber: r.registration_number,
      logoUrl: r.logo_url,
      invoicePrefix: r.invoice_prefix,
      nextInvoiceSequence: Number(r.next_invoice_sequence),
      settingsJson: r.settings_json,
      isArchived: Boolean(r.is_archived),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async create(record: Omit<BusinessProfileRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<BusinessProfileRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateEntityId('bp');
    const created: BusinessProfileRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.conn.run(
      `INSERT INTO business_profiles (
        id, workspace_id, business_type, legal_name, tax_identifier, registration_number,
        logo_url, invoice_prefix, next_invoice_sequence, settings_json, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.workspaceId,
        created.businessType,
        created.legalName || null,
        created.taxIdentifier || null,
        created.registrationNumber || null,
        created.logoUrl || null,
        created.invoicePrefix,
        created.nextInvoiceSequence,
        created.settingsJson || '{}',
        created.isArchived ? 1 : 0,
        created.createdAt,
        created.updatedAt
      ]
    );

    return created;
  }

  public async update(workspaceId: string, updates: Partial<BusinessProfileRecord>): Promise<BusinessProfileRecord> {
    const existing = await this.findByWorkspaceId(workspaceId);
    if (!existing) {
      throw new Error(`Business profile for workspace ${workspaceId} not found.`);
    }

    const updated: BusinessProfileRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.conn.run(
      `UPDATE business_profiles SET
        business_type = ?, legal_name = ?, tax_identifier = ?, registration_number = ?,
        logo_url = ?, invoice_prefix = ?, next_invoice_sequence = ?, settings_json = ?,
        is_archived = ?, updated_at = ?
       WHERE workspace_id = ?`,
      [
        updated.businessType,
        updated.legalName || null,
        updated.taxIdentifier || null,
        updated.registrationNumber || null,
        updated.logoUrl || null,
        updated.invoicePrefix,
        updated.nextInvoiceSequence,
        updated.settingsJson,
        updated.isArchived ? 1 : 0,
        updated.updatedAt,
        workspaceId
      ]
    );

    return updated;
  }
}
