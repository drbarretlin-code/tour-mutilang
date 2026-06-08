import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { ItineraryDay } from '../../types/itinerary';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

interface DailySummaryCardProps {
  day: ItineraryDay;
}

export function DailySummaryCard({ day }: DailySummaryCardProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Mock weather data based on day number to ensure consistent premium display without API cost
  const getWeatherInfo = (dayNum: number) => {
    const weatherPool = [
      { temp: '28°C ~ 32°C', icon: 'sunny', rainProb: '10%', desc: t('itinerary.dailySummary.weather.sunny'), advice: t('itinerary.dailySummary.advice.sunny') },
      { temp: '25°C ~ 29°C', icon: 'cloudy', rainProb: '20%', desc: t('itinerary.dailySummary.weather.cloudy'), advice: t('itinerary.dailySummary.advice.cloudy') },
      { temp: '24°C ~ 28°C', icon: 'rainy', rainProb: '70%', desc: t('itinerary.dailySummary.weather.rainy'), advice: t('itinerary.dailySummary.advice.rainy') },
      { temp: '26°C ~ 30°C', icon: 'partly-sunny', rainProb: '30%', desc: t('itinerary.dailySummary.weather.partlySunny'), advice: t('itinerary.dailySummary.advice.partlySunny') },
    ];
    return weatherPool[(dayNum - 1) % weatherPool.length];
  };

  const weather = getWeatherInfo(day.dayNumber);

  // Format walking distance
  const formatDistance = (meters: number) => {
    if (!meters) return '0 km';
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <Card variant="elevated" style={styles.card}>
      {/* Date and Summary Header */}
      <View style={styles.header}>
        <View style={[styles.dayBadge, { backgroundColor: colors.primary500, borderRadius: borderRadius.sm }]}>
          <Text style={[typography.labelMedium, { color: colors.neutral0, fontWeight: '700' }]}>
            Day {day.dayNumber}
          </Text>
        </View>
        <Text style={[typography.titleLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1, fontWeight: '700' }]}>
          {day.title}
        </Text>
      </View>

      <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginVertical: spacing.sm }]}>
        {day.summary}
      </Text>

      {/* Highlights Grid */}
      <View style={[styles.grid, { borderColor: colors.divider }]}>
        {/* Weather Info */}
        <View style={[styles.gridItem, { borderRightWidth: 1, borderRightColor: colors.divider }]}>
          <View style={styles.iconRow}>
            <Ionicons name={weather.icon as any} size={20} color={colors.primary500} />
            <Text style={[typography.labelMedium, { color: colors.text, marginLeft: spacing.xs, fontWeight: '600' }]}>
              {weather.desc}
            </Text>
          </View>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            {weather.temp}
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            {t('itinerary.dailySummary.weather.rainProb', { prob: weather.rainProb })}
          </Text>
        </View>

        {/* Financial Budget & Distance */}
        <View style={styles.gridItem}>
          <View style={styles.statRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary500} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
              {t('itinerary.estimatedCost')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.text, marginLeft: 'auto', fontWeight: '600' }]}>
              {day.estimatedCost.amount} {day.estimatedCost.currency}
            </Text>
          </View>

          <View style={[styles.statRow, { marginTop: spacing.xs }]}>
            <Ionicons name="footsteps-outline" size={16} color={colors.primary500} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
              {t('itinerary.walkingDistance')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.text, marginLeft: 'auto', fontWeight: '600' }]}>
              {formatDistance(day.walkingDistance || 3000)}
            </Text>
          </View>
        </View>
      </View>

      {/* Weather Tip Bar */}
      <View style={[styles.tipsContainer, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.sm }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary500} style={{ marginRight: spacing.xs }} />
        <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
          {weather.advice}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginVertical: 8,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
});
