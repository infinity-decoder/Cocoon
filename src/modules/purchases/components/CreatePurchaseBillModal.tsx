/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, ShoppingBag, Truck, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { PurchaseService } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface CreatePurchaseBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  accounts: AccountRecord[];
  currencySymbol: string;
}

interface BillLineFormItem {
  id: string;
  productId: string;
  itemType: 'inventory' | 'expense';
  description: string;
  quantity: number;
  packageUnit: string;
  unitCost: number;
  discount: number;
  taxRatePercent: number;
}

export function CreatePurchaseBillModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  parties,
  products,
  accounts,
  currencySymbol
}: CreatePurchaseBillModalProps) {
  const suppliers = parties.filter(p => p.type === 'supplier' || p.type === 'both' || true);
  const paymentAccounts = accounts.filter(a => a.type === 'asset' && (a.accountCode === '1010' || a.accountCode === '1020' || a.subCategory === 'cash' || a.subCategory === 'bank'));

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueDefaultStr = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [billNumber, setBillNumber] = useState<string>(`BILL-${Date.now().toString().slice(-6)}`);
  const [billDate, setBillDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(dueDefaultStr);
  const [notes, setNotes] = useState<string>('');
  const [receiveStockNow, setReceiveStockNow] = useState<boolean>(true);
  const [landedCost, setLandedCost] = useState<number>(0);
  const [allocationMethod, setAllocationMethod] = useState<'by_value' | 'by_quantity'>('by_value');

  // Immediate payment option
  const [payNow, setPayNow] = useState<boolean>(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string>(paymentAccounts[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Line items
  const [lines, setLines] = useState<BillLineFormItem[]>([
    {
      id: 'line-1',
      productId: products[0]?.id || '',
      itemType: products[0] ? 'inventory' : 'expense',
      description: products[0]?.name || 'Inventory item',
      quantity: 1,
      packageUnit: products[0]?.unit || 'pcs',
      unitCost: products[0] ? Number(products[0].costPriceScaled) / 10000 : 0,
      discount: 0,
      taxRatePercent: 0
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate live totals
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  lines.forEach(l => {
    const gross = l.quantity * l.unitCost;
    const disc = l.discount;
    const taxable = Math.max(0, gross - disc);
    const tax = taxable * (l.taxRatePercent / 100);
    subtotal += gross;
    totalDiscount += disc;
    totalTax += tax;
  });

  const grandTotal = subtotal - totalDiscount + totalTax + landedCost;

  const handleProductChange = (lineId: string, prodId: string) => {
    const p = products.find(item => item.id === prodId);
    setLines(prev =>
      prev.map(l => {
        if (l.id !== lineId) return l;
        if (!p) {
          return {
            ...l,
            productId: '',
            itemType: 'expense',
            description: 'Non-stock Expense',
            packageUnit: 'service',
            unitCost: 0
          };
        }
        return {
          ...l,
          productId: p.id,
          itemType: 'inventory',
          description: p.name,
          packageUnit: p.unit || 'pcs',
          unitCost: Number(p.costPriceScaled) / 10000
        };
      })
    );
  };

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        productId: products[0]?.id || '',
        itemType: products[0] ? 'inventory' : 'expense',
        description: products[0]?.name || 'Line Item',
        quantity: 1,
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
    if (lines.length === 0) {
      setErrorMsg('Add at least one line item.');
      return;
    }

    try {
      setIsSubmitting(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      const landedCostScaled = BigInt(Math.round(landedCost * 10000));

      const serviceLines = lines.map(l => ({
        productId: l.productId || undefined,
        itemType: l.itemType,
        description: l.description,
        quantity: l.quantity,
        packageUnit: l.packageUnit,
        unitCostScaled: BigInt(Math.round(l.unitCost * 10000)),
        discountScaled: BigInt(Math.round(l.discount * 10000)),
        taxRatePercent: l.taxRatePercent
      }));

      await PurchaseService.createPurchaseBill(conn, workspaceId, {
        billNumber,
        supplierId,
        billDate,
        dueDate,
        notes: notes.trim() || undefined,
        receiveStockNow,
        landedCostScaled,
        landedCostAllocationMethod: allocationMethod,
        lines: serviceLines,
        immediatePayment:
          payNow && paymentAmount > 0
            ? {
                accountId: paymentAccountId,
                amountScaled: BigInt(Math.round(paymentAmount * 10000)),
                paymentMethod: 'Cash',
                notes: `Immediate payment on Bill ${billNumber}`
              }
            : undefined
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record purchase bill.');
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
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <ShoppingBag size={18} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white">Record Purchase Bill</h2>
                <span className="text-[11px] text-neutral-400">Supplier invoice, stock receipt & liability</span>
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
            {/* Top Row: Supplier & Bill Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Supplier / Distributor *
                </label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
                  Bill / Invoice # *
                </label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={e => setBillNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Bill Date *
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Due Date (Payment Terms) *
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-white/10 rounded-xl p-3 bg-neutral-950/40 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Items & Non-Stock Expenses
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Line
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {lines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl flex flex-col gap-2"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Product Selector */}
                      <div className="col-span-6 sm:col-span-5">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Product / Item</label>
                        <select
                          value={line.productId}
                          onChange={e => handleProductChange(line.id, e.target.value)}
                          className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        >
                          <option value="">(Non-stock Operating Expense)</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku || p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Package Unit */}
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

                      {/* Quantity */}
                      <div className="col-span-3 sm:col-span-2">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={line.quantity}
                          onChange={e =>
                            setLines(prev =>
                              prev.map(l =>
                                l.id === line.id ? { ...l, quantity: parseFloat(e.target.value) || 0 } : l
                              )
                            )
                          }
                          className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                          required
                        />
                      </div>

                      {/* Unit Cost */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Cost ({currencySymbol})</label>
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

                      {/* Delete */}
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
                  </div>
                ))}
              </div>
            </div>

            {/* Landed Cost & Stock Receipt Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-950/40 border border-white/10 rounded-xl">
              <div>
                <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1.5 mb-1">
                  <Truck size={14} className="text-amber-400" />
                  Freight & Landed Costs ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={landedCost}
                  onChange={e => setLandedCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Allocated to inventory asset cost rather than immediate expense.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-300 mb-1 block">
                  Allocation Method
                </label>
                <select
                  value={allocationMethod}
                  onChange={e => setAllocationMethod(e.target.value as any)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="by_value">Allocate Proportionally by Item Value</option>
                  <option value="by_quantity">Allocate Proportionally by Quantity</option>
                </select>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="receiveStock"
                    checked={receiveStockNow}
                    onChange={e => setReceiveStockNow(e.target.checked)}
                    className="rounded text-blue-500"
                  />
                  <label htmlFor="receiveStock" className="text-xs text-neutral-300 cursor-pointer">
                    Receive stock into inventory on posting
                  </label>
                </div>
              </div>
            </div>

            {/* Payment Mode (Credit vs Pay Now) */}
            <div className="p-3 bg-neutral-950/40 border border-white/10 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DollarSign size={15} className="text-emerald-400" />
                  Payment Settlement
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={!payNow}
                      onChange={() => setPayNow(false)}
                    />
                    <span>Credit (Pay Later)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={payNow}
                      onChange={() => {
                        setPayNow(true);
                        setPaymentAmount(grandTotal);
                      }}
                    />
                    <span>Pay Now</span>
                  </label>
                </div>
              </div>

              {payNow && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div>
                    <label className="text-[10px] text-neutral-400 mb-1 block">Account</label>
                    <select
                      value={paymentAccountId}
                      onChange={e => setPaymentAccountId(e.target.value)}
                      className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      required
                    >
                      {paymentAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.accountCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 mb-1 block">Amount to Pay</label>
                    <input
                      type="number"
                      min="0.01"
                      max={grandTotal}
                      step="any"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-neutral-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="flex justify-between items-center px-2 py-1 text-xs">
              <span className="text-neutral-400">Total Purchase Value:</span>
              <span className="text-lg font-black text-white font-mono">
                {currencySymbol} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Action Buttons */}
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? 'Posting Bill...' : 'Post Purchase Bill'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
