/**
 * services/api.js
 * FairConnect Mobile — Centralized API Service Layer
 *
 * • Axios instance pointed at the Node.js/Express backend
 * • Request interceptor: auto-reads JWT from expo-secure-store
 *   and injects Authorization: Bearer <token> on every request
 * • Response interceptor: handles 401 → logout
 */

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import storage from './storage';

// ── Resolve backend URL intelligently across Web, Emulator & Physical Phone ──
function resolveApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // On Web, localhost:5000 or envUrl works directly
  if (Platform.OS === 'web') {
    return envUrl || 'http://localhost:5000';
  }

  // If envUrl is set to a non-localhost LAN IP, use it
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // In Expo Go on mobile, automatically extract the host computer's IP
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:5000`;
    }
  }

  // Android emulator localhost alias
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  // Active machine Wi-Fi LAN IP
  return 'http://10.133.9.205:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();

// ── SecureStore key (mirrors web's TOKEN_KEY = 'fairconnect_token') ───────────
export const TOKEN_KEY = 'fairconnect_token';

// ── Create axios instance ─────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: inject JWT automatically ─────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[api] storage read error:', err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 auth failures ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await storage.deleteItem(TOKEN_KEY);
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS (Passwordless Email OTP & Demo Login)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/auth/login → sends 6-digit OTP to user's email */
export const sendLoginOtp = (email) =>
  api.post('/api/auth/login', { email: (email || '').trim().toLowerCase() });

/** POST /api/auth/verify-otp → verifies 6-digit OTP and returns { token, user } */
export const verifyOtp = (email, otp) =>
  api.post('/api/auth/verify-otp', {
    email: (email || '').trim().toLowerCase(),
    otp: (otp || '').trim(),
  });

/** POST /api/auth/demo-login → fast 1-click login for worker/employer/admin */
export const demoLogin = (role = 'worker') =>
  api.post('/api/auth/demo-login', { role });

/** POST /api/auth/register → registers worker or employer and sends OTP */
export const registerUser = (name, email, role, phoneNumber) =>
  api.post('/api/auth/register', {
    name,
    email: (email || '').trim().toLowerCase(),
    role,
    phoneNumber,
  });

// Aliases for compatibility
export const loginUser = sendLoginOtp;
export const verifyEmailOtp = verifyOtp;

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/verification/upload-certificate
 * Sends certificate as multipart/form-data.
 *
 * @param {string} fileUri     - Local file URI from expo-document-picker / expo-image-picker
 * @param {string} fileName    - Original filename
 * @param {string} mimeType    - MIME type (image/jpeg, image/png, application/pdf)
 * @param {function} onProgress - Optional upload progress callback (0–100)
 */
export async function uploadCertificate(fileUri, fileName, mimeType, userId, onProgress) {
  // If 4th arg is function, it was called as (fileUri, fileName, mimeType, onProgress)
  let actualUserId = userId;
  let actualOnProgress = onProgress;
  if (typeof userId === 'function') {
    actualOnProgress = userId;
    actualUserId = null;
  }

  const formData = new FormData();

  const filePayload = {
    uri: fileUri,
    name: fileName || 'certificate',
    type: mimeType || 'application/octet-stream',
  };

  // Append both 'certificateFile' (as requested) and 'certificate' (multer backend compatibility)
  formData.append('certificateFile', filePayload);
  formData.append('certificate', filePayload);

  if (actualUserId) {
    formData.append('userId', actualUserId);
  }

  const token = await storage.getItem(TOKEN_KEY);

  return axios.post(`${API_BASE_URL}/api/verification/upload-certificate`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    onUploadProgress: actualOnProgress
      ? (evt) => {
          const pct = Math.round((evt.loaded * 100) / (evt.total || 1));
          actualOnProgress(pct);
        }
      : undefined,
  });
}

/**
 * POST /api/verification/verify-qr
 * Sends scanned QR payload for certificate cross-matching.
 *
 * @param {string} qrPayload - Raw string decoded from QR scan
 */
export const verifyQRCode = (qrPayload) =>
  api.post('/api/verification/verify-qr', { qrPayload });

/** GET /api/verification/status → { isVerified, verificationStatus, certificate } */
export const getVerificationStatus = () => api.get('/api/verification/status');

// ─────────────────────────────────────────────────────────────────────────────
// WORKER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/worker/profile */
export const getWorkerProfile = () => api.get('/api/worker/profile');

/** PUT /api/worker/profile */
export const updateWorkerProfile = (data) => api.put('/api/worker/profile', data);

// ─────────────────────────────────────────────────────────────────────────────
// JOBS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/jobs?skill=&location=&page= */
export const getJobs = (params) => api.get('/api/jobs', { params });

/** GET /api/jobs/:id */
export const getJobById = (id) => api.get(`/api/jobs/${id}`);

/** POST /api/jobs/:id/apply */
export const applyForJob = (jobId, data) =>
  api.post(`/api/jobs/${jobId}/apply`, data);

/** POST /api/jobs (employer only) */
export const postJob = (data) => api.post('/api/jobs', data);

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/applications/my */
export const getMyApplications = () => api.get('/api/applications/my');

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/chat/conversations */
export const getConversations = () => api.get('/api/chat/conversations');

/** GET /api/chat/messages/:conversationId */
export const getMessages = (conversationId) =>
  api.get(`/api/chat/messages/${conversationId}`);

/** POST /api/chat/messages */
export const sendMessage = (conversationId, content) =>
  api.post('/api/chat/messages', { conversationId, content });

// ─────────────────────────────────────────────────────────────────────────────
// RATINGS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/ratings */
export const submitRating = (workerId, jobId, rating, review) =>
  api.post('/api/ratings', { workerId, jobId, rating, review });

export default api;
