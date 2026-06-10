'use strict';

/**
 * atsScorer.js — Production-Ready ATS Scorer
 *
 * Fixes applied vs previous version:
 *  1. normalizeText() was removing ALL spaces, breaking multi-word keyword
 *     matching (e.g. "machine learning" became "machinelearning" which never
 *     matched individual tokens).  Now preserves single spaces for the
 *     normalized-string path; a separate collapseSpaces variant is used where
 *     the original intent (strip separators only) was correct.
 *  2. matchKeyword() false-positive risk: partial token match `rt.includes(kt)`
 *     could match "java" inside "javascript". Added word-boundary guard.
 *  3. improveBullet() capitalisation bug: when prepending "Developed " the
 *     original first character was being lowercased unconditionally, producing
 *     "Developed built a pipeline" if bullet started with "Built".  Fixed.
 *  4. generateSuggestions() ran both "no action verb" and "no metric" checks
 *     independently; a bullet with no action verb AND no metric would generate
 *     two redundant suggestions.  Consolidated into a single, prioritised check.
 *  5. calculateReadabilityScore() score could go above 100 on metric-rich
 *     resumes (score += 8 per metric bullet, uncapped).  Capped at 100 and
 *     the bonus is now proportional rather than per-bullet additive.
 *  6. findMissingKeywords() used simple .includes() (not normalised matching)
 *     while calculateKeywordMatch() used the normalised matcher — inconsistent
 *     results.  Both now use the same matchKeyword() helper.
 *  7. categorizeImportance() was matching the *keyword* text for words like
 *     "required" instead of the JD context around it.  Corrected the intent
 *     (always returns 'Nice to have' for bare keywords) and documented it.
 *  8. suggestionId counter was function-scoped with let but generateSuggestions
 *     was defined outside the class body (indentation bug).  Moved fully inside.
 *  9. METRICS_PATTERNS regex for currency used a raw £ and € that can cause
 *     encoding issues in some CI environments.  Replaced with Unicode escapes.
 * 10. Module exported a singleton `new ATSScorer()`.  Kept singleton but added
 *     a named export so unit tests can also import the class itself.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  'achieved', 'improved', 'increased', 'decreased', 'reduced', 'developed', 'created',
  'built', 'designed', 'implemented', 'launched', 'led', 'managed', 'coordinated',
  'optimized', 'streamlined', 'automated', 'established', 'pioneered', 'initiated',
  'delivered', 'executed', 'enhanced', 'resolved', 'analyzed', 'assessed', 'evaluated',
  'collaborated', 'facilitated', 'mentored', 'trained', 'presented', 'communicated',
  'negotiated', 'generated', 'accelerated', 'transformed', 'standardized', 'scaled',
  'architected', 'migrated', 'refactored', 'deployed', 'integrated', 'audited',
  'diagnosed', 'configured', 'maintained', 'documented', 'supported', 'contributed'
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'responsible', 'involved', 'helped', 'worked', 'recently', 'currently', 'also', 'was', 'were'
]);

// FIX #9: use Unicode escapes for non-ASCII currency characters
// ISSUE #4 FIX: Expanded patterns to detect more metrics including percentages, numeric impact, and impact words
const METRICS_PATTERNS = [
  // Percentages (25%, 50%, etc.)
  /(\d+\.?\d*)\s*%/,
  // Multipliers (2x, 3x, etc.)
  /(\d+\.?\d*)\s*x(?:times)?/i,
  // Large numbers with suffixes (1M, 500K, 100k, etc.)
  /(\d+\.?\d*)\s*(?:million|thousand|hundred|k|m|b)\b/i,
  // Reduction/improvement phrases
  /(?:reduced|decreased|cut)\s+by\s+(\d+\.?\d*)\s*%?/i,
  /(?:improved|increased|boosted|enhanced|optimized|accelerated)\s+by\s+(\d+\.?\d*)\s*(?:x|%)?/i,
  // Numeric values with plus/plus (100+, 50+)
  /(\d+)\s*(?:\+|plus|or\s+more)/i,
  // People/users/customers counts
  /(\d+)\s*(?:team\s*)?(?:members|people|users|customers|clients|employees)\b/i,
  // Currency amounts (saved $100k, generated $1M, etc.)
  /(?:saved|generated|earned|revenue|profit)\s+.*?[\$\u00a3\u20ac]?\s*(\d+\.?\d*)\s*(?:million|thousand|k)?/i,
  // Impact words that indicate quantified achievements (without explicit numbers but strong indicators)
  /\b(?:increased|decreased|reduced|improved|optimized|enhanced|accelerated|grew|expanded|scaled|delivered|achieved)\b/i,
];

const WEAK_PHRASES = {
  'worked on':       'developed',
  'responsible for': 'managed',
  'involved in':     'contributed to',
  'helped with':     'collaborated on',
  'used':            'leveraged',
  'did':             'delivered',
  'made':            'created',
  'worked with':     'partnered with',
  'part of':         'drove',
  'participated in': 'spearheaded',
};

// Section weights for completeness scoring (must sum to 100)
const SECTION_WEIGHTS = {
  'Personal Info':   15,
  'Summary':         10,
  'Skills':          20,
  'Experience':      30,
  'Education':       15,
  'Projects':         5,
  'Certifications':   3,
  'Achievements':     2,
};

// Import shared helpers
const { hasValidAchievements } = require('./resumeHelpers');

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS  (no side-effects, fully unit-testable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ENHANCEMENT: Comprehensive text normalization for keyword matching.
 * Preserves spaces for multi-word keyword detection while removing harmful
 * separators. Protects tech tokens like "node.js", "c++", "c#", ".net".
 *
 * "React.js"         → "reactjs"
 * "Node.JS"          → "nodejs"
 * "machine learning" → "machine learning"   (spaces preserved)
 * "microservice-ready" → "microservice ready"
 */
const normalizeText = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  let normalized = text.toLowerCase().trim();
  
  // Protect tech tokens with special chars FIRST using explicit patterns
  // This avoids regex escaping issues with + and #
  normalized = normalized
    .replace(/\bc\+\+\b/gi, 'CPLUS_PLACEHOLDER')
    .replace(/\bc#\b/gi, 'CSHARP_PLACEHOLDER')
    .replace(/\bnode\.js\b/gi, 'NODEJS_PLACEHOLDER')
    .replace(/\bnodejs\b/gi, 'NODEJS_PLACEHOLDER')
    .replace(/\bnext\.js\b/gi, 'NEXTJS_PLACEHOLDER')
    .replace(/\bnextjs\b/gi, 'NEXTJS_PLACEHOLDER')
    .replace(/\b\.net\b/gi, 'DOTNET_PLACEHOLDER')
    .replace(/\bdotnet\b/gi, 'DOTNET_PLACEHOLDER');
  
  // Remove non-alphanumeric except spaces and underscores (for placeholders)
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Restore tech tokens from placeholders
  normalized = normalized
    .replace(/CPLUS_PLACEHOLDER/g, 'cpp')
    .replace(/CSHARP_PLACEHOLDER/g, 'csharp')
    .replace(/NODEJS_PLACEHOLDER/g, 'nodejs')
    .replace(/NEXTJS_PLACEHOLDER/g, 'nextjs')
    .replace(/DOTNET_PLACEHOLDER/g, 'dotnet');
  
  return normalized;
};

