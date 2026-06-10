const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');

// Rate limit auth endpoints (5 requests per 15 minutes per IP)
router.post('/register', authLimiter, authController.registerValidation, authController.register);
router.post('/login', authLimiter, authController.loginValidation, authController.login);
router.get('/me', authMiddleware, authController.getProfile);

module.exports = router;
