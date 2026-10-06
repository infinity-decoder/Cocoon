/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  Search, Filter, Calendar, CreditCard, ChevronDown, Trash2, Edit, 
  FileSpreadsheet, Printer, ShieldCheck, X, ChevronRight, Pencil, ChevronLeft, ArrowLeft 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Category, NotificationType } from '../../../core/types';
import { CATEGORY_ICONS_MAP } from '../../categories';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface TransactionsTabProps {
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: string[];
  currencySymbol: string;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (id: string, updatedData: Partial<Transaction>) => void;
  onAddNotification?: (title: string, message: string, type: NotificationType) => void;
  onBack?: () => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
}

export default function TransactionsTab({
  transactions,
  categories,
  paymentMethods,
  currencySymbol,
  onDeleteTransaction,
  onEditTransaction,
  onAddNotification,
  onBack,
  themeCardBg
}: TransactionsTabProps) {
  // Active swiped item state: { id: string; action: 'edit' | 'delete' } | null
  const [swipedTx, setSwipedTx] = useState<{ id: string; action: 'edit' | 'delete' } | null>(null);

  // Filters & search state
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export panel states
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportScope, setExportScope] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const [exportFilter, setExportFilter] = useState<'combined' | 'expense' | 'income'>('combined');
  const [pdfPassword, setPdfPassword] = useState('');
  const [encryptPdf, setEncryptPdf] = useState(false);

  // Edit form dialog states
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editError, setEditError] = useState('');

  // Core Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Search term filter
      const matchesSearch = 
        t.note.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.amount.toString().includes(searchTerm);

      // Type filter
      const matchesType = 
        filterType === 'all' || 
        t.type === filterType || 
        (filterType === 'expense' && t.type === 'savings_deposit') || 
        (filterType === 'income' && t.type === 'savings_withdraw');

      // Category filter
      const matchesCategory = 
        filterCategory === 'all' || 
        t.category.toLowerCase() === filterCategory.toLowerCase();

      // Payment method filter
      const matchesPayment = 
        filterPayment === 'all' || 
        t.paymentMethod === filterPayment;

      // Min/Max amount
      const min = parseFloat(filterMinAmount);
      const max = parseFloat(filterMaxAmount);
      const matchesMin = isNaN(min) || t.amount >= min;
      const matchesMax = isNaN(max) || t.amount <= max;

      // Date range
      const tDate = new Date(t.date);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');

      return matchesSearch && matchesType && matchesCategory && matchesPayment && matchesMin && matchesMax && matchesStart && matchesEnd;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPayment, filterMinAmount, filterMaxAmount, startDate, endDate]);

  // Group filtered transactions by Date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    filteredTransactions.forEach(t => {
      const dateStr = t.date.split('T')[0];
      let header = '';

      if (dateStr === todayStr) {
        header = 'Today';
      } else if (dateStr === yesterdayStr) {
        header = 'Yesterday';
      } else {
        const dObj = new Date(t.date);
        header = dObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }

      if (!groups[header]) {
        groups[header] = [];
      }
      groups[header].push(t);
    });

    return groups;
  }, [filteredTransactions]);

  // Export CSV Helper
  const handleExportCSV = () => {
    triggerHapticFeedback();
    const headers = ['ID', 'Type', 'Amount', 'Currency', 'Date', 'Category', 'Note', 'Wallet', 'Payment Method'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.type,
      t.amount,
      t.currency,
      t.date,
      t.category,
      t.note,
      t.walletId,
      t.paymentMethod
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cocoon_export_${exportScope}_${exportFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportPanel(false);

    if (onAddNotification) {
      onAddNotification(
        'Excel/CSV Exported',
        `Your financial records (${exportScope}) have been exported as a CSV file.`,
        'excel_export'
      );
    }
  };

  // Printable Report Generation (Simulated PDF Print Layout)
  const handlePrintPDF = () => {
    triggerHapticFeedback();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (onAddNotification) {
        onAddNotification(
          'Pop-up Blocked',
          'Please allow popups to preview and print the report.',
          'pdf_export'
        );
      }
      return;
    }

    const reportTitle = `Cocoon Premium Financial Report - ${exportScope.toUpperCase()}`;
    const scopeFiltered = transactions.filter(t => {
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === new Date().getMonth() && tDate.getFullYear() === new Date().getFullYear();
      const isCurrentYear = tDate.getFullYear() === new Date().getFullYear();
      
      if (exportScope === 'monthly' && !isCurrentMonth) return false;
      if (exportScope === 'yearly' && !isCurrentYear) return false;

      if (exportFilter === 'expense' && t.type !== 'expense' && t.type !== 'savings_deposit') return false;
      if (exportFilter === 'income' && t.type !== 'income' && t.type !== 'savings_withdraw') return false;

      return true;
    });

    const totalIn = scopeFiltered.filter(t => t.type === 'income' || t.type === 'savings_withdraw').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = scopeFiltered.filter(t => t.type === 'expense' || t.type === 'savings_deposit').reduce((sum, t) => sum + t.amount, 0);
    const surplus = totalIn - totalOut;

    const tableRows = scopeFiltered.map(t => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(t.date).toLocaleDateString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-transform: capitalize;">${t.type}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${t.category}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.note || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${t.paymentMethod}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-weight: bold; text-align: right; color: ${t.type === 'income' ? '#10b981' : '#f43f5e'};">
          ${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toFixed(2)}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #2d3748; padding: 40px; margin: 0; }
            .header { display: flex; justify-between: space-between; align-items: center; border-bottom: 3px solid #3182ce; padding-bottom: 20px; margin-bottom: 30px; }
            .brand { font-size: 26px; font-weight: 800; color: #1a365d; letter-spacing: -1px; }
            .title { font-size: 16px; font-weight: 500; color: #718096; text-transform: uppercase; text-align: right; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: #f7fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .stat-label { font-size: 11px; text-transform: uppercase; color: #718096; }
            .stat-value { font-size: 20px; font-weight: 700; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #edf2f7; padding: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            footer { margin-top: 50px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header" style="display: flex; justify-content: space-between;">
            <div class="brand">Cocoon Finance Tracker</div>
            <div class="title">${reportTitle}</div>
          </div>
          ${encryptPdf ? `<div style="padding: 8px; background: #fffaf0; border: 1px solid #feebc8; font-size: 11px; color: #c05621; margin-bottom: 15px; border-radius: 4px;">⚠️ Encrypted Report File - Password Protected Simulation active.</div>` : ''}
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Cash Inflow</div>
              <div class="stat-value" style="color: #10b981;">+${currencySymbol}${totalIn.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Outgoings</div>
              <div class="stat-value" style="color: #f43f5e;">-${currencySymbol}${totalOut.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Net Balance</div>
              <div class="stat-value" style="color: ${surplus >= 0 ? '#10b981' : '#f43f5e'}">${surplus >= 0 ? '+' : ''}${currencySymbol}${surplus.toFixed(2)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description Note</th>
                <th>Payment Method</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <footer>
            Cocoon Financial Dashboard - Local Offline Secure Storage Database Report. Developed by INFINITY DECODER (<a href="https://infinitydecoder.com" target="_blank" style="color: #718096; text-decoration: none;">infinitydecoder.com</a>). Generated on ${new Date().toLocaleString()}.
          </footer>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setShowExportPanel(false);

    if (onAddNotification) {
      onAddNotification(
        'PDF Exported Successfully',
        `A printable financial PDF report (${exportScope}) was generated.`,
        'pdf_export'
      );
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 select-none">
      {/* Top Header with Back to Home button */}
      {onBack && (
        <div className="flex items-center justify-between pb-1 border-b border-white/5 gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
          >
            <ArrowLeft size={14} className="text-emerald-400" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold hidden sm:inline">Ledger Book</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              {filteredTransactions.length} entries
            </span>
          </div>
        </div>
      )}

      {/* Search Bar & Primary Filters Button */}
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-white/4 border border-white/5 rounded-2xl px-3 py-2.5 sm:px-3.5 sm:py-3 transition-colors focus-within:border-emerald-500/40">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search notes, amounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent w-full min-w-0 text-xs sm:text-sm outline-none placeholder:text-neutral-500 text-white truncate"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-neutral-500 hover:text-white p-0.5 shrink-0"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            setShowFilters(!showFilters);
          }}
          className={`w-11 h-11 shrink-0 border rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            showFilters 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
              : 'bg-white/4 border-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Toggle Filters"
          aria-label="Filter transactions"
        >
          <div className="relative flex items-center justify-center">
            <Filter size={17} />
            {(filterType !== 'all' || filterCategory || startDate || endDate || filterPayment !== 'all') && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            setShowExportPanel(true);
          }}
          className="w-11 h-11 shrink-0 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/25 border border-blue-500/25 rounded-2xl flex items-center justify-center text-blue-300 hover:text-blue-200 transition-all cursor-pointer active:scale-95 shadow-sm"
          title="Save PDF / Export Ledger"
          aria-label="Save PDF or Export Ledger"
        >
          <FileSpreadsheet size={17} />
        </button>
      </div>

      {/* EXPANDABLE FILTER CABINET */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white/3 border border-white/5 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2">
              {/* Type Filter Buttons */}
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`py-1.5 rounded-xl border text-xs capitalize font-bold cursor-pointer ${
                    filterType === t 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                      : 'bg-neutral-800/40 border-white/5 text-neutral-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Category Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">Category</span>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">Payment</span>
                <select 
                  value={filterPayment} 
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white"
                >
                  <option value="all">All Methods</option>
                  {paymentMethods.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Amount Range Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">Min Amount ({currencySymbol})</span>
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={filterMinAmount} 
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">Max Amount ({currencySymbol})</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={filterMaxAmount} 
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">From Date</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1 text-xs text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">To Date</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* Reset Filters button */}
            <button
              onClick={() => {
                setFilterType('all');
                setFilterCategory('all');
                setFilterPayment('all');
                setFilterMinAmount('');
                setFilterMaxAmount('');
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
              }}
              className="text-xs text-rose-400 font-bold self-end hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- EXPORT REPORT CONFIGURATION PANEL --- */}
      <AnimatePresence>
        {showExportPanel && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-white text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-base font-bold flex items-center gap-1.5">
                  <FileSpreadsheet size={18} className="text-emerald-400" />
                  Custom Ledger Export
                </span>
                <button onClick={() => setShowExportPanel(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Time Range scope */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-400">Time Range Scope</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['monthly', 'yearly', 'all'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setExportScope(s)}
                      className={`py-1.5 rounded-xl border text-xs font-bold capitalize transition-colors cursor-pointer ${
                        exportScope === s ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-neutral-800/40 border-white/5 text-neutral-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Scope Type */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-400">Transactions to Include</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['combined', 'expense', 'income'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setExportFilter(f)}
                      className={`py-1.5 rounded-xl border text-xs font-bold capitalize transition-colors cursor-pointer ${
                        exportFilter === f ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-neutral-800/40 border-white/5 text-neutral-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security / Password simulation toggle */}
              <div className="flex flex-col gap-2 p-3 bg-neutral-950/40 border border-white/5 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Protect PDF with Password
                  </span>
                  <input
                    type="checkbox"
                    checked={encryptPdf}
                    onChange={(e) => setEncryptPdf(e.target.checked)}
                    className="accent-emerald-500 cursor-pointer"
                  />
                </div>

                {encryptPdf && (
                  <input
                    type="password"
                    placeholder="Enter document unlock password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                )}
              </div>

              {/* Export Trigger Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleExportCSV}
                  className="py-2.5 bg-neutral-800 hover:bg-neutral-700/80 border border-white/10 rounded-xl text-xs font-bold text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  Download CSV
                </button>

                <button
                  onClick={handlePrintPDF}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer size={15} />
                  Print / Save PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- TRANSACTIONS LOGS LIST --- */}
      <div className="flex flex-col gap-5">
        {Object.keys(groupedTransactions).map((dateHeader) => (
          <div key={dateHeader} className="flex flex-col gap-2">
            <span className="text-xs font-bold text-neutral-400 px-1 text-left">
              {dateHeader}
            </span>

            <div className="flex flex-col gap-2">
              {groupedTransactions[dateHeader].map((tx) => {
                const matchedCategory = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase() || c.id === tx.category);
                const iconName = matchedCategory ? matchedCategory.icon : 'HelpCircle';
                const IconComponent = CATEGORY_ICONS_MAP[iconName] || CATEGORY_ICONS_MAP['Home'];
                const catColor = matchedCategory ? matchedCategory.color : '#64748B';

                const isSwipedDelete = swipedTx?.id === tx.id && swipedTx.action === 'delete';
                const isSwipedEdit = swipedTx?.id === tx.id && swipedTx.action === 'edit';

                return (
                  <div key={tx.id} className="relative overflow-hidden w-full rounded-2xl h-[72px]">
                    {/* Left track: Uncovered on Left-to-Right slide -> Actionable EDIT button (Blue/Indigo with Pencil) */}
                    <button
                      type="button"
                      aria-label="Edit transaction"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHapticFeedback();
                        setSwipedTx(null);
                        setEditingTx(tx);
                        setEditNote(tx.note);
                        setEditAmount(tx.amount.toString());
                        setEditError('');
                      }}
                      className="absolute inset-y-0 left-0 w-32 bg-blue-600 hover:bg-blue-500 rounded-2xl flex items-center justify-start pl-4 z-0 font-bold text-xs text-white cursor-pointer active:scale-95 transition-all select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <Pencil size={16} /> Edit
                      </span>
                    </button>

                    {/* Right track: Uncovered on Right-to-Left slide -> Actionable DELETE button (Red/Rose with Trash2) */}
                    <button
                      type="button"
                      aria-label="Delete transaction"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHapticFeedback();
                        setSwipedTx(null);
                        onDeleteTransaction(tx.id);
                      }}
                      className="absolute inset-y-0 right-0 w-32 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-end pr-4 z-0 font-bold text-xs text-white cursor-pointer active:scale-95 transition-all select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        Delete <Trash2 size={16} />
                      </span>
                    </button>

                    {/* Draggable Foreground Card */}
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -100, right: 100 }}
                      dragElastic={0.2}
                      animate={{
                        x: isSwipedDelete ? -95 : isSwipedEdit ? 95 : 0
                      }}
                      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                      onDragEnd={(_event, info) => {
                        if (info.offset.x < -35) {
                          triggerHapticFeedback();
                          setSwipedTx({ id: tx.id, action: 'delete' });
                        } else if (info.offset.x > 35) {
                          triggerHapticFeedback();
                          setSwipedTx({ id: tx.id, action: 'edit' });
                        } else {
                          setSwipedTx(null);
                        }
                      }}
                      onClick={() => {
                        if (swipedTx?.id === tx.id) {
                          setSwipedTx(null);
                        }
                      }}
                      className="absolute inset-0 w-full h-full flex items-center justify-between p-3.5 bg-neutral-900 border border-white/5 cursor-grab active:cursor-grabbing rounded-2xl z-10 hover:border-white/10 transition-colors select-none"
                      style={{ backgroundColor: themeCardBg }}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: catColor }}
                        >
                          <IconComponent size={20} />
                        </div>
                        
                        <div className="flex flex-col truncate text-left">
                          <span className="text-sm font-semibold text-white truncate leading-tight">
                            {tx.note || tx.category}
                          </span>
                          <span className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                            <span className="font-semibold uppercase tracking-wider text-[9px] opacity-75">{tx.category}</span>
                            {tx.subCategory && (
                              <>
                                <ChevronRight size={10} className="text-neutral-500" />
                                <span className="opacity-90">{tx.subCategory}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end text-right font-mono">
                        <span className={`text-sm font-extrabold ${tx.type === 'income' || tx.type === 'savings_withdraw' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.type === 'income' || tx.type === 'savings_withdraw' ? '+' : '-'} {currencySymbol} {tx.amount.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {tx.isRecurring && (
                            <span className="text-[8px] bg-white/10 text-neutral-300 px-1.5 py-0.2 rounded font-sans uppercase font-bold">
                              Recurring
                            </span>
                          )}
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {new Date(tx.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <span className="text-sm block">No matching transactions found</span>
            <span className="text-xs opacity-60">Adjust your filters or search keywords</span>
          </div>
        )}
      </div>

      {/* --- EDIT TRANSACTION SHEET (POPUP MODAL) --- */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col gap-4 text-white"
            >
              <span className="text-base font-bold">Edit Transaction</span>

              {editError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Description / Note</span>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => {
                    setEditNote(e.target.value);
                    setEditError('');
                  }}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Amount ({currencySymbol})</span>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => {
                    setEditAmount(e.target.value);
                    setEditError('');
                  }}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  onClick={() => {
                    setEditingTx(null);
                    setEditError('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const amt = parseFloat(editAmount);
                    if (isNaN(amt) || amt <= 0) {
                      setEditError('Please enter a valid amount greater than 0');
                      return;
                    }
                    onEditTransaction(editingTx.id, {
                      note: editNote.trim(),
                      amount: amt
                    });
                    setEditingTx(null);
                    setEditError('');
                    triggerHapticFeedback();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
