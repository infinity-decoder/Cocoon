/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowLeft, Key, Shield, Trash2, Download, Upload, 
  ShieldCheck, Check, ShieldAlert, SlidersHorizontal
} from 'lucide-react';
import { AppSettings } from '../../../core/types';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
  settings: AppSettings;
  onChangeSettings: (updates: Partial<AppSettings>) => void;
  onFactoryReset: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => void;
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

  if (!isOpen) return null;

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          onImportBackup(reader.result as string);
          setStatusMsg({ text: 'Database backup restored successfully!' });
          triggerHapticFeedback();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Restoration failed. Please check file formatting.';
          setStatusMsg({ text: message, isError: true });
        }
      };
      reader.readAsText(file);
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
          className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 text-rose-400 cursor-pointer transition-all active:scale-90 shadow-sm shrink-0"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Settings Body */}
      <div className="flex flex-col gap-4 text-left">
            {/* Status Message */}
            {statusMsg && (
              <div 
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                  statusMsg.isError 
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusMsg.isError ? <ShieldAlert size={16} /> : <Check size={16} />}
                  <span>{statusMsg.text}</span>
                </div>
                <button 
                  onClick={() => setStatusMsg(null)} 
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* 1. App Lock Protection */}
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
                    <span className="text-sm font-bold text-white">App Lock Protection</span>
                    <span className="text-[10px] text-neutral-400">Lock financials on device loading</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPinDialog(true);
                    triggerHapticFeedback();
                  }}
                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/25 active:bg-purple-500/30 border border-purple-500/35 rounded-xl text-purple-300 text-xs font-bold cursor-pointer transition-all active:scale-95"
                >
                  {settings.pinCode ? 'Reset PIN' : 'Set PIN'}
                </button>
              </div>

              {settings.pinCode && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-emerald-300 font-bold">Local PIN Lock Security Enabled</span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeSettings({ pinCode: undefined });
                      triggerHapticFeedback();
                      setStatusMsg({ text: 'App lock PIN code removed.' });
                    }}
                    className="ml-auto text-[10px] text-rose-400 font-bold underline cursor-pointer hover:text-rose-300"
                  >
                    Disable Lock
                  </button>
                </div>
              )}
            </div>

            {/* 2. Database Operations (JSON Backup & Restore) */}
            <div 
              className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius}`} 
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: themeBorder }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                  <Shield size={16} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-white">Database Operations</span>
                  <span className="text-[10px] text-neutral-400">Export & restore secure JSON database records</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    onExportBackup();
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
                  className="py-2.5 bg-purple-500 hover:bg-purple-600 font-bold text-white rounded-xl text-xs cursor-pointer shadow-md shadow-purple-500/25 transition-all active:scale-95"
                >
                  Set PIN Code
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
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[85vh] overflow-y-auto p-4 shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          {contentElement}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
