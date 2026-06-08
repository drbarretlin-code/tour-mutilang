import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, Text, TouchableOpacity, Alert, Platform, Image, TextInput, Switch, Linking, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useSurvey } from '../src/context/SurveyContext';
import { AuthForm } from '../src/components/auth/AuthForm';
import { dbService } from '../src/services/db';
import { settingsService } from '../src/services/settings';
import { Itinerary } from '../src/types/itinerary';
import { ItineraryCard } from '../src/components/dashboard/ItineraryCard';
import { t } from '../src/i18n';
import { LanguagePicker } from '../src/components/common/LanguagePicker';
import { useLanguage } from '../src/context/LanguageContext';

export default function HomeDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { setActiveItinerary, loadSurveyForEdit } = useSurvey();
  const { locale } = useLanguage();
  const router = useRouter();

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [persistKey, setPersistKey] = useState(false); // Default to not persist
  const [savingKey, setSavingKey] = useState(false);
  const [isApiPanelExpanded, setIsApiPanelExpanded] = useState(true);

  // Check for API Key on mount
  useEffect(() => {
    settingsService.getApiKey().then(key => {
      if (key) {
        setHasApiKey(true);
        setIsApiPanelExpanded(false);
      } else {
        setHasApiKey(false);
        setIsApiPanelExpanded(true);
      }
      setLoadingApiKey(false);
    }).catch(() => {
      setLoadingApiKey(false);
      setIsApiPanelExpanded(true);
    });
  }, []);

  // Fetch itineraries when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (user) {
        setLoadingList(true);
        dbService.getUserItineraries(user.uid)
          .then(data => {
            if (isActive) {
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

  // Derived display states - used to toggle visibility without changing DOM structure
  const showLoading = authLoading || loadingApiKey;
  const showAuth = !showLoading && !user;
  const showDashboard = !showLoading && !!user;

  const displayName = user?.email ? user.email.split('@')[0] : 'Traveler';

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await settingsService.saveApiKey(apiKeyInput.trim(), persistKey);
      setHasApiKey(true);
      setIsApiPanelExpanded(false);
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), 'Failed to save API Key');
    } finally {
      setSavingKey(false);
    }
  };

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
          await settingsService.clearApiKey();
          await logout();
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleCreateNew = () => {
    if (!hasApiKey) {
      Alert.alert('API Key Required', t('home.apiKeySetupDesc'));
      return;
    }
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

  const renderApiKeySetup = () => {
    const isExpanded = isApiPanelExpanded;

    return (
      <View style={[styles.apiCard, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderColor: colors.border, marginBottom: 20 }]}>
        {/* Panel Header (Click to toggle) */}
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={() => setIsApiPanelExpanded(!isExpanded)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="hardware-chip" size={24} color={hasApiKey ? colors.primary500 : colors.warning500} />
            <Text style={[typography.titleMedium, { color: colors.text, marginLeft: 12, fontWeight: '800' }]}>
              {hasApiKey 
                ? t('home.apiKeyEnabled', { defaultValue: 'AI 智慧引擎：已啟用' }) 
                : t('home.apiKeyDisabled', { defaultValue: 'AI 智慧引擎：未啟用' })
              }
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isExpanded && hasApiKey && (
              <View style={{ backgroundColor: colors.primary50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={[typography.caption, { color: colors.primary700, fontWeight: '700' }]}>
                  Gemini Active
                </Text>
              </View>
            )}
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Panel Content (Visible only when expanded) */}
        <View style={{ display: isExpanded ? 'flex' : 'none', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 }}>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: 16, lineHeight: 22 }]}>
            {t('home.apiKeySetupDesc', { defaultValue: '為了提供個人化的專屬行程規劃，系統需要存取 Gemini AI。請輸入您的 API Key 來啟用智慧引擎。' })}
          </Text>

          <TouchableOpacity onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')} style={styles.linkContainer}>
            <Text style={[typography.labelMedium, { color: colors.primary600, fontWeight: '600' }]}>
              {t('home.getFreeApiKey', { defaultValue: '點此快速申請免費 Google Gemini API Key' })}
            </Text>
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background, borderRadius: borderRadius.md, marginBottom: 16 }]}>
            <Ionicons name="key" size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
            <TextInput
              style={[styles.input, typography.bodyLarge, { color: colors.text }]}
              placeholder={t('home.apiKeyPlaceholder', { defaultValue: '貼上您的 Gemini API Key (AIzaSy...)' })}
              placeholderTextColor={colors.textTertiary}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              secureTextEntry
            />
          </View>

          <View style={styles.switchContainer}>
            <Switch
              value={persistKey}
              onValueChange={setPersistKey}
              trackColor={{ false: colors.border, true: colors.primary400 }}
              thumbColor={Platform.OS === 'ios' ? '#fff' : (persistKey ? colors.primary600 : '#f4f3f4')}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[typography.labelLarge, { color: colors.text, fontWeight: '600' }]}>
                {t('home.apiKeySaveLocally', { defaultValue: '儲存於本機裝置' })}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('home.apiKeySaveLocallyDesc', { defaultValue: '若取消勾選，關閉網頁後將自動清除，不留存於記憶體。' })}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              style={[
                styles.saveBtn, 
                { 
                  backgroundColor: apiKeyInput.trim() ? colors.primary500 : colors.border, 
                  borderRadius: borderRadius.md,
                  flex: 2,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
              disabled={!apiKeyInput.trim() || savingKey}
              onPress={handleSaveApiKey}
              activeOpacity={0.8}
            >
              {savingKey ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={[typography.labelLarge, { color: '#fff', fontWeight: '700' }]}>
                    {t('home.saveApiKey', { defaultValue: '儲存金鑰' })}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {hasApiKey && (
              <TouchableOpacity 
                style={[
                  styles.saveBtn, 
                  { 
                    backgroundColor: colors.error50, 
                    borderColor: colors.error200,
                    borderWidth: 1,
                    borderRadius: borderRadius.md,
                    flex: 1,
                    height: 56,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }
                ]}
                onPress={async () => {
                  safeConfirm(
                    t('home.clearApiKeyConfirmTitle', { defaultValue: '清除 API Key' }),
                    t('home.clearApiKeyConfirmMsg', { defaultValue: '確定要清除已設定的 API Key 嗎？這將會暫停 AI 的推薦功能。' }),
                    async () => {
                      await settingsService.clearApiKey();
                      setHasApiKey(false);
                      setApiKeyInput('');
                      setIsApiPanelExpanded(true);
                    }
                  );
                }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="trash-outline" size={20} color={colors.error600} style={{ marginRight: 8 }} />
                  <Text style={[typography.labelLarge, { color: colors.error600, fontWeight: '700' }]}>
                    {t('common.clear', { defaultValue: '清除' })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

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
            {/* API Setup View */}
            <View>
              {renderApiKeySetup()}
            </View>
            
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
  apiCard: {
    padding: 24,
    borderWidth: 1,
  },
  apiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 16,
    borderRadius: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
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
