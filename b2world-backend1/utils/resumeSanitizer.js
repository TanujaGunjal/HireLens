/**
 * resumeSanitizer.js - Resume Sanitization Utility
 * 
 * Prevents suggestion text from leaking into resume content.
 * Called before PDF generation or when saving resume data.
 * Acts as FINAL SAFETY LAYER to catch any suggestion text that slipped through.
 * 
 * Blacklist patterns that should NEVER appear in resume content:
 * - "consider adding" - suggestion text
 * - "add measurable impact" - suggestion text
 * - "target X+" - suggestion text
 * - Any suggestion message patterns
 * - System-generated phrases
 */

// CRITICAL: Suggestion patterns that indicate system-generated text (primary blacklist)
const SUGGESTION_PATTERNS = [
  /consider adding/i,
  /considering adding/i,
  /add measurable/i,
  /add.*impact/i,
  /target \d+/i,
  /^add /i,
  /currently \d+,\s*target/i,
  /this suggestion/i,
  /requires manual/i,
];

// Secondary blacklist: these patterns often appear WITH real content so removal is riskier
const SECONDARY_BLACKLIST = [
  /resulting in \d+%/i,
  /resulting in \d+\+?\s*improvement/i,
  /resulting in enterprise-?scale\s*improvement/i,
  /resulting in [\w,.-]+\+?\s*improvement/i,   // catches any "resulting in X improvement"
  /resulting in \d+[\w+%,-]+.*?improvement/i,   // catches "resulting in 10,000+ improvement"
  /delivering measurable business value/i,       // generic fallback phrase
  /serving \d+/i,
  /improving.*to \d+%/i,
  /add \d+%/i,
  /achieved \d+%/i,
];

// SAFE patterns: actual metric content that should ALWAYS be preserved
const SAFE_METRIC_PATTERNS = [
  /\d+%$/m,                                    // ends with percentage
  /\d+x$/m,                                    // ends with multiplier
  /\d+\s*(?:million|thousand|hundred|k|m)$/i, // ends with scale
  /\d+\s*\+?\s*(?:users|customers|employees)$/i, // ends with count
];

/**
 * Get all patterns to check (both primary and secondary)
 */
const getAllBlacklistPatterns = () => [
  ...SUGGESTION_PATTERNS,
  ...SECONDARY_BLACKLIST,
];

/**
 * Check if text contains SAFE metric content that should be preserved
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains real metrics we should keep
 */
const containsSafeMetricContent = (text) => {
  if (!text || typeof text !== 'string') return false;
  return SAFE_METRIC_PATTERNS.some(pattern => pattern.test(text.trim()));
};

/**
 * Check if text is purely suggestion text (no real content)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text appears to be pure suggestion text
 */
const isPureSuggestionText = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const trimmed = text.trim();
  
  // If it contains safe metrics, it's probably real content
  if (containsSafeMetricContent(trimmed)) {
    return false;
  }
  
  // Check if it matches primary suggestion patterns
  const matchesPrimary = SUGGESTION_PATTERNS.some(p => p.test(trimmed));
  if (!matchesPrimary) {
    return false; // No suggestion pattern found, keep as-is
  }
  
  // Text matches suggestion pattern AND has no safe metrics = likely pure suggestion
  return true;
};

/**
 * Check if text contains suggestion patterns (should be sanitized)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text should be sanitized
 */
const containsSuggestionPattern = (text) => {
  if (!text || typeof text !== 'string') return false;
  return getAllBlacklistPatterns().some(pattern => pattern.test(text));
};

/**
 * Check if text contains actual metrics (should be preserved)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains real metrics
 */
const containsRealMetrics = (text) => {
  if (!text || typeof text !== 'string') return false;
  return SAFE_METRIC_PATTERNS.some(pattern => pattern.test(text));
};

/**
 * Clean a single text string
 * If text looks like pure suggestion (no real content), return empty string
 * Otherwise return original text
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
const cleanText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  // CRITICAL CHECK: If it's pure suggestion text, remove completely
  if (isPureSuggestionText(trimmed)) {
    console.warn(`[Sanitizer] Removed pure suggestion text: "${trimmed.substring(0, 50)}..."`);
    return '';
  }
  
  // IMPORTANT: If it contains suggestion patterns but also has real content,
  // try to extract the real part (remove the suggestion tail)
  if (containsSuggestionPattern(trimmed) && !containsRealMetrics(trimmed)) {
    // Remove trailing suggestion phrases
    let cleaned = trimmed;
    
    // Remove "consider adding" or "considering adding" suffix
    cleaned = cleaned.replace(/\s*—\s*consider(?:ing)? adding.*$/i, '');
    cleaned = cleaned.replace(/\s*[-–]\s*consider(?:ing)? adding.*$/i, '');
    
    // Remove "add measurable" suffix
    cleaned = cleaned.replace(/\s*[-–—]\s*add measurable.*$/i, '');
    
    // Remove "target X+" suffix
    cleaned = cleaned.replace(/,\s*target\s+\d+\+?$/i, '');
    cleaned = cleaned.replace(/\s*\(\s*target\s+\d+\+?\s*\)$/i, '');
    
    const cleanedResult = cleaned.trim();
    
    // Only return the cleaned text if something was actually removed
    if (cleanedResult !== trimmed && cleanedResult.length > 0) {
      console.log(`[Sanitizer] Cleaned suggestion tail from: "${trimmed.substring(0, 50)}..."`);
      return cleanedResult;
    }
  }
  
  return trimmed;
};


/**
 * Clean a single bullet point
 * @param {string} bullet - Bullet text to clean
 * @returns {string} - Cleaned bullet
 */
