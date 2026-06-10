/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS SUGGESTION GENERATOR
 * 
 * Generates grammatically correct suggestions for resume improvements
 * Uses domain-aware templates and context-sensitive logic
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { SUGGESTION_TEMPLATES, DOMAIN_KEYWORDS, METRICS, BASELINE_VALUES } = require('./atsConfig');
const { normalizeText, extractContext } = require('./atsTextProcessor');

/**
 * Detects the primary domain/role of a resume
 * Based on keyword analysis of resume content
 * 
 * @param {Object} resume - Resume object
 * @returns {string} - Domain identifier (e.g., 'software_engineer', 'data_analyst')
 * 
 * @example
 * detectDomain(resume)
 * // Returns: 'software_engineer'
 */
function detectDomain(resume) {
  if (!resume || typeof resume !== 'object') {
    return 'default';
  }
  
  // Combine all resume text for analysis
  const allText = [
    resume.summary || '',
    resume.jobTitle || '',
    (resume.experience || [])
      .map(e => `${e.role || ''} ${(e.bullets || []).join(' ')}`)
      .join(' '),
    (resume.projects || [])
      .map(p => `${p.name || ''} ${p.description || ''}`)
      .join(' ')
  ].join(' ').toLowerCase();
  
  // Count keyword matches per domain
  const domainScores = {};
  
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let matches = 0;
    keywords.forEach(keyword => {
      if (allText.includes(keyword.toLowerCase())) {
        matches++;
      }
    });
    domainScores[domain] = matches;
  }
  
  // Return domain with highest score
  let maxDomain = 'default';
  let maxScore = 0;
  
  for (const [domain, score] of Object.entries(domainScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxDomain = domain;
    }
  }
  
  return maxDomain;
}

/**
 * Generates improved bullet point for a given context
 * Uses domain-specific templates and context to create professional suggestions
 * 
 * @param {Object} options - Generation options
 * @param {string} options.keyword - Technology/concept to highlight
 * @param {string} options.context - Additional context about usage
 * @param {string} options.domain - Domain/role (e.g., 'software_engineer')
 * @param {string} options.originalBullet - Original bullet for reference (optional)
 * @returns {string} - Improved bullet point
 * 
 * @example
 * generateImprovedBullet({
 *   keyword: 'React',
 *   context: 'building dashboard components',
 *   domain: 'software_engineer',
 *   originalBullet: 'Worked on React stuff'
 * })
 * // Returns: 'Developed React dashboard components serving 100,000+ daily users'
 */
function generateImprovedBullet(options) {
  const {
    keyword,
    context = '',
    domain = 'default',
    originalBullet = ''
  } = options;
  
  if (!keyword) {
    return originalBullet || '';
  }
  
  // Get templates for domain
  const templates = SUGGESTION_TEMPLATES[domain] || SUGGESTION_TEMPLATES['default'];
  
  if (!templates || templates.length === 0) {
    return createBasicBullet(keyword, context);
  }
  
  // Select template (deterministically based on keyword)
  const templateIndex = hashString(keyword) % templates.length;
  const template = templates[templateIndex];
  
  // Generate metrics/values for template
  const metrics = selectRandomMetric();
  const value = selectRandomValue(metrics);
  
  // Replace placeholders
  const improvedBullet = template
    .replace(/{keyword}/g, keyword)
    .replace(/{context}/g, context || 'implementation')
    .replace(/{metric}/g, metrics)
    .replace(/{value}/g, value)
    .replace(/{baseline}/g, Math.floor(value * 2));
  
  // Clean up the result
  return cleanupBullet(improvedBullet);
}

/**
 * Creates a basic bullet when no templates are available
 * 
 * @private
 * @param {string} keyword - Technology/keyword
 * @param {string} context - Additional context
 * @returns {string} - Basic bullet
 */
function createBasicBullet(keyword, context) {
  const verbs = ['Developed', 'Built', 'Engineered', 'Implemented'];
  const verbIndex = Math.floor(Math.random() * verbs.length);
  const verb = verbs[verbIndex];
  
  if (context) {
    return `${verb} ${keyword} for ${context}`;
  }
  
  return `${verb} ${keyword}`;
}

/**
 * Cleans up generated bullet point text
 * - Fixes spacing
 * - Removes unwanted punctuation
 * - Ensures proper capitalization
 * - Removes duplicate words
 * 
 * @private
 * @param {string} text - Bullet text to clean
 * @returns {string} - Cleaned text
 */
function cleanupBullet(text) {
  if (!text) return '';
  
  // Remove extra spaces
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // Remove double punctuation
  cleaned = cleaned.replace(/([.!?])\1+/g, '$1');
  
  // Ensure single space before punctuation
  cleaned = cleaned.replace(/\s+([.!?,;:])/g, '$1');
  
  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  
  // Ensure period at end if missing
  if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
    cleaned += '.';
  }
  
  // Remove duplicate consecutive words
  const words = cleaned.split(/\s+/);
  const deduped = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      deduped.push(words[i]);
    }
  }
  
  return deduped.join(' ');
}

