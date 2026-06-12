import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { StepIndicator } from '../common/StepIndicator';
import { Button } from '../common/Button';
import { StepBasics } from './StepBasics';
import { StepPreferences } from './StepPreferences';
import { StepDetails, StepDetailsHandle } from './StepDetails';
import { StepAttractions } from './StepAttractions';
import { t } from '../../i18n';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../utils/alert';
import { useResponsive } from '../../hooks/useResponsive';
import { ApiKeyModal } from '../settings/ApiKeyModal';
import { dbService } from '../../services/db';

export function SurveyForm() {
  const { survey, submitSurvey, resetSurvey, saveDraft, isSubmitting, editingItineraryId, cancelEditingItinerary, setActiveItinerary } = useSurvey();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { user, logout } = useAuth();
  const { isLargeScreen } = useResponsive();
  const [showApiModal, setShowApiModal] = useState(false);
  
  const [step, setStep] = useState(0);
  const stepDetailsRef = useRef<StepDetailsHandle>(null);

  // 在離開「旅遊風格與興趣」步驟（含航班資訊）前，提交尚未加入的航班輸入
  const commitStepPendingInputs = () => {
    if (step === 2) {
      stepDetailsRef.current?.commitPendingInputs();
    }
  };

  const stepLabels = [
    t('survey.sections.basics'),
    t('survey.sections.budget'),
    t('survey.sections.style'),
    t('survey.sections.attractions'),
  ];

  const totalSteps = stepLabels.length;

  // Validation function for each step
  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 0: // Basics validation
        if (!survey?.dates?.startDate || !survey?.dates?.endDate) {
          showAlert(t('common.error'), t('errors.invalidDate'));
          return false;
        }
        if (!survey?.destinations || survey.destinations.length === 0) {
          showAlert(t('common.error'), t('errors.minDestination'));
          return false;
        }
        if (!survey?.departureCity) {
          showAlert(t('common.error'), t('errors.required') + ': ' + t('survey.departure.label'));
          return false;
        }
        if (!survey?.travelers || (survey.travelers.adults ?? 0) <= 0) {
          showAlert(t('common.error'), t('errors.minTravelers'));
          return false;
        }
        return true;

      case 1: // Preferences validation
        if (!survey?.transportModes || survey.transportModes.length === 0) {
          showAlert(t('common.error'), t('errors.required') + ': ' + t('survey.transport.label'));
          return false;
        }
        if (!survey?.bookingPlatforms || survey.bookingPlatforms.length === 0) {
          showAlert(t('common.error'), t('errors.required') + ': ' + t('survey.accommodation.platform.label'));
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    try {
      if (validateStep(step)) {
        commitStepPendingInputs();
        if (step < totalSteps - 1) {
          setStep(step + 1);
        }
      }
    } catch (error: any) {
      console.error('Error in handleNext:', error);
      showAlert(t('common.error'), error?.message || String(error));
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.replace("/");
    }
  };

  const handleSubmit = async () => {
    try {
      if (!validateStep(step)) return;
      await submitSurvey();
      // Redirect to itinerary generation loader screen or layout
      router.replace('/itinerary');
    } catch (error: any) {
      if (error?.message === 'MISSING_API_KEY' || error?.message === 'INVALID_API_KEY') {
        setShowApiModal(true);
      } else {
        console.error('Error in handleSubmit:', error);
        showAlert(t('common.error'), error?.message || t('errors.serverError'));
      }
    }
  };

  const handleReset = () => {
    showConfirm(
      t('survey.actions.confirmDiscardTitle'),
      t('survey.actions.confirmDiscardMessage'),
      async () => {
        await resetSurvey();
        setStep(0);
      }
    );
  };

  const handleSaveDraft = async () => {
    await saveDraft();
    showAlert(t('survey.actions.saveSuccessTitle'), t('survey.actions.saveSuccessMessage'));
  };

  const handleCancelEdit = async () => {
    if (Platform.OS === 'web') {
      const confirmDiscard = window.confirm(t('survey.actions.cancelEditWebConfirm'));
      if (confirmDiscard) {
        try {
          if (editingItineraryId) {
             const oldItinerary = await dbService.getItinerary(editingItineraryId);
             if (oldItinerary) {
               setActiveItinerary(oldItinerary);
               router.replace('/itinerary');
             } else {
               router.replace('/');
             }
             cancelEditingItinerary();
          }
        } catch(e) {
           router.replace('/');
           cancelEditingItinerary();
        }
      } else {
        cancelEditingItinerary();
        showAlert(t('survey.actions.convertedTitle'), t('survey.actions.convertedMessage'));
      }
    } else {
      Alert.alert(
        t('survey.actions.cancelEditTitle'),
        t('survey.actions.cancelEditMessage'),
        [
          { 
            text: t('survey.actions.discardAndReturn'), 
            style: 'destructive',
            onPress: async () => {
              try {
                if (editingItineraryId) {
                   const oldItinerary = await dbService.getItinerary(editingItineraryId);
                   if (oldItinerary) {
                     setActiveItinerary(oldItinerary);
                     router.replace('/itinerary');
                   } else {
                     router.replace('/');
                   }
                   cancelEditingItinerary();
                }
              } catch(e) {
                 router.replace('/');
                 cancelEditingItinerary();
              }
            } 
          },
          { 
            text: t('survey.actions.saveAsNew'), 
            onPress: () => {
               cancelEditingItinerary();
               showAlert(t('survey.actions.convertedTitle'), t('survey.actions.convertedMessage'));
            } 
          },
          { text: t('survey.actions.continueEditing'), style: 'cancel' }
        ]
      );
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return <StepBasics />;
      case 1:
        return <StepPreferences />;
      case 2:
        return <StepDetails ref={stepDetailsRef} />;
      case 3:
        return <StepAttractions />;
      default:
        return null;
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
        <Text style={[styles.loadingText, { color: colors.text, marginTop: spacing.md }]}>
          {t('survey.generating')}
        </Text>
      </SafeAreaView>
    );
  }

  // Render Inner Form (Header, Content Scroll, Footer)
  const renderInnerForm = () => (
    <View style={styles.formContainer}>
      {/* Step Indicator Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, borderBottomWidth: 1, paddingVertical: spacing.md }]}>
        <StepIndicator currentStep={step} totalSteps={totalSteps} stepLabels={stepLabels} />
      </View>

      {/* Step Form Scrollable View */}
      <View style={styles.formContent}>
        {renderStepContent()}
      </View>

      {/* Navigation Footer */}
      <View style={[styles.footer, { borderTopColor: colors.divider, borderTopWidth: 1, padding: spacing.md }]}>
        {step > 0 ? (
          <Button
            title={t('common.back')}
            variant="outlined"
            onPress={handleBack}
            style={{ width: '45%' }}
          />
        ) : (
          <View style={{ width: '45%' }} />
        )}

        {step < totalSteps - 1 ? (
          <Button
            title={t('common.next')}
            variant="primary"
            onPress={handleNext}
            style={{ width: '45%' }}
          />
        ) : (
          <Button
            title={t('survey.generateTrip')}
            variant="primary"
            onPress={handleSubmit}
            style={{ width: '45%' }}
          />
        )}
      </View>
    </View>
  );

  // Render Live Dream Trip Summary Panel for large screens
  const renderSummaryPanel = () => {
    const destNames = (survey?.destinations || []).map(d => d.name).join(' ➜ ');
    const totalDays = survey?.dates?.startDate && survey?.dates?.endDate
      ? Math.max(1, Math.ceil((new Date(survey.dates.endDate).getTime() - new Date(survey.dates.startDate).getTime()) / 86400000) + 1)
      : 0;

    return (
      <ScrollView contentContainerStyle={styles.summaryPanelContent} style={[styles.summaryPanel, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Text style={[typography.headlineMedium, { color: colors.text, fontWeight: '800', marginBottom: spacing.md }]}>
          {t('survey.summary.title')}
        </Text>
        
        {/* Progress Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primary50, borderColor: colors.primary200, borderRadius: borderRadius.md }]}>
          <Text style={[typography.labelMedium, { color: colors.primary700, fontWeight: '700' }]}>
            {t('survey.summary.progress')}
          </Text>
          <Text style={[typography.headlineLarge, { color: colors.primary500, fontWeight: '900', marginVertical: spacing.xs }]}>
            {Math.round(((step + 1) / totalSteps) * 100)}%
          </Text>
          <View style={[styles.progressBarBg, { backgroundColor: colors.neutral300 }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary500, width: `${((step + 1) / totalSteps) * 100}%` }]} />
          </View>
        </View>

        {/* Detailed Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statRow}>
            <Ionicons name="location" size={20} color={colors.primary500} style={styles.statIcon} />
            <View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{t('survey.destination.label')}</Text>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                {destNames || t('survey.summary.notSelectedHint')}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="calendar" size={20} color={colors.primary500} style={styles.statIcon} />
            <View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{t('survey.dates.label')}</Text>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]}>
                {survey?.dates?.startDate ? `${survey.dates.startDate} ${t('survey.summary.dateTo')} ${survey.dates.endDate} (${totalDays} ${t('survey.dates.days')})` : t('survey.summary.notSelected')}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="airplane-outline" size={20} color={colors.primary500} style={styles.statIcon} />
            <View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{t('survey.departure.label')}</Text>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]}>
                {survey?.departureCity || t('survey.summary.notSet')}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="people" size={20} color={colors.primary500} style={styles.statIcon} />
            <View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{t('survey.travelers.label')}</Text>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]}>
                {`${survey?.travelers?.adults || 0} ${t('survey.summary.adults')}, ${(survey?.travelers?.children || []).length} ${t('survey.summary.children')} / ${survey?.tripType ? t('survey.tripType.' + survey.tripType) : t('survey.summary.notSelected')}`}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary500} style={styles.statIcon} />
            <View>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{t('survey.budget.label')}</Text>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '600' }]}>
                {survey?.budgetLevel ? t('survey.budget.' + survey.budgetLevel) : t('survey.summary.notSet')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Action Status Bar (Visible to all users for local save) */}
      <View style={[styles.authStatusBar, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border, borderBottomWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }]}>
        <View style={styles.authInfo}>
          <Ionicons
            name={!user || user.isAnonymous ? "person-circle-outline" : "checkmark-circle-outline"}
            size={18}
            color={!user || user.isAnonymous ? colors.warning500 : colors.success500}
          />
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
            {!user || user.isAnonymous ? t('survey.summary.guestMode') : `${t('survey.summary.loggedInAs')}${user.email}`}
          </Text>
        </View>
        <View style={styles.authActions}>
          {editingItineraryId && (
            <TouchableOpacity onPress={handleCancelEdit} style={[styles.logoutBtn, { marginRight: spacing.sm }]}>
              <Text style={[typography.labelSmall, { color: colors.warning600, fontWeight: '700' }]}>
                {t('survey.actions.cancelEditTitle')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSaveDraft} style={[styles.logoutBtn, { marginRight: spacing.sm }]}>
            <Text style={[typography.labelSmall, { color: colors.success500, fontWeight: '600' }]}>
              {t('survey.actions.saveDraft')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={[styles.logoutBtn, { marginRight: spacing.sm }]}>
            <Text style={[typography.labelSmall, { color: colors.error500, fontWeight: '600' }]}>
              {t('survey.actions.restart')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={[typography.labelSmall, { color: colors.primary500, fontWeight: '600' }]}>
              {!user || user.isAnonymous ? t('survey.actions.loginOrRegister') : t('auth.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ApiKeyModal 
        visible={showApiModal} 
        onClose={() => setShowApiModal(false)} 
        onSuccess={() => {
          setShowApiModal(false);
          handleSubmit();
        }} 
      />

      {/* Main Responsive Layout Body */}
      {isLargeScreen ? (
        <View style={styles.desktopLayout}>
          {renderSummaryPanel()}
          <View style={[styles.desktopFormWrapper, { backgroundColor: colors.background }]}>
            {renderInnerForm()}
          </View>
        </View>
      ) : (
        renderInnerForm()
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  authStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 36,
    zIndex: 10,
  },
  authInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // Responsive Desktop Layout Styles
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  summaryPanel: {
    width: 320,
    borderRightWidth: 1,
  },
  summaryPanelContent: {
    padding: 24,
  },
  summaryCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsSection: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  statIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  desktopFormWrapper: {
    flex: 1,
  },
});
