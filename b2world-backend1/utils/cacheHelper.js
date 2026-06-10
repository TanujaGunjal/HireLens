/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CACHE UTILITY HELPERS
 * 
 * Reusable helper functions for common caching patterns:
 * - Cache-aside pattern
 * - Cache key generation
 * - Batch cache operations
 * - Cache invalidation helpers
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const cache = require('../services/cache.service');

/**
 * Cache key generators for different resources
 */
const cacheKeys = {
  // ATS Score: ats:{resumeId}:{jdId}
  atsScore: (resumeId, jdId) => `ats:${resumeId}:${jdId}`,

  // Semantic Matching: semantic:{resumeId}:{jdId}
  semanticScore: (resumeId, jdId) => `semantic:${resumeId}:${jdId}`,

  // Skill Gap Analysis: skillgap:{resumeId}:{jdId}
  skillGap: (resumeId, jdId) => `skillgap:${resumeId}:${jdId}`,

  // User Lookup: user:{userId}
  user: (userId) => `user:${userId}`,

  // Job Description: jd:{jdId}
  jobDescription: (jdId) => `jd:${jdId}`,

  // Resume: resume:{resumeId}
  resume: (resumeId) => `resume:${resumeId}`,
};

/**
 * Cache TTL constants (in seconds)
 */
const cacheTTL = {
  ATS_SCORE: 3600,              // 1 hour
  SEMANTIC_SCORE: 3600,         // 1 hour
  SKILL_GAP: 3600,              // 1 hour
  USER: 300,                    // 5 minutes (users change frequently)
  JOB_DESCRIPTION: 1800,        // 30 minutes
  RESUME: 1800,                 // 30 minutes
};

/**
 * Cache-aside pattern: Try cache first, fallback to supplier function
 * @param {string} key - Cache key
 * @param {Function} supplier - Function that returns the actual value
 * @param {number} ttl - Time to live in seconds
 * @returns {any} - Cached or freshly computed value
 */
async function getOrSet(key, supplier, ttl = 3600) {
  try {
    // Try to get from cache
    const cachedValue = await cache.get(key);
    if (cachedValue !== null) {
      console.log(`✅ CACHE HIT: ${key}`);
      return cachedValue;
    }

    console.log(`❌ CACHE MISS: ${key}`);

    // Cache miss - compute value
    const value = await supplier();

    // Store in cache (fire and forget - don't await)
    cache.set(key, value, ttl).catch((error) => {
      console.error(`⚠️  Failed to cache ${key}:`, error);
    });

    return value;
  } catch (error) {
    console.error(`Error in cache getOrSet for ${key}:`, error);
    // On error, still call supplier to get fresh value
    return await supplier();
  }
}

/**
 * Invalidate ATS-related caches for a resume/JD pair
 * @param {string} resumeId - Resume ID
 * @param {string} jdId - Job Description ID
 */
async function invalidateATS(resumeId, jdId) {
  const key = cacheKeys.atsScore(resumeId, jdId);
  console.log(`🗑️  CACHE INVALIDATED: ${key}`);
  return cache.del(key);
}

/**
 * Invalidate semantic caches for a resume/JD pair
 * @param {string} resumeId - Resume ID
 * @param {string} jdId - Job Description ID
 */
async function invalidateSemantic(resumeId, jdId) {
  const key = cacheKeys.semanticScore(resumeId, jdId);
  console.log(`🗑️  CACHE INVALIDATED: ${key}`);
  return cache.del(key);
}

/**
 * Invalidate skill gap caches for a resume/JD pair
 * @param {string} resumeId - Resume ID
 * @param {string} jdId - Job Description ID
 */
async function invalidateSkillGap(resumeId, jdId) {
  const key = cacheKeys.skillGap(resumeId, jdId);
  console.log(`🗑️  CACHE INVALIDATED: ${key}`);
  return cache.del(key);
}

/**
 * Invalidate all caches for a resume when it's updated
 * @param {string} resumeId - Resume ID
 */
async function invalidateResumeAnalyses(resumeId) {
  console.log(`🗑️  CACHE INVALIDATED: All analyses for resume ${resumeId}`);
  return cache.deleteByPattern(`ats:${resumeId}:*`) &&
    cache.deleteByPattern(`semantic:${resumeId}:*`) &&
    cache.deleteByPattern(`skillgap:${resumeId}:*`);
}

/**
 * Invalidate all caches for a job description when it's updated
 * @param {string} jdId - Job Description ID
 */
async function invalidateJobDescriptionAnalyses(jdId) {
  console.log(`🗑️  CACHE INVALIDATED: All analyses for JD ${jdId}`);
  return cache.deleteByPattern(`ats:*:${jdId}`) &&
    cache.deleteByPattern(`semantic:*:${jdId}`) &&
    cache.deleteByPattern(`skillgap:*:${jdId}`);
}

/**
 * Invalidate user cache
 * @param {string} userId - User ID
 */
async function invalidateUser(userId) {
  const key = cacheKeys.user(userId);
  console.log(`🗑️  CACHE INVALIDATED: ${key}`);
  return cache.del(key);
}

/**
 * Invalidate all caches for a user
 * @param {string} userId - User ID
 */
async function invalidateUserAllCaches(userId) {
  console.log(`🗑️  CACHE INVALIDATED: All caches for user ${userId}`);
  // Invalidate user profile
  await cache.del(cacheKeys.user(userId));
  // Could also invalidate all their resumes/JDs if needed
  return true;
}

/**
 * Get cache statistics (hit/miss ratio)
 * For monitoring and debugging
 */
async function getCacheStats() {
  if (!cache.isRedisConnected()) {
    return { status: 'disconnected' };
  }

  try {
    const client = await cache.getClient();
    const info = await client.info('stats');
    return {
      status: 'connected',
      info: info,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Warm up cache for a resume/JD pair
 * Pre-compute and cache values for frequently accessed combinations
 * @param {string} resumeId - Resume ID
 * @param {string} jdId - Job Description ID
 * @param {Object} values - Object with ats, semantic, skillGap values
 */
async function warmupCache(resumeId, jdId, values = {}) {
  const operations = [];

  if (values.ats) {
    operations.push(cache.set(
      cacheKeys.atsScore(resumeId, jdId),
      values.ats,
      cacheTTL.ATS_SCORE
    ));
  }

  if (values.semantic) {
    operations.push(cache.set(
      cacheKeys.semanticScore(resumeId, jdId),
      values.semantic,
      cacheTTL.SEMANTIC_SCORE
    ));
  }

  if (values.skillGap) {
    operations.push(cache.set(
      cacheKeys.skillGap(resumeId, jdId),
      values.skillGap,
      cacheTTL.SKILL_GAP
    ));
  }

  try {
    await Promise.all(operations);
    console.log(`✨ Cache warmed up for resume ${resumeId} and JD ${jdId}`);
    return true;
  } catch (error) {
    console.error('Error warming up cache:', error);
    return false;
  }
}

module.exports = {
  cacheKeys,
  cacheTTL,
  getOrSet,
  invalidateATS,
  invalidateSemantic,
  invalidateSkillGap,
  invalidateResumeAnalyses,
  invalidateJobDescriptionAnalyses,
  invalidateUser,
  invalidateUserAllCaches,
  getCacheStats,
  warmupCache,
};
