/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import { PurchaseBillWithLines } from '../../../infrastructure/database/repositories/PurchaseRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { PurchaseService } from '../../../application/services/PurchaseService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface RecordBillPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  bill: PurchaseBillWithLines | null;
  accounts: AccountRecord[];
  currencySymbol: string;
}

export function RecordBillPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  bill,
  accounts,
  currencySymbol
}: RecordBillPaymentModalProps) {
  const paymentAccounts = accounts.filter(
    a => a.type === 'asset' && (a.accountCode === '1010' || a.accountCode === '1020' || a.subCategory === 'cash' || a.subCategory === 'bank')
  );

  const remaining = bill ? Number(bill.totalScaled - bill.paidAmountScaled) / 10000 : 0;
  const [amount, setAmount] = useState<number>(remaining > 0 ? remaining : 0);
  const [accountId, setAccountId] = useState<string>(paymentAccounts[0]?.id || '');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !bill) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('Payment amount must be greater than zero.');
      return;
    }
    if (amount > remaining + 0.0001) {
      setErrorMsg(`Payment amount cannot exceed remaining balance of ${currencySymbol} ${remaining.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const conn = await SqliteConnectionPool.getInstance().getConnection();

      await PurchaseService.recordSupplierPayment(conn, workspaceId, {
        billId: bill.id,
        amountScaled: BigInt(Math.round(amount * 10000)),
        paymentDate,
        paymentMethod,
        accountId,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined
      });

      triggerHapticFeedback();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record supplier payment.');
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
          className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-5 my-8 text-white flex flex-col gap-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <DollarSign size={18} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white">Pay Supplier Bill</h2>
                <span className="text-[11px] text-neutral-400">
                  Bill #{bill.billNumber} · {bill.supplierName}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Balance card */}
          <div className="p-3 bg-neutral-950/50 border border-white/10 rounded-xl flex justify-between items-center text-xs">
            <div className="flex flex-col">
              <span className="text-neutral-400">Total Bill Amount</span>
              <span className="font-mono font-bold text-white mt-0.5">
                {currencySymbol} {(Number(bill.totalScaled) / 10000).toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-neutral-400">Remaining Balance</span>
              <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                {currencySymbol} {remaining.toFixed(2)}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                Payment Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                min="0.01"
                max={remaining}
                step="any"
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Paying Account *
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
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
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Reference / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. TR-9981"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1 block">Notes</label>
              <input
                type="text"
                placeholder="Paid by manager, online transfer..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10 mt-1">
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
