import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_KEY_STORE_KEY = 'user_gemini_api_key';

export const settingsService = {
  /**
   * Saves the Gemini API key securely on mobile, or falls back to AsyncStorage on web.
   */
  async saveApiKey(apiKey: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(API_KEY_STORE_KEY, apiKey);
      } else {
        await SecureStore.setItemAsync(API_KEY_STORE_KEY, apiKey);
      }
    } catch (e) {
      console.error('Failed to save API Key:', e);
      throw new Error('無法儲存 API Key，請檢查您的系統權限。');
    }
  },

  /**
   * Retrieves the stored Gemini API key.
   */
  async getApiKey(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(API_KEY_STORE_KEY);
      } else {
        return await SecureStore.getItemAsync(API_KEY_STORE_KEY);
      }
    } catch (e) {
      console.warn('Failed to retrieve API Key:', e);
      return null;
    }
  },

  /**
   * Removes the stored Gemini API key.
   */
  async clearApiKey(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(API_KEY_STORE_KEY);
      } else {
        await SecureStore.deleteItemAsync(API_KEY_STORE_KEY);
      }
    } catch (e) {
      console.error('Failed to clear API Key:', e);
    }
  }
};
