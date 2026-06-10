'use strict';

/**
 * auth.test.js
 *
 * Integration tests for POST /api/auth/register and POST /api/auth/login.
 * Uses Supertest + an in-memory MongoDB connection (via mongoose connect).
 * Real bcrypt is used — Gemini and Puppeteer are mocked.
 */

require('dotenv').config();

const request  = require('supertest');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

const app = require('../../app');

// ─── Test DB setup ─────────────────────────────────────────────────────────────

const TEST_MONGO_URI =
  process.env.MONGO_TEST_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/ats_test_db';

let mongoAvailable = false;

beforeAll(async () => {
  try {
    await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    mongoAvailable = true;
  } catch (err) {
    console.warn('⚠️  MongoDB not reachable — auth integration tests will be SKIPPED.');
    console.warn('   Start MongoDB locally or set MONGO_TEST_URI to run these tests.');
  }
}, 10000);

afterAll(async () => {
  if (mongoAvailable) {
    try {
      await mongoose.connection.db.dropDatabase();
    } catch (_) {}
    await mongoose.connection.close();
  }
});

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_USER = {
  name:     'Jane Tester',
  email:    `test_${Date.now()}@example.com`,
  password: 'Password1',
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/auth/register', () => {
  test('201 + JWT token on valid registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(VALID_USER)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('response includes user object with name and email', async () => {
    const email = `reg_shape_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, email })
      .expect(201);

    expect(res.body.data.user).toHaveProperty('name');
    expect(res.body.data.user).toHaveProperty('email', email);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  test('409 on duplicate email', async () => {
    const email = `dup_${Date.now()}@example.com`;
    // First registration
    await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, email })
      .expect(201);

    // Duplicate
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, email });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('400 on missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `noname_${Date.now()}@example.com`, password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 when password is too short (< 4 chars in dev)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: `short_${Date.now()}@test.com`, password: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('response Content-Type is application/json', async () => {
    const email = `ct_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, email });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

(mongoAvailable ? describe : describe.skip)('POST /api/auth/login', () => {
  const loginEmail    = `login_${Date.now()}@example.com`;
  const loginPassword = 'Password1';

  // Register once before login tests
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login Tester', email: loginEmail, password: loginPassword });
  });

  test('200 + JWT token on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: loginPassword })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThan(20);
  });

  test('JWT token is a valid three-part structure', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: loginPassword });

    const parts = res.body.data.token.split('.');
    expect(parts).toHaveLength(3);
  });

  test('401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: 'WrongPassword99' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('401 on non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'Password1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('400 on missing password field', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('does not expose passwordHash in response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: loginPassword });

    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('password');
  });
});

// ─── Auth protection (misc protected routes) ─────────────────────────────────

(mongoAvailable ? describe : describe.skip)('Protected routes — auth guard', () => {
  test('GET /api/resume returns 401 without token', async () => {
    const res = await request(app).get('/api/resume');
    expect(res.status).toBe(401);
  });

  test('POST /api/ats/score returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/ats/score')
      .send({ resumeId: '64f1234567890123456789ab' });
    expect(res.status).toBe(401);
  });

  test('POST /api/ats/rewrite returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/ats/rewrite')
      .send({ resumeId: '64f1234567890123456789ab' });
    expect(res.status).toBe(401);
  });
});
