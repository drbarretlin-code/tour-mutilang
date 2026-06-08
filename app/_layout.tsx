import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SurveyProvider } from '../src/context/SurveyContext';
import { AuthProvider } from '../src/context/AuthContext';
import { initLocale } from '../src/i18n';
import { PACProvider } from '../src/context/PACContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { SafeErrorBoundary } from '../src/components/common/SafeErrorBoundary';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await initLocale();
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  // CRITICAL: Wrap the entire application tree inside SafeErrorBoundary.
  // This catches any runtime DOM reconciliation errors (such as insertBefore crashes)
  // and attempts to recover via a clean client-side re-mount.
  return (
    <SafeErrorBoundary>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemeProvider>
              <PACProvider>
                <SurveyProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                  </Stack>
                </SurveyProvider>
              </PACProvider>
            </ThemeProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </SafeErrorBoundary>
  );
}
