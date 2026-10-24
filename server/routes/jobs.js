const express = require('express');
const jwt = require('jsonwebtoken');
const { isEmployer, verifyToken, isWorker } = require('../middleware/auth');
const Job  = require('../models/Job');
const User = require('../models/User');
const Application = require('../models/Application');

const router = express.Router();

const SKILL_IDS = [
  'electrician',
  'electrical',
  'plumbing',
  'plumber',
  'masonry',
  'masonary',
  'construction',
  'carpentry',
  'cleaning',
  'driving',
  'painting',
  'welding',
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
//   Need       — days since lastWorkedDate  → up to +50 pts (capped at 50 days)
//   Verified   — isVerified === true        → +20 pts
//   Equity adj — penalise high completions  → −0 to −10 pts (fairness to newcomers)
//
// New-worker bonus: 25 pts (mid-range) — avoids dominating experienced workers.
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
    // Never worked → mid-range need score (25 pts) so new workers get a fair
    // boost without overshadowing experienced workers idle for 25+ days.
    score += 25;
  }

  // ── Verification bonus (20 pts) ────────────────────────────────────────────
  if (worker.isVerified) score += 20;

  // ── Equity adjustment (−0 to −10 pts) ────────────────────────────────────
  // Workers with many completed jobs get a small penalty so newcomers aren't
  // perpetually locked out of work.
  const penaltyPer10Jobs = Math.min(Math.floor((worker.totalJobsCompleted || 0) / 10), 10);
  score -= penaltyPer10Jobs;

  return Math.min(100, Math.max(0, Math.round(score)));
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
// Map of human-facing category labels to all matching requiredSkill values (including aliases).
// This ensures clicking e.g. "Plumbing" in the UI finds jobs posted with requiredSkill 'plumber'
// as well as 'plumbing', and "Electrical" also finds jobs posted as 'electrician', etc.
const CATEGORY_LABEL_TO_SKILL_ALIASES = {
  'plumbing':               ['plumbing', 'plumber'],
  'electrical':             ['electrical', 'electrician'],
  'construction / masonry': ['masonry', 'masonary', 'construction', 'carpentry', 'welding'],
  'construction':           ['construction', 'masonry', 'masonary', 'carpentry', 'welding'],
  'masonry':                ['masonry', 'masonary', 'construction'],
};

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
    // Build a combined $or that matches either:
    //   (a) the job's category field (regex match), OR
    //   (b) the job's requiredSkill field via expanded aliases
    const orClauses = [];
    const categoryRegexes = categories.map((cat) => new RegExp(escapeRegex(cat), 'i'));
    orClauses.push({ category: { $in: categoryRegexes } });

    // Expand each category label to its known requiredSkill aliases
    const expandedSkillValues = new Set();
    categories.forEach((cat) => {
      const aliases = CATEGORY_LABEL_TO_SKILL_ALIASES[cat.toLowerCase()];
      if (aliases) {
        aliases.forEach((a) => expandedSkillValues.add(a));
      } else {
        // Fallback: also try matching requiredSkill directly by the category string
        expandedSkillValues.add(cat.toLowerCase());
      }
    });

    if (expandedSkillValues.size > 0) {
      const skillAliasRegexes = Array.from(expandedSkillValues).map(
        (s) => new RegExp(`^${escapeRegex(s)}$`, 'i')
      );
      orClauses.push({ requiredSkill: { $in: skillAliasRegexes } });
    }

    conditions.push({ $or: orClauses });
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
      .populate('employerId', 'name')
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
      .populate('employerId', 'name')
      .lean();

    if (req.query.mine === 'true' && jobs.length > 0) {
      const jobIds = jobs.map((j) => j._id);
      const acceptedApps = await Application.find({
        job: { $in: jobIds },
        status: { $in: ['accepted', 'completed'] },
      })
        .populate('worker', 'name city')
        .lean();

      const appByJob = new Map();
      acceptedApps.forEach((a) => {
        appByJob.set(a.job.toString(), a);
      });

      const enriched = jobs.map((j) => ({
        ...j,
        acceptedApplication: appByJob.get(j._id.toString()) || null,
      }));

      return res.status(200).json({ jobs: enriched, count: enriched.length });
    }

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

    // Find all applications for this job
    let applications = await Application.find({ job: job._id }).lean();
    const appliedMap = new Map();
    applications.forEach((app) => {
      appliedMap.set(app.worker.toString(), {
        applicationId: app._id,
        status: app.status,
        appliedAt: app.appliedAt,
      });
    });

    // If job has an assigned/hired worker but no application document exists yet, auto-create one
    const activeAssignedId = job.assignedWorkerId || job.hiredWorkerId;
    if (activeAssignedId && !appliedMap.has(activeAssignedId.toString())) {
      try {
        const fallbackApp = await Application.create({
          job: job._id,
          worker: activeAssignedId,
          employer: job.employerId,
          status: job.status === 'closed' ? 'completed' : 'accepted',
          initiatedBy: 'employer',
        });
        appliedMap.set(activeAssignedId.toString(), {
          applicationId: fallbackApp._id,
          status: fallbackApp.status,
          appliedAt: fallbackApp.createdAt,
        });
      } catch (e) {
        // Compound index or conflict handled
      }
    }

    // Find all verified workers who have the required skill (accounting for aliases)
    const skillVariants = [job.requiredSkill];
    if (job.requiredSkill === 'electrician') skillVariants.push('electrical');
    if (job.requiredSkill === 'electrical') skillVariants.push('electrician');
    if (job.requiredSkill === 'masonry') skillVariants.push('masonary');
    if (job.requiredSkill === 'masonary') skillVariants.push('masonry');
    if (job.requiredSkill === 'plumbing') skillVariants.push('plumber');
    if (job.requiredSkill === 'plumber') skillVariants.push('plumbing');

    const appliedWorkerIds = Array.from(appliedMap.keys());

    const workers = await User.find({
      role:   'worker',
      $or: [
        { skills: { $in: skillVariants } },
        { _id: { $in: appliedWorkerIds } },
      ],
    })
      .select('name skills primarySkill isVerified city lastWorkedDate totalJobsCompleted')
      .lean();

    // Score & enrich workers
    const scoredWorkers = workers.map((w) => {
      const appInfo = appliedMap.get(w._id.toString());
      const isOfferPending = job.offerPendingWorkerId?.toString() === w._id.toString() || appInfo?.status === 'offered';
      const isAssigned = job.assignedWorkerId?.toString() === w._id.toString() || job.hiredWorkerId?.toString() === w._id.toString() || appInfo?.status === 'accepted';
      return {
        ...w,
        hasApplied: !!appInfo,
        applicationId: appInfo?.applicationId || null,
        applicationStatus: appInfo?.status || null,
        appliedAt: appInfo?.appliedAt || null,
        isOfferPending,
        isAssigned,
        fairnessScore: calcFairnessScore(w, job),
      };
    });

    // Applicants: workers who applied, ranked by fairnessScore
    const applicants = scoredWorkers
      .filter((w) => w.hasApplied)
      .sort((a, b) => b.fairnessScore - a.fairnessScore);

    // All matching workers: ranked by fairnessScore
    const allMatching = scoredWorkers
      .slice()
      .sort((a, b) => b.fairnessScore - a.fairnessScore);

    return res.status(200).json({
      job,
      applicants,
      allWorkers: allMatching,
      workers: allMatching, // backwards compatibility
    });
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
        if ((s === 'plumbing' || s === 'plumber') && (job.requiredSkill === 'plumbing' || job.requiredSkill === 'plumber')) return true;
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
    job.status               = 'closed';
    job.hiredWorkerId        = workerId;
    job.assignedWorkerId     = workerId;
    job.offerPendingWorkerId = null;
    await job.save();

    // ── Update worker's fairness stats ──────────────────────────────────────
    worker.lastWorkedDate      = new Date();
    worker.totalJobsCompleted  = (worker.totalJobsCompleted || 0) + 1;
    await worker.save();

    // ── Update Application status if exists ─────────────────────────────────
    await Application.findOneAndUpdate(
      { job: job._id, worker: workerId },
      { status: 'completed' }
    );

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/:id/request-worker
// Employer sends a job request to a matching worker.
// Body: { workerId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/request-worker', isEmployer, async (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) return res.status(400).json({ message: 'workerId is required.' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found.' });

    if (job.employerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You do not own this job.' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: `Cannot send request. Job status is currently "${job.status}".` });
    }

    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    // Update or create Application record
    let app = await Application.findOne({ job: job._id, worker: workerId });
    if (app) {
      app.status = 'offered';
      app.initiatedBy = 'employer';
      await app.save();
    } else {
      app = await Application.create({
        job: job._id,
        worker: workerId,
        employer: job.employerId,
        status: 'offered',
        initiatedBy: 'employer',
      });
    }

    job.offerPendingWorkerId = workerId;
    await job.save();

    return res.status(200).json({
      message: `Job request sent to ${worker.name}. Waiting for worker's acceptance.`,
      job,
      application: app,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send job request.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/:id/cancel-request
// Employer cancels the pending request sent to a worker.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel-request', isEmployer, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found.' });

    if (job.employerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You do not own this job.' });
    }

    if (job.offerPendingWorkerId) {
      await Application.findOneAndUpdate(
        { job: job._id, worker: job.offerPendingWorkerId },
        { status: 'rejected' }
      );
      job.offerPendingWorkerId = null;
      await job.save();
    }

    return res.status(200).json({
      message: 'Job request cancelled.',
      job,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to cancel job request.', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/:id/rate
// Hired worker submits a rating (1–5) and optional feedback for the employer
// after the job is closed.
//
// Auth:  Worker JWT (isWorker middleware)
// Body:  { rating: Number (1–5), feedback?: String }
// Rules:
//   • Job must be closed (status === 'closed')
//   • Caller must be the hiredWorkerId on the job
//   • Rating can only be submitted once (ratingSubmitted flag)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/rate', isWorker, async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    // ── Validate rating ──────────────────────────────────────────────────────
    const ratingNum = Number(rating);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });
    }
    if (feedback && typeof feedback === 'string' && feedback.trim().length > 500) {
      return res.status(400).json({ message: 'Feedback cannot exceed 500 characters.' });
    }

    // ── Fetch job ────────────────────────────────────────────────────────────
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found.' });

    // ── Job must be closed ───────────────────────────────────────────────────
    if (job.status !== 'closed') {
      return res.status(400).json({ message: 'You can only rate a completed (closed) job.' });
    }

    // ── Caller must be the hired worker ──────────────────────────────────────
    if (!job.hiredWorkerId || job.hiredWorkerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Only the hired worker can rate this job.' });
    }

    // ── Prevent duplicate ratings ────────────────────────────────────────────
    if (job.ratingSubmitted) {
      return res.status(409).json({ message: 'You have already submitted a rating for this job.' });
    }

    // ── Save rating on the job ───────────────────────────────────────────────
    job.workerRating    = ratingNum;
    job.workerFeedback  = feedback ? feedback.trim() : null;
    job.ratingSubmitted = true;
    job.ratedAt         = new Date();
    await job.save();

    // ── Update employer's aggregate rating ───────────────────────────────────
    const employer = await User.findById(job.employerId);
    if (employer) {
      const prevCount  = employer.employerRatingCount || 0;
      const prevRating = employer.employerRating || 0;

      // Recalculate running average
      const newCount  = prevCount + 1;
      const newRating = parseFloat(
        ((prevRating * prevCount + ratingNum) / newCount).toFixed(2)
      );

      employer.employerRatingCount = newCount;
      employer.employerRating      = newRating;

      // Keep the last 10 feedback entries (newest first)
      const worker = await User.findById(req.user.id).select('name');
      employer.employerFeedbacks.unshift({
        jobId:      job._id,
        rating:     ratingNum,
        feedback:   feedback ? feedback.trim() : null,
        workerName: worker ? worker.name : 'Anonymous',
        ratedAt:    job.ratedAt,
      });
      if (employer.employerFeedbacks.length > 10) {
        employer.employerFeedbacks = employer.employerFeedbacks.slice(0, 10);
      }

      await employer.save();
    }

    return res.status(200).json({
      message: 'Thank you! Your rating has been submitted.',
      jobId:          job._id,
      workerRating:   job.workerRating,
      workerFeedback: job.workerFeedback,
      ratedAt:        job.ratedAt,
      employer: employer
        ? {
            _id:                employer._id,
            name:               employer.name,
            employerRating:     employer.employerRating,
            employerRatingCount: employer.employerRatingCount,
          }
        : null,
    });
  } catch (err) {
    console.error('Rate job error:', err);
    return res.status(500).json({ message: 'Failed to submit rating.', error: err.message });
  }
});

module.exports = router;

