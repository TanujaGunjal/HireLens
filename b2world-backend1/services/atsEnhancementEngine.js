/**
 * ATS ENHANCEMENT ENGINE — Production-Grade Improvements
 * 
 * Provides enhanced scoring functions that fix:
 * 1. Action verb detection (scan entire text, not just first word)
 * 2. Keyword matching with normalized variations/synonyms
 * 3. Improved grammar in generated bullets
 * 4. Score improvement tracking (before/after)
 * 5. Missing keywords reporting
 *
 * All functions are deterministic (no randomness) and modular
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: ACTION VERB DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Comprehensive list of strong action verbs for scoring
 * Used to detect professional achievement language
 */
const ACTION_VERBS = new Set([
  'achieved',    'architected', 'automated',  'built',        'collaborated',
  'coordinated', 'created',     'decreased',  'defined',      'delivered',
  'deployed',    'designed',    'developed',  'drove',        'engineered',
  'enhanced',    'established', 'executed',   'expanded',     'facilitated',
  'generated',   'grew',        'guided',     'identified',   'implemented',
  'improved',    'increased',   'initiated',  'innovated',    'integrated',
  'introduced',  'launched',    'led',        'leveraged',    'managed',
  'mentored',    'migrated',    'modernized','monitored',    'negotiated',
  'optimized',   'orchestrated','organized', 'owned',        'partnered',
  'pioneered',   'planned',     'produced',   'promoted',     'reduced',
  'refactored',  'refined',     'resolved',   'restructured', 'revamped',
  'scaled',      'secured',     'shipped',    'simplified',   'spearheaded',
  'standardized','streamlined', 'strengthened','structured', 'supervised',
  'transformed', 'transitioned','troubleshot','unified',     'validated',
]);

/**
 * Detect action verbs anywhere in text (not just first word)
 * 
 * @param {string} text - Bullet point or description text
 * @returns {number} Count of action verbs found in the text
 */
function detectActionVerbsInText(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const lowerText = text.toLowerCase();
  let verbCount = 0;
  
  for (const verb of ACTION_VERBS) {
    // Use word boundary to match whole words only
    const regex = new RegExp(`\\b${verb}\\b`, 'g');
    const matches = (lowerText.match(regex) || []).length;
    verbCount += matches;
  }
  
  return verbCount;
}

/**
 * Calculate action verb score from entire resume
 * Scans all experience and project bullets for action verbs
 * 
 * @param {object} resume - Resume object with experience/projects
 * @returns {number} Action verb percentage (0-100)
 */
function detectActionVerbs(resume) {
  if (!resume) return 0;
  
  // Collect all bullets from experience and projects
  const allBullets = [
    ...(resume.experience || []).flatMap(e => e.bullets || e.responsibilities || []),
    ...(resume.projects   || []).flatMap(p => p.bullets || []),
  ];
  
  if (allBullets.length === 0) return 0;
  
  // Count bullets that contain at least one action verb
  let bulletsWithVerbs = 0;
  
  for (const bullet of allBullets) {
    if (detectActionVerbsInText(String(bullet))) {
      bulletsWithVerbs++;
    }
  }
  
  // Return percentage of bullets with action verbs
  return Math.round((bulletsWithVerbs / allBullets.length) * 100);
}

/**
 * Score action verbs contribution to overall ATS score (10% weight)
 * Uses formula: (actionVerbPercentage / 100) * 10
 * 
 * @param {object} resume - Resume object
 * @returns {number} Action verb score (0-10)
 */
