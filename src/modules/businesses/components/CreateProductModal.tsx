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
              <span className="text-[10px] font-mono tracking-widest text-purple-400 font-bold uppercase">
                {workspaceName} · Product Catalog
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                <Package size={18} className="text-purple-400" />
                Add New Retail / Mart Product
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
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
              <label className="text-xs font-mono text-neutral-400">
                Product Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Basmati Rice 5kg, Fresh Milk 1L, Coca Cola 330ml"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm font-semibold bg-neutral-900 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                style={{ borderColor: theme.border }}
              />
            </div>

            {/* SKU and Barcode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">SKU (Unique code)</label>
                <input
                  type="text"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  placeholder="e.g. RICE-BAS-5K"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono bg-neutral-900 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Primary Barcode</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="e.g. 8901234567890"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono bg-neutral-900 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>
            </div>

            {/* Category and Brand */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Grocery, Dairy, Beverage"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs bg-neutral-900 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Nestle, Unilever, Local"
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs bg-neutral-900 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>
            </div>

            {/* 2. Unit of Measure */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-neutral-400">Canonical Stock Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value as ProductUnit)}
                className="w-full px-4 py-2.5 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                style={{ borderColor: theme.border }}
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
                <label className="text-xs font-mono text-neutral-400">Cost Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Sale Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Tax Rate (%)</label>
                <input
                  type="number"
                  step="any"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
              </div>
            </div>

            {/* 4. Stock & Threshold */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Opening Stock Qty</label>
                <input
                  type="number"
                  step="any"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
                <span className="text-[9px] text-neutral-500 font-mono">
                  Recorded in stock movements ledger
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-neutral-400">Reorder Threshold</label>
                <input
                  type="number"
                  step="any"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  placeholder="5"
                  className="w-full px-4 py-2 rounded-2xl border text-xs font-mono bg-neutral-900 text-white focus:outline-none focus:border-purple-500"
                  style={{ borderColor: theme.border }}
                />
                <span className="text-[9px] text-neutral-500 font-mono">
                  Low stock alert badge
                </span>
              </div>
            </div>

            {/* 5. Unit Conversion Option (e.g. 1 carton = 24 pcs) */}
            <div className="p-3 rounded-2xl bg-white/5 border flex flex-col gap-2.5" style={{ borderColor: theme.border }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers size={14} className="text-purple-400" /> Multi-Pack / Bulk Unit Conversion
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddConversion(!showAddConversion)}
                  className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                >
                  {showAddConversion ? 'Remove' : '+ Add Pack Conversion'}
                </button>
              </div>

              {showAddConversion && (
                <div className="space-y-2 pt-1 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-0.5 block">Pack Unit Name</label>
                      <input
                        type="text"
                        placeholder="e.g. carton, box, pack"
                        value={conversionUnitName}
                        onChange={e => setConversionUnitName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-0.5 block">Contains ({unit})</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 24"
                        value={conversionFactor}
                        onChange={e => setConversionFactor(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-0.5 block">Pack Barcode (Optional)</label>
                      <input
                        type="text"
                        placeholder="Carton barcode"
                        value={conversionBarcode}
                        onChange={e => setConversionBarcode(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-0.5 block">Pack Sale Price (Optional)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 2400"
                        value={conversionPrice}
                        onChange={e => setConversionPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Batch & Serial tracking toggles */}
            <div className="flex gap-4 text-xs font-mono text-neutral-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBatchTracking}
                  onChange={e => setHasBatchTracking(e.target.checked)}
                  className="rounded text-purple-500 bg-neutral-900"
                />
                <span>Batch & Expiry Tracking</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSerialTracking}
                  onChange={e => setHasSerialTracking(e.target.checked)}
                  className="rounded text-purple-500 bg-neutral-900"
                />
                <span>Serial Number Tracking</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: theme.border }}>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-purple-500 text-white hover:bg-purple-400 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer"
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
