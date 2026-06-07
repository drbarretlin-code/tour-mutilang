import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export function StepIndicator({
  currentStep,
  totalSteps,
  stepLabels
}: StepIndicatorProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <View
                style={[
                  styles.stepCircle,
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isCompleted
                      ? colors.success500
                      : isActive
                      ? colors.primary500
                      : colors.backgroundTertiary,
                    borderColor: isActive ? colors.primary100 : 'transparent',
                    borderWidth: isActive ? 4 : 0,
                  },
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={18} color={colors.neutral0} />
                ) : (
                  <Text
                    style={[
                      typography.labelLarge,
                      {
                        color: isActive
                          ? colors.neutral0
                          : colors.textTertiary,
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Connector Line (except for the last step) */}
              {index < totalSteps - 1 && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        index < currentStep
                          ? colors.success500
                          : colors.divider,
                      marginHorizontal: spacing.xs,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Label under current step */}
      <View style={[styles.labelContainer, { marginTop: spacing.sm }]}>
        <Text
          style={[
            typography.titleMedium,
            { color: colors.text, textAlign: 'center', fontWeight: '600' }
          ]}
        >
          {stepLabels[currentStep]}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textTertiary, textAlign: 'center', marginTop: 2 }
          ]}
        >
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
  },
  stepCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  labelContainer: {
    alignItems: 'center',
  },
});
