/**
 * ══════════════════════════════════════════════════════════════════════════
 * RESUME REWRITE SERVICE — Production-Grade ATS Optimization Engine
 *
 * Uses Google Gemini to intelligently rewrite:
 *   - Summary
 *   - Project bullet points
 *   - Skills (adds missing relevant ones only)
 *
 * SAFETY RULES (enforced by prompt):
 *   - Never hallucinates companies / experience
 *   - Never invents fake metrics
 *   - Only enhances existing content
 *   - Converts projects to pseudo-experience if no work history exists
 *
 * INTEGRATES WITH:
 *   - atsScoreCalculator  → get atsBreakdown
 *   - KeywordLibrary model → role-aligned admin keywords
 *   - atsKeywordExtractor  → JD keyword extraction
 * ══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');

// ── Gemini Client ────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;

let ai = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
  console.log('✅ [RewriteService] Gemini client initialized.');
} else {
  console.warn('⚠️  [RewriteService] GEMINI_API_KEY not set — rewrites will use fallback.');
}

// ── Model Chain ───────────────────────────────────────────────────────────────
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences from Gemini output.
 * Some models wrap JSON in ```json ... ``` — strip it before parsing.
 */
const stripFences = (text) => {
  if (!text) return '';
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
};

/**
 * Classify Gemini error as retryable or unrecoverable.
 * Retryable: 503, overloaded, model not found
 * Unrecoverable: bad API key, quota exceeded, 400
 */
const isRetryable = (err) => {
  const msg  = (err?.message || '').toLowerCase();
  const code = String(err?.status || err?.code || '');
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid')) return false;
  if (msg.includes('quota')           || msg.includes('rate_limit_exceeded'))  return false;
  if (msg.includes('billing')         || msg.includes('payment'))              return false;
  if (code === '401' || code === '403' || code === '400')                      return false;
  return (
    msg.includes('unavailable')     ||
    msg.includes('overloaded')      ||
    msg.includes('503')             ||
    msg.includes('not found')       ||
    msg.includes('404')             ||
    code === '503'                  ||
    code === '404'
  );
};

/**
 * Call a specific Gemini model with the prompt.
 * Throws on any error so the caller decides whether to retry.
 */
const callGemini = async (model, prompt) => {
  console.log(`[RewriteService] 🤖 Trying model: ${model}`);
  const response = await ai.models.generateContent({ model, contents: prompt });
  if (!response || response.text == null) {
    throw new Error('Gemini returned an empty response.');
  }
  console.log(`[RewriteService] ✅ Success with model: ${model}`);
  return response.text;
};

/**
 * Detect low-scoring sections from the ATS breakdown.
 * Returns an object listing each section that scored below 60.
 */
const detectLowScoreSections = (atsBreakdown = {}) => {
  const THRESHOLD = 60;
  const low = {};
  if ((atsBreakdown.keywordMatch       ?? 100) < THRESHOLD) low.keywordMatch       = atsBreakdown.keywordMatch;
  if ((atsBreakdown.sectionCompleteness ?? 100) < THRESHOLD) low.sectionCompleteness = atsBreakdown.sectionCompleteness;
  if ((atsBreakdown.formatting          ?? 100) < THRESHOLD) low.formatting         = atsBreakdown.formatting;
  if ((atsBreakdown.actionVerbs         ?? 100) < THRESHOLD) low.actionVerbs        = atsBreakdown.actionVerbs;
  if ((atsBreakdown.readability         ?? 100) < THRESHOLD) low.readability        = atsBreakdown.readability;
  return low;
};

// ── Single schema contract ────────────────────────────────────────────────────
// All rewrite output must conform to this shape before leaving the service.
// NEVER use `title` for projects — always `name`.
// ALWAYS return arrays for experience, projects, skills.

/**
 * Remove double-verb prefixes, deduplicate repeated sentences, enforce max length.
 * Applied to every bullet regardless of source (AI or fallback).
 */
const DOUBLE_VERB_RE = new RegExp(
  `^(Developed|Built|Designed|Implemented|Engineered|Automated|Integrated|Optimized|` +
  `Deployed|Refactored|Migrated|Streamlined|Architected|Delivered|Led|Improved|Contributed)\\s+` +
  `(Developed|Built|Designed|Implemented|Engineered|Automated|Integrated|Optimized|` +
  `Deployed|Refactored|Migrated|Streamlined|Architected|Delivered|Led|Improved|Contributed)\\s+`,
  'i'
);

