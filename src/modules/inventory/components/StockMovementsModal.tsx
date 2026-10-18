/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  History,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Package,
  Layers,
  ArrowRightLeft,
  Calendar,
  Tag
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useWorkspace } from '../../../app/WorkspaceContext';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { ProductRepository, StockMovementRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { InventoryService } from '../../../application/services/InventoryService';

interface StockMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  theme: AppTheme;
}

export function StockMovementsModal({
  isOpen,
  onClose,
  productId,
  theme
}: StockMovementsModalProps) {
  const { currentWorkspace, products, refreshBusinessData } = useWorkspace();
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(productId || 'all');
  const [isLoading, setIsLoading] = useState(false);
  const [reversalLoadingId, setReversalLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reversalReasonPrompt, setReversalReasonPrompt] = useState<string | null>(null);
  const [targetMovementToReverse, setTargetMovementToReverse] = useState<StockMovementRecord | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const loadMovements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const conn = await databaseService.getInitializedConnection();
      const repo = new ProductRepository(conn);
      if (selectedProductId && selectedProductId !== 'all') {
        const rows = await repo.findMovementsByProductId(selectedProductId);
        setMovements(rows);
      } else {
        const rows = await repo.findMovementsByWorkspace(currentWorkspace.id, 100);
        setMovements(rows);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load stock movements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(productId || 'all');
    }
  }, [isOpen, productId]);

  useEffect(() => {
    if (isOpen) {
      loadMovements();
    }
  }, [isOpen, selectedProductId]);

  if (!isOpen) return null;

  const handleInitiateReversal = (m: StockMovementRecord) => {
    triggerHapticFeedback();
    setTargetMovementToReverse(m);
    setReversalReasonPrompt('');
  };

  const handleConfirmReversal = async () => {
    if (!targetMovementToReverse) return;
    const reason = reversalReasonPrompt?.trim() || 'Audited reversal by user';

    setReversalLoadingId(targetMovementToReverse.id);
    try {
      const conn = await databaseService.getInitializedConnection();
      await InventoryService.reverseStockMovement(conn, currentWorkspace.id, targetMovementToReverse.id, reason);
      triggerHapticFeedback();
      setTargetMovementToReverse(null);
      setReversalReasonPrompt(null);
      await loadMovements();
      await refreshBusinessData();
    } catch (err: any) {
      setError(err?.message || 'Failed to reverse movement.');
    } finally {
      setReversalLoadingId(null);
    }
  };

  const formatSourceType = (type: string) => {
    switch (type) {
      case 'opening_stock': return 'Opening Stock';
      case 'goods_received': return 'Goods Received (PO)';
      case 'sale_issue': return 'Sales Issue';
      case 'sales_return': return 'Customer Return';
      case 'purchase_return': return 'Supplier Return';
      case 'damaged_wasted': return 'Damage / Waste';
      case 'stock_adjustment': return 'Stock Adjustment';
      case 'stock_transfer': return 'Stock Transfer';
      case 'reversal': return 'Reversal';
      default: return type;
    }
  };

  const getSourceTypeBadge = (type: string, delta: number) => {
    if (delta > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
          <ArrowDownLeft size={10} /> {formatSourceType(type)}
        </span>
      );
    }
    if (type === 'damaged_wasted') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
          <AlertTriangle size={10} /> {formatSourceType(type)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
        <ArrowUpRight size={10} /> {formatSourceType(type)}
      </span>
    );
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

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden z-10"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div
            className="p-5 border-b flex justify-between items-center shrink-0"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <History size={20} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Stock Movements Ledger
                  {selectedProduct && (
                    <span className="text-xs font-normal text-purple-400">
                      ({selectedProduct.name})
                    </span>
                  )}
                </h2>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {currentWorkspace.name} · Complete audit trail & valuation
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Product Filter Selector */}
          <div className="p-3 border-b flex items-center justify-between gap-3 bg-black/20" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Package size={14} /> Filter Product:
            </div>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white cursor-pointer"
              style={{ borderColor: theme.border }}
            >
              <option value="all">All Products (Latest 100 Movements)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.currentStockQuantity} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Reversal Confirmation Dialog */}
          {targetMovementToReverse && (
            <div className="m-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <RotateCcw size={16} /> Confirm Audited Movement Reversal
              </div>
              <p className="text-xs text-neutral-300">
                You are about to reverse movement <span className="font-mono font-bold text-white">{targetMovementToReverse.id}</span> ({formatSourceType(targetMovementToReverse.sourceType)}, delta: {targetMovementToReverse.quantityDelta} {targetMovementToReverse.canonicalUnit}). This will flip stock quantity and valuation history.
              </p>
              <input
                type="text"
                placeholder="Reason for reversal (e.g., entered by mistake, wrong count)..."
                value={reversalReasonPrompt || ''}
                onChange={e => setReversalReasonPrompt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs bg-neutral-900 text-white"
                style={{ borderColor: theme.border }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setTargetMovementToReverse(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReversal}
                  disabled={reversalLoadingId !== null}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400"
                >
                  {reversalLoadingId ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </div>
          )}

          {/* Movements List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-neutral-500 font-mono">
                Loading stock movements...
              </div>
            ) : movements.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 flex flex-col items-center gap-2">
                <History size={32} className="opacity-40" />
                <span className="text-xs">No stock movements recorded yet.</span>
              </div>
            ) : (
              movements.map(m => {
                const prod = products.find(p => p.id === m.productId);
                const isIncoming = m.quantityDelta > 0;
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      m.isReversed ? 'opacity-60 bg-white/2 border-dashed' : 'hover:border-purple-500/30'
                    }`}
                    style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getSourceTypeBadge(m.sourceType, m.quantityDelta)}
                          <span className="text-xs font-bold text-white">
                            {prod?.name || m.productId}
                          </span>
                          {m.isReversed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono uppercase font-bold">
                              Reversed
                            </span>
                          )}
                          {m.reversalOfMovementId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                              Reversal of {m.reversalOfMovementId.slice(-8)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} /> {m.effectiveDate}
                          </span>
                          {m.batchNumber && (
                            <span className="flex items-center gap-1 text-purple-300">
                              <Tag size={10} /> Batch: {m.batchNumber}
                            </span>
                          )}
                          {m.expiryDate && (
                            <span className="text-amber-400">Exp: {m.expiryDate}</span>
                          )}
                          {m.serialNumber && (
                            <span className="text-blue-300">S/N: {m.serialNumber}</span>
                          )}
                          {m.sourceId && (
                            <span>Ref: {m.sourceId}</span>
                          )}
                        </div>

                        {m.reason && (
                          <div className="text-[10px] text-neutral-400 italic">
                            Reason: "{m.reason}"
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span
                          className={`text-sm font-mono font-bold ${
                            isIncoming ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isIncoming ? '+' : ''}{m.quantityDelta} {m.canonicalUnit}
                        </span>

                        <span className="text-[10px] font-mono text-neutral-500">
                          Unit Cost: {Number(m.unitCostScaled) / 10000} PKR
                        </span>

                        {!m.isReversed && m.sourceType !== 'reversal' && (
                          <button
                            onClick={() => handleInitiateReversal(m)}
                            className="mt-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Reverse this movement with audit trail"
                          >
                            <RotateCcw size={10} /> Reverse
                          </button>
                        )}
                      </div>
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
