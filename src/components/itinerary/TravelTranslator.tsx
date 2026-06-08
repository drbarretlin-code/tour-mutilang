import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TripSurvey } from '../../types/survey';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import { aiService } from '../../services/ai';
import * as Speech from 'expo-speech';

interface TravelTranslatorProps {
  survey: TripSurvey;
}

interface TravelPhrase {
  chinese: string;
  english: string;
  japanese: string;
  korean: string;
  thai: string;
  vietnamese: string;
}

export function TravelTranslator({ survey }: TravelTranslatorProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState<'english' | 'japanese' | 'korean' | 'thai' | 'vietnamese'>('english');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'handbook'>('live');
  const [activeCategory, setActiveCategory] = useState<'general' | 'dining' | 'transport' | 'emergency'>('general');

  // Detect and set recommended target language based on survey destinations
  React.useEffect(() => {
    const primaryDest = survey.destinations[0]?.name || '';
    const destStr = primaryDest.toLowerCase();
    if (destStr.includes('日本') || destStr.includes('東京') || destStr.includes('大阪') || destStr.includes('japan') || destStr.includes('tokyo') || destStr.includes('osaka')) {
      setTargetLang('japanese');
    } else if (destStr.includes('韓國') || destStr.includes('首爾') || destStr.includes('korea') || destStr.includes('seoul')) {
      setTargetLang('korean');
    } else if (destStr.includes('泰國') || destStr.includes('曼谷') || destStr.includes('thailand') || destStr.includes('bangkok')) {
      setTargetLang('thai');
    } else if (destStr.includes('越南') || destStr.includes('河內') || destStr.includes('胡志明') || destStr.includes('vietnam') || destStr.includes('hanoi')) {
      setTargetLang('vietnamese');
    } else {
      setTargetLang('english');
    }
  }, [survey.destinations]);

  // Offline Travel phrase dictionary for quick handbooks (No internet needed)
  const phrasebook: Record<'general' | 'dining' | 'transport' | 'emergency', TravelPhrase[]> = {
    general: [
      { chinese: t('itinerary.travelTranslator.phrases.general.0'), english: 'Hello', japanese: 'こんにちは (Konnichiwa)', korean: '안녕하세요 (Annyeonghaseyo)', thai: 'สวัสดี (Sawatdee)', vietnamese: 'Xin chào' },
      { chinese: t('itinerary.travelTranslator.phrases.general.1'), english: 'Thank you', japanese: 'ありがとう (Arigatou)', korean: '감사합니다 (Gamsahabnida)', thai: 'ขอบคุณ (Khob khun)', vietnamese: 'Cảm ơn' },
      { chinese: t('itinerary.travelTranslator.phrases.general.2'), english: 'Excuse me', japanese: 'すみません (Sumimasen)', korean: '실례합니다 (Sillyehabnida)', thai: 'ขอโทษ (Kho thot)', vietnamese: 'Xin lỗi' },
      { chinese: t('itinerary.travelTranslator.phrases.general.3'), english: 'How much is this?', japanese: 'これはいくらですか (Kore wa ikura desu ka)', korean: '이것은 얼마입니까 (Igeoseon eolmaimnikka)', thai: 'นี่เท่าไหร่ (Nee tao rai)', vietnamese: 'Cái này bao nhiêu tiền?' },
    ],
    dining: [
      { chinese: t('itinerary.travelTranslator.phrases.dining.0'), english: 'Menu please', japanese: 'メニューをください (Menyu wo kudasai)', korean: '메뉴판 주세요 (Menyupan juseyo)', thai: 'ขอเมนูหน่อย (Kho menu noi)', vietnamese: 'Cho tôi xem thực đơn' },
      { chinese: t('itinerary.travelTranslator.phrases.dining.1'), english: 'Water please', japanese: 'お水をください (Omizu wo kudasai)', korean: '물 좀 주세요 (Mul jom juseyo)', thai: 'ขอน้ำเปล่าหน่อย (Kho nam plao noi)', vietnamese: 'Cho tôi xin nước lọc' },
      { chinese: t('itinerary.travelTranslator.phrases.dining.2'), english: 'Does this contain peanuts?', japanese: 'これにピーナッツは入っていますか (Kore ni pinattsu wa haitte imasu ka)', korean: '여기에 땅콩이 들어있습니까 (Yeogie ttangkongi deureoisseumnikka)', thai: 'มีถั่วลิสงไหม (Mee tua lee song mai)', vietnamese: 'Món này có lạc không?' },
      { chinese: t('itinerary.travelTranslator.phrases.dining.3'), english: 'Check please', japanese: 'お会計をお願いします (Okaikei wo onegai shimasu)', korean: '계산해 주세요 (Gyesanhae juseyo)', thai: 'เช็คบิลด้วย (Check bill duay)', vietnamese: 'Cho tôi thanh toán' },
    ],
    transport: [
      { chinese: t('itinerary.travelTranslator.phrases.transport.0'), english: 'Where is the subway station?', japanese: '地下鉄の駅はどこですか (Chikatetsu no eki wa doko desu ka)', korean: '지하철역이 어디입니까 (Jihacheolyeogi eodiimnikka)', thai: 'สถานีรถไฟฟ้อยู่ไหน (Satanee rot fai fa yee nai)', vietnamese: 'Ga tàu điện ngầm ở đâu?' },
      { chinese: t('itinerary.travelTranslator.phrases.transport.1'), english: 'I want to go here', japanese: 'ここに行きたいです (Koko ni ikitai desu)', korean: '여기에 가고 싶습니다 (Yeogie gago sipseumnida)', thai: 'อยากไปที่นี่ (Yak pai tee nee)', vietnamese: 'Tôi muốn đi đến nơi này' },
      { chinese: t('itinerary.travelTranslator.phrases.transport.2'), english: 'Where is the restroom?', japanese: 'トイレはどこですか (Toire wa doko desu ka)', korean: '화장실이 어디입니까 (Hwajangsil-i eodiimnikka)', thai: 'ห้องน้ำอยู่ไหน (Hong nam yee nai)', vietnamese: 'Nhà vệ sinh ở đâu?' },
    ],
    emergency: [
      { chinese: t('itinerary.travelTranslator.phrases.emergency.0'), english: 'Call an ambulance please!', japanese: '救急車を呼んでください (Kyukyusha wo yonde kudasai)', korean: '구급차를 불러주세요 (Gugeupchareul bulleojuseyo)', thai: 'ช่วยเรียกการแพทย์หน่อย (Chuay riak rot payaban noi)', vietnamese: 'Làm ơn gọi xe cấp cứu!' },
      { chinese: t('itinerary.travelTranslator.phrases.emergency.1'), english: 'I lost my passport!', japanese: 'パスポートを紛失しました (Pasupoto wo funshitsu shimashita)', korean: '여권을 잃어버렸습니다 (Yeogwoneul ireobeoryeosseumnida)', thai: 'พาสปอร์ตหาย (Passport hai)', vietnamese: 'Tôi bị mất hộ chiếu!' },
      { chinese: t('itinerary.travelTranslator.phrases.emergency.2'), english: 'Where is the police station?', japanese: '警察署はどこですか (Keisatsusho wa doko desu ka)', korean: '경찰서가 어디입니까 (Gyeongchalseoga eodiimnikka)', thai: 'สถานีตำรวจอยู่ไหน (Satanee tamruat yee nai)', vietnamese: 'Đồn cảnh sát ở đâu?' },
    ],
  };

  // Perform AI text translation using secure API or local dictionary fallback
  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      // 1. Local phrase matcher for instant zero-cost response
      const matchedPhrase = findLocalPhrase(inputText.trim(), targetLang);
      if (matchedPhrase) {
        setTranslatedText(matchedPhrase);
        setLoading(false);
        return;
      }

      // 2. Call secure backend serverless API (Gemini translation) if configured
      const BACKEND_API_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL || '';
      if (BACKEND_API_URL) {
        const response = await fetch(`${BACKEND_API_URL}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText.trim(), targetLang })
        });
        if (response.ok) {
          const res = await response.json();
          setTranslatedText(res.translatedText);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback mock translation rule
      setTimeout(() => {
        const langNames: Record<string, string> = { 
          english: t('itinerary.travelTranslator.langs.english'), 
          japanese: t('itinerary.travelTranslator.langs.japanese'), 
          korean: t('itinerary.travelTranslator.langs.korean'), 
          thai: t('itinerary.travelTranslator.langs.thai'), 
          vietnamese: t('itinerary.travelTranslator.langs.vietnamese') 
        };
        setTranslatedText(`${t('itinerary.travelTranslator.phrases.mockPrefix', { lang: langNames[targetLang] })} ${inputText.trim()}`);
        setLoading(false);
      }, 800);

    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('itinerary.travelTranslator.errors.translationFailed'));
      setLoading(false);
    }
  };

  const findLocalPhrase = (text: string, lang: string): string | null => {
    const cleaned = text.toLowerCase();
    const categories: ('general' | 'dining' | 'transport' | 'emergency')[] = ['general', 'dining', 'transport', 'emergency'];
    
    for (const cat of categories) {
      const list = phrasebook[cat];
      const match = list.find(p => p.chinese.toLowerCase().includes(cleaned) || cleaned.includes(p.chinese.toLowerCase()));
      if (match) {
        const val = match[lang as keyof TravelPhrase];
        return val || null;
      }
    }
    return null;
  };

  const handleSpeak = (text: string, lang: string) => {
    // Basic stripping of bracketed romanization like "สวัสดี (Sawatdee)" -> "สวัสดี"
    // so the TTS engine doesn't read the romanization out loud.
    const cleanText = text.replace(/\s*\(.*?\)\s*/g, '').replace(/\[模擬翻譯 - .*?\]\s*/, '');
    
    const langMap: Record<string, string> = {
      english: 'en-US',
      japanese: 'ja-JP',
      korean: 'ko-KR',
      thai: 'th-TH',
      vietnamese: 'vi-VN'
    };
    Speech.speak(cleanText, { language: langMap[lang] || 'en-US', rate: 0.9 });
  };

  const renderPhraseItem = (phrase: TravelPhrase) => {
    const targetValue = phrase[targetLang as keyof TravelPhrase] || phrase.english;
    return (
      <Card key={phrase.chinese} style={styles.phraseCard} variant="flat">
        <View style={styles.phraseHeader}>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            {phrase.chinese}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => handleSpeak(targetValue, targetLang)} style={{ padding: 4 }}>
            <Ionicons name="volume-high" size={20} color={colors.primary500} />
          </TouchableOpacity>
        </View>
        <Text style={[typography.titleSmall, { color: colors.primary500, fontWeight: '700', marginTop: 4 }]}>
          {targetValue}
        </Text>
        {targetLang !== 'english' && (
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            {t('itinerary.travelTranslator.phrases.englishRef', { text: phrase.english })}
          </Text>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Sub Tabs Selection */}
      <View style={[styles.subTabs, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.sm }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('live')}
          style={[styles.subTab, { backgroundColor: activeTab === 'live' ? colors.background : 'transparent' }]}
        >
          <Text style={[typography.labelMedium, { color: activeTab === 'live' ? colors.primary500 : colors.textSecondary }]}>
            {t('itinerary.travelTranslator.tabs.live')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('handbook')}
          style={[styles.subTab, { backgroundColor: activeTab === 'handbook' ? colors.background : 'transparent' }]}
        >
          <Text style={[typography.labelMedium, { color: activeTab === 'handbook' ? colors.primary500 : colors.textSecondary }]}>
            {t('itinerary.travelTranslator.tabs.handbook')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'live' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Lang targets picker */}
          <Card variant="flat" style={styles.langPickerCard}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              {t('itinerary.travelTranslator.live.targetLabel')}
            </Text>
            <View style={styles.langRow}>
              {[
                { code: 'english', label: t('itinerary.travelTranslator.langs.english') },
                { code: 'japanese', label: t('itinerary.travelTranslator.langs.japanese') },
                { code: 'korean', label: t('itinerary.travelTranslator.langs.korean') },
                { code: 'thai', label: t('itinerary.travelTranslator.langs.thai') },
                { code: 'vietnamese', label: t('itinerary.travelTranslator.langs.vietnamese') },
              ].map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => setTargetLang(lang.code as any)}
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: targetLang === lang.code ? colors.primary500 : colors.background,
                      borderColor: targetLang === lang.code ? 'transparent' : colors.border,
                      borderRadius: borderRadius.xs,
                    }
                  ]}
                >
                  <Text style={{ color: targetLang === lang.code ? colors.neutral0 : colors.text, fontSize: 11, fontWeight: '600' }}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Translation inputs and outputs */}
          <Card variant="elevated" style={styles.translateBox}>
            <TextInput
              style={[
                styles.textInput,
                typography.bodyMedium,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.sm,
                  color: colors.text,
                  padding: spacing.md,
                }
              ]}
              multiline
              numberOfLines={4}
              placeholder={t('itinerary.travelTranslator.live.placeholder')}
              placeholderTextColor={colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
            />

            <Button
              title={t('itinerary.travelTranslator.live.translateBtn')}
              onPress={handleTranslate}
              loading={loading}
              style={{ marginVertical: spacing.md }}
              leftIcon={<Ionicons name="sparkles" size={16} color={colors.neutral0} />}
            />

            {translatedText ? (
              <View style={[styles.outputContainer, { backgroundColor: colors.primary50, borderRadius: borderRadius.sm, borderColor: colors.primary200 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[typography.caption, { color: colors.primary700, fontWeight: '700' }]}>
                    {t('itinerary.travelTranslator.live.resultLabel')}
                  </Text>
                  <TouchableOpacity onPress={() => handleSpeak(translatedText, targetLang)}>
                    <Ionicons name="volume-high" size={20} color={colors.primary500} />
                  </TouchableOpacity>
                </View>
                <Text style={[typography.titleMedium, { color: colors.text, marginTop: spacing.xs, fontWeight: '700' }]}>
                  {translatedText}
                </Text>
              </View>
            ) : null}
          </Card>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Phrasebook Categories Header */}
          <View style={styles.categoryRow}>
            {[
              { code: 'general', label: t('itinerary.travelTranslator.categories.general'), icon: 'chatbubble-ellipses-outline' },
              { code: 'dining', label: t('itinerary.travelTranslator.categories.dining'), icon: 'restaurant-outline' },
              { code: 'transport', label: t('itinerary.travelTranslator.categories.transport'), icon: 'bus-outline' },
              { code: 'emergency', label: t('itinerary.travelTranslator.categories.emergency'), icon: 'alert-circle-outline' },
            ].map(cat => (
              <TouchableOpacity
                key={cat.code}
                onPress={() => setActiveCategory(cat.code as any)}
                style={[
                  styles.categoryBtn,
                  {
                    backgroundColor: activeCategory === cat.code ? colors.primary500 : colors.backgroundSecondary,
                    borderRadius: borderRadius.sm
                  }
                ]}
              >
                <Ionicons name={cat.icon as any} size={18} color={activeCategory === cat.code ? colors.neutral0 : colors.primary500} />
                <Text style={{ color: activeCategory === cat.code ? colors.neutral0 : colors.text, fontSize: 10, marginTop: 4, fontWeight: '600' }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Handbook phrase items */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            {phrasebook[activeCategory].map(renderPhraseItem)}
          </ScrollView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 8,
  },
  subTabs: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 16,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPickerCard: {
    padding: 12,
    marginBottom: 16,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  translateBox: {
    padding: 16,
    marginBottom: 20,
  },
  textInput: {
    textAlignVertical: 'top',
    borderWidth: 1,
    height: 100,
  },
  outputContainer: {
    padding: 12,
    borderWidth: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 3,
  },
  phraseCard: {
    padding: 12,
    marginBottom: 8,
  },
  phraseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
