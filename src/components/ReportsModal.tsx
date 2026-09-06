/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowDownRight, ArrowUpRight, TrendingUp, BarChart2 } from 'lucide-react';
import { Transaction, Category } from '../types';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  currencySymbol: string;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

import { triggerHapticFeedback } from '../utils/haptics';

export default function ReportsModal({
  isOpen,
  onClose,
  transactions,
  categories,
  currencySymbol,
  themeCardBg,
  themeBorder,
  themeRadius,
  currentMonth,
  onPrevMonth,
  onNextMonth
}: ReportsModalProps) {
  const [reportType, setReportType] = useState<'expense' | 'income'>('expense');

  // Month Switcher Computations
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonth));
  }, [transactions, currentMonth]);

  const monthIncome = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const monthExpense = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const filteredTx = useMemo(() => {
    return currentMonthTransactions.filter(t => {
      if (reportType === 'expense') {
        return t.type === 'expense' || t.type === 'savings_deposit';
      } else {
        return t.type === 'income' || t.type === 'savings_withdraw';
      }
    });
  }, [currentMonthTransactions, reportType]);

  const totalAmount = useMemo(() => {
    return filteredTx.reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTx]);

  // Aggregate by category
  const categorySummary = useMemo(() => {
    const summaryMap: Record<string, number> = {};
    
    filteredTx.forEach(t => {
      const catName = t.category;
      summaryMap[catName] = (summaryMap[catName] || 0) + t.amount;
    });

    return Object.entries(summaryMap)
      .map(([name, amount]) => {
        const catObj = categories.find(c => c.name === name || c.id === name);
        let percentage = 0;
        if (reportType === 'expense') {
          percentage = monthIncome > 0 ? (amount / monthIncome) * 100 : (totalAmount > 0 ? (amount / totalAmount) * 100 : 0);
        } else {
          percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        }
        return {
          name,
          amount,
          color: catObj?.color || '#64748B',
          icon: catObj?.icon || 'Tag',
          percentage
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTx, categories, totalAmount, reportType, monthIncome]);

  // Daily Spending Trend computations for the selected month:
  const dailyTrend = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const numDays = new Date(year, month, 0).getDate();
    
    const dailyAmounts = Array.from({ length: numDays }, (_, i) => ({
      day: i + 1,
      amount: 0
    }));

    filteredTx.forEach(t => {
      const day = new Date(t.date).getDate();
      if (day >= 1 && day <= numDays) {
        dailyAmounts[day - 1].amount += t.amount;
      }
    });

    return dailyAmounts;
  }, [filteredTx, currentMonth]);

  const maxDailyAmount = useMemo(() => {
    const max = Math.max(...dailyTrend.map(d => d.amount), 0);
    return max > 0 ? max : 1;
  }, [dailyTrend]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 select-none">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          {/* Header */}
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: themeBorder }}>
            <div>
              <h3 className="text-base font-black text-white font-display uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Deep Analysis
              </h3>
              <p className="text-[10px] text-neutral-400 font-mono">Month-to-month cashflow & percentages</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. CALENDAR MONTH SWITCHER CAPSULE (Moved from Home Screen) */}
            <div 
              className="flex items-center justify-between p-3 border rounded-2xl bg-neutral-950/40"
              style={{ borderColor: themeBorder }}
            >
              <button 
                onClick={() => { triggerHapticFeedback(); onPrevMonth(); }} 
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white cursor-pointer transition-colors text-[9px] font-mono uppercase tracking-widest font-black"
              >
                &larr; Prev
              </button>
              <span className="text-xs font-black tracking-widest font-mono uppercase text-emerald-400">
                {new Date(currentMonth + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => { triggerHapticFeedback(); onNextMonth(); }} 
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white cursor-pointer transition-colors text-[9px] font-mono uppercase tracking-widest font-black"
              >
                Next &rarr;
              </button>
            </div>

            {/* 2. THREE-COLUMN MONTHLY SUMMARY BOX (Moved from Home Screen) */}
            <div 
              className="grid grid-cols-3 gap-1 p-4.5 border text-left bg-neutral-950/20 rounded-2xl"
              style={{ borderColor: themeBorder }}
            >
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest font-mono font-black text-neutral-400">Expense</span>
                <span className="text-sm font-extrabold font-mono text-rose-400 mt-1 truncate">
                  {currencySymbol} {monthExpense.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col border-x border-white/5 px-2">
                <span className="text-[8px] uppercase tracking-widest font-mono font-black text-neutral-400">Income</span>
                <span className="text-sm font-extrabold font-mono text-emerald-400 mt-1 truncate">
                  {currencySymbol} {monthIncome.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col pl-2">
                <span className="text-[8px] uppercase tracking-widest font-mono font-black text-neutral-400">Total</span>
                <span className={`text-sm font-extrabold font-mono mt-1 truncate ${monthIncome - monthExpense >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {currencySymbol} {(monthIncome - monthExpense).toLocaleString()}
                </span>
              </div>
            </div>

            {/* DAILY TREND SPARKLINE / BAR CHART */}
            <div className="p-4 bg-black/10 border rounded-2xl flex flex-col gap-2" style={{ borderColor: themeBorder }}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-400">Daily {reportType === 'expense' ? 'Expense' : 'Income'} Flow</span>
                <span className="text-[9px] font-mono text-neutral-500">
                  Max: {currencySymbol} {maxDailyAmount.toLocaleString()}
                </span>
              </div>
              
              <div className="h-20 w-full flex items-end gap-1 pt-3 pb-1">
                {dailyTrend.map((d) => {
                  const heightPercent = (d.amount / maxDailyAmount) * 100;
                  return (
                    <div 
                      key={d.day} 
                      className="flex-1 flex flex-col items-center group relative h-full justify-end"
                    >
                      <div className="absolute bottom-full mb-1 bg-neutral-950 text-white text-[8px] font-mono px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                        Day {d.day}: {currencySymbol}{d.amount.toLocaleString()}
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all duration-300 ${
                          reportType === 'expense' 
                            ? 'bg-rose-500/40 hover:bg-rose-500 group-hover:scale-105' 
                            : 'bg-emerald-500/40 hover:bg-emerald-500 group-hover:scale-105'
                        }`}
                        style={{ height: `${Math.max(heightPercent, 3)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-neutral-500 font-mono">
                <span>Day 1</span>
                <span>Day {dailyTrend.length}</span>
              </div>
            </div>

            {/* Toggle Split Buttons */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-950/40 rounded-xl border border-white/5">
              <button
                onClick={() => { triggerHapticFeedback(); setReportType('expense'); }}
                className={`py-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider ${
                  reportType === 'expense'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                    : 'bg-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowDownRight size={12} />
                Expenses Split
              </button>
              <button
                onClick={() => { triggerHapticFeedback(); setReportType('income'); }}
                className={`py-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider ${
                  reportType === 'income'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowUpRight size={12} />
                Income Split
              </button>
            </div>

            {/* Distribution breakdown */}
            <div className="space-y-3.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  {reportType === 'expense' ? 'Percentage of Income' : 'Category Share'}
                </span>
                <span className="text-[9px] text-neutral-400 font-mono">
                  Total Split: {currencySymbol} {totalAmount.toLocaleString()}
                </span>
              </div>

              {categorySummary.length === 0 ? (
                <div className="text-center py-8 bg-neutral-950/10 rounded-2xl border border-dashed border-white/5">
                  <span className="text-2xl block mb-2">📊</span>
                  <span className="text-xs text-neutral-500 font-mono">No data logged for this category type.</span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {categorySummary.map((item, index) => (
                    <div key={index} className="space-y-1.5 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">({item.percentage.toFixed(1)}%)</span>
                        </div>
                        <span className="font-black text-white font-mono">
                          {currencySymbol} {item.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* Progress Bar Track */}
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(item.percentage, 100)}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
