/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'system' | 'light' | 'dark' | string;

export interface AppTheme {
  id: string;
  name: string;
  isDark: boolean;

  // Surfaces
  background: string;       // Primary canvas
  cardBg: string;           // Content cards & surfaces
  surfaceElevated: string;  // Modal dialogs, dropdowns, floating sheets
  surfaceMuted: string;     // Inner panels, table headers, search boxes
  overlay: string;          // Modal backdrop scrim

  // Typography
  textPrimary: string;      // Headings & primary legible text
  textSecondary: string;    // Subheadings, labels, dates
  textMuted: string;        // Inactive tabs, disabled, placeholders
  textInverse: string;      // Inverted contrast text
  textOnPrimary: string;    // Text on primary buttons

  // Borders
  border: string;           // Standard container border
  borderSubtle: string;     // Subtle inner divider
  borderFocus: string;      // Focus rings

  // Interactive & Form Inputs
  primary: string;          // Primary action & active indicator
  primaryHover: string;     // Primary hover state
  secondary: string;        // Secondary brand accent
  primaryContent?: string;  // Contrast text color for primary actions
  accent?: string;          // Accent highlight alias
  inputBg: string;          // Form input background
  inputBorder: string;      // Form input border

  // Semantic Status
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;

  // Data Visualization
  chartGrid: string;
  chartText: string;
  chartSeries: string[];

  // Presentation & Legacy Compatibility
  radius: string;           // tailwind rounded class
  fontFamily: string;       // tailwind font class
  accentGlow: string;       // shadow class
  glassmorphic: string;
  badgeBg: string;
  iconStrokeWidth: number;
  iconFilled: boolean;
}

export const COCOON_PALETTE = {
  // Primary brand palette requested
  contessa: '#C67764',
  wispPink: '#FDF2F3',
  ebony: '#0D1726',
  cinnabar: '#E74425',
  doubleSpanishWhite: '#E5CFB4',
  asphalt: '#191009',
  digikhataNavy: '#111F49',
  white: '#FFFFFF',
  charcoal: '#26282A',
  spanishGray: '#9E9FA0',

  // Harmonious orange tints and elevated tones
  tangerineGlow: '#FF6B4A',
  amberCinnabar: '#F25835',
  warmSand: '#EFE0CD',
  deepTerracotta: '#A34F3D',
  elevatedNavy: '#172758',
  softNavyBorder: 'rgba(198, 119, 100, 0.22)'
} as const;

