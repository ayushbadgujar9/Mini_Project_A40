/**
 * app/(auth)/register.jsx
 * FairConnect Mobile — Registration Screen
 *
 * Mirrors web RegisterPage.jsx:
 *  • POST /api/auth/register → OTP sent → navigate to verify-otp
 *  • Role picker: worker or employer
 */

import React, { useState } from 'react';
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
import { registerUser } from '../../services/api';

const ROLES = [
  { value: 'worker', label: '👷 Worker', desc: 'Looking for skilled work' },
  { value: 'employer', label: '🏢 Employer', desc: 'Hiring skilled workers' },
];

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await registerUser(name.trim(), email.trim().toLowerCase(), role, password, phone.trim());
      // Navigate to OTP verification, passing email
      router.push({ pathname: '/(auth)/verify-otp', params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 }}>
          Create Your Account
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          Join FairConnect — a platform for fair, verified skilled work
        </Text>

        {/* Error */}
        {error && (
          <View
            style={{
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 15 }}>⚠️</Text>
            <Text style={{ fontSize: 13, color: '#b91c1c', flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Role selector */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          I am a…
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setRole(r.value)}
              style={{
                flex: 1,
                borderWidth: 2,
                borderColor: role === r.value ? '#059669' : '#d1d5db',
                backgroundColor: role === r.value ? '#ecfdf5' : '#fff',
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 22, marginBottom: 4 }}>{r.label.split(' ')[0]}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: role === r.value ? '#065f46' : '#374151',
                }}
              >
                {r.label.split(' ')[1]}
              </Text>
              <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 2 }}>
                {r.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Full Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
          style={inputStyle}
        />

        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Email Address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          style={inputStyle}
        />

        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
          Phone Number <Text style={{ fontWeight: '400', color: '#9ca3af' }}>(optional)</Text>
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          style={inputStyle}
        />

        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 6 characters"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          style={inputStyle}
        />

        {/* Submit */}
        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#9ca3af' : '#059669',
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            marginTop: 4,
          }}
          activeOpacity={0.8}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Creating account…</Text>
            </>
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
