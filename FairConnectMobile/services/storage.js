/**
 * services/storage.js
 * Cross-platform persistent storage
 *
 * • Native (iOS / Android): uses expo-secure-store for hardware-backed encryption
 * • Web: falls back to window.localStorage (since expo-secure-store is not supported on web)
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (err) {
        console.warn('[storage] localStorage read error:', err);
      }
      return null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('[storage] SecureStore read error:', err.message);
      return null;
    }
  },

  async setItem(key, value) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (err) {
        console.warn('[storage] localStorage write error:', err);
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn('[storage] SecureStore write error:', err.message);
    }
  },

  async deleteItem(key) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (err) {
        console.warn('[storage] localStorage delete error:', err);
      }
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.warn('[storage] SecureStore delete error:', err.message);
    }
  },
};

export default storage;
