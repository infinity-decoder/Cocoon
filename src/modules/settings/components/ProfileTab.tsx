/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, DollarSign, Calendar, Shield, Camera, ArrowLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { AppTheme, PREBUILT_THEMES } from '../../../core/theme';
import { AppSettings } from '../../../core/types';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface ProfileTabProps {
  settings: AppSettings;
  onChangeSettings: (updates: Partial<AppSettings>) => void;
  avatar: string; // base64
  onChangeAvatar: (base64: string) => void;
  onFactoryReset?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (jsonStr: string) => void;
  activeThemeId: string;
  onSelectTheme: (id: string) => void;
  onBack?: () => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
}

export default function ProfileTab({
  settings,
  onChangeSettings,
  avatar,
  onChangeAvatar,
  activeThemeId,
  onSelectTheme,
  onBack,
  themeCardBg,
  themeBorder,
  themeRadius
}: ProfileTabProps) {
  const [userName, setUserName] = useState(localStorage.getItem('cocoon_username') || localStorage.getItem('finflow_username') || 'INFINITY DECODER');

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

  return (
    <div className="w-full flex flex-col gap-5 select-none text-white">
      {/* Top Header with Back to Home button */}
      {onBack && (
        <div className="flex items-center justify-between pb-1 border-b border-white/5">
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={14} className="text-emerald-400" />
            <span>Back to Home</span>
          </button>
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold">Preferences & Profile</span>
        </div>
      )}
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
              onChangeSettings({ firstDayOfWeek: e.target.value as 'monday' | 'sunday' });
              triggerHapticFeedback();
            }}
            className="bg-neutral-900 border border-white/10 text-xs rounded-xl p-2 font-bold outline-none cursor-pointer text-white"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>

        {/* Security & Database notice pointing to Sidebar Settings */}
        <div 
          className={`p-4 border flex items-center justify-between shadow-md ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Shield size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">App Lock & Data Management</span>
              <span className="text-[10px] text-neutral-400">Passcode security, JSON backups & reset</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 shrink-0">
            Side Menu &gt; Settings
          </span>
        </div>
      </div>
    </div>
  );
}
