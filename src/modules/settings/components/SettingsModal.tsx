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
import { useTheme } from '../../../core/theme';

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
  const { theme } = useTheme();
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
      <div className="flex justify-between items-center pb-2.5 border-b gap-3" style={{ borderColor: theme.borderSubtle }}>
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.borderSubtle,
            color: theme.textPrimary
          }}
          title="Back to Home"
        >
          <ArrowLeft size={14} style={{ color: theme.primary }} />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <div 
            className="p-1.5 rounded-xl border"
            style={{
              backgroundColor: `${theme.primary}18`,
              borderColor: `${theme.primary}35`,
              color: theme.primary
            }}
          >
            <SlidersHorizontal size={15} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>System Settings</span>
            <span className="text-[9px]" style={{ color: theme.textSecondary }}>Security & Maintenance</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="p-1.5 rounded-xl transition-all cursor-pointer"
          style={{
            backgroundColor: theme.surfaceMuted,
            color: theme.textSecondary
          }}
        >
          <X size={16} />
        </button>
      </div>

      {statusMsg && (
        <div 
          className="p-3 rounded-2xl border text-xs flex items-center justify-between transition-all"
          style={{
            backgroundColor: statusMsg.isError ? theme.dangerBg : theme.successBg,
            borderColor: statusMsg.isError ? `${theme.danger}40` : `${theme.success}40`,
            color: statusMsg.isError ? theme.danger : theme.success
          }}
        >
          <div className="flex items-center gap-2">
            {statusMsg.isError ? <ShieldAlert size={15} /> : <Check size={15} />}
            <span>{statusMsg.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatusMsg(null)} 
            className="text-xs font-bold px-1 cursor-pointer"
            style={{ color: theme.textSecondary }}
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
          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 border rounded-xl"
                style={{
                  backgroundColor: `${theme.primary}18`,
                  borderColor: `${theme.primary}35`,
                  color: theme.primary
                }}
              >
                <Key size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Application Security</span>
                <span className="text-[10px]" style={{ color: theme.textSecondary }}>PBKDF2 (100k rounds) & AES-256 Envelope</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPinDialog(true);
                triggerHapticFeedback();
              }}
              className="px-3 py-1.5 border font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: `${theme.primary}20`,
                borderColor: `${theme.primary}40`,
                color: theme.primary
              }}
            >
              {settings.isPinConfigured || settings.pinCode ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>

          <div 
            className="p-2.5 rounded-xl border flex items-start gap-2 text-[10px]"
            style={{
              backgroundColor: theme.inputBg,
              borderColor: theme.borderSubtle,
              color: theme.textSecondary
            }}
          >
            <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: theme.primary }} />
            <span>
              <strong>SQLCipher Database Protection:</strong> Your PIN derives a master key encryption key. Raw PINs are never stored in plaintext. If the PIN is lost, local encrypted data cannot be recovered.
            </span>
          </div>
        </div>

        {/* 2. Versioned Database Backup & Restore Operations */}
        <div 
          className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius}`} 
          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 border rounded-xl"
                style={{
                  backgroundColor: `${theme.primary}18`,
                  borderColor: `${theme.primary}35`,
                  color: theme.primary
                }}
              >
                <Shield size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Backup & Restore</span>
                <span className="text-[10px]" style={{ color: theme.textSecondary }}>Integrity-checked, versioned snapshots</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span 
                className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
                style={{
                  backgroundColor: settings.lastBackupStatus === 'success' ? theme.successBg : theme.warningBg,
                  borderColor: settings.lastBackupStatus === 'success' ? `${theme.success}40` : `${theme.warning}40`,
                  color: settings.lastBackupStatus === 'success' ? theme.success : theme.warning
                }}
              >
                {settings.lastBackupStatus === 'success' ? 'Protected' : 'Needs Backup'}
              </span>
            </div>
          </div>

          {/* Last Backup Timestamp info */}
          <div className="flex items-center justify-between text-[11px] px-1" style={{ color: theme.textSecondary }}>
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: theme.textMuted }} />
              <span>Last Backup:</span>
            </div>
            <span className="font-mono font-medium" style={{ color: theme.textPrimary }}>
              {settings.lastBackupTimestamp
                ? new Date(settings.lastBackupTimestamp).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : 'Never'}
            </span>
          </div>

          {/* Critical Security Warning */}
          <div 
            className="p-2.5 rounded-xl border flex items-start gap-2 text-[10px]"
            style={{
              backgroundColor: theme.warningBg,
              borderColor: `${theme.warning}35`,
              color: theme.textPrimary
            }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: theme.warning }} />
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
              className="py-2.5 px-3 border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <Download size={14} style={{ color: theme.primary }} />
              <span>Export Backup</span>
            </button>

            <label 
              className="py-2.5 px-3 border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-center transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <Upload size={14} style={{ color: theme.primary }} />
              <span>Restore Backup</span>
              <input type="file" accept=".json" onChange={handleBackupUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* 3. Secure Factory Reset */}
        <div 
          className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`} 
          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 border rounded-xl"
              style={{
                backgroundColor: theme.dangerBg,
                borderColor: `${theme.danger}35`,
                color: theme.danger
              }}
            >
              <Trash2 size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Erase Workspace Data</span>
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>Factory reset all local storages</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResetConfirm(true);
              triggerHapticFeedback();
            }}
            className="px-3.5 py-2 border font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
            style={{
              backgroundColor: theme.dangerBg,
              borderColor: `${theme.danger}40`,
              color: theme.danger
            }}
          >
            Factory Reset
          </button>
        </div>
      </div>

      {/* EXPORT OPTIONS MODAL */}
      <AnimatePresence>
        {showExportModal && (
          <div 
            className="fixed inset-0 backdrop-blur-sm z-[95] flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <div className="flex items-center gap-2">
                  <Download size={18} style={{ color: theme.primary }} />
                  <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Export Database Backup</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1 rounded-lg cursor-pointer transition-colors"
                  style={{ color: theme.textSecondary }}
                >
                  <X size={16} />
                </button>
              </div>

              {exportError && (
                <div 
                  className="p-2.5 rounded-xl border text-xs"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  {exportError}
                </div>
              )}

              {/* Encryption Toggle */}
              <div 
                className="flex items-center justify-between p-3 rounded-xl border transition-colors"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle
                }}
              >
                <div className="flex items-center gap-2.5">
                  {exportWithPassword ? (
                    <Lock size={16} style={{ color: theme.primary }} />
                  ) : (
                    <Unlock size={16} style={{ color: theme.textSecondary }} />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Password Protection (AES-256-GCM)</span>
                    <span className="text-[10px]" style={{ color: theme.textSecondary }}>Derives key via PBKDF2 (100k rounds)</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={exportWithPassword}
                  onChange={(e) => {
                    setExportWithPassword(e.target.checked);
                    setExportError('');
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>

              {exportWithPassword && (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold" style={{ color: theme.textSecondary }}>Set Passphrase (Min 4 chars)</label>
                    <input
                      type="password"
                      placeholder="Enter strong passphrase"
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      className="border rounded-xl px-3 py-2 text-xs outline-none transition-colors"
                      style={{
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold" style={{ color: theme.textSecondary }}>Confirm Passphrase</label>
                    <input
                      type="password"
                      placeholder="Re-enter passphrase"
                      value={exportPassphraseConfirm}
                      onChange={(e) => setExportPassphraseConfirm(e.target.value)}
                      className="border rounded-xl px-3 py-2 text-xs outline-none transition-colors"
                      style={{
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary
                      }}
                    />
                  </div>
                  <div 
                    className="p-2 rounded-xl border text-[9px]"
                    style={{
                      backgroundColor: theme.warningBg,
                      borderColor: `${theme.warning}40`,
                      color: theme.warning
                    }}
                  >
                    If this passphrase is lost, the exported file cannot be decrypted by anyone.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 text-center"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExecuteExport}
                  className="py-2.5 font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textOnPrimary || '#FFFFFF'
                  }}
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
          <div 
            className="fixed inset-0 backdrop-blur-sm z-[95] flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl max-h-[90vh] overflow-y-auto transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: theme.primary }} />
                  <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Restore Pre-Flight Inspection</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectionReport(null);
                    setRawUploadedBackup(null);
                  }}
                  className="p-1 rounded-lg cursor-pointer transition-colors"
                  style={{ color: theme.textSecondary }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* If password required */}
              {inspectionReport.needsPassphrase ? (
                <div className="flex flex-col gap-3">
                  <div 
                    className="p-3 rounded-2xl border text-xs"
                    style={{
                      backgroundColor: `${theme.primary}15`,
                      borderColor: `${theme.primary}30`,
                      color: theme.textPrimary
                    }}
                  >
                    This backup is encrypted with <strong>AES-256-GCM</strong>. Enter the passphrase used during export to decrypt and verify the contents.
                  </div>

                  {restorePassphraseError && (
                    <div 
                      className="p-2.5 rounded-xl border text-xs"
                      style={{
                        backgroundColor: theme.dangerBg,
                        borderColor: `${theme.danger}40`,
                        color: theme.danger
                      }}
                    >
                      {restorePassphraseError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold" style={{ color: theme.textSecondary }}>Decryption Passphrase</label>
                    <input
                      type="password"
                      placeholder="Enter passphrase"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      className="border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.textPrimary
                      }}
                      autoFocus
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDecryptInspection}
                    className="py-2.5 font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 text-center mt-1"
                    style={{
                      backgroundColor: theme.primary,
                      color: theme.textOnPrimary || '#FFFFFF'
                    }}
                  >
                    Unlock & Verify Backup
                  </button>
                </div>
              ) : (
                /* Valid Decrypted Preview Summary */
                <div className="flex flex-col gap-3">
                  {inspectionReport.errors.length > 0 && (
                    <div 
                      className="p-3 rounded-2xl border text-xs flex flex-col gap-1"
                      style={{
                        backgroundColor: theme.dangerBg,
                        borderColor: `${theme.danger}40`,
                        color: theme.danger
                      }}
                    >
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
                    <div 
                      className="p-2.5 rounded-xl border text-[11px] flex flex-col gap-0.5"
                      style={{
                        backgroundColor: theme.warningBg,
                        borderColor: `${theme.warning}40`,
                        color: theme.warning
                      }}
                    >
                      {inspectionReport.warnings.map((w, idx) => (
                        <span key={idx}>⚠️ {w}</span>
                      ))}
                    </div>
                  )}

                  {/* Metadata Table */}
                  <div 
                    className="p-3.5 rounded-2xl border flex flex-col gap-2 text-xs"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.borderSubtle
                    }}
                  >
                    <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: theme.borderSubtle }}>
                      <span style={{ color: theme.textSecondary }}>Format & Schema Version:</span>
                      <span className="font-mono font-bold" style={{ color: theme.textPrimary }}>
                        v{inspectionReport.formatVersion} (Schema {inspectionReport.schemaVersion})
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: theme.borderSubtle }}>
                      <span style={{ color: theme.textSecondary }}>Created At:</span>
                      <span className="font-mono" style={{ color: theme.textPrimary }}>
                        {inspectionReport.createdAt ? new Date(inspectionReport.createdAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: theme.borderSubtle }}>
                      <span style={{ color: theme.textSecondary }}>Base Currency:</span>
                      <span className="font-mono font-bold" style={{ color: theme.textPrimary }}>{inspectionReport.currencyCode}</span>
                    </div>

                    {/* Record Counts */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div 
                        className="p-2 rounded-xl border flex justify-between"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }}
                      >
                        <span style={{ color: theme.textSecondary }}>Transactions:</span>
                        <span className="font-mono font-bold" style={{ color: theme.primary }}>{inspectionReport.recordCounts.transactions || 0}</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border flex justify-between"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }}
                      >
                        <span style={{ color: theme.textSecondary }}>Accounts/Wallets:</span>
                        <span className="font-mono font-bold" style={{ color: theme.primary }}>{inspectionReport.recordCounts.wallets || inspectionReport.recordCounts.accounts || 0}</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border flex justify-between"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }}
                      >
                        <span style={{ color: theme.textSecondary }}>Journals:</span>
                        <span className="font-mono font-bold" style={{ color: theme.primary }}>{inspectionReport.recordCounts.journal_entries || 0}</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border flex justify-between"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }}
                      >
                        <span style={{ color: theme.textSecondary }}>Attachments:</span>
                        <span className="font-mono font-bold" style={{ color: theme.primary }}>{inspectionReport.attachmentCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Safety Rollback Notice */}
                  <div 
                    className="p-3 rounded-2xl border text-[10px] leading-relaxed"
                    style={{
                      backgroundColor: `${theme.primary}12`,
                      borderColor: `${theme.primary}30`,
                      color: theme.textPrimary
                    }}
                  >
                    <CheckCircle2 size={14} className="inline mr-1" style={{ color: theme.primary }} />
                    <strong>Atomic Safety Guarantee:</strong> A full safety rollback snapshot of your existing database will be taken immediately before restore. If any constraint or table fails, the prior database will be restored untouched.
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectionReport(null);
                        setRawUploadedBackup(null);
                      }}
                      className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 text-center"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.borderSubtle,
                        color: theme.textSecondary
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!inspectionReport.isValid || isRestoring}
                      onClick={handleConfirmRestore}
                      className="py-2.5 font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.textOnPrimary || '#FFFFFF',
                        opacity: (!inspectionReport.isValid || isRestoring) ? 0.5 : 1
                      }}
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
          <div 
            className="fixed inset-0 backdrop-blur-sm z-[95] flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-center shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <Trash2 size={40} className="text-rose-500 mx-auto animate-bounce" />
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold" style={{ color: theme.textPrimary }}>Erase Secure Database?</span>
                <span className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                  This action is irreversible. All local transactions, categories, budgets, and settings will be permanently wiped.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
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
                  className="py-2.5 font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.danger,
                    color: '#FFFFFF'
                  }}
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
          <div 
            className="fixed inset-0 backdrop-blur-sm z-[95] flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-center shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div 
                className="p-3 rounded-full border w-12 h-12 flex items-center justify-center mx-auto transition-colors"
                style={{
                  backgroundColor: `${theme.primary}18`,
                  borderColor: `${theme.primary}35`,
                  color: theme.primary
                }}
              >
                <Key size={24} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-base font-bold" style={{ color: theme.textPrimary }}>Configure App Lock PIN</span>
                <span className="text-xs" style={{ color: theme.textSecondary }}>Enter a 4-digit security PIN passcode</span>
              </div>

              {pinError && (
                <div 
                  className="p-2.5 rounded-xl border text-xs font-medium"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
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
                className="border rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest mx-auto w-44 outline-none transition-colors"
                style={{
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary
                }}
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
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="py-2.5 font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textOnPrimary || '#FFFFFF'
                  }}
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
    <div 
      className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: theme.overlay }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md max-h-[88vh] overflow-y-auto p-5 border shadow-2xl relative transition-colors"
        style={{
          backgroundColor: theme.surfaceElevated || themeCardBg,
          borderColor: theme.borderSubtle || themeBorder,
          borderRadius: '24px',
          color: theme.textPrimary
        }}
      >
        {contentElement}
      </motion.div>
    </div>
  );
}

