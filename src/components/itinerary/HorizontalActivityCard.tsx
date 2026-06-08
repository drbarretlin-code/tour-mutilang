import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Activity } from '../../types/itinerary';
import { t } from '../../i18n';

interface Props {
  activity: Activity;
  index: number;
  onPress?: () => void;
  onEdit?: (id: string) => void;
}

export const HorizontalActivityCard: React.FC<Props> = ({ activity, index, onPress, onEdit }) => {
  return (
    <View style={styles.container}>
      {/* Number Badge */}
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>

      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={onPress}
      >
        <View style={styles.header}>
          <View style={styles.timeContainer}>
            <Ionicons name="time-outline" size={16} color="#00E676" />
            <Text style={styles.timeText}>{activity.startTime}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>
              {activity.type === 'activity' ? t('itinerary.horizontalCard.types.activity') : (activity.type === 'restaurant' || activity.type === 'cafe') ? t('itinerary.horizontalCard.types.dining') : activity.type === 'shopping' ? t('itinerary.horizontalCard.types.shopping') : t('itinerary.horizontalCard.types.experience')}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {activity.title}
        </Text>
        
        {onEdit && (
           <TouchableOpacity onPress={() => onEdit(activity.id)} style={styles.editButton}>
              <Ionicons name="pencil" size={16} color="#94A3B8" />
           </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    marginRight: 16,
    paddingTop: 12, // Space for the floating badge
    position: 'relative',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  numberBadge: {
    position: 'absolute',
    top: 0,
    left: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6', // Blue like the picture
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#0F111A', // Match the dashboard background
  },
  numberText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#00E676', // Bright green as in picture
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  typeBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderColor: 'rgba(0, 230, 118, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  editButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 4,
  }
});
