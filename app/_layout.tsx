import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize localization
        await initLocale();
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // CRITICAL: Never return null. React 19 + react-native-web crashes with
  // insertBefore when reconciling null -> complex tree in Expo Router.
  // Instead, always render the full tree and overlay a loading screen.
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ThemeProvider>
            <PACProvider>
              <SurveyProvider>
                {appIsReady ? (
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                  </Stack>
                ) : (
                  <View style={layoutStyles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3366FF" />
                  </View>
                )}
              </SurveyProvider>
            </PACProvider>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const layoutStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
