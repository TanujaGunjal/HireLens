/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS KEYWORD EXTRACTOR & MATCHER
 * 
 * Handles keyword extraction from job descriptions and matching with resumes
 * Supports semantic matching with synonyms
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { KEYWORD_SYNONYMS, STOPWORDS } = require('./atsConfig');
const {
  normalizeText,
  tokenize,
  removeStopwords,
  extractNgrams,
  extractKeywordCandidates,
  computeSimilarity
} = require('./atsTextProcessor');

/**
 * Extracts keywords from job description text
 * 
 * Algorithm:
 * 1. Normalize text
 * 2. Tokenize and remove stopwords
 * 3. Extract unigrams and bigrams
 * 4. Filter by length and frequency
 * 5. Rank by relevance
 * 
 * @param {string} jdText - Job description text
 * @returns {string[]} - Array of extracted keywords (canonical form, sorted by relevance)
 * 
 * @example
 * extractJDKeywords('Looking for Node.js and React developer with REST API experience')
 * // Returns: ['react', 'node.js', 'rest api', 'developer', ...]
 */
function extractJDKeywords(jdText) {
  if (!jdText || typeof jdText !== 'string') {
    return [];
  }

  const normalized = normalizeText(jdText);
  const tokens = tokenize(normalized);
  const filtered = removeStopwords(tokens);
  
  if (filtered.length === 0) {
    return [];
  }
  
  // Extract unigrams and bigrams
  const unigrams = filtered.filter(token => !isGenericWord(token));
  const bigrams = extractNgrams(filtered, 2)
    .filter(bg => {
      const parts = bg.split(' ');
      return !parts.some(p => STOPWORDS.has(p) || isGenericWord(p));
    });
  
  // Combine and deduplicate
  const allCandidates = [...new Set([...bigrams, ...unigrams])];
  
  // Rank by relevance (bigrams and technical terms first)
  const ranked = allCandidates.sort((a, b) => {
    const aScore = getKeywordScore(a);
    const bScore = getKeywordScore(b);
    return bScore - aScore;
  });
  
  return ranked;
}

/**
 * Calculates relevance score for a keyword candidate
 * Considers: length, word count, technical indicators
 * Heavily weights technical and framework keywords
 * 
 * @private
 * @param {string} keyword - Keyword to score
 * @returns {number} - Relevance score
 */
