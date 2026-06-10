/**
 * AI Service — Google Gemini Integration
 *
 * Provides AI-powered resume improvement by sending structured prompts
 * to Gemini and parsing the returned JSON output.
 *
 * SDK: @google/genai (AI Studio — official new SDK)
 * Models: gemini-2.5-flash → gemini-2.0-flash (auto-fallback chain)
 * Docs: https://ai.google.dev/gemini-api/docs/models
 *
 * ISOLATED: Does not touch ATS scoring, DB writes, or existing resume flow.
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');

// ── Gemini Client Init ──────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;

let ai = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
  console.log('✅ [AI Service] Gemini (AI Studio) client initialized.');
} else {
  console.warn('⚠️  [AI Service] GEMINI_API_KEY not set — AI endpoints will return 503.');
}

// ── Model Priority Chain ────────────────────────────────────────────────────
//
// Try each model in order. Skip to next on 503/overload/not-found.
// Stop immediately on unrecoverable errors (bad key, quota, bad request).
//
const MODELS = [
  'gemini-2.5-flash', // primary  — current stable free-tier model
  'gemini-2.0-flash', // fallback — previous stable, broad regional coverage
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compress a resume document into a compact plaintext representation
 * so we don't waste prompt tokens on Mongoose metadata.
 */
const serializeResume = (resume) => {
  const lines = [];

  if (resume.personalInfo?.fullName) lines.push(`Name: ${resume.personalInfo.fullName}`);
  if (resume.summary) lines.push(`\nSummary:\n${resume.summary}`);

  if (resume.experience?.length) {
    lines.push('\nExperience:');
    resume.experience.forEach((e) => {
      lines.push(`  - ${e.role || e.jobTitle} at ${e.company} (${e.startDate || ''} – ${e.current ? 'Present' : e.endDate || ''})`);
      if (e.bullets?.length) e.bullets.forEach((b) => lines.push(`    • ${b}`));
    });
  }

  if (resume.projects?.length) {
    lines.push('\nProjects:');
    resume.projects.forEach((p) => {
      lines.push(`  - ${p.title || p.name}`);
      if (p.bullets?.length) p.bullets.forEach((b) => lines.push(`    • ${b}`));
    });
  }

  if (resume.skills?.length) {
    const allSkills = resume.skills.flatMap((s) => s.items || [s]).join(', ');
    lines.push(`\nSkills: ${allSkills}`);
  }

  return lines.join('\n');
};

/**
 * Build the structured Gemini prompt for resume improvement.
 * Instructs the model to return plain JSON — no code fences.
 */
const buildPrompt = (resumeText, jdText) => `
You are an expert resume coach and ATS optimization specialist.

Improve the following resume sections specifically for the given job description.

Job Description:
"""
${jdText.trim()}
"""

Current Resume:
"""
${resumeText.trim()}
"""

Instructions:
- Improve clarity, impact, and ATS-friendliness of the summary, experience bullets, and project descriptions.
- Naturally weave in relevant keywords from the Job Description.
- Use strong, quantified action verbs (e.g., "Led", "Architected", "Reduced by 30%") where possible.
- Keep content concise and professional.
- Do NOT fabricate new roles, companies, or unrelated experiences.
- Preserve all original companies, project names, and timelines exactly.
- Only improve the wording and add relevant keywords.
- For experience and projects, return arrays matching the EXACT same count and order as the input.

Return ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "summary": "<improved summary string>",
  "experience": [
    {
      "role": "<same role>",
      "company": "<same company>",
      "bullets": ["<improved bullet 1>", "<improved bullet 2>"]
    }
  ],
  "projects": [
    {
      "title": "<same project title>",
      "bullets": ["<improved bullet 1>", "<improved bullet 2>"]
    }
  ]
}
`.trim();

/**
 * Strip markdown code fences if the model wraps its JSON output.
 * e.g. ```json\n{ ... }\n``` → { ... }
 */
const stripCodeFences = (text) => {
  if (!text) return '';
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
};

/**
 * Parse and validate the JSON response from Gemini.
 * Throws on malformed output.
 */
