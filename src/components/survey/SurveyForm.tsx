import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useSurvey } from '../../context/SurveyContext';
import { useTheme } from '../../context/ThemeContext';
import { StepIndicator } from '../common/StepIndicator';
import { Button } from '../common/Button';
import { StepBasics } from './StepBasics';
import { StepPreferences } from './StepPreferences';
import { StepDetails } from './StepDetails';
import { StepAttractions } from './StepAttractions';
import { t } from '../../i18n';
import { router } from 'expo-router';

export function SurveyForm() {
  const { survey, submitSurvey, isSubmitting } = useSurvey();
  const { colors, spacing } = useTheme();
  
  const [step, setStep] = useState(0);

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
        if (!survey.dates.startDate || !survey.dates.endDate) {
          Alert.alert(t('common.error'), t('errors.invalidDate'));
          return false;
        }
        if (survey.destinations.length === 0) {
          Alert.alert(t('common.error'), t('errors.minDestination'));
          return false;
        }
        if (!survey.departureCity) {
          Alert.alert(t('common.error'), t('errors.required') + ': ' + t('survey.departure.label'));
          return false;
        }
        if (survey.travelers.adults <= 0) {
          Alert.alert(t('common.error'), t('errors.minTravelers'));
          return false;
        }
        return true;

      case 1: // Preferences validation
        if (survey.transportModes.length === 0) {
          Alert.alert(t('common.error'), t('errors.required') + ': ' + t('survey.transport.label'));
          return false;
        }
        if (survey.bookingPlatforms.length === 0) {
          Alert.alert(t('common.error'), t('errors.required') + ': ' + t('survey.accommodation.platform.label'));
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < totalSteps - 1) {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    try {
      await submitSurvey();
      // Redirect to itinerary generation loader screen or layout
      router.replace('/itinerary');
    } catch (e) {
      Alert.alert(t('common.error'), t('errors.serverError'));
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return <StepBasics />;
      case 1:
        return <StepPreferences />;
      case 2:
        return <StepDetails />;
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
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
});
