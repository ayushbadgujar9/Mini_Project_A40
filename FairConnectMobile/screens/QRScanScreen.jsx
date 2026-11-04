/**
 * screens/QRScanScreen.jsx
 * FairConnect Mobile — Native QR Code Scanner for Certificate Verification
 *
 * Uses expo-camera barcode scanning mode to:
 *  1. Scan a QR code printed on an ITI/NCVT certificate image
 *  2. Extract the payload string (JSON or line-delimited credential text)
 *  3. POST to /api/verification/verify-qr
 *  4. Display instant visual feedback and update status badge
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verifyQRCode } from '../services/api';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_BOX_SIZE = SCREEN_WIDTH * 0.65;

// ── Verification result badge shown after scan ────────────────────────────────
function VerificationResultBadge({ result, onReset }) {
  if (!result) return null;

  const isVerified = result.verified === true;
  const isPending = result.verificationStatus === 'pending';

  return (
    <View style={styles.resultOverlay}>
      <View
        style={[
          styles.resultCard,
          { borderColor: isVerified ? '#10b981' : isPending ? '#f59e0b' : '#ef4444' },
        ]}
      >
        {/* Icon */}
        <Text style={styles.resultIcon}>{isVerified ? '✅' : isPending ? '⏳' : '❌'}</Text>

        {/* Status heading */}
        <Text
          style={[
            styles.resultTitle,
            {
              color: isVerified ? '#065f46' : isPending ? '#78350f' : '#7f1d1d',
            },
          ]}
        >
          {isVerified
            ? '✓ Skill Verified'
            : isPending
            ? 'Sent for Admin Review'
            : 'Verification Failed'}
        </Text>

        {/* Details */}
        {isVerified && (result.certName || result.certTrade) && (
          <View style={styles.resultDetails}>
            {result.certName && (
              <Text style={styles.resultDetailText}>
                👤 <Text style={{ fontWeight: '700' }}>Name:</Text>{' '}
                {result.certName.toUpperCase()}
              </Text>
            )}
            {result.certTrade && (
              <Text style={styles.resultDetailText}>
                🛠️ <Text style={{ fontWeight: '700' }}>Trade:</Text>{' '}
                {result.certTrade.toUpperCase()}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.resultMessage} numberOfLines={4}>
          {result.message}
        </Text>

        {/* Action buttons */}
        <View style={styles.resultActions}>
          <TouchableOpacity
            onPress={onReset}
            style={[
              styles.resultButton,
              { backgroundColor: isVerified ? '#059669' : '#6b7280' },
            ]}
            activeOpacity={0.8}
          >
            <Text style={styles.resultButtonText}>
              {isVerified ? '🎉 Done' : 'Scan Another'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QRScanScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function QRScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);     // prevents duplicate scans
  const [verifying, setVerifying] = useState(false);  // API call in progress
  const [scannedPayload, setScannedPayload] = useState(null);
  const [result, setResult] = useState(null);
  const scanLock = useRef(false);

  // ── Handle a detected barcode ─────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(
    async ({ data }) => {
      if (!scanning || scanLock.current || verifying) return;
      if (!data || typeof data !== 'string' || data.trim() === '') return;

      // Lock to prevent duplicate scans
      scanLock.current = true;
      setScanning(false);
      setScannedPayload(data);
      setVerifying(true);

      try {
        const { data: responseData } = await verifyQRCode(data.trim());

        const scanResult = {
          verified: responseData.verified,
          verificationStatus: responseData.verificationStatus,
          message: responseData.message,
          certName: responseData.certName || null,
          certTrade: responseData.certTrade || null,
        };

        setResult(scanResult);

        // Show instant visual feedback via native Alert
        if (responseData.verified) {
          Alert.alert(
            '✓ Skill Verified',
            `Certificate credential successfully matched!\n\nCandidate: ${(
              responseData.certName || ''
            ).toUpperCase()}\nTrade: ${(
              responseData.certTrade || ''
            ).toUpperCase()}\n\nStatus badge updated to "✓ Skill Verified".`,
            [{ text: '🎉 Great!' }]
          );
        } else if (responseData.verificationStatus === 'pending') {
          Alert.alert(
            '📋 Sent for Review',
            `QR code scanned. Certificate routed to Admin Dashboard for manual review.\n\n${responseData.message}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '❌ Verification Failed',
            responseData.message || 'Could not verify this QR code.',
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        const errMsg =
          err.response?.data?.message || 'Verification failed. Please check your connection.';
        setResult({
          verified: false,
          verificationStatus: 'error',
          message: errMsg,
        });
        Alert.alert('Scan Error', errMsg, [{ text: 'OK' }]);
      } finally {
        setVerifying(false);
        scanLock.current = false;
      }
    },
    [scanning, verifying]
  );

  // ── Reset state to allow a new scan ─────────────────────────────────────
  function handleReset() {
    setResult(null);
    setScannedPayload(null);
    setScanning(true);
    setVerifying(false);
    scanLock.current = false;
  }

  // ── Permission not yet determined ─────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Checking camera permission…</Text>
      </View>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionSubtext}>
          FairConnect needs access to your camera to scan QR codes on certificates.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelLink}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Camera view fills entire screen ── */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanning && !verifying ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'datamatrix', 'pdf417'],
        }}
      />

      {/* ── Dark overlay with transparent scan window ── */}
      <View style={styles.overlay}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />

        {/* Middle row: dark | transparent box | dark */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          {/* Scan window */}
          <View style={styles.scanWindow}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scanning line animation hint */}
            {scanning && !verifying && (
              <View style={styles.scanLine} />
            )}

            {/* Verifying spinner inside box */}
            {verifying && (
              <View style={styles.verifyingInBox}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.verifyingText}>Verifying…</Text>
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom dark area with instructions */}
        <View style={styles.overlayBottom}>
          <Text style={styles.instructionText}>
            {verifying
              ? '🔄 Cross-matching credentials with database…'
              : scanning
              ? '📋 Point camera at the QR code on the certificate'
              : '✅ QR code captured — processing…'}
          </Text>

          {scannedPayload && !verifying && !result && (
            <Text style={styles.payloadPreview} numberOfLines={2}>
              Payload: {scannedPayload.substring(0, 60)}
              {scannedPayload.length > 60 ? '…' : ''}
            </Text>
          )}

          {/* Reset button */}
          {!scanning && !verifying && !result && (
            <TouchableOpacity onPress={handleReset} style={styles.rescanButton} activeOpacity={0.8}>
              <Text style={styles.rescanButtonText}>🔁 Scan Again</Text>
            </TouchableOpacity>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>✕ Close Scanner</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Result overlay card (shown after API response) ── */}
      {result && <VerificationResultBadge result={result} onReset={handleReset} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.62)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  // ── Permission screen ──────────────────────────────────────────────────────
  permissionIcon: { fontSize: 64, marginBottom: 16 },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelLink: { padding: 8 },
  cancelLinkText: { fontSize: 13, color: '#6b7280', textDecorationLine: 'underline' },

  // ── Scanner overlay ────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    height: SCAN_BOX_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  scanWindow: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  payloadPreview: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rescanButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  rescanButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backButton: { marginTop: 8, padding: 8 },
  backButtonText: { fontSize: 13, color: '#d1d5db', textDecorationLine: 'underline' },

  // ── Corner brackets ────────────────────────────────────────────────────────
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10b981',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // ── Scan line ──────────────────────────────────────────────────────────────
  scanLine: {
    position: 'absolute',
    top: '45%',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: 'rgba(16,185,129,0.7)',
    borderRadius: 1,
  },

  // ── Verifying indicator inside box ────────────────────────────────────────
  verifyingInBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  verifyingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6ee7b7',
    fontWeight: '600',
  },

  // ── Result overlay ─────────────────────────────────────────────────────────
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 8,
  },
  resultIcon: { fontSize: 52, marginBottom: 4 },
  resultTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  resultDetails: { width: '100%', marginTop: 4, gap: 4 },
  resultDetailText: { fontSize: 13, color: '#065f46', textAlign: 'center' },
  resultMessage: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  resultButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  resultButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
