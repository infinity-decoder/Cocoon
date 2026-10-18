/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';

interface CreateDocumentModalProps {
  isOpen: boolean;
  workspaceName: string;
  currencySymbol: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  onClose: () => void;
  onSubmit: (params: {
    documentType: 'sales_invoice' | 'purchase_bill' | 'receipt';
    partyId?: string;
    partyName: string;
    issueDate: string;
    dueDate: string;
    lines: {
      itemId?: string;
      description: string;
      quantity: number;
      unitPriceScaled: bigint;
      discountScaled?: bigint;
      taxRatePercent?: number;
    }[];
    notes?: string;
  }) => Promise<void>;
  theme: AppTheme;
}

export function CreateDocumentModal({
  isOpen,
  workspaceName,
  currencySymbol,
  parties,
  products,
  onClose,
  onSubmit,
  theme
}: CreateDocumentModalProps) {
  const [documentType, setDocumentType] = useState<'sales_invoice' | 'purchase_bill' | 'receipt'>('sales_invoice');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customPartyName, setCustomPartyName] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<Array<{
    itemId?: string;
    description: string;
    quantity: number;
    unitPrice: string;
    taxRate: string;
    discount: string;
  }>>([
    { description: '', quantity: 1, unitPrice: '', taxRate: '0', discount: '0' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const relevantParties = parties.filter(p => {
    if (documentType === 'sales_invoice') return p.type === 'customer' || p.type === 'both';
    if (documentType === 'purchase_bill') return p.type === 'supplier' || p.type === 'both';
    return true;
  });

  const handleAddLine = () => {
    triggerHapticFeedback();
    setLines(prev => [
      ...prev,
      { description: '', quantity: 1, unitPrice: '', taxRate: '0', discount: '0' }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    triggerHapticFeedback();
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setLines(prev => {
      const copy = [...prev];
      const priceScaled = documentType === 'sales_invoice' ? prod.salePriceScaled : prod.costPriceScaled;
      const priceFloat = (Number(priceScaled) / 10000).toFixed(2);
      copy[index] = {
        ...copy[index],
        itemId: prod.id,
        description: prod.name,
        unitPrice: priceFloat
      };
      return copy;
    });
  };

  // Calculate live preview total
  const calculatedTotal = lines.reduce((acc, line) => {
    const q = Number(line.quantity) || 0;
    const p = Number(line.unitPrice) || 0;
    const disc = Number(line.discount) || 0;
    const tax = Number(line.taxRate) || 0;
    const base = q * p;
    const net = Math.max(0, base - disc);
    const withTax = net + (net * tax) / 100;
    return acc + withTax;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let resolvedPartyName = customPartyName.trim();
    if (selectedPartyId) {
      const p = parties.find(party => party.id === selectedPartyId);
      if (p) resolvedPartyName = p.name;
    }

    if (!resolvedPartyName) {
      setError('Please select or specify a Customer / Supplier name.');
      return;
    }

    if (lines.length === 0 || lines.some(l => !l.description.trim() || Number(l.unitPrice) < 0)) {
      setError('Please provide at least one valid line item with description and unit price.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const transformedLines = lines.map(l => ({
        itemId: l.itemId || undefined,
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unitPriceScaled: BigInt(Math.round((Number(l.unitPrice) || 0) * 10000)),
        discountScaled: BigInt(Math.round((Number(l.discount) || 0) * 10000)),
        taxRatePercent: Number(l.taxRate) || 0
      }));

      await onSubmit({
        documentType,
        partyId: selectedPartyId || undefined,
        partyName: resolvedPartyName,
        issueDate,
        dueDate,
        lines: transformedLines,
        notes: notes.trim() || undefined
      });

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                Workspace Context: {workspaceName}
              </span>
              <h2 className="text-lg font-black text-white mt-0.5 flex items-center gap-2">
                <FileText size={18} className="text-emerald-400" />
                {documentType === 'sales_invoice' ? 'Create Sales Invoice' : documentType === 'purchase_bill' ? 'Record Purchase Bill' : 'Record Receipt'}
              </h2>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Document Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDocumentType('sales_invoice')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  documentType === 'sales_invoice'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                }`}
              >
                Sales Invoice
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('purchase_bill')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  documentType === 'purchase_bill'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                }`}
              >
                Purchase Bill
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('receipt')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  documentType === 'receipt'
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                    : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                }`}
              >
                Cash Receipt
              </button>
            </div>

            {/* Party Selection (Scoped to this business!) */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                {documentType === 'sales_invoice' ? 'Customer' : 'Supplier'} <span className="text-rose-400">*</span>
              </label>
              {relevantParties.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedPartyId}
                    onChange={e => {
                      setSelectedPartyId(e.target.value);
                      if (e.target.value) setCustomPartyName('');
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select from {workspaceName} Contacts --</option>
                    {relevantParties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type}) {p.phone ? `· ${p.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  {!selectedPartyId && (
                    <input
                      type="text"
                      value={customPartyName}
                      onChange={e => setCustomPartyName(e.target.value)}
                      placeholder="Or enter walk-in party name..."
                      className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={customPartyName}
                  onChange={e => setCustomPartyName(e.target.value)}
                  placeholder="e.g. Walk-in Customer"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: theme.border }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Line Items ({lines.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Line
                </button>
              </div>

              {lines.map((line, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex gap-2">
                    {products.length > 0 && (
                      <select
                        value={line.itemId || ''}
                        onChange={e => handleSelectProduct(idx, e.target.value)}
                        className="w-1/3 px-2 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      required
                      placeholder="Item description / particulars"
                      value={line.description}
                      onChange={e => {
                        const copy = [...lines];
                        copy[idx].description = e.target.value;
                        setLines(copy);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500"
                    />

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400">Qty</span>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.quantity}
                        onChange={e => {
                          const copy = [...lines];
                          copy[idx].quantity = Number(e.target.value);
                          setLines(copy);
                        }}
                        className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs text-center"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400">Unit Price</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={line.unitPrice}
                        onChange={e => {
                          const copy = [...lines];
                          copy[idx].unitPrice = e.target.value;
                          setLines(copy);
                        }}
                        className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs text-center"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400">Disc ({currencySymbol})</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={line.discount}
                        onChange={e => {
                          const copy = [...lines];
                          copy[idx].discount = e.target.value;
                          setLines(copy);
                        }}
                        className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs text-center"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400">Tax %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        placeholder="0"
                        value={line.taxRate}
                        onChange={e => {
                          const copy = [...lines];
                          copy[idx].taxRate = e.target.value;
                          setLines(copy);
                        }}
                        className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Calculation Display */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-300">Calculated Total</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {currencySymbol} {calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Internal Remarks / Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Payment terms, delivery instructions..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Posting Document...' : 'Issue & Post Document'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
