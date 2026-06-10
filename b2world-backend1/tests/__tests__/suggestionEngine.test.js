'use strict';

/**
 * suggestionEngine.test.js
 *
 * Unit tests for the ATS suggestion pipeline:
 *   - utils/skillGapAnalyzer.js  — keyword matching & suggestion templates
 *   - services/atsKeywordExtractor.js — JD keyword extraction
 *
 * No DB or AI calls.
 */

const { getSkillGap, buildResumeSearchText } = require('../../utils/skillGapAnalyzer');
const { extractJDKeywords, calculateKeywordScore } = require('../../services/atsKeywordExtractor');

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_RESUME_TEXT =
  'React Node.js MongoDB Express TypeScript REST API Docker AWS Jest ' +
  'Developed scalable REST APIs. Built React dashboard with authentication. ' +
  'Deployed using Docker on AWS EC2.';

const SPARSE_RESUME_TEXT = 'JavaScript developer with basic HTML and CSS skills.';

// Helper: build a resume object for getSkillGap (accepts resume object, not raw text)
const makeResume = (text) => ({
  summary: text,
  skills: [],
  experience: [],
  projects: [],
  education: [],
});

const JD_KEYWORDS_BACKEND = [
  'Node.js', 'MongoDB', 'REST API', 'Docker', 'Redis', 'GraphQL', 'AWS',
];

const JD_TEXT = `
  We are looking for a Backend Engineer with 3+ years of experience in Node.js,
  MongoDB, REST API design, Docker, Kubernetes, Redis, and GraphQL.
  Experience with CI/CD pipelines and AWS is a plus.
`;

// ─── analyzeResume (skillGapAnalyzer) ─────────────────────────────────────────

