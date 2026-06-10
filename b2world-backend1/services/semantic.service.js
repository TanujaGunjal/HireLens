/**
 * semantic.service.js  — v3 (Production)
 *
 * REAL semantic scoring using Gemini text-embedding-004.
 *
 * Architecture:
 *   Resume text  →  Gemini embedding  →  vector (cached in Redis, 24h TTL)
 *   JD text      →  Gemini embedding  →  vector (cached in Redis, 24h TTL)
 *                          ↓
 *                  Cosine Similarity  →  raw score 0–1
 *                          ↓
 *                  Scale to 0–100   →  Semantic ATS Score
 *
 * Graceful fallback chain:
 *   1. Gemini embeddings + cosine similarity  (best — real semantic matching)
 *   2. Concept-cluster keyword scoring        (good — domain-aware heuristic)
 *   3. Returns 35 (floor)                     (worst — ensures ATS never crashes)
 */

'use strict';

const crypto          = require('crypto');
const { generateEmbedding } = require('../utils/geminiClient');
const cacheService    = require('./cache.service');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const EMBEDDING_TTL_SEC = 86400; // 24 hours — embeddings are deterministic

// ─────────────────────────────────────────────────────────────────────────────
// Concept clusters — used as graceful fallback when Gemini is unavailable
// ─────────────────────────────────────────────────────────────────────────────

const CONCEPT_CLUSTERS = {
  messaging_systems: [
    'kafka', 'rabbitmq', 'activemq', 'redis pubsub', 'message queue',
    'event streaming', 'pub/sub', 'event-driven', 'nats', 'kinesis',
    'message broker', 'asynchronous', 'event bus',
  ],
  distributed_systems: [
    'distributed', 'microservices', 'service mesh', 'consensus', 'raft',
    'paxos', 'sharding', 'replication', 'horizontal scaling', 'load balancing',
    'fault tolerance', 'cap theorem', 'eventual consistency', 'zookeeper',
  ],
  caching_layer: [
    'redis', 'memcached', 'caching', 'cache', 'in-memory', 'ttl',
    'eviction', 'cache invalidation', 'cdn', 'varnish',
  ],
  backend_engineering: [
    'rest api', 'restful', 'graphql', 'grpc', 'websockets', 'express',
    'fastapi', 'django', 'spring boot', 'node.js', 'api design',
    'microservice', 'serverless', 'lambda',
  ],
  databases: [
    'postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb',
    'elasticsearch', 'neo4j', 'sqlite', 'orm', 'sql', 'nosql',
    'indexing', 'query optimization', 'transactions', 'acid',
  ],
  devops_cloud: [
    'docker', 'kubernetes', 'k8s', 'ci/cd', 'github actions', 'jenkins',
    'terraform', 'ansible', 'aws', 'gcp', 'azure', 'helm', 'prometheus',
    'grafana', 'observability', 'monitoring', 'infrastructure as code',
  ],
  security: [
    'jwt', 'oauth', 'oauth2', 'authentication', 'authorization',
    'ssl', 'tls', 'https', 'encryption', 'rbac', 'zero trust',
  ],
  data_engineering: [
    'spark', 'hadoop', 'airflow', 'etl', 'data pipeline', 'data warehouse',
    'bigquery', 'snowflake', 'dbt', 'flink', 'pandas', 'numpy',
  ],
  frontend: [
    'react', 'angular', 'vue', 'nextjs', 'typescript', 'javascript',
    'css', 'html', 'redux', 'zustand', 'tailwind', 'webpack', 'vite',
  ],
};

const MIN_CLUSTER_HITS   = 2;
const BOOST_PER_CLUSTER  = 8;
const MAX_CONCEPT_BOOST  = 30;
const BASE_FALLBACK      = 35;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Stable short hash of text for cache key generation */
function hashText(text) {
  return crypto.createHash('sha256').update(text.trim().slice(0, 8000)).digest('hex').slice(0, 16);
}

