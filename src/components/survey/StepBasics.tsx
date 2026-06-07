import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { CalendarPicker } from '../common/CalendarPicker';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { t, SUPPORTED_LOCALES, setLocale, LocaleCode } from '../../i18n';
import { SUGGESTED_DESTINATIONS } from '../../constants/destinations';
import { Ionicons } from '@expo/vector-icons';
import { TripType } from '../../types/survey';

export function StepBasics() {
  const { survey, updateSurvey, updateDates, addDestination, removeDestination } = useSurvey();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  // Local UI states
  const [destSearch, setDestSearch] = useState('');
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const tripTypes: { value: TripType; icon: string; labelKey: string }[] = [
    { value: 'family', icon: 'people', labelKey: 'survey.tripType.family' },
    { value: 'couple', icon: 'heart', labelKey: 'survey.tripType.couple' },
    { value: 'solo', icon: 'person', labelKey: 'survey.tripType.solo' },
    { value: 'friends', icon: 'people-circle', labelKey: 'survey.tripType.friends' },
    { value: 'business', icon: 'briefcase', labelKey: 'survey.tripType.business' },
    { value: 'honeymoon', icon: 'rose', labelKey: 'survey.tripType.honeymoon' },
  ];

  // Travelers handler
  const handleUpdateTravelers = (type: 'adults' | 'children' | 'infants' | 'seniors', operation: 'add' | 'subtract') => {
    const currentVal = survey.travelers[type];
    let newVal = currentVal;
    if (operation === 'add') {
      newVal += 1;
    } else {
      newVal = Math.max(0, currentVal - 1);
      if (type === 'adults') {
        newVal = Math.max(1, newVal); // At least 1 adult
      }
    }

    updateSurvey({
      travelers: {
        ...survey.travelers,
        [type]: newVal,
      },
    });
  };

  // Language handler
  const handleLanguageSelect = async (code: LocaleCode) => {
    await setLocale(code);
    updateSurvey({ locale: code });
    setShowLangModal(false);
  };

  // Destination autocomplete filter
  const filteredSuggestions = SUGGESTED_DESTINATIONS.filter(item => {
    const term = destSearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      item.name_en.toLowerCase().includes(term) ||
      item.country.toLowerCase().includes(term) ||
      item.country_en.toLowerCase().includes(term)
    );
  });

  const getLanguageLabel = (code: string) => {
    return SUPPORTED_LOCALES.find(l => l.code === code)?.label || code;
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      <Text style={[typography.headlineLarge, { color: colors.text, marginBottom: spacing.md, fontWeight: '700' }]}>
        {t('survey.subtitle')}
      </Text>

      {/* 1. App Language Preference */}
      <Card variant="flat" style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          {t('survey.language.label')}
        </Text>
        <TouchableOpacity
          onPress={() => setShowLangModal(true)}
          style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {getLanguageLabel(survey.locale)}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      {/* 2. Travel Dates (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.dates.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        <TouchableOpacity
          onPress={() => setShowCalendarModal(true)}
          style={styles.dateSelector}
        >
          <View style={styles.dateBlock}>
            <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>{t('survey.dates.start')}</Text>
            <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600', marginTop: 4 }]}>
              {survey.dates.startDate || 'Select Date'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.primary500} style={{ marginHorizontal: spacing.md }} />
          <View style={styles.dateBlock}>
            <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>{t('survey.dates.end')}</Text>
            <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600', marginTop: 4 }]}>
              {survey.dates.endDate || 'Select Date'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Date Flexibility */}
        <View style={[styles.flexRow, { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleSmall, { color: colors.text }]}>{t('survey.dates.flexible')}</Text>
            <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>{t('survey.dates.flexibleHint')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSurvey({
              dates: { ...survey.dates, isFlexible: !survey.dates.isFlexible }
            })}
            style={[
              styles.switchTrack,
              {
                backgroundColor: survey.dates.isFlexible ? colors.primary500 : colors.neutral300,
                borderRadius: borderRadius.full,
              }
            ]}
          >
            <View style={[
              styles.switchThumb,
              {
                backgroundColor: colors.neutral0,
                alignSelf: survey.dates.isFlexible ? 'flex-end' : 'flex-start',
                borderRadius: borderRadius.full,
              }
            ]} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* 3. Destination (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.destination.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg, overflow: 'visible', zIndex: 10 }}>
        {/* Input & Autocomplete */}
        <Input
          placeholder={t('survey.destination.placeholder')}
          value={destSearch}
          onChangeText={(text) => {
            setDestSearch(text);
            setShowDestSuggestions(text.length > 0);
          }}
          leftIcon={<Ionicons name="search" size={18} color={colors.textTertiary} />}
          rightIcon={
            destSearch.length > 0 ? (
              <TouchableOpacity onPress={() => { setDestSearch(''); setShowDestSuggestions(false); }}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null
          }
        />

        {showDestSuggestions && (
          <View style={[styles.suggestionsBox, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: borderRadius.md, ...shadows.md }]}>
            {filteredSuggestions.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.suggestionItem, { borderBottomColor: colors.divider }]}
                onPress={() => {
                  addDestination(item.name, '', item.country);
                  setDestSearch('');
                  setShowDestSuggestions(false);
                }}
              >
                <Ionicons name="location" size={18} color={colors.primary500} style={{ marginRight: spacing.sm }} />
                <View>
                  <Text style={[typography.titleSmall, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>{item.country}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected Destinations List */}
        <View style={{ marginTop: spacing.md }}>
          {survey.destinations.map((dest) => (
            <View key={dest.id} style={[styles.destBadge, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, borderColor: colors.border }]}>
              <View style={styles.flexRow}>
                <Ionicons name="pin" size={16} color={colors.primary500} style={{ marginRight: spacing.xs }} />
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{dest.name}, {dest.country}</Text>
              </View>
              <TouchableOpacity onPress={() => removeDestination(dest.id)}>
                <Ionicons name="trash" size={18} color={colors.error500} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>

      {/* 4. Departure City (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.departure.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        <Input
          placeholder={t('survey.departure.placeholder')}
          value={survey.departureCity}
          onChangeText={(text) => updateSurvey({ departureCity: text })}
          leftIcon={<Ionicons name="airplane" size={18} color={colors.textTertiary} />}
        />
      </Card>

      {/* 5. Travelers (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.travelers.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {[
          { key: 'adults', label: 'survey.travelers.adults' },
          { key: 'children', label: 'survey.travelers.children' },
          { key: 'infants', label: 'survey.travelers.infants' },
          { key: 'seniors', label: 'survey.travelers.seniors' },
        ].map((item, idx) => (
          <View key={idx} style={[styles.travelerRow, { borderBottomWidth: idx < 3 ? 1 : 0, borderBottomColor: colors.divider, paddingVertical: spacing.sm }]}>
            <Text style={[typography.bodyLarge, { color: colors.text }]}>{t(item.label)}</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                onPress={() => handleUpdateTravelers(item.key as any, 'subtract')}
                style={[styles.stepperBtn, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>-</Text>
              </TouchableOpacity>
              <Text style={[typography.titleMedium, { color: colors.text, marginHorizontal: spacing.md }]}>
                {survey.travelers[item.key as 'adults' | 'children' | 'infants' | 'seniors']}
              </Text>
              <TouchableOpacity
                onPress={() => handleUpdateTravelers(item.key as any, 'add')}
                style={[styles.stepperBtn, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>

      {/* 6. Trip Type (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.tripType.label')} *
      </Text>
      <View style={styles.gridContainer}>
        {tripTypes.map((type, idx) => {
          const selected = survey.tripType === type.value;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => updateSurvey({ tripType: type.value })}
              style={[
                styles.gridItem,
                {
                  backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                  borderRadius: borderRadius.md,
                  borderColor: selected ? 'transparent' : colors.border,
                  borderWidth: selected ? 0 : 1,
                  padding: spacing.md,
                }
              ]}
            >
              <Ionicons
                name={type.icon as any}
                size={24}
                color={selected ? colors.neutral0 : colors.primary500}
                style={{ marginBottom: spacing.xs }}
              />
              <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text, textAlign: 'center' }]}>
                {t(type.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MODAL: Calendar Picker */}
      <Modal visible={showCalendarModal} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[typography.headlineSmall, { color: colors.text }]}>{t('survey.dates.selectDates')}</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: spacing.md }}>
              <CalendarPicker
                startDate={survey.dates.startDate}
                endDate={survey.dates.endDate}
                onSelectDates={(start, end) => {
                  updateDates(start, end, survey.dates.isFlexible, survey.dates.flexDays);
                }}
              />
              <Button
                title={t('common.confirm')}
                onPress={() => setShowCalendarModal(false)}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Language Selection */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}
        >
          <View style={[styles.dialogContent, { backgroundColor: colors.background, borderRadius: borderRadius.lg }]}>
            <Text style={[typography.titleLarge, { color: colors.text, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
              {t('survey.language.label')}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {SUPPORTED_LOCALES.map((locale) => (
                <TouchableOpacity
                  key={locale.code}
                  onPress={() => handleLanguageSelect(locale.code)}
                  style={[styles.langItem, { borderBottomColor: colors.divider }]}
                >
                  <Text style={[typography.bodyLarge, { color: colors.text }]}>
                    {locale.nativeLabel}
                  </Text>
                  {survey.locale === locale.code && (
                    <Ionicons name="checkmark" size={20} color={colors.primary500} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBlock: {
    flex: 1,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTrack: {
    width: 50,
    height: 28,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 24,
    height: 24,
  },
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 99,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridItem: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  dialogContent: {
    width: '80%',
    alignSelf: 'center',
    marginTop: '30%',
    overflow: 'hidden',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
});
