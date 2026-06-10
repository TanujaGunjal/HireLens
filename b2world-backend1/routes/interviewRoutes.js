const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interview.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const { generalLimiter } = require('../middlewares/rateLimitMiddleware');

// Mount auth and rate limit protections
router.use(authMiddleware);

// Generate questions securely 
router.post('/generate', generalLimiter, interviewController.generateInterviewQuestions);

// Evaluate question safely falling back if needed
router.post('/evaluate', generalLimiter, interviewController.evaluateAnswer);

module.exports = router;
