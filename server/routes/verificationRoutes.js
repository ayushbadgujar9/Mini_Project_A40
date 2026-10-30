/**
 * verificationRoutes.js
 * POST /api/verification/upload-certificate
 *
 * Automated Multi-Format Verification Engine:
 *   • PDF documents:
 *       - Direct digital text extraction via PDFParse
 *       - Auto-extracts Candidate Name and Trade / Skill
 *       - Validates against NCVT / ITI vocational training keywords
 *       - Matches credentials with user profile -> Instant Auto-Verification!
 *   • Image uploads (JPEG / PNG):
 *       - Layer 1: Embedded QR Code scan (Jimp + qrcode-reader)
 *       - Layer 2: Automated Tesseract OCR text recognition fallback
 *       - Matches credentials with user profile -> Instant Auto-Verification!
 *   • Fallback:
 *       - If document credentials do not match profile or document is unreadable,
 *         gracefully saves the file and queues for admin review.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { Jimp } = require('jimp');
const QrCode   = require('qrcode-reader');
const Tesseract = require('tesseract.js');
const { PDFParse } = require('pdf-parse');

const { verifyToken, isWorker } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// ── Upload directory ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Allowed MIME types ────────────────────────────────────────────────────────
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const PDF_TYPE    = 'application/pdf';
const ALL_TYPES   = [...IMAGE_TYPES, PDF_TYPE];

// ── Multer setup (10 MB limit) ───────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALL_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG images or PDF documents are accepted.'));
    }
  },
});

// ── Helper: determine file category ──────────────────────────────────────────
function getFileCategory(mimetype) {
  if (IMAGE_TYPES.includes(mimetype)) return 'image';
  if (mimetype === PDF_TYPE)          return 'pdf';
  return 'unknown';
}

function safeExtension(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/jpg':  '.jpg',
    'image/png':  '.png',
    'application/pdf': '.pdf',
  };
  return mimeMap[file.mimetype] || ext || '.bin';
}

// ── Helper: QR Code decoding from image buffer ────────────────────────────────
function decodeQrFromBuffer(imageBuffer) {
  return new Promise((resolve) => {
    Jimp.read(imageBuffer)
      .then((jimpImg) => {
        const qr = new QrCode();
        qr.callback = (err, result) => {
          if (err || !result || !result.result) {
            resolve(null);
          } else {
            resolve(result.result);
          }
        };
        qr.decode(jimpImg.bitmap);
      })
      .catch((err) => {
        console.warn('[QR Decode warning]:', err.message);
        resolve(null);
      });
  });
}

// ── Helper: parse QR Payload ─────────────────────────────────────────────────
function parseQrPayload(payload) {
  if (!payload || typeof payload !== 'string') return { name: null, trade: null };

  // 1. JSON parse
  try {
    const obj = JSON.parse(payload);
    const name  = (obj.name || obj.candidate_name || obj.candidateName || obj.trainee_name || '').trim().toLowerCase();
    const trade = (obj.trade || obj.skill || obj.course || '').trim().toLowerCase();
    if (name || trade) return { name: name || null, trade: trade || null };
  } catch (_) {}

  // 2. Line parsing
  const lines = payload.split(/\r?\n/);
  let name  = null;
  let trade = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/candidate\s*name|trainee\s*name|name\s*[:\-]/i.test(lower)) {
      name = line.split(/[:\-]/)[1]?.trim().toLowerCase() || null;
    } else if (/^trade\s*[:\-]|^skill\s*[:\-]|^course\s*[:\-]/i.test(line)) {
      trade = line.split(/[:\-]/)[1]?.trim().toLowerCase() || null;
    }
  }

  return { name, trade };
}

// ── Helper: Extract Name and Trade from Document Text (PDF or OCR) ───────────
function extractCredentialsFromDocumentText(text) {
  if (!text || typeof text !== 'string') return { certName: null, certTrade: null, isAuthenticVocational: false };

  let certName = null;
  let certTrade = null;

  // Check authenticity keywords (NCVT, ITI, Vocational, Skill Development, etc.)
  const authenticKeywords = [
    'national council for vocational training',
    'national trade certificate',
    'ministry of skill development',
    'vocational training',
    'industrial training institute',
    'trade test',
    'all india trade test',
    'directorate general of training',
    'ncvt'
  ];
  const lowerText = text.toLowerCase();
  const isAuthenticVocational = authenticKeywords.some(kw => lowerText.includes(kw));

  // 1. Name extraction
  const nameRegexes = [
    /(?:Shri\/Smt\/Kumari|Shri|Smt|Kumari)\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
    /(?:Candidate\s*Name|Trainee\s*Name|Name\s*of\s*(?:the\s*)?Trainee|Name\s*of\s*(?:the\s*)?Candidate|Student\s*Name)\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
    /(?:^|\n)\s*Name\s*[:\-]\s*([A-Za-z\s]{3,40})/i
  ];
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      const clean = m[1].replace(/[\r\n].*/s, '').replace(/\b(?:Son|Daughter|Wife|Father|Mother|Roll|Date|Institute)\b.*/i, '').trim();
      if (clean.length >= 2) {
        certName = clean.toLowerCase();
        break;
      }
    }
  }

  // 2. Trade extraction
  const tradeRegexes = [
    /(?:Name\s*of\s*(?:the\s*)?Trade|Trade\s*Name)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /(?:^|\n)\s*Trade\s*[:\-]?\s*([A-Za-z\s]{3,30})/i
  ];
  for (const re of tradeRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      const clean = m[1].replace(/[\r\n].*/s, '').replace(/\b(?:Training|Roll|Duration|Session|Semester|Year)\b.*/i, '').trim();
      if (clean.length >= 2 && !clean.toLowerCase().includes('certificate')) {
        certTrade = clean.toLowerCase();
        break;
      }
    }
  }

  // 3. Trade keyword match fallback
  if (!certTrade) {
    const commonTrades = ['electrician', 'plumbing', 'plumber', 'masonry', 'mason', 'carpenter', 'welder', 'fitter', 'painter', 'mechanic', 'wireman', 'turner', 'machinist'];
    for (const t of commonTrades) {
      if (new RegExp('\\b' + t + '\\b', 'i').test(lowerText)) {
        certTrade = t;
        break;
      }
    }
  }

  return { certName, certTrade, isAuthenticVocational };
}

