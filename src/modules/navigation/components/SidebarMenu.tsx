/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Tag, ShieldCheck, Landmark, BarChart2, HelpCircle, 
  ChevronRight, ClipboardList, Vault
} from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

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
              {/* Drawer Header */}
              <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: themeBorder }}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">Cocoon Navigation</span>
                  <span className="text-base font-black tracking-tight text-white mt-0.5">Control Menu</span>
                </div>
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                  }}
                  className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-none">
                <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-3 py-1 block">
                  Accounting & Records
                </span>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenLedger();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
                      <ClipboardList size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Ledger Book</span>
                      <span className="text-[9px] text-neutral-400">View transactions & filters</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenBudgets();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                      <Landmark size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Make Budget</span>
                      <span className="text-[9px] text-neutral-400">Monthly category limit caps</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenSavings();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
                      <Vault size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Savings Vault</span>
                      <span className="text-[9px] text-neutral-400">Locked goal targets & piggybank</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenReports();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                      <BarChart2 size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Analysis & Trends</span>
                      <span className="text-[9px] text-neutral-400">Interactive charts & timeline</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-3 pt-3 pb-1 block">
                  Configuration
                </span>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenCategories();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Tag size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Custom Categories</span>
                      <span className="text-[9px] text-neutral-400">Icons, tags & palette colors</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenHelp();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
                      <HelpCircle size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">FAQ & Guide</span>
                      <span className="text-[9px] text-neutral-400">Local-first privacy guide</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: themeBorder }}>
                <div className="flex items-center gap-2 text-neutral-400 text-[10px] font-mono">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>100% Offline Encrypted</span>
                </div>
                <div className="text-[8px] text-neutral-500 font-mono">
                  Cocoon v0.0.2 • INFINITY DECODER
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
