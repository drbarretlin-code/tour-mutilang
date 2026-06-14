import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Linking, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSurvey } from '../../context/SurveyContext';
import { aiService } from '../../services/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../../i18n';
import { usePAC } from '../../context/PACContext';
import { COVERED_GUIDE_COUNTRIES, fetchGuidePack, tryFetchUnlistedGuidePack } from '../../services/guidePacks';
import { useResponsive } from '../../hooks/useResponsive';
import { PACEngine } from '../../services/pac';
import { getFallbackGuideInfo } from '../../services/ai';

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

interface WeatherAdvice {
  season: string;
  tempRange: string;
  description: string;
  clothing: string;
  tips: string[];
}

const getWeatherAdvice = (country: string, month: number, isEn: boolean): WeatherAdvice => {
  const cLower = country.toLowerCase();
  const isTropical = cLower.includes('泰國') || cLower.includes('thailand') ||
                     cLower.includes('新加坡') || cLower.includes('singapore') ||
                     cLower.includes('馬來西亞') || cLower.includes('malaysia') ||
                     cLower.includes('菲律賓') || cLower.includes('philippines') ||
                     cLower.includes('越南') || cLower.includes('vietnam') ||
                     cLower.includes('印尼') || cLower.includes('indonesia') ||
                     cLower.includes('曼谷') || cLower.includes('bangkok') ||
                     cLower.includes('普吉') || cLower.includes('phuket') ||
                     cLower.includes('峇里') || cLower.includes('bali');

  if (isTropical) {
    const isRainy = month >= 5 && month <= 10;
    if (isRainy) {
      return {
        season: isEn ? 'Rainy Season (Monsoon)' : '雨季 (季風氣候)',
        tempRange: '26°C - 33°C',
        description: isEn 
          ? 'Hot and humid with frequent rainstorms or afternoon showers.' 
          : '高溫潮濕，常有午後雷陣雨或持續性降雨。',
        clothing: isEn 
          ? 'Light, breathable cotton clothing. Short sleeves and shorts. Wear waterproof sandals.' 
          : '輕便、透氣防汗的棉質衣物。短袖短褲為佳，建議穿防滑且防水的涼鞋或拖鞋。',
        tips: isEn 
          ? ['Always carry an umbrella or light raincoat.', 'Be prepared for sudden heavy downpours.', 'Stay hydrated and use sun protection.'] 
          : ['隨身攜帶雨具（摺疊傘或輕便雨衣）。', '注意午後強降雨，避免積水路段。', '多喝水防中暑，即使陰天也要注意防曬。']
      };
    } else {
      return {
        season: isEn ? 'Dry Season (Cooler)' : '乾季 (涼季)',
        tempRange: '24°C - 32°C',
        description: isEn 
          ? 'Sunny and warm, the most comfortable time to visit.' 
          : '晴朗溫暖，降雨極少，是最適宜旅遊的季節。',
        clothing: isEn 
          ? 'Summer clothing, sunglasses, and a sunhat. A light jacket might be useful for strong air conditioning indoors.' 
          : '夏季清涼衣物，墨鏡及防曬帽。室內冷氣通常較強，建議隨身攜帶薄外套。',
        tips: isEn 
          ? ['UV index is very high; apply sunscreen regularly.', 'Great time for outdoor and beach activities.', 'Drink plenty of fluids.'] 
          : ['紫外線指數高，請定時塗抹防曬乳。', '極適合進行戶外與沙灘活動。', '注意水分補充。']
      };
    }
  }
  
  const isWinter = month === 12 || month === 1 || month === 2;
  const isSpring = month === 3 || month === 4 || month === 5;
  const isSummer = month === 6 || month === 7 || month === 8;
  
  if (isWinter) {
    const needsHeavyCoat = !cLower.includes('台灣') && !cLower.includes('taiwan');
    return {
      season: isEn ? 'Winter' : '冬季',
      tempRange: needsHeavyCoat ? '-5°C - 8°C' : '12°C - 19°C',
      description: isEn 
        ? 'Cold and dry, snow is common in northern areas. Short daylight hours.' 
        : '寒冷乾燥，北部地區易有降雪或強風，日照時間較短。',
      clothing: isEn 
        ? 'Layered clothing: thermal underwear, sweater, heavy coat or down jacket, gloves, and scarf.' 
        : '洋蔥式穿法：發熱衣、毛衣、防風保暖外套或羽絨衣，並配戴圍巾與防寒手套。',
      tips: isEn 
        ? ['Watch out for icy, slippery roads.', 'Moisturize skin to prevent dryness.', 'Double check sunset times before outdoor trips.'] 
        : ['部分路面可能結冰濕滑，行走請注意防滑。', '天氣乾燥，注意皮膚保濕。', '日落時間較早，室外行程建議提早出發。']
    };
  } else if (isSpring) {
    return {
      season: isEn ? 'Spring' : '春季',
      tempRange: '12°C - 22°C',
      description: isEn 
        ? 'Pleasant and mild weather. Beautiful cherry blossom and flower seasons.' 
        : '氣候宜人，冷暖適中。正值櫻花或春季花卉盛開的季節。',
      clothing: isEn 
        ? 'Long sleeves, light sweaters, with a windbreaker or denim jacket for chilly mornings and nights.' 
        : '長袖襯衫、針織衫，早晚溫差大，隨身攜帶防風外套或牛仔外套。',
      tips: isEn 
        ? ['Weather can be unpredictable; carry a light jacket.', 'Popular spots can be crowded due to blossom festivals.', 'Allergy season; carry antihistamines if needed.'] 
        : ['春季天氣多變，建議隨身準備外套。', '花季景點人潮眾多，建議提早規劃交通。', '花粉過敏者請備妥口罩或藥品。']
    };
  } else if (isSummer) {
    return {
      season: isEn ? 'Summer' : '夏季',
      tempRange: '25°C - 35°C',
      description: isEn 
        ? 'Hot and humid with occasional typhoons or rainy periods.' 
        : '炎熱潮濕，紫外線強烈，偶有颱風或梅雨鋒面帶來的降雨。',
      clothing: isEn 
        ? 'Light t-shirts, shorts, breathable fabrics, and comfortable walking shoes.' 
        : '短袖 T 恤、短褲、防曬衣物，選擇透氣舒適的鞋子。',
      tips: isEn 
        ? ['High risk of heatstroke; stay hydrated.', 'Check weather alerts for typhoons or heavy rain.', 'Sunscreen and insect repellent are essential.'] 
        : ['高溫炎熱注意防暑，適時補充水分。', '隨時關注颱風或大雨特報。', '防曬乳與防蚊液為必備品。']
    };
  } else {
    return {
      season: isEn ? 'Autumn' : '秋季',
      tempRange: '15°C - 24°C',
      description: isEn 
        ? 'Cool, dry, and comfortable with autumn leaves. Excellent travel weather.' 
        : '涼爽乾燥，氣候舒適，楓葉轉紅，是極佳的旅遊季節。',
      clothing: isEn 
        ? 'T-shirts with a light cardigan, sweater, or casual jacket. Long pants.' 
        : '短袖搭配薄針織衫、針織外套，或休閒長袖、薄夾克，下身穿長褲。',
      tips: isEn 
        ? ['Excellent time for photography.', 'Warm during the day but cold at night; dress in layers.', 'Pre-book popular foliage viewing locations.'] 
        : ['天氣晴朗極適合拍照。', '晝夜溫差大，注意保暖防寒。', '賞楓熱門景點建議提前預訂門票或交通。']
    };
  }
};

