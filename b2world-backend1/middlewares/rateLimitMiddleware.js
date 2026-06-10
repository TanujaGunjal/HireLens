const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * Protects endpoints from brute force and abuse
 */

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';
console.log(`🔒 Rate limiting ${isDevelopment ? 'DISABLED' : 'ENABLED'} (NODE_ENV=${process.env.NODE_ENV})`);

// Auth endpoints: 5 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per window
  message: 'Too many login/register attempts. Please try again later.',
  standardHeaders: true,      // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  skip: () => isDevelopment,  // Skip completely in development
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for ${req.ip}`);
    res.status(429).json({ 
      success: false, 
      message: 'Too many attempts. Please try again later.' 
    });
  }
});

// PDF download: 10 requests per hour per user
const pdfDownloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 requests per window
  message: 'Too many PDF downloads. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per authenticated user, not IP
    return req.user?._id?.toString() || req.ip;
  },
  skip: () => isDevelopment,
  handler: (req, res) => {
    console.warn(`⚠️ PDF rate limit exceeded for ${req.user?._id || req.ip}`);
    res.status(429).json({ 
      success: false, 
      message: 'Too many PDF downloads. Please try again in an hour.' 
    });
  }
});

// General API limiter: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
});

module.exports = {
  authLimiter,
  pdfDownloadLimiter,
  generalLimiter,
};
