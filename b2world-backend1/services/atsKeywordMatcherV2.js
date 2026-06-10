/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KEYWORD MATCHING ENGINE WITH SYNONYM SUPPORT
 * 
 * FIX: Flexibly match keywords with synonyms
 * Examples:
 * - "api development" matches "REST API development"
 * - "deploy" matches "deployment"
 * - "design" matches "designed"
 * - "optimize" matches "optimization"
 * 
 * Scoring: (matchedKeywords / totalJDKeywords) * 100
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ───────────────────────────────────────────────────────────────────────────
// SYNONYM MAPPING
// ───────────────────────────────────────────────────────────────────────────

const KEYWORD_SYNONYMS = {
  // Technology Keywords
  'api': ['rest api', 'restful api', 'graphql', 'grpc', 'web service', 'api development'],
  'apis': ['rest apis', 'restful apis', 'web services'],
  'rest': ['rest api', 'restful', 'rest api development'],
  'node': ['nodejs', 'node.js', 'node js'],
  'nodejs': ['node', 'node.js', 'node js'],
  'js': ['javascript', 'vanilla js'],
  'mongodb': ['mongo', 'mongo db', 'mongodb atlas'],
  'postgres': ['postgresql', 'postgres sql', 'pg'],
  'mysql': ['sql', 'relational database'],
  'docker': ['containerization', 'docker container'],
  'kubernetes': ['k8s', 'k8', 'orchestration'],
  'react': ['reactjs', 'react.js', 'react js', 'frontend framework'],
  'vue': ['vuejs', 'vue.js'],
  'angular': ['angularjs', 'angular.js'],
  'express': ['expressjs', 'express.js', 'express js'],
  'aws': ['amazon web services', 'cloud infrastructure'],
  'gcp': ['google cloud', 'google cloud platform'],
  'azure': ['azure cloud', 'microsoft azure'],

  // Action Verbs (normalized forms)
  'deploy': ['deployment', 'deployed', 'deploying', 'deploys'],
  'deployed': ['deploy', 'deployment', 'deploying'],
  'deployment': ['deploy', 'deployed', 'deploying'],
  'design': ['designed', 'designing', 'designer', 'architectural design'],
  'designed': ['design', 'designing'],
  'develop': ['development', 'developer', 'developed', 'developing'],
  'developed': ['develop', 'development', 'developing'],
  'development': ['develop', 'developed', 'developing'],
  'optimize': ['optimization', 'optimizing', 'optimized'],
  'optimized': ['optimize', 'optimization', 'optimizing'],
  'optimization': ['optimize', 'optimized', 'optimizing'],
  'improve': ['improvement', 'improved', 'improving'],
  'improved': ['improve', 'improvement', 'improving'],
  'improvement': ['improve', 'improved', 'improving'],
  'implement': ['implementation', 'implemented', 'implementing'],
  'implemented': ['implement', 'implementation', 'implementing'],
  'implementation': ['implement', 'implemented', 'implementing'],
  'test': ['testing', 'tested', 'unit test', 'integration test'],
  'testing': ['test', 'tested'],
  'tested': ['test', 'testing'],
  'build': ['built', 'building', 'builder'],
  'built': ['build', 'building'],
  'analyze': ['analysis', 'analyzed', 'analyzing'],
  'analyzed': ['analyze', 'analysis', 'analyzing'],
  'analysis': ['analyze', 'analyzed', 'analyzing'],
  'manage': ['management', 'managed', 'managing', 'manager'],
  'managed': ['manage', 'management', 'managing'],
  'management': ['manage', 'managed', 'managing'],
  'lead': ['leadership', 'leading', 'led', 'leader'],
  'led': ['lead', 'leadership', 'leading'],
  'leadership': ['lead', 'leading', 'led'],

  // Concepts
  'scalability': ['scalable', 'scale', 'scaling'],
  'scalable': ['scalability', 'scale', 'scaling'],
  'performance': ['high-performance', 'optimize performance', 'fast'],
  'reliability': ['reliable', 'fault-tolerant', 'high availability'],
  'reliable': ['reliability', 'dependable'],
  'automation': ['automated', 'automate', 'automating'],
  'automated': ['automation', 'automate'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'ci', 'cd'],
  'git': ['version control', 'github', 'gitlab', 'bitbucket'],
  'sql': ['database', 'relational database', 'mysql', 'postgres'],
  'nosql': ['mongodb', 'cassandra', 'dynamodb'],
  'agile': ['scrum', 'sprint', 'kanban'],
  'rest': ['restful api', 'http api'],

  // Skill Areas
  'frontend': ['ui', 'user interface', 'react', 'angular', 'vue'],
  'backend': ['server', 'api', 'database'],
  'fullstack': ['full stack', 'full-stack'],
  'cloud': ['aws', 'azure', 'gcp', 'cloud computing'],
  'security': ['secure', 'encryption', 'authentication', 'authorization'],
  'devops': ['ci/cd', 'deployment', 'infrastructure'],
  'database': ['sql', 'nosql', 'mongodb', 'postgres'],
  'microservices': ['service-oriented', 'distributed systems'],
  'api': ['rest api', 'graphql', 'web service']
};

