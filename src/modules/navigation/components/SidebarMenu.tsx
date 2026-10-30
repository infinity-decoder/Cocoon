/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Tag, ShieldCheck, HelpCircle, 
  ChevronRight, ClipboardList, Vault, Settings, Building2, Sparkles
} from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';
import AboutAuthorModal from './AboutAuthorModal';

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
  activeThemeId?: string;
  themeCardBg?: string;
  themeBorder?: string;
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
  isBusinessMode
}: SidebarMenuProps) {
  const { theme } = useTheme();
  const [showAboutAuthor, setShowAboutAuthor] = useState(false);
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
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ backgroundColor: theme.overlay }}
          />

          {/* Sliding Panel Content */}
          <div className="absolute inset-y-0 right-0 max-w-[280px] w-full flex">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              className="h-full w-full shadow-2xl flex flex-col justify-between border-l select-none text-left"
              style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b flex justify-between items-center" style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary, boxShadow: `0 0 6px ${theme.primary}` }} />
                    <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: theme.primary }}>Cocoon Navigation</span>
                  </div>
                  <span className="text-base font-black tracking-tight mt-1" style={{ color: theme.textPrimary }}>Control Menu</span>
                </div>
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                  }}
                  className="p-2 min-h-[44px] min-w-[44px] rounded-xl cursor-pointer transition-colors flex items-center justify-center active:scale-95"
                  style={{ backgroundColor: theme.surfaceMuted, color: theme.textSecondary }}
                  title="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none" style={{ backgroundColor: theme.background }}>
                {/* Manage Business Workspace entry */}
                {onOpenBusinessManagement && (
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      onClose();
                      onOpenBusinessManagement();
                    }}
                    className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                    style={{
                      backgroundColor: isBusinessMode ? `${theme.primary}18` : theme.surfaceMuted,
                      borderColor: isBusinessMode ? `${theme.primary}40` : theme.borderSubtle,
                      color: isBusinessMode ? theme.primary : theme.textPrimary
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: `${theme.primary}20`,
                          borderColor: `${theme.primary}30`,
                          color: theme.primary
                        }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Manage Business</span>
                          {isBusinessMode && (
                            <span 
                              className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full border font-bold"
                              style={{
                                backgroundColor: `${theme.primary}20`,
                                borderColor: `${theme.primary}40`,
                                color: theme.primary
                              }}
                            >
                              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.primary }} />
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[9px]" style={{ color: theme.textSecondary }}>
                          {isBusinessMode ? `Active: ${activeWorkspaceName || 'Business'}` : 'Switch or create business profiles'}
                        </span>
                      </div>
                    </div>
                    {isBusinessMode ? (
                      <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: theme.primary, boxShadow: `0 0 8px ${theme.primary}` }} />
                    ) : (
                      <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenLedger();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${theme.secondary || theme.primary}20`,
                        borderColor: `${theme.secondary || theme.primary}30`,
                        color: theme.secondary || theme.primary
                      }}
                    >
                      <ClipboardList size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Ledger Book</span>
                      <span className="text-[9px]" style={{ color: theme.textSecondary }}>View transactions & filters</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenSavings();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${theme.primary}20`,
                        borderColor: `${theme.primary}30`,
                        color: theme.primary
                      }}
                    >
                      <Vault size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Savings Vault</span>
                      <span className="text-[9px]" style={{ color: theme.textSecondary }}>Locked goal targets & piggybank</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenCategories();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${theme.secondary || theme.primary}20`,
                        borderColor: `${theme.secondary || theme.primary}30`,
                        color: theme.secondary || theme.primary
                      }}
                    >
                      <Tag size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Custom Categories</span>
                      <span className="text-[9px]" style={{ color: theme.textSecondary }}>Icons, tags & palette colors</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenSettings();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${theme.primary}20`,
                        borderColor: `${theme.primary}30`,
                        color: theme.primary
                      }}
                    >
                      <Settings size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Settings</span>
                      <span className="text-[9px]" style={{ color: theme.textSecondary }}>Security, backups & system</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onClose();
                    onOpenHelp();
                  }}
                  className="w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group border active:scale-98"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${theme.primary}20`,
                        borderColor: `${theme.primary}30`,
                        color: theme.primary
                      }}
                    >
                      <HelpCircle size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>FAQ & Guide</span>
                      <span className="text-[9px]" style={{ color: theme.textSecondary }}>Local-first privacy guide</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Sidebar Footer */}
              <div 
                className="p-4 border-t flex flex-col gap-2.5 transition-colors" 
                style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }}
              >
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center p-1 bg-white shadow-sm"
                    style={{ borderColor: `${theme.primary}40` }}
                  >
                    <img 
                      src="/assets/aistudio/infinity_logo_v_01_599892f8.png" 
                      alt="INFINITY DECODER" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[10px] font-medium" style={{ color: theme.textSecondary }}>
                      Developed with <span className="text-red-500 animate-pulse inline-block">❤️</span> by
                    </span>
                    <span className="text-xs font-black tracking-tight" style={{ color: theme.primary }}>
                      INFINITY DECODER
                    </span>
                  </div>
                </div>

                {/* About Author trigger */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowAboutAuthor(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer group active:scale-98 shadow-sm hover:translate-x-0.5"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary
                  }}
                >
                  <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide">
                    <Sparkles size={14} style={{ color: theme.primary }} />
                    About Author
                  </span>
                  <ChevronRight size={14} style={{ color: theme.textSecondary }} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Glassy About Author Modal */}
          <AboutAuthorModal
            isOpen={showAboutAuthor}
            onClose={() => setShowAboutAuthor(false)}
            theme={theme}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
