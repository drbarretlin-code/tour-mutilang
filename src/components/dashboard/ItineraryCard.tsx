import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary } from '../../types/itinerary';

interface Props {
  itinerary: Itinerary;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ItineraryCard({ itinerary, onPress, onEdit, onDelete }: Props) {
  const { colors, typography, shadows, borderRadius, spacing } = useTheme();

  const dayCount = itinerary.days?.length || 0;
  const startDate = itinerary.days?.[0]?.date || '';
  const endDate = itinerary.days?.[dayCount - 1]?.date || '';
  
  const bgImage = itinerary.mapImageUrl || itinerary.days?.[0]?.activities?.find(a => a.photoUrl?.startsWith('http'))?.photoUrl;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.card, shadows.md, { borderRadius: borderRadius.lg, backgroundColor: colors.surface }]}
    >
      <View style={[styles.imageContainer, { borderRadius: borderRadius.lg }]}>
        {bgImage ? (
          <ImageBackground source={{ uri: bgImage }} style={styles.imageBackground} resizeMode="cover">
            <View style={styles.overlay} />
          </ImageBackground>
        ) : (
          <View style={[styles.imageBackground, { backgroundColor: colors.primary500 }]} />
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="calendar-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={[typography.labelSmall, { color: '#fff' }]}>{t('common.days', { count: dayCount })}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="wallet-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={[typography.labelSmall, { color: '#fff' }]}>
                {itinerary.currency || 'TWD'} {itinerary.totalEstimatedCost?.amount || 0}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            {onEdit && (
              <TouchableOpacity 
                onPress={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                  onEdit();
                }} 
                style={styles.actionBtn}
              >
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity 
                onPress={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                  onDelete();
                }} 
                style={styles.actionBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={[typography.titleLarge, { color: '#fff', fontWeight: '700', marginBottom: 4 }]} numberOfLines={2}>
              {itinerary.title || t('dashboard.untitledItinerary')}
            </Text>
            <Text style={[typography.labelMedium, { color: 'rgba(255,255,255,0.8)' }]}>
              {startDate} {endDate && startDate !== endDate ? `~ ${endDate}` : ''}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    height: 180,
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  imageBackground: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', // Dark overlay for text readability
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  footer: {
    justifyContent: 'flex-end',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
