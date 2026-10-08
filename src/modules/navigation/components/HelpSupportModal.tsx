/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, HelpCircle, ChevronDown, Shield, ArrowLeft, 
  Pencil, Trash2, ChevronLeft, ChevronRight, FileSpreadsheet, Printer, Sparkles 
} from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

export default function HelpSupportModal({
  isOpen,
  onClose,
  isInline = false,
  themeCardBg,
  themeBorder,
  themeRadius
}: HelpSupportModalProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const contentElement = (
    <div className={`w-full flex flex-col gap-4 text-left select-none ${isInline ? 'pb-6' : ''}`}>
      {/* Top Header Row matching Ledger Book & UI/UX Standards */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5 gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
          title="Back to Home"
        >
          <ArrowLeft size={14} className="text-emerald-400" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle size={15} />
          </div>
          <span className="text-xs font-bold text-white">FAQ & User Guide</span>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 text-rose-400 cursor-pointer transition-all active:scale-90 shadow-sm shrink-0"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Accordion FAQ List */}
      <div className="flex flex-col gap-3">
        {/* Item 0: Slide/Swipe Gesture for Ledger Book */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 0 ? null : 0)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs font-bold text-neutral-200">
                How do I edit or delete a transaction in the Ledger Book?
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 0 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 0 && (
            <div className="px-4 pb-4 pt-1 flex flex-col gap-3 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              <p>
                In the <strong>Ledger Book</strong>, each transaction row is an interactive swipe card:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-300">
                <li><strong className="text-blue-400">Slide Right (👈 Drag Right)</strong>: Uncovers the blue <strong>Edit</strong> button. Tap it to edit description, notes, or amounts.</li>
                <li><strong className="text-rose-400">Slide Left (Drag Left 👉)</strong>: Uncovers the crimson <strong>Delete</strong> button. Tap it to permanently delete the transaction.</li>
              </ul>

              {/* Looping swipe gesture demo card */}
              <div className="bg-gradient-to-r from-blue-950/40 via-neutral-900/60 to-rose-950/40 border border-white/10 rounded-xl p-3 flex flex-col gap-2 mt-1">
                <div className="relative h-11 bg-black/50 rounded-xl overflow-hidden border border-white/5 flex items-center justify-between px-3 text-[10px]">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold z-0">
                    <Pencil size={12} />
                    <span>Slide Right to Edit</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold z-0">
                    <span>Slide Left to Delete</span>
                    <Trash2 size={12} />
                  </div>

                  <motion.div
                    animate={{
                      x: [0, 70, 0, -70, 0]
                    }}
                    transition={{
                      duration: 4.8,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    className="absolute inset-y-1 inset-x-8 bg-neutral-800/95 border border-white/15 rounded-lg flex items-center justify-center gap-2 shadow-lg z-10 pointer-events-none select-none text-neutral-200"
                  >
                    <ChevronLeft size={13} className="text-rose-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-white">👈 Drag Card 👉</span>
                    <ChevronRight size={13} className="text-blue-400 animate-pulse" />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-medium">
                  <div className="flex items-center gap-1 text-neutral-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span>Swipe <strong>Right</strong>: Edit</span>
                  </div>
                  <div className="flex items-center gap-1 text-neutral-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1 justify-end text-right">
                    <span>Swipe <strong>Left</strong>: Delete</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Item 1: Save & Export Transactions */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 1 ? null : 1)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-neutral-200">
                How do I save or export my transactions and statements?
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 1 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 1 && (
            <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              <p>
                Cocoon gives you two flexible ways to export your records:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
                <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <FileSpreadsheet size={14} />
                    <span>Excel / CSV Spreadsheet</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Download raw transaction records (.csv) compatible with Microsoft Excel, Google Sheets, or Apple Numbers.
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Printer size={14} />
                    <span>Official Transaction Statement</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Generates an executive bank-style statement featuring Cocoon branding, your profile info, period dates, and a confidential seal.
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400">
                To export, open <strong>Ledger Book</strong>, tap the export icon next to the filter button, pick your time scope (Monthly, Yearly, or All), and choose <strong>Download CSV</strong> or <strong>Save PDF</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Item 2: Local-First Privacy */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 2 ? null : 2)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <span className="text-xs font-bold text-neutral-200">How does Cocoon protect my financial details?</span>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 2 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 2 && (
            <div className="px-4 pb-4 pt-1 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              Cocoon is designed with a strict local-first architecture. All your transaction ledger logs, custom category tags, and vault balances are stored in your device&apos;s local storage. No data is transmitted to remote servers, preventing external security breaches.
            </div>
          )}
        </div>

        {/* Item 3: Custom Categories */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 3 ? null : 3)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <span className="text-xs font-bold text-neutral-200">How do I add custom categories with custom icons?</span>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 3 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 3 && (
            <div className="px-4 pb-4 pt-1 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              Open the Control Menu using the top menu icon (☰), then select &quot;Custom Categories&quot;. Click &quot;+ Add New Category&quot;. You can enter a category name, choose from 12 harmonious colors, pick a vector icon, and save immediately.
            </div>
          )}
        </div>

        {/* Item 4: Savings Vault */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 4 ? null : 4)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <span className="text-xs font-bold text-neutral-200">What is the Savings Vault and how does it work?</span>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 4 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 4 && (
            <div className="px-4 pb-4 pt-1 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              The Savings Vault represents an isolated piggy-bank fund separate from your cash/checking balances. You can deposit money into a goal from any physical wallet. This deducts the balance from your cash wallet and locks it securely inside the goal fund, protected by your 4-digit Vault PIN.
            </div>
          )}
        </div>

        {/* Item 5: Database Backups */}
        <div
          className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
          style={{ borderColor: themeBorder }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === 5 ? null : 5)}
            className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
          >
            <span className="text-xs font-bold text-neutral-200">Can I export a backup of my ledger database?</span>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform shrink-0 ${openIndex === 5 ? 'rotate-180 text-emerald-400' : ''}`}
            />
          </button>
          {openIndex === 5 && (
            <div className="px-4 pb-4 pt-1 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
              Yes. Open the Control Menu and select &quot;Settings&quot;. In the Database Backup section, click &quot;Export Local Backup&quot;. This downloads a secure .json file representing your entire database, which you can restore at any time.
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-left mt-2">
        <Shield size={20} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-emerald-300">Offline & Privacy First</span>
          <span className="text-[10px] text-neutral-300 mt-1 leading-relaxed">
            Your financial data never touches remote servers or trackers. Everything remains strictly stored on your own physical device.
          </span>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return contentElement;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[85vh] overflow-y-auto p-4 shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          {contentElement}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