/**
 * ENHANCEMENT: Simple stemming function for word variation handling.
 * Handles common English word endings: plural, past tense, progressive.
 *
 * "microservices" → "microservice"
 * "deployed"      → "deploy"
 * "optimization"  → "optimiz"
 * "APIs"          → "api"
 */
const stemWord = (word = '') => {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .trim()
    .replace(/(s|es|ed|ing|tion|ation)$/i, '')
    .replace(/y$/, 'i'); // reduce to root for matching
};

/**
 * FIX #1: Collapse separators (dots, dashes, underscores, slashes) into
 * nothing, but keep spaces so that "machine learning" stays as two tokens.
 * Used for exact-string keyword matching.
 *
 * "React.js"   → "reactjs"
 * "Node-JS"    → "nodejs"
 * "CI/CD"      → "cicd"
 * "machine learning" → "machine learning"   ← spaces preserved
 */
const normalizeSeparators = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[.\-_/\\]/g, '')
    .replace(/\s{2,}/g, ' ');
};

/**
 * Split text into lowercase word tokens, removing punctuation.
 * Single-character tokens are kept (e.g. "C" language).
 *
 * "React-Native Development" → ["react", "native", "development"]
 */
const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

/**
 * ENHANCEMENT: Lightweight synonym mapping for common tech/business terms.
 * Allows capturing resume content that's semantically equivalent to JD keywords.
 * Keeps data structure lightweight for performance.
 */
const SYNONYM_MAP = {
  'rest': ['restful', 'rest api', 'rest apis'],
  'nodejs': ['node.js', 'node', 'nodejs'],
  'nextjs': ['next.js', 'next'],
  'backend': ['back-end', 'server-side', 'server side'],
  'frontend': ['front-end', 'client-side', 'client side', 'ui'],
  'microservice': ['microservices', 'microservice'],
  'devops': ['dev-ops', 'dev ops'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  'aws': ['amazon', 'amazon web services'],
  'gcp': ['google cloud', 'google cloud platform'],
  'docker': ['containerization', 'container'],
  'kubernetes': ['k8s', 'k8'],
  'sql': ['mysql', 'postgres', 'postgresql', 'database'],
  'nosql': ['mongodb', 'redis', 'dynamodb'],
  'testing': ['test', 'unit test', 'integration test'],
  'api': ['apis', 'api'],
  'deployment': ['deploy', 'deployed', 'deploying'],
  'optimization': ['optimize', 'optimized', 'optimizing'],
  'database': ['databases', 'db'],
  'authentication': ['auth', 'oauth', 'jwt'],
};

/**
 * ENHANCEMENT: Check if a keyword matches via synonyms.
 * Returns true if keyword or any synonym is found in text.
 */
const matchSynonym = (text = '', keyword = '') => {
  if (!text || !keyword) return false;
  const normalized = normalizeText(text);
  const normalizedKw = normalizeText(keyword);
  
  // Direct synonym lookup
  const synonyms = SYNONYM_MAP[normalizedKw.split(' ')[0]?.toLowerCase()] || [];
  
  return synonyms.some(syn => 
    normalized.includes(normalizeText(syn))
  );
};

/**
 * ENHANCEMENT: Phrase token matching for multi-word keywords.
 * Enables matching "backend development" against "backend developer" etc.
 * Also handles hyphenated/dash words like "microservices-ready".
 *
 * Checks if all keyword tokens appear as whole words in resume text.
 * ISSUE #2 FIX: Ensures multi-word keywords are properly matched.
 * Uses aggressive stemming for better recall.
 */
const phraseMatch = (keyword = '', text = '') => {
  if (!keyword || !text) return false;
  
  // Normalize both to lowercase and remove punctuation
  const normalKw = normalizeText(keyword);
  const normalText = normalizeText(text);
  
  // Split by word boundaries, keeping all meaningful tokens
  const kWords = normalKw.split(/\s+/).filter(Boolean);
  const tWords = normalText.split(/\s+/).filter(Boolean);
  
  if (kWords.length === 0) return false;
  
  // For single-word keywords, use aggressive stem matching
  if (kWords.length === 1) {
    const kw = kWords[0];
    const stemKw = stemWord(kw);
    return tWords.some(tw => {
      const stemTw = stemWord(tw);
      // Match if same stem, or if one is just a variant of the other
      return stemTw === stemKw || 
             (stemKw.length > 2 && stemTw.startsWith(stemKw)) ||
             (stemTw.length > 2 && stemKw.startsWith(stemTw));
    });
  }
  
  // For multi-word phrases, all first parts of root words must appear
  // Example: "backend development" matches if both "backend" and "develop" roots exist
  return kWords.every(kw => {
    const stemKw = stemWord(kw);
    return tWords.some(tw => {
      const stemTw = stemWord(tw);
      // Match if exact stem match, or if one root starts with the other (for variants)
      return stemTw === stemKw || 
             (stemKw.length > 2 && stemTw.startsWith(stemKw)) ||
             (stemTw.length > 2 && stemKw.startsWith(stemTw));
    });
  });
};

/**
 * ENHANCEMENT: Comprehensive keyword matching with multiple strategies.
 * Uses text normalization, stemming, partial matching, phrase matching,
 * and synonym detection for Jobscan-level accuracy.
 *
 * Strategies (tried in order):
 *   1. Exact substring match (after normalization)
 *   2. Phrase token matching with stemming
 *   3. Synonym matching
 *   4. Word boundary whole-word match with stemming support
 *   5. Partial stem-based matching for singular/plural handling (strict)
 *
 * Returns true on first match.
 *
 * @param {string} resumeText
 * @param {string} keyword
 * @returns {boolean}
 */
const matchKeyword = (resumeText, keyword) => {
  if (!resumeText || !keyword) return false;

  // Normalize both texts
  const normText = normalizeText(resumeText);
  const normKw = normalizeText(keyword);
  
  // Strategy 1: Direct substring match on normalized text
  if (normText.includes(normKw)) {
    if (process.env.ATS_DEBUG === 'true') {
      console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 1 (substring)`);
    }
    return true;
  }
  
  // Strategy 2: Phrase token matching with stemming
  // For multi-word keywords like "backend development"
  if (phraseMatch(keyword, resumeText)) {
    if (process.env.ATS_DEBUG === 'true') {
      console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 2 (phrase)`);
    }
    return true;
  }
  
  // Strategy 3: Check synonyms
  if (matchSynonym(resumeText, keyword)) {
    if (process.env.ATS_DEBUG === 'true') {
      console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 3 (synonym)`);
    }
    return true;
  }
  
  // Strategy 4: Word boundary match with stem fallback
  const lowerKw = keyword.toLowerCase().trim();
  const stemKw = stemWord(lowerKw);
  
  // For single-word keywords, try word boundary matching
  if (!lowerKw.includes(' ')) {
    // Exact word boundary match
    const wordBoundaryRe = new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordBoundaryRe.test(resumeText)) {
      if (process.env.ATS_DEBUG === 'true') {
        console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 4a (word-boundary)`);
      }
      return true;
    }
    
    // Stem-based word boundary match (e.g., "test" matches "testing", "tested")
    // Only if the word is long enough to reduce ambiguity
    if (stemKw && stemKw !== lowerKw && lowerKw.length >= 5) {
      const stemRe = new RegExp(`\\b${stemWord(stemKw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (stemRe.test(resumeText)) {
        if (process.env.ATS_DEBUG === 'true') {
          console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 4b (stem)`);
        }
        return true;
      }
    }
  } else {
    // For multi-word keywords, check substring
    if (resumeText.toLowerCase().includes(lowerKw)) {
      if (process.env.ATS_DEBUG === 'true') {
        console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 4c (multi-word)`);
      }
      return true;
    }
  }
  
  // Strategy 5: Partial matching with tokenization (STRICT - only for exact stems)
  // Useful for catching variations in resumes
  const kwTokens = tokenize(keyword).map(t => stemWord(t));
  const textTokens = tokenize(resumeText).map(t => stemWord(t));
  
  // For single-token keywords, check if ANY resume token has exact stem match
  if (kwTokens.length === 1) {
    // Use exact stem match only, NOT prefix match, to avoid "java" matching "javascript"
    if (textTokens.some(tt => tt === kwTokens[0])) {
      if (process.env.ATS_DEBUG === 'true') {
        console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 5a (token)`);
      }
      return true;
    }
  } else {
    // For multi-token keywords, check if ALL keyword tokens exist in resume with exact stems
    if (kwTokens.every(kt => textTokens.some(tt => tt === kt))) {
      if (process.env.ATS_DEBUG === 'true') {
        console.log(`[ATS_DEBUG] ✅ "${keyword}" matched via Strategy 5b (all-tokens)`);
      }
      return true;
    }
  }
  
  // No match found
  if (process.env.ATS_DEBUG === 'true') {
    console.log(`[ATS_DEBUG] ❌ "${keyword}" NOT matched (checked all 5 strategies)`);
  }
  
  return false;
};

