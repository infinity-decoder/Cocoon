/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppTheme,
  PREBUILT_THEMES,
  ThemeMode,
  getThemeById,
  resolveTheme,
  applyThemeToDocument,
  syncNativeSystemBars
} from './index';

export interface ThemeContextValue {
  theme: AppTheme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  selectTheme: (themeId: string) => void;
  availableThemes: AppTheme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_THEME_MODE_KEY = 'cocoon_theme_mode';
const STORAGE_THEME_ID_KEY = 'cocoon_theme_id';
const LEGACY_FINFLOW_THEME_KEY = 'finflow_theme_id';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 1. Detect system OS preference
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 2. Load stored user preference (defaults to 'cocoon')
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'cocoon';
    const storedMode = localStorage.getItem(STORAGE_THEME_MODE_KEY);
    if (storedMode) return storedMode;
    const storedThemeId = localStorage.getItem(STORAGE_THEME_ID_KEY) || localStorage.getItem(LEGACY_FINFLOW_THEME_KEY);
    return storedThemeId || 'cocoon';
  });

  // 3. Keep system preference listener active
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  // 4. Resolve the active theme object
  const activeTheme = useMemo<AppTheme>(() => {
    return resolveTheme(themeMode, systemIsDark);
  }, [themeMode, systemIsDark]);

  // 5. Apply theme immediately to document root and native system bars
  useEffect(() => {
    applyThemeToDocument(activeTheme);
    syncNativeSystemBars(activeTheme);
  }, [activeTheme]);

  // 6. User actions
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_THEME_MODE_KEY, mode);
    if (mode !== 'system') {
      const resolved = resolveTheme(mode, systemIsDark);
      localStorage.setItem(STORAGE_THEME_ID_KEY, resolved.id);
      localStorage.setItem(LEGACY_FINFLOW_THEME_KEY, resolved.id);
    }
  }, [systemIsDark]);

  const selectTheme = useCallback((themeId: string) => {
    setThemeModeState(themeId);
    localStorage.setItem(STORAGE_THEME_MODE_KEY, themeId);
    localStorage.setItem(STORAGE_THEME_ID_KEY, themeId);
    localStorage.setItem(LEGACY_FINFLOW_THEME_KEY, themeId);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: activeTheme,
    themeMode,
    isDark: activeTheme.isDark,
    setThemeMode,
    selectTheme,
    availableThemes: PREBUILT_THEMES
  }), [activeTheme, themeMode, setThemeMode, selectTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return a safe fallback if accessed outside Provider
    const fallbackTheme = getThemeById('cocoon');
    return {
      theme: fallbackTheme,
      themeMode: 'cocoon',
      isDark: fallbackTheme.isDark,
      setThemeMode: () => {},
      selectTheme: () => {},
      availableThemes: PREBUILT_THEMES
    };
  }
  return context;
}
