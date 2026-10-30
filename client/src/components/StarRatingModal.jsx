import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STAR_LABELS = {
  1: 'Poor · Needs Improvement',
  2: 'Fair · Acceptable Work',
  3: 'Good · Met Expectations',
  4: 'Very Good · High Quality Work',
  5: 'Excellent · Highly Recommended!',
};

/**
 * StarRatingModal
 * Clean, light-themed modal for employers to rate daily-wage workers (1-5 stars).
 * Updates worker ratings and dynamically recalculates custom Fairness Score.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - workerId: string (ID of worker to rate)
 *  - workerName: string (Name of worker)
 *  - jobId?: string (Optional associated job ID)
 *  - jobTitle?: string (Optional job title)
 *  - onSuccess?: (data) => void (Callback after rating submitted)
 */
export default function StarRatingModal({
  isOpen,
  onClose,
  workerId,
  workerName = 'Worker',
  jobId = null,
  jobTitle = null,
  onSuccess,
}) {
  const { token: authToken } = useAuth();

  const [rating, setRating]         = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen) return null;

  const activeStars = hoverRating || rating;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token =
        authToken ||
        localStorage.getItem('fairconnect_token') ||
        localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE}/api/ratings/submit`,
        {
          workerId,
          jobId,
          rating: Number(rating),
          feedback: feedback.trim() || undefined,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data;
      setSuccessResult(data);

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to submit rating. Please check your connection.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleModalClose() {
    setError(null);
    setSuccessResult(null);
    setFeedback('');
    setRating(5);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg max-w-md w-full relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleModalClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-lg p-1"
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <h2 className="text-lg font-bold text-gray-800">
              Rate Worker &amp; Feedback
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Rate <strong className="text-gray-800">{workerName}</strong>
            {jobTitle ? (
              <> for completing <span className="font-medium text-emerald-700">&ldquo;{jobTitle}&rdquo;</span></>
            ) : (
              ' for their work'
            )}.
          </p>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <span className="text-3xl block mb-1">🎉</span>
              <h3 className="font-bold text-emerald-900 text-base">
                Rating Submitted Successfully!
              </h3>
              <p className="text-xs text-emerald-700 mt-1">
                Thank you! Your feedback directly updated {workerName}&apos;s profile.
              </p>

              {/* Dynamic fairness score pill */}
              <div className="mt-3 inline-flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-3 py-1.5 shadow-xs">
                <span className="text-sm font-semibold text-gray-700">Fairness Score:</span>
                <span className="text-base font-extrabold text-emerald-600">
                  {successResult.fairnessScore} pts
                </span>
                <span className="text-xs text-gray-400">/ 40 max</span>
              </div>
            </div>

            {/* Score breakdown snippet */}
            {successResult.breakdown && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>📍 Local Residency:</span>
                  <span className="font-semibold text-gray-800">
                    +{successResult.breakdown.residencyScore} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🔨 Experience (10 base + jobs):</span>
                  <span className="font-semibold text-gray-800">
                    +{successResult.breakdown.experienceScore} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>⭐ Feedback Rating (5-star window):</span>
                  <span className="font-semibold text-emerald-700">
                    +{successResult.breakdown.feedbackScore} pts
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleModalClose}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Interactive 5-Star Row */}
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50/70 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-3xl transition-transform hover:scale-125 focus:outline-hidden"
                    aria-label={`Rate ${star} stars`}
                  >
                    <span
                      className={
                        star <= activeStars
                          ? 'text-amber-400 drop-shadow-xs'
                          : 'text-gray-300'
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <span className="mt-2 text-xs font-semibold text-gray-600">
                {STAR_LABELS[activeStars] || `${activeStars} Stars`}
              </span>
            </div>

            {/* Fairness Impact Note */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 p-2.5 text-xs text-amber-900 leading-relaxed">
              <span className="text-sm">💡</span>
              <p>
                <strong>Fairness Allocation:</strong> Customer feedback contributes up to
                <strong> 5 points</strong> directly to the worker&apos;s score.
              </p>
            </div>

            {/* Feedback textarea */}
            <div>
              <label
                htmlFor="feedback-input"
                className="block text-xs font-bold text-gray-700 mb-1"
              >
                Review &amp; Feedback <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="feedback-input"
                rows={3}
                maxLength={500}
                placeholder="Mention the worker's punctuality, skills, communication, and work quality..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
              <div className="text-right text-[11px] text-gray-400 mt-0.5">
                {feedback.length}/500
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Rating'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