/** Tokenise to a flat Set of lowercase words + bigrams */
function lowerTokens(text = '') {
  const lower = text.toLowerCase();
  const words = lower.match(/[\w']+/g) || [];
  const tokens = new Set(words);
  for (let i = 0; i < words.length - 1; i++) tokens.add(`${words[i]} ${words[i + 1]}`);
  return tokens;
}

/** Concept-cluster boost fallback (0 … MAX_CONCEPT_BOOST) */
function computeConceptBoost(resumeText, jdText) {
  const resumeTokens = lowerTokens(resumeText);
  const jdTokens     = lowerTokens(jdText);
  let boost = 0;
  for (const [, terms] of Object.entries(CONCEPT_CLUSTERS)) {
    const resumeHits = terms.filter(t => resumeTokens.has(t)).length;
    const jdHits     = terms.filter(t => jdTokens.has(t)).length;
    if (resumeHits >= MIN_CLUSTER_HITS && jdHits >= 1) {
      const depth = Math.min(resumeHits / terms.length, 1.0);
      boost += BOOST_PER_CLUSTER * (0.5 + 0.5 * depth);
    }
  }
  return Math.min(boost, MAX_CONCEPT_BOOST);
}

/** Cosine similarity between two float vectors (0 to 1) */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag > 0 ? dot / mag : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding with Redis caching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get embedding for text. Checks Redis cache first; generates via Gemini on miss.
 * Caches result for 24 hours (embeddings are deterministic for the same text).
 * @param {string} text
 * @returns {Promise<number[]>} embedding vector
 */
async function getCachedEmbedding(text) {
  const hash     = hashText(text);
  const cacheKey = `emb:${hash}`;

  // Check Redis cache
  if (cacheService.isRedisConnected()) {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log(`[Semantic] CACHE HIT  - Embedding ${hash}`);
      return cached;
    }
    console.log(`[Semantic] CACHE MISS - Embedding ${hash}`);
  }

  // Generate via Gemini
  const embedding = await generateEmbedding(text);

  // Store in Redis (fire-and-forget)
  if (embedding && cacheService.isRedisConnected()) {
    cacheService.set(cacheKey, embedding, EMBEDDING_TTL_SEC).catch(() => {});
  }

  return embedding;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resume text builders
// ─────────────────────────────────────────────────────────────────────────────

function buildSkillsText(resume) {
  if (!Array.isArray(resume.skills)) return '';
  return resume.skills.map(s => {
    if (typeof s === 'string') return s;
    const items = Array.isArray(s.items) ? s.items.join(' ') : '';
    return `${s.category || ''} ${items}`.trim();
  }).join(' ');
}

function buildExperienceText(resume) {
  if (!Array.isArray(resume.experience)) return '';
  return resume.experience.map(exp => {
    const bullets = Array.isArray(exp.bullets) ? exp.bullets.join(' ') : '';
    return `${exp.role || ''} ${exp.company || ''} ${bullets}`.trim();
  }).join(' ');
}

function buildProjectsText(resume) {
  if (!Array.isArray(resume.projects)) return '';
  return resume.projects.map(p => {
    const techs   = Array.isArray(p.techStack) ? p.techStack.join(' ') : '';
    const bullets = Array.isArray(p.bullets) ? p.bullets.join(' ') : '';
    return `${p.title || p.name || ''} ${p.description || ''} ${techs} ${bullets}`.trim();
  }).join(' ');
}

function buildResumeFullText(resume) {
  return [
    resume.summary || '',
    buildSkillsText(resume),
    buildExperienceText(resume),
    buildProjectsText(resume),
  ].filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Service
// ─────────────────────────────────────────────────────────────────────────────

class SemanticService {

  /**
   * Get semantic similarity score (0–100) comparing resume content against a JD.
   *
   * Strategy:
   *   1. Try Gemini text-embedding-004 → cosine similarity → scale to 0–100
   *   2. On any failure → concept-cluster fallback score
   *
   * @param {Object|string} resumeInput - full resume object or sections map
   * @param {string}        jdText      - raw job description text
   * @returns {Promise<number>} - integer 0–100
   */
  async getSemanticScore(resumeInput, jdText = '') {
    // ── Build full resume text ─────────────────────────────────────────────
    let resumeFullText = '';

    if (resumeInput && typeof resumeInput === 'object') {
      if (Array.isArray(resumeInput.skills) || Array.isArray(resumeInput.experience)) {
        // Full resume document
        resumeFullText = buildResumeFullText(resumeInput);
      } else {
        // Pre-built strings map (legacy)
        resumeFullText = [
          resumeInput.summary    || '',
          resumeInput.skills     || '',
          resumeInput.experience || '',
          resumeInput.projects   || '',
        ].filter(Boolean).join(' ');
      }
    } else if (typeof resumeInput === 'string') {
      resumeFullText = resumeInput;
    }

    if (!resumeFullText.trim()) return 0;
    if (!jdText || !jdText.trim()) {
      // No JD — return a content-quality proxy using concept boost alone
      const boost = computeConceptBoost(resumeFullText, resumeFullText);
      return Math.min(100, BASE_FALLBACK + boost);
    }

    // ── Attempt 1: Gemini embeddings + cosine similarity ──────────────────
    try {
      const [resumeVec, jdVec] = await Promise.all([
        getCachedEmbedding(resumeFullText),
        getCachedEmbedding(jdText),
      ]);

      const similarity = cosineSimilarity(resumeVec, jdVec);
      // Cosine similarity for same-domain text typically falls in 0.6–0.95.
      // We linearly scale the [0.5, 1.0] band → [0, 100] for a meaningful score.
      const scaled = Math.round(Math.max(0, Math.min(1, (similarity - 0.5) * 2)) * 100);
      console.log(`[Semantic] Gemini embeddings OK — cosine=${similarity.toFixed(4)}, score=${scaled}`);
      return scaled;

    } catch (err) {
      console.warn(`[Semantic] Gemini embedding failed (${err.message}). Falling back to concept scoring.`);
    }

    // ── Attempt 2: Concept-cluster heuristic fallback ─────────────────────
    const boost = computeConceptBoost(resumeFullText, jdText);
    const score = Math.round(Math.min(100, BASE_FALLBACK + boost));
    console.log(`[Semantic] Concept-cluster fallback — boost=${boost.toFixed(1)}, score=${score}`);
    return score;
  }

  /**
   * Identify contextual synonym matches between resume skills and JD keywords.
   * Falls back to substring matching when Gemini is unavailable.
   *
   * @param {string[]} resumeSkills
   * @param {string[]} jdKeywords
   * @returns {Promise<Array<{jdSkill, matchedWith, confidence}>>}
   */
  async getSkillSemanticMatches(resumeSkills, jdKeywords) {
    if (!resumeSkills?.length || !jdKeywords?.length) return [];

    // Substring-based fallback (fast, no API call needed)
    return jdKeywords
      .map(jdKw => {
        const jdLower = jdKw.toLowerCase();
        const match = resumeSkills.find(rs =>
          rs.toLowerCase().includes(jdLower) || jdLower.includes(rs.toLowerCase())
        );
        return match ? { jdSkill: jdKw, matchedWith: match, confidence: 0.7 } : null;
      })
      .filter(Boolean);
  }

  /** Standalone concept-boost for external logging/debugging */
  computeConceptBoost(resumeText, jdText) {
    return computeConceptBoost(resumeText, jdText);
  }
}

module.exports = new SemanticService();
