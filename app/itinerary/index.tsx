import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSurvey } from '../../src/context/SurveyContext';
import { useTheme } from '../../src/context/ThemeContext';
import { DailySummaryCard } from '../../src/components/itinerary/DailySummaryCard';
import { TimelineView } from '../../src/components/itinerary/TimelineView';
import { MapFallbackView } from '../../src/components/itinerary/MapFallbackView';
import { PackingChecklist } from '../../src/components/itinerary/PackingChecklist';
import { ExpenseSplitter } from '../../src/components/itinerary/ExpenseSplitter';
import { TravelTranslator } from '../../src/components/itinerary/TravelTranslator';
import { DestinationGuide } from '../../src/components/itinerary/DestinationGuide';
import { Itinerary3DMap } from '../../src/components/itinerary/Itinerary3DMap';
import { CombinedItineraryView } from '../../src/components/itinerary/CombinedItineraryView';
import { ActivityEditorModal } from '../../src/components/itinerary/ActivityEditorModal';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { t } from '../../src/i18n';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Itinerary, Activity } from '../../src/types/itinerary';
import { dbService } from '../../src/services/db';
import { syncService } from '../../src/services/sync';
import { auth } from '../../src/services/firebase';
import { useResponsive } from '../../src/hooks/useResponsive';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateItineraryHtml } from '../../src/utils/pdfGenerator';

const OFFLINE_ITINERARY_KEY = '@trip_active_itinerary';
const OFFLINE_SURVEY_KEY = '@trip_active_survey';

type ViewMode = 'timeline' | 'map' | 'checklist' | 'expenses' | 'translator';

