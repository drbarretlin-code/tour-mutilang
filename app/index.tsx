import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, Text, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useSurvey } from '../src/context/SurveyContext';
import { AuthForm } from '../src/components/auth/AuthForm';
import { dbService } from '../src/services/db';
import { Itinerary } from '../src/types/itinerary';
import { ItineraryCard } from '../src/components/dashboard/ItineraryCard';
import { t } from '../src/i18n';
import { LanguagePicker } from '../src/components/common/LanguagePicker';

export default function HomeDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { setActiveItinerary, loadSurveyForEdit } = useSurvey();
  const router = useRouter();

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [langModalVisible, setLangModalVisible] = useState(false);

  // Fetch itineraries when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (user) {
        setLoadingList(true);
        dbService.getUserItineraries(user.uid)
          .then(data => {
            if (isActive) {
              // Sort by createdAt descending
              const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setItineraries(sorted);
              setLoadingList(false);
            }
          })
          .catch(err => {
            console.error('Failed to fetch itineraries:', err);
            if (isActive) setLoadingList(false);
          });
      }
      return () => { isActive = false; };
    }, [user])
  );

  if (authLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

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
    // Reset active itinerary when creating a new plan
    setActiveItinerary(null);
    router.push('/survey');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="map-outline" size={64} color={colors.primary200} style={{ marginBottom: spacing.md }} />
      <Text style={[typography.titleLarge, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('home.emptyStateTitle')}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }]}>
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

  const displayName = user?.email ? user.email.split('@')[0] : 'Traveler';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          <View>
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
              {getGreeting()},
            </Text>
            <Text style={[typography.headlineMedium, { color: colors.text, fontWeight: '800' }]}>
              {displayName}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setLangModalVisible(true)} style={styles.iconBtn}>
            <Ionicons name="language-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feature Entry: AI Batch Scheduler (Hero Banner) */}
      <TouchableOpacity 
        style={[styles.heroBanner, shadows.md, { backgroundColor: colors.primary500, borderRadius: 24 }]}
        activeOpacity={0.9}
        onPress={() => router.push('/batch-scheduler')}
      >
        <View style={styles.heroContent}>
          <View style={[styles.heroIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="sparkles" size={28} color="#fff" />
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={[typography.titleLarge, { color: '#fff', fontWeight: '800', marginBottom: 4 }]}>
              {t('home.aiBatchTitle')}
            </Text>
            <Text style={[typography.bodyMedium, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={2}>
              {t('home.aiBatchSubtitle')}
            </Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={32} color="#fff" style={styles.heroActionIcon} />
      </TouchableOpacity>

      {/* List */}
      {loadingList ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary500} />
        </View>
      ) : (
        <FlatList
          data={itineraries}
          keyExtractor={item => item.id}
          contentContainerStyle={itineraries.length === 0 ? styles.emptyListContent : { paddingBottom: 100, paddingTop: 16 }}
          renderItem={({ item }) => (
            <ItineraryCard 
              itinerary={item} 
              onPress={() => handleItineraryPress(item)} 
              onEdit={() => handleEditSurveyPlan(item)}
              onDelete={() => handleDeleteItinerary(item.id)}
            />
          )}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* FAB for Create New Plan */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleCreateNew}
        style={[
          styles.fab,
          shadows.lg,
          { backgroundColor: colors.primary500, borderRadius: 9999 }
        ]}
      >
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={[typography.titleMedium, { color: '#fff', marginLeft: 8, fontWeight: '700' }]}>
          {t('home.newPlan')}
        </Text>
      </TouchableOpacity>

      <LanguagePicker 
        visible={langModalVisible} 
        onClose={() => setLangModalVisible(false)} 
      />
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
    paddingTop: 60, // Safe area roughly
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  heroBanner: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextContainer: {
    flex: 1,
    paddingRight: 24,
  },
  heroActionIcon: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    opacity: 0.9,
  },
});
