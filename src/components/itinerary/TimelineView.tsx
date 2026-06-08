import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, TextInput, Platform, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { ItineraryDay, Activity } from '../../types/itinerary';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

interface TimelineViewProps {
  day: ItineraryDay;
  onMoveActivity: (activityId: string, direction: 'up' | 'down') => void;
  onAddRecommendedActivity: (gapStartIndex: number) => void;
  onNavigate: (location: NonNullable<Activity['location']>, origin?: NonNullable<Activity['location']>) => void;
  onUpdateNote?: (activityId: string, note: string) => void;
  onEditActivity: (activityId: string) => void;
}

export function TimelineView({
  day,
  onMoveActivity,
  onAddRecommendedActivity,
  onNavigate,
  onUpdateNote,
  onEditActivity,
}: TimelineViewProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  // Local state to track notes input before saving
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  const handleNoteChange = (id: string, text: string) => {
    setLocalNotes(prev => ({ ...prev, [id]: text }));
  };

  const handleNoteBlur = (id: string) => {
    if (onUpdateNote && localNotes[id] !== undefined) {
      onUpdateNote(id, localNotes[id]);
    }
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'transport': return t('itinerary.timelineView.types.transport');
      case 'meal': return t('itinerary.timelineView.types.meal');
      case 'hotel': return t('itinerary.timelineView.types.hotel');
      case 'attraction': return t('itinerary.timelineView.types.attraction');
      default: return t('itinerary.timelineView.types.default');
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      // 處理 Grab 與 Bolt 這種純 App 服務的特例
      if (url.includes('grab.com')) {
        if (Platform.OS === 'web') {
          alert(t('itinerary.timelineView.alerts.grabWebHint'));
          window.open(url, '_blank');
          return;
        } else {
          const grabAppUrl = 'grab://';
          const canOpenApp = await Linking.canOpenURL(grabAppUrl);
          if (canOpenApp) {
            await Linking.openURL(grabAppUrl);
            return;
          }
        }
      }

      if (url.includes('bolt.eu')) {
         if (Platform.OS === 'web') {
          alert(t('itinerary.timelineView.alerts.boltWebHint'));
          window.open(url, '_blank');
          return;
        } else {
          const boltAppUrl = 'bolt://';
          const canOpenApp = await Linking.canOpenURL(boltAppUrl);
          if (canOpenApp) {
            await Linking.openURL(boltAppUrl);
            return;
          }
        }
      }

      // 一般網頁
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(t('itinerary.timelineView.alerts.cannotOpenTitle'), t('itinerary.timelineView.alerts.cannotOpenMessage'));
        }
      }
    } catch (e) {
      console.warn('Failed to open url', e);
      if (Platform.OS !== 'web') {
        Alert.alert(t('itinerary.timelineView.alerts.errorTitle'), t('itinerary.timelineView.alerts.errorMessage'));
      }
    }
  };

  const activities = day.activities || [];

  return (
    <View style={styles.container}>
      {activities.map((act, index) => {
        const isFirst = index === 0;
        const isLast = index === activities.length - 1;
        const noteValue = localNotes[act.id] !== undefined ? localNotes[act.id] : (act.notes || '');

        let gapMinutes = 0;
        let showGapRecommendation = false;
        if (!isLast) {
          const nextAct = activities[index + 1];
          if (nextAct) {
            const thisEnd = parseTimeToMinutes(act.endTime);
            const nextStart = parseTimeToMinutes(nextAct.startTime);
            gapMinutes = nextStart - thisEnd;
            if (gapMinutes >= 120) {
              showGapRecommendation = true;
            }
          }
        }

        // Special render for the very last item returning to hotel/airport
        if (isLast) {
          return (
            <View key={act.id} style={styles.timelineRow}>
              <View style={styles.leftColumn}>
                <View style={[styles.timelineIconWrapper, { backgroundColor: '#F3E8FF', borderColor: '#9333EA' }]}>
                  <Ionicons name="moon" size={14} color="#9333EA" />
                </View>
              </View>

              <View style={[styles.rightColumn, { paddingBottom: 0 }]}>
                <View style={[styles.card, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF', borderRadius: borderRadius.md }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[typography.bodyMedium, { color: '#7E22CE', fontWeight: '700' }]}>
                      {t('itinerary.timelineView.endOfDay.title')}
                    </Text>
                  </View>
                  
                  <View style={[styles.endContentBox, { borderColor: '#E9D5FF', backgroundColor: '#F5F3FF' }]}>
                    <Text style={[typography.labelSmall, { color: '#6B21A8', marginBottom: 6 }]}>
                      {t('itinerary.timelineView.endOfDay.transportAdvice')}
                    </Text>
                    <View style={[styles.transportGuideBox, { backgroundColor: '#FFFFFF', borderColor: '#DDD6FE' }]}>
                      <Text style={[typography.labelSmall, { color: '#581C87', fontWeight: '700', marginBottom: 4 }]}>
                        {t('itinerary.timelineView.endOfDay.shuttleGuideTitle')}
                      </Text>
                      <Text style={[typography.caption, { color: '#4C1D95' }]}>
                        {t('itinerary.timelineView.endOfDay.shuttleGuideDesc', { hotelName: act.location?.name || t('itinerary.timelineView.endOfDay.yourHotel') })}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: '#6B21A8', marginTop: 8 }]}>
                      {t('itinerary.timelineView.endOfDay.tonightStay', { hotelName: act.location?.name || t('itinerary.timelineView.endOfDay.yourHotel') })}
                    </Text>

                    {act.photoUrl === 'local-asset://airport_map' && (
                      <View style={{ marginTop: 12, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden', padding: 8 }}>
                        <Image 
                          source={require('../../../assets/images/airport_terminal_map.png')} 
                          style={{ width: '100%', height: 450, resizeMode: 'contain' }} 
                        />
                        <Text style={[typography.caption, { color: '#64748B', textAlign: 'center', marginTop: 8 }]}>{t('itinerary.timelineView.endOfDay.airportMapHint')}</Text>
                      </View>
                    )}

                    <View style={styles.endBtnRow}>
                      <TouchableOpacity 
                        style={[styles.endBtn, { backgroundColor: '#7C3AED' }]}
                        onPress={() => Linking.openURL('https://www.grab.com')}
                      >
                        <Ionicons name="car" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>{t('itinerary.timelineView.endOfDay.openGrab')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.endBtn, { backgroundColor: '#DB2777' }]}
                        onPress={() => Linking.openURL('https://bolt.eu')}
                      >
                        <Ionicons name="car-sport" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>{t('itinerary.timelineView.endOfDay.openBolt')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        }

        // Standard flat card design
        return (
          <View key={act.id} style={styles.timelineRow}>
            {/* Left Timeline Line & Icon indicator */}
            <View style={styles.leftColumn}>
              <View style={[styles.timelineIconWrapper, { backgroundColor: '#E0F2FE', borderColor: '#0284C7' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0284C7' }} />
              </View>
              <View style={[styles.line, { backgroundColor: '#E2E8F0' }]} />
            </View>

            {/* Right Activity Card */}
            <View style={[styles.rightColumn, { paddingBottom: spacing.lg }]}>
              <View style={[styles.card, { borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: borderRadius.md }]}>
                
                {/* 1. Header (Time & Region) */}
                <View style={styles.flatHeader}>
                  <Text style={[typography.labelMedium, { color: '#334155', fontWeight: '700' }]}>
                    {act.startTime}
                  </Text>
                  <Text style={[typography.caption, { color: '#64748B', marginLeft: 8 }]}>
                    {t('itinerary.timelineView.activity.region', { region: day.region || t('itinerary.timelineView.activity.thisRegion') })}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => onEditActivity(act.id)} style={{ padding: 4, marginRight: 4 }}>
                    <Ionicons name="pencil" size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  {!!act.location && (
                    <TouchableOpacity onPress={() => onNavigate(act.location!, isFirst ? undefined : activities[index - 1]?.location)} style={{ padding: 4 }}>
                      <Ionicons name="open-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[typography.titleMedium, { color: '#0F172A', fontWeight: '800', marginTop: 8 }]}>
                  {getActivityTypeLabel(act.type)}：{act.title} {act.localTitle ? `[${act.localTitle}]` : ''}
                </Text>

                {act.photoUrl === 'local-asset://airport_map' && (
                  <View style={{ marginTop: 12, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden', padding: 8 }}>
                    <Image 
                      source={require('../../../assets/images/airport_terminal_map.png')} 
                      style={{ width: '100%', height: 450, resizeMode: 'contain' }} 
                    />
                    <Text style={[typography.caption, { color: '#64748B', textAlign: 'center', marginTop: 8 }]}>{t('itinerary.timelineView.endOfDay.airportMapHint')}</Text>
                  </View>
                )}

                {/* 3. Transport Guideline */}
                <View style={[styles.transitGuideRow, { marginTop: 12 }]}>
                  <Ionicons name="car" size={16} color="#DC2626" />
                  <Text style={[typography.caption, { color: '#475569', marginLeft: 6, flex: 1 }]}>
                    {t('itinerary.timelineView.activity.transitGuide', { gap: Math.max(10, gapMinutes - act.duration) })}
                  </Text>
                </View>

                {/* 4. Action Buttons (Nav & Booking) */}
                <View style={[styles.actionBtnRow, { marginTop: 16 }]}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
                    onPress={() => onNavigate(act.location || { latitude: 0, longitude: 0, address: '', name: act.title }, isFirst ? undefined : activities[index - 1]?.location)}
                  >
                    <Ionicons name="navigate-circle-outline" size={16} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={[typography.caption, { color: '#059669', fontWeight: '700' }]}>{t('itinerary.timelineView.activity.navigate')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                    onPress={() => handleOpenUrl(`https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(act.title)}`)}
                  >
                    <Ionicons name="ticket-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={[typography.caption, { color: '#475569', fontWeight: '600' }]}>Klook {day.region || ''}{t('itinerary.timelineView.activity.charter')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                    onPress={() => handleOpenUrl(`https://www.kkday.com/zh-tw/product/productlist?word=${encodeURIComponent(act.title)}`)}
                  >
                    <Ionicons name="ticket-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={[typography.caption, { color: '#475569', fontWeight: '600' }]}>KKday {day.region || ''}{t('itinerary.timelineView.activity.charter')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }]}
                    onPress={() => handleOpenUrl(`https://www.google.com/search?q=${encodeURIComponent(act.title + ' ' + (day.region || ''))}`)}
                  >
                    <Ionicons name="search-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={[typography.caption, { color: '#2563EB', fontWeight: '600' }]}>{t('itinerary.timelineView.activity.googleSearch', { defaultValue: 'Google 搜尋' })}</Text>
                  </TouchableOpacity>
                  
                  {act.links && act.links.map((link, idx) => (
                    <TouchableOpacity 
                      key={idx}
                      style={[styles.actionBtn, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                      onPress={() => handleOpenUrl(link.url)}
                    >
                      <Ionicons name="link-outline" size={14} color="#3B82F6" style={{ marginRight: 4 }} />
                      <Text style={[typography.caption, { color: '#3B82F6', fontWeight: '600' }]} numberOfLines={1}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 5. Notes Input */}
                <View style={[styles.notesContainer, { borderTopColor: '#F1F5F9' }]}>
                  <Ionicons name="create-outline" size={16} color="#94A3B8" />
                  <Text style={[typography.caption, { color: '#64748B', marginLeft: 4 }]}>{t('itinerary.timelineView.activity.notesLabel')}</Text>
                  <TextInput
                    style={[styles.noteInput, { borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#F8FAFC' }]}
                    placeholder={t('itinerary.timelineView.activity.notesPlaceholder')}
                    placeholderTextColor="#94A3B8"
                    value={noteValue}
                    onChangeText={(text) => handleNoteChange(act.id, text)}
                    onBlur={() => handleNoteBlur(act.id)}
                  />
                </View>
              </View>

              {/* Transit indicator if next activity is coming */}
              {!showGapRecommendation && (
                <View style={styles.shortTransitRow}>
                  <View style={[styles.transitVerticalLine, { backgroundColor: '#E2E8F0' }]} />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 32,
    alignItems: 'center',
  },
  timelineIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    marginTop: 8,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -8, // connect to next
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  flatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transitGuideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  noteInput: {
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    fontSize: 13,
  },
  shortTransitRow: {
    height: 24,
    justifyContent: 'center',
  },
  transitVerticalLine: {
    width: 2,
    height: 24,
    marginLeft: -29,
  },
  cardHeader: {
    marginBottom: 8,
  },
  endContentBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  transportGuideBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  endBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
});
