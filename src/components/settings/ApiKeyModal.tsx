import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { settingsService } from '../../services/settings';
import { t } from '../../i18n';

interface ApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApiKeyModal({ visible, onClose, onSuccess }: ApiKeyModalProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      settingsService.getApiKey().then(key => {
        if (key) setApiKey(key);
      });
    }
  }, [visible]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      await settingsService.saveApiKey(apiKey.trim());
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLink = () => {
    Linking.openURL('https://aistudio.google.com/app/apikey');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <View style={styles.header}>
            <Ionicons name="key-outline" size={24} color={colors.primary500} />
            <Text style={[typography.titleMedium, { color: colors.text, marginLeft: spacing.sm }]}>
              {t('apiKeyModal.title')}
            </Text>
          </View>

          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {t('apiKeyModal.description')}
          </Text>

          <TouchableOpacity onPress={handleLink} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.bodyMedium, { color: colors.primary500, textDecorationLine: 'underline' }]}>
              {t('apiKeyModal.linkText')}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              { 
                borderColor: colors.border, 
                backgroundColor: colors.background,
                color: colors.text,
                borderRadius: borderRadius.md,
                padding: spacing.md
              }
            ]}
            placeholder="AIzaSy..."
            placeholderTextColor={colors.textTertiary}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            secureTextEntry
          />

          <View style={[styles.footer, { marginTop: spacing.xl }]}>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md }]} 
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={[typography.labelLarge, { color: colors.text }]}>{t('apiKeyModal.cancelBtn')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md }]} 
              onPress={handleSave}
              disabled={isSaving || !apiKey.trim()}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[typography.labelLarge, { color: '#fff' }]}>{t('apiKeyModal.saveBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
