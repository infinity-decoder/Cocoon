/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Layers, Plus, CheckCircle2, AlertCircle, 
  Search, ShieldCheck, Scale, FileText, ChevronRight
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { AccountRecord, AccountType, AccountSubCategory, ReportMapping, AccountBalanceResult } from '../../../infrastructure/database/repositories/AccountRepository';
import { WorkspaceService } from '../../../application/services/WorkspaceService';

interface ChartOfAccountsModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceName: string;
  currencySymbol: string;
  theme: AppTheme;
  onClose: () => void;
}

export function ChartOfAccountsModal({
  isOpen,
  workspaceId,
  workspaceName,
  currencySymbol,
  theme,
  onClose
}: ChartOfAccountsModalProps) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [trialBalance, setTrialBalance] = useState<{
    balances: AccountBalanceResult[];
    totalDebitsScaled: bigint;
    totalCreditsScaled: bigint;
    isBalanced: boolean;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // New account form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('asset');
  const [newSubCategory, setNewSubCategory] = useState<AccountSubCategory>('cash');
  const [newReportMapping, setNewReportMapping] = useState<ReportMapping>('balance_sheet');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const formatScaled = (scaledVal?: bigint | null) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const loadAccounts = useCallback(async () => {
    if (!workspaceId || !isOpen) return;
    setIsLoading(true);
    try {
      const conn = await databaseService.getInitializedConnection();
      const [accList, tb] = await Promise.all([
        WorkspaceService.getAccounts(conn, workspaceId),
        WorkspaceService.getTrialBalance(conn, workspaceId)
      ]);
      setAccounts(accList);
      setTrialBalance(tb);
    } catch (err) {
      console.error('Failed to load accounts and trial balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, isOpen]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const balanceMap = useMemo(() => {
    const map = new Map<string, AccountBalanceResult>();
    if (trialBalance) {
      for (const b of trialBalance.balances) {
        map.set(b.accountId, b);
      }
    }
    return map;
  }, [trialBalance]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesTab = activeTab === 'all' || acc.type === activeTab;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || acc.name.toLowerCase().includes(q) || acc.accountCode.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [accounts, activeTab, searchQuery]);

  // Adjust subcategories when type changes
  const handleTypeChange = (t: AccountType) => {
    setNewType(t);
    if (t === 'asset') {
      setNewSubCategory('cash');
      setNewReportMapping('balance_sheet');
    } else if (t === 'liability') {
      setNewSubCategory('supplier_payables');
      setNewReportMapping('balance_sheet');
    } else if (t === 'equity') {
      setNewSubCategory('capital');
      setNewReportMapping('balance_sheet');
    } else if (t === 'revenue') {
      setNewSubCategory('sales');
      setNewReportMapping('income_statement');
    } else if (t === 'expense') {
      setNewSubCategory('operating_expenses');
      setNewReportMapping('income_statement');
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setFormError('Account Code and Account Name are required.');
      return;
    }

    setFormError(null);
    try {
      const conn = await databaseService.getInitializedConnection();
      await WorkspaceService.createAccount(conn, workspaceId, {
        accountCode: newCode.trim(),
        name: newName.trim(),
        type: newType,
        subCategory: newSubCategory,
        reportMapping: newReportMapping,
        description: newDescription.trim() || undefined
      });

      triggerHapticFeedback();
      setIsCreatingAccount(false);
      setNewCode('');
      setNewName('');
      setNewDescription('');
      await loadAccounts();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create account.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[92vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                <Layers size={20} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-black text-white tracking-tight">
                  Chart of Accounts & General Ledger
                </h1>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {workspaceName} · Explicit report mapping & balances
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsCreatingAccount(!isCreatingAccount);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={14} />
                {isCreatingAccount ? 'Cancel' : 'New Account'}
              </button>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onClose();
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Trial Balance Health Banner */}
          {trialBalance && (
            <div className={`p-3 rounded-2xl border flex justify-between items-center text-xs font-mono ${
              trialBalance.isBalanced
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                <Scale size={16} className={trialBalance.isBalanced ? 'text-emerald-400' : 'text-rose-400'} />
                <span>
                  Trial Balance Status: <strong>{trialBalance.isBalanced ? 'BALANCED' : 'UNBALANCED'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span>Debits: {currencySymbol} {formatScaled(trialBalance.totalDebitsScaled)}</span>
                <span>Credits: {currencySymbol} {formatScaled(trialBalance.totalCreditsScaled)}</span>
              </div>
            </div>
          )}

          {/* Create Custom Account Form Drawer */}
          {isCreatingAccount && (
            <form onSubmit={handleCreateAccount} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
              <span className="text-xs font-bold text-white">Create Custom Account</span>

              {formError && (
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">Account Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1030, 2060, 5030"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">Account Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Petty Cash, Office Rent"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">Type *</label>
                  <select
                    value={newType}
                    onChange={e => handleTypeChange(e.target.value as AccountType)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">Subcategory *</label>
                  <select
                    value={newSubCategory}
                    onChange={e => setNewSubCategory(e.target.value as AccountSubCategory)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    {newType === 'asset' && (
                      <>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="receivables">Receivables</option>
                        <option value="inventory">Inventory</option>
                        <option value="other_assets">Other Assets</option>
                      </>
                    )}
                    {newType === 'liability' && (
                      <>
                        <option value="supplier_payables">Supplier Payables</option>
                        <option value="taxes_payable">Taxes Payable</option>
                        <option value="owner_loans_payable">Owner Loans Payable</option>
                        <option value="other_liabilities">Other Liabilities</option>
                      </>
                    )}
                    {newType === 'equity' && (
                      <>
                        <option value="capital">Capital</option>
                        <option value="retained_earnings">Retained Earnings</option>
                        <option value="owner_drawings">Owner Drawings</option>
                        <option value="other_equity">Other Equity</option>
                      </>
                    )}
                    {newType === 'revenue' && (
                      <>
                        <option value="sales">Sales</option>
                        <option value="other_income">Other Income</option>
                      </>
                    )}
                    {newType === 'expense' && (
                      <>
                        <option value="cogs">COGS</option>
                        <option value="operating_expenses">Operating Expenses</option>
                        <option value="other_expenses">Other Expenses</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">Report Mapping *</label>
                  <select
                    value={newReportMapping}
                    onChange={e => setNewReportMapping(e.target.value as ReportMapping)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="balance_sheet">Balance Sheet</option>
                    <option value="income_statement">Income Statement</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="py-2 rounded-xl bg-teal-500 text-neutral-950 font-bold text-xs cursor-pointer hover:bg-teal-400 transition-colors"
              >
                Save Account
              </button>
            </form>
          )}

          {/* Search & Category Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search account name or code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-teal-500 font-sans"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {(['all', 'asset', 'liability', 'equity', 'revenue', 'expense'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-bold capitalize transition-colors cursor-pointer border ${
                    activeTab === tab
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-neutral-400 font-mono">
                Loading Chart of Accounts...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-xs text-neutral-400">
                No accounts match the selected category.
              </div>
            ) : (
              filteredAccounts.map(acc => {
                const bal = balanceMap.get(acc.id);
                return (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-2xl border flex justify-between items-center transition-colors bg-white/5 hover:bg-white/[0.07]"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-teal-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {acc.accountCode}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          {acc.name}
                          {acc.isSystem && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-neutral-400 font-mono">
                              SYSTEM
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
                          <span className="capitalize text-teal-400">{acc.type}</span>
                          <span>·</span>
                          <span className="capitalize">{acc.subCategory?.replace(/_/g, ' ') || 'General'}</span>
                          <span>·</span>
                          <span className="text-neutral-500">{acc.reportMapping.replace(/_/g, ' ')}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">
                        {currencySymbol} {formatScaled(bal?.netBalanceScaled)}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-500">
                        {bal ? `${bal.normalBalanceType.toUpperCase()} normal` : '0.00 balance'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
