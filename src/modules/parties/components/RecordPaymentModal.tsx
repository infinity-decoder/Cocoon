/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { DocumentWithLines } from '../../../infrastructure/database/repositories/DocumentRepository';
import { RecordPaymentParams } from '../../../application/services/PartyKhataService';

interface RecordPaymentModalProps {
  isOpen: boolean;
  party: PartyRecord | null;
  parties: PartyRecord[];
  documents: DocumentWithLines[];
  currencySymbol: string;
  theme: AppTheme;
  onClose: () => void;
  onSubmit: (params: RecordPaymentParams) => Promise<void>;
}

export function RecordPaymentModal({
  isOpen,
  party: initialParty,
  parties,
  documents,
  currencySymbol,
  theme,
  onClose,
  onSubmit
}: RecordPaymentModalProps) {
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'customer_receipt' | 'supplier_payment'>('customer_receipt');
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialParty) {
      setSelectedPartyId(initialParty.id);
      if (initialParty.type === 'supplier') {
        setPaymentType('supplier_payment');
      } else {
        setPaymentType('customer_receipt');
      }
    } else if (parties.length > 0 && !selectedPartyId) {
      setSelectedPartyId(parties[0].id);
    }
  }, [initialParty, parties, isOpen]);

  // Find currently selected party
  const currentParty = useMemo(() => {
    return parties.find(p => p.id === selectedPartyId) || initialParty || null;
  }, [parties, selectedPartyId, initialParty]);

  // Unpaid or partial documents for this party
  const eligibleDocuments = useMemo(() => {
    if (!currentParty) return [];
    return documents.filter(doc => {
      const isPartyMatch = doc.partyId === currentParty.id;
      const isUnpaid = doc.status === 'unpaid' || doc.status === 'partial';
      const isTypeMatch =
        paymentType === 'customer_receipt'
          ? doc.documentType === 'sales_invoice'
          : doc.documentType === 'purchase_bill';
      return isPartyMatch && isUnpaid && isTypeMatch;
    });
  }, [documents, currentParty, paymentType]);

  // Total allocated amount calculation
  const totalAllocatedScaled = useMemo(() => {
    let sum = 0n;
    for (const [_, val] of Object.entries(allocations)) {
      const num = Number(val);
      if (num > 0) {
        sum += BigInt(Math.round(num * 10000));
      }
    }
    return sum;
  }, [allocations]);

  const enteredAmountScaled = useMemo(() => {
    const num = Number(amount);
    return num > 0 ? BigInt(Math.round(num * 10000)) : 0n;
  }, [amount]);

  const unallocatedAmountScaled = useMemo(() => {
    if (enteredAmountScaled >= totalAllocatedScaled) {
      return enteredAmountScaled - totalAllocatedScaled;
    }
    return 0n;
  }, [enteredAmountScaled, totalAllocatedScaled]);

  const formatScaled = (scaledVal?: bigint | number | null) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = typeof scaledVal === 'bigint' ? Number(scaledVal) / 10000 : Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isOpen) return null;

  // Auto-fill allocation when clicking "Pay in Full" on a document
  const handleAllocateFull = (doc: DocumentWithLines) => {
    const remainingScaled = doc.totalScaled - doc.paidAmountScaled;
    const remainingNum = Number(remainingScaled) / 10000;
    setAllocations(prev => ({
      ...prev,
      [doc.id]: remainingNum.toFixed(2)
    }));

    // If total entered amount is less than total allocated, adjust amount to match
    const newTotalAlloc = totalAllocatedScaled + remainingScaled;
    if (enteredAmountScaled < newTotalAlloc) {
      setAmount((Number(newTotalAlloc) / 10000).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParty) {
      setError('Please select a party/contact.');
      return;
    }
    if (enteredAmountScaled <= 0n) {
      setError('Please enter a valid positive payment amount.');
      return;
    }
    if (totalAllocatedScaled > enteredAmountScaled) {
      setError('Total allocated to invoices cannot exceed the payment amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const allocList = Object.entries(allocations)
        .map(([docId, val]) => {
          const num = Number(val);
          return {
            documentId: docId,
            amountScaled: BigInt(Math.round(num * 10000))
          };
        })
        .filter(a => a.amountScaled > 0n);

      await onSubmit({
        partyId: currentParty.id,
        paymentType,
        amountScaled: enteredAmountScaled,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocList.length > 0 ? allocList : undefined
      });

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment.');
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

        {/* Modal Card */}
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
                Khata Payment & Ledger Transaction
              </span>
              <h2 className="text-lg font-black text-white mt-0.5 flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                Record Khata Payment
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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment Direction */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('customer_receipt')}
                className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                  paymentType === 'customer_receipt'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <ArrowDownLeft size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Receive Money</span>
                  <span className="text-[10px] text-neutral-400">Customer Receipt</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('supplier_payment')}
                className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                  paymentType === 'supplier_payment'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Pay Money</span>
                  <span className="text-[10px] text-neutral-400">Supplier Payment</span>
                </div>
              </button>
            </div>

            {/* Party Selector */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Contact / Party <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedPartyId}
                onChange={e => {
                  setSelectedPartyId(e.target.value);
                  setAllocations({});
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {parties.map(p => (
                  <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                    {p.name} ({p.type}) {p.phone ? `· ${p.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Amount ({currencySymbol}) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Payment Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Payment Method & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="Cash" className="bg-neutral-900">Cash on Hand</option>
                  <option value="Bank Transfer" className="bg-neutral-900">Bank Transfer / Online</option>
                  <option value="Cheque" className="bg-neutral-900">Cheque</option>
                  <option value="Mobile Wallet" className="bg-neutral-900">EasyPaisa / JazzCash</option>
                  <option value="Card" className="bg-neutral-900">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Reference / Receipt #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="e.g. TXN-100234"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Invoice Allocation Section */}
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-400" />
                  Allocate to Unpaid Invoices ({eligibleDocuments.length})
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Allocated: {currencySymbol} {formatScaled(totalAllocatedScaled)}
                </span>
              </div>

              {eligibleDocuments.length === 0 ? (
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-neutral-400 font-mono">
                  No unpaid {paymentType === 'customer_receipt' ? 'sales invoices' : 'purchase bills'} pending for this contact.
                  The full amount will be recorded as an unallocated advance credit.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {eligibleDocuments.map(doc => {
                    const remainingScaled = doc.totalScaled - doc.paidAmountScaled;
                    const allocatedVal = allocations[doc.id] || '';

                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl border flex justify-between items-center bg-white/5"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white font-mono">
                            {doc.documentNumber}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            Due: {doc.dueDate} · Balance: {currencySymbol} {formatScaled(remainingScaled)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAllocateFull(doc)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                          >
                            Pay Full
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={allocatedVal}
                            onChange={e => {
                              const v = e.target.value;
                              setAllocations(prev => ({
                                ...prev,
                                [doc.id]: v
                              }));
                            }}
                            className="w-24 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unallocated advance breakdown */}
              {unallocatedAmountScaled > 0n && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex justify-between items-center text-xs text-blue-400 font-mono">
                  <span>Unallocated Advance Credit:</span>
                  <span className="font-bold">{currencySymbol} {formatScaled(unallocatedAmountScaled)}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Transaction Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes or remittance details..."
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Posting Payment...' : 'Post to Ledger & Khata'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
