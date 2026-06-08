import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Activity, Itinerary } from '../../types/itinerary';
import { t } from '../../i18n';

const getActivityTypes = () => [
  { value: 'attraction', label: t('itinerary.activityEditor.types.attraction') },
  { value: 'restaurant', label: t('itinerary.activityEditor.types.restaurant') },
  { value: 'cafe', label: t('itinerary.activityEditor.types.cafe') },
  { value: 'shopping', label: t('itinerary.activityEditor.types.shopping') },
  { value: 'spa', label: t('itinerary.activityEditor.types.spa') },
  { value: 'entertainment', label: t('itinerary.activityEditor.types.entertainment') },
  { value: 'hotel', label: t('itinerary.activityEditor.types.hotel') },
  { value: 'transport', label: t('itinerary.activityEditor.types.transport') },
  { value: 'activity', label: t('itinerary.activityEditor.types.activity') },
];

export interface ActivityEditorModalProps {
  visible: boolean;
  activity: Activity | null;
  itinerary: Itinerary | null;
  currentDayNumber: number;
  onClose: () => void;
  onSave: (updatedActivity: Activity, targetDayNumber: number) => void;
  onDelete: (activityId: string, dayNumber: number) => void;
}

export function ActivityEditorModal({
  visible,
  activity,
  itinerary,
  currentDayNumber,
  onClose,
  onSave,
  onDelete
}: ActivityEditorModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();

  // Internal state
  const [startTime, setStartTime] = useState('');
  const [type, setType] = useState<any>('attraction');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [targetDay, setTargetDay] = useState<number>(1);
  const [links, setLinks] = useState<{ url: string; label: string; type: any }[]>([]);
  
  // Fake custom drop-down states to replace missing picker
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showDayMenu, setShowDayMenu] = useState(false);

  useEffect(() => {
    if (visible && activity) {
      setStartTime(activity.startTime || '10:00');
      setType(activity.type || 'attraction');
      setTitle(activity.title || '');
      setAddress(activity.location?.address || '');
      setNotes(activity.notes || '');
      setTargetDay(currentDayNumber);
      setLinks(activity.links ? [...activity.links] : []);
      
      setShowTypeMenu(false);
      setShowDayMenu(false);
    }
  }, [visible, activity, currentDayNumber]);

  if (!activity || !itinerary) return null;

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('itinerary.activityEditor.errors.titleEmpty'));
      return;
    }
    
    // Deep copy and assign
    const updatedActivity: Activity = JSON.parse(JSON.stringify(activity));
    updatedActivity.startTime = startTime;
    updatedActivity.type = type;
    updatedActivity.title = title;
    updatedActivity.notes = notes;
    
    if (updatedActivity.location) {
      updatedActivity.location.address = address;
    } else {
      updatedActivity.location = {
        name: title,
        address: address,
        latitude: 0,
        longitude: 0
      };
    }

    updatedActivity.links = links.filter(l => l.url.trim() !== '');

    onSave(updatedActivity, targetDay);
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('itinerary.activityEditor.deleteConfirm.message'))) {
        onDelete(activity.id, currentDayNumber);
      }
    } else {
      Alert.alert(t('itinerary.activityEditor.deleteConfirm.title'), t('itinerary.activityEditor.deleteConfirm.message'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(activity.id, currentDayNumber) }
      ]);
    }
  };

  const getLinkByType = (type: string) => links.find(l => l.type === type)?.url || '';
  const updateLink = (typeStr: string, label: string, url: string) => {
    setLinks(prev => {
      const existIdx = prev.findIndex(l => l.type === typeStr);
      const newLinks = [...prev];
      if (existIdx > -1) {
        newLinks[existIdx] = { ...newLinks[existIdx]!, url };
      } else {
        newLinks.push({ type: typeStr as any, label, url });
      }
      return newLinks;
    });
  };

  const currentTypeLabel = getActivityTypes().find(t => t.value === type)?.label || type;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background, borderRadius: borderRadius.lg }]}>
          
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="pencil" size={20} color={colors.primary500} style={{ marginRight: 8 }} />
              <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                {t('itinerary.activityEditor.title')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView style={styles.scrollContent} contentContainerStyle={{ padding: spacing.md }}>
            
            <View style={styles.row}>
              {/* Time */}
              <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.time')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md }]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="HH:mm"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Type Selection */}
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm, zIndex: 10 }]}>
                <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.type')}</Text>
                <TouchableOpacity 
                  style={[styles.input, styles.selectBtn, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                  onPress={() => { setShowTypeMenu(!showTypeMenu); setShowDayMenu(false); }}
                >
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>{currentTypeLabel}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showTypeMenu && (
                  <View style={[styles.dropdownMenu, shadows.md, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {getActivityTypes().map(t => (
                      <TouchableOpacity 
                        key={t.value} 
                        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                        onPress={() => { setType(t.value); setShowTypeMenu(false); }}
                      >
                        <Text style={[typography.bodyMedium, { color: colors.text }]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Title */}
            <View style={[styles.inputGroup, { zIndex: 9 }]}>
              <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.title')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t('itinerary.activityEditor.fields.titlePlaceholder')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={[styles.row, { zIndex: 8 }]}>
              {/* Location */}
              <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.location')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t('itinerary.activityEditor.fields.locationPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Day Selection */}
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.day')}</Text>
                <TouchableOpacity 
                  style={[styles.input, styles.selectBtn, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                  onPress={() => { setShowDayMenu(!showDayMenu); setShowTypeMenu(false); }}
                >
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>Day {targetDay}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showDayMenu && (
                  <View style={[styles.dropdownMenu, shadows.md, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {itinerary.days.map(d => (
                      <TouchableOpacity 
                        key={d.dayNumber} 
                        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                        onPress={() => { setTargetDay(d.dayNumber); setShowDayMenu(false); }}
                      >
                        <Text style={[typography.bodyMedium, { color: colors.text }]}>Day {d.dayNumber}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Notes */}
            <View style={[styles.inputGroup, { zIndex: 7 }]}>
              <Text style={[typography.labelMedium, styles.label, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.fields.notes')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md, minHeight: 80 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholder={t('itinerary.activityEditor.fields.notesPlaceholder')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Reference Links Area */}
            <View style={[styles.linksArea, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, padding: spacing.md, zIndex: 6 }]}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '700' }]}>
                {t('itinerary.activityEditor.fields.links')}
              </Text>
              
              <View style={styles.linkRow}>
                <View style={styles.linkIconCol}>
                  <Ionicons name="map-outline" size={16} color={colors.primary500} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>{t('itinerary.activityEditor.links.map')}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.linkInput, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.sm }]}
                  value={getLinkByType('map')}
                  onChangeText={(val) => updateLink('map', 'Map', val)}
                  placeholder={t('itinerary.activityEditor.links.mapPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.linkRow}>
                <View style={styles.linkIconCol}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary500} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>{t('itinerary.activityEditor.links.info')}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.linkInput, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.sm }]}
                  value={getLinkByType('info')}
                  onChangeText={(val) => updateLink('info', 'Info', val)}
                  placeholder={t('itinerary.activityEditor.links.infoPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              <View style={styles.linkRow}>
                <View style={styles.linkIconCol}>
                  <Ionicons name="bus-outline" size={16} color={colors.primary500} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>{t('itinerary.activityEditor.links.booking')}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.linkInput, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.sm }]}
                  value={getLinkByType('booking')}
                  onChangeText={(val) => updateLink('booking', 'Booking', val)}
                  placeholder={t('itinerary.activityEditor.links.bookingPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: colors.divider }]}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[typography.labelLarge, { color: '#EF4444', fontWeight: '700' }]}>{t('itinerary.activityEditor.actions.delete')}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'transparent' }]} onPress={onClose}>
                <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>{t('itinerary.activityEditor.actions.cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary500 }]} onPress={handleSave}>
                <Text style={[typography.labelLarge, { color: colors.neutral0, fontWeight: '700' }]}>{t('itinerary.activityEditor.actions.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
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
  scrollContent: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    overflow: 'scroll',
    zIndex: 999,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  linksArea: {
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkIconCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  linkInput: {
    flex: 1,
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  }
});
