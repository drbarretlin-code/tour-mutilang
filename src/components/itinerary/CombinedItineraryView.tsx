import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Itinerary, Activity } from '../../types/itinerary';
import { Itinerary3DMap } from './Itinerary3DMap';
import { getDayRouteNavigationUrl } from './MapFallbackView';
import { HorizontalActivityCard } from './HorizontalActivityCard';
import { t } from '../../i18n';
import { getRouteDistanceKm } from '../../utils/distance';

interface Props {
  itinerary: Itinerary;
  activeDay: number;
  mapProvider?: 'apple' | 'google' | 'amap' | 'baidu';
  onEditActivity?: (id: string) => void;
  onRefreshMap?: () => void;
  onNavigate?: (location: { latitude?: number; longitude?: number; address?: string; name?: string }) => void;
}

export const CombinedItineraryView: React.FC<Props> = ({ itinerary, activeDay, mapProvider = 'google', onEditActivity, onRefreshMap, onNavigate }) => {
  const currentDayData = itinerary.days.find(d => d.dayNumber === activeDay) || itinerary.days[0];
  
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const scrollNode = scrollRef.current?.getScrollableNode?.() || scrollRef.current;
    if (!scrollNode) return;

    scrollNode.classList.add('web-timeline-scroll');

    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      scrollNode.style.cursor = 'grabbing';
      startX = e.pageX - scrollNode.offsetLeft;
      scrollLeft = scrollNode.scrollLeft;
      e.preventDefault();
    };

    const handleMouseLeave = () => {
      isDown = false;
      scrollNode.style.cursor = 'grab';
    };

    const handleMouseUp = () => {
      isDown = false;
      scrollNode.style.cursor = 'grab';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollNode.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollNode.scrollLeft = scrollLeft - walk;
    };

    scrollNode.style.cursor = 'grab';
    scrollNode.style.userSelect = 'none';

    scrollNode.addEventListener('mousedown', handleMouseDown);
    scrollNode.addEventListener('mouseleave', handleMouseLeave);
    scrollNode.addEventListener('mouseup', handleMouseUp);
    scrollNode.addEventListener('mousemove', handleMouseMove);

    return () => {
      scrollNode.removeEventListener('mousedown', handleMouseDown);
      scrollNode.removeEventListener('mouseleave', handleMouseLeave);
      scrollNode.removeEventListener('mouseup', handleMouseUp);
      scrollNode.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentDayData]);

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

      {/* Open full route in user's preferred map app */}
      {(() => {
        const navUrl = getDayRouteNavigationUrl(currentDayData.activities, mapProvider);
        if (!navUrl) return null;
        return (
          <TouchableOpacity style={styles.navigateButton} onPress={() => Linking.openURL(navUrl)}>
            <Ionicons name="navigate" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.refreshText}>
              {t('itinerary.map.openNavigation', { provider: t(`survey.map.${mapProvider}`) })}
            </Text>
          </TouchableOpacity>
        );
      })()}

      {/* Horizontal Timeline Section */}
      <View style={styles.timelineContainer}>
        {Platform.OS === 'web' && (
          <style dangerouslySetInnerHTML={{__html: `
            .web-timeline-scroll::-webkit-scrollbar {
              height: 10px !important;
              display: block !important;
            }
            .web-timeline-scroll::-webkit-scrollbar-track {
              background: #1E293B !important;
              border-radius: 6px !important;
            }
            .web-timeline-scroll::-webkit-scrollbar-thumb {
              background: #4F46E5 !important;
              border-radius: 6px !important;
              border: 2px solid #1E293B !important;
            }
            .web-timeline-scroll::-webkit-scrollbar-thumb:hover {
              background: #6366F1 !important;
            }
          `}} />
        )}
        <ScrollView 
          ref={scrollRef}
          horizontal 
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          {(() => {
            let routeLegs: any[] = [];
            try {
              if (currentDayData.routeGeometry) {
                const geoData = JSON.parse(currentDayData.routeGeometry);
                if (geoData && geoData.legs) routeLegs = geoData.legs;
              }
            } catch (e) {}

            const points = currentDayData.activities.map((act) => ({
              ...act,
              isHotel: act.type === 'hotel',
            }));

            return points.map((pt, index) => {
              let distanceStr = '';
              if (index < points.length - 1) {
                const nextPt = points[index + 1];
                let distanceKm = getRouteDistanceKm(nextPt.transport, pt.location, nextPt.location);
                if (routeLegs && routeLegs[index] && routeLegs[index].distance) {
                  distanceKm = routeLegs[index].distance / 1000;
                }
                if (distanceKm > 0) distanceStr = `${distanceKm.toFixed(1)} km`;
              }

              return (
                <React.Fragment key={pt.id}>
                  {pt.isHotel ? (
                    <View style={styles.hotelCardContainer}>
                      <View style={[styles.numberBadge, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.numberText}>H</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.card, { borderColor: 'rgba(16, 185, 129, 0.3)' }]} 
                        activeOpacity={0.8}
                      >
                        <View style={styles.cardHeader}>
                          <View style={styles.timeContainer}>
                            <Ionicons name="time-outline" size={16} color="#10B981" />
                            <Text style={[styles.timeText, { color: '#10B981' }]}>{pt.startTime}</Text>
                          </View>
                          <View style={[styles.typeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                            <Text style={[styles.typeText, { color: '#10B981' }]}>
                              {t('itinerary.activity.type.hotel')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {pt.title}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <HorizontalActivityCard 
                      activity={pt as unknown as Activity} 
                      index={index} 
                      onEdit={onEditActivity}
                      onPress={() => {
                        if (pt.location && onNavigate) {
                          onNavigate(pt.location);
                        }
                      }}
                    />
                  )}
                  {index < points.length - 1 && (
                    <View style={styles.arrowContainer}>
                      <Text style={styles.distanceText}>{distanceStr}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="chevron-forward" size={20} color={pt.isHotel ? '#10B981' : '#6366F1'} style={{ marginRight: -10 }} />
                        <Ionicons name="chevron-forward" size={20} color={pt.isHotel ? '#10B981' : '#6366F1'} />
                      </View>
                    </View>
                  )}
                </React.Fragment>
              );
            });
          })()}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0F111A', // Very dark blue/black
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
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
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 24,
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
    minHeight: 180, // Increased to ensure scrollbar is visible
    paddingBottom: 8,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 24, // Added bottom padding to prevent scrollbar clipping
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  arrowContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  hotelCardContainer: {
    width: 280,
    marginRight: 16,
    paddingTop: 12,
    position: 'relative',
  },
  numberBadge: {
    position: 'absolute',
    top: 0,
    left: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#0F111A',
  },
  numberText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  cardHeader: {
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
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  typeBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  distanceText: {
    color: '#00D8A1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  }
});
