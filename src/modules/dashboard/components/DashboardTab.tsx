/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { AppTheme } from '../../../core/theme';
import { Category, Budget } from '../../../core/types';
import { CategoryBreakdownResult, DoughnutSegmentItem } from '../calculations';
import NetBalanceCard from './NetBalanceCard';
import CategoryDonutChart from './CategoryDonutChart';
import CategorySpendList from './CategorySpendList';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface DashboardTabProps {
  netBalance: number;
  balanceRevealed: boolean;
  currencySymbol: string;
  theme: AppTheme;
  onToggleBalanceReveal: () => void;
  dashboardToggle: 'expense' | 'income';
  onToggleDashboardView: () => void;
  categoryBreakdown: CategoryBreakdownResult;
  doughnutSegments: DoughnutSegmentItem[];
  monthIncome: number;
  activeDoughnutIndex: number | null;
  onSelectDoughnutIndex: (index: number | null) => void;
  allCategories: Category[];
  budgets: Budget[];
}

export default function DashboardTab({
  netBalance,
  balanceRevealed,
  currencySymbol,
  theme,
  onToggleBalanceReveal,
  dashboardToggle,
  onToggleDashboardView,
  categoryBreakdown,
  doughnutSegments,
  monthIncome,
  activeDoughnutIndex,
  onSelectDoughnutIndex,
  allCategories,
  budgets
}: DashboardTabProps) {
  return (
    <motion.div
      key="dashboard-tab"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-4.5"
    >
      {/* 1. DYNAMIC PRIVACY NET BALANCE HERO CARD */}
      <NetBalanceCard
        netBalance={netBalance}
        balanceRevealed={balanceRevealed}
        currencySymbol={currencySymbol}
        theme={theme}
        onToggleReveal={onToggleBalanceReveal}
      />

      {/* 2. INTERACTIVE OVERVIEW SWITCHER TOGGLE */}
      <div className="flex justify-between items-center px-1 mt-1">
        <span className="text-xs font-black uppercase tracking-widest font-mono text-neutral-400">
          {dashboardToggle === 'expense' ? 'Expense Category Overview' : 'Income Category Overview'}
        </span>
        <button
          onClick={() => {
            triggerHapticFeedback();
            onToggleDashboardView();
          }}
          className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 font-mono"
        >
          {dashboardToggle === 'expense' ? 'Show Income' : 'Show Expense'}
        </button>
      </div>

      {/* 3. DONUT CHART REPRESENTATION */}
      <CategoryDonutChart
        segments={doughnutSegments}
        totalAmount={categoryBreakdown.total}
        monthIncome={monthIncome}
        dashboardToggle={dashboardToggle}
        activeSegmentIndex={activeDoughnutIndex}
        onSegmentChange={onSelectDoughnutIndex}
        theme={theme}
      />

      {/* 4. VERTICAL LIST OF SPENT/EARNED CATEGORIES */}
      <CategorySpendList
        categories={categoryBreakdown.list}
        allCategories={allCategories}
        budgets={budgets}
        dashboardToggle={dashboardToggle}
        balanceRevealed={balanceRevealed}
        currencySymbol={currencySymbol}
      />
    </motion.div>
  );
}
