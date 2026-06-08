import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SurveyForm } from '../../src/components/survey/SurveyForm';
import { AuthForm } from '../../src/components/auth/AuthForm';

export default function SurveyScreen() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <SurveyForm />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
