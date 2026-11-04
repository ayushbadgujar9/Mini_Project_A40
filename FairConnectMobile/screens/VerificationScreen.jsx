/**
 * screens/VerificationScreen.jsx
 * FairConnect Mobile — Native Skill Certificate Upload Screen
 *
 * Mirrors web CertificateUpload.jsx but built for React Native using:
 *  • expo-document-picker  → pick PDF certificates
 *  • expo-image-picker     → pick JPG/PNG certificate images
 *  • uploadCertificate()   → POST /api/verification/upload-certificate
 *  • NativeWind classes    → light-themed UI matching web design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadCertificate } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Status badge component ────────────────────────────────────────────────────
function StatusBadge({ status, certName, certTrade }) {
  const cfg = {
    verified: {
      bg: 'bg-emerald-50',
      border: '#6ee7b7',
      icon: '✅',
      textColor: '#065f46',
      label: 'Certificate Verified & Approved!',
    },
    pending: {
      bg: 'bg-amber-50',
      border: '#fbbf24',
      icon: '⏳',
      textColor: '#78350f',
      label: 'Under Admin Review',
    },
    rejected: {
      bg: 'bg-red-50',
      border: '#fca5a5',
      icon: '❌',
      textColor: '#7f1d1d',
      label: 'Verification Rejected',
    },
  };
  const c = cfg[status];
  if (!c) return null;

  return (
    <View
      style={{
        backgroundColor: status === 'verified' ? '#ecfdf5' : status === 'pending' ? '#fffbeb' : '#fef2f2',
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20 }}>{c.icon}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.textColor, flex: 1 }}>
          {c.label}
        </Text>
      </View>
      {status === 'verified' && (certName || certTrade) && (
        <View style={{ marginTop: 6, paddingLeft: 28 }}>
          {certName && (
            <Text style={{ fontSize: 12, color: '#065f46' }}>
              👤 <Text style={{ fontWeight: '700' }}>Candidate Name:</Text> {certName.toUpperCase()}
            </Text>
          )}
          {certTrade && (
            <Text style={{ fontSize: 12, color: '#065f46', marginTop: 2 }}>
              🛠️ <Text style={{ fontWeight: '700' }}>Verified Trade:</Text> {certTrade.toUpperCase()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Mismatch details card ─────────────────────────────────────────────────────
function MismatchCard({ mismatch }) {
  if (!mismatch) return null;
  return (
    <View
      style={{
        backgroundColor: '#fefce8',
        borderWidth: 1,
        borderColor: '#fde68a',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#78350f', marginBottom: 4 }}>
        Credential Scan Details:
      </Text>
      <Text style={{ fontSize: 12, color: '#78350f' }}>
        • Scanned Name:{' '}
        <Text style={{ fontWeight: '700' }}>{mismatch.scannedName || 'Not detected'}</Text>
        {'  '}
        {mismatch.nameMatched ? '✅ Matches profile' : `❌ Differs from: "${mismatch.profileName}"`}
      </Text>
      <Text style={{ fontSize: 12, color: '#78350f', marginTop: 3 }}>
        • Scanned Trade:{' '}
        <Text style={{ fontWeight: '700' }}>{mismatch.scannedTrade || 'Not detected'}</Text>
        {'  '}
        {mismatch.tradeMatched
          ? '✅ Matches skill'
          : `❌ Not in: [${(mismatch.profileSkills || []).join(', ')}]`}
      </Text>
      <Text style={{ fontSize: 11, color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>
        Tip: Ensure your profile name and skills match what's on the certificate.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VerificationScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function VerificationScreen({ onVerified, currentStatus }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null); // { uri, name, mimeType, size, preview }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(
    currentStatus && currentStatus !== 'unverified'
      ? {
          status: currentStatus,
          message:
            currentStatus === 'verified'
              ? 'Your certificate is verified and active on your profile.'
              : 'Your certificate is currently queued for manual review.',
          certName: null,
          certTrade: null,
        }
      : null
  );

  // ── Pick document (PDF or image) via expo-document-picker ──────────────────
  async function handlePickDocument() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset) return;

      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setError('File size must be under 10 MB.');
        return;
      }

      const mimeType = asset.mimeType || (asset.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const isImg = mimeType.startsWith('image/');

      setSelectedFile({
        uri: asset.uri,
        name: asset.name || 'certificate',
        mimeType,
        size: asset.size,
        preview: isImg ? asset.uri : null,
      });
      setResult(null);
    } catch (err) {
      setError('Failed to pick document. Please try again.');
    }
  }

  // ── Pick image via expo-image-picker ───────────────────────────────────────
  async function handlePickImage() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to pick a certificate image.',
          [{ text: 'OK' }]
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset) return;

      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName =
        asset.fileName || `certificate_${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;

      setSelectedFile({
        uri: asset.uri,
        name: fileName,
        mimeType,
        size: asset.fileSize,
        preview: asset.uri,
      });
      setResult(null);
    } catch (err) {
      setError('Failed to pick image. Please try again.');
    }
  }

  // ── Upload & verify ────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const { data } = await uploadCertificate(
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType,
        user?.id,
        (pct) => setUploadProgress(pct)
      );

      const scanResult = {
        status: data.verificationStatus,
        message: data.message,
        certName: data.certName || null,
        certTrade: data.certTrade || null,
        scanMethod: data.scanMethod || null,
        mismatch: data.mismatch || null,
      };
      setResult(scanResult);

      // Native alert feedback matching web's Alert.alert pattern
      if (data.verified) {
        Alert.alert(
          '✅ Certificate Verified!',
          `Your ITI/NCVT certificate was automatically matched.\n\nCandidate: ${(data.certName || '').toUpperCase()}\nTrade: ${(data.certTrade || '').toUpperCase()}\n\nYour profile is now Skill Verified.`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          '📋 Sent for Review',
          `Your certificate has been uploaded and routed to the Admin Dashboard for manual review.\n\n${data.message}`,
          [{ text: 'Understood' }]
        );
      }

      if (onVerified) onVerified(data);
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Upload failed. Please check your network and try again.';
      setError(msg);
      Alert.alert('Upload Failed', msg, [{ text: 'OK' }]);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setUploadProgress(0);
  }

  const isPdf = selectedFile?.mimeType === 'application/pdf';

  return (
    <ScrollView
      className="bg-gray-50 flex-1"
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Card Container ── */}
      <View
        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>📜</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              Skill Certificate Verification
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 20 }}>
            Upload your{' '}
            <Text style={{ fontWeight: '600' }}>ITI or Vocational Training Certificate</Text>. Our
            system scans the document to automatically verify your trade qualifications.
          </Text>

          {/* Format badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <View
              style={{
                backgroundColor: '#eff6ff',
                borderWidth: 1,
                borderColor: '#bfdbfe',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#1d4ed8' }}>
                🖼️ JPEG / PNG (Auto QR + AI OCR)
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#faf5ff',
                borderWidth: 1,
                borderColor: '#e9d5ff',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#7c3aed' }}>
                📄 PDF (NCVT / ITI e-Certificate)
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#f9fafb',
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, color: '#6b7280' }}>Up to 10 MB</Text>
            </View>
          </View>
        </View>

        {/* ── File Picker Buttons (only before result) ── */}
        {!result && (
          <>
            {/* Selected file preview area */}
            {selectedFile ? (
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: '#10b981',
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 14,
                  backgroundColor: '#f0fdf4',
                }}
              >
                {selectedFile.preview ? (
                  <Image
                    source={{ uri: selectedFile.preview }}
                    style={{ width: '100%', height: 180, borderRadius: 8, resizeMode: 'contain' }}
                  />
                ) : (
                  <Text style={{ fontSize: 48 }}>📄</Text>
                )}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: '#111827',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  {selectedFile.name}
                </Text>
                <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {selectedFile.size
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : selectedFile.mimeType}{' '}
                  · Ready to scan
                </Text>
              </View>
            ) : (
              /* Empty drop zone with picker buttons */
              <View
                style={{
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: 8 }}>📂</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Choose your certificate
                </Text>
                <Text
                  style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}
                >
                  National Trade Certificate (NTC), ITI, Vocational Diploma
                </Text>

                {/* Two picker buttons side by side */}
                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={{
                      flex: 1,
                      backgroundColor: '#eff6ff',
                      borderWidth: 1,
                      borderColor: '#93c5fd',
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>🖼️</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1d4ed8' }}>
                      Pick Image
                    </Text>
                    <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 1 }}>JPG / PNG</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePickDocument}
                    style={{
                      flex: 1,
                      backgroundColor: '#faf5ff',
                      borderWidth: 1,
                      borderColor: '#c4b5fd',
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>📄</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#7c3aed' }}>
                      Pick Document
                    </Text>
                    <Text style={{ fontSize: 10, color: '#8b5cf6', marginTop: 1 }}>
                      PDF / Image (ITI)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Error message */}
            {error && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: '#fef2f2',
                  borderWidth: 1,
                  borderColor: '#fecaca',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={{ fontSize: 13, color: '#b91c1c', flex: 1 }}>{error}</Text>
              </View>
            )}

            {/* Upload progress */}
            {uploading && uploadProgress > 0 && (
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    height: 6,
                    backgroundColor: '#e5e7eb',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${uploadProgress}%`,
                      backgroundColor: '#10b981',
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'right', marginTop: 4 }}>
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleUpload}
                disabled={!selectedFile || uploading}
                style={{
                  flex: 1,
                  backgroundColor: !selectedFile || uploading ? '#9ca3af' : '#059669',
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                      Scanning & Verifying…
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    🔍 Scan & Verify Certificate
                  </Text>
                )}
              </TouchableOpacity>

              {selectedFile && !uploading && (
                <TouchableOpacity
                  onPress={handleReset}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── Result panel ── */}
        {result && (
          <View>
            <StatusBadge
              status={result.status}
              certName={result.certName}
              certTrade={result.certTrade}
            />
            <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 10 }}>
              {result.message}
            </Text>
            <MismatchCard mismatch={result.mismatch} />
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#059669',
                  textDecorationLine: 'underline',
                  marginTop: 4,
                }}
              >
                Upload a different certificate
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Info note ── */}
      <View
        style={{
          backgroundColor: '#f0f9ff',
          borderWidth: 1,
          borderColor: '#bae6fd',
          borderRadius: 12,
          padding: 14,
          marginTop: 14,
        }}
      >
        <Text style={{ fontSize: 12, color: '#0369a1', lineHeight: 18 }}>
          ℹ️{' '}
          <Text style={{ fontWeight: '700' }}>How it works:</Text> Our system uses multi-layer
          scanning — QR code decoding, AI OCR text extraction, and PDF parsing — to automatically
          match your certificate with your profile details. Unreadable documents are queued for
          admin review.
        </Text>
      </View>
    </ScrollView>
  );
}
