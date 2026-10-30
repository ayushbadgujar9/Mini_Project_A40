const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const { calculateFairnessScore } = require('../utils/fairnessScore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ratings/submit
// Submit a 1-5 star rating and optional feedback for a worker.
// Automatically recalculates average rating and updates the worker's fairness score.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { workerId, jobId, rating, feedback } = req.body;

    // 1. Validation
    if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({ message: 'A valid workerId is required.' });
    }

    const ratingNum = Number(rating);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });
    }

    if (feedback && typeof feedback === 'string' && feedback.trim().length > 500) {
      return res.status(400).json({ message: 'Feedback cannot exceed 500 characters.' });
    }

    // 2. Fetch worker
    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    if (worker.role !== 'worker') {
      return res.status(400).json({ message: 'The specified user is not a worker.' });
    }

    // 3. Initialize ratings structure if missing
    if (!worker.ratings) {
      worker.ratings = {
        average: 0,
        count: 0,
        scores: [],
        feedbacks: [],
      };
    }
    if (!Array.isArray(worker.ratings.scores)) {
      worker.ratings.scores = [];
    }
    if (!Array.isArray(worker.ratings.feedbacks)) {
      worker.ratings.feedbacks = [];
    }

    // 4. Record new rating score
    const safeRating = Math.max(1, Math.min(5, Math.round(ratingNum)));
    worker.ratings.scores.push(safeRating);
    worker.ratings.count = worker.ratings.scores.length;

    // Recalculate running average
    const totalSum = worker.ratings.scores.reduce((acc, curr) => acc + curr, 0);
    worker.ratings.average = parseFloat((totalSum / worker.ratings.count).toFixed(2));

    // 5. Fetch employer details for feedback attribution
    let employerName = 'Employer';
    if (req.user?.id) {
      const employer = await User.findById(req.user.id).select('name');
      if (employer?.name) employerName = employer.name;
    }

    // Add feedback entry
    worker.ratings.feedbacks.unshift({
      jobId: jobId && mongoose.Types.ObjectId.isValid(jobId) ? jobId : null,
      employerId: req.user?.id || null,
      rating: safeRating,
      feedback: feedback && typeof feedback === 'string' ? feedback.trim() : null,
      employerName,
      ratedAt: new Date(),
    });

    if (worker.ratings.feedbacks.length > 20) {
      worker.ratings.feedbacks = worker.ratings.feedbacks.slice(0, 20);
    }

    // 6. Sync job completion count if job is referenced
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      const job = await Job.findById(jobId);
      if (job) {
        if (!worker.stats) {
          worker.stats = { totalCompleted: worker.totalJobsCompleted || 0 };
        }
        // If job was completed/closed, ensure count reflects it
        const currentCompleted = Math.max(worker.stats.totalCompleted || 0, worker.totalJobsCompleted || 0);
        worker.stats.totalCompleted = currentCompleted;
        worker.totalJobsCompleted   = currentCompleted;
      }
    }

    // 7. Automatically recalculate custom Fairness Score
    const breakdown = calculateFairnessScore(worker);
    worker.fairnessScore = breakdown.totalScore;

    await worker.save();

    return res.status(200).json({
      success: true,
      message: 'Rating submitted successfully and worker fairness score updated.',
      workerId: worker._id,
      workerName: worker.name,
      ratings: {
        average: worker.ratings.average,
        count: worker.ratings.count,
        latestRating: safeRating,
      },
      fairnessScore: worker.fairnessScore,
      breakdown,
    });
  } catch (err) {
    console.error('[RatingRoutes] Submit error:', err);
    return res.status(500).json({ message: 'Failed to submit rating.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ratings/worker/:id
// Get ratings summary and fairness score breakdown for a worker
// ─────────────────────────────────────────────────────────────────────────────
router.get('/worker/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid worker ID.' });
    }

    const worker = await User.findById(id).select(
      'name role isLocal stats totalJobsCompleted ratings fairnessScore'
    );
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    const breakdown = calculateFairnessScore(worker);

    return res.status(200).json({
      workerId: worker._id,
      name: worker.name,
      isLocal: Boolean(worker.isLocal),
      completedJobs: worker.stats?.totalCompleted || worker.totalJobsCompleted || 0,
      ratings: {
        average: worker.ratings?.average || 0,
        count: worker.ratings?.count || 0,
        feedbacks: (worker.ratings?.feedbacks || []).slice(0, 5),
      },
      fairnessScore: worker.fairnessScore ?? breakdown.totalScore,
      breakdown,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch worker ratings.', error: err.message });
  }
});

module.exports = router;

