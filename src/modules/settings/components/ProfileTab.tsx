/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, DollarSign, Calendar, Camera, ArrowLeft, Check, Trash2, Save, Building2, ChevronDown, Sun, Moon, Laptop } from 'lucide-react';
import { motion } from 'motion/react';
import { PREBUILT_THEMES, useTheme } from '../../../core/theme';
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
  themeSecondary?: string;
  onOpenWorkspaceSelector?: () => void;
  activeWorkspaceName?: string;
  isBusinessMode?: boolean;
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
  themeRadius,
  themePrimary = '#E74425',
  themeSecondary = '#C67764',
  onOpenWorkspaceSelector,
  activeWorkspaceName,
  isBusinessMode
}: ProfileTabProps) {
  const { theme, themeMode, setThemeMode } = useTheme();

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
    <div className="w-full flex flex-col gap-5 select-none text-left" style={{ color: theme.textPrimary }}>
      {/* Top Header with Back to Home button & Workspace Switcher */}
      <div className="flex items-center justify-between pb-2 border-b gap-2" style={{ borderColor: theme.borderSubtle }}>
        {onBack ? (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm border"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary
            }}
          >
            <ArrowLeft size={14} style={{ color: theme.primary }} />
            <span>Back to Home</span>
          </button>
        ) : (
          <div className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: theme.textSecondary }}>
            Profile Settings
          </div>
        )}

        {/* Workspace Switcher Button */}
        {onOpenWorkspaceSelector ? (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              onOpenWorkspaceSelector();
            }}
            className="px-3 py-1.5 min-h-[44px] rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            style={{
              backgroundColor: isBusinessMode ? `${theme.primary}18` : theme.surfaceMuted,
              borderColor: isBusinessMode ? `${theme.primary}50` : theme.borderSubtle,
              color: isBusinessMode ? theme.primary : theme.textPrimary
            }}
            title="Switch Workspace Context"
          >
            {isBusinessMode ? (
              <Building2 size={15} style={{ color: theme.primary }} className="shrink-0" />
            ) : (
              <User size={15} style={{ color: theme.secondary || theme.primary }} className="shrink-0" />
            )}
            <div className="flex flex-col text-left">
              <span className="text-[8px] uppercase font-mono tracking-wider opacity-70" style={{ color: theme.textSecondary }}>Workspace</span>
              <span className="max-w-[110px] truncate text-xs font-bold" style={{ color: theme.textPrimary }}>
                {activeWorkspaceName || 'Personal'}
              </span>
            </div>
            <ChevronDown size={13} style={{ color: theme.textSecondary }} className="shrink-0" />
          </button>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: theme.textSecondary }}>
            Preferences & Profile
          </span>
        )}
      </div>

      {/* Visual Avatar & Profile Photo Section */}
      <div 
        className="w-full p-6 rounded-[28px] border flex flex-col items-center gap-4 relative overflow-hidden shadow-lg transition-colors"
        style={{
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.borderSubtle
        }}
      >
        <div 
          className="absolute right-[-20px] top-[-20px] w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-20"
          style={{ backgroundColor: theme.primary }}
        />

        {/* Large Avatar container */}
        <div 
          className="relative group w-28 h-28 rounded-full overflow-hidden border-2 border-dashed shadow-xl flex items-center justify-center transition-colors"
          style={{
            borderColor: `${theme.primary}60`,
            backgroundColor: theme.surfaceMuted
          }}
        >
          {avatar ? (
            <img src={avatar} alt="Profile Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: theme.textSecondary }}>
              <User size={46} strokeWidth={1.5} />
            </div>
          )}

          {/* Quick upload overlay */}
          <label 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-[10px] font-bold"
            style={{ backgroundColor: theme.overlay, color: '#FFFFFF' }}
          >
            <Camera size={20} className="mb-1" style={{ color: theme.primary }} />
            Change Photo
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        {/* Avatar Action Controls */}
        <div className="flex items-center gap-2">
          <label 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm border"
            style={{
              backgroundColor: `${theme.primary}18`,
              borderColor: `${theme.primary}40`,
              color: theme.primary
            }}
          >
            <Camera size={14} style={{ color: theme.primary }} />
            <span>Update Photo</span>
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>

          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm border"
              style={{
                backgroundColor: theme.dangerBg,
                borderColor: `${theme.danger}40`,
                color: theme.danger
              }}
              title="Remove profile picture"
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight" style={{ color: theme.textPrimary }}>
            {userName || 'User Profile'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest mt-0.5 block" style={{ color: theme.textSecondary }}>
            Offline Encrypted Account
          </span>
        </div>
      </div>

      {/* USER DETAILS EDITING FORM */}
      <div 
        className={`p-5 border flex flex-col gap-4 shadow-md ${themeRadius} text-left transition-colors`} 
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.borderSubtle }}>
          <div className="flex items-center gap-2.5">
            <div 
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: `${theme.primary}15`,
                borderColor: `${theme.primary}30`,
                color: theme.primary
              }}
            >
              <User size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Personal Information</span>
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>Username, contact & address details</span>
            </div>
          </div>

          {savedFeedback && (
            <span 
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 animate-fade-in border"
              style={{
                backgroundColor: theme.successBg,
                borderColor: `${theme.success}50`,
                color: theme.success
              }}
            >
              <Check size={12} strokeWidth={3} /> Saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
          {/* Username Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: theme.textSecondary }}>
              <User size={12} style={{ color: theme.primary }} /> Full Name / Username
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. John Doe"
              className="rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.textPrimary
              }}
            />
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: theme.textSecondary }}>
              <Mail size={12} style={{ color: theme.primary }} /> Email Address
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              className="rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.textPrimary
              }}
            />
          </div>

          {/* Mobile Number Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: theme.textSecondary }}>
              <Phone size={12} style={{ color: theme.primary }} /> Mobile Number
            </label>
            <input
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="e.g. +92 300 1234567"
              className="rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.textPrimary
              }}
            />
          </div>

          {/* Physical Address Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: theme.textSecondary }}>
              <MapPin size={12} style={{ color: theme.primary }} /> Residential / Postal Address
            </label>
            <input
              type="text"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="e.g. Apartment 4B, Central Avenue, City"
              className="rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border"
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.textPrimary
              }}
            />
          </div>

          {/* Save Profile Button */}
          <button
            type="submit"
            className="mt-1 w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            style={{
              backgroundColor: theme.primary,
              color: theme.textOnPrimary || '#FFFFFF'
            }}
          >
            <Save size={14} />
            <span>Save Profile Details</span>
          </button>
        </form>
      </div>

      {/* APPEARANCE MODE SWITCHER (System | Light | Dark) */}
      <div 
        className={`p-4 border flex flex-col gap-3 shadow-md ${themeRadius} text-left transition-colors`}
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: theme.borderSubtle }}>
          <div className="flex flex-col">
            <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Appearance Mode</span>
            <span className="text-[10px]" style={{ color: theme.textSecondary }}>Match OS setting or force light/dark</span>
          </div>
          <span 
            className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.borderSubtle,
              color: theme.primary
            }}
          >
            {themeMode}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl" style={{ backgroundColor: theme.surfaceMuted }}>
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              setThemeMode('system');
            }}
            className="py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
            style={{
              backgroundColor: themeMode === 'system' ? theme.surfaceElevated : 'transparent',
              color: themeMode === 'system' ? theme.primary : theme.textSecondary,
              boxShadow: themeMode === 'system' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
            }}
          >
            <Laptop size={14} />
            <span>System</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              setThemeMode('light');
            }}
            className="py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
            style={{
              backgroundColor: themeMode === 'light' ? theme.surfaceElevated : 'transparent',
              color: themeMode === 'light' ? theme.primary : theme.textSecondary,
              boxShadow: themeMode === 'light' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
            }}
          >
            <Sun size={14} />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              setThemeMode('dark');
            }}
            className="py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
            style={{
              backgroundColor: themeMode === 'dark' ? theme.surfaceElevated : 'transparent',
              color: themeMode === 'dark' ? theme.primary : theme.textSecondary,
              boxShadow: themeMode === 'dark' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
            }}
          >
            <Moon size={14} />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC ACCENT / PRE-BUILT THEMES GRID */}
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: theme.textSecondary }}>
            Color Palettes & Signatures
          </span>
          <span className="text-[10px] font-mono font-bold" style={{ color: theme.primary }}>
            {PREBUILT_THEMES.length} Available
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {PREBUILT_THEMES.map(t => {
            const isSelected = activeThemeId === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  onSelectTheme(t.id);
                  triggerHapticFeedback();
                }}
                className={`relative p-2 h-22 flex flex-col items-center justify-between border rounded-xl cursor-pointer transition-all ${
                  isSelected ? 'border-transparent shadow-xl scale-[1.02]' : 'hover:opacity-90'
                }`}
                style={
                  isSelected 
                    ? { outline: `2px solid ${t.primary}`, boxShadow: `0 0 16px ${t.primary}50`, backgroundColor: `${t.primary}15` } 
                    : { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceMuted }
                }
              >
                {/* Background swatch preview inside card */}
                <div 
                  className="w-full h-8 rounded-lg border flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: t.background, borderColor: t.borderSubtle || 'rgba(128,128,128,0.2)' }}
                >
                  <div 
                    className="w-5 h-4 rounded-sm border flex items-center justify-center" 
                    style={{ backgroundColor: t.cardBg, borderColor: t.borderSubtle || 'rgba(128,128,128,0.3)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.primary }} />
                  </div>
                </div>

                <span 
                  className="text-[9px] font-bold tracking-tight text-center truncate w-full mt-1"
                  style={{ color: isSelected ? theme.primary : theme.textPrimary }}
                >
                  {t.name.replace('Cocoon ', '')}
                </span>

                {isSelected && (
                  <div 
                    className="absolute top-1 right-1 rounded-full p-0.5 text-white shadow-sm"
                    style={{ backgroundColor: t.primary }}
                  >
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
        <span className="text-xs font-semibold tracking-wider uppercase px-1" style={{ color: theme.textSecondary }}>
          App Customization
        </span>

        {/* Currency setting */}
        <div 
          className={`p-4 border flex items-center justify-between shadow-md ${themeRadius} transition-colors`} 
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: `${theme.primary}15`,
                borderColor: `${theme.primary}30`,
                color: theme.primary
              }}
            >
              <DollarSign size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Preferred Currency</span>
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>Local numerical formats</span>
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
            className="border text-xs rounded-xl p-2 font-bold outline-none cursor-pointer max-w-[140px] truncate"
            style={{
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.textPrimary
            }}
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
            ))}
          </select>
        </div>

        {/* First Day of Week */}
        <div 
          className={`p-4 border flex items-center justify-between shadow-md ${themeRadius} transition-colors`} 
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: `${theme.secondary || theme.primary}15`,
                borderColor: `${theme.secondary || theme.primary}30`,
                color: theme.secondary || theme.primary
              }}
            >
              <Calendar size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>First Day of Week</span>
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>Starts calendar segments</span>
            </div>
          </div>
          <select
            value={settings.firstDayOfWeek}
            onChange={(e) => {
              onChangeSettings({ firstDayOfWeek: e.target.value as 'monday' | 'sunday' });
              triggerHapticFeedback();
            }}
            className="border text-xs rounded-xl p-2 font-bold outline-none cursor-pointer"
            style={{
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.textPrimary
            }}
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      </div>
    </div>
  );
}

