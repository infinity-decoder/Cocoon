/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, BarChart3, TrendingUp, Calendar, Filter, 
  RefreshCw, DollarSign, Users, Package, AlertTriangle, 
  CheckCircle2, Printer, ChevronLeft, ChevronRight, 
  MessageSquare, ExternalLink, ShieldCheck, Search, Clock, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { 
  BusinessReportService, 
  DaybookReportResult, 
  SalesReportResult, 
  PurchasesReportResult, 
  CustomerAgingReportResult, 
  SupplierDuesReportResult, 
  InventoryValuationReportResult, 
  LowStockAlertItem, 
  GrossProfitReportResult, 
  ProfitAndLossReportResult, 
  CashBankSummaryItem, 
  TrialBalanceReportResult, 
  BalanceSheetReportResult, 
  AuditHistoryLogItem 
} from '../../../application/services/BusinessReportService';
import { PartyStatementResult } from '../../../infrastructure/database/repositories/PartyLedgerRepository';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';

export type ReportType = 
  | 'pl' 
  | 'balance_sheet' 
  | 'trial_balance' 
  | 'gross_profit'
  | 'daybook' 
  | 'cash_bank' 
  | 'customer_aging' 
  | 'sales' 
  | 'supplier_dues' 
  | 'purchases' 
  | 'stock_on_hand' 
  | 'inventory_valuation' 
  | 'low_stock' 
  | 'party_statement' 
  | 'audit_history';

interface ReportsViewProps {
  workspaceId: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  accounts: AccountRecord[];
  currencySymbol: string;
}