export const PREBUILT_THEMES: AppTheme[] = [
  {
    id: 'cocoon',
    name: 'Cocoon Flagship',
    isDark: true,
    background: '#0D1726', // Ebony
    cardBg: '#111F49', // DigiKhata Navy
    surfaceElevated: '#172758',
    surfaceMuted: '#15224D',
    overlay: 'rgba(13, 23, 38, 0.78)',
    textPrimary: '#FFFFFF',
    textSecondary: '#E5CFB4', // Double Spanish White
    textMuted: '#9E9FA0', // Spanish Gray
    textInverse: '#0D1726',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(198, 119, 100, 0.22)',
    borderSubtle: 'rgba(198, 119, 100, 0.12)',
    borderFocus: '#E74425',
    primary: '#E74425', // Cinnabar
    primaryHover: '#FF6B4A', // Tangerine Glow
    secondary: '#C67764', // Contessa
    inputBg: '#0F1A3B',
    inputBorder: 'rgba(198, 119, 100, 0.28)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.15)',
    chartGrid: 'rgba(255, 255, 255, 0.08)',
    chartText: '#9E9FA0',
    chartSeries: ['#E74425', '#C67764', '#E5CFB4', '#3B82F6', '#10B981', '#A855F7'],
    radius: 'rounded-[24px]',
    fontFamily: 'font-sans',
    accentGlow: 'shadow-[0_0_24px_rgba(231,68,37,0.35)]',
    glassmorphic: 'bg-[#111F49]/90 backdrop-blur-xl border border-[#C67764]/25',
    badgeBg: 'bg-[#E74425]/15 text-[#FF6B4A] border border-[#E74425]/30',
    iconStrokeWidth: 2,
    iconFilled: true
  },
  {
    id: 'cocoon-light',
    name: 'Cocoon Light Canvas',
    isDark: false,
    background: '#FDF2F3', // Wisp Pink
    cardBg: '#FFFFFF', // Pure White
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F8ECED',
    overlay: 'rgba(13, 23, 38, 0.45)',
    textPrimary: '#0D1726', // Ebony
    textSecondary: '#4B5563',
    textMuted: '#9E9FA0',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(198, 119, 100, 0.22)',
    borderSubtle: 'rgba(198, 119, 100, 0.12)',
    borderFocus: '#E74425',
    primary: '#E74425',
    primaryHover: '#C8371B',
    secondary: '#C67764',
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(198, 119, 100, 0.25)',
    success: '#059669',
    successBg: 'rgba(5, 150, 105, 0.12)',
    warning: '#D97706',
    warningBg: 'rgba(217, 119, 6, 0.12)',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.12)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.12)',
    chartGrid: 'rgba(13, 23, 38, 0.08)',
    chartText: '#4B5563',
    chartSeries: ['#E74425', '#C67764', '#D97706', '#2563EB', '#059669', '#7C3AED'],
    radius: 'rounded-[24px]',
    fontFamily: 'font-sans',
    accentGlow: 'shadow-[0_4px_20px_rgba(231,68,37,0.15)]',
    glassmorphic: 'bg-white/90 backdrop-blur-xl border border-[#E5CFB4]/60',
    badgeBg: 'bg-[#E74425]/10 text-[#E74425] border border-[#E74425]/20',
    iconStrokeWidth: 2,
    iconFilled: false
  },
  {
    id: 'cocoon-navy',
    name: 'Cocoon Classic Navy',
    isDark: true,
    background: '#101E37',
    cardBg: '#142038',
    surfaceElevated: '#20314D',
    surfaceMuted: '#1A2844',
    overlay: 'rgba(16, 30, 55, 0.78)',
    textPrimary: '#FFFFFF',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textInverse: '#101E37',
    textOnPrimary: '#FFFFFF',
    border: '#23334F',
    borderSubtle: '#1C2940',
    borderFocus: '#168FE0',
    primary: '#168FE0', // Electric blue
    primaryHover: '#2196E8',
    secondary: '#A9E547', // Distinctive lime-green active indicator
    inputBg: '#0E192E',
    inputBorder: '#23334F',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#168FE0',
    infoBg: 'rgba(22, 143, 224, 0.15)',
    chartGrid: 'rgba(255, 255, 255, 0.08)',
    chartText: '#CBD5E1',
    chartSeries: ['#168FE0', '#A9E547', '#38BDF8', '#818CF8', '#F472B6', '#FBBF24'],
    radius: 'rounded-[24px]',
    fontFamily: 'font-sans',
    accentGlow: 'shadow-[0_0_20px_rgba(22,143,224,0.35)]',
    glassmorphic: 'bg-[#142038]/90 backdrop-blur-xl border border-[#23334F]',
    badgeBg: 'bg-[#168FE0]/15 text-[#60A5FA] border border-[#168FE0]/30',
    iconStrokeWidth: 2,
    iconFilled: true
  },
  {
    id: 'emerald',
    name: 'Emerald Dream',
    isDark: true,
    background: '#121826',
    cardBg: '#1E293B',
    surfaceElevated: '#28364F',
    surfaceMuted: '#182234',
    overlay: 'rgba(18, 24, 38, 0.78)',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#121826',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    borderFocus: '#10B981',
    primary: '#10B981', // Emerald green
    primaryHover: '#059669',
    secondary: '#14B8A6', // Teal
    inputBg: '#151E2E',
    inputBorder: 'rgba(255, 255, 255, 0.12)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#14B8A6',
    infoBg: 'rgba(20, 184, 166, 0.15)',
    chartGrid: 'rgba(255, 255, 255, 0.08)',
    chartText: '#94A3B8',
    chartSeries: ['#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#8B5CF6', '#F59E0B'],
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
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#FFFBEB',
    overlay: 'rgba(69, 26, 3, 0.45)',
    textPrimary: '#451A03', // Dark Brown
    textSecondary: '#78350F', // Warm brown clay
    textMuted: '#A16207',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(234, 88, 12, 0.18)',
    borderSubtle: 'rgba(234, 88, 12, 0.08)',
    borderFocus: '#EA580C',
    primary: '#EA580C', // Terracotta
    primaryHover: '#C2410C',
    secondary: '#FB7185', // Rose
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(234, 88, 12, 0.2)',
    success: '#059669',
    successBg: 'rgba(5, 150, 105, 0.12)',
    warning: '#D97706',
    warningBg: 'rgba(217, 119, 6, 0.12)',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.12)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.12)',
    chartGrid: 'rgba(69, 26, 3, 0.08)',
    chartText: '#78350F',
    chartSeries: ['#EA580C', '#FB7185', '#F59E0B', '#E11D48', '#8B5CF6', '#10B981'],
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
    surfaceElevated: '#2C2C2E',
    surfaceMuted: '#141416',
    overlay: 'rgba(0, 0, 0, 0.85)',
    textPrimary: '#FFFFFF',
    textSecondary: '#CBD5E1',
    textMuted: '#71717A',
    textInverse: '#000000',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(168, 85, 247, 0.25)',
    borderSubtle: 'rgba(168, 85, 247, 0.12)',
    borderFocus: '#A855F7',
    primary: '#A855F7', // Neon Purple
    primaryHover: '#9333EA',
    secondary: '#06B6D4', // Cyan
    inputBg: '#121214',
    inputBorder: 'rgba(168, 85, 247, 0.3)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#06B6D4',
    infoBg: 'rgba(6, 182, 212, 0.15)',
    chartGrid: 'rgba(255, 255, 255, 0.08)',
    chartText: '#CBD5E1',
    chartSeries: ['#A855F7', '#06B6D4', '#EC4899', '#3B82F6', '#10B981', '#EAB308'],
    radius: 'rounded-lg',
    fontFamily: 'font-mono',
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
    surfaceElevated: '#293850',
    surfaceMuted: '#152238',
    overlay: 'rgba(15, 23, 42, 0.78)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0F172A',
    textOnPrimary: '#0F172A',
    border: 'rgba(45, 212, 191, 0.15)',
    borderSubtle: 'rgba(45, 212, 191, 0.08)',
    borderFocus: '#2DD4BF',
    primary: '#2DD4BF', // Bright Teal
    primaryHover: '#14B8A6',
    secondary: '#FBBF24', // Soft Gold
    inputBg: '#131F33',
    inputBorder: 'rgba(45, 212, 191, 0.2)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#38BDF8',
    infoBg: 'rgba(56, 189, 248, 0.15)',
    chartGrid: 'rgba(255, 255, 255, 0.08)',
    chartText: '#94A3B8',
    chartSeries: ['#2DD4BF', '#FBBF24', '#38BDF8', '#818CF8', '#34D399', '#FB7185'],
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
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#FAF5FF',
    overlay: 'rgba(76, 29, 149, 0.45)',
    textPrimary: '#4C1D95', // Deep Purple
    textSecondary: '#6D28D9', // Medium purple
    textMuted: '#8B5CF6',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    border: 'rgba(236, 72, 153, 0.15)',
    borderSubtle: 'rgba(236, 72, 153, 0.08)',
    borderFocus: '#EC4899',
    primary: '#EC4899', // Bubblegum Pink
    primaryHover: '#DB2777',
    secondary: '#34D399', // Mint
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(236, 72, 153, 0.2)',
    success: '#059669',
    successBg: 'rgba(5, 150, 105, 0.12)',
    warning: '#D97706',
    warningBg: 'rgba(217, 119, 6, 0.12)',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.12)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.12)',
    chartGrid: 'rgba(76, 29, 149, 0.08)',
    chartText: '#6D28D9',
    chartSeries: ['#EC4899', '#34D399', '#A855F7', '#38BDF8', '#F59E0B', '#10B981'],
    radius: 'rounded-[28px]',
    fontFamily: 'font-sans font-medium',
    accentGlow: 'shadow-[0_4px_16px_rgba(236,72,153,0.12)]',
    glassmorphic: 'bg-[#FFF1F2]/90 backdrop-blur-md border border-pink-200/50',
    badgeBg: 'bg-pink-100 text-pink-700 border border-pink-200',
    iconStrokeWidth: 1.5,
    iconFilled: false
  }
];

