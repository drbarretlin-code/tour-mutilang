import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Itinerary } from '../../types/itinerary';
import { Itinerary3DMap } from './Itinerary3DMap';
import { HorizontalActivityCard } from './HorizontalActivityCard';
import { t } from '../../i18n';

interface Props {
  itinerary: Itinerary;
  activeDay: number;
  onEditActivity?: (id: string) => void;
  onRefreshMap?: () => void;
  onNavigate?: (location: { latitude?: number; longitude?: number; address?: string; name?: string }) => void;
}

export const CombinedItineraryView: React.FC<Props> = ({ itinerary, activeDay, onEditActivity, onRefreshMap, onNavigate }) => {
  const currentDayData = itinerary.days.find(d => d.dayNumber === activeDay) || itinerary.days[0];
  
  if (!currentDayData) return null;

  return (
    <View style={styles.container}>
      {/* Header section */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>
            {t('itinerary.combinedView.title', { day: activeDay })}
          </Text>
          <Text style={styles.subtitle}>
            {t('itinerary.combinedView.subtitle')}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefreshMap}>
          <Ionicons name="sync" size={16} color="#FFFFFF" />
          <Text style={styles.refreshText}>{t('itinerary.combinedView.refresh')}</Text>
        </TouchableOpacity>
      </View>

      {/* 3D Map Section */}
      <View style={styles.mapContainer}>
        <Itinerary3DMap itinerary={itinerary} activeDay={activeDay} height={400} />
      </View>

      {/* Horizontal Timeline Section */}
      <View style={styles.timelineContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          {currentDayData.activities.map((act, index) => (
            <React.Fragment key={act.id}>
              <HorizontalActivityCard 
                activity={act} 
                index={index} 
                onEdit={onEditActivity}
                onPress={() => {
                  if (act.location && onNavigate) {
                    onNavigate(act.location);
                  }
                }}
              />
              {index < currentDayData.activities.length - 1 && (
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={24} color="#6366F1" style={{ marginRight: -12 }} />
                  <Ionicons name="chevron-forward" size={24} color="#6366F1" />
                </View>
              )}
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A', // Very dark blue/black
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 280,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D8A1', // Cyan/Teal button
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  refreshText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mapContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timelineContainer: {
    height: 160, // Ensure enough height for the cards
  },
  scrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  arrowContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  }
});
