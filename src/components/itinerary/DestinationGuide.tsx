import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSurvey } from '../../context/SurveyContext';
import { aiService } from '../../services/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../../i18n';

// Web-safe cache helpers: bypass AsyncStorage on Web (unreliable) and use localStorage directly
const cacheGet = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  try { return await AsyncStorage.getItem(key); } catch { return null; }
};
const cacheSet = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  try { await AsyncStorage.setItem(key, value); } catch {}
};

interface Props {
  onNavigateToTranslator: () => void;
  countryName?: string;
}

export function DestinationGuide({ onNavigateToTranslator, countryName }: Props) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { survey } = useSurvey();
  
  const [loading, setLoading] = useState(true);
  const [guideData, setGuideData] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeMode, setExchangeMode] = useState<'TWD_TO_LOCAL' | 'LOCAL_TO_TWD'>('TWD_TO_LOCAL');
  const [amountStr, setAmountStr] = useState('1000');
  const [errorMsg, setErrorMsg] = useState('');

  const loadGuideData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const country = countryName || (survey.destinations && survey.destinations.length > 0 
        ? survey.destinations[0].country || survey.destinations[0].name 
        : '泰國'); // fallback

      // 1. 嘗試從 Cache 讀取 (Web 使用 localStorage，Native 使用 AsyncStorage)
      const cacheKey = `@guide_data_${country}`;
      let cached = null;
      try {
        cached = await cacheGet(cacheKey);
      } catch (e) {
        console.warn('[DestinationGuide] Cache read error:', e);
      }

      let data = null;

      if (cached) {
        try {
          data = JSON.parse(cached);
          if (!data || !data.currencyCode || !Array.isArray(data.emergencyContacts)) {
            console.warn('[DestinationGuide] Invalid or stale cache detected, bypassing:', cached);
            data = null;
            await cacheSet(cacheKey, '');
          } else {
            console.log('[DestinationGuide] Loaded from cache for:', country);
          }
        } catch (e) {
          console.warn('[DestinationGuide] Cache JSON parse error:', e);
          data = null;
        }
      }

      if (!data) {
        // 2. 呼叫 AI 產生
        console.log('[DestinationGuide] No cache, calling AI for:', country);
        data = await aiService.getDestinationGuideInfo(country);
        if (data && data.currencyCode && Array.isArray(data.emergencyContacts)) {
          console.log('[DestinationGuide] AI returned valid data, caching...');
          try {
            await cacheSet(cacheKey, JSON.stringify(data));
          } catch (e) {
            console.warn('[DestinationGuide] Cache write error:', e);
          }
        }
      }

      if (data) {
        setGuideData(data);

        // 3. 獲取真實匯率 (獨立 Try-Catch 避免影響畫面顯示)
        try {
          const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/TWD');
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            const targetRate = data.currencyCode && rateData.rates[data.currencyCode] 
              ? rateData.rates[data.currencyCode] 
              : 1;
            setExchangeRate(targetRate);
          }
        } catch (error) {
          console.warn('Failed to fetch exchange rate', error);
        }
      } else {
        setErrorMsg('無法從 AI 獲取當地指南資料。');
      }

    } catch (error) {
      console.error('Failed to load guide data', error);
      const isMissingKey = error instanceof Error && error.message === 'MISSING_API_KEY';
      setErrorMsg(isMissingKey ? '缺少 Gemini API Key。請先至首頁設定 API Key 以啟用智慧引擎。' : '載入當地指南時發生非預期的錯誤。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuideData();
  }, [countryName, survey.destinations]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 400 }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 16 }]}>{t('itinerary.destinationGuide.loading')}</Text>
      </View>
    );
  }

  if (errorMsg || !guideData) {
    const country = countryName || (survey.destinations && survey.destinations.length > 0 
      ? survey.destinations[0].country || survey.destinations[0].name 
      : '泰國');
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 400 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 16, textAlign: 'center' }]}>
          {errorMsg || '目前沒有可用資料'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          <TouchableOpacity 
            style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary50, borderRadius: borderRadius.md }}
            onPress={loadGuideData}
          >
            <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>重試</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border }}
            onPress={async () => {
              const cacheKey = `@guide_data_${country}`;
              await cacheSet(cacheKey, '');
              loadGuideData();
            }}
          >
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>清除快取重試</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { currencyCode, currencyName, emergencyContacts, usefulPhrases, guideItems } = guideData;
  const amount = parseFloat(amountStr) || 0;

  const convertedAmount = exchangeMode === 'TWD_TO_LOCAL' 
    ? (amount * exchangeRate).toFixed(2)
    : (amount / exchangeRate).toFixed(2);

  const toggleExchangeMode = () => {
    setExchangeMode(prev => prev === 'TWD_TO_LOCAL' ? 'LOCAL_TO_TWD' : 'TWD_TO_LOCAL');
    setAmountStr(parseFloat(convertedAmount).toFixed(0));
  };

  const handleQuickAmount = (val: number) => {
    setAmountStr(val.toString());
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* 1. Exchange Rate Calculator Card */}
      <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg }]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FFB800' }]}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>$</Text>
            </View>
            <View>
              <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '800' }]}>{t('itinerary.destinationGuide.exchange.title', { currencyName })}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{t('itinerary.destinationGuide.exchange.subtitle', { rate: exchangeRate.toFixed(2), code: currencyCode })}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={[styles.modeToggleBtn, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.full }]} onPress={toggleExchangeMode}>
            <Text style={[typography.labelMedium, { color: colors.text }]}>
              {exchangeMode === 'TWD_TO_LOCAL' ? t('itinerary.destinationGuide.exchange.twdToLocal', { code: currencyCode }) : t('itinerary.destinationGuide.exchange.localToTwd', { code: currencyCode })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.exchangeContentRow}>
          {/* Left: Input & Output */}
          <View style={styles.exchangeInputSection}>
            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: 8 }]}>
              {exchangeMode === 'TWD_TO_LOCAL' ? t('itinerary.destinationGuide.exchange.inputTwd') : t('itinerary.destinationGuide.exchange.inputLocal', { name: currencyName, code: currencyCode })}
            </Text>
            <View style={[styles.inputBox, { borderColor: colors.border, borderRadius: borderRadius.md }]}>
              <Text style={[typography.titleMedium, { color: colors.textTertiary, marginRight: 8 }]}>$</Text>
              <TextInput
                style={[typography.headlineMedium, { flex: 1, color: colors.text, fontWeight: '700' }]}
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0"
              />
              <Text style={[typography.titleMedium, { color: colors.textTertiary }]}>
                {exchangeMode === 'TWD_TO_LOCAL' ? 'TWD' : currencyCode}
              </Text>
            </View>

            <View style={styles.switchIconWrapper}>
              <TouchableOpacity onPress={toggleExchangeMode} style={[styles.switchIconButton, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: 8 }]}>
              {t('itinerary.destinationGuide.exchange.resultLabel', { code: exchangeMode === 'TWD_TO_LOCAL' ? currencyCode : 'TWD' })}
            </Text>
            <View style={[styles.resultBox, { backgroundColor: '#E8FBF4', borderRadius: borderRadius.md }]}>
              <Text style={[typography.headlineMedium, { color: '#008A5E', fontWeight: '800' }]} numberOfLines={1}>
                {exchangeMode === 'TWD_TO_LOCAL' ? '' : 'NT$'} {parseFloat(convertedAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
              <View style={[styles.currencyBadge, { backgroundColor: '#D1F4E6', borderRadius: borderRadius.sm }]}>
                <Text style={[typography.labelSmall, { color: '#008A5E', fontWeight: '700' }]}>
                  {exchangeMode === 'TWD_TO_LOCAL' ? `${currencyCode} ${currencyName}` : t('itinerary.destinationGuide.exchange.twdLabel')}
                </Text>
              </View>
            </View>
          </View>

          {/* Right: Quick Guide */}
          <View style={[styles.exchangeGuideSection, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md }]}>
            <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700', marginBottom: 12 }]}>
              {t('itinerary.destinationGuide.guide.title', { code: currencyCode })}
            </Text>
            
            {guideItems && guideItems.map((item: any, idx: number) => (
              <View key={idx} style={styles.guideRow}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, flex: 1 }]}>{item.item}</Text>
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>{item.priceRange}</Text>
              </View>
            ))}

            <View style={{ marginTop: 16 }}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: 8 }]}>{t('itinerary.destinationGuide.guide.quickSelect')}</Text>
              <View style={styles.quickChips}>
                {[500, 1000, 3000, 5000].map(val => (
                  <TouchableOpacity 
                    key={val} 
                    style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleQuickAmount(val)}
                  >
                    <Text style={[typography.labelMedium, { color: colors.text }]}>{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Bottom Two Columns */}
      <View style={styles.bottomColumns}>
        
        {/* Left: Emergency Contacts */}
        <View style={[styles.card, styles.columnCard, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[typography.titleLarge, { color: colors.error600, fontWeight: '800', marginBottom: 16, flexDirection: 'row', alignItems: 'center' }]}>
            {t('itinerary.destinationGuide.emergency.title')}
          </Text>
          
          {emergencyContacts && emergencyContacts.map((contact: any, index: number) => (
            <View key={index} style={[styles.contactRow, index !== emergencyContacts.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>{contact.title}</Text>
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>{contact.subTitle}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.phoneBadge, { backgroundColor: colors.error50, borderRadius: borderRadius.full }]}
                onPress={() => handleCall(contact.phone)}
              >
                <Text style={[typography.titleMedium, { color: colors.error700, fontWeight: '800' }]}>{contact.phone}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Right: Useful Phrases */}
        <View style={[styles.card, styles.columnCard, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <Text style={[typography.titleLarge, { color: colors.primary700, fontWeight: '800', marginBottom: 16 }]}>
            {t('itinerary.destinationGuide.phrases.title')}
          </Text>

          {usefulPhrases && usefulPhrases.map((phrase: any, index: number) => (
            <View key={index} style={[styles.phraseRow, phrase.isHighlight && { backgroundColor: colors.warning50, borderRadius: borderRadius.md, paddingHorizontal: 12, marginHorizontal: -12 }]}>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{phrase.zh}</Text>
              <Text style={[typography.titleMedium, { color: phrase.isHighlight ? colors.warning700 : colors.primary600, fontWeight: '700' }]}>{phrase.local}</Text>
            </View>
          ))}

          <View style={{ flex: 1 }} />

          <View style={[styles.toolRow, { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 16, marginTop: 16 }]}>
            <Text style={[typography.bodyMedium, { color: colors.text }]}>{t('itinerary.destinationGuide.phrases.translator')}</Text>
            <TouchableOpacity 
              style={[styles.openToolBtn, { backgroundColor: colors.primary50, borderRadius: borderRadius.md }]}
              onPress={onNavigateToTranslator}
            >
              <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>{t('itinerary.destinationGuide.phrases.openTool')}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exchangeContentRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 24,
  },
  exchangeInputSection: {
    flex: 1,
  },
  exchangeGuideSection: {
    flex: 1,
    padding: 20,
  },
  inputBox: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchIconWrapper: {
    alignItems: 'center',
    height: 1,
    zIndex: 10,
    marginVertical: 16,
  },
  switchIconButton: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 6,
    position: 'absolute',
    top: -16,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  currencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  guideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  bottomColumns: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
  },
  columnCard: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  phoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phraseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openToolBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
