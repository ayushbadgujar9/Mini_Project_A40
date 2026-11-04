/**
 * app/(tabs)/employer.jsx
 * FairConnect Mobile — Employer Dashboard Tab
 *
 * Mirrors web pages/employer/Dashboard.jsx:
 *  • POST /api/jobs → post a job
 *  • View recent posted jobs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getJobs, verifyQRCode } from '../../services/api';

export default function EmployerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [postedJobs, setPostedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchMyJobs() {
    try {
      const { data } = await getJobs({ employer: user?.id });
      setPostedJobs(Array.isArray(data) ? data : data.jobs || []);
    } catch (err) {
      console.warn('[Employer] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchMyJobs();
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchMyJobs(); }}
          tintColor="#059669"
        />
      }
    >
      {/* Welcome */}
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 }}>
        Employer Dashboard 🏢
      </Text>
      <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        Welcome, {user?.name}. Manage your job postings and verify worker credentials.
      </Text>

      {/* Action cards */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => router.push('/qr-scan')}
          style={{
            flex: 1,
            backgroundColor: '#059669',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            gap: 6,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 28 }}>📷</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
            Scan Worker QR
          </Text>
          <Text style={{ color: '#d1fae5', fontSize: 11, textAlign: 'center' }}>
            Verify credentials
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Alert.alert('Post Job', 'Job posting form coming soon!')}
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: '#059669',
            padding: 16,
            alignItems: 'center',
            gap: 6,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 28 }}>➕</Text>
          <Text style={{ color: '#059669', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
            Post a Job
          </Text>
          <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
            Hire skilled workers
          </Text>
        </TouchableOpacity>
      </View>

      {/* My Jobs list */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
        My Job Postings
      </Text>
      {loading ? (
        <ActivityIndicator color="#059669" />
      ) : postedJobs.length === 0 ? (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 8 }}>📭</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
            No jobs posted yet
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            Post your first job to start hiring skilled workers
          </Text>
        </View>
      ) : (
        postedJobs.map((job, idx) => (
          <View
            key={job._id || idx}
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              padding: 14,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
              📍 {job.location} · 💰 ₹{job.payPerDay}/day
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                {job.applications?.length || 0} applications
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: job.isOpen ? '#059669' : '#6b7280',
                }}
              >
                {job.isOpen ? '● Active' : '● Closed'}
              </Text>
            </View>
          </View>
        ))
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
          marginTop: 20,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#b91c1c' }}>🚪 Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