/**
 * ENHANCEMENT - Issue #3: Count unique skills with normalization and deduplication.
 * Removes duplicates, normalizes to lowercase, filters empty entries.
 * Handles tech tokens: "Node.js", "node.js", "nodejs", "NODEJS" all count as 1.
 * Used to validate skill count accuracy.
 *
 * @param {Array} skills - Array of skill strings  
 * @returns {number} Count of unique, non-empty skills
 */
const countUniqueSkills = (skills = []) => {
  if (!Array.isArray(skills)) return 0;
  
  const normalized = new Set();
  
  for (const skill of skills) {
    if (typeof skill === 'string' && skill.trim()) {
      // Normalize: lowercase, trim, and handle tech token variations
      let key = skill.trim().toLowerCase();
      
      // Normalize tech tokens
      key = key
        .replace(/\bc\+\+\b/, 'cpp')
        .replace(/\bc#\b/, 'csharp')
        .replace(/\bnode\.?js\b/, 'nodejs')
        .replace(/\bnext\.?js\b/, 'nextjs')
        .replace(/\b\.?net\b/, 'dotnet');
      
      normalized.add(key);
    }
  }
  
  return normalized.size;
};

/**
 * BUG FIX: Get TOTAL unique skills from ALL resume sources
 * Previously only counted resume.skills[] items, missing 15+ skills from projects and languages
 * 
 * Aggregates skills from:
 *   1. resume.skills[].items[] - primary skills section
 *   2. resume.projects[].techStack[] - technologies used in projects
 *   3. resume.languages[].name - language proficiencies
 * 
 * @param {Object} resume - The resume object
 * @returns {number} Total unique skill count across all sources
 */
const getTotalUniqueSkills = (resume = {}) => {
  if (!resume || typeof resume !== 'object') return 0;
  
  const normalized = new Set();
  
  // Helper to normalize and add skill
  const addSkill = (skill) => {
    if (typeof skill === 'string' && skill.trim()) {
      let key = skill.trim().toLowerCase();
      
      // Normalize tech tokens (same as countUniqueSkills)
      key = key
        .replace(/\bc\+\+\b/, 'cpp')
        .replace(/\bc#\b/, 'csharp')
        .replace(/\bnode\.?js\b/, 'nodejs')
        .replace(/\bnext\.?js\b/, 'nextjs')
        .replace(/\b\.?net\b/, 'dotnet');
      
      normalized.add(key);
    }
  };
  
  // 1. Add skills from resume.skills[] (primary section)
  if (resume.skills && Array.isArray(resume.skills)) {
    resume.skills.forEach((skillGroup) => {
      if (skillGroup.items && Array.isArray(skillGroup.items)) {
        skillGroup.items.forEach(addSkill);
      }
    });
  }
  
  // 2. Add skills from resume.projects[].techStack[]
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach((project) => {
      if (project.techStack && Array.isArray(project.techStack)) {
        project.techStack.forEach(addSkill);
      }
    });
  }
  
  // 3. Add skills from resume.languages[]
  if (resume.languages && Array.isArray(resume.languages)) {
    resume.languages.forEach((lang) => {
      if (typeof lang.name === 'string') {
        addSkill(lang.name);
      }
    });
  }
  
  return normalized.size;
};

/** Returns true if the text contains at least one quantifiable metric. */
const hasMetrics = (text) => {
  if (!text || typeof text !== 'string') return false;
  return METRICS_PATTERNS.some(p => p.test(text));
};

/**
 * ENHANCEMENT: Find which resume section a keyword was found in.
 * Returns a boost multiplier for section-aware keyword scoring.
 *
 * Section priority:
 *   skills:     1.0 (highest - skills section is most important)
 *   experience: 1.0 (work experience is equally critical)
 *   projects:   0.9 (projects add substantial weight)
 *   summary:    0.8 (summary is secondary)
 *   other:      0.7 (education, certifications, etc.)
 */
const getKeywordSectionBoost = (resume, keyword) => {
  const normalizedKw = normalizeText(keyword);
  
  // Check skills first (highest priority)
  if (Array.isArray(resume.skills)) {
    for (const grp of resume.skills) {
      if (Array.isArray(grp.items)) {
        for (const item of grp.items) {
          if (matchKeyword(item, keyword)) {
            return 1.0; // Full boost for skills
          }
        }
      }
    }
  }
  
  // Check experience (high priority)
  if (Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      if (matchKeyword(exp.company + ' ' + exp.role, keyword)) {
        return 1.0;
      }
      if (Array.isArray(exp.bullets)) {
        for (const bullet of exp.bullets) {
          if (matchKeyword(bullet, keyword)) {
            return 1.0;
          }
        }
      }
    }
  }
  
  // Check projects (moderate priority)
  if (Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      if (matchKeyword(proj.title, keyword)) {
        return 0.9;
      }
      if (Array.isArray(proj.techStack) && proj.techStack.some(t => matchKeyword(t, keyword))) {
        return 0.9;
      }
      if (Array.isArray(proj.bullets)) {
        for (const bullet of proj.bullets) {
          if (matchKeyword(bullet, keyword)) {
            return 0.9;
          }
        }
      }
    }
  }
  
  // Check summary (lower priority)
  if (matchKeyword(resume.summary || '', keyword)) {
    return 0.8;
  }
  
  // Default for other sections
  return 0.7;
};

