/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, DollarSign, Calendar, Camera, ArrowLeft, Check, Trash2, Save } from 'lucide-react';
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
  const [userName, setUserName] = useState(
    settings.userName || localStorage.getItem('cocoon_username') || localStorage.getItem('finflow_username') || ''
  );
  const [userEmail, setUserEmail] = useState(
    settings.userEmail || localStorage.getItem('cocoon_user_email') || ''
  );
  const [userPhone, setUserPhone] = useState(
    settings.userPhone || localStorage.getItem('cocoon_user_phone') || ''
  );
  const [userAddress, setUserAddress] = useState(
    settings.userAddress || localStorage.getItem('cocoon_user_address') || ''
  );
  const [savedFeedback, setSavedFeedback] = useState(false);

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
        const base64 = reader.result as string;
        onChangeAvatar(base64);
        triggerHapticFeedback();
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2500);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    triggerHapticFeedback();
    onChangeAvatar('');
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    triggerHapticFeedback();
    localStorage.setItem('cocoon_username', userName);
    localStorage.setItem('finflow_username', userName);
    localStorage.setItem('cocoon_user_email', userEmail);
    localStorage.setItem('cocoon_user_phone', userPhone);
    localStorage.setItem('cocoon_user_address', userAddress);

    onChangeSettings({
      userName,
      userEmail,
      userPhone,
      userAddress
    });

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
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

      {/* Visual Avatar & Profile Photo Section */}
      <div 
        className="w-full p-6 rounded-[28px] border bg-gradient-to-b from-neutral-900 to-neutral-950 flex flex-col items-center gap-4 relative overflow-hidden shadow-lg"
        style={{ borderColor: themeBorder }}
      >
        <div className="absolute right-[-20px] top-[-20px] w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Large Avatar container */}
        <div className="relative group w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-emerald-500/40 bg-neutral-900 shadow-xl flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt="Profile Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-neutral-800/80 flex items-center justify-center text-neutral-400">
              <User size={46} strokeWidth={1.5} />
            </div>
          )}

          {/* Quick upload overlay */}
          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-white text-[10px] font-bold">
            <Camera size={20} className="mb-1 text-emerald-400" />
            Change Photo
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        {/* Avatar Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300 cursor-pointer transition-all active:scale-95 shadow-sm">
            <Camera size={14} className="text-emerald-400" />
            <span>Update Photo</span>
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>

          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-400 cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Remove profile picture"
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-base font-bold text-white tracking-tight">{userName || 'User Profile'}</h2>
          <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest mt-0.5 block">
            Offline Encrypted Account
          </span>
        </div>
      </div>

      {/* USER DETAILS EDITING FORM */}
      <div 
        className={`p-5 border flex flex-col gap-4 shadow-md ${themeRadius} text-left`} 
        style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <User size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Personal Information</span>
              <span className="text-[10px] text-neutral-400">Username, contact & address details</span>
            </div>
          </div>

          {savedFeedback && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-fade-in">
              <Check size={12} strokeWidth={3} /> Saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
          {/* Username Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <User size={12} className="text-emerald-400" /> Full Name / Username
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. John Doe"
              className="bg-neutral-900 border border-white/10 focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
            />
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <Mail size={12} className="text-blue-400" /> Email Address
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              className="bg-neutral-900 border border-white/10 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
            />
          </div>

          {/* Mobile Number Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <Phone size={12} className="text-purple-400" /> Mobile Number
            </label>
            <input
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="e.g. +92 300 1234567"
              className="bg-neutral-900 border border-white/10 focus:border-purple-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
            />
          </div>

          {/* Physical Address Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <MapPin size={12} className="text-amber-400" /> Residential / Postal Address
            </label>
            <input
              type="text"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="e.g. Apartment 4B, Central Avenue, City"
              className="bg-neutral-900 border border-white/10 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
            />
          </div>

          {/* Save Profile Button */}
          <button
            type="submit"
            className="mt-1 w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Save size={14} />
            <span>Save Profile Details</span>
          </button>
        </form>
      </div>

      {/* DYNAMIC ACCENT / PRE-BUILT MATERIAL 3 THEMING GRID */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold tracking-wider opacity-60 uppercase px-1 text-left">
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
      <div className="flex flex-col gap-2.5 text-left">
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
      </div>
    </div>
  );
}
