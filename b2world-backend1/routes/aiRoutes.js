/**
 * AI Routes — /api/ai
 *
 * New module, isolated from ATS scoring routes.
 */

const express       = require('express');
const router        = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { improve }   = require('../controllers/ai.controller');

// All AI routes require authentication
router.use(authMiddleware);

/**
 * POST /api/ai/improve
 * Body: { resumeId: string, jdId: string }
 * Returns: { improved: { summary, experience[], projects[] } }
 */
router.post('/improve', improve);

module.exports = router;
