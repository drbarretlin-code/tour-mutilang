import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSurvey } from '../../src/context/SurveyContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { t } from '../../src/i18n';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ItineraryScreen() {
  const { survey } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate AI Generation for 3 seconds
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={colors.primary500} />
          <Text style={[typography.headlineMedium, { color: colors.text, marginTop: spacing.lg, fontWeight: '700' }]}>
            {t('survey.generating')}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Analyzing destinations, checking flights, matching budget ({t(`survey.budget.${survey.budgetLevel}`)}), and finding local attractions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.divider, borderBottomWidth: 1, padding: spacing.md }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '700', flex: 1, textAlign: 'center' }]}>
          {t('itinerary.title')}
        </Text>
        <View style={{ width: 24 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={[typography.headlineMedium, { color: colors.text, fontWeight: '700', marginBottom: spacing.sm }]}>
          Your Dream Trip
        </Text>

        {/* Info card */}
        <Card variant="flat" style={{ marginBottom: spacing.lg }}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color={colors.primary500} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              {survey.dates.startDate} ~ {survey.dates.endDate}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
            <Ionicons name="people" size={18} color={colors.primary500} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              {survey.travelers.adults} Adults, {survey.travelers.children.length} Children ({t(`survey.tripType.${survey.tripType}`)})
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
            <Ionicons name="wallet" size={18} color={colors.primary500} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              Budget: {t(`survey.budget.${survey.budgetLevel}`)} ({survey.currency})
            </Text>
          </View>
        </Card>

        {/* Daily Itinerary Mock Blocks */}
        <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.sm, fontWeight: '600' }]}>
          Daily Schedule
        </Text>

        {survey.destinations.map((dest, index) => (
          <Card key={dest.id} style={{ marginBottom: spacing.md }} variant="elevated">
            <View style={styles.dayHeader}>
              <View style={[styles.dayCircle, { backgroundColor: colors.primary500 }]}>
                <Text style={[typography.labelLarge, { color: colors.neutral0 }]}>D{index + 1}</Text>
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
                  Welcome to {dest.name}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                  {dest.country} | Regional Area Exploration
                </Text>
              </View>
            </View>
            
            <View style={[styles.timelineLine, { borderColor: colors.divider, marginLeft: 16, marginTop: spacing.md, paddingLeft: spacing.lg }]}>
              <View style={styles.timelineItem}>
                <Ionicons name="airplane" size={18} color={colors.primary500} style={styles.timelineIcon} />
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                  Arrival at Airport & Transit
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Pickup organized according to your {survey.transportModes.join(', ')} transport preference.
                </Text>
              </View>
              
              <View style={[styles.timelineItem, { marginTop: spacing.md }]}>
                <Ionicons name="home" size={18} color={colors.primary500} style={styles.timelineIcon} />
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                  Hotel Check-in
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Reserved via {survey.bookingPlatforms.join(' / ')} platforms.
                </Text>
              </View>

              <View style={[styles.timelineItem, { marginTop: spacing.md }]}>
                <Ionicons name="star" size={18} color={colors.warning500} style={styles.timelineIcon} />
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                  Sightseeing & Dining
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  AI-selected spots based on interests. Utilizing {survey.mapProvider} map for local routing.
                </Text>
              </View>
            </View>
          </Card>
        ))}

        <Button
          title="Back to Questionnaire"
          variant="outlined"
          onPress={() => router.replace('/')}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrapper: {
    padding: 24,
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    borderLeftWidth: 2,
  },
  timelineItem: {
    position: 'relative',
    paddingBottom: 4,
  },
  timelineIcon: {
    position: 'absolute',
    left: -28,
    top: 2,
  },
});