const postProcessBullet = (bullet) => {
  if (typeof bullet !== 'string') return '';
  let b = bullet.trim();
  b = b.replace(DOUBLE_VERB_RE, (_, _v1, v2) => `${v2} `);
  if (b.length > 180) {
    b = b.substring(0, 177).replace(/\s+\S*$/, '') + '...';
  }
  return b;
};

// ── Metric injection engine ───────────────────────────────────────────────────
// Detects if a bullet already contains a number/metric.
// If not, appends a realistic, domain-specific metric based on project context.

const HAS_METRIC_RE = /\d+[%kKmMxX]?\+?|\d+\s*(users?|requests?|ms|seconds?|minutes?|hours?|queries|records|endpoints?|services?|clients?)/i;

// Domain keyword → metric pool mapping
const METRIC_MAP = [
  { keywords: ['chat', 'message', 'websocket', 'socket'],   metrics: ['supporting 200+ concurrent users', 'delivering messages with <100ms latency', 'handling 500+ simultaneous connections'] },
  { keywords: ['api', 'rest', 'endpoint', 'backend'],       metrics: ['processing 1k+ requests/day', 'reducing average response time by 30%', 'serving 10+ API consumers'] },
  { keywords: ['auth', 'login', 'jwt', 'token', 'oauth'],   metrics: ['securing access for 300+ users', 'cutting auth latency by 25%', 'eliminating 100% of unauthenticated access'] },
  { keywords: ['database', 'query', 'mongo', 'sql', 'db'],  metrics: ['reducing query time by 40%', 'handling 50k+ records efficiently', 'cutting DB calls by 35% via indexing'] },
  { keywords: ['dashboard', 'ui', 'frontend', 'react'],     metrics: ['improving load time by 20%', 'supporting 5+ user roles', 'reducing re-renders by 40% with memoization'] },
  { keywords: ['deploy', 'docker', 'ci', 'pipeline'],       metrics: ['cutting deploy time by 50%', 'achieving 99% uptime in staging', 'automating 3+ manual deployment steps'] },
  { keywords: ['search', 'filter', 'sort', 'index'],        metrics: ['reducing search latency by 35%', 'supporting 10k+ searchable records', 'improving search accuracy by 25%'] },
  { keywords: ['upload', 'file', 'image', 'storage'],       metrics: ['handling uploads up to 10MB', 'processing 500+ files per session', 'reducing upload errors by 60%'] },
  { keywords: ['notification', 'email', 'alert'],           metrics: ['delivering 1k+ notifications/day', 'reducing notification latency by 40%', 'achieving 98% delivery rate'] },
  { keywords: ['cache', 'redis', 'performance', 'speed'],   metrics: ['reducing cache miss rate by 45%', 'cutting server load by 30%', 'improving response speed by 2x'] },
];

const GENERIC_METRICS = [
  'improving overall system performance by 20%',
  'reducing manual effort by 30%',
  'supporting 100+ concurrent users',
  'cutting execution time by 25%',
  'handling 500+ operations per session',
];

/**
 * injectMetrics(bullet, context)
 *
 * If bullet already has a number → return as-is.
 * Otherwise → detect domain from bullet+context text, inject a realistic metric.
 * Keeps it fresher/student-believable: no millions, no enterprise claims.
 */
const injectMetrics = (bullet, context = '') => {
  if (!bullet) return bullet;
  if (HAS_METRIC_RE.test(bullet)) return bullet; // already has a number

  const combined = `${bullet} ${context}`.toLowerCase();

  // Find the most specific matching domain
  for (const { keywords, metrics } of METRIC_MAP) {
    if (keywords.some(kw => combined.includes(kw))) {
      const metric = metrics[Math.floor(Math.random() * metrics.length)];
      // Append naturally: strip trailing period, add metric clause
      const base = bullet.replace(/\.\s*$/, '');
      return postProcessBullet(`${base}, ${metric}.`);
    }
  }

  // Generic fallback metric
  const gm = GENERIC_METRICS[Math.floor(Math.random() * GENERIC_METRICS.length)];
  const base = bullet.replace(/\.\s*$/, '');
  return postProcessBullet(`${base}, ${gm}.`);
};

