/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, AlertCircle, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DocumentWithLines } from '../../../infrastructure/database/repositories/DocumentRepository';
import { SalesRepository } from '../../../infrastructure/database/repositories/SalesRepository';
import { SaleService, SalesReturnItemInput } from '../../../application/services/SaleService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface RecordSalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  invoice: DocumentWithLines | null;
  currencySymbol: string;
}

interface ReturnLineItemState {
  originalLineId: string;
  productId: string;
  description: string;
  soldQty: number;
  alreadyReturnedQty: number;
  maxReturnableQty: number;
  returnedQty: number;
  packageUnit: string;
  unitPriceScaled: bigint;
  itemCondition: 'resellable' | 'damaged';
  notes: string;
}

export function RecordSalesReturnModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  invoice,
  currencySymbol
}: RecordSalesReturnModalProps) {
  const [returnNumber, setReturnNumber] = useState(`SR-${Date.now().toString().slice(-6)}`);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [settlementType, setSettlementType] = useState<'cash_refund' | 'bank_refund' | 'receivable_credit'>('cash_refund');
  const [returnLines, setReturnLines] = useState<ReturnLineItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingLines, setIsLoadingLines] = useState(false);

  useEffect(() => {
    if (!invoice || !isOpen) return;

    setReturnNumber(`SR-${Date.now().toString().slice(-6)}`);
    setReason('');
    setErrorMsg(null);

    // If walk-in cash customer, default to cash refund
    if (!invoice.partyId) {
      setSettlementType('cash_refund');
    } else {
      setSettlementType('receivable_credit');
    }

    async function loadReturnableLimits() {
      if (!invoice) return;
      setIsLoadingLines(true);
      try {
        const conn = await SqliteConnectionPool.getInstance().getConnection();
        const salesRepo = new SalesRepository(conn);

        const items: ReturnLineItemState[] = [];
        for (const line of invoice.lines) {
          if (!line.productId) continue;
          const returned = await salesRepo.getReturnedQuantityForLine(line.id);
          const maxReturnable = Math.max(0, line.quantity - returned);

          items.push({
            originalLineId: line.id,
            productId: line.productId,
            description: line.description,
            soldQty: line.quantity,
            alreadyReturnedQty: returned,
            maxReturnableQty: maxReturnable,
            returnedQty: 0,
            packageUnit: line.packageUnit || 'pcs',
            unitPriceScaled: line.unitPriceScaled,
            itemCondition: 'resellable',
            notes: ''
          });
        }
        setReturnLines(items);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error calculating returnable line limits.');
      } finally {
        setIsLoadingLines(false);
      }
    }

    loadReturnableLimits();
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const formatScaled = (scaledVal?: bigint | number) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateReturnTotal = () => {
    let total = 0n;
    for (const l of returnLines) {
      if (l.returnedQty > 0) {
        total += BigInt(Math.round(l.returnedQty * Number(l.unitPriceScaled)));
      }
    }
    return total;
  };

  const handleQtyChange = (originalLineId: string, value: string) => {
    const qty = parseFloat(value) || 0;
    setReturnLines(prev =>
      prev.map(line => {
        if (line.originalLineId !== originalLineId) return line;
        const boundedQty = Math.min(line.maxReturnableQty, Math.max(0, qty));
        return { ...line, returnedQty: boundedQty };
      })
    );
  };

  const handleConditionChange = (originalLineId: string, condition: 'resellable' | 'damaged') => {
    setReturnLines(prev =>
      prev.map(line => {
        if (line.originalLineId !== originalLineId) return line;
        return { ...line, itemCondition: condition };
      })
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const validLines = returnLines.filter(l => l.returnedQty > 0);
    if (validLines.length === 0) {
      setErrorMsg('Please specify a return quantity greater than zero for at least one item.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please state a reason for this sales return.');
      return;
    }

    if (settlementType === 'receivable_credit' && !invoice.partyId) {
      setErrorMsg('Cannot issue receivable credit to anonymous walk-in customer. Choose cash or bank refund.');
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHapticFeedback();
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      const returnLinesInput: SalesReturnItemInput[] = validLines.map(l => ({
        originalLineId: l.originalLineId,
        productId: l.productId,
        description: l.description,
        returnedQuantity: l.returnedQty,
        packageUnit: l.packageUnit,
        itemCondition: l.itemCondition,
        notes: l.itemCondition === 'damaged' ? 'Damaged goods return' : undefined
      }));

      await SaleService.recordSalesReturn(conn, workspaceId, {
        originalDocumentId: invoice.id,
        returnNumber,
        returnDate,
        reason: reason.trim(),
        settlementType,
        lines: returnLinesInput
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record customer sales return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnTotalScaled = calculateReturnTotal();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <RotateCcw size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Record Customer Sales Return</h3>
                <p className="text-[11px] text-neutral-400">
                  Invoice {invoice.documentNumber} · {invoice.partyName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-none">
            {errorMsg && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Return Doc #
                </label>
                <input
                  type="text"
                  value={returnNumber}
                  onChange={e => setReturnNumber(e.target.value)}
                  className="w-full mt-1 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Return Date
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full mt-1 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            {/* Settlement Refund Method */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Refund / Settlement Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSettlementType('cash_refund')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    settlementType === 'cash_refund'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  Cash Refund
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementType('bank_refund')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    settlementType === 'bank_refund'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  Bank / Card Refund
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementType('receivable_credit')}
                  disabled={!invoice.partyId}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    settlementType === 'receivable_credit'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10 disabled:opacity-30'
                  }`}
                >
                  Credit Note (A/R)
                </button>
              </div>
            </div>

            {/* Return Reason */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Reason for Return
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Defective batch, customer changed mind, wrong item"
                className="w-full mt-1 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>

            {/* Line Items Selection Table */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                <span>Select Return Items & Condition</span>
                <span className="text-[10px] text-neutral-500">
                  {returnLines.filter(l => l.maxReturnableQty > 0).length} returnable items
                </span>
              </label>

              {isLoadingLines ? (
                <div className="p-4 text-center text-xs text-neutral-500">Checking returnable limits...</div>
              ) : returnLines.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">
                  No returnable products found for this invoice.
                </div>
              ) : (
                <div className="space-y-2">
                  {returnLines.map(line => {
                    const isExhausted = line.maxReturnableQty <= 0;
                    return (
                      <div
                        key={line.originalLineId}
                        className={`p-3 rounded-2xl border transition-all ${
                          line.returnedQty > 0
                            ? 'bg-neutral-950 border-amber-500/40 shadow-sm'
                            : 'bg-neutral-950/40 border-white/5 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-white">{line.description}</div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              Rate: {currencySymbol} {formatScaled(line.unitPriceScaled)} · Sold: {line.soldQty} ·
                              Already Returned: {line.alreadyReturnedQty} ·{' '}
                              <span className={isExhausted ? 'text-rose-400' : 'text-emerald-400'}>
                                Max: {line.maxReturnableQty} {line.packageUnit}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-white">
                              {currencySymbol} {formatScaled(BigInt(Math.round(line.returnedQty * Number(line.unitPriceScaled))))}
                            </span>
                          </div>
                        </div>

                        {!isExhausted && (
                          <div className="mt-3 pt-2 border-t border-white/5 grid grid-cols-2 gap-2 items-center">
                            {/* Return Quantity input */}
                            <div>
                              <label className="text-[10px] text-neutral-400">Return Qty ({line.packageUnit}):</label>
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={line.maxReturnableQty}
                                  step="any"
                                  value={line.returnedQty || ''}
                                  onChange={e => handleQtyChange(line.originalLineId, e.target.value)}
                                  placeholder="0"
                                  className="w-20 bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(line.originalLineId, String(line.maxReturnableQty))}
                                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-neutral-300 transition-colors cursor-pointer"
                                >
                                  All
                                </button>
                              </div>
                            </div>

                            {/* Item Condition Toggle */}
                            <div>
                              <label className="text-[10px] text-neutral-400">Inventory Condition:</label>
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleConditionChange(line.originalLineId, 'resellable')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    line.itemCondition === 'resellable'
                                      ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                                      : 'bg-white/5 text-neutral-500 border border-transparent'
                                  }`}
                                  title="Restores stock back to sellable inventory"
                                >
                                  Resellable (Stock +)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConditionChange(line.originalLineId, 'damaged')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    line.itemCondition === 'damaged'
                                      ? 'bg-rose-600/30 border border-rose-500/50 text-rose-300'
                                      : 'bg-white/5 text-neutral-500 border border-transparent'
                                  }`}
                                  title="Item is damaged and will NOT be added to sellable inventory"
                                >
                                  Damaged
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total Refund Banner */}
            <div className="p-3 bg-neutral-950 border border-white/10 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Total Refund / Credit:</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {currencySymbol} {formatScaled(returnTotalScaled)}
              </span>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || returnTotalScaled <= 0n}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-600/20"
              >
                {isSubmitting ? (
                  <>Processing Return...</>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    Post Sales Return
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