/**
 * Generates suggestions for improving a resume
 * 
 * @param {Object} resume - Resume object
 * @param {string[]} missingKeywords - Keywords not found in resume
 * @param {string} domain - Domain/role of resume
 * @returns {Object[]} - Array of suggestions
 * 
 * @example
 * generateSuggestions(resume, ['Docker', 'Kubernetes'], 'software_engineer')
 * // Returns: [
 * //   {
 * //     type: 'missing_keyword',
 * //     keyword: 'Docker',
 * //     message: 'Add Docker to your experience',
 * //     suggestion: 'Implemented Docker containerization...',
 * //     impact: 'high',
 * //     section: 'experience'
 * //   },
 * //   ...
 * // ]
 */
function generateSuggestions(resume, missingKeywords, domain = 'default') {
  const suggestions = [];
  
  if (!missingKeywords || missingKeywords.length === 0) {
    return suggestions;
  }
  
  // Group keywords by priority
  const prioritized = prioritizeKeywords(missingKeywords, domain);
  
  prioritized.forEach((keyword, index) => {
    // Only suggest top N keywords
    if (index >= 5) return;
    
    const improved = generateImprovedBullet({
      keyword,
      domain,
      context: `implementation or usage of ${keyword}`
    });
    
    suggestions.push({
      type: 'missing_keyword',
      keyword,
      message: `Add ${keyword} to your experience`,
      suggestion: improved,
      impact: index < 2 ? 'high' : 'medium',
      section: 'experience',
      priority: index + 1
    });
  });
  
  return deduplicateSuggestions(suggestions);
}

/**
 * Prioritizes keywords by importance
 * Technical keywords ranked higher than generic ones
 * 
 * @private
 * @param {string[]} keywords - Keywords to prioritize
 * @param {string} domain - Domain/role
 * @returns {string[]} - Prioritized keywords
 */
function prioritizeKeywords(keywords, domain) {
  const priorityMap = {};
  
  keywords.forEach((keyword, index) => {
    let score = 0;
    
    // Prefer domain-specific keywords
    if (DOMAIN_KEYWORDS[domain] && DOMAIN_KEYWORDS[domain].includes(keyword.toLowerCase())) {
      score += 10;
    }
    
    // Prefer longer keywords (more specific)
    score += keyword.length * 0.5;
    
    // Prefer technical terms
    if (keyword.match(/api|framework|library|database|cloud|framework/i)) {
      score += 5;
    }
    
    // Original position matters (first missing keywords are often more important)
    score -= index * 0.5;
    
    priorityMap[keyword] = score;
  });
  
  return keywords.sort((a, b) => priorityMap[b] - priorityMap[a]);
}

/**
 * Deduplicates suggestions
 * Removes duplicate suggestions that refer to the same issue
 * 
 * @param {Object[]} suggestions - Array of suggestions
 * @returns {Object[]} - Deduplicated suggestions
 */
function deduplicateSuggestions(suggestions) {
  const seen = new Set();
  const deduped = [];
  
  suggestions.forEach(suggestion => {
    // Create a dedup key from keyword and type
    const key = `${suggestion.type}:${normalizeText(suggestion.keyword)}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(suggestion);
    }
  });
  
  return deduped;
}

/**
 * Selects a random metric from METRICS
 * Deterministic based on keyword for consistency
 * 
 * @private
 * @returns {string} - Metric name
 */
function selectRandomMetric() {
  const allMetrics = Object.values(METRICS).flat();
  const index = Math.floor(Math.random() * allMetrics.length);
  return allMetrics[index];
}

/**
 * Selects a random value from BASELINE_VALUES
 * Picks a reasonable value based on category
 * 
 * @private
 * @param {string} metric - Metric name
 * @returns {string|number} - Value for metric
 */
function selectRandomValue(metric) {
  let values = BASELINE_VALUES.percentage;
  
  if (metric.includes('time') || metric.includes('latency') || metric.includes('response')) {
    values = BASELINE_VALUES.time;
  } else if (metric.includes('user') || metric.includes('request') || metric.includes('concurrent')) {
    values = BASELINE_VALUES.users;
  } else if (metric.includes('improvement') || metric.includes('performance')) {
    values = BASELINE_VALUES.multiplier;
  }
  
  const index = Math.floor(Math.random() * values.length);
  return values[index];
}

/**
 * Hash function for deterministic selection
 * 
 * @private
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

module.exports = {
  detectDomain,
  generateImprovedBullet,
  generateSuggestions,
  deduplicateSuggestions
};
