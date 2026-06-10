/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS KEYWORD SUGGESTION ENGINE
 *
 * Generates smart, section-aware keyword suggestions by comparing:
 *   - extractedKeywords from the Job Description
 *   - full searchable text from the Resume
 *
 * Returns suggestions with the EXACT section where the keyword best fits,
 * a concrete actionable message, and an improved-text example.
 *
 * RULES:
 * - Does NOT modify scoring logic
 * - Does NOT overwrite existing suggestion types
 * - Merges cleanly into the existing suggestion array
 * - De-duplicates by keyword (no same keyword suggested twice)
 * - Limits output to 5–8 suggestions regardless of input size
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Section Taxonomy ────────────────────────────────────────────────────────
// Ordered by specificity — try each category match before falling back.

const SECTION_KEYWORD_MAP = {
  // Skills / tools — always a good fit for the skills section
  skills: [
    // Languages
    'javascript', 'python', 'java', 'typescript', 'c++', 'c#', 'go', 'rust',
    'kotlin', 'swift', 'php', 'ruby', 'scala', 'dart', 'r', 'matlab',
    // Frontend
    'react', 'react.js', 'reactjs', 'angular', 'vue', 'vue.js', 'next.js',
    'nextjs', 'svelte', 'redux', 'webpack', 'vite', 'html', 'css', 'sass',
    'tailwind', 'bootstrap', 'material-ui', 'ant design',
    // Backend
    'node', 'node.js', 'nodejs', 'express', 'express.js', 'nestjs', 'django',
    'flask', 'spring', 'fastapi', 'rails', 'laravel', 'graphql', 'rest',
    'rest api', 'restful', 'grpc', 'microservices',
    // Databases
    'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra',
    'dynamodb', 'firebase', 'sqlite', 'oracle', 'sql', 'nosql',
    // Cloud / DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform',
    'ansible', 'github actions', 'ci/cd', 'helm', 'nginx', 'linux',
    'git', 'bitbucket', 'gitlab',
    // Data / AI
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn',
    'pandas', 'numpy', 'spark', 'hadoop', 'kafka', 'airflow',
  ],

  // Frameworks and tools used in project context
  projects: [
    'api integration', 'rest api integration', 'authentication', 'authorization',
    'jwt', 'oauth', 'real-time', 'websocket', 'socket.io', 'payment gateway',
    'stripe', 'twilio', 'sendgrid', 'third-party api', 'deployment', 'responsive',
    'mvp', 'prototype', 'github', 'version control', 'agile', 'crud',
  ],

  // Soft skills and responsibilities — experience section fit
  experience: [
    'leadership', 'cross-functional', 'stakeholder', 'delivery', 'mentoring',
    'collaboration', 'communication', 'problem-solving', 'on-call', 'production',
    'incident', 'sla', 'sprint', 'scrum', 'code review', 'pull request',
    'performance', 'scalability', 'reliability', 'monitoring', 'observability',
    'logging', 'tracing', 'metrics',
  ],

  // High-level role keywords → summary
  summary: [
    'full-stack', 'fullstack', 'full stack', 'senior', 'junior', 'mid-level',
    'software engineer', 'software developer', 'backend developer',
    'frontend developer', 'data engineer', 'devops engineer', 'tech lead',
    'product-focused', 'agile methodology', 'results-driven',
  ],
};

