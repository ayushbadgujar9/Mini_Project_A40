/**
 * app/(auth)/login.jsx
 * FairConnect Mobile — Passwordless Email OTP Login
 *
 * Exact replica of the web portal's authentication flow:
 *  1. User enters Email (no password)
 *  2. Server generates a 6-digit OTP and sends it via email (POST /api/auth/login)
 *  3. User enters the 6-digit OTP (POST /api/auth/verify-otp)
 *  4. Server responds with JWT token and user profile
 *  5. App stores JWT in SecureStore/Storage and routes to dashboard based on role
 *  6. Fast 1-click Demo Logins (Worker / Employer) available for instant testing
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { sendLoginOtp, verifyOtp, demoLogin, registerUser } from '../../services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  // Screen state: 'email' (Step 1) | 'otp' (Step 2)
  const [step, setStep] = useState('email');

  // Mode: 'login' | 'register'
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('worker'); // 'worker' | 'employer'
  const [phoneNumber, setPhoneNumber] = useState('');

  // 6-digit OTP boxes
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef([]);

  // UX & async states
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(null); // 'worker' | 'employer'
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [devOtp, setDevOtp] = useState(null);

  // 5-minute countdown timer for OTP
  const [countdown, setCountdown] = useState(300);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timerActive && countdown > 0) {
      interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, countdown]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── STEP 1: Send OTP to Email ──────────────────────────────────────────────
  async function handleSendOtp() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (isRegisterMode && !name.trim()) {
      setError('Please provide your full name to register.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let resData;
      if (isRegisterMode) {
        // Register route sends OTP
        const { data } = await registerUser(
          name.trim(),
          trimmedEmail,
          role,
          phoneNumber.trim() || undefined
        );
        resData = data;
      } else {
        // Passwordless login sends OTP
        const { data } = await sendLoginOtp(trimmedEmail);
        resData = data;
      }

      setDevOtp(resData.devOtp || null);
      setSuccessMsg(resData.message || `OTP sent to ${trimmedEmail}`);
      setStep('otp');
      setCountdown(resData.expiresInSeconds || 300);
      setTimerActive(true);
      setOtpDigits(['', '', '', '', '', '']);

      // Focus first OTP box
      setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 250);
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Could not send verification code. Please try again.';
      // If user not found during login, guide them to register
      if (err.response?.status === 404 && !isRegisterMode) {
        setError('No account found with this email. Toggle to Register below.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── STEP 2: Verify OTP ─────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const fullOtp = otpDigits.join('').trim();
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await verifyOtp(email.trim().toLowerCase(), fullOtp);

      if (data.token) {
        await login(data.token);

        const userRole = data.user?.role || role;
        if (userRole === 'employer' || userRole === 'admin') {
          router.replace('/(tabs)/employer');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Invalid or expired verification code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── OTP input box change handler ───────────────────────────────────────────
  function handleDigitChange(text, idx) {
    const clean = text.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (clean.length > 1) {
      // Pasted full 6-digit code
      const pasted = clean.slice(0, 6).split('');
      pasted.forEach((ch, i) => {
        if (i < 6) newDigits[i] = ch;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pasted.length, 5);
      digitRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[idx] = clean;
    setOtpDigits(newDigits);

    // Auto-advance to next box if digit typed
    if (clean && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyPress(e, idx) {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    }
  }

  // ── 1-Click Fast Demo Login ────────────────────────────────────────────────
  async function handleDemoLogin(targetRole) {
    setDemoLoading(targetRole);
    setError(null);

    try {
      const { data } = await demoLogin(targetRole);
      if (data.token) {
        await login(data.token);
        if (targetRole === 'employer') {
          router.replace('/(tabs)/employer');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || `Demo ${targetRole} login failed.`);
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 6 }}>🤝</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#059669', letterSpacing: -0.5 }}>
            FairConnect
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Empowering blue-collar workers through verified skills
          </Text>
        </View>

        {/* Main Card */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* STEP 1: Enter Email (Passwordless)                                */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {step === 'email' ? (
            <View>
              {/* Tab Toggle: Sign In vs Create Account */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#f3f4f6',
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setIsRegisterMode(false);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: !isRegisterMode ? '#ffffff' : 'transparent',
                    alignItems: 'center',
                    shadowColor: !isRegisterMode ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: !isRegisterMode ? 1 : 0,
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: !isRegisterMode ? '#059669' : '#6b7280',
                    }}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsRegisterMode(true);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: isRegisterMode ? '#ffffff' : 'transparent',
                    alignItems: 'center',
                    shadowColor: isRegisterMode ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: isRegisterMode ? 1 : 0,
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isRegisterMode ? '#059669' : '#6b7280',
                    }}
                  >
                    Create Account
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
                {isRegisterMode ? 'Register New Account' : 'Welcome to FairConnect'}
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 18 }}>
                {isRegisterMode
                  ? 'Fill your details and we will send a 6-digit OTP to verify your email.'
                  : 'Enter your email to receive a 6-digit OTP verification code. No password needed!'}
              </Text>

              {/* Full Name (Registration only) */}
              {isRegisterMode && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                    Full Name *
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor="#9ca3af"
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: '#111827',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                </View>
              )}

              {/* Email Input */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Email Address *
                </Text>
                <TextInput
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: '#111827',
                    backgroundColor: '#f9fafb',
                  }}
                />
              </View>

              {/* Role Picker (Registration only) */}
              {isRegisterMode && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                    I am a *
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setRole('worker')}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderWidth: 1.5,
                        borderColor: role === 'worker' ? '#059669' : '#e5e7eb',
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: role === 'worker' ? '#ecfdf5' : '#ffffff',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 18 }}>👷</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: role === 'worker' ? '#065f46' : '#6b7280',
                          marginTop: 2,
                        }}
                      >
                        Skilled Worker
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setRole('employer')}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderWidth: 1.5,
                        borderColor: role === 'employer' ? '#059669' : '#e5e7eb',
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: role === 'employer' ? '#ecfdf5' : '#ffffff',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 18 }}>🏢</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: role === 'employer' ? '#065f46' : '#6b7280',
                          marginTop: 2,
                        }}
                      >
                        Employer
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Error message */}
              {error && (
                <View
                  style={{
                    backgroundColor: '#fef2f2',
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#b91c1c' }}>⚠️ {error}</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={loading}
                style={{
                  backgroundColor: loading ? '#9ca3af' : '#059669',
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                activeOpacity={0.8}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      Sending Code…
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    📩 Send Verification Code
                  </Text>
                )}
              </TouchableOpacity>

              {/* 1-Click Demo Login Shortcuts */}
              <View style={{ marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    textAlign: 'center',
                    marginBottom: 10,
                  }}
                >
                  ⚡ Fast 1-Click Demo Login
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleDemoLogin('worker')}
                    disabled={demoLoading !== null}
                    style={{
                      flex: 1,
                      backgroundColor: '#eff6ff',
                      borderWidth: 1,
                      borderColor: '#bfdbfe',
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    {demoLoading === 'worker' ? (
                      <ActivityIndicator size="small" color="#1d4ed8" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 16 }}>👷</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1d4ed8', marginTop: 2 }}>
                          Demo Worker
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDemoLogin('employer')}
                    disabled={demoLoading !== null}
                    style={{
                      flex: 1,
                      backgroundColor: '#f0fdf4',
                      borderWidth: 1,
                      borderColor: '#bbf7d0',
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    {demoLoading === 'employer' ? (
                      <ActivityIndicator size="small" color="#15803d" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 16 }}>🏢</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d', marginTop: 2 }}>
                          Demo Employer
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* ═════════════════════════════════════════════════════════════════ */
            /* STEP 2: Enter 6-Digit OTP                                         */
            /* ═════════════════════════════════════════════════════════════════ */
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setStep('email');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  style={{ marginRight: 10, padding: 4 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 18, color: '#059669', fontWeight: '700' }}>←</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  Verify Email
                </Text>
              </View>

              <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 14 }}>
                We sent a 6-digit verification code to:{'\n'}
                <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
              </Text>

              {/* Dev OTP helper badge if server returned it in non-production */}
              {devOtp && (
                <View
                  style={{
                    backgroundColor: '#fef3c7',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600' }}>
                    🔑 DEV AUTO-FILL CODE:
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const digits = String(devOtp).split('').slice(0, 6);
                      setOtpDigits(digits);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: '#78350f',
                        letterSpacing: 4,
                        marginTop: 2,
                      }}
                    >
                      {devOtp}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#b45309', textAlign: 'center', marginTop: 1 }}>
                      (Tap to auto-fill)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 6 Digit Input Boxes */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  gap: 6,
                }}
              >
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(ref) => (digitRefs.current[idx] = ref)}
                    value={digit}
                    onChangeText={(val) => handleDigitChange(val, idx)}
                    onKeyPress={(e) => handleKeyPress(e, idx)}
                    keyboardType="number-pad"
                    maxLength={idx === 0 ? 6 : 1}
                    selectTextOnFocus
                    style={{
                      flex: 1,
                      height: 52,
                      borderWidth: 2,
                      borderColor: digit ? '#059669' : '#d1d5db',
                      borderRadius: 10,
                      textAlign: 'center',
                      fontSize: 22,
                      fontWeight: '800',
                      color: '#111827',
                      backgroundColor: digit ? '#f0fdf4' : '#f9fafb',
                    }}
                  />
                ))}
              </View>

              {/* Timer & Resend */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  Expires in:{' '}
                  <Text
                    style={{
                      fontWeight: '700',
                      color: countdown < 60 ? '#dc2626' : '#059669',
                    }}
                  >
                    {formatTimer(countdown)}
                  </Text>
                </Text>

                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading || timerActive}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: timerActive ? '#9ca3af' : '#059669',
                      textDecorationLine: timerActive ? 'none' : 'underline',
                    }}
                  >
                    Resend Code
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error message */}
              {error && (
                <View
                  style={{
                    backgroundColor: '#fef2f2',
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#b91c1c' }}>⚠️ {error}</Text>
                </View>
              )}

              {/* Verify & Sign In Button */}
              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={loading || otpDigits.join('').length !== 6}
                style={{
                  backgroundColor:
                    loading || otpDigits.join('').length !== 6 ? '#9ca3af' : '#059669',
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                activeOpacity={0.8}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      Verifying…
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    ✓ Verify & Sign In
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
