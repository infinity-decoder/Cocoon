/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, CheckCircle2, AlertTriangle, Layers, Tag, Barcode, Plus, Trash2 } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { ProductUnit } from '../../../domain/inventory/InventoryItem';

interface CreateProductModalProps {
  isOpen: boolean;
  workspaceName: string;
  currencySymbol: string;
  initialBarcode?: string;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    sku?: string;
    barcode?: string;
    unit: ProductUnit;
    costPriceScaled: bigint;
    salePriceScaled: bigint;
    wholesalePriceScaled?: bigint;
    initialStockQuantity?: number;
    minStockAlert?: number;
    description?: string;
    category?: string;
    brand?: string;
    taxRatePercent?: number;
    reorderThreshold?: number;
    hasBatchTracking?: boolean;
    hasSerialTracking?: boolean;
    unitConversions?: Array<{
      unitName: string;
      conversionFactor: number;
      salePriceScaled?: bigint;
      barcode?: string;
    }>;
  }) => Promise<void>;
  theme: AppTheme;
}

export function CreateProductModal({
  isOpen,
  workspaceName,
  currencySymbol,
  initialBarcode,
  onClose,
  onSubmit,
  theme
}: CreateProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState(initialBarcode || '');
  const [unit, setUnit] = useState<ProductUnit>('pcs');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [hasBatchTracking, setHasBatchTracking] = useState(false);
  const [hasSerialTracking, setHasSerialTracking] = useState(false);

  // Additional packaging unit conversion (e.g. 1 carton = 24 pcs)
  const [showAddConversion, setShowAddConversion] = useState(false);
  const [conversionUnitName, setConversionUnitName] = useState('carton');
  const [conversionFactor, setConversionFactor] = useState('24');
  const [conversionBarcode, setConversionBarcode] = useState('');
  const [conversionPrice, setConversionPrice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBarcode) {
      setBarcode(initialBarcode);
    }
  }, [initialBarcode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const costScaled = costPrice ? BigInt(Math.round(Number(costPrice) * 10000)) : 0n;
      const saleScaled = salePrice ? BigInt(Math.round(Number(salePrice) * 10000)) : 0n;
      const wholesaleScaled = wholesalePrice ? BigInt(Math.round(Number(wholesalePrice) * 10000)) : undefined;

      const unitConversions = [];
      if (showAddConversion && conversionUnitName.trim() && Number(conversionFactor) > 0) {
        unitConversions.push({
          unitName: conversionUnitName.trim().toLowerCase(),
          conversionFactor: Number(conversionFactor),
          salePriceScaled: conversionPrice ? BigInt(Math.round(Number(conversionPrice) * 10000)) : undefined,
          barcode: conversionBarcode.trim() || undefined
        });
      }

      await onSubmit({
        name: name.trim(),
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        unit,
        costPriceScaled: costScaled,
        salePriceScaled: saleScaled,
        wholesalePriceScaled: wholesaleScaled,
        initialStockQuantity: Number(stock) || 0,
        minStockAlert: Number(minStock) || 5,
        reorderThreshold: Number(minStock) || 5,
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        taxRatePercent: Number(taxRate) || 0,
        hasBatchTracking,
        hasSerialTracking,
        unitConversions
      });

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 250 }}
          className="relative w-full max-w-lg max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: theme.primary }}>
                {workspaceName} · Product Catalog
              </span>
              <h2 className="text-base font-bold flex items-center gap-2 mt-0.5" style={{ color: theme.textPrimary }}>
                <Package size={18} style={{ color: theme.primary }} />
                Add New Retail / Mart Product
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: theme.textMuted, backgroundColor: theme.surfaceMuted }}
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-1 pb-4">
            {/* 1. Basic Product Identity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>
                Product Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Basmati Rice 5kg, Fresh Milk 1L, Coca Cola 330ml"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none"
                style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
              />
            </div>

            {/* SKU and Barcode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>SKU (Unique code)</label>
                <input
                  type="text"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  placeholder="e.g. RICE-BAS-5K"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Primary Barcode</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="e.g. 8901234567890"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Category and Brand */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Grocery, Dairy, Beverage"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Nestle, Unilever, Local"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* 2. Unit of Measure */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Canonical Stock Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value as ProductUnit)}
                className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono focus:outline-none cursor-pointer"
                style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
              >
                <option value="pcs">Pieces (pcs) - Unit / Item</option>
                <option value="pack">Pack (pack)</option>
                <option value="carton">Carton (carton)</option>
                <option value="box">Box (box)</option>
                <option value="kg">Kilogram (kg) - Measured by weight</option>
                <option value="g">Gram (g) - Metric weight</option>
                <option value="ltr">Litre (ltr) - Measured by volume</option>
                <option value="ml">Millilitre (ml) - Metric volume</option>
                <option value="meter">Meter (m) - Length / fabric</option>
                <option value="dozen">Dozen (12 pcs)</option>
              </select>
            </div>

            {/* 3. Pricing & Tax */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Cost Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Sale Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Tax Rate (%)</label>
                <input
                  type="number"
                  step="any"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* 4. Stock & Threshold */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Opening Stock Qty</label>
                <input
                  type="number"
                  step="any"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
                <span className="text-[9px] font-mono" style={{ color: theme.textMuted }}>
                  Recorded in stock movements ledger
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono" style={{ color: theme.textSecondary }}>Reorder Threshold</label>
                <input
                  type="number"
                  step="any"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  placeholder="5"
                  className="w-full px-4 py-2 rounded-2xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                />
                <span className="text-[9px] font-mono" style={{ color: theme.textMuted }}>
                  Low stock alert badge
                </span>
              </div>
            </div>

            {/* 5. Unit Conversion Option (e.g. 1 carton = 24 pcs) */}
            <div className="p-3 rounded-2xl border flex flex-col gap-2.5" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textPrimary }}>
                  <Layers size={14} style={{ color: theme.primary }} /> Multi-Pack / Bulk Unit Conversion
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddConversion(!showAddConversion)}
                  className="text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  style={{ color: theme.primary }}
                >
                  {showAddConversion ? 'Remove' : '+ Add Pack Conversion'}
                </button>
              </div>

              {showAddConversion && (
                <div className="space-y-2 pt-1 border-t" style={{ borderColor: theme.borderSubtle }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono mb-0.5 block" style={{ color: theme.textSecondary }}>Pack Unit Name</label>
                      <input
                        type="text"
                        placeholder="e.g. carton, box, pack"
                        value={conversionUnitName}
                        onChange={e => setConversionUnitName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono mb-0.5 block" style={{ color: theme.textSecondary }}>Contains ({unit})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 24"
                        value={conversionFactor}
                        onChange={e => setConversionFactor(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono mb-0.5 block" style={{ color: theme.textSecondary }}>Pack Barcode (Optional)</label>
                      <input
                        type="text"
                        placeholder="Carton barcode"
                        value={conversionBarcode}
                        onChange={e => setConversionBarcode(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono mb-0.5 block" style={{ color: theme.textSecondary }}>Pack Sale Price (Optional)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 2400"
                        value={conversionPrice}
                        onChange={e => setConversionPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Batch & Serial tracking toggles */}
            <div className="flex gap-4 text-xs font-mono pt-1" style={{ color: theme.textSecondary }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBatchTracking}
                  onChange={e => setHasBatchTracking(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: theme.primary }}
                />
                <span>Batch & Expiry Tracking</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSerialTracking}
                  onChange={e => setHasSerialTracking(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: theme.primary }}
                />
                <span>Serial Number Tracking</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: theme.borderSubtle }}>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
                style={{ color: theme.textSecondary }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl text-xs font-bold text-white disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg cursor-pointer"
                style={{ backgroundColor: theme.primary }}
              >
                <CheckCircle2 size={16} />
                {isSubmitting ? 'Saving...' : 'Create Product'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
