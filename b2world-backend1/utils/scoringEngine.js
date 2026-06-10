/**
 * Unified ATS Scoring Engine
 * 
 * Robust, deterministic, mathematically correct scoring.
 * Role-agnostic, production-safe.
 */

const keywordService = require('../services/keywordService');

// Strong verbs - configurable
const STRONG_VERBS = new Set([
  'built', 'developed', 'implemented', 'optimized', 'designed',
  'analyzed', 'created', 'improved', 'reduced', 'increased',
  'automated', 'engineered', 'deployed', 'led', 'managed',
  'architected', 'integrated', 'transformed', 'accelerated',
  'delivered', 'executed', 'established', 'launched', 'scaled',
  'orchestrated', 'spearheaded', 'directed', 'championed', 'pioneered',
  'streamlined', 'enhanced', 'refactored', 'migrated', 'secured',
  'validated', 'tested', 'debugged', 'troubleshot', 'resolved'
]);

// Weak verbs to flag
const WEAK_VERBS = new Set([
  'worked', 'helped', 'assisted', 'responsible', 'supported',
  'handled', 'used', 'made', 'did', 'was', 'involved',
  'participated', 'contributed', 'engaged', 'joined'
]);

// Metrics regex patterns
const METRICS_REGEX = /\d+%|\$\d+|\d+\+?|\d+ms|\d+k|\d+m|\d+b|x\s*faster|increased|decreased|reduced|improved|enhanced|optimized/gi;

/**
 * Normalize text for scoring
 */
const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Extract first word from text
 */
const getFirstWord = (text) => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  return words[0]?.toLowerCase().replace(/[^a-z]/g, '') || '';
};

/**
 * Calculate action verb score
 * 
 * actionScore = (strongStarts / totalBullets) * 100
 * +10 bonus if bullet contains quantified metrics
 * Cap at 100
 */
const calculateActionScore = (bullets = []) => {
  if (!Array.isArray(bullets) || bullets.length === 0) {
    return 0;
  }

  let strongStarts = 0;
  let hasMetricBonus = 0;

  bullets.forEach(bullet => {
    if (!bullet || typeof bullet !== 'string') return;
    
    const normalized = normalizeText(bullet);
    const firstWord = getFirstWord(normalized);
    
    if (STRONG_VERBS.has(firstWord)) {
      strongStarts++;
    }
    
    // Check for quantified metrics
    if (METRICS_REGEX.test(bullet)) {
      hasMetricBonus += 10;
    }
  });

  const baseScore = (strongStarts / bullets.length) * 100;
  const metricBonus = Math.min(hasMetricBonus, 20); // Cap bonus at 20
  const finalScore = Math.min(100, Math.round(baseScore + metricBonus));
  
  return finalScore;
};

/**
 * Calculate completeness score
 * 
 * completeness = (present / 7) * 100
 * 
 * Required sections: summary, skills, experience, projects, education, certifications, achievements
 */
const calculateCompleteness = (resume) => {
  if (!resume || typeof resume !== 'object') {
    return 0;
  }

  const requiredSections = [
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
    'achievements'
  ];

  let presentCount = 0;

  // Summary
  if (resume.summary && typeof resume.summary === 'string' && resume.summary.trim().length > 20) {
    presentCount++;
  }

  // Skills
  if (resume.skills && Array.isArray(resume.skills) && resume.skills.length > 0) {
    const hasSkills = resume.skills.some(cat => 
      cat.items && Array.isArray(cat.items) && cat.items.length > 0
    );
    if (hasSkills) presentCount++;
  }

  // Experience
  if (resume.experience && Array.isArray(resume.experience) && resume.experience.length > 0) {
    const hasBullets = resume.experience.some(exp => 
      exp.bullets && Array.isArray(exp.bullets) && exp.bullets.length > 0
    );
    if (hasBullets) presentCount++;
  }

  // Projects
  if (resume.projects && Array.isArray(resume.projects) && resume.projects.length > 0) {
    presentCount++;
  }

  // Education
  if (resume.education && Array.isArray(resume.education) && resume.education.length > 0) {
    presentCount++;
  }

  // Certifications
  if (resume.certifications && Array.isArray(resume.certifications) && resume.certifications.length > 0) {
    presentCount++;
  }

  // Achievements
  if (resume.achievements && Array.isArray(resume.achievements) && resume.achievements.length > 0) {
    presentCount++;
  }

  return Math.round((presentCount / requiredSections.length) * 100);
};

/**
 * Calculate formatting score
 * 
 * Penalize:
 * - excessive special characters
 * - too long paragraphs
 * - too few bullets
 * - inconsistent spacing
 */