/**
 * Normalize text for matching
 * @private
 */
function normalizeText(text = '') {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\-]/g, ' ')      // Remove special chars except hyphen
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}

/**
 * Get all synonyms for a keyword (including the keyword itself)
 * @private
 */
function getSynonyms(keyword) {
  const normalized = normalizeText(keyword);
  const synonyms = new Set([normalized]);

  // Add direct synonyms
  if (KEYWORD_SYNONYMS[normalized]) {
    KEYWORD_SYNONYMS[normalized].forEach(syn => {
      synonyms.add(normalizeText(syn));
    });
  }

  // Add reverse mappings (if keyword appears as value in another key)
  Object.entries(KEYWORD_SYNONYMS).forEach(([key, values]) => {
    if (values.some(v => normalizeText(v) === normalized)) {
      synonyms.add(key);
      values.forEach(v => synonyms.add(normalizeText(v)));
    }
  });

  return Array.from(synonyms);
}

/**
 * Check if text contains keyword or any of its synonyms
 * 
 * @param {string} text - Text to search in
 * @param {string} keyword - Keyword to match
 * @returns {boolean} - True if keyword or synonym found
 */
function matchesKeywordWithSynonyms(text, keyword) {
  if (!text || !keyword) return false;

  const normalizedText = normalizeText(text);
  const synonyms = getSynonyms(keyword);

  // Try exact phrase match first
  for (const synonym of synonyms) {
    if (normalizedText.includes(synonym)) {
      return true;
    }
  }

  // Try word-boundary match (for partial matches)
  for (const synonym of synonyms) {
    const words = synonym.split(/\s+/);
    if (words.length === 1) {
      // Single word - use word boundaries
      const wordRegex = new RegExp(`\\b${words[0]}\\b`);
      if (wordRegex.test(normalizedText)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract and normalize keywords from JD
 * @param {string|Array} jdInput - JD text or keyword array
 * @returns {Array} - Array of unique, normalized keywords
 */
function extractJDKeywords(jdInput) {
  if (!jdInput) return [];

  let text = '';

  if (Array.isArray(jdInput)) {
    // Already have keywords
    text = jdInput.map(k => String(k)).join(' ');
  } else if (typeof jdInput === 'string') {
    text = jdInput;
  } else if (jdInput.description) {
    text = jdInput.description;
  } else if (jdInput.jdText) {
    text = jdInput.jdText;
  }

  if (!text) return [];

  // Split into tokens and filter
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
    'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'experience', 'knowledge', 'ability', 'skills', 'requirement', 'required',
    'preferred', 'nice', 'years', 'plus', 'day', 'year', 'month'
  ]);

  const tokens = normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopwords.has(t) && !/^\d+$/.test(t));

  // Remove duplicates
  return Array.from(new Set(tokens));
}

/**
 * Calculate keyword match score
 * 
 * FORMULA: (matchedKeywords / totalJDKeywords) * 100
 * 
 * @param {string} resumeText - Full resume text
 * @param {Array} jdKeywords - Keywords from job description
 * @returns {Object} - {score, matched, missing, matchPercentage}
 */
function calculateKeywordScore(resumeText, jdKeywords) {
  if (!resumeText || !jdKeywords || jdKeywords.length === 0) {
    return {
      score: 0,
      matched: [],
      missing: [],
      matchPercentage: 0,
      details: {}
    };
  }

  const normalizedResume = normalizeText(resumeText);
  const matched = [];
  const missing = [];

  // Check each keyword
  jdKeywords.forEach(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    
    if (matchesKeywordWithSynonyms(normalizedResume, normalizedKeyword)) {
      matched.push(normalizedKeyword);
    } else {
      missing.push(normalizedKeyword);
    }
  });

  // Calculate score
  const matchPercentage = jdKeywords.length > 0 
    ? (matched.length / jdKeywords.length) * 100 
    : 0;

  const score = Math.min(100, Math.max(0, Math.round(matchPercentage)));

  return {
    score,
    matched: Array.from(new Set(matched)),
    missing: Array.from(new Set(missing)),
    matchPercentage: Math.round(matchPercentage * 10) / 10,
    details: {
      totalJDKeywords: jdKeywords.length,
      matchedCount: matched.length,
      missingCount: missing.length
    }
  };
}

module.exports = {
  calculateKeywordScore,
  matchesKeywordWithSynonyms,
  getSynonyms,
  extractJDKeywords,
  normalizeText,
  KEYWORD_SYNONYMS
};
