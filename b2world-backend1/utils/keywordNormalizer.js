'use strict';

/**
 * Keyword Normalization Utility
 * Ensures deterministic, case-insensitive keyword matching
 */

const normalizeText = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (text = '') => {
  return normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length > 0);
};

/**
 * Check if keyword exists in text using multiple strategies
 * Returns true/false deterministically
 */
const matchKeyword = (resumeText, keyword) => {
  if (!resumeText || !keyword) return false;

  const normText = normalizeText(resumeText);
  const normKw = normalizeText(keyword);

  // Strategy 1: Exact substring match
  if (normText.includes(normKw)) return true;

  // Strategy 2: All tokens in keyword present in text
  const kwTokens = tokenize(keyword);
  if (kwTokens.length > 1) {
    const allPresent = kwTokens.every(t => normText.includes(t));
    if (allPresent) return true;
  }

  // Strategy 3: Stem match for single-word keywords (length >= 5)
  if (kwTokens.length === 1 && kwTokens[0].length >= 5) {
    const stem = kwTokens[0].replace(/(ing|tion|ment|al|ed|s|ly)$/, '');
    if (stem.length >= 4) {
      const textTokens = tokenize(resumeText);
      if (textTokens.some(t => {
        const tStem = t.replace(/(ing|tion|ment|al|ed|s|ly)$/, '');
        return tStem === stem;
      })) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Extract all keywords from resume text
 * Returns array of detected keywords
 */
const extractResumeKeywords = (resume) => {
  const keywords = new Set();

  // Skills
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(skillGroup => {
      if (Array.isArray(skillGroup.items)) {
        skillGroup.items.forEach(item => {
          if (item) {
            String(item).split(/[,•|/]/).forEach(s => {
              const normalized = normalizeText(s);
              if (normalized) keywords.add(normalized);
            });
          }
        });
      }
    });
  }

  // Experience descriptions
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (exp.company) keywords.add(normalizeText(exp.company));
      if (exp.position) keywords.add(normalizeText(exp.position));
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach(bullet => {
          if (bullet) {
            tokenize(bullet).forEach(token => {
              if (token.length >= 4) keywords.add(token);
            });
          }
        });
      }
    });
  }

  // Projects
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (proj.name) keywords.add(normalizeText(proj.name));
      if (Array.isArray(proj.techStack)) {
        proj.techStack.forEach(tech => {
          if (tech) keywords.add(normalizeText(tech));
        });
      }
      if (Array.isArray(proj.bullets)) {
        proj.bullets.forEach(bullet => {
          if (bullet) {
            tokenize(bullet).forEach(token => {
              if (token.length >= 4) keywords.add(token);
            });
          }
        });
      }
    });
  }

  return Array.from(keywords);
};

module.exports = {
  normalizeText,
  tokenize,
  matchKeyword,
  extractResumeKeywords,
};
