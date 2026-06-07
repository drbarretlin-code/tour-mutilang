/**
 * Design System: Colors
 * Premium travel app color palette with dark mode support.
 */

const palette = {
  // Primary - Deep Ocean Blue
  primary50: '#EEF4FF',
  primary100: '#D9E6FF',
  primary200: '#BBD4FF',
  primary300: '#8DB8FF',
  primary400: '#5891FF',
  primary500: '#3366FF',
  primary600: '#1A44F5',
  primary700: '#1433E1',
  primary800: '#172BB6',
  primary900: '#19298F',

  // Accent - Warm Coral
  accent50: '#FFF5F2',
  accent100: '#FFE8E1',
  accent200: '#FFD4C8',
  accent300: '#FFB3A1',
  accent400: '#FF8A6E',
  accent500: '#FF6B47',
  accent600: '#ED4A28',
  accent700: '#C7381A',
  accent800: '#A4311A',
  accent900: '#882D1C',

  // Success - Emerald
  success50: '#ECFDF5',
  success100: '#D1FAE5',
  success200: '#A7F3D0',
  success300: '#6EE7B7',
  success400: '#34D399',
  success500: '#10B981',
  success600: '#059669',
  success700: '#047857',
  success800: '#065F46',
  success900: '#064E3B',

  // Warning - Amber
  warning50: '#FFFBEB',
  warning100: '#FEF3C7',
  warning200: '#FDE68A',
  warning300: '#FCD34D',
  warning400: '#FBBF24',
  warning500: '#F59E0B',
  warning600: '#D97706',
  warning700: '#B45309',
  warning800: '#92400E',
  warning900: '#78350F',

  // Error - Rose
  error50: '#FFF1F2',
  error100: '#FFE4E6',
  error200: '#FECDD3',
  error300: '#FDA4AF',
  error400: '#FB7185',
  error500: '#F43F5E',
  error600: '#E11D48',
  error700: '#BE123C',
  error800: '#9F1239',
  error900: '#881337',

  // Neutrals
  neutral0: '#FFFFFF',
  neutral50: '#F9FAFB',
  neutral100: '#F3F4F6',
  neutral200: '#E5E7EB',
  neutral300: '#D1D5DB',
  neutral400: '#9CA3AF',
  neutral500: '#6B7280',
  neutral600: '#4B5563',
  neutral700: '#374151',
  neutral800: '#1F2937',
  neutral900: '#111827',
  neutral950: '#030712',
};

export const lightColors = {
  ...palette,
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  borderFocused: '#3366FF',
  divider: '#F3F4F6',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.08)',
  cardBackground: '#FFFFFF',
  inputBackground: '#F9FAFB',
  tabBarBackground: '#FFFFFF',
  statusBar: 'dark' as const,
};

export const darkColors = {
  ...palette,
  background: '#0A0E1A',
  backgroundSecondary: '#111827',
  backgroundTertiary: '#1F2937',
  surface: '#1A2036',
  surfaceElevated: '#232B44',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textTertiary: '#6B7280',
  textInverse: '#111827',
  border: '#2D3652',
  borderFocused: '#5891FF',
  divider: '#1F2937',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  cardBackground: '#1A2036',
  inputBackground: '#111827',
  tabBarBackground: '#0A0E1A',
  statusBar: 'light' as const,
};

export type ThemeColors = typeof lightColors;
