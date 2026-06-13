import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, TextInput, Platform, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { ItineraryDay, Activity } from '../../types/itinerary';
import i18n, { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import { getRouteDistanceKm } from '../../utils/distance';
import { useResponsive } from '../../hooks/useResponsive';

function getAirportData(regionName: string, isArrival: boolean, isEn: boolean) {
  const rName = (regionName || '').toLowerCase();
  
  if (rName.includes('東京') || rName.includes('日本') || rName.includes('tokyo') || rName.includes('japan') || rName.includes('成田') || rName.includes('羽田') || rName.includes('nrt') || rName.includes('hnd')) {
    const isHaneda = rName.includes('羽田') || rName.includes('hnd') || rName.includes('haneda');
    if (isHaneda) {
      return {
        code: 'HND',
        title: isEn
          ? `🇯🇵 Haneda Airport (HND) ${isArrival ? 'Arrival Terminal' : 'Departure Terminal'} Guide`
          : `🇯🇵 東京羽田國際機場 (HND) ${isArrival ? '入境大廳指引' : '出境大廳指引'}`,
        description: isArrival
          ? (isEn 
              ? '💡 Arrival Guide: Follow the "Arrival / Immigration" signs after deplaning to proceed to immigration and baggage claim. After exiting, take the Tokyo Monorail or Keikyu Line at the underground railway station.'
              : '💡 抵達指引：下飛機後順著「Arrival (入境)」指標前進，至入境審查處辦理入境手續與提取行李。通關後，出口位於抵達大廳。若欲搭乘東京單軌電車 (Tokyo Monorail) 或京急線，請往聯絡通道前進搭乘。')
          : (isEn
              ? '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor entrance. Proceed to the check-in counters of your airline (usually Terminal 3). Security and passport control are located in the center.'
              : '💡 離境指引：接送專車或計程車將在出境大廳入口停靠。請前往第三航廈 (或對應航廈) 的 Check-in 櫃檯辦理登機與行李託運。完成安檢與證照查驗後即可前往登機門。'),
      };
    } else {
      return {
        code: 'NRT',
        title: isEn
          ? `🇯🇵 Narita Airport (NRT) ${isArrival ? 'Arrival Terminal' : 'Departure Terminal'} Guide`
          : `🇯🇵 東京成田國際機場 (NRT) ${isArrival ? '入境大廳指引' : '出境大廳指引'}`,
        description: isArrival
          ? (isEn
              ? '💡 Arrival Guide: Follow the "Arrival / Immigration" signs after deplaning to proceed to immigration and baggage claim. After exiting, take the Narita Express (NEX) or Keisei Skyliner from the B1 train station.'
              : '💡 抵達指引：下飛機後順著「Arrival (入境)」指標前進，至入境審查處辦理入境手續與提取行李。通關後，出口位於抵達大廳。若欲搭乘成田特快 (NEX) 或京成電鐵 (Keisei Skyliner)，請搭手扶梯下至 B1 層乘車。')
          : (isEn
              ? '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor entrance. Proceed to the check-in counters of your airline (Terminal 1/2/3). Security and passport control are located in the center.'
              : '💡 離境指引：接送專車或計程車將在出境大廳入口停靠。請依據您的航空公司前往對應的航廈與 Check-in 櫃檯辦理登機與行李託運。完成安檢與證照查驗後即可前往登機門。'),
      };
    }
  }
  
  if (rName.includes('台灣') || rName.includes('台北') || rName.includes('taiwan') || rName.includes('taipei') || rName.includes('桃園') || rName.includes('tpe')) {
    return {
      code: 'TPE',
      title: isEn
        ? `🇹🇼 Taoyuan Airport (TPE) ${isArrival ? 'Arrival Terminal' : 'Departure Terminal'} Guide`
        : `🇹🇼 桃園國際機場 (TPE) ${isArrival ? '入境大廳指引' : '出境大廳指引'}`,
      description: isArrival
        ? (isEn
            ? '💡 Arrival Guide: Follow the "Immigration" signs after deplaning, clear customs and retrieve your baggage. After exiting, proceed downstairs to take the Taoyuan Airport MRT.'
            : '💡 抵達指引：下飛機後順著「Immigration (證照查驗)」指標前進，通關並提取行李。出關後即為抵達大廳。若欲搭乘桃園機場捷運，請依指標下樓前往捷運站乘車。')
        : (isEn
            ? '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor. Proceed to your airline check-in counters for check-in and baggage drop. Security and passport control are located at the back.'
            : '💡 離境指引：專車或計程車將在出境大廳入口停靠。進入航廈後請至對應的航空公司 Check-in 櫃檯辦理登機與行李託運。安檢與證照查驗位於出境大廳後方。'),
    };
  }

  // Default: Thailand (Bangkok / Suvarnabhumi BKK)
  return {
    code: 'BKK',
    title: isEn
      ? `🇹🇭 Suvarnabhumi Airport (BKK) ${isArrival ? 'Arrival Terminal' : 'Departure Terminal'} Guide`
      : `🇹🇭 曼谷蘇凡納布機場 (BKK) ${isArrival ? '入境大廳指引 (Level 2)' : '出境大廳指引 (Level 4)'}`,
    description: isArrival
      ? (isEn
          ? '💡 Arrival Guide: Follow the "Immigration" signs after deplaning to Level 2 for passport control and baggage claim. Exits are on Level 2. For Airport Rail Link (ARL), go down to B1.'
          : '💡 抵達指引：下飛機後順著「Immigration (入境)」指標前進，至 Level 2 辦理入境與行李提取。提取行李後，出口位於 Level 2 大廳。若欲搭乘機場快線 (ARL)，請搭手扶梯下至 B1 層。')
      : (isEn
          ? '💡 Departure Guide: Taxis or Grab will drop you off at the Level 4 departure gates. Check in at your airline counter. Security and passport control are at the rear of Level 4.'
          : '💡 離境指引：專車或 Grab 將在 Level 4 離境大廳入口停靠。進入航廈後請尋找對應航空公司的 Check-in 櫃檯辦理登機。安檢與證照查驗位於 Level 4 後方中央。'),
  };
}

function getRideHailingInfo(regionName: string, isEn: boolean) {
  const rName = (regionName || '').toLowerCase();
  
  if (rName.includes('東京') || rName.includes('日本') || rName.includes('tokyo') || rName.includes('japan') || rName.includes('成田') || rName.includes('羽田') || rName.includes('nrt') || rName.includes('hnd')) {
    return {
      platform1Name: isEn ? 'GO' : 'GO App',
      platform1Url: 'https://go.mo-t.com/',
      platform1Color: '#005CAF',
      platform2Name: isEn ? 'Uber' : 'Uber App',
      platform2Url: 'https://www.uber.com/jp/zh-tw/',
      platform2Color: '#1A1A1A',
      transitLabel: isEn ? 'GO / Uber' : 'GO / Uber',
    };
  } else if (rName.includes('台灣') || rName.includes('台北') || rName.includes('高雄') || rName.includes('taiwan') || rName.includes('taipei') || rName.includes('tpe')) {
    return {
      platform1Name: isEn ? 'yoxi' : 'yoxi App',
      platform1Url: 'https://www.yoxi.app/',
      platform1Color: '#FF3B30',
      platform2Name: isEn ? 'Uber' : 'Uber App',
      platform2Url: 'https://www.uber.com/tw/zh-tw/',
      platform2Color: '#1A1A1A',
      transitLabel: isEn ? 'yoxi / Uber' : 'yoxi / Uber',
    };
  } else if (rName.includes('泰國') || rName.includes('曼谷') || rName.includes('thailand') || rName.includes('bangkok') || rName.includes('bkk')) {
    return {
      platform1Name: isEn ? 'Grab' : 'Grab App',
      platform1Url: 'https://www.grab.com/',
      platform1Color: '#00B14F',
      platform2Name: isEn ? 'Bolt' : 'Bolt App',
      platform2Url: 'https://bolt.eu/',
      platform2Color: '#34D399',
      transitLabel: isEn ? 'Grab / Bolt' : 'Grab / Bolt',
    };
  } else {
    return {
      platform1Name: isEn ? 'Uber' : 'Uber App',
      platform1Url: 'https://www.uber.com/',
      platform1Color: '#1A1A1A',
      platform2Name: isEn ? 'Google Maps' : 'Google 地圖叫車',
      platform2Url: 'https://maps.google.com/',
      platform2Color: '#4285F4',
      transitLabel: isEn ? 'Uber / Taxi' : 'Uber / 計程車',
    };
  }
}

interface TimelineViewProps {
  day: ItineraryDay;
  onMoveActivity: (activityId: string, direction: 'up' | 'down') => void;
  onAddRecommendedActivity: (gapStartIndex: number) => void;
  onNavigate: (location: NonNullable<Activity['location']>, origin?: NonNullable<Activity['location']>) => void;
  onUpdateNote?: (activityId: string, note: string) => void;
  onEditActivity?: (activityId: string) => void;
  onReRollActivity?: (activityId: string) => void;
  onToggleRainFallback?: (dayNumber: number) => void;
}

export function TimelineView({
  day,
  onMoveActivity,
  onAddRecommendedActivity,
  onNavigate,
  onUpdateNote,
  onEditActivity,
  onReRollActivity,
  onToggleRainFallback,
}: TimelineViewProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { isLargeScreen } = useResponsive();
  const locale = i18n.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const renderVerticalTransitBadge = (transport: any, from?: any, to?: any) => {
    const tData = transport || { mode: 'drive', duration: 10 };
    const distKm = getRouteDistanceKm(tData, from, to);
    const distStr = distKm > 0 ? `${distKm.toFixed(1)} km` : '';
    
    let iconName: any = 'car-outline';
    let modeLabel = t('itinerary.timelineView.transport.mode.drive', { defaultValue: '乘車' });
    let themeColor = '#6366F1'; // Indigo for drive
    let bgColor = '#EEF2FF';
    
    if (tData.mode === 'walk') {
      iconName = 'walk-outline';
      modeLabel = t('itinerary.timelineView.transport.mode.walk', { defaultValue: '步行' });
      themeColor = '#10B981'; // Green for walk
      bgColor = '#ECFDF5';
    } else if (tData.mode === 'public') {
      iconName = 'bus-outline';
      modeLabel = t('itinerary.timelineView.transport.mode.public', { defaultValue: '大眾運輸' });
      themeColor = '#3B82F6'; // Blue for public
      bgColor = '#EFF6FF';
    } else if (tData.mode === 'taxi' || tData.mode === 'charter') {
      iconName = 'car-sport-outline';
      modeLabel = tData.mode === 'taxi' 
        ? t('itinerary.timelineView.transport.mode.taxi', { defaultValue: '計程車' })
        : t('itinerary.timelineView.transport.mode.charter', { defaultValue: '包車' });
      themeColor = '#F59E0B'; // Amber
      bgColor = '#FFFBEB';
    }

    return (
      <View style={[styles.verticalTransitBadge, { backgroundColor: bgColor, borderColor: themeColor + '30' }]}>
        <Ionicons name={iconName} size={13} color={themeColor} />
        <Text style={[styles.verticalTransitText, { color: themeColor }]}>
          {modeLabel} • {tData.duration || 10} {t('common.minutes', { defaultValue: '分鐘' })}{distStr ? ` • ${distStr}` : ''}
        </Text>
      </View>
    );
  };

  // Local state to track notes input before saving
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [expandedTerminalMap, setExpandedTerminalMap] = useState<Record<string, boolean>>({});
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

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
      // 處理各國叫車 App 服務的特例
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

      if (url.includes('yoxi.app')) {
        if (Platform.OS === 'web') {
          alert('請使用手機開啟 yoxi App 進行叫車');
          window.open(url, '_blank');
          return;
        } else {
          const yoxiAppUrl = 'yoxi://';
          const canOpenApp = await Linking.canOpenURL(yoxiAppUrl);
          if (canOpenApp) {
            await Linking.openURL(yoxiAppUrl);
            return;
          }
        }
      }

      if (url.includes('go.mo-t.com')) {
        if (Platform.OS === 'web') {
          alert('請使用手機開啟 GO App 進行叫車');
          window.open(url, '_blank');
          return;
        } else {
          const goAppUrl = 'taxigo://';
          const canOpenApp = await Linking.canOpenURL(goAppUrl);
          if (canOpenApp) {
            await Linking.openURL(goAppUrl);
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
      {day.weather && (
        <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.weatherHeader}>
            <Ionicons name="cloudy-outline" size={20} color={colors.text} />
            <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
              {t('itinerary.timelineView.weather.title', { defaultValue: '今日氣候預測' })}
            </Text>
          </View>
          <View style={styles.weatherInfoRow}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              {day.weather.condition} • {day.weather.temperature}°{day.weather.temperatureUnit} • {t('itinerary.timelineView.weather.rainChance', { defaultValue: '降雨率' })} {day.weather.rainChance}%
            </Text>
          </View>
          {day.weather.rainChance >= 70 && onToggleRainFallback && (
            <View style={[styles.rainAlertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Ionicons name="rainy-outline" size={18} color="#DC2626" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[typography.labelSmall, { color: '#991B1B', fontWeight: '700' }]}>
                  {t('itinerary.timelineView.weather.rainWarning', { defaultValue: '偵測到今日降雨機率偏高！' })}
                </Text>
                <Text style={[typography.labelSmall, { color: '#B91C1C', marginTop: 2 }]}>
                  {t('itinerary.timelineView.weather.rainHint', { defaultValue: '建議一鍵切換雨天備案，自動將戶外景點對調為室內景點。' })}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.rainButton, { backgroundColor: '#EF4444' }]}
                onPress={() => onToggleRainFallback(day.dayNumber)}
              >
                <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                  {t('itinerary.timelineView.weather.swapBtn', { defaultValue: '一鍵切換室內備案' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {activities.map((act, index) => {
        const isFirst = index === 0;
        const isLast = index === activities.length - 1;
        const noteValue = localNotes[act.id] !== undefined ? localNotes[act.id] : (act.notes || '');

        let gapMinutes = 0;
        let showGapRecommendation = false;
        const nextAct = !isLast ? activities[index + 1] : null;
        const nextTransport = nextAct ? nextAct.transport : null;
        if (!isLast && nextAct) {
          const thisEnd = parseTimeToMinutes(act.endTime);
          const nextStart = parseTimeToMinutes(nextAct.startTime);
          gapMinutes = nextStart - thisEnd;
          if (gapMinutes >= 120) {
            showGapRecommendation = true;
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

                    {(() => {
                      const isArrival = day.dayNumber === 1;
                      const airportInfo = getAirportData(day.region, isArrival, isEn);
                      const hailingInfo = getRideHailingInfo(day.region, isEn);
                      const isAirport = act.photoUrl === 'local-asset://airport_map' || act.title.includes('機場') || act.title.toLowerCase().includes('airport');
                      
                      return (
                        <>
                          {isAirport && (
                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 }}>
                              <TouchableOpacity
                                onPress={() => setExpandedTerminalMap(prev => ({ ...prev, [act.id]: !prev[act.id] }))}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  paddingVertical: 10,
                                  paddingHorizontal: 16,
                                  backgroundColor: colors.backgroundSecondary,
                                  borderColor: colors.border,
                                  borderWidth: 1,
                                  borderRadius: borderRadius.md,
                                }}
                              >
                                <Ionicons name="airplane-outline" size={16} color={colors.primary500} />
                                <Text style={[typography.labelMedium, { color: colors.primary500, fontWeight: '700' }]}>
                                  {expandedTerminalMap[act.id] 
                                    ? (isEn ? 'Hide Terminal Map ▴' : '收起航站大廳導覽圖 ▴') 
                                    : (isEn ? `🗺️ Show Terminal Map (${airportInfo.code}) ▾` : `🗺️ 展開航站大廳導覽圖 (${airportInfo.code} Airport) ▾`)}
                                </Text>
                              </TouchableOpacity>

                              {expandedTerminalMap[act.id] && (
                                <View style={{ marginTop: 10, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md, padding: 12 }}>
                                  <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>
                                    {airportInfo.title}
                                  </Text>
                                  <View style={{ borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }}>
                                    <Image 
                                      source={require('../../../assets/images/airport_terminal_map.png')} 
                                      style={{ width: '100%', height: 350, resizeMode: 'contain' }} 
                                    />
                                  </View>
                                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
                                    {airportInfo.description}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.endBtnRow}>
                            <TouchableOpacity 
                              style={[styles.endBtn, { backgroundColor: hailingInfo.platform1Color }]}
                              onPress={() => handleOpenUrl(hailingInfo.platform1Url)}
                            >
                              <Ionicons name="car" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                                {isEn ? `Open ${hailingInfo.platform1Name}` : `點此開啟 ${hailingInfo.platform1Name}`}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.endBtn, { backgroundColor: hailingInfo.platform2Color }]}
                              onPress={() => handleOpenUrl(hailingInfo.platform2Url)}
                            >
                              <Ionicons name="car-sport" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                                {isEn ? `Open ${hailingInfo.platform2Name}` : `點此開啟 ${hailingInfo.platform2Name}`}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      );
                    })()}
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
                <View style={isLargeScreen ? { flexDirection: 'row', gap: 16 } : null}>
                  
                  {/* Left Column: Info & Action Buttons */}
                  <View style={isLargeScreen ? { flex: 2 } : { width: '100%' }}>
                    {/* 1. Header (Time & Region) */}
                    <View style={styles.flatHeader}>
                      <Text style={[typography.labelMedium, { color: '#334155', fontWeight: '700' }]}>
                        {act.startTime}
                      </Text>
                      <Text style={[typography.caption, { color: '#64748B', marginLeft: 8 }]}>
                        {t('itinerary.timelineView.activity.region', { region: day.region || t('itinerary.timelineView.activity.thisRegion') })}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {!!act.location && (
                        <TouchableOpacity onPress={() => onNavigate(act.location!, isFirst ? undefined : activities[index - 1]?.location)} style={{ padding: 4 }}>
                          <Ionicons name="open-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={[typography.titleMedium, { color: '#0F172A', fontWeight: '800', marginTop: 8 }]}>
                      {getActivityTypeLabel(act.type)}：{act.title} {act.localTitle ? `[${act.localTitle}]` : ''}
                    </Text>

                    {/* 景點長介紹（約300字）：可展開／收合，預設顯示前幾行 */}
                    {!!act.description && (
                      <View style={{ marginTop: 6 }}>
                        <Text
                          style={[typography.bodySmall, { color: '#475569', lineHeight: 20 }]}
                          numberOfLines={expandedDesc[act.id] ? undefined : 4}
                        >
                          {act.description}
                        </Text>
                        {act.description.length > 80 && (
                          <TouchableOpacity onPress={() => setExpandedDesc(prev => ({ ...prev, [act.id]: !prev[act.id] }))} style={{ marginTop: 4 }}>
                            <Text style={[typography.caption, { color: colors.primary500, fontWeight: '700' }]}>
                              {expandedDesc[act.id] ? '收起 ▴' : '展開更多 ▾'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {(() => {
                      const isArrival = day.dayNumber === 1;
                      const airportInfo = getAirportData(day.region, isArrival, isEn);
                      const isAirport = act.photoUrl === 'local-asset://airport_map' || act.title.includes('機場') || act.title.toLowerCase().includes('airport');
                      
                      if (!isAirport) return null;
                      
                      return (
                        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 }}>
                          <TouchableOpacity
                            onPress={() => setExpandedTerminalMap(prev => ({ ...prev, [act.id]: !prev[act.id] }))}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              backgroundColor: colors.backgroundSecondary,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: borderRadius.md,
                            }}
                          >
                            <Ionicons name="airplane-outline" size={16} color={colors.primary500} />
                            <Text style={[typography.labelMedium, { color: colors.primary500, fontWeight: '700' }]}>
                              {expandedTerminalMap[act.id] 
                                ? (isEn ? 'Hide Terminal Map ▴' : '收起航站大廳導覽圖 ▴') 
                                : (isEn ? `🗺️ Show Terminal Map (${airportInfo.code}) ▾` : `🗺️ 展開航站大廳導覽圖 (${airportInfo.code} Airport) ▾`)}
                            </Text>
                          </TouchableOpacity>

                          {expandedTerminalMap[act.id] && (
                            <View style={{ marginTop: 10, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md, padding: 12 }}>
                              <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>
                                {airportInfo.title}
                              </Text>
                              <View style={{ borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }}>
                                <Image 
                                  source={require('../../../assets/images/airport_terminal_map.png')} 
                                  style={{ width: '100%', height: 350, resizeMode: 'contain' }} 
                                />
                              </View>
                              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
                                {airportInfo.description}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* 3. Transport Guideline */}
                    {!isLast && (() => {
                      const transitDuration = nextTransport && nextTransport.duration 
                        ? nextTransport.duration 
                        : Math.max(10, gapMinutes);
                      const transitDistance = nextTransport ? getRouteDistanceKm(nextTransport, act.location, nextAct?.location) : 0;
                      const transitDistStr = transitDistance > 0 ? `${transitDistance.toFixed(1)} km` : '';
                      const transitMode = nextTransport ? nextTransport.mode : 'drive';

                      let transitText = '';
                      let transitIconName: any = 'car';
                      let transitIconColor = '#DC2626';

                      const prefix = isEn ? 'Transport Guide: ' : '交通指引：';
                      const estLabel = isEn ? 'estimated' : '預估時間';
                      const minLabel = isEn ? 'mins' : '分鐘';
                      const distLabel = isEn ? 'distance approx.' : '距離約';

                      if (nextTransport && nextTransport.description) {
                        transitText = isEn 
                          ? `${prefix}${nextTransport.description}, ${estLabel} ${transitDuration} ${minLabel}.`
                          : `${prefix}${nextTransport.description}，${estLabel} ${transitDuration} ${minLabel}。`;
                        
                        if (transitMode === 'walk') {
                          transitIconName = 'walk';
                          transitIconColor = '#10B981';
                        } else if (transitMode === 'public') {
                          transitIconName = 'bus';
                          transitIconColor = '#3B82F6';
                        }
                      } else {
                        const distPart = transitDistStr 
                          ? (isEn ? `, ${distLabel} ${transitDistStr}` : `，${distLabel} ${transitDistStr}`) 
                          : '';

                        const hailingInfo = getRideHailingInfo(day.region, isEn);

                        if (transitMode === 'walk') {
                          transitIconName = 'walk';
                          transitIconColor = '#10B981';
                          transitText = isEn
                            ? `${prefix}Walk recommended to the next stop${distPart}, ${estLabel} ${transitDuration} ${minLabel}.`
                            : `${prefix}前往下一站距離較近，建議步行前往${distPart}，${estLabel} ${transitDuration} ${minLabel}。`;
                        } else if (transitMode === 'public') {
                          transitIconName = 'bus';
                          transitIconColor = '#3B82F6';
                          transitText = isEn
                            ? `${prefix}Public transit is convenient, metro/bus recommended${distPart}, ${estLabel} ${transitDuration} ${minLabel}.`
                            : `${prefix}前往下一站大眾運輸便利，建議搭乘地鐵、公車或輕軌前往${distPart}，${estLabel} ${transitDuration} ${minLabel}。`;
                        } else {
                          transitIconName = 'car';
                          transitIconColor = '#DC2626';
                          transitText = isEn
                            ? `${prefix}Public transit is limited, charter/taxi/${hailingInfo.transitLabel} recommended${distPart}, ${estLabel} ${transitDuration} ${minLabel}.`
                            : `${prefix}前往下一站大眾運輸不便，建議搭乘包車、計程車或使用 ${hailingInfo.transitLabel} 叫車${distPart}，${estLabel} ${transitDuration} ${minLabel}。`;
                        }
                      }

                      if (!transitText) return null;

                      return (
                        <View style={[styles.transitGuideRow, { marginTop: 12 }]}>
                          <Ionicons name={transitIconName} size={16} color={transitIconColor} />
                          <Text style={[typography.caption, { color: '#475569', marginLeft: 6, flex: 1 }]}>
                            {transitText}
                          </Text>
                        </View>
                      );
                    })()}

                    {/* 4. Action Buttons (Nav & Booking) */}
                    <View style={[styles.actionBtnRow, { marginTop: 16 }]}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
                        onPress={() => onNavigate(act.location || { latitude: 0, longitude: 0, address: '', name: act.title }, isFirst ? undefined : activities[index - 1]?.location)}
                      >
                        <Ionicons name="navigate-circle-outline" size={16} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={[typography.caption, { color: '#059669', fontWeight: '700' }]}>{t('itinerary.timelineView.activity.navigate')}</Text>
                      </TouchableOpacity>

                      {(act.bookingRecommended || ['attraction', 'activity'].includes(act.type)) && (
                        <>
                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: '#FF5B00', backgroundColor: '#FFF0E5' }]}
                            onPress={() => handleOpenUrl(`https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(act.localTitle || act.title)}`)}
                          >
                            <Ionicons name="ticket" size={14} color="#FF5B00" style={{ marginRight: 4 }} />
                            <Text style={[typography.caption, { color: '#FF5B00', fontWeight: '700' }]}>Klook 找票券</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: '#26C2D6', backgroundColor: '#E0FAFD' }]}
                            onPress={() => handleOpenUrl(`https://www.kkday.com/zh-tw/product/productlist?word=${encodeURIComponent(act.localTitle || act.title)}`)}
                          >
                            <Ionicons name="ticket" size={14} color="#26C2D6" style={{ marginRight: 4 }} />
                            <Text style={[typography.caption, { color: '#26C2D6', fontWeight: '700' }]}>KKday 找體驗</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }]}
                        onPress={() => handleOpenUrl(`https://www.google.com/search?q=${encodeURIComponent((act.localTitle || act.title) + ' ' + (day.region || ''))}`)}
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

                      {onEditActivity && (
                        <TouchableOpacity 
                          style={[styles.actionBtn, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                          onPress={() => onEditActivity(act.id)}
                        >
                          <Ionicons name="pencil-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                          <Text style={[typography.caption, { color: '#475569', fontWeight: '600' }]}>{t('common.edit')}</Text>
                        </TouchableOpacity>
                      )}

                      {onReRollActivity && !['hotel', 'transport'].includes(act.type) && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: '#FDE047', backgroundColor: '#FEF9C3' }]}
                          onPress={() => onReRollActivity(act.id)}
                        >
                          <Ionicons name="dice-outline" size={14} color="#A16207" style={{ marginRight: 4 }} />
                          <Text style={[typography.caption, { color: '#A16207', fontWeight: '600' }]}>{t('itinerary.timelineView.activity.reroll', { defaultValue: '換一個' })}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Right Column: Notes block */}
                  <View style={isLargeScreen ? { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.divider, paddingLeft: 16, justifyContent: 'center' } : null}>
                    {/* 5. Notes Input */}
                    <View style={[styles.notesContainer, isLargeScreen ? { borderTopWidth: 0, marginTop: 0, paddingTop: 0 } : { borderTopColor: '#F1F5F9' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isLargeScreen ? 6 : 0 }}>
                        <Ionicons name="create-outline" size={16} color="#94A3B8" />
                        <Text style={[typography.caption, { color: '#64748B', marginLeft: 4 }]}>{t('itinerary.timelineView.activity.notesLabel')}</Text>
                      </View>
                      <TextInput
                        style={[styles.noteInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.backgroundSecondary, marginLeft: isLargeScreen ? 0 : 8, width: '100%' }]}
                        placeholder={t('itinerary.timelineView.activity.notesPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        value={noteValue}
                        onChangeText={(text) => handleNoteChange(act.id, text)}
                        onBlur={() => handleNoteBlur(act.id)}
                        multiline={isLargeScreen}
                        numberOfLines={isLargeScreen ? 3 : 1}
                      />
                    </View>
                  </View>

                </View>
              </View>

              {/* Transit indicator if next activity is coming */}
              {!showGapRecommendation && !isLast && (
                <View style={styles.verticalTransitContainer}>
                  <View style={[styles.transitVerticalLine, { backgroundColor: '#E2E8F0', height: 48 }]} />
                  {renderVerticalTransitBadge(activities[index + 1].transport, act.location, activities[index + 1].location)}
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
  verticalTransitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    position: 'relative',
    marginTop: 8,
    marginBottom: 8,
  },
  verticalTransitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 16,
    gap: 4,
  },
  verticalTransitText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  weatherCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weatherInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rainAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  rainButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
});
