const Application = require('../models/Application');

// ──────────────────────────────────────────────────────────────────────────────
// assertChatAccess
//
// Reusable guard used by both the contact endpoint and chat routes.
// Validates:
//   1. The application exists (404 otherwise)
//   2. req.user.id is either the worker or employer of the application (403)
//   3. The application status is 'accepted' or 'completed' (403 with message)
//
// Returns { application, isWorker, otherPartyId } on success.
// Calls res.status(...).json(...) and returns null on failure — caller must
// immediately `return` when null is returned.
// ──────────────────────────────────────────────────────────────────────────────
async function assertChatAccess(req, res) {
  const applicationId = req.params.applicationId || req.params.id;
  const userId = req.user.id.toString();

  const application = await Application.findById(applicationId);

  if (!application) {
    res.status(404).json({ message: 'Application not found.' });
    return null;
  }

  const workerId   = application.worker.toString();
  const employerId = application.employer.toString();
  const isWorker   = userId === workerId;
  const isEmployer = userId === employerId;

  if (!isWorker && !isEmployer) {
    res.status(403).json({
      message: 'Forbidden. You are not a participant in this application.',
    });
    return null;
  }

  if (!['accepted', 'completed'].includes(application.status)) {
    res.status(403).json({
      message:
        'Contact details and chat are only available after the job offer has been accepted.',
    });
    return null;
  }

  const otherPartyId = isWorker ? employerId : workerId;

  return { application, isWorker, otherPartyId };
}

module.exports = { assertChatAccess };
