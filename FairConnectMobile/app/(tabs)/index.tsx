/**
 * app/(tabs)/index.jsx
 * FairConnect Mobile — Worker Dashboard (Home Tab)
 *
 * Mirrors web pages/worker/Dashboard.jsx:
 *  • Verification status card with badge
 *  • Quick action cards: Upload Certificate, Scan QR, Find Jobs
 *  • Recent activity section
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getVerificationStatus } from '../../services/api';

// ── Verification status banner ────────────────────────────────────────────────
function VerificationBanner({ status, isVerified }) {
  const cfg = {
    verified: {
      bg: '#ecfdf5', border: '#6ee7b7', icon: '✅', label: '✓ Skill Verified',
      text: 'Your ITI/NCVT certificate has been verified. Employers can trust your credentials.',
      textColor: '#065f46',
    },
    pending: {
      bg: '#fffbeb', border: '#fcd34d', icon: '⏳', label: 'Verification Pending',
      text: 'Your certificate is under admin review. This usually takes 24–48 hours.',
      textColor: '#78350f',
    },
    unverified: {
      bg: '#f0f9ff', border: '#7dd3fc', icon: '📜', label: 'Get Skill Verified',
      text: 'Upload your ITI/NCVT certificate to get a verified badge on your profile.',
      textColor: '#0369a1',
    },
  };

  const c = cfg[status] || cfg.unverified;

  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderWidth: 1.5,
        borderColor: c.border,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Text style={{ fontSize: 24 }}>{c.icon}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.textColor }}>{c.label}</Text>
      </View>
      <Text style={{ fontSize: 13, color: c.textColor, lineHeight: 19 }}>{c.text}</Text>
    </View>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────
function QuickAction({ emoji, title, subtitle, onPress, color = '#059669' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 14,
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: 15 }}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await getVerificationStatus();
      setVerificationData(data);
    } catch (err) {
      console.warn('[Dashboard] Could not fetch verification status:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchStatus();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const status = verificationData?.verificationStatus || 'unverified';
  const isVerified = verificationData?.isVerified || false;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>
          Hello, {user?.name?.split(' ')[0] || 'Worker'} 👋
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          {isVerified ? '✓ Your skills are verified and visible to employers.' : 'Complete your profile to get hired faster.'}
        </Text>
      </View>

      {/* Verification status banner */}
      <VerificationBanner status={status} isVerified={isVerified} />

      {/* Quick actions */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <QuickAction
          emoji="📜"
          title="Upload Certificate"
          subtitle="ITI / NCVT / PDF"
          onPress={() => router.push('/verification')}
        />
        <QuickAction
          emoji="📷"
          title="Scan QR Code"
          subtitle="Instant verify"
          onPress={() => router.push('/qr-scan')}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        <QuickAction
          emoji="🔍"
          title="Find Jobs"
          subtitle="Near your location"
          onPress={() => router.push('/(tabs)/jobs')}
        />
        <QuickAction
          emoji="👤"
          title="My Profile"
          subtitle="Edit & complete"
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      {/* Certificate info card */}
      {verificationData?.certificate?.fileUrl && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
            📋 Certificate on File
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Type</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', textTransform: 'capitalize' }}>
                {verificationData.certificate.fileType || 'Document'}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Status</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: status === 'verified' ? '#059669' : status === 'pending' ? '#d97706' : '#ef4444',
                  textTransform: 'capitalize',
                }}
              >
                {status}
              </Text>
            </View>
            {verificationData.certificate.verifiedAt && (
              <View>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Verified On</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                  {new Date(verificationData.certificate.verifiedAt).toLocaleDateString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        onPress={logout}
        style={{
          borderWidth: 1,
          borderColor: '#fecaca',
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: '#fef2f2',
          marginTop: 8,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#b91c1c' }}>🚪 Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
