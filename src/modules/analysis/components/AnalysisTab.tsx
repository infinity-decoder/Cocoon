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
  ChevronLeft, 
  ChevronRight, 
  X, 
  CalendarDays, 
  HelpCircle,
  Trash2,
  Edit,
  Pencil,
  ArrowLeft
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Transaction, Category } from '../../../core/types';
import { CATEGORY_ICONS_MAP } from '../../categories';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';

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
  onBack?: () => void;
}

interface ChartNodeItem {
  label: string;
  day?: number;
  monthIndex?: number;
  monthStr?: string;
  dateStr?: string;
  income: number;
  expense: number;
}

export default function AnalysisTab({
  transactions,
  categories,
  currencySymbol,
  themeCardBg,
  themeBorder,
  themeRadius,
  onDeleteTransaction,
  onEditTransaction,
  onBack
}: AnalysisTabProps) {
  const { theme } = useTheme();
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
  const [chartClickedItem, setChartClickedItem] = useState<ChartNodeItem | null>(null);

  // Editing transaction state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editError, setEditError] = useState('');

  // Active swiped item state: { id: string; action: 'edit' | 'delete' } | null
  const [swipedTx, setSwipedTx] = useState<{ id: string; action: 'edit' | 'delete' } | null>(null);

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
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const dailyData: ChartNodeItem[] = Array.from({ length: daysInMonth }, (_, i) => {
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
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData: ChartNodeItem[] = monthNames.map((name, index) => ({
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
      if (transactions.length === 0) return [];
      
      const dateObjects = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      if (dateObjects.length === 0) return [];

      const years = dateObjects.map(d => d.getFullYear());
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      const allData: ChartNodeItem[] = [];

      for (let y = minYear; y <= maxYear; y++) {
        for (let m = 0; m < 12; m++) {
          const mStr = String(m + 1).padStart(2, '0');
          const monthKey = `${y}-${mStr}`;
          
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

      let startIdx = 0;
      while (startIdx < allData.length && allData[startIdx].income === 0 && allData[startIdx].expense === 0) {
        startIdx++;
      }

      let endIdx = allData.length - 1;
      while (endIdx >= startIdx && allData[endIdx].income === 0 && allData[endIdx].expense === 0) {
        endIdx--;
      }

      const slicedData = allData.slice(Math.max(0, startIdx - 1), Math.min(allData.length, endIdx + 2));
      return slicedData.length > 0 ? slicedData : allData.slice(-6);
    }
  }, [transactions, scopeTransactions, timeScope, selectedMonth, selectedYear]);

  // 3. FINAL DIRECTORY TRANSACTIONS
  const directoryTransactions = useMemo(() => {
    let list = [...scopeTransactions];

    if (chartClickedItem) {
      if (timeScope === 'month' && chartClickedItem.day !== undefined) {
        list = list.filter(t => {
          const d = new Date(t.date);
          return d.getDate() === chartClickedItem.day;
        });
      } else if (timeScope === 'yearly' && chartClickedItem.monthIndex !== undefined) {
        list = list.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === chartClickedItem.monthIndex;
        });
      } else if (timeScope === 'all' && chartClickedItem.monthStr) {
        list = list.filter(t => {
          return t.date.startsWith(chartClickedItem.monthStr!);
        });
      }
    }

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
      const clickedData = state.activePayload[0].payload as ChartNodeItem;
      setChartClickedItem(clickedData);
      triggerHapticFeedback();
    }
  };

  // Custom glassy tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="backdrop-blur-md border p-3 rounded-2xl shadow-xl text-left text-xs font-mono"
          style={{
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.borderSubtle,
            color: theme.textPrimary
          }}
        >
          <p className="font-extrabold mb-1.5 uppercase tracking-wider text-[9px]" style={{ color: theme.textSecondary }}>{label}</p>
          {payload.map((p) => (
            <div key={p.name} className="flex items-center gap-5 justify-between py-0.5">
              <span className="flex items-center gap-1.5 font-sans font-medium" style={{ color: theme.textSecondary }}>
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
    <div className="flex flex-col gap-5 w-full max-w-xl mx-auto pb-24" style={{ color: theme.textPrimary }}>
      {/* Top Header with Back to Home button */}
      {onBack && (
        <div className="flex items-center justify-between pb-1 border-b gap-2" style={{ borderColor: theme.borderSubtle }}>
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary
            }}
          >
            <ArrowLeft size={14} style={{ color: theme.primary }} />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold hidden sm:inline" style={{ color: theme.textSecondary }}>Reports & Analysis</span>
            <span 
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold capitalize"
              style={{
                backgroundColor: `${theme.primary}18`,
                borderColor: `${theme.primary}35`,
                color: theme.primary
              }}
            >
              {timeScope} view
            </span>
          </div>
        </div>
      )}

      {/* 1. GLASSY SCOPE CONTROL PANEL AT THE TOP */}
      <div 
        className="p-4 border rounded-[24px] flex flex-col gap-4 text-left shadow-lg backdrop-blur-md relative transition-colors"
        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, borderRadius: themeRadius }}
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 font-display" style={{ color: theme.textPrimary }}>
              <TrendingUp size={16} style={{ color: theme.primary }} />
              Dynamic Analysis
            </h3>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: theme.textSecondary }}>Overlapping Cashflow Comparison</p>
          </div>

          {/* Scope selection buttons: Month, Yearly, All */}
          <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}>
            {(['month', 'yearly', 'all'] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => handleTimeScopeChange(scope)}
                className="px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                style={{
                  backgroundColor: timeScope === scope ? theme.surfaceElevated : 'transparent',
                  color: timeScope === scope ? theme.primary : theme.textSecondary,
                  boxShadow: timeScope === scope ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Context Selector based on timeScope */}
        <div className="flex items-center justify-between py-1 px-1 border-t pt-3" style={{ borderColor: theme.borderSubtle }}>
          {timeScope === 'month' && (
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-[10px] uppercase font-mono tracking-widest font-bold" style={{ color: theme.textSecondary }}>
                Select Month
              </span>
              <div className="relative flex items-center gap-2">
                <CalendarDays size={14} className="absolute left-2.5 pointer-events-none" style={{ color: theme.primary }} />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="border text-xs rounded-xl pl-8 pr-2.5 py-1.5 font-bold outline-none cursor-pointer text-right transition-colors"
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary
                  }}
                />
              </div>
            </div>
          )}

          {timeScope === 'yearly' && (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] uppercase font-mono tracking-widest font-bold" style={{ color: theme.textSecondary }}>
                Select Year
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleYearChange(-1)}
                  className="p-1.5 border active:scale-90 rounded-lg transition-all cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span 
                  className="text-xs font-black font-mono px-3 py-1 rounded-lg border tracking-wider"
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.primary
                  }}
                >
                  {selectedYear}
                </span>
                <button
                  onClick={() => handleYearChange(1)}
                  className="p-1.5 border active:scale-90 rounded-lg transition-all cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {timeScope === 'all' && (
            <div className="flex justify-between w-full items-center">
              <span className="text-[10px] uppercase font-mono tracking-widest font-bold" style={{ color: theme.textSecondary }}>
                Total Account Lifespan
              </span>
              <span 
                className="text-[10px] font-mono px-2.5 py-1 rounded-lg border font-bold"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textSecondary
                }}
              >
                All Logs Combined
              </span>
            </div>
          )}
        </div>

        {/* Three Column Cashflow Box */}
        <div className="grid grid-cols-3 gap-1 p-3 border rounded-2xl" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}>
          <div className="flex flex-col pl-1">
            <span className="text-[8px] uppercase tracking-widest font-mono font-black text-rose-400 flex items-center gap-1">
              <ArrowDownRight size={8} /> Expense
            </span>
            <span className="text-xs font-black font-mono text-rose-400 mt-1 truncate">
              {currencySymbol} {totalExpense.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col border-x px-2" style={{ borderColor: theme.borderSubtle }}>
            <span className="text-[8px] uppercase tracking-widest font-mono font-black text-emerald-400 flex items-center gap-1">
              <ArrowUpRight size={8} /> Income
            </span>
            <span className="text-xs font-black font-mono text-emerald-400 mt-1 truncate">
              {currencySymbol} {totalIncome.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col pl-2">
            <span className="text-[8px] uppercase tracking-widest font-mono font-black" style={{ color: theme.textSecondary }}>
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
        style={{ 
          backgroundColor: theme.surfaceElevated, 
          borderColor: theme.borderSubtle 
        }}
      >
        <div className="flex justify-between items-center mb-1 text-left">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold" style={{ color: theme.textSecondary }}>
              Spline Area Cashflow Chart
            </span>
            <span className="text-[9px] font-mono mt-0.5" style={{ color: theme.textMuted }}>
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
            <div 
              className="h-full flex flex-col items-center justify-center border border-dashed rounded-2xl"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
            >
              <span className="text-2xl mb-1">📈</span>
              <span className="text-[10px] font-mono" style={{ color: theme.textSecondary }}>No sufficient cashflow data to plot.</span>
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
                <CartesianGrid strokeDasharray="3 3" stroke={theme.isDark ? '#ffffff10' : '#00000010'} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke={theme.textMuted} 
                  fontSize={8} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke={theme.textMuted} 
                  fontSize={8} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.isDark ? '#ffffff20' : '#00000020', strokeWidth: 1 }} />
                
                {/* Income Area Curve */}
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  name="income"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                  activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: theme.surfaceElevated }}
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
                  activeDot={{ r: 5, stroke: '#f43f5e', strokeWidth: 2, fill: theme.surfaceElevated }}
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
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.textSecondary }}>
              {chartClickedItem ? 'Filtered ledger' : 'Ledger summary'}
            </span>
            {chartClickedItem && (
              <span className="text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {chartClickedItem.label}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono" style={{ color: theme.textSecondary }}>
            {directoryTransactions.length} logs
          </span>
        </div>

        {directoryTransactions.length === 0 ? (
          <div 
            className="text-center py-12 rounded-[24px] border border-dashed"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
          >
            <span className="text-3xl block mb-2">📒</span>
            <p className="text-xs font-mono" style={{ color: theme.textSecondary }}>No logs logged for this specific period selection.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.keys(groupedTransactions).map((dateHeader) => (
              <div key={dateHeader} className="flex flex-col gap-2">
                {/* Date header banner */}
                <div className="py-1 px-1 flex justify-between items-center border-b" style={{ borderColor: theme.borderSubtle }}>
                  <span className="text-xs font-bold tracking-wide" style={{ color: theme.textSecondary }}>
                    {dateHeader}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: theme.textMuted }}>
                    {groupedTransactions[dateHeader].length} logs
                  </span>
                </div>

                {/* Group items list */}
                <div className="flex flex-col gap-2">
                  {groupedTransactions[dateHeader].map((tx) => {
                    const matchedCategory = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase() || c.id === tx.category);
                    const iconName = matchedCategory ? matchedCategory.icon : 'HelpCircle';
                    const IconComponent = CATEGORY_ICONS_MAP[iconName] || HelpCircle;
                    const catColor = matchedCategory ? matchedCategory.color : '#64748B';

                    const isSwipedDelete = swipedTx?.id === tx.id && swipedTx.action === 'delete';
                    const isSwipedEdit = swipedTx?.id === tx.id && swipedTx.action === 'edit';

                    return (
                      <div key={tx.id} className="relative overflow-hidden w-full rounded-2xl h-[72px]">
                    {/* Left track: Uncovered on Left-to-Right slide -> Actionable EDIT button (Blue with Pencil) */}
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

                        {/* Draggable container matching Ledger tab */}
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
                          className="absolute inset-0 w-full h-full flex items-center justify-between p-3.5 border cursor-grab active:cursor-grabbing rounded-2xl z-10 transition-colors select-none"
                          style={{
                            backgroundColor: theme.surfaceElevated,
                            borderColor: theme.borderSubtle
                          }}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 animate-fade-in shadow-sm"
                              style={{ backgroundColor: catColor }}
                            >
                              <IconComponent size={20} />
                            </div>
                            
                            <div className="flex flex-col truncate text-left">
                              <span className="text-sm font-semibold truncate leading-tight" style={{ color: theme.textPrimary }}>
                                {tx.note || tx.category}
                              </span>
                              <span className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: theme.textSecondary }}>
                                <span className="font-semibold uppercase tracking-wider text-[9px] opacity-75">{tx.category}</span>
                                {tx.subCategory && (
                                  <>
                                    <ChevronRight size={10} style={{ color: theme.textMuted }} />
                                    <span className="opacity-90">{tx.subCategory}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end text-right font-mono">
                            <span className={`text-sm font-extrabold ${isIncome(tx) ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {isIncome(tx) ? '+' : '-'} {currencySymbol} {tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[9px] mt-0.5" style={{ color: theme.textSecondary }}>
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

      {/* Inline transactional editing modal portal */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 z-[99] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
            <div className="absolute inset-0" onClick={() => setEditingTx(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-3xl relative z-10 text-left shadow-2xl"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Edit Log Entry</span>
                <button 
                  onClick={() => {
                    setEditingTx(null);
                    setEditError('');
                  }} 
                  className="cursor-pointer transition-colors"
                  style={{ color: theme.textMuted }}
                >
                  <X size={16} />
                </button>
              </div>

              {editError && (
                <div className="p-2.5 mb-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: theme.textSecondary }}>Notes / Description</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => {
                      setEditNote(e.target.value);
                      setEditError('');
                    }}
                    className="border rounded-xl p-2.5 text-xs outline-none font-semibold transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: theme.textSecondary }}>Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value);
                      setEditError('');
                    }}
                    className="border rounded-xl p-2.5 text-xs outline-none font-mono font-black transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    if (editingTx) {
                      const parsedAmount = parseFloat(editAmount);
                      if (isNaN(parsedAmount) || parsedAmount <= 0) {
                        setEditError('Please enter a valid amount greater than 0');
                        return;
                      }
                      onEditTransaction(editingTx.id, {
                        note: editNote.trim(),
                        amount: parsedAmount
                      });
                      triggerHapticFeedback();
                      setEditingTx(null);
                      setEditError('');
                    }
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all mt-2 cursor-pointer active:scale-95 shadow-md"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.primaryContent
                  }}
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
