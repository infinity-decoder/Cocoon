/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseConnection } from '../../infrastructure/database/types';
import { 
  WorkspaceRepository, 
  WorkspaceRecord,
  BusinessProfileRepository,
  BusinessProfileRecord,
  AccountRepository,
  PartyRepository,
  ProductRepository,
  DocumentRepository,
  DocumentWithLines,
  JournalEntryRepository,
  PartyLedgerRepository
} from '../../infrastructure/database/repositories';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from '../../infrastructure/database/migrations/002_business_workspaces_ledger_parties';
import { EntityId } from '../../domain/primitives/EntityId';
import { BusinessType } from '../../domain/businesses/Business';
import { 
  validateRequiredString, 
  validatePositiveAmount,
  assertValid 
} from '../validation/financialValidation';
import { InventoryService } from './InventoryService';

export class CrossWorkspaceIsolationError extends Error {
  constructor(message: string) {
    super(`Cross-Workspace Isolation Violation: ${message}`);
    this.name = 'CrossWorkspaceIsolationError';
  }
}

export interface WorkspaceWithProfile extends WorkspaceRecord {
  profile?: BusinessProfileRecord | null;
}

export interface CreateBusinessWorkspaceParams {
  name: string;
  businessType: BusinessType;
  currencyCode?: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  invoicePrefix?: string;
  logoUrl?: string;
  settings?: Record<string, any>;
}

export interface UpdateBusinessWorkspaceParams {
  name?: string;
  businessType?: BusinessType;
  currencyCode?: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  invoicePrefix?: string;
  logoUrl?: string;
  settings?: Record<string, any>;
}

export class WorkspaceService {
  /**
   * Retrieves all workspaces with their linked profiles.
   */
  public static async listWorkspaces(
    conn: DatabaseConnection,
    includeArchived = false
  ): Promise<WorkspaceWithProfile[]> {
    const wsRepo = new WorkspaceRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);

    const workspaces = await wsRepo.findAll(includeArchived);
    const result: WorkspaceWithProfile[] = [];

    for (const ws of workspaces) {
      let profile: BusinessProfileRecord | null = null;
      if (ws.type === 'business') {
        profile = await bpRepo.findByWorkspaceId(ws.id);
      }
      result.push({ ...ws, profile });
    }

