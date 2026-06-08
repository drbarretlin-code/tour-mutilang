import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import { BudgetLevel, TransportMode, BookingPlatform, MapProvider } from '../../types/survey';

export function StepPreferences() {
  const { survey, updateSurvey } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();

  const budgetLevels: { value: BudgetLevel; labelKey: string; desc: string }[] = [
    { value: 'economy', labelKey: 'survey.budget.economy', desc: 'Hostels, public transit, local street food' },
    { value: 'moderate', labelKey: 'survey.budget.moderate', desc: '3-star hotels, casual dining, mixed transit' },
    { value: 'luxury', labelKey: 'survey.budget.luxury', desc: '5-star resorts, private transport, fine dining' },
    { value: 'unlimited', labelKey: 'survey.budget.unlimited', desc: 'Experience the absolute best without bounds' },
  ];

  const transportModes: { value: TransportMode; labelKey: string; icon: string }[] = [
    { value: 'public', labelKey: 'survey.transport.public', icon: 'bus' },
    { value: 'taxi', labelKey: 'survey.transport.taxi', icon: 'car-sport' },
    { value: 'rental', labelKey: 'survey.transport.rental', icon: 'key' },
    { value: 'charter', labelKey: 'survey.transport.charter', icon: 'people' },
    { value: 'walking', labelKey: 'survey.transport.walking', icon: 'walk' },
  ];

  const bookingPlatforms: { value: BookingPlatform; label: string }[] = [
    { value: 'agoda', label: 'Agoda' },
    { value: 'hotels_com', label: 'Hotels.com' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'trip_com', label: 'Trip.com' },
  ];

  const mapProviders: { value: MapProvider; labelKey: string }[] = [
    { value: 'apple', labelKey: 'survey.map.apple' },
    { value: 'google', labelKey: 'survey.map.google' },
    { value: 'amap', labelKey: 'survey.map.amap' },
    { value: 'baidu', labelKey: 'survey.map.baidu' },
  ];

  const currencies = [
    { code: 'TWD', symbol: 'NT$' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'JPY', symbol: '¥' },
    { code: 'CNY', symbol: '¥' },
    { code: 'THB', symbol: '฿' },
  ];

  // Multiselect toggle helper
  const toggleSelection = <T extends string>(field: 'transportModes' | 'bookingPlatforms', value: T) => {
    const list = (survey[field] as string[]) || [];
    const isSelected = list.includes(value);
    const updated = isSelected ? list.filter(item => item !== value) : [...list, value];
    updateSurvey({ [field]: updated });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      
      {/* 1. Total Budget Level (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.budget.label')} *
      </Text>
      <View style={{ marginBottom: spacing.lg }}>
        {budgetLevels.map((level, idx) => {
          const selected = survey.budgetLevel === level.value;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => updateSurvey({ budgetLevel: level.value })}
              style={[
                styles.budgetCard,
                {
                  backgroundColor: selected ? colors.primary50 : colors.backgroundSecondary,
                  borderColor: selected ? colors.primary500 : colors.border,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                }
              ]}
            >
              <View style={styles.radioRow}>
                <View style={[
                  styles.radioButton,
                  {
                    borderColor: selected ? colors.primary500 : colors.textTertiary,
                    backgroundColor: selected ? colors.primary500 : 'transparent'
                  }
                ]}>
                  {selected && <View style={[styles.radioDot, { backgroundColor: colors.neutral0 }]} />}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
                    {t(level.labelKey)}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
                    {level.desc}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. Preferred Currency & Daily Meal Budget (Recommended) */}
      <View style={[styles.flexRowContainer, { marginBottom: spacing.lg }]}>
        <View style={{ width: '48%' }}>
          <Text style={[typography.titleSmall, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
            {t('survey.budget.currency')}
          </Text>
          <View style={styles.chipsRow}>
            {currencies.map((curr) => {
              const selected = survey.currency === curr.code;
              return (
                <TouchableOpacity
                  key={curr.code}
                  onPress={() => updateSurvey({ currency: curr.code })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                      borderColor: selected ? 'transparent' : colors.border,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      margin: 2
                    }
                  ]}
                >
                  <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                    {curr.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        <View style={{ width: '48%' }}>
          <Input
            label={t('survey.budget.dailyMeals')}
            placeholder="e.g. 500"
            keyboardType="numeric"
            value={survey.dailyMealBudget?.toString() || ''}
            onChangeText={(text) => {
              const amt = parseFloat(text);
              updateSurvey({ dailyMealBudget: isNaN(amt) ? undefined : amt });
            }}
          />
        </View>
      </View>

      {/* 3. Local Transportation Preferences (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.transport.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {transportModes.map((mode, idx) => {
          const selected = (survey?.transportModes || []).includes(mode.value);
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => toggleSelection('transportModes', mode.value)}
              style={[styles.checkboxRow, { borderBottomWidth: idx < transportModes.length - 1 ? 1 : 0, borderBottomColor: colors.divider }]}
            >
              <View style={styles.flexRow}>
                <Ionicons name={mode.icon as any} size={20} color={colors.primary500} style={{ marginRight: spacing.sm }} />
                <Text style={[typography.bodyLarge, { color: colors.text }]}>{t(mode.labelKey)}</Text>
              </View>
              <View style={[
                styles.checkbox,
                {
                  borderColor: selected ? colors.primary500 : colors.textTertiary,
                  backgroundColor: selected ? colors.primary500 : 'transparent',
                  borderRadius: borderRadius.xs,
                }
              ]}>
                {selected && <Ionicons name="checkmark" size={14} color={colors.neutral0} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* 4. Booking Platforms Selection (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.accommodation.platform.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
        {bookingPlatforms.map((platform, idx) => {
          const selected = (survey?.bookingPlatforms || []).includes(platform.value);
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => toggleSelection('bookingPlatforms', platform.value)}
              style={[styles.checkboxRow, { borderBottomWidth: idx < bookingPlatforms.length - 1 ? 1 : 0, borderBottomColor: colors.divider }]}
            >
              <Text style={[typography.bodyLarge, { color: colors.text }]}>{platform.label}</Text>
              <View style={[
                styles.checkbox,
                {
                  borderColor: selected ? colors.primary500 : colors.textTertiary,
                  backgroundColor: selected ? colors.primary500 : 'transparent',
                  borderRadius: borderRadius.xs,
                }
              ]}>
                {selected && <Ionicons name="checkmark" size={14} color={colors.neutral0} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Custom Booking URL */}
        <View style={{ marginTop: spacing.md }}>
          <Input
            label={t('survey.accommodation.platform.customUrl')}
            placeholder="https://..."
            keyboardType="url"
            autoCapitalize="none"
            value={survey.customBookingUrl || ''}
            onChangeText={(text) => updateSurvey({ customBookingUrl: text })}
          />
        </View>
      </Card>

      {/* 5. Map Options (Required) */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
        {t('survey.map.label')} *
      </Text>
      <Card variant="elevated" style={{ marginBottom: spacing.md }}>
        {mapProviders.map((provider, idx) => {
          const selected = survey.mapProvider === provider.value;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => updateSurvey({ mapProvider: provider.value })}
              style={[styles.checkboxRow, { borderBottomWidth: idx < mapProviders.length - 1 ? 1 : 0, borderBottomColor: colors.divider }]}
            >
              <Text style={[typography.bodyLarge, { color: colors.text }]}>{t(provider.labelKey)}</Text>
              <View style={[
                styles.radioButton,
                {
                  borderColor: selected ? colors.primary500 : colors.textTertiary,
                  backgroundColor: selected ? colors.primary500 : 'transparent',
                  borderRadius: borderRadius.full,
                }
              ]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.neutral0 }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  budgetCard: {
    borderWidth: 1.5,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flexRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
