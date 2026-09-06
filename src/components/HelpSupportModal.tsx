/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, ChevronDown, BookOpen, Shield, MessageSquare } from 'lucide-react';

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
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: themeBorder }}>
            <div className="flex items-center gap-2.5">
              <HelpCircle className="text-emerald-400" size={18} />
              <div>
                <h3 className="text-base font-black text-white font-display">Help & Support Guide</h3>
                <p className="text-[11px] text-neutral-400 font-mono">Frequently asked questions & user manual</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Info Blocks */}
          <div className="p-5 bg-black/10 border-b grid grid-cols-2 gap-3" style={{ borderColor: themeBorder }}>
            <div className="p-3 bg-white/3 border border-white/5 rounded-2xl text-left">
              <BookOpen className="text-emerald-400 mb-1.5" size={16} />
              <h4 className="text-[11px] font-black text-white uppercase font-mono tracking-wider">Quick Guide</h4>
              <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                Tap "+" to record an expense. Manage goals in Savings Vault.
              </p>
            </div>
            <div className="p-3 bg-white/3 border border-white/5 rounded-2xl text-left">
              <Shield className="text-blue-400 mb-1.5" size={16} />
              <h4 className="text-[11px] font-black text-white uppercase font-mono tracking-wider">Offline First</h4>
              <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                Zero telemetry. Absolute physical key-value control.
              </p>
            </div>
          </div>

          {/* FAQ Accordion List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <h4 className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold text-left mb-1">
              Frequently Asked Questions
            </h4>

            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div 
                  key={index} 
                  className="rounded-2xl border bg-white/2 hover:bg-white/3 overflow-hidden transition-all text-left"
                  style={{ borderColor: themeBorder }}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full p-4 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-white"
                  >
                    <span>{item.q}</span>
                    <ChevronDown 
                      size={14} 
                      className="text-neutral-500 transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t"
                        style={{ borderColor: themeBorder }}
                      >
                        <p className="p-4 text-[11px] text-neutral-300 leading-relaxed font-sans bg-black/10">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