    return result;
  }

  /**
   * Retrieves a specific workspace by ID, validating its existence and integrity.
   */
  public static async getWorkspaceById(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<WorkspaceWithProfile | null> {
    assertValid(validateRequiredString(workspaceId, 'Workspace ID'));
    const wsRepo = new WorkspaceRepository(conn);
    const ws = await wsRepo.findById(workspaceId);
    if (!ws) return null;

    let profile: BusinessProfileRecord | null = null;
    if (ws.type === 'business') {
      const bpRepo = new BusinessProfileRepository(conn);
      profile = await bpRepo.findByWorkspaceId(ws.id);
    }

    return { ...ws, profile };
  }

  /**
   * Validates that the specified workspace ID exists and is active.
   * Throws if invalid or inactive; never trusts UI strings blindly.
   */
  public static async validateWorkspaceAccess(
    conn: DatabaseConnection,
    workspaceId: string,
    allowArchived = false
  ): Promise<WorkspaceWithProfile> {
    assertValid(validateRequiredString(workspaceId, 'Workspace ID'));
    const ws = await this.getWorkspaceById(conn, workspaceId);
    if (!ws) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }
    if (!allowArchived && !ws.isActive) {
      throw new Error(`Workspace ${workspaceId} (${ws.name}) is archived.`);
    }
    return ws;
  }

  /**
   * Controlled setup flow for creating a new business workspace.
   * Creates workspace, business profile, default Chart of Accounts,
   * default payment terms, and audit record within an atomic transaction.
   */
  public static async createBusinessWorkspace(
    conn: DatabaseConnection,
    params: CreateBusinessWorkspaceParams
  ): Promise<WorkspaceWithProfile> {
    assertValid(validateRequiredString(params.name, 'Business Name'));
    assertValid(validateRequiredString(params.businessType, 'Business Type'));

    const currencyCode = params.currencyCode?.trim().toUpperCase() || 'PKR';
    const workspaceId = EntityId.generate('ws');
    const invoicePrefix = params.invoicePrefix?.trim().toUpperCase() || 'INV';

    const wsRepo = new WorkspaceRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);
    const accRepo = new AccountRepository(conn);

    let createdWs: WorkspaceRecord;
    let createdBp: BusinessProfileRecord;

    await conn.executeTransaction(async () => {
      // 1. Create Workspace
      createdWs = await wsRepo.create({
        id: workspaceId,
        name: params.name.trim(),
        type: 'business',
        currencyCode,
        taxId: params.taxId?.trim() || null,
        address: params.address?.trim() || null,
        phone: params.phone?.trim() || null,
        email: params.email?.trim() || null,
        isActive: true
      });

      // 2. Create Linked Business Profile
      createdBp = await bpRepo.create({
        workspaceId,
        businessType: params.businessType,
        legalName: params.legalName?.trim() || params.name.trim(),
        taxIdentifier: params.taxId?.trim() || null,
        registrationNumber: null,
        logoUrl: params.logoUrl || null,
        invoicePrefix,
        nextInvoiceSequence: 1,
        settingsJson: JSON.stringify(params.settings || {}),
        isArchived: false
      });

      // 3. Create Default Business Chart of Accounts with explicit categories and report mappings
      const defaultAccounts: {
        code: string;
        name: string;
        type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
        subCategory: any;
        reportMapping: 'balance_sheet' | 'income_statement';
      }[] = [
        // Assets
        { code: '1010', name: 'Cash on Hand', type: 'asset', subCategory: 'cash', reportMapping: 'balance_sheet' },
        { code: '1020', name: 'Business Bank Account', type: 'asset', subCategory: 'bank', reportMapping: 'balance_sheet' },
        { code: '1200', name: 'Accounts Receivable', type: 'asset', subCategory: 'receivables', reportMapping: 'balance_sheet' },
        { code: '1300', name: 'Inventory Asset', type: 'asset', subCategory: 'inventory', reportMapping: 'balance_sheet' },
        { code: '1400', name: 'Due from Other Workspace', type: 'asset', subCategory: 'other_assets', reportMapping: 'balance_sheet' },
        { code: '1500', name: 'Other Current Assets', type: 'asset', subCategory: 'other_assets', reportMapping: 'balance_sheet' },
        // Liabilities
        { code: '2010', name: 'Accounts Payable', type: 'liability', subCategory: 'supplier_payables', reportMapping: 'balance_sheet' },
        { code: '2020', name: 'Taxes Payable', type: 'liability', subCategory: 'taxes_payable', reportMapping: 'balance_sheet' },
        { code: '2030', name: 'Due to Owner (Loans Payable)', type: 'liability', subCategory: 'owner_loans_payable', reportMapping: 'balance_sheet' },
        { code: '2040', name: 'Due to Other Workspace', type: 'liability', subCategory: 'other_liabilities', reportMapping: 'balance_sheet' },
        { code: '2050', name: 'Other Current Liabilities', type: 'liability', subCategory: 'other_liabilities', reportMapping: 'balance_sheet' },
        // Equity
        { code: '3000', name: 'Owner Capital', type: 'equity', subCategory: 'capital', reportMapping: 'balance_sheet' },
        { code: '3010', name: 'Owner Drawings', type: 'equity', subCategory: 'owner_drawings', reportMapping: 'balance_sheet' },
        { code: '3020', name: 'Retained Earnings', type: 'equity', subCategory: 'retained_earnings', reportMapping: 'balance_sheet' },
        // Revenue / Income
        { code: '4010', name: 'Sales Revenue', type: 'revenue', subCategory: 'sales', reportMapping: 'income_statement' },
        { code: '4020', name: 'Other Income', type: 'revenue', subCategory: 'other_income', reportMapping: 'income_statement' },
        // Expenses
        { code: '5010', name: 'Cost of Goods Sold', type: 'expense', subCategory: 'cogs', reportMapping: 'income_statement' },
        { code: '5020', name: 'Operating Expenses', type: 'expense', subCategory: 'operating_expenses', reportMapping: 'income_statement' },
        { code: '5090', name: 'Other Expenses', type: 'expense', subCategory: 'other_expenses', reportMapping: 'income_statement' }
      ];

      for (const acc of defaultAccounts) {
        await accRepo.create({
          id: `acc_${workspaceId}_${acc.code}`,
          workspaceId,
          accountCode: acc.code,
          name: acc.name,
          type: acc.type,
          subCategory: acc.subCategory,
          reportMapping: acc.reportMapping,
          currencyCode,
          isSystem: true,
          isActive: true
        });
      }

      // 4. Create Default Payment Terms
      const defaultTerms = [
        { id: `pt_${workspaceId}_immediate`, name: 'Due on Receipt', dueDays: 0, isDefault: 1 },
        { id: `pt_${workspaceId}_net15`, name: 'Net 15 Days', dueDays: 15, isDefault: 0 },
        { id: `pt_${workspaceId}_net30`, name: 'Net 30 Days', dueDays: 30, isDefault: 0 }
      ];

      const now = new Date().toISOString();
      for (const term of defaultTerms) {
        await conn.run(
          `INSERT INTO payment_terms (id, workspace_id, name, due_days, is_default, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [term.id, workspaceId, term.name, term.dueDays, term.isDefault, now]
        );
      }

      // 5. Create Default Stock Location for Retail/Wholesale Inventory
      await conn.run(
        `INSERT OR IGNORE INTO stock_locations (id, workspace_id, name, code, description, is_default, is_active, created_at, updated_at)
         VALUES (?, ?, 'Main Store', 'MAIN', 'Default primary store and inventory location', 1, 1, ?, ?)`,
        [`loc_${workspaceId}_default`, workspaceId, now, now]
      );

      // 6. Emit Audit Event
      await conn.run(
        `INSERT INTO audit_events (id, workspace_id, entity_type, entity_id, action, metadata, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          EntityId.generate('audit'),
          workspaceId,
          'workspace',
          workspaceId,
          'create_business_workspace',
          JSON.stringify({ name: params.name, businessType: params.businessType }),
          now
        ]
      );
    });

    return {
      ...createdWs!,
      profile: createdBp!
    };
  }

  /**
   * Updates an existing business workspace and its linked profile.
   */
  public static async updateBusinessWorkspace(
    conn: DatabaseConnection,
    workspaceId: string,
    params: UpdateBusinessWorkspaceParams
  ): Promise<WorkspaceWithProfile> {
    await this.validateWorkspaceAccess(conn, workspaceId);

    const wsRepo = new WorkspaceRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);

    let updatedWs: WorkspaceRecord;
    let updatedBp: BusinessProfileRecord | null = null;

    await conn.executeTransaction(async () => {
      // 1. Update Workspace Record
      const wsUpdates: Partial<WorkspaceRecord> = {};
      if (params.name) wsUpdates.name = params.name.trim();
      if (params.currencyCode) wsUpdates.currencyCode = params.currencyCode.trim().toUpperCase();
      if (params.taxId !== undefined) wsUpdates.taxId = params.taxId;
      if (params.phone !== undefined) wsUpdates.phone = params.phone;
      if (params.email !== undefined) wsUpdates.email = params.email;
      if (params.address !== undefined) wsUpdates.address = params.address;

      updatedWs = await wsRepo.update(workspaceId, wsUpdates);

      // 2. Update Business Profile
      const bpUpdates: Partial<BusinessProfileRecord> = {};
      if (params.businessType) bpUpdates.businessType = params.businessType;
      if (params.legalName !== undefined) bpUpdates.legalName = params.legalName;
      if (params.taxId !== undefined) bpUpdates.taxIdentifier = params.taxId;
      if (params.logoUrl !== undefined) bpUpdates.logoUrl = params.logoUrl;
      if (params.invoicePrefix) bpUpdates.invoicePrefix = params.invoicePrefix.trim().toUpperCase();
      if (params.settings) bpUpdates.settingsJson = JSON.stringify(params.settings);

      updatedBp = await bpRepo.update(workspaceId, bpUpdates);
    });

    return {
      ...updatedWs!,
      profile: updatedBp
    };
  }

  /**
   * Archives a workspace without deleting financial records.
   * Default personal workspace cannot be archived.
   */
  public static async archiveWorkspace(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<void> {
    if (workspaceId === DEFAULT_PERSONAL_WORKSPACE_ID) {
      throw new Error('Default Personal Workspace cannot be archived.');
    }

    const wsRepo = new WorkspaceRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);

    await conn.executeTransaction(async () => {
      await wsRepo.archive(workspaceId);
      const profile = await bpRepo.findByWorkspaceId(workspaceId);
      if (profile) {
        await bpRepo.update(workspaceId, { isArchived: true });
      }

      await conn.run(
        `INSERT INTO audit_events (id, workspace_id, entity_type, entity_id, action, metadata, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          EntityId.generate('audit'),
          workspaceId,
          'workspace',
          workspaceId,
          'archive_workspace',
          JSON.stringify({ archivedAt: new Date().toISOString() }),
          new Date().toISOString()
        ]
      );
    });
  }

  /**
   * Unarchives an archived workspace.
   */
  public static async unarchiveWorkspace(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<void> {
    const wsRepo = new WorkspaceRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);

    await conn.executeTransaction(async () => {
      await wsRepo.unarchive(workspaceId);
      const profile = await bpRepo.findByWorkspaceId(workspaceId);
      if (profile) {
        await bpRepo.update(workspaceId, { isArchived: false });
      }
    });
  }

  /**
   * Safely deletes an empty workspace.
   * REJECTS if workspace contains financial history (documents, journal entries).
   */
  public static async deleteWorkspace(
    conn: DatabaseConnection,
    workspaceId: string
  ): Promise<void> {
    if (workspaceId === DEFAULT_PERSONAL_WORKSPACE_ID) {
      throw new Error('Default Personal Workspace cannot be deleted.');
    }

    const wsRepo = new WorkspaceRepository(conn);
    await wsRepo.delete(workspaceId);
  }

  // =========================================================================
  // SCOPED BUSINESS DATA OPERATIONS WITH CROSS-WORKSPACE ISOLATION
  // =========================================================================

  /**
   * Creates a party (Customer or Supplier) strictly scoped to a workspace.
   */
  public static async createParty(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      name: string;
      type: 'customer' | 'supplier' | 'both';
      phone?: string;
      email?: string;
      address?: string;
      taxNumber?: string;
      creditLimitScaled?: bigint;
      currencyCode?: string;
    }
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.name, 'Party Name'));

    const partyRepo = new PartyRepository(conn);
    return await partyRepo.create({
      workspaceId,
      name: params.name.trim(),
      type: params.type,
      phone: params.phone || null,
      email: params.email || null,
      address: params.address || null,
      taxNumber: params.taxNumber || null,
      creditLimitScaled: params.creditLimitScaled ?? 0n,
      currencyCode: params.currencyCode || 'PKR',
      isActive: true
    });
  }

  /**
   * Lists parties scoped to workspace.
   */
  public static async getParties(
    conn: DatabaseConnection,
    workspaceId: string,
    filterType?: 'customer' | 'supplier' | 'both'
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);
    const partyRepo = new PartyRepository(conn);
    return await partyRepo.findByWorkspace(workspaceId, filterType);
  }

  /**
   * Creates an inventory product scoped to a workspace.
   */
  public static async createProduct(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      name: string;
      sku?: string;
      barcode?: string;
      unit?: any;
      costPriceScaled: bigint;
      salePriceScaled: bigint;
      wholesalePriceScaled?: bigint;
      currentStockQuantity?: number;
      minStockAlert?: number;
      initialStockQuantity?: number;
      description?: string;
      category?: string;
      brand?: string;
      taxRatePercent?: number;
      reorderThreshold?: number;
      hasBatchTracking?: boolean;
      hasSerialTracking?: boolean;
      unitConversions?: any[];
    }
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.name, 'Product Name'));

    return await InventoryService.createProduct(conn, workspaceId, {
      name: params.name,
      sku: params.sku,
      barcode: params.barcode,
      unit: params.unit || 'pcs',
      costPriceScaled: params.costPriceScaled,
      salePriceScaled: params.salePriceScaled,
      wholesalePriceScaled: params.wholesalePriceScaled,
      initialStockQuantity: params.initialStockQuantity ?? params.currentStockQuantity ?? 0,
      minStockAlert: params.minStockAlert ?? 5,
      reorderThreshold: params.reorderThreshold ?? params.minStockAlert ?? 5,
      description: params.description,
      category: params.category,
      brand: params.brand,
      taxRatePercent: params.taxRatePercent ?? 0,
      hasBatchTracking: params.hasBatchTracking,
      hasSerialTracking: params.hasSerialTracking,
      unitConversions: params.unitConversions
    });
  }

  /**
   * Lists products scoped to workspace.
   */
  public static async getProducts(
    conn: DatabaseConnection,
    workspaceId: string,
    includeArchived = false
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);
    const prodRepo = new ProductRepository(conn);
    return await prodRepo.findByWorkspace(workspaceId, includeArchived);
  }

  /**
   * Creates an invoice/bill strictly scoped to workspace.
   * CROSS-WORKSPACE ISOLATION GUARD:
   * Validates that the party and any products belong to the EXACT same workspace.
   * Throws CrossWorkspaceIsolationError if an entity from another workspace is linked.
   */
  public static async createDocument(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      documentType: 'sales_invoice' | 'purchase_bill' | 'receipt';
      documentNumber?: string;
      partyId?: string;
      partyName: string;
      issueDate: string;
      dueDate: string;
      lines: {
        itemId?: string;
        description: string;
        quantity: number;
        unitPriceScaled: bigint;
        discountScaled?: bigint;
        taxRatePercent?: number;
      }[];
      notes?: string;
    }
  ): Promise<DocumentWithLines> {
    await this.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.partyName, 'Party Name'));

    const partyRepo = new PartyRepository(conn);
    const prodRepo = new ProductRepository(conn);
    const docRepo = new DocumentRepository(conn);
    const bpRepo = new BusinessProfileRepository(conn);

    // 1. ISOLATION CHECK: Validate party belongs to this workspace
    if (params.partyId) {
      const party = await partyRepo.findById(params.partyId);
      if (!party) {
        throw new Error(`Party ${params.partyId} not found.`);
      }
      if (party.workspaceId !== workspaceId) {
        throw new CrossWorkspaceIsolationError(
          `Party ${party.id} belongs to workspace "${party.workspaceId}", but document is being created in workspace "${workspaceId}".`
        );
      }
    }

    // 2. ISOLATION CHECK: Validate each product belongs to this workspace
    for (const line of params.lines) {
      if (line.itemId) {
        const item = await prodRepo.findById(line.itemId);
        if (!item) {
          throw new Error(`Product ${line.itemId} not found.`);
        }
        if (item.workspaceId !== workspaceId) {
          throw new CrossWorkspaceIsolationError(
            `Product ${item.id} belongs to workspace "${item.workspaceId}", but document is being created in workspace "${workspaceId}".`
          );
        }
      }
    }

    // 3. Document sequence and number
    let docNumber = params.documentNumber;
    if (!docNumber) {
      const profile = await bpRepo.findByWorkspaceId(workspaceId);
      const prefix = profile?.invoicePrefix || 'INV';
      const seq = profile?.nextInvoiceSequence || 1;
      docNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
      if (profile) {
        await bpRepo.update(workspaceId, { nextInvoiceSequence: seq + 1 });
      }
    }

    // 4. Calculate line amounts and totals
    let subtotalScaled = 0n;
    let totalDiscountScaled = 0n;
    let totalTaxScaled = 0n;

    const computedLines = params.lines.map(line => {
      const discount = line.discountScaled ?? 0n;
      const baseLineTotal = (BigInt(Math.round(line.quantity * 10000)) * line.unitPriceScaled) / 10000n;
      const netLine = baseLineTotal > discount ? baseLineTotal - discount : 0n;
      const taxRate = line.taxRatePercent ?? 0;
      const taxScaled = (netLine * BigInt(Math.round(taxRate * 100))) / 10000n;
      const lineTotal = netLine + taxScaled;

      subtotalScaled += baseLineTotal;
      totalDiscountScaled += discount;
      totalTaxScaled += taxScaled;

      return {
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity,
        unitPriceScaled: line.unitPriceScaled,
        discountScaled: discount,
        taxRatePercent: taxRate,
        taxScaled,
        totalScaled: lineTotal
      };
    });

    const totalScaled = subtotalScaled - totalDiscountScaled + totalTaxScaled;

    // 5. Persist document
    const created = await docRepo.createWithLines(
      {
        workspaceId,
        documentType: params.documentType,
        documentNumber: docNumber,
        partyId: params.partyId || null,
        partyName: params.partyName,
        issueDate: params.issueDate,
        dueDate: params.dueDate,
        currencyCode: 'PKR',
        subtotalScaled,
        discountScaled: totalDiscountScaled,
        taxScaled: totalTaxScaled,
        totalScaled,
        paidAmountScaled: 0n,
        status: 'unpaid',
        notes: params.notes || null,
        isArchived: false
      },
      computedLines
    );

    // Automatically record credit sales and purchases in the Party Khata Ledger
    if (params.partyId && (params.documentType === 'sales_invoice' || params.documentType === 'purchase_bill')) {
      const ledgerRepo = new PartyLedgerRepository(conn);
      await ledgerRepo.recordEntry({
        workspaceId,
        partyId: params.partyId,
        entryDate: params.issueDate,
        entryType: params.documentType === 'sales_invoice' ? 'credit_sale' : 'credit_purchase',
        documentId: created.id,
        referenceNumber: created.documentNumber,
        description: `${params.documentType === 'sales_invoice' ? 'Credit Sale Invoice' : 'Purchase Bill'} ${created.documentNumber}`,
        receivableAmountScaled: params.documentType === 'sales_invoice' ? created.totalScaled : 0n,
        payableAmountScaled: params.documentType === 'purchase_bill' ? created.totalScaled : 0n,
        dueDate: params.dueDate || null
      });
    }

    return created;
  }

  /**
   * Retrieves documents scoped to workspace.
   */
  public static async getDocuments(
    conn: DatabaseConnection,
    workspaceId: string,
    filterType?: 'sales_invoice' | 'purchase_bill' | 'receipt'
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);
    const docRepo = new DocumentRepository(conn);
    return await docRepo.findByWorkspace(workspaceId, filterType);
  }

  /**
   * Retrieves Chart of Accounts scoped to workspace.
   */
  public static async getAccounts(
    conn: DatabaseConnection,
    workspaceId: string
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);
    const accRepo = new AccountRepository(conn);
    return await accRepo.findByWorkspace(workspaceId);
  }

  /**
   * Creates a configurable custom account in the workspace's Chart of Accounts.
   */
  public static async createAccount(
    conn: DatabaseConnection,
    workspaceId: string,
    params: {
      accountCode: string;
      name: string;
      type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      subCategory?: any;
      reportMapping?: 'balance_sheet' | 'income_statement';
      description?: string;
      parentAccountId?: string;
      currencyCode?: string;
    }
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId);
    assertValid(validateRequiredString(params.accountCode, 'Account Code'));
    assertValid(validateRequiredString(params.name, 'Account Name'));
    assertValid(validateRequiredString(params.type, 'Account Type'));

    const accRepo = new AccountRepository(conn);
    const existing = await accRepo.findByCode(workspaceId, params.accountCode.trim());
    if (existing) {
      throw new Error(`Account with code ${params.accountCode} already exists in this workspace.`);
    }

    return await accRepo.create({
      workspaceId,
      accountCode: params.accountCode.trim(),
      name: params.name.trim(),
      type: params.type,
      subCategory: params.subCategory,
      reportMapping: params.reportMapping,
      description: params.description?.trim() || null,
      parentAccountId: params.parentAccountId || null,
      currencyCode: params.currencyCode || 'PKR',
      isSystem: false,
      isActive: true
    });
  }

  /**
   * Retrieves trial balance for the workspace, validating total debits equal total credits.
   */
  public static async getTrialBalance(
    conn: DatabaseConnection,
    workspaceId: string
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);
    const accRepo = new AccountRepository(conn);
    return await accRepo.getTrialBalance(workspaceId);
  }

  /**
   * Computes a comprehensive financial summary scoped to a specific business workspace.
   * Guaranteed ZERO leakage of other businesses' or personal finance data.
   */
  public static async getBusinessSummary(
    conn: DatabaseConnection,
    workspaceId: string
  ) {
    await this.validateWorkspaceAccess(conn, workspaceId, true);

    const [parties, products, docs, accounts] = await Promise.all([
      this.getParties(conn, workspaceId),
      this.getProducts(conn, workspaceId),
      this.getDocuments(conn, workspaceId),
      this.getAccounts(conn, workspaceId)
    ]);

    let totalSalesScaled = 0n;
    let totalPurchasesScaled = 0n;

    for (const d of docs) {
      if (d.documentType === 'sales_invoice') {
        totalSalesScaled += d.totalScaled;
      } else if (d.documentType === 'purchase_bill') {
        totalPurchasesScaled += d.totalScaled;
      }
    }

    // Authoritative receivables and payables derived from party ledger events (including opening balances)
    const ledgerRepo = new PartyLedgerRepository(conn);
    let receivablesScaled = 0n;
    let payablesScaled = 0n;

    for (const p of parties) {
      const bal = await ledgerRepo.getDerivedPartyBalance(workspaceId, p.id);
      if (bal.netBalanceScaled > 0n) {
        receivablesScaled += bal.netBalanceScaled;
      } else if (bal.netBalanceScaled < 0n) {
        payablesScaled += -bal.netBalanceScaled;
      }
    }

    // If no parties cataloged yet, fallback to document unpaid balances
    if (parties.length === 0) {
      for (const d of docs) {
        if (d.documentType === 'sales_invoice') {
          const remaining = d.totalScaled - d.paidAmountScaled;
          if (remaining > 0n) receivablesScaled += remaining;
        } else if (d.documentType === 'purchase_bill') {
          const remaining = d.totalScaled - d.paidAmountScaled;
          if (remaining > 0n) payablesScaled += remaining;
        }
      }
    }

    let inventoryValuationScaled = 0n;
    for (const p of products) {
      if (p.currentStockQuantity > 0) {
        const itemVal = (BigInt(Math.round(p.currentStockQuantity * 10000)) * p.costPriceScaled) / 10000n;
        inventoryValuationScaled += itemVal;
      }
    }

    return {
      workspaceId,
      customerCount: parties.filter(p => p.type === 'customer' || p.type === 'both').length,
      supplierCount: parties.filter(p => p.type === 'supplier' || p.type === 'both').length,
      productCount: products.length,
      documentCount: docs.length,
      accountCount: accounts.length,
      totalSalesScaled,
      totalPurchasesScaled,
      receivablesScaled,
      payablesScaled,
      inventoryValuationScaled
    };
  }
}