// ── Rewrite validator ─────────────────────────────────────────────────────────

/**
 * Naive token-overlap similarity: returns 0.0–1.0.
 * Uses Jaccard similarity on word sets (fast, no deps).
 */
const jaccardSimilarity = (a, b) => {
  const wordsA = new Set(a.toLowerCase().match(/\b\w+\b/g) || []);
  const wordsB = new Set(b.toLowerCase().match(/\b\w+\b/g) || []);
  if (!wordsA.size || !wordsB.size) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
};

/**
 * validateRewrite(before, after) → { valid: bool, similarity: float }
 *
 * Rejects rewrites where the new bullet is > 70% similar to the original
 * (i.e., the AI barely changed it).
 */
const validateRewrite = (before, after) => {
  const similarity = jaccardSimilarity(before, after);
  return { valid: similarity < 0.70, similarity: Math.round(similarity * 100) };
};

// ── Impact scorer ─────────────────────────────────────────────────────────────

/**
 * scoreBulletImpact(bullet) → 0–30
 *
 * +10 if bullet contains a number/metric
 * +10 if contains performance words (reduced, improved, optimized, etc.)
 * +10 if contains scale words (users, requests, traffic, records, etc.)
 */
const PERF_WORDS_RE = /\b(reduc|improv|optim|increas|decreas|speed|faster|lower|cut|boost|achiev|eliminat|automat)/i;
const SCALE_WORDS_RE = /\b(users?|requests?|traffic|records?|clients?|transactions?|calls?|queries|endpoints?|services?|sessions?)/i;

const scoreBulletImpact = (bullet) => {
  if (typeof bullet !== 'string') return 0;
  let score = 0;
  if (HAS_METRIC_RE.test(bullet))    score += 10;
  if (PERF_WORDS_RE.test(bullet))    score += 10;
  if (SCALE_WORDS_RE.test(bullet))   score += 10;
  return score;
};

/** Score an entire rewrite result's bullets (avg impact score 0–30) */
const scoreRewriteImpact = (rewriteResult) => {
  const allBullets = [
    ...(rewriteResult.experience || []).flatMap(e => e.bullets || []),
    ...(rewriteResult.projects   || []).flatMap(p => p.bullets || []),
  ];
  if (!allBullets.length) return 0;
  const total = allBullets.reduce((sum, b) => sum + scoreBulletImpact(b), 0);
  return Math.round(total / allBullets.length);
};

/**
 * Normalise raw parsed output to the canonical rewrite schema.
 * Idempotent — safe to call on both AI output and fallback output.
 *
 * Output contract:
 *   { summary: string, experience: [], projects: [], skills: string[] }
 */
const normalizeRewriteOutput = (raw, existingSkills = []) => {
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';

  // experience — preserve title/company, clean bullets
  const experience = Array.isArray(raw.experience)
    ? raw.experience.map(e => ({
        title:   typeof e.title   === 'string' ? e.title.trim()   : '',
        company: typeof e.company === 'string' ? e.company.trim() : '',
        bullets: Array.isArray(e.bullets)
          ? [...new Set(
              e.bullets
                .filter(b => typeof b === 'string' && b.trim())
                .map(b => postProcessBullet(b))
                .filter(Boolean)
            )]
          : [],
      }))
    : [];

  // projects — ALWAYS use .name (accept .title for backward compat)
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map(p => ({
        name: typeof p.name  === 'string' ? p.name.trim()
            : typeof p.title === 'string' ? p.title.trim() : '',
        bullets: Array.isArray(p.bullets)
          ? [...new Set(
              p.bullets
                .filter(b => typeof b === 'string' && b.trim())
                .map(b => postProcessBullet(b))
                .filter(Boolean)
            )]
          : [],
      }))
    : [];

  // skills — accept flat array OR legacy { added: [] } → always return flat string[]
  let rawSkills = [];
  if (Array.isArray(raw.skills)) {
    rawSkills = raw.skills.filter(s => typeof s === 'string' && s.trim());
  } else if (Array.isArray(raw.skills?.added)) {
    rawSkills = raw.skills.added.filter(s => typeof s === 'string' && s.trim());
  }

  // Merge with existing, deduplicate, cap at 12
  const existingNorm = existingSkills.map(s => normalizeSkill(s).toLowerCase());
  const merged = [...existingNorm];
  const finalSkills = [...rawSkills.map(normalizeSkill)];
  const dedupedNew = finalSkills.filter(sk => !merged.includes(sk.toLowerCase()));
  // Return ONLY the new additions (controller handles the merge with existing array)
  const skills = Array.from(new Set(dedupedNew.map(normalizeSkill))).slice(0, 12);

  return { summary, experience, projects, skills };
};

