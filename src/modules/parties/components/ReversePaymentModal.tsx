/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface ReversePaymentModalProps {
  isOpen: boolean;
  paymentId: string;
  paymentNumber: string;
  amountFormatted: string;
  theme: AppTheme;
  onClose: () => void;
  onConfirm: (paymentId: string, reason: string) => Promise<void>;
}

export function ReversePaymentModal({
  isOpen,
  paymentId,
  paymentNumber,
  amountFormatted,
  theme,
  onClose,
  onConfirm
}: ReversePaymentModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide an audited reason for reversing this payment.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(paymentId, reason.trim());
      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reverse payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-rose-400 font-bold uppercase">
                Audited Reversal Process
              </span>
              <h2 className="text-lg font-black text-white mt-0.5 flex items-center gap-2">
                <RotateCcw size={18} className="text-rose-400" />
                Reverse Payment
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1.5 text-xs text-rose-300">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <AlertTriangle size={16} />
                <span>Audited Correction Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-200/80">
                Reversing payment <strong className="font-mono text-white">{paymentNumber}</strong> ({amountFormatted}) will restore document balances to unpaid, post compensating journal entries, and record an audited reversal entry in the Khata. Transaction history is permanently preserved.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Reason for Reversal <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Cheque returned by bank / Double payment error / Incorrect account selected"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-rose-500 resize-none font-sans"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw size={16} />
                {isSubmitting ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
