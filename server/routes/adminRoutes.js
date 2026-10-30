const express = require('express');
const User = require('../models/User');
const Job = require('../models/Job');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Platform summary metrics: Total Users, Total Workers, Total Employers, Active Jobs, Pending Identity Reviews
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const [totalUsers, totalWorkers, totalEmployers, activeJobs, totalJobs, pendingReviews, verifiedWorkers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({}),
      User.countDocuments({
        role: 'worker',
        $or: [
          { verificationStatus: 'pending' },
          { isVerified: false, idImagePath: { $ne: null } },
        ],
      }),
      User.countDocuments({ role: 'worker', isVerified: true }),
    ]);

    return res.status(200).json({
      totalUsers,
      totalWorkers,
      totalEmployers,
      activeJobs,
      totalJobs,
      pendingReviews,
      pendingIdentityReviews: pendingReviews,
      total: totalWorkers,
      verified: verifiedWorkers,
      pending: pendingReviews,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch platform metrics.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/verifications
// Fetches all worker profiles with verificationStatus: 'pending' or uploaded ID document awaiting verification.
// Include fields for uploaded ID document URL, OCR-extracted text, full name, phone number, and signup date.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verifications', adminMiddleware, async (req, res) => {
  try {
    const filter = {
      role: 'worker',
      $or: [
        { verificationStatus: 'pending' },
        { isVerified: false, idImagePath: { $ne: null } },
      ],
    };

    const workers = await User.find(filter)
      .select('name phoneNumber skills primarySkill idImagePath ocrExtractedText verificationStatus rejectionReason isVerified createdAt certificate')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = workers.map((w) => {
      const idDocumentUrl = w.certificate?.fileUrl || (w.idImagePath ? `/uploads/${w.idImagePath.replace(/^\/uploads\//, '')}` : null);
      const idOcrText = w.certificate?.qrPayload || w.ocrExtractedText || 'No QR/OCR text extracted yet.';
      return {
        ...w,
        userId: w._id,
        fullName: w.name,
        phone: w.phoneNumber,
        idDocumentUrl,
        idOcrText: w.ocrExtractedText || 'No OCR text extracted yet.',
        ocrExtractedText: w.ocrExtractedText || 'No OCR text extracted yet.',
        signupDate: w.createdAt,
        verificationStatus: w.verificationStatus || (w.isVerified ? 'verified' : 'pending'),
      };
    });

    return res.status(200).json({ verifications: formatted, workers: formatted });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch pending verifications.', error: err.message });
  }
});

// Legacy helper route: GET /api/admin/workers/pending
router.get('/workers/pending', adminMiddleware, async (req, res) => {
  try {
    const workers = await User.find({
      role: 'worker',
      $or: [{ verificationStatus: 'pending' }, { isVerified: false }],
    })
      .select('name phoneNumber skills primarySkill idImagePath ocrExtractedText verificationStatus rejectionReason createdAt certificate')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = workers.map((w) => ({
      ...w,
      idDocumentUrl: w.idImagePath ? `/uploads/${w.idImagePath}` : null,
      idOcrText: w.ocrExtractedText,
      signupDate: w.createdAt,
    }));

    return res.status(200).json({ workers: formatted });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch pending workers.', error: err.message });
  }
});

// Legacy helper route: GET /api/admin/workers/verified
router.get('/workers/verified', adminMiddleware, async (req, res) => {
  try {
    const workers = await User.find({ role: 'worker', isVerified: true })
      .select('name phoneNumber skills primarySkill idImagePath ocrExtractedText verificationStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = workers.map((w) => ({
      ...w,
      idDocumentUrl: w.idImagePath ? `/uploads/${w.idImagePath}` : null,
      idOcrText: w.ocrExtractedText,
      signupDate: w.createdAt,
    }));

    return res.status(200).json({ workers: formatted });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch verified workers.', error: err.message });
  }
});

