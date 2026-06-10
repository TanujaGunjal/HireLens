const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../services/cache.service');
const cacheHelper = require('../utils/cacheHelper');


/**
 * Authentication Middleware with Redis caching
 * Verifies JWT token and attaches user to request
 * 
 * IMPROVEMENTS:
 * - Caches user lookups in Redis (300s TTL)
 * - Reduces MongoDB queries on every request
 * - Graceful fallback if Redis unavailable
 */

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    // Find user - with caching
    const userId = decoded.userId;
    const cacheKey = cacheHelper.cacheKeys.user(userId);
    
    let user = null;
    
    // Try cache first (logs demoted to dev-only — fires on every request)
    if (cache.isRedisConnected()) {
      user = await cache.get(cacheKey);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Auth] ${user ? 'CACHE HIT' : 'CACHE MISS'} - User ${userId}`);
      }
    }
    
    // Cache miss - fetch from DB
    if (!user) {
      user = await User.findById(userId).select('-passwordHash');
      
      // Store in cache (fire and forget - don't await)
      if (user && cache.isRedisConnected()) {
        cache.set(cacheKey, user, cacheHelper.cacheTTL.USER).catch((error) => {
          console.error(`⚠️  Failed to cache user ${userId}:`, error);
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

module.exports = authMiddleware;