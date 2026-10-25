/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowLeft, Key, Shield, Trash2, Download, Upload, 
  ShieldCheck, Check, ShieldAlert, SlidersHorizontal, Lock, Unlock,
  AlertTriangle, RefreshCw, Clock, CheckCircle2
} from 'lucide-react';
import { AppSettings } from '../../../core/types';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { backupArchiveService, RestoreInspectionReport } from '../../../infrastructure/storage/BackupArchiveService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
  settings: AppSettings;
  onChangeSettings: (updates: Partial<AppSettings>) => void;
  onFactoryReset: () => void;
  onExportBackup: (passphrase?: string) => Promise<void> | void;
  onImportBackup: (jsonStr: string, passphrase?: string) => Promise<boolean | void> | void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  isInline = false,
  settings,
  onChangeSettings,
  onFactoryReset,
  onExportBackup,
  onImportBackup,
  themeCardBg,
  themeBorder,
  themeRadius
}: SettingsModalProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Export Dialog State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportWithPassword, setExportWithPassword] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState('');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Restore Inspection State
  const [rawUploadedBackup, setRawUploadedBackup] = useState<string | null>(null);
  const [inspectionReport, setInspectionReport] = useState<RestoreInspectionReport | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restorePassphraseError, setRestorePassphraseError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const content = reader.result as string;
      setRawUploadedBackup(content);
      setRestorePassphrase('');
      setRestorePassphraseError('');

      try {
        const report = await backupArchiveService.inspectBackup(content);
        setInspectionReport(report);
        triggerHapticFeedback();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Backup inspection failed.';
        setStatusMsg({ text: message, isError: true });
      }
    };
    reader.readAsText(file);
    // Reset file input so subsequent selection triggers onChange
    e.target.value = '';
  };

  const handleDecryptInspection = async () => {
    if (!rawUploadedBackup || !restorePassphrase) {
      setRestorePassphraseError('Please enter the backup passphrase.');
      return;
    }
    setRestorePassphraseError('');
    try {
      const report = await backupArchiveService.inspectBackup(rawUploadedBackup, restorePassphrase);
      if (!report.isValid) {
        setRestorePassphraseError(report.errors[0] || 'Decryption failed: incorrect passphrase.');
      } else {
        setInspectionReport(report);
        triggerHapticFeedback();
      }
    } catch (err: any) {
      setRestorePassphraseError(err.message || 'Decryption failed: incorrect passphrase.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!rawUploadedBackup) return;
    setIsRestoring(true);
    try {
      await onImportBackup(rawUploadedBackup, restorePassphrase || undefined);
      setStatusMsg({ text: 'Database and attachments restored successfully!' });
      triggerHapticFeedback();
      setInspectionReport(null);
      setRawUploadedBackup(null);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Restoration failed.', isError: true });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExecuteExport = async () => {
    if (exportWithPassword) {
      if (exportPassphrase.length < 4) {
        setExportError('Passphrase must be at least 4 characters long.');
        return;
      }
      if (exportPassphrase !== exportPassphraseConfirm) {
        setExportError('Passphrases do not match.');
        return;
      }
    }

    setIsExporting(true);
    setExportError('');

    try {
      await onExportBackup(exportWithPassword ? exportPassphrase : undefined);
      setShowExportModal(false);
      setExportPassphrase('');
      setExportPassphraseConfirm('');
      setStatusMsg({ text: 'Backup exported and verified successfully!' });
      triggerHapticFeedback();
    } catch (err: any) {
      setExportError(err.message || 'Failed to export backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSavePin = () => {
    if (pinInput.length !== 4 || isNaN(parseInt(pinInput))) {
      setPinError('PIN must be exactly 4 numeric digits.');
      return;
    }
    onChangeSettings({ pinCode: pinInput });
    setPinInput('');
    setPinError('');
    setShowPinDialog(false);
    setStatusMsg({ text: 'App lock PIN code updated successfully!' });
    triggerHapticFeedback();
  };

  const contentElement = (
    <div className={`w-full flex flex-col gap-3 select-none text-left ${isInline ? 'pb-6' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-center pb-2.5 border-b gap-3" style={{ borderColor: themeBorder }}>
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm"
          title="Back to Home"
        >
          <ArrowLeft size={14} className="text-emerald-400" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <SlidersHorizontal size={15} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white">System Settings</span>
            <span className="text-[9px] text-neutral-400">Security & Maintenance</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {statusMsg && (
        <div 
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-all ${
            statusMsg.isError 
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.isError ? <ShieldAlert size={15} /> : <Check size={15} />}
            <span>{statusMsg.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatusMsg(null)} 
            className="text-neutral-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Settings Body */}
      <div className="flex flex-col gap-3">
        {/* 1. App Lock & Security Status */}
        <div 
          className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius}`} 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: themeBorder }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Key size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-white">Application Security</span>
                <span className="text-[10px] text-neutral-400">PBKDF2 (100k rounds) & AES-256 Envelope</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPinDialog(true);
                triggerHapticFeedback();
              }}
              className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 active:bg-purple-500/40 border border-purple-500/35 text-purple-300 font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
            >
              {settings.isPinConfigured || settings.pinCode ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15 flex items-start gap-2 text-[10px] text-neutral-300">
            <ShieldCheck size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>SQLCipher Database Protection:</strong> Your PIN derives a master key encryption key. Raw PINs are never stored in plaintext. If the PIN is lost, local encrypted data cannot be recovered.
            </span>
          </div>
        </div>

        {/* 2. Versioned Database Backup & Restore Operations */}
        <div 
          className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius}`} 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: themeBorder }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                <Shield size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-white">Backup & Restore</span>
                <span className="text-[10px] text-neutral-400">Integrity-checked, versioned snapshots</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                settings.lastBackupStatus === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {settings.lastBackupStatus === 'success' ? 'Protected' : 'Needs Backup'}
              </span>
            </div>
          </div>

          {/* Last Backup Timestamp info */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-neutral-500" />
              <span>Last Backup:</span>
            </div>
            <span className="font-mono text-neutral-300">
              {settings.lastBackupTimestamp
                ? new Date(settings.lastBackupTimestamp).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : 'Never'}
            </span>
          </div>

          {/* Critical Security Warning */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[10px] text-amber-200">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Disaster Recovery Advisory:</strong> Local backups stored only on this phone do not protect against loss, theft, or hardware failure. Always export an encrypted backup to external storage.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setShowExportModal(true);
              }}
              className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white transition-all active:scale-95 shadow-sm"
            >
              <Download size={14} className="text-teal-400" />
              <span>Export Backup</span>
            </button>

            <label className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-center text-white transition-all active:scale-95 shadow-sm">
              <Upload size={14} className="text-teal-400" />
              <span>Restore Backup</span>
              <input type="file" accept=".json" onChange={handleBackupUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* 3. Secure Factory Reset */}
        <div 
          className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`} 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: themeBorder }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Trash2 size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">Erase Workspace Data</span>
              <span className="text-[10px] text-neutral-400">Factory reset all local storages</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResetConfirm(true);
              triggerHapticFeedback();
            }}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 border border-rose-500/35 text-rose-300 font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
          >
            Factory Reset
          </button>
        </div>
      </div>

      {/* EXPORT OPTIONS MODAL */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-left shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Download size={18} className="text-teal-400" />
                  <span className="text-sm font-bold text-white">Export Database Backup</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {exportError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {exportError}
                </div>
              )}

              {/* Encryption Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  {exportWithPassword ? (
                    <Lock size={16} className="text-teal-400" />
                  ) : (
                    <Unlock size={16} className="text-neutral-400" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Password Protection (AES-256-GCM)</span>
                    <span className="text-[10px] text-neutral-400">Derives key via PBKDF2 (100k rounds)</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={exportWithPassword}
                  onChange={(e) => {
                    setExportWithPassword(e.target.checked);
                    setExportError('');
                  }}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400"
                />
              </div>

              {exportWithPassword && (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-300">Set Passphrase (Min 4 chars)</label>
                    <input
                      type="password"
                      placeholder="Enter strong passphrase"
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      className="bg-neutral-800 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-300">Confirm Passphrase</label>
                    <input
                      type="password"
                      placeholder="Re-enter passphrase"
                      value={exportPassphraseConfirm}
                      onChange={(e) => setExportPassphraseConfirm(e.target.value)}
                      className="bg-neutral-800 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-200">
                    If this passphrase is lost, the exported file cannot be decrypted by anyone.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 cursor-pointer transition-all active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExecuteExport}
                  className="py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-teal-500/25 transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                >
                  {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{isExporting ? 'Exporting...' : 'Export Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESTORE INSPECTION & CONFIRMATION MODAL */}
      <AnimatePresence>
        {inspectionReport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-left shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-teal-400" />
                  <span className="text-sm font-bold text-white">Restore Pre-Flight Inspection</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectionReport(null);
                    setRawUploadedBackup(null);
                  }}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* If password required */}
              {inspectionReport.needsPassphrase ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200">
                    This backup is encrypted with <strong>AES-256-GCM</strong>. Enter the passphrase used during export to decrypt and verify the contents.
                  </div>

                  {restorePassphraseError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                      {restorePassphraseError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-neutral-300">Decryption Passphrase</label>
                    <input
                      type="password"
                      placeholder="Enter passphrase"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      className="bg-neutral-800 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400"
                      autoFocus
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDecryptInspection}
                    className="py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 text-center mt-1"
                  >
                    Unlock & Verify Backup
                  </button>
                </div>
              ) : (
                /* Valid Decrypted Preview Summary */
                <div className="flex flex-col gap-3">
                  {inspectionReport.errors.length > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Pre-Flight Validation Errors:</span>
                      </div>
                      {inspectionReport.errors.map((e, idx) => (
                        <span key={idx}>• {e}</span>
                      ))}
                    </div>
                  )}

                  {inspectionReport.warnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] flex flex-col gap-0.5">
                      {inspectionReport.warnings.map((w, idx) => (
                        <span key={idx}>⚠️ {w}</span>
                      ))}
                    </div>
                  )}

                  {/* Metadata Table */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-neutral-400">Format & Schema Version:</span>
                      <span className="font-mono text-white font-bold">
                        v{inspectionReport.formatVersion} (Schema {inspectionReport.schemaVersion})
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-neutral-400">Created At:</span>
                      <span className="font-mono text-neutral-300">
                        {inspectionReport.createdAt ? new Date(inspectionReport.createdAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-neutral-400">Base Currency:</span>
                      <span className="font-mono text-white font-bold">{inspectionReport.currencyCode}</span>
                    </div>

                    {/* Record Counts */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded-xl bg-white/5 flex justify-between">
                        <span className="text-neutral-400">Transactions:</span>
                        <span className="font-mono text-teal-300 font-bold">{inspectionReport.recordCounts.transactions || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 flex justify-between">
                        <span className="text-neutral-400">Accounts/Wallets:</span>
                        <span className="font-mono text-teal-300 font-bold">{inspectionReport.recordCounts.wallets || inspectionReport.recordCounts.accounts || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 flex justify-between">
                        <span className="text-neutral-400">Journals:</span>
                        <span className="font-mono text-teal-300 font-bold">{inspectionReport.recordCounts.journal_entries || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 flex justify-between">
                        <span className="text-neutral-400">Attachments:</span>
                        <span className="font-mono text-teal-300 font-bold">{inspectionReport.attachmentCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Safety Rollback Notice */}
                  <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-200 leading-relaxed">
                    <CheckCircle2 size={14} className="inline mr-1 text-teal-400" />
                    <strong>Atomic Safety Guarantee:</strong> A full safety rollback snapshot of your existing database will be taken immediately before restore. If any constraint or table fails, the prior database will be restored untouched.
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectionReport(null);
                        setRawUploadedBackup(null);
                      }}
                      className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 cursor-pointer transition-all active:scale-95 text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!inspectionReport.isValid || isRestoring}
                      onClick={handleConfirmRestore}
                      className="py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-teal-500/25 transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                    >
                      {isRestoring ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>{isRestoring ? 'Restoring...' : 'Confirm & Restore'}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FACTORY RESET CONFIRM OVERLAY */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-center shadow-2xl"
            >
              <Trash2 size={40} className="text-rose-500 mx-auto animate-bounce" />
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold text-white">Erase Secure Database?</span>
                <span className="text-xs text-neutral-400 leading-relaxed">
                  This action is irreversible. All local transactions, categories, budgets, and settings will be permanently wiped.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onFactoryReset();
                    setShowResetConfirm(false);
                    triggerHapticFeedback();
                    onClose();
                  }}
                  className="py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-rose-500/25 transition-all active:scale-95"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APP LOCK PIN SETTING DIALOG */}
      <AnimatePresence>
        {showPinDialog && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] flex flex-col gap-4 text-center shadow-2xl"
            >
              <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 w-12 h-12 flex items-center justify-center mx-auto">
                <Key size={24} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-base font-bold text-white">Configure App Lock PIN</span>
                <span className="text-xs text-neutral-400">Enter a 4-digit security PIN passcode</span>
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {pinError}
                </div>
              )}

              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                className="bg-neutral-800 border border-white/15 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white mx-auto w-44 outline-none focus:border-purple-400"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError('');
                    setShowPinDialog(false);
                  }}
                  className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-purple-500/25 transition-all active:scale-95"
                >
                  Save PIN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isInline) {
    return contentElement;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md max-h-[88vh] overflow-y-auto p-5 border shadow-2xl relative"
        style={{
          backgroundColor: themeCardBg,
          borderColor: themeBorder,
          borderRadius: '24px'
        }}
      >
        {contentElement}
      </motion.div>
    </div>
  );
}
