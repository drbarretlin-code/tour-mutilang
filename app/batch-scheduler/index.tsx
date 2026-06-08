import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { aiService } from '../../src/services/ai';
import { useSurvey } from '../../src/context/SurveyContext';
import { dbService } from '../../src/services/db';
import { Activity } from '../../src/types/itinerary';

export default function BatchSchedulerScreen() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();
  const { activeItinerary, setActiveItinerary } = useSurvey();

  const [inputUrls, setInputUrls] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Track user decisions and edits for each result item
  const [decisions, setDecisions] = useState<Record<number, { title: string, day: number, status: 'pending' | 'imported' | 'skipped' }>>({});

  const handleExample = () => {
    setInputUrls(
      "https://www.google.com/maps/place/Savoey+Terminal21\n" +
      "https://www.klook.com/zh-TW/activity/95015-suphattra-land-orchard-rayong/\n" +
      "https://www.google.com/maps/place/FO+SHO+BRO+Bangkok/"
    );
  };

  const handleAnalyze = async () => {
    if (!inputUrls.trim()) return;
    
    setIsAnalyzing(true);
    setResults([]);
    try {
      const res = await aiService.analyzeBatchUrls(inputUrls, activeItinerary);
      if (res && res.analysisResults) {
        setResults(res.analysisResults);
        
        // Initialize decisions
        const initialDecisions: Record<number, any> = {};
        res.analysisResults.forEach((item: any, idx: number) => {
          initialDecisions[idx] = { 
            title: item.title || '', 
            day: item.suggestedDay || 1, 
            status: 'pending' 
          };
        });
        setDecisions(initialDecisions);
      }
    } catch (error) {
      console.error(error);
      alert('分析失敗，請稍後再試。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'adoptable': return colors.primary500;
      case 'optional': return '#8B5CF6'; // Purple
      case 'not_recommended': return colors.error500;
      default: return colors.textSecondary;
    }
  };

  const getDecisionLabel = (decision: string) => {
    switch (decision) {
      case 'adoptable': return '可採用';
      case 'optional': return '可選擇';
      case 'not_recommended': return '不建議';
      default: return '未知';
    }
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    setDecisions(prev => ({
      ...prev,
      [index]: { ...prev[index], title: newTitle }
    }));
  };

  const handleDayChange = (index: number, newDay: number) => {
    setDecisions(prev => ({
      ...prev,
      [index]: { ...prev[index], day: newDay }
    }));
  };

  const handleSkip = (index: number) => {
    setDecisions(prev => ({
      ...prev,
      [index]: { ...prev[index], status: 'skipped' }
    }));
  };

  const handleAddToItinerary = async (item: any, index: number) => {
    if (!activeItinerary) return;
    
    const decision = decisions[index];
    const targetDayNumber = decision?.day || 1;
    const finalTitle = decision?.title || item.title || '未知景點';
    
    const dayIndex = targetDayNumber - 1;
    if (dayIndex < 0 || dayIndex >= activeItinerary.days.length) {
      alert('選擇的天數超出既有行程範圍。');
      return;
    }

    const updatedItinerary = { ...activeItinerary };
    const day = { ...updatedItinerary.days[dayIndex]! };
    
    const newActivity: Activity = {
      id: `act-batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order: day.activities.length,
      startTime: item.suggestedTime || '14:00',
      endTime: '15:00', // 預設給1小時
      title: finalTitle,
      type: (item.category as any) || 'attraction',
      description: item.suggestion || '',
      location: { latitude: 0, longitude: 0, address: '', name: finalTitle },
      duration: 60,
      links: [],
      notes: '',
      isMustVisit: false,
    };

    day.activities = [...day.activities, newActivity];
    updatedItinerary.days[dayIndex] = day;

    setActiveItinerary(updatedItinerary);
    try {
      await dbService.saveItinerary(updatedItinerary);
      setDecisions(prev => ({
        ...prev,
        [index]: { ...prev[index], status: 'imported' }
      }));
    } catch (err) {
      console.error(err);
      alert('加入失敗，請稍後再試。');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '700' }]}>
          🤖 AI 智慧批次排程
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              請貼入多個網頁介紹或景點名稱（每行一筆），AI 將分析其地理位置、分類、同質性，並給出專業排程與體驗警示。
            </Text>

            <View style={styles.inputHeader}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary, fontWeight: '700' }]}>輸入內容：</Text>
              <TouchableOpacity onPress={handleExample}>
                <Text style={[typography.labelSmall, { color: colors.primary500 }]}>帶入範例</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: colors.backgroundSecondary, 
                  borderColor: colors.border,
                  borderRadius: borderRadius.sm,
                  color: colors.text
                }
              ]}
              multiline
              numberOfLines={6}
              placeholder="貼上網址或景點名稱..."
              placeholderTextColor={colors.textTertiary}
              value={inputUrls}
              onChangeText={setInputUrls}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.analyzeButton,
                { backgroundColor: !inputUrls.trim() || isAnalyzing ? colors.textTertiary : colors.primary500, borderRadius: borderRadius.md }
              ]}
              disabled={!inputUrls.trim() || isAnalyzing}
              onPress={handleAnalyze}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[typography.titleMedium, { color: '#fff', fontWeight: '700' }]}>開始智能分析</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Results Area */}
          {results.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700', marginBottom: spacing.md }]}>
                分析結果 ({results.length} 筆)
              </Text>
              
              {results.map((item, index) => {
                const decisionState = decisions[index] || { title: item.title, day: 1, status: 'pending' };
                const isImported = decisionState.status === 'imported';
                const isSkipped = decisionState.status === 'skipped';
                
                let cardStyle: any[] = [styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.md }];
                if (isImported) {
                  cardStyle.push({ borderColor: colors.primary300, backgroundColor: colors.primary50 });
                } else if (isSkipped) {
                  cardStyle.push({ opacity: 0.6, borderColor: colors.border });
                }

                return (
                  <View key={index} style={cardStyle}>
                    {isImported && (
                      <View style={[styles.statusBanner, { backgroundColor: colors.primary500 }]}>
                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                        <Text style={styles.statusBannerText}>已成功匯入</Text>
                      </View>
                    )}
                    {isSkipped && (
                      <View style={[styles.statusBanner, { backgroundColor: colors.textSecondary }]}>
                        <Ionicons name="close-circle" size={14} color="#fff" />
                        <Text style={styles.statusBannerText}>已略過建議</Text>
                      </View>
                    )}

                    <View style={styles.resultHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]} numberOfLines={2}>
                          {item.title || '未知景點'}
                        </Text>
                        <View style={styles.tagsRow}>
                          <Text style={[styles.tag, typography.caption, { backgroundColor: colors.backgroundSecondary, color: colors.textSecondary }]}>
                            {item.region}
                          </Text>
                          <Text style={[styles.tag, typography.caption, { backgroundColor: colors.primary50, color: colors.primary700 }]}>
                            分類：{item.category}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.badge, { backgroundColor: getDecisionColor(item.aiDecision) + '15', borderWidth: 1, borderColor: getDecisionColor(item.aiDecision) + '30' }]}>
                        <Text style={[typography.labelSmall, { color: getDecisionColor(item.aiDecision), fontWeight: '800' }]}>
                          {getDecisionLabel(item.aiDecision)}
                        </Text>
                      </View>
                    </View>

                    {/* Editor Fields */}
                    <View style={[styles.editorBox, { borderColor: colors.border, backgroundColor: '#F8FAFC' }]}>
                      <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: 6, fontWeight: '700' }]}>
                        <Ionicons name="location-outline" size={14} /> 景點主要名稱 (可編輯)
                      </Text>
                      <TextInput 
                        style={[styles.titleInput, { borderColor: colors.border, backgroundColor: '#FFF' }]}
                        value={decisionState.title}
                        onChangeText={(t) => handleTitleChange(index, t)}
                        editable={decisionState.status === 'pending'}
                      />
                      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                        💡 此名稱將作為匯入後 Google Maps 導航與搜尋之關鍵字。
                      </Text>
                    </View>

                    {/* AI Assessment Reason */}
                    <View style={[styles.reasonBox, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.sm }]}>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700' }}>實務邏輯分析與建議：</Text>{'\n'}
                        {item.aiDecisionReason}
                      </Text>
                    </View>

                    {/* Warnings */}
                    {item.warnings && item.warnings !== '無' && (
                      <View style={styles.warningBox}>
                        <Ionicons name="warning" size={16} color={colors.warning600} style={{ marginRight: 6, marginTop: 2 }} />
                        <Text style={[typography.bodySmall, { color: colors.warning700, flex: 1, fontWeight: '600' }]}>
                          警示: {item.warnings}
                        </Text>
                      </View>
                    )}

                    {/* Suggestion */}
                    <View style={styles.suggestionBox}>
                      <Ionicons name="bulb" size={16} color={colors.primary600} style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={[typography.bodySmall, { color: colors.primary700, flex: 1, fontWeight: '600' }]}>
                        排程建議: {item.suggestion}
                      </Text>
                    </View>

                    {/* Processing Actions */}
                    {decisionState.status === 'pending' && (
                      <View style={[styles.actionsArea, { borderTopColor: colors.border }]}>
                        {!activeItinerary ? (
                          <View style={{ padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="information-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                            <Text style={[typography.labelMedium, { color: '#B91C1C', flex: 1 }]}>
                              請先退回首頁「選擇」或「建立」一份行程計畫，才能使用一鍵匯入功能喔！
                            </Text>
                          </View>
                        ) : (
                          <>
                            <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>
                              選擇欲安插的天數：
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} style={{ marginBottom: 16 }}>
                              {activeItinerary.days.map((d, dIdx) => (
                            <TouchableOpacity 
                              key={d.dayNumber}
                              style={[
                                styles.daySelectBtn,
                                { 
                                  borderColor: decisionState.day === d.dayNumber ? colors.primary500 : colors.border,
                                  backgroundColor: decisionState.day === d.dayNumber ? colors.primary50 : '#FFF'
                                }
                              ]}
                              onPress={() => handleDayChange(index, d.dayNumber)}
                            >
                              <Text style={[
                                typography.labelSmall, 
                                { color: decisionState.day === d.dayNumber ? colors.primary700 : colors.textSecondary, fontWeight: decisionState.day === d.dayNumber ? '700' : '400' }
                              ]}>
                                Day {d.dayNumber}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        <View style={styles.actionBtnRow}>
                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: '#FFF' }]}
                            onPress={() => handleSkip(index)}
                          >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>略過建議</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: colors.primary500, backgroundColor: colors.primary500, flex: 2 }]}
                            onPress={() => handleAddToItinerary(item, index)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                            <Text style={[typography.labelMedium, { color: '#FFF', marginLeft: 4, fontWeight: '700' }]}>確認匯入 (Day {decisionState.day})</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                      </View>
                    )}

                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    minHeight: 120,
    marginBottom: 16,
  },
  analyzeButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    marginTop: 8,
  },
  resultCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusBanner: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  statusBannerText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editorBox: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  reasonBox: {
    padding: 12,
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionsArea: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  daySelectBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 6,
  },
});
