/**
 * app/(tabs)/_layout.jsx
 * FairConnect Mobile — Worker Tab Navigator
 *
 * Mirrors the web portal's Worker Dashboard tabs.
 * Redirects to login if user is not authenticated.
 */

import React, { useEffect } from 'react';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, View, Text, Platform } from 'react-native';

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', minHeight: 300 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🤝</Text>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
        <Text style={{ marginTop: 16, fontSize: 14, color: '#6b7280', fontWeight: '500' }}>Loading FairConnect…</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        },
        headerTintColor: '#059669',
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
      }}
    >
      {/* Worker Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          headerTitle: '🤝 FairConnect',
        }}
      />

      {/* Job Search */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Find Jobs',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
          headerTitle: 'Browse Jobs',
        }}
      />

      {/* Certificate Verification (Worker) */}
      <Tabs.Screen
        name="verify"
        options={{
          title: 'Verify Skills',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📜" focused={focused} />,
          headerTitle: 'Skill Verification',
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          headerTitle: 'My Profile',
        }}
      />

      {/* Employer dashboard — hide from tabs for workers, show for employers */}
      <Tabs.Screen
        name="employer"
        options={{
          title: 'Employer',
          href: user?.role === 'employer' ? '/employer' : null, // only show for employer role
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏢" focused={focused} />,
          headerTitle: 'Employer Dashboard',
        }}
      />
    </Tabs>
  );
}
