/**
 * ================================================================================
 * SUGGESTION NORMALIZER
 * ================================================================================
 * Handles both old (suggestedText) and new (improvedText) suggestion formats
 * Ensures all suggestions have required fields before processing
 * ================================================================================
 */

/**
 * Normalize a suggestion object to ensure it has all required fields
 * Handles both old format (suggestedText) and new format (improvedText)
 * 
 * @param {Object} suggestion - Raw suggestion object from database
 * @returns {Object} Normalized suggestion with all required fields
 * @throws {Error} If suggestion is invalid or missing critical fields
 */
const normalizeSuggestion = (suggestion) => {
  if (!suggestion || typeof suggestion !== 'object') {
    throw new Error('Suggestion must be an object');
  }

  // Extract fields, handling both old and new formats
  const section = suggestion.section?.trim();
  const improvedText = (
    suggestion.improvedText || 
    suggestion.suggestedText ||  // Support old format
    suggestion.recommended ||
    ''
  )?.toString().trim();

  const currentText = (
    suggestion.currentText || 
    suggestion.originalText ||
    ''
  )?.toString().trim();

  const itemIndex = suggestion.itemIndex ?? suggestion.targetIndex?.itemIndex;
  const bulletIndex = suggestion.bulletIndex ?? suggestion.targetIndex?.bulletIndex;

  // Validate required fields
  if (!section) {
    throw new Error('Invalid suggestion: section is required');
  }

  if (improvedText === undefined || improvedText === '') {
    throw new Error(`Invalid suggestion: improvedText (or suggestedText) is required for section="${section}"`);
  }

  // Return normalized suggestion
  return {
    id: suggestion.id || suggestion._id || `sugg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    section,
    itemIndex: itemIndex !== undefined && itemIndex !== null ? parseInt(itemIndex) : undefined,
    bulletIndex: bulletIndex !== undefined && bulletIndex !== null ? parseInt(bulletIndex) : undefined,
    currentText,
    improvedText,
    reason: suggestion.reason || suggestion.description || `Improve ${section}`,
    type: suggestion.type || 'content',
    impact: suggestion.impact || 'medium',
  };
};

/**
 * Normalize an array of suggestions
 * Skips invalid suggestions with logging instead of failing
 * 
 * @param {Array} suggestions - Array of raw suggestion objects
 * @param {Boolean} throwOnError - If true, throw error on invalid suggestion; default false (skip)
 * @returns {Array} Array of normalized valid suggestions
 */
const normalizeSuggestions = (suggestions, throwOnError = false) => {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const normalized = [];

  for (const sug of suggestions) {
    try {
      normalized.push(normalizeSuggestion(sug));
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
      console.warn(`[suggestionNormalizer] Skipped invalid suggestion:`, error.message);
    }
  }

  return normalized;
};

/**
 * Validate a single suggestion is properly formatted
 * Returns validation result with details
 * 
 * @param {Object} suggestion - Suggestion to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateSuggestion = (suggestion) => {
  try {
    normalizeSuggestion(suggestion);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  normalizeSuggestion,
  normalizeSuggestions,
  validateSuggestion,
};