// Legacy helper route: GET /api/admin/workers/stats
router.get('/workers/stats', adminMiddleware, async (req, res) => {
  try {
    const [total, verified, pending] = await Promise.all([
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'worker', isVerified: true }),
      User.countDocuments({
        role: 'worker',
        $or: [{ verificationStatus: 'pending' }, { isVerified: false, idImagePath: { $ne: null } }],
      }),
    ]);

    return res.status(200).json({ total, verified, pending });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch stats.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/verify-user/:userId
// Updates a worker's verificationStatus to 'verified' or 'rejected', along with an optional rejectionReason string.
// Supports both PATCH & PUT methods for versatility.
// ─────────────────────────────────────────────────────────────────────────────
const handleVerifyUser = async (req, res) => {
  try {
    const userId = req.params.userId || req.params.id;
    const { status, verificationStatus, rejectionReason } = req.body;
    const targetStatus = verificationStatus || status;

    if (!targetStatus || !['verified', 'rejected', 'pending'].includes(targetStatus)) {
      return res.status(400).json({ message: "verificationStatus must be 'verified', 'rejected', or 'pending'." });
    }

    const update = {
      verificationStatus: targetStatus,
      isVerified: targetStatus === 'verified',
    };

    if (targetStatus === 'rejected') {
      update.rejectionReason = rejectionReason || 'Verification rejected by administrator.';
    } else if (targetStatus === 'verified') {
      update.rejectionReason = null;
    }

    const worker = await User.findOneAndUpdate(
      { _id: userId, role: 'worker' },
      update,
      { new: true }
    ).select('name phoneNumber role isVerified verificationStatus rejectionReason idImagePath ocrExtractedText');

    if (!worker) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    return res.status(200).json({
      message: `Worker "${worker.name}" status updated to ${targetStatus}.`,
      worker: {
        id: worker._id,
        name: worker.name,
        isVerified: worker.isVerified,
        verificationStatus: worker.verificationStatus,
        rejectionReason: worker.rejectionReason,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update verification status.', error: err.message });
  }
};

router.patch('/verify-user/:userId', adminMiddleware, handleVerifyUser);
router.put('/verify-user/:userId', adminMiddleware, handleVerifyUser);
router.put('/workers/:id/verify', adminMiddleware, (req, res) => {
  req.body.verificationStatus = 'verified';
  return handleVerifyUser(req, res);
});

// Legacy DELETE endpoint to delete worker account on reject if invoked via legacy interface
router.delete('/workers/:id', adminMiddleware, async (req, res) => {
  try {
    const worker = await User.findOneAndDelete({ _id: req.params.id, role: 'worker' });
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    return res.status(200).json({ message: `${worker.name}'s account has been removed.`, worker: { id: worker._id } });
  } catch (err) {
    return res.status(500).json({ message: 'Rejection failed.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/jobs
// Fetches all job postings with optional filtering for flagged/reported jobs.
// Query params: ?flagged=true or ?status=open|closed
// ─────────────────────────────────────────────────────────────────────────────
router.get('/jobs', adminMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.flagged === 'true') {
      filter.isFlagged = true;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .populate('employerId', 'name phoneNumber')
      .populate('hiredWorkerId', 'name lastWorkedDate totalJobsCompleted isVerified city')
      .lean();

    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch jobs.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/jobs/:jobId/flag
// Allows admins to flag or unflag job listings for moderation.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/jobs/:jobId/flag', adminMiddleware, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const { isFlagged, flagReason } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job posting not found.' });

    job.isFlagged = isFlagged !== undefined ? isFlagged : !job.isFlagged;
    if (flagReason !== undefined) job.flagReason = flagReason;
    await job.save();

    return res.status(200).json({
      message: `Job "${job.title}" flag status updated to ${job.isFlagged ? 'flagged' : 'unflagged'}.`,
      job,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update job flag status.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/jobs/:jobId
// Allows admins to remove inappropriate or spam job postings.
// ─────────────────────────────────────────────────────────────────────────────
const handleDeleteJob = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.params.id;
    const job = await Job.findByIdAndDelete(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Job posting not found.' });
    }

    return res.status(200).json({
      message: `Job posting "${job.title}" has been deleted successfully by admin.`,
      jobId: job._id,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete job posting.', error: err.message });
  }
};

router.delete('/jobs/:jobId', adminMiddleware, handleDeleteJob);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// Fetches all platform users (worker, employer, admin) with role/search filtering
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status && status !== 'all') {
      filter.verificationStatus = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phoneNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email role phoneNumber verificationStatus isVerified isEmailVerified city skills createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ users, total: users.length });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch users.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:userId/toggle-verify
// Toggle verification status of a user
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:userId/toggle-verify', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const nextVerified = !user.isVerified;
    user.isVerified = nextVerified;
    user.verificationStatus = nextVerified ? 'verified' : 'unverified';
    await user.save();

    return res.status(200).json({
      message: `User ${user.name} verification status set to ${user.verificationStatus}.`,
      user: {
        _id: user._id,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update user verification.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:userId
// Delete a user and associated jobs if employer
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/users/:userId', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) return res.status(404).json({ message: 'User not found.' });

    if (deleted.role === 'employer') {
      await Job.deleteMany({ employerId: deleted._id });
    }

    return res.status(200).json({ message: `User "${deleted.name}" has been removed.`, userId });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
});

module.exports = router;