const cleanBullet = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return '';
  return cleanText(bullet);
};

/**
 * Clean experience bullets
 * @param {Array} experience - Experience array
 * @returns {Array} - Cleaned experience array
 */
const cleanExperience = (experience) => {
  if (!Array.isArray(experience)) return [];
  
  return experience.map(exp => {
    if (!exp) return exp;
    
    const cleanedExp = { ...exp };
    
    // Clean bullets
    if (Array.isArray(exp.bullets)) {
      cleanedExp.bullets = exp.bullets
        .map(cleanBullet)
        .filter(Boolean);
    }
    
    return cleanedExp;
  });
};

/**
 * Clean project bullets
 * @param {Array} projects - Projects array
 * @returns {Array} - Cleaned projects array
 */
const cleanProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  
  return projects.map(proj => {
    if (!proj) return proj;
    
    const cleanedProj = { ...proj };
    
    // Clean bullets
    if (Array.isArray(proj.bullets)) {
      cleanedProj.bullets = proj.bullets
        .map(cleanBullet)
        .filter(Boolean);
    }
    
    return cleanedProj;
  });
};

/**
 * Clean skills array
 * @param {Array} skills - Skills array
 * @returns {Array} - Cleaned skills array
 */
const cleanSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  
  return skills.map(skillGroup => {
    if (!skillGroup) return skillGroup;
    
    const cleanedGroup = { ...skillGroup };
    
    // Clean skill items
    if (Array.isArray(skillGroup.items)) {
      cleanedGroup.items = skillGroup.items
        .map(item => cleanText(item))
        .filter(Boolean);
    }
    
    // Remove empty groups
    if (!cleanedGroup.items || cleanedGroup.items.length === 0) {
      return null;
    }
    
    return cleanedGroup;
  }).filter(Boolean);
};

/**
 * Clean summary text
 * @param {string} summary - Summary text
 * @returns {string} - Cleaned summary
 */
const cleanSummary = (summary) => {
  return cleanText(summary);
};

/**
 * Clean achievements array
 * @param {Array} achievements - Achievements array
 * @returns {Array} - Cleaned achievements
 */
const cleanAchievements = (achievements) => {
  if (!achievements) return achievements;
  
  if (Array.isArray(achievements)) {
    return achievements
      .map(a => {
        if (typeof a === 'string') return cleanText(a);
        if (typeof a === 'object' && a !== null) {
          // Handle object format {title, description}
          const cleaned = {};
          if (a.title) cleaned.title = cleanText(a.title);
          if (a.description) cleaned.description = cleanText(a.description);
          return Object.keys(cleaned).length > 0 ? cleaned : null;
        }
        return null;
      })
      .filter(Boolean);
  }
  
  // Handle string format
  if (typeof achievements === 'string') {
    return cleanText(achievements);
  }
  
  return achievements;
};

/**
 * Main sanitization function - sanitizes entire resume object
 * @param {Object} resume - Resume object to sanitize
 * @returns {Object} - Sanitized resume object
 */
const sanitizeResume = (resume) => {
  if (!resume || typeof resume !== 'object') return resume;
  
  // Create a deep copy to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(resume));
  
  // Clean summary
  if (sanitized.summary) {
    sanitized.summary = cleanSummary(sanitized.summary);
  }
  
  // Clean skills
  if (sanitized.skills) {
    sanitized.skills = cleanSkills(sanitized.skills);
  }
  
  // Clean experience
  if (sanitized.experience) {
    sanitized.experience = cleanExperience(sanitized.experience);
  }
  
  // Clean projects
  if (sanitized.projects) {
    sanitized.projects = cleanProjects(sanitized.projects);
  }
  
  // Clean achievements
  if (sanitized.achievements) {
    sanitized.achievements = cleanAchievements(sanitized.achievements);
  }
  
  // Clean education (less likely to have suggestion text but just in case)
  if (Array.isArray(sanitized.education)) {
    sanitized.education = sanitized.education.map(edu => {
      if (!edu) return edu;
      const cleaned = { ...edu };
      if (cleaned.degree) cleaned.degree = cleanText(cleaned.degree);
      if (cleaned.institution) cleaned.institution = cleanText(cleaned.institution);
      if (cleaned.field) cleaned.field = cleanText(cleaned.field);
      return cleaned;
    });
  }
  
  // Clean certifications
  if (Array.isArray(sanitized.certifications)) {
    sanitized.certifications = sanitized.certifications.map(cert => {
      if (!cert) return cert;
      const cleaned = { ...cert };
      if (cleaned.name) cleaned.name = cleanText(cleaned.name);
      if (cleaned.issuer) cleaned.issuer = cleanText(cleaned.issuer);
      return cleaned;
    });
  }
  
  return sanitized;
};

module.exports = {
  sanitizeResume,
  cleanText,
  cleanBullet,
  cleanExperience,
  cleanProjects,
  cleanSkills,
  cleanSummary,
  cleanAchievements,
  containsSuggestionPattern,
  containsRealMetrics,
};
