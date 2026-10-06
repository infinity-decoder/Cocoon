/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, ChevronDown, BookOpen, Shield, MessageSquare, ArrowLeft } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

const FAQ_ITEMS = [
  {
    q: 'How does Cocoon protect my financial details?',
    a: 'Cocoon is designed with a strict local-first architecture. All your transaction ledger logs, custom category tags, and vault balances are stored in your device\'s local storage. No data is transmitted to remote servers, preventing external security breaches.'
  },
  {
    q: 'How do I add custom categories with custom icons?',
    a: 'Open the sidebar menu using the top-right menu trigger (☰), then select "Expense Categories" or "Income Categories". Click the "+ Add New" button. You will be able to enter a category name, select from 12 swatches, pick a vector icon, and save immediately.'
  },
  {
    q: 'What is the Savings Vault and how does it work?',
    a: 'The Savings Vault represents an isolated piggy-bank fund separate from your cash/checking balances. You can deposit money into a goal (e.g., M3 Macbook) from any physical wallet. This deducts the balance from your cash wallet and locks it securely inside the goal fund.'
  },
  {
    q: 'Can I export a backup of my ledger?',
    a: 'Yes. Go to the Sidebar and click "Profile & Themes" (or open Settings). In the Backup & Storage section, click "Export Local Backup". This downloads a secure .json file representing your database, which you can import back at any time.'
  }
];

export default function HelpSupportModal({
  isOpen,
  onClose,
  themeCardBg,
  themeBorder,
  themeRadius
}: HelpSupportModalProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b gap-3" style={{ borderColor: themeBorder }}>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Back to Home"
            >
              <ArrowLeft size={14} className="text-emerald-400" />
              <span>Back to Home</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <HelpCircle size={16} />
              </div>
              <span className="text-sm font-bold text-white">How Cocoon Works</span>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Accordion */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-none text-left">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border bg-white/2 overflow-hidden transition-all"
                  style={{ borderColor: themeBorder }}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left gap-3 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-neutral-200">{item.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-[11px] text-neutral-400 leading-relaxed border-t border-white/5">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-left mt-4">
              <Shield size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-300">Offline & Privacy First</span>
                <span className="text-[10px] text-neutral-300 mt-1 leading-relaxed">
                  Your data never touches third-party trackers or servers. Everything remains strictly stored on your own device.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
