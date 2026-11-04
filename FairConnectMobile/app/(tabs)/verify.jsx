/**
 * app/(tabs)/verify.jsx
 * FairConnect Mobile — Verify Skills Tab
 *
 * Wraps the VerificationScreen component inside the tab navigator.
 * Passes current verification status from API.
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import VerificationScreen from '../../screens/VerificationScreen';
import { getVerificationStatus } from '../../services/api';

export default function VerifyTab() {
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
      }}
    />
  );
}
