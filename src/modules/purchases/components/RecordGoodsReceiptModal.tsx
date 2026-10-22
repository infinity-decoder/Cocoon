/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PurchaseOrderWithLines } from '../../../infrastructure/database/repositories/PurchaseRepository';
import { PurchaseService } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface RecordGoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  order: PurchaseOrderWithLines | null;
}

interface ReceiptLineInput {
  poLineId: string;
  productId: string;
  description: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  receivedQty: number;
  shortQty: number;
  damagedQty: number;
  packageUnit: string;
  unitCostScaled: bigint;
  batchNumber: string;
  expiryDate: string;
  serialNumber: string;
}

export function RecordGoodsReceiptModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  order
}: RecordGoodsReceiptModalProps) {
  const [receiptNumber, setReceiptNumber] = useState(`GRN-${Date.now().toString().slice(-6)}`);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [receiptLines, setReceiptLines] = useState<ReceiptLineInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setReceiptNumber(`GRN-${Date.now().toString().slice(-6)}`);
      setReceiptLines(
        order.lines.map(l => {
          const remaining = Math.max(0, l.orderedQuantity - l.receivedQuantity);
          return {
            poLineId: l.id,
            productId: l.productId || '',
            description: l.description,
            orderedQty: l.orderedQuantity,
            previouslyReceivedQty: l.receivedQuantity,
            receivedQty: remaining,
            shortQty: 0,
            damagedQty: 0,
            packageUnit: l.packageUnit,
            unitCostScaled: l.unitCostScaled,
            batchNumber: '',
            expiryDate: '',
            serialNumber: ''
          };
        })
      );
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validLines = receiptLines.filter(l => l.receivedQty > 0 && l.productId);
    if (validLines.length === 0) {
      setErrorMsg('Please specify received quantities greater than zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      await PurchaseService.recordGoodsReceipt(conn, workspaceId, {
        receiptNumber,
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        receiptDate,
        notes: notes.trim() || undefined,
        lines: validLines.map(l => ({
          purchaseOrderLineId: l.poLineId,
          productId: l.productId,
          description: l.description,
          receivedQuantity: l.receivedQty,
          shortQuantity: l.shortQty,
          damagedQuantity: l.damagedQty,
          packageUnit: l.packageUnit,
          unitCostScaled: l.unitCostScaled,
          batchNumber: l.batchNumber.trim() || undefined,
          expiryDate: l.expiryDate.trim() || undefined,
          serialNumber: l.serialNumber.trim() || undefined
        }))
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record goods receipt.');
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
          className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-5 my-8 text-white flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Truck size={18} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white">Receive Goods (GRN)</h2>
                <span className="text-[11px] text-neutral-400">
                  Receiving against PO #{order.orderNumber} ({order.supplierName})
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
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">GRN / Receipt #</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={e => setReceiptNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Receipt Date</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            {/* Line items with received, short, damaged inputs */}
            <div className="border border-white/10 rounded-xl p-3 bg-neutral-950/40 flex flex-col gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Order Delivery Verification
              </span>

              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                {receiptLines.map((l, index) => (
                  <div
                    key={l.poLineId}
                    className="p-3 bg-neutral-900 border border-white/5 rounded-xl flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{l.description}</span>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        Ordered: {l.orderedQty} {l.packageUnit} (Prev Received: {l.previouslyReceivedQty})
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-emerald-400 block mb-0.5">Received Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={l.receivedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, receivedQty: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800 border border-emerald-500/30 rounded-lg px-2 py-1 text-xs text-white font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-amber-400 block mb-0.5">Shortage Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={l.shortQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, shortQty: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800 border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-rose-400 block mb-0.5">Damaged Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={l.damagedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, damagedQty: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800 border border-rose-500/30 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                      <div>
                        <input
                          type="text"
                          placeholder="Batch #"
                          value={l.batchNumber}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, batchNumber: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          placeholder="Expiry"
                          value={l.expiryDate}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, expiryDate: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Serial #"
                          value={l.serialNumber}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiptLines(prev =>
                              prev.map((item, i) => (i === index ? { ...item, serialNumber: val } : item))
                            );
                          }}
                          className="w-full bg-neutral-800/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Receipt Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Inspected by warehouse staff, delivery truck condition..."
                rows={2}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Recording Receipt...' : 'Confirm Stock Receipt'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
