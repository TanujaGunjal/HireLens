'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPROVED ATS SCORING ENGINE - Assignment Requirements Compliant
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Implements exact scoring formula with proper weights:
 * - Keyword Match: 40%
 * - Section Completeness: 20%
 * - Formatting: 20%
 * - Action Verbs: 10%
 * - Readability: 10%
 * 
 * Generates improvement suggestions even for high-scoring resumes
 * Handles all edge cases and produces realistic score distribution
 */

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

const STRONG_ACTION_VERBS = new Set([
  'built', 'developed', 'implemented', 'designed', 'optimized', 'reduced',
  'increased', 'created', 'analyzed', 'improved', 'delivered', 'led',
  'managed', 'engineered', 'automated', 'architected', 'deployed',
  'established', 'launched', 'achieved', 'coordinated', 'facilitated',
  'collaborated', 'enhanced', 'resolved', 'executed', 'documented',
  'mentored', 'trained', 'directed', 'orchestrated', 'scaled',
  'configured', 'integrated', 'tested', 'debugged', 'refined',
  'validated', 'streamlined', 'accelerated', 'transformed'
]);

const SECTION_PATTERNS = {
  summary: [
    'summary', 'professional summary', 'career summary', 'profile', 'overview',
    'objective', 'about', 'professional profile'
  ],
  skills: [
    'skills', 'technical skills', 'core skills', 'competencies', 'expertise',
    'technologies', 'tools'
  ],
  experience: [
    'experience', 'work experience', 'professional experience', 'employment',
    'work history', 'career history'
  ],
  projects: [
    'projects', 'personal projects', 'portfolio', 'academic projects',
    'side projects', 'notable projects'
  ],
  education: [
    'education', 'academic background', 'degrees', 'qualifications', 'courses',
    'certifications'
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize text: lowercase, tokenize, remove punctuation
 */
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Tokenize text into words
 */
const tokenize = (text) => {
  if (!text) return [];
  return normalizeText(text).split(' ').filter(word => word.length > 0);
};

/**
 * Extract unique tokens from text, filtering stopwords
 */
const extractKeywords = (text) => {
  const tokens = tokenize(text);
  const unique = new Set(tokens);
  return Array.from(unique).filter(word => !STOPWORDS.has(word) && word.length > 2);
};

/**
 * Build complete resume text from all sections
 */
const buildResumeText = (resume) => {
  const parts = [];

  if (resume.summary) parts.push(String(resume.summary));
  if (resume.objective) parts.push(String(resume.objective));

  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(skill => {
      if (skill.category) parts.push(String(skill.category));
      if (Array.isArray(skill.items)) {
        parts.push(...skill.items.map(item => String(item)));
      }
    });
  }

  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.company) parts.push(String(exp.company));
      if (exp.position || exp.jobTitle) parts.push(String(exp.position || exp.jobTitle));
      if (exp.description) parts.push(String(exp.description));
      if (Array.isArray(exp.bullets)) {
        parts.push(...exp.bullets.map(b => String(b)));
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.title) parts.push(String(proj.title));
      if (proj.description) parts.push(String(proj.description));
      if (Array.isArray(proj.techStack)) {
        parts.push(...proj.techStack.map(t => String(t)));
      }
      if (Array.isArray(proj.bullets)) {
        parts.push(...proj.bullets.map(b => String(b)));
      }
    });
  }

  if (Array.isArray(resume.education)) {
    resume.education.forEach(edu => {
      if (edu.institution) parts.push(String(edu.institution));
      if (edu.degree) parts.push(String(edu.degree));
      if (edu.field) parts.push(String(edu.field));
    });
  }

  return parts.join(' ');
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. KEYWORD MATCHING (40%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate keyword match percentage
 * Returns: { score: 0-100, matchedKeywords: [], missingKeywords: [] }
 */
const calculateKeywordMatch = (resume, jdKeywords) => {
  if (!jdKeywords || jdKeywords.length === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const resumeText = buildResumeText(resume).toLowerCase();
  const matched = [];
  const missing = [];

  jdKeywords.forEach(keyword => {
    const normalized = normalizeText(keyword);
    if (resumeText.includes(normalized)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const matchPercent = jdKeywords.length > 0 
    ? Math.round((matched.length / jdKeywords.length) * 100)
    : 0;

  return {
    score: matchPercent,
    matchedKeywords: matched,
    missingKeywords: missing
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. SECTION COMPLETENESS (20%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if a section exists (flexible heading detection)
 */
const detectSection = (resume, sectionName) => {
  const patterns = SECTION_PATTERNS[sectionName] || [];
  const resumeText = buildResumeText(resume).toLowerCase();
  
  // Check for heading patterns
  const hasHeading = patterns.some(pattern => 
    new RegExp(`\\b${pattern}\\b`, 'i').test(resumeText)
  );

  // Check actual data presence
  let hasData = false;
  switch (sectionName) {
    case 'summary':
      hasData = resume.summary && String(resume.summary).trim().length > 20;
      break;
    case 'skills':
      hasData = Array.isArray(resume.skills) && resume.skills.length > 0 &&
        resume.skills.some(s => Array.isArray(s.items) && s.items.length > 0);
      break;
    case 'experience':
      hasData = Array.isArray(resume.experience) && resume.experience.length > 0;
      break;
    case 'projects':
      hasData = Array.isArray(resume.projects) && resume.projects.length > 0;
      break;
    case 'education':
      hasData = Array.isArray(resume.education) && resume.education.length > 0;
      break;
  }

  return hasHeading || hasData;
};

/**
 * Calculate section completeness percentage
 */
const calculateSectionCompleteness = (resume) => {
  const requiredSections = ['summary', 'skills', 'experience', 'projects', 'education'];
  let foundCount = 0;

  requiredSections.forEach(section => {
    if (detectSection(resume, section)) {
      foundCount++;
    }
  });

  return Math.round((foundCount / requiredSections.length) * 100);
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. FORMATTING SCORE (20%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate ATS formatting compatibility
 */
const calculateFormattingScore = (resume) => {
  let score = 100;
  const issues = [];

  // Check for problematic elements
  const resumeText = buildResumeText(resume);

  // Deduct for detected issues
  if (resumeText.includes('<img') || resumeText.includes('[image]')) {
    score -= 20;
    issues.push('Contains images');
  }

  if (resumeText.includes('<table') || resumeText.includes('|')) {
    score -= 20;
    issues.push('Contains tables');
  }

  // Check for excessive special characters
  const specialCharCount = (resumeText.match(/[™®©§¶]/g) || []).length;
  if (specialCharCount > 5) {
    score -= 15;
    issues.push('Excessive special symbols');
  }

  // Check for very long paragraphs (paragraphs > 200 words)
  const paragraphs = resumeText.split(/\n\n+/);
  const longParagraphs = paragraphs.filter(p => tokenize(p).length > 200);
  if (longParagraphs.length > 0) {
    score -= 10;
    issues.push('Very long paragraphs detected');
  }

  // Bonus for clean formatting
  const bulletPoints = (resumeText.match(/^[\s]*[-•*]/gm) || []).length;
  if (bulletPoints > 10) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. ACTION VERB SCORE (10%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate percentage of bullets with strong action verbs
 */
const calculateActionVerbScore = (resume) => {
  const allBullets = [];

  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (Array.isArray(exp.bullets)) {
        allBullets.push(...exp.bullets);
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (Array.isArray(proj.bullets)) {
        allBullets.push(...proj.bullets);
      }
    });
  }

  if (allBullets.length === 0) {
    return 0;
  }

  let bulletsWithVerbs = 0;

  allBullets.forEach(bullet => {
    const text = String(bullet).toLowerCase().trim();
    const firstWord = tokenize(text)[0] || '';
    
    if (STRONG_ACTION_VERBS.has(firstWord)) {
      bulletsWithVerbs++;
    }
  });

  return Math.round((bulletsWithVerbs / allBullets.length) * 100);
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. READABILITY SCORE (10%)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate readability based on bullet length and structure
 */
const calculateReadabilityScore = (resume) => {
  const allBullets = [];

  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (Array.isArray(exp.bullets)) {
        allBullets.push(...exp.bullets);
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (Array.isArray(proj.bullets)) {
        allBullets.push(...proj.bullets);
      }
    });
  }

  if (allBullets.length === 0) {
    return 50; // Default for resumes without bullets
  }

  let score = 100;
  let issueCount = 0;

  allBullets.forEach(bullet => {
    const text = String(bullet).trim();
    const wordCount = tokenize(text).length;

    // Deduct for bullets > 20 words
    if (wordCount > 20) {
      issueCount++;
    }
  });

  // Deduct points based on issues (max 50 point deduction)
  const issuePercentage = (issueCount / allBullets.length) * 100;
  score -= (issuePercentage / 2);

  return Math.max(0, Math.min(100, Math.round(score)));
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. SUGGESTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate improvement suggestions
 */
const generateSuggestions = (resume, jdKeywords, breakdown) => {
  const suggestions = [];

  // Always generate suggestions, even for high scores

  // 1. Missing keywords suggestions
  if (jdKeywords && jdKeywords.length > 0) {
    const keywordData = calculateKeywordMatch(resume, jdKeywords);
    if (keywordData.missingKeywords.length > 0) {
      const missingList = keywordData.missingKeywords.slice(0, 3).join(', ');
      suggestions.push({
        type: 'keywords',
        currentText: 'Resume lacks certain keywords',
        improvedText: `Add missing keywords: ${missingList}`,
        action: 'Apply Fix'
      });
    }
  }

  // 2. Weak summary suggestions
  const summary = (resume.summary || '').trim();
  if (summary.length < 100) {
    suggestions.push({
      type: 'summary',
      currentText: summary || '[No summary found]',
      improvedText: 'Write a comprehensive professional summary (80-150 words) highlighting key skills and achievements',
      action: 'Apply Fix'
    });
  }

  // 3. Bullets without metrics
  const allBullets = [];
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (Array.isArray(exp.bullets)) {
        allBullets.push(...exp.bullets);
      }
    });
  }

  allBullets.forEach((bullet, index) => {
    const text = String(bullet);
    const hasMetrics = /\d+%|\d+x|\$\d+|improved|reduced|increased|\.+\d+|%/i.test(text);
    
    if (!hasMetrics && text.length > 10) {
      suggestions.push({
        type: 'experience',
        currentText: text,
        improvedText: `${text.replace(/\.$/, '')}. Achieved measurable impact.`,
        action: 'Apply Fix'
      });

      // Limit suggestions to avoid overwhelming
      if (suggestions.length >= 5) return;
    }
  });

  // 4. Missing sections
  const requiredSections = ['summary', 'skills', 'experience', 'projects', 'education'];
  requiredSections.forEach(section => {
    if (!detectSection(resume, section)) {
      const sectionDisplay = section.charAt(0).toUpperCase() + section.slice(1);
      suggestions.push({
        type: section,
        currentText: `Missing ${sectionDisplay}`,
        improvedText: `Add a comprehensive ${sectionDisplay} section`,
        action: 'Apply Fix'
      });
    }
  });

  // 5. Weak bullets without strong action verbs
  allBullets.forEach((bullet, index) => {
    const text = String(bullet).toLowerCase().trim();
    const firstWord = tokenize(text)[0] || '';

    if (!STRONG_ACTION_VERBS.has(firstWord) && text.length > 10) {
      const improvedBullet = cleanAndImproveAction(text);
      if (improvedBullet !== text) {
        suggestions.push({
          type: 'action_verb',
          currentText: text,
          improvedText: improvedBullet,
          action: 'Apply Fix'
        });
      }

      if (suggestions.length >= 5) return;
    }
  });

  // 6. Grammar and clarity
  allBullets.forEach(bullet => {
    const text = String(bullet).trim();
    
    // Check for double punctuation
    if (text.includes('.,')) {
      suggestions.push({
        type: 'punctuation',
        currentText: text,
        improvedText: text.replace(/\.,/g, '.'),
        action: 'Apply Fix'
      });

      if (suggestions.length >= 5) return;
    }
  });

  // Ensure at least 2 suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'optimization',
      currentText: 'Resume is well-structured',
      improvedText: 'Consider adding quantified achievements and metrics to strengthen impact',
      action: 'Apply Fix'
    });
    suggestions.push({
      type: 'optimization',
      currentText: 'Keywords are well-matched',
      improvedText: 'Review job description for additional niche keywords to include',
      action: 'Apply Fix'
    });
  }

  return suggestions.slice(0, 8); // Return top 8 suggestions
};

/**
 * Improve weak action verbs in bullets
 */
const cleanAndImproveAction = (bullet) => {
  const weakVerbs = {
    'worked': 'Developed',
    'helped': 'Collaborated',
    'involved': 'Spearheaded',
    'handled': 'Managed',
    'used': 'Leveraged',
    'made': 'Created',
    'did': 'Delivered'
  };

  let improved = String(bullet);
  for (const [weak, strong] of Object.entries(weakVerbs)) {
    const regex = new RegExp(`^${weak}\\b`, 'i');
    if (regex.test(improved)) {
      improved = strong + improved.slice(weak.length);
      break;
    }
  }

  return improved.charAt(0).toUpperCase() + improved.slice(1);
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate complete ATS score
 */
const calculateATSScore = (resume, jdKeywords = []) => {
  // Extract JD keywords if provided
  const safeJDKeywords = Array.isArray(jdKeywords) 
    ? jdKeywords.map(kw => String(kw).trim()).filter(kw => kw.length > 0)
    : [];

  // Calculate component scores
  const keywordMatchData = calculateKeywordMatch(resume, safeJDKeywords);
  const completenessScore = calculateSectionCompleteness(resume);
  const formattingScore = calculateFormattingScore(resume);
  const actionVerbScore = calculateActionVerbScore(resume);
  const readabilityScore = calculateReadabilityScore(resume);

  // Apply weights according to assignment formula
  const atsScore = Math.round(
    (keywordMatchData.score * 0.40) +
    (completenessScore * 0.20) +
    (formattingScore * 0.20) +
    (actionVerbScore * 0.10) +
    (readabilityScore * 0.10)
  );

  // Clamp score to 0-100
  const finalScore = Math.max(0, Math.min(100, atsScore));

  const breakdown = {
    keywordMatchScore: keywordMatchData.score,
    sectionCompletenessScore: completenessScore,
    formattingScore: formattingScore,
    actionVerbScore: actionVerbScore,
    readabilityScore: readabilityScore
  };

  const suggestions = generateSuggestions(resume, safeJDKeywords, breakdown);

  return {
    score: finalScore,
    keywordMatchPercent: keywordMatchData.score,
    keywordMatchScore: keywordMatchData.score,
    completenessScore: completenessScore,
    sectionCompletenessScore: completenessScore,
    formattingScore: formattingScore,
    actionVerbScore: actionVerbScore,
    readabilityScore: readabilityScore,
    missingKeywords: keywordMatchData.missingKeywords,
    matchedKeywords: keywordMatchData.matchedKeywords,
    suggestions: suggestions,
    breakdown: breakdown
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  calculateATSScore,
  calculateKeywordMatch,
  calculateSectionCompleteness,
  calculateFormattingScore,
  calculateActionVerbScore,
  calculateReadabilityScore,
  generateSuggestions,
  buildResumeText,
  tokenize,
  normalizeText,
  extractKeywords,
  detectSection
};