const calculateFormattingScore = (resume) => {
  if (!resume || typeof resume !== 'object') {
    return 0;
  }

  let penalty = 0;
  let totalBullets = 0;
  let totalParagraphs = 0;

  // Collect all bullets
  const allBullets = [];
  
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.bullets && Array.isArray(exp.bullets)) {
        allBullets.push(...exp.bullets);
      }
    });
  }

  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.bullets && Array.isArray(proj.bullets)) {
        allBullets.push(...proj.bullets);
      }
    });
  }

  totalBullets = allBullets.length;

  // Check for excessive special characters
  const allText = allBullets.join(' ');
  const specialCharCount = (allText.match(/[*_~`#=]{3,}/g) || []).length;
  if (specialCharCount > 0) penalty += 20;

  // Check for table-like patterns
  if (/\|.+\|/.test(allText) || /\btable\b/i.test(allText)) {
    penalty += 15;
  }

  // Check for emojis
  if (/[\u{1F300}-\u{1FAFF}]/u.test(allText)) {
    penalty += 10;
  }

  // Check for too long bullets (> 35 words)
  const longBullets = allBullets.filter(b => {
    const wordCount = b.trim().split(/\s+/).length;
    return wordCount > 35;
  });
  penalty += Math.min(20, longBullets.length * 5);

  // Check for empty bullets
  const emptyBullets = allBullets.filter(b => !b || b.trim().length < 5);
  penalty += Math.min(15, emptyBullets.length * 5);

  // Check for very short bullets (single word)
  const shortBullets = allBullets.filter(b => {
    const wordCount = b.trim().split(/\s+/).length;
    return wordCount <= 2;
  });
  penalty += Math.min(10, shortBullets.length * 2);

  // Check summary length
  if (resume.summary) {
    const summaryWords = resume.summary.trim().split(/\s+/).length;
    if (summaryWords > 100) {
      penalty += 10;
    }
  }

  // Base score = 100 - penalties
  const score = Math.max(0, 100 - penalty);
  
  return score;
};

/**
 * Calculate readability score
 * 
 * Penalize:
 * - bullet > 35 words
 * - paragraph > 5 lines
 * - duplicate sentences
 * - repeated phrases
 */
const calculateReadabilityScore = (resume) => {
  if (!resume || typeof resume !== 'object') {
    return 0;
  }

  let penalty = 0;

  // Collect all text
  const allText = [];
  
  if (resume.summary) allText.push(resume.summary);
  
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.bullets && Array.isArray(exp.bullets)) {
        allText.push(...exp.bullets);
      }
    });
  }

  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.bullets && Array.isArray(proj.bullets)) {
        allText.push(...proj.bullets);
      }
    });
  }

  const textString = allText.join(' ');
  const sentences = textString.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = textString.split(/\s+/).filter(w => w.length > 0);

  // Check for very long bullets (> 35 words)
  const longBulletPenalty = allText.filter(text => {
    const wordCount = text.split(/\s+/).length;
    return wordCount > 35;
  }).length * 5;
  penalty += Math.min(25, longBulletPenalty);

  // Check for repeated words
  const wordFreq = {};
  words.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.length > 3) {
      wordFreq[normalized] = (wordFreq[normalized] || 0) + 1;
    }
  });

  const repeatedWords = Object.values(wordFreq).filter(count => count > 3).length;
  penalty += Math.min(20, repeatedWords * 3);

  // Check for duplicate sentences
  const uniqueSentences = new Set(sentences.map(s => normalizeText(s)));
  const duplicatePenalty = sentences.length - uniqueSentences.size;
  penalty += Math.min(15, duplicatePenalty * 5);

  // Check for excessive spacing issues
  if (/\s{3,}/.test(textString)) {
    penalty += 10;
  }

  // Check for very short summary
  if (resume.summary && resume.summary.split(/\s+/).length < 10) {
    penalty += 5;
  }

  // Base score = 100 - penalties
  const score = Math.max(0, 100 - penalty);
  
  return score;
};

/**
 * Main scoring function
 * 
 * Returns:
 * {
 *   totalScore,
 *   breakdown: {
 *     keywordMatch,
 *     completeness,
 *     formatting,
 *     actionScore,
 *     readability
 *   },
 *   matchedKeywords,
 *   missingKeywords
 * }
 */
const calculateScore = (resume, jdKeywords) => {
  // Validate inputs
  if (!resume || typeof resume !== 'object') {
    return {
      totalScore: 0,
      breakdown: {
        keywordMatch: 0,
        completeness: 0,
        formatting: 0,
        actionScore: 0,
        readability: 0
      },
      matchedKeywords: [],
      missingKeywords: []
    };
  }

  // Build resume text
  const resumeText = keywordService.buildResumeText(resume);

  // Calculate keyword match
  let keywordMatch = 0;
  let matchedKeywords = [];
  let missingKeywords = [];
  
  if (jdKeywords && Array.isArray(jdKeywords) && jdKeywords.length > 0) {
    const keywordResult = keywordService.calculateKeywordMatch(jdKeywords, resumeText);
    keywordMatch = keywordResult.keywordMatch;
    matchedKeywords = keywordResult.matchedKeywords;
    missingKeywords = keywordResult.missingKeywords;
  }

  // Calculate other scores
  const completeness = calculateCompleteness(resume);
  
  // Collect all bullets for action score
  const allBullets = [];
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.bullets && Array.isArray(exp.bullets)) {
        allBullets.push(...exp.bullets);
      }
    });
  }
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.bullets && Array.isArray(proj.bullets)) {
        allBullets.push(...proj.bullets);
      }
    });
  }
  
  const actionScore = calculateActionScore(allBullets);
  const formatting = calculateFormattingScore(resume);
  const readability = calculateReadabilityScore(resume);

  // Calculate final weighted score
  const totalScore = Math.round(
    keywordMatch * 0.4 +
    completeness * 0.2 +
    formatting * 0.2 +
    actionScore * 0.1 +
    readability * 0.1
  );

  return {
    totalScore,
    breakdown: {
      keywordMatch,
      completeness,
      formatting,
      actionScore,
      readability
    },
    matchedKeywords,
    missingKeywords
  };
};

module.exports = {
  calculateScore,
  calculateActionScore,
  calculateCompleteness,
  calculateFormattingScore,
  calculateReadabilityScore,
  STRONG_VERBS,
  WEAK_VERBS,
  METRICS_REGEX
};
