/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppTheme {
  id: string;
  name: string;
  isDark: boolean;
  background: string;
  cardBg: string;
  primary: string; // Accent primary
  secondary: string; // Accent secondary
  textPrimary: string;
  textSecondary: string;
  border: string;
  radius: string; // tailwind rounded class
  fontFamily: string; // tailwind font class
  accentGlow: string; // shadow class
  glassmorphic: string;
  badgeBg: string;
  iconStrokeWidth: number;
  iconFilled: boolean;
}

export const PREBUILT_THEMES: AppTheme[] = [
  {
    id: 'emerald',
    name: 'Emerald Dream',
    isDark: true,
    background: '#121826',
    cardBg: '#1E293B',
    primary: '#10B981', // Emerald green
    secondary: '#14B8A6', // Teal
    textPrimary: '#FFFFFF', // High contrast white
    textSecondary: '#94A3B8', // High contrast slate-400
    border: 'rgba(255, 255, 255, 0.08)',
    radius: 'rounded-[24px]',
    fontFamily: 'font-sans',
    accentGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    glassmorphic: 'bg-[#1E293B]/85 backdrop-blur-xl border border-white/10',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    iconStrokeWidth: 2.5,
    iconFilled: true
  },
  {
    id: 'sakura',
    name: 'Sakura Dawn',
    isDark: false,
    background: '#FEF3C7', // Warm Beige
    cardBg: '#FFFFFF', // Soft White
    primary: '#EA580C', // Terracotta
    secondary: '#FB7185', // Rose
    textPrimary: '#451A03', // Dark Brown (Superb contrast on white/beige)
    textSecondary: '#78350F', // Warm brown clay (readable)
    border: 'rgba(234, 88, 12, 0.15)',
    radius: 'rounded-[32px]',
    fontFamily: 'font-sans font-medium',
    accentGlow: 'shadow-[0_4px_20px_rgba(234,88,12,0.15)]',
    glassmorphic: 'bg-white/90 backdrop-blur-xl border border-orange-200/50',
    badgeBg: 'bg-orange-100 text-orange-800 border border-orange-200',
    iconStrokeWidth: 1.5,
    iconFilled: false
  },
  {
    id: 'midnight',
    name: 'Midnight Raven',
    isDark: true,
    background: '#000000', // True Black
    cardBg: '#1C1C1E', // Dark Gray
    primary: '#A855F7', // Neon Purple
    secondary: '#06B6D4', // Cyan
    textPrimary: '#FFFFFF',
    textSecondary: '#CBD5E1', // High contrast gray
    border: 'rgba(168, 85, 247, 0.25)',
    radius: 'rounded-lg', // Sharp sleek edges
    fontFamily: 'font-mono', // Techy monospace
    accentGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
    glassmorphic: 'bg-black/90 backdrop-blur-md border border-purple-500/30',
    badgeBg: 'bg-purple-950 text-purple-300 border border-purple-800',
    iconStrokeWidth: 2.5,
    iconFilled: true
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    isDark: true,
    background: '#0F172A', // Deep Navy
    cardBg: '#1E293B', // Slate Blue
    primary: '#2DD4BF', // Bright Teal
    secondary: '#FBBF24', // Soft Gold
    textPrimary: '#F8FAFC', // Slate-50
    textSecondary: '#94A3B8', // Slate-400
    border: 'rgba(45, 212, 191, 0.15)',
    radius: 'rounded-[24px]',
    fontFamily: 'font-sans',
    accentGlow: 'shadow-[0_0_20px_rgba(45,212,191,0.25)]',
    glassmorphic: 'bg-[#1E293B]/85 backdrop-blur-xl border border-teal-500/10',
    badgeBg: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
    iconStrokeWidth: 2.5,
    iconFilled: true
  },
  {
    id: 'cotton',
    name: 'Cotton Candy',
    isDark: false,
    background: '#F3E8FF', // Soft Lavender
    cardBg: '#FFF1F2', // Pinkish White
    primary: '#EC4899', // Bubblegum Pink
    secondary: '#34D399', // Mint
    textPrimary: '#4C1D95', // Deep Purple (Excellent contrast on pink/lavender)
    textSecondary: '#6D28D9', // Medium purple
    border: 'rgba(236, 72, 153, 0.15)',
    radius: 'rounded-[28px]',
    fontFamily: 'font-sans font-medium',
    accentGlow: 'shadow-[0_4px_16px_rgba(236,72,153,0.12)]',
    glassmorphic: 'bg-[#FFF1F2]/90 backdrop-blur-md border border-pink-200/50',
    badgeBg: 'bg-pink-100 text-pink-700 border border-pink-200',
    iconStrokeWidth: 1.5,
    iconFilled: false
  }
];
