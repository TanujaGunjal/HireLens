/**
 * ================================================================================
 * ENHANCED TECH KEYWORD DICTIONARY
 * ================================================================================
 * Comprehensive mapping of technology terms with:
 * - Multi-word phrases preserved
 * - Synonyms and variations
 * - Weight/Importance scores
 * - Category classification
 * ================================================================================
 */

'use strict';

/**
 * Comprehensive tech keyword dictionary
 * Format: canonical_form -> { synonyms: [], category: '', weight: 0 }
 */
const TECH_KEYWORD_DICTIONARY = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA SCIENCE & ML (High Value Keywords)
  // ═══════════════════════════════════════════════════════════════════════════
  'machine learning': { 
    synonyms: ['ml', 'ml'], 
    category: 'data_science',
    weight: 10
  },
  'deep learning': { 
    synonyms: ['neural networks', 'dl'], 
    category: 'data_science',
    weight: 9
  },
  'natural language processing': { 
    synonyms: ['nlp', 'text analysis'], 
    category: 'data_science',
    weight: 9
  },
  'data visualization': { 
    synonyms: ['visualization', 'data viz'], 
    category: 'data_science',
    weight: 8
  },
  'scikit-learn': { 
    synonyms: ['sklearn', 'scikit learn'], 
    category: 'data_science',
    weight: 8
  },
  'random forest': { 
    synonyms: [], 
    category: 'data_science',
    weight: 7
  },
  'logistic regression': { 
    synonyms: [], 
    category: 'data_science',
    weight: 7
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKEND FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  'spring boot': { 
    synonyms: ['springboot', 'spring'], 
    category: 'backend',
    weight: 9
  },
  'node.js': { 
    synonyms: ['nodejs', 'node'], 
    category: 'backend',
    weight: 9
  },
  'express.js': { 
    synonyms: ['express', 'expressjs'], 
    category: 'backend',
    weight: 8
  },
  'django': { 
    synonyms: ['django rest'], 
    category: 'backend',
    weight: 9
  },
  'flask': { 
    synonyms: [], 
    category: 'backend',
    weight: 8
  },
  'ruby on rails': { 
    synonyms: ['rails', 'ror'], 
    category: 'backend',
    weight: 8
  },
  'asp.net': { 
    synonyms: ['asp net', '.net'], 
    category: 'backend',
    weight: 8
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  'react': { 
    synonyms: ['reactjs', 'react.js'], 
    category: 'frontend',
    weight: 10
  },
  'vue.js': { 
    synonyms: ['vue', 'vuejs'], 
    category: 'frontend',
    weight: 9
  },
  'angular': { 
    synonyms: ['angularjs'], 
    category: 'frontend',
    weight: 9
  },
  'next.js': { 
    synonyms: ['nextjs', 'next'], 
    category: 'frontend',
    weight: 9
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASES
  // ═══════════════════════════════════════════════════════════════════════════
  'mongodb': { 
    synonyms: ['mongo', 'mongodb'], 
    category: 'database',
    weight: 9
  },
  'postgresql': { 
    synonyms: ['postgres', 'postgre', 'psql'], 
    category: 'database',
    weight: 9
  },
  'mysql': { 
    synonyms: [], 
    category: 'database',
    weight: 8
  },
  'dynamodb': { 
    synonyms: ['dynamo db'], 
    category: 'database',
    weight: 8
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOUD PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  'amazon web services': { 
    synonyms: ['aws', 'amazon'], 
    category: 'cloud',
    weight: 10
  },
  'microsoft azure': { 
    synonyms: ['azure', 'microsoft'], 
    category: 'cloud',
    weight: 10
  },
  'google cloud': { 
    synonyms: ['gcp', 'google cloud platform'], 
    category: 'cloud',
    weight: 10
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVOPS & TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  'docker': { 
    synonyms: [], 
    category: 'devops',
    weight: 9
  },
  'kubernetes': { 
    synonyms: ['k8s', 'k8'], 
    category: 'devops',
    weight: 9
  },
  'ci/cd': { 
    synonyms: ['cicd', 'continuous integration'], 
    category: 'devops',
    weight: 8
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BI & ANALYTICS TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  'power bi': { 
    synonyms: ['powerbi', 'power bi'], 
    category: 'analytics',
    weight: 8
  },
  'tableau': { 
    synonyms: [], 
    category: 'analytics',
    weight: 8
  },
  'looker': { 
    synonyms: [], 
    category: 'analytics',
    weight: 7
  },
};

/**
 * Extended technology synonyms for matching
 * Ensures variations are matched to canonical form
 */
const EXTENDED_TECH_SYNONYMS = {
  'machine learning': ['ml', 'machine-learning'],
  'deep learning': ['neural networks', 'neural-networks', 'dl'],
  'natural language processing': ['nlp', 'text-analysis', 'text analysis'],
  'data visualization': ['visualization', 'data-visualization', 'data viz', 'dataviz'],
  'scikit-learn': ['sklearn', 'scikit learn', 'scikit-learn'],
  'power bi': ['powerbi', 'power-bi'],
  'spring boot': ['springboot', 'spring-boot'],
  'node.js': ['nodejs', 'node.js', 'node'],
  'express.js': ['express', 'expressjs', 'express-js'],
  'ruby on rails': ['rails', 'ror', 'ruby-on-rails'],
  'asp.net': ['asp net', '.net', 'dotnet'],
  'vue.js': ['vue', 'vuejs', 'vue-js'],
  'next.js': ['next', 'nextjs', 'next-js'],
  'amazon web services': ['aws', 'amazon-web-services'],
  'microsoft azure': ['azure', 'microsoft-azure'],
  'google cloud': ['gcp', 'google-cloud', 'google-cloud-platform'],
};

/**
 * Normalize keyword to canonical form
 * Returns the primary form used in dictionary
 * @param {string} keyword - Raw keyword
 * @returns {string} Canonical form
 */
const normalizeToCanonical = (keyword) => {
  const normalized = keyword
    .toLowerCase()
    .replace(/[-_\/]/g, ' ')
    .trim();

  // Check if it's already a canonical form
  if (TECH_KEYWORD_DICTIONARY[normalized]) {
    return normalized;
  }

  // Check synonyms
  for (const [canonical, synonyms] of Object.entries(EXTENDED_TECH_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return canonical;
    }
  }

  // Return normalized form if not found
  return normalized;
};

/**
 * Get all variations of a keyword (canonical + synonyms)
 * @param {string} keyword - Raw or canonical keyword
 * @returns {string[]} All variations
 */
const getKeywordVariations = (keyword) => {
  const canonical = normalizeToCanonical(keyword);
  const dictEntry = TECH_KEYWORD_DICTIONARY[canonical];

  if (!dictEntry) {
    return [canonical];
  }

  return [
    canonical,
    ...(dictEntry.synonyms || []),
    ...(EXTENDED_TECH_SYNONYMS[canonical] || [])
  ].filter(v => v && typeof v === 'string');
};

/**
 * Get keyword weight/importance
 * @param {string} keyword - Keyword
 * @returns {number} Weight (1-10)
 */
const getKeywordWeight = (keyword) => {
  const canonical = normalizeToCanonical(keyword);
  const dictEntry = TECH_KEYWORD_DICTIONARY[canonical];
  return dictEntry?.weight || 5; // Default weight is 5
};

/**
 * Get keyword category
 * @param {string} keyword - Keyword
 * @returns {string} Category
 */
const getKeywordCategory = (keyword) => {
  const canonical = normalizeToCanonical(keyword);
  const dictEntry = TECH_KEYWORD_DICTIONARY[canonical];
  return dictEntry?.category || 'other';
};

/**
 * Check if keyword is multi-word
 * @param {string} keyword - Keyword
 * @returns {boolean}
 */
const isMultiWordKeyword = (keyword) => {
  return keyword.trim().includes(' ');
};

/**
 * Preserve multi-word keywords in text
 * Important: Match longer phrases first, then shorter ones
 * @param {string} text - Text to process
 * @returns {array} Extracted keywords preserving multi-word terms
 */
const extractKeywordsPreservingPhrases = (text) => {
  const found = new Set();
  const normalized = text.toLowerCase().replace(/[-_]/g, ' ');

  // Sort by phrase length (longest first) to ensure multi-word keywords are captured first
  const keywords = Object.keys(TECH_KEYWORD_DICTIONARY)
    .concat(Object.keys(EXTENDED_TECH_SYNONYMS).flatMap(k => EXTENDED_TECH_SYNONYMS[k]))
    .filter(k => k && typeof k === 'string')
    .sort((a, b) => b.length - a.length); // Longest first

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(normalized)) {
      found.add(normalizeToCanonical(keyword));
    }
  }

  return Array.from(found);
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORTS
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
  TECH_KEYWORD_DICTIONARY,
  EXTENDED_TECH_SYNONYMS,
  normalizeToCanonical,
  getKeywordVariations,
  getKeywordWeight,
  getKeywordCategory,
  isMultiWordKeyword,
  extractKeywordsPreservingPhrases
};
