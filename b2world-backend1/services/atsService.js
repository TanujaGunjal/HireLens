/**
 * ================================================================================
 * PRODUCTION-GRADE ATS SCORING ENGINE - SPECIFICATION COMPLIANT
 * ================================================================================
 * Implements strict scoring model for ANY resume/JD combination
 * 
 * ✅ FIXED: Weights now match assignment specification exactly
 * Score Breakdown (Total = 100):
 * - Keyword Match: 40%
 * - Section Completeness: 20%
 * - Formatting: 20%
 * - Action Verbs & Impact: 10%
 * - Readability & Quality: 10%
 * 
 * Final score = weighted sum, rounded to integer 0-100
 * ================================================================================
 */

const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const validation = require('../utils/atsValidationEngine');
const rewriteRules = require('../utils/rewriteRules');  // ✅ FIX: Import for shouldSuggest guards

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also', 'my', 'your', 'our'
]);

const GENERIC_WORDS = new Set([
  'experience', 'knowledge', 'ability', 'skills', 'working', 'work', 'job',
  'role', 'position', 'company', 'team', 'responsibility', 'requirement',
  'good', 'great', 'excellent', 'strong', 'years', 'plus', 'required',
  'preferred', 'nice', 'day', 'year', 'month', 'understanding'
]);

// Domain-agnostic strong verbs (applicable to any role)
const STRONG_VERBS = new Set([
  'developed', 'built', 'implemented', 'designed', 'led', 'optimized',
  'engineered', 'automated', 'analyzed', 'architected', 'deployed',
  'created', 'established', 'launched', 'delivered', 'achieved',
  'managed', 'coordinated', 'facilitated', 'collaborated', 'improved',
  'enhanced', 'resolved', 'executed', 'documented', 'mentored',
  'trained', 'directed', 'orchestrated', 'scaled', 'configured',
  'integrated', 'tested', 'debugged', 'refined', 'validated',
  'streamlined', 'accelerated', 'reduced', 'increased', 'transformed'
]);

const WEAK_VERBS = new Set([
  'worked', 'helped', 'assisted', 'responsible', 'involved', 'handled',
  'used', 'made', 'did', 'was', 'were', 'tried', 'attempted', 'supported'
]);

// ✅ FIX: Tech synonyms for consistent keyword matching
const TECH_SYNONYMS = {
  'nodejs': ['node', 'node.js', 'node js'],
  'javascript': ['js'],
  'typescript': ['ts'],
  'postgresql': ['postgres', 'pg', 'psql'],
  'mongodb': ['mongo', 'mongodb atlas'],
  'kubernetes': ['k8s', 'k8'],
  'reactjs': ['react', 'react.js'],
  'express': ['expressjs', 'express.js'],
  'restapi': ['rest', 'restful', 'rest api', 'rest apis'],
  'cicd': ['ci/cd', 'ci cd', 'continuous integration'],
  'datastructures': ['dsa', 'data structures', 'ds'],
  'springboot': ['spring boot', 'spring']
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✅ FIX #1: Enhanced keyword normalization with punctuation handling
 * Converts: "React.js" → "react", "Node.js" → "node", "REST APIs" → "rest apis"
 */
const normalizeText = (text = '') => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    // Handle framework versions: React.js → react, Node.js → node
    .replace(/\.js\b/g, '')
    .replace(/\.ts\b/g, '')
    // Remove other punctuation but keep word boundaries
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (text = '') => {
  return normalizeText(text).split(' ').filter(t => t);
};

const stemWord = (word = '') => {
  if (!word || word.length < 3) return word;
  let stem = word.toLowerCase();
  if (stem.endsWith('ies')) stem = stem.slice(0, -3) + 'i';
  else if (stem.endsWith('es')) stem = stem.slice(0, -2);
  else if (stem.endsWith('s') && !stem.endsWith('ss')) stem = stem.slice(0, -1);
  if (stem.endsWith('ing')) stem = stem.slice(0, -3);
  if (stem.endsWith('ed')) stem = stem.slice(0, -2);
  if (stem.endsWith('tion')) stem = stem.slice(0, -4) + 't';
  if (stem.endsWith('ation')) stem = stem.slice(0, -5) + 't';
  return stem;
};

const getFirstWord = (text) => {
  const words = tokenize(text);
  return words.length > 0 ? words[0] : '';
};

const countWords = (text) => tokenize(text).length;

const hasMetrics = (text) => {
  return /\d+%|\d+x|\d+[kmb]|\$\d+|improved|reduced|increased|decreased/i.test(text);
};

/**
 * ✅ FIX PUNCTUATION BUGS
 * Ensure rewritten bullets never contain: ".," ".." ",."
 * Example: "trends., improving performance" → "trends, improving performance"
 */
const fixPunctuation = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/\.,/g, ',')      // ".," → ","
    .replace(/\.\./g, '.')     // ".." → "."
    .replace(/,\./g, '.')      // ",." → "."
    .replace(/\s+,/g, ',')     // " ," → ","
    .replace(/\s+\./g, '.')    // " ." → "."
    .trim();
};

/**
 * Clean and validate suggestion text
 */
