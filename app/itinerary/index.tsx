import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSurvey } from '../../src/context/SurveyContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { DailySummaryCard } from '../../src/components/itinerary/DailySummaryCard';
import { TimelineView } from '../../src/components/itinerary/TimelineView';
import { MapFallbackView, getDayRouteNavigationUrl } from '../../src/components/itinerary/MapFallbackView';
import { PackingList } from '../../src/components/itinerary/PackingList';
import { ItineraryCollaborator } from '../../src/components/itinerary/ItineraryCollaborator';
import { DestinationGuide } from '../../src/components/itinerary/DestinationGuide';
import { Itinerary3DMap } from '../../src/components/itinerary/Itinerary3DMap';
import { CombinedItineraryView } from '../../src/components/itinerary/CombinedItineraryView';
import { ActivityEditorModal } from '../../src/components/itinerary/ActivityEditorModal';
import { ReRollModal } from '../../src/components/itinerary/ReRollModal';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { AffiliateWidget } from '../../src/components/common/AffiliateWidget';
import { t } from '../../src/i18n';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Itinerary, Activity } from '../../src/types/itinerary';
import { TripSurvey } from '../../src/types/survey';
import { dbService } from '../../src/services/db';
import { aiService } from '../../src/services/ai';
import { syncService } from '../../src/services/sync';
import { regenerateActivityAlternatives } from '../../src/services/ai';
import { verifyOpenTripMapKey, OtmKeyDiagnostic } from '../../src/services/poi';
import { auth } from '../../src/services/firebase';
import { useResponsive } from '../../src/hooks/useResponsive';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateItineraryHtml } from '../../src/utils/pdfGenerator';
import { swapOutdoorWithIndoor, repairItineraryTimes } from '../../src/utils/itineraryRepairer';
import { localSyncManager } from '../../src/services/localSyncManager';

// Web-safe cache helpers: AsyncStorage on Web is unreliable, use localStorage directly
const cacheGet = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  try { return await AsyncStorage.getItem(key); } catch { return null; }
};
const cacheSet = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  try { await AsyncStorage.setItem(key, value); } catch {}
};

// Web-safe alert helper: Alert.alert may not work on Web
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const OFFLINE_ITINERARY_KEY = '@trip_active_itinerary';
const OFFLINE_SURVEY_KEY = '@trip_active_survey';


type ViewMode = 'timeline' | 'map' | 'checklist' | 'guide' | 'collaborator';