export function getThemeById(themeId: string): AppTheme {
  const t = PREBUILT_THEMES.find(th => th.id === themeId) || PREBUILT_THEMES[0];
  return {
    ...t,
    primaryContent: t.primaryContent || t.textOnPrimary,
    accent: t.accent || t.secondary || t.primary
  };
}

/**
 * Resolves theme based on selected mode ('system' | 'light' | 'dark' | themeId).
 * Preserves the distinction between the user's selected preference and the resolved palette.
 */
export function resolveTheme(themeMode: ThemeMode, systemIsDark: boolean): AppTheme {
  if (themeMode === 'system') {
    return systemIsDark ? getThemeById('cocoon') : getThemeById('cocoon-light');
  }
  if (themeMode === 'dark') {
    return getThemeById('cocoon');
  }
  if (themeMode === 'light') {
    return getThemeById('cocoon-light');
  }
  return getThemeById(themeMode);
}

/**
 * Applies all semantic CSS custom properties to the document root element.
 * Guarantees zero-flicker and immediate reactivity across CSS and native layers.
 */
export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Semantic surfaces
  root.style.setProperty('--app-bg', theme.background);
  root.style.setProperty('--app-card-bg', theme.cardBg);
  root.style.setProperty('--app-surface-elevated', theme.surfaceElevated);
  root.style.setProperty('--app-surface-muted', theme.surfaceMuted);
  root.style.setProperty('--app-overlay', theme.overlay);

  // Semantic typography
  root.style.setProperty('--app-text-primary', theme.textPrimary);
  root.style.setProperty('--app-text-secondary', theme.textSecondary);
  root.style.setProperty('--app-text-muted', theme.textMuted);
  root.style.setProperty('--app-text-inverse', theme.textInverse);
  root.style.setProperty('--app-text-on-primary', theme.textOnPrimary);

  // Semantic borders
  root.style.setProperty('--app-border', theme.border);
  root.style.setProperty('--app-border-subtle', theme.borderSubtle);
  root.style.setProperty('--app-border-focus', theme.borderFocus);

  // Form inputs
  root.style.setProperty('--app-input-bg', theme.inputBg);
  root.style.setProperty('--app-input-border', theme.inputBorder);

  // Brand accents
  root.style.setProperty('--app-primary', theme.primary);
  root.style.setProperty('--app-primary-hover', theme.primaryHover);
  root.style.setProperty('--app-secondary', theme.secondary);

  // Status tokens
  root.style.setProperty('--app-success', theme.success);
  root.style.setProperty('--app-warning', theme.warning);
  root.style.setProperty('--app-danger', theme.danger);
  root.style.setProperty('--app-info', theme.info);

  // Native color-scheme & data attributes
  root.style.setProperty('color-scheme', theme.isDark ? 'dark' : 'light');
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-color-scheme', theme.isDark ? 'dark' : 'light');

  if (theme.isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  // Also update body background
  if (document.body) {
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.textPrimary;
  }
}

/**
 * Synchronizes Android status bar and system navigation bar with active theme.
 */
export async function syncNativeSystemBars(theme: AppTheme): Promise<void> {
  if (typeof window === 'undefined') return;

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({
        style: theme.isDark ? Style.Dark : Style.Light
      });
      await StatusBar.setBackgroundColor({
        color: theme.background
      });
    } catch {
      // Graceful fallback on web or unsupported platform
    }
  }
}

export * from './ThemeContext';