// Build a fast reverse-lookup: keyword → section
const KEYWORD_TO_SECTION = {};
for (const [section, keywords] of Object.entries(SECTION_KEYWORD_MAP)) {
  for (const kw of keywords) {
    // Store the lowest-specificity section only (first one wins per section order)
    if (!KEYWORD_TO_SECTION[kw]) {
      KEYWORD_TO_SECTION[kw] = section;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace).
 */
const normalize = (str) =>
  String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Determine which resume section a missing keyword best belongs to.
 * Falls back to 'skills' — the safest, always-applicable section.
 *
 * @param {string} keyword
 * @returns {'skills'|'projects'|'experience'|'summary'}
 */
const mapKeywordToSection = (keyword) => {
  const kw = normalize(keyword);

  // Exact match
  if (KEYWORD_TO_SECTION[kw]) return KEYWORD_TO_SECTION[kw];

  // Partial / substring match — iterate known entries
  for (const [known, section] of Object.entries(KEYWORD_TO_SECTION)) {
    if (kw.includes(known) || known.includes(kw)) return section;
  }

  // Default: skills is always safe
  return 'skills';
};

/**
 * Build a short, concrete improved-text example for a keyword + section pair.
 *
 * @param {string} keyword - The missing keyword
 * @param {string} section - Where to add it
 * @param {Object} resume  - Resume data (for context)
 * @returns {string}
 */
const buildImprovedText = (keyword, section, resume) => {
  switch (section) {
    case 'skills':
      return keyword; // Single keyword — the apply handler adds it to the items array

    case 'projects': {
      // Refer to the first project name if available
      const projName = resume.projects?.[0]?.title || resume.projects?.[0]?.name || 'your project';
      return `Implemented ${keyword} in ${projName} to enhance functionality and meet job requirements.`;
    }

    case 'experience': {
      const role = resume.experience?.[0]?.role || 'your role';
      return `Leveraged ${keyword} at ${role} to drive measurable improvements in delivery speed and reliability.`;
    }

    case 'summary':
      return `${resume.summary ? resume.summary.trimEnd() + ' ' : ''}Experienced in ${keyword} with a track record of delivering impactful solutions.`;

    default:
      return keyword;
  }
};

/**
 * Build a human-readable, actionable message for a keyword + section.
 *
 * @param {string} keyword
 * @param {string} section
 * @returns {string}
 */
const buildMessage = (keyword, section) => {
  switch (section) {
    case 'skills':
      return `Add "${keyword}" to your Skills section — it's listed in the job description and missing from your resume.`;
    case 'projects':
      return `Mention "${keyword}" in a project description to show hands-on experience with this technology.`;
    case 'experience':
      return `Include "${keyword}" in an experience bullet to align with the job's key requirement.`;
    case 'summary':
      return `Add "${keyword}" to your summary to signal alignment with the target role at a glance.`;
    default:
      return `Add "${keyword}" to improve your ATS keyword match score.`;
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * generateKeywordSuggestions
 *
 * Compares JD keywords against resume text, finds missing ones, maps each to
 * the best section, and returns up to `maxSuggestions` structured suggestions.
 *
 * @param {Object}   resume           - Raw resume object (engine format)
 * @param {string[]} jdKeywords       - Extracted keywords from the job description
 * @param {string}   resumeText       - Pre-built searchable text from buildSearchableResumeText()
 * @param {object}   [opts]
 * @param {number}   [opts.max=6]     - Maximum suggestions to return (default 6)
 * @returns {Array}                   - Array of suggestion objects
 */
function generateKeywordSuggestions(resume, jdKeywords, resumeText, opts = {}) {
  const max = opts.max ?? 6;

  if (!Array.isArray(jdKeywords) || jdKeywords.length === 0) return [];
  if (!resumeText) return [];

  const normalizedResumeText = normalize(resumeText);

  // Step 1: Find missing keywords (case-insensitive, whole-ish word match)
  const missingKeywords = jdKeywords.filter((kw) => {
    const normalized = normalize(kw);
    if (!normalized || normalized.length < 2) return false;
    return !normalizedResumeText.includes(normalized);
  });

  if (missingKeywords.length === 0) return [];

  // Step 2: Map each missing keyword to a section and deduplicate by (keyword, section) pair
  const seen = new Set();
  const suggestions = [];
  let priority = 1;

  for (const keyword of missingKeywords) {
    if (suggestions.length >= max) break;

    const dedupeKey = normalize(keyword);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const section     = mapKeywordToSection(keyword);
    const improvedText = buildImprovedText(keyword, section, resume);
    const message     = buildMessage(keyword, section);

    // Severity: skills / summary keywords are high-impact; others are medium
    const severity = (section === 'skills' || section === 'summary') ? 'high' : 'medium';

    suggestions.push({
      id:           `sugg-kw-${normalize(keyword).replace(/\s+/g, '-')}-${Date.now()}-${priority}`,
      type:         'keyword',
      impact:       severity,
      section,
      message,
      currentText:  `"${keyword}" not found in resume`,
      improvedText,
      keyword,
      priority:     priority++,
    });
  }

  console.log(`[KeywordSuggestionEngine] Generated ${suggestions.length} section-aware keyword suggestions`);
  return suggestions;
}

module.exports = { generateKeywordSuggestions, mapKeywordToSection };
