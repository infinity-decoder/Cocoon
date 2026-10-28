/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Tag, ShieldCheck, HelpCircle, 
  ChevronRight, ClipboardList, Vault, Settings, Building2
} from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCategories: () => void;
  onOpenLedger: () => void;
  onOpenSavings: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenBusinessManagement?: () => void;
  activeWorkspaceName?: string;
  isBusinessMode?: boolean;
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
  onOpenSettings,
  onOpenHelp,
  onOpenBusinessManagement,
  activeWorkspaceName,
  isBusinessMode,
  themeCardBg,
  themeBorder
}: SidebarMenuProps) {
  const [appVersion, setAppVersion] = useState<string>('v 0.0.7');

  useEffect(() => {
    let isMounted = true;
    async function fetchAppVersion() {
      try {
        const info = await CapacitorApp.getInfo();
        if (info && info.version) {
          const formatted = `v ${info.version}`;
          if (isMounted) {
            setAppVersion(formatted);
          }
          const el = document.getElementById('app-version');
          if (el) {
            el.innerText = formatted;
          }
        }
      } catch {
        // Fallback in web browser or preview mode
        const el = document.getElementById('app-version');
        if (el && !el.innerText) {
          el.innerText = 'v 0.0.7';
        }
      }
    }

    fetchAppVersion();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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
              <div className="p-5 border-b flex justify-between items-center" style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E74425] shadow-[0_0_6px_#E74425]" />
                    <span className="text-[10px] font-mono tracking-widest text-[#E74425] font-bold uppercase">Cocoon Navigation</span>
                  </div>
                  <span className="text-base font-black tracking-tight text-white mt-1">Control Menu</span>
                </div>
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                  }}
                  className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-white/5 text-neutral-400 hover:text-white cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center"
                  title="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none" style={{ backgroundColor: '#0D1726' }}>
                {/* Manage Business Workspace entry */}
                {onOpenBusinessManagement && (
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      onClose();
                      onOpenBusinessManagement();
                    }}
                    className={`w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border ${
                      isBusinessMode
                        ? 'bg-[#E74425]/15 border-[#E74425]/40 text-white shadow-sm'
                        : 'bg-white/[0.04] border-white/5 hover:bg-[#111F49] text-neutral-200 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#E74425]/20 text-[#E74425] border border-[#E74425]/30 group-hover:scale-105 transition-transform">
                        <Building2 size={16} />
                      </div>
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">Manage Business</span>
                          {isBusinessMode && (
                            <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-[#E74425]/20 text-[#E74425] border border-[#E74425]/40 font-bold">
                              <span className="w-1 h-1 rounded-full bg-[#E74425]" />
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-neutral-400">
                          {isBusinessMode ? `Active: ${activeWorkspaceName || 'Business'}` : 'Switch or create business profiles'}
                        </span>
                      </div>
                    </div>
                    {isBusinessMode ? (
                      <div className="w-1.5 h-6 rounded-full bg-[#E74425] shadow-[0_0_8px_#E74425]" />
                    ) : (
                      <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenLedger();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl hover:bg-[#111F49] active:bg-[#111F49]/80 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#C67764]/15 text-[#E5CFB4] border border-[#C67764]/25 group-hover:scale-105 transition-transform">
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
                    onOpenSavings();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl hover:bg-[#111F49] active:bg-[#111F49]/80 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#E74425]/15 text-[#E74425] border border-[#E74425]/25 group-hover:scale-105 transition-transform">
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
                    onOpenCategories();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl hover:bg-[#111F49] active:bg-[#111F49]/80 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#C67764]/15 text-[#C67764] border border-[#C67764]/25 group-hover:scale-105 transition-transform">
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
                    onOpenSettings();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl hover:bg-[#111F49] active:bg-[#111F49]/80 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#E5CFB4]/15 text-[#E5CFB4] border border-[#E5CFB4]/25 group-hover:scale-105 transition-transform">
                      <Settings size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Settings</span>
                      <span className="text-[9px] text-neutral-400">Security, backups & system</span>
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
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl hover:bg-[#111F49] active:bg-[#111F49]/80 text-neutral-200 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
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
              <div className="p-4 border-t flex flex-col gap-2" style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
                <div className="flex items-center gap-2 text-neutral-400 text-[10px] font-mono">
                  <ShieldCheck size={14} className="text-[#E74425]" />
                  <span>100% Offline Encrypted</span>
                </div>
                <div id="app-version" className="text-[8px] text-neutral-500 font-mono">
                  {appVersion}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
