/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Search, Filter, Calendar, RotateCcw, 
  Printer, Share2, CheckCircle2, Clock, AlertCircle, 
  ArrowUpRight, ArrowLeft, Plus, ChevronLeft, ChevronRight,
  CreditCard, DollarSign, Split, Users, FileText
} from 'lucide-react';
import { DocumentWithLines } from '../../../infrastructure/database/repositories/DocumentRepository';
import { SalesReturnWithLines } from '../../../infrastructure/database/repositories/SalesRepository';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { SaleService } from '../../../application/services/SaleService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { POSScreen } from './POSScreen';
import { ReceiptModal, ReceiptData } from './ReceiptModal';
import { RecordSalesReturnModal } from './RecordSalesReturnModal';

interface SalesViewProps {
  workspaceId: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  accounts: AccountRecord[];
  currencySymbol: string;
  onRefreshWorkspace?: () => void;
}

export function SalesView({
  workspaceId,
  parties,
  products,
  accounts,
  currencySymbol,
  onRefreshWorkspace
}: SalesViewProps) {
  // Navigation: sales dashboard list vs active POS terminal
  const [viewMode, setViewMode] = useState<'list' | 'pos'>('list');
  const [activeTab, setActiveTab] = useState<'invoices' | 'returns'>('invoices');

  // Filter & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Data state
  const [invoices, setInvoices] = useState<DocumentWithLines[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [returns, setReturns] = useState<SalesReturnWithLines[]>([]);
  const [returnsTotal, setReturnsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [selectedReceiptData, setSelectedReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<DocumentWithLines | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Load Invoices
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const conn = await SqliteConnectionPool.getInstance().getConnection();
      const res = await SaleService.getSalesDocuments(conn, workspaceId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        searchQuery: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        pageSize
      });
      setInvoices(res.documents);
      setInvoicesTotal(res.total);
    } catch (err) {
      console.error('Error loading sales invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, statusFilter, searchQuery, startDate, endDate, currentPage, pageSize]);

  // Load Returns
  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const conn = await SqliteConnectionPool.getInstance().getConnection();
      const res = await SaleService.getSalesReturns(conn, workspaceId, {
        page: currentPage,
        pageSize
      });
      setReturns(res.returns);
      setReturnsTotal(res.total);
    } catch (err) {
      console.error('Error loading sales returns:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, currentPage, pageSize]);

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
    } else {
      loadReturns();
    }
  }, [activeTab, loadInvoices, loadReturns]);

  const formatScaled = (scaledVal?: bigint | number) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Convert DocumentWithLines into ReceiptData format for preview
  const handleViewReceipt = (doc: DocumentWithLines) => {
    triggerHapticFeedback();
    const remainingScaled = doc.totalScaled - doc.paidAmountScaled;
    const receipt: ReceiptData = {
      businessName: 'Business Workspace',
      invoiceNumber: doc.documentNumber,
      date: doc.issueDate,
      customerName: doc.partyName || 'Walk-in Cash Customer',
      currencySymbol,
      lines: doc.lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.packageUnit || 'pcs',
        unitPriceScaled: l.unitPriceScaled,
        discountScaled: l.discountScaled || 0n,
        taxScaled: l.taxScaled || 0n,
        totalScaled: l.totalScaled
      })),
      subtotalScaled: doc.subtotalScaled,
      discountScaled: doc.discountScaled,
      taxScaled: doc.taxScaled,
      totalScaled: doc.totalScaled,
      paidAmountScaled: doc.paidAmountScaled,
      changeOrDueScaled: remainingScaled,
      paymentMethod: doc.paymentMethod || (doc.status === 'paid' ? 'cash' : 'credit')
    };

    setSelectedReceiptData(receipt);
    setIsReceiptModalOpen(true);
  };

  // Open Sales Return modal
  const handleOpenReturnModal = (doc: DocumentWithLines) => {
    triggerHapticFeedback();
    setReturnInvoice(doc);
    setIsReturnModalOpen(true);
  };

  // If in POS mode, show full interactive POS screen
  if (viewMode === 'pos') {
    return (
      <POSScreen
        workspaceId={workspaceId}
        currencySymbol={currencySymbol}
        parties={parties}
        products={products}
        accounts={accounts}
        onSaleCompleted={() => {
          loadInvoices();
          if (onRefreshWorkspace) onRefreshWorkspace();
        }}
        onBackToDashboard={() => {
          triggerHapticFeedback();
          setViewMode('list');
          loadInvoices();
        }}
      />
    );
  }

  // Calculate summary metrics
  const totalSalesVolumeScaled = invoices.reduce((acc, doc) => acc + doc.totalScaled, 0n);
  const totalPaidScaled = invoices.reduce((acc, doc) => acc + doc.paidAmountScaled, 0n);
  const totalReceivablesScaled = totalSalesVolumeScaled - totalPaidScaled;
  const totalReturnsScaled = returns.reduce((acc, ret) => acc + ret.totalScaled, 0n);

  return (
    <div className="flex flex-col gap-4 text-left select-none pb-8">
      {/* 1. TOP HERO ACTIONS & POS REGISTER LAUNCHER */}
      <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-900 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShoppingBag size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Point of Sale & Sales Register</h2>
            <p className="text-xs text-neutral-400">
              Offline counter sales, barcode scanning, thermal receipts & customer refunds
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHapticFeedback();
            setViewMode('pos');
          }}
          className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Open POS Terminal
        </button>
      </div>

      {/* 2. SUMMARY METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 bg-neutral-900 border border-white/5 rounded-2xl flex flex-col">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Sales Invoices</span>
          <span className="text-lg font-black text-white font-mono mt-0.5">{invoicesTotal}</span>
          <span className="text-[10px] text-neutral-500">Recorded invoices</span>
        </div>

        <div className="p-3 bg-neutral-900 border border-white/5 rounded-2xl flex flex-col">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Page Revenue</span>
          <span className="text-lg font-black text-emerald-400 font-mono mt-0.5">
            {currencySymbol} {formatScaled(totalSalesVolumeScaled)}
          </span>
          <span className="text-[10px] text-emerald-500/80">Total gross billed</span>
        </div>

        <div className="p-3 bg-neutral-900 border border-white/5 rounded-2xl flex flex-col">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Open Receivables</span>
          <span className="text-lg font-black text-amber-400 font-mono mt-0.5">
            {currencySymbol} {formatScaled(totalReceivablesScaled)}
          </span>
          <span className="text-[10px] text-amber-500/80">Pending customer balance</span>
        </div>

        <div className="p-3 bg-neutral-900 border border-white/5 rounded-2xl flex flex-col">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Customer Returns</span>
          <span className="text-lg font-black text-rose-400 font-mono mt-0.5">
            {currencySymbol} {formatScaled(totalReturnsScaled)}
          </span>
          <span className="text-[10px] text-rose-500/80">{returnsTotal} returns recorded</span>
        </div>
      </div>

      {/* 3. TABS: SALES INVOICES vs CUSTOMER RETURNS */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            triggerHapticFeedback();
            setActiveTab('invoices');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'invoices'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          Sales Invoices ({invoicesTotal})
        </button>

        <button
          onClick={() => {
            triggerHapticFeedback();
            setActiveTab('returns');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'returns'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          Customer Returns ({returnsTotal})
        </button>
      </div>

      {/* 4. FILTERS BAR (For Invoices) */}
      {activeTab === 'invoices' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-neutral-900 border border-white/5 p-2.5 rounded-2xl">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer name..."
              className="w-full bg-neutral-950 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid / Credit</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-1/2 bg-neutral-950 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-white"
              title="From date"
            />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-1/2 bg-neutral-950 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-white"
              title="To date"
            />
          </div>
        </div>
      )}

      {/* 5. DATA TABLES */}
      {activeTab === 'invoices' ? (
        <div className="bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-neutral-500">Loading sales invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <FileText size={24} className="opacity-40" />
              <span>No sales invoices found matching your filters.</span>
              <button
                onClick={() => setViewMode('pos')}
                className="mt-2 text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                + Launch POS to create a new sale
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-neutral-950/60 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {invoices.map(doc => {
                    const remainingScaled = doc.totalScaled - doc.paidAmountScaled;
                    return (
                      <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                          {doc.documentNumber}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                          {doc.issueDate}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-white font-medium truncate max-w-[140px]">
                          {doc.partyName || 'Walk-in Cash Customer'}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {doc.lines.length} items
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                          {currencySymbol} {formatScaled(doc.totalScaled)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 whitespace-nowrap">
                          {currencySymbol} {formatScaled(doc.paidAmountScaled)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-400 whitespace-nowrap">
                          {currencySymbol} {formatScaled(remainingScaled)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-sans uppercase tracking-wider ${
                              doc.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : doc.status === 'partial'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleViewReceipt(doc)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-blue-600/20 text-neutral-400 hover:text-blue-400 transition-colors cursor-pointer"
                              title="Preview & Share Thermal Receipt"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenReturnModal(doc)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-amber-600/20 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                              title="Process Customer Sales Return"
                            >
                              <RotateCcw size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination controls */}
          {invoicesTotal > pageSize && (
            <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
              <span>
                Page {currentPage} of {Math.ceil(invoicesTotal / pageSize)} ({invoicesTotal} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage * pageSize >= invoicesTotal}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Customer Returns List */
        <div className="bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-neutral-500">Loading sales returns...</div>
          ) : returns.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <RotateCcw size={24} className="opacity-40" />
              <span>No customer returns recorded yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-neutral-950/60 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Return #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Settlement</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Refund Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {returns.map(ret => (
                    <tr key={ret.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-amber-400 whitespace-nowrap">
                        {ret.returnNumber}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                        {ret.returnDate}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-white font-medium truncate max-w-[140px]">
                        {ret.partyName}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-sans text-neutral-300 capitalize">
                        {ret.settlementType.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-neutral-400 truncate max-w-[160px]">
                        {ret.reason}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400 whitespace-nowrap">
                        {currencySymbol} {formatScaled(ret.totalScaled)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {returnsTotal > pageSize && (
            <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
              <span>
                Page {currentPage} of {Math.ceil(returnsTotal / pageSize)} ({returnsTotal} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage * pageSize >= returnsTotal}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. RECEIPT PREVIEW & SHARE MODAL */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={selectedReceiptData}
      />

      {/* 7. RECORD SALES RETURN MODAL */}
      <RecordSalesReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnInvoice(null);
        }}
        onSuccess={() => {
          loadInvoices();
          loadReturns();
          if (onRefreshWorkspace) onRefreshWorkspace();
        }}
        workspaceId={workspaceId}
        invoice={returnInvoice}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
