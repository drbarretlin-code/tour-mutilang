import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n, { LocaleCode, initLocale, setLocale as setI18nLocale } from '../i18n';

interface LanguageContextType {
  locale: LocaleCode;
  changeLanguage: (lang: LocaleCode) => Promise<void>;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<LocaleCode>('zh-TW'); // fallback initial
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeLanguage = async () => {
      await initLocale();
      setLocale(i18n.locale as LocaleCode);
      setIsReady(true);
    };
    initializeLanguage();
  }, []);

  const changeLanguage = async (newLocale: LocaleCode) => {
    await setI18nLocale(newLocale);
    setLocale(newLocale); // Triggers re-render across the app
  };

  // CRITICAL: Never return null here. On React 19 + react-native-web,
  // returning null then switching to children causes insertBefore DOM crash.
  // The locale defaults to 'zh-TW' until async init completes, which is fine.

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