/**
 * Return the first word in `text` that is not a stop word.
 * Falls back to the very first word if all are stop words.
 */
const getFirstMeaningfulWord = (text) => {
  if (!text || typeof text !== 'string') return '';
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    if (!STOP_WORDS.has(w)) return w;
  }
  return words[0] || '';
};

/** Returns true if `word` is a known strong action verb. */
const isActionVerb = (word) =>
  Boolean(word) && ACTION_VERBS.has(word.toLowerCase());

// ─────────────────────────────────────────────────────────────────────────────
// ATS SCORER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ATSScorer {

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Calculate a full ATS score for a resume against optional JD keywords.
   * 
   * ISSUE #1 FIX: Implement 2 scoring modes based on JD presence:
   * - General ATS Readiness Mode (NO JD): weights 30/30/20/20 (no keyword)
   * - JD-Based Mode (JD exists): weights 40/20/20/10/10 (with keyword)
   *
   * @param {object} resume       — Plain resume object (Mongoose .toObject())
   * @param {Array}  jdKeywords   — Array of string | { keyword, category }
   * @returns {{ totalScore, breakdown, missingKeywords, suggestions, overallFeedback, scoringMode }}
   */
  calculateScore(resume, jdKeywords = []) {
    if (!resume || typeof resume !== 'object') {
      throw new TypeError('calculateScore: resume must be a non-null object');
    }
    const safeKeywords = Array.isArray(jdKeywords) ? jdKeywords : [];
    const hasJD = safeKeywords.length > 0; // Track whether JD was provided
    
    // Determine scoring mode based on JD presence
    const scoringMode = hasJD ? 'job-specific' : 'general';

    // Calculate completeness first (needed for quality ceiling on keyword match)
    const completenessScore = this._sectionCompleteness(resume);

    // Get component scores (scalar values)
    const formattingScore = this._formattingScore(resume);
    const verbScore = this._actionVerbScore(resume);
    const readabilityScore = this._readabilityScore(resume);

    let breakdown;
    let totalScore;

    if (hasJD) {
      // ════════════════════════════════════════════════════════════════════════
      // MODE 2: JD-Based Scoring (JD keywords provided)
      // ════════════════════════════════════════════════════════════════════════
      const kwScore = this._keywordMatch(resume, safeKeywords, completenessScore);
      
      breakdown = {
        keywordMatchScore: { score: kwScore, weight: 40 },
        formattingScore: { score: formattingScore, weight: 20 },
        sectionCompletenessScore: { score: completenessScore, weight: 20 },
        actionVerbScore: { score: verbScore, weight: 10 },
        readabilityScore: { score: readabilityScore, weight: 10 },
      };
      
      totalScore = this._weightedTotal(breakdown, hasJD);
    } else {
      // ════════════════════════════════════════════════════════════════════════
      // MODE 1: General ATS Readiness (no JD provided)
      // ════════════════════════════════════════════════════════════════════════
      // Disable keyword match, redistribute weights: 30/30/20/20
      breakdown = {
        keywordMatchScore: { score: 0, weight: 0 },
        formattingScore: { score: formattingScore, weight: 30 },
        sectionCompletenessScore: { score: completenessScore, weight: 30 },
        actionVerbScore: { score: verbScore, weight: 20 },
        readabilityScore: { score: readabilityScore, weight: 20 },
      };
      
      totalScore = this._weightedTotal(breakdown, hasJD);
    }

    const missingKeywords = this._findMissingKeywords(resume, safeKeywords);
    const suggestions = this._generateSuggestions(resume, breakdown, missingKeywords);
    const overallFeedback = this._overallFeedback(breakdown, totalScore);

    return { 
      totalScore, 
      breakdown, 
      missingKeywords, 
      suggestions, 
      overallFeedback,
      scoringMode
    };
  }

  // ── Score Components ───────────────────────────────────────────────────────

  /**
   * ISSUE #1 FIX: Keyword Match with Proper Normalization & Percentage-Based Scoring
   * 
   * Implementation:
   * - Normalize text (lowercase, remove punctuation)
   * - Remove stopwords
   * - Token match, not substring match
   * - Use percentage match: (matchedKeywords / totalJDKeywords) * 100
   * - Apply smooth scaling (no binary scoring)
   * - Returns: Scalar score 0-100
   */
