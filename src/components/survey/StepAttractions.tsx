import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';


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
  const [refUrl, setRefUrl] = useState('');
  const [mustUrl, setMustUrl] = useState('');
  const [mustDate, setMustDate] = useState('');
  const [mustTime, setMustTime] = useState('');

  const [specName, setSpecName] = useState('');
  const [specDate, setSpecDate] = useState('');
  const [specTime, setSpecTime] = useState('');
  const [specDuration, setSpecDuration] = useState('');
  const [specNotes, setSpecNotes] = useState('');

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

  // Add Specific Location
  const handleAddSpecLocation = () => {
    if (!specName) return;
    addSpecificLocation(
      'text',
      specName,
      specDate || undefined,
      specTime || undefined,
      specDuration ? parseInt(specDuration, 10) : undefined,
      specNotes || undefined
    );
    setSpecName('');
    setSpecDate('');
    setSpecTime('');
    setSpecDuration('');
    setSpecNotes('');
  };



  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      
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
          <Input
            placeholder={t('survey.attractions.specificLocation.placeholder')}
            value={specName}
            onChangeText={setSpecName}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <View style={{ marginTop: spacing.sm }} />
        <View style={styles.flexRowBetween}>
          <Input
            placeholder={t('survey.attractions.specificLocation.specifyDate')}
            value={specDate}
            onChangeText={setSpecDate}
            containerStyle={{ width: '48%' }}
          />
          <Input
            placeholder={t('survey.attractions.specificLocation.specifyTime')}
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
                <Ionicons name="location" size={18} color={colors.primary500} style={{ marginRight: spacing.xs }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                    {item.value}
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
          <Input
            placeholder="e.g. Grand Palace, Tokyo Tower"
            value={mustUrl}
            onChangeText={setMustUrl}
            containerStyle={{ flex: 1, marginRight: spacing.sm }}
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
