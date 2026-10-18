/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Barcode,
  Search,
  CheckCircle2,
  Plus,
  Link,
  Package,
  Layers,
  Sliders,
  History,
  AlertCircle
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useWorkspace } from '../../../app/WorkspaceContext';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { InventoryService, BarcodeLookupResult } from '../../../application/services/InventoryService';
import { HardwareBarcodeScannerService } from '../../../infrastructure/barcode/HardwareBarcodeScannerService';
import { ProductRepository } from '../../../infrastructure/database/repositories/ProductRepository';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateWithBarcode?: (barcode: string) => void;
  onOpenStockMovement?: (productId: string) => void;
  onOpenStockAdjustment?: (productId: string) => void;
  theme: AppTheme;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onOpenCreateWithBarcode,
  onOpenStockMovement,
  onOpenStockAdjustment,
  theme
}: BarcodeScannerModalProps) {
  const { currentWorkspace, products, refreshBusinessData } = useWorkspace();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedResult, setScannedResult] = useState<BarcodeLookupResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [linkProductId, setLinkProductId] = useState<string>('');
  const [linkPackagingUnit, setLinkPackagingUnit] = useState<string>('pcs');
  const [linkConversionFactor, setLinkConversionFactor] = useState<string>('1');
  const [isLinking, setIsLinking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Subscribe to hardware barcode wedge scanner
  useEffect(() => {
    if (!isOpen) return;

    const wedgeService = HardwareBarcodeScannerService.getInstance();
    const unsubscribe = wedgeService.subscribe((scan) => {
      triggerHapticFeedback();
      setBarcodeInput(scan.code);
      handlePerformLookup(scan.code);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, currentWorkspace.id]);

  if (!isOpen) return null;

  const handlePerformLookup = async (codeToSearch?: string) => {
    const code = (codeToSearch || barcodeInput).trim();
    if (!code) return;

    setIsSearching(true);
    setMessage(null);
    setScannedResult(null);
    setUnknownBarcode(null);

    try {
      const conn = await databaseService.getInitializedConnection();
      const res = await InventoryService.lookupBarcode(conn, currentWorkspace.id, code);

      if (res) {
        setScannedResult(res);
        setUnknownBarcode(null);
        triggerHapticFeedback();
      } else {
        setScannedResult(null);
        setUnknownBarcode(code);
        if (products.length > 0 && !linkProductId) {
          setLinkProductId(products[0].id);
        }
      }
    } catch (err: any) {
      setMessage({ text: err?.message || 'Lookup failed.', type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkBarcodeToProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unknownBarcode || !linkProductId) return;

    setIsLinking(true);
    setMessage(null);

    try {
      const conn = await databaseService.getInitializedConnection();
      const repo = new ProductRepository(conn);
      const factor = Number(linkConversionFactor) || 1.0;

      await repo.addBarcode({
        workspaceId: currentWorkspace.id,
        productId: linkProductId,
        barcode: unknownBarcode,
        normalizedBarcode: unknownBarcode.trim().toUpperCase(),
        packagingUnit: linkPackagingUnit.trim().toLowerCase(),
        conversionFactor: factor,
        isPrimary: false,
        notes: `Linked packaging unit: 1 ${linkPackagingUnit} = ${factor} units`
      });

      triggerHapticFeedback();
      setMessage({ text: `Barcode "${unknownBarcode}" linked successfully!`, type: 'success' });
      await refreshBusinessData();

      // Refresh lookup
      await handlePerformLookup(unknownBarcode);
    } catch (err: any) {
      setMessage({ text: err?.message || 'Failed to link barcode.', type: 'error' });
    } finally {
      setIsLinking(false);
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
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Barcode size={20} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-white">Barcode Scanner & Fast Lookup</h2>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Hardware USB/Bluetooth Wedge & Manual Search
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

          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Input Barcode Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handlePerformLookup();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Barcode size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  autoFocus
                  data-barcode-receiver="true"
                  placeholder="Scan barcode or type code..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-mono bg-neutral-900 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500"
                  style={{ borderColor: theme.border }}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !barcodeInput.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-teal-500 text-neutral-950 hover:bg-teal-400 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Search size={14} />
                {isSearching ? 'Looking up...' : 'Lookup'}
              </button>
            </form>

            {/* Hardware Scanner Indicator */}
            <div className="px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Laser / Optical scanner active: Aim & press trigger anytime.</span>
            </div>

            {/* Notification message */}
            {message && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Product Found Card */}
            {scannedResult && (
              <div
                className="p-4 rounded-2xl border flex flex-col gap-3 bg-white/5"
                style={{ borderColor: theme.border }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                      <Package size={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{scannedResult.product.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono mt-0.5">
                        {scannedResult.product.sku && <span>SKU: {scannedResult.product.sku}</span>}
                        {scannedResult.product.category && <span>· {scannedResult.product.category}</span>}
                        {scannedResult.product.brand && <span>· {scannedResult.product.brand}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      PKR {Number(scannedResult.unitPriceScaled) / 10000}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      Pack: {scannedResult.packagingUnit} (x{scannedResult.conversionFactor})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border flex justify-between items-center text-xs font-mono" style={{ borderColor: theme.border }}>
                  <span className="text-neutral-400">Stock on Hand:</span>
                  <span className={`font-bold ${scannedResult.product.currentStockQuantity <= scannedResult.product.minStockAlert ? 'text-amber-400' : 'text-white'}`}>
                    {scannedResult.product.currentStockQuantity} {scannedResult.product.unit}
                    {scannedResult.product.currentStockQuantity <= scannedResult.product.minStockAlert && (
                      <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase">
                        Low Stock
                      </span>
                    )}
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenStockAdjustment) onOpenStockAdjustment(scannedResult.product.id);
                    }}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sliders size={14} /> Adjust Stock
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenStockMovement) onOpenStockMovement(scannedResult.product.id);
                    }}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <History size={14} /> View Ledger
                  </button>
                </div>
              </div>
            )}

            {/* Unknown Barcode Safe Add/Link Flow */}
            {unknownBarcode && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <AlertCircle size={16} /> Barcode "{unknownBarcode}" Not Found
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  This code is not currently linked to any product in {currentWorkspace.name}. Would you like to create a new product or link this barcode to an existing item?
                </p>

                {/* Action Choice 1: Create New Product */}
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenCreateWithBarcode) onOpenCreateWithBarcode(unknownBarcode);
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-purple-500 text-white hover:bg-purple-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Plus size={14} /> Create New Product with this Barcode
                </button>

                <div className="text-center text-[10px] text-neutral-400 font-mono">
                  — OR LINK TO EXISTING PRODUCT —
                </div>

                {/* Action Choice 2: Link to Existing Product */}
                <form onSubmit={handleLinkBarcodeToProduct} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-mono text-neutral-400 mb-1 block">Choose Product</label>
                    <select
                      value={linkProductId}
                      onChange={e => setLinkProductId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                      style={{ borderColor: theme.border }}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-1 block">Packaging Unit</label>
                      <input
                        type="text"
                        placeholder="e.g. carton, pack, box"
                        value={linkPackagingUnit}
                        onChange={e => setLinkPackagingUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-neutral-400 mb-1 block">Units per Pack</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 24"
                        value={linkConversionFactor}
                        onChange={e => setLinkConversionFactor(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white"
                        style={{ borderColor: theme.border }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLinking || !linkProductId}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-neutral-950 hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Link size={14} /> {isLinking ? 'Linking...' : 'Link Barcode to Selected Product'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
