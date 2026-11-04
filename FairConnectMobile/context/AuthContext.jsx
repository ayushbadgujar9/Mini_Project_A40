/**
 * context/AuthContext.jsx
 * FairConnect Mobile — Auth Context
 *
 * Uses cross-platform storage (SecureStore on native, localStorage on web)
 * for JWT persistence and authentication state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import storage from '../services/storage';

const AuthContext = createContext(null);
const TOKEN_KEY = 'fairconnect_token';

// ── Pure JS Base64 decoder (safe across Web, Hermes, JSC) ────────────────────
function decodeBase64(str) {
  if (typeof atob === 'function') {
    return atob(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }
  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

// ── Safely decode JWT payload without verifying signature ────────────────────
function decodeJWT(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const raw = decodeBase64(base64);
    const jsonPayload = decodeURIComponent(
      raw
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    // Check expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return decoded; // { id, role, email, name, iat, exp }
  } catch {
    return null;
  }
}

// Check initial token synchronously on web
function getInitialToken() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(TOKEN_KEY);
      if (stored) {
        const decoded = decodeJWT(stored);
        if (decoded) return stored;
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch (_) {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [token, setToken] = useState(getInitialToken);
  const [isLoading, setIsLoading] = useState(() => Platform.OS !== 'web');

  // ── Bootstrap: read token from storage on native app start ─────────────────
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const stored = await storage.getItem(TOKEN_KEY);
        if (stored && isMounted) {
          const decoded = decodeJWT(stored);
          if (decoded) {
            setToken(stored);
          } else {
            await storage.deleteItem(TOKEN_KEY);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Storage bootstrap error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Derived user from token
  const user = token ? decodeJWT(token) : null;

  const login = useCallback(async (newToken) => {
    try {
      await storage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    } catch (err) {
      console.error('[AuthContext] Failed to save token:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await storage.deleteItem(TOKEN_KEY);
    } catch (_) {}
    setToken(null);
    router.replace('/(auth)/login');
  }, []);

  const value = {
    token,
    user,             // { id, role, email, name, iat, exp } or null
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export default AuthContext;