const cleanSuggestionText = (suggestion) => {
  if (!suggestion || typeof suggestion !== 'object') return suggestion;
  
  const cleaned = { ...suggestion };
  
  if (cleaned.currentText && typeof cleaned.currentText === 'string') {
    cleaned.currentText = fixPunctuation(cleaned.currentText);
  }
  
  if (cleaned.improvedText && typeof cleaned.improvedText === 'string') {
    cleaned.improvedText = fixPunctuation(cleaned.improvedText);
  }
  
  if (cleaned.text && typeof cleaned.text === 'string') {
    cleaned.text = fixPunctuation(cleaned.text);
  }
  
  return cleaned;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ KEYWORD MATCHING (40%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract keywords from JD with FREQUENCY weighting
 * High-frequency keywords = higher weight for scoring
 */
const extractJDKeywords = (jd) => {
  if (!jd) return [];
  
  let rawKeywords = [];
  
  // Use preextracted keywords
  if (jd.extractedKeywords && Array.isArray(jd.extractedKeywords)) {
    rawKeywords = jd.extractedKeywords.map(k => 
      typeof k === 'string' ? k : (k.keyword || String(k))
    );
  } else if (jd.jdText) {
    rawKeywords = tokenize(jd.jdText);
  }
  
  // Filter and weight keywords
  const keywordFreq = {};
  rawKeywords
    .map(k => normalizeText(String(k).trim()))
    .filter(k => k.length >= 2)
    .filter(k => !STOPWORDS.has(k) && !GENERIC_WORDS.has(k))
    .filter(k => !/^\d+$/.test(k))
    .forEach(k => {
      keywordFreq[k] = (keywordFreq[k] || 0) + 1;
    });
  
  // Convert to weighted array (higher frequency = higher importance)
  return Object.entries(keywordFreq)
    .map(([keyword, freq]) => ({
      keyword,
      weight: Math.min(freq, 5), // Cap weight at 5
      frequency: freq
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);
};

/**
 * Build full resume text for keyword matching
 */
const buildResumeText = (resume) => {
  const sections = [];
  
  if (resume.summary) sections.push(resume.summary);
  
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(s => {
      if (s.category) sections.push(s.category);
      if (Array.isArray(s.items)) sections.push(...s.items);
    });
  }
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (e.company) sections.push(e.company);
      if (e.role) sections.push(e.role);
      if (e.jobTitle) sections.push(e.jobTitle);
      if (Array.isArray(e.bullets)) sections.push(...e.bullets);
    });
  }
  
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (p.title) sections.push(p.title);
      if (p.name) sections.push(p.name);
      if (p.description) sections.push(p.description);
      if (Array.isArray(p.techStack)) sections.push(...p.techStack);
      if (Array.isArray(p.bullets)) sections.push(...p.bullets);
    });
  }
  
  if (Array.isArray(resume.education)) {
    resume.education.forEach(e => {
      if (e.institution) sections.push(e.institution);
      if (e.degree) sections.push(e.degree);
      if (e.field) sections.push(e.field);
    });
  }
  
  return normalizeText(sections.join(' '));
};

/**
 * ✅ FIX #1: Normalize keyword to canonical form for synonym matching
 * Handles variations like "Node.js" → "nodejs", "REST API" → "restapi"
 */
const normalizeKeywordForMatching = (keyword) => {
  const normalized = normalizeText(keyword);
  
  // Check if it matches a canonical form (case-insensitive)
  for (const [canonical, synonyms] of Object.entries(TECH_SYNONYMS)) {
    if (normalized === canonical) {
      return canonical;  // Direct match
    }
    // Check synonyms (includes both string array and nested variations)
    const allSynonyms = Array.isArray(synonyms) ? synonyms : [];
    if (allSynonyms.some(syn => normalizeText(syn) === normalized)) {
      return canonical;  // Found in synonyms
    }
  }
  
  return normalized;
};

/**
 * ✅ FIX #1: Match keyword with stemming, partial matching, and phrase awareness
 * Handles variations: "React.js" matches "react", "REST API" matches "rest apis", etc.
 */
const matchKeyword = (resumeText, keyword) => {
  const normText = normalizeText(resumeText);
  const normKw = normalizeText(keyword);
  
  // Strategy 1: Direct substring match (most common case)
  if (normText.includes(normKw)) return true;
  
  // Strategy 2: Synonym-aware matching for known tech keywords
  const keywordCanonical = normalizeKeywordForMatching(keyword);
  const keywordSynonyms = TECH_SYNONYMS[keywordCanonical] || [];
  const allForms = [keywordCanonical, ...keywordSynonyms.map(s => normalizeText(s))];
  
  for (const form of allForms) {
    if (form && normText.includes(form)) return true;
  }
  
  // Strategy 3: Multi-word keyword - all tokens must be present (phrase matching)
  const tokens = tokenize(normKw);
  if (tokens.length > 1) {
    const allPresent = tokens.every(token => {
      const wordBoundary = new RegExp(`\\b${token}\\b`);
      return wordBoundary.test(normText);
    });
    if (allPresent) return true;
  }
  
  // Strategy 4: Stem match for single words (length >= 4)
  if (tokens.length === 1) {
    const stemKw = stemWord(normKw);
    if (stemKw && stemKw.length >= 4) {
      const textTokens = tokenize(normText);
      return textTokens.some(t => stemWord(t) === stemKw);
    }
  }
  
  return false;
};

/**
 * Score keyword match (40%)
 * Uses WEIGHTED scoring: high-frequency keywords worth more
 */
/**
 * ✅ FIX #1: Calculate keyword match with proper normalization
 * Returns score from 0-100 based on matched vs total keywords
 */
