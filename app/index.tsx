import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Image, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useSurvey } from '../src/context/SurveyContext';
import { AuthForm } from '../src/components/auth/AuthForm';
import { dbService } from '../src/services/db';
import { Itinerary } from '../src/types/itinerary';
import { ItineraryCard } from '../src/components/dashboard/ItineraryCard';
import { t } from '../src/i18n';
import { LanguagePicker } from '../src/components/common/LanguagePicker';
import { useLanguage } from '../src/context/LanguageContext';
import { ApiKeySettings } from '../src/components/common/ApiKeySettings';

const OFFLINE_ITINERARIES_LIST_KEY = '@trip_cached_itineraries_list';

export default function HomeDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { setActiveItinerary, loadSurveyForEdit } = useSurvey();
  const { locale } = useLanguage();
  const router = useRouter();

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Fetch itineraries when the screen comes into focus - Offline-first loading
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCachedAndFresh = async () => {
        setLoadingList(true);
        
        // 1. Load from Local Cache first (Instant Offline UX)
        try {
          const cached = await AsyncStorage.getItem(OFFLINE_ITINERARIES_LIST_KEY);
          if (cached && isActive) {
            const parsed = JSON.parse(cached) as Itinerary[];
            setItineraries(parsed);
          }
        } catch (cacheErr) {
          console.warn('[HomeDashboard] Failed to load cached itineraries:', cacheErr);
        }

        // 2. Fetch fresh data from Firestore if user is present
        if (user) {
          try {
            const data = await dbService.getUserItineraries(user.uid);
            if (isActive) {
              const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setItineraries(sorted);
              
              // Persist locally for offline fallback
              await AsyncStorage.setItem(OFFLINE_ITINERARIES_LIST_KEY, JSON.stringify(sorted));
            }
          } catch (dbErr) {
            console.warn('[HomeDashboard] Firestore fetch failed (falling back to cache):', dbErr);
          }
        }
        
        if (isActive) {
          setLoadingList(false);
        }
      };

      loadCachedAndFresh();

      return () => { isActive = false; };
    }, [user])
  );

  // Derived display states - used to toggle visibility without changing DOM structure
  const showLoading = authLoading;
  const showAuth = !showLoading && !user;
  const showDashboard = !showLoading && !!user;

  const displayName = user?.email ? user.email.split('@')[0] : 'Traveler';

  const handleItineraryPress = (it: Itinerary) => {
    setActiveItinerary(it);
    router.push('/itinerary');
  };

  const handleEditSurveyPlan = async (item: Itinerary) => {
    try {
      setLoadingList(true);
      const surveyData = await dbService.getSurvey(item.surveyId);
      if (surveyData) {
        loadSurveyForEdit(surveyData, item.id);
        router.push('/survey');
      } else {
        if (Platform.OS === 'web') window.alert(t('home.errorNotFound'));
        else Alert.alert(t('common.error'), t('home.errorNotFound'));
      }
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'web') window.alert(t('home.errorLoadFailed'));
      else Alert.alert(t('common.error'), t('home.errorLoadFailed'));
    } finally {
      setLoadingList(false);
    }
  };

  const safeConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: '取消', style: 'cancel' },
        { text: '確定', style: 'destructive', onPress: onConfirm }
      ]);
    }
  };

  const handleDeleteItinerary = (id: string) => {
    safeConfirm(
      t('home.confirmDeleteTitle'),
      t('home.confirmDeleteMessage'),
      async () => {
        try {
          await dbService.deleteItinerary(id);
          setItineraries(prev => prev.filter(it => it.id !== id));
        } catch (err) {
          console.error(err);
          if (Platform.OS === 'web') {
            window.alert(t('home.errorDeleteFailed'));
          } else {
            Alert.alert(t('common.error'), t('home.errorDeleteFailed'));
          }
        }
      }
    );
  };

  const handleLogout = () => {
    safeConfirm(
      t('home.confirmLogoutTitle'),
      t('home.confirmLogoutMessage'),
      async () => {
        try {
          await logout();
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleCreateNew = () => {
    setActiveItinerary(null);
    router.push('/survey');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconBox, { backgroundColor: colors.surface }]}>
        <Ionicons name="compass-outline" size={48} color={colors.primary400} />
      </View>
      <Text style={[typography.titleLarge, { color: colors.text, marginBottom: spacing.xs, fontWeight: '700' }]}>
        {t('home.emptyStateTitle')}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', maxWidth: 280 }]}>
        {t('home.emptyStateSubtitle')}
      </Text>
    </View>
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning', { defaultValue: 'Good Morning' });
    if (hour < 18) return t('home.greetingAfternoon', { defaultValue: 'Good Afternoon' });
    return t('home.greetingEvening', { defaultValue: 'Good Evening' });
  };

  // CRITICAL: This component returns a SINGLE, STRUCTURALLY STABLE tree.
  // All three states (loading, auth, dashboard) are always mounted in the DOM.
  // We toggle visibility with display:'none'/'flex' instead of conditional rendering.
  // This prevents React 19 + react-native-web 0.21 insertBefore crashes.
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* === STATE 1: Loading Spinner === */}
      <View style={[styles.centerContainer, { display: showLoading ? 'flex' : 'none' }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>

      {/* === STATE 2: Auth Form === */}
      <View style={[styles.container, { display: showAuth ? 'flex' : 'none' }]}>
        <AuthForm />
      </View>

      {/* === STATE 3: Dashboard === */}
      <View style={{ flex: 1, display: showDashboard ? 'flex' : 'none' }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View style={styles.headerLeft}>
            <Image source={require('../assets/images/logo.png')} style={styles.logo} />
            <View>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
                {getGreeting()},
              </Text>
              <Text style={[typography.headlineSmall, { color: colors.text, fontWeight: '800' }]}>
                {displayName}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowApiSettings(prev => !prev)} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <LanguagePicker />
            <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginBottom: 32 }}>
            {/* Dashboard Header View */}
            <View>
              <View style={styles.sectionHeader}>
                <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '800' }]}>
                  {t('home.myItineraries', { defaultValue: '我的旅遊計畫' })}
                </Text>
                
                {/* Small Action Button */}
                <View style={{ display: itineraries.length > 0 ? 'flex' : 'none' }}>
                  <TouchableOpacity 
                    style={[styles.smallAddBtn, { backgroundColor: colors.primary50 }]}
                    onPress={handleCreateNew}
                  >
                    <Ionicons name="add" size={16} color={colors.primary600} />
                    <Text style={[typography.labelMedium, { color: colors.primary600, fontWeight: '700', marginLeft: 4 }]}>
                      {t('home.newPlan')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Secondary Actions (Batch Scheduler) */}
              <TouchableOpacity 
                style={[styles.miniBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push('/batch-scheduler')}
              >
                <View style={[styles.miniBannerIcon, { backgroundColor: colors.primary50 }]}>
                  <Ionicons name="sparkles" size={18} color={colors.primary500} />
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, flex: 1, fontWeight: '600' }]}>
                  {t('home.aiBatchTitle', { defaultValue: 'AI Batch Scheduler' })}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              <ApiKeySettings visible={showApiSettings} />
            </View>

            {/* Empty State / Loading State */}
            <View style={{ display: itineraries.length === 0 ? 'flex' : 'none', minHeight: 200, justifyContent: 'center', alignItems: 'center', marginTop: 32 }}>
              <View style={{ display: loadingList ? 'flex' : 'none' }}>
                <ActivityIndicator size="large" color={colors.primary500} />
              </View>
              <View style={{ display: (!loadingList && itineraries.length === 0) ? 'flex' : 'none', width: '100%' }}>
                {renderEmptyState()}
              </View>
            </View>
          </View>

          <View style={{ width: '100%' }}>
            {itineraries.map((item) => (
              <ItineraryCard 
                key={item.id}
                itinerary={item} 
                onPress={() => handleItineraryPress(item)} 
                onEdit={() => handleEditSurveyPlan(item)}
                onDelete={() => handleDeleteItinerary(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Main Floating Action Button */}
        <View style={{ display: (itineraries.length === 0 && !loadingList) ? 'flex' : 'none', position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCreateNew}
            style={[
              styles.fabMain,
              shadows.lg,
              { backgroundColor: colors.primary500, borderRadius: 9999 }
            ]}
          >
            <Ionicons name="add" size={28} color="#fff" />
            <Text style={[typography.titleMedium, { color: '#fff', marginLeft: 8, fontWeight: '700' }]}>
              {t('home.newPlan')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  miniBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  miniBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  fabMain: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
});
