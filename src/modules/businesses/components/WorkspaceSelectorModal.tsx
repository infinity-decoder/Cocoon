/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Briefcase, Plus, Check, Archive, 
  RefreshCw, Building2, User, ChevronRight 
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { WorkspaceWithProfile } from '../../../application/services/WorkspaceService';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from '../../../infrastructure/database/migrations/002_business_workspaces_ledger_parties';

interface WorkspaceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: WorkspaceWithProfile[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenCreateBusiness: () => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
  onUnarchiveWorkspace?: (workspaceId: string) => void;
  theme: AppTheme;
}

export function WorkspaceSelectorModal({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCreateBusiness,
  onArchiveWorkspace,
  onUnarchiveWorkspace,
  theme
}: WorkspaceSelectorModalProps) {
  if (!isOpen) return null;

  const personalWorkspace = workspaces.find(w => w.type === 'personal') || {
    id: DEFAULT_PERSONAL_WORKSPACE_ID,
    name: 'Personal Workspace',
    type: 'personal',
    currencyCode: 'PKR',
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };

  const businessWorkspaces = workspaces.filter(w => w.type === 'business');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 backdrop-blur-sm cursor-pointer"
          style={{ backgroundColor: theme.overlay }}
        />

        {/* Modal Sheet / Dialog */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md max-h-[85vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-5 overflow-hidden z-10"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.borderSubtle }}>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: theme.primary }}>
                Isolated Environments
              </span>
              <h2 className="text-lg font-black mt-0.5 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                <Briefcase size={18} style={{ color: theme.primary }} />
                Workspaces
              </h2>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-2 rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: theme.surfaceMuted, color: theme.textPrimary }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {/* 1. PERSONAL WORKSPACE CARD */}
            <div className="space-y-1.5 text-left">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: theme.textMuted }}>
                Personal Finance
              </span>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onSelectWorkspace(personalWorkspace.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  activeWorkspaceId === personalWorkspace.id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'hover:opacity-90'
                }`}
                style={activeWorkspaceId === personalWorkspace.id ? undefined : { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <User size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold flex items-center gap-2" style={{ color: theme.textPrimary }}>
                      {personalWorkspace.name}
                      {activeWorkspaceId === personalWorkspace.id && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </span>
                    <span className="text-xs" style={{ color: theme.textSecondary }}>
                      Personal income, expenses, wallets & vault
                    </span>
                  </div>
                </div>
                {activeWorkspaceId === personalWorkspace.id ? (
                  <Check size={18} className="text-emerald-400" />
                ) : (
                  <ChevronRight size={16} style={{ color: theme.textMuted }} />
                )}
              </button>
            </div>

            {/* 2. BUSINESS WORKSPACES LIST */}
            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: theme.textMuted }}>
                  Business Profiles ({businessWorkspaces.length})
                </span>
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onOpenCreateBusiness();
                  }}
                  className="text-xs font-bold flex items-center gap-1 cursor-pointer"
                  style={{ color: theme.primary }}
                >
                  <Plus size={14} /> New Business
                </button>
              </div>

              {businessWorkspaces.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed text-center flex flex-col items-center gap-2" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.surfaceMuted }}>
                  <Building2 size={24} style={{ color: theme.textMuted }} />
                  <span className="text-xs" style={{ color: theme.textSecondary }}>No business workspaces created yet.</span>
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      onOpenCreateBusiness();
                    }}
                    className="mt-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    Create First Business
                  </button>
                </div>
              ) : (
                businessWorkspaces.map(biz => {
                  const isActive = activeWorkspaceId === biz.id;
                  const isArchived = !biz.isActive;

                  return (
                    <div
                      key={biz.id}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : isArchived
                          ? 'opacity-60'
                          : 'hover:opacity-90'
                      }`}
                      style={isActive ? undefined : { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
                    >
                      <button
                        onClick={() => {
                          triggerHapticFeedback();
                          onSelectWorkspace(biz.id);
                          onClose();
                        }}
                        className="flex-1 flex items-center gap-3 cursor-pointer text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          <Building2 size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold flex items-center gap-2" style={{ color: theme.textPrimary }}>
                            {biz.name}
                            {isActive && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            )}
                            {isArchived && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Archived
                              </span>
                            )}
                          </span>
                          <span className="text-xs flex items-center gap-2" style={{ color: theme.textSecondary }}>
                            <span className="capitalize">{biz.profile?.businessType || 'General'}</span>
                            <span>·</span>
                            <span>{biz.currencyCode}</span>
                            {biz.taxId && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-[10px]">{biz.taxId}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 pl-2">
                        {onArchiveWorkspace && !isArchived && (
                          <button
                            title="Archive Business"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHapticFeedback();
                              if (confirm(`Archive ${biz.name}? Financial records and invoices will remain safely preserved.`)) {
                                onArchiveWorkspace(biz.id);
                              }
                            }}
                            className="p-1.5 rounded-lg border text-neutral-400 hover:text-amber-400 cursor-pointer"
                            style={{ backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }}
                          >
                            <Archive size={14} />
                          </button>
                        )}
                        {onUnarchiveWorkspace && isArchived && (
                          <button
                            title="Unarchive Business"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHapticFeedback();
                              onUnarchiveWorkspace(biz.id);
                            }}
                            className="p-1.5 rounded-lg border text-neutral-400 hover:text-emerald-400 cursor-pointer"
                            style={{ backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }}
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        {isActive && <Check size={18} className="text-emerald-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t flex flex-col gap-2" style={{ borderColor: theme.borderSubtle }}>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onOpenCreateBusiness();
              }}
              className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus size={18} />
              Create Business Workspace
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
