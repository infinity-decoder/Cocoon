/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, Plus, Search, Filter, Calendar, Truck, 
  RotateCcw, DollarSign, FileSpreadsheet, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, AlertCircle, Eye, ArrowUpRight
} from 'lucide-react';
import { 
  PurchaseBillWithLines, 
  PurchaseOrderWithLines, 
  GoodsReceiptWithLines, 
  PurchaseReturnWithLines 
} from '../../../infrastructure/database/repositories/PurchaseRepository';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { PurchaseService, PurchaseSummaryMetrics } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { CreatePurchaseBillModal } from './CreatePurchaseBillModal';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { RecordGoodsReceiptModal } from './RecordGoodsReceiptModal';
import { RecordPurchaseReturnModal } from './RecordPurchaseReturnModal';
import { RecordBillPaymentModal } from './RecordBillPaymentModal';

interface PurchasesViewProps {
  workspaceId: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  accounts: AccountRecord[];
  currencySymbol: string;
}

export function PurchasesView({
  workspaceId,
  parties,
  products,
  accounts,
  currencySymbol
}: PurchasesViewProps) {
  const [activeTab, setActiveTab] = useState<'bills' | 'orders' | 'receipts' | 'returns'>('bills');
  const [summary, setSummary] = useState<PurchaseSummaryMetrics | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Data lists
  const [bills, setBills] = useState<PurchaseBillWithLines[]>([]);
  const [billsTotal, setBillsTotal] = useState(0);

  const [orders, setOrders] = useState<PurchaseOrderWithLines[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);

  const [receipts, setReceipts] = useState<GoodsReceiptWithLines[]>([]);
  const [receiptsTotal, setReceiptsTotal] = useState(0);

  const [returns, setReturns] = useState<PurchaseReturnWithLines[]>([]);
  const [returnsTotal, setReturnsTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);
  const [receiptPO, setReceiptPO] = useState<PurchaseOrderWithLines | null>(null);
  const [returnBill, setReturnBill] = useState<PurchaseBillWithLines | null>(null);
  const [paymentBill, setPaymentBill] = useState<PurchaseBillWithLines | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      // 1. Load metrics
      const sum = await PurchaseService.getPurchaseSummary(
        conn,
        workspaceId,
        startDate || undefined,
        endDate || undefined
      );
      setSummary(sum);

      const offset = (currentPage - 1) * pageSize;
      const commonFilter = {
        supplierId: selectedSupplierId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchQuery.trim() || undefined,
        limit: pageSize,
        offset
      };

      if (activeTab === 'bills') {
        const res = await PurchaseService.listPurchaseBills(conn, workspaceId, {
          ...commonFilter,
          paymentStatus: statusFilter as any
        });
        setBills(res.bills);
        setBillsTotal(res.total);
      } else if (activeTab === 'orders') {
        const res = await PurchaseService.listPurchaseOrders(conn, workspaceId, {
          ...commonFilter,
          status: statusFilter || undefined
        });
        setOrders(res.orders);
        setOrdersTotal(res.total);
      } else if (activeTab === 'receipts') {
        const res = await PurchaseService.listGoodsReceipts(conn, workspaceId, commonFilter);
        setReceipts(res.receipts);
        setReceiptsTotal(res.total);
      } else if (activeTab === 'returns') {
        const res = await PurchaseService.listPurchaseReturns(conn, workspaceId, commonFilter);
        setReturns(res.returns);
        setReturnsTotal(res.total);
      }
    } catch (err) {
      console.error('Failed to load purchase data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, activeTab, searchQuery, selectedSupplierId, statusFilter, startDate, endDate, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatScaled = (scaledVal?: bigint | number | string) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currentTabTotal =
    activeTab === 'bills'
      ? billsTotal
      : activeTab === 'orders'
      ? ordersTotal
      : activeTab === 'receipts'
      ? receiptsTotal
      : returnsTotal;

  const totalPages = Math.max(1, Math.ceil(currentTabTotal / pageSize));

  return (
    <div className="flex flex-col gap-4 text-white text-left">
      {/* 1. Header & Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Purchases */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Total Purchases</span>
            <ShoppingBag size={14} className="text-blue-400" />
          </div>
          <span className="text-base font-black text-white font-mono mt-1">
            {currencySymbol} {formatScaled(summary?.totalPurchasesScaled)}
          </span>
          <span className="text-[10px] text-neutral-400">Recorded bills</span>
        </div>

        {/* Outstanding Payables */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Outstanding Payables</span>
            <Clock size={14} className="text-rose-400" />
          </div>
          <span className="text-base font-black text-rose-400 font-mono mt-1">
            {currencySymbol} {formatScaled(summary?.outstandingPayablesScaled)}
          </span>
          <span className="text-[10px] text-neutral-400">Supplier liabilities</span>
        </div>

        {/* Pending POs */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Pending Receipts</span>
            <Truck size={14} className="text-amber-400" />
          </div>
          <span className="text-base font-black text-amber-400 font-mono mt-1">
            {summary?.pendingReceiptsCount || 0} Orders
          </span>
          <span className="text-[10px] text-neutral-400">Awaiting delivery</span>
        </div>

        {/* Returns / Credit Notes */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Debit Notes & Returns</span>
            <RotateCcw size={14} className="text-purple-400" />
          </div>
          <span className="text-base font-black text-purple-400 font-mono mt-1">
            {currencySymbol} {formatScaled(summary?.totalReturnsScaled)}
          </span>
          <span className="text-[10px] text-neutral-400">Returned to supplier</span>
        </div>
      </div>

      {/* 2. Tab Navigation & Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {(
            [
              { id: 'bills', label: 'Purchase Bills', icon: ShoppingBag, count: billsTotal },
              { id: 'orders', label: 'Purchase Orders', icon: FileSpreadsheet, count: ordersTotal },
              { id: 'receipts', label: 'Goods Receipts', icon: Truck, count: receiptsTotal },
              { id: 'returns', label: 'Returns', icon: RotateCcw, count: returnsTotal }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHapticFeedback();
              setIsCreatePOOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            <span>+ Purchase Order</span>
          </button>

          <button
            onClick={() => {
              triggerHapticFeedback();
              setIsCreateBillOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            <span>+ Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* 3. Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-neutral-900 border border-white/10">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search bill #, PO #, supplier..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-neutral-800 border border-white/5 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Supplier Filter */}
        <div>
          <select
            value={selectedSupplierId}
            onChange={e => {
              setSelectedSupplierId(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-neutral-800 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Suppliers</option>
            {parties
              .filter(p => p.type === 'supplier' || p.type === 'both')
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-neutral-800 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {activeTab === 'bills' ? (
              <>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Fully Paid</option>
              </>
            ) : activeTab === 'orders' ? (
              <>
                <option value="ordered">Ordered</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Fully Received</option>
                <option value="cancelled">Cancelled</option>
              </>
            ) : (
              <>
                <option value="received">Received</option>
                <option value="reconciled">Reconciled</option>
              </>
            )}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-1/2 bg-neutral-800 border border-white/5 rounded-xl px-2 py-1.5 text-[11px] text-white"
            placeholder="From"
          />
          <span className="text-neutral-500 text-xs">-</span>
          <input
            type="date"
            value={endDate}
            onChange={e => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-1/2 bg-neutral-800 border border-white/5 rounded-xl px-2 py-1.5 text-[11px] text-white"
            placeholder="To"
          />
        </div>
      </div>

      {/* 4. Active Tab Data Table */}
      <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-neutral-400">Loading purchase records...</div>
        ) : activeTab === 'bills' ? (
          /* BILLS TABLE */
          bills.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400">
              No purchase bills found matching current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-mono uppercase">
                  <tr>
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Date / Due</th>
                    <th className="py-3 px-4">Receipt Status</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Remaining</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bills.map(bill => {
                    const remaining = BigInt(bill.totalScaled) - BigInt(bill.paidAmountScaled);
                    return (
                      <tr key={bill.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                          {bill.billNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-white">
                          {bill.supplierName}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                          <div>{bill.billDate}</div>
                          <div className="text-[10px] text-neutral-500">Due: {bill.dueDate}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              bill.receiptStatus === 'received'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : bill.receiptStatus === 'partially_received'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-neutral-800 text-neutral-400 border border-white/10'
                            }`}
                          >
                            {bill.receiptStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              bill.paymentStatus === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : bill.paymentStatus === 'partially_paid'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {bill.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                          {currencySymbol} {formatScaled(bill.totalScaled)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-neutral-300">
                          {remaining > 0n ? (
                            <span className="text-rose-400 font-bold">
                              {currencySymbol} {formatScaled(remaining)}
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">Settled</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {remaining > 0n && (
                              <button
                                onClick={() => {
                                  triggerHapticFeedback();
                                  setPaymentBill(bill);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition-all cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => {
                                triggerHapticFeedback();
                                setReturnBill(bill);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'orders' ? (
          /* ORDERS TABLE */
          orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400">
              No purchase orders found matching current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-mono uppercase">
                  <tr>
                    <th className="py-3 px-4">PO #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Expected Delivery</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Total Commitment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map(po => (
                    <tr key={po.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                        {po.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {po.supplierName}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                        {po.orderDate}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                        {po.expectedDeliveryDate || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            po.orderStatus === 'received'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : po.orderStatus === 'partially_received'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {po.orderStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {currencySymbol} {formatScaled(po.totalScaled)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {po.orderStatus !== 'received' && po.orderStatus !== 'cancelled' && (
                          <button
                            onClick={() => {
                              triggerHapticFeedback();
                              setReceiptPO(po);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Receive Goods
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'receipts' ? (
          /* GOODS RECEIPTS TABLE */
          receipts.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400">
              No goods receipts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-mono uppercase">
                  <tr>
                    <th className="py-3 px-4">GRN #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Receipt Date</th>
                    <th className="py-3 px-4">Items Received</th>
                    <th className="py-3 px-4">Received / Short / Damaged</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {receipts.map(grn => {
                    const totalRec = grn.lines.reduce((acc, l) => acc + l.receivedQuantity, 0);
                    const totalShort = grn.lines.reduce((acc, l) => acc + l.shortQuantity, 0);
                    const totalDamaged = grn.lines.reduce((acc, l) => acc + l.damagedQuantity, 0);
                    return (
                      <tr key={grn.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                          {grn.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-white">{grn.supplierName}</td>
                        <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                          {grn.receiptDate}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-300">
                          {grn.lines.length} products
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <span className="text-emerald-400 font-bold">{totalRec} rec</span>
                          {totalShort > 0 && <span className="text-amber-400 ml-2">{totalShort} short</span>}
                          {totalDamaged > 0 && (
                            <span className="text-rose-400 ml-2">{totalDamaged} damaged</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {grn.receiptStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* RETURNS TABLE */
          returns.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400">
              No purchase returns recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-mono uppercase">
                  <tr>
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Settlement</th>
                    <th className="py-3 px-4 text-right">Return Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {returns.map(ret => (
                    <tr key={ret.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                        {ret.returnNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">{ret.supplierName}</td>
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                        {ret.returnDate}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-300 max-w-[200px] truncate">
                        {ret.reason}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-mono text-[11px] text-neutral-400">
                        {ret.settlementType.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400">
                        {currencySymbol} {formatScaled(ret.totalScaled)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-neutral-950/40 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
          <span>
            Showing {currentTabTotal > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, currentTabTotal)} of {currentTabTotal} records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-white text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreatePurchaseBillModal
        isOpen={isCreateBillOpen}
        onClose={() => setIsCreateBillOpen(false)}
        onSuccess={loadData}
        workspaceId={workspaceId}
        parties={parties}
        products={products}
        accounts={accounts}
        currencySymbol={currencySymbol}
      />

      <CreatePurchaseOrderModal
        isOpen={isCreatePOOpen}
        onClose={() => setIsCreatePOOpen(false)}
        onSuccess={loadData}
        workspaceId={workspaceId}
        parties={parties}
        products={products}
        currencySymbol={currencySymbol}
      />

      <RecordGoodsReceiptModal
        isOpen={Boolean(receiptPO)}
        onClose={() => setReceiptPO(null)}
        onSuccess={loadData}
        workspaceId={workspaceId}
        order={receiptPO}
      />

      <RecordPurchaseReturnModal
        isOpen={Boolean(returnBill)}
        onClose={() => setReturnBill(null)}
        onSuccess={loadData}
        workspaceId={workspaceId}
        bill={returnBill}
        currencySymbol={currencySymbol}
      />

      <RecordBillPaymentModal
        isOpen={Boolean(paymentBill)}
        onClose={() => setPaymentBill(null)}
        onSuccess={loadData}
        workspaceId={workspaceId}
        bill={paymentBill}
        accounts={accounts}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
