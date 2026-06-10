/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CACHED SEMANTIC SERVICE WRAPPER
 * 
 * Wraps semanticService.getSemanticScore with Redis caching
 * - Checks cache before calling Python engine
 * - Stores results with TTL
 * - Reduces expensive Gemini API calls
 * - Maintains backward compatibility
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const semanticService = require('./semantic.service');
const cacheHelper = require('../utils/cacheHelper');

/**
 * Cached version of getSemanticScore
 * 
 * Significantly reduces Gemini API calls by caching semantic matching results
 * 
 * @param {Object} resumeSectionsOrObject - Resume object or sections
 * @param {string} jdText - Job description text
 * @param {string} cacheKeyPrefix - Optional custom cache key (for testing)
 * @returns {Promise<number>} - Semantic similarity score (0-100)
 */
async function getSemanticScoreCached(resumeSectionsOrObject, jdText = '', cacheKeyPrefix = null) {
  try {
    // Create cache key from resume ID if available
    let cacheKey = null;
    
    if (!cacheKeyPrefix) {
      const resumeId = resumeSectionsOrObject?._id || resumeSectionsOrObject?.id;
      const jdId = 'gemini'; // Use static ID since we're matching against text, not JD object

      if (resumeId) {
        cacheKey = cacheHelper.cacheKeys.semanticScore(resumeId, jdId);
      }
    } else {
      cacheKey = cacheKeyPrefix;
    }

    // If we have a valid cache key, use cache-aside pattern
    if (cacheKey) {
      const result = await cacheHelper.getOrSet(
        cacheKey,
        // Supplier function
        async () => {
          console.log(`   Computing semantic score...`);
          return await semanticService.getSemanticScore(resumeSectionsOrObject, jdText);
        },
        // TTL
        cacheHelper.cacheTTL.SEMANTIC_SCORE
      );
      return result;
    }

    // No cache key available - compute directly
    console.log('⚠️  No cache key available for semantic scoring');
    return await semanticService.getSemanticScore(resumeSectionsOrObject, jdText);

  } catch (error) {
    console.error('Error in getSemanticScoreCached:', error);
    // Fallback: compute without cache
    return await semanticService.getSemanticScore(resumeSectionsOrObject, jdText);
  }
}

/**
 * Cached version of getSkillSemanticMatches
 * 
 * @param {string[]} resumeSkills - Resume skills
 * @param {string[]} jdKeywords - JD keywords
 * @returns {Promise<Object[]>} - Semantic matches
 */
async function getSkillSemanticMatchesCached(resumeSkills, jdKeywords) {
  try {
    // Create cache key from skills and keywords
    const skillsKey = resumeSkills?.join('|') || '';
    const keywordsKey = jdKeywords?.join('|') || '';
    const cacheKey = `skill-match:${Buffer.from(skillsKey).toString('base64')}:${Buffer.from(keywordsKey).toString('base64')}`;

    const result = await cacheHelper.getOrSet(
      cacheKey,
      async () => {
        console.log(`   Computing skill semantic matches...`);
        return await semanticService.getSkillSemanticMatches(resumeSkills, jdKeywords);
      },
      cacheHelper.cacheTTL.SEMANTIC_SCORE
    );

    return result;
  } catch (error) {
    console.error('Error in getSkillSemanticMatchesCached:', error);
    // Fallback
    return await semanticService.getSkillSemanticMatches(resumeSkills, jdKeywords);
  }
}

module.exports = {
  getSemanticScoreCached,
  getSkillSemanticMatchesCached,
  // Re-export other methods for backward compatibility
  computeConceptBoost: semanticService.computeConceptBoost.bind(semanticService),
};
