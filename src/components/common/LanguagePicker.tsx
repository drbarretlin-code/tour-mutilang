import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { SUPPORTED_LOCALES, LocaleCode } from '../../i18n';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  // We no longer need visible/onClose since it's a dropdown, but keeping the signature empty
}

export const LanguagePicker: React.FC<Props> = () => {
  const { locale, changeLanguage } = useLanguage();
  const { colors, typography } = useTheme();

  // Create a customized data array for the dropdown
  const dropdownData = SUPPORTED_LOCALES.map((item) => ({
    label: `${item.flag} ${item.nativeLabel}`,
    value: item.code,
  }));

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
    borderColor: 'transparent', // Will inherit from theme if needed, but surface usually looks clean
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
