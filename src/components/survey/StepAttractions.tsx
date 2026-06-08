import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { readFileContent } from '../../utils/fileReader';

export function StepAttractions() {
  const {
    survey,
    addReferenceAttraction,
    removeReferenceAttraction,
    addMustVisitAttraction,
    removeMustVisitAttraction
  } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Local inputs
  const [refUrl, setRefUrl] = useState('');
  const [mustUrl, setMustUrl] = useState('');
  const [mustDate, setMustDate] = useState('');
  const [mustTime, setMustTime] = useState('');



  // Add URL Reference
  const handleAddRefUrl = () => {
    if (!refUrl) return;
    addReferenceAttraction('url', refUrl);
    setRefUrl('');
  };

  // Add Must Visit
  const handleAddMustVisit = () => {
    if (!mustUrl) return;
    addMustVisitAttraction('url', mustUrl, mustDate || undefined, mustTime || undefined);
    setMustUrl('');
    setMustDate('');
    setMustTime('');
  };

  const handleUploadRefFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const content = await readFileContent(asset);
        addReferenceAttraction('file', content, asset.name, asset.mimeType);
      }
    } catch (e) {
      console.error('File pick error', e);
    }
  };

  const handleUploadMustVisitFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const content = await readFileContent(asset);
        addMustVisitAttraction('file', content, mustDate || undefined, mustTime || undefined, asset.name, asset.mimeType);
      }
    } catch (e) {
      console.error('File pick error', e);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      
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
            onPress={handleUploadRefFile}
            style={[styles.addBtn, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, marginRight: spacing.sm, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Ionicons name="document-attach" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
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

      {/* SECTION 2: MUST-VISIT ATTRACTIONS (Tier 1 & 3) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
        {t('survey.attractions.mustVisit.label')}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
        {t('survey.attractions.mustVisit.hint')}
      </Text>

      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {/* Must Visit Inputs */}
        <View style={styles.flexRowBetween}>
          <Input
            placeholder="e.g. Grand Palace, Tokyo Tower"
            value={mustUrl}
            onChangeText={setMustUrl}
            containerStyle={{ flex: 1, marginRight: spacing.sm }}
          />
          <TouchableOpacity
            onPress={handleUploadMustVisitFile}
            style={[styles.addBtn, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Ionicons name="document-attach" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
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
            placeholder={t('survey.attractions.mustVisit.specifyTime')}
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
