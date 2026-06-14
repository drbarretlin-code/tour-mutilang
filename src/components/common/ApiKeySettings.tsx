import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { t } from '../../i18n';
import {
  getUserGeoapifyKey,
  setUserGeoapifyKey,
  clearUserGeoapifyKey,
  getGeocoderStatus,
  isGeoapifyQuotaExceeded,
  resetQuotaExceededFlag,
  loadUserGeoapifyKey
} from '../../services/geocoder';

interface Props {
  visible: boolean;
}

export const ApiKeySettings: React.FC<Props> = ({ visible }) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState(getGeocoderStatus());
  const [quotaExceeded, setQuotaExceeded] = useState(isGeoapifyQuotaExceeded());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Load key and status on mount and when visible changes
  useEffect(() => {
    const init = async () => {
      await loadUserGeoapifyKey();
      setKeyInput(getUserGeoapifyKey() || '');
      setStatus(getGeocoderStatus());
      setQuotaExceeded(isGeoapifyQuotaExceeded());
    };
    if (visible) {
      init();
    }
  }, [visible]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  const handleSave = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      await handleClear();
      return;
    }
    await setUserGeoapifyKey(trimmed);
    resetQuotaExceededFlag();
    setQuotaExceeded(false);
    setStatus(getGeocoderStatus());
    setFeedbackMsg(t('settings.apiKeySettings.saved'));
  };

  const handleClear = async () => {
    await clearUserGeoapifyKey();
    resetQuotaExceededFlag();
    setQuotaExceeded(false);
    setKeyInput('');
    setStatus(getGeocoderStatus());
    setFeedbackMsg(t('settings.apiKeySettings.cleared'));
  };

  const handleApplyKey = () => {
    Linking.openURL('https://myprojects.geoapify.com/register');
  };

  const getStatusText = () => {
    if (status.isUserKey) {
      return t('settings.apiKeySettings.statusCustom');
    }
    if (status.hasKey) {
      return t('settings.apiKeySettings.statusBuiltIn');
    }
    return t('settings.apiKeySettings.statusNone');
  };

  return (
    <View style={[styles.container, { display: visible ? 'flex' : 'none', backgroundColor: colors.cardBackground, borderColor: colors.border, borderRadius: borderRadius.lg, ...shadows.md }]}>
      <View style={styles.headerRow}>
        <Ionicons name="key-outline" size={20} color={colors.primary500} />
        <Text style={[typography.titleMedium, { color: colors.text, marginLeft: spacing.sm, fontWeight: '700' }]}>
          {t('settings.apiKeySettings.title')}
        </Text>
      </View>

      <View style={[styles.statusBox, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md }]}>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
          {getStatusText()}
        </Text>
      </View>

      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.md, lineHeight: 18 }]}>
        {t('settings.apiKeySettings.geoapifyHint')}
      </Text>

      {quotaExceeded && (
        <View style={[styles.warningBox, { borderColor: colors.error300, backgroundColor: colors.error50 || 'rgba(239, 68, 68, 0.08)', borderRadius: borderRadius.md }]}>
          <Ionicons name="warning-outline" size={18} color={colors.error500} style={{ marginRight: spacing.xs }} />
          <Text style={[typography.bodySmall, { color: colors.error600 || colors.error500, flex: 1, fontWeight: '500' }]}>
            {t('settings.apiKeySettings.quotaExceeded')}
          </Text>
        </View>
      )}

      <Text style={[typography.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
        {t('settings.apiKeySettings.geoapifyLabel')}
      </Text>

      <TextInput
        style={[styles.input, {
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          color: colors.text,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: spacing.md,
          ...typography.bodyMedium
        }]}
        placeholder={t('settings.apiKeySettings.inputPlaceholder')}
        placeholderTextColor={colors.textTertiary}
        value={keyInput}
        onChangeText={setKeyInput}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md }]}
          onPress={handleSave}
        >
          <Text style={[typography.bodyMedium, { color: '#ffffff', fontWeight: '600' }]}>
            {t('settings.apiKeySettings.save')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.clearBtn, { borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md }]}
          onPress={handleClear}
        >
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, fontWeight: '500' }]}>
            {t('settings.apiKeySettings.clear')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.linkBtn} onPress={handleApplyKey}>
        <Text style={[typography.bodyMedium, { color: colors.primary500, fontWeight: '500' }]}>
          {t('settings.apiKeySettings.applyLink')}
        </Text>
        <Ionicons name="open-outline" size={16} color={colors.primary500} style={{ marginLeft: spacing.xs }} />
      </TouchableOpacity>

      {feedbackMsg && (
        <View style={[styles.feedbackBox, { backgroundColor: colors.success50 || 'rgba(16, 185, 129, 0.08)', borderRadius: borderRadius.md }]}>
          <Text style={[typography.bodySmall, { color: colors.success600 || colors.success500, fontWeight: '500' }]}>
            {feedbackMsg}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBox: {
    padding: 8,
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {},
  clearBtn: {},
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  feedbackBox: {
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
});
