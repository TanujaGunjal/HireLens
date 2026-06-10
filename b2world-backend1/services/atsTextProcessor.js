/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS TEXT PROCESSOR
 * 
 * Handles text normalization, cleaning, and basic text operations
 * Used as foundation for keyword extraction and matching
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { STOPWORDS } = require('./atsConfig');

/**
 * Normalizes text for keyword matching and extraction
 * 
 * Operations:
 * - Convert to lowercase
 * - Remove HTML tags
 * - Remove URLs
 * - Remove email addresses
 * - Remove special characters (keep alphanumeric, spaces, hyphens)
 * - Remove extra whitespace
 * 
 * @param {string} text - Raw text to normalize
 * @returns {string} - Normalized text
 * 
 * @example
 * normalizeText('Check out https://example.com or email test@example.com')
 * // Returns: 'check out or email'
 * 
 * @example
 * normalizeText('C++ & C# Development')
 * // Returns: 'c and c development'
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Convert to lowercase
    .toLowerCase()
    // Remove HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, ' ')
    // Remove email addresses
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, ' ')
    // Remove file paths (Mac/Windows/Unix)
    .replace(/[a-zA-Z]:[\\\/][^\s]*/g, ' ')
    .replace(/\/[a-zA-Z0-9_./\-]*/g, ' ')
    // Remove timestamps
    .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, ' ')
    // Keep only alphanumeric, spaces, hyphens, dots, slashes
    .replace(/[^a-z0-9\s\-._/]/g, ' ')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Tokenizes text into words
 * 
 * @param {string} text - Text to tokenize
 * @returns {string[]} - Array of individual words
 */
function tokenize(text) {
  const normalized = normalizeText(text);
  return normalized.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Removes stopwords from token array
 * 
 * Stopwords are common words that don't carry meaningful information:
 * - Articles: a, an, the
 * - Prepositions: in, on, at, to, etc.
 * - Generic verbs: manage, help, support
 * - Common business fluff: ability, deliver, task
 * 
 * @param {string[]} tokens - Array of words
 * @returns {string[]} - Filtered tokens (stopwords removed)
 * 
 * @example
 * removeStopwords(['the', 'ability', 'to', 'manage', 'projects'])
 * // Returns: ['manage', 'projects']
 */
function removeStopwords(tokens) {
  return tokens.filter(token => !STOPWORDS.has(token) && token.length > 2);
}

/**
 * Extracts n-grams (multi-word phrases) from tokens
 * 
 * N-grams capture multi-word concepts like "machine learning" or "rest api"
 * This is important for technical keywords that are phrases, not single words
 * 
 * @param {string[]} tokens - Array of words
 * @param {number} n - Size of n-gram (2 or 3)
 * @returns {string[]} - N-grams joined with spaces
 * 
 * @example
 * extractNgrams(['machine', 'learning', 'model'], 2)
 * // Returns: ['machine learning', 'learning model']
 */
function extractNgrams(tokens, n = 2) {
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }
  return ngrams;
}

/**
 * Extracts ngrams and single tokens together
 * Used for comprehensive keyword matching
 * 
 * @param {string} text - Raw text
 * @returns {string[]} - Combined tokens and bigrams
 * 
 * @example
 * extractKeywordCandidates('Machine learning with Python')
 * // Returns: ['machine', 'learning', 'with', 'python', 'machine learning', ...]
 */
function extractKeywordCandidates(text) {
  const tokens = tokenize(text);
  const filtered = removeStopwords(tokens);
  
  // Include both single tokens and bigrams
  const unigrams = filtered;
  const bigrams = extractNgrams(filtered, 2).filter(bg => {
    const parts = bg.split(' ');
    return !parts.some(p => STOPWORDS.has(p));
  });
  
  return [...unigrams, ...bigrams];
}

/**
 * Computes similarity between two strings (Levenshtein distance ratio)
 * Used for fuzzy matching when exact match fails
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score 0-1 (1 = identical)
 * 
 * @example
 * computeSimilarity('nodejs', 'node.js')
 * // Returns: ~0.85 (high similarity)
 */
