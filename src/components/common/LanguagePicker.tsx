import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_LOCALES, LocaleCode, t } from '../../i18n';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const LanguagePicker: React.FC<Props> = ({ visible, onClose }) => {
  const { locale, changeLanguage } = useLanguage();
  const { colors, typography, spacing, borderRadius } = useTheme();

  const handleSelect = async (code: LocaleCode) => {
    await changeLanguage(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
              {t('settings.language')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={SUPPORTED_LOCALES}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isSelected = item.code === locale;
              return (
                <TouchableOpacity
                  style={[
                    styles.item,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primary50 }
                  ]}
                  onPress={() => handleSelect(item.code)}
                >
                  <Text style={[
                    typography.bodyMedium,
                    { color: isSelected ? colors.primary700 : colors.text },
                    isSelected && { fontWeight: '700' }
                  ]}>
                    {item.nativeLabel} {String(item.code) !== String(item.label) && String(item.nativeLabel) !== String(item.label) ? `(${item.label})` : ''}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.primary600} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: 300,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    padding: 4,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
  }
});
