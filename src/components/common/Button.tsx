import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  GestureResponderEvent
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

export interface ButtonProps {
  onPress: (event: GestureResponderEvent) => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outlined' | 'danger' | 'text';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  enableHaptics?: boolean;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  enableHaptics = true
}: ButtonProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled || loading) return;
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(event);
  };

  const getButtonStyles = (): ViewStyle[] => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
    };

    // Size styles
    let sizeStyle: ViewStyle = {};
    switch (size) {
      case 'sm':
        sizeStyle = { paddingVertical: spacing.sm, paddingHorizontal: spacing.md };
        break;
      case 'lg':
        sizeStyle = { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl };
        break;
      case 'md':
      default:
        sizeStyle = { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };
        break;
    }

    // Variant styles
    let variantStyle: ViewStyle = {};
    switch (variant) {
      case 'primary':
        variantStyle = {
          backgroundColor: colors.primary500,
          ...shadows.sm,
        };
        break;
      case 'secondary':
        variantStyle = {
          backgroundColor: colors.primary100,
        };
        break;
      case 'outlined':
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary500,
        };
        break;
      case 'danger':
        variantStyle = {
          backgroundColor: colors.error500,
          ...shadows.sm,
        };
        break;
      case 'text':
        variantStyle = {
          backgroundColor: 'transparent',
        };
        break;
    }

    if (disabled) {
      variantStyle = {
        ...variantStyle,
        backgroundColor: variant === 'outlined' || variant === 'text' ? 'transparent' : colors.neutral200,
        borderColor: variant === 'outlined' ? colors.neutral300 : undefined,
        shadowOpacity: 0,
        elevation: 0,
      };
    }

    return [base, sizeStyle, variantStyle, style || {}];
  };

  const getTextStyles = (): TextStyle[] => {
    const base: TextStyle = {
      textAlign: 'center',
    };

    // Size font styles
    let fontStyle: TextStyle = {};
    switch (size) {
      case 'sm':
        fontStyle = typography.labelMedium;
        break;
      case 'lg':
        fontStyle = typography.titleLarge;
        break;
      case 'md':
      default:
        fontStyle = typography.labelLarge;
        break;
    }

    // Variant text color
    let colorStyle: TextStyle = {};
    switch (variant) {
      case 'primary':
        colorStyle = { color: colors.neutral0 };
        break;
      case 'secondary':
        colorStyle = { color: colors.primary700 };
        break;
      case 'outlined':
      case 'text':
        colorStyle = { color: colors.primary500 };
        break;
      case 'danger':
        colorStyle = { color: colors.neutral0 };
        break;
    }

    if (disabled) {
      colorStyle = { color: colors.neutral400 };
    }

    return [base, fontStyle, colorStyle, textStyle || {}];
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={getButtonStyles()}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? colors.neutral0 : colors.primary500}
        />
      ) : (
        <View style={styles.contentContainer}>
          {leftIcon && <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>}
          <Text style={getTextStyles()}>{title}</Text>
          {rightIcon && <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
