/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConnectionPool } from '../sqliteConnectionPool';
import { MigrationService } from '../migrations/MigrationService';
import { MIGRATION_REGISTRY } from '../migrations/MigrationRegistry';
import { ProductRepository } from '../repositories/ProductRepository';
import { PartyLedgerRepository } from '../repositories/PartyLedgerRepository';
import { JournalEntryRepository } from '../repositories/JournalEntryRepository';
import { TransactionQueryService } from '../../../application/services/TransactionQueryService';
import { InventoryService } from '../../../application/services/InventoryService';
import { generateEntityId } from '../../../domain/primitives/EntityId';

describe('High-Volume Business Optimization & Query Plan Benchmarks', () => {
  const workspaceId = 'ws_bench_enterprise_001';

  it('verifies EXPLAIN QUERY PLAN utilizes covering indexes and avoids full table scans', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_query_plan_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);

    // 1. Verify Barcode Direct Join Query Plan
    const barcodePlan = await conn.query<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT p.*, b.packaging_unit, b.conversion_factor, b.price_scaled
       FROM product_barcodes b
       JOIN products p ON p.id = b.product_id
       WHERE b.workspace_id = ? AND b.normalized_barcode = ? AND p.is_archived = 0
       LIMIT 1`,
      [workspaceId, '8901234567890']
    );

    const barcodeDetails = barcodePlan.map(p => p.detail).join(' ');
    // Must use index on product_barcodes and primary key or index on products
    assert.match(barcodeDetails, /USING (COVERING )?INDEX|SEARCH (TABLE )?b|SEARCH (TABLE )?p/i);
    assert.doesNotMatch(barcodeDetails, /SCAN TABLE products/i, 'Product join must not do full table scan');

    // 2. Verify Party Ledger Balance Aggregation Covering Index
    const ledgerAggPlan = await conn.query<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT 
         COALESCE(SUM(receivable_amount_scaled), 0) AS rec_total,
         COALESCE(SUM(payable_amount_scaled), 0) AS pay_total
       FROM party_ledger_entries
       WHERE workspace_id = ? AND party_id = ? AND is_reversed = 0`,
      [workspaceId, 'party_123']
    );

    const aggDetails = ledgerAggPlan.map(p => p.detail).join(' ');
    // Must use covering index idx_party_ledger_balance_covering
    assert.match(aggDetails, /USING (COVERING )?INDEX (idx_party_ledger_balance_covering|idx_party_ledger_ws_party)/i);

    // 3. Verify Transactions Keyset Pagination Query Plan
    const txKeysetPlan = await conn.query<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT id, date, amount FROM transactions
       WHERE (date < ? OR (date = ? AND id < ?))
       ORDER BY date DESC, id DESC
       LIMIT 25`,
      ['2026-10-01', '2026-10-01', 'tx_999']
    );

    const txDetails = txKeysetPlan.map(p => p.detail).join(' ');
    assert.match(txDetails, /USING INDEX idx_transactions_date_id/i);

    // 4. Verify Stock Movements Covering Query Plan
    const stockPlan = await conn.query<{ detail: string }>(
      `EXPLAIN QUERY PLAN
       SELECT COALESCE(SUM(quantity_delta), 0)
       FROM stock_movements
       WHERE workspace_id = ? AND product_id = ? AND is_reversed = 0`,
      [workspaceId, 'prod_123']
    );

    const stockDetails = stockPlan.map(p => p.detail).join(' ');
    assert.match(stockDetails, /USING (COVERING )?INDEX/i);
  });

  it('populates high-volume synthetic dataset (100k+ transactions, 15k products, 10k ledger entries) and asserts latency targets', async () => {
    const pool = SqliteConnectionPool.getInstance();
    const conn = await pool.getConnection(`test_high_volume_${Date.now()}`);
    const migService = new MigrationService();
    await migService.runPendingMigrations(conn, MIGRATION_REGISTRY);

    // Setup workspace and system accounts
    const now = new Date().toISOString();
    await conn.run(
      `INSERT OR IGNORE INTO workspaces (id, name, type, currency_code, is_active, created_at, updated_at)
       VALUES (?, 'Enterprise Wholesale Hub', 'business', 'PKR', 1, ?, ?)`,
      [workspaceId, now, now]
    );

    const partyId = 'pty_distributor_alpha';
    await conn.run(
      `INSERT INTO parties (id, workspace_id, name, type, is_active, created_at, updated_at)
       VALUES (?, ?, 'Alpha Super Distributors', 'both', 1, ?, ?)`,
      [partyId, workspaceId, now, now]
    );

    // 1. Synthetic Generation: 15,000 Products with direct and multi-unit barcodes
    console.log('Generating 15,000 products with indexed barcodes...');
    const productBatchSize = 1000;
    const totalProducts = 15000;
    const testBarcodes: string[] = [];

    for (let batch = 0; batch < totalProducts; batch += productBatchSize) {
      await conn.executeTransaction(async () => {
        for (let i = batch; i < batch + productBatchSize; i++) {
          const prodId = `prod_${i.toString().padStart(6, '0')}`;
          const barcode = `890${i.toString().padStart(10, '0')}`;
          if (i % 150 === 0) testBarcodes.push(barcode);

          await conn.run(
            `INSERT INTO products (
              id, workspace_id, name, sku, barcode, unit, cost_price_scaled, sale_price_scaled,
              current_stock_quantity, min_stock_alert, currency_code, is_archived, is_active,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pcs', 1000000, 1500000, 250, 10, 'PKR', 0, 1, ?, ?)`,
            [
              prodId,
              workspaceId,
              `Premium Commercial SKU ${i}`,
              `SKU-${i}`,
              barcode,
              now,
              now
            ]
          );

          await conn.run(
            `INSERT INTO product_barcodes (
              id, workspace_id, product_id, barcode, normalized_barcode,
              packaging_unit, conversion_factor, price_scaled, is_primary, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pcs', 1.0, 1500000, 1, ?, ?)`,
            [
              `pbc_${i}`,
              workspaceId,
              prodId,
              barcode,
              barcode,
              now,
              now
            ]
          );
        }
      });
    }

    // 2. Synthetic Generation: 10,000 Party Ledger (Khata) Entries for single party
    console.log('Generating 10,000 party ledger entries...');
    const ledgerBatchSize = 1000;
    const totalLedger = 10000;
    for (let batch = 0; batch < totalLedger; batch += ledgerBatchSize) {
      await conn.executeTransaction(async () => {
        for (let i = batch; i < batch + ledgerBatchSize; i++) {
          const day = (i % 28) + 1;
          const month = ((Math.floor(i / 28)) % 12) + 1;
          const dateStr = `2026-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          const isCreditSale = i % 2 === 0;

          await conn.run(
            `INSERT INTO party_ledger_entries (
              id, workspace_id, party_id, entry_date, entry_type, reference_number, description,
              receivable_amount_scaled, payable_amount_scaled, running_balance_scaled, is_reversed, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
            [
              `ple_${i.toString().padStart(6, '0')}`,
              workspaceId,
              partyId,
              dateStr,
              isCreditSale ? 'credit_sale' : 'payment_received',
              `REF-${i}`,
              `Commercial transaction ${i}`,
              isCreditSale ? 50000000 : 0, // 5,000 PKR
              isCreditSale ? 0 : 50000000,
              now
            ]
          );
        }
      });
    }

    // 3. Synthetic Generation: 100,000 Transactions (Personal / Business cash entries)
    console.log('Generating 100,000 transactions...');
    const txBatchSize = 5000;
    const totalTx = 100000;
    for (let batch = 0; batch < totalTx; batch += txBatchSize) {
      await conn.executeTransaction(async () => {
        for (let i = batch; i < batch + txBatchSize; i++) {
          const day = (i % 28) + 1;
          const month = ((Math.floor(i / 28)) % 12) + 1;
          const year = 2024 + Math.floor(i / (28 * 12));
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T10:00:00.000Z`;

          await conn.run(
            `INSERT INTO transactions (
              id, type, amount, currency, date, note, category, wallet_id, payment_method, is_recurring
            ) VALUES (?, 'expense', ?, 'PKR', ?, ?, 'Inventory', 'wallet_cash_01', 'cash', 0)`,
            [
              `tx_${i.toString().padStart(7, '0')}`,
              (i % 500) + 10,
              dateStr,
              `Wholesale supply bill item #${i}`
            ]
          );
        }
      });
    }

    // -------------------------------------------------------------
    // BENCHMARK 1: Barcode Lookup Latency (Target ≤ 150ms p95)
    // -------------------------------------------------------------
    console.log('Benchmarking barcode direct indexed lookups across 15,000 products...');
    const productRepo = new ProductRepository(conn);
    const barcodeLatencies: number[] = [];

    for (const code of testBarcodes) {
      const start = performance.now();
      const match = await productRepo.lookupBarcodeDirect(workspaceId, code);
      const duration = performance.now() - start;
      barcodeLatencies.push(duration);

      assert.notEqual(match, null, `Barcode ${code} should resolve`);
      assert.equal(match?.barcodeRecord.normalizedBarcode, code);
    }

    barcodeLatencies.sort((a, b) => a - b);
    const p95Barcode = barcodeLatencies[Math.floor(barcodeLatencies.length * 0.95)];
    const avgBarcode = barcodeLatencies.reduce((a, b) => a + b, 0) / barcodeLatencies.length;

    console.log(`Barcode Lookup Results: Avg=${avgBarcode.toFixed(3)}ms, p95=${p95Barcode.toFixed(3)}ms (Threshold: 150ms)`);
    assert.ok(p95Barcode <= 150, `p95 barcode lookup time (${p95Barcode}ms) exceeded 150ms threshold`);

    // -------------------------------------------------------------
    // BENCHMARK 2: Ordinary Local Ledger Page Query (Target ≤ 200ms)
    // -------------------------------------------------------------
    console.log('Benchmarking party ledger statement on 10,000-entry customer ledger...');
    const ledgerRepo = new PartyLedgerRepository(conn);

    const ledgerLatencies: number[] = [];
    for (let page = 1; page <= 5; page++) {
      const start = performance.now();
      const statement = await ledgerRepo.getPartyStatement(workspaceId, partyId, { page, pageSize: 50 });
      const duration = performance.now() - start;
      ledgerLatencies.push(duration);

      assert.equal(statement.totalCount, totalLedger);
      assert.equal(statement.entries.length, 50);
    }

    ledgerLatencies.sort((a, b) => a - b);
    const p95Ledger = ledgerLatencies[Math.floor(ledgerLatencies.length * 0.95)];
    console.log(`Ledger Page Results: p95=${p95Ledger.toFixed(3)}ms (Threshold: 200ms)`);
    assert.ok(p95Ledger <= 200, `p95 ledger page query time (${p95Ledger}ms) exceeded 200ms threshold`);

    // -------------------------------------------------------------
    // BENCHMARK 3: Instant SQL-Level Running Balance Calculation
    // -------------------------------------------------------------
    console.log('Benchmarking covering index running balance aggregation...');
    const balanceStart = performance.now();
    const balance = await ledgerRepo.getDerivedPartyBalance(workspaceId, partyId);
    const balanceDuration = performance.now() - balanceStart;

    console.log(`Covering Index Balance Aggregation Duration: ${balanceDuration.toFixed(3)}ms`);
    assert.ok(balanceDuration <= 50, `Balance aggregation took ${balanceDuration}ms, expected ≤ 50ms`);
    // 5000 credits of 50000000 minus 5000 debits of 50000000 === 0
    assert.equal(balance.receivableTotalScaled, 250000000000n);
    assert.equal(balance.payableTotalScaled, 250000000000n);
    assert.equal(balance.netBalanceScaled, 0n);

    // -------------------------------------------------------------
    // BENCHMARK 4: Keyset Pagination vs OFFSET Performance
    // -------------------------------------------------------------
    console.log('Benchmarking Keyset Pagination on 100,000 transactions...');
    const page1Start = performance.now();
    const page1 = await TransactionQueryService.queryTransactionsKeyset(conn, { limit: 25 });
    const page1Duration = performance.now() - page1Start;

    assert.equal(page1.items.length, 25);
    assert.notEqual(page1.nextCursor, null);

    // Deep seek using keyset cursor
    let currentCursor = page1.nextCursor;
    let deepPageDuration = 0;
    for (let p = 0; p < 10; p++) {
      const start = performance.now();
      const pageResult = await TransactionQueryService.queryTransactionsKeyset(conn, {
        cursor: currentCursor!,
        limit: 25
      });
      deepPageDuration = performance.now() - start;
      currentCursor = pageResult.nextCursor;
    }

    console.log(`Keyset Page 1: ${page1Duration.toFixed(3)}ms, Deep Keyset Page: ${deepPageDuration.toFixed(3)}ms`);
    assert.ok(deepPageDuration <= 50, `Deep keyset pagination took ${deepPageDuration}ms, expected ≤ 50ms`);

    // -------------------------------------------------------------
    // BENCHMARK 5: Stock Movement Reconciliation
    // -------------------------------------------------------------
    console.log('Benchmarking cached projection reconciliation...');
    const reconStart = performance.now();
    const recon = await InventoryService.rebuildStockCache(conn, workspaceId);
    const reconDuration = performance.now() - reconStart;

    console.log(`Stock Cache Reconciliation for ${recon.reconciledCount} products: ${reconDuration.toFixed(3)}ms`);
    assert.equal(recon.reconciledCount, totalProducts);
  });
});
