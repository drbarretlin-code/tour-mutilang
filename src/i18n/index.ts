import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import ms from './locales/ms.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const i18n = new I18n({
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  'en': en,
  'ja': ja,
  'ko': ko,
  'th': th,
  'vi': vi,
  'ms': ms,
  'es': es,
  'pt': pt,
});

i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export const SUPPORTED_LOCALES = [
  { code: 'zh-TW', label: '繁體中文', nativeLabel: '繁體中文' },
  { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ja', label: '日本語', nativeLabel: '日本語' },
  { code: 'ko', label: '한국어', nativeLabel: '한국어' },
  { code: 'th', label: 'ไทย', nativeLabel: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt', nativeLabel: 'Tiếng Việt' },
  { code: 'ms', label: 'Bahasa Melayu', nativeLabel: 'Bahasa Melayu' },
  { code: 'es', label: 'Español', nativeLabel: 'Español' },
  { code: 'pt', label: 'Português', nativeLabel: 'Português' },
] as const;

export type LocaleCode = typeof SUPPORTED_LOCALES[number]['code'];

const LOCALE_STORAGE_KEY = '@app_locale';

export async function initLocale(): Promise<void> {
  try {
    const savedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale && SUPPORTED_LOCALES.some(l => l.code === savedLocale)) {
      i18n.locale = savedLocale;
    } else {
      const deviceLocales = Localization.getLocales();
      const deviceLang = deviceLocales[0]?.languageTag || 'en';
      const matched = SUPPORTED_LOCALES.find(l => deviceLang.startsWith(l.code)) ||
                      SUPPORTED_LOCALES.find(l => deviceLang.startsWith(l.code.split('-')[0]));
      i18n.locale = matched?.code || 'en';
    }
  } catch {
    i18n.locale = 'en';
  }
}

export async function setLocale(code: LocaleCode): Promise<void> {
  i18n.locale = code;
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, code);
}

export function t(scope: string, options?: Record<string, unknown>): string {
  return i18n.t(scope, options);
}

export default i18n;
