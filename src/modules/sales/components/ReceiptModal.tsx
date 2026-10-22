/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Share2, Download, CheckCircle2, Copy } from 'lucide-react';
import { Share } from '@capacitor/share';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

export interface ReceiptData {
  businessName: string;
  legalName?: string;
  taxIdentifier?: string;
  invoiceNumber: string;
  date: string;
  cashierName?: string;
  customerName: string;
  currencySymbol: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceScaled: bigint;
    discountScaled: bigint;
    taxScaled: bigint;
    totalScaled: bigint;
  }>;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  changeOrDueScaled: bigint;
  paymentMethod: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

export function ReceiptModal({ isOpen, onClose, receiptData }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !receiptData) return null;

  const formatScaled = (scaledVal?: bigint) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateReceiptPlainText = () => {
    const lines = [
      '========================================',
      `       ${receiptData.businessName.toUpperCase()}`,
      receiptData.legalName ? `       ${receiptData.legalName}` : '',
      receiptData.taxIdentifier ? `       Tax ID: ${receiptData.taxIdentifier}` : '',
      '========================================',
      `Invoice #: ${receiptData.invoiceNumber}`,
      `Date:      ${receiptData.date}`,
      `Cashier:   ${receiptData.cashierName || 'Counter'}`,
      `Customer:  ${receiptData.customerName}`,
      '----------------------------------------',
      'ITEM             QTY   PRICE    TOTAL',
      '----------------------------------------'
    ].filter(Boolean);

    for (const item of receiptData.lines) {
      const price = formatScaled(item.unitPriceScaled);
      const total = formatScaled(item.totalScaled);
      lines.push(`${item.description.slice(0, 16).padEnd(16)} ${item.quantity} ${item.unit}  ${price}  ${total}`);
    }

    lines.push('----------------------------------------');
    lines.push(`Subtotal:              ${receiptData.currencySymbol} ${formatScaled(receiptData.subtotalScaled)}`);
    if (receiptData.discountScaled > 0n) {
      lines.push(`Discount:             -${receiptData.currencySymbol} ${formatScaled(receiptData.discountScaled)}`);
    }
    if (receiptData.taxScaled > 0n) {
      lines.push(`Tax:                   ${receiptData.currencySymbol} ${formatScaled(receiptData.taxScaled)}`);
    }
    lines.push(`TOTAL:                 ${receiptData.currencySymbol} ${formatScaled(receiptData.totalScaled)}`);
    lines.push(`Paid (${receiptData.paymentMethod}):   ${receiptData.currencySymbol} ${formatScaled(receiptData.paidAmountScaled)}`);
    lines.push(`Remaining Due / Change: ${receiptData.currencySymbol} ${formatScaled(receiptData.changeOrDueScaled)}`);
    lines.push('========================================');
    lines.push('       THANK YOU FOR YOUR PATRONAGE!    ');
    lines.push('   Goods once sold can be returned with ');
    lines.push('     original receipt within 7 days.    ');
    lines.push('========================================');

    return lines.join('\n');
  };

  const handlePrint = () => {
    triggerHapticFeedback();
    window.print();
  };

  const handleShare = async () => {
    triggerHapticFeedback();
    const text = generateReceiptPlainText();
    try {
      if (typeof navigator !== 'undefined' && (Share as any)?.share) {
        await Share.share({
          title: `Receipt ${receiptData.invoiceNumber}`,
          text: text,
          dialogTitle: 'Share POS Receipt'
        });
        return;
      }
    } catch {
      // Fall back to navigator.share
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receiptData.invoiceNumber}`,
          text: text
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    triggerHapticFeedback();
    setIsExporting(true);

    try {
      // Dynamic import of html2pdf.js
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Receipt-${receiptData.invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: [80, 220], orientation: 'portrait' }
      };

      await (html2pdf as any)().from(receiptRef.current).set(opt).save();
    } catch (err) {
      console.warn('PDF export fallback:', err);
      // Fallback to plain print
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col my-auto"
        >
          {/* Modal Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={16} />
              Sale Completed Successfully
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Printable Thermal Receipt Container */}
          <div className="p-4 bg-neutral-950 flex justify-center">
            <div
              ref={receiptRef}
              className="w-full bg-white text-black p-5 rounded-xl font-mono text-[11px] leading-tight shadow-md border border-neutral-300 select-all"
            >
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-neutral-400">
                <div className="font-extrabold text-sm tracking-wide">{receiptData.businessName}</div>
                {receiptData.legalName && (
                  <div className="text-[10px] text-neutral-600">{receiptData.legalName}</div>
                )}
                {receiptData.taxIdentifier && (
                  <div className="text-[10px] text-neutral-700 font-bold mt-0.5">
                    TAX / NTN: {receiptData.taxIdentifier}
                  </div>
                )}
              </div>

              {/* Meta details */}
              <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">INVOICE:</span>
                  <span className="font-bold">{receiptData.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">DATE:</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">CASHIER:</span>
                  <span>{receiptData.cashierName || 'Counter Terminal'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">CUSTOMER:</span>
                  <span className="font-bold">{receiptData.customerName}</span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="py-2.5 border-b border-dashed border-neutral-400">
                <div className="flex justify-between text-[10px] font-bold pb-1 text-neutral-700">
                  <span>ITEM</span>
                  <span>QTY x RATE</span>
                  <span className="text-right">TOTAL</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {receiptData.lines.map((line, idx) => (
                    <div key={idx} className="flex flex-col text-[10.5px]">
                      <div className="font-semibold text-neutral-900">{line.description}</div>
                      <div className="flex justify-between text-[10px] text-neutral-600">
                        <span>
                          {line.quantity} {line.unit} @ {formatScaled(line.unitPriceScaled)}
                        </span>
                        <span className="font-bold text-black">
                          {formatScaled(line.totalScaled)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Subtotal:</span>
                  <span>{formatScaled(receiptData.subtotalScaled)}</span>
                </div>
                {receiptData.discountScaled > 0n && (
                  <div className="flex justify-between text-neutral-700">
                    <span>Discount:</span>
                    <span>-{formatScaled(receiptData.discountScaled)}</span>
                  </div>
                )}
                {receiptData.taxScaled > 0n && (
                  <div className="flex justify-between text-neutral-700">
                    <span>Tax:</span>
                    <span>+{formatScaled(receiptData.taxScaled)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-neutral-400">
                  <span>TOTAL:</span>
                  <span>{receiptData.currencySymbol} {formatScaled(receiptData.totalScaled)}</span>
                </div>
                <div className="flex justify-between text-[10.5px] pt-1">
                  <span className="text-neutral-600">Paid ({receiptData.paymentMethod}):</span>
                  <span className="font-bold">{receiptData.currencySymbol} {formatScaled(receiptData.paidAmountScaled)}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span className="text-neutral-600">Remaining / Balance:</span>
                  <span className="font-bold">{receiptData.currencySymbol} {formatScaled(receiptData.changeOrDueScaled)}</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="pt-3 text-center text-[9.5px] text-neutral-600 space-y-0.5">
                <div className="font-bold">THANK YOU FOR SHOPPING WITH US!</div>
                <div>Returns accepted within 7 days with original receipt.</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-white/10 bg-neutral-950/60 flex items-center justify-between gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer size={14} />
              Print
            </button>

            <button
              onClick={handleShare}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
            >
              {copied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Download size={14} />
              {isExporting ? 'Saving...' : 'PDF'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
