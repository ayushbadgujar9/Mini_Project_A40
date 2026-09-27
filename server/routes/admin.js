const express = require('express');
const User    = require('../models/User');
const Job     = require('../models/Job');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/workers/pending
// Returns all workers where isVerified === false, including their ID image path.
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/workers/pending', isAdmin, async (req, res) => {
  try {
    const workers = await User.find({ role: 'worker', isVerified: false })
      .select('name phoneNumber skills primarySkill idImagePath createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ workers });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch pending workers.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/workers/verified
// Returns all workers where isVerified === true.
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/workers/verified', isAdmin, async (req, res) => {
  try {
    const workers = await User.find({ role: 'worker', isVerified: true })
      .select('name phoneNumber skills primarySkill idImagePath createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ workers });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch verified workers.', error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/workers/stats
// Returns quick summary counts for the dashboard header.
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/workers/stats', isAdmin, async (req, res) => {
  try {
    const [total, verified, pending] = await Promise.all([
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'worker', isVerified: true }),
      User.countDocuments({ role: 'worker', isVerified: false }),
    ]);

    return res.status(200).json({ total, verified, pending });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch stats.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/workers/:id/verify
// Approves a worker — sets isVerified to true.
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/workers/:id/verify', isAdmin, async (req, res) => {
  try {
    const worker = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'worker' },
      { isVerified: true },
      { new: true }
    ).select('name isVerified');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    return res.status(200).json({
      message: `${worker.name} has been verified successfully.`,
      worker: { id: worker._id, name: worker.name, isVerified: worker.isVerified },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Verification failed.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/workers/:id
// Rejects a worker — permanently removes them from the database.
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/workers/:id', isAdmin, async (req, res) => {
  try {
    const worker = await User.findOneAndDelete({ _id: req.params.id, role: 'worker' });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    return res.status(200).json({
      message: `${worker.name}'s account has been rejected and removed.`,
      worker: { id: worker._id, name: worker.name },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Rejection failed.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/jobs
// Returns ALL jobs (any status) with employer name and, for closed jobs, the
// hired worker's name + key fairness stats (lastWorkedDate, totalJobsCompleted).
// Protected: admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/jobs', isAdmin, async (req, res) => {
  try {
    const jobs = await Job.find({})
      .sort({ createdAt: -1 })
      .populate('employerId',    'name')
      .populate('hiredWorkerId', 'name lastWorkedDate totalJobsCompleted isVerified city')
      .lean();

    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch jobs.', error: err.message });
  }
});

module.exports = router;