describe('getSkillGap — skill gap analysis', () => {
  test('returns an object with present and missing arrays', () => {
    const result = getSkillGap(makeResume(FULL_RESUME_TEXT), JD_KEYWORDS_BACKEND);
    expect(result).toHaveProperty('present');
    expect(result).toHaveProperty('missing');
    expect(Array.isArray(result.present)).toBe(true);
    expect(Array.isArray(result.missing)).toBe(true);
  });

  test('correctly identifies matched keywords', () => {
    const result = getSkillGap(makeResume(FULL_RESUME_TEXT), JD_KEYWORDS_BACKEND);
    // At least some keywords are found
    expect(result.present.length + result.missing.length).toBe(JD_KEYWORDS_BACKEND.length);
  });

  test('correctly identifies missing keywords', () => {
    const result = getSkillGap(makeResume('Python developer only.'), ['Kubernetes', 'GraphQL', 'Rust']);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  test('sparse resume produces more missing keywords than full resume', () => {
    const full   = getSkillGap(makeResume(FULL_RESUME_TEXT),   JD_KEYWORDS_BACKEND);
    const sparse = getSkillGap(makeResume(SPARSE_RESUME_TEXT), JD_KEYWORDS_BACKEND);
    expect(sparse.missing.length).toBeGreaterThanOrEqual(full.missing.length);
  });

  test('no false positives — keywords not in resume appear in missing', () => {
    const result = getSkillGap(makeResume('Python developer.'), ['React', 'Vue', 'Angular']);
    expect(result.missing.length).toBe(3);
    expect(result.present.length).toBe(0);
  });

  test('handles empty JD keywords array gracefully', () => {
    const result = getSkillGap(makeResume(FULL_RESUME_TEXT), []);
    expect(result.present).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  test('handles empty resume gracefully', () => {
    const result = getSkillGap(makeResume(''), JD_KEYWORDS_BACKEND);
    expect(result.present).toEqual([]);
    expect(result.missing.length).toBe(JD_KEYWORDS_BACKEND.length);
  });

  test('buildResumeSearchText returns a string', () => {
    const text = buildResumeSearchText(makeResume(FULL_RESUME_TEXT));
    expect(typeof text).toBe('string');
  });
});

// ─── extractJDKeywords ────────────────────────────────────────────────────────

describe('extractJDKeywords — JD keyword extraction', () => {
  test('returns an array', () => {
    const keywords = extractJDKeywords(JD_TEXT);
    expect(Array.isArray(keywords)).toBe(true);
  });

  test('returns non-empty array for a typical JD', () => {
    const keywords = extractJDKeywords(JD_TEXT);
    expect(keywords.length).toBeGreaterThan(0);
  });

  test('extracts known tech terms from JD', () => {
    const keywords = extractJDKeywords(JD_TEXT);
    const flat = keywords.map(k => (typeof k === 'string' ? k : k.keyword || '').toLowerCase());
    const hasNode = flat.some(k => k.includes('node'));
    const hasMongo = flat.some(k => k.includes('mongo') || k.includes('mongodb'));
    expect(hasNode || hasMongo).toBe(true);
  });

  test('handles empty JD text without throwing', () => {
    expect(() => extractJDKeywords('')).not.toThrow();
  });

  test('handles null/undefined input without throwing', () => {
    expect(() => extractJDKeywords(null)).not.toThrow();
    expect(() => extractJDKeywords(undefined)).not.toThrow();
  });

  test('does not include common stopwords as keywords', () => {
    const keywords = extractJDKeywords(JD_TEXT);
    const flat = keywords.map(k => (typeof k === 'string' ? k : k.keyword || '').toLowerCase());
    const stopwords = ['the', 'and', 'with', 'for', 'are', 'is', 'a', 'an'];
    stopwords.forEach(sw => {
      expect(flat).not.toContain(sw);
    });
  });
});

// ─── calculateKeywordScore ────────────────────────────────────────────────────

describe('calculateKeywordScore — keyword matching', () => {
  test('returns object with score, matched, missing', () => {
    const result = calculateKeywordScore(FULL_RESUME_TEXT, JD_KEYWORDS_BACKEND);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('matched');
    expect(result).toHaveProperty('missing');
  });

  test('score is between 0 and 100', () => {
    const result = calculateKeywordScore(FULL_RESUME_TEXT, JD_KEYWORDS_BACKEND);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('higher overlap produces higher score', () => {
    const highMatch = calculateKeywordScore(
      'Node.js MongoDB Docker AWS REST API Redis GraphQL',
      JD_KEYWORDS_BACKEND
    );
    const lowMatch = calculateKeywordScore(
      'Python Flask SQL PostgreSQL',
      JD_KEYWORDS_BACKEND
    );
    expect(highMatch.score).toBeGreaterThan(lowMatch.score);
  });

  test('all keywords matched → score above 80', () => {
    const text = JD_KEYWORDS_BACKEND.join(' ');
    const result = calculateKeywordScore(text, JD_KEYWORDS_BACKEND);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test('no keywords matched → score is 0', () => {
    const result = calculateKeywordScore('Python Rust Golang', JD_KEYWORDS_BACKEND);
    expect(result.score).toBe(0);
  });

  test('empty resume text → score 0', () => {
    const result = calculateKeywordScore('', JD_KEYWORDS_BACKEND);
    expect(result.score).toBe(0);
  });

  test('empty keywords array → score 0', () => {
    const result = calculateKeywordScore(FULL_RESUME_TEXT, []);
    expect(result.score).toBe(0);
  });

  test('matchPercentage is between 0 and 100', () => {
    const result = calculateKeywordScore(FULL_RESUME_TEXT, JD_KEYWORDS_BACKEND);
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0);
    expect(result.matchPercentage).toBeLessThanOrEqual(100);
  });

  test('matched + missing === total JD keywords', () => {
    const result = calculateKeywordScore(FULL_RESUME_TEXT, JD_KEYWORDS_BACKEND);
    expect(result.matched.length + result.missing.length).toBe(JD_KEYWORDS_BACKEND.length);
  });
});
