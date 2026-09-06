/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  CalendarDays, 
  Briefcase, 
  HelpCircle,
  Eye,
  Trash2,
  Edit
} from 'lucide-react';
import { Transaction, Category } from '../types';
import * as LucideIcons from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

interface AnalysisTabProps {
  transactions: Transaction[];
  categories: Category[];
  currencySymbol: string;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (id: string, updatedData: Partial<Transaction>) => void;
}

import { triggerHapticFeedback } from '../utils/haptics';

export default function AnalysisTab({
  transactions,
  categories,
  currencySymbol,
  themeCardBg,
  themeBorder,
  themeRadius,
  themePrimary,
  onDeleteTransaction,
  onEditTransaction
}: AnalysisTabProps) {
  // Time scope: 'month' | 'yearly' | 'all'
  const [timeScope, setTimeScope] = useState<'month' | 'yearly' | 'all'>('month');
  
  // Date context states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`; // YYYY-MM
  });
  
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Interactive Clicked Filter state from the chart
  const [chartClickedItem, setChartClickedItem] = useState<any | null>(null);

  // Swipe items tracking
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

  // Editing transaction state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Reset chart filter whenever time scope, month, or year changes
  const handleTimeScopeChange = (scope: 'month' | 'yearly' | 'all') => {
    triggerHapticFeedback();
    setTimeScope(scope);
    setChartClickedItem(null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedMonth(e.target.value);
      setChartClickedItem(null);
    }
  };

  const handleYearChange = (offset: number) => {
    triggerHapticFeedback();
    setSelectedYear(prev => prev + offset);
    setChartClickedItem(null);
  };

  // Helper to test if a transaction belongs to Income or Expense
  const isIncome = (t: Transaction) => t.type === 'income' || t.type === 'savings_withdraw';
  const isExpense = (t: Transaction) => t.type === 'expense' || t.type === 'savings_deposit';

  // 1. FILTERED TRANSACTIONS BASED ON SCOPE
  const scopeTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      if (isNaN(txDate.getTime())) return false;

      if (timeScope === 'month') {
        const [y, m] = selectedMonth.split('-').map(Number);
        return txDate.getFullYear() === y && (txDate.getMonth() + 1) === m;
      } else if (timeScope === 'yearly') {
        return txDate.getFullYear() === selectedYear;
      } else {
        // 'all'
        return true;
      }
    });
  }, [transactions, timeScope, selectedMonth, selectedYear]);

  // Total sums of filtered transactions
  const totalIncome = useMemo(() => {
    return scopeTransactions.filter(isIncome).reduce((sum, t) => sum + t.amount, 0);
  }, [scopeTransactions]);

  const totalExpense = useMemo(() => {
    return scopeTransactions.filter(isExpense).reduce((sum, t) => sum + t.amount, 0);
  }, [scopeTransactions]);

  // 2. CHART COMPUTATIONS
  const chartData = useMemo(() => {
    if (timeScope === 'month') {
      // Aggregate by Day (1 to max days in month)
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const dayStr = String(dayNum).padStart(2, '0');
        const dateStr = `${selectedMonth}-${dayStr}`;
        return {
          label: `Day ${dayNum}`,
          day: dayNum,
          dateStr,
          income: 0,
          expense: 0
        };
      });

      scopeTransactions.forEach(t => {
        const dateObj = new Date(t.date);
        const day = dateObj.getDate();
        if (day >= 1 && day <= daysInMonth) {
          if (isIncome(t)) {
            dailyData[day - 1].income += t.amount;
          } else if (isExpense(t)) {
            dailyData[day - 1].expense += t.amount;
          }
        }
      });

      return dailyData;

    } else if (timeScope === 'yearly') {
      // Aggregate by Month (Jan - Dec)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData = monthNames.map((name, index) => ({
        label: name,
        monthIndex: index,
        monthStr: `${selectedYear}-${String(index + 1).padStart(2, '0')}`,
        income: 0,
        expense: 0
      }));

      scopeTransactions.forEach(t => {
        const dateObj = new Date(t.date);
        const monthIndex = dateObj.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          if (isIncome(t)) {
            monthlyData[monthIndex].income += t.amount;
          } else if (isExpense(t)) {
            monthlyData[monthIndex].expense += t.amount;
          }
        }
      });

      return monthlyData;

    } else {
      // 'all' time - Aggregate by month name over all years available
      // Find range of years
      if (transactions.length === 0) return [];
      
      const dateObjects = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      if (dateObjects.length === 0) return [];

      const years = dateObjects.map(d => d.getFullYear());
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      const allData: Array<{ label: string; monthStr: string; income: number; expense: number }> = [];

      for (let y = minYear; y <= maxYear; y++) {
        for (let m = 0; m < 12; m++) {
          const mStr = String(m + 1).padStart(2, '0');
          const monthKey = `${y}-${mStr}`;
          
          // Only add months that are between min transaction date and max transaction date
          const monthStartDate = new Date(y, m, 1);
          const firstTxDate = new Date(minYear, 0, 1);
          const lastTxDate = new Date(maxYear, 11, 31);
          
          if (monthStartDate >= firstTxDate && monthStartDate <= lastTxDate) {
            const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            allData.push({
              label: `${shortMonthNames[m]} '${String(y).slice(-2)}`,
              monthStr: monthKey,
              income: 0,
              expense: 0
            });
          }
        }
      }

      transactions.forEach(t => {
        const dObj = new Date(t.date);
        if (isNaN(dObj.getTime())) return;
        const y = dObj.getFullYear();
        const m = dObj.getMonth();
        const mStr = String(m + 1).padStart(2, '0');
        const monthKey = `${y}-${mStr}`;

        const index = allData.findIndex(item => item.monthStr === monthKey);
        if (index !== -1) {
          if (isIncome(t)) {
            allData[index].income += t.amount;
          } else if (isExpense(t)) {
            allData[index].expense += t.amount;
          }
        }
      });

      // Filter out leading and trailing months that have 0 income and 0 expense to keep graph clean
      let startIdx = 0;
      while (startIdx < allData.length && allData[startIdx].income === 0 && allData[startIdx].expense === 0) {
        startIdx++;
      }

      let endIdx = allData.length - 1;
      while (endIdx >= startIdx && allData[endIdx].income === 0 && allData[endIdx].expense === 0) {
        endIdx--;
      }

      const slicedData = allData.slice(Math.max(0, startIdx - 1), Math.min(allData.length, endIdx + 2));
      return slicedData.length > 0 ? slicedData : allData.slice(-6); // fallback to last 6 months
    }
  }, [transactions, scopeTransactions, timeScope, selectedMonth, selectedYear]);

  // 3. FINAL DIRECTORY TRANSACTIONS (Filtered by active view range AND graph click highlights)
  const directoryTransactions = useMemo(() => {
    let list = [...scopeTransactions];

    // Apply interactive chart click filter if active
    if (chartClickedItem) {
      if (timeScope === 'month') {
        list = list.filter(t => {
          const d = new Date(t.date);
          return d.getDate() === chartClickedItem.day;
        });
      } else if (timeScope === 'yearly') {
        list = list.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === chartClickedItem.monthIndex;
        });
      } else if (timeScope === 'all') {
        list = list.filter(t => {
          return t.date.startsWith(chartClickedItem.monthStr);
        });
      }
    }

    // Sort chronologically (newest first)
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scopeTransactions, chartClickedItem, timeScope]);

  // Group directory transactions by date headers
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    directoryTransactions.forEach(t => {
      const dObj = new Date(t.date);
      const dateHeader = isNaN(dObj.getTime())
        ? 'Unknown Date'
        : dObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      
      if (!groups[dateHeader]) {
        groups[dateHeader] = [];
      }
      groups[dateHeader].push(t);
    });
    return groups;
  }, [directoryTransactions]);

  // Handle graph node selection click
  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length) {
      const clickedData = state.activePayload[0].payload;
      setChartClickedItem(clickedData);
      triggerHapticFeedback();
    }
  };

  // Custom glassy tooltip styled like Telegram
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-950/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl text-left text-xs font-mono">
          <p className="text-white font-extrabold mb-1.5 uppercase tracking-wider text-[9px] text-neutral-400">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-5 justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-neutral-300 font-sans font-medium">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name === 'income' ? 'Income' : 'Expense'}:
              </span>
              <span className={`font-black ${p.name === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currencySymbol} {p.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-xl mx-auto pb-24 text-white">
      {/* 1. GLASSY SCOPE CONTROL PANEL AT THE TOP */}
      <div 
        className="p-4 border rounded-[24px] flex flex-col gap-4 text-left shadow-lg backdrop-blur-md relative"
        style={{ backgroundColor: `${themeCardBg}D0`, borderColor: themeBorder, borderRadius: themeRadius }}
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 font-display">
              <TrendingUp size={16} className="text-emerald-400" />
              Dynamic Analysis
            </h3>
            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Overlapping Cashflow Comparison</p>
          </div>

          {/* Scope selection buttons: Month, Yearly, All */}
          <div className="flex items-center gap-1 bg-neutral-950/50 p-1 rounded-xl border border-white/5">
            {(['month', 'yearly', 'all'] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => handleTimeScopeChange(scope)}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  timeScope === scope
                    ? 'bg-white/10 text-emerald-400 font-bold border border-white/5'
                    : 'text-neutral-400 hover:text-white bg-transparent'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Context Selector based on timeScope */}
        <div className="flex items-center justify-between py-1 px-1 border-t border-white/5 pt-3">
          {timeScope === 'month' && (
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
                Select Month
              </span>
              <div className="relative flex items-center gap-2">
                <CalendarDays size={14} className="text-emerald-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="bg-neutral-900 border border-white/10 text-xs rounded-xl pl-8 pr-2.5 py-1.5 font-bold outline-none cursor-pointer text-white text-right"
                />
              </div>
            </div>
          )}

          {timeScope === 'yearly' && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
                Select Year
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleYearChange(-1)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-black font-mono px-3 py-1 bg-neutral-900 rounded-lg border border-white/5 text-emerald-400 tracking-wider">
                  {selectedYear}
                </span>
                <button
                  onClick={() => handleYearChange(1)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {timeScope === 'all' && (
            <div className="flex justify-between w-full items-center">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
                Total Account Lifespan
              </span>
              <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2.5 py-1 rounded-lg border border-white/5">
                All Logs Combined
              </span>
            </div>
          )}
        </div>

        {/* Three Column Cashflow Box */}
        <div className="grid grid-cols-3 gap-1 p-3 bg-neutral-950/25 border border-white/5 rounded-2xl">
          <div className="flex flex-col pl-1">
            <span className="text-[8px] uppercase tracking-widest font-mono font-black text-rose-400 flex items-center gap-1">
              <ArrowDownRight size={8} /> Expense
            </span>
            <span className="text-xs font-black font-mono text-rose-400 mt-1 truncate">
              {currencySymbol} {totalExpense.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col border-x border-white/5 px-2">
            <span className="text-[8px] uppercase tracking-widest font-mono font-black text-emerald-400 flex items-center gap-1">
              <ArrowUpRight size={8} /> Income
            </span>
            <span className="text-xs font-black font-mono text-emerald-400 mt-1 truncate">
              {currencySymbol} {totalIncome.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col pl-2">
            <span className="text-[8px] uppercase tracking-widest font-mono font-black text-neutral-400">
              Net Saving
            </span>
            <span className={`text-xs font-black font-mono mt-1 truncate ${totalIncome - totalExpense >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {currencySymbol} {(totalIncome - totalExpense).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SPLINE AREA CHART MODULE */}
      <div 
        className="p-5 border rounded-[24px] shadow-lg flex flex-col gap-3 backdrop-blur-md relative"
        style={{ backgroundColor: `${themeCardBg}C8`, borderColor: themeBorder, borderRadius: themeRadius }}
      >
        <div className="flex justify-between items-center mb-1 text-left">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
              Spline Area Cashflow Chart
            </span>
            <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
              Click any point below to filter the transaction list
            </span>
          </div>
          {chartClickedItem && (
            <button
              onClick={() => { triggerHapticFeedback(); setChartClickedItem(null); }}
              className="text-[8px] font-black font-mono uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1 transition-all cursor-pointer"
            >
              Clear Filter <X size={10} />
            </button>
          )}
        </div>

        {/* The Recharts smooth area graph */}
        <div className="h-56 w-full select-none">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-neutral-950/20">
              <span className="text-2xl mb-1">📈</span>
              <span className="text-[10px] font-mono text-neutral-400">No sufficient cashflow data to plot.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                onClick={handleChartClick}
                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#ffffff40" 
                  fontSize={8} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={8} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff15', strokeWidth: 1 }} />
                
                {/* Income Area Curve */}
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  name="income"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                  activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#060a0a' }}
                />

                {/* Expense Area Curve */}
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  name="expense"
                  stroke="#f43f5e" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                  activeDot={{ r: 5, stroke: '#f43f5e', strokeWidth: 2, fill: '#0a0606' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3. TRANSACTION DIRECTORY LIST */}
      <div className="flex flex-col gap-3.5 text-left">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              {chartClickedItem ? 'Filtered ledger' : 'Ledger summary'}
            </span>
            {chartClickedItem && (
              <span className="text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {chartClickedItem.label}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            {directoryTransactions.length} logs
          </span>
        </div>

        {directoryTransactions.length === 0 ? (
          <div className="text-center py-12 bg-neutral-950/20 rounded-[24px] border border-dashed border-white/5">
            <span className="text-3xl block mb-2">📒</span>
            <p className="text-xs font-mono text-neutral-500">No logs logged for this specific period selection.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.keys(groupedTransactions).map((dateHeader) => (
              <div key={dateHeader} className="flex flex-col gap-2">
                {/* Date header banner */}
                <div className="py-1 px-1 flex justify-between items-center border-b border-white/5">
                  <span className="text-xs font-bold tracking-wide text-neutral-400">
                    {dateHeader}
                  </span>
                  <span className="text-[9px] font-mono opacity-50">
                    {groupedTransactions[dateHeader].length} logs
                  </span>
                </div>

                {/* Group items list */}
                <div className="flex flex-col gap-2">
                  {groupedTransactions[dateHeader].map((tx) => {
                    const matchedCategory = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase() || c.id === tx.category);
                    const iconName = matchedCategory ? matchedCategory.icon : 'HelpCircle';
                    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
                    const catColor = matchedCategory ? matchedCategory.color : '#64748B';

                    return (
                      <div key={tx.id} className="relative overflow-hidden w-full rounded-2xl h-[72px]">
                        {/* Swipe backdrop tracks */}
                        <div className="absolute inset-0 bg-blue-600 flex items-center pl-6 text-white justify-start pointer-events-none rounded-2xl">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Edit size={16} /> Edit Snap
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-rose-600 flex items-center pr-6 text-white justify-end pointer-events-none rounded-2xl">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            Delete <Trash2 size={16} />
                          </div>
                        </div>

                        {/* Draggable container matching Ledger tab */}
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: -140, right: 140 }}
                          dragElastic={0.4}
                          onDragEnd={(event, info) => {
                            if (info.offset.x < -80) {
                              triggerHapticFeedback();
                              onDeleteTransaction(tx.id);
                            } else if (info.offset.x > 80) {
                              triggerHapticFeedback();
                              setEditingTx(tx);
                              setEditNote(tx.note);
                              setEditAmount(tx.amount.toString());
                            }
                          }}
                          className="absolute inset-0 w-full h-full flex items-center justify-between p-3.5 bg-neutral-900 border border-white/5 cursor-grab active:cursor-grabbing rounded-2xl z-10 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 animate-fade-in"
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
                            <span className={`text-sm font-extrabold ${isIncome(tx) ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isIncome(tx) ? '+' : '-'} {currencySymbol} {tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-neutral-500 mt-0.5">
                              {tx.paymentMethod}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline transactional editing modal portal for seamless flow */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setEditingTx(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-3xl relative z-10 text-white text-left"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Edit Log Entry</span>
                <button onClick={() => setEditingTx(null)} className="text-neutral-500 hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">Notes / Description</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="bg-neutral-950 border border-white/10 rounded-xl p-2.5 text-xs outline-none text-white font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="bg-neutral-950 border border-white/10 rounded-xl p-2.5 text-xs outline-none text-white font-mono font-black"
                  />
                </div>

                <button
                  onClick={() => {
                    if (editingTx) {
                      const parsedAmount = parseFloat(editAmount);
                      if (!isNaN(parsedAmount) && parsedAmount > 0) {
                        onEditTransaction(editingTx.id, {
                          note: editNote,
                          amount: parsedAmount
                        });
                        triggerHapticFeedback();
                        setEditingTx(null);
                      }
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-xs tracking-wide transition-all text-white mt-2 cursor-pointer"
                >
                  Save Modifications
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
