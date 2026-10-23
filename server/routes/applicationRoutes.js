const express = require('express');
const { verifyToken, isWorker, isEmployer } = require('../middleware/auth');
const Application = require('../models/Application');
const Job  = require('../models/Job');
const User = require('../models/User');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/apply/:jobId
// Allows an authenticated worker to apply for a job.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/apply/:jobId', isWorker, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).lean();
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: 'This job is no longer accepting applications.' });
    }

    // Create application (compound index enforces uniqueness)
    const application = await Application.create({
      job:      job._id,
      worker:   req.user.id,
      employer: job.employerId,
    });

    return res.status(201).json({
      message: 'Application submitted successfully.',
      application,
    });
  } catch (err) {
    // Duplicate-key error from the compound unique index
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You have already applied for this job.' });
    }
    return res.status(500).json({ message: 'Failed to apply.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/my-applications
// Returns all applications for the logged-in worker, newest first.
// Populates job details and employer name.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-applications', isWorker, async (req, res) => {
  try {
    const applications = await Application.find({ worker: req.user.id })
      .sort({ appliedAt: -1 })
      .populate({
        path: 'job',
        select: 'title description requiredSkill dailyWage city status employerId assignedWorkerId offerPendingWorkerId',
        populate: { path: 'employerId', select: 'name phoneNumber email' },
      })
      .lean();

    return res.status(200).json({ applications });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch applications.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/job/:jobId
// Returns all applicants for a specific job. Only the employer who
// posted the job can view this list.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/job/:jobId', isEmployer, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).lean();
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.employerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You do not own this job.' });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .sort({ appliedAt: -1 })
      .populate({
        path: 'worker',
        select: 'name phoneNumber skills primarySkill isVerified city totalJobsCompleted',
      })
      .lean();

    return res.status(200).json({ applications });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch applicants.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applications/:id/status
// Allows the employer to update an application's status to accepted or rejected.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', isEmployer, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be either "accepted" or "rejected".',
      });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    // Only the employer who owns this job can update the status
    if (application.employer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You are not the employer for this application.' });
    }

    // Prevent updating already-decided applications
    if (application.status !== 'pending') {
      return res.status(400).json({
        message: `Application has already been ${application.status}. Cannot change status.`,
      });
    }

    application.status = status;
    await application.save();

    // Populate worker info before returning
    await application.populate('worker', 'name phoneNumber skills');

    return res.status(200).json({
      message: `Application ${status} successfully.`,
      application,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update status.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applications/:id/respond
// Worker accepts or rejects an employer's job request / offer.
// If accepted:
//   - application.status = 'accepted'
//   - job.status = 'assigned' (freezed for all other workers)
//   - job.assignedWorkerId = worker.id
//   - job.hiredWorkerId = worker.id
//   - job.offerPendingWorkerId = null
// If rejected:
//   - application.status = 'rejected'
//   - job.offerPendingWorkerId = null (job remains open)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/respond', isWorker, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "accept" or "reject".' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (application.worker.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You are not the recipient of this job request.' });
    }

    const job = await Job.findById(application.job);
    if (!job) {
      return res.status(404).json({ message: 'Job no longer exists.' });
    }

    if (action === 'accept') {
      if (job.status === 'closed') {
        return res.status(400).json({ message: 'This job is already closed.' });
      }
      if (job.status === 'assigned' && job.assignedWorkerId?.toString() !== req.user.id.toString()) {
        return res.status(400).json({ message: 'This job has already been assigned to another worker.' });
      }

      application.status = 'accepted';
      await application.save();

      // Freeze the job for all other workers
      job.status = 'assigned';
      job.assignedWorkerId = req.user.id;
      job.hiredWorkerId = req.user.id;
      job.offerPendingWorkerId = null;
      await job.save();

      return res.status(200).json({
        message: 'Job request accepted! The job is now assigned to you and frozen for other workers.',
        application,
        job,
      });
    } else {
      application.status = 'rejected';
      await application.save();

      if (job.offerPendingWorkerId?.toString() === req.user.id.toString()) {
        job.offerPendingWorkerId = null;
        await job.save();
      }

      return res.status(200).json({
        message: 'Job request declined.',
        application,
      });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to respond to job request.', error: err.message });
  }
});

module.exports = router;