export function DestinationGuide({ onNavigateToTranslator, countryName }: Props) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { survey } = useSurvey();
  const { pacState } = usePAC();
  const { isLargeScreen } = useResponsive();
  
  const [loading, setLoading] = useState(true);
  const [guideData, setGuideData] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeMode, setExchangeMode] = useState<'TWD_TO_LOCAL' | 'LOCAL_TO_TWD'>('TWD_TO_LOCAL');
  const [amountStr, setAmountStr] = useState('1000');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloading, setDownloading] = useState(false);

  const getCountryName = () => countryName || (survey.destinations && survey.destinations.length > 0
    ? survey.destinations[0].country || survey.destinations[0].name
    : '泰國'); // fallback

  const loadGuideData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const country = getCountryName();

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
        // 2. 取得內建離線指南資料
        console.log('[DestinationGuide] No cache, loading offline guide for:', country);
        data = await aiService.getDestinationGuideInfo(country);

        // 2b. 若目的地未涵蓋於內建範本，檢查是否已下載過該國家的離線指南範本
        if (data && !data.isCovered && data.countryKey) {
          try {
            const packCache = await cacheGet(`@guide_pack_${data.countryKey}`);
            if (packCache) {
              const pack = JSON.parse(packCache);
              if (pack && pack.currencyCode && Array.isArray(pack.emergencyContacts)) {
                data = { ...data, ...pack, isCovered: true, downloaded: true };
              }
            }
          } catch (e) {
            console.warn('[DestinationGuide] Guide pack cache read error:', e);
          }
        }

        if (data && data.currencyCode && Array.isArray(data.emergencyContacts)) {
          console.log('[DestinationGuide] Guide data loaded, caching...');
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
        setErrorMsg('無法取得當地指南資料。');
      }

    } catch (error) {
      console.error('Failed to load guide data', error);
      setErrorMsg('載入當地指南時發生非預期的錯誤。');
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
    const country = getCountryName();
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

  const handleDownloadGuidePack = async () => {
    const downloadable = guideData?.downloadableCountry;
    if (!downloadable || downloading) return;

    setDownloading(true);
    try {
      // 使用 PAC 的 executeWithHealing 實現指數退避重試
      const pack = await PACEngine.executeWithHealing(
        () => fetchGuidePack(downloadable.key),
        () => getFallbackGuideInfo(downloadable.key),
        `fetchGuidePack_${downloadable.key}`,
        3,
        ['GUIDE_PACK_NOT_FOUND', 'GUIDE_PACK_INVALID']
      );
      await cacheSet(`@guide_pack_${downloadable.key}`, JSON.stringify(pack));
      await cacheSet(`@guide_data_${getCountryName()}`, '');
      await loadGuideData();
    } catch (e) {
      console.warn('[DestinationGuide] Guide pack download failed:', e);
      const message = `下載「${downloadable.label}」離線指南失敗，請確認網路連線後再試一次。`;
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('下載失敗', message);
    } finally {
      setDownloading(false);
    }
  };

  const handleTryDownloadUnlisted = async () => {
    const candidateKey = guideData?.candidateKey;
    if (!candidateKey || downloading) return;

    setDownloading(true);
    try {
      const pack = await PACEngine.executeWithHealing(
        () => tryFetchUnlistedGuidePack(candidateKey),
        () => getFallbackGuideInfo(candidateKey),
        `tryFetchGuidePack_${candidateKey}`,
        2, // fewer retries for unlisted
        ['GUIDE_PACK_NOT_FOUND', 'GUIDE_PACK_INVALID']
      );
      await cacheSet(`@guide_pack_${candidateKey}`, JSON.stringify(pack));
      await cacheSet(`@guide_data_${getCountryName()}`, '');
      await loadGuideData();
    } catch (e) {
      console.warn('[DestinationGuide] Unlisted guide pack download failed:', e);
      const message = t('itinerary.destinationGuide.downloadNotAvailable');
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('itinerary.destinationGuide.tryDownload'), message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* 真正離線時才示警；網路正常時的內建精選指南並非「降級」，不顯示警示橫幅。 */}
      {pacState.network !== 'online' && (
        <View style={[
          styles.offlineBanner,
          {
            backgroundColor: colors.warning50,
            borderColor: colors.warning200,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
            padding: spacing.md
          }
        ]}>
          <View style={styles.offlineBannerContent}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning800} style={{ marginRight: 8 }} />
            <Text style={[typography.bodyMedium, { color: colors.warning800, fontWeight: '600', flex: 1 }]}>
              離線模式：目前為您顯示已暫存之當地指南。
            </Text>
          </View>
        </View>
      )}

      {/* 內建離線範本涵蓋範圍說明 + 下載額外國家指南 */}
      {guideData?.isFallback && (
        <View style={[
          styles.offlineBanner,
          {
            backgroundColor: colors.primary50,
            borderColor: colors.primary100,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
            padding: spacing.md
          }
        ]}>
          <View style={styles.offlineBannerContent}>
            <Ionicons
              name={guideData.isCovered ? 'shield-checkmark-outline' : 'information-circle-outline'}
              size={18}
              color={colors.primary700}
              style={{ marginRight: 8 }}
            />
            <Text style={[typography.bodySmall, { color: colors.primary700, flex: 1 }]}>
              {guideData.isCovered
                ? t('itinerary.destinationGuide.coveredInfo')
                : t('itinerary.destinationGuide.coveredCountries', { countries: COVERED_GUIDE_COUNTRIES.map(c => c.label).join('／') })}
            </Text>
          </View>

          {!guideData.isCovered && (
            <View style={{ marginTop: 8 }}>
              <Text style={[typography.bodySmall, { color: colors.primary700, marginBottom: (guideData.downloadableCountry || guideData.candidateKey) ? 8 : 0 }]}>
                {guideData.downloadableCountry
                  ? t('itinerary.destinationGuide.notCoveredWithDownload', { label: guideData.downloadableCountry.label })
                  : t('itinerary.destinationGuide.noGuideTemplate')}
              </Text>
              {guideData.downloadableCountry && (
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md, opacity: downloading ? 0.6 : 1 }]}
                  onPress={handleDownloadGuidePack}
                  disabled={downloading}
                >
                  {downloading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="cloud-download-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  }
                  <Text style={[typography.labelMedium, { color: '#fff', fontWeight: '700' }]}>
                    {downloading ? t('itinerary.destinationGuide.downloading') : t('itinerary.destinationGuide.downloadLabel', { label: guideData.downloadableCountry.label })}
                  </Text>
                </TouchableOpacity>
              )}
              {!guideData.downloadableCountry && guideData.candidateKey && (
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md, opacity: downloading ? 0.6 : 1 }]}
                  onPress={handleTryDownloadUnlisted}
                  disabled={downloading}
                >
                  {downloading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="cloud-download-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  }
                  <Text style={[typography.labelMedium, { color: '#fff', fontWeight: '700' }]}>
                    {downloading ? t('itinerary.destinationGuide.downloading') : t('itinerary.destinationGuide.tryDownloadLabel')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Weather & Attire Suggestions Card */}
      {(() => {
        const start = new Date(survey?.dates?.startDate || Date.now());
        const month = start.getMonth() + 1;
        const locale = survey?.locale || 'zh-TW';
        const isEn = !locale.startsWith('zh');
        const country = getCountryName();
        const advice = getWeatherAdvice(country, month, isEn);
        
        return (
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.iconBox, { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name="sunny-outline" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '800' }]}>
                    {isEn ? 'Seasonal Weather & Attire' : '季節氣候與穿著建議'}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {isEn ? `Travel Month: ${month} (Season: ${advice.season})` : `出發月份：${month} 月 (季節：${advice.season})`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: colors.primary50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                  <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>
                    {advice.tempRange}
                  </Text>
                </View>
                <Text style={[typography.bodyMedium, { color: colors.text, flex: 1, fontWeight: '600' }]}>
                  {advice.description}
                </Text>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: 4 }]}>
                  {isEn ? 'WHAT TO WEAR' : '建議穿著'}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.text, lineHeight: 20 }]}>
                  {advice.clothing}
                </Text>
              </View>

              <View style={{ backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, padding: 12, marginTop: 4 }}>
                <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: 6 }]}>
                  {isEn ? 'WEATHER TIPS' : '出行貼心提示'}
                </Text>
                {advice.tips.map((tip, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: index === advice.tips.length - 1 ? 0 : 6 }}>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginRight: 6 }]}>•</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1, lineHeight: 18 }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })()}

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

        <View style={[styles.exchangeContentRow, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
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
      <View style={[styles.bottomColumns, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
        
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
            <Text style={[typography.bodyMedium, { color: colors.text, flexShrink: 1 }]}>{t('itinerary.destinationGuide.phrases.translator')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* 直接前往 Google AI Studio 申請所需的 API 金鑰 */}
              <TouchableOpacity
                style={[styles.openToolBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary200, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
              >
                <Ionicons name="key-outline" size={14} color={colors.primary700} />
                <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>{t('itinerary.destinationGuide.phrases.applyApiKey')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.openToolBtn, { backgroundColor: colors.primary50, borderRadius: borderRadius.md }]}
                onPress={onNavigateToTranslator}
              >
                <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>{t('itinerary.destinationGuide.phrases.openTool')}</Text>
              </TouchableOpacity>
            </View>
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
  offlineBanner: {
    borderWidth: 1,
  },
  offlineBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
});