const calculateKeywordMatch = (resume, jdKeywords) => {
  // FIX: Handle edge cases
  if (!jdKeywords || !Array.isArray(jdKeywords) || jdKeywords.length === 0) {
    return { matchedKeywords: [], missingKeywords: [], score: 0 };
  }
  
  const resumeText = buildResumeText(resume);
  if (!resumeText || resumeText.trim().length === 0) {
    return { matchedKeywords: [], missingKeywords: [], score: 0 };
  }
  
  const matched = [];
  const missing = [];
  let totalWeight = 0;
  let matchedWeight = 0;
  
  // Process each keyword with weight
  for (const kw of jdKeywords) {
    const keyword = kw.keyword || kw;
    const weight = kw.weight || 1;
    totalWeight += weight;
    
    if (matchKeyword(resumeText, String(keyword).trim())) {
      matched.push(keyword);
      matchedWeight += weight;
    } else {
      missing.push(keyword);
    }
  }
  
  // ✅ FIX: Proper score calculation (0-100)
  let score = 0;
  if (totalWeight > 0) {
    score = Math.round((matchedWeight / totalWeight) * 100);
    score = Math.max(0, Math.min(100, score));  // Clamp to 0-100
  }
  
  return { 
    matchedKeywords: validation.deduplicateKeywords(matched), 
    missingKeywords: validation.deduplicateKeywords(missing), 
    score: validation.validateATSScore(score)
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ SECTION COMPLETENESS (20%) - FIXED BUG
// ═══════════════════════════════════════════════════════════════════════════
// Required sections: summary, skills, experience, projects, education
// Formula: (foundSections / 5) * 100

const REQUIRED_SECTIONS = ['summary', 'skills', 'experience', 'projects', 'education'];

const getMissingSections = (resume) => {
  const missing = [];
  for (const section of REQUIRED_SECTIONS) {
    let found = false;
    if (section === 'summary') {
      // Lower threshold: 20 chars is enough to count as a summary
      found = !!(resume.summary && resume.summary.trim().length >= 20);
    } else if (section === 'skills') {
      // Handle BOTH shapes:
      //  1. Engine format: flat string array  ['React', 'Node.js']
      //  2. Mongo format:  [{category, items: [...]}]
      if (Array.isArray(resume.skills) && resume.skills.length > 0) {
        found = resume.skills.some(s => {
          if (typeof s === 'string') return s.trim().length > 0;
          if (s && Array.isArray(s.items)) return s.items.length > 0;
          return false;
        });
      }
    } else if (section === 'experience') {
      // Freshers: 2+ projects substitute for missing experience
      const hasExp  = Array.isArray(resume.experience) && resume.experience.length > 0;
      const projCnt = Array.isArray(resume.projects)   ? resume.projects.length : 0;
      found = hasExp || projCnt >= 2;
    } else if (section === 'projects') {
      found = Array.isArray(resume.projects) && resume.projects.length > 0;
    } else if (section === 'education') {
      found = Array.isArray(resume.education) && resume.education.length > 0;
    }
    if (!found) missing.push(section);
  }
  return missing;
};

const calculateCompleteness = (resume) => {
  const hasExperience = Array.isArray(resume.experience) && resume.experience.length > 0;
  const hasProjects   = Array.isArray(resume.projects)   && resume.projects.length   > 0;
  const hasEducation  = Array.isArray(resume.education)  && resume.education.length  > 0;
  const hasSummary    = !!resume.summary;

  const hasSkills = Array.isArray(resume.skills) && resume.skills.some(s => {
    if (typeof s === 'string') return s.trim().length > 0;
    if (s && Array.isArray(s.items)) return s.items.length > 0;
    return false;
  });

  if (!hasSkills && !hasProjects && !hasEducation && !hasExperience && !hasSummary) {
    return 0;
  }

  const skillsPts     = hasSkills     ? 20 : 0;
  const projectsPts   = hasProjects   ? 30 : 0;
  const educationPts  = hasEducation  ? 20 : 0;
  const experiencePts = (hasExperience || resume._autoGeneratedExperience) ? 30 : 0;
  const summaryPts    = hasSummary    ? 5 : 0;

  const projectCount    = Array.isArray(resume.projects) ? resume.projects.length : 0;
  const projectDepthPts = projectCount >= 2 ? 10 : 0;

  let score = skillsPts + projectsPts + educationPts + experiencePts + summaryPts + projectDepthPts;

  if (hasSkills && hasProjects) {
    if (score < 70) score = 70;
  } else if (score > 0 && score < 60) {
    score = 60;
  }

  return Math.max(0, Math.min(100, score));
};

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ FORMATTING (20%) - IMPROVED WITH DEDUCTIONS
// ═══════════════════════════════════════════════════════════════════════════
// Start: 100
// Deductions: tables (-20), images (-20), icons/emojis (-10), 
//             excessive symbols (-10), long paragraphs (-10), inconsistent headings (-10)

const normalizeBullets = (bullets) => {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .flatMap(b => (typeof b === 'string' ? b.split('\n') : []))
    .map(b => b.trim())
    .filter(Boolean);
};

const calculateFormatting = (resume) => {
  let score = 0;
  
  const allRawBullets = [
    ...(resume.experience || []).flatMap(e => Array.isArray(e.bullets) ? e.bullets : []),
    ...(resume.projects || []).flatMap(p => Array.isArray(p.bullets) ? p.bullets : [])
  ];
  
  const normalized = normalizeBullets(allRawBullets);
  const total = normalized.length;

  // 1. proper sections exist (+20)
  const hasSummary = !!(resume.summary && resume.summary.trim().length > 0);
  const hasExpOrProj = !!((Array.isArray(resume.experience) && resume.experience.length > 0) || 
                          (Array.isArray(resume.projects) && resume.projects.length > 0));
  const hasSkills = !!(Array.isArray(resume.skills) && resume.skills.length > 0);
  
  if (hasSummary && hasExpOrProj && hasSkills) {
    score += 20;
  }

  // 2. proper bullets (+20)
  if (total > 0 && allRawBullets.length >= total * 0.8) {
    score += 20; 
  } else if (total === 0) {
    score += 20;
  }

  // 3. bullet length between 8–25 words (+20)
  if (total > 0) {
    const goodLen = normalized.filter(b => {
      const w = b.split(/\s+/).length;
      return w >= 8 && w <= 25;
    }).length;
    if ((goodLen / total) > 0.6) {
      score += 20;
    }
  } else {
    score += 20;
  }

  // 4. consistent formatting across sections (+20)
  let hasInconsistentBullets = false;
  if (total > 0) {
    const endsWithPeriod = normalized.filter(b => b.endsWith('.')).length;
    const ratio = endsWithPeriod / total;
    if (ratio >= 0.8 || ratio <= 0.2) {
      score += 20;
    } else {
      hasInconsistentBullets = true;
    }
  } else {
    score += 20;
  }

  // 5. no broken formatting (+20)
  const hasNewline = allRawBullets.some(b => typeof b === 'string' && b.includes('\n'));
  let hasLongParagraph = false;
  if (resume.summary && resume.summary.split(/\s+/).length > 80) hasLongParagraph = true;
  normalized.forEach(b => {
    if (b.split(/\s+/).length > 40) hasLongParagraph = true;
  });

  if (!hasNewline && !hasLongParagraph) {
    score += 20;
  }

  // DEDUCTIONS
  if (hasLongParagraph) score -= 10;
  if (hasInconsistentBullets) score -= 10;
  if (hasNewline) score -= 10;

  return Math.max(0, Math.min(100, score));
};

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ ACTION VERBS & IMPACT (10%)
// ═══════════════════════════════════════════════════════════════════════════

const calculateActionVerbs = (resume) => {
  const bullets = [];
  
  // Collect all bullets with their source
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (Array.isArray(e.bullets)) {
        bullets.push(...e.bullets.filter(Boolean).map(b => ({ text: b, section: 'experience' })));
      }
    });
  }
  
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) {
        bullets.push(...p.bullets.filter(Boolean).map(b => ({ text: b, section: 'projects' })));
      }
    });
  }
  
  if (bullets.length === 0) return 50;

  // ✅ FIX: Helper to detect double verbs (e.g., "Developed handled...")
  const hasDoubleVerb = (text) => {
    const words = tokenize(text);
    if (words.length < 2) return false;
    const firstWord = words[0];
    const secondWord = words[1];
    return STRONG_VERBS.has(firstWord) && STRONG_VERBS.has(secondWord);
  };
  
  let score = 0;
  let strongCount = 0;
  let weakCount = 0;
  
  for (const bullet of bullets) {
    const firstWord = getFirstWord(bullet.text);
    
    // ✅ FIX: Detect and penalize double verbs as weak grammar
    const hasDoubleVerbError = hasDoubleVerb(bullet.text);
    
    if (STRONG_VERBS.has(firstWord) && !hasDoubleVerbError) {
      score += 2; // Strong verb
      strongCount++;
      if (hasMetrics(bullet.text)) score += 1; // + metrics bonus
    } else if (WEAK_VERBS.has(firstWord) || hasDoubleVerbError) {
      score -= 1; // Weak verb penalty OR grammar error penalty
      weakCount++;
    } else if (countWords(bullet.text) >= 5) {
      score += 0.5; // OK sentence structure
    }
  }
  
  const baseScore = (score / bullets.length) * 100;
  const weakPenalty = Math.min(30, (weakCount / bullets.length) * 30);
  const finalScore = Math.max(10, Math.min(100, Math.round(baseScore - weakPenalty)));
  return finalScore;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ READABILITY & QUALITY (10%) - IMPROVED