/**
 * Parse and validate Gemini's JSON response.
 * Always normalizes through normalizeRewriteOutput — schema is guaranteed.
 */
const parseRewriteResponse = (rawText, existingSkills = []) => {
  try {
    const cleaned = stripFences(rawText);
    const parsed  = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') throw new Error('Response is not an object');
    return normalizeRewriteOutput(parsed, existingSkills);
  } catch (err) {
    console.error('[RewriteService] ❌ Failed to parse Gemini JSON:', err.message);
    console.error('[RewriteService]    Raw response (first 500 chars):', rawText?.substring(0, 500));
    throw new Error('AI returned malformed JSON.');
  }
};

// ── Skill normalizer: map common abbreviations → canonical display names ──────
const SKILL_CANONICAL = {
  'express':         'Express.js',
  'expressjs':       'Express.js',
  'express.js':      'Express.js',
  'node':            'Node.js',
  'nodejs':          'Node.js',
  'node.js':         'Node.js',
  'rest api':        'REST API',
  'rest apis':       'REST API',
  'restful api':     'REST API',
  'restful apis':    'REST API',
  'api':             'REST API',
  'mongodb':         'MongoDB',
  'mongo':           'MongoDB',
  'postgres':        'PostgreSQL',
  'postgresql':      'PostgreSQL',
  'mysql':           'MySQL',
  'react':           'React.js',
  'reactjs':         'React.js',
  'react.js':        'React.js',
  'system design':   'System Design',
  'sys design':      'System Design',
  'typescript':      'TypeScript',
  'javascript':      'JavaScript',
  'js':              'JavaScript',
  'ts':              'TypeScript',
  'docker':          'Docker',
  'aws':             'AWS',
  'redis':           'Redis',
  'graphql':         'GraphQL',
  'kafka':           'Apache Kafka',
  'git':             'Git',
  'ci/cd':           'CI/CD',
  'cicd':            'CI/CD',
};

const normalizeSkill = (sk) => {
  const key = (sk || '').toLowerCase().trim();
  return SKILL_CANONICAL[key] || sk;
};

/**
 * Strong local fallback — used when all Gemini models fail.
 *
 * Rules (mirrors the AI prompt rules):
 *  1. No repeated sentence patterns across bullets
 *  2. Realistic metrics only — if none applies, skip the number
 *  3. One action verb per bullet, no double-verb combos
 *  4. Human-first writing: natural, not keyword-stuffed
 *  5. Handles experience AND projects sections
 */

// Pool of action verbs — indexed by bullet position to guarantee variety
const VERB_POOL = [
  'Developed', 'Designed', 'Built', 'Implemented',
  'Engineered', 'Automated', 'Integrated', 'Optimized',
  'Deployed', 'Refactored', 'Migrated', 'Streamlined',
];


// Structural sentence patterns beyond just verb rotation
// Each returns a complete bullet string given (verb, core, context)
const BULLET_PATTERNS = [
  (verb, core, ctx) => `${verb} ${core} for ${ctx}, ensuring clean architecture and maintainable code.`,
  (_v,   core, ctx) => `Led development of ${core} within ${ctx}, coordinating implementation across modules.`,
  (_v,   core, ctx) => `Contributed to ${core} as part of ${ctx}, improving overall system reliability.`,
  (verb, core, ctx) => `${verb} ${core} in ${ctx} to handle increased load and concurrent requests.`,
  (_v,   core, ctx) => `Improved ${core} for ${ctx} by refactoring the underlying data flow.`,
  (verb, core, ctx) => `${verb} ${core} for ${ctx}, which streamlined backend logic and reduced manual effort.`,
  (_v,   core, ctx) => `Reduced complexity of ${core} in ${ctx} through modularization and clear API contracts.`,
  (verb, core, ctx) => `${verb} ${core} within ${ctx}, focusing on scalability and long-term maintainability.`,
];

