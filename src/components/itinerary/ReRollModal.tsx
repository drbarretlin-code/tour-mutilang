import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Activity } from '../../types/itinerary';
import { t } from '../../i18n';

export interface ReRollModalProps {
  visible: boolean;
  isLoading: boolean;
  alternatives: Activity[];
  onClose: () => void;
  onSelect: (activity: Activity) => void;
}

export function ReRollModal({ visible, isLoading, alternatives, onClose, onSelect }: ReRollModalProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const modalContent = (
    <View style={styles.overlay}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, borderRadius: borderRadius.lg }]}>
        
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="dice-outline" size={24} color={colors.primary500} style={{ marginRight: 8 }} />
            <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
              {t('itinerary.reroll.title', { defaultValue: '替代方案 (Alternatives)' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ padding: spacing.md }}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="sync-circle-outline" size={48} color={colors.primary500} style={{ marginBottom: 16 }} />
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('itinerary.reroll.loading', { defaultValue: 'AI 正在為您搜尋最佳替代方案...' })}
              </Text>
            </View>
          ) : alternatives.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('itinerary.reroll.noResults', { defaultValue: '無法產生替代方案，請稍後再試。' })}
              </Text>
            </View>
          ) : (
            alternatives.map((alt, index) => (
              <TouchableOpacity 
                key={alt.id || index} 
                style={[styles.altCard, { borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.surface }]}
                onPress={() => onSelect(alt)}
              >
                <View style={styles.altHeader}>
                  <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700', flex: 1 }]}>{alt.title}</Text>
                  <View style={[styles.tag, { backgroundColor: colors.primary100 }]}>
                    <Text style={[typography.labelSmall, { color: colors.primary700 }]}>{alt.type}</Text>
                  </View>
                </View>
                
                <View style={styles.altRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {alt.startTime} - {alt.endTime} ({alt.duration} min)
                  </Text>
                </View>
                
                <View style={styles.altRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
                    {alt.location?.address || alt.location?.name || 'No location'}
                  </Text>
                </View>

                <Text style={[typography.bodyMedium, { color: colors.text, marginTop: 8 }]} numberOfLines={3}>
                  {alt.notes}
                </Text>
                
                <View style={[styles.selectBtn, { backgroundColor: colors.primary50 }]}>
                  <Text style={[typography.labelMedium, { color: colors.primary600, fontWeight: '700' }]}>
                    {t('itinerary.reroll.selectBtn', { defaultValue: '選擇此方案 (Select)' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999, display: visible ? 'flex' : 'none' }]}>
        {modalContent}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      {modalContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  altHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 8,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  }
});