// ═══════════════════════════════════════════════════════════════════════════
// Deductions:
// - Bullet length >20 words → -2 points
// - Repeated words → -5 points
// - Paragraph >150 words → -10 points
// - Missing punctuation → -3 points

const calculateReadability = (resume) => {
  const bullets = [];
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (Array.isArray(e.bullets)) bullets.push(...e.bullets.filter(Boolean));
    });
  }
  
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) bullets.push(...p.bullets.filter(Boolean));
    });
  }
  
  if (bullets.length === 0) return 50;
  
  let deductions = 0;
  
  // ✅ DEDUCTION 1: Bullet length >20 words → -2 points per bullet
  const longBullets = bullets.filter(b => countWords(b) > 20).length;
  deductions += longBullets * 2;
  
  // ✅ DEDUCTION 2: Repeated words (words appearing >4 times) → -5 points
  const allWords = bullets.flatMap(b => tokenize(b));
  const wordFreq = {};
  allWords.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const repeatedWordsCount = Object.values(wordFreq).filter(n => n > 4).length;
  if (repeatedWordsCount > 0) deductions += 5;
  
  // ✅ DEDUCTION 3: Paragraph >150 words → -10 points
  let hasLongParagraph = false;
  if (resume.summary && countWords(resume.summary) > 150) hasLongParagraph = true;
  bullets.forEach(bullet => {
    if (countWords(bullet) > 150) hasLongParagraph = true;
  });
  if (hasLongParagraph) deductions += 10;
  
  // ✅ DEDUCTION 4: Missing punctuation at end of bullet → -3 points
  const bulletsMissingPunctuation = bullets.filter(b => !/[.!?]$/.test(b.trim())).length;
  deductions += Math.min(3, bulletsMissingPunctuation); // Cap at 3 points for this category
  
  const score = Math.max(0, 100 - deductions);
  return Math.min(100, score);
};

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTIONS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate intelligent suggestions
 */
/**
 * ================================================================================
 * GENERATE OPTIMIZATION SUGGESTIONS
 * ================================================================================
 * Provides actionable improvement suggestions even for high-scoring resumes
 * Ensures users always know how to further improve their resume
 */

