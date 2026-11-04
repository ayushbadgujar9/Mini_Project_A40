/**
 * app/verification.jsx
 * FairConnect Mobile — Certificate Verification Route
 *
 * Accessed via router.push('/verification') from:
 *  - Worker Dashboard quick action card
 *  - Worker Profile "Upload Certificate" button
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import VerificationScreen from '../screens/VerificationScreen';
import { getVerificationStatus } from '../services/api';
import { useRouter } from 'expo-router';

export default function VerificationRoute() {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVerificationStatus()
      .then(({ data }) => setCurrentStatus(data?.verificationStatus || 'unverified'))
      .catch(() => setCurrentStatus('unverified'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <VerificationScreen
      currentStatus={currentStatus}
      onVerified={(data) => {
        setCurrentStatus(data.verificationStatus);
        // After successful verification, optionally go back
        if (data.verified) {
          setTimeout(() => router.back(), 1500);
        }
      }}
    />
  );
}
