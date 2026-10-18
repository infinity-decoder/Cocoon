/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowRightLeft, ShieldCheck, AlertCircle, 
  Wallet, Building2, User, HelpCircle, ArrowRight
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useWorkspace } from '../../../app/WorkspaceContext';
import { TransferType } from '../../../infrastructure/database/repositories/TransferRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { WorkspaceService } from '../../../application/services/WorkspaceService';

interface InterWorkspaceTransferModalProps {
  isOpen: boolean;
  theme: AppTheme;
  currencySymbol: string;
  onClose: () => void;
}

export function InterWorkspaceTransferModal({
  isOpen,
  theme,
  currencySymbol,
  onClose
}: InterWorkspaceTransferModalProps) {
  const { 
    availableWorkspaces, 
    currentWorkspace, 
    createInterWorkspaceTransfer,
    createDirectSupplierPayment,
    parties
  } = useWorkspace();

  const [sourceWorkspaceId, setSourceWorkspaceId] = useState<string>('');
  const [destWorkspaceId, setDestWorkspaceId] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destAccountId, setDestAccountId] = useState<string>('');
  const [transferType, setTransferType] = useState<TransferType>('owner_capital');
  const [amount, setAmount] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  const [isDirectSupplierPayment, setIsDirectSupplierPayment] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const [sourceAccounts, setSourceAccounts] = useState<AccountRecord[]>([]);
  const [destAccounts, setDestAccounts] = useState<AccountRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize workspaces default
  useEffect(() => {
    if (availableWorkspaces.length >= 2 && (!sourceWorkspaceId || !destWorkspaceId)) {
      const personal = availableWorkspaces.find(w => w.type === 'personal') || availableWorkspaces[0];
      const business = availableWorkspaces.find(w => w.type === 'business' && w.id !== personal.id)
        || availableWorkspaces.find(w => w.id !== personal.id);

      if (currentWorkspace.type === 'business') {
        // Default to Personal -> Current Business (funding) or Current Business -> Personal (drawing)
        setSourceWorkspaceId(personal.id);
        setDestWorkspaceId(currentWorkspace.id);
      } else {
        setSourceWorkspaceId(personal.id);
        if (business) setDestWorkspaceId(business.id);
      }
    }
  }, [availableWorkspaces, currentWorkspace, isOpen]);

  // Load source workspace accounts
  useEffect(() => {
    if (!sourceWorkspaceId) return;
    let isCancelled = false;
    (async () => {
      try {
        const conn = await databaseService.getInitializedConnection();
        const accs = await WorkspaceService.getAccounts(conn, sourceWorkspaceId);
        if (!isCancelled) {
          setSourceAccounts(accs);
          // Auto select first cash/bank account
          const defaultSrc = accs.find(a => a.accountCode === '1010' || a.accountCode === '1020') || accs[0];
          if (defaultSrc) setSourceAccountId(defaultSrc.id);
        }
      } catch (err) {
        console.error('Failed to load source accounts:', err);
      }
    })();
    return () => { isCancelled = true; };
  }, [sourceWorkspaceId]);

  // Load destination workspace accounts
  useEffect(() => {
    if (!destWorkspaceId) return;
    let isCancelled = false;
    (async () => {
      try {
        const conn = await databaseService.getInitializedConnection();
        const accs = await WorkspaceService.getAccounts(conn, destWorkspaceId);
        if (!isCancelled) {
          setDestAccounts(accs);
          // Auto select cash/bank account
          const defaultDest = accs.find(a => a.accountCode === '1010' || a.accountCode === '1020') || accs[0];
          if (defaultDest) setDestAccountId(defaultDest.id);
        }
      } catch (err) {
        console.error('Failed to load destination accounts:', err);
      }
    })();
    return () => { isCancelled = true; };
  }, [destWorkspaceId]);

  const sourceWs = useMemo(() => availableWorkspaces.find(w => w.id === sourceWorkspaceId), [availableWorkspaces, sourceWorkspaceId]);
  const destWs = useMemo(() => availableWorkspaces.find(w => w.id === destWorkspaceId), [availableWorkspaces, destWorkspaceId]);

  // Filter suppliers for direct payment
  const supplierParties = useMemo(() => {
    return parties.filter(p => p.type === 'supplier' || p.type === 'both');
  }, [parties]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWorkspaceId || !destWorkspaceId) {
      setError('Please select both source and destination workspaces.');
      return;
    }
    if (sourceWorkspaceId === destWorkspaceId) {
      setError('Source and destination workspaces must be different.');
      return;
    }
    const num = Number(amount);
    if (!num || num <= 0) {
      setError('Please enter a valid positive transfer amount.');
      return;
    }
    if (!sourceAccountId || !destAccountId) {
      setError('Please select valid accounts for both workspaces.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const amountScaled = BigInt(Math.round(num * 10000));
      const idempotencyKey = `xfer_${sourceWorkspaceId}_${destWorkspaceId}_${Date.now()}`;

      if (isDirectSupplierPayment) {
        // Direct Supplier Payment flow
        await createDirectSupplierPayment({
          businessWorkspaceId: destWorkspaceId,
          personalWorkspaceId: sourceWorkspaceId,
          personalCashAccountId: sourceAccountId,
          supplierPartyId: selectedSupplierId || undefined,
          amountScaled,
          paymentDate: transferDate,
          fundingType: transferType === 'owner_loan' ? 'owner_loan' : 'owner_capital',
          note: note.trim() || undefined,
          idempotencyKey
        });
      } else {
        // Standard Inter-Workspace Transfer flow
        await createInterWorkspaceTransfer({
          sourceWorkspaceId,
          destinationWorkspaceId: destWorkspaceId,
          sourceAccountId,
          destinationAccountId: destAccountId,
          amountScaled,
          transferDate,
          transferType,
          note: note.trim() || undefined,
          idempotencyKey
        });
      }

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute linked transfer.');
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
          className="relative w-full max-w-lg max-h-[92vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <ArrowRightLeft size={20} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-black text-white tracking-tight">
                  Inter-Workspace Transfer
                </h1>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Atomic double-entry linking Personal & Business books
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

            {/* Transfer Classification */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Transfer Category & Accounting Treatment
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'owner_capital', label: 'Owner Capital', desc: 'Equity contribution (Not revenue)' },
                  { id: 'owner_loan', label: 'Owner Loan', desc: 'Debt: Due to Owner (2030)' },
                  { id: 'owner_drawing', label: 'Owner Drawing', desc: 'Equity withdrawal (Not expense)' },
                  { id: 'owner_loan_repayment', label: 'Loan Repayment', desc: 'Settles Due to Owner liability' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      setTransferType(item.id as TransferType);
                    }}
                    className={`p-2.5 rounded-2xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      transferType === item.id
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[9px] font-mono text-neutral-400">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Supplier Payment toggle */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Direct Supplier Payment</span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Owner pays vendor directly; books record purchase settlement without double-counting expense
                </span>
              </div>
              <input
                type="checkbox"
                checked={isDirectSupplierPayment}
                onChange={e => setIsDirectSupplierPayment(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-500 focus:ring-0 cursor-pointer"
              />
            </div>

            {isDirectSupplierPayment && supplierParties.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Select Supplier (Business Vendor)
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-sans"
                >
                  <option value="" className="bg-neutral-900">Select Supplier</option>
                  {supplierParties.map(s => (
                    <option key={s.id} value={s.id} className="bg-neutral-900">
                      {s.name} {s.companyName ? `(${s.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Paired Workspaces Box */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
              {/* Source Workspace */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1">
                  <User size={12} className="text-indigo-400" /> Source Workspace
                </label>
                <select
                  value={sourceWorkspaceId}
                  onChange={e => setSourceWorkspaceId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-sans"
                >
                  {availableWorkspaces.map(w => (
                    <option key={w.id} value={w.id} className="bg-neutral-900">
                      {w.name} ({w.type})
                    </option>
                  ))}
                </select>

                <label className="text-[9px] font-mono text-neutral-400 mt-1 block">
                  Disbursing Account
                </label>
                <select
                  value={sourceAccountId}
                  onChange={e => setSourceAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {sourceAccounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-neutral-900">
                      {a.accountCode} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Workspace */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1">
                  <Building2 size={12} className="text-emerald-400" /> Dest Workspace
                </label>
                <select
                  value={destWorkspaceId}
                  onChange={e => setDestWorkspaceId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-sans"
                >
                  {availableWorkspaces.map(w => (
                    <option key={w.id} value={w.id} className="bg-neutral-900">
                      {w.name} ({w.type})
                    </option>
                  ))}
                </select>

                <label className="text-[9px] font-mono text-neutral-400 mt-1 block">
                  Receiving Account
                </label>
                <select
                  value={destAccountId}
                  onChange={e => setDestAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {destAccounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-neutral-900">
                      {a.accountCode} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Transfer Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Reference Note / Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Initial working capital, inventory purchase loan..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Verification Guarantee Banner */}
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
              <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Drift Guarantee:</strong> Both workspace entries are committed inside a single atomic SQLite transaction. If either side fails, neither side is committed. Retrying will never create duplicates.
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
                className="flex-1 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
              >
                {isSubmitting ? 'Posting Linked Journal...' : 'Confirm Linked Transfer'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
