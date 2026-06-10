const express = require('express');
const router = express.Router();
const jdController = require('../controllers/jdController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/analyze', jdController.analyzeJD);        // Analyze JD only - no resume required
router.post('/generate', jdController.generateResume);  // Generate new resume from JD - no resume required
router.post('/optimize', jdController.optimizeResume);  // Optimize existing resume - requires resumeId

// Legacy endpoint - kept for backward compatibility
router.post('/generate-resume', jdController.generateResume);

// Get JD by ID (MUST be after POST routes to avoid conflicts)
router.get('/:id', jdController.getJD);

module.exports = router;
