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
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border"
        style={{
          backgroundColor: theme?.surface || '#181E29',
          borderColor: 'rgba(239, 68, 68, 0.4)'
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-100">Database Safety Mode</h2>
            <p className="text-xs text-neutral-400">Zero-loss protection active</p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed mb-4">
          Cocoon encountered an issue opening the local SQLite database. To guarantee zero data loss, your
          persisted financial records have <strong className="text-emerald-400 font-semibold">not</strong> been
          cleared or replaced.
        </p>

        {errorState.message && (
          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-[11px] text-rose-300 font-mono mb-4 break-words max-h-24 overflow-y-auto">
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
              className="p-3 mb-4 rounded-xl bg-neutral-900 border border-neutral-700/60 text-[11px] space-y-1.5 font-mono overflow-hidden"
            >
              <div className="flex justify-between items-center text-neutral-400">
                <span>Integrity Check:</span>
                <span className={diagnostic.integrityCheckPassed ? 'text-emerald-400' : 'text-rose-400'}>
                  {diagnostic.integrityCheckPassed ? 'Passed (OK)' : 'Failed'}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>Foreign Keys:</span>
                <span className="text-neutral-200">{diagnostic.foreignKeysEnforced ? 'Enforced' : 'Off'}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>Journal Mode:</span>
                <span className="text-neutral-200">{diagnostic.journalMode}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>Applied Migrations:</span>
                <span className="text-emerald-400">{diagnostic.appliedMigrationsCount} (v{diagnostic.latestMigrationVersion})</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'Re-attempting connection...' : 'Retry Connection'}</span>
          </button>

          <button
            onClick={handleRunDiagnostic}
            type="button"
            className="w-full py-2.5 px-4 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 font-medium text-xs flex items-center justify-center gap-2 border border-neutral-700/60 transition-all cursor-pointer"
          >
            <FileText size={14} />
            <span>{showDiagnostic ? 'Refresh Health Diagnostic' : 'View Health Diagnostics'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
