/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, DollarSign, Calendar, Palette, Key, Shield, Trash2, Camera, Download, Upload, ShieldCheck, Check } from 'lucide-react';
import { AppTheme, PREBUILT_THEMES } from '../theme';
import { AppSettings, BackupSchedule } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileTabProps {
  settings: AppSettings;
  onChangeSettings: (updates: Partial<AppSettings>) => void;
  avatar: string; // base64
  onChangeAvatar: (base64: string) => void;
  onFactoryReset: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => void;
  activeThemeId: string;
  onSelectTheme: (id: string) => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
}

import { triggerHapticFeedback } from '../utils/haptics';

export default function ProfileTab({
  settings,
  onChangeSettings,
  avatar,
  onChangeAvatar,
  onFactoryReset,
  onExportBackup,
  onImportBackup,
  activeThemeId,
  onSelectTheme,
  themeCardBg,
  themeBorder,
  themeRadius,
  themePrimary
}: ProfileTabProps) {
  const [userName, setUserName] = useState(localStorage.getItem('cocoon_username') || localStorage.getItem('finflow_username') || 'INFINITY DECODER');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');

  // Currency listings
  const currencies = [
    { symbol: '₨', code: 'PKR', name: 'Pakistani Rupee' },
    { symbol: '$', code: 'USD', name: 'US Dollar' },
    { symbol: '€', code: 'EUR', name: 'Euro' },
    { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
    { symbol: '£', code: 'GBP', name: 'British Pound' },
    { symbol: '¥', code: 'JPY', name: 'Japanese Yen' }
  ];

  // Image upload base64 converter
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChangeAvatar(reader.result as string);
        triggerHapticFeedback();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          onImportBackup(reader.result as string);
          alert('Database backup restored successfully!');
          triggerHapticFeedback();
        } catch (err: any) {
          alert(err.message || 'Restoration failed. Please check file formatting.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSavePin = () => {
    if (pinInput.length !== 4 || isNaN(parseInt(pinInput))) {
      alert('PIN must be exactly 4 numeric digits.');
      return;
    }
    onChangeSettings({ pinCode: pinInput });
    setPinInput('');
    setShowPinDialog(false);
    triggerHapticFeedback();
  };

  return (
    <div className="w-full flex flex-col gap-5 select-none text-white">
      {/* Visual Avatar Header card */}
      <div 
        className="w-full p-6 rounded-[28px] border bg-gradient-to-b from-neutral-900 to-neutral-950 flex flex-col items-center gap-3 relative overflow-hidden"
        style={{ borderColor: themeBorder }}
      >
        <div className="absolute right-[-20px] top-[-20px] w-28 h-28 bg-white/2 rounded-full blur-xl pointer-events-none" />

        {/* Large Avatar container */}
        <div className="relative group cursor-pointer w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-white/20 hover:border-emerald-400 transition-colors">
          {avatar ? (
            <img src={avatar} alt="Profile Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-400">
              <User size={40} />
            </div>
          )}
          
          {/* File Camera trigger input overlays */}
          <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold">
            <Camera size={18} className="mb-1 text-emerald-400" />
            Set Photo
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              localStorage.setItem('cocoon_username', e.target.value);
              localStorage.setItem('finflow_username', e.target.value);
            }}
            placeholder="Your Name..."
            className="bg-transparent border-b border-transparent focus:border-white/30 text-center text-base font-bold text-white outline-none w-full"
          />
          <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
            Offline secure account
          </span>
        </div>
      </div>

      {/* DYNAMIC ACCENT / PRE-BUILT MATERIAL 3 THEMING GRID */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold tracking-wider opacity-60 uppercase px-1">
          Material 3 Themes
        </span>
        <div className="grid grid-cols-5 gap-2.5">
          {PREBUILT_THEMES.map(theme => {
            const isSelected = activeThemeId === theme.id;
            return (
              <motion.button
                key={theme.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  onSelectTheme(theme.id);
                  triggerHapticFeedback();
                }}
                className={`relative p-2 h-20 flex flex-col items-center justify-between border rounded-xl cursor-pointer ${
                  isSelected ? 'ring-2 ring-emerald-400 border-transparent shadow-xl' : 'border-white/5 bg-white/2'
                }`}
              >
                {/* Background swatch preview inside card */}
                <div 
                  className="w-full h-8 rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: theme.background }}
                >
                  <div className="w-2 h-2 rounded-full absolute" style={{ backgroundColor: theme.primary }} />
                </div>

                <span className="text-[8px] font-bold tracking-tight text-center text-neutral-300 truncate w-full">
                  {theme.name.split(' ')[0]}
                </span>

                {isSelected && (
                  <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 text-white">
                    <Check size={8} strokeWidth={4} />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* TILE CARD SETTINGS SLIDES */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold tracking-wider opacity-60 uppercase px-1">
          App Customization
        </span>

        {/* Currency setting */}
        <div className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`} style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <DollarSign size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">Preferred Currency</span>
              <span className="text-[10px] text-neutral-400">Local numerical formats</span>
            </div>
          </div>
          <select
            value={settings.currencyCode || 'PKR'}
            onChange={(e) => {
              const selected = currencies.find(c => c.code === e.target.value);
              if (selected) {
                onChangeSettings({
                  currencySymbol: selected.symbol,
                  currencyCode: selected.code
                });
                triggerHapticFeedback();
              }
            }}
            className="bg-neutral-900 border border-white/10 text-xs rounded-xl p-2 font-bold outline-none cursor-pointer text-white max-w-[140px] truncate"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
            ))}
          </select>
        </div>

        {/* First Day of Week */}
        <div className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`} style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Calendar size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">First Day of Week</span>
              <span className="text-[10px] text-neutral-400">Starts calendar segments</span>
            </div>
          </div>
          <select
            value={settings.firstDayOfWeek}
            onChange={(e) => {
              onChangeSettings({ firstDayOfWeek: e.target.value as any });
              triggerHapticFeedback();
            }}
            className="bg-neutral-900 border border-white/10 text-xs rounded-xl p-2 font-bold outline-none cursor-pointer"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>

        {/* local PIN lock setting */}
        <div className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius}`} style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
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
              onClick={() => {
                setShowPinDialog(true);
                triggerHapticFeedback();
              }}
              className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/25 border border-purple-500/35 rounded-xl text-purple-400 text-xs font-bold cursor-pointer"
            >
              {settings.pinCode ? 'Reset PIN' : 'Set PIN'}
            </button>
          </div>

          {settings.pinCode && (
            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-bold">Local Pin Lock Security Enabled!</span>
              <button
                onClick={() => {
                  onChangeSettings({ pinCode: undefined });
                  triggerHapticFeedback();
                }}
                className="ml-auto text-[10px] text-rose-400 font-bold underline cursor-pointer"
              >
                Disable Lock
              </button>
            </div>
          )}
        </div>

        {/* SQLite/JSON Offline Backups */}
        <div className={`p-4 border flex flex-col gap-3.5 shadow-md ${themeRadius}`} style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
              <Shield size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">Database Operations</span>
              <span className="text-[10px] text-neutral-400">Export secure JSON database records</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={onExportBackup}
              className="py-2.5 bg-neutral-800 hover:bg-neutral-700/80 border border-white/5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
            >
              <Download size={14} /> Export Backup
            </button>
            <label className="py-2.5 bg-neutral-800 hover:bg-neutral-700/80 border border-white/5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer text-center">
              <Upload size={14} /> Restore Backup
              <input type="file" accept=".json" onChange={handleBackupUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Secure Factory Reset */}
        <div className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`} style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}>
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
            onClick={() => {
              setShowResetConfirm(true);
              triggerHapticFeedback();
            }}
            className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Factory Reset
          </button>
        </div>
      </div>

      {/* FACTORY RESET CONFIRM OVERLAY */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col gap-4 text-center"
            >
              <Trash2 size={40} className="text-rose-500 mx-auto animate-bounce" />
              <span className="text-lg font-bold">Erase Secure Database?</span>
              <span className="text-xs text-neutral-400 leading-relaxed">
                This action is irreversible. All local transactions, categories, wallets, and settings will be permanently destroyed.
              </span>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onFactoryReset();
                    setShowResetConfirm(false);
                    triggerHapticFeedback();
                  }}
                  className="py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer"
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col gap-4 text-center"
            >
              <Key size={30} className="text-purple-400 mx-auto" />
              <span className="text-base font-bold">Configure App Lock PIN</span>
              <span className="text-xs text-neutral-400">Enter a 4-digit security PIN passcode</span>

              <input
                type="text"
                maxLength={4}
                placeholder="e.g. 1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white mx-auto w-40 outline-none focus:border-purple-400"
              />

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => {
                    setPinInput('');
                    setShowPinDialog(false);
                  }}
                  className="py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePin}
                  className="py-2 bg-purple-500 hover:bg-purple-600 font-bold text-white rounded-xl text-xs cursor-pointer"
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
}
