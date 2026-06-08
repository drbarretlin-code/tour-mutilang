import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { SUPPORTED_LOCALES, LocaleCode } from '../../i18n';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Props {}

export const LanguagePicker: React.FC<Props> = () => {
  const { locale, changeLanguage } = useLanguage();
  const { colors, typography } = useTheme();

  // Create a customized data array for the dropdown
  const dropdownData = SUPPORTED_LOCALES.map((item) => ({
    label: `${item.flag} ${item.nativeLabel}`,
    value: item.code,
  }));

  // On Web, use standard HTML5 select to avoid DOM reconciliation issues with absolute/modal layers
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <select
          value={locale}
          onChange={async (e) => {
            await changeLanguage(e.target.value as LocaleCode);
          }}
          style={{
            height: 36,
            paddingLeft: 12,
            paddingRight: 28,
            borderRadius: 18,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(colors.textSecondary)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            backgroundSize: 16,
            width: '100%',
          } as any}
        >
          {dropdownData.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </View>
    );
  }

  // On native platforms, render the styled react-native-element-dropdown
  return (
    <View style={styles.container}>
      <Dropdown
        style={[styles.dropdown, { backgroundColor: colors.surface }]}
        containerStyle={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        selectedTextStyle={[typography.labelMedium, { color: colors.text, fontWeight: '600' }]}
        itemTextStyle={[typography.bodyMedium, { color: colors.text }]}
        activeColor={colors.primary50}
        data={dropdownData}
        maxHeight={300}
        labelField="label"
        valueField="value"
        value={locale}
        onChange={async (item) => {
          await changeLanguage(item.value as LocaleCode);
        }}
        renderLeftIcon={() => null}
        renderRightIcon={() => (
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 130, // Adjust width as needed to fit the flag + text
  },
  dropdown: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dropdownContainer: {
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
});
