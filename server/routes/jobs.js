const express = require('express');
const jwt = require('jsonwebtoken');
const { isEmployer, verifyToken, isWorker } = require('../middleware/auth');
const Job  = require('../models/Job');
const User = require('../models/User');

const router = express.Router();

const SKILL_IDS = [
  'construction',
  'carpentry',
  'plumbing',
  'electrical',
  'cleaning',
  'driving',
  'painting',
  'welding',
  'masonry',
  'gardening',
  'security',
  'cooking',
];

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
// Regex & Query Parameter Helpers for Category & Skills Filtering
// ─────────────────────────────────────────────────────────────────────────────
function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Parses optional query parameters: `category` and `skills` (or `skill`).
 * Supports comma-separated strings or arrays.
 * Uses MongoDB's $in operator with case-insensitive regex ($options: 'i')
 * to filter against `category` and `skillsRequired` array fields in the Job schema.
 */
function buildCategoryAndSkillsQuery(reqQuery) {
  const conditions = [];

  // Parse category (comma-separated string or array)
  let categories = [];
  if (Array.isArray(reqQuery.category)) {
    categories = reqQuery.category.flatMap((c) => String(c).split(','));
  } else if (typeof reqQuery.category === 'string') {
    categories = reqQuery.category.split(',');
  }
  categories = categories
    .map((c) => c.trim())
    .filter((c) => c && c.toLowerCase() !== 'all' && c.toLowerCase() !== 'all jobs');

  if (categories.length > 0) {
    const categoryRegexes = categories.map((cat) => new RegExp(escapeRegex(cat), 'i'));
    conditions.push({
      $or: [
        { category: { $in: categoryRegexes } },
        { requiredSkill: { $in: categoryRegexes } },
      ],
    });
  }

  // Parse skills (comma-separated string or array; also support reqQuery.skill)
  let skills = [];
  const rawSkills = reqQuery.skills ?? reqQuery.skill;
  if (Array.isArray(rawSkills)) {
    skills = rawSkills.flatMap((s) => String(s).split(','));
  } else if (typeof rawSkills === 'string') {
    skills = rawSkills.split(',');
  }
  skills = skills
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== 'all');

  if (skills.length > 0) {
    const skillRegexes = skills.map((sk) => new RegExp(escapeRegex(sk), 'i'));
    conditions.push({
      $or: [
        { skillsRequired: { $in: skillRegexes } },
        { requiredSkill: { $in: skillRegexes } },
      ],
    });
  }

  return conditions;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/nearby
// Accepts latitude, longitude, and maxDistanceInKm as query parameters.
// Also supports category and skills query parameters for trade skill filtering.
// Uses MongoDB's $near operator on the GeoJSON Point location field
// using the 2dsphere index to return active jobs within the specified radius.
// Uses MongoDB's $in operator with case-insensitive regex ($options: 'i')
// to filter jobs against category and skillsRequired array fields in the Job schema.
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

    // Filter against category and skillsRequired array fields using $in operator with regex
    const filterConditions = buildCategoryAndSkillsQuery(req.query);
    if (filterConditions.length > 0) {
      query.$and = filterConditions;
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
// Automatically constructs GeoJSON Point location field [lng, lat] from
// forward-geocoded coordinates (latitude, longitude) or location object.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', isEmployer, async (req, res) => {
  try {
    const {
      title,
      description,
      skill,
      requiredSkill,
      category,
      skillsRequired,
      dailyWage,
      wage,
      city,
      location,
      latitude,
      longitude,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Job title is required.' });
    }

    const wageValue = dailyWage ?? wage;
    if (wageValue == null || isNaN(Number(wageValue)) || Number(wageValue) < 1) {
      return res.status(400).json({ message: 'A valid daily wage (minimum ₹1) is required.' });
    }

    const rawSkill = skill || requiredSkill || (Array.isArray(skillsRequired) && skillsRequired[0]) || 'Construction';
    const skillVal = String(rawSkill).trim();
    const normalizedSkill = skillVal.toLowerCase();

    // Determine skillsRequired array
    let finalSkillsRequired = [];
    if (Array.isArray(skillsRequired) && skillsRequired.length > 0) {
      finalSkillsRequired = skillsRequired.map((s) => String(s).trim());
    } else if (typeof skillsRequired === 'string' && skillsRequired.trim()) {
      finalSkillsRequired = skillsRequired.split(',').map((s) => s.trim());
    } else {
      finalSkillsRequired = [skillVal];
    }

    // Construct GeoJSON Point field: coordinates must be [longitude, latitude]
    let jobLocation = { type: 'Point', coordinates: [74.2433, 16.7049] }; // Fallback Kolhapur coordinates
    if (
      longitude != null &&
      latitude != null &&
      !isNaN(parseFloat(longitude)) &&
      !isNaN(parseFloat(latitude))
    ) {
      jobLocation = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)], // [lng, lat]
      };
    } else if (
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2 &&
      !isNaN(parseFloat(location.coordinates[0])) &&
      !isNaN(parseFloat(location.coordinates[1]))
    ) {
      jobLocation = {
        type: 'Point',
        coordinates: [parseFloat(location.coordinates[0]), parseFloat(location.coordinates[1])],
      };
    }

    const jobPayload = {
      title:         title.trim(),
      description:   description && description.trim() ? description.trim() : `${title.trim()} in ${city ? city.trim() : 'local area'}`,
      skillsRequired: finalSkillsRequired,
      requiredSkill: SKILL_IDS.includes(normalizedSkill) ? normalizedSkill : 'construction',
      category:      category ? category.trim() : undefined,
      city:          city ? city.trim() : null,
      wage:          Number(wageValue),
      dailyWage:     Number(wageValue),
      employerId:    req.user.id,
      location:      jobLocation,
    };

    const newJob = await Job.create(jobPayload);
    await newJob.populate('employerId', 'name phoneNumber');

    return res.status(201).json({ message: 'Job posted successfully.', job: newJob });
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
// Supports optional query parameters:
//   - category: string or comma-separated string or array
//   - skills: string or comma-separated string or array (or skill)
//   - mine=true (requires Bearer token, returns only calling employer's jobs)
// Uses MongoDB's $in operator with case-insensitive regex ($options: 'i')
// to filter jobs against category and skillsRequired array fields in the Job schema.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let authUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        authUser = decoded;
      } catch (_) {
        // Proceed unauthenticated unless mine=true
      }
    }

    const filter = { status: 'open', isFlagged: { $ne: true } };

    if (req.query.mine === 'true') {
      if (!authUser?.id) {
        return res.status(401).json({ message: 'Authentication required to view your jobs.' });
      }
      filter.employerId = authUser.id;
      delete filter.status;
      delete filter.isFlagged;
    }

    // Filter against category and skillsRequired array fields using $in operator with regex
    const filterConditions = buildCategoryAndSkillsQuery(req.query);
    if (filterConditions.length > 0) {
      filter.$and = filterConditions;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .populate('employerId', 'name phoneNumber')
      .lean();

    return res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    console.error('Error fetching jobs:', err);
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
