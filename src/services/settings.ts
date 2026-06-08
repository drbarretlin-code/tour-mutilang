import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_KEY_STORE_KEY = 'user_gemini_api_key';

let sessionApiKey: string | null = null;

export const settingsService = {
  /**
   * Saves the Gemini API key.
   * @param apiKey The API Key to save.
   * @param persist If true, saves to secure local storage. If false, saves only in memory for this session.
   */
  async saveApiKey(apiKey: string, persist: boolean = true): Promise<void> {
    try {
      sessionApiKey = apiKey;
      
      if (persist) {
        if (Platform.OS === 'web') {
          localStorage.setItem(API_KEY_STORE_KEY, apiKey);
        } else {
          await SecureStore.setItemAsync(API_KEY_STORE_KEY, apiKey);
        }
      } else {
        // Ensure any previously persisted key is cleared if user chooses session only
        if (Platform.OS === 'web') {
          localStorage.removeItem(API_KEY_STORE_KEY);
        } else {
          await SecureStore.deleteItemAsync(API_KEY_STORE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to save API Key:', e);
      throw new Error('無法儲存 API Key，請檢查您的系統權限。');
    }
  },

  /**
   * Retrieves the stored Gemini API key. Checks session memory first, then persistent storage.
   */
  async getApiKey(): Promise<string | null> {
    if (sessionApiKey) {
      console.log('[settingsService.getApiKey] Using session API key (first 8):', sessionApiKey.substring(0, 8) + '...');
      return sessionApiKey;
    }

    try {
      let storedKey: string | null = null;
      if (Platform.OS === 'web') {
        storedKey = localStorage.getItem(API_KEY_STORE_KEY);
        console.log('[settingsService.getApiKey] Web localStorage:', storedKey ? `found (first 8: ${storedKey.substring(0, 8)}...)` : 'NOT FOUND');
      } else {
        storedKey = await SecureStore.getItemAsync(API_KEY_STORE_KEY);
        console.log('[settingsService.getApiKey] Native SecureStore:', storedKey ? 'found' : 'NOT FOUND');
      }
      // Hydrate session cache for subsequent reads
      if (storedKey) {
        sessionApiKey = storedKey;
      }
      return storedKey;
    } catch (e) {
      console.warn('[settingsService.getApiKey] Failed to retrieve API Key:', e);
      return null;
    }
  },

  /**
   * Removes the stored Gemini API key from both memory and persistent storage.
   */
  async clearApiKey(): Promise<void> {
    sessionApiKey = null;
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(API_KEY_STORE_KEY);
      } else {
        await SecureStore.deleteItemAsync(API_KEY_STORE_KEY);
      }
    } catch (e) {
      console.error('Failed to clear API Key:', e);
    }
  }
};
