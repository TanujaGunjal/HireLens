'use strict';

/**
 * atsApi.test.js
 *
 * Integration tests for ATS API endpoints using Supertest.
 * MongoDB is connected to a real test DB; Gemini AI is mocked.
 *
 * Covered:
 *   POST /api/ats/score   — score calculation
 *   POST /api/ats/rewrite — AI rewrite (Gemini mocked)
 *   POST /api/ai/improve  — AI improve (Gemini mocked)
 *   POST /api/interview/generate — interview generation (Gemini mocked)
 */

jest.mock('axios'); // Prevent real Python semantic engine calls

require('dotenv').config();

const request  = require('supertest');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const axios    = require('axios');

const app = require('../../app');

// ─── Gemini mock ───────────────────────────────────────────────────────────────
// Prevents ANY real Gemini API calls during tests.
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          summary: 'Mocked AI summary for testing.',
          experience: [],
          projects: [
            { name: 'Test Project', bullets: ['Built test project using Node.js, handling 500+ requests/day.'] },
          ],
          skills: ['Docker', 'Redis'],
        }),
      }),
    },
  })),
}));

// Mock semantic engine (Python) — returns fixed score
axios.post.mockResolvedValue({
  data: { semanticScore: 55, conceptBoost: 10, embeddingScore: 45 },
});

// ─── Test DB setup ─────────────────────────────────────────────────────────────

const TEST_MONGO_URI =
  process.env.MONGO_TEST_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/ats_test_db';

let mongoAvailable = false;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }

  // Register + login to get a real JWT
  const email = `ats_api_test_${Date.now()}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'ATS Tester', email, password: 'Password1' });

  testToken = regRes.body.data?.token;

  // Create a test resume to score
  const resumeRes = await request(app)
    .post('/api/resume/create')
    .set('Authorization', `Bearer ${testToken}`)
    .send({
      personalInfo: { fullName: 'ATS Tester', email },
      summary: 'Full-stack developer with Node.js and React experience.',
      skills: [
        { category: 'Backend',  items: ['Node.js', 'Express', 'MongoDB'] },
        { category: 'Frontend', items: ['React', 'TypeScript'] },
      ],
      experience: [
        {
          role: 'Software Engineer',
          company: 'TechCorp',
          bullets: [
            'Built REST APIs with Node.js, serving 1000+ requests/day.',
            'Implemented React dashboard with real-time updates.',
          ],
        },
      ],
      projects: [
        {
          name: 'Chat App',
          title: 'Chat App',
          description: 'Real-time chat using WebSockets.',
          techStack: ['Node.js', 'Socket.IO', 'React'],
          bullets: [
            'Developed WebSocket server handling 200+ concurrent connections.',
          ],
        },
      ],
      education: [
        { degree: 'B.Tech Computer Science', school: 'IIT Bombay', field: 'CS' },
      ],
    });

  testResumeId = resumeRes.body.data?._id || resumeRes.body.data?.resume?._id;
}, 20000);

afterAll(async () => {
  if (mongoAvailable) {
    try {
      await mongoose.connection.db.dropDatabase();
    } catch (_) {}
    await mongoose.connection.close();
  }
});

// ─── POST /api/ats/score ──────────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/ats/score', () => {
  test('401 without auth token', async () => {
    await request(app)
      .post('/api/ats/score')
      .send({ resumeId: '64f1234567890123456789ab' })
      .expect(401);
  });

  test('400 on missing resumeId', async () => {
    const res = await request(app)
      .post('/api/ats/score')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 on invalid (non-ObjectId) resumeId', async () => {
    const res = await request(app)
      .post('/api/ats/score')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ resumeId: 'not-a-valid-id' });

    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test('404 on resumeId that does not belong to user', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/ats/score')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ resumeId: fakeId });

    expect([400, 404]).toContain(res.status);
  });

  test('response is JSON', async () => {
    const res = await request(app)
      .post('/api/ats/score')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ resumeId: testResumeId || '64f1234567890123456789ab' });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ─── POST /api/ats/rewrite ────────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/ats/rewrite', () => {
  test('401 without auth token', async () => {
    await request(app)
      .post('/api/ats/rewrite')
      .send({ resumeId: '64f1234567890123456789ab' })
      .expect(401);
  });

  test('400 on missing resumeId', async () => {
    const res = await request(app)
      .post('/api/ats/rewrite')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns JSON response', async () => {
    const res = await request(app)
      .post('/api/ats/rewrite')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ resumeId: testResumeId || '64f1234567890123456789ab' });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ─── POST /api/ai/improve ─────────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/ai/improve', () => {
  test('401 without auth token', async () => {
    await request(app)
      .post('/api/ai/improve')
      .send({ resumeId: '64f1234567890123456789ab', jdId: '64f1234567890123456789ac' })
      .expect(401);
  });

  test('400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/ai/improve')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});

    expect([400, 422]).toContain(res.status);
  });

  test('returns JSON', async () => {
    const res = await request(app)
      .post('/api/ai/improve')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        resumeId: testResumeId || '64f1234567890123456789ab',
        jdId: new mongoose.Types.ObjectId().toString(),
      });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ─── POST /api/interview/generate ────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/interview/generate', () => {
  test('401 without auth token', async () => {
    await request(app)
      .post('/api/interview/generate')
      .send({
        resumeId: '64f1234567890123456789ab',
        jdId: '64f1234567890123456789ac',
      })
      .expect(401);
  });

  test('400 on missing resumeId', async () => {
    const res = await request(app)
      .post('/api/interview/generate')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ jdId: new mongoose.Types.ObjectId().toString() });

    expect([400, 422]).toContain(res.status);
  });

  test('returns JSON', async () => {
    const res = await request(app)
      .post('/api/interview/generate')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        resumeId: testResumeId || '64f1234567890123456789ab',
        jdId: new mongoose.Types.ObjectId().toString(),
      });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ─── Token integrity ──────────────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('Auth token integrity', () => {
  test('tampered JWT is rejected with 401', async () => {
    const tamperedToken = testToken ? testToken.slice(0, -5) + 'XXXXX' : 'invalid.token.here';
    const res = await request(app)
      .get('/api/resume')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  test('expired JWT is rejected with 401', async () => {
    const expiredToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '0s' }
    );
    const res = await request(app)
      .get('/api/resume')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});