export default function ItineraryScreen() {
  const { survey: contextSurvey, activeItinerary: contextItinerary, updateSurvey } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();

  const { isLargeScreen } = useResponsive();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'map' | 'checklist' | 'expenses' | 'translator' | 'guide'>('timeline');
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(true);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const itineraryRef = useRef(itinerary);
  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

  // 1. Initialize and load itinerary data
  useEffect(() => {
    async function loadData() {
      try {
        if (contextItinerary) {
          setItinerary(contextItinerary);
          await AsyncStorage.setItem(OFFLINE_ITINERARY_KEY, JSON.stringify(contextItinerary));
          await AsyncStorage.setItem(OFFLINE_SURVEY_KEY, JSON.stringify(contextSurvey));
        } else {
          const cachedItinerary = await AsyncStorage.getItem(OFFLINE_ITINERARY_KEY);
          const cachedSurvey = await AsyncStorage.getItem(OFFLINE_SURVEY_KEY);

          if (cachedItinerary) {
            const parsedItinerary = JSON.parse(cachedItinerary) as Itinerary;
            setItinerary(parsedItinerary);
            setIsOffline(true);

            if (cachedSurvey) {
              const parsedSurvey = JSON.parse(cachedSurvey);
              updateSurvey(parsedSurvey);
            }
          }
        }
      } catch (error) {
        console.error('Error loading itinerary data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [contextItinerary]);

  // 2. Real-time Firebase Database subscription for multi-user sync
  useEffect(() => {
    if (!itinerary?.id || isOffline) return;

    const unsubscribe = syncService.subscribeToItinerary(itinerary.id, (updatedItinerary) => {
      if (updatedItinerary && (!itineraryRef.current || updatedItinerary.updatedAt !== itineraryRef.current.updatedAt)) {
        setItinerary(updatedItinerary);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [itinerary?.id, isOffline]);

  useEffect(() => {
    // We no longer need the global print styles as we use an iframe with our custom pdfGenerator.ts HTML
    const existing = document.getElementById('print-fix-styles');
    if (existing) document.head.removeChild(existing);
  }, []);

  // Handle activity swap up/down
  const handleMoveActivity = async (activityId: string, direction: 'up' | 'down') => {
    if (!itinerary) return;

    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    const dayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === activeDay);
    if (dayIndex === -1) return;

    const day = { ...updatedItinerary.days[dayIndex]! };
    const activities = [...day.activities];

    const actIndex = activities.findIndex(a => a.id === activityId);
    if (actIndex === -1) return;

    const targetIndex = direction === 'up' ? actIndex - 1 : actIndex + 1;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    // Deep copy objects to prevent mutation issues
    const act = { ...activities[actIndex]! };
    const targetAct = { ...activities[targetIndex]! };

    // Swap times
    const tempTime = act.startTime;
    const tempEndTime = act.endTime;
    act.startTime = targetAct.startTime;
    act.endTime = targetAct.endTime;
    targetAct.startTime = tempTime;
    targetAct.endTime = tempEndTime;

    // Swap positions
    activities[actIndex] = targetAct;
    activities[targetIndex] = act;

    day.activities = activities.map((a, idx) => ({ ...a, order: idx }));
    updatedItinerary.days[dayIndex] = day;

    setItinerary(updatedItinerary);
    await saveAndSyncItinerary(updatedItinerary);
  };

  const handleUpdateNote = async (activityId: string, note: string) => {
    if (!itinerary || !activeDay) return;
    
    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    const dayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === activeDay);
    if (dayIndex === -1) return;

    const day = { ...updatedItinerary.days[dayIndex]! };
    const activities = [...day.activities];
    const actIndex = activities.findIndex(a => a.id === activityId);
    if (actIndex > -1) {
      activities[actIndex] = { ...activities[actIndex]!, notes: note };
      day.activities = activities;
      updatedItinerary.days[dayIndex] = day;
      
      setItinerary(updatedItinerary);
      // Background save
      saveAndSyncItinerary(updatedItinerary).catch(console.error);
    }
  };

  const getEditingActivity = (): Activity | null => {
    if (!itinerary || !editingActivityId) return null;
    for (const day of itinerary.days) {
      const act = day.activities.find(a => a.id === editingActivityId);
      if (act) return act;
    }
    return null;
  };

  const handleSaveActivity = async (updatedActivity: Activity, targetDayNumber: number) => {
    if (!itinerary || !editingActivityId) return;

    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    
    let originalDayIndex = -1;
    for (let i = 0; i < updatedItinerary.days.length; i++) {
      if (updatedItinerary.days[i]!.activities.some(a => a.id === editingActivityId)) {
        originalDayIndex = i;
        break;
      }
    }
    if (originalDayIndex === -1) return;

    const targetDayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === targetDayNumber);
    if (targetDayIndex === -1) return;

    let originalDay = { ...updatedItinerary.days[originalDayIndex]! };
    let originalActivities = [...originalDay.activities].filter(a => a.id !== editingActivityId);
    
    if (originalDayIndex === targetDayIndex) {
      originalActivities.push(updatedActivity);
      originalActivities.sort((a, b) => {
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return ((timeA[0] || 0) * 60 + (timeA[1] || 0)) - ((timeB[0] || 0) * 60 + (timeB[1] || 0));
      });
      originalDay.activities = originalActivities.map((act, idx) => ({ ...act, order: idx }));
      updatedItinerary.days[originalDayIndex] = originalDay;
    } else {
      originalDay.activities = originalActivities.map((act, idx) => ({ ...act, order: idx }));
      updatedItinerary.days[originalDayIndex] = originalDay;

      let targetDay = { ...updatedItinerary.days[targetDayIndex]! };
      let targetActivities = [...targetDay.activities];
      targetActivities.push(updatedActivity);
      targetActivities.sort((a, b) => {
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return ((timeA[0] || 0) * 60 + (timeA[1] || 0)) - ((timeB[0] || 0) * 60 + (timeB[1] || 0));
      });
      targetDay.activities = targetActivities.map((act, idx) => ({ ...act, order: idx }));
      updatedItinerary.days[targetDayIndex] = targetDay;
    }

    setItinerary(updatedItinerary);
    setEditingActivityId(null);
    await saveAndSyncItinerary(updatedItinerary);
  };

  const handleDeleteActivity = async (activityId: string, dayNumber: number) => {
    if (!itinerary) return;

    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    const dayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === dayNumber);
    if (dayIndex === -1) return;

    let day = { ...updatedItinerary.days[dayIndex]! };
    let activities = [...day.activities].filter(a => a.id !== activityId);
    day.activities = activities.map((act, idx) => ({ ...act, order: idx }));
    updatedItinerary.days[dayIndex] = day;

    setItinerary(updatedItinerary);
    setEditingActivityId(null);
    await saveAndSyncItinerary(updatedItinerary);
  };

  // Handle plugging time gap
  const handleAddRecommendedActivity = async (gapStartIndex: number) => {
    if (!itinerary) return;

    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    const dayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === activeDay);
    if (dayIndex === -1) return;

    const day = { ...updatedItinerary.days[dayIndex]! };
    const activities = [...day.activities];

    const actA = activities[gapStartIndex]!;
    const actB = activities[gapStartIndex + 1]!;

    if (!actA || !actB) return;

    const newAct: Activity = {
      id: `act-rec-${Date.now()}`,
      order: gapStartIndex + 1,
      startTime: actA.endTime,
      endTime: actB.startTime,
      title: 'AI 推薦：精選在地美食品嚐',
      type: 'restaurant',
      description: '為您推薦周邊高人氣美食餐廳，適合在行程空檔放鬆享用。',
      location: {
        name: '特色小吃與咖啡廳',
        address: '景點步行區域內',
        latitude: actA.location?.latitude || 0,
        longitude: actA.location?.longitude || 0
      },
      duration: 90,
      links: [],
      notes: '推薦試試當地特色冷飲。',
      isMustVisit: false
    };

    activities.splice(gapStartIndex + 1, 0, newAct);

    day.activities = activities.map((act, idx) => ({ ...act, order: idx }));
    updatedItinerary.days[dayIndex] = day;

    setItinerary(updatedItinerary);
    await saveAndSyncItinerary(updatedItinerary);
    Alert.alert('AI 推薦', '已為您自動填補行程空檔並更新路線！');
  };

  const saveAndSyncItinerary = async (updatedItinerary: Itinerary) => {
    try {
      await AsyncStorage.setItem(OFFLINE_ITINERARY_KEY, JSON.stringify(updatedItinerary));
      const user = auth.currentUser;
      if (user) {
        await dbService.saveItinerary(updatedItinerary);
        await syncService.publishItinerary(updatedItinerary);
      }
    } catch (error) {
      console.error('Error syncing itinerary updates:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!itinerary) return;
    try {
      setLoading(true);
      const html = generateItineraryHtml(itinerary);

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          
          iframe.contentWindow?.focus();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }, 500);
        } else {
          await Print.printAsync({ html });
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: '匯出行程 PDF',
            UTI: 'com.adobe.pdf'
          });
        } else {
          Alert.alert('匯出成功', `PDF 已產生至：${uri}`);
        }
      }
    } catch (error) {
      console.error('PDF Export Error:', error);
      Alert.alert('匯出失敗', '無法產生 PDF 檔案。');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
        <Text style={[typography.titleMedium, { color: colors.text, marginTop: spacing.md }]}>
          {t('survey.generating')}
        </Text>
      </SafeAreaView>
    );
  }

  if (!itinerary) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error500} />
        <Text style={[typography.titleLarge, { color: colors.text, marginTop: spacing.md }]}>
          無行程資料
        </Text>
        <Button
          title="返回首頁"
          onPress={() => router.replace('/')}
          style={{ marginTop: spacing.lg }}
        />
      </SafeAreaView>
    );
  }

  const currentDayData = itinerary.days.find(d => d.dayNumber === activeDay) || itinerary.days[0];
  const isDailyView = viewMode === 'timeline';

  // Render Left Panel (3D Map & Daily Summary Card) for Large screens
  const renderLeftPanel = () => (
    <View style={[styles.leftPanel, { borderRightColor: colors.divider, borderRightWidth: 1 }]}>
      <Card variant="flat" style={styles.mapCard}>
        <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '700' }]}>
          全行程 3D 立體景觀圖
        </Text>
        <Itinerary3DMap itinerary={itinerary} activeDay={activeDay} height={320} />
      </Card>
      {currentDayData && (
        <ScrollView style={{ flex: 1, marginTop: spacing.md }} showsVerticalScrollIndicator={false}>
          <DailySummaryCard day={currentDayData} />
        </ScrollView>
      )}
    </View>
  );

  // Render Inner Content Panel (Checklist, Expenses, Translator, Guide)
  const renderInnerContent = () => (
    <View style={styles.mainContentWrapper}>
      {/* timeline and map modes are now handled by CombinedItineraryView directly in the main layout */}

      {viewMode === 'checklist' && (
        <PackingChecklist
          itinerary={itinerary}
          survey={contextSurvey}
        />
      )}

      {viewMode === 'expenses' && (
        <ExpenseSplitter
          itinerary={itinerary}
          survey={contextSurvey}
        />
      )}

      {viewMode === 'translator' && (
        <TravelTranslator
          survey={contextSurvey}
        />
      )}

      {viewMode === 'guide' && (
        <DestinationGuide 
          onNavigateToTranslator={() => Linking.openURL('https://acia-2.vercel.app')}
        />
      )}
    </View>
  );

  const handleRefreshItinerary = async () => {
    if (!itinerary?.id || isOffline) return;
    setLoading(true);
    try {
      const latestItinerary = await dbService.getItinerary(itinerary.id);
      if (latestItinerary) {
        setItinerary(latestItinerary);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 1. App Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, borderBottomWidth: 1, padding: spacing.md }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            {itinerary?.title}
          </Text>
          {isOffline && (
            <View style={[styles.offlineBadge, { backgroundColor: colors.warning50 }]}>
              <Text style={{ color: colors.warning600, fontSize: 10, fontWeight: '700' }}>
                離線瀏覽模式
              </Text>
            </View>
          )}
        </View>

        {!isOffline && (
          <TouchableOpacity onPress={handleRefreshItinerary} style={styles.backButton}>
            <Ionicons name="refresh" size={24} color={colors.primary500} />
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={handleExportPDF} style={[styles.shareButton, { marginRight: 12 }]}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary500} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('分享行程', '行程連結已複製到剪貼簿！')} style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Collapsible Header */}
      <TouchableOpacity 
        style={[styles.navPanelHeader, { backgroundColor: colors.surface, borderBottomColor: colors.divider, borderBottomWidth: 1 }]}
        activeOpacity={0.7}
        onPress={() => setIsNavExpanded(!isNavExpanded)}
      >
        <Text style={[typography.labelMedium, { color: colors.textSecondary, fontWeight: '600' }]}>
          {isNavExpanded ? '收起選單面板' : '展開視圖與天數選單'}
        </Text>
        <Ionicons name={isNavExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Navigation Panel Content */}
      {isNavExpanded && (
        <View style={{ backgroundColor: colors.surface }}>
          {/* 2. Days Selector Tab (Only show for timeline/map view modes) */}
          {isDailyView && (
            <View style={[styles.daysTabContainer, { borderBottomColor: colors.divider, borderBottomWidth: 1 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                {itinerary.days.map((d) => {
                  const isSelected = d.dayNumber === activeDay;
                  return (
                    <TouchableOpacity
                      key={d.dayNumber}
                      onPress={() => setActiveDay(d.dayNumber)}
                      style={[
                        styles.dayTab,
                        {
                          backgroundColor: isSelected ? colors.primary500 : colors.backgroundSecondary,
                          borderRadius: borderRadius.sm,
                          marginRight: spacing.xs,
                        }
                      ]}
                    >
                      <Text style={[typography.labelMedium, { color: isSelected ? colors.neutral0 : colors.text, fontWeight: '600' }]}>
                        Day {d.dayNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 3. View Switch Tab (5-Tab scrollable bar) */}
          <View style={[styles.viewModeContainer, { borderBottomColor: colors.divider, borderBottomWidth: 1 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScrollContent}>
              {[
                { code: 'timeline', label: '行程總覽', icon: 'map' },
                { code: 'guide', label: '當地指南', icon: 'compass-outline' },
                { code: 'checklist', label: '行前清單', icon: 'checkbox-outline' },
                { code: 'expenses', label: '費用分帳', icon: 'wallet-outline' },
                { code: 'translator', label: '旅遊翻譯', icon: 'language-outline' },
              ].map((mode) => {
                const isSelected = viewMode === mode.code;
                return (
                  <TouchableOpacity
                    key={mode.code}
                    onPress={() => setViewMode(mode.code as any)}
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: isSelected ? colors.primary50 : 'transparent',
                        borderBottomWidth: 2,
                        borderBottomColor: isSelected ? colors.primary500 : 'transparent',
                        paddingHorizontal: spacing.md,
                      }
                    ]}
                  >
                    <Ionicons name={mode.icon as any} size={16} color={isSelected ? colors.primary500 : colors.textSecondary} />
                    <Text style={[typography.labelMedium, { color: isSelected ? colors.primary500 : colors.textSecondary, marginLeft: 6, fontWeight: '600' }]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 4. Main Responsive Body */}
      {isDailyView ? (
        <ScrollView 
          style={{ flex: 1, backgroundColor: colors.background }} 
          contentContainerStyle={{ padding: isLargeScreen ? spacing.lg : spacing.xs, paddingBottom: 60 }} 
          showsVerticalScrollIndicator={false}
        > 
          <CombinedItineraryView 
             itinerary={itinerary}
             activeDay={activeDay}
             onEditActivity={setEditingActivityId}
             onRefreshMap={handleRefreshItinerary}
             onNavigate={(loc) => {
                const lat = loc.latitude || 0;
                const lng = loc.longitude || 0;
                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                Linking.openURL(url);
             }}
          />
          <View style={{ marginTop: spacing.xl }}>
            <TimelineView
              day={currentDayData}
              onMoveActivity={handleMoveActivity}
              onAddRecommendedActivity={handleAddRecommendedActivity}
              onEditActivity={setEditingActivityId}
              onNavigate={(loc) => {
                const lat = loc.latitude || 0;
                const lng = loc.longitude || 0;
                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                Linking.openURL(url);
              }}
              onUpdateNote={handleUpdateNote}
            />
          </View>
        </ScrollView>
      ) : (
        isLargeScreen ? (
          <View style={styles.desktopLayout}>
            <View style={[styles.rightContentPanel, { borderLeftWidth: 0, paddingLeft: 0 }]}>
              {renderInnerContent()}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, padding: spacing.md }}>
            {renderInnerContent()}
          </View>
        )
      )}

      {/* Global Activity Editor Modal */}
      <ActivityEditorModal
        visible={!!editingActivityId}
        activity={getEditingActivity()}
        itinerary={itinerary}
        currentDayNumber={
          (itinerary && editingActivityId) 
            ? (itinerary.days.find(d => d.activities.some(a => a.id === editingActivityId))?.dayNumber || activeDay)
            : activeDay
        }
        onClose={() => setEditingActivityId(null)}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginHorizontal: 12,
  },
  offlineBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  navPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  daysTabContainer: {
    width: '100%',
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeContainer: {
    width: '100%',
    height: 44,
  },
  modeScrollContent: {
    alignItems: 'center',
    height: '100%',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  // Responsive Desktop Layout Styles
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 420,
    padding: 16,
  },
  mapCard: {
    padding: 12,
  },
  rightContentPanel: {
    flex: 1,
    padding: 16,
  },
  mainContentWrapper: {
    flex: 1,
  },
});