const parseGeminiResponse = (rawText) => {
  try {
    const cleaned = stripCodeFences(rawText);
    const parsed  = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object') throw new Error('Response is not an object');
    if (typeof parsed.summary !== 'string') parsed.summary = '';
    if (!Array.isArray(parsed.experience)) parsed.experience = [];
    if (!Array.isArray(parsed.projects))   parsed.projects   = [];

    return parsed;
  } catch (err) {
    console.error('[AI Service] Failed to parse Gemini JSON response:', err.message);
    console.error('[AI Service] Raw response (first 500 chars):', rawText?.substring(0, 500));
    throw new Error('AI returned malformed JSON. Please try again.');
  }
};

/**
 * Classify a Gemini error to decide whether to retry with the next model.
 *
 * Returns true  → retryable (503, overloaded, model-not-found)
 * Returns false → unrecoverable (bad key, quota, billing, 400)
 */
const isRetryable = (err) => {
  const msg  = (err?.message || '').toLowerCase();
  const code = String(err?.status || err?.code || '');

  // Unrecoverable — trying another model won't fix these
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid')) return false;
  if (msg.includes('quota')           || msg.includes('rate_limit_exceeded')) return false;
  if (msg.includes('billing')         || msg.includes('payment'))             return false;
  if (code === '401' || code === '403' || code === '400')                     return false;

  // Retryable — overloaded or model unavailable in this region/key scope
  return (
    msg.includes('unavailable')     ||
    msg.includes('overloaded')      ||
    msg.includes('503')             ||
    msg.includes('not found')       ||
    msg.includes('404')             ||
    msg.includes('model_not_found') ||
    code === '503'                  ||
    code === '404'
  );
};

/**
 * Call Gemini with a specific model; returns raw response text.
 * Throws on any error so the caller decides whether to retry.
 */
const callGemini = async (model, prompt) => {
  console.log(`[AI Service] 🤖 Trying model: ${model}`);
  const response = await ai.models.generateContent({ model, contents: prompt });
  if (!response || response.text == null) {
    throw new Error('Gemini returned an empty response.');
  }
  console.log(`[AI Service] ✅ Success with model: ${model}`);
  return response.text;
};

/**
 * Build a structured offline fallback when ALL Gemini models fail.
 *
 * IMPORTANT: returns the exact same shape as parseGeminiResponse() so the
 * controller and frontend work transparently — no special-casing needed.
 * The _fallback flag lets the controller report aiUsed: false.
 *
 * @param {Object} resumeData — original resume (preserves structure)
 * @returns {{ summary, experience, projects, _fallback: true }}
 */
const buildFallbackResult = (resumeData) => {
  const tip =
    'AI is temporarily busy. In the meantime: use strong action verbs ' +
    '(Developed, Built, Led), add measurable outcomes (e.g., reduced latency ' +
    'by 30%), and align skills with the job description keywords.';

  return {
    summary: resumeData?.summary
      ? `${resumeData.summary} [AI tip: ${tip}]`
      : tip,

    experience: (resumeData?.experience || []).map((e) => ({
      role:    e.role || e.jobTitle || '',
      company: e.company || '',
      bullets: e.bullets || [],
    })),

    projects: (resumeData?.projects || []).map((p) => ({
      title:   p.title || p.name || '',
      bullets: p.bullets || [],
    })),

    _fallback: true, // controller reads this to set aiUsed: false
  };
};

/**
 * Builds the structured prompt to reconstruct projects from raw text.
 */
const buildParseProjectsPrompt = (projectsText) => `
You are an expert resume parser.

Convert the following raw project text from a resume into a structured JSON array.
Do not hallucinate. Preserve original meaning, titles, and details exactly.
Do not add anything that isn't in the text.

Raw Project Text:
"""
${projectsText}
"""

Return ONLY valid JSON (an array of project objects). No markdown format, no code fences, no explanations.
Format MUST adhere to:
[
  {
    "title": "Project Name",
    "description": "Short project description or summary, if any",
    "techStack": ["React", "Express", "Node.js"],
    "bullets": ["Bullet 1", "Bullet 2"]
  }
]
`.trim();

/**
 * Call Gemini to reconstruct and parse projects into structured JSON.
 */
