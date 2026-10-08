/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  Search, Filter, Calendar, CreditCard, ChevronDown, Trash2, Edit, 
  FileSpreadsheet, Printer, ShieldCheck, X, ChevronRight, Pencil, ChevronLeft, ArrowLeft,
  Sparkles, Download, Check, User, Phone, Mail, MapPin, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';
import { Transaction, Category, NotificationType } from '../../../core/types';
import { CATEGORY_ICONS_MAP } from '../../categories';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import CocoonLogo from '../../../shared/components/CocoonLogo';
import CocoonStatementSeal from '../../../shared/components/CocoonStatementSeal';

interface TransactionsTabProps {
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: string[];
  currencySymbol: string;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (id: string, updatedData: Partial<Transaction>) => void;
  onAddNotification?: (title: string, message: string, type: NotificationType) => void;
  onBack?: () => void;
  userProfile?: {
    userName?: string;
    userEmail?: string;
    userPhone?: string;
    userAddress?: string;
  };
  onUpdateProfile?: (profile: {
    userName?: string;
    userEmail?: string;
    userPhone?: string;
    userAddress?: string;
  }) => void;
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
  userProfile,
  onUpdateProfile,
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
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [exportScope, setExportScope] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const [exportFilter, setExportFilter] = useState<'combined' | 'expense' | 'income'>('combined');
  const [pdfPassword, setPdfPassword] = useState('');
  const [encryptPdf, setEncryptPdf] = useState(false);

  // Guide dismiss state
  const [isGuideDismissed, setIsGuideDismissed] = useState<boolean>(() => {
    return localStorage.getItem('cocoon_dismiss_swipe_guide') === 'true';
  });

  // Downloading PDF loading state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // User profile modal states for PDF Statement
  const [showProfilePromptModal, setShowProfilePromptModal] = useState(false);
  const [inputName, setInputName] = useState(userProfile?.userName || '');
  const [inputEmail, setInputEmail] = useState(userProfile?.userEmail || '');
  const [inputPhone, setInputPhone] = useState(userProfile?.userPhone || '');
  const [inputAddress, setInputAddress] = useState(userProfile?.userAddress || '');

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

  // Filtered transactions specifically for PDF & Statement Exports
  const scopeFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === new Date().getMonth() && tDate.getFullYear() === new Date().getFullYear();
      const isCurrentYear = tDate.getFullYear() === new Date().getFullYear();
      
      if (exportScope === 'monthly' && !isCurrentMonth) return false;
      if (exportScope === 'yearly' && !isCurrentYear) return false;

      if (exportFilter === 'expense' && t.type !== 'expense' && t.type !== 'savings_deposit') return false;
      if (exportFilter === 'income' && t.type !== 'income' && t.type !== 'savings_withdraw') return false;

