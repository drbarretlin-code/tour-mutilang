import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const getBorderColor = () => {
    if (error) return colors.error500;
    if (isFocused) return colors.primary500;
    return colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[
          styles.label,
          typography.titleSmall,
          { color: error ? colors.error500 : colors.textSecondary, marginBottom: spacing.xs },
          labelStyle
        ]}>
          {label}
        </Text>
      )}

      <View style={[
        styles.inputWrapper,
        {
          borderColor: getBorderColor(),
          borderRadius: borderRadius.md,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: spacing.md,
          height: 48,
        }
      ]}>
        {leftIcon && <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.textInput,
            typography.bodyMedium,
            { color: colors.text, flex: 1 },
            inputStyle
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {rightIcon && <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View>}
      </View>

      {error ? (
        <Text style={[
          styles.errorText,
          typography.bodySmall,
          { color: colors.error500, marginTop: spacing.xs }
        ]}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[
          styles.helperText,
          typography.bodySmall,
          { color: colors.textTertiary, marginTop: spacing.xs }
        ]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  textInput: {
    height: '100%',
    padding: 0, // React Native Android default padding reset
  },
  errorText: {
    fontWeight: '500',
  },
  helperText: {},
});
