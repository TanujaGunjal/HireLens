/**
 * geminiClient.js — Centralized Gemini AI Client
 *
 * Features:
 *  - Single GoogleGenAI instance (lazy-initialized)
 *  - Exponential backoff with jitter on 429 quota errors & 5xx errors
 *  - generateEmbedding() using text-embedding-004
 *  - generateContent() using gemini-2.0-flash with model fallback
 *  - Graceful degradation: returns null (never throws) when all retries exhausted
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');

let _ai = null;

/** Lazy-initialize the Gemini client. Returns null if key not configured. */
function getAI() {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify whether a Gemini error is worth retrying.
 * 429 quota / 5xx transient = retryable
 * 400 bad request / 401 key / 403 billing = not retryable
 */
function isRetryable(err) {
  const msg    = (err?.message || '').toLowerCase();
  const status = err?.status || err?.httpErrorCode || err?.code || 0;

  // Never retry: bad key, quota permanently exhausted, billing, bad request
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid')) return false;
  if (msg.includes('billing') || msg.includes('payment'))                   return false;
  if (String(status) === '400' || String(status) === '401' || String(status) === '403') return false;

  // Retry: quota (429), temporary overload (503), model not found (404 transient)
  const isQuota   = String(status) === '429' || msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit');
  const isServer  = Number(status) >= 500 || msg.includes('unavailable') || msg.includes('overloaded');
  return isQuota || isServer;
}

/**
 * Retry an async function with exponential backoff + jitter.
 * @param {Function} fn          - async function to retry
 * @param {number}   maxRetries  - maximum attempts after first failure (default 3)
 * @param {number}   baseMs      - initial delay in ms (default 1000)
 * @returns {Promise<any>}
 */
async function withRetry(fn, maxRetries = 3, baseMs = 1000) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt >= maxRetries) break;

      const delay = baseMs * (2 ** attempt) + Math.random() * 300;
      const status = err?.status || err?.httpErrorCode || '?';
      console.warn(
        `[GeminiClient] Attempt ${attempt + 1}/${maxRetries} failed ` +
        `(status=${status}). Retrying in ${Math.round(delay)}ms…`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a text embedding vector using Gemini text-embedding-004.
 *
 * @param {string} text - text to embed (will be truncated to 8000 chars)
 * @returns {Promise<number[]>} - float32 embedding vector
 * @throws {Error} if API key not configured, text is empty, or all retries fail
 */
async function generateEmbedding(text) {
  const ai = getAI();
  if (!ai) throw new Error('[GeminiClient] GEMINI_API_KEY not configured');

  const trimmed = (text || '').trim().slice(0, 8000);
  if (!trimmed) throw new Error('[GeminiClient] Cannot embed empty text');

  return withRetry(async () => {
    const result = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: trimmed,
    });

    const values = result?.embeddings?.[0]?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('[GeminiClient] Unexpected embedding response structure');
    }
    return values;
  });
}

/**
 * Generate text content with a model fallback chain and exponential backoff.
 *
 * @param {string} prompt  - the prompt to send
 * @param {string} [model] - primary model (default: gemini-2.0-flash)
 * @returns {Promise<string|null>} - generated text, or null on persistent failure
 */
async function generateContent(prompt, model = 'gemini-2.0-flash') {
  const ai = getAI();
  if (!ai) throw new Error('[GeminiClient] GEMINI_API_KEY not configured');

  const MODELS = [model, 'gemini-2.0-flash', 'gemini-2.5-flash'].filter(
    (m, i, arr) => arr.indexOf(m) === i  // deduplicate
  );

  for (const m of MODELS) {
    try {
      return await withRetry(async () => {
        const result = await ai.models.generateContent({ model: m, contents: prompt });
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        if (!text) throw new Error('Empty response from Gemini');
        return text;
      });
    } catch (err) {
      if (!isRetryable(err)) break; // unrecoverable — stop the model chain
      console.warn(`[GeminiClient] Model ${m} exhausted, trying next…`);
    }
  }

  return null; // graceful degradation
}

module.exports = { generateEmbedding, generateContent, withRetry, isRetryable };
