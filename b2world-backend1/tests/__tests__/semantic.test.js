'use strict';

/**
 * semantic.test.js
 *
 * Unit tests for semantic.service.js
 * Tests: concept boost fallback, token handling, score bounds.
 * The Python engine (localhost:8000) is MOCKED — no real HTTP calls.
 */

jest.mock('axios');
const axios = require('axios');
const semanticService = require('../../services/semantic.service');

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const BACKEND_RESUME = {
  summary: 'Backend developer experienced in REST APIs, Node.js, and MongoDB.',
  skills: [
    { category: 'Backend', items: ['Node.js', 'Express', 'MongoDB', 'Redis'] },
    { category: 'Cloud',   items: ['Docker', 'AWS'] },
  ],
  experience: [
    {
      role: 'Backend Developer',
      company: 'TechCorp',
      bullets: [
        'Designed and implemented microservices architecture using Node.js.',
        'Managed distributed systems with Redis for caching and session management.',
      ],
    },
  ],
  projects: [
    {
      name: 'Chat System',
      description: 'Real-time chat using WebSockets and Redis pub/sub.',
      techStack: ['Node.js', 'Redis', 'WebSocket'],
      bullets: ['Built chat with 200+ concurrent users via WebSocket.'],
    },
  ],
};

const JD_TEXT_BACKEND = `
  Senior Backend Engineer — 3+ years Node.js, microservices, REST API design,
  Redis caching, Docker containerization, and distributed systems experience.
`;

// ─── Python engine ONLINE (axios resolves) ────────────────────────────────────

describe('semanticService — Python engine online', () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({
      data: { semanticScore: 78, conceptBoost: 20, embeddingScore: 58 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns a numeric score', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(typeof score).toBe('number');
  });

  test('returns the Python engine score when available', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(score).toBe(78);
  });

  test('score is between 0 and 100', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('calls axios.post exactly once per invocation', async () => {
    await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('sends section payloads to the correct endpoint', async () => {
    await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toContain('/semantic-score');
    expect(body).toHaveProperty('skills');
    expect(body).toHaveProperty('experience');
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('jdText');
  });
});

// ─── Python engine OFFLINE (axios rejects → JS fallback) ─────────────────────

describe('semanticService — fallback when Python engine is down', () => {
  beforeEach(() => {
    axios.post.mockRejectedValue(new Error('ECONNREFUSED connect ECONNREFUSED 127.0.0.1:8000'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('does NOT throw — always returns a score', async () => {
    await expect(
      semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND)
    ).resolves.toBeDefined();
  });

  test('fallback score is numeric', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(typeof score).toBe('number');
    expect(Number.isNaN(score)).toBe(false);
  });

  test('fallback score is between 0 and 100', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('empty resume returns 0 in fallback', async () => {
    const emptyResume = { summary: '', skills: [], experience: [], projects: [] };
    const score = await semanticService.getSemanticScore(emptyResume, JD_TEXT_BACKEND);
    expect(score).toBe(0);
  });

  test('backend-aligned resume scores above base floor (35) in fallback', async () => {
    const score = await semanticService.getSemanticScore(BACKEND_RESUME, JD_TEXT_BACKEND);
    expect(score).toBeGreaterThanOrEqual(35);
  });
});

// ─── Skill matching ───────────────────────────────────────────────────────────

describe('semanticService — getSkillSemanticMatches', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns empty array for empty inputs', async () => {
    axios.post.mockResolvedValue({ data: { semanticMatches: [] } });
    const matches = await semanticService.getSkillSemanticMatches([], []);
    expect(matches).toEqual([]);
  });

  test('returns matched array when Python engine responds', async () => {
    axios.post.mockResolvedValue({
      data: {
        semanticMatches: [
          { jdSkill: 'NodeJS', matchedWith: 'Node.js', confidence: 0.92 },
        ],
      },
    });
    const matches = await semanticService.getSkillSemanticMatches(
      ['Node.js', 'Redis'], ['NodeJS', 'Caching']
    );
    expect(Array.isArray(matches)).toBe(true);
  });

  test('falls back to substring matching when Python is down', async () => {
    axios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    const matches = await semanticService.getSkillSemanticMatches(
      ['Node.js', 'MongoDB'], ['node', 'mongo']
    );
    expect(Array.isArray(matches)).toBe(true);
  });
});

// ─── computeConceptBoost ──────────────────────────────────────────────────────

describe('semanticService.computeConceptBoost', () => {
  test('returns a number', () => {
    const boost = semanticService.computeConceptBoost(
      'kafka redis docker kubernetes microservices',
      'kafka redis distributed systems'
    );
    expect(typeof boost).toBe('number');
  });

  test('returns 0 for empty strings', () => {
    const boost = semanticService.computeConceptBoost('', '');
    expect(boost).toBe(0);
  });

  test('strong domain alignment produces boost > 0', () => {
    const resumeText = 'kafka rabbitmq redis pub/sub event streaming docker kubernetes';
    const jdText     = 'kafka message queue redis distributed';
    const boost = semanticService.computeConceptBoost(resumeText, jdText);
    expect(boost).toBeGreaterThan(0);
  });

  test('result is capped at 30', () => {
    const resumeText = 'kafka rabbitmq redis docker kubernetes react angular postgresql mongodb graphql jwt oauth aws gcp';
    const jdText     = 'kafka redis docker react postgresql jwt aws';
    const boost = semanticService.computeConceptBoost(resumeText, jdText);
    expect(boost).toBeLessThanOrEqual(30);
  });
});
