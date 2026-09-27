import { createContext, useContext, useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

// ──────────────────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);
const TOKEN_KEY = 'fairconnect_token';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: safely decode token, return null if invalid / expired
// ──────────────────────────────────────────────────────────────────────────────
function decodeToken(token) {
  try {
    const decoded = jwtDecode(token);
    // Check expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return decoded; // { id, role, iat, exp }
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const decoded = decodeToken(stored);
    if (!decoded) {
      localStorage.removeItem(TOKEN_KEY); // Clean up expired token
      return null;
    }
    return stored;
  });

  // Derived user from token
  const user = token ? decodeToken(token) : null;

  const login = useCallback((newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = {
    token,
    user,           // { id, role, iat, exp } or null
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ──────────────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export default AuthContext;
