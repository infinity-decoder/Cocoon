import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../../infrastructure/database/sqliteConnectionPool';
import { MigrationService } from '../../infrastructure/database/migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../../infrastructure/database/migrations/MigrationRegistry';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from '../../infrastructure/database/migrations/002_business_workspaces_ledger_parties';
import { 
  WorkspaceService, 
  CrossWorkspaceIsolationError 
} from './WorkspaceService';
import { PersonalFinanceService } from './PersonalFinanceService';

describe('Application Service: Workspace Management & Cross-Workspace Isolation', () => {
  async function createTestDb(name: string) {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(name);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);
    return conn;
  }

  it('initializes default Personal Workspace and permits creation of multiple distinct business workspaces', async () => {
    const conn = await createTestDb(`test_ws_create_${Date.now()}`);

    // 1. Verify default personal workspace
    const personal = await WorkspaceService.getWorkspaceById(conn, DEFAULT_PERSONAL_WORKSPACE_ID);
    assert.notEqual(personal, null);
    assert.equal(personal?.name, 'Personal Workspace');
    assert.equal(personal?.type, 'personal');

    // 2. Create Business Workspace A (Apex Supermarket - Retail)
    const bizA = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Apex Supermarket',
      businessType: 'retail',
      currencyCode: 'PKR',
      taxId: 'TX-APEX-9921',
      phone: '03001112233',
      address: 'Main Commercial Plaza, Lahore',
      invoicePrefix: 'APX'
    });

    assert.notEqual(bizA.id, DEFAULT_PERSONAL_WORKSPACE_ID);
    assert.equal(bizA.name, 'Apex Supermarket');
    assert.equal(bizA.type, 'business');
    assert.equal(bizA.profile?.businessType, 'retail');
    assert.equal(bizA.profile?.invoicePrefix, 'APX');

    // 3. Create Business Workspace B (Beacon Electronics - Wholesale)
    const bizB = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Beacon Electronics',
      businessType: 'wholesale',
      currencyCode: 'PKR',
      taxId: 'TX-BCN-4410',
      phone: '03215556677',
      address: 'Industrial Estate, Karachi',
      invoicePrefix: 'BCN'
    });

    assert.notEqual(bizB.id, bizA.id);
    assert.equal(bizB.name, 'Beacon Electronics');
    assert.equal(bizB.profile?.businessType, 'wholesale');

    // 4. Verify both businesses received default Chart of Accounts and default payment terms
    const accountsA = await WorkspaceService.getAccounts(conn, bizA.id);
    const accountsB = await WorkspaceService.getAccounts(conn, bizB.id);

    assert.equal(accountsA.length >= 9, true);
    assert.equal(accountsB.length >= 9, true);

    // Verify accounts are strictly scoped to their respective workspace IDs
    assert.equal(accountsA.every(a => a.workspaceId === bizA.id), true);
    assert.equal(accountsB.every(a => a.workspaceId === bizB.id), true);

    // List all workspaces
    const all = await WorkspaceService.listWorkspaces(conn);
    assert.equal(all.length >= 3, true);
    assert.equal(all.some(w => w.id === DEFAULT_PERSONAL_WORKSPACE_ID), true);
    assert.equal(all.some(w => w.id === bizA.id), true);
    assert.equal(all.some(w => w.id === bizB.id), true);
  });

  it('guarantees strict data isolation: Business A does not display or leak Business B data', async () => {
    const conn = await createTestDb(`test_ws_isolation_${Date.now()}`);

    const bizA = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Alpha Traders',
      businessType: 'retail'
    });

    const bizB = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Beta Logistics',
      businessType: 'services'
    });

    // 1. Add parties (customers & suppliers) to Alpha Traders
    const custAlpha = await WorkspaceService.createParty(conn, bizA.id, {
      name: 'Customer of Alpha',
      type: 'customer',
      phone: '03001234567'
    });

    const suppAlpha = await WorkspaceService.createParty(conn, bizA.id, {
      name: 'Supplier to Alpha',
      type: 'supplier'
    });

    // 2. Add party to Beta Logistics
    const custBeta = await WorkspaceService.createParty(conn, bizB.id, {
      name: 'Customer of Beta',
      type: 'customer',
      phone: '03119876543'
    });

    // 3. Add products to Alpha
    const prodAlpha = await WorkspaceService.createProduct(conn, bizA.id, {
      name: 'Alpha Widget X',
      unit: 'pcs',
      costPriceScaled: 5000000n, // 500.00 PKR
      salePriceScaled: 7500000n,  // 750.00 PKR
      currentStockQuantity: 100
    });

    // 4. Add products to Beta
    const prodBeta = await WorkspaceService.createProduct(conn, bizB.id, {
      name: 'Beta Heavy Machine',
      unit: 'pcs',
      costPriceScaled: 25000000n, // 2500.00 PKR
      salePriceScaled: 35000000n,  // 3500.00 PKR
      currentStockQuantity: 10
    });

    // 5. Create invoice in Alpha
    const invAlpha = await WorkspaceService.createDocument(conn, bizA.id, {
      documentType: 'sales_invoice',
      partyId: custAlpha.id,
      partyName: custAlpha.name,
      issueDate: '2026-10-16',
      dueDate: '2026-10-31',
      lines: [
        {
          itemId: prodAlpha.id,
          description: '10x Widget X',
          quantity: 10,
          unitPriceScaled: 7500000n
        }
      ]
    });

    // 6. Query scoped data for Alpha Traders
    const alphaParties = await WorkspaceService.getParties(conn, bizA.id);
    const alphaProducts = await WorkspaceService.getProducts(conn, bizA.id);
    const alphaDocs = await WorkspaceService.getDocuments(conn, bizA.id);
    const alphaSummary = await WorkspaceService.getBusinessSummary(conn, bizA.id);

    assert.equal(alphaParties.length, 2);
    assert.equal(alphaParties.some(p => p.name === 'Customer of Alpha'), true);
    assert.equal(alphaParties.some(p => p.name === 'Customer of Beta'), false); // NO LEAKAGE

    assert.equal(alphaProducts.length, 1);
    assert.equal(alphaProducts[0].name, 'Alpha Widget X');

    assert.equal(alphaDocs.length, 1);
    assert.equal(alphaDocs[0].documentNumber, invAlpha.documentNumber);

    assert.equal(alphaSummary.customerCount, 1);
    assert.equal(alphaSummary.supplierCount, 1);
    assert.equal(alphaSummary.productCount, 1);
    assert.equal(alphaSummary.totalSalesScaled, 75000000n); // 7,500.00 PKR

    // 7. Query scoped data for Beta Logistics
    const betaParties = await WorkspaceService.getParties(conn, bizB.id);
    const betaProducts = await WorkspaceService.getProducts(conn, bizB.id);
    const betaDocs = await WorkspaceService.getDocuments(conn, bizB.id);
    const betaSummary = await WorkspaceService.getBusinessSummary(conn, bizB.id);

    assert.equal(betaParties.length, 1);
    assert.equal(betaParties[0].name, 'Customer of Beta');
    assert.equal(betaParties.some(p => p.name === 'Customer of Alpha'), false); // NO LEAKAGE

    assert.equal(betaProducts.length, 1);
    assert.equal(betaProducts[0].name, 'Beta Heavy Machine');

    assert.equal(betaDocs.length, 0); // Beta has no invoices yet
    assert.equal(betaSummary.totalSalesScaled, 0n);
  });

  it('cross-workspace isolation check: rejects attempt to link an entity from one business to another business document', async () => {
    const conn = await createTestDb(`test_ws_cross_reject_${Date.now()}`);

    const bizA = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Business One',
      businessType: 'retail'
    });

    const bizB = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Business Two',
      businessType: 'wholesale'
    });

    // Create a customer belonging to Business Two
    const customerOfBizB = await WorkspaceService.createParty(conn, bizB.id, {
      name: 'Biz B Loyal Client',
      type: 'customer'
    });

    // Create a product belonging to Business Two
    const productOfBizB = await WorkspaceService.createProduct(conn, bizB.id, {
      name: 'Product Exclusively From B',
      costPriceScaled: 1000000n,
      salePriceScaled: 1500000n
    });

    // Attempt 1: Try to create an invoice in Business ONE referencing party from Business TWO
    await assert.rejects(
      async () => {
        await WorkspaceService.createDocument(conn, bizA.id, {
          documentType: 'sales_invoice',
          partyId: customerOfBizB.id, // Belonging to Business B!
          partyName: customerOfBizB.name,
          issueDate: '2026-10-16',
          dueDate: '2026-10-31',
          lines: [
            {
              description: 'Generic Service',
              quantity: 1,
              unitPriceScaled: 1000000n
            }
          ]
        });
      },
      (err: any) => {
        assert.equal(err instanceof CrossWorkspaceIsolationError, true);
        assert.match(err.message, /Cross-Workspace Isolation Violation/);
        return true;
      }
    );

    // Attempt 2: Try to create an invoice in Business ONE referencing product from Business TWO
    await assert.rejects(
      async () => {
        await WorkspaceService.createDocument(conn, bizA.id, {
          documentType: 'sales_invoice',
          partyName: 'Random Walk-in',
          issueDate: '2026-10-16',
          dueDate: '2026-10-31',
          lines: [
            {
              itemId: productOfBizB.id, // Product from Business B!
              description: 'Cross-linked Item',
              quantity: 1,
              unitPriceScaled: 1500000n
            }
          ]
        });
      },
      (err: any) => {
        assert.equal(err instanceof CrossWorkspaceIsolationError, true);
        assert.match(err.message, /Cross-Workspace Isolation Violation/);
        return true;
      }
    );
  });

  it('preserves history on archiving, and prevents accidental hard deletion of business containing financial history', async () => {
    const conn = await createTestDb(`test_ws_archive_delete_${Date.now()}`);

    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Historical Enterprises',
      businessType: 'services'
    });

    // Add customer & invoice (creating financial history)
    const cust = await WorkspaceService.createParty(conn, biz.id, {
      name: 'Client with Invoices',
      type: 'customer'
    });

    const doc = await WorkspaceService.createDocument(conn, biz.id, {
      documentType: 'sales_invoice',
      partyId: cust.id,
      partyName: cust.name,
      issueDate: '2026-10-16',
      dueDate: '2026-10-31',
      lines: [
        {
          description: 'Consulting Session',
          quantity: 2,
          unitPriceScaled: 5000000n
        }
      ]
    });

    // 1. Attempt hard delete: MUST BE REJECTED because it has financial history
    await assert.rejects(
      async () => {
        await WorkspaceService.deleteWorkspace(conn, biz.id);
      },
      /Cannot delete workspace.*contains financial history/
    );

    // 2. Archive workspace: MUST SUCCEED without deleting history
    await WorkspaceService.archiveWorkspace(conn, biz.id);

    const wsArchived = await WorkspaceService.getWorkspaceById(conn, biz.id);
    assert.equal(wsArchived?.isActive, false);

    // Inactive workspace list excludes it by default, but includes it when requested
    const activeList = await WorkspaceService.listWorkspaces(conn, false);
    assert.equal(activeList.some(w => w.id === biz.id), false);

    const fullList = await WorkspaceService.listWorkspaces(conn, true);
    assert.equal(fullList.some(w => w.id === biz.id), true);

    // Verify invoice and party history remain fully intact
    const historicalDocs = await WorkspaceService.getDocuments(conn, biz.id);
    assert.equal(historicalDocs.length, 1);
    assert.equal(historicalDocs[0].id, doc.id);

    // 3. Unarchive workspace: restores active status cleanly
    await WorkspaceService.unarchiveWorkspace(conn, biz.id);
    const wsRestored = await WorkspaceService.getWorkspaceById(conn, biz.id);
    assert.equal(wsRestored?.isActive, true);
  });

  it('guarantees Personal Finance data is completely independent from business workspaces', async () => {
    const conn = await createTestDb(`test_personal_independence_${Date.now()}`);

    // Create a business
    const biz = await WorkspaceService.createBusinessWorkspace(conn, {
      name: 'Side Hustle Shop',
      businessType: 'retail'
    });

    // Add personal transaction
    const personalTx = await PersonalFinanceService.addTransaction(conn, {
      type: 'expense',
      amount: 1500,
      category: 'Groceries',
      walletId: 'cash',
      note: 'Personal groceries at market'
    });

    assert.notEqual(personalTx.id, null);

    // Add business customer and document
    const bizCust = await WorkspaceService.createParty(conn, biz.id, {
      name: 'Business Buyer',
      type: 'customer'
    });

    const bizDoc = await WorkspaceService.createDocument(conn, biz.id, {
      documentType: 'sales_invoice',
      partyId: bizCust.id,
      partyName: bizCust.name,
      issueDate: '2026-10-16',
      dueDate: '2026-10-31',
      lines: [
        {
          description: 'Retail inventory goods',
          quantity: 5,
          unitPriceScaled: 2000000n
        }
      ]
    });

    // Verify personal state transactions list only has the personal transaction
    const personalRows = await conn.query<any>('SELECT * FROM transactions WHERE id = ?', [personalTx.id]);
    assert.equal(personalRows.length, 1);
    assert.equal(personalRows[0].amount, 1500);

    // Verify business documents have zero personal transactions
    const bizDocs = await WorkspaceService.getDocuments(conn, biz.id);
    assert.equal(bizDocs.length, 1);
    assert.equal(bizDocs[0].id, bizDoc.id);

    // Attempt to delete default personal workspace must be rejected
    await assert.rejects(
      async () => {
        await WorkspaceService.deleteWorkspace(conn, DEFAULT_PERSONAL_WORKSPACE_ID);
      },
      /Default Personal Workspace cannot be deleted/
    );

    // Attempt to archive default personal workspace must be rejected
    await assert.rejects(
      async () => {
        await WorkspaceService.archiveWorkspace(conn, DEFAULT_PERSONAL_WORKSPACE_ID);
      },
      /Default Personal Workspace cannot be archived/
    );
  });
});
