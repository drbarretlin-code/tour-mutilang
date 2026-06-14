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
import { verifyOpenTripMapKey } from '../src/services/poi';
import { createLogger } from '../src/services/logger';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await initLocale();
        // P4：啟動時自檢 OpenTripMap 金鑰是否真的會生效，於 console 明確記錄，
        // 讓「.env 有值卻因未重新建置而 bundle 內無金鑰」這類問題在啟動即可被發現。
        verifyOpenTripMapKey()
          .then(diag => {
            const log = createLogger('startup');
            const msg = `OpenTripMap 金鑰自檢：${diag.status}（來源：${diag.source}）— ${diag.message}`;
            if (diag.status === 'ok') log.info(msg);
            else log.warn(`${msg} 提示：${diag.hint}`);
          })
          .catch(() => { /* 自檢失敗不影響啟動 */ });
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