const generateOptimizationSuggestions = (resume, breakdown, jdKeywords) => {
  const suggestions = [];
  
  // 1. Add quantifiable achievements (always helpful)
  suggestions.push({
    id: 'opt-achievements',
    type: 'impact',
    section: 'experience',
    itemIndex: undefined,
    bulletIndex: undefined,
    currentText: '',
    improvedText: 'Add quantifiable achievements (e.g., "improved performance by 40%", "reduced costs by $500K")',
    text: 'Add quantifiable achievements',
    impact: 'high',
    reason: 'Specific metrics and achievements demonstrate measurable impact and value to employers',
    title: 'Quantify your achievements',
    impactLevel: 'high',
    confidence: 95
  });
  
  // 2. Improve summary impact (always relevant)
  if (!resume.summary || resume.summary.trim().length < 100) {
    suggestions.push({
      id: 'opt-summary',
      type: 'section',
      section: 'summary',
      itemIndex: undefined,
      bulletIndex: undefined,
      currentText: resume.summary?.trim() || '',
      improvedText: 'Craft a compelling 3-4 sentence summary highlighting key achievements, technical skills, and years of experience relevant to the target role',
      text: 'Strengthen your professional summary',
      impact: 'high',
      reason: 'A powerful summary immediately captures recruiter attention and improves initial resume evaluation',
      title: 'Strengthen professional summary',
      impactLevel: 'high',
      confidence: 90
    });
  } else if (breakdown.completeness >= 80) {
    // Even with good summary, suggest stronger impact language
    suggestions.push({
      id: 'opt-summary-impact',
      type: 'section',
      section: 'summary',
      itemIndex: undefined,
      bulletIndex: undefined,
      currentText: resume.summary?.trim() || '',
      improvedText: 'Enhance summary with specific achievements: "Delivered X projects", "Managed team of Y", or "Increased metric by Z%"',
      text: 'Add specific achievements to your summary',
      impact: 'medium',
      reason: 'Quantified achievements in the summary create immediate impact and improve ATS matching',
      title: 'Enhance summary with metrics',
      impactLevel: 'medium',
      confidence: 85
    });
  }
  
  // 3. Add role-specific keywords
  if (jdKeywords && jdKeywords.length > 0) {
    const topMissing = jdKeywords
      .filter(kw => !matchKeyword(buildResumeText(resume), kw.keyword))
      .slice(0, 3);
    
    if (topMissing.length > 0) {
      suggestions.push({
        id: 'opt-keywords',
        type: 'keyword',
        section: 'skills',
        itemIndex: undefined,
        bulletIndex: undefined,
        currentText: '',
        improvedText: `Add these role-specific keywords: ${topMissing.map(k => k.keyword).join(', ')}`,
        text: 'Add role-specific keywords',
        impact: 'high',
        reason: 'Including keywords from the job posting significantly improves ATS matching and recruiter discovery',
        title: 'Add role-specific keywords',
        impactLevel: 'high',
        confidence: 92
      });
    }
  }
  
  // 4. Strengthen bullet language (always applicable)
  const weakBulletCount = countWeakBullets(resume);
  if (weakBulletCount > 0) {
    suggestions.push({
      id: 'opt-bullets',
      type: 'bullet',
      section: 'experience',
      itemIndex: undefined,
      bulletIndex: undefined,
      currentText: '',
      improvedText: 'Replace weak starters (e.g., "Responsible for", "Worked on") with strong action verbs (e.g., "Spearheaded", "Engineered", "Optimized")',
      text: 'Strengthen weak bullet points',
      impact: 'medium',
      reason: 'Strong action verbs immediately improve resume quality and ATS scoring',
      title: 'Use stronger action verbs',
      impactLevel: 'medium',
      confidence: 85
    });
  }
  
  // 5. Enhance technical depth
  if (breakdown.completeness < 90) {
    suggestions.push({
      id: 'opt-depth',
      type: 'content',
      section: 'experience',
      itemIndex: undefined,
      bulletIndex: undefined,
      currentText: '',
      improvedText: 'Add technical depth by mentioning specific tools, technologies, and methodologies used in each role',
      text: 'Add technical depth and tools used',
      impact: 'medium',
      reason: 'Specific technologies and tools improve ATS matching and demonstrate technical expertise',
      title: 'Add technical tools and frameworks',
      impactLevel: 'medium',
      confidence: 80
    });
  }
  
  return suggestions;
};

/**
 * Helper: Count weak bullets in resume
 */
const countWeakBullets = (resume) => {
  let count = 0;
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach(bullet => {
          if (bullet && /^(responsible for|worked on|worked with|used|helped|handled|involved in|participated in|made)/i.test(bullet)) {
            count++;
          }
        });
      }
    });
  }
  return count;
};

/**
 * ================================================================================
 * GENERATE SUGGESTIONS - USING SMART BULLET REWRITER
 * ================================================================================
 * Uses bulletRewriter.js for intelligent, grammatically correct suggestions
 */

const bulletRewriter = require('../utils/bulletRewriter');

