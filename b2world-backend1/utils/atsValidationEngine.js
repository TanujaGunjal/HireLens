/**
 * ================================================================================
 * ATS VALIDATION ENGINE
 * ================================================================================
 * Production-grade validation for resume/JD analysis system
 * - Ensures score validity (0-100)
 * - Validates all components
 * - Catches edge cases
 * - Prevents broken output
 * ================================================================================
 */

'use strict';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CORE VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Validate and clamp ATS score to 0-100 range
 * @param {number} score - Raw score value
 * @returns {number} Validated score (0-100)
 */
const validateATSScore = (score) => {
  if (typeof score !== 'number') return 0;
  if (isNaN(score)) return 0;
  if (!isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Validate component scores
 * @param {object} breakdown - Score breakdown object
 * @returns {object} Validated breakdown with safe values
 */
const validateBreakdown = (breakdown) => {
  if (!breakdown || typeof breakdown !== 'object') {
    return {
      keywordMatch: 0,
      completeness: 0,
      formatting: 0,
      actionVerbs: 0,
      readability: 0
    };
  }

  return {
    keywordMatch: validateATSScore(breakdown.keywordMatch),
    completeness: validateATSScore(breakdown.completeness),
    formatting: validateATSScore(breakdown.formatting),
    actionVerbs: validateATSScore(breakdown.actionVerbs),
    readability: validateATSScore(breakdown.readability)
  };
};

/**
 * Validate resume object structure
 * @param {object} resume - Resume to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
const validateResumeStructure = (resume) => {
  const errors = [];

  if (!resume || typeof resume !== 'object') {
    return { isValid: false, errors: ['Resume must be a valid object'] };
  }

  // Check required fields
  if (!resume.personalInfo?.fullName) {
    errors.push('Missing: personalInfo.fullName');
  }
  if (!resume.personalInfo?.email) {
    errors.push('Missing: personalInfo.email');
  }

  // Check array fields
  const arrayFields = ['skills', 'experience', 'projects', 'education', 'certifications'];
  for (const field of arrayFields) {
    if (resume[field] && !Array.isArray(resume[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  // Check experience bullets
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach((exp, idx) => {
      if (exp.bullets && !Array.isArray(exp.bullets)) {
        errors.push(`experience[${idx}].bullets must be an array`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate JD structure
 * @param {object} jd - Job description to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
const validateJDStructure = (jd) => {
  const errors = [];

  if (!jd || typeof jd !== 'object') {
    return { isValid: false, errors: ['JD must be a valid object'] };
  }

  if (!jd.jdText && !jd.extractedKeywords) {
    errors.push('JD must have jdText or extractedKeywords');
  }

  if (jd.extractedKeywords && !Array.isArray(jd.extractedKeywords)) {
    errors.push('extractedKeywords must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * KEYWORD VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Validate keywords array
 * @param {array} keywords - Keywords to validate
 * @returns {array} Cleaned keywords
 */
const validateKeywords = (keywords) => {
  if (!Array.isArray(keywords)) return [];

  const validated = new Set();

  for (const kw of keywords) {
    if (!kw) continue;

    const cleaned = String(kw)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\+\#\.\-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length >= 2 && cleaned.length <= 100) {
      validated.add(cleaned);
    }
  }

  return Array.from(validated);
};

/**
 * Remove duplicate keywords (case-insensitive)
 * @param {array} keywords - Keywords array
 * @returns {array} Deduplicated keywords
 */
const deduplicateKeywords = (keywords) => {
  const seen = new Set();
  const result = [];

  for (const kw of keywords) {
    const normalized = String(kw).toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(kw);
    }
  }

  return result;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SUGGESTION VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Validate suggestion object
 * @param {object} suggestion - Suggestion to validate
 * @returns {object|null} Validated suggestion or null
 */
const validateSuggestion = (suggestion) => {
  if (!suggestion || typeof suggestion !== 'object') return null;

  // Required fields
  if (!suggestion.type || !suggestion.section) return null;

  // Valid types
  const validTypes = ['keyword', 'bullet', 'verb', 'metrics', 'section', 'impact'];
  if (!validTypes.includes(suggestion.type)) return null;

  // Ensure text fields are strings
  const text = String(suggestion.improvedText || suggestion.currentText || '').trim();
  if (!text) return null;

  // Safe impact level
  const validImpacts = ['low', 'medium', 'high'];
  const impactLevel = (suggestion.impactLevel || suggestion.impact || 'medium').toLowerCase();

  return {
    id: suggestion.id || `sugg-${Date.now()}-${Math.random()}`,
    type: suggestion.type,
    section: suggestion.section,
    itemIndex: typeof suggestion.itemIndex === 'number' ? suggestion.itemIndex : undefined,
    bulletIndex: typeof suggestion.bulletIndex === 'number' ? suggestion.bulletIndex : undefined,
    currentText: String(suggestion.currentText || '').trim(),
    improvedText: String(suggestion.improvedText || '').trim(),
    title: String(suggestion.title || suggestion.text || '').substring(0, 200),
    reason: String(suggestion.reason || '').substring(0, 300),
    impactLevel: validImpacts.includes(impactLevel) ? impactLevel : 'medium',
    confidence: typeof suggestion.confidence === 'number' ? Math.round(suggestion.confidence) : 80
  };
};

/**
 * Validate suggestions array
 * @param {array} suggestions - Suggestions to validate
 * @returns {array} Validated unique suggestions
 */
const validateSuggestions = (suggestions) => {
  if (!Array.isArray(suggestions)) return [];

  const validated = [];
  const seen = new Set();

  for (const sugg of suggestions) {
    const validSugg = validateSuggestion(sugg);
    if (!validSugg) continue;

    // Dedupe by type + section + currentText
    const key = `${validSugg.type}|${validSugg.section}|${validSugg.currentText}`;
    if (seen.has(key)) continue;

    seen.add(key);
    validated.push(validSugg);
  }

  return validated.slice(0, 20); // Limit to 20 suggestions
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEXT & GRAMMAR VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Detect double-verb error pattern
 * e.g., "Developed analyzed", "Implemented handled"
 * @param {string} text - Text to check
 * @returns {boolean} True if has double-verb issue
 */
const hasDoubleVerbError = (text) => {
  if (!text || typeof text !== 'string') return false;

  const STRONG_VERBS = new Set([
    'developed', 'engineered', 'architected', 'designed', 'created',
    'built', 'implemented', 'deployed', 'delivered', 'optimized',
    'improved', 'enhanced', 'streamlined', 'automated', 'accelerated',
    'analyzed', 'investigated', 'evaluated', 'assessed', 'managed',
    'led', 'coordinated', 'spearheaded', 'pioneered', 'established',
    'launched', 'released', 'published', 'presented', 'demonstrated'
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^\w\-]/g, ''))
    .filter(w => w.length > 0);

  if (words.length < 2) return false;

  // Check if first two words are both strong verbs
  const firstWord = words[0];
  const secondWord = words[1];

  return STRONG_VERBS.has(firstWord) && STRONG_VERBS.has(secondWord);
};

/**
 * Validate bullet point grammar
 * @param {string} bullet - Bullet text to validate
 * @returns {object} { isValid: boolean, issues: string[] }
 */
const validateBulletGrammar = (bullet) => {
  const issues = [];

  if (!bullet || typeof bullet !== 'string' || bullet.trim().length === 0) {
    return { isValid: false, issues: ['Bullet is empty'] };
  }

  // Check for double-verb pattern
  if (hasDoubleVerbError(bullet)) {
    issues.push('Double-verb error (e.g., "Developed analyzed")');
  }

  // Check for incomplete sentence patterns
  if (/^(integrated|handled|processed|managed|coordinated|worked)\s+(analyze|create|build|develop)/i.test(bullet)) {
    issues.push('Possible incomplete verb combination');
  }

  // Check minimum word count
  const wordCount = bullet.split(/\s+/).length;
  if (wordCount < 4) {
    issues.push('Bullet too short (less than 4 words)');
  }

  // Check for dangling verb
  if (/^(to |with |using |for )/i.test(bullet.trim())) {
    issues.push('Bullet starts with preposition, missing action verb');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};

/**
 * Fix common grammar issues in bullet points
 * @param {string} bullet - Original bullet
 * @returns {string} Improved bullet
 */
const fixBulletGrammar = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return '';

  let text = bullet.trim();

  // Fix double-verb pattern: "Developed analyzed..." → "Developed and analyzed..."
  text = text.replace(
    /^(develop|engineer|architect|design|create|build|implement|deployed|deliver|optimized|improve|enhance|streamline|automate|accelerat|analyz|investigat|evaluat|assess|manag|lead|coordinat|spearhead|pioneer|establish|launch|releas|publish|present|demonstrat)\s+(analyze|create|build|develop|implement|assess|handle|process|manage|coordinate|handled|processed|managed|coordinated)/i,
    (match, verb1, verb2) => {
      return `${verb1.toLowerCase()} and ${verb2.toLowerCase()}`;
    }
  );

  // Ensure starts with capital letter
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Ensure ends with period
  if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
    text += '.';
  }

  return text;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * METRIC & IMPACT VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Check if text contains measurable impact/metrics
 * @param {string} text - Text to check
 * @returns {boolean} True if contains metrics
 */
const hasMetrics = (text) => {
  if (!text || typeof text !== 'string') return false;

  const metricPatterns = [
    /\d+%/, // Percentages
    /\d+x/, // Multiples
    /\d+\s?(k|m|b|billion|million|thousand)/, // Large numbers
    /\$\d+/, // Currency
    /\d+\s+(users|customers|transactions|requests|days?|weeks?|months?|hours?|minutes?|seconds?)/, // Quantifiable units
    /improved|increased|decreased|reduced|accelerated|optimized|doubled|tripled|grown|expanded/i // Impact verbs
  ];

  return metricPatterns.some(pattern => pattern.test(text));
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPLETENESS VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Check if resume has required sections with content
 * @param {object} resume - Resume to check
 * @returns {object} Section completeness report
 */
const checkSectionCompleteness = (resume) => {
  const report = {
    hasPersonalInfo: !!(resume.personalInfo?.fullName && resume.personalInfo?.email),
    hasSummary: !!(resume.summary && resume.summary.trim().length >= 50),
    hasSkills: !!(Array.isArray(resume.skills) && resume.skills.some(s => s.items?.length > 0)),
    hasExperience: !!(Array.isArray(resume.experience) && resume.experience.length > 0),
    hasEducation: !!(Array.isArray(resume.education) && resume.education.length > 0),
    hasProjects: !!(Array.isArray(resume.projects) && resume.projects.length > 0),
    missingRequired: []
  };

  if (!report.hasPersonalInfo) report.missingRequired.push('Personal Information');
  if (!report.hasExperience) report.missingRequired.push('Work Experience');
  if (!report.hasEducation) report.missingRequired.push('Education');

  report.completenessPercent = Math.round(
    (Object.values(report).filter(v => v === true).length / 6) * 100
  );

  return report;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORTS
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
  // Score validation
  validateATSScore,
  validateBreakdown,

  // Structure validation
  validateResumeStructure,
  validateJDStructure,

  // Keyword validation
  validateKeywords,
  deduplicateKeywords,

  // Suggestion validation
  validateSuggestion,
  validateSuggestions,

  // Grammar validation
  hasDoubleVerbError,
  validateBulletGrammar,
  fixBulletGrammar,

  // Impact validation
  hasMetrics,

  // Completeness
  checkSectionCompleteness
};
