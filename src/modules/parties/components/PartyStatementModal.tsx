/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Users, BookOpen, ArrowDownLeft, ArrowUpRight, 
  RotateCcw, Calendar, AlertCircle, ChevronLeft, ChevronRight,
  Plus, CreditCard, ShieldCheck, Clock
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { databaseService } from '../../../infrastructure/database/DatabaseService';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { PartyKhataService } from '../../../application/services/PartyKhataService';
import { PartyStatementResult, PartyLedgerEntryRecord } from '../../../infrastructure/database/repositories/PartyLedgerRepository';

interface PartyStatementModalProps {
  isOpen: boolean;
  party: PartyRecord | null;
  workspaceId: string;
  currencySymbol: string;
  theme: AppTheme;
  onClose: () => void;
  onOpenRecordPayment: (party: PartyRecord) => void;
  onOpenReversePayment: (paymentId: string, paymentNumber: string, amountFormatted: string) => void;
}

export function PartyStatementModal({
  isOpen,
  party,
  workspaceId,
  currencySymbol,
  theme,
  onClose,
  onOpenRecordPayment,
  onOpenReversePayment
}: PartyStatementModalProps) {
  const [statement, setStatement] = useState<PartyStatementResult | null>(null);
  const [derivedBalance, setDerivedBalance] = useState<{
    receivableTotalScaled: bigint;
    payableTotalScaled: bigint;
    netBalanceScaled: bigint;
    balanceType: 'receivable' | 'payable' | 'zero';
  } | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const formatScaled = (scaledVal?: bigint) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const loadStatement = useCallback(async () => {
    if (!party || !isOpen) return;
    setIsLoading(true);
    try {
      const conn = await databaseService.getInitializedConnection();
      const [stmt, bal] = await Promise.all([
        PartyKhataService.getPartyStatement(conn, workspaceId, party.id, { page, pageSize: 20 }),
        PartyKhataService.getDerivedPartyBalance(conn, workspaceId, party.id)
      ]);
      setStatement(stmt);
      setDerivedBalance(bal);
    } catch (err) {
      console.error('Failed to load party statement:', err);
    } finally {
      setIsLoading(false);
    }
  }, [party, workspaceId, isOpen, page]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  if (!isOpen || !party) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[92vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <BookOpen size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                  Party Ledger & Khata Statement
                </span>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  {party.name}
                  {party.companyName && (
                    <span className="text-xs font-normal text-neutral-400">({party.companyName})</span>
                  )}
                </h1>
                <div className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5 font-mono">
                  <span className="capitalize px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">
                    Role: {party.type === 'both' ? 'Customer & Supplier (B2B)' : party.type}
                  </span>
                  {party.phone && <span>· {party.phone}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onOpenRecordPayment(party);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <CreditCard size={14} />
                Record Payment
              </button>
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
          </div>

          {/* Balance Cards Summary Banner */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Net Authoritative Balance */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Authoritative Net Balance
              </span>
              <span className={`text-base font-black font-mono ${
                derivedBalance?.balanceType === 'receivable'
                  ? 'text-emerald-400'
                  : derivedBalance?.balanceType === 'payable'
                  ? 'text-blue-400'
                  : 'text-neutral-300'
              }`}>
                {currencySymbol} {formatScaled(derivedBalance?.netBalanceScaled !== undefined ? (derivedBalance.netBalanceScaled < 0n ? -derivedBalance.netBalanceScaled : derivedBalance.netBalanceScaled) : 0n)}
              </span>
              <span className="text-[9px] font-mono text-neutral-400">
                {derivedBalance?.balanceType === 'receivable'
                  ? 'Money owed to business'
                  : derivedBalance?.balanceType === 'payable'
                  ? 'Money business owes'
                  : 'Zero balance settled'}
              </span>
            </div>

            {/* Total Receivables */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300">
                Total Receivables (+)
              </span>
              <span className="text-base font-black font-mono text-emerald-400">
                {currencySymbol} {formatScaled(derivedBalance?.receivableTotalScaled)}
              </span>
              <span className="text-[9px] font-mono text-emerald-300/70">
                Sales & debits
              </span>
            </div>

            {/* Total Payables */}
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300">
                Total Payables (-)
              </span>
              <span className="text-base font-black font-mono text-blue-400">
                {currencySymbol} {formatScaled(derivedBalance?.payableTotalScaled)}
              </span>
              <span className="text-[9px] font-mono text-blue-300/70">
                Payments & credits
              </span>
            </div>
          </div>

          {/* Opening balance indicator if present */}
          {party.openingBalanceScaled > 0n && (
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex justify-between items-center text-xs font-mono text-purple-300">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-purple-400" />
                Opening Balance as of {party.openingBalanceDate || 'Start'}:
              </span>
              <span className="font-bold">
                {currencySymbol} {formatScaled(party.openingBalanceScaled)} ({party.openingBalanceType})
              </span>
            </div>
          )}

          {/* Ledger Chronological Entries */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
            <div className="flex justify-between items-center text-xs font-mono text-neutral-400 px-1 pt-1">
              <span>Chronological Statement ({statement?.totalCount || 0} events)</span>
              <span>Sorted by Date ASC</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-neutral-400 font-mono">
                Loading ledger entries...
              </div>
            ) : !statement || statement.entries.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
                <BookOpen size={28} className="text-neutral-500" />
                <span className="text-xs text-neutral-400 font-mono">No ledger movements recorded yet.</span>
                <button
                  onClick={() => onOpenRecordPayment(party)}
                  className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 cursor-pointer"
                >
                  Record First Transaction
                </button>
              </div>
            ) : (
              statement.entries.map((entry: PartyLedgerEntryRecord) => {
                const isOverdue = entry.dueDate && entry.dueDate < todayStr && !entry.isReversed;
                const isPayment = entry.paymentId || entry.entryType.includes('payment');

                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-2xl border flex flex-col gap-2 transition-colors ${
                      entry.isReversed
                        ? 'bg-white/[0.02] border-white/5 opacity-60'
                        : 'bg-white/5 hover:bg-white/[0.07]'
                    }`}
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          entry.receivableAmountScaled > 0n
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {entry.receivableAmountScaled > 0n ? (
                            <ArrowDownLeft size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white flex items-center gap-2">
                            {entry.description}
                            {entry.isReversed && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono">
                                REVERSED
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-2">
                            <span>{entry.entryDate}</span>
                            {entry.referenceNumber && <span>· Ref: {entry.referenceNumber}</span>}
                            <span className="capitalize text-neutral-500">
                              · {entry.entryType.replace(/_/g, ' ')}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Movement & Running Balance */}
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-mono font-bold ${
                          entry.receivableAmountScaled > 0n
                            ? 'text-emerald-400'
                            : 'text-blue-400'
                        }`}>
                          {entry.receivableAmountScaled > 0n ? '+' : '-'} {currencySymbol} {formatScaled(
                            entry.receivableAmountScaled > 0n
                              ? entry.receivableAmountScaled
                              : entry.payableAmountScaled
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          Run: {currencySymbol} {formatScaled(entry.runningBalanceScaled)}
                        </span>
                      </div>
                    </div>

                    {/* Due Date & Action Bar */}
                    <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono pt-1.5 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        {entry.dueDate && (
                          <span className={isOverdue ? 'text-amber-400 font-bold' : ''}>
                            Due: {entry.dueDate} {isOverdue && '(OVERDUE)'}
                          </span>
                        )}
                      </div>

                      {/* Payment Reversal button if applicable and not already reversed */}
                      {isPayment && !entry.isReversed && entry.paymentId && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback();
                            const amt = `${currencySymbol} ${formatScaled(
                              entry.receivableAmountScaled > 0n
                                ? entry.receivableAmountScaled
                                : entry.payableAmountScaled
                            )}`;
                            onOpenReversePayment(entry.paymentId!, entry.referenceNumber || 'PAY', amt);
                          }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw size={12} />
                          Reverse Payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {statement && statement.totalCount > 20 && (
            <div className="flex justify-between items-center pt-2 border-t text-xs font-mono" style={{ borderColor: theme.border }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-neutral-300 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-neutral-400">
                Page {page} of {Math.ceil(statement.totalCount / 20)}
              </span>
              <button
                disabled={page >= Math.ceil(statement.totalCount / 20)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-neutral-300 flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
