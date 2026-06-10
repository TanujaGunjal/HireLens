/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CACHED ATS SERVICE WRAPPER
 * 
 * Wraps atsService.calculateATSScore with Redis caching
 * - Checks cache before computation
 * - Stores results with TTL
 * - Handles cache misses gracefully
 * - Maintains backward compatibility with existing API
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const atsService = require('./atsService');
const cacheHelper = require('../utils/cacheHelper');

/**
 * Cached version of calculateATSScore
 * Uses Redis for improved performance
 * 
 * @param {string|Object} resumeInput - Resume ID or object
 * @param {string|Object} jdInput - Job Description ID or object
 * @returns {Object} - ATS score result
 */
async function calculateATSScoreCached(resumeInput, jdInput) {
  try {
    // Extract IDs for cache key
    const resumeId = typeof resumeInput === 'string' ? resumeInput : resumeInput?._id;
    const jdId = typeof jdInput === 'string' ? jdInput : jdInput?._id;

    // Create cache key
    const cacheKey = cacheHelper.cacheKeys.atsScore(resumeId, jdId);

    // Use cache-aside pattern
    const result = await cacheHelper.getOrSet(
      cacheKey,
      // Supplier function - computes actual value if cache miss
      async () => {
        console.log(`   Computing ATS score for resume ${resumeId} and JD ${jdId}...`);
        return await atsService.calculateATSScore(resumeInput, jdInput);
      },
      // TTL
      cacheHelper.cacheTTL.ATS_SCORE
    );

    return result;
  } catch (error) {
    console.error('Error in calculateATSScoreCached:', error);
    // Fallback: compute without cache
    return await atsService.calculateATSScore(resumeInput, jdInput);
  }
}

module.exports = {
  calculateATSScoreCached,
  // Re-export other functions for backward compatibility
  ...atsService,
};