const generateSuggestions = (resume, jdKeywords, breakdown) => {
  const suggestions = [];
  
  // ✅ FIXED: Validate input
  const validatedJDKeywords = Array.isArray(jdKeywords) ? jdKeywords : [];
  const validatedBreakdown = breakdown || { completeness: 0, keywordMatch: 0, actionVerbs: 0 };
  
  // 1. MISSING KEYWORDS suggestions - Always trigger if JD has keywords
  if (validatedJDKeywords.length > 0) {
    const resumeText = buildResumeText(resume);
    const missing = validatedJDKeywords
      .filter(kw => !matchKeyword(resumeText, kw.keyword))
      .sort((a, b) => (b.weight || 1) - (a.weight || 1)) // Sort by importance
      .slice(0, 5); // Top 5 missing keywords
    
    if (missing.length > 0) {
      missing.forEach((kw, idx) => {
        // ✅ FIXED: Always suggest high-weight keywords
        if ((kw.weight || 1) >= 1) {
          suggestions.push({
            id: `sugg-keyword-${idx}`,
            type: 'keyword',
            section: 'skills',
            itemIndex: 0,
            bulletIndex: undefined,
            currentText: '',
            improvedText: kw.keyword,
            text: `Add keyword: "${kw.keyword}"`,
            impact: kw.weight >= 3 ? 'high' : 'medium',
            reason: `"${kw.keyword}" appears in the job description and would improve your match`,
            title: `Add missing keyword: ${kw.keyword}`,
            impactLevel: kw.weight >= 3 ? 'high' : 'medium',
            confidence: 95
          });
        }
      });
    }
  }
  
  // 2. WEAK BULLET suggestions (using intelligent rewriter)
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach((exp, expIdx) => {
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet, bulletIdx) => {
          if (!bullet || typeof bullet !== 'string') return;
          
          // ✅ FIX #2, #8: Check if should suggest (prevents looping)
          if (!rewriteRules.shouldSuggest(bullet, 'weak_bullet')) {
            return;  // Skip if already improved
          }
          
          // ✅ FIXED: Check for grammar issues
          const grammarCheck = validation.validateBulletGrammar(bullet);
          if (!grammarCheck.isValid) {
            // Grammar issue found - suggest fix
            const fixed = validation.fixBulletGrammar(bullet);
            if (fixed !== bullet) {
              suggestions.push({
                id: `sugg-grammar-${expIdx}-${bulletIdx}`,
                type: 'bullet',
                section: 'experience',
                itemIndex: expIdx,
                bulletIndex: bulletIdx,
                currentText: bullet,
                improvedText: fixed,
                text: `Fix grammar: "${bullet}" → "${fixed}"`,
                impact: 'high',
                reason: grammarCheck.issues[0] || 'Improve sentence structure for clarity',
                title: 'Fix grammar issue',
                impactLevel: 'high',
                confidence: 90
              });
            }
          } else {
            // No grammar issue, try intelligent rewriting
            const rewritten = bulletRewriter.rewriteBullet(bullet, 'experience');
            
            if (rewritten.rewritten !== rewritten.original && countWords(rewritten.rewritten) >= 5) {
              suggestions.push({
                id: `sugg-bullet-${expIdx}-${bulletIdx}`,
                type: 'bullet',
                section: 'experience',
                itemIndex: expIdx,
                bulletIndex: bulletIdx,
                currentText: rewritten.original,
                improvedText: rewritten.expanded || rewritten.rewritten,
                text: `Strengthen: "${rewritten.original.substring(0, 40)}..."`,
                impact: rewritten.confidence === 'high' ? 'high' : 'medium',
                reason: 'Use stronger action verb and add quantifiable impact',
                title: 'Strengthen bullet point',
                impactLevel: rewritten.confidence === 'high' ? 'high' : 'medium',
                confidence: rewritten.confidence === 'high' ? 90 : 75
              });
            }
          }
        });
      }
    });
  }
  
  // 3. SHORT BULLET suggestions - Expand < 8 words
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach((exp, expIdx) => {
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet, bulletIdx) => {
          if (!bullet || typeof bullet !== 'string') return;
          
          const wordCount = countWords(bullet);
          if (wordCount < 8 && suggestions.length < 15) {
            const rewritten = bulletRewriter.rewriteBullet(bullet, 'experience');
            if (rewritten.expanded.length > bullet.length && rewritten.expanded.length > 50) {
              suggestions.push({
                id: `sugg-expand-${expIdx}-${bulletIdx}`,
                type: 'bullet',
                section: 'experience',
                itemIndex: expIdx,
                bulletIndex: bulletIdx,
                currentText: rewritten.original,
                improvedText: rewritten.expanded,
                text: `Expand: "${rewritten.original}" (${wordCount} words)`,
                impact: 'medium',
                reason: 'Longer, more detailed bullets show stronger impact and improve readability',
                title: 'Expand short bullet point',
                impactLevel: 'medium',
                confidence: 80
              });
            }
          }
        });
      }
    });
  }
  
  // 4. MISSING METRICS suggestions - Only for strong bullets without metrics
  if (Array.isArray(resume.experience) && suggestions.length < 15) {
    resume.experience.forEach((exp, expIdx) => {
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet, bulletIdx) => {
          if (!bullet || typeof bullet !== 'string') return;
          
          // ✅ FIX #2, #5, #8: Check if should suggest metrics (prevents looping and duplicates)
          if (!rewriteRules.shouldSuggest(bullet, 'missing_metrics')) {
            return;  // Skip if already improved or has impact phrases
          }
          
          const { hasMetrics, suggestedTemplate } = bulletRewriter.analyzeMetricsNeed(bullet);
          
          // ✅ FIXED: Only suggest metrics if bullet is strong enough AND has no metrics
          if (!hasMetrics && countWords(bullet) >= 8 && suggestedTemplate && validatedBreakdown.actionVerbs > 60) {
            suggestions.push({
              id: `sugg-metrics-exp-${expIdx}-${bulletIdx}`,
              type: 'impact',
              section: 'experience',
              itemIndex: expIdx,
              bulletIndex: bulletIdx,
              currentText: bullet,
              improvedText: suggestedTemplate,
              text: `Add metrics: "${bullet.substring(0, 40)}..."`,
              impact: 'high',
              reason: 'Quantifiable metrics demonstrate measurable achievements and business impact',
              title: 'Add measurable metrics',
              impactLevel: 'high',
              confidence: 85
            });
          }
        });
      }
    });
  }
  
  // 5. PROJECT METRICS suggestions
  if (Array.isArray(resume.projects) && suggestions.length < 15) {
    resume.projects.forEach((proj, projIdx) => {
      if (Array.isArray(proj.bullets)) {
        proj.bullets.forEach((bullet, bulletIdx) => {
          if (!bullet || typeof bullet !== 'string') return;
          
          const { hasMetrics } = bulletRewriter.analyzeMetricsNeed(bullet);
          
          if (!hasMetrics && countWords(bullet) >= 8) {
            suggestions.push({
              id: `sugg-metrics-proj-${projIdx}-${bulletIdx}`,
              type: 'impact',
              section: 'projects',
              itemIndex: projIdx,
              bulletIndex: bulletIdx,
              currentText: bullet,
              improvedText: 'Add project outcome: scale (users/QPS), performance gain (%), or business impact',
              text: 'Add measurable project impact',
              impact: 'high',
              reason: 'Quantifiable results demonstrate value and practical business application',
              title: 'Add project impact metrics',
              impactLevel: 'high',
              confidence: 80
            });
          }
        });
      }
    });
  }
  
  // 6. MISSING SUMMARY suggestion - Always suggest if poor
  if ((!resume.summary || resume.summary.trim().length < 50) && suggestions.length < 15) {
    const existingSummary = resume.summary?.trim() || '';
    suggestions.push({
      id: 'sugg-summary',
      type: 'section',
      section: 'summary',
      itemIndex: undefined,
      bulletIndex: undefined,
      currentText: existingSummary,
      improvedText: 'Results-driven professional with proven expertise in delivering impactful solutions and driving measurable outcomes across diverse technical and business challenges.',
      text: 'Add a professional summary (3-4 sentences)',
      impact: 'high',
      reason: 'A compelling summary makes your resume stand out and improves ATS visibility',
      title: 'Add professional summary',
      impactLevel: 'high',
      confidence: 95
    });
  }
  
  // 7. MISSING SECTIONS suggestion
  if (validatedBreakdown.completeness < 60 && suggestions.length < 15) {
    if (!Array.isArray(resume.projects) || resume.projects.length === 0) {
      suggestions.push({
        id: 'sugg-projects-section',
        type: 'section',
        section: 'projects',
        itemIndex: undefined,
        bulletIndex: undefined,
        currentText: '',
        improvedText: 'Add 2-3 projects with descriptions and measurable outcomes',
        text: 'Add a Projects section (2-3 projects)',
        impact: 'high',
        reason: 'Projects demonstrate practical application of skills and technical expertise',
        title: 'Add Projects section',
        impactLevel: 'high',
        confidence: 90
      });
    }
  }
  
  // ✅ FIXED: Validate all suggestions and remove duplicates
  const validatedSuggestions = validation.validateSuggestions(suggestions);
  
  // ✅ IMPROVED: Always generate optimization suggestions, even for high-scoring resumes
  // Ensure at least 2 suggestions are ALWAYS provided
  if (validatedSuggestions.length < 2) {
    const optimizationSuggestions = generateOptimizationSuggestions(resume, validatedBreakdown, validatedJDKeywords);
    for (const suggestion of optimizationSuggestions) {
      if (validatedSuggestions.length >= 2) break;
      validatedSuggestions.push(suggestion);
    }
  }
  
  // ✅ FIX PUNCTUATION: Clean all suggestions of ".," ".." ",." bugs
  const cleanedSuggestions = validatedSuggestions.map(s => cleanSuggestionText(s));
  
  return cleanedSuggestions;
};


