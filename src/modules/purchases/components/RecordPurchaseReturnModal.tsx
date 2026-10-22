/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, AlertCircle } from 'lucide-react';
import { PurchaseBillWithLines } from '../../../infrastructure/database/repositories/PurchaseRepository';
import { PurchaseService } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface RecordPurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  bill: PurchaseBillWithLines | null;
  currencySymbol: string;
}

interface ReturnLineInput {
  billLineId: string;
  productId: string;
  description: string;
  receivedQty: number;
  returnedQty: number;
  packageUnit: string;
  unitCostFormatted: string;
}

export function RecordPurchaseReturnModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  bill,
  currencySymbol
}: RecordPurchaseReturnModalProps) {
  const [returnNumber, setReturnNumber] = useState(`PR-${Date.now().toString().slice(-6)}`);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [settlementType, setSettlementType] = useState<'credit_note' | 'cash_refund' | 'bank_refund'>('credit_note');
  const [returnLines, setReturnLines] = useState<ReturnLineInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bill) {
      setReturnNumber(`PR-${Date.now().toString().slice(-6)}`);
      setReturnLines(
        bill.lines
          .filter(l => l.productId)
          .map(l => ({
            billLineId: l.id,
            productId: l.productId!,
            description: l.description,
            receivedQty: l.quantity,
            returnedQty: 0,
            packageUnit: l.packageUnit,
            unitCostFormatted: (Number(l.effectiveUnitCostScaled || l.unitCostScaled) / 10000).toFixed(2)
          }))
      );
    }
  }, [bill, isOpen]);

  if (!isOpen || !bill) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validLines = returnLines.filter(l => l.returnedQty > 0);
    if (validLines.length === 0) {
      setErrorMsg('Please enter return quantity greater than zero for at least one item.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please specify reason for the return.');
      return;
    }

    try {
      setIsSubmitting(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      await PurchaseService.recordPurchaseReturn(conn, workspaceId, {
        returnNumber,
        originalBillId: bill.id,
        returnDate,
        reason: reason.trim(),
        settlementType,
        lines: validLines.map(l => ({
          originalBillLineId: l.billLineId,
          productId: l.productId,
          description: l.description,
          returnedQuantity: l.returnedQty,
          packageUnit: l.packageUnit
        }))
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record purchase return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-5 my-8 text-white flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                <RotateCcw size={18} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white">Return Goods to Supplier</h2>
                <span className="text-[11px] text-neutral-400">
                  Bill #{bill.billNumber} · {bill.supplierName}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Return #</label>
                <input
                  type="text"
                  value={returnNumber}
                  onChange={e => setReturnNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            {/* Returnable Items */}
            <div className="border border-white/10 rounded-xl p-3 bg-neutral-950/40 flex flex-col gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Items to Return
              </span>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {returnLines.map((l, index) => (
                  <div
                    key={l.billLineId}
                    className="p-3 bg-neutral-900 border border-white/5 rounded-xl flex justify-between items-center gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{l.description}</span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        Cost: {currencySymbol} {l.unitCostFormatted} · Received: {l.receivedQty} {l.packageUnit}
                      </span>
                    </div>

                    <div className="w-28 flex flex-col items-end">
                      <label className="text-[10px] text-rose-400 block mb-0.5">Return Qty</label>
                      <input
                        type="number"
                        min="0"
                        max={l.receivedQty}
                        step="any"
                        value={l.returnedQty}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setReturnLines(prev =>
                            prev.map((item, i) => (i === index ? { ...item, returnedQty: val } : item))
                          );
                        }}
                        className="w-full bg-neutral-800 border border-rose-500/30 rounded-lg px-2 py-1 text-xs text-white font-mono text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement Type */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Settlement Type</label>
              <select
                value={settlementType}
                onChange={e => setSettlementType(e.target.value as any)}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="credit_note">Supplier Credit Note (Offset future purchases)</option>
                <option value="cash_refund">Immediate Cash Refund</option>
                <option value="bank_refund">Bank Account Refund</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Reason for Return *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Defective items, expired batch, incorrect specifications..."
                rows={2}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Processing Return...' : 'Confirm Return to Supplier'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