const parseProjects = async (projectsText) => {
  if (!ai || !projectsText || !projectsText.trim()) {
    return null;
  }

  const prompt = buildParseProjectsPrompt(projectsText);

  for (const model of MODELS) {
    try {
      const rawText = await callGemini(model, prompt);
      const cleaned = stripCodeFences(rawText);
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error('AI returned non-array for projects');
      }

      // Ensure each item matches the schema
      const validProjects = parsed.filter(p => p && p.title).map(p => ({
        title: p.title || '',
        description: p.description || '',
        techStack: Array.isArray(p.techStack) ? p.techStack : typeof p.techStack === 'string' ? p.techStack.split(',').map(s=>s.trim()) : [],
        bullets: Array.isArray(p.bullets) ? p.bullets : [],
      }));

      return validProjects;
    } catch (err) {
      console.warn(`[AI Service - parseProjects] ⚠️ ${model} failed: ${err.message}`);
      if (!isRetryable(err)) break;
    }
  }

  return null;
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * improveResume
 *
 * Walks the MODELS chain, retrying on recoverable failures (503, not-found).
 * Stops immediately on unrecoverable errors (bad key, quota).
 * Returns a structured offline fallback if every model fails.
 *
 * @param {Object} resumeData  — raw Resume Mongoose document (or plain object)
 * @param {string} jdText      — raw job description text
 * @returns {{ summary, experience, projects, _fallback? }}
 */
const improveResume = async (resumeData, jdText) => {
  // No API key — return fallback immediately (no throw)
  if (!ai) {
    console.warn('[AI Service] ⚠️  No API key — returning offline fallback.');
    return buildFallbackResult(resumeData);
  }

  // Missing input — return fallback immediately (no throw)
  if (!resumeData || !jdText) {
    console.warn('[AI Service] ⚠️  Missing resumeData or jdText — returning offline fallback.');
    return buildFallbackResult(resumeData);
  }

  const resumeText = serializeResume(resumeData);
  const prompt     = buildPrompt(resumeText, jdText);

  // ── Walk model chain ───────────────────────────────────────────────────────
  for (const model of MODELS) {
    try {
      const rawText = await callGemini(model, prompt);
      return parseGeminiResponse(rawText); // ← success, return immediately
    } catch (err) {
      console.warn(`[AI Service] ⚠️  ${model} failed: ${err.message}`);

      if (!isRetryable(err)) {
        // Quota / bad-key / 400 — no point trying more models,
        // but DON'T throw: fall through to the offline fallback below.
        console.warn('[AI Service] ⚠️  Unrecoverable error — stopping chain, using fallback.');
        break;
      }

      console.log('[AI Service] 🔄 Retryable error — trying next model...');
    }
  }

  // ── All models exhausted ───────────────────────────────────────────────────
  console.warn('[AI Service] 🟡 All models failed — returning offline fallback.');
  return buildFallbackResult(resumeData);
};

/**
 * Refine base interview questions using context
 */
const refineQuestions = async (resumeText, jdText, missingSkills) => {
  if (!ai) return null;
  const prompt = `You are an expert technical interviewer.
Based on the candidate's Resume and Job Description, and their missing skills: ${(missingSkills || []).join(', ')},
generate exactly 5 highly technical and challenging interview questions reflecting a realistic interview.
Return ONLY a JSON array, no markdown.
Format: [ { "type": "resume|jd|gap", "question": "..." } ]`;
  
  for (const model of MODELS) {
    try {
      const resp = await callGemini(model, prompt);
      const cleaned = resp.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch(e) {
      if (!isRetryable(e)) break;
    }
  }
  return null;
};

/**
 * Evaluate Candidate's Interview Answer
 */
const evaluateInterviewAnswer = async (question, answer, context) => {
  if (!ai) throw new Error('No AI connection available');
  const prompt = `You are an expert technical interviewer.

Evaluate the candidate's answer.

Question:
${question}

Answer:
${answer}

Context:
Resume Skills: ${(context.resumeSkills || []).join(', ')}
JD Skills: ${(context.jdSkills || []).join(', ')}
Missing Skills: ${(context.missingSkills || []).join(', ')}

Evaluate details:
- Technical correctness
- Depth
- Clarity
- Missing concepts

Return STRICT JSON without markdown block delimiters:
{
  "score": 7,
  "feedback": "...",
  "missingConcepts": ["..."],
  "improvement": "..."
}`;

  for (const model of MODELS) {
    try {
      const rawText = await callGemini(model, prompt);
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch(e) {
      if (!isRetryable(e)) break;
    }
  }
  throw new Error('All models exhausted in evaluation');
};

module.exports = { improveResume, parseProjects, refineQuestions, evaluateInterviewAnswer };
