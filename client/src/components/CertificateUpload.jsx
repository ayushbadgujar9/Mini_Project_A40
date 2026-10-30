import { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Allowed types ────────────────────────────────────────────────────────────
const ALLOWED_TYPES   = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES  = 10 * 1024 * 1024; // 10 MB

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, certName, certTrade }) {
  const cfg = {
    verified: {
      bg:    'bg-emerald-50 border-emerald-300',
      icon:  '✅',
      text:  'text-emerald-900',
      label: 'Certificate Verified & Approved!',
    },
    pending: {
      bg:    'bg-amber-50 border-amber-300',
      icon:  '⏳',
      text:  'text-amber-900',
      label: 'Under Admin Review',
    },
    rejected: {
      bg:    'bg-red-50 border-red-300',
      icon:  '❌',
      text:  'text-red-900',
      label: 'Verification Rejected',
    },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${c.bg}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{c.icon}</span>
        <span className={`text-base font-bold ${c.text}`}>{c.label}</span>
      </div>
      {status === 'verified' && (certName || certTrade) && (
        <div className="text-xs text-emerald-800 mt-1 pl-7 space-y-0.5">
          {certName && <p>👤 <strong>Candidate Name:</strong> {certName.toUpperCase()}</p>}
          {certTrade && <p>🛠️ <strong>Verified Trade:</strong> {certTrade.toUpperCase()}</p>}
        </div>
      )}
    </div>
  );
}

// ── File icon helper ──────────────────────────────────────────────────────────
function FileTypeIcon({ file }) {
  if (!file) return <span className="text-4xl">📂</span>;
  if (file.type === 'application/pdf') return <span className="text-4xl">📄</span>;
  return <span className="text-4xl">🖼️</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CertificateUpload component
// ─────────────────────────────────────────────────────────────────────────────
export default function CertificateUpload({ onVerified, currentStatus }) {
  const { token: authToken } = useAuth();

  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(
    currentStatus && currentStatus !== 'unverified'
      ? {
          status:    currentStatus,
          message:   currentStatus === 'verified'
            ? 'Your certificate is verified and active on your profile.'
            : 'Your certificate is currently queued for manual review.',
          certName:  null,
          certTrade: null,
        }
      : null
  );
  const inputRef = useRef(null);

  function applyFile(selected) {
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Please upload an image (JPG, PNG) or digital PDF certificate.');
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError('File size must be under 10 MB.');
      return;
    }

    setFile(selected);
    setError(null);
    setResult(null);

    if (selected.type !== 'application/pdf') {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }
  }

  function handleFileChange(e) {
    applyFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    applyFile(e.dataTransfer.files?.[0]);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('certificate', file);

      const token = authToken
        || localStorage.getItem('fairconnect_token')
        || localStorage.getItem('token');

      const { data } = await axios.post(
        `${API_BASE}/api/verification/upload-certificate`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization:  `Bearer ${token}`,
          },
        }
      );

      setResult({
        status:     data.verificationStatus,
        message:    data.message,
        certName:   data.certName   || null,
        certTrade:  data.certTrade  || null,
        scanMethod: data.scanMethod || null,
        mismatch:   data.mismatch   || null,
      });

      if (onVerified) onVerified(data);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Upload failed. Please check your network and try again.'
      );
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const isPdf = file?.type === 'application/pdf';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 w-full shadow-sm">

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">📜</span>
          <h2 className="text-lg font-bold text-gray-800">Skill Certificate Verification</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Upload your <strong>ITI or Vocational Training Certificate</strong>. Our system scans the document
          directly to automatically verify your trade qualifications.
        </p>

        {/* Formats info */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            🖼️ JPEG / PNG (Auto QR + AI OCR)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
            📄 PDF (NCVT / ITI Digital e-Certificate)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-500">
            Up to 10 MB
          </span>
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <label
          htmlFor="cert-upload-input"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 w-full min-h-[160px] p-4
                     border-2 border-dashed border-gray-300 rounded-xl cursor-pointer
                     hover:border-emerald-500 hover:bg-emerald-50/20 transition-colors"
        >
          {preview && !isPdf ? (
            <img
              src={preview}
              alt="Certificate preview"
              className="max-h-48 w-auto rounded-lg object-contain shadow-sm"
            />
          ) : (
            <>
              <FileTypeIcon file={file} />
              {file ? (
                <div className="text-center px-2">
                  <span className="text-sm font-semibold text-gray-800 break-all block">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB · Ready to scan
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-sm font-semibold text-gray-700">
                    Click to browse or drag &amp; drop your certificate
                  </span>
                  <span className="text-xs text-gray-400 text-center">
                    National Trade Certificate (NTC), ITI, Vocational Diploma (PDF, JPG, PNG)
                  </span>
                </>
              )}
            </>
          )}

          <input
            id="cert-upload-input"
            ref={inputRef}
            type="file"
            accept="image/png, image/jpeg, application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}

      {/* Inline error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-base">⚠️</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Scan Result */}
      {result && (
        <div className="space-y-3 mt-3">
          <StatusBadge
            status={result.status}
            certName={result.certName}
            certTrade={result.certTrade}
          />

          <p className="text-sm text-gray-600 leading-relaxed">{result.message}</p>

          {/* Mismatch assistance note */}
          {result.mismatch && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50/80 px-4 py-3 text-xs text-yellow-900 space-y-1">
              <p className="font-bold">Credential Scan Details:</p>
              <p>• Scanned Name: <strong>{result.mismatch.scannedName || 'Not detected'}</strong> ({result.mismatch.nameMatched ? '✅ Matches profile' : '❌ Differs from profile name: "' + result.mismatch.profileName + '"'})</p>
              <p>• Scanned Trade: <strong>{result.mismatch.scannedTrade || 'Not detected'}</strong> ({result.mismatch.tradeMatched ? '✅ Matches skill' : '❌ Not in your skills: [' + (result.mismatch.profileSkills || []).join(', ') + ']'})</p>
              <p className="text-yellow-800 mt-1 italic">
                Tip: Make sure the profile name and selected trade match the name and trade on your certificate.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-800 transition-colors"
          >
            Upload a different certificate
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!result && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                       hover:bg-emerald-700 active:scale-95 transition-all shadow-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning &amp; Verifying Document…
              </span>
            ) : (
              'Scan & Verify Certificate'
            )}
          </button>

          {file && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
