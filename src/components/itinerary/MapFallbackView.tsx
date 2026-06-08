import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { ItineraryDay, Activity } from '../../types/itinerary';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

interface MapFallbackViewProps {
  day: ItineraryDay;
  mapProvider: 'apple' | 'google' | 'amap' | 'baidu';
}

export function MapFallbackView({ day, mapProvider }: MapFallbackViewProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  // Filter activities that have valid locations
  const activities = day.activities || [];
  const routePoints = activities.filter(act => act.location && act.location.name);

  // Trigger native map navigation via URL Scheme
  const handleNavigate = async (act: Activity) => {
    if (!act.location) return;
    const { name, latitude, longitude } = act.location;
    const lat = latitude || 0;
    const lng = longitude || 0;

    let url = '';

    switch (mapProvider) {
      case 'apple':
        url = `maps://?q=${encodeURIComponent(name)}&daddr=${lat},${lng}`;
        break;
      case 'amap':
        url = `androidamap://route/plan/?dlat=${lat}&dlon=${lng}&dname=${encodeURIComponent(name)}&dev=0&t=0`;
        break;
      case 'baidu':
        url = `baidumap://map/direction?destination=${lat},${lng}&mode=driving`;
        break;
      case 'google':
      default:
        url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        break;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to Web Google Maps which works everywhere (iOS, Android, Web)
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening map URL:', error);
      Alert.alert(t('common.error'), t('itinerary.mapFallbackView.errors.openFailed'));
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      Linking.openURL(fallbackUrl);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }} style={styles.container}>
      {/* 1. High-Aesthetic Virtual Route Map Panel */}
      <Card variant="flat" style={StyleSheet.flatten([styles.mapPanel, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }])}>
        <View style={styles.mapHeader}>
          <Ionicons name="map-outline" size={20} color={colors.primary500} style={{ marginRight: spacing.xs }} />
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
            {t('itinerary.mapFallbackView.title')}
          </Text>
        </View>

        {routePoints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[typography.bodyMedium, { color: colors.textTertiary }]}>
              {t('itinerary.mapFallbackView.empty')}
            </Text>
          </View>
        ) : (
          <View style={styles.visualContainer}>
            {/* Visual Dotted Network Line */}
            <View style={[styles.networkLine, { borderColor: colors.primary200 }]} />

            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.horizontalScroll}>
              {routePoints.map((pt, idx) => {
                const isLastPoint = idx === routePoints.length - 1;
                return (
                  <View key={pt.id} style={styles.nodeWrapper}>
                    <TouchableOpacity
                      onPress={() => handleNavigate(pt)}
                      style={StyleSheet.flatten([
                        styles.nodeCircle,
                        {
                          ...shadows.sm,
                          backgroundColor: colors.primary500,
                          shadowColor: colors.primary500,
                        }
                      ])}
                    >
                      <Text style={[typography.labelMedium, { color: colors.neutral0, fontWeight: '700' }]}>
                        {idx + 1}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center', maxWidth: 80 }]} numberOfLines={1}>
                      {pt.location?.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textTertiary, fontSize: 10 }]}>
                      {pt.startTime}
                    </Text>

                    {!isLastPoint && (
                      <View style={styles.arrowConnector}>
                        <Ionicons name="arrow-forward" size={16} color={colors.primary300} />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Card>


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapPanel: {
    padding: 16,
    borderWidth: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  visualContainer: {
    position: 'relative',
    justifyContent: 'center',
    height: 120,
  },
  networkLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 36,
    height: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  horizontalScroll: {
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
  },
  nodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    position: 'relative',
    zIndex: 2,
  },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowConnector: {
    position: 'absolute',
    right: -15,
    top: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