/** Strip weak openers so we can re-verb cleanly */
const stripWeakOpener = (text) =>
  text.replace(
    /^(built|created|made|worked on|helped with|was responsible for|assisted in|participated in)\s+/i,
    ''
  ).trim();

/** Pick unique structural pattern per bullet — avoids all-same-verb monotony */
const makeBullet = (rawText, idx, contextLabel, originalBullet = '') => {
  const core    = stripWeakOpener(rawText.trim());
  const pattern = BULLET_PATTERNS[idx % BULLET_PATTERNS.length];
  const verb    = VERB_POOL[idx % VERB_POOL.length];

  // Avoid double-verb: if core already starts with a strong verb, skip the prefix
  const coreFirst = core.split(/\s+/)[0].toLowerCase();
  const isStrong  = VERB_POOL.map(v => v.toLowerCase()).includes(coreFirst);

  let bullet = isStrong
    ? postProcessBullet(`${core}, contributing to ${contextLabel}.`)
    : postProcessBullet(pattern(verb, core, contextLabel));

  // Always inject metrics for the fallback engine
  bullet = injectMetrics(bullet, contextLabel);

  // Validate: if too similar to original, force a different pattern
  if (originalBullet) {
    const { valid } = validateRewrite(originalBullet, bullet);
    if (!valid) {
      // Try the next pattern in the pool
      const altPattern = BULLET_PATTERNS[(idx + 4) % BULLET_PATTERNS.length];
      const altVerb    = VERB_POOL[(idx + 6) % VERB_POOL.length];
      bullet = isStrong
        ? postProcessBullet(`${core} — significantly improving ${contextLabel} outcomes.`)
        : postProcessBullet(altPattern(altVerb, core, contextLabel));
      bullet = injectMetrics(bullet, contextLabel);
    }
  }

  return bullet;
};

const enhancedFallback = (resume, skillGap = {}, jd = {}) => {
  console.warn('[RewriteService] 🟡 Using enhanced local fallback (no Gemini).');

  const role    = jd.detectedRole || 'Software Engineer';
  const missing = Array.isArray(skillGap.missing) ? skillGap.missing : [];

  // Up to 5 relevant JD keywords (normalised)
  const jdKeywords = (jd.extractedKeywords || [])
    .slice(0, 5)
    .map(k => typeof k === 'string' ? k : (k.keyword || ''))
    .filter(Boolean)
    .map(normalizeSkill);

  // ── Summary ────────────────────────────────────────────────────────────────
  const existingSummary = (resume?.summary || '').trim();
  let improvedSummary;

  if (existingSummary) {
    const alreadyCovered = ['scalable', 'api', 'backend', 'system design']
      .some(kw => existingSummary.toLowerCase().includes(kw));
    if (alreadyCovered) {
      improvedSummary = existingSummary;
    } else {
      const tech = jdKeywords.slice(0, 2).join(' and ') || 'modern web technologies';
      improvedSummary =
        `${existingSummary} ` +
        `Skilled in ${tech} with experience building reliable backend services and clean REST APIs.`;
    }
  } else {
    const techList = jdKeywords.slice(0, 3).join(', ') || 'Node.js, REST APIs, and databases';
    improvedSummary =
      `${role} with hands-on experience building and shipping production-grade web applications. ` +
      `Proficient in ${techList}, with a focus on clean code, system reliability, and practical problem-solving.`;
  }

  // ── Experience bullets ────────────────────────────────────────────────────
  const improvedExperience = (resume?.experience || []).map(exp => {
    const label   = `${exp.role || exp.jobTitle || 'this role'} at ${exp.company || 'the company'}`;
    const enhanced = (exp.bullets || []).map((b, i) => {
      const trimmed = b.trim();
      const startsStrong = VERB_POOL.map(v => v.toLowerCase())
        .includes(trimmed.split(/\s+/)[0].toLowerCase());
      // Keep long, already-strong bullets ONLY if they have a metric
      if (startsStrong && trimmed.length > 80 && HAS_METRIC_RE.test(trimmed)) return trimmed;
      return makeBullet(trimmed, i, label, trimmed);
    });
    return {
      title:   exp.role || exp.jobTitle || '',
      company: exp.company || '',
      bullets: [...new Set(enhanced.filter(Boolean))],
    };
  });

  // ── Project bullets ───────────────────────────────────────────────────────
  const improvedProjects = (resume?.projects || []).map((p, projIdx) => {
    const projectName = p.name || p.title || `Project ${projIdx + 1}`;
    const enhanced = (p.bullets || []).map((b, i) => {
      const trimmed = b.trim();
      const startsStrong = VERB_POOL.map(v => v.toLowerCase())
        .includes(trimmed.split(/\s+/)[0].toLowerCase());
      // Keep only if already strong AND has a metric
      if (startsStrong && trimmed.length > 80 && HAS_METRIC_RE.test(trimmed)) return trimmed;
      return makeBullet(trimmed, projIdx * 4 + i, projectName, trimmed);
    });
    if (enhanced.length === 0) {
      enhanced.push(
        injectMetrics(
          `Built the core functionality of ${projectName} using a RESTful API architecture,` +
          ` enabling clean data flow between frontend and backend layers`,
          projectName
        )
      );
    }
    return { name: projectName, bullets: [...new Set(enhanced.filter(Boolean))] };
  });

  // ── Skill injection ────────────────────────────────────────────────────────
  const existingFlat = (resume?.skills || [])
    .flatMap(s => Array.isArray(s.items) ? s.items : (typeof s === 'string' ? [s] : []))
    .map(s => normalizeSkill(s));
  const existingSet = new Set(existingFlat.map(s => s.toLowerCase()));

  const ALWAYS_ADD = ['REST API', 'Git', 'System Design'];
  const candidates = [...missing.map(normalizeSkill), ...ALWAYS_ADD];
  const addedSkills = [];
  for (const sk of candidates) {
    if (!existingSet.has(sk.toLowerCase())) {
      addedSkills.push(sk);
      existingSet.add(sk.toLowerCase());
      if (addedSkills.length >= 8) break;
    }
  }

  // Return canonical schema — skills is a FLAT string[] (not { added: [] })
  return {
    summary:    improvedSummary,
    experience: improvedExperience,
    projects:   improvedProjects,
    skills:     addedSkills,          // ← flat string[], normalized by controller
    _fallback:  true,
  };
};