function getKeywordScore(keyword) {
  let score = 0;
  const lowerKeyword = keyword.toLowerCase();
  
  // Prefer multi-word phrases (bigrams, trigrams)
  const wordCount = keyword.split(' ').length;
  score += wordCount * 2;
  
  // Prefer longer keywords (more specific)
  score += keyword.length * 0.1;
  
  // TECHNICAL BOOST - Heavy weighting for production tools
  
  // Programming Languages
  if (lowerKeyword.match(/javascript|typescript|python|java|c\+\+|go|rust|kotlin|scala|php|ruby|swift|csharp|c#/)) {
    score += 8;
  }
  
  // Frontend Frameworks
  if (lowerKeyword.match(/react|angular|vue|svelte|ember|next\.js|nuxt/)) {
    score += 8;
  }
  
  // Backend Frameworks
  if (lowerKeyword.match(/express|spring|django|flask|fastapi|nest|laravel|rails|aspnet/)) {
    score += 8;
  }
  
  // Databases
  if (lowerKeyword.match(/mongodb|postgresql|mysql|oracle|redis|cassandra|elasticsearch|dynamodb|sql/)) {
    score += 7;
  }
  
  // DevOps & Cloud
  if (lowerKeyword.match(/docker|kubernetes|aws|azure|gcp|cloud|terraform|jenkins|ci\/cd|devops|git|gitlab|github/)) {
    score += 8;
  }
  
  // APIs & Architecture
  if (lowerKeyword.match(/rest|graphql|api|microservice|architecture|design patterns/)) {
    score += 7;
  }
  
  // Testing & Quality
  if (lowerKeyword.match(/junit|jest|mocha|pytest|selenium|cypress|testing|tdd|bdd/)) {
    score += 6;
  }
  
  // Message Queues & Event Systems
  if (lowerKeyword.match(/rabbit|kafka|redis|activemq|message queue/)) {
    score += 6;
  }
  
  // Security & Authentication
  if (lowerKeyword.match(/oauth|jwt|authentication|security|encryption|ssl|https/)) {
    score += 6;
  }
  
  // Action Verbs (valuable but lower than technical)
  if (lowerKeyword.match(/^(develop|design|implement|deploy|architect|build|create|engineer)/)) {
    score += 4;
  }
  
  return score;
}

/**
 * Detects generic/non-technical words
 * 
 * @private
 * @param {string} word - Word to check
 * @returns {boolean} - True if word is generic
 */
function isGenericWord(word) {
  const genericWords = [
    'software', 'company', 'team', 'project', 'role', 'position',
    'business', 'industry', 'professional', 'technical', 'specific',
    'required', 'preferred', 'needed', 'important', 'key', 'person',
    'developer', 'engineer', 'candidate', 'individual', 'skills'
  ];
  
  return genericWords.includes(word);
}

/**
 * Matches resume text against JD keywords
 * Supports exact matching, synonym matching, and fuzzy matching
 * 
 * Algorithm:
 * 1. For each JD keyword, try exact match (with synonyms)
 * 2. If no exact match, try fuzzy match (similarity > 0.8)
 * 3. Return matched and missing keywords
 * 
 * @param {string} resumeText - Resume text (preferably normalized)
 * @param {string[]} jdKeywords - Keywords extracted from job description
 * @returns {Object} - Matching results
 * 
 * @example
 * const results = matchKeywords(resumeText, ['node.js', 'react', 'mongodb'])
 * // Returns: {
 * //   matched: ['node.js', 'react'],
 * //   missing: ['mongodb'],
 * //   matchedDetails: [
 * //     { keyword: 'node.js', foundAs: 'nodejs', method: 'synonym' }
 * //   ],
 * //   matchPercentage: 67
 * // }
 */
function matchKeywords(resumeText, jdKeywords) {
  if (!resumeText || !jdKeywords || jdKeywords.length === 0) {
    return {
      matched: [],
      missing: jdKeywords || [],
      matchedDetails: [],
      matchPercentage: 0
    };
  }
  
  const normalized = normalizeText(resumeText);
  const resumeTokens = tokenize(normalized);
  const resumeText_lower = normalized.toLowerCase();
  
  const matched = [];
  const missing = [];
  const matchedDetails = [];
  
  jdKeywords.forEach(keyword => {
    const result = findKeywordMatch(keyword, resumeText_lower, resumeTokens);
    
    if (result.found) {
      matched.push(keyword);
      matchedDetails.push({
        keyword,
        foundAs: result.foundAs,
        method: result.method
      });
    } else {
      missing.push(keyword);
    }
  });
  
  const matchPercentage = jdKeywords.length > 0
    ? Math.round((matched.length / jdKeywords.length) * 100)
    : 0;
  
  return {
    matched,
    missing,
    matchedDetails,
    matchPercentage
  };
}

function normalize(text) {
  if (!text || typeof text !== 'string') return "";
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Finds if a single keyword exists in resume text
 * Tries multiple matching strategies in order of confidence
 * 
 * @private
 * @param {string} keyword - Keyword to find
 * @param {string} resumeText - Resume text (normalized, lowercase)
 * @param {string[]} resumeTokens - Tokenized resume text
 * @returns {Object} - { found: boolean, foundAs: string, method: string }
 */
function findKeywordMatch(keyword, resumeText, resumeTokens) {
  const keywordNormalized = normalizeText(keyword);
  
  // Strategy 1: Exact phrase match (highest confidence)
  if (normalize(resumeText).includes(normalize(keyword))) {
    return {
      found: true,
      foundAs: keyword,
      method: 'exact'
    };
  }
  
  // Strategy 2: Synonym match (high confidence)
  const synonyms = getKeywordSynonyms(keyword);
  for (const synonym of synonyms) {
    if (resumeText.includes(normalizeText(synonym))) {
      return {
        found: true,
        foundAs: synonym,
        method: 'synonym'
      };
    }
  }
  
  // Strategy 3: Individual word match for multi-word keywords
  if (keyword.includes(' ')) {
    const words = tokenize(keyword);
    const allWordsFound = words.every(word =>
      resumeTokens.includes(word) || resumeTokens.some(token =>
        computeSimilarity(token, word) > 0.85
      )
    );
    
    if (allWordsFound) {
      return {
        found: true,
        foundAs: keyword,
        method: 'word_match'
      };
    }
  }
  
  // Strategy 4: Fuzzy match (medium confidence, only if high similarity)
  for (const resumeToken of resumeTokens) {
    const similarity = computeSimilarity(resumeToken, keywordNormalized);
    if (similarity > 0.85) {
      return {
        found: true,
        foundAs: resumeToken,
        method: 'fuzzy'
      };
    }
  }
  
  return {
    found: false,
    foundAs: null,
    method: null
  };
}

/**
 * Gets all synonym variations for a keyword
 * Includes semantic variations (verb forms, related terms)
 * 
 * @param {string} keyword - Keyword to get synonyms for
 * @returns {string[]} - Array of synonyms (including the original keyword)
 * 
 * @example
 * getKeywordSynonyms('deploy')
 * // Returns: ['deploy', 'deployed', 'deployment', 'deploying']
 * 
 * @example
 * getKeywordSynonyms('node.js')
 * // Returns: ['node.js', 'nodejs', 'node js', 'NodeJS']
 */
function getKeywordSynonyms(keyword) {
  const normalized = normalizeText(keyword);
  const variations = new Set([keyword]);
  
  // Check direct match in KEYWORD_SYNONYMS config
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (normalizeText(key) === normalized) {
      return [keyword, ...synonyms];
    }
    
    // Check if keyword is in synonyms array
    if (synonyms.includes(normalized) || synonyms.some(s => normalizeText(s) === normalized)) {
      return [key, keyword, ...synonyms];
    }
  }
  
  // SEMANTIC VERB VARIATIONS - Handle action-based keywords
  const semanticVariations = {
    // Deploy variations
    'deploy': ['deployment', 'deployed', 'deploying', 'deploy'],
    'deployed': ['deploy', 'deployment', 'deploying'],
    'deployment': ['deploy', 'deployed', 'deploying'],
    
    // Design variations
    'design': ['designed', 'designing', 'design', 'designer'],
    'designed': ['design', 'designing', 'designer'],
    
    // Optimize variations
    'optimize': ['optimization', 'optimized', 'optimizing'],
    'optimized': ['optimize', 'optimization', 'optimizing'],
    'optimization': ['optimize', 'optimized'],
    
    // Develop variations
    'develop': ['development', 'developed', 'developer', 'developing'],
    'developer': ['develop', 'development', 'developing'],
    'development': ['develop', 'developer', 'developing'],
    
    // Implement variations
    'implement': ['implementation', 'implemented', 'implementing'],
    'implemented': ['implement', 'implementation', 'implementing'],
    'implementation': ['implement', 'implemented'],
    
    // Create/Build variations
    'build': ['built', 'building', 'builder'],
    'built': ['build', 'builder', 'building'],
    
    'create': ['created', 'creation', 'creative'],
    'created': ['create', 'creation'],
    
    // Architecture variations
    'architect': ['architecture', 'architected', 'architectural'],
    'architected': ['architect', 'architecture'],
    'architecture': ['architect', 'architected'],
    
    // Manage variations
    'manage': ['management', 'managed', 'manager'],
    'managed': ['manage', 'management', 'manager'],
    'management': ['manage', 'managed'],
    
    // API variations
    'api': ['apis', 'rest api', 'rest', 'endpoint', 'endpoints'],
    'rest': ['api', 'rest api', 'apis'],
    'rest api': ['rest', 'api', 'apis'],
  };
  
  const lowerKeyword = keyword.toLowerCase().trim();
  if (semanticVariations[lowerKeyword]) {
    semanticVariations[lowerKeyword].forEach(v => variations.add(v));
  }
  
  // If no semantic variations found, return just the keyword
  return Array.from(variations);
}

/**
 * Expands keywords with synonyms for comprehensive matching
 * Useful for broad matching when exact keyword may not be in resume
 * 
 * @param {string[]} keywords - Keywords to expand
 * @returns {Object} - Map of canonical keyword to all variations
 * 
 * @example
 * expandKeywordsWithSynonyms(['node.js', 'react'])
 * // Returns: {
 * //   'node.js': ['node.js', 'nodejs', 'node js', ...],
 * //   'react': ['react', 'reactjs', 'react.js', ...]
 * // }
 */
function expandKeywordsWithSynonyms(keywords) {
  const expanded = {};
  
  keywords.forEach(keyword => {
    const canonical = normalizeText(keyword);
    expanded[canonical] = getKeywordSynonyms(keyword);
  });
  
  return expanded;
}

/**
 * Calculates detailed keyword matching score
 * 
 * @param {string} resumeText - Resume text
 * @param {string[]} jdKeywords - Keywords from job description
 * @returns {Object} - Detailed scoring information
 * 
 * @example
 * const score = calculateKeywordScore(resumeText, ['python', 'pandas', 'sql'])
 * // Returns: {
 * //   matched: 2,
 * //   missing: 1,
 * //   matchPercentage: 67,
 * //   score: 26.8,  // 67% * 40
 * //   totalKeywords: 3
 * // }
 */
function calculateKeywordScore(resumeText, jdKeywords) {
  const matchResults = matchKeywords(resumeText, jdKeywords);
  
  // Score should be 0-100 (percentage based). The final weight (e.g. 35% or 40%) is applied inside calculateATSScore.
  const score = matchResults.matchPercentage;
  
  return {
    matched: matchResults.matched,
    missing: matchResults.missing,
    matchPercentage: matchResults.matchPercentage,
    score: Math.round(score), // Round to nearest integer
    totalKeywords: jdKeywords.length,
    details: matchResults.matchedDetails
  };
}

/**
 * Filters keywords by category/type
 * Useful for domain-specific keyword extraction
 * 
 * @param {string[]} keywords - Keywords to filter
 * @param {string} category - Category to filter by ('tech', 'soft_skills', 'experience')
 * @returns {string[]} - Filtered keywords
 */
function filterKeywordsByCategory(keywords, category) {
  const techKeywords = new Set([
    'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'api', 'rest', 'graphql', 'sql', 'mongodb', 'docker', 'kubernetes',
    'aws', 'azure', 'gcp', 'devops', 'agile', 'microservices'
  ]);
  
  const softSkills = new Set([
    'leadership', 'communication', 'collaboration', 'teamwork', 'management',
    'problem', 'solving', 'critical', 'thinking', 'presentation'
  ]);
  
  switch (category) {
    case 'tech':
      return keywords.filter(kw => {
        const normalized = normalizeText(kw);
        return techKeywords.has(normalized);
      });
    case 'soft_skills':
      return keywords.filter(kw => {
        const normalized = normalizeText(kw);
        return softSkills.has(normalized);
      });
    default:
      return keywords;
  }
}

module.exports = {
  extractJDKeywords,
  matchKeywords,
  calculateKeywordScore,
  getKeywordSynonyms,
  expandKeywordsWithSynonyms,
  filterKeywordsByCategory
};
