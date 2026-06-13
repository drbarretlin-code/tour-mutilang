import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeInput } from '../../utils/timeInput';
import {
  InterestTag,
  TravelPace,
  DietaryRestriction,
  AccommodationType,
  MorningPreference,
  AccommodationLocation,
  AccommodationAmenity,
  AccessibilityNeed,
  InsuranceStatus
} from '../../types/survey';

export interface StepDetailsHandle {
  /** 提交所有尚未加入清單、但已填寫於輸入框中的航班，避免使用者忘記按「新增」而遺失資料 */
  commitPendingInputs: () => void;
}

export const StepDetails = forwardRef<StepDetailsHandle>((_props, ref) => {
  const { survey, updateSurvey, addFlight, removeFlight } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Collapsible accordion states
  const [activeAccordion, setActiveAccordion] = useState<string | null>('flights');

  // Flight temp input state
  const [fNum, setFNum] = useState('');
  const [fDep, setFDep] = useState('');
  const [fArr, setFArr] = useState('');
  const [fReturn, setFReturn] = useState(false);

  // Return flight temp input state
  const [retFNum, setRetFNum] = useState('');
  const [retFDep, setRetFDep] = useState('');
  const [retFArr, setRetFArr] = useState('');

  // Interest tags
  const interestTags: { value: InterestTag; labelKey: string }[] = [
    { value: 'culture', labelKey: 'survey.interests.culture' },
    { value: 'nature', labelKey: 'survey.interests.nature' },
    { value: 'food', labelKey: 'survey.interests.food' },
    { value: 'shopping', labelKey: 'survey.interests.shopping' },
    { value: 'nightlife', labelKey: 'survey.interests.nightlife' },
    { value: 'water', labelKey: 'survey.interests.water' },
    { value: 'family', labelKey: 'survey.interests.family' },
    { value: 'photo', labelKey: 'survey.interests.photo' },
    { value: 'temple', labelKey: 'survey.interests.temple' },
    { value: 'spa', labelKey: 'survey.interests.spa' },
    { value: 'themepark', labelKey: 'survey.interests.themepark' },
    { value: 'art', labelKey: 'survey.interests.art' },
    { value: 'market', labelKey: 'survey.interests.market' },
  ];

  // Dietary restrictions
  const dietaryOptions: { value: DietaryRestriction; labelKey: string }[] = [
    { value: 'none', labelKey: 'survey.dietary.noRestriction' },
    { value: 'vegetarian', labelKey: 'survey.dietary.vegetarian' },
    { value: 'vegan', labelKey: 'survey.dietary.vegan' },
    { value: 'halal', labelKey: 'survey.dietary.halal' },
    { value: 'peanut_allergy', labelKey: 'survey.dietary.peanut' },
    { value: 'seafood_allergy', labelKey: 'survey.dietary.seafood' },
  ];

  // Accommodation types
  const accTypes: { value: AccommodationType; labelKey: string }[] = [
    { value: 'hotel', labelKey: 'survey.accommodation.type.hotel' },
    { value: 'homestay', labelKey: 'survey.accommodation.type.homestay' },
    { value: 'hostel', labelKey: 'survey.accommodation.type.hostel' },
    { value: 'resort', labelKey: 'survey.accommodation.type.resort' },
    { value: 'apartment', labelKey: 'survey.accommodation.type.apartment' },
  ];

  // Amenities
  const amenityOptions: { value: AccommodationAmenity; labelKey: string }[] = [
    { value: 'pool', labelKey: 'survey.accommodation.amenities.pool' },
    { value: 'gym', labelKey: 'survey.accommodation.amenities.gym' },
    { value: 'breakfast', labelKey: 'survey.accommodation.amenities.breakfast' },
    { value: 'kitchen', labelKey: 'survey.accommodation.amenities.kitchen' },
    { value: 'laundry', labelKey: 'survey.accommodation.amenities.laundry' },
    { value: 'parking', labelKey: 'survey.accommodation.amenities.parking' },
  ];

  // Accessibility
  const accessOptions: { value: AccessibilityNeed; labelKey: string }[] = [
    { value: 'wheelchair', labelKey: 'survey.accessibility.wheelchair' },
    { value: 'stroller', labelKey: 'survey.accessibility.stroller' },
    { value: 'mobility', labelKey: 'survey.accessibility.mobility' },
  ];

  const toggleAccordion = (section: string) => {
    setActiveAccordion(activeAccordion === section ? null : section);
  };

  const handleAddFlight = () => {
    const hasOutgoing = fNum || fDep || fArr;
    const hasReturn = retFNum || retFDep || retFArr;
    if (!hasOutgoing && !hasReturn) return;

    // 如果有填寫去程航班（航班編號、起飛或抵達時間其中之一）
    if (hasOutgoing) {
      addFlight(fNum, fDep, fArr, false);
    }

    // 如果有填寫回程航班（航班編號、起飛或抵達時間其中之一）
    if (hasReturn) {
      addFlight(retFNum, retFDep, retFArr, true);
    }

    // 清空去程欄位
    setFNum('');
    setFDep('');
    setFArr('');
    
    // 清空回程欄位
    setRetFNum('');
    setRetFDep('');
    setRetFArr('');
    setFReturn(false);
  };

  // 對外暴露：在離開此步驟前，自動提交尚未加入的航班輸入（避免使用者忘記按「新增航班資訊」）
  useImperativeHandle(ref, () => ({
    commitPendingInputs: () => {
      if (fNum || fDep || fArr || retFNum || retFDep || retFArr) {
        handleAddFlight();
      }
    },
  }));

  const toggleMultiselect = <T extends string>(field: string, value: T) => {
    const list = (survey as any)[field] as string[];
    const isSelected = list.includes(value);
    const updated = isSelected ? list.filter(item => item !== value) : [...list, value];
    updateSurvey({ [field]: updated });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={styles.container}>
      
      {/* 1. FLIGHT INFORMATION ACCORDION */}
      <Card variant="elevated" style={{ marginBottom: spacing.md, padding: 0 }}>
        <TouchableOpacity
          onPress={() => toggleAccordion('flights')}
          style={[styles.accordionHeader, { borderBottomColor: colors.divider, borderBottomWidth: activeAccordion === 'flights' ? 1 : 0, padding: spacing.md }]}
        >
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
            {t('survey.transport.flightInfo.label')} ({(survey?.flights || []).length})
          </Text>
          <Ionicons name={activeAccordion === 'flights' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
        </TouchableOpacity>

        {activeAccordion === 'flights' && (
          <View style={{ padding: spacing.md }}>
            {/* Added Flights List */}
            {(survey?.flights || []).map((f) => (
              <View key={f.id} style={[styles.flightBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <View>
                  <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]}>
                    {f.flightNumber} {f.isReturn ? '(Return)' : '(Outgoing)'}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Dep: {f.departureTime || '-'} | Arr: {f.arrivalTime || '-'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeFlight(f.id)}>
                  <Ionicons name="trash" size={18} color={colors.error500} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add New Flight Form */}
            <View style={[styles.addFlightForm, { marginTop: spacing.md, borderTopColor: colors.divider, borderTopWidth: 1, paddingTop: spacing.md }]}>
              {/* Outgoing Flight */}
              <Text style={[typography.titleSmall, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
                Outgoing Flight (去程航班)
              </Text>
              <Input
                placeholder="Flight Number (e.g. CI915)"
                value={fNum}
                onChangeText={setFNum}
                containerStyle={{ marginBottom: spacing.sm }}
              />
              <View style={[styles.flexRowBetween, { marginBottom: spacing.sm }]}>
                <Input
                  placeholder="Departure (e.g. 10:00)"
                  value={fDep}
                  onChangeText={(text) => setFDep(formatTimeInput(text))}
                  keyboardType="numeric"
                  maxLength={5}
                  containerStyle={{ width: '48%' }}
                />
                <Input
                  placeholder="Arrival (e.g. 14:30)"
                  value={fArr}
                  onChangeText={(text) => setFArr(formatTimeInput(text))}
                  keyboardType="numeric"
                  maxLength={5}
                  containerStyle={{ width: '48%' }}
                />
              </View>
              
              {/* Return Flight Switch */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setFReturn(!fReturn)}
                style={[styles.switchRow, { marginVertical: spacing.sm }]}
              >
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>Return Flight? (加填返程機票)</Text>
                <Switch value={fReturn} onValueChange={setFReturn} trackColor={{ true: colors.primary500 }} />
              </TouchableOpacity>

              {/* Conditional Return Flight Inputs */}
              {fReturn && (
                <View style={{ marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginBottom: spacing.sm }}>
                  <Text style={[typography.titleSmall, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
                    Return Flight (返程航班)
                  </Text>
                  <Input
                    placeholder="Flight Number (e.g. CI916)"
                    value={retFNum}
                    onChangeText={setRetFNum}
                    containerStyle={{ marginBottom: spacing.sm }}
                  />
                  <View style={styles.flexRowBetween}>
                    <Input
                      placeholder="Departure (e.g. 16:00)"
                      value={retFDep}
                      onChangeText={(text) => setRetFDep(formatTimeInput(text))}
                      keyboardType="numeric"
                      maxLength={5}
                      containerStyle={{ width: '48%' }}
                    />
                    <Input
                      placeholder="Arrival (e.g. 20:00)"
                      value={retFArr}
                      onChangeText={(text) => setRetFArr(formatTimeInput(text))}
                      keyboardType="numeric"
                      maxLength={5}
                      containerStyle={{ width: '48%' }}
                    />
                  </View>
                </View>
              )}

              <Button
                title={t('survey.transport.flightInfo.addFlight')}
                variant="outlined"
                onPress={handleAddFlight}
                disabled={!fNum && !fDep && !fArr && (!fReturn || (!retFNum && !retFDep && !retFArr))}
              />
            </View>
          </View>
        )}
      </Card>

      {/* 2. INTERESTS ACCORDION */}
      <Card variant="elevated" style={{ marginBottom: spacing.md, padding: 0 }}>
        <TouchableOpacity
          onPress={() => toggleAccordion('interests')}
          style={[styles.accordionHeader, { borderBottomColor: colors.divider, borderBottomWidth: activeAccordion === 'interests' ? 1 : 0, padding: spacing.md }]}
        >
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
            {t('survey.interests.label')} ({(survey?.interests || []).length})
          </Text>
          <Ionicons name={activeAccordion === 'interests' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
        </TouchableOpacity>

        {activeAccordion === 'interests' && (
          <View style={[styles.chipsContainer, { padding: spacing.md }]}>
            {interestTags.map((tag) => {
              const selected = (survey?.interests || []).includes(tag.value);
              return (
                <TouchableOpacity
                  key={tag.value}
                  onPress={() => toggleMultiselect('interests', tag.value)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                      borderColor: selected ? 'transparent' : colors.border,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      margin: 4
                    }
                  ]}
                >
                  <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                    {t(tag.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>

      {/* 3. DIETARY ACCORDION */}
      <Card variant="elevated" style={{ marginBottom: spacing.md, padding: 0 }}>
        <TouchableOpacity
          onPress={() => toggleAccordion('dietary')}
          style={[styles.accordionHeader, { borderBottomColor: colors.divider, borderBottomWidth: activeAccordion === 'dietary' ? 1 : 0, padding: spacing.md }]}
        >
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
            {t('survey.dietary.label')} ({(survey?.dietaryRestrictions || []).length})
          </Text>
          <Ionicons name={activeAccordion === 'dietary' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
        </TouchableOpacity>

        {activeAccordion === 'dietary' && (
          <View style={[styles.chipsContainer, { padding: spacing.md }]}>
            {dietaryOptions.map((opt) => {
              const selected = (survey?.dietaryRestrictions || []).includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    if (opt.value === 'none') {
                      updateSurvey({ dietaryRestrictions: ['none'] });
                    } else {
                      const list = survey.dietaryRestrictions.filter(x => x !== 'none');
                      const hasVal = list.includes(opt.value);
                      const updated = hasVal ? list.filter(x => x !== opt.value) : [...list, opt.value];
                      updateSurvey({ dietaryRestrictions: updated.length === 0 ? ['none'] : updated });
                    }
                  }}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                      borderColor: selected ? 'transparent' : colors.border,
                      borderRadius: borderRadius.full,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      margin: 4
                    }
                  ]}
                >
                  <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>

      {/* 4. ACCOMMODATION TYPE ACCORDION */}
      <Card variant="elevated" style={{ marginBottom: spacing.md, padding: 0 }}>
        <TouchableOpacity
          onPress={() => toggleAccordion('accommodation')}
          style={[styles.accordionHeader, { borderBottomColor: colors.divider, borderBottomWidth: activeAccordion === 'accommodation' ? 1 : 0, padding: spacing.md }]}
        >
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
            {t('survey.accommodation.type.label')} ({(survey?.accommodationType || []).length})
          </Text>
          <Ionicons name={activeAccordion === 'accommodation' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
        </TouchableOpacity>

        {activeAccordion === 'accommodation' && (
          <View style={{ padding: spacing.md }}>
            <View style={styles.chipsContainer}>
              {accTypes.map((type) => {
                const selected = (survey?.accommodationType || []).includes(type.value);
                return (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => toggleMultiselect('accommodationType', type.value)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: selected ? 'transparent' : colors.border,
                        borderRadius: borderRadius.full,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        margin: 4
                      }
                    ]}
                  >
                    <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                      {t(type.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Accommodation Amenities */}
            <Text style={[typography.titleSmall, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '600' }]}>
              {t('survey.accommodation.amenities.label')}
            </Text>
            <View style={styles.chipsContainer}>
              {amenityOptions.map((opt) => {
                const selected = (survey?.accommodationAmenities || []).includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleMultiselect('accommodationAmenities', opt.value)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: selected ? 'transparent' : colors.border,
                        borderRadius: borderRadius.full,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        margin: 4
                      }
                    ]}
                  >
                    <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </Card>

      {/* 5. ACCESSIBILITY & OTHERS ACCORDION */}
      <Card variant="elevated" style={{ marginBottom: spacing.md, padding: 0 }}>
        <TouchableOpacity
          onPress={() => toggleAccordion('accessibility')}
          style={[styles.accordionHeader, { borderBottomColor: colors.divider, borderBottomWidth: activeAccordion === 'accessibility' ? 1 : 0, padding: spacing.md }]}
        >
          <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
            {t('survey.sections.special')}
          </Text>
          <Ionicons name={activeAccordion === 'accessibility' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
        </TouchableOpacity>

        {activeAccordion === 'accessibility' && (
          <View style={{ padding: spacing.md }}>
            {/* Accessibility Choices */}
            <Text style={[typography.titleSmall, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
              {t('survey.accessibility.label')}
            </Text>
            <View style={[styles.chipsContainer, { marginBottom: spacing.md }]}>
              {accessOptions.map((opt) => {
                const selected = (survey?.accessibilityNeeds || []).includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleMultiselect('accessibilityNeeds', opt.value)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: selected ? 'transparent' : colors.border,
                        borderRadius: borderRadius.full,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        margin: 4
                      }
                    ]}
                  >
                    <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Drivers license */}
            <View style={[styles.switchRow, { marginVertical: spacing.sm }]}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>
                {t('survey.transport.drivingLicense')}
              </Text>
              <Switch
                value={survey.hasInternationalLicense}
                onValueChange={(val) => updateSurvey({ hasInternationalLicense: val })}
                trackColor={{ true: colors.primary500 }}
              />
            </View>

            {/* Passport nationality */}
            <Input
              label={t('survey.visa.nationality')}
              placeholder="e.g. Taiwan"
              value={survey.passportNationality || ''}
              onChangeText={(text) => updateSurvey({ passportNationality: text })}
              containerStyle={{ marginVertical: spacing.sm }}
            />

            {/* Insurance Status */}
            <Text style={[typography.titleSmall, { color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs, fontWeight: '600' }]}>
              {t('survey.insurance.label')}
            </Text>
            <View style={styles.chipsContainer}>
              {[
                { value: 'have', labelKey: 'survey.insurance.have' },
                { value: 'need', labelKey: 'survey.insurance.need' },
                { value: 'skip', labelKey: 'survey.insurance.skip' }
              ].map((opt) => {
                const selected = survey.insuranceStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => updateSurvey({ insuranceStatus: opt.value as InsuranceStatus })}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: selected ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: selected ? 'transparent' : colors.border,
                        borderRadius: borderRadius.full,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        margin: 4
                      }
                    ]}
                  >
                    <Text style={[typography.labelMedium, { color: selected ? colors.neutral0 : colors.text }]}>
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </Card>

      {/* 6. GENERAL NOTES */}
      <Text style={[typography.titleMedium, { color: colors.text, marginBottom: spacing.xs, fontWeight: '600' }]}>
        {t('survey.notes.label')}
      </Text>
      <Input
        placeholder={t('survey.notes.placeholder')}
        multiline
        numberOfLines={4}
        value={survey.notes}
        onChangeText={(text) => updateSurvey({ notes: text })}
        inputStyle={{ height: 100, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />

    </ScrollView>
  );
});

StepDetails.displayName = 'StepDetails';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  addFlightForm: {
    width: '100%',
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    borderWidth: 1,
  },
});