function scoreActionVerbs(resume) {
  const percentage = detectActionVerbs(resume);
  // Convert percentage to 0-10 scale
  return Math.round((percentage / 100) * 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: KEYWORD NORMALIZATION & MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Keyword variations and synonyms
 * Used to normalize keywords before matching
 */
const KEYWORD_VARIATIONS = {
  // Frontend
  'react':              ['reactjs', 'react.js', 'react js'],
  'vue':                ['vuejs', 'vue.js'],
  'angular':            ['angularjs', 'angular.js'],
  'typescript':         ['ts'],
  'javascript':         ['js'],
  
  // Backend
  'node.js':            ['nodejs', 'node js', 'node'],
  'python':             ['python3', 'py'],
  'java':               ['jdk', 'j2ee'],
  'go':                 ['golang', 'go lang'],
  'rust':               ['rustlang'],
  'php':                ['php5', 'php7', 'php8'],
  'ruby':               ['rbx'],
  '.net':               ['dotnet', 'c#', 'csharp'],
  
  // Databases
  'postgresql':         ['postgres', 'pg', 'psql'],
  'mongodb':            ['mongo'],
  'mysql':              ['mariadb'],
  'redis':              ['memcached'],
  'elasticsearch':      ['elastic search', 'elastic'],
  'dynamodb':           ['aws dynamodb'],
  
  // Cloud & DevOps
  'aws':                ['amazon web services', 'amazon aws'],
  'google cloud':       ['gcp', 'google cloud platform'],
  'microsoft azure':    ['azure', 'ms azure'],
  'docker':             ['containerization', 'containers'],
  'kubernetes':         ['k8s'],
  'ci/cd':              ['cicd', 'ci cd', 'continuous integration', 'continuous deployment'],
  'jenkins':            ['jenkins ci'],
  'terraform':          ['terraform iac'],
  
  // APIs & Web Services
  'rest api':           ['restful', 'rest apis', 'rest', 'restful api'],
  'graphql':            ['graph ql'],
  'soap':               ['web services'],
  'grpc':               ['google rpc'],
  
  // Frameworks
  'spring boot':        ['springboot', 'spring'],
  'express':            ['express.js', 'expressjs'],
  'django':             ['django rest framework', 'drf'],
  'flask':              ['flask api'],
  'fastapi':            ['fast api'],
  'next.js':            ['nextjs', 'next js'],
  'nest.js':            ['nestjs', 'nest js'],
  'rails':              ['ruby on rails'],
  'laravel':            ['laravel framework'],
  
  // Data Science & ML
  'machine learning':   ['ml', 'supervised learning', 'unsupervised learning'],
  'deep learning':      ['neural networks', 'neural network', 'dl'],
  'tensorflow':         ['tf'],
  'pytorch':            ['torch'],
  'scikit-learn':       ['sklearn', 'scikit learn', 'scikit'],
  'pandas':             ['pd'],
  'numpy':              ['np'],
  'natural language processing': ['nlp'],
  'data visualization': ['tableau', 'power bi', 'powerbi', 'matplotlib', 'seaborn', 'plotly'],
  'statistics':         ['statistical analysis', 'statistical modeling', 'stats'],
  'spark':              ['apache spark', 'pyspark'],
  
  // Tools & Technologies
  'git':                ['github', 'gitlab', 'bitbucket'],
  'docker':             ['docker compose'],
  'jira':               ['atlassian jira'],
  'figma':              ['design figma'],
  'microservices':      ['microservice', 'micro services'],
  'agile':              ['scrum', 'kanban'],
  'testing':            ['unit testing', 'integration testing', 'e2e testing'],
  'junit':              ['junit5', 'junit4'],
  'pytest':             ['py.test'],
  'jest':               ['jest testing'],
  'mocha':              ['chai mocha'],
  'selenium':           ['webdriver', 'automaton'],
};

/**
 * Normalize a keyword by removing punctuation and converting to lowercase
 * Handles variations and synonyms
 * 
 * @param {string} keyword - Raw keyword from JD
 * @returns {string} Normalized keyword (lowercase, basic cleanup)
 */
function normalizeKeyword(keyword) {
  if (!keyword || typeof keyword !== 'string') return '';
  
  // Convert to lowercase and trim
  let normalized = keyword.toLowerCase().trim();
  
  // Remove common punctuation but preserve hyphens and dots for special cases
  normalized = normalized.replace(/[^\w\s.\-]/g, '');
  
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Get all forms of a keyword (canonical + variations)
 * Used to match keywords with different spelling/naming conventions
 * 
 * @param {string} keyword - Keyword to expand
 * @returns {string[]} Array of all variations
 */
function getKeywordForms(keyword) {
  const normalized = normalizeKeyword(keyword);
  const forms = [normalized];
  
  // Check if this keyword has variations defined
  for (const [canonical, variations] of Object.entries(KEYWORD_VARIATIONS)) {
    if (normalizeKeyword(canonical) === normalized) {
      forms.push(...variations.map(normalizeKeyword));
    }
    // Also check if keyword is a variation
    if (variations.some(v => normalizeKeyword(v) === normalized)) {
      forms.push(normalizeKeyword(canonical));
      forms.push(...variations.map(normalizeKeyword));
    }
  }
  
  return [...new Set(forms)]; // Remove duplicates
}

/**
 * Calculate keyword match score (40% of total)
 * Matches resume keywords against JD keywords with normalization
 * 
 * @param {string} resumeText - Searchable resume text (lowercase, no punctuation)
 * @param {string[]} jdKeywords - Keywords extracted from job description
 * @returns {object} { matched, missing, percentage, score }
 */
function calculateKeywordScore(resumeText, jdKeywords) {
  if (!jdKeywords || jdKeywords.length === 0) {
    return {
      matched: [],
      missing: [],
      percentage: 100,
      score: 40, // Full points if no JD keywords
      count: 0
    };
  }
  
  const matched = [];
  const missing = [];
  const normalizedText = normalizeKeyword(resumeText);
  
  for (const keyword of jdKeywords) {
    const forms = getKeywordForms(keyword);
    const isMatched = forms.some(form => {
      // Use word boundary to match whole keywords
      const regex = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      return regex.test(normalizedText);
    });
    
    if (isMatched) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  
  const percentage = Math.round((matched.length / jdKeywords.length) * 100);
  const score = Math.round((percentage / 100) * 40); // 40% weight
  
  return {
    matched,
    missing,
    percentage,
    score,
    count: jdKeywords.length
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: BULLET GENERATION & GRAMMAR FIX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Templates for improved bullets (without unnecessary prepositions)
 */
const BULLET_TEMPLATES = {
  api: [
    'Developed {technology} {description}',
    'Implemented {technology} {description}',
    'Built {technology} {description}',
    'Engineered {technology} {description}',
  ],
  backend: [
    'Developed {technology} backend {description}',
    'Built scalable {technology} services {description}',
    'Implemented {technology} infrastructure {description}',
    'Engineered {technology} server {description}',
  ],
  frontend: [
    'Built {technology} user interfaces {description}',
    'Developed responsive {technology} components {description}',
    'Implemented {technology} frontend {description}',
    'Created {technology} web applications {description}',
  ],
  database: [
    'Designed {technology} database schemas {description}',
    'Optimized {technology} queries {description}',
    'Implemented {technology} data models {description}',
    'Architected {technology} data layer {description}',
  ],
  devops: [
    'Automated {technology} deployment pipelines {description}',
    'Implemented {technology} infrastructure {description}',
    'Configured {technology} monitoring {description}',
    'Orchestrated {technology} environments {description}',
  ],
  default: [
    'Developed {technology} {description}',
    'Implemented {technology} {description}',
    'Built {technology} {description}',
    'Engineered {technology} {description}',
  ]
};

/**
 * Generate an improved bullet point (fixes grammar issues)
 * Avoids unnecessary prepositions that sound awkward
 * 
 * @param {string} technology - Technology name
 * @param {string} category - Type of work (api, backend, frontend, database, etc.)
 * @param {string} description - What was accomplished
 * @returns {string} Improved bullet point
 */
function generateImprovedBullet(technology, category = 'default', description = '') {
  if (!technology) return '';
  
  const templates = BULLET_TEMPLATES[category] || BULLET_TEMPLATES.default;
  
  // Use deterministic selection (first template) instead of random
  const template = templates[0];
  
  // Clean up description
  const cleanDescription = (description || '').trim();
  
  // Format result
  let result = template
    .replace('{technology}', technology.trim())
    .replace('{description}', cleanDescription);
  
  // Clean up any double spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  // Add period if missing
  if (!result.endsWith('.')) {
    result += '.';
  }
  
  return result;
}

/**
 * Examples of improved bullets (no awkward prepositions)
 * 
 * BEFORE: "Developed on backend APIs for internal tools"
 * AFTER:  "Developed backend APIs using Node.js and Express for internal tools."
 * 
 * BEFORE: "Used React to create frontend interface"
 * AFTER:  "Built responsive React components for user dashboard."
 * 
 * BEFORE: "Worked with Docker container system"
 * AFTER:  "Engineered Docker infrastructure for microservices deployment."
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: SCORE IMPROVEMENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two ATS scores and calculate improvement
 * 
 * @param {object} previousScore - Previous score object with breakdown
 * @param {object} newScore - New score object with breakdown
 * @returns {object} Improvement metrics
 */
function calculateScoreImprovement(previousScore, newScore) {
  if (!previousScore || !newScore) {
    return {
      previousTotal: previousScore?.score || 0,
      newTotal: newScore?.score || 0,
      improvement: 0,
      percentageImprovement: 0,
      categoryChanges: {}
    };
  }
  
  const previousTotal = previousScore.score || 0;
  const newTotal = newScore.score || 0;
  const improvement = newTotal - previousTotal;
  const percentageImprovement = previousTotal > 0 
    ? Math.round((improvement / previousTotal) * 100)
    : 0;
  
  // Track changes by category
  const categoryChanges = {};
  const categories = ['keywordMatch', 'sectionCompleteness', 'formatting', 'actionVerbs', 'readability'];
  
  for (const category of categories) {
    const prev = previousScore.breakdown?.[category] || 0;
    const curr = newScore.breakdown?.[category] || 0;
    if (prev !== curr) {
      categoryChanges[category] = {
        before: prev,
        after: curr,
        change: curr - prev
      };
    }
  }
  
  return {
    previousTotal,
    newTotal,
    improvement: Math.round(improvement),
    percentageImprovement,
    categoryChanges,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format score improvement for UI display
 * Example: "71 → 86 (+15)"
 * 
 * @param {object} improvement - Result from calculateScoreImprovement()
 * @returns {string} Formatted string for display
 */
function formatScoreImprovement(improvement) {
  const { previousTotal, newTotal, improvement: diff } = improvement;
  const sign = diff >= 0 ? '+' : '';
  return `${previousTotal} → ${newTotal} (${sign}${diff})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: MISSING KEYWORDS REPORTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract missing keywords from keyword scoring result
 * These are keywords from the JD that were not found in the resume
 * 
 * @param {object} keywordScore - Result from calculateKeywordScore()
 * @returns {string[]} Array of missing keywords
 */
function getMissingKeywords(keywordScore) {
  return keywordScore?.missing || [];
}

/**
 * Format missing keywords with priority weighting
 * Returns up to 10 most important missing keywords
 * 
 * @param {string[]} missingKeywords - Array of missing keyword strings
 * @returns {object[]} Array of keyword objects with metadata
 */
function formatMissingKeywordsForFrontend(missingKeywords) {
  if (!missingKeywords || missingKeywords.length === 0) {
    return [];
  }
  
  // Limit to top 10 for UI display
  return missingKeywords.slice(0, 10).map((keyword, index) => ({
    id: `missing-${index}`,
    keyword: keyword.toString(),
    priority: index < 3 ? 'high' : index < 7 ? 'medium' : 'low',
    category: categorizeMissingKeyword(keyword)
  }));
}

/**
 * Categorize a keyword by type (frontend, backend, database, etc.)
 * 
 * @param {string} keyword - Keyword to categorize
 * @returns {string} Category name
 */
function categorizeMissingKeyword(keyword) {
  const lower = keyword.toLowerCase();
  
  const categories = {
    frontend: ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript', 'webpack'],
    backend: ['node', 'python', 'java', 'golang', 'express', 'django', 'spring'],
    database: ['sql', 'mongodb', 'postgres', 'mysql', 'redis', 'elasticsearch'],
    cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform'],
    testing: ['jest', 'mocha', 'pytest', 'junit', 'selenium'],
    devops: ['ci/cd', 'jenkins', 'git', 'devops', 'ansible'],
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  
  return 'other';
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: COMPLETE ATS SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate complete ATS score with all components
 * Integrates all scoring functions into a unified result
 * 
 * @param {object} resume - Resume object
 * @param {object} jobDescription - Job description with extractedKeywords
 * @param {function} completenessCalculator - Function to calculate completeness score
 * @param {function} formattingCalculator - Function to calculate formatting score
 * @param {function} readabilityCalculator - Function to calculate readability score
 * @returns {object} Complete ATS score with breakdown
 */
function calculateATSScore(resume, jobDescription, completenessCalculator, formattingCalculator, readabilityCalculator) {
  if (!resume) throw new Error('Resume required');
  if (!jobDescription) throw new Error('JobDescription required');
  
  // 1. Build searchable resume text
  const resumeText = buildSearchableText(resume);
  
  // 2. Extract JD keywords
  const jdKeywords = (jobDescription.extractedKeywords || [])
    .map(kw => (typeof kw === 'string' ? kw : kw?.keyword || '').trim())
    .filter(k => k.length > 1)
    .filter((k, i, a) => a.findIndex(x => x.toLowerCase() === k.toLowerCase()) === i);
  
  // 3. Calculate all scoring components
  const keywordScoring = calculateKeywordScore(resumeText, jdKeywords);
  const actionVerbScore = scoreActionVerbs(resume);
  const completenessScore = completenessCalculator ? completenessCalculator(resume) : 0;
  const formattingScore = formattingCalculator ? formattingCalculator(resume) : 0;
  const readabilityScore = readabilityCalculator ? readabilityCalculator(resume) : 0;
  
  // 4. Calculate weighted total
  const totalScore = Math.round(
    keywordScoring.score +
    (completenessScore / 100) * 20 +
    (formattingScore / 100) * 20 +
    actionVerbScore +
    (readabilityScore / 100) * 10
  );
  
  // 5. Return complete result
  return {
    score: Math.min(100, totalScore),
    breakdown: {
      keywordMatch: keywordScoring.score,
      sectionCompleteness: Math.round((completenessScore / 100) * 20),
      formatting: Math.round((formattingScore / 100) * 20),
      actionVerbs: actionVerbScore,
      readability: Math.round((readabilityScore / 100) * 10)
    },
    keywords: {
      matched: keywordScoring.matched,
      missing: keywordScoring.missing,
      matchPercentage: keywordScoring.percentage,
      totalCount: keywordScoring.count
    },
    missingKeywords: formatMissingKeywordsForFrontend(keywordScoring.missing),
    metadata: {
      resumeTextLength: resumeText.length,
      keywordCount: jdKeywords.length,
      calculatedAt: new Date().toISOString()
    }
  };
}

/**
 * Helper: Build searchable text from resume
 * Concatenates all relevant sections for keyword matching
 * 
 * @param {object} resume - Resume object
 * @returns {string} Concatenated searchable text (lowercase, basic cleanup)
 */
function buildSearchableText(resume) {
  const parts = [];
  
  // Skills
  (resume.skills || []).forEach(s => {
    if (typeof s === 'string') parts.push(s);
    else if (s?.items) parts.push(...s.items.map(String));
    else if (s?.name) parts.push(String(s.name));
  });
  
  // Summary
  if (resume.summary) parts.push(resume.summary);
  
  // Experience
  (resume.experience || []).forEach(exp => {
    parts.push(exp.role || exp.position || '');
    parts.push(exp.company || exp.companyName || '');
    parts.push(exp.description || '');
    parts.push(...(exp.bullets || exp.responsibilities || []));
  });
  
  // Projects
  (resume.projects || []).forEach(p => {
    parts.push(p.title || p.name || '');
    parts.push(p.description || '');
    if (p.techStack) parts.push(...p.techStack);
    parts.push(...(p.bullets || []));
  });
  
  // Education
  (resume.education || []).forEach(e => {
    parts.push(e.degree || '');
    parts.push(e.field || e.major || '');
    parts.push(e.school || e.university || '');
  });
  
  return parts.map(p => String(p || '').trim()).join(' ').toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Action Verbs
  ACTION_VERBS,
  detectActionVerbsInText,
  detectActionVerbs,
  scoreActionVerbs,
  
  // Keyword Matching
  KEYWORD_VARIATIONS,
  normalizeKeyword,
  getKeywordForms,
  calculateKeywordScore,
  getMissingKeywords,
  
  // Bullet Generation
  generateImprovedBullet,
  BULLET_TEMPLATES,
  
  // Score Improvement
  calculateScoreImprovement,
  formatScoreImprovement,
  
  // Missing Keywords
  formatMissingKeywordsForFrontend,
  categorizeMissingKeyword,
  
  // Complete ATS
  calculateATSScore,
  buildSearchableText,
};
