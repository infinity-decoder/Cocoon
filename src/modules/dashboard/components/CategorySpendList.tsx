/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home as HomeIcon } from 'lucide-react';
import { CategoryBreakdownItem } from '../calculations';
import { Category, Budget } from '../../../core/types';
import { CATEGORY_ICONS_MAP } from '../../categories/components/CategoryManager';

interface CategorySpendListProps {
  categories: CategoryBreakdownItem[];
  allCategories: Category[];
  budgets: Budget[];
  dashboardToggle: 'expense' | 'income';
  balanceRevealed: boolean;
  currencySymbol: string;
}

export default function CategorySpendList({
  categories,
  allCategories,
  budgets,
  dashboardToggle,
  balanceRevealed,
  currencySymbol
}: CategorySpendListProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5 mt-1.5">
      {categories.map((item, idx) => {
        const IconComponent = CATEGORY_ICONS_MAP[item.icon] || HomeIcon;
        const isPrivacyMasked = dashboardToggle === 'expense' && !balanceRevealed;

        const matchingCat = allCategories.find(c => c.name === item.name);
        const budgetLimit = dashboardToggle === 'expense' && matchingCat 
          ? budgets.find(b => b.categoryId === matchingCat.id || b.categoryId === matchingCat.name) 
          : undefined;
        const hasBudget = !!budgetLimit;
        const budgetAmount = budgetLimit ? budgetLimit.amount : 0;
        const percentSpent = hasBudget ? (item.amount / budgetAmount) * 100 : 0;

        return (
          <div 
            key={idx} 
            className="flex flex-col gap-2 p-3.5 bg-white/2 hover:bg-white/4 rounded-2xl border border-white/5 transition-all text-left"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" 
                  style={{ backgroundColor: item.color }}
                >
                  <IconComponent size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white tracking-wide">{item.name}</span>
                  <span className="text-[9px] text-neutral-400 font-mono mt-0.5">
                    {dashboardToggle === 'expense' ? (
                      hasBudget ? (
                        <span className={percentSpent > 100 ? 'text-rose-400 font-extrabold' : 'text-neutral-400'}>
                          {percentSpent.toFixed(0)}% of {currencySymbol} {budgetAmount.toLocaleString()} budget
                        </span>
                      ) : (
                        'No budget allocated'
                      )
                    ) : (
                      `${item.percentage.toFixed(1)}% of Total`
                    )}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end text-right font-mono">
                <span className="text-xs font-extrabold text-white">
                  {isPrivacyMasked ? `${currencySymbol} •••••` : `${currencySymbol} ${item.amount.toLocaleString()}`}
                </span>
                {dashboardToggle === 'expense' && hasBudget && percentSpent > 100 && (
                  <span className="text-[7.5px] font-black uppercase text-rose-400 tracking-wider mt-0.5">
                    Over budget
                  </span>
                )}
              </div>
            </div>
            {/* Progress bar line */}
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500" 
                style={{ 
                  backgroundColor: dashboardToggle === 'expense' && hasBudget && percentSpent > 100 ? '#F43F5E' : item.color, 
                  width: `${Math.min(dashboardToggle === 'expense' ? (hasBudget ? percentSpent : 0) : item.percentage, 100)}%` 
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
