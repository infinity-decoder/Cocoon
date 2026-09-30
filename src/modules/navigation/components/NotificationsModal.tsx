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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Panel Content */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl z-10 flex flex-col max-h-[480px] overflow-hidden select-none text-left"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3.5 border-b" style={{ borderColor: theme.border }}>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase text-emerald-400 font-mono tracking-widest">Vault Messages</span>
              <span className="text-[10px] text-neutral-400 font-mono mt-0.5">Secure offline ledger logs</span>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-none">
            {notifications.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-white/3 rounded-full text-neutral-500 border border-white/5">
                  <Bell size={24} className="opacity-40" />
                </div>
                <span className="text-xs font-bold text-neutral-400">All Quiet Here</span>
                <span className="text-[10px] text-neutral-500 leading-normal max-w-[200px]">
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
                      notif.unread ? 'bg-white/[0.04]' : 'bg-transparent opacity-75'
                    }`}
                    style={{ borderColor: theme.border }}
                  >
                    <div className={`p-2 rounded-xl border flex-shrink-0 h-9 w-9 flex items-center justify-center ${iconColor}`}>
                      <IconComponent size={16} />
                    </div>
                    <div className="flex flex-col text-left flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-xs font-bold text-neutral-200 truncate">{notif.title}</span>
                        <span className="text-[9px] font-mono text-neutral-500 whitespace-nowrap">{notif.timestamp}</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-relaxed mt-0.5">{notif.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls */}
          {notifications.length > 0 && (
            <div className="pt-3 border-t flex justify-between gap-3 mt-1" style={{ borderColor: theme.border }}>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onMarkAllRead();
                }}
                className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border border-white/5"
              >
                Mark all read
              </button>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onClearAll();
                }}
                className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border border-rose-500/20 flex items-center gap-1.5"
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