export default function ItineraryScreen() {
  const { survey: contextSurvey, activeItinerary: contextItinerary, updateSurvey } = useSurvey();
  const { locale } = useLanguage();
  const { colors, spacing, borderRadius, typography } = useTheme();

  const { isLargeScreen } = useResponsive();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(true);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  // Re-roll state
  const [reRollModalVisible, setReRollModalVisible] = useState(false);
  const [reRollLoading, setReRollLoading] = useState(false);
  const [reRollAlternatives, setReRollAlternatives] = useState<Activity[]>([]);
  const [reRollTargetActivityId, setReRollTargetActivityId] = useState<string | null>(null);

  // OpenTripMap 金鑰診斷（用於提示金鑰是否生效並引導解決方案）
  // OpenTripMap 金鑰僅在金鑰失效（缺失/無效/網路）時提示；金鑰來自建置時注入的
  // EXPO_PUBLIC_OPENTRIPMAP_KEY，正常情況此橫幅不會出現。
  const [otmDiag, setOtmDiag] = useState<OtmKeyDiagnostic | null>(null);
  const [otmBannerDismissed, setOtmBannerDismissed] = useState(false);
  useEffect(() => {
    localSyncManager.initialize();
  }, []);

  useEffect(() => {
    let cancelled = false;
    verifyOpenTripMapKey()
      .then(diag => { if (!cancelled) setOtmDiag(diag); })
      .catch(() => { if (!cancelled) setOtmDiag(null); });

    // 設定真正的離線連線偵測
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const itineraryRef = useRef(itinerary);
  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

  // 1. Initialize and load itinerary data
  useEffect(() => {
    async function loadData() {
      try {
        let currentIt: Itinerary | null = null;
        let currentSurveyObj: TripSurvey | null = null;

        if (contextItinerary) {
          currentIt = contextItinerary;
          setItinerary(contextItinerary);
          await cacheSet(OFFLINE_ITINERARY_KEY, JSON.stringify(contextItinerary));
        } else {
          const cachedItinerary = await cacheGet(OFFLINE_ITINERARY_KEY);
          if (cachedItinerary) {
            currentIt = JSON.parse(cachedItinerary) as Itinerary;
            setItinerary(currentIt);
          }
        }

        // 當我們有行程資料時，依據其 surveyId 去數據庫拉取真實的 Survey
        if (currentIt && currentIt.surveyId) {
          console.log('[ItineraryScreen] Fetching real survey from DB for ID:', currentIt.surveyId);
          try {
            const realSurvey = await dbService.getSurvey(currentIt.surveyId);
            if (realSurvey) {
              currentSurveyObj = realSurvey;
              updateSurvey(realSurvey);
              await cacheSet(OFFLINE_SURVEY_KEY, JSON.stringify(realSurvey));
              console.log('[ItineraryScreen] Real survey loaded & cached.');
            }
          } catch (dbErr) {
            console.warn('[ItineraryScreen] DB survey fetch failed (might be offline):', dbErr);
          }
        }

        // 如果 DB 載入失敗或離線，嘗試從本機快取恢復 Survey
        if (!currentSurveyObj) {
          const cachedSurvey = await cacheGet(OFFLINE_SURVEY_KEY);
          if (cachedSurvey) {
            const parsedSurvey = JSON.parse(cachedSurvey) as TripSurvey;
            updateSurvey(parsedSurvey);
            currentSurveyObj = parsedSurvey;
            console.log('[ItineraryScreen] Survey restored from cache.');
          } else if (contextSurvey) {
            // 最差情況，寫入當前 contextSurvey
            currentSurveyObj = contextSurvey;
            await cacheSet(OFFLINE_SURVEY_KEY, JSON.stringify(contextSurvey));
          }
        }

        // 對已載入的行程進行座標自癒 (Coordinate Healing)
        if (currentIt && currentSurveyObj) {
          console.log('[ItineraryScreen] Healing coordinates for loaded itinerary...');
          aiService.healItineraryCoordinates(currentIt, currentSurveyObj);
          setItinerary({ ...currentIt });
          await cacheSet(OFFLINE_ITINERARY_KEY, JSON.stringify(currentIt));
          
          // Auto-recovery of PACEngine status on successful client-side load
          const PACEngine = require('../../src/services/pac').default;
          PACEngine.resetHealingState();
        }
      } catch (error) {
        console.error('[ItineraryScreen] Error loading itinerary data:', error);
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
        if (contextSurvey) {
          aiService.healItineraryCoordinates(updatedItinerary, contextSurvey);
        }
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

    // Reset orders
    activities.forEach((a, idx) => { a.order = idx; });
    day.activities = activities;
    updatedItinerary.days[dayIndex] = day;

    // 實作順序調整後相鄰景點的真實交通重算與起訖時間順延自癒
    // 我們以排在前面的活動 (較早的 targetIndex) 的 startTime 為基準，往後修復整天
    const firstActId = activities[Math.min(actIndex, targetIndex)]!.id;
    const firstActStartTime = activities[Math.min(actIndex, targetIndex)]!.startTime;
    
    // 從 utils/itineraryRepairer 呼叫 repairItineraryTimes
    const repairedItinerary = repairItineraryTimes(updatedItinerary, day.dayNumber, firstActId, firstActStartTime);

    // 由於 repairItineraryTimes 會順便重算交通時間並檢驗時間，這裡就不需要手動檢查。
    // 但是我們還需要校驗「公休日與營業時間」並「動態顯示警告標籤」。
    // 這一部分在 UI 的 TimelineView 中已經依賴 warningType 顯示。

    setItinerary(repairedItinerary);
    await saveAndSyncItinerary(repairedItinerary);
  };

  const handleRemoveActivity = async (dayNumber: number, activityId: string) => {
    if (!itinerary) return;

    const updatedItinerary = { ...itinerary, days: [...itinerary.days] };
    const dayIndex = updatedItinerary.days.findIndex(d => d.dayNumber === dayNumber);
    if (dayIndex === -1) return;

    const day = { ...updatedItinerary.days[dayIndex]! };
    let activities = [...day.activities];

    const actIndex = activities.findIndex(a => a.id === activityId);
    if (actIndex === -1) return;

    activities.splice(actIndex, 1);
    activities.forEach((a, idx) => { a.order = idx; });
    day.activities = activities;
    updatedItinerary.days[dayIndex] = day;

    const firstAct = activities.length > 0 ? activities[0] : undefined;
    const repairedItinerary = firstAct 
      ? repairItineraryTimes(updatedItinerary, day.dayNumber, firstAct.id, firstAct.startTime)
      : updatedItinerary;

    setItinerary(repairedItinerary);
    await saveAndSyncItinerary(repairedItinerary);
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

  const handleToggleRainFallback = async (dayNumber: number) => {
    if (!itinerary) return;
    const updated = swapOutdoorWithIndoor(itinerary, dayNumber);
    setItinerary(updated);
    await saveAndSyncItinerary(updated);
    showAlert(t('itinerary.timelineView.weather.rainWarning', { defaultValue: '雨天備案已切換' }), t('itinerary.timelineView.weather.rainHint', { defaultValue: '已自動將當日的戶外景點對調為室內景點，並重新規劃交通路線。' }));
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


  const handleReRollActivity = async (activityId: string) => {
    if (!itinerary) {
      console.warn('[ReRoll] No itinerary available, aborting.');
      return;
    }
    
    // Use contextSurvey even if minimal -- regenerateActivityAlternatives can handle partial data
    const surveyForReRoll = contextSurvey;
    console.log('[ReRoll] Starting for activity:', activityId, 'Survey destinations:', surveyForReRoll?.destinations?.length ?? 0);
    
    // Find the target activity and its context
    let targetDayIndex = -1;
    let targetActIndex = -1;
    let targetActivity = null;
    
    for (let i = 0; i < itinerary.days.length; i++) {
      const day = itinerary.days[i];
      const idx = day.activities.findIndex(a => a.id === activityId);
      if (idx !== -1) {
        targetDayIndex = i;
        targetActIndex = idx;
        targetActivity = day.activities[idx];
        break;
      }
    }
    
    if (!targetActivity) {
      console.warn('[ReRoll] Target activity not found:', activityId);
      return;
    }

    setReRollTargetActivityId(activityId);
    setReRollModalVisible(true);
    setReRollLoading(true);
    setReRollAlternatives([]);

    try {
      const day = itinerary.days[targetDayIndex];
      const prevActivity = targetActIndex > 0 ? day.activities[targetActIndex - 1] : undefined;
      const nextActivity = targetActIndex < day.activities.length - 1 ? day.activities[targetActIndex + 1] : undefined;

      console.log('[ReRoll] Calling regenerateActivityAlternatives...');
      const alternatives = await regenerateActivityAlternatives(
        surveyForReRoll,
        targetActivity,
        prevActivity,
        nextActivity,
        day.region || itinerary.title
      );
      
      console.log('[ReRoll] Got', alternatives.length, 'alternatives');
      setReRollAlternatives(alternatives);
    } catch (error: any) {
      console.error('[ReRoll] Error:', error?.message || error);
      const noAlternatives = error?.message === 'NO_ALTERNATIVES_FOUND';
      const msg = noAlternatives
        ? '找不到適合的替代景點，請稍後再試或手動編輯此活動。'
        : t('itinerary.reroll.error', { defaultValue: '產生替代方案失敗，請稍後再試。' });
      showAlert(t('common.error'), msg);
      setReRollModalVisible(false);
    } finally {
      setReRollLoading(false);
    }
  };

  const handleReRollSelect = async (selectedActivity: Activity) => {
    if (!itinerary || !reRollTargetActivityId) return;

    const updatedItinerary = JSON.parse(JSON.stringify(itinerary));
    
    for (const day of updatedItinerary.days) {
      const idx = day.activities.findIndex((a: any) => a.id === reRollTargetActivityId);
      if (idx !== -1) {
        day.activities[idx] = selectedActivity;
        break;
      }
    }

    setItinerary(updatedItinerary);
    await saveAndSyncItinerary(updatedItinerary);
    
    setReRollModalVisible(false);
    setReRollTargetActivityId(null);
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
      title: t('itinerary.aiRecommend.actTitle'),
      type: 'restaurant',
      description: t('itinerary.aiRecommend.actDesc'),
      location: {
        name: t('itinerary.aiRecommend.actLocName'),
        address: t('itinerary.aiRecommend.actLocAddr'),
        latitude: actA.location?.latitude || 0,
        longitude: actA.location?.longitude || 0
      },
      duration: 90,
      links: [],
      notes: t('itinerary.aiRecommend.actNotes'),
      isMustVisit: false
    };

    activities.splice(gapStartIndex + 1, 0, newAct);

    day.activities = activities.map((act, idx) => ({ ...act, order: idx }));
    updatedItinerary.days[dayIndex] = day;

    setItinerary(updatedItinerary);
    await saveAndSyncItinerary(updatedItinerary);
    showAlert(t('itinerary.aiRecommend.title'), t('itinerary.aiRecommend.msg'));
  };

  const saveAndSyncItinerary = async (updatedItinerary: Itinerary) => {
    try {
      await cacheSet(OFFLINE_ITINERARY_KEY, JSON.stringify(updatedItinerary));
      await localSyncManager.saveItineraryLocal(updatedItinerary, true);
    } catch (error) {
      console.error('Error syncing itinerary updates:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!itinerary) return;
    try {
      setLoading(true);
      const html = generateItineraryHtml(itinerary, contextSurvey);

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        iframe.contentWindow?.document.open();
        iframe.contentWindow?.document.write(html);
        iframe.contentWindow?.document.close();
        
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }, 500);
        };
      } else if (Platform.OS === 'macos' || Platform.OS === 'windows') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('itinerary.exportTitle'),
            UTI: 'com.adobe.pdf'
          });
        } else {
          showAlert(t('itinerary.exportSuccess'), t('itinerary.exportSuccessMsg', { uri }));
        }
      }
    } catch (error) {
      console.error('PDF Export Error:', error);
      showAlert(t('itinerary.exportFail'), t('itinerary.exportFailMsg'));
    } finally {
      setLoading(false);
    }
  };

  const dummyItinerary: Itinerary = {
    id: '',
    surveyId: '',
    userId: '',
    title: '',
    createdAt: '',
    updatedAt: '',
    status: 'ready',
    days: [],
    emergencyContacts: [],
    currency: 'TWD',
    totalEstimatedCost: { amount: 0, currency: 'TWD' }
  };

  const activeItinerary = itinerary || dummyItinerary;
  const currentDayData = activeItinerary.days.find(d => d.dayNumber === activeDay) || activeItinerary.days[0] || null;
  const isDailyView = viewMode === 'timeline';

  // Render Left Panel (3D Map & Daily Summary Card) for Large screens
  const renderLeftPanel = () => (
    <View style={[styles.leftPanel, { borderRightColor: colors.divider, borderRightWidth: 1 }]}>
      <Card variant="flat" style={styles.mapCard}>
        <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '700' }]}>
          {t('itinerary.map.title')}
        </Text>
        <Itinerary3DMap itinerary={activeItinerary} activeDay={activeDay} height={320} />
        {(() => {
          const mapProvider = contextSurvey?.mapProvider || 'google';
          const navUrl = currentDayData ? getDayRouteNavigationUrl(currentDayData.activities, mapProvider) : null;
          if (!navUrl) return null;
          return (
            <TouchableOpacity
              style={[styles.navigateButton, { backgroundColor: colors.primary500, marginTop: spacing.sm }]}
              onPress={() => Linking.openURL(navUrl)}
            >
              <Ionicons name="navigate" size={16} color={colors.neutral0} style={{ marginRight: 6 }} />
              <Text style={[typography.labelMedium, { color: colors.neutral0, fontWeight: '700' }]}>
                {t('itinerary.map.openNavigation', { provider: t(`survey.map.${mapProvider}`) })}
              </Text>
            </TouchableOpacity>
          );
        })()}
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
        <PackingList
          itinerary={activeItinerary}
          survey={contextSurvey!}
        />
      )}

      {viewMode === 'collaborator' && (
        <ItineraryCollaborator
          itinerary={activeItinerary}
          survey={contextSurvey!}
          onRemoveActivity={handleRemoveActivity}
        />
      )}



      {viewMode === 'guide' && (
        <DestinationGuide 
          countryName={contextSurvey?.destinations?.[0]?.country || '泰國'}
          onNavigateToTranslator={() => Linking.openURL('https://acia-2.vercel.app?reset=1')}
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
        if (contextSurvey) {
          aiService.healItineraryCoordinates(latestItinerary, contextSurvey);
        }
        setItinerary(latestItinerary);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 線上重新生成：當行程因即時資料硬失敗而降級時，讓使用者一鍵以即時資料重建，
  // 救回非降級版本。離線時不提供（避免又生成出降級版覆蓋現有行程）。
  const handleRegenerateItinerary = async () => {
    if (isOffline || regenerating) return;
    if (!contextSurvey) {
      showAlert(t('itinerary.fallback.title'), t('itinerary.fallback.noSurvey'));
      return;
    }
    setRegenerating(true);
    try {
      const fresh = await aiService.generateItinerary(contextSurvey);
      // 沿用原行程的識別資訊以「覆蓋同一筆」而非新增，維持連續性。
      if (itinerary?.id) fresh.id = itinerary.id;
      if (itinerary?.surveyId) fresh.surveyId = itinerary.surveyId;
      if (itinerary?.title) fresh.title = itinerary.title;

      setItinerary(fresh);
      await cacheSet(OFFLINE_ITINERARY_KEY, JSON.stringify(fresh));

      if (auth.currentUser) {
        try {
          await dbService.saveItinerary(fresh);
          await syncService.publishItinerary(fresh);
        } catch (saveErr) {
          console.warn('[Regenerate] 儲存/發佈失敗（已更新本機）：', saveErr);
        }
      }

      if (fresh.generatedByFallback) {
        // 仍降級：通常代表金鑰/網路問題仍在，提示使用者。
        showAlert(t('itinerary.fallback.title'), t('itinerary.fallback.stillFallback'));
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
      showAlert(t('itinerary.fallback.title'), t('itinerary.fallback.regenFailed'));
    } finally {
      setRegenerating(false);
    }
  };

  // Derived visibility states for ZERO conditional rendering
  const showLoading = loading;
  const showNoData = !loading && !itinerary;
  const showContent = !loading && !!itinerary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* === STATE 1: Loading Spinner === */}
      <View style={[styles.loadingContainer, { display: showLoading ? 'flex' : 'none', minHeight: 400, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
        <Text style={[typography.titleMedium, { color: colors.text, marginTop: spacing.md }]}>
          {t('survey.generating')}
        </Text>
      </View>

      {/* === STATE 2: No Data view === */}
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, display: showNoData ? 'flex' : 'none' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error500} />
        <Text style={[typography.titleLarge, { color: colors.text, marginTop: spacing.md }]}>
          {t('itinerary.noData')}
        </Text>
        <Button
          title={t('itinerary.backHome')}
          onPress={() => router.replace('/')}
          style={{ marginTop: spacing.lg }}
        />
      </View>

      {/* === STATE 3: Main Itinerary Content === */}
      <View style={[styles.container, { display: showContent ? 'flex' : 'none' }]}>

        {/* AI 生成失敗、改用離線範本時的明確警示橫幅（含真實失敗原因，方便診斷） */}
        {itinerary?.generatedByFallback && (
          <View style={{
            backgroundColor: colors.warning50,
            borderColor: colors.warning500,
            borderWidth: 1,
            borderRadius: borderRadius.md,
            margin: isLargeScreen ? spacing.md : spacing.xs,
            marginBottom: 0,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}>
            <Ionicons name="warning" size={20} color={colors.warning600} style={{ marginRight: spacing.sm, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.labelMedium, { color: colors.warning700, fontWeight: '800', marginBottom: 2 }]}>
                {t('itinerary.fallback.title')}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.warning700 }]}>
                {t('itinerary.fallback.desc')}
              </Text>
              {/* 針對配額不足（429）給出可行動的中文指引 */}
              {!!itinerary?.fallbackReason && /429|quota|exceeded/i.test(itinerary.fallbackReason) && (
                <Text style={[typography.bodySmall, { color: colors.warning700, fontWeight: '700', marginTop: 6 }]}>
                  {t('itinerary.fallback.quotaHint')}
                </Text>
              )}
              {!!itinerary?.fallbackReason && (
                <Text style={[typography.caption, { color: colors.warning600, marginTop: 4 }]} selectable>
                  {t('itinerary.fallback.reason')}: {itinerary.fallbackReason}
                </Text>
              )}
              {/* 線上時提供「重新生成」一鍵以即時資料重建；離線則提示先連網。 */}
              {!isOffline ? (
                <TouchableOpacity
                  onPress={handleRegenerateItinerary}
                  disabled={regenerating}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    backgroundColor: colors.warning600,
                    borderRadius: borderRadius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    marginTop: spacing.sm,
                    opacity: regenerating ? 0.6 : 1,
                  }}
                >
                  {regenerating
                    ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                    : <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />}
                  <Text style={[typography.labelMedium, { color: '#fff', fontWeight: '800' }]}>
                    {regenerating ? t('itinerary.fallback.regenerating') : t('itinerary.fallback.regenerate')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[typography.caption, { color: colors.warning600, marginTop: spacing.sm, fontWeight: '700' }]}>
                  {t('itinerary.fallback.offlineHint')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Consolidated Floating Control Panel */}
        <View style={{ 
          backgroundColor: colors.surface, 
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          margin: isLargeScreen ? spacing.md : spacing.xs,
          marginBottom: spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
          borderWidth: 1,
          zIndex: 100
        }}>
          {/* Row 1: Header (Back, Title) + Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: isNavExpanded ? 1 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.md }}>
              <TouchableOpacity onPress={() => router.replace('/')} style={{ padding: 6, marginRight: spacing.xs }}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                  {itinerary?.title}
                </Text>
                {isOffline && (
                  <View style={[styles.offlineBadge, { backgroundColor: colors.warning50, marginLeft: 8 }]}>
                    <Text style={{ color: colors.warning600, fontSize: 10, fontWeight: '700' }}>
                      {t('itinerary.offline')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Action Buttons (Always visible in Header) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              {!isOffline && (
                <TouchableOpacity
                  onPress={handleRefreshItinerary}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: borderRadius.full,
                    paddingHorizontal: isLargeScreen ? spacing.md : 10,
                    paddingVertical: 8,
                    marginHorizontal: 2
                  }}
                >
                  <Ionicons name="sync" size={18} color={colors.textSecondary} />
                  {isLargeScreen && (
                    <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6, fontWeight: '700' }]}>
                      {t('common.refresh')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleExportPDF}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: isLargeScreen ? spacing.md : 10,
                  paddingVertical: 8,
                  marginHorizontal: 2
                }}
              >
                <Ionicons name="document-text" size={18} color={colors.textSecondary} />
                {isLargeScreen && (
                  <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6, fontWeight: '700' }]}>
                    {t('itinerary.export.pdf')}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.alert(`${t('itinerary.shareTitle')}\n${t('itinerary.shareMsg')}`);
                  } else {
                    showAlert(t('itinerary.shareTitle'), t('itinerary.shareMsg'));
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: isLargeScreen ? spacing.md : 10,
                  paddingVertical: 8,
                  marginHorizontal: 2
                }}
              >
                <Ionicons name="share-social" size={18} color={colors.textSecondary} />
                {isLargeScreen && (
                  <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6, fontWeight: '700' }]}>
                    {t('common.share')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* OpenTripMap 金鑰診斷提示：金鑰缺失/無效時提醒並引導解決方案 */}
          {otmDiag && otmDiag.status !== 'ok' && !otmBannerDismissed && (
            <View style={{
              marginHorizontal: spacing.md,
              marginBottom: spacing.sm,
              padding: spacing.md,
              borderRadius: borderRadius.md,
              backgroundColor: otmDiag.status === 'invalid' ? '#FEF2F2' : '#FFFBEB',
              borderWidth: 1,
              borderColor: otmDiag.status === 'invalid' ? '#FCA5A5' : '#FCD34D',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons
                  name={otmDiag.status === 'invalid' ? 'alert-circle' : 'information-circle'}
                  size={18}
                  color={otmDiag.status === 'invalid' ? '#DC2626' : '#D97706'}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.labelMedium, { color: '#92400E', fontWeight: '700', marginBottom: 4 }]}>
                    {otmDiag.message}
                  </Text>
                  <Text style={[typography.caption, { color: '#92400E', lineHeight: 18 }]}>
                    {otmDiag.hint}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://opentripmap.io/product')}>
                      <Text style={[typography.caption, { color: '#2563EB', fontWeight: '700' }]}>取得 / 確認金鑰</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setOtmBannerDismissed(true)}>
                      <Text style={[typography.caption, { color: '#6B7280', fontWeight: '700' }]}>知道了</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Row 2 & 3: View Modes + Days (Visible only when expanded) */}
          {isNavExpanded && (
            <View style={{ padding: spacing.md }}>
              {/* View Switch Tab */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing.sm }}>
                {[
                  { code: 'timeline', label: t('itinerary.tabs.timeline'), icon: 'map' },
                  { code: 'guide', label: t('itinerary.tabs.guide'), icon: 'compass-outline' },
                  { code: 'checklist', label: t('itinerary.tabs.checklist'), icon: 'checkbox-outline' },
                  { code: 'collaborator', label: !locale.startsWith('zh') ? 'Collaboration' : '協同投票', icon: 'people-outline' },
                ].map((mode) => {
                  const isSelected = viewMode === mode.code;
                  return (
                    <TouchableOpacity
                      key={mode.code}
                      onPress={() => setViewMode(mode.code as any)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isSelected ? colors.primary500 : colors.backgroundSecondary,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: borderRadius.full,
                        marginRight: spacing.sm,
                      }}
                    >
                      <Ionicons name={mode.icon as any} size={16} color={isSelected ? '#fff' : colors.textSecondary} />
                      <Text style={[typography.labelMedium, { color: isSelected ? '#fff' : colors.textSecondary, marginLeft: 6, fontWeight: '700' }]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Days Selector Tab (Only show for timeline/map view modes) */}
              {isDailyView && (
                <View style={{ paddingTop: spacing.sm, borderTopColor: colors.divider, borderTopWidth: 1, marginTop: spacing.xs }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} contentContainerStyle={{ paddingBottom: spacing.xs }}>
                    {activeItinerary.days.map((d) => {
                      const isSelected = d.dayNumber === activeDay;
                      return (
                        <TouchableOpacity
                          key={d.dayNumber}
                          onPress={() => setActiveDay(d.dayNumber)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            backgroundColor: isSelected ? colors.primary50 : 'transparent',
                            borderBottomWidth: 3,
                            borderBottomColor: isSelected ? colors.primary500 : 'transparent',
                            marginRight: spacing.sm,
                          }}
                        >
                          <Text style={[typography.labelLarge, { color: isSelected ? colors.primary600 : colors.text, fontWeight: isSelected ? '800' : '600' }]}>
                            Day {d.dayNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Toggle Panel Button (Bottom Handle) */}
          <TouchableOpacity 
            style={{ 
              alignItems: 'center', 
              justifyContent: 'center', 
              paddingVertical: 6, 
              borderTopColor: colors.divider, 
              borderTopWidth: isNavExpanded ? 1 : 0, 
              backgroundColor: colors.backgroundSecondary,
              borderBottomLeftRadius: borderRadius.lg,
              borderBottomRightRadius: borderRadius.lg
            }}
            activeOpacity={0.7}
            onPress={() => setIsNavExpanded(!isNavExpanded)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                {isNavExpanded ? t('itinerary.nav.collapse') : t('itinerary.nav.expand')}
              </Text>
              <Ionicons name={isNavExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. Main Responsive Body */}
        {isDailyView ? (
          <ScrollView 
            style={{ flex: 1, backgroundColor: colors.background }} 
            contentContainerStyle={{ padding: isLargeScreen ? spacing.lg : spacing.xs, paddingBottom: 60 }} 
            showsVerticalScrollIndicator={false}
          > 
            <CombinedItineraryView
               itinerary={activeItinerary}
               activeDay={activeDay}
               mapProvider={contextSurvey?.mapProvider || 'google'}
               onEditActivity={setEditingActivityId}
               onRefreshMap={handleRefreshItinerary}
               onNavigate={(loc: any, origin?: any) => {
                  const destLat = loc.latitude || 0;
                  const destLng = loc.longitude || 0;
                  const destination = (destLat !== 0 && destLng !== 0) ? `${destLat},${destLng}` : encodeURIComponent(loc.name || loc.address || '');
                  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                  
                  if (origin) {
                    const origLat = origin.latitude || 0;
                    const origLng = origin.longitude || 0;
                    const originParam = (origLat !== 0 && origLng !== 0) ? `${origLat},${origLng}` : encodeURIComponent(origin.name || origin.address || '');
                    if (originParam) {
                      url += `&origin=${originParam}`;
                    }
                  }
                  Linking.openURL(url);
               }}
            /> 
            {currentDayData && (
              <View style={{ marginTop: spacing.xl }}>
                <TimelineView
                  day={currentDayData}
                  onMoveActivity={handleMoveActivity}
                  onAddRecommendedActivity={handleAddRecommendedActivity}
                  onEditActivity={setEditingActivityId}
                  onReRollActivity={handleReRollActivity}
                  onNavigate={(loc: any, origin?: any) => {
                    const destLat = loc.latitude || 0;
                    const destLng = loc.longitude || 0;
                    const destination = (destLat !== 0 && destLng !== 0) ? `${destLat},${destLng}` : encodeURIComponent(loc.name || loc.address || '');
                    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                    
                    if (origin) {
                      const origLat = origin.latitude || 0;
                      const origLng = origin.longitude || 0;
                      const originParam = (origLat !== 0 && origLng !== 0) ? `${origLat},${origLng}` : encodeURIComponent(origin.name || origin.address || '');
                      if (originParam) {
                        url += `&origin=${originParam}`;
                      }
                    }
                    Linking.openURL(url);
                 }}
                  onUpdateNote={handleUpdateNote}
                  onToggleRainFallback={handleToggleRainFallback}
                />
              </View>
            )}
            <View style={{ marginTop: spacing.lg }}>
              <AffiliateWidget region={currentDayData?.region || activeItinerary.title} />
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
          itinerary={activeItinerary}
          currentDayNumber={
            (itinerary && editingActivityId) 
              ? (itinerary.days.find(d => d.activities.some(a => a.id === editingActivityId))?.dayNumber || activeDay)
              : activeDay
          }
          onClose={() => setEditingActivityId(null)}
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
        />

        <ReRollModal
          visible={reRollModalVisible}
          isLoading={reRollLoading}
          alternatives={reRollAlternatives}
          onClose={() => {
            setReRollModalVisible(false);
            setReRollTargetActivityId(null);
          }}
          onSelect={handleReRollSelect}
        />
      </View>
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
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  rightContentPanel: {
    flex: 1,
    padding: 16,
  },
  mainContentWrapper: {
    flex: 1,
  },
});
