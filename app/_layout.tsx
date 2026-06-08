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

  // CRITICAL: The DOM tree structure must be 100% stable from the very
  // first render. No conditional returns, no ternaries that swap component
  // types. React 19 + react-native-web 0.21 crashes with insertBefore
  // when the tree shape changes after mount.
  //
  // <Stack> is always rendered. The screen content (app/index.tsx) handles
  // its own loading/auth states internally with display:none, never by
  // returning different component trees.
  return (
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
  );
}