      return true;
    });
  }, [transactions, exportScope, exportFilter]);

  // Aggregate stats for PDF/statement view
  const exportTotals = useMemo(() => {
    const totalIn = scopeFilteredTransactions
      .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalOut = scopeFilteredTransactions
      .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const surplus = totalIn - totalOut;
    return { totalIn, totalOut, surplus };
  }, [scopeFilteredTransactions]);

  // Helper to format date as 07JUN2026
  const formatDateForStatement = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}${month}${year}`;
  };

  // Statement date range calculation for "07JUN2026 to 05JUL2026"
  const statementDateRange = useMemo(() => {
    const dates = scopeFilteredTransactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
    const now = new Date();
    
    if (exportScope === 'monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${formatDateForStatement(startOfMonth)} to ${formatDateForStatement(endOfMonth)}`;
    }

    if (exportScope === 'yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return `${formatDateForStatement(startOfYear)} to ${formatDateForStatement(endOfYear)}`;
    }

    // All time
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      return `${formatDateForStatement(minDate)} to ${formatDateForStatement(maxDate)}`;
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return `${formatDateForStatement(startOfMonth)} to ${formatDateForStatement(now)}`;
  }, [scopeFilteredTransactions, exportScope]);

  // Safe In-App PDF / Statement Viewer with Cancel, Save, and Print controls
  const handlePrintPDF = () => {
    triggerHapticFeedback();
    setShowExportPanel(false);

    // If user has not added their profile info, prompt before generating PDF
    const hasProfile = Boolean(
      userProfile?.userName?.trim() ||
      userProfile?.userEmail?.trim() ||
      userProfile?.userPhone?.trim() ||
      userProfile?.userAddress?.trim()
    );

    if (!hasProfile) {
      setInputName(userProfile?.userName || '');
      setInputEmail(userProfile?.userEmail || '');
      setInputPhone(userProfile?.userPhone || '');
      setInputAddress(userProfile?.userAddress || '');
      setShowProfilePromptModal(true);
    } else {
      setShowPdfPreviewModal(true);
    }

    if (onAddNotification) {
      onAddNotification(
        'Statement Preview Ready',
        `A printable financial report (${exportScope}) is ready to preview, save, or print.`,
        'pdf_export'
      );
    }
  };

  // Direct Save/Download PDF to device downloads
  const handleDownloadPDF = async () => {
    triggerHapticFeedback();
    const element = document.getElementById('printable-ledger-report');
    if (!element) {
      window.print();
      return;
    }

    try {
      setIsDownloadingPdf(true);
      const filename = `Cocoon-Transaction-Statement-${exportScope}-${new Date().toISOString().split('T')[0]}.pdf`;
      const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();

      if (onAddNotification) {
        onAddNotification(
          'PDF Saved',
          `Transaction Statement downloaded successfully to your device downloads folder.`,
          'pdf_export'
        );
      }
    } catch {
      // Fallback to native print/save if browser restricts direct html2canvas
      window.print();
    } finally {
      setIsDownloadingPdf(false);
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
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/25 transition-all active:scale-95"
                >
                  <Download size={15} />
                  Save PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- INTERACTIVE SWIPE GESTURE TUTORIAL / ANIMATION BANNER --- */}
      {!isGuideDismissed && (
        <div className="bg-gradient-to-r from-blue-950/40 via-neutral-900/60 to-rose-950/40 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles size={14} />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">
                Quick Action Gestures
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest hidden sm:inline">
                Swipe cards to act
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setIsGuideDismissed(true);
                  localStorage.setItem('cocoon_dismiss_swipe_guide', 'true');
                }}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss guide"
                aria-label="Dismiss guide"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Looping sliding gesture demo card */}
          <div className="relative h-11 bg-black/40 rounded-xl overflow-hidden border border-white/5 flex items-center justify-between px-3 text-[10px]">
            {/* Left track hint (Slide Right to Edit) */}
            <div className="flex items-center gap-1.5 text-blue-400 font-bold z-0">
              <Pencil size={12} />
              <span>Slide Right to Edit</span>
            </div>

            {/* Right track hint (Slide Left to Delete) */}
            <div className="flex items-center gap-1.5 text-rose-400 font-bold z-0">
              <span>Slide Left to Delete</span>
              <Trash2 size={12} />
            </div>

            {/* Animated gliding demo card showing user how to slide both directions */}
            <motion.div
              animate={{
                x: [0, 70, 0, -70, 0]
              }}
              transition={{
                duration: 4.8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="absolute inset-y-1 inset-x-10 bg-neutral-800/90 border border-white/15 rounded-lg flex items-center justify-center gap-2 shadow-lg z-10 pointer-events-none select-none text-neutral-200"
            >
              <ChevronLeft size={13} className="text-rose-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-white">👈 Drag Card 👉</span>
              <ChevronRight size={13} className="text-blue-400 animate-pulse" />
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-medium pt-0.5">
            <div className="flex items-center gap-1.5 text-neutral-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span>Slide <strong>Right</strong> to Edit</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 justify-end text-right">
              <span>Slide <strong>Left</strong> to Delete</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            </div>
          </div>
        </div>
      )}

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

      {/* --- USER STATEMENT PROFILE DETAILS PROMPT MODAL --- */}
      <AnimatePresence>
        {showProfilePromptModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-white text-left shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <User size={16} />
                  </div>
                  <span className="text-sm font-bold text-white">Statement Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfilePromptModal(false)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Add your personal or business details to generate a professional, bank-style Transaction Statement:
              </p>

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Account Holder Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Mahboob Alam"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Email Address</span>
                  <input
                    type="email"
                    placeholder="e.g. mahboobalam.dev@gmail.com"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Mobile Number</span>
                  <input
                    type="tel"
                    placeholder="e.g. +92 300 1234567"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Mailing / Business Address</span>
                  <textarea
                    rows={2}
                    placeholder="e.g. Suite 402, Financial Tower, City"
                    value={inputAddress}
                    onChange={(e) => setInputAddress(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfilePromptModal(false);
                    setShowPdfPreviewModal(true);
                  }}
                  className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 cursor-pointer transition-all active:scale-95"
                >
                  Skip for Now
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    if (onUpdateProfile) {
                      onUpdateProfile({
                        userName: inputName.trim(),
                        userEmail: inputEmail.trim(),
                        userPhone: inputPhone.trim(),
                        userAddress: inputAddress.trim()
                      });
                    }
                    localStorage.setItem('cocoon_username', inputName.trim());
                    localStorage.setItem('cocoon_user_email', inputEmail.trim());
                    localStorage.setItem('cocoon_user_phone', inputPhone.trim());
                    localStorage.setItem('cocoon_user_address', inputAddress.trim());

                    setShowProfilePromptModal(false);
                    setShowPdfPreviewModal(true);
                  }}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md shadow-emerald-500/25 transition-all active:scale-95"
                >
                  Save & Generate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- IN-APP PDF / PROFESSIONAL BANK-GRADE TRANSACTION STATEMENT MODAL --- */}
      <AnimatePresence>
        {showPdfPreviewModal && (
          <div className="fixed inset-0 z-[100] bg-neutral-950/95 backdrop-blur-md flex flex-col overflow-hidden text-left">
            {/* Top Navigation & Action Header */}
            <div className="p-3 sm:p-4 bg-neutral-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowPdfPreviewModal(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                <ArrowLeft size={15} className="text-emerald-400" />
                <span>Back to Ledger</span>
              </button>

              <div className="flex flex-col text-center">
                <span className="text-xs font-bold text-white tracking-tight">Transaction Statement</span>
                <span className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest">
                  {exportScope} Scope • {scopeFilteredTransactions.length} Entries
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    handleExportCSV();
                  }}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-xl text-xs font-bold text-neutral-200 cursor-pointer transition-all active:scale-95"
                  title="Export CSV spreadsheet"
                >
                  <FileSpreadsheet size={14} className="text-blue-400" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md shadow-emerald-500/25 transition-all active:scale-95"
                  title="Save PDF to device"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Save PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowPdfPreviewModal(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Printable Document Viewport */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col items-center">
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  #printable-ledger-report, #printable-ledger-report * { visibility: visible !important; }
                  #printable-ledger-report {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 24px !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    color: black !important;
                  }
                  .no-print { display: none !important; }
                }
              `}</style>

              <div
                id="printable-ledger-report"
                className="w-full max-w-3xl bg-white text-neutral-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-neutral-300 flex flex-col gap-6"
              >
                {/* --- STATEMENT DOCUMENT HEADER --- */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-neutral-300">
                  {/* Top-Left: App Logo + App Name "Cocoon" (no finance tracker) + Account Title info */}
                  <div className="flex flex-col max-w-md">
                    <div className="flex items-center gap-3">
                      <CocoonLogo size={38} />
                      <h1 className="text-2xl font-black text-neutral-950 tracking-tight leading-none">
                        Cocoon
                      </h1>
                    </div>

                    {/* Account Title & Contact Information */}
                    <div className="flex flex-col mt-3 text-xs text-neutral-700 space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-semibold text-neutral-500">
                          Account Title:
                        </span>
                        <span className="text-sm font-bold text-neutral-900">
                          {userProfile?.userName?.trim() || inputName?.trim() || 'Client Account'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-600 mt-0.5">
                        {(userProfile?.userEmail?.trim() || inputEmail?.trim()) && (
                          <span className="font-mono">
                            {userProfile?.userEmail?.trim() || inputEmail?.trim()}
                          </span>
                        )}
                        {(userProfile?.userPhone?.trim() || inputPhone?.trim()) && (
                          <span className="font-mono">
                            {userProfile?.userPhone?.trim() || inputPhone?.trim()}
                          </span>
                        )}
                      </div>
                      {(userProfile?.userAddress?.trim() || inputAddress?.trim()) && (
                        <span className="text-[11px] text-neutral-600">
                          {userProfile?.userAddress?.trim() || inputAddress?.trim()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Top-Right: Transaction Statement (gray with no background) + Date range (07JUN2026 to 05JUL2026) in single line */}
                  <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
                    <span className="text-base font-bold text-neutral-500 tracking-tight">
                      Transaction Statement
                    </span>
                    <div className="mt-1.5 text-xs font-mono text-neutral-600">
                      <span>{statementDateRange}</span>
                    </div>
                  </div>
                </div>

                {/* --- STATEMENT FINANCIAL SUMMARY CARDS --- */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                      Total Inflow (Credit)
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-1">
                      {currencySymbol}   {exportTotals.totalIn.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider font-mono">
                      Total Outgoings (Debit)
                    </span>
                    <span className="text-base sm:text-lg font-black text-rose-700 font-mono mt-1">
                      {currencySymbol}   {exportTotals.totalOut.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col">
                    <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider font-mono">
                      Net Balance
                    </span>
                    <span className={`text-base sm:text-lg font-black font-mono mt-1 ${exportTotals.surplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {currencySymbol}   {exportTotals.surplus.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* --- STATEMENT LEDGER TABLE --- */}
                <div className="overflow-x-auto w-full border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-300 bg-neutral-100 text-neutral-700 font-bold uppercase text-[10px] font-mono">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2">Category</th>
                        <th className="py-2.5 px-2">Particulars / Note</th>
                        <th className="py-2.5 px-2">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 font-sans">
                      {scopeFilteredTransactions.map((tx, idx) => (
                        <tr key={`${tx.id}-${idx}`} className="hover:bg-neutral-50">
                          <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap text-neutral-700">
                            {new Date(tx.date).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-2 capitalize text-[11px] font-medium text-neutral-600">
                            {tx.type}
                          </td>
                          <td className="py-2 px-2 font-medium text-[11px] text-neutral-800">
                            {tx.category}
                          </td>
                          <td className="py-2 px-2 max-w-[180px] truncate text-neutral-600 text-[11px]">
                            {tx.note || '-'}
                          </td>
                          <td className="py-2 px-2 text-neutral-500 text-[11px]">
                            {tx.paymentMethod}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold text-[11px] whitespace-nowrap ${
                            tx.type === 'income' || tx.type === 'savings_withdraw' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {tx.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {scopeFilteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-neutral-400 font-mono text-xs">
                            No records found for the selected scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* --- STATEMENT OFFICIAL FOOTER & CIRCULAR RED SEAL --- */}
                <div className="pt-3 flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Left Side: Computer generated statement text (small gray line, no extra line underneath) */}
                  <div className="flex flex-col text-left max-w-xs">
                    <span className="text-[11px] text-neutral-500 font-normal">
                      Computer generated statement does not require signature.
                    </span>
                  </div>

                  {/* Center: Beautiful yet Official Circular Red Seal Stamp */}
                  <div className="flex items-center justify-center">
                    <CocoonStatementSeal size={105} />
                  </div>

                  {/* Right Side: Timestamp without heading */}
                  <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-[11px] text-neutral-500 font-mono">
                    <span>
                      {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Bottom In-Page Controls */}
                <div className="no-print pt-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowPdfPreviewModal(false)}
                    className="w-full sm:w-auto px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Cancel & Return to Ledger
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isDownloadingPdf}
                    className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Downloading PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Save PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