export function ReportsView({
  workspaceId,
  parties,
  products,
  accounts,
  currencySymbol
}: ReportsViewProps) {
  // Navigation
  const [activeReport, setActiveReport] = useState<ReportType>('pl');

  // Filter state
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(startOfMonth);
  const [endDate, setEndDate] = useState<string>(today);
  const [asOfDate, setAsOfDate] = useState<string>(today);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(parties[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data states for all 15 reports
  const [daybookData, setDaybookData] = useState<DaybookReportResult | null>(null);
  const [salesData, setSalesData] = useState<SalesReportResult | null>(null);
  const [purchasesData, setPurchasesData] = useState<PurchasesReportResult | null>(null);
  const [agingData, setAgingData] = useState<CustomerAgingReportResult | null>(null);
  const [supplierDuesData, setSupplierDuesData] = useState<SupplierDuesReportResult | null>(null);
  const [stockOnHandData, setStockOnHandData] = useState<{ items: any[]; totalCount: number } | null>(null);
  const [invValuationData, setInvValuationData] = useState<InventoryValuationReportResult | null>(null);
  const [lowStockData, setLowStockData] = useState<LowStockAlertItem[] | null>(null);
  const [grossProfitData, setGrossProfitData] = useState<GrossProfitReportResult | null>(null);
  const [plData, setPlData] = useState<ProfitAndLossReportResult | null>(null);
  const [cashBankData, setCashBankData] = useState<CashBankSummaryItem[] | null>(null);
  const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceReportResult | null>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetReportResult | null>(null);
  const [partyStatementData, setPartyStatementData] = useState<PartyStatementResult | null>(null);
  const [auditData, setAuditData] = useState<{ logs: AuditHistoryLogItem[]; totalCount: number } | null>(null);

  // WhatsApp reminder modal
  const [whatsappModalCustomer, setWhatsappModalCustomer] = useState<string | null>(null);

  const formatScaled = (scaled?: bigint | null) => {
    if (scaled === undefined || scaled === null) return '0.00';
    const num = Number(scaled) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pool = SqliteConnectionPool.getInstance();
      const conn = await pool.getConnection();

      switch (activeReport) {
        case 'pl': {
          const res = await BusinessReportService.getProfitAndLossReport(conn, workspaceId, { startDate, endDate });
          setPlData(res);
          break;
        }
        case 'balance_sheet': {
          const res = await BusinessReportService.getBalanceSheetReport(conn, workspaceId, asOfDate);
          setBalanceSheetData(res);
          break;
        }
        case 'trial_balance': {
          const res = await BusinessReportService.getTrialBalanceReport(conn, workspaceId, asOfDate);
          setTrialBalanceData(res);
          break;
        }
        case 'gross_profit': {
          const res = await BusinessReportService.getGrossProfitReport(conn, workspaceId, { startDate, endDate });
          setGrossProfitData(res);
          break;
        }
        case 'daybook': {
          const res = await BusinessReportService.getDaybook(conn, workspaceId, { startDate, endDate, page, pageSize });
          setDaybookData(res);
          break;
        }
        case 'cash_bank': {
          const res = await BusinessReportService.getCashBankSummary(conn, workspaceId, asOfDate);
          setCashBankData(res);
          break;
        }
        case 'customer_aging': {
          const res = await BusinessReportService.getCustomerAgingReport(conn, workspaceId, asOfDate);
          setAgingData(res);
          break;
        }
        case 'sales': {
          const res = await BusinessReportService.getSalesReport(conn, workspaceId, {
            startDate,
            endDate,
            customerId: selectedPartyId || undefined,
            productId: selectedProductId || undefined,
            status: statusFilter,
            page,
            pageSize
          });
          setSalesData(res);
          break;
        }
        case 'purchases': {
          const res = await BusinessReportService.getPurchasesReport(conn, workspaceId, {
            startDate,
            endDate,
            supplierId: selectedPartyId || undefined,
            productId: selectedProductId || undefined,
            page,
            pageSize
          });
          setPurchasesData(res);
          break;
        }
        case 'supplier_dues': {
          const res = await BusinessReportService.getSupplierDuesReport(conn, workspaceId, asOfDate);
          setSupplierDuesData(res);
          break;
        }
        case 'stock_on_hand': {
          const res = await BusinessReportService.getStockOnHandReport(conn, workspaceId, { page, pageSize });
          setStockOnHandData(res);
          break;
        }
        case 'inventory_valuation': {
          const res = await BusinessReportService.getInventoryValuationReport(conn, workspaceId);
          setInvValuationData(res);
          break;
        }
        case 'low_stock': {
          const res = await BusinessReportService.getLowStockReport(conn, workspaceId);
          setLowStockData(res);
          break;
        }
        case 'party_statement': {
          if (selectedPartyId) {
            const res = await BusinessReportService.getPartyStatementReport(conn, workspaceId, selectedPartyId, {
              startDate,
              endDate,
              page,
              pageSize
            });
            setPartyStatementData(res);
          } else {
            setPartyStatementData(null);
          }
          break;
        }
        case 'audit_history': {
          const res = await BusinessReportService.getAuditHistoryReport(conn, workspaceId, { page, pageSize });
          setAuditData(res);
          break;
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  }, [
    activeReport, workspaceId, startDate, endDate, asOfDate,
    selectedPartyId, selectedProductId, statusFilter, page
  ]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    triggerHapticFeedback();
    window.print();
  };

  const reportCategories = [
    {
      label: 'Financial Statements',
      items: [
        { id: 'pl', label: 'Profit & Loss' },
        { id: 'balance_sheet', label: 'Balance Sheet' },
        { id: 'trial_balance', label: 'Trial Balance' },
        { id: 'gross_profit', label: 'Gross Profit' },
      ]
    },
    {
      label: 'Cash & Banking',
      items: [
        { id: 'daybook', label: 'Daybook' },
        { id: 'cash_bank', label: 'Cash/Bank Summary' },
      ]
    },
    {
      label: 'Receivables & Sales',
      items: [
        { id: 'customer_aging', label: 'Customer Aging' },
        { id: 'sales', label: 'Sales Report' },
      ]
    },
    {
      label: 'Payables & Purchases',
      items: [
        { id: 'supplier_dues', label: 'Supplier Dues' },
        { id: 'purchases', label: 'Purchases Report' },
      ]
    },
    {
      label: 'Inventory & Stock',
      items: [
        { id: 'stock_on_hand', label: 'Stock on Hand' },
        { id: 'inventory_valuation', label: 'Inventory Valuation' },
        { id: 'low_stock', label: 'Low Stock Alerts' },
      ]
    },
    {
      label: 'Audit & Ledgers',
      items: [
        { id: 'party_statement', label: 'Party Statements' },
        { id: 'audit_history', label: 'Audit / History' },
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-5 text-left pb-16">
      {/* 1. Header Banner */}
      <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-indigo-400 font-bold uppercase">
              Financial & Operational Intelligence
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
              Posted Data Only
            </span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <BarChart3 size={22} className="text-indigo-400" />
            Official Business Reports
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            15 authoritative reports reconciled strictly with double-entry general ledger and inventory records.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              triggerHapticFeedback();
              loadReport();
            }}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Categorized Report Selector */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-4 flex flex-col gap-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
          Select Report
        </span>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {reportCategories.map((cat, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase tracking-wider">
                {cat.label}
              </span>
              <div className="flex flex-col gap-1">
                {cat.items.map(item => {
                  const isSelected = activeReport === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        triggerHapticFeedback();
                        setActiveReport(item.id as ReportType);
                        setPage(1);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/30'
                          : 'bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Dynamic Filter Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* As-Of Date filter for point-in-time reports */}
          {['balance_sheet', 'trial_balance', 'customer_aging', 'supplier_dues', 'cash_bank', 'inventory_valuation'].includes(activeReport) ? (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">As of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : ['pl', 'gross_profit', 'daybook', 'sales', 'purchases', 'party_statement'].includes(activeReport) ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-neutral-400 font-medium">Period:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-neutral-500 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : null}

          {/* Party dropdown for Party Statement or Sales/Purchases */}
          {['party_statement', 'sales'].includes(activeReport) && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">Customer:</span>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 max-w-[180px]"
              >
                {activeReport === 'sales' && <option value="">All Customers</option>}
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'purchases' && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">Supplier:</span>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 max-w-[180px]"
              >
                <option value="">All Suppliers</option>
                {parties.filter(p => p.type === 'supplier' || p.type === 'both').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Product filter for sales/purchases */}
          {['sales', 'purchases'].includes(activeReport) && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">Product:</span>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="bg-black/50 border border-neutral-700 text-white px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 max-w-[180px]"
              >
                <option value="">All Products</option>
                {products.map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick Date Presets */}
        {['pl', 'gross_profit', 'daybook', 'sales', 'purchases'].includes(activeReport) && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                triggerHapticFeedback();
                setStartDate(startOfMonth);
                setEndDate(today);
              }}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-neutral-300 transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              onClick={() => {
                triggerHapticFeedback();
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setStartDate(d.toISOString().slice(0, 10));
                setEndDate(today);
              }}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-neutral-300 transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => {
                triggerHapticFeedback();
                setStartDate('1970-01-01');
                setEndDate('2099-12-31');
              }}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-neutral-300 transition-colors cursor-pointer"
            >
              All Time
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. MAIN REPORT CONTENT CONTAINER */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-sm min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-neutral-400 gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs font-mono">Aggregating posted double-entry ledger data...</span>
          </div>
        ) : (
          <>
            {/* 1. PROFIT & LOSS */}
            {activeReport === 'pl' && plData && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">Profit & Loss Statement</h2>
                  <p className="text-xs text-neutral-400 font-mono">For period {plData.startDate} to {plData.endDate}</p>
                </div>

                <div className="space-y-4 text-xs font-mono">
                  {/* Revenue Section */}
                  <div className="space-y-2">
                    <span className="font-bold text-emerald-400 text-sm uppercase tracking-wider">Revenue</span>
                    <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-neutral-300">Gross Sales Revenue</span>
                        <span className="text-white">{currencySymbol} {formatScaled(plData.revenue.salesRevenueScaled)}</span>
                      </div>
                      {plData.revenue.salesReturnsDeductionScaled > 0n && (
                        <div className="flex justify-between text-rose-400">
                          <span>Less: Sales Returns & Allowances</span>
                          <span>- {currencySymbol} {formatScaled(plData.revenue.salesReturnsDeductionScaled)}</span>
                        </div>
                      )}
                      {plData.revenue.otherIncomeScaled > 0n && (
                        <div className="flex justify-between text-neutral-300">
                          <span>Other Operating Income</span>
                          <span>{currencySymbol} {formatScaled(plData.revenue.otherIncomeScaled)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-sm text-emerald-400">
                        <span>Total Net Revenue</span>
                        <span>{currencySymbol} {formatScaled(plData.revenue.totalRevenueScaled)}</span>
                      </div>
                    </div>
                  </div>

                  {/* COGS Section */}
                  <div className="space-y-2">
                    <span className="font-bold text-amber-400 text-sm uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
                    <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-neutral-300">Inventory Sales Cost Issues</span>
                        <span className="text-white">{currencySymbol} {formatScaled(plData.cogs.inventoryCogsScaled)}</span>
                      </div>
                      {plData.cogs.cogsReturnsReversedScaled > 0n && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Less: Resellable Returns Cost Reversal</span>
                          <span>- {currencySymbol} {formatScaled(plData.cogs.cogsReturnsReversedScaled)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-sm text-amber-400">
                        <span>Net Cost of Goods Sold</span>
                        <span>{currencySymbol} {formatScaled(plData.cogs.netCogsScaled)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Gross Profit Summary */}
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex justify-between items-center text-sm font-bold">
                    <span className="text-indigo-300">GROSS PROFIT</span>
                    <span className="text-white text-base">{currencySymbol} {formatScaled(plData.grossProfitScaled)}</span>
                  </div>

                  {/* Operating Expenses Section */}
                  <div className="space-y-2">
                    <span className="font-bold text-rose-400 text-sm uppercase tracking-wider">Operating Expenses</span>
                    <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                      {plData.operatingExpenses.length === 0 ? (
                        <span className="text-neutral-500 italic">No non-COGS operating expenses recorded in this period.</span>
                      ) : (
                        plData.operatingExpenses.map(exp => (
                          <div key={exp.accountId} className="flex justify-between text-neutral-300">
                            <span>{exp.accountCode} - {exp.name}</span>
                            <span>{currencySymbol} {formatScaled(exp.amountScaled)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-sm text-rose-400">
                        <span>Total Operating Expenses</span>
                        <span>{currencySymbol} {formatScaled(plData.totalOperatingExpensesScaled)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Final Net Profit or Loss */}
                  <div className={`p-4 rounded-2xl border flex justify-between items-center text-base font-black ${
                    plData.netProfitOrLossScaled >= 0n
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    <span>{plData.netProfitOrLossScaled >= 0n ? 'NET PROFIT' : 'NET LOSS'}</span>
                    <span className="text-xl">{currencySymbol} {formatScaled(plData.netProfitOrLossScaled)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BALANCE SHEET */}
            {activeReport === 'balance_sheet' && balanceSheetData && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Balance Sheet</h2>
                    <p className="text-xs text-neutral-400 font-mono">As of {balanceSheetData.asOfDate}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                    balanceSheetData.isBalanced 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    <ShieldCheck size={14} />
                    <span>{balanceSheetData.isBalanced ? 'Balanced: Assets = Liab. + Equity' : `Imbalance: ${currencySymbol} ${formatScaled(balanceSheetData.imbalanceScaled)}`}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  {/* Left Column: Assets */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="font-bold text-emerald-400 text-sm uppercase tracking-wider">Current Assets</span>
                      <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                        {balanceSheetData.assets.currentAssets.map((a, i) => (
                          <div key={i} className="flex justify-between text-neutral-300">
                            <span>{a.accountCode} - {a.name}</span>
                            <span>{currencySymbol} {formatScaled(a.balanceScaled)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-emerald-300">
                          <span>Total Current Assets</span>
                          <span>{currencySymbol} {formatScaled(balanceSheetData.assets.totalCurrentAssetsScaled)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between font-bold text-sm text-emerald-400">
                      <span>TOTAL ASSETS</span>
                      <span>{currencySymbol} {formatScaled(balanceSheetData.assets.totalAssetsScaled)}</span>
                    </div>
                  </div>

                  {/* Right Column: Liabilities & Equity */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="font-bold text-rose-400 text-sm uppercase tracking-wider">Current Liabilities</span>
                      <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                        {balanceSheetData.liabilities.currentLiabilities.map((l, i) => (
                          <div key={i} className="flex justify-between text-neutral-300">
                            <span>{l.accountCode} - {l.name}</span>
                            <span>{currencySymbol} {formatScaled(l.balanceScaled)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-rose-300">
                          <span>Total Liabilities</span>
                          <span>{currencySymbol} {formatScaled(balanceSheetData.liabilities.totalLiabilitiesScaled)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-blue-400 text-sm uppercase tracking-wider">Equity</span>
                      <div className="bg-white/5 rounded-2xl p-3 space-y-1.5 border border-white/5">
                        <div className="flex justify-between text-neutral-300">
                          <span>Owner Capital Contributed</span>
                          <span>{currencySymbol} {formatScaled(balanceSheetData.equity.capitalScaled)}</span>
                        </div>
                        {balanceSheetData.equity.drawingsScaled > 0n && (
                          <div className="flex justify-between text-rose-400">
                            <span>Less: Owner Drawings</span>
                            <span>- {currencySymbol} {formatScaled(balanceSheetData.equity.drawingsScaled)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-neutral-300">
                          <span>Current Period Net Earnings</span>
                          <span>{currencySymbol} {formatScaled(balanceSheetData.equity.currentPeriodEarningsScaled)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-blue-300">
                          <span>Total Equity</span>
                          <span>{currencySymbol} {formatScaled(balanceSheetData.equity.totalEquityScaled)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex justify-between font-bold text-sm text-blue-400">
                      <span>TOTAL LIABILITIES & EQUITY</span>
                      <span>{currencySymbol} {formatScaled(balanceSheetData.totalLiabilitiesAndEquityScaled)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TRIAL BALANCE */}
            {activeReport === 'trial_balance' && trialBalanceData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Trial Balance</h2>
                    <p className="text-xs text-neutral-400 font-mono">As of {trialBalanceData.asOfDate}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                    trialBalanceData.isBalanced 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    <ShieldCheck size={14} />
                    <span>{trialBalanceData.isBalanced ? 'Balanced: Total Debits = Total Credits' : 'Unbalanced!'}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Account Code</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Debit</th>
                        <th className="py-2.5 px-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trialBalanceData.balances.map(b => (
                        <tr key={b.accountId} className="hover:bg-white/5">
                          <td className="py-2 px-3 text-indigo-400 font-bold">{b.accountCode}</td>
                          <td className="py-2 px-3 text-white">{b.name}</td>
                          <td className="py-2 px-3 text-neutral-400 capitalize">{b.type}</td>
                          <td className="py-2 px-3 text-right text-white">
                            {b.totalDebitScaled > 0n ? `${currencySymbol} ${formatScaled(b.totalDebitScaled)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-white">
                            {b.totalCreditScaled > 0n ? `${currencySymbol} ${formatScaled(b.totalCreditScaled)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/20 font-bold text-sm">
                        <td colSpan={3} className="py-3 px-3 text-neutral-300">TOTAL TRIAL BALANCE</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(trialBalanceData.totalDebitsScaled)}</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(trialBalanceData.totalCreditsScaled)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 4. GROSS PROFIT */}
            {activeReport === 'gross_profit' && grossProfitData && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">Gross Profit Report</h2>
                  <p className="text-xs text-neutral-400 font-mono">Strict accounting formula: Net Sales - Net COGS (excludes supplier cash disbursements or capital)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 font-mono">
                    <span className="text-[10px] text-neutral-400 uppercase">Gross Sales</span>
                    <span className="text-lg font-bold text-white">{currencySymbol} {formatScaled(grossProfitData.grossSalesScaled)}</span>
                    <span className="text-[10px] text-neutral-500">Discounts: {currencySymbol} {formatScaled(grossProfitData.salesDiscountsScaled)}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 font-mono">
                    <span className="text-[10px] text-neutral-400 uppercase">Net Sales</span>
                    <span className="text-lg font-bold text-emerald-400">{currencySymbol} {formatScaled(grossProfitData.netSalesScaled)}</span>
                    <span className="text-[10px] text-neutral-500">After returns of {currencySymbol} {formatScaled(grossProfitData.salesReturnsScaled)}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 font-mono">
                    <span className="text-[10px] text-neutral-400 uppercase">Net COGS</span>
                    <span className="text-lg font-bold text-amber-400">{currencySymbol} {formatScaled(grossProfitData.netCogsScaled)}</span>
                    <span className="text-[10px] text-neutral-500">Inventory cost of goods sold</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-neutral-900 border border-emerald-500/30 flex justify-between items-center font-mono">
                  <div className="flex flex-col">
                    <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Gross Profit Realized</span>
                    <span className="text-2xl font-black text-white mt-1">{currencySymbol} {formatScaled(grossProfitData.grossProfitScaled)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-neutral-400 uppercase block">Profit Margin</span>
                    <span className="text-2xl font-black text-emerald-400">{grossProfitData.grossProfitMarginPercent.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DAYBOOK */}
            {activeReport === 'daybook' && daybookData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Cash & Bank Daybook</h2>
                    <p className="text-xs text-neutral-400 font-mono">Chronological inflow/outflow journal lines for period {daybookData.startDate} to {daybookData.endDate}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex flex-col items-end">
                      <span className="text-neutral-500 text-[10px]">Opening Balance</span>
                      <span className="text-white font-bold">{currencySymbol} {formatScaled(daybookData.openingBalanceScaled)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-neutral-500 text-[10px]">Closing Balance</span>
                      <span className="text-emerald-400 font-bold">{currencySymbol} {formatScaled(daybookData.closingBalanceScaled)}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Entry #</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Party / Particulars</th>
                        <th className="py-2.5 px-3 text-right">Inflow (Debit)</th>
                        <th className="py-2.5 px-3 text-right">Outflow (Credit)</th>
                        <th className="py-2.5 px-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {daybookData.entries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No cash or bank transactions found in this period.
                          </td>
                        </tr>
                      ) : (
                        daybookData.entries.map((e, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-2 px-3 text-neutral-300">{e.entryDate}</td>
                            <td className="py-2 px-3 text-indigo-400 font-bold">{e.entryNumber}</td>
                            <td className="py-2 px-3 text-neutral-300">{e.accountName}</td>
                            <td className="py-2 px-3 text-white max-w-[200px] truncate">
                              {e.partyName ? `${e.partyName} - ` : ''}{e.description}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-400">
                              {e.inflowScaled > 0n ? `${currencySymbol} ${formatScaled(e.inflowScaled)}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-rose-400">
                              {e.outflowScaled > 0n ? `${currencySymbol} ${formatScaled(e.outflowScaled)}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-white">
                              {currencySymbol} {formatScaled(e.runningBalanceScaled)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center pt-3 border-t border-white/10 text-xs">
                  <span className="text-neutral-400 font-mono">
                    Showing page {page} ({daybookData.entries.length} of {daybookData.totalCount} entries)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= daybookData.totalCount}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 6. CASH/BANK SUMMARY */}
            {activeReport === 'cash_bank' && cashBankData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">Cash & Bank Balances Summary</h2>
                  <p className="text-xs text-neutral-400 font-mono">Reconciled to posted journal lines as of {asOfDate}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cashBankData.map(acc => (
                    <div key={acc.accountId} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center font-mono">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{acc.name}</span>
                        <span className="text-[10px] text-neutral-400">Code: {acc.accountCode} · {acc.subCategory.toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-base font-black text-emerald-400">{currencySymbol} {formatScaled(acc.closingBalanceScaled)}</span>
                        <span className="text-[9px] text-neutral-500">Debits: {formatScaled(acc.totalDebitScaled)} | Credits: {formatScaled(acc.totalCreditScaled)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. CUSTOMER AGING */}
            {activeReport === 'customer_aging' && agingData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Customer Accounts Receivable Aging</h2>
                    <p className="text-xs text-neutral-400 font-mono">Age buckets computed from invoice due dates as of {agingData.asOfDate}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                    agingData.isReconciled 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <ShieldCheck size={14} />
                    <span>{agingData.isReconciled ? 'Reconciled to A/R (1200)' : `Discrepancy: ${currencySymbol} ${formatScaled(agingData.discrepancyScaled)}`}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">0-30 Days</th>
                        <th className="py-2.5 px-3 text-right">31-60 Days</th>
                        <th className="py-2.5 px-3 text-right">61-90 Days</th>
                        <th className="py-2.5 px-3 text-right">90+ Days</th>
                        <th className="py-2.5 px-3 text-right">Total Due</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {agingData.customers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No outstanding customer receivables found.
                          </td>
                        </tr>
                      ) : (
                        agingData.customers.map(c => (
                          <tr key={c.partyId} className="hover:bg-white/5">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-white">{c.partyName}</div>
                              {c.phone && <div className="text-[10px] text-neutral-400">{c.phone}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-right text-neutral-300">
                              {c.currentScaled > 0n ? `${currencySymbol} ${formatScaled(c.currentScaled)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-amber-400">
                              {c.days31To60Scaled > 0n ? `${currencySymbol} ${formatScaled(c.days31To60Scaled)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-orange-400">
                              {c.days61To90Scaled > 0n ? `${currencySymbol} ${formatScaled(c.days61To90Scaled)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-400 font-bold">
                              {c.over90DaysScaled > 0n ? `${currencySymbol} ${formatScaled(c.over90DaysScaled)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-white">
                              {currencySymbol} {formatScaled(c.totalDueScaled)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  triggerHapticFeedback();
                                  setWhatsappModalCustomer(c.partyId);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer mx-auto"
                              >
                                <MessageSquare size={12} />
                                <span>WhatsApp</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/20 font-bold text-sm">
                        <td className="py-3 px-3 text-neutral-300">TOTAL AGING</td>
                        <td colSpan={4} className="py-3 px-3"></td>
                        <td className="py-3 px-3 text-right text-emerald-400">
                          {currencySymbol} {formatScaled(agingData.totalReceivableAgingScaled)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 8. SALES REPORT */}
            {activeReport === 'sales' && salesData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Sales Register Report</h2>
                    <p className="text-xs text-neutral-400 font-mono">Excludes drafts/voids, includes returns and discounts</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex flex-col items-end">
                      <span className="text-neutral-500 text-[10px]">Net Sales</span>
                      <span className="text-emerald-400 font-bold">{currencySymbol} {formatScaled(salesData.totalNetSalesScaled)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-neutral-500 text-[10px]">Returns Deducted</span>
                      <span className="text-rose-400 font-bold">{currencySymbol} {formatScaled(salesData.totalReturnsScaled)}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {salesData.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">No matching sales invoices found.</td>
                        </tr>
                      ) : (
                        salesData.invoices.map(inv => (
                          <tr key={inv.documentId} className="hover:bg-white/5">
                            <td className="py-2 px-3 text-neutral-300">{inv.date}</td>
                            <td className="py-2 px-3 text-indigo-400 font-bold">{inv.documentNumber}</td>
                            <td className="py-2 px-3 text-white">{inv.partyName}</td>
                            <td className="py-2 px-3 capitalize text-neutral-400">{inv.status}</td>
                            <td className="py-2 px-3 text-right text-white font-bold">{currencySymbol} {formatScaled(inv.totalScaled)}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(inv.paidAmountScaled)}</td>
                            <td className="py-2 px-3 text-right text-rose-400">{currencySymbol} {formatScaled(inv.remainingDueScaled)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center pt-3 border-t border-white/10 text-xs">
                  <span className="text-neutral-400 font-mono">
                    Page {page} ({salesData.invoices.length} of {salesData.totalCount} invoices)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= salesData.totalCount}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 9. SUPPLIER DUES */}
            {activeReport === 'supplier_dues' && supplierDuesData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Supplier Amounts Payable (A/P)</h2>
                    <p className="text-xs text-neutral-400 font-mono">As of {supplierDuesData.asOfDate}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                    supplierDuesData.isReconciled 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <ShieldCheck size={14} />
                    <span>{supplierDuesData.isReconciled ? 'Reconciled to A/P (2010)' : 'Reconciliation Discrepancy'}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {supplierDuesData.suppliers.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 text-xs">No pending supplier dues recorded.</div>
                  ) : (
                    supplierDuesData.suppliers.map(s => (
                      <div key={s.partyId} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">{s.partyName}</span>
                          <span className="text-sm font-black text-rose-400 font-mono">
                            Total Due: {currencySymbol} {formatScaled(s.totalDueScaled)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {s.bills.map(b => (
                            <div key={b.billId} className="flex justify-between items-center text-xs font-mono text-neutral-400 py-0.5">
                              <span>Bill #{b.billNumber} (Due: {b.dueDate}) {b.isOverdue && <span className="text-rose-400 font-bold ml-1">OVERDUE</span>}</span>
                              <span className="text-white">{currencySymbol} {formatScaled(b.dueAmountScaled)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 10. PURCHASES REPORT */}
            {activeReport === 'purchases' && purchasesData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Purchases Register Report</h2>
                    <p className="text-xs text-neutral-400 font-mono">Posted supplier bills and purchase returns</p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-neutral-500 text-[10px] block">Net Purchases</span>
                    <span className="text-emerald-400 font-bold text-sm">{currencySymbol} {formatScaled(purchasesData.totalNetPurchasesScaled)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Bill #</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {purchasesData.bills.map(b => (
                        <tr key={b.billId} className="hover:bg-white/5">
                          <td className="py-2 px-3 text-neutral-300">{b.date}</td>
                          <td className="py-2 px-3 text-indigo-400 font-bold">{b.billNumber}</td>
                          <td className="py-2 px-3 text-white">{b.supplierName}</td>
                          <td className="py-2 px-3 capitalize text-neutral-400">{b.status}</td>
                          <td className="py-2 px-3 text-right text-white font-bold">{currencySymbol} {formatScaled(b.totalScaled)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(b.paidAmountScaled)}</td>
                          <td className="py-2 px-3 text-right text-rose-400">{currencySymbol} {formatScaled(b.remainingDueScaled)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 11. STOCK ON HAND */}
            {activeReport === 'stock_on_hand' && stockOnHandData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">Stock on Hand Report</h2>
                  <p className="text-xs text-neutral-400 font-mono">Current quantities reconciled to posted inventory stock movements</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">SKU / Barcode</th>
                        <th className="py-2.5 px-3 text-right">Current Stock</th>
                        <th className="py-2.5 px-3 text-right">Reorder Threshold</th>
                        <th className="py-2.5 px-3 text-right">Cost Price</th>
                        <th className="py-2.5 px-3 text-right">Sale Price</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stockOnHandData.items.map(item => (
                        <tr key={item.productId} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-bold text-white">{item.productName}</td>
                          <td className="py-2.5 px-3 text-neutral-400">{item.sku || item.barcode || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-black text-white">{item.currentStock} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-400">{item.reorderThreshold} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-300">{currencySymbol} {formatScaled(item.costPriceScaled)}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(item.salePriceScaled)}</td>
                          <td className="py-2.5 px-3 text-center">
                            {item.isLowStock ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. INVENTORY VALUATION */}
            {activeReport === 'inventory_valuation' && invValuationData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Inventory Valuation Report</h2>
                    <p className="text-xs text-neutral-400 font-mono">Weighted Average Cost (WAC) valuation method</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                    invValuationData.isReconciled 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <ShieldCheck size={14} />
                    <span>{invValuationData.isReconciled ? 'Reconciled to Inventory Asset (1300)' : 'Reconciliation Discrepancy'}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Unit WAC</th>
                        <th className="py-2.5 px-3 text-right">Total Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invValuationData.items.map(item => (
                        <tr key={item.productId} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-bold text-white">{item.productName}</td>
                          <td className="py-2 px-3 text-neutral-400">{item.unit}</td>
                          <td className="py-2 px-3 text-right text-white">{item.currentStock}</td>
                          <td className="py-2 px-3 text-right text-neutral-300">{currencySymbol} {formatScaled(item.weightedAvgCostScaled)}</td>
                          <td className="py-2 px-3 text-right font-black text-emerald-400">{currencySymbol} {formatScaled(item.totalValuationScaled)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/20 font-bold text-sm">
                        <td colSpan={4} className="py-3 px-3 text-neutral-300">TOTAL INVENTORY VALUE</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{currencySymbol} {formatScaled(invValuationData.totalValuationScaled)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 13. LOW STOCK ALERTS */}
            {activeReport === 'low_stock' && lowStockData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">Low Stock & Reorder Report</h2>
                  <p className="text-xs text-neutral-400 font-mono">Items currently at or below minimum threshold requiring purchase orders</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lowStockData.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-neutral-500 text-xs">All catalog items have healthy stock levels above reorder thresholds.</div>
                  ) : (
                    lowStockData.map(item => (
                      <div key={item.productId} className="p-4 rounded-2xl bg-white/5 border border-rose-500/20 flex justify-between items-center font-mono">
                        <div>
                          <span className="text-sm font-bold text-white block">{item.productName}</span>
                          <span className="text-[11px] text-rose-400">
                            Current: {item.currentStock} {item.unit} (Min: {item.reorderThreshold} {item.unit})
                          </span>
                          <span className="text-[10px] text-neutral-400 block mt-0.5">
                            Deficit to Order: {item.deficitQuantity} {item.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block uppercase">Est. Reorder Cost</span>
                          <span className="text-sm font-bold text-white">{currencySymbol} {formatScaled(item.estimatedReorderCostScaled)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 14. PARTY STATEMENT */}
            {activeReport === 'party_statement' && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-white">Party Statement of Account</h2>
                    <p className="text-xs text-neutral-400 font-mono">Opening balance, debits, credits, and closing balance</p>
                  </div>
                  {partyStatementData && (
                    <div className="text-right font-mono text-xs">
                      <span className="text-neutral-500 text-[10px] block">Closing Balance</span>
                      <span className={`font-black text-sm ${partyStatementData.closingBalanceScaled >= 0n ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currencySymbol} {formatScaled(partyStatementData.closingBalanceScaled)}
                      </span>
                    </div>
                  )}
                </div>

                {!partyStatementData ? (
                  <div className="text-center py-8 text-neutral-500 text-xs">Select a customer or supplier above to view their verified statement.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-neutral-400">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Ref #</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Debit</th>
                          <th className="py-2.5 px-3 text-right">Credit</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {partyStatementData.entries.map((e, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-2 px-3 text-neutral-300">{e.entryDate}</td>
                            <td className="py-2 px-3 text-indigo-400 font-bold">{e.referenceNumber}</td>
                            <td className="py-2 px-3 text-neutral-400 capitalize">{e.transactionType}</td>
                            <td className="py-2 px-3 text-white">{e.description}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{e.debitScaled > 0n ? `${currencySymbol} ${formatScaled(e.debitScaled)}` : '-'}</td>
                            <td className="py-2 px-3 text-right text-rose-400">{e.creditScaled > 0n ? `${currencySymbol} ${formatScaled(e.creditScaled)}` : '-'}</td>
                            <td className="py-2 px-3 text-right font-bold text-white">{currencySymbol} {formatScaled(e.runningBalanceScaled)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 15. AUDIT / HISTORY */}
            {activeReport === 'audit_history' && auditData && (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white">System Audit & Ledger History</h2>
                  <p className="text-xs text-neutral-400 font-mono">Immutable audit trail of journal entries, reversals, and adjustments</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Reference #</th>
                        <th className="py-2.5 px-3">Source Type</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditData.logs.map(log => (
                        <tr key={log.id} className="hover:bg-white/5">
                          <td className="py-2 px-3 text-neutral-400">{log.timestamp}</td>
                          <td className="py-2 px-3 text-indigo-400 font-bold">{log.referenceNumber}</td>
                          <td className="py-2 px-3 text-neutral-300 uppercase text-[10px]">{log.type}</td>
                          <td className="py-2 px-3 text-white">{log.actor}</td>
                          <td className="py-2 px-3 text-neutral-200 max-w-[260px] truncate">{log.description}</td>
                          <td className="py-2 px-3 text-center">
                            {log.isReversal ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                REVERSAL
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                                POSTED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center pt-3 border-t border-white/10 text-xs">
                  <span className="text-neutral-400 font-mono">
                    Page {page} ({auditData.logs.length} of {auditData.totalCount} audit logs)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= auditData.totalCount}
                      className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 text-white cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* WhatsApp Reminder Modal */}
      {whatsappModalCustomer && (
        <WhatsAppReminderModal
          isOpen={!!whatsappModalCustomer}
          workspaceId={workspaceId}
          customerId={whatsappModalCustomer}
          currencySymbol={currencySymbol}
          onClose={() => setWhatsappModalCustomer(null)}
        />
      )}
    </div>
  );
}
