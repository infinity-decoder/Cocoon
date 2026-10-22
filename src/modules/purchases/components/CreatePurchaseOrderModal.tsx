/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, FileSpreadsheet, AlertCircle, Info } from 'lucide-react';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { PurchaseService } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  currencySymbol: string;
}

interface POLineFormItem {
  id: string;
  productId: string;
  description: string;
  orderedQuantity: number;
  packageUnit: string;
  unitCost: number;
  discount: number;
  taxRatePercent: number;
}

export function CreatePurchaseOrderModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  parties,
  products,
  currencySymbol
}: CreatePurchaseOrderModalProps) {
  const suppliers = parties.filter(p => p.type === 'supplier' || p.type === 'both' || true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const deliveryDefaultStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [orderNumber, setOrderNumber] = useState<string>(`PO-${Date.now().toString().slice(-6)}`);
  const [orderDate, setOrderDate] = useState<string>(todayStr);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(deliveryDefaultStr);
  const [notes, setNotes] = useState<string>('');

  const [lines, setLines] = useState<POLineFormItem[]>([
    {
      id: 'po-line-1',
      productId: products[0]?.id || '',
      description: products[0]?.name || 'Product item',
      orderedQuantity: 1,
      packageUnit: products[0]?.unit || 'pcs',
      unitCost: products[0] ? Number(products[0].costPriceScaled) / 10000 : 0,
      discount: 0,
      taxRatePercent: 0
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  let totalOrderAmount = 0;
  lines.forEach(l => {
    const gross = l.orderedQuantity * l.unitCost;
    const taxable = Math.max(0, gross - l.discount);
    totalOrderAmount += taxable + taxable * (l.taxRatePercent / 100);
  });

  const handleProductChange = (lineId: string, prodId: string) => {
    const p = products.find(item => item.id === prodId);
    if (!p) return;
    setLines(prev =>
      prev.map(l =>
        l.id === lineId
          ? {
              ...l,
              productId: p.id,
              description: p.name,
              packageUnit: p.unit || 'pcs',
              unitCost: Number(p.costPriceScaled) / 10000
            }
          : l
      )
    );
  };

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `po-line-${Date.now()}`,
        productId: products[0]?.id || '',
        description: products[0]?.name || 'Item',
        orderedQuantity: 1,
        packageUnit: products[0]?.unit || 'pcs',
        unitCost: products[0] ? Number(products[0].costPriceScaled) / 10000 : 0,
        discount: 0,
        taxRatePercent: 0
      }
    ]);
  };

  const handleRemoveLine = (lineId: string) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }

    try {
      setIsSubmitting(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      await PurchaseService.createPurchaseOrder(conn, workspaceId, {
        orderNumber,
        supplierId,
        orderDate,
        expectedDeliveryDate,
        notes: notes.trim() || undefined,
        lines: lines.map(l => ({
          productId: l.productId,
          itemType: 'inventory',
          description: l.description,
          orderedQuantity: l.orderedQuantity,
          packageUnit: l.packageUnit,
          unitCostScaled: BigInt(Math.round(l.unitCost * 10000)),
          discountScaled: BigInt(Math.round(l.discount * 10000)),
          taxRatePercent: l.taxRatePercent
        }))
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create purchase order.');
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
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <FileSpreadsheet size={18} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white">Create Purchase Order</h2>
                <span className="text-[11px] text-neutral-400">Order from supplier before receipt</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Non-inflating stock notice */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Creating a purchase order registers an authorized order commitment. It does <strong>not</strong> inflate on-hand stock or create journal entries until goods or bills are received.
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Supplier / Distributor *
                </label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  PO Number *
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Order Date *
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={e => setExpectedDeliveryDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="border border-white/10 rounded-xl p-3 bg-neutral-950/40 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Order Line Items
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Line
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {lines.map(line => (
                  <div
                    key={line.id}
                    className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-6 sm:col-span-5">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Product</label>
                      <select
                        value={line.productId}
                        onChange={e => handleProductChange(line.id, e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        required
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku || p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3 sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Unit</label>
                      <input
                        type="text"
                        value={line.packageUnit}
                        onChange={e =>
                          setLines(prev =>
                            prev.map(l => (l.id === line.id ? { ...l, packageUnit: e.target.value } : l))
                          )
                        }
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={line.orderedQuantity}
                        onChange={e =>
                          setLines(prev =>
                            prev.map(l =>
                              l.id === line.id ? { ...l, orderedQuantity: parseFloat(e.target.value) || 0 } : l
                            )
                          )
                        }
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        required
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Unit Cost ({currencySymbol})</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitCost}
                        onChange={e =>
                          setLines(prev =>
                            prev.map(l =>
                              l.id === line.id ? { ...l, unitCost: parseFloat(e.target.value) || 0 } : l
                            )
                          )
                        }
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        required
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        disabled={lines.length <= 1}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Notes / Terms</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Delivery instructions, distributor agreement details..."
                rows={2}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex justify-between items-center px-2 py-1 text-xs">
              <span className="text-neutral-400">Total Order Commitment:</span>
              <span className="text-lg font-black text-white font-mono">
                {currencySymbol} {totalOrderAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Creating Order...' : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