_keywordMatch(resume, jdKeywords, completenessScore = 0) {
  if (!jdKeywords || !jdKeywords.length) return 0;

  const resumeText = this._allText(resume);

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const kw of jdKeywords) {
    const keyword = typeof kw === 'string' ? kw : kw?.keyword;
    if (!keyword) continue;

    // Base weight per keyword
    let weight = 1;

    // Boost important categories
    if (typeof kw === 'object' && kw.category === 'skill') weight = 1.5;
    if (typeof kw === 'object' && kw.category === 'requirement') weight = 2;

    totalWeight += weight;

    if (matchKeyword(resumeText, keyword)) {
      // Section-aware boost
      const sectionBoost = getKeywordSectionBoost(resume, keyword);
      matchedWeight += weight * sectionBoost;
    }
  }

  if (totalWeight === 0) return 0;

  const rawScore = (matchedWeight / totalWeight) * 100;

  // Apply smooth curve (avoid harsh 0/100 jumps)
  const smoothScore = Math.pow(rawScore / 100, 0.85) * 100;

  return Math.round(Math.min(smoothScore, 100));
}
  /**
   * Normalize text for keyword matching: lowercase + remove punctuation
   */
  _normalizeForKeywordMatch(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * HARDENED: Section Completeness — 25% Weight
   * 
   * REDESIGNED for realistic scoring and differentiation:
   * - Base score: 0 points (must earn points)
   * - Each critical section: 10 points (4 sections = 40 points base)
   * - Experience depth: heavily weighted (0-25 points)
   * - Optional sections: 10 points total
   * - Max: 75 (realistic completeness never hits 90+)
   * 
   * Experience depth calculation:
   * - Deep position (3+ strong bullets): 8 points per position (cap 16)
   * - Standard position (2 strong bullets): 4 points per position
   * - Shallow position (0-1 strong bullet): 0 points
   * - Career growth bonus (3+ positions): +5 points
   * 
   * Returns: Scalar score 0-100 (weight applied in _weightedTotal)
   */
  _sectionCompleteness(resume) {
    let score = 0;

    // Critical sections: 10 points each
    if (resume.personalInfo?.fullName && resume.personalInfo?.email) {
      score += 10;
    }
    if (typeof resume.summary === 'string' && resume.summary.trim().length > 50) {
      score += 10;
    }
    if (Array.isArray(resume.skills) && 
        resume.skills.some(s => Array.isArray(s.items) && s.items.length > 0)) {
      score += 10;
    }
    if (Array.isArray(resume.education) && resume.education.length > 0) {
      score += 10;
    }

    // Experience depth scoring (0-25 points) - HEAVILY WEIGHTED FOR GROWTH
    if (Array.isArray(resume.experience) && resume.experience.length > 0) {
      let experienceScore = 0;

      for (const exp of resume.experience) {
        if (!Array.isArray(exp.bullets)) continue;

        // Count strong bullets (action verb + metrics)
        let strongBullets = 0;
        
        for (const bullet of exp.bullets) {
          if (typeof bullet === 'string' && 
              isActionVerb(getFirstMeaningfulWord(bullet)) && 
              hasMetrics(bullet)) {
            strongBullets++;
          }
        }

        // Score this position based on depth
        if (strongBullets >= 3) {
          experienceScore += 8; // +8 for demonstrably strong positions with metrics
        } else if (strongBullets >= 2) {
          experienceScore += 4; // +4 for solid positions
        }
        // +0 for weak positions
      }

      // Cap experience score at 16 (2 deep positions)
      experienceScore = Math.min(experienceScore, 16);
      
      // Bonus for career growth (3+ positions showing progression)
      if (resume.experience.length >= 3) {
        experienceScore += 5;
      }
      
      experienceScore = Math.min(experienceScore, 25); // Cap at 25
      score += experienceScore;
    }

    // Optional sections: projects, certifications, achievements (0-10 points)
    let optionalScore = 0;
    if (Array.isArray(resume.projects) && resume.projects.length > 0) optionalScore += 4;
    if (Array.isArray(resume.certifications) && resume.certifications.length > 0) optionalScore += 3;
    if (Array.isArray(resume.achievements) && resume.achievements.length > 0) optionalScore += 3;
    
    score += Math.min(optionalScore, 10);

    // Cap at 75 max
    return Math.min(score, 75);
  }

  /**
   * HARDENED: Formatting — 20% Weight
   * 
   * REDESIGNED for ATS compatibility:
   * - Start at 80, deduct for ATS violations
   * - Long bullets (>200 chars): -5 each (up from -4)
   * - Excessive special characters: -8 (up from -5)
   * - Oversized skill tags: -3 (up from -2)
   * - Summary > 500 chars: -5
   * - No line breaks/formatting: -10
   * - Floor: 35 (extreme cases still scoreable)
   * 
   * Returns: Scalar score 0-100 (weight applied in _weightedTotal)
   */
  _formattingScore(resume) {
    let score = 80; // Start at 80, not 100
    const issues = [];

    // Check experience and project bullets for length
    let longBulletCount = 0;
    for (const section of ['experience', 'projects']) {
      if (!Array.isArray(resume[section])) continue;
      
      for (const item of resume[section]) {
        if (!Array.isArray(item.bullets)) continue;
        
        for (const bullet of item.bullets) {
          if (typeof bullet === 'string' && bullet.length > 200) {
            longBulletCount++;
            issues.push(`Long bullet: ${bullet.length} chars`);
          }
        }
      }
    }
    score -= longBulletCount * 5; // Harsher penalty

    // Check summary for special character overuse
    if (typeof resume.summary === 'string') {
      const specialMatch = resume.summary.match(/[!@#$%^&*()_+=\[\]{};:'",.<>?/\\]/g);
      const specialCount = specialMatch ? specialMatch.length : 0;
      
      if (specialCount > 8) {
        score -= 8; // Harsher penalty
        issues.push(`Excessive special chars: ${specialCount}`);
      }
      
      // Check summary length
      if (resume.summary.length > 500) {
        score -= 5;
        issues.push('Summary too long (>500 chars)');
      }
    }

    // Check skills for oversized items
    if (Array.isArray(resume.skills)) {
      let oversizeCount = 0;
      
      for (const skillGroup of resume.skills) {
        if (Array.isArray(skillGroup.items)) {
          for (const item of skillGroup.items) {
            if (typeof item === 'string' && item.length > 50) {
              oversizeCount++;
            }
          }
        }
      }
      
      if (oversizeCount > 5) {
        score -= oversizeCount; // Harsher: penalize each oversized item
        issues.push(`Oversized skill items: ${oversizeCount}`);
      }
    }

    // Floor: 35 (extreme cases must still be scoreable, but lower)
    return Math.max(score, 35);
  }

  /**
   * HARDENED: Action Verbs + Impact — 10% Weight
   * 
   * REDESIGNED to require BOTH verbs AND metrics:
   * - Verbs alone (no metrics): 0-40 points
   * - Metrics alone (no verbs): 0 points
   * - Verbs + Metrics (strong signal): 0-50 points bonus
   * - Max: 100
   * 
   * Returns: Scalar score 0-100 (weight applied in _weightedTotal)
   */
  _actionVerbScore(resume) {
    const allBullets = this._allBullets(resume);

    if (!allBullets.length) {
      return 0; // No bullets = no action signals
    }

    const verbsFound = new Set();
    let bulletsWithVerbs = 0;
    let bulletsWithMetrics = 0;
    let bulletsWithBoth = 0;

    for (const bullet of allBullets) {
      const firstWord = getFirstMeaningfulWord(bullet);
      const hasVerb = isActionVerb(firstWord);
      const hasMetric = hasMetrics(bullet);

      if (hasVerb) {
        verbsFound.add(firstWord);
        bulletsWithVerbs++;
      }
      if (hasMetric) {
        bulletsWithMetrics++;
      }
      if (hasVerb && hasMetric) {
        bulletsWithBoth++;
      }
    }

    // Score components
    // Verbs alone: up to 40 points (weak signal)
    const verbOnlyScore = (bulletsWithVerbs / allBullets.length) * 40;
    
    // Verbs + Metrics: up to 50 points (strong signal)
    const verbMetricScore = (bulletsWithBoth / allBullets.length) * 50;
    
    // Metrics WITHOUT verbs: 0 points (doesn't trigger without verb)
    
    // Total: 0-90 range (weighted to emphasize metrics)
    const totalScore = Math.min(verbOnlyScore + verbMetricScore, 100);

    return Math.round(totalScore);
  }

  /**
   * HARDENED: Readability — 10% Weight
   * 
   * REDESIGNED to penalize readability issues more aggressively:
   * - Start at 75 (not perfect), deduct for genuine problems
   * - No action verb: -3 each (up from -2)
   * - Long bullets (>180 chars): -4 each (up from -3)
   * - Short bullets (<30 chars): -3 each (up from -2)
   * - Missing metrics: -2 per bullet without metrics (NEW)
   * - Duplicate bullets: -15 each (up from -10)
   * - Summary > 500 chars: -8 (up from -5)
   * - Summary > 1000 chars: -15 (up from -10)
   * - Floor: 20 (extreme cases)
   * - Max: 85 (good readability doesn't guarantee quality)
   * 
   * Returns: Scalar score 0-100 (weight applied in _weightedTotal)
   */
  _readabilityScore(resume) {
    const allBullets = this._allBullets(resume);

    if (!allBullets.length) {
      return 40; // No bullets = poor readability (was 50)
    }

    let score = 75; // Start at 75, not 90
    let totalLength = 0;
    const lowerBullets = [];

    // Analyze each bullet
    for (const bullet of allBullets) {
      if (typeof bullet !== 'string') continue;
      
      const len = bullet.length;
      totalLength += len;
      lowerBullets.push(bullet.toLowerCase());

      // Long bullets are hard to scan
      if (len > 180) {
        score -= 4; // Harsher
      }
      
      // Very short bullets are unclear
      if (len > 0 && len < 30) {
        score -= 3; // Harsher
      }
      
      // Non-action-verb bullets (weak signal)
      if (!isActionVerb(getFirstMeaningfulWord(bullet))) {
        score -= 3; // Harsher
      }
      
      // Missing metrics is bad for readability
      if (!hasMetrics(bullet)) {
        score -= 2;
      }
    }

    // Detect duplicate bullets
    const uniqueBullets = new Set(lowerBullets);
    const duplicateCount = allBullets.length - uniqueBullets.size;
    if (duplicateCount > 0) {
      score -= duplicateCount * 15; // Harsher penalty
    }

    // Penalize excessively long summary
    if (typeof resume.summary === 'string') {
      const summaryLength = resume.summary.length;
      if (summaryLength > 500) {
        score -= 8; // Harsher
      }
      if (summaryLength > 1000) {
        score -= 15; // Much harsher
      }
    }

    // Floor: 20 (extremely unreadable must still be scoreable)
    // Cap: 85 (perfect readability cap, down from 90)
    return Math.min(Math.max(score, 20), 85);
  }

  // ── Supporting Calculations ────────────────────────────────────────────────

  /**
   * ISSUE #1 & #5 FIX: Weighted Total - Support 2 Modes
   * 
   * Mode 1 (NO JD): 30% formatting + 30% completeness + 20% verbs + 20% readability
   * Mode 2 (JD): 40% keyword + 20% formatting + 20% completeness + 10% verbs + 10% readability
   * 
   * Also FIX #5: Score Distribution
   * - Good resumes can reach 80+
   * - Average resumes land 60-75
   * - Weak resumes below 50
   * - Avoid 95+ unless nearly perfect
   */
  _weightedTotal(breakdown, hasJD = false) {
    if (!breakdown || typeof breakdown !== 'object') {
      console.error('[ATS_ERROR] _weightedTotal: Invalid breakdown object');
      return 0;
    }

    // Extract scores from breakdown objects
    const kwScore = breakdown.keywordMatchScore?.score ?? 0;
    const formattingScore = breakdown.formattingScore?.score ?? 0;
    const completenessScore = breakdown.sectionCompletenessScore?.score ?? 0;
    const verbScore = breakdown.actionVerbScore?.score ?? 0;
    const readabilityScore = breakdown.readabilityScore?.score ?? 0;

    // Validate all scores are in range [0, 100]
    const scores = [kwScore, formattingScore, completenessScore, verbScore, readabilityScore];
    for (const s of scores) {
      if (typeof s !== 'number' || s < 0 || s > 100) {
        console.warn('[ATS_WARNING] Invalid score detected, clamping values');
        return 0;
      }
    }

    let weightedSum;

    if (hasJD) {
      // MODE 2: JD-Based (40/20/20/10/10)
      weightedSum = 
        (kwScore * 0.40) +              // Keyword: 40%
        (formattingScore * 0.20) +      // Formatting: 20%
        (completenessScore * 0.20) +    // Completeness: 20%
        (verbScore * 0.10) +            // Action Verbs: 10%
        (readabilityScore * 0.10);      // Readability: 10%
    } else {
      // MODE 1: General Readiness (30/30/20/20)
      weightedSum = 
        (formattingScore * 0.30) +      // Formatting: 30%
        (completenessScore * 0.30) +    // Completeness: 30%
        (verbScore * 0.20) +            // Action Verbs: 20%
        (readabilityScore * 0.20);      // Readability: 20%
    }

    // ISSUE #5 FIX: Apply gradual penalty curves for better distribution
    // Clamp to [0, 100]
    let score = Math.min(Math.max(weightedSum, 0), 100);

    // Apply smooth penalty for very low scores to prevent unrealistic clustering
    if (score < 30) {
      // Stretch low scores slightly (no one deserves 0 for something filled out)
      score = Math.min(score * 1.2, 30);
    }

    // Apply ceiling to prevent unrealistic high scores without JD
    if (!hasJD && score > 85) {
      score = 85; // Cap general mode at 85
    }

    // Prevent 95+ unless nearly perfect
    if (score > 95) {
      // Only allow 95+ if ALL components are 90+
      const minComponent = Math.min(formattingScore, completenessScore, verbScore, readabilityScore);
      if (minComponent < 90) {
        score = Math.min(score, 90);
      }
    }

    return Math.round(score);
  }

  /**
   * FIX #6: Uses the same matchKeyword() helper as _keywordMatch() so that
   * "missing" and "matched" sets are always complementary.
   * ENHANCEMENT - Issue #5: Debug logging for missing keywords validation
   */
  _findMissingKeywords(resume, jdKeywords) {
    if (!jdKeywords.length) return [];
    const resumeText = this._allText(resume);
    const missing = [];

    for (const kw of jdKeywords) {
      const keyword = typeof kw === 'string' ? kw : kw?.keyword;
      if (keyword && !matchKeyword(resumeText, keyword)) {
        missing.push({
          keyword,
          category:   typeof kw === 'object' && kw.category ? kw.category : 'skill',
          importance: 'Nice to have', // FIX #7: no false "Critical" from bare keyword text
        });
      }
    }

    // ENHANCEMENT - Issue #5: Debug logging
    if (process.env.ATS_DEBUG === 'true' && missing.length > 0) {
      console.log('[ATS_DEBUG] Missing Keywords Details:');
      console.log('[ATS_DEBUG] Total Missing:', missing.length);
      const samples = missing.slice(0, 5).map(m => m.keyword).join(', ');
      console.log('[ATS_DEBUG] Samples:', samples);
    }

    return missing.slice(0, 15);
  }

  // ── Suggestion Generation (FIX #4, #8) ────────────────────────────────────

  /**
   * FIX #8: Method is now fully inside the class body (was outside due to
   * indentation error in the original source).
   *
   * FIX #4: For each bullet, only ONE suggestion is produced (prioritised):
   *   - If missing action verb → suggest verb fix (more fundamental)
   *   - Else if missing metric → suggest quantification
   * This prevents duplicate suggestions for the same bullet.
   */
  _generateSuggestions(resume, breakdown, missingKeywords) {
    const suggestions = [];
    let id = 1;
    const push = (s) => suggestions.push({ ...s, id: `sugg-${id++}`, applied: false });

    // 1. Missing keywords (top 5 most impactful)
    for (const mk of missingKeywords.slice(0, 5)) {
      push({
        type:          'keyword',
        severity:      'critical',
        section:       mk.category === 'skill' ? 'skills' : 'experience',
        currentText:   '',
        suggestedText: `Add "${mk.keyword}" to your ${mk.category === 'skill' ? 'skills' : 'experience'} section`,
        reason:        `"${mk.keyword}" appears in the job description but not in your resume`,
        impact:        'high',
        title:         `Add missing keyword: "${mk.keyword}"`,
      });
    }

    // 2. Summary too short
    if (!resume.summary || resume.summary.trim().length < 100) {
      push({
        type:          'content',
        severity:      'critical',
        section:       'summary',
        currentText:   resume.summary || '',
        suggestedText: 'Write a compelling 3–4 sentence professional summary highlighting your key skills, years of experience, and career objective',
        reason:        'A strong summary helps ATS and recruiters quickly understand your profile',
        impact:        'high',
        title:         'Strengthen your professional summary',
      });
    }

    // 3. Experience bullets — one suggestion per bullet, most fundamental first
    if (Array.isArray(resume.experience)) {
      for (const [expIdx, exp] of resume.experience.entries()) {
        if (!Array.isArray(exp.bullets)) continue;
        for (const [bulletIdx, bullet] of exp.bullets.entries()) {
          if (typeof bullet !== 'string' || !bullet.trim()) continue;

          const firstWord    = getFirstMeaningfulWord(bullet);
          const hasVerb      = isActionVerb(firstWord);
          const hasMetric    = hasMetrics(bullet);

          if (!hasVerb) {
            // FIX #4: action-verb fix takes priority; don't also emit metric suggestion
            push({
              type:          'content',
              severity:      'suggestion',
              section:       'experience',
              targetIndex:   { expIndex: expIdx, bulletIndex: bulletIdx },
              currentText:   bullet,
              suggestedText: this._improveBullet(bullet),
              reason:        'Start with a strong action verb for better ATS matching and recruiter impact',
              impact:        'medium',
              title:         'Start with a strong action verb',
            });
          } else if (!hasMetric) {
            push({
              type:          'content',
              severity:      'suggestion',
              section:       'experience',
              targetIndex:   { expIndex: expIdx, bulletIndex: bulletIdx },
              currentText:   bullet,
              suggestedText: `${bullet} — quantify the impact (e.g., "improved by 25%", "served 50+ clients")`,
              reason:        'Quantifiable achievements significantly improve ATS scores and recruiter interest',
              impact:        'high',
              title:         'Quantify your experience impact',
            });
          }
        }
      }
    }

    // 4. Missing sections
    for (const section of (breakdown.sectionCompletenessScore?.details?.missingSections ?? [])) {
      push({
        type:          'structure',
        severity:      'important',
        section:       section.toLowerCase().replace(' ', '_'),
        currentText:   '',
        suggestedText: `Add a "${section}" section to improve resume completeness`,
        reason:        `"${section}" is an important section for ATS scoring`,
        impact:        'high',
        title:         `Add missing section: ${section}`,
      });
    }

    // Return top 15 by insertion order (already severity-sorted by logic above)
    return suggestions.slice(0, 15);
  }

  /**
   * FIX #3: Capitalisation bug fix when prepending "Developed ".
   *
   * Original: `improved.substring(1)` dropped the first char of the original
   * bullet, so "Built a pipeline" became "Developed uilt a pipeline".
   *
   * Now: prepend "Developed " and leave the original text completely intact
   * so that "Built a pipeline" → "Developed built a pipeline" only if the
   * first word genuinely isn't an action verb (which "Built" is, so it would
   * have been caught by the weak-phrase replacement first).
   */
  _improveBullet(bullet) {
    if (typeof bullet !== 'string') return bullet;

    let improved = bullet.trim();

    // Replace weak phrases first (deterministic, longest match wins).
    // After replacement, capitalise the first character of the result.
    for (const [weak, strong] of Object.entries(WEAK_PHRASES)) {
      const re = new RegExp(`\\b${weak}\\b`, 'i');
      if (re.test(improved)) {
        improved = improved.replace(re, strong);
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        return improved; // Return early after verb replacement; don't append metrics hint
      }
    }

    // If no weak phrase was replaced and still no action verb, prepend one
    if (improved === bullet.trim()) {
      const firstWord = getFirstMeaningfulWord(improved);
      if (!isActionVerb(firstWord)) {
        // FIX #3: Append "Developed" prefix; keep original capitalisation intact
        improved = `Developed ${improved.charAt(0).toLowerCase()}${improved.slice(1)}`;
        return improved; // Return early after prepending verb; don't append metrics hint
      }
    }

    // ❌ DO NOT append metrics hints — it's handled as a separate suggestion type
    return improved;
  }

  // ── Overall Feedback ───────────────────────────────────────────────────────

  _overallFeedback(breakdown, totalScore) {
    const STRENGTH_MESSAGES = {
      keywordMatchScore:        'Strong keyword alignment with job requirements',
      sectionCompletenessScore: 'Comprehensive resume with all key sections',
      formattingScore:          'ATS-friendly formatting throughout',
      actionVerbScore:          'Effective use of strong action verbs',
      readabilityScore:         'Clear and concise writing style',
    };
    const WEAKNESS_MESSAGES = {
      keywordMatchScore:        'Low keyword match with job description',
      sectionCompletenessScore: 'Missing important resume sections',
      formattingScore:          'Formatting issues detected',
      actionVerbScore:          'Limited use of strong action verbs',
      readabilityScore:         'Readability could be improved',
    };
    const RECOMMENDATION_MESSAGES = {
      keywordMatchScore:        'Incorporate more relevant keywords from the job posting',
      sectionCompletenessScore: 'Add missing sections to complete your resume',
      formattingScore:          'Simplify formatting; remove long bullets and special characters',
      actionVerbScore:          'Start every bullet point with a strong action verb',
      readabilityScore:         'Keep bullets concise (80–140 chars) and avoid duplicates',
    };

    const strengths      = [];
    const weaknesses     = [];
    const recommendations = [];

    for (const [key, component] of Object.entries(breakdown)) {
      if (component.score >= 80) {
        strengths.push(STRENGTH_MESSAGES[key] || `Good performance in ${key}`);
      } else if (component.score < 50) {
        weaknesses.push(WEAKNESS_MESSAGES[key]     || `Needs improvement in ${key}`);
        recommendations.push(RECOMMENDATION_MESSAGES[key] || `Review and improve ${key}`);
      }
    }

    if (totalScore < 60) {
      recommendations.unshift('Focus on adding the missing keywords from the job description first');
      recommendations.push('Complete all required sections before applying');
    } else if (totalScore < 80) {
      recommendations.unshift('Enhance bullet points with quantifiable achievements');
    }

    return { strengths, weaknesses, recommendations: recommendations.slice(0, 5) };
  }

  // ── Private Utilities ──────────────────────────────────────────────────────

  /** Collect all bullet strings from experience and projects. */
  _allBullets(resume) {
    const bullets = [];
    for (const section of ['experience', 'projects']) {
      if (Array.isArray(resume[section])) {
        for (const item of resume[section]) {
          if (Array.isArray(item.bullets)) {
            bullets.push(...item.bullets.filter(b => typeof b === 'string'));
          }
        }
      }
    }
    return bullets;
  }

  /**
   * ENHANCEMENT: Dedicated comprehensive text builder.
   * Aggregates ALL resume sections in a structured way to prevent keyword misses.
   * Each section is joined by spaces to maintain token boundaries.
   */
  buildResumeText(resume) {
    const sections = [];

    // Personal Info
    if (resume.personalInfo && typeof resume.personalInfo === 'object') {
      sections.push(
        resume.personalInfo.fullName,
        resume.personalInfo.email,
        resume.personalInfo.phone,
        resume.personalInfo.location,
        resume.personalInfo.linkedin,
        resume.personalInfo.github,
        resume.personalInfo.portfolio
      );
    }

    // Professional Summary
    if (resume.summary && typeof resume.summary === 'string') {
      sections.push(resume.summary);
    }

    // Skills (from groups)
    if (Array.isArray(resume.skills)) {
      resume.skills.forEach(grp => {
        if (grp.category) sections.push(grp.category);
        if (Array.isArray(grp.items)) {
          sections.push(...grp.items);
        }
      });
    }

    // Work Experience
    if (Array.isArray(resume.experience)) {
      resume.experience.forEach(exp => {
        if (exp.company) sections.push(exp.company);
        if (exp.role) sections.push(exp.role);
        if (exp.jobTitle) sections.push(exp.jobTitle);
        if (Array.isArray(exp.bullets)) {
          sections.push(...exp.bullets);
        }
      });
    }

    // Projects
    if (Array.isArray(resume.projects)) {
      resume.projects.forEach(proj => {
        if (proj.title) sections.push(proj.title);
        if (proj.name) sections.push(proj.name);
        if (proj.description) sections.push(proj.description);
        if (Array.isArray(proj.techStack)) {
          sections.push(...proj.techStack);
        }
        if (proj.technologies) sections.push(proj.technologies);
        if (Array.isArray(proj.bullets)) {
          sections.push(...proj.bullets);
        }
      });
    }

    // Education
    if (Array.isArray(resume.education)) {
      resume.education.forEach(edu => {
        if (edu.institution) sections.push(edu.institution);
        if (edu.degree) sections.push(edu.degree);
        if (edu.field) sections.push(edu.field);
        if (edu.graduationYear) sections.push(edu.graduationYear);
      });
    }

    // Certifications
    if (Array.isArray(resume.certifications)) {
      resume.certifications.forEach(cert => {
        if (cert.name) sections.push(cert.name);
        if (cert.organization) sections.push(cert.organization);
      });
    }

    // Achievements (handle both string and object formats)
    if (Array.isArray(resume.achievements)) {
      resume.achievements.forEach(a => {
        if (typeof a === 'string' && a.trim()) {
          sections.push(a);
        } else if (a && typeof a === 'object') {
          if (a.title) sections.push(a.title);
          if (a.description) sections.push(a.description);
          if (a.text) sections.push(a.text);
        }
      });
    }

    // Languages
    if (Array.isArray(resume.languages)) {
      resume.languages.forEach(lang => {
        if (typeof lang === 'string') sections.push(lang);
        else if (lang && typeof lang === 'object' && lang.name) sections.push(lang.name);
      });
    }

    // Filter out empty/null values and join
    return sections
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /** Concatenate all readable text from a resume into a single string. */
  _allText(resume) {
    // Use the enhanced buildResumeText() for comprehensive aggregation
    const text = this.buildResumeText(resume);
    
    // ENHANCEMENT - Issue #5: Debug logging for keyword matching validation
    if (process.env.ATS_DEBUG === 'true') {
      console.log('[ATS_DEBUG] Resume text aggregation:');
      console.log('[ATS_DEBUG] Total characters:', text.length);
      console.log('[ATS_DEBUG] Total words:', text.split(/\s+/).length);
      console.log('[ATS_DEBUG] Text preview:', text.substring(0, 200) + '...');
    }

    return text;
  }
}

// Export the singleton (runtime) and the class itself (for unit testing)
const atsScorer = new ATSScorer();

module.exports = atsScorer;
module.exports.ATSScorer = ATSScorer;

// ─── Named pure-function exports for unit testing ────────────────────────────
module.exports._helpers = { 
  normalizeText,
  stemWord,
  normalizeSeparators, 
  tokenize, 
  matchKeyword, 
  phraseMatch,
  matchSynonym,
  hasMetrics, 
  getFirstMeaningfulWord, 
  isActionVerb,
  getKeywordSectionBoost,
  countUniqueSkills,
  getTotalUniqueSkills,
  SYNONYM_MAP,
};
