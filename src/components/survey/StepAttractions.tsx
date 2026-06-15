import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AttractionAutocomplete } from './AttractionAutocomplete';
import { parseAttractionsWithAI } from '../../services/aiPreprocessor';
import { parseGoogleMapsUrl } from '../../utils/urlParser';
import { ActivityIndicator } from 'react-native';


export function StepAttractions() {
  const {
    survey,
    addReferenceAttraction,
    removeReferenceAttraction,
    addMustVisitAttraction,
    removeMustVisitAttraction,
    addSpecificLocation,
    removeSpecificLocation
  } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Local inputs
  
  const [geminiKey, setGeminiKey] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [magicInput, setMagicInput] = useState('');

  const [specLat, setSpecLat] = useState<number>();
  const [specLng, setSpecLng] = useState<number>();
  const [specPlaceId, setSpecPlaceId] = useState<string>();
  const [specAddress, setSpecAddress] = useState<string>();

  const [mustLat, setMustLat] = useState<number>();
  const [mustLng, setMustLng] = useState<number>();
  const [mustPlaceId, setMustPlaceId] = useState<string>();
  const [mustAddress, setMustAddress] = useState<string>();

  React.useEffect(() => {
    AsyncStorage.getItem('gemini_api_key').then(val => {
      if (val) setGeminiKey(val);
    });
  }, []);

  const handleSaveGeminiKey = (val: string) => {
    setGeminiKey(val);
    AsyncStorage.setItem('gemini_api_key', val);
  };

  const handleMagicParse = async () => {
    if (!magicInput.trim() || !geminiKey) return;
    setIsAiParsing(true);
    try {
      const parsed = await parseAttractionsWithAI(geminiKey, magicInput);
      parsed.forEach(p => {
        addMustVisitAttraction('text', p.value, undefined, undefined, undefined, undefined, p.lat, p.lng, p.placeId, p.notes);
      });
      setMagicInput('');
      alert('AI 預處理成功！已為您自動解碼並加入清單。');
    } catch(e: any) {
      alert('解析失敗: ' + (e.message || '請檢查您的 API Key'));
    } finally {
      setIsAiParsing(false);
    }
  };

  const [refUrl, setRefUrl] = useState('');
  const [mustUrl, setMustUrl] = useState('');
  const [mustDate, setMustDate] = useState('');
  const [mustTime, setMustTime] = useState('');

  const [specName, setSpecName] = useState('');
  const [specDate, setSpecDate] = useState('');
  const [specTime, setSpecTime] = useState('');
  const [specDuration, setSpecDuration] = useState('');
  const [specNotes, setSpecNotes] = useState('');
  const [specIsAccommodation, setSpecIsAccommodation] = useState(false);

  // Add URL Reference
  const handleAddRefUrl = () => {
    if (!refUrl) return;
    addReferenceAttraction('url', refUrl);
    setRefUrl('');
  };

  // Add Must Visit
  const handleAddMustVisit = () => {
    if (!mustUrl) return;
    
    const mapMatch = parseGoogleMapsUrl(mustUrl);
    if (mapMatch) {
      addMustVisitAttraction('url', mapMatch.name || mustUrl, mustDate || undefined, mustTime || undefined, undefined, undefined, mapMatch.lat, mapMatch.lng, undefined, undefined);
    } else {
      addMustVisitAttraction('url', mustUrl, mustDate || undefined, mustTime || undefined, undefined, undefined, mustLat, mustLng, mustPlaceId, mustAddress);
    }
    setMustUrl('');
    setMustLat(undefined);
    setMustLng(undefined);
    setMustPlaceId(undefined);
    setMustAddress(undefined);

    setMustDate('');
    setMustTime('');
  };

  // Add Specific Location
  const handleAddSpecLocation = () => {
    if (!specName) return;
    addSpecificLocation(
      'text',
      specName,
      specDate || undefined,
      specTime || undefined,
      specDuration ? parseInt(specDuration, 10) : undefined,
      specNotes || undefined,
      undefined,
      undefined,
      specLat,
      specLng,
      specPlaceId,
      specAddress,
      specIsAccommodation
    );
    setSpecName('');
    setSpecLat(undefined);
    setSpecLng(undefined);
    setSpecPlaceId(undefined);
    setSpecAddress(undefined);
    setSpecDate('');
    setSpecTime('');
    setSpecDuration('');
    setSpecNotes('');
    setSpecIsAccommodation(false);
  };



  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      {/* SECTION 0: BYOK Gemini AI Preprocessor */}
      <Card variant="elevated" style={{ marginBottom: spacing.lg, backgroundColor: colors.primary100 }}>
        <View style={styles.flexRowBetween}>
          <View style={styles.flexRow}>
            <Ionicons name="sparkles" size={20} color={colors.primary500} style={{ marginRight: 8 }} />
            <Text style={[typography.titleMedium, { color: colors.primary900, fontWeight: '700' }]}>AI 神奇魔法棒</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}>
            <Ionicons name="help-circle-outline" size={24} color={colors.primary500} />
          </TouchableOpacity>
        </View>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, marginBottom: 12 }]}>
          貼上任何雜亂的地點描述或多段網址，讓 AI 一鍵幫您轉化成精準座標並加入清單。(金鑰僅存本地)
        </Text>
        
        <Input
          placeholder="請輸入您的 Gemini Free Tier API Key"
          value={geminiKey}
          onChangeText={handleSaveGeminiKey}
          containerStyle={{ marginBottom: 12 }}
          secureTextEntry
        />

        {geminiKey ? (
          <View>
            <TextInput
              style={[{ height: 80, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, borderWidth: 1, borderColor: colors.border }]}
              multiline
              placeholder="例如：下午想吃六千牛肉湯，然後去 https://maps.app.goo.gl/..."
              value={magicInput}
              onChangeText={setMagicInput}
            />
            <Button
              title={isAiParsing ? "解析中..." : "一鍵 AI 解析"}
              onPress={handleMagicParse}
              disabled={isAiParsing || !magicInput}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : null}
      </Card>

      
      {/* SECTION 2: SPECIFIC LOCATION REQUIREMENTS (PRIORITY) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
        {t('survey.attractions.specificLocation.label')}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
        {t('survey.attractions.specificLocation.hint')}
      </Text>

      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {/* Specific Location Inputs */}
        <View style={styles.flexRowBetween}>
          <AttractionAutocomplete
            placeholder={t('survey.attractions.specificLocation.placeholder')}
            value={specName}
            onChangeText={setSpecName}
            onSelect={(loc) => {
              setSpecName(loc.name);
              setSpecLat(loc.lat);
              setSpecLng(loc.lng);
              setSpecPlaceId(loc.placeId);
              setSpecAddress(loc.address);
            }}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <View style={{ marginTop: spacing.sm }} />
        <View style={styles.flexRowBetween}>
          <Input
            placeholder="e.g. 2026-07-14 or 07-14~07-16"
            value={specDate}
            onChangeText={setSpecDate}
            containerStyle={{ width: '48%' }}
          />
          <Input
            placeholder="xx:xx"
            value={specTime}
            onChangeText={setSpecTime}
            containerStyle={{ width: '48%' }}
          />
        </View>
        <View style={{ marginTop: spacing.sm }} />
        <View style={styles.flexRowBetween}>
          <Input
            placeholder={t('survey.attractions.specificLocation.duration')}
            value={specDuration}
            onChangeText={setSpecDuration}
            keyboardType="numeric"
            containerStyle={{ width: '48%' }}
          />
          <Input
            placeholder={t('survey.attractions.specificLocation.notes')}
            value={specNotes}
            onChangeText={setSpecNotes}
            containerStyle={{ width: '48%' }}
          />
        </View>
        <View style={[styles.flexRow, { marginTop: spacing.sm }]}>
          <Switch
            value={specIsAccommodation}
            onValueChange={setSpecIsAccommodation}
            trackColor={{ false: colors.border, true: colors.primary500 }}
          />
          <Text style={[typography.bodyMedium, { color: colors.text, marginLeft: spacing.xs }]}>此地點為住宿飯店（將安排為當晚住宿）</Text>
        </View>
        <Button
          title={t('survey.attractions.specificLocation.addBtn')}
          variant="outlined"
          onPress={handleAddSpecLocation}
          disabled={!specName}
          style={{ marginTop: spacing.md }}
        />

        {/* Specific Location List */}
        <View style={{ marginTop: spacing.md }}>
          {(survey?.specificLocations || []).map((item) => (
            <View key={item.id} style={[styles.attachmentBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={[styles.flexRow, { flex: 1 }]}>
                <Ionicons name={item.isAccommodation ? "bed" : "location"} size={18} color={item.isAccommodation ? colors.primary500 : colors.primary500} style={{ marginRight: spacing.xs }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                    {item.value} {item.isAccommodation && <Text style={{ color: colors.primary500, fontSize: 12 }}>(住宿)</Text>}
                  </Text>
                  {(item.preferredDate || item.preferredTime || item.duration || item.notes) && (
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {item.preferredDate ? `Date: ${item.preferredDate} ` : ''}
                      {item.preferredTime ? `Time: ${item.preferredTime} ` : ''}
                      {item.duration ? `Duration: ${item.duration}m ` : ''}
                      {item.notes ? `(${item.notes})` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => removeSpecificLocation(item.id)}>
                <Ionicons name="trash" size={18} color={colors.error500} style={{ marginLeft: spacing.xs }} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>

      {/* SECTION 3: MUST-VISIT ATTRACTIONS (Tier 1 & 3) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
        {t('survey.attractions.mustVisit.label')}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
        {t('survey.attractions.mustVisit.hint')}
      </Text>

      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {/* Must Visit Inputs */}
        <View style={styles.flexRowBetween}>
          <AttractionAutocomplete
            placeholder="貼上網址或搜尋景點 e.g. Grand Palace, Tokyo Tower"
            value={mustUrl}
            onChangeText={setMustUrl}
            onSelect={(loc) => {
              setMustUrl(loc.name);
              setMustLat(loc.lat);
              setMustLng(loc.lng);
              setMustPlaceId(loc.placeId);
              setMustAddress(loc.address);
            }}
            containerStyle={{ flex: 1 }}
          />

        </View>
        <View style={{ marginTop: spacing.sm }} />
        <View style={styles.flexRowBetween}>
          <Input
            placeholder={t('survey.attractions.mustVisit.specifyDate')}
            value={mustDate}
            onChangeText={setMustDate}
            containerStyle={{ width: '48%' }}
          />
          <Input
            placeholder="xx:xx"
            value={mustTime}
            onChangeText={setMustTime}
            containerStyle={{ width: '48%' }}
          />
        </View>
        <Button
          title="Add Must-Visit Attraction"
          variant="outlined"
          onPress={handleAddMustVisit}
          disabled={!mustUrl}
          style={{ marginTop: spacing.md }}
        />

        {/* Must-Visit List */}
        <View style={{ marginTop: spacing.md }}>
          {(survey?.mustVisitAttractions || []).map((item) => (
            <View key={item.id} style={[styles.attachmentBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={[styles.flexRow, { flex: 1 }]}>
                <Ionicons name={item.type === 'file' ? 'document-text' : 'star'} size={18} color={item.type === 'file' ? colors.primary500 : colors.warning500} style={{ marginRight: spacing.xs }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                    {item.fileName || item.value}
                  </Text>
                  {(item.preferredDate || item.preferredTime) && (
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {item.preferredDate ? `Date: ${item.preferredDate}` : ''} {item.preferredTime ? `Time: ${item.preferredTime}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => removeMustVisitAttraction(item.id)}>
                <Ionicons name="trash" size={18} color={colors.error500} style={{ marginLeft: spacing.xs }} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>

    {/* SECTION 1: REFERENCE ATTRACTIONS (Tier 3) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
        {t('survey.attractions.reference.label')}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
        {t('survey.attractions.reference.hint')}
      </Text>

      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {/* URL Input */}
        <View style={styles.flexRowBetween}>
          <Input
            placeholder={t('survey.attractions.reference.urlPlaceholder')}
            value={refUrl}
            onChangeText={setRefUrl}
            containerStyle={{ flex: 1, marginRight: spacing.sm }}
          />

          <TouchableOpacity
            onPress={handleAddRefUrl}
            style={[styles.addBtn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md }]}
          >
            <Ionicons name="add" size={24} color={colors.neutral0} />
          </TouchableOpacity>
        </View>


        {/* Reference List */}
        <View style={{ marginTop: spacing.md }}>
          {(survey?.referenceAttractions || []).map((item) => (
            <View key={item.id} style={[styles.attachmentBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={styles.flexRow}>
                <Ionicons
                  name={item.type === 'file' ? 'document-text' : (item.type === 'url' ? 'link' : 'document')}
                  size={18}
                  color={colors.primary500}
                  style={{ marginRight: spacing.xs }}
                />
                <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                  {item.fileName || item.value}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeReferenceAttraction(item.id)}>
                <Ionicons name="trash" size={18} color={colors.error500} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>

      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPickers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    width: '48%',
    justifyContent: 'center',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
});
