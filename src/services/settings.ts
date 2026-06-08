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
          await AsyncStorage.setItem(API_KEY_STORE_KEY, apiKey);
        } else {
          await SecureStore.setItemAsync(API_KEY_STORE_KEY, apiKey);
        }
      } else {
        // Ensure any previously persisted key is cleared if user chooses session only
        if (Platform.OS === 'web') {
          await AsyncStorage.removeItem(API_KEY_STORE_KEY);
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
      return sessionApiKey;
    }

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
   * Removes the stored Gemini API key from both memory and persistent storage.
   */
  async clearApiKey(): Promise<void> {
    sessionApiKey = null;
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