/**
 * Intelligently improve a weak bullet (full rewrite, not just prepend)
 */

/**
 * Intelligently improve a weak bullet (DEPRECATED - use bulletRewriter.js instead)
 * Kept for backward compatibility but not used in current flow
 */
const improveBullet = (bullet, section) => {
  // Delegate to bulletRewriter
  const bulletRewriter = require('../utils/bulletRewriter');
  const rewritten = bulletRewriter.rewriteBullet(bullet, section);
  return rewritten.expanded || rewritten.rewritten || bullet;
};


// ═══════════════════════════════════════════════════════════════════════════
// MAIN: CALCULATE ATS SCORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main ATS scoring function - returns comprehensive report
 * 
 * Accepts either:
 * - (resumeId, jdId) - fetches from DB
 * - (resumeObj, jdObj) - uses objects directly (for transactions)
 */
const calculateATSScore = async (resumeInput, jdInput) => {
  if (!resumeInput) throw new Error('Resume input required');
  
  let resume, jdKeywords = [];
  
  // Handle both ID and object inputs
  if (typeof resumeInput === 'string' || resumeInput._id) {
    // Input is an ID
    const resumeId = typeof resumeInput === 'string' ? resumeInput : resumeInput._id;
    resume = await Resume.findById(resumeId).lean();
    if (!resume) throw new Error(`Resume ${resumeId} not found`);
  } else {
    // Input is already an object
    resume = typeof resumeInput.toObject === 'function' ? resumeInput.toObject() : resumeInput;
  }
  
  if (jdInput) {
    try {
      let jd;
      if (typeof jdInput === 'string') {
        jd = await JobDescription.findById(jdInput).lean();
      } else if (typeof jdInput.toObject === 'function') {
        jd = jdInput.toObject();
      } else {
        jd = jdInput;
      }
      
      if (jd) jdKeywords = extractJDKeywords(jd);
    } catch (err) {
      console.warn('⚠️ Failed to extract JD keywords:', err.message);
    }
  }
  
  // If no JD provided, try to use resume's default JD
  if (jdKeywords.length === 0 && resume.jdId) {
    try {
      const jd = await JobDescription.findById(resume.jdId).lean();
      if (jd) jdKeywords = extractJDKeywords(jd);
    } catch (err) {
      console.warn('⚠️ Failed to extract default JD keywords:', err.message);
    }
  }
  
  // Calculate all components
  const keywordData = calculateKeywordMatch(resume, jdKeywords);
  const completeness = calculateCompleteness(resume);
  const formatting = calculateFormatting(resume);
  const actionVerbs = calculateActionVerbs(resume);
  const readability = calculateReadability(resume);
  
  // Weighted total score
  let totalScore = null;
  if (jdKeywords.length > 0) {
    // ✅ SPECIFICATION-COMPLIANT: Correct weight distribution
    // ATS Score = (keyword*0.40) + (completeness*0.20) + (formatting*0.20) + (actionVerbs*0.10) + (readability*0.10)
    const rawScore = 
      keywordData.score * 0.40 +
      completeness * 0.20 +
      formatting * 0.20 +
      actionVerbs * 0.10 +
      readability * 0.10;
    
    // ✅ Round to integer 0-100
    totalScore = Math.round(rawScore);
    totalScore = Math.max(0, Math.min(100, totalScore));
  }
  
  const breakdown = {
    keywordMatch: validation.validateATSScore(keywordData.score),
    completeness: validation.validateATSScore(completeness),
    formatting: validation.validateATSScore(formatting),
    actionVerbs: validation.validateATSScore(actionVerbs),
    readability: validation.validateATSScore(readability)
  };

  
  // Generate suggestions
  const suggestions = generateSuggestions(resume, jdKeywords, breakdown);
  
  // Detect missing sections
  const missingSections = getMissingSections(resume);
  
  return {
    score: totalScore,
    totalScore: totalScore,
    keywordMatchPercent: breakdown.keywordMatch,
    completenessScore: breakdown.completeness,
    formattingScore: breakdown.formatting,
    actionVerbScore: breakdown.actionVerbs,
    readabilityScore: breakdown.readability,
    keywordMatchScore: breakdown.keywordMatch,
    sectionCompletenessScore: breakdown.completeness,
    scoringMode: totalScore !== null ? 'job-specific' : 'no-jd',
    breakdown,
    matchedKeywords: keywordData.matchedKeywords,
    missingKeywords: keywordData.missingKeywords,
    missingSections: missingSections,
    suggestions,
    jdKeywordCount: jdKeywords.length,
    overallFeedback: generateFeedback(totalScore, breakdown, keywordData.missingKeywords)
  };
};

/**
 * Generate text feedback based on scores
 */
