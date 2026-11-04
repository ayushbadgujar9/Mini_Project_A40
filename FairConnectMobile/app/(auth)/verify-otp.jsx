/**
 * app/(auth)/verify-otp.jsx
 * FairConnect Mobile — Email OTP Verification Screen
 *
 * Mirrors web EmailVerification.jsx:
 *  • POST /api/auth/verify-email-otp → receives JWT → login & redirect
 */

import React, { useState, useRef } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { verifyEmailOtp } from '../../services/api';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const { login } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputs = useRef([]);

  function handleOtpChange(text, idx) {
    if (!/^\d*$/.test(text)) return;
    const newOtp = [...otp];
    newOtp[idx] = text.slice(-1); // only last digit
    setOtp(newOtp);
    if (text && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
  }

  function handleKeyPress(key, idx) {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data } = await verifyEmailOtp(email, code);
      await login(data.token);
      const role = data.user?.role || data.role;
      if (role === 'worker') router.replace('/(tabs)');
      else if (role === 'employer') router.replace('/(tabs)/employer');
      else router.replace('/(tabs)');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>📧</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' }}>
            Verify Your Email
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ fontWeight: '700', color: '#059669' }}>{email}</Text>
          </Text>
        </View>

        {error && (
          <View
            style={{
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              borderRadius: 10,
              padding: 12,
              marginBottom: 20,
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Text>⚠️</Text>
            <Text style={{ fontSize: 13, color: '#b91c1c', flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* OTP input boxes */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(el) => (inputs.current[idx] = el)}
              value={digit}
              onChangeText={(t) => handleOtpChange(t, idx)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              style={{
                width: 46,
                height: 54,
                borderWidth: 2,
                borderColor: digit ? '#059669' : '#d1d5db',
                borderRadius: 10,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: '700',
                color: '#111827',
                backgroundColor: digit ? '#ecfdf5' : '#fff',
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={handleVerify}
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
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Verifying…</Text>
            </>
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>← Back to Register</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
