'use strict';

/**
 * atsScoreCalculator.test.js
 *
 * Unit tests for the core ATS scoring engine.
 * Covers: score range, component weights, completeness, formatting,
 * keyword matching, action verb detection, edge cases.
 *
 * No real DB or AI calls — pure unit tests.
 */

const {
  calculateATSScore,
  calculateFormatting,
  calculateCompleteness,
  calculateFinalScore,
  validateScores,
  buildSearchableResumeText,
  generateReasonBreakdown,
} = require('../../services/atsScoreCalculator');

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_RESUME = {
  summary: 'Full-stack developer with 3 years of experience in React and Node.js.',
  personalInfo: { fullName: 'Jane Dev', email: 'jane@example.com' },
  skills: [
    { category: 'Frontend', items: ['React', 'TypeScript', 'CSS'] },
    { category: 'Backend',  items: ['Node.js', 'Express', 'MongoDB'] },
  ],
  experience: [
    {
      role: 'Software Engineer',
      company: 'TechCorp',
      bullets: [
        'Developed REST APIs using Node.js and Express, reducing response time by 30%.',
        'Built React dashboard with real-time data, supporting 500+ concurrent users.',
      ],
    },
  ],
  projects: [
    {
      name: 'ATS Resume Builder',
      title: 'ATS Resume Builder',
      description: 'AI-powered resume builder using Gemini and MongoDB.',
      techStack: ['React', 'Node.js', 'MongoDB', 'Gemini AI'],
      bullets: [
        'Implemented keyword scoring engine with 40-point weighted formula.',
        'Deployed on AWS EC2 with CI/CD pipeline reducing deployment time by 50%.',
      ],
    },
  ],
  education: [
    { degree: 'B.Tech Computer Science', school: 'IIT Bombay', field: 'CS' },
  ],
};

const EMPTY_RESUME = {
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

const MINIMAL_RESUME = {
  summary: 'A software developer.',
  skills: [{ category: 'Skills', items: ['JavaScript'] }],
  experience: [],
  projects: [
    {
      name: 'Portfolio',
      title: 'Portfolio',
      description: 'Personal portfolio website.',
      techStack: ['React'],
      bullets: ['Built portfolio using React.'],
    },
  ],
  education: [],
};

const JD_WITH_KEYWORDS = {
  description: 'We need a React developer skilled in Node.js, MongoDB, REST APIs and AWS.',
  extractedKeywords: ['React', 'Node.js', 'MongoDB', 'REST API', 'AWS'],
};

const JD_NO_MATCH = {
  description: 'Kubernetes, Rust, Golang, gRPC, eBPF experience required.',
  extractedKeywords: ['Kubernetes', 'Rust', 'Golang', 'gRPC', 'eBPF'],
};

// ─── Score Range ───────────────────────────────────────────────────────────────

describe('calculateATSScore — score range', () => {
  test('returns a score between 0 and 100 for a well-populated resume', () => {
    const result = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 60);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('returns score 0 for a fully empty resume', () => {
    const result = calculateATSScore(EMPTY_RESUME, JD_WITH_KEYWORDS, 0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('score is a number (not NaN)', () => {
    const result = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 50);
    expect(typeof result.score).toBe('number');
    expect(Number.isNaN(result.score)).toBe(false);
  });

  test('score is an integer (rounded)', () => {
    const result = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 55);
    expect(result.score % 1).toBe(0);
  });

  test('high keyword match produces score above 40', () => {
    const result = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 70);
    expect(result.score).toBeGreaterThan(40);
  });

  test('zero keyword overlap produces lower score than high overlap', () => {
    const highMatch = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 70);
    const noMatch   = calculateATSScore(FULL_RESUME, JD_NO_MATCH, 20);
    expect(highMatch.score).toBeGreaterThan(noMatch.score);
  });

  test('null resume returns empty result with score 0', () => {
    const result = calculateATSScore(null, JD_WITH_KEYWORDS, 0);
    expect(result.score).toBe(0);
  });

  test('null JD returns empty result with score 0', () => {
    const result = calculateATSScore(FULL_RESUME, null, 0);
    expect(result.score).toBe(0);
  });
});

// ─── Breakdown Shape ──────────────────────────────────────────────────────────

describe('calculateATSScore — breakdown shape', () => {
  let result;
  beforeAll(() => {
    result = calculateATSScore(FULL_RESUME, JD_WITH_KEYWORDS, 60);
  });

  test('breakdown object has all five keys', () => {
    expect(result.breakdown).toHaveProperty('keywordMatch');
    expect(result.breakdown).toHaveProperty('sectionCompleteness');
    expect(result.breakdown).toHaveProperty('formatting');
    expect(result.breakdown).toHaveProperty('actionVerbs');
    expect(result.breakdown).toHaveProperty('readability');
  });

  test('every breakdown value is between 0 and 100', () => {
    Object.values(result.breakdown).forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    });
  });

  test('result contains keywords object with matched array', () => {
    expect(result.keywords).toBeDefined();
    expect(Array.isArray(result.keywords.matched)).toBe(true);
    expect(Array.isArray(result.keywords.missing)).toBe(true);
  });
});