const generateFeedback = (totalScore, breakdown, missingKeywords) => {
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];
  
  if (!breakdown) return { strengths, weaknesses, recommendations };
  
  // Strengths
  if (breakdown.keywordMatch >= 75) strengths.push('Strong keyword alignment with job description');
  if (breakdown.formatting >= 85) strengths.push('Clean and ATS-optimized format');
  if (breakdown.completeness >= 80) strengths.push('Well-structured and comprehensive resume');
  if (breakdown.actionVerbs >= 75) strengths.push('Effective use of strong action verbs');
  if (breakdown.readability >= 75) strengths.push('Clear and impactful bullet points');
  
  // Weaknesses & Recommendations
  if (breakdown.keywordMatch < 70) {
    weaknesses.push('Keyword match could be stronger');
    recommendations.push(`Add missing keywords: ${missingKeywords.slice(0, 3).join(', ')}`);
  }
  if (breakdown.completeness < 70) {
    weaknesses.push('Resume is missing key sections');
    recommendations.push('Ensure Summary, Experience, Skills, and Projects are present and detailed');
  }
  if (breakdown.actionVerbs < 70) {
    weaknesses.push('Some bullets lack strong action verbs');
    recommendations.push('Start bullets with verbs like: Developed, Architected, Optimized, Ledfeedforward');
  }
  if (breakdown.readability < 70) {
    weaknesses.push('Bullet clarity could be improved');
    recommendations.push('Keep bullets 10-20 words, focus on measurable outcomes');
  }
  
  if (strengths.length === 0) strengths.push('Resume has good fundamentals');
  if (weaknesses.length === 0) weaknesses.push('Minor optimizations available');
  if (recommendations.length === 0) recommendations.push('Quantify achievements with metrics and percentages');
  
  return { strengths, weaknesses, recommendations };
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVALUATE RESUME - Production-Ready Scoring & Suggestion Generation
 * ═══════════════════════════════════════════════════════════════════════════
 * Returns: { totalScore, breakdown, suggestions, missingKeywords, overallFeedback }
 * All suggestions are auto-applicable (no advisory-only logic)
 */
const evaluateResume = async (resume, jd) => {
  const breakdown = {
    keywordMatch: 0,
    formatting: 0,
    completeness: 0,
    actionVerbs: 0,
    readability: 0,
  };

  // Keyword matching
  const jdKeywords = new Set((jd.extractedKeywords || []).map(k => k.toLowerCase()));
  const resumeText = `
    ${resume.summary || ''} 
    ${(resume.skills || []).flatMap(s => s.items).join(' ')} 
    ${(resume.experience || []).flatMap(e => e.bullets).join(' ')}
  `.toLowerCase();

  let keywordHits = 0;
  jdKeywords.forEach(kw => {
    if (resumeText.includes(kw)) keywordHits++;
  });
  breakdown.keywordMatch = Math.round((keywordHits / jdKeywords.size) * 100);

  // Formatting completeness
  const hasAllSections = resume.summary && resume.experience?.length && resume.skills?.length;
  breakdown.completeness = hasAllSections ? 90 : 60;

  // Formatting score
  const bulletCount = (resume.experience || []).reduce((sum, e) => sum + (e.bullets?.length || 0), 0);
  breakdown.formatting = bulletCount >= 10 ? 85 : bulletCount >= 5 ? 70 : 50;

  // Action verbs (REMOVE suggestions if score is 100)
  const actionVerbs = ['managed', 'led', 'developed', 'designed', 'implemented', 'created', 'built'];
  const verbMatches = (resume.experience || []).flatMap(e => e.bullets || [])
    .filter(b => actionVerbs.some(v => b.toLowerCase().includes(v))).length;
  breakdown.actionVerbs = Math.min(100, (verbMatches / Math.max(bulletCount, 1)) * 100);

  // Readability
  const sentenceLength = resumeText.split('.').filter(s => s.trim()).length;
  breakdown.readability = sentenceLength >= 20 ? 85 : 70;

  const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0) / 5;

  // Generate suggestions ONLY for missing improvements
  const suggestions = [];

  if (breakdown.keywordMatch < 80) {
    const missingKeywords = Array.from(jdKeywords).filter(kw => !resumeText.includes(kw)).slice(0, 3);
    missingKeywords.forEach(kw => {
      suggestions.push({
        id: `sugg-${Math.random().toString(36).substr(2, 9)}`,
        section: 'skills',
        itemIndex: 0,
        currentText: '',
        improvedText: kw,
        impact: 'high',
        reason: `Add skill "${kw}" from job description`,
        type: 'keyword',
      });
    });
  }

  if (breakdown.actionVerbs < 100 && (resume.experience || []).length > 0) {
    const firstExpIdx = 0;
    const firstBulletIdx = 0;
    const bullet = resume.experience?.[firstExpIdx]?.bullets?.[firstBulletIdx];
    if (bullet && !actionVerbs.some(v => bullet.toLowerCase().includes(v))) {
      suggestions.push({
        id: `sugg-${Math.random().toString(36).substr(2, 9)}`,
        section: 'experience',
        itemIndex: firstExpIdx,
        bulletIndex: firstBulletIdx,
        currentText: bullet,
        improvedText: `Managed team objectives and delivered results exceeding targets.`,
        impact: 'high',
        reason: 'Strengthen bullet with action verb',
        type: 'verb',
      });
    }
  }

  if (breakdown.completeness < 90 && !resume.summary) {
    suggestions.push({
      id: `sugg-${Math.random().toString(36).substr(2, 9)}`,
      section: 'summary',
      currentText: '',
      improvedText: 'Results-driven professional with expertise in delivering impactful solutions.',
      impact: 'medium',
      reason: 'Add professional summary',
      type: 'content',
    });
  }

  return {
    totalScore: Math.round(totalScore),
    breakdown,
    suggestions: suggestions.slice(0, 15),
    missingKeywords: Array.from(jdKeywords).slice(0, 5),
    overallFeedback: {
      strengths: breakdown.keywordMatch >= 70 ? ['Good keyword alignment'] : [],
      weaknesses: breakdown.actionVerbs < 50 ? ['Weak action verbs'] : [],
      recommendations: ['Review and apply suggestions to improve score'],
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  calculateATSScore,
  calculateKeywordMatch,
  calculateCompleteness,
  calculateFormatting,
  calculateActionVerbs,
  calculateReadability,
  generateSuggestions,
  extractJDKeywords,
  buildResumeText,
  improveBullet,
  normalizeKeywordForMatching,
  evaluateResume,
  getMissingSections,
  fixPunctuation,
  cleanSuggestionText,
  REQUIRED_SECTIONS,
  STRONG_VERBS,
  WEAK_VERBS,
  TECH_SYNONYMS
};