function computeSimilarity(str1, str2) {
  // Remove all non-alphanumeric for comparison
  const clean1 = str1.replace(/[^a-z0-9]/g, '');
  const clean2 = str2.replace(/[^a-z0-9]/g, '');
  
  if (clean1 === clean2) return 1;
  
  // Levenshtein distance
  const longer = clean1.length > clean2.length ? clean1 : clean2;
  const shorter = clean1.length > clean2.length ? clean2 : clean1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculates edit distance (Levenshtein) for similarity matching
 * 
 * @private
 * @param {string} longer - Longer string
 * @param {string} shorter - Shorter string
 * @returns {number} - Edit distance
 */
function getEditDistance(longer, shorter) {
  const costs = [];
  
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  
  return costs[shorter.length];
}

/**
 * Extracts sentences from text
 * Useful for context-aware keyword extraction
 * 
 * @param {string} text - Raw text
 * @returns {string[]} - Array of sentences
 */
function extractSentences(text) {
  const normalized = normalizeText(text);
  return normalized
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Extracts context around a keyword (surrounding words)
 * Useful for understanding keyword usage
 * 
 * @param {string} text - Text to search in
 * @param {string} keyword - Keyword to find context for
 * @param {number} windowSize - Number of words before/after (default 2)
 * @returns {string|null} - Context string or null if not found
 * 
 * @example
 * extractContext('I developed REST API with Node.js', 'REST API', 2)
 * // Returns: 'developed REST API with'
 */
function extractContext(text, keyword, windowSize = 2) {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const keywordTokens = tokenize(keyword);
  
  // Find keyword in tokens
  for (let i = 0; i <= tokens.length - keywordTokens.length; i++) {
    const match = tokens
      .slice(i, i + keywordTokens.length)
      .join(' ');
    
    if (normalizeText(match) === normalizeText(keyword)) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(tokens.length, i + keywordTokens.length + windowSize);
      return tokens.slice(start, end).join(' ');
    }
  }
  
  return null;
}

/**
 * Calculates text readability metrics
 * 
 * @param {string} text - Text to analyze
 * @returns {Object} - Readability metrics
 * 
 * @example
 * calculateReadability('Implemented feature. Built system. Optimized performance.')
 * // Returns: { avgWordsPerSentence: 2.33, avgSentenceLength: 14, ... }
 */
function calculateReadability(text) {
  const sentences = extractSentences(text);
  const words = tokenize(text);
  
  if (sentences.length === 0 || words.length === 0) {
    return {
      avgWordsPerSentence: 0,
      avgSentenceLength: 0,
      totalWords: 0,
      totalSentences: 0
    };
  }
  
  return {
    avgWordsPerSentence: words.length / sentences.length,
    avgSentenceLength: words.join(' ').length / sentences.length,
    totalWords: words.length,
    totalSentences: sentences.length,
    score: calculateReadabilityScore(words.length / sentences.length)
  };
}

/**
 * Calculates readability score (0-10) based on words per sentence
 * Optimal range is 10-20 words per sentence
 * 
 * @private
 * @param {number} avgWordsPerSentence - Average words per sentence
 * @returns {number} - Readability score 0-10
 */
function calculateReadabilityScore(avgWordsPerSentence) {
  // Optimal: 10-20 words per sentence
  // Below 10 or above 30 is difficult to read
  
  if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
    return 10;
  }
  
  if (avgWordsPerSentence < 10) {
    // Too short - fragmented
    return Math.max(5, 10 - (10 - avgWordsPerSentence) * 0.5);
  }
  
  // Too long - complex sentences
  const excess = avgWordsPerSentence - 20;
  return Math.max(2, 10 - excess * 0.1);
}

/**
 * Counts specific words in text (case-insensitive)
 * 
 * @param {string} text - Text to search
 * @param {string[]} words - Words to count
 * @returns {Object} - Map of word to count
 */
function countWords(text, words) {
  const normalized = normalizeText(text);
  const result = {};
  
  words.forEach(word => {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = normalized.match(pattern);
    result[word] = matches ? matches.length : 0;
  });
  
  return result;
}

/**
 * Detects language of text (basic detection)
 * Used to avoid false matches with non-English text
 * 
 * @param {string} text - Text to analyze
 * @returns {string} - Language code ('en', 'other')
 */
function detectLanguage(text) {
  if (!text) return 'en';
  
  // Simple heuristic: check for ASCII range
  const englishChars = (text.match(/[a-zA-Z0-9\s.,!?'-]/g) || []).length;
  const ratio = englishChars / text.length;
  
  return ratio > 0.8 ? 'en' : 'other';
}

module.exports = {
  normalizeText,
  tokenize,
  removeStopwords,
  extractNgrams,
  extractKeywordCandidates,
  computeSimilarity,
  extractSentences,
  extractContext,
  calculateReadability,
  countWords,
  detectLanguage
};
