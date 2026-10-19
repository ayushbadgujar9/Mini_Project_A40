const express = require('express');
const { isEmployer, verifyToken, isWorker } = require('../middleware/auth');
const Job  = require('../models/Job');
const User = require('../models/User');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Fairness Scoring Algorithm
//
// Scores a worker against a job. Higher score = better/fairer match.
//
// Components (max 100 pts):
//   Proximity  — same city as job           → +30 pts
//   Need       — days since lastWorkedDate  → up to +50 pts (capped at 60 days)
//   Verified   — isVerified === true        → +20 pts
//   Equity adj — penalise high completions  → −0 to −10 pts (fairness to newcomers)
// ─────────────────────────────────────────────────────────────────────────────
function calcFairnessScore(worker, job) {
  let score = 0;

  // ── Proximity (30 pts) ─────────────────────────────────────────────────────
  if (
    job.city &&
    worker.city &&
    job.city.trim().toLowerCase() === worker.city.trim().toLowerCase()
  ) {
    score += 30;
  }

  // ── Need (0–50 pts) ────────────────────────────────────────────────────────
  // Workers who haven't worked recently get priority.
  if (worker.lastWorkedDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(worker.lastWorkedDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    // Every day idle = +1 pt, capped at 50
    score += Math.min(daysSince, 50);
  } else {
    // Never worked → maximum need score (brand new worker)
    score += 50;
  }

  // ── Verification bonus (20 pts) ────────────────────────────────────────────
  if (worker.isVerified) score += 20;

  // ── Equity adjustment (−0 to −10 pts) ────────────────────────────────────
  // Workers with many completed jobs get a small penalty so newcomers aren't
  // perpetually locked out of work.
  const penaltyPer10Jobs = Math.min(Math.floor((worker.totalJobsCompleted || 0) / 10), 10);
  score -= penaltyPer10Jobs;

  return Math.max(0, Math.round(score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Geospatial Distance Helper (Haversine formula in Kilometers)
// ─────────────────────────────────────────────────────────────────────────────
function calculateDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // e.g. 1.2 km
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/nearby
// Accepts latitude, longitude, and maxDistanceInKm as query parameters.
// Uses MongoDB's $near operator on the GeoJSON Point location field
// using the 2dsphere index to return active jobs within the specified radius.
// Calculates and appends the distance in kilometers to each returned job object.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/nearby', async (req, res) => {
  try {
    const rawLat = req.query.latitude ?? req.query.lat;
    const rawLon = req.query.longitude ?? req.query.lng ?? req.query.lon;
    const rawRadius = req.query.maxDistanceInKm ?? req.query.radius;

    if (rawLat == null || rawLon == null || rawLat === '' || rawLon === '') {
      return res.status(400).json({
        message: 'latitude and longitude are required query parameters.',
      });
    }

    const latitude = parseFloat(rawLat);
    const longitude = parseFloat(rawLon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        message: 'latitude and longitude must be valid numbers.',
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        message: 'latitude must be between -90 and 90, and longitude between -180 and 180.',
      });
    }

    const maxDistanceInKm = rawRadius ? parseFloat(rawRadius) : 10;
    if (isNaN(maxDistanceInKm) || maxDistanceInKm <= 0) {
      return res.status(400).json({
        message: 'maxDistanceInKm must be a positive number.',
      });
    }

    const maxDistanceInMeters = maxDistanceInKm * 1000;

    // MongoDB geospatial query using $near with 2dsphere index
    const query = {
      status: 'open',
      isFlagged: { $ne: true },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude], // GeoJSON Point format: [lon, lat]
          },
          $maxDistance: maxDistanceInMeters,
        },
      },
    };

    if (req.query.skill && req.query.skill !== 'all') {
      query.requiredSkill = req.query.skill;
    }

    const jobs = await Job.find(query)
      .populate('employerId', 'name phoneNumber')
      .lean();

    // Calculate and append the distance in kilometers to each returned job object
    const jobsWithDistance = jobs.map((job) => {
      let distance = null;
      if (
        job.location &&
        Array.isArray(job.location.coordinates) &&
        job.location.coordinates.length === 2
      ) {
        const [jobLon, jobLat] = job.location.coordinates;
        distance = calculateDistanceInKm(latitude, longitude, jobLat, jobLon);
      }
      return {
        ...job,
        distance,
        distanceInKm: distance,
      };
    });

    return res.status(200).json({
      jobs: jobsWithDistance,
      count: jobsWithDistance.length,
      center: { latitude, longitude },
      maxDistanceInKm,
    });
  } catch (err) {
    console.error('Error fetching nearby jobs:', err);
    return res.status(500).json({
      message: 'Failed to fetch nearby jobs.',
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs
// Employer posts a new job listing.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', isEmployer, async (req, res) => {
  try {
    const { title, description, requiredSkill, dailyWage, city, location, latitude, longitude } = req.body;

    if (!title || !description || !requiredSkill || dailyWage == null) {
      return res.status(400).json({
        message: 'title, description, requiredSkill, and dailyWage are all required.',
      });
    }

    let jobLocation = { type: 'Point', coordinates: [74.24, 16.70] };
    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      jobLocation = {
        type: 'Point',
        coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
      };
    } else if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      jobLocation = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    const job = await Job.create({
      title:         title.trim(),
      description:   description.trim(),
      requiredSkill,
      dailyWage:     Number(dailyWage),
      employerId:    req.user.id,
      city:          city ? city.trim() : null,
      location:      jobLocation,
    });

    await job.populate('employerId', 'name');

    return res.status(201).json({ message: 'Job posted successfully.', job });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    return res.status(500).json({ message: 'Failed to post job.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs
// Returns all open jobs (newest first) with employer name populated.
// Any authenticated user can call this.
// Optional query param: ?mine=true  → only the calling employer's jobs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const filter = { status: 'open' };

    if (req.query.mine === 'true') {
      filter.employerId = req.user.id;
      delete filter.status;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .populate('employerId', 'name')
      .lean();

    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch jobs.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/matches/:jobId
// Returns a ranked list of workers for the given job, scored by the
// Fairness Engine. Only the employer who owns the job can call this.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/matches/:jobId', isEmployer, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({ message: 'Job not found.' });

    // Ensure caller owns the job
    if (job.employerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You do not own this job.' });
    }

    // Find all verified workers who have the required skill (accounting for aliases)
    const skillVariants = [job.requiredSkill];
    if (job.requiredSkill === 'electrician') skillVariants.push('electrical');
    if (job.requiredSkill === 'electrical') skillVariants.push('electrician');
    if (job.requiredSkill === 'masonry') skillVariants.push('masonary');
    if (job.requiredSkill === 'masonary') skillVariants.push('masonry');

    const workers = await User.find({
      role:   'worker',
      skills: { $in: skillVariants },
    })
      .select('name skills primarySkill isVerified city lastWorkedDate totalJobsCompleted')
      .lean();

    // Score & rank
    const ranked = workers
      .map((w) => ({ ...w, fairnessScore: calcFairnessScore(w, job) }))
      .sort((a, b) => b.fairnessScore - a.fairnessScore)
      .slice(0, 10); // Return top 10

    return res.status(200).json({ job, workers: ranked });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch matches.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/my-scores
// Called by a worker. Returns open jobs enriched with the worker's own
// fairnessScore so the UI can highlight "Fair Match" jobs.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-scores', isWorker, async (req, res) => {
  try {
    const worker = await User.findById(req.user.id)
      .select('skills primarySkill isVerified city lastWorkedDate totalJobsCompleted')
      .lean();

    if (!worker) return res.status(404).json({ message: 'Worker not found.' });

    // Only score jobs that match at least one of the worker's skills
    const jobs = await Job.find({ status: 'open' })
      .sort({ createdAt: -1 })
      .populate('employerId', 'name')
      .lean();

    const scored = jobs.map((job) => {
      const isSkillMatch = (worker.skills || []).some((s) => {
        if (s === job.requiredSkill) return true;
        if ((s === 'electrician' || s === 'electrical') && (job.requiredSkill === 'electrician' || job.requiredSkill === 'electrical')) return true;
        if ((s === 'masonry' || s === 'masonary') && (job.requiredSkill === 'masonry' || job.requiredSkill === 'masonary')) return true;
        return false;
      });
      const fairnessScore = isSkillMatch ? calcFairnessScore(worker, job) : 0;
      return { ...job, fairnessScore, isSkillMatch };
    });

    return res.status(200).json({ jobs: scored });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to score jobs.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/jobs/:id/complete
// Marks a job as closed/complete and updates the hired worker's stats.
// Only the employer who owns the job can call this.
// Body: { workerId }  — the worker being credited with the completion
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/complete', isEmployer, async (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ message: 'workerId is required.' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found.' });

    if (job.employerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You do not own this job.' });
    }

    if (job.status === 'closed') {
      return res.status(400).json({ message: 'Job is already closed.' });
    }

    // Verify the worker exists and has the required role
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // ── Update job ──────────────────────────────────────────────────────────
    job.status         = 'closed';
    job.hiredWorkerId  = workerId;
    await job.save();

    // ── Update worker's fairness stats ──────────────────────────────────────
    worker.lastWorkedDate      = new Date();
    worker.totalJobsCompleted  = (worker.totalJobsCompleted || 0) + 1;
    await worker.save();

    return res.status(200).json({
      message: `Job marked complete. ${worker.name}'s stats have been updated.`,
      job: { _id: job._id, status: job.status, hiredWorkerId: job.hiredWorkerId },
      worker: {
        _id:                worker._id,
        name:               worker.name,
        lastWorkedDate:     worker.lastWorkedDate,
        totalJobsCompleted: worker.totalJobsCompleted,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to complete job.', error: err.message });
  }
});

module.exports = router;
