/**
 * fairnessScore.js
 * Utility to calculate custom fairness score for daily-wage workers on FairConnect.
 *
 * Scoring Rules:
 *  1. Local Residency Status:
 *     - worker.isLocal or city match ? 15 : 0 points
 *  2. Experience & Progression:
 *     - Starts at a base of 10 points for new workers
 *     - Increases by +1 per completed job (worker.stats.totalCompleted)
 *     - Strictly capped at 20 points max: Math.min(20, 10 + completedJobs)
 *  3. Customer Feedback:
 *     - Mapped proportionally from the average 5-star rating:
 *       ((worker.ratings.average / 5) * 5) -> max 5 points
 *  4. ID Verification:
 *     - isVerified || verificationStatus === 'verified' ? 10 : 0 points
 *
 * Total Score:
 *  - Sum of Local Residency (0 or 15) + Experience (10 to 20) + Feedback (0 to 5) + ID Verification (0 or 10)
 *  - Range: 10 to 50 points max
 */

/**
 * Calculates fairness score and component breakdown for a worker.
 * @param {Object} worker - User document or worker object
 * @param {Object} [job] - Optional job document for proximity/locality checking
 * @returns {Object} { totalScore, residencyScore, experienceScore, feedbackScore, verificationScore, isLocal, isVerified }
 */
function calculateFairnessScore(worker, job = null) {
  if (!worker) {
    return {
      totalScore: 10,
      residencyScore: 0,
      experienceScore: 10,
      feedbackScore: 0,
      verificationScore: 0,
      isLocal: false,
      isVerified: false,
    };
  }

  // 1. Local Residency: 15 points if local (either worker.isLocal is true, or worker's city matches job city)
  const isCityMatch = Boolean(
    job?.city &&
    worker.city &&
    job.city.trim().toLowerCase() === worker.city.trim().toLowerCase()
  );
  const isLocal = Boolean(worker.isLocal || isCityMatch);
  const residencyScore = isLocal ? 15 : 0;

  // 2. Experience & Progression: Base 10, +1 per completed job, strictly capped at 20
  const completedJobs = Number(
    worker.stats?.totalCompleted ??
    worker.totalJobsCompleted ??
    0
  );
  const safeCompletedJobs = Math.max(0, isNaN(completedJobs) ? 0 : completedJobs);
  const experienceScore = Math.min(20, 10 + safeCompletedJobs);

  // 3. Customer Feedback: Mapped proportionally from 5-star average rating ((avg / 5) * 5)
  const avgRating = Number(
    worker.ratings?.average ??
    0
  );
  const safeAvgRating = Math.max(0, Math.min(5, isNaN(avgRating) ? 0 : avgRating));
  const feedbackScore = parseFloat(((safeAvgRating / 5) * 5).toFixed(2));

  // 4. ID Verification: 10 points if verified
  const isVerified = Boolean(
    worker.isVerified ||
    worker.verificationStatus === 'verified'
  );
  const verificationScore = isVerified ? 10 : 0;

  // Sum of components (10 to 50 max)
  const totalScore = parseFloat(
    (residencyScore + experienceScore + feedbackScore + verificationScore).toFixed(2)
  );

  return {
    totalScore,
    residencyScore,
    experienceScore,
    feedbackScore,
    verificationScore,
    isLocal,
    isVerified,
  };
}

module.exports = {
  calculateFairnessScore,
};

