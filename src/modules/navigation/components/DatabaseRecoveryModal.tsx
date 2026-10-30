/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, RefreshCw, FileText, CheckCircle2, X } from 'lucide-react';
import { DatabaseErrorState, DatabaseHealthDiagnostic, databaseService } from '../../../infrastructure/database/DatabaseService';

interface DatabaseRecoveryModalProps {
  errorState: DatabaseErrorState;
  onRetry: () => Promise<void>;
  theme: any;
}

export function DatabaseRecoveryModal({ errorState, onRetry, theme }: DatabaseRecoveryModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DatabaseHealthDiagnostic | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  if (!errorState.hasError) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // Retained in error state
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRunDiagnostic = async () => {
    const diag = await databaseService.checkHealth();
    setDiagnostic(diag);
    setShowDiagnostic(true);
  };

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ backgroundColor: theme?.overlay || 'rgba(0,0,0,0.8)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-colors text-left"
        style={{
          backgroundColor: theme?.surfaceElevated || theme?.cardBg || '#181E29',
          borderColor: 'rgba(239, 68, 68, 0.4)',
          color: theme?.textPrimary || '#FFFFFF'
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: theme?.textPrimary || '#FFFFFF' }}>Database Safety Mode</h2>
            <p className="text-xs" style={{ color: theme?.textSecondary || '#A1A1AA' }}>Zero-loss protection active</p>
          </div>
        </div>

        <p className="text-xs leading-relaxed mb-4" style={{ color: theme?.textSecondary || '#D4D4D8' }}>
          Cocoon encountered an issue opening the local SQLite database. To guarantee zero data loss, your
          persisted financial records have <strong className="font-semibold" style={{ color: theme?.primary || '#10B981' }}>not</strong> been
          cleared or replaced.
        </p>

        {errorState.message && (
          <div 
            className="p-3 rounded-xl border text-[11px] text-rose-400 font-mono mb-4 break-words max-h-24 overflow-y-auto"
            style={{
              backgroundColor: theme?.surfaceMuted || 'rgba(0,0,0,0.2)',
              borderColor: 'rgba(239, 68, 68, 0.2)'
            }}
          >
            {errorState.message}
          </div>
        )}

        {/* SANITIZED DIAGNOSTIC EXPANDER */}
        <AnimatePresence>
          {showDiagnostic && diagnostic && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-3 mb-4 rounded-xl border text-[11px] space-y-1.5 font-mono overflow-hidden"
              style={{
                backgroundColor: theme?.surfaceMuted || 'rgba(0,0,0,0.2)',
                borderColor: theme?.borderSubtle || 'rgba(255,255,255,0.1)'
              }}
            >
              <div className="flex justify-between items-center" style={{ color: theme?.textSecondary }}>
                <span>Integrity Check:</span>
                <span className={diagnostic.integrityCheckPassed ? 'text-emerald-400' : 'text-rose-400'}>
                  {diagnostic.integrityCheckPassed ? 'Passed (OK)' : 'Failed'}
                </span>
              </div>
              <div className="flex justify-between items-center" style={{ color: theme?.textSecondary }}>
                <span>Foreign Keys:</span>
                <span style={{ color: theme?.textPrimary }}>{diagnostic.foreignKeysEnforced ? 'Enforced' : 'Off'}</span>
              </div>
              <div className="flex justify-between items-center" style={{ color: theme?.textSecondary }}>
                <span>Journal Mode:</span>
                <span style={{ color: theme?.textPrimary }}>{diagnostic.journalMode}</span>
              </div>
              <div className="flex justify-between items-center" style={{ color: theme?.textSecondary }}>
                <span>Applied Migrations:</span>
                <span style={{ color: theme?.primary || '#10B981' }}>{diagnostic.appliedMigrationsCount} (v{diagnostic.latestMigrationVersion})</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3 px-4 rounded-2xl active:scale-[0.98] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            style={{
              backgroundColor: theme?.primary || '#10B981',
              color: theme?.textOnPrimary || '#FFFFFF'
            }}
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'Re-attempting connection...' : 'Retry Connection'}</span>
          </button>

          <button
            onClick={handleRunDiagnostic}
            type="button"
            className="w-full py-2.5 px-4 rounded-2xl font-medium text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer"
            style={{
              backgroundColor: theme?.surfaceMuted,
              borderColor: theme?.borderSubtle,
              color: theme?.textPrimary
            }}
          >
            <FileText size={14} />
            <span>{showDiagnostic ? 'Refresh Health Diagnostic' : 'View Health Diagnostics'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

