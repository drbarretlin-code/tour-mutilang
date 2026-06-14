import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary, Activity } from '../../types/itinerary';
import { TripSurvey } from '../../types/survey';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

// Web-safe cache helpers
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

interface ItineraryCollaboratorProps {
  itinerary: Itinerary;
  survey: TripSurvey;
}

interface VoteData {
  upVotes: string[]; // List of names who voted up
  downVotes: string[]; // List of names who voted down
}

// Mock travelers
const MOCK_FRIENDS = ['Alice 🏃‍♀️', 'Bob ☕', 'Charlie 📷', 'David 🗺️'];

export function ItineraryCollaborator({ itinerary, survey }: ItineraryCollaboratorProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [votes, setVotes] = useState<Record<string, VoteData>>({});

  const STORAGE_KEY = `@collab_votes_${itinerary.id}`;
  const locale = survey.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const days = itinerary.days || [];
  const currentDay = days[selectedDayIdx];
  const activities = currentDay ? currentDay.activities || [] : [];

  // Load votes from cache or initialize with mock data
  useEffect(() => {
    async function loadVotes() {
      try {
        const cached = await cacheGet(STORAGE_KEY);
        if (cached) {
          setVotes(JSON.parse(cached));
        } else {
          // Initialize mock votes for all activities
          const initialVotes: Record<string, VoteData> = {};
          
          itinerary.days.forEach(day => {
            day.activities.forEach((act, actIdx) => {
              // Generate mock votes deterministically based on index to look realistic
              const upVotes: string[] = [];
              const downVotes: string[] = [];
              
              MOCK_FRIENDS.forEach((friend, fIdx) => {
                const seed = (actIdx + fIdx) % 5;
                if (seed === 0) {
                  downVotes.push(friend);
                } else if (seed !== 4) {
                  upVotes.push(friend);
                } // seed === 4 is no vote
              });
              
              initialVotes[act.id] = { upVotes, downVotes };
            });
          });

          setVotes(initialVotes);
          await cacheSet(STORAGE_KEY, JSON.stringify(initialVotes));
        }
      } catch (error) {
        console.error('Failed to load collaborative votes:', error);
      }
    }
    loadVotes();
  }, [itinerary.id]);

  const saveVotes = async (newVotes: Record<string, VoteData>) => {
    setVotes(newVotes);
    try {
      await cacheSet(STORAGE_KEY, JSON.stringify(newVotes));
    } catch (e) {
      console.error('Failed to save collaborative votes:', e);
    }
  };

  const handleVote = (actId: string, type: 'up' | 'down') => {
    const userLabel = isEn ? 'You 🙋‍♂️' : '您 🙋‍♂️';
    const current = votes[actId] || { upVotes: [], downVotes: [] };
    
    let updatedUp = [...current.upVotes];
    let updatedDown = [...current.downVotes];

    const hasUpVoted = updatedUp.includes(userLabel);
    const hasDownVoted = updatedDown.includes(userLabel);

    if (type === 'up') {
      if (hasUpVoted) {
        // Remove upvote
        updatedUp = updatedUp.filter(name => name !== userLabel);
      } else {
        // Add upvote, remove downvote if any
        updatedUp.push(userLabel);
        updatedDown = updatedDown.filter(name => name !== userLabel);
      }
    } else {
      if (hasDownVoted) {
        // Remove downvote
        updatedDown = updatedDown.filter(name => name !== userLabel);
      } else {
        // Add downvote, remove upvote if any
        updatedDown.push(userLabel);
        updatedUp = updatedUp.filter(name => name !== userLabel);
      }
    }

    const updatedVotes = {
      ...votes,
      [actId]: { upVotes: updatedUp, downVotes: updatedDown }
    };
    saveVotes(updatedVotes);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Collaboration Banner */}
      <View style={[styles.card, shadows.sm, { backgroundColor: colors.primary50, borderColor: colors.primary100, borderWidth: 1, borderRadius: borderRadius.lg }]}>
        <View style={styles.flexRow}>
          <Ionicons name="people-outline" size={24} color={colors.primary700} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleLarge, { color: colors.primary800, fontWeight: '800' }]}>
              {isEn ? 'Group Collaborative Voting' : '小組協同投票草案'}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.primary700, marginTop: 4 }]}>
              {isEn 
                ? 'Share this draft with friends to vote on attraction preferences.' 
                : '已開啟共享草稿模式，可邀請旅伴針對每日排程投票表決！'}
            </Text>
          </View>
        </View>
      </View>

      {/* Day Selector */}
      <View style={styles.daySelectorContainer}>
        {days.map((day, idx) => (
          <TouchableOpacity
            key={day.dayNumber}
            onPress={() => setSelectedDayIdx(idx)}
            style={[
              styles.dayBtn,
              {
                backgroundColor: selectedDayIdx === idx ? colors.primary500 : colors.surface,
                borderColor: selectedDayIdx === idx ? colors.primary500 : colors.border,
                borderRadius: borderRadius.md,
              }
            ]}
          >
            <Text
              style={[
                typography.labelMedium,
                {
                  color: selectedDayIdx === idx ? '#FFFFFF' : colors.textSecondary,
                  fontWeight: '700'
                }
              ]}
            >
              {isEn ? `Day ${day.dayNumber}` : `第 ${day.dayNumber} 天`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity Voting Cards */}
      <View style={{ gap: 16 }}>
        {activities.length === 0 ? (
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, alignItems: 'center' }]}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              {isEn ? 'No activities scheduled for this day.' : '本日無安排行程。'}
            </Text>
          </View>
        ) : (
          activities.map((act) => {
            const userLabel = isEn ? 'You 🙋‍♂️' : '您 🙋‍♂️';
            const actVotes = votes[act.id] || { upVotes: [], downVotes: [] };
            const upCount = actVotes.upVotes.length;
            const downCount = actVotes.downVotes.length;
            const userUp = actVotes.upVotes.includes(userLabel);
            const userDown = actVotes.downVotes.includes(userLabel);

            // Skip hotel or transport types if they are not attraction/activity
            if (act.type !== 'activity' && act.type !== 'attraction' && act.type !== 'restaurant') return null;

            return (
              <View key={act.id} style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
                {/* Activity details header */}
                <View style={styles.activityHeader}>
                  <View style={{ backgroundColor: colors.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                    <Text style={[typography.labelSmall, { color: colors.textSecondary, fontWeight: '700' }]}>
                      {act.startTime}
                    </Text>
                  </View>
                  <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '800', flex: 1, marginLeft: 8 }]} numberOfLines={1}>
                    {act.title}
                  </Text>
                </View>

                {/* Voter details */}
                <View style={styles.voterBox}>
                  {upCount > 0 && (
                    <View style={styles.voteListRow}>
                      <Ionicons name="thumbs-up" size={14} color={colors.success600} style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={[typography.bodySmall, { color: colors.success700, flex: 1 }]}>
                        {actVotes.upVotes.join(', ')} {isEn ? 'voted YES' : '贊成安排'}
                      </Text>
                    </View>
                  )}
                  {downCount > 0 && (
                    <View style={styles.voteListRow}>
                      <Ionicons name="thumbs-down" size={14} color={colors.error600} style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={[typography.bodySmall, { color: colors.error700, flex: 1 }]}>
                        {actVotes.downVotes.join(', ')} {isEn ? 'voted NO' : '反對安排'}
                      </Text>
                    </View>
                  )}
                  {upCount === 0 && downCount === 0 && (
                    <Text style={[typography.caption, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                      {isEn ? 'No votes cast yet.' : '尚無旅伴投票，成為第一個投票的人！'}
                    </Text>
                  )}
                </View>

                {/* Vote actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => handleVote(act.id, 'up')}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: userUp ? colors.success50 : colors.backgroundSecondary,
                        borderColor: userUp ? colors.success500 : colors.border,
                        borderRadius: borderRadius.md,
                      }
                    ]}
                  >
                    <Ionicons name={userUp ? "thumbs-up" : "thumbs-up-outline"} size={18} color={userUp ? colors.success600 : colors.textSecondary} />
                    <Text style={[typography.labelMedium, { color: userUp ? colors.success700 : colors.textSecondary, fontWeight: '700' }]}>
                      {isEn ? `Yes (${upCount})` : `贊成 (${upCount})`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleVote(act.id, 'down')}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: userDown ? colors.error50 : colors.backgroundSecondary,
                        borderColor: userDown ? colors.error500 : colors.border,
                        borderRadius: borderRadius.md,
                      }
                    ]}
                  >
                    <Ionicons name={userDown ? "thumbs-down" : "thumbs-down-outline"} size={18} color={userDown ? colors.error600 : colors.textSecondary} />
                    <Text style={[typography.labelMedium, { color: userDown ? colors.error700 : colors.textSecondary, fontWeight: '700' }]}>
                      {isEn ? `No (${downCount})` : `反對 (${downCount})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 20,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  daySelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  dayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  voterBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  voteListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
});
