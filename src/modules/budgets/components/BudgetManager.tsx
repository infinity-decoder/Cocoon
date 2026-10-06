/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Plus, HelpCircle, ShieldAlert, ChevronLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import { Budget, Category, Transaction } from '../../../core/types';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_ICONS_MAP } from '../../categories';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface BudgetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  currencySymbol: string;
  onSetBudget: (categoryId: string, amount: number, rollover: boolean) => void;
  onDeleteBudget: (budgetId: string) => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  isInline?: boolean;
}

export default function BudgetManager({
  isOpen,
  onClose,
  budgets,
  categories,
  transactions,
  currencySymbol,
  onSetBudget,
  onDeleteBudget,
  isInline = false
}: BudgetManagerProps) {
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [formError, setFormError] = useState('');

  // Editing state for existing budget caps
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editCapAmount, setEditCapAmount] = useState<string>('');
  const [editRollover, setEditRollover] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // Get only expense categories
  const expenseCategories = categories.filter(c => c.type === 'expense' && c.isEnabled);

  const handleSetBudgetSubmit = () => {
    const amt = parseFloat(budgetAmount);
    const catId = selectedCategoryId || expenseCategories[0]?.id;
    if (!catId || isNaN(amt) || amt <= 0) {
      setFormError('Please select a category and enter a valid positive cap amount.');
      return;
    }

    onSetBudget(catId, amt, rollover);
    setBudgetAmount('');
    setFormError('');
    setShowAddBudget(false);
  };

  const handleStartEdit = (b: Budget) => {
    triggerHapticFeedback();
    setEditingBudgetId(b.id);
    setEditCapAmount(b.amount.toString());
    setEditRollover(!!b.rollover);
    setEditError('');
    setShowAddBudget(false);
  };

  const handleSaveEdit = (b: Budget) => {
    const amt = parseFloat(editCapAmount);
    if (isNaN(amt) || amt <= 0) {
      setEditError('Please enter a valid positive cap amount.');
      return;
    }
    triggerHapticFeedback();
    onSetBudget(b.categoryId, amt, editRollover);
    setEditingBudgetId(null);
    setEditError('');
  };

  const handleCancelEdit = () => {
    triggerHapticFeedback();
    setEditingBudgetId(null);
    setEditError('');
  };

  if (!isInline && !isOpen) return null;

  const contentElement = (
    <div className={`w-full flex flex-col justify-between text-white ${isInline ? 'p-1' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/5 gap-4">
        <div className="flex flex-col text-left">
          <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Budget Caps Control</span>
          <span className="text-lg font-bold">Make Budget</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer text-xs font-semibold text-neutral-300 hover:text-white transition-all active:scale-95"
          title="Back to home"
        >
          <ChevronLeft size={14} />
          <span>Back to Home</span>
        </button>
      </div>

      {/* List of active Budgets */}
      <div className="flex-1 flex flex-col gap-3 py-4 overflow-y-auto scrollbar-none">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-neutral-400 uppercase">Configured Caps</span>
          {!showAddBudget && (
            <button
              onClick={() => setShowAddBudget(true)}
              className="text-xs text-emerald-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus size={14} /> Add Limit
            </button>
          )}
        </div>

        {/* ADD BUDGET IN-LINE FORM */}
        <AnimatePresence>
          {showAddBudget && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-white/3 border border-white/5 rounded-2xl flex flex-col gap-3"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold">Set Category Cap</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBudget(false);
                    setFormError('');
                  }}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {formError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2.5">
                {/* Select category */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400">Category</span>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl p-2 text-xs text-white cursor-pointer"
                  >
                    <option value="">Choose category</option>
                    {expenseCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Enter Amount */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-neutral-400 font-mono">Max Cap ({currencySymbol})</span>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Rollover checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rollover-box"
                  checked={rollover}
                  onChange={(e) => setRollover(e.target.checked)}
                  className="accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="rollover-box" className="text-xs text-neutral-300 cursor-pointer select-none">
                  Enable Roll-Over of unused limit to next month
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button
                  onClick={() => setShowAddBudget(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetBudgetSubmit}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold text-white cursor-pointer"
                >
                  Set Cap
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List items */}
        <div className="flex flex-col gap-3.5">
          {budgets.map(b => {
            const cat = categories.find(c => c.id === b.categoryId || c.name === b.categoryId);
            if (!cat) return null;

            const IconComp = CATEGORY_ICONS_MAP[cat.icon] || HelpCircle;

            // Sum expenses in this category for the current month
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const spentAmount = transactions
              .filter(t => t.type === 'expense' && t.category === cat.name && t.date.startsWith(currentMonth))
              .reduce((sum, t) => sum + t.amount, 0);

            const truePercentage = b.amount > 0 ? Math.round((spentAmount / b.amount) * 100) : 0;
            const barWidth = Math.min(truePercentage, 100);

            // Gauge alert color logic
            let strokeColor = '#10B981'; // Green
            let bgColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            let alertActive = false;

            if (spentAmount >= b.amount) {
              strokeColor = '#EF4444'; // Red (100%+)
              bgColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
              alertActive = true;
            } else if (spentAmount >= b.amount * 0.9) {
              strokeColor = '#EF4444'; // Red (90%+)
              bgColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
              alertActive = true;
            } else if (spentAmount >= b.amount * 0.70) {
              strokeColor = '#F59E0B'; // Yellow/Amber (70-90%)
              bgColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            }

            const isEditing = editingBudgetId === b.id;

            if (isEditing) {
              return (
                <div
                  key={b.id}
                  className="p-4 bg-white/5 border border-emerald-500/30 rounded-2xl flex flex-col gap-3 relative text-left shadow-lg ring-1 ring-emerald-500/20 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        <IconComp size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{cat.name}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Editing Budget Cap</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {editError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
                      {editError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Max Cap ({currencySymbol})
                    </span>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={editCapAmount}
                      onChange={(e) => setEditCapAmount(e.target.value)}
                      className="bg-neutral-800 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-rollover-${b.id}`}
                      checked={editRollover}
                      onChange={(e) => setEditRollover(e.target.checked)}
                      className="accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor={`edit-rollover-${b.id}`} className="text-xs text-neutral-300 cursor-pointer select-none">
                      Enable Roll-Over of unused limit to next month
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(b)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold text-white cursor-pointer shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Check size={13} strokeWidth={3} /> Save Cap
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={b.id}
                className="p-4 bg-white/3 border border-white/5 rounded-2xl flex flex-col gap-3 relative overflow-hidden text-left"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      <IconComp size={14} />
                    </div>
                    <span className="text-sm font-bold text-white">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(b)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-neutral-200 hover:text-white rounded-lg transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Edit budget cap"
                    >
                      <Pencil size={12} className="text-blue-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteBudget(b.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                      title="Delete budget cap"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress details */}
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-400">
                    Spent:{' '}
                    <span className="font-bold text-white">
                      {currencySymbol}
                      {spentAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </span>
                  <span className="text-neutral-500">
                    Cap: {currencySymbol}{b.amount}
                  </span>
                </div>

                {/* Progress Bar with markers */}
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: strokeColor }}
                  />
                </div>

                {/* Mini dynamic badge indicators */}
                <div className="flex justify-between items-center mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border uppercase tracking-wider ${bgColor}`}>
                    {truePercentage}% Spent
                  </span>
                  {b.rollover && (
                    <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                      Rollover On
                    </span>
                  )}
                </div>

                {/* Local exceed warning notifications */}
                {alertActive && (
                  <div className="mt-2.5 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-400 flex items-center gap-2">
                    <ShieldAlert size={14} className="flex-shrink-0 animate-bounce" />
                    <span>Warning: Outgoing cap has exceeded safety thresholds!</span>
                  </div>
                )}
              </div>
            );
          })}

          {budgets.length === 0 && (
            <div className="text-center py-6 text-neutral-500 text-xs">
              No outgoing caps defined yet. Set budgets to keep proactive control!
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm text-neutral-200 mt-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <ChevronLeft size={16} className="text-emerald-400" />
        <span>Back to Home</span>
      </button>
    </div>
  );

  return (
    <AnimatePresence>
      {isInline ? (
        contentElement
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-[28px] p-6 max-h-[85vh] overflow-y-auto flex flex-col justify-between text-white"
          >
            {contentElement}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
