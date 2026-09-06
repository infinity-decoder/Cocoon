/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Tag, ShieldCheck, Landmark, BarChart2, HelpCircle, 
  ChevronRight, ClipboardList, Vault
} from 'lucide-react';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCategories: () => void;
  onOpenLedger: () => void;
  onOpenSavings: () => void;
  onOpenBudgets: () => void;
  onOpenReports: () => void;
  onOpenHelp: () => void;
  activeThemeId: string;
  themeCardBg: string;
  themeBorder: string;
}

export default function SidebarMenu({
  isOpen,
  onClose,
  onOpenCategories,
  onOpenLedger,
  onOpenSavings,
  onOpenBudgets,
  onOpenReports,
  onOpenHelp,
  activeThemeId,
  themeCardBg,
  themeBorder
}: SidebarMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
          />

          {/* Sliding Panel Content */}
          <div className="absolute inset-y-0 right-0 max-w-[280px] w-full flex">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              className="h-full w-full shadow-2xl flex flex-col justify-between border-l select-none text-left"
              style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
            >
              {/* Sidebar Header */}
              <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: themeBorder }}>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-emerald-400 font-mono tracking-widest">Cocoon Menu</span>
                  <span className="text-[10px] text-neutral-400 font-mono mt-0.5">Offline Secure Vault</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Sidebar Menu Items */}
              <div className="flex-1 overflow-y-auto py-4.5 px-3 space-y-1.5 font-sans">
                {/* 1. Configuration & Ledgers */}
                <div className="px-3 pb-1 pt-2">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 font-black">Main Modules</span>
                </div>

                <button
                  onClick={() => {
                    onOpenLedger();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ClipboardList size={15} />
                    </div>
                    <span className="text-xs font-bold">Ledger</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>

                <button
                  onClick={() => {
                    onOpenCategories();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Tag size={15} />
                    </div>
                    <span className="text-xs font-bold">Categories</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>

                <button
                  onClick={() => {
                    onOpenBudgets();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Landmark size={15} />
                    </div>
                    <span className="text-xs font-bold">Budget Planner</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>

                <div className="h-px bg-white/5 my-3" />

                {/* 2. Core Wealth Modules */}
                <div className="px-3 pb-1">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 font-black">Wealth Modules</span>
                </div>

                <button
                  onClick={() => {
                    onOpenSavings();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Vault size={15} />
                    </div>
                    <span className="text-xs font-bold">Vault</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>

                <button
                  onClick={() => {
                    onOpenReports();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <BarChart2 size={15} />
                    </div>
                    <span className="text-xs font-bold">Analysis</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>

                <div className="h-px bg-white/5 my-3" />

                {/* 3. System Help */}
                <div className="px-3 pb-1">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 font-black">Support</span>
                </div>

                <button
                  onClick={() => {
                    onOpenHelp();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/4 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-neutral-500/10 text-neutral-300 border border-neutral-500/20">
                      <HelpCircle size={15} />
                    </div>
                    <span className="text-xs font-bold">Help & Support</span>
                  </div>
                  <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500" />
                </button>
              </div>

              {/* Sidebar Footer */}
              <div className="p-5 border-t bg-black/10 flex flex-col gap-1" style={{ borderColor: themeBorder }}>
                <span className="text-[9px] font-bold text-neutral-400 font-mono uppercase tracking-widest">Secured via Crypto</span>
                <span className="text-[8px] text-neutral-500 font-mono leading-relaxed">
                  Cocoon Ledger uses local offline state persistence. No personal cloud leaks.
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
