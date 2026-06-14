import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary } from '../../types/itinerary';
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

interface PackingListProps {
  itinerary: Itinerary;
  survey: TripSurvey;
}

export interface PackingItem {
  id: string;
  name: string;
  checked: boolean;
  category: 'essential' | 'clothing' | 'electronics' | 'docs' | 'custom';
}

export function PackingList({ itinerary, survey }: PackingListProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const [items, setItems] = useState<PackingItem[]>([]);
  const [newCustomItem, setNewCustomItem] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'docs' | 'clothing' | 'essential' | 'electronics' | 'custom'>('all');

  const STORAGE_KEY = `@packing_list_new_${itinerary.id}`;
  const locale = survey.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const start = new Date(survey?.dates?.startDate || Date.now());
  const end = new Date(survey?.dates?.endDate || Date.now() + 86400000 * 3);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // Initialize checklist items based on survey settings
  useEffect(() => {
    async function loadList() {
      try {
        const cached = await cacheGet(STORAGE_KEY);
        if (cached) {
          setItems(JSON.parse(cached) as PackingItem[]);
        } else {
          // Generate smart initial items based on days count and trip parameters
          const initialItems: PackingItem[] = [
            // Documents
            { id: 'doc-1', name: isEn ? 'Passport' : '護照正本與簽證', checked: false, category: 'docs' },
            { id: 'doc-2', name: isEn ? 'Flight Itinerary / Boarding Pass' : '機票行程單 / 登機證影本', checked: false, category: 'docs' },
            { id: 'doc-3', name: isEn ? 'Hotel Confirmation Vouchers' : '飯店入住確認單', checked: false, category: 'docs' },
            { id: 'doc-4', name: isEn ? 'Travel Insurance Proof' : '旅平險 / 醫療保險憑證', checked: false, category: 'docs' },
            { id: 'doc-5', name: isEn ? 'Passport Photo Copies (2)' : '護照大頭照影本 x2', checked: false, category: 'docs' },

            // Electronics
            { id: 'ele-1', name: isEn ? 'Mobile Phone & Charger' : '手機與充電頭 / 線材', checked: false, category: 'electronics' },
            { id: 'ele-2', name: isEn ? 'Power Bank' : '行動電源 (隨身攜帶)', checked: false, category: 'electronics' },
            { id: 'ele-3', name: isEn ? 'Universal Travel Adapter' : '萬國轉接頭', checked: false, category: 'electronics' },
            { id: 'ele-4', name: isEn ? 'Headphones / Earbuds' : '耳機', checked: false, category: 'electronics' },

            // Essentials
            { id: 'ess-1', name: isEn ? 'Local Currency Cash' : '當地外幣現金', checked: false, category: 'essential' },
            { id: 'ess-2', name: isEn ? 'Credit / Debit Cards' : '信用卡 / 提款卡', checked: false, category: 'essential' },
            { id: 'ess-3', name: isEn ? 'Toothbrush & Toothpaste' : '牙刷與牙膏', checked: false, category: 'essential' },
            { id: 'ess-4', name: isEn ? 'Personal Medication / First Aid' : '個人常備藥品 / 急救包', checked: false, category: 'essential' },
            { id: 'ess-5', name: isEn ? 'Sunscreen' : '防曬乳', checked: false, category: 'essential' },
            { id: 'ess-6', name: isEn ? 'Sanitizer / Wet Wipes' : '乾洗手 / 濕紙巾', checked: false, category: 'essential' },

            // Clothing (dynamic counts)
            { id: 'clo-1', name: isEn ? `Underwear (${dayCount} sets)` : `內衣褲 (${dayCount} 套)`, checked: false, category: 'clothing' },
            { id: 'clo-2', name: isEn ? `Socks (${dayCount} pairs)` : `襪子 (${dayCount} 雙)`, checked: false, category: 'clothing' },
            { id: 'clo-3', name: isEn ? `Tops (${dayCount} shirts)` : `上衣 (${dayCount} 件)`, checked: false, category: 'clothing' },
            { id: 'clo-4', name: isEn ? `Pants / Shorts (${Math.ceil(dayCount / 2)} pairs)` : `褲子 / 短褲 (${Math.ceil(dayCount / 2)} 件)`, checked: false, category: 'clothing' },
            { id: 'clo-5', name: isEn ? 'Comfortable Walking Shoes' : '好走好穿的運動鞋', checked: false, category: 'clothing' },
            { id: 'clo-6', name: isEn ? 'Lightweight Jacket' : '防風薄外套 / 薄針織衫', checked: false, category: 'clothing' },
          ];

          // Travel companion tweaks
          if (survey.travelers.children.length > 0) {
            initialItems.push({ id: 'ess-child-1', name: isEn ? 'Kid Snacks & Toys' : '孩童零食與安撫玩具', checked: false, category: 'essential' });
            initialItems.push({ id: 'ess-child-2', name: isEn ? 'Kid Toiletries / Diapers' : '孩童專用盥洗用品 / 尿布', checked: false, category: 'essential' });
          }

          if (survey.transportModes.includes('rental')) {
            initialItems.push({ id: 'doc-driver-1', name: isEn ? 'International Driving Permit' : '國際駕照正本', checked: false, category: 'docs' });
            initialItems.push({ id: 'ess-driver-2', name: isEn ? 'Car Phone Mount' : '車用手機架', checked: false, category: 'electronics' });
          }

          // Interest dynamic customization
          const interests = (survey.interests || []) as string[];
          if (interests.includes('water') || interests.includes('beach')) {
            initialItems.push({ id: 'clo-water-1', name: isEn ? 'Swimsuit & Goggles' : '泳裝與泳鏡', checked: false, category: 'clothing' });
            initialItems.push({ id: 'ess-water-2', name: isEn ? 'Waterproof Phone Pouch' : '手機防水袋', checked: false, category: 'essential' });
            initialItems.push({ id: 'clo-water-3', name: isEn ? 'Sandals / Slippers' : '海灘拖鞋 / 涼鞋', checked: false, category: 'clothing' });
          }

          if (interests.includes('nature') || interests.includes('adventure')) {
            initialItems.push({ id: 'ess-nat-1', name: isEn ? 'Insect Repellent' : '防蚊液 / 驅蚊貼片', checked: false, category: 'essential' });
            initialItems.push({ id: 'clo-nat-2', name: isEn ? 'Hiking / Trail Shoes' : '防滑登山鞋 / 健行鞋', checked: false, category: 'clothing' });
            initialItems.push({ id: 'clo-nat-3', name: isEn ? 'Raincoat / Poncho' : '便攜型雨衣', checked: false, category: 'clothing' });
          }

          setItems(initialItems);
          await cacheSet(STORAGE_KEY, JSON.stringify(initialItems));
        }
      } catch (error) {
        console.error('Failed to initialize packing list:', error);
      }
    }
    loadList();
  }, [itinerary.id]);

  const saveList = async (newItems: PackingItem[]) => {
    setItems(newItems);
    try {
      await cacheSet(STORAGE_KEY, JSON.stringify(newItems));
    } catch (e) {
      console.error('Failed to save packing list:', e);
    }
  };

  const handleToggle = (id: string) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    saveList(updated);
  };

  const handleAddCustomItem = () => {
    if (!newCustomItem.trim()) return;
    const newItem: PackingItem = {
      id: `cust-${Date.now()}`,
      name: newCustomItem.trim(),
      checked: false,
      category: 'custom'
    };
    const updated = [...items, newItem];
    saveList(updated);
    setNewCustomItem('');
  };

  const handleDeleteCustom = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    saveList(updated);
  };

  const totalCount = items.length;
  const checkedCount = items.filter(item => item.checked).length;
  const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    return item.category === activeTab;
  });

  const getTabLabel = (tab: typeof activeTab) => {
    switch (tab) {
      case 'all': return isEn ? 'All' : '全部';
      case 'docs': return isEn ? 'Documents' : '證件';
      case 'clothing': return isEn ? 'Clothing' : '衣物';
      case 'essential': return isEn ? 'Essentials' : '日常用品';
      case 'electronics': return isEn ? 'Electronics' : '電子產品';
      case 'custom': return isEn ? 'Custom' : '自訂';
    }
  };

  const tabs: (typeof activeTab)[] = ['all', 'docs', 'clothing', 'essential', 'electronics', 'custom'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Progress Card */}
      <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
        <View style={styles.flexRow}>
          <View>
            <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '800' }]}>
              {isEn ? 'Packing Progress' : '行李打包進度'}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              {isEn ? `${checkedCount} of ${totalCount} items packed` : `已打包 ${checkedCount} / ${totalCount} 件物品`}
            </Text>
          </View>
          <Text style={[typography.headlineMedium, { color: colors.primary500, fontWeight: '800', marginLeft: 'auto' }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>

        {/* Custom Progress Bar */}
        <View style={[styles.progressBarBg, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.full }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primary500,
                borderRadius: borderRadius.full,
              },
            ]}
          />
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab ? colors.primary500 : colors.surface,
                borderColor: activeTab === tab ? colors.primary500 : colors.border,
                borderRadius: borderRadius.full,
              }
            ]}
          >
            <Text
              style={[
                typography.labelMedium,
                {
                  color: activeTab === tab ? '#FFFFFF' : colors.textSecondary,
                  fontWeight: activeTab === tab ? '700' : '500'
                }
              ]}
            >
              {getTabLabel(tab)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Checklist */}
      <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.sm }]}>
        {filteredItems.length === 0 ? (
          <View style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Ionicons name="sparkles-outline" size={36} color={colors.textTertiary} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 12 }]}>
              {isEn ? 'No items in this category' : '此類別中尚無物品'}
            </Text>
          </View>
        ) : (
          filteredItems.map(item => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => handleToggle(item.id)}
              style={[styles.itemRow, { borderBottomColor: colors.border }]}
            >
              <Ionicons
                name={item.checked ? "checkbox" : "square-outline"}
                size={22}
                color={item.checked ? colors.primary500 : colors.textTertiary}
              />
              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color: item.checked ? colors.textTertiary : colors.text,
                    textDecorationLine: item.checked ? 'line-through' : 'none',
                    marginLeft: spacing.sm,
                    flex: 1
                  }
                ]}
              >
                {item.name}
              </Text>

              {item.category === 'custom' && (
                <TouchableOpacity onPress={() => handleDeleteCustom(item.id)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.error500} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Add Custom Item */}
      <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, gap: 12 }]}>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
          {isEn ? 'Add Custom Item' : '新增自訂打包物品'}
        </Text>
        <View style={styles.addInputRow}>
          <TextInput
            style={[
              styles.input,
              typography.bodyMedium,
              {
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                color: colors.text,
                backgroundColor: colors.backgroundSecondary
              }
            ]}
            placeholder={isEn ? "e.g. Swim cap, drone charger" : "例如：泳帽、空拍機充電器"}
            placeholderTextColor={colors.textTertiary}
            value={newCustomItem}
            onChangeText={setNewCustomItem}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary500, borderRadius: borderRadius.md }]}
            onPress={handleAddCustomItem}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
  progressBarBg: {
    height: 8,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 44,
  },
  addBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
