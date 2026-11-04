/**
 * app/(tabs)/profile.jsx
 * FairConnect Mobile — Worker Profile Tab
 *
 * Mirrors web pages/worker/CompleteProfile.jsx:
 *  • GET /api/worker/profile → display profile fields
 *  • Skill tags, verification badge, contact info
 */

import React, { useEffect, useState } from 'react';
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
import { getWorkerProfile } from '../../services/api';

function SkillBadge({ skill }) {
  return (
    <View
      style={{
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        margin: 3,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1d4ed8' }}>{skill}</Text>
    </View>
  );
}

function ProfileRow({ label, value, icon }) {
  if (!value) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}
    >
      <Text style={{ fontSize: 18, width: 32 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 14, color: '#111827', fontWeight: '500' }}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data } = await getWorkerProfile();
      setProfile(data);
    } catch (err) {
      console.warn('[Profile] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const displayProfile = profile || user;
  const isVerified = profile?.isVerified || false;
  const status = profile?.verificationStatus || 'unverified';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchProfile(); }}
          tintColor="#059669"
        />
      }
    >
      {/* Profile avatar card */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 20,
          alignItems: 'center',
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Avatar placeholder */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#ecfdf5',
            borderWidth: 3,
            borderColor: '#6ee7b7',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 36 }}>👷</Text>
        </View>

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
          {displayProfile?.name || 'Worker'}
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
          {displayProfile?.email || user?.email}
        </Text>

        {/* Verification badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: isVerified ? '#ecfdf5' : status === 'pending' ? '#fffbeb' : '#f3f4f6',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderWidth: 1,
            borderColor: isVerified ? '#6ee7b7' : status === 'pending' ? '#fcd34d' : '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 14 }}>
            {isVerified ? '✅' : status === 'pending' ? '⏳' : '📋'}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: isVerified ? '#065f46' : status === 'pending' ? '#78350f' : '#6b7280',
            }}
          >
            {isVerified ? '✓ Skill Verified' : status === 'pending' ? 'Verification Pending' : 'Not Verified'}
          </Text>
        </View>
      </View>

      {/* Profile details */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          paddingHorizontal: 16,
          marginBottom: 16,
        }}
      >
        <ProfileRow icon="📞" label="Phone Number" value={displayProfile?.phoneNumber} />
        <ProfileRow icon="📍" label="Location" value={displayProfile?.location} />
        <ProfileRow icon="🛠️" label="Primary Skill" value={displayProfile?.primarySkill} />
        <ProfileRow icon="💼" label="Experience" value={displayProfile?.experience} />
        <ProfileRow icon="📝" label="Bio" value={displayProfile?.bio} />
      </View>

      {/* Skills */}
      {(displayProfile?.skills?.length > 0 || displayProfile?.primarySkill) && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
            🛠️ Skills
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -3 }}>
            {displayProfile?.primarySkill && (
              <SkillBadge skill={`${displayProfile.primarySkill} (Primary)`} />
            )}
            {(displayProfile?.skills || []).map((skill, idx) => (
              <SkillBadge key={idx} skill={skill} />
            ))}
          </View>
        </View>
      )}

      {/* Action buttons */}
      <TouchableOpacity
        onPress={() => router.push('/verification')}
        style={{
          backgroundColor: '#059669',
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          marginBottom: 10,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
          📜 Upload / Update Certificate
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={{
          borderWidth: 1,
          borderColor: '#fecaca',
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: '#fef2f2',
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#b91c1c' }}>🚪 Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
