import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ThemeColors } from '../theme/colors';
import { spacing, borderRadius, typography, shadows, animation } from '../theme/tokens';

type ColorScheme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colors: ThemeColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  shadows: typeof shadows;
  animation: typeof animation;
  isDark: boolean;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SCHEME_KEY = '@color_scheme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('system');

  useEffect(() => {
    AsyncStorage.getItem(SCHEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setColorSchemeState(saved);
      }
    });
  }, []);

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    AsyncStorage.setItem(SCHEME_KEY, scheme);
  };

  const isDark =
    colorScheme === 'system' ? systemScheme === 'dark' : colorScheme === 'dark';

  const value = useMemo<ThemeContextType>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      borderRadius,
      typography,
      shadows,
      animation,
      isDark,
      colorScheme,
      setColorScheme,
    }),
    [isDark, colorScheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