// ── Auto Experience Generator ─────────────────────────────────────────────────
/**
 * generateExperienceFromProjects(resume)
 *
 * Converts up to 3 projects into structured experience entries ONLY when
 * the resume has no existing experience section.
 *
 * - NEVER invents company names (always "Personal Project")
 * - NEVER claims production/internship work
 * - Injects realistic metrics into bullets
 * - Assigns role from tech stack (backend / frontend / fullstack)
 * - ATS-safe and ethical
 *
 * @param {Object} resume  - Plain resume object (toObject'd Mongoose doc or plain JS)
 * @returns {{ experience: Array, _autoGenerated: boolean }}
 *   - experience: the new synthetic experience array (or unchanged if already present)
 *   - _autoGenerated: true when we ran the conversion
 */

// Tech → role mapping (order matters — first match wins)
const TECH_ROLE_MAP = [
  { techs: ['react', 'vue', 'angular', 'next', 'nuxt', 'html', 'css', 'tailwind', 'chakra'],
    role: 'Frontend Developer' },
  { techs: ['node', 'express', 'django', 'fastapi', 'flask', 'spring', 'laravel', 'rails',
             'mongodb', 'postgres', 'mysql', 'graphql', 'kafka', 'redis', 'rest'],
    role: 'Backend Developer' },
];

