import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  variant?: 'flat' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export function Card({
  children,
  onPress,
  style,
  variant = 'elevated',
  padding = 'md'
}: CardProps) {
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const getCardStyles = (): ViewStyle[] => {
    const base: ViewStyle = {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.cardBackground,
      overflow: 'hidden',
    };

    // Padding styles
    let paddingStyle: ViewStyle = {};
    switch (padding) {
      case 'none':
        paddingStyle = { padding: 0 };
        break;
      case 'sm':
        paddingStyle = { padding: spacing.sm };
        break;
      case 'lg':
        paddingStyle = { padding: spacing.lg };
        break;
      case 'xl':
        paddingStyle = { padding: spacing.xl };
        break;
      case 'md':
      default:
        paddingStyle = { padding: spacing.md };
        break;
    }

    // Variant styles
    let variantStyle: ViewStyle = {};
    switch (variant) {
      case 'elevated':
        variantStyle = {
          ...shadows.md,
          borderWidth: 1,
          borderColor: colors.isDark ? colors.border : 'transparent',
        };
        break;
      case 'flat':
        variantStyle = {
          backgroundColor: colors.backgroundSecondary,
        };
        break;
      case 'outlined':
        variantStyle = {
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: 'transparent',
        };
        break;
    }

    return [base, paddingStyle, variantStyle, style || {}];
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={getCardStyles()}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={getCardStyles()}>
      {children}
    </View>
  );
}
