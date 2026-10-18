/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRightLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useWorkspace } from '../../../app/WorkspaceContext';

interface IntraAccountTransferModalProps {
  isOpen: boolean;
  theme: AppTheme;
  currencySymbol: string;
  onClose: () => void;
}

export function IntraAccountTransferModal({
  isOpen,
  theme,
  currencySymbol,
  onClose
}: IntraAccountTransferModalProps) {
  const { currentWorkspace, accounts, createAccountTransfer } = useWorkspace();

  // Balance sheet liquid accounts (cash, bank, etc.)
  const liquidAccounts = useMemo(() => {
    return accounts.filter(a => a.type === 'asset' || a.type === 'liability');
  }, [accounts]);

  const [sourceAccountId, setSourceAccountId] = useState<string>(() => {
    const cash = liquidAccounts.find(a => a.accountCode === '1010');
    return cash?.id || liquidAccounts[0]?.id || '';
  });

  const [destAccountId, setDestAccountId] = useState<string>(() => {
    const bank = liquidAccounts.find(a => a.accountCode === '1020');
    return bank?.id || liquidAccounts[1]?.id || '';
  });

  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId || !destAccountId) {
      setError('Please select source and destination accounts.');
      return;
    }
    if (sourceAccountId === destAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }
    const num = Number(amount);
    if (!num || num <= 0) {
      setError('Please enter a valid positive transfer amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const amountScaled = BigInt(Math.round(num * 10000));
      await createAccountTransfer({
        workspaceId: currentWorkspace.id,
        sourceAccountId,
        destinationAccountId: destAccountId,
        amountScaled,
        transferDate,
        description: description.trim() || undefined,
        idempotencyKey: `intra_${currentWorkspace.id}_${Date.now()}`
      });

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to transfer between accounts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
          className="relative w-full max-w-md max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <ArrowRightLeft size={20} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-black text-white tracking-tight">
                  Account Transfer (Cash ↔ Bank)
                </h1>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {currentWorkspace.name} · Internal balance movement
                </span>
              </div>
            </div>

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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Source Account */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Transfer From (Source Account) *
              </label>
              <select
                value={sourceAccountId}
                onChange={e => setSourceAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                {liquidAccounts.map(a => (
                  <option key={a.id} value={a.id} className="bg-neutral-900">
                    {a.accountCode} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Account */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Transfer To (Destination Account) *
              </label>
              <select
                value={destAccountId}
                onChange={e => setDestAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                {liquidAccounts.map(a => (
                  <option key={a.id} value={a.id} className="bg-neutral-900">
                    {a.accountCode} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Note / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Cash deposit to bank account"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Guarantee Note */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
              <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Non-revenue movement:</strong> Internal account transfers adjust cash and bank balances without affecting profit, sales revenue, or operating expenses.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
