/**
 * ================================================================================
 * KEYWORD NORMALIZATION UTILITY - PRODUCTION GRADE
 * ================================================================================
 * Ensures consistent keyword matching across resume and JD
 * ================================================================================
 */

/**
 * Normalize keyword for matching
 * Lowercase, remove punctuation, trim spaces
 */
const normalizeKeyword = (keyword) => {
  if (!keyword) return '';
  return String(keyword)
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

/**
 * Extract and normalize all keywords from text
 */
const extractKeywordsFromText = (text = '') => {
  if (!text) return new Set();
  
  const keywords = String(text)
    .toLowerCase()
    .split(/[\s,;.!?()[\]{}]+/)
    .filter(kw => kw.length > 2) // Only meaningful keywords
    .map(kw => normalizeKeyword(kw))
    .filter(kw => kw);

  return new Set(keywords);
};

/**
 * Normalize array of keywords
 */
const normalizeKeywordArray = (keywords = []) => {
  if (!Array.isArray(keywords)) return new Set();
  
  return new Set(
    keywords
      .filter(k => k)
      .map(k => normalizeKeyword(k))
  );
};

/**
 * Check if keyword exists in resume (normalized)
 * ✅ FIXED: With debug logging
 */
const keywordExistsInResume = (resume, keyword) => {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return false;

  const resumeText = buildResumeTextForKeywordMatching(resume);
  const normalizedResume = normalizeKeyword(resumeText);

  // Check as whole word or partial match
  return normalizedResume.includes(normalized);
};

/**
 * Build complete resume text for keyword matching
 * ✅ FIXED: Handles all possible resume structures
 */
const buildResumeTextForKeywordMatching = (resume) => {
  if (!resume) return '';

  const parts = [];

  // Summary
  if (resume.summary) {
    parts.push(String(resume.summary));
  }

  // Skills - HANDLE BOTH FORMATS
  if (resume.skills && Array.isArray(resume.skills)) {
    resume.skills.forEach(skill => {
      // Format 1: object with items array
      if (skill && typeof skill === 'object' && Array.isArray(skill.items)) {
        parts.push(...skill.items.map(item => String(item)));
      }
      // Format 2: string directly
      else if (typeof skill === 'string') {
        parts.push(skill);
      }
    });
  }

  // Experience
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.bullets && Array.isArray(exp.bullets)) {
        parts.push(...exp.bullets.map(b => String(b)));
      }
      if (exp.role) parts.push(String(exp.role));
      if (exp.company) parts.push(String(exp.company));
    });
  }

  // Projects
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.title) parts.push(String(proj.title));
      if (proj.bullets && Array.isArray(proj.bullets)) {
        parts.push(...proj.bullets.map(b => String(b)));
      }
      if (proj.techStack && Array.isArray(proj.techStack)) {
        parts.push(...proj.techStack.map(t => String(t)));
      }
    });
  }

  // Education
  if (resume.education && Array.isArray(resume.education)) {
    resume.education.forEach(edu => {
      if (edu.degree) parts.push(String(edu.degree));
      if (edu.field) parts.push(String(edu.field));
      if (edu.institution) parts.push(String(edu.institution));
    });
  }

  return parts.filter(p => p && String(p).trim()).join(' ');
};

/**
 * Get missing keywords from JD that are not in resume
 * ✅ FIXED: With detailed logging
 */
const getMissingKeywords = (resume, jdKeywords) => {
  if (!jdKeywords || !Array.isArray(jdKeywords)) {
    console.log('[getMissingKeywords] No JD keywords provided');
    return [];
  }

  console.log(`[getMissingKeywords] Checking ${jdKeywords.length} JD keywords against resume`);

  const normalizedJDKeywords = normalizeKeywordArray(jdKeywords);
  const missing = [];

  normalizedJDKeywords.forEach(keyword => {
    if (!keywordExistsInResume(resume, keyword)) {
      missing.push(keyword);
    }
  });

  console.log(`[getMissingKeywords] Result: ${missing.length}/${normalizedJDKeywords.size} missing`);
  return missing;
};

/**
 * Calculate keyword match percentage
 * ✅ FIXED: With detailed logging for debugging
 */
const calculateKeywordMatchPercentage = (resume, jdKeywords) => {
  if (!jdKeywords || jdKeywords.length === 0) {
    console.log('[calculateKeywordMatchPercentage] No JD keywords, returning 100%');
    return 100;
  }

  console.log(`[calculateKeywordMatchPercentage] START: Matching ${jdKeywords.length} keywords`);

  const normalizedJDKeywords = normalizeKeywordArray(jdKeywords);
  const resumeText = buildResumeTextForKeywordMatching(resume);

  console.log(`[calculateKeywordMatchPercentage] Resume text length: ${resumeText.length} chars`);
  console.log(`[calculateKeywordMatchPercentage] JD keywords (first 5): ${Array.from(normalizedJDKeywords).slice(0, 5).join(', ')}`);

  let matches = 0;
  const matched = [];
  const notMatched = [];

  normalizedJDKeywords.forEach(keyword => {
    if (keywordExistsInResume(resume, keyword)) {
      matches++;
      matched.push(keyword);
    } else {
      notMatched.push(keyword);
    }
  });

  const percentage = Math.round((matches / normalizedJDKeywords.size) * 100);

  console.log(`[calculateKeywordMatchPercentage] RESULT: ${matches}/${normalizedJDKeywords.size} matched = ${percentage}%`);
  if (matched.length > 0) {
    console.log(`[calculateKeywordMatchPercentage] Matched samples: ${matched.slice(0, 5).join(', ')}`);
  }
  if (notMatched.length > 0) {
    console.log(`[calculateKeywordMatchPercentage] Not matched samples: ${notMatched.slice(0, 5).join(', ')}`);
  }

  return percentage;
};

module.exports = {
  normalizeKeyword,
  extractKeywordsFromText,
  normalizeKeywordArray,
  keywordExistsInResume,
  buildResumeTextForKeywordMatching,
  getMissingKeywords,
  calculateKeywordMatchPercentage,
};
