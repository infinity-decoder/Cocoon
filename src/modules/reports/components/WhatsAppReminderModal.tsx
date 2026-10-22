/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, Copy, Check, AlertTriangle, 
  ExternalLink, User, DollarSign, Calendar, FileText 
} from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { BusinessReportService, WhatsAppReminderDetails } from '../../../application/services/BusinessReportService';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  workspaceId: string;
  customerId: string;
  currencySymbol: string;
  onClose: () => void;
}

export function WhatsAppReminderModal({
  isOpen,
  workspaceId,
  customerId,
  currencySymbol,
  onClose
}: WhatsAppReminderModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<WhatsAppReminderDetails | null>(null);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !customerId) return;

    let isMounted = true;
    async function loadReminder() {
      setLoading(true);
      setError(null);
      try {
        const pool = SqliteConnectionPool.getInstance();
        const conn = await pool.getConnection();
        const res = await BusinessReportService.buildWhatsAppReminder(
          conn,
          workspaceId,
          customerId,
          currencySymbol
        );
        if (isMounted) {
          setDetails(res);
          setCustomMessage(res.messageText);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to generate WhatsApp reminder details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReminder();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId, customerId, currencySymbol]);

  if (!isOpen) return null;

  const handleCopyMessage = async () => {
    triggerHapticFeedback();
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const computeEncodedUrl = () => {
    if (!details) return '#';
    const cleanPhone = details.phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(customMessage);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  };

  const handleOpenWhatsApp = () => {
    triggerHapticFeedback();
    const url = computeEncodedUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-neutral-900/90 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">
                WhatsApp Payment Reminder
              </h2>
              <p className="text-xs text-neutral-400">
                Reviewable reminder generated from verified ledger records
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHapticFeedback();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {loading && (
            <div className="p-12 text-center text-neutral-400 font-mono">
              Generating verified balance & overdue invoice breakdown...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Error:</span> {error}
              </div>
            </div>
          )}

          {details && !loading && (
            <>
              {/* Customer Profile & Outstanding Summary */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold block">
                    Customer
                  </span>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <User size={14} className="text-neutral-400" />
                    <span>{details.customerName}</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 mt-0.5 block">
                    {details.phone}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold block">
                    Verified Balance Due
                  </span>
                  <span className="text-base font-black text-rose-400 font-mono mt-0.5 block">
                    {details.currencySymbol} {(Number(details.verifiedBalanceScaled) / 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {details.invoices.length} unpaid / overdue {details.invoices.length === 1 ? 'invoice' : 'invoices'}
                  </span>
                </div>
              </div>

              {/* Overdue Invoices Breakdown */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold block">
                  Included Overdue Invoices
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-white/5 rounded-xl p-2 bg-black/30">
                  {details.invoices.length === 0 ? (
                    <div className="text-center py-3 text-neutral-500 text-[11px]">
                      No overdue sales invoices found for this customer.
                    </div>
                  ) : (
                    details.invoices.map((inv, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center text-[11px] py-1 border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-blue-400" />
                          <span className="font-bold text-white font-mono">#{inv.invoiceNumber}</span>
                          <span className="text-neutral-400 text-[10px]">Due {inv.dueDate}</span>
                        </div>
                        <span className="font-mono font-bold text-rose-400">
                          {details.currencySymbol} {(Number(inv.dueAmountScaled) / 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Editable Message Preview */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                    Message Body (Review & Edit Before Sending)
                  </span>
                  <button
                    onClick={handleCopyMessage}
                    className="flex items-center gap-1 text-[10px] font-bold text-neutral-300 hover:text-white px-2 py-1 rounded bg-white/10 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={7}
                  className="w-full p-3 rounded-2xl bg-black/50 border border-neutral-700 text-neutral-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
                />
              </div>

              {/* Transparency & Delivery Disclosure */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[10px] flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <p>
                  <strong>Delivery Disclosure:</strong> {details.disclosure} Only this selected customer’s verified overdue data is included.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-white/10 bg-neutral-900/95 flex justify-end gap-2.5">
          <button
            onClick={() => {
              triggerHapticFeedback();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenWhatsApp}
            disabled={!details || loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Send size={14} />
            <span>Open in WhatsApp</span>
            <ExternalLink size={12} className="opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
}
