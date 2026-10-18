/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { PartyKhataService } from '../../../application/services/PartyKhataService';

interface ControlAccountsReconciliationModalProps {
  isOpen: boolean;
  workspaceId: string;
  currencySymbol: string;
  theme: AppTheme;
  onClose: () => void;
}

export function ControlAccountsReconciliationModal({
  isOpen,
  workspaceId,
  currencySymbol,
  theme,
  onClose
}: ControlAccountsReconciliationModalProps) {
  const [recon, setRecon] = useState<{
    isReconciled: boolean;
    customerLedgerTotalScaled: bigint;
    controlAccountReceivableScaled: bigint;
    supplierLedgerTotalScaled: bigint;
    controlAccountPayableScaled: bigint;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatScaled = (scaledVal?: bigint | number | null) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = typeof scaledVal === 'bigint' ? Number(scaledVal) / 10000 : Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const runReconciliation = async () => {
    setIsLoading(true);
    try {
      const conn = await databaseService.getInitializedConnection();
      const res = await PartyKhataService.reconcileWithControlAccounts(conn, workspaceId);
      setRecon(res);
    } catch (err) {
      console.error('Reconciliation check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runReconciliation();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

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

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                General Ledger Control Reconciliation
              </span>
              <h2 className="text-lg font-black text-white mt-0.5 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                Accounting Control Reconciliation
              </h2>
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

          {/* Status Badge */}
          {recon && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              recon.isReconciled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {recon.isReconciled ? (
                <CheckCircle2 size={24} className="shrink-0" />
              ) : (
                <AlertCircle size={24} className="shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">
                  {recon.isReconciled
                    ? '100% Control Account Reconciled'
                    : 'Reconciliation Discrepancy Detected'}
                </span>
                <span className="text-xs text-neutral-400">
                  {recon.isReconciled
                    ? 'Individual sub-ledger Khata accounts match General Ledger control accounts (1200 & 2010).'
                    : 'Discrepancy detected between sub-ledger totals and GL control entries.'}
                </span>
              </div>
            </div>
          )}

          {/* Detailed Control Comparison */}
          {recon && (
            <div className="space-y-3 font-mono text-xs">
              {/* Accounts Receivable */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center font-bold text-emerald-400 border-b border-white/5 pb-1">
                  <span>Accounts Receivable (A/R)</span>
                  <span>Code 1200</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Customer Khata Ledgers:</span>
                  <span className="font-bold">{currencySymbol} {formatScaled(recon.customerLedgerTotalScaled)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>GL Control Account 1200:</span>
                  <span className="font-bold">{currencySymbol} {formatScaled(recon.controlAccountReceivableScaled)}</span>
                </div>
                <div className="flex justify-between text-neutral-400 pt-1 border-t border-white/5 text-[10px]">
                  <span>Variance:</span>
                  <span className={recon.customerLedgerTotalScaled === recon.controlAccountReceivableScaled ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                    {currencySymbol} {formatScaled(recon.customerLedgerTotalScaled - recon.controlAccountReceivableScaled)}
                  </span>
                </div>
              </div>

              {/* Accounts Payable */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center font-bold text-blue-400 border-b border-white/5 pb-1">
                  <span>Accounts Payable (A/P)</span>
                  <span>Code 2010</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Supplier Khata Ledgers:</span>
                  <span className="font-bold">{currencySymbol} {formatScaled(recon.supplierLedgerTotalScaled)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>GL Control Account 2010:</span>
                  <span className="font-bold">{currencySymbol} {formatScaled(recon.controlAccountPayableScaled)}</span>
                </div>
                <div className="flex justify-between text-neutral-400 pt-1 border-t border-white/5 text-[10px]">
                  <span>Variance:</span>
                  <span className={recon.supplierLedgerTotalScaled === recon.controlAccountPayableScaled ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                    {currencySymbol} {formatScaled(recon.supplierLedgerTotalScaled - recon.controlAccountPayableScaled)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => {
                triggerHapticFeedback();
                runReconciliation();
              }}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Re-verifying...' : 'Re-verify Control Accounts'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