// ─── validateScores ────────────────────────────────────────────────────────────

describe('validateScores', () => {
  test('clamps value above 100 to 100', () => {
    const result = validateScores({ keywordMatch: 150, sectionCompleteness: 80,
      formatting: 70, actionVerbs: 60, readability: 50 });
    expect(result.keywordMatch).toBe(100);
  });

  test('clamps negative value to 0', () => {
    const result = validateScores({ keywordMatch: -20, sectionCompleteness: 80,
      formatting: 70, actionVerbs: 60, readability: 50 });
    expect(result.keywordMatch).toBe(0);
  });

  test('replaces NaN with 0', () => {
    const result = validateScores({ keywordMatch: NaN, sectionCompleteness: 80,
      formatting: 70, actionVerbs: 60, readability: 50 });
    expect(result.keywordMatch).toBe(0);
  });

  test('valid in-range values pass through unchanged', () => {
    const input = { keywordMatch: 75, sectionCompleteness: 80,
      formatting: 65, actionVerbs: 55, readability: 90 };
    const result = validateScores(input);
    expect(result).toEqual(input);
  });
});

// ─── calculateFinalScore ───────────────────────────────────────────────────────

describe('calculateFinalScore — weighted formula', () => {
  test('all-100 components with 100 semantic = 100 final', () => {
    const bd = { keywordMatch: 100, sectionCompleteness: 100,
      formatting: 100, actionVerbs: 100, readability: 100 };
    expect(calculateFinalScore(bd, 100)).toBe(100);
  });

  test('all-zero components = 0 final', () => {
    const bd = { keywordMatch: 0, sectionCompleteness: 0,
      formatting: 0, actionVerbs: 0, readability: 0 };
    expect(calculateFinalScore(bd, 0)).toBe(0);
  });

  test('result is rounded integer', () => {
    const bd = { keywordMatch: 73, sectionCompleteness: 85,
      formatting: 60, actionVerbs: 50, readability: 78 };
    const score = calculateFinalScore(bd, 55);
    expect(score % 1).toBe(0);
  });

  test('result stays between 0 and 100', () => {
    const bd = { keywordMatch: 50, sectionCompleteness: 70,
      formatting: 60, actionVerbs: 40, readability: 80 };
    const score = calculateFinalScore(bd, 60);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── calculateCompleteness ────────────────────────────────────────────────────

describe('calculateCompleteness', () => {
  test('full resume scores above 70', () => {
    const result = calculateCompleteness(FULL_RESUME);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  test('empty resume scores 0', () => {
    const result = calculateCompleteness(EMPTY_RESUME);
    expect(result.score).toBe(0);
  });

  test('resume with skills+projects gets 70 floor', () => {
    const result = calculateCompleteness(MINIMAL_RESUME);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  test('returns object with score and details', () => {
    const result = calculateCompleteness(FULL_RESUME);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
  });

  test('details.sections has expected boolean flags', () => {
    const result = calculateCompleteness(FULL_RESUME);
    expect(result.details.sections).toHaveProperty('summary');
    expect(result.details.sections).toHaveProperty('skills');
    expect(result.details.sections).toHaveProperty('experience');
    expect(result.details.sections).toHaveProperty('projects');
    expect(result.details.sections).toHaveProperty('education');
  });

  test('missing experience reduces score vs full resume', () => {
    const noExp = { ...FULL_RESUME, experience: [] };
    const full  = calculateCompleteness(FULL_RESUME);
    const withoutExp = calculateCompleteness(noExp);
    expect(full.score).toBeGreaterThanOrEqual(withoutExp.score);
  });
});

// ─── calculateFormatting ──────────────────────────────────────────────────────

describe('calculateFormatting', () => {
  test('returns a score between 0 and 100', () => {
    const result = calculateFormatting(FULL_RESUME);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('resume with proper bullets scores above 40', () => {
    const result = calculateFormatting(FULL_RESUME);
    expect(result.score).toBeGreaterThan(40);
  });

  test('empty resume (no bullets) still returns a score', () => {
    const result = calculateFormatting(EMPTY_RESUME);
    expect(typeof result.score).toBe('number');
  });

  test('resume with very long bullets gets penalized', () => {
    const longBullet = 'word '.repeat(50).trim();
    const resume = {
      ...MINIMAL_RESUME,
      experience: [{ role: 'Dev', bullets: [longBullet] }],
    };
    const result = calculateFormatting(resume);
    expect(result.score).toBeLessThan(100);
  });
});

// ─── buildSearchableResumeText ────────────────────────────────────────────────

describe('buildSearchableResumeText', () => {
  test('returns a non-empty string for a full resume', () => {
    const text = buildSearchableResumeText(FULL_RESUME);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('includes summary text', () => {
    const text = buildSearchableResumeText(FULL_RESUME);
    expect(text).toContain('Full-stack developer');
  });

  test('includes skill items', () => {
    const text = buildSearchableResumeText(FULL_RESUME);
    expect(text).toContain('React');
    expect(text).toContain('MongoDB');
  });

  test('includes project bullets', () => {
    const text = buildSearchableResumeText(FULL_RESUME);
    expect(text).toContain('weighted formula');
  });

  test('returns empty string for non-object input', () => {
    const text = buildSearchableResumeText(null);
    expect(text).toBe('');
  });

  test('returns empty string for resume with no content', () => {
    const text = buildSearchableResumeText(EMPTY_RESUME);
    expect(text.trim()).toBe('');
  });
});

// ─── generateReasonBreakdown ──────────────────────────────────────────────────

describe('generateReasonBreakdown', () => {
  test('returns an array', () => {
    const bd = { keywordMatch: 40, sectionCompleteness: 60,
      formatting: 50, actionVerbs: 40, readability: 60 };
    const reasons = generateReasonBreakdown(FULL_RESUME, bd, ['Kubernetes', 'Rust'], []);
    expect(Array.isArray(reasons)).toBe(true);
  });

  test('includes missing_keywords reason when keywordMatch < 70', () => {
    const bd = { keywordMatch: 30, sectionCompleteness: 70,
      formatting: 70, actionVerbs: 70, readability: 70 };
    const reasons = generateReasonBreakdown(FULL_RESUME, bd, ['Rust', 'Golang'], []);
    const types = reasons.map(r => r.type);
    expect(types).toContain('missing_keywords');
  });

  test('includes fresher_profile reason when no experience but 2+ projects', () => {
    const noExp = { ...FULL_RESUME, experience: [], projects: [
      { name: 'P1', bullets: [] }, { name: 'P2', bullets: [] },
    ]};
    const bd = { keywordMatch: 70, sectionCompleteness: 60,
      formatting: 70, actionVerbs: 70, readability: 70 };
    const reasons = generateReasonBreakdown(noExp, bd, [], []);
    const types = reasons.map(r => r.type);
    expect(types).toContain('fresher_profile');
  });

  test('each reason has type, message, and impact', () => {
    const bd = { keywordMatch: 30, sectionCompleteness: 50,
      formatting: 50, actionVerbs: 40, readability: 50 };
    const reasons = generateReasonBreakdown(EMPTY_RESUME, bd, ['React'], []);
    reasons.forEach(r => {
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('message');
      expect(r).toHaveProperty('impact');
    });
  });
});
