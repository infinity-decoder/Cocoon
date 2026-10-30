/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Database, Download, Upload, FileText, FileSpreadsheet, Trash2 } from 'lucide-react';
import { InAppNotification } from '../../../core/types';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface NotificationsModalProps {
  isOpen: boolean;
  notifications: InAppNotification[];
  theme: AppTheme;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export default function NotificationsModal({
  isOpen,
  notifications,
  theme,
  onClose,
  onMarkAllRead,
  onClearAll
}: NotificationsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99] overflow-hidden flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 backdrop-blur-sm cursor-pointer"
          style={{ backgroundColor: theme.overlay }}
        />

        {/* Panel Content */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl z-10 flex flex-col max-h-[480px] overflow-hidden select-none text-left transition-colors"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3.5 border-b" style={{ borderColor: theme.borderSubtle }}>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase font-mono tracking-widest" style={{ color: theme.primary }}>
                Vault Messages
              </span>
              <span className="text-[10px] font-mono mt-0.5" style={{ color: theme.textSecondary }}>
                Secure offline ledger logs
              </span>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ color: theme.textSecondary, backgroundColor: theme.surfaceMuted }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-none">
            {notifications.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center gap-2">
                <div 
                  className="p-3 rounded-full border"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle, color: theme.textMuted }}
                >
                  <Bell size={24} className="opacity-60" />
                </div>
                <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>All Quiet Here</span>
                <span className="text-[10px] leading-normal max-w-[200px]" style={{ color: theme.textSecondary }}>
                  Notifications about offline backups, restores, and printable exports will appear here.
                </span>
              </div>
            ) : (
              notifications.map(notif => {
                let IconComponent = Database;
                let iconColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                if (notif.type === 'backup_export') {
                  IconComponent = Download;
                  iconColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                } else if (notif.type === 'backup_import') {
                  IconComponent = Upload;
                  iconColor = 'text-teal-400 bg-teal-500/10 border-teal-500/20';
                } else if (notif.type === 'pdf_export') {
                  IconComponent = FileText;
                  iconColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                } else if (notif.type === 'excel_export') {
                  IconComponent = FileSpreadsheet;
                  iconColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                }

                return (
                  <div 
                    key={notif.id}
                    className={`p-3 rounded-2xl border flex gap-3 transition-all ${
                      notif.unread ? 'shadow-sm' : 'opacity-80'
                    }`}
                    style={{
                      borderColor: theme.borderSubtle,
                      backgroundColor: notif.unread ? theme.surfaceMuted : 'transparent'
                    }}
                  >
                    <div className={`p-2 rounded-xl border flex-shrink-0 h-9 w-9 flex items-center justify-center ${iconColor}`}>
                      <IconComponent size={16} />
                    </div>
                    <div className="flex flex-col text-left flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>{notif.title}</span>
                        <span className="text-[9px] font-mono whitespace-nowrap" style={{ color: theme.textMuted }}>{notif.timestamp}</span>
                      </div>
                      <span className="text-[10px] leading-relaxed mt-0.5" style={{ color: theme.textSecondary }}>{notif.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls */}
          {notifications.length > 0 && (
            <div className="pt-3 border-t flex justify-between gap-3 mt-1" style={{ borderColor: theme.borderSubtle }}>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onMarkAllRead();
                }}
                className="flex-1 py-2 px-3 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                Mark all read
              </button>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onClearAll();
                }}
                className="py-2 px-3 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border flex items-center gap-1.5"
                style={{
                  backgroundColor: theme.dangerBg,
                  borderColor: `${theme.danger}35`,
                  color: theme.danger
                }}
              >
                <Trash2 size={12} />
                Clear all
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

