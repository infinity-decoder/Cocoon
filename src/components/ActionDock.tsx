/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plus, Minus, FileText, PieChart, Sparkles } from 'lucide-react';
import { Transaction, Budget } from '../types';
import { motion } from 'motion/react';
import AnimatedTicker from './AnimatedTicker';

interface ActionDockProps {
  onAddIncome: () => void;
  onAddExpense: () => void;
  onNavigateToHistory: () => void;
  onNavigateToBudget: () => void;
  lastTransactions: Transaction[];
  budgets: Budget[];
  transactions: Transaction[];
  currencySymbol?: string;
  themeRadius: string;
}

export default function ActionDock({
  onAddIncome,
  onAddExpense,
  onNavigateToHistory,
  onNavigateToBudget,
  lastTransactions,
  budgets,
  transactions,
  currencySymbol = '$',
  themeRadius
}: ActionDockProps) {
  // Math for Budget status progress ring
  // Calculate average percentage of spent budgets
  let overallSpent = 0;
  let overallBudget = 0;
  
  budgets.forEach(b => {
    // Sum transactions for this category in current month
    const totalSpentInCat = transactions
      .filter(t => t.type === 'expense' && t.category === b.categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
    overallSpent += totalSpentInCat;
    overallBudget += b.amount;
  });

  const budgetRatio = overallBudget > 0 ? Math.min(overallSpent / overallBudget, 1.5) : 0;
  const budgetPercentage = Math.round(budgetRatio * 100);

  // SVG parameters for progress circle
  const strokeWidth = 5;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(budgetRatio, 1) * circumference);

  let budgetColor = 'stroke-emerald-400';
  if (budgetPercentage > 90) {
    budgetColor = 'stroke-rose-500';
  } else if (budgetPercentage > 70) {
    budgetColor = 'stroke-amber-400';
  }

  return (
    <div className="w-full flex flex-col gap-2.5 select-none mt-2">
      <span className="text-xs font-semibold tracking-wider opacity-60 uppercase px-1">
        Command Operations
      </span>

      <div className="grid grid-cols-2 gap-3.5">
        {/* ADD INCOME CARD: Top-Left (Green Gradient) */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={onAddIncome}
          className={`h-36 relative overflow-hidden bg-gradient-to-br from-emerald-500/80 to-teal-600/90 text-white p-5 flex flex-col justify-between text-left shadow-lg cursor-pointer ${themeRadius}`}
        >
          {/* Large background plus icon */}
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10 pointer-events-none">
            <Plus size={110} strokeWidth={1} />
          </div>

          <div className="p-2.5 bg-white/10 border border-white/20 rounded-2xl w-fit">
            <Plus size={24} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold tracking-tight">Add Income</span>
            <span className="text-[10px] opacity-80 tracking-wide font-light">Deposit external rewards</span>
          </div>
        </motion.button>

        {/* ADD EXPENSE CARD: Top-Right (Red/Coral Gradient) */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={onAddExpense}
          className={`h-36 relative overflow-hidden bg-gradient-to-br from-rose-500/80 to-orange-500/90 text-white p-5 flex flex-col justify-between text-left shadow-lg cursor-pointer ${themeRadius}`}
        >
          {/* Large background minus icon */}
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10 pointer-events-none">
            <Minus size={110} strokeWidth={1} />
          </div>

          <div className="p-2.5 bg-white/10 border border-white/20 rounded-2xl w-fit">
            <Minus size={24} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold tracking-tight">Add Expense</span>
            <span className="text-[10px] opacity-80 tracking-wide font-light">Record financial outgoing</span>
          </div>
        </motion.button>

        {/* VIEW ALL TRANSACTIONS CARD: Bottom-Left (Neutral Slate) */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={onNavigateToHistory}
          className={`h-40 relative overflow-hidden bg-neutral-800/40 border border-white/5 text-left p-4 flex flex-col justify-between shadow-lg cursor-pointer ${themeRadius}`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-1.5 bg-white/5 border border-white/10 rounded-xl">
              <FileText size={16} className="text-neutral-300" />
            </div>
            <span className="text-[9px] text-neutral-400 font-mono">History</span>
          </div>

          {/* Mini preview of last 3 transactions */}
          <div className="flex flex-col gap-1.5 w-full my-2">
            {lastTransactions.slice(0, 3).map((t, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                <span className="truncate max-w-[85px] text-neutral-300 font-light">
                  {t.note || t.category}
                </span>
                <span className={`font-mono font-medium ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{currencySymbol}{t.amount.toFixed(0)}
                </span>
              </div>
            ))}
            {lastTransactions.length === 0 && (
              <span className="text-[10px] text-neutral-500 text-center py-2">No transactions recorded yet</span>
            )}
          </div>

          <span className="text-[10px] text-neutral-400 font-medium underline">
            View full history &rarr;
          </span>
        </motion.button>

        {/* BUDGET STATUS CARD: Bottom-Right (Amber/Purple Gradient) */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -3 }}
          onClick={onNavigateToBudget}
          className={`h-40 relative overflow-hidden bg-neutral-800/40 border border-white/5 text-left p-4 flex flex-col justify-between shadow-lg cursor-pointer ${themeRadius}`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-1.5 bg-white/5 border border-white/10 rounded-xl">
              <PieChart size={16} className="text-amber-400" />
            </div>
            <span className="text-[9px] text-neutral-400 font-mono">Caps</span>
          </div>

          {/* Visual Mini Progress Circle */}
          <div className="flex items-center gap-2.5 my-2 w-full">
            <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  fill="transparent"
                  className={`${budgetColor} transition-all duration-500`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-[10px] font-mono font-bold text-neutral-200">
                {budgetPercentage}%
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-neutral-200 truncate leading-tight">Monthly Caps</span>
              <span className="text-[9px] text-neutral-400 font-light leading-snug">
                Spent: <AnimatedTicker value={overallSpent} currencySymbol={currencySymbol} decimalPlaces={0} className="text-[9px] text-amber-300 font-bold" />
              </span>
            </div>
          </div>

          <span className="text-[10px] text-amber-400 font-medium underline">
            Manage Limits &rarr;
          </span>
        </motion.button>
      </div>
    </div>
  );
}