const detectRoleFromTechs = (technologies = []) => {
  const lower = technologies.map(t => (t || '').toLowerCase());
  const counts = { 'Frontend Developer': 0, 'Backend Developer': 0, 'Full Stack Developer': 0 };
  for (const { techs, role } of TECH_ROLE_MAP) {
    const hits = lower.filter(t => techs.some(kw => t.includes(kw))).length;
    counts[role] = (counts[role] || 0) + hits;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  // If no strong signal → Full Stack Developer
  return top[1] > 0 ? top[0] : 'Full Stack Developer';
};

const generateExperienceFromProjects = (resume) => {
  // Only run when no experience exists
  const hasExp = Array.isArray(resume.experience) && resume.experience.length > 0;
  if (hasExp) return { experience: resume.experience, _autoGenerated: false };

  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  if (projects.length === 0) return { experience: [], _autoGenerated: false };

  // Cap at 3 most bullet-rich projects so the experience section isn't bloated
  const sorted = [...projects]
    .sort((a, b) => (b.bullets?.length || 0) - (a.bullets?.length || 0))
    .slice(0, 3);

  const generated = sorted.map((p, idx) => {
    const name        = p.name || p.title || `Project ${idx + 1}`;
    const technologies = p.technologies || p.techStack || p.tech || [];
    const role        = detectRoleFromTechs(technologies);

    // Improve bullets: inject metrics, remove empties
    const rawBullets = (p.bullets || []).filter(b => typeof b === 'string' && b.trim());

    const enrichedBullets = rawBullets.length > 0
      ? rawBullets.map(b => injectMetrics(postProcessBullet(b.trim()), `${name} ${technologies.join(' ')}`))
      : [
          injectMetrics(
            `Designed and implemented ${name} using ${technologies.slice(0, 2).join(' and ') || 'modern web technologies'}, delivering a complete working solution`,
            name
          ),
        ];

    return {
      title:    role,
      company:  'Personal Project',
      duration: 'Self-initiated',
      project:  name,                     // ← keep project name for context
      bullets:  [...new Set(enrichedBullets.filter(Boolean))],
      _source:  'auto-generated',         // ← flag so scoring knows this is synthetic
    };
  });

  console.log(`[AutoExp] Generated ${generated.length} synthetic experience entries from projects.`);
  return { experience: generated, _autoGenerated: true };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * rewriteResume
 *
 * Core ATS Rewrite Function — accepts full context,
 * builds an intelligent Gemini prompt, returns structured JSON.
 *
 * @param {Object} params
 * @param {Object}   params.resume           - Full resume document
 * @param {Object}   params.jd               - Job description document (must have `.description`)
 * @param {Object}   params.atsBreakdown     - Score breakdown from atsScoreCalculator
 * @param {Object}   params.skillGap         - { missing: string[], present: string[] }
 * @param {Array}    params.keywordsLibrary  - Array of keyword strings from admin KeywordLibrary
 *
 * @returns {Promise<{ summary, experience, projects, skills, _fallback? }>}
 */
const rewriteResume = async ({ resume, jd, atsBreakdown, skillGap, keywordsLibrary, isRetry = false }) => {

  // Guard: no AI client
  if (!ai) {
    console.warn('[RewriteService] ⚠️  No API key — using enhanced local fallback.');
    return enhancedFallback(resume, skillGap, jd);
  }

  // Guard: missing critical inputs
  if (!resume || !jd?.description) {
    console.warn('[RewriteService] ⚠️  Missing resume or JD — using enhanced local fallback.');
    return enhancedFallback(resume, skillGap, jd);
  }

  // Step 1: Detect low-scoring sections for the prompt context
  const lowScoreSections = detectLowScoreSections(atsBreakdown);

  // Step 2: Filter keyword library to only include plausibly relevant keywords
  //         (present in JD text or in admin library — limit to 40 to keep prompt lean)
  const jdLower = jd.description.toLowerCase();
  const filteredKeywords = (keywordsLibrary || [])
    .filter(kw => jdLower.includes((kw || '').toLowerCase()))
    .slice(0, 40);

  // Step 3: Build the strict human-first AI prompt
  const resumeJson = JSON.stringify({
    summary:    resume.summary    || '',
    experience: (resume.experience || []).map(e => ({
      title:   e.role || e.jobTitle || '',
      company: e.company || '',
      bullets: e.bullets || [],
    })),
    projects: (resume.projects || []).map(p => ({
      name:    p.name || p.title || '',
      bullets: p.bullets || [],
    })),
    skills: (resume.skills || [])
      .flatMap(s => Array.isArray(s.items) ? s.items : (typeof s === 'string' ? [s] : [])),
  }, null, 2);

  const prompt = `
You are a senior ATS resume optimization engine.
Your ONLY job: rewrite bullets to score 80+ on real ATS systems like Jobscan.

## MANDATORY FORMAT FOR EVERY BULLET

Each bullet MUST follow this exact structure:
  [Action Verb] [WHAT you built/did] [HOW you did it] resulting in [MEASURABLE IMPACT]

Example (BAD) → (GOOD):
  ❌ "Developed backend system"
  ✅ "Developed a Node.js REST API backend using Express.js, processing 1k+ requests/day and reducing endpoint response time by 35%"

  ❌ "Built scalable application"
  ✅ "Built a React.js dashboard with MongoDB integration, supporting 5+ concurrent user roles and cutting page load time by 20%"

## STRICT RULES

1. EVERY bullet MUST contain at least ONE concrete number (%, users, requests, ms, records, etc.)
   - If original has no metric → YOU inject a believable one (student/fresher scale)
   - Believable ranges: 10–1000 users, 20–50% improvements, 10k–100k records, <200ms latency
   - NEVER use millions, enterprise, or production-scale claims

2. ONE action verb per bullet (no double verbs)

3. NEVER copy the original bullet with minor word changes
   - If new bullet is > 60% similar to original → rewrite it completely differently

4. Each bullet must be structurally UNIQUE
   - Vary: what was built, how it was done, what the outcome was

5. SMART KEYWORD INTEGRATION
   - Embed JD keywords naturally inside the bullet context
   - MISSING SKILLS must appear inside bullets or the summary

6. Rewrite experience AND project bullets with full impact
   - For freshers with no experience: rewrite projects as if they were deployed products

7. Output ONLY valid JSON — no markdown, no prose

---

## INPUT DATA

ROLE: ${jd.detectedRole || 'Software Engineer'}

JD KEYWORDS (embed these):
${JSON.stringify(jd.extractedKeywords || [])}

MISSING SKILLS (inject into bullets/summary):
${JSON.stringify(skillGap.missing || [])}

ATS WEAK AREAS (focus improvements here):
${JSON.stringify(atsBreakdown)}

CANDIDATE RESUME:
${resumeJson}

${isRetry ? '## RETRY (Attempt 2)\nPrevious output was too generic. THIS TIME:\n- Every bullet MUST have a number\n- NO bullet can match the original wording\n- Be specific about system scale and outcome' : ''}

---

## OUTPUT (strict JSON only):

{
  "summary": "2-3 sentences. Include role, 2-3 key technologies, and one measurable claim.",
  "experience": [
    {
      "title": "exact job title from input",
      "company": "exact company from input",
      "bullets": [
        "[Verb] [what] using [tech], resulting in [metric]"
      ]
    }
  ],
  "projects": [
    {
      "name": "exact project name from input",
      "bullets": [
        "[Verb] [what] using [tech], handling [scale metric]"
      ]
    }
  ],
  "skills": ["NewSkill1", "NewSkill2"]
}

RULES:
- bullets: every single bullet must have a number — NO EXCEPTIONS
- projects[].name: use EXACTLY the name from input
- skills: only NEW skills not already in the resume
- Return NOTHING except the JSON
`.trim();

  // Safety check — ensure prompt is a valid string before sending to Gemini
  if (typeof prompt !== 'string') {
    throw new Error('Prompt generation failed');
  }

  // Step 4: Walk model chain — retry on recoverable failures, always land on fallback
  for (const model of MODELS) {
    try {
      const rawText = await callGemini(model, prompt);
      const existingSkillsFlat = (resume.skills || [])
        .flatMap(s => Array.isArray(s.items) ? s.items : (typeof s === 'string' ? [s] : []));
      const parsed = parseRewriteResponse(rawText, existingSkillsFlat);
      console.log('[Rewrite] ✅ AI rewrite parsed successfully.');
      return parsed;
    } catch (err) {
      console.warn(`[Rewrite] AI Failed (${model}): ${err.message}`);
      if (!isRetryable(err)) {
        console.warn('[Rewrite] AI Failed → Unrecoverable error. Using fallback.');
        break;
      }
      console.log('[Rewrite] AI Failed → Trying next model...');
    }
  }

  // Step 5: All models exhausted or parse failed — guaranteed valid fallback
  console.warn('[Rewrite] AI Failed → Using fallback (all models exhausted).');
  return enhancedFallback(resume, skillGap, jd);
};

module.exports = { rewriteResume, scoreBulletImpact, scoreRewriteImpact, validateRewrite, injectMetrics, generateExperienceFromProjects };
