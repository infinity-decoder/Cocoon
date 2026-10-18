/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sliders, AlertTriangle, CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useWorkspace } from '../../../app/WorkspaceContext';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { InventoryService } from '../../../application/services/InventoryService';
import { ProductRepository, StockLocationRecord } from '../../../infrastructure/database/repositories/ProductRepository';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProductId?: string;
  theme: AppTheme;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  preselectedProductId,
  theme
}: StockAdjustmentModalProps) {
  const { currentWorkspace, products, refreshBusinessData } = useWorkspace();
  const [productId, setProductId] = useState<string>(preselectedProductId || products[0]?.id || '');
  const [operationType, setOperationType] = useState<'adjustment' | 'damaged' | 'received'>('adjustment');
  const [adjustmentMode, setAdjustmentMode] = useState<'count' | 'delta'>('count');
  const [newCount, setNewCount] = useState<string>('');
  const [deltaQty, setDeltaQty] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [locations, setLocations] = useState<StockLocationRecord[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find(p => p.id === productId);

  useEffect(() => {
    if (preselectedProductId) {
      setProductId(preselectedProductId);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [preselectedProductId, products]);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const conn = await databaseService.getInitializedConnection();
        const repo = new ProductRepository(conn);
        const locs = await repo.getLocations(currentWorkspace.id);
        setLocations(locs);
        const def = locs.find(l => l.isDefault) || locs[0];
        if (def) setSelectedLocationId(def.id);
      } catch (e) {
        // ignore
      }
    };
    if (isOpen) {
      loadLocations();
    }
  }, [isOpen, currentWorkspace.id]);

  if (!isOpen) return null;

  const currentStock = selectedProduct ? selectedProduct.currentStockQuantity : 0;
  let calculatedDelta = 0;

  if (operationType === 'adjustment') {
    if (adjustmentMode === 'count') {
      const parsedCount = Number(newCount);
      calculatedDelta = !isNaN(parsedCount) ? parsedCount - currentStock : 0;
    } else {
      calculatedDelta = Number(deltaQty) || 0;
    }
  } else if (operationType === 'damaged') {
    const qty = Math.abs(Number(deltaQty) || 0);
    calculatedDelta = -qty;
  } else if (operationType === 'received') {
    const qty = Math.abs(Number(deltaQty) || 0);
    calculatedDelta = qty;
  }

  const resultingStock = currentStock + calculatedDelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }
    if (calculatedDelta === 0) {
      setError('Adjustment quantity cannot result in zero change.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this inventory adjustment.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const conn = await databaseService.getInitializedConnection();
      let sourceType: any = 'stock_adjustment';
      if (operationType === 'damaged') sourceType = 'damaged_wasted';
      if (operationType === 'received') sourceType = 'goods_received';

      const unitCostScaled = unitCost ? BigInt(Math.round(Number(unitCost) * 10000)) : undefined;

      await InventoryService.recordStockMovement(conn, currentWorkspace.id, {
        productId: selectedProduct.id,
        sourceType,
        quantity: calculatedDelta,
        packageUnit: selectedProduct.unit,
        locationId: selectedLocationId || undefined,
        unitCostScaled,
        reason: reason.trim(),
        effectiveDate: new Date().toISOString().slice(0, 10),
        createdBy: 'local_user'
      });

      triggerHapticFeedback();
      await refreshBusinessData();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record adjustment.');
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

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden z-10"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div
            className="p-5 border-b flex justify-between items-center"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Sliders size={20} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-white">Stock Count & Adjustment</h2>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {currentWorkspace.name} · Physical count, damage or goods receipt
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

          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product Picker */}
            <div>
              <label className="text-xs font-mono text-neutral-400 mb-1.5 block">Select Product</label>
              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white cursor-pointer"
                style={{ borderColor: theme.border }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Stock: {p.currentStockQuantity} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Operation Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOperationType('adjustment')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  operationType === 'adjustment'
                    ? 'bg-amber-500 text-neutral-950 border-amber-500 shadow-md'
                    : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                Stock Audit Count
              </button>
              <button
                type="button"
                onClick={() => setOperationType('damaged')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  operationType === 'damaged'
                    ? 'bg-red-500 text-white border-red-500 shadow-md'
                    : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                Damaged / Spoilage
              </button>
              <button
                type="button"
                onClick={() => setOperationType('received')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  operationType === 'received'
                    ? 'bg-emerald-500 text-neutral-950 border-emerald-500 shadow-md'
                    : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                Quick Restock
              </button>
            </div>

            {/* Location */}
            {locations.length > 1 && (
              <div>
                <label className="text-xs font-mono text-neutral-400 mb-1.5 block">Location</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                  style={{ borderColor: theme.border }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity Input based on Operation Type */}
            {operationType === 'adjustment' ? (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode('count')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                      adjustmentMode === 'count' ? 'bg-white/15 text-white' : 'text-neutral-500'
                    }`}
                  >
                    Enter Physical Count
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode('delta')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                      adjustmentMode === 'delta' ? 'bg-white/15 text-white' : 'text-neutral-500'
                    }`}
                  >
                    Enter Quantity Delta (+ / -)
                  </button>
                </div>

                {adjustmentMode === 'count' ? (
                  <div>
                    <label className="text-xs font-mono text-neutral-400 mb-1 block">
                      Physical Counted Quantity ({selectedProduct?.unit || 'pcs'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Counted (Current is ${currentStock})`}
                      value={newCount}
                      onChange={e => setNewCount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono bg-neutral-900 text-white"
                      style={{ borderColor: theme.border }}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-mono text-neutral-400 mb-1 block">
                      Quantity Delta (+ for found, - for missing)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. +5 or -2"
                      value={deltaQty}
                      onChange={e => setDeltaQty(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono bg-neutral-900 text-white"
                      style={{ borderColor: theme.border }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs font-mono text-neutral-400 mb-1 block">
                  {operationType === 'damaged' ? 'Wasted / Damaged Quantity' : 'Restock Quantity'}{' '}
                  ({selectedProduct?.unit || 'pcs'})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5"
                  value={deltaQty}
                  onChange={e => setDeltaQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono bg-neutral-900 text-white"
                  style={{ borderColor: theme.border }}
                />
              </div>
            )}

            {/* Unit cost if quick restock */}
            {operationType === 'received' && (
              <div>
                <label className="text-xs font-mono text-neutral-400 mb-1 block">
                  Purchase Unit Cost (PKR, optional override)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder={`Default is ${Number(selectedProduct?.costPriceScaled ?? 0n) / 10000}`}
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                  style={{ borderColor: theme.border }}
                />
              </div>
            )}

            {/* Impact Calculation Preview */}
            <div className="p-3.5 rounded-xl bg-white/5 border flex justify-between items-center" style={{ borderColor: theme.border }}>
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400 font-mono">Stock Change Preview</span>
                <span className="text-xs font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>{currentStock} {selectedProduct?.unit}</span>
                  <ArrowRight size={12} className="text-neutral-500" />
                  <span className={calculatedDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                    {resultingStock} {selectedProduct?.unit}
                  </span>
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] text-neutral-400 font-mono">Quantity Delta</span>
                <span className={`text-xs font-mono font-bold ${calculatedDelta > 0 ? 'text-emerald-400' : calculatedDelta < 0 ? 'text-amber-400' : 'text-neutral-500'}`}>
                  {calculatedDelta > 0 ? `+${calculatedDelta}` : calculatedDelta} {selectedProduct?.unit}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-mono text-neutral-400 mb-1 block">
                Reason / Note <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  operationType === 'damaged'
                    ? 'e.g. Expired bottles, broken carton in transit'
                    : operationType === 'received'
                    ? 'e.g. Supplementary stock purchase from distributor'
                    : 'e.g. Monthly physical inventory audit count difference'
                }
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-neutral-900 text-white"
                style={{ borderColor: theme.border }}
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || calculatedDelta === 0}
                className="w-full py-3 rounded-xl font-bold text-xs bg-amber-500 text-neutral-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? 'Recording Adjustment...' : 'Post Inventory Adjustment'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
