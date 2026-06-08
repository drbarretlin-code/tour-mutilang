import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Itinerary } from '../../types/itinerary';
import { TripSurvey } from '../../types/survey';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

interface PackingChecklistProps {
  itinerary: Itinerary;
  survey: TripSurvey;
}

export interface ChecklistItem {
  id: string;
  name: string;
  checked: boolean;
  category: 'essential' | 'clothing' | 'docs' | 'custom';
}

export function PackingChecklist({ itinerary, survey }: PackingChecklistProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newCustomItem, setNewCustomItem] = useState('');

  const CHECKLIST_STORAGE_KEY = `@packing_checklist_${itinerary.id}`;

  // Initialize checklist items based on survey settings
  useEffect(() => {
    async function loadChecklist() {
      try {
        const cached = await AsyncStorage.getItem(CHECKLIST_STORAGE_KEY);
        if (cached) {
          setItems(JSON.parse(cached) as ChecklistItem[]);
        } else {
          // Generate smart initial items
          const initialItems: ChecklistItem[] = [
            // Essential documents
            { id: 'doc-1', name: t('itinerary.packingChecklist.items.doc1'), checked: false, category: 'docs' },
            { id: 'doc-2', name: t('itinerary.packingChecklist.items.doc2'), checked: false, category: 'docs' },
            { id: 'doc-3', name: t('itinerary.packingChecklist.items.doc3'), checked: false, category: 'docs' },
            { id: 'doc-4', name: t('itinerary.packingChecklist.items.doc4'), checked: false, category: 'docs' },

            // Essential items
            { id: 'ess-1', name: t('itinerary.packingChecklist.items.ess1'), checked: false, category: 'essential' },
            { id: 'ess-2', name: t('itinerary.packingChecklist.items.ess2'), checked: false, category: 'essential' },
            { id: 'ess-3', name: t('itinerary.packingChecklist.items.ess3'), checked: false, category: 'essential' },
            { id: 'ess-4', name: t('itinerary.packingChecklist.items.ess4'), checked: false, category: 'essential' },
            { id: 'ess-5', name: t('itinerary.packingChecklist.items.ess5'), checked: false, category: 'essential' },
            { id: 'ess-6', name: t('itinerary.packingChecklist.items.ess6'), checked: false, category: 'essential' },

            // Basic clothing
            { id: 'clo-1', name: t('itinerary.packingChecklist.items.clo1'), checked: false, category: 'clothing' },
            { id: 'clo-2', name: t('itinerary.packingChecklist.items.clo2'), checked: false, category: 'clothing' },
            { id: 'clo-3', name: t('itinerary.packingChecklist.items.clo3'), checked: false, category: 'clothing' },
          ];

          // Dynamic insertion based on travelers and transportation modes
          if (survey.travelers.children.length > 0) {
            initialItems.push({ id: 'ess-child-1', name: t('itinerary.packingChecklist.items.child1'), checked: false, category: 'essential' });
            initialItems.push({ id: 'ess-child-2', name: t('itinerary.packingChecklist.items.child2'), checked: false, category: 'essential' });
          }

          if (survey.transportModes.includes('rental')) {
            initialItems.push({ id: 'doc-driver-1', name: t('itinerary.packingChecklist.items.driver1'), checked: false, category: 'docs' });
            initialItems.push({ id: 'ess-driver-2', name: t('itinerary.packingChecklist.items.driver2'), checked: false, category: 'essential' });
          }

          // Dynamic insertion based on interests
          if (survey.interests.includes('water')) {
            initialItems.push({ id: 'clo-water-1', name: t('itinerary.packingChecklist.items.water1'), checked: false, category: 'clothing' });
            initialItems.push({ id: 'ess-water-2', name: t('itinerary.packingChecklist.items.water2'), checked: false, category: 'essential' });
          }

          if (survey.interests.includes('nature')) {
            initialItems.push({ id: 'ess-nat-1', name: t('itinerary.packingChecklist.items.nat1'), checked: false, category: 'essential' });
            initialItems.push({ id: 'clo-nat-2', name: t('itinerary.packingChecklist.items.nat2'), checked: false, category: 'clothing' });
          }

          setItems(initialItems);
          await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(initialItems));
        }
      } catch (error) {
        console.error('Failed to initialize packing checklist:', error);
      }
    }

    loadChecklist();
  }, [itinerary.id]);

  // Save changes helper
  const saveChecklist = async (newItems: ChecklistItem[]) => {
    setItems(newItems);
    try {
      await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(newItems));
    } catch (e) {
      console.error('Failed to save checklist:', e);
    }
  };

  // Toggle checklist checkbox
  const handleToggle = (id: string) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    saveChecklist(updated);
  };

  // Add custom packing item
  const handleAddCustomItem = () => {
    if (!newCustomItem.trim()) return;

    const newItem: ChecklistItem = {
      id: `cust-${Date.now()}`,
      name: newCustomItem.trim(),
      checked: false,
      category: 'custom'
    };

    const updated = [...items, newItem];
    saveChecklist(updated);
    setNewCustomItem('');
  };

  // Delete custom packing item
  const handleDeleteCustom = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    saveChecklist(updated);
  };

  // Calculate check progress
  const totalCount = items.length;
  const checkedCount = items.filter(item => item.checked).length;
  const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const renderCategorySection = (category: ChecklistItem['category'], title: string) => {
    const sectionItems = items.filter(item => item.category === category);
    if (sectionItems.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' }]}>
          {title} ({sectionItems.filter(i => i.checked).length}/{sectionItems.length})
        </Text>
        {sectionItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => handleToggle(item.id)}
            style={[styles.itemRow, { borderBottomColor: colors.divider }]}
          >
            <Ionicons
              name={item.checked ? "checkbox" : "square-outline"}
              size={22}
              color={item.checked ? colors.primary500 : colors.textTertiary}
            />
            <Text style={[
              typography.bodyMedium,
              {
                color: item.checked ? colors.textTertiary : colors.text,
                textDecorationLine: item.checked ? 'line-through' : 'none',
                marginLeft: spacing.sm,
                flex: 1
              }
            ]}>
              {item.name}
            </Text>

            {category === 'custom' && (
              <TouchableOpacity onPress={() => handleDeleteCustom(item.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={18} color={colors.error500} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Progress Card */}
      <Card variant="elevated" style={styles.progressCard}>
        <View style={styles.flexRow}>
          <View>
            <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
              {t('itinerary.packingChecklist.progress.title')}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {t('itinerary.packingChecklist.progress.subtitle', { checkedCount, totalCount })}
            </Text>
          </View>
          <Text style={[typography.headlineMedium, { color: colors.primary500, fontWeight: '800', marginLeft: 'auto' }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.divider, borderRadius: borderRadius.full }]}>
          <View style={[
            styles.progressBar,
            {
              backgroundColor: colors.primary500,
              width: `${progressPercent}%`,
              borderRadius: borderRadius.full
            }
          ]} />
        </View>
      </Card>

      {/* Input to add custom item */}
      <Card variant="flat" style={styles.addCard}>
        <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '700', marginBottom: spacing.xs }]}>
          {t('itinerary.packingChecklist.custom.title')}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              typography.bodyMedium,
              {
                borderColor: colors.border,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.background,
                color: colors.text,
                paddingHorizontal: spacing.sm,
              }
            ]}
            placeholder={t('itinerary.packingChecklist.custom.placeholder')}
            placeholderTextColor={colors.textTertiary}
            value={newCustomItem}
            onChangeText={setNewCustomItem}
          />
          <TouchableOpacity
            onPress={handleAddCustomItem}
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.primary500,
                borderRadius: borderRadius.sm,
                marginLeft: spacing.sm
              }
            ]}
          >
            <Ionicons name="add" size={20} color={colors.neutral0} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Categories sections */}
      {renderCategorySection('docs', t('itinerary.packingChecklist.categories.docs'))}
      {renderCategorySection('essential', t('itinerary.packingChecklist.categories.essential'))}
      {renderCategorySection('clothing', t('itinerary.packingChecklist.categories.clothing'))}
      {renderCategorySection('custom', t('itinerary.packingChecklist.categories.custom'))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressCard: {
    padding: 16,
    marginBottom: 16,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    width: '100%',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  addCard: {
    padding: 12,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    width: '100%',
  },
  textInput: {
    flex: 1,
    height: '100%',
    borderWidth: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
});