// ── Helper: Match Certificate Data with User Profile ─────────────────────────
function checkProfileMatch(user, certName, certTrade) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const userName = (user.name || '').trim().toLowerCase();
  const userTokens = userName.split(/\s+/).filter(Boolean);
  const certTokens = (certName || '').toLowerCase().split(/\s+/).filter(Boolean);

  // Name matches if full string matches OR first/last name tokens match
  const nameMatch = Boolean(
    certName && (
      userName.includes(certName) ||
      certName.includes(userName) ||
      userTokens.some(ut => ut.length >= 3 && certTokens.some(ct => ct.length >= 3 && (ut.includes(ct) || ct.includes(ut))))
    )
  );

  // Normalize trade and check against user skills
  const allUserSkills = [
    user.primarySkill,
    ...(user.skills || [])
  ].filter(Boolean).map(norm);

  const normCertTrade = norm(certTrade);
  const tradeMatch = Boolean(
    normCertTrade && allUserSkills.some(s => 
      s.includes(normCertTrade) || 
      normCertTrade.includes(s) || 
      (s === 'plumbing' && normCertTrade === 'plumber') ||
      (s === 'plumber' && normCertTrade === 'plumbing') ||
      (s === 'masonry' && normCertTrade === 'mason') ||
      (s === 'mason' && normCertTrade === 'masonry')
    )
  );

  return { nameMatch, tradeMatch };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/verification/upload-certificate
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/upload-certificate',
  verifyToken,
  isWorker,
  upload.single('certificate'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded. Please attach a JPEG, PNG, or PDF certificate.',
      });
    }

    const fileCategory = getFileCategory(req.file.mimetype);

    try {
      // 1. Fetch current worker profile
      const user = await User.findById(req.user.id).select(
        'name skills primarySkill verificationStatus certificate isVerified'
      );
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // 2. Save uploaded document to disk
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext          = safeExtension(req.file);
      const filename     = `cert-${uniqueSuffix}${ext}`;
      const destPath     = path.join(uploadsDir, filename);

      fs.writeFileSync(destPath, req.file.buffer);

      let extractedName = null;
      let extractedTrade = null;
      let qrPayload = null;
      let scanMethod = 'unknown';

      // ══════════════════════════════════════════════════════════════════════
      // CASE 1: PDF DOCUMENT PROCESSING
      // ══════════════════════════════════════════════════════════════════════
      if (fileCategory === 'pdf') {
        scanMethod = 'pdf-parser';
        try {
          const parser = new PDFParse(new Uint8Array(req.file.buffer));
          const pdfData = await parser.getText();
          const docText = pdfData?.text || '';

          const parsed = extractCredentialsFromDocumentText(docText);
          extractedName = parsed.certName;
          extractedTrade = parsed.certTrade;
        } catch (pdfErr) {
          console.warn('[PDF Parsing error]:', pdfErr.message);
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // CASE 2: IMAGE PROCESSING (QR Scan -> OCR Fallback)
      // ══════════════════════════════════════════════════════════════════════
      if (fileCategory === 'image') {
        // Step A: Attempt QR decoding
        qrPayload = await decodeQrFromBuffer(req.file.buffer);

        if (qrPayload) {
          scanMethod = 'qr-code';
          const qrData = parseQrPayload(qrPayload);
          extractedName = qrData.name;
          extractedTrade = qrData.trade;
        }

        // Step B: If QR didn't yield both credentials, run AI OCR on image
        if (!extractedName || !extractedTrade) {
          scanMethod = qrPayload ? 'qr-code + ocr' : 'tesseract-ocr';
          try {
            const { data: { text: ocrText } } = await Tesseract.recognize(destPath, 'eng');
            const ocrParsed = extractCredentialsFromDocumentText(ocrText);
            if (!extractedName) extractedName = ocrParsed.certName;
            if (!extractedTrade) extractedTrade = ocrParsed.certTrade;
          } catch (ocrErr) {
            console.warn('[OCR Parsing error]:', ocrErr.message);
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // CREDENTIAL CROSS-CHECK
      // ══════════════════════════════════════════════════════════════════════
      const { nameMatch, tradeMatch } = checkProfileMatch(user, extractedName, extractedTrade);

      // SUCCESS: Auto-Verification Approved!
      if (nameMatch && tradeMatch) {
        await User.findByIdAndUpdate(req.user.id, {
          isVerified:               true,
          verificationStatus:       'verified',
          'certificate.fileUrl':    filename,
          'certificate.fileType':   fileCategory,
          'certificate.qrPayload':  qrPayload,
          'certificate.verifiedAt': new Date(),
        });

        return res.status(200).json({
          verified:           true,
          verificationStatus: 'verified',
          fileType:           fileCategory,
          scanMethod,
          certName:           extractedName,
          certTrade:          extractedTrade,
          message:
            `Certificate verified successfully! Matched candidate "${extractedName.toUpperCase()}" with trade "${extractedTrade.toUpperCase()}". Your profile is now Skill Verified.`,
        });
      }

      // FALLBACK: Could not verify automatically -> Queue for manual admin review
      await User.findByIdAndUpdate(req.user.id, {
        isVerified:               false,
        verificationStatus:       'pending',
        'certificate.fileUrl':    filename,
        'certificate.fileType':   fileCategory,
        'certificate.qrPayload':  qrPayload,
        'certificate.verifiedAt': null,
      });

      let mismatchReason = '';
      if (!nameMatch && !tradeMatch) {
        mismatchReason = 'Could not match candidate name and trade to your profile.';
      } else if (!nameMatch) {
        mismatchReason = `Found trade "${extractedTrade || 'trade'}" but certificate name did not match your profile name "${user.name}".`;
      } else if (!tradeMatch) {
        mismatchReason = `Verified candidate name "${extractedName || 'name'}" but trade did not match your selected skills.`;
      }

      return res.status(200).json({
        verified:           false,
        verificationStatus: 'pending',
        fileType:           fileCategory,
        scanMethod,
        certName:           extractedName,
        certTrade:          extractedTrade,
        message:
          `Document scanned (${scanMethod}). ${mismatchReason} Sent to admin for manual confirmation.`,
        mismatch: {
          nameMatched:  nameMatch,
          tradeMatched: tradeMatch,
          scannedName:  extractedName,
          scannedTrade: extractedTrade,
          profileName:  user.name,
          profileSkills: [user.primarySkill, ...(user.skills || [])].filter(Boolean),
        },
      });
    } catch (err) {
      console.error('[upload-certificate] Error:', err);
      return res.status(500).json({
        message: 'Certificate scanning failed.',
        error:   err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/verification/status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', verifyToken, isWorker, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'verificationStatus isVerified certificate'
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.status(200).json({
      isVerified:         user.isVerified,
      verificationStatus: user.verificationStatus,
      certificate: {
        fileUrl:    user.certificate?.fileUrl    || null,
        fileType:   user.certificate?.fileType   || null,
        verifiedAt: user.certificate?.verifiedAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch status.', error: err.message });
  }
});

module.exports = router;
