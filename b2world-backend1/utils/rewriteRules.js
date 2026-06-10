/**
 * ================================================================================
 * RULE-BASED REWRITE ENGINE - Core Utilities
 * ================================================================================
 * Professional suggestion rewriting without LLM/OpenAI
 * Uses rule-based NLP: tokenization, verb detection, impact templates
 * ================================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// STRONG ACTION VERBS (for experience/projects)
// ─────────────────────────────────────────────────────────────────────────────

const STRONG_VERBS = new Set([
  'architected', 'developed', 'engineered', 'implemented', 'designed',
  'optimized', 'improved', 'enhanced', 'led', 'owned', 'delivered',
  'reduced', 'increased', 'scaled', 'revolutionized', 'transformed',
  'pioneered', 'spearheaded', 'accelerated', 'streamlined', 'automated',
  'eliminated', 'boosted', 'amplified', 'expedited', 'established',
  'managed', 'coordinated', 'orchestrated', 'deployed', 'launched',
  'integrated', 'consolidated', 'migrated', 'analyzed', 'evaluated'
]);

// ─────────────────────────────────────────────────────────────────────────────
// WEAK ACTION VERBS (to be replaced)
// ─────────────────────────────────────────────────────────────────────────────

const WEAK_VERBS = new Set([
  'worked', 'helped', 'did', 'made', 'created', 'used', 'had', 'was',
  'is', 'are', 'been', 'being', 'have', 'has', 'do', 'does', 'went',
  'came', 'got', 'took', 'gave', 'found', 'tried', 'tried to', 'attempt',
  'seemed', 'appeared', 'looked', 'felt', 'started', 'began', 'kept',
  'provided', 'utilized', 'executed', 'performed', 'handled'
]);

// ─────────────────────────────────────────────────────────────────────────────
// WEAK VERB → STRONG VERB REPLACEMENTS
// ─────────────────────────────────────────────────────────────────────────────

// ✅ IMPROVED: Better verb replacements with proper context
const VERB_REPLACEMENTS = {
  'worked': 'Developed',        // Worked on APIs → Developed APIs
  'helped': 'Built',             // Helped build dashboard → Built dashboard
  'assisted': 'Supported',       // Assisted in project → Supported project
  'participated': 'Collaborated', // Participated in → Collaborated on
  'handled': 'Managed',          // Handled database → Managed database
  'did': 'Delivered',
  'made': 'Built',
  'created': 'Engineered',
  'used': 'Leveraged',
  'tried': 'Pioneered',
  'provided': 'Delivered',
  'utilized': 'Leveraged',
  'started': 'Initiated',
  'began': 'Launched',
  'executed': 'Implemented',
  'performed': 'Optimized'
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC WORDS (to be removed for cleaner suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_WORDS = new Set([
  'some', 'very', 'really', 'quite', 'just', 'basically', 'obviously',
  'stuff', 'things', 'etc', 'various', 'several', 'many', 'a lot of',
  'something', 'anything', 'nothing'
]);

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT KEYWORDS (to detect what type of impact to add)
// ─────────────────────────────────────────────────────────────────────────────

const IMPACT_PATTERNS = {
  performance: ['speed', 'performance', 'latency', 'response', 'load', 'throughput'],
  scalability: ['scale', 'scalable', 'load', 'capacity', 'users', 'traffic', 'grows'],
  efficiency: ['efficient', 'optimize', 'reduce', 'improve', 'faster', 'better'],
  quality: ['quality', 'bug', 'defect', 'error', 'stability', 'reliability'],
  cost: ['cost', 'budget', 'save', 'reduce', 'expensive', 'price'],
  ux: ['user', 'experience', 'interface', 'frontend', 'ui', 'design', 'usability'],
  database: ['database', 'query', 'sql', 'mongo', 'redis', 'cache', 'data']
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT TEMPLATES (contextual impact based on category)
// ✅ FIXED: Realistic, natural improvement templates (no fake metrics)
// ─────────────────────────────────────────────────────────────────────────────

const IMPACT_TEMPLATES = {
  performance: [
    'improving system performance',
    'enhancing API responsiveness',
    'optimizing load times',
    'accelerating request processing'
  ],
  scalability: [
    'supporting efficient backend services',
    'enabling horizontal scaling',
    'handling increased system load',
    'supporting application growth'
  ],
  efficiency: [
    'improving operational efficiency',
    'reducing manual overhead',
    'automating routine tasks',
    'streamlining workflows'
  ],
  quality: [
    'improving code quality',
    'enhancing system reliability',
    'ensuring application stability',
    'maintaining code standards'
  ],
  cost: [
    'optimizing resource utilization',
    'reducing infrastructure overhead',
    'improving cost efficiency',
    'optimizing operational costs'
  ],
  ux: [
    'improving user experience',
    'enhancing interface usability',
    'increasing user satisfaction',
    'supporting better user interactions'
  ],
  database: [
    'optimizing database operations',
    'improving query efficiency',
    'enhancing data management',
    'optimizing data storage'
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// TECH STACK KEYWORDS (to extract from context)
// ─────────────────────────────────────────────────────────────────────────────

const TECH_KEYWORDS = {
  languages: ['javascript', 'python', 'java', 'typescript', 'go', 'rust', 'kotlin', 'swift', 'c++'],
  frameworks: ['react', 'angular', 'vue', 'express', 'django', 'spring', 'fastapi', 'next.js'],
  databases: ['postgres', 'mongodb', 'mysql', 'redis', 'cassandra', 'dynamodb', 'firestore'],
  tools: ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'jenkins', 'git', 'gitlab', 'github'],
  methodologies: ['agile', 'scrum', 'kanban', 'ci/cd', 'tdd', 'bdd', 'microservices']
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean and tokenize text into words
 * @param {string} text
 * @returns {string[]} Array of lowercase words
 */
const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
};

/**
 * Remove common stopwords
 * @param {string[]} tokens
 * @returns {string[]} Filtered tokens
 */
const removeStopwords = (tokens) => {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'is', 'was', 'are', 'be']);
  return tokens.filter(token => !stopwords.has(token) && token.length > 2);
};

/**
 * Check if text starts with weak verb
 * @param {string} text
 * @returns {object} { isWeak: boolean, verb: string, replacement: string }
 */
const detectWeakVerb = (text) => {
  if (!text) return { isWeak: false, verb: null, replacement: null };

  const tokens = tokenize(text);
  if (tokens.length === 0) return { isWeak: false, verb: null, replacement: null };

  const firstWord = tokens[0];
  const isWeak = WEAK_VERBS.has(firstWord);
  const replacement = VERB_REPLACEMENTS[firstWord] || null;

  return { isWeak, verb: firstWord, replacement };
};

/**
 * Detect impact category from text
 * @param {string} text
 * @returns {string} Impact category (performance, scalability, etc.)
 */
const detectImpactCategory = (text) => {
  if (!text) return 'efficiency';

  const tokens = tokenize(text).join(' ');

  for (const [category, keywords] of Object.entries(IMPACT_PATTERNS)) {
    if (keywords.some(kw => tokens.includes(kw))) {
      return category;
    }
  }

  return 'efficiency'; // default
};

const getImpactStatement = (text) => {
  const category = detectImpactCategory(text);
  const templates = IMPACT_TEMPLATES[category] || IMPACT_TEMPLATES.efficiency;
  // DETERMINISTIC: pick template based on text content hash, not random
  // Same bullet always gets same suggestion — critical for consistent UX
  let hash = 0;
  for (let i = 0; i < (text || '').length; i++) {
    hash = ((hash << 5) - hash) + (text || '').charCodeAt(i);
    hash |= 0;
  }
  return templates[Math.abs(hash) % templates.length];
};

/**
 * Check if text has metrics/numbers
 * @param {string} text
 * @returns {boolean}
 */
const hasMetrics = (text) => {
  if (!text) return false;
  return /\d+(\.\d+)?(%|K|M|x|ms|s|hrs|hours|seconds|days)?/i.test(text);
};

/**
 * Extract technologies from text
 * @param {string} text
 * @returns {string[]} Array of detected technologies
 */
const extractTechs = (text) => {
  if (!text) return [];

  const lower = text.toLowerCase();
  const techs = [];

  for (const category in TECH_KEYWORDS) {
    for (const tech of TECH_KEYWORDS[category]) {
      if (lower.includes(tech)) {
        techs.push(tech);
      }
    }
  }

  return [...new Set(techs)]; // remove duplicates
};

/**
 * Check if bullet is strong (has verb, metrics, and length)
 * @param {string} bullet
 * @returns {object} { isStrong: boolean, weakPoints: string[] }
 */
const analyzeBullet = (bullet) => {
  if (!bullet) return { isStrong: false, weakPoints: ['Empty bullet'] };

  const weakPoints = [];
  const tokens = tokenize(bullet);

  // Check 1: Has strong verb
  const firstWord = tokens[0] || '';
  if (WEAK_VERBS.has(firstWord)) {
    weakPoints.push('weak_verb');
  } else if (!STRONG_VERBS.has(firstWord)) {
    weakPoints.push('no_verb');
  }

  // Check 2: Has metrics
  if (!hasMetrics(bullet)) {
    weakPoints.push('no_metrics');
  }

  // Check 3: Proper length (min 8 words)
  if (tokens.length < 8) {
    weakPoints.push('too_short');
  }

  return {
    isStrong: weakPoints.length === 0,
    weakPoints
  };
};

/**
 * Create unique suggestion key for deduplication
 * @param {string} section
 * @param {string} originalText
 * @param {string} type
 * @returns {string}
 */
const createSuggestionKey = (section, originalText, type) => {
  return `${section}|${(originalText || '').toLowerCase().trim()}|${type}`;
};

/**
 * Rewrite keyword into experience section naturally
 * @param {string} keyword
 * @param {string} bullet
 * @returns {string} Rewritten bullet with keyword
 */
const rewriteBulletWithKeyword = (keyword, bullet) => {
  if (!keyword || !bullet) return bullet;

  const tokenized = tokenize(bullet);
  if (tokenized.length === 0) return bullet;

  // ✅ IMPROVED: Create natural rewrites instead of templated ones
  
  // Check if keyword already exists
  if (bullet.toLowerCase().includes(keyword.toLowerCase())) {
    return bullet; // No change needed
  }

  // Get strong verb (first word)
  const firstWord = tokenized[0];
  const strongVerb = VERB_REPLACEMENTS[firstWord?.toLowerCase()] || 
    (firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1) : 'Developed');

  // Remove weak verb and get rest of bullet
  const rest = tokenized.slice(1).join(' ').trim();

  // Try to inject keyword naturally into the sentence
  // Strategy: Add keyword after strong verb or in "using/with" clause
  
  // Check if rest has "using/with/leveraging" pattern
  const usingMatch = rest.match(/^(.+?)(using|with|leveraging|via)\s+(.+?)(\.|,|$)/i);
  
  if (usingMatch) {
    // Inject keyword into existing "using..." clause
    const [, prefix, connector, tools, suffix] = usingMatch;
    const allTools = [keyword, ...tools.split(',').map(t => t.trim())];
    return `${strongVerb} ${prefix}${connector} ${allTools.join(', ')}${suffix}`;
  }

  // Try to inject keyword into main verb phrase
  // Example: "developing web tools" → "developing React web tools"
  const verbPhraseMatch = rest.match(/^(.+?)(project|application|tool|system|service|feature|module|component)/i);
  
  if (verbPhraseMatch) {
    const [, descriptor, subject] = verbPhraseMatch;
    const remaining = rest.substring(verbPhraseMatch[0].length);
    return `${strongVerb} ${keyword} ${descriptor}${subject}${remaining}`;
  }

  // Fallback: append keyword naturally with "using"
  // Example: "Assisted in tool development" → "Developed tools using React"
  return `${strongVerb} ${rest.replace(/^(in |the |)/, '')} using ${keyword}.`;
};

/**
 * ✅ NEW: Create natural skill context rewrite
 * Instead of awkward keyword insertion, add contextual tech skills sentence
 */
const createSkillContextBullet = (keyword, originalBullet) => {
  if (!keyword || !originalBullet) return originalBullet;
  
  const keywords = keyword.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keywords.length === 0) return originalBullet;

  // Build a proper skills context  
  const skillsText = keywords.join(', ');
  return originalBullet.includes(skillsText) 
    ? originalBullet 
    : `${originalBullet} Expertise in ${skillsText}.`;
};

/**
 * ✅ FIXED: Check if a bullet is already improved
 * Prevents looping suggestions by detecting already-improved content
 * @param {string} bullet
 * @returns {boolean} True if bullet should NOT be suggested again
 */
const isAlreadyImproved = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return false;

  const lower = bullet.toLowerCase();
  
  // Keywords that indicate sentence is already improved
  const improvedKeywords = [
    'resulting in',
    'improving',
    'optimizing', 
    'developing',
    'implemented',
    'engineered',
    'architected',
    'deployed',
    'managed',
    'built',
    'supported',
    'delivered',
    'enhanced',
    'streamlined',
    'automated',
    'collaborat', // collaborated, collaborating
    'leveraging',
    'utilizing'
  ];

  // If bullet contains strong action verbs typical of improved content, skip it
  return improvedKeywords.some(keyword => lower.includes(keyword));
};

/**
 * ✅ FIX #2, #5, #8: Determine if suggestion should be generated
 * Prevents looping and duplicate suggestions with comprehensive checks
 * @param {string} bullet
 * @param {string} type - weak_verb, missing_metrics, weak_bullet, etc.
 * @returns {boolean} True only if safe to suggest
 */
const shouldSuggest = (bullet, type = 'general') => {
  if (!bullet || typeof bullet !== 'string') return false;
  
  const lowerBullet = bullet.toLowerCase();
  
  // ✅ FIX #2, #8: Core guard - never suggest if already improved
  // Contains keywords indicating already rewritten
  const improvementIndicators = [
    'resulting in', 'improved', 'optimized', 'developed', 'implemented',
    'built', 'engineered', 'architected', 'designed', 'created',
    'deployed', 'launched', 'established', 'transformed'
  ];
  if (improvementIndicators.some(ind => lowerBullet.includes(ind))) {
    return false;  // Already improved
  }
  
  // ✅ FIX #5: Prevent duplicate impact phrases in same bullet
  const impactPhrases = [
    'resulting in', 'by ', 'improving', 'reducing', 'increasing',
    'enhancing', 'supporting', 'enabling'
  ];
  const impactCount = impactPhrases.filter(phrase => lowerBullet.includes(phrase)).length;
  if (impactCount > 1) {
    return false;  // Already has multiple impact phrases
  }
  
  // Type-specific checks
  if (type === 'weak_verb') {
    const { isWeak } = detectWeakVerb(bullet);
    return isWeak && bullet.length >= 5;  // Only suggest if weak verb detected
  }
  
  if (type === 'missing_metrics') {
    // Only suggest if: no metrics AND sufficient length AND no existing impact
    const hasExistingMetrics = hasMetrics(bullet);
    const hasExistingImpact = impactPhrases.some(phrase => lowerBullet.includes(phrase));
    return !hasExistingMetrics && !hasExistingImpact && bullet.length > 20;
  }
  
  if (type === 'weak_bullet') {
    // Only suggest if bullet is truly weak
    const { isWeak } = detectWeakVerb(bullet);
    return isWeak && !hasMetrics(bullet) && bullet.length >= 8;
  }
  
  return true;  // Safe default
};

/**
 * ✅ FIX #2, #3, #5, #7, #8: Natural bullet improvement without fake metrics
 * Creates ATS-friendly improvements with proper length and no duplicate impact
 * @param {string} bullet
 * @returns {string} Strengthened bullet or original if already improved
 */
const improveBulletPoint = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return bullet;
  
  // ✅ FIX #2, #8: Guard - skip if already improved (prevents looping)
  if (isAlreadyImproved(bullet)) return bullet;
  
  const { isWeak, verb, replacement } = detectWeakVerb(bullet);
  if (!isWeak || !replacement) return bullet;  // No weak verb found
  
  // Extract tokens and remove weak verb
  const tokens = tokenize(bullet);
  tokens.shift();  // Remove weak verb from start
  const rest = tokens.join(' ').trim();
  
  // ✅ FIX #5: Clean verbose prepositions without creating duplicates
  const cleanRest = rest
    .replace(/^(for the|the|in|on|with|by|from|to)\s+/i, '')
    .trim();
  
  // Build improved: Strong Verb + Object
  let improved = `${replacement} ${cleanRest}`;
  
  // ✅ FIX #3, #5: Remove any existing metrics/impact to prevent duplicates
  // (clean up before adding new impact)
  const fakeMetricsPatterns = [
    /,\s*resulting in \d+[x%+k].*$/i,  // "resulting in 10x..."
    /,\s*improving by \d+[%x].*$/i,    // "improving by 40%..."
    /,\s*reducing \d+[%x].*$/i,        // "reducing 50%..."
    /,\s*saving \$\d+.*$/i              // "saving $50K..."
  ];
  for (const pattern of fakeMetricsPatterns) {
    improved = improved.replace(pattern, '');
  }
  
  // Normalize ending
  improved = improved.replace(/\.+$/, '').trim();
  if (!improved.endsWith('.')) improved += '.';
  
  // ✅ FIX #7: Ensure ATS-friendly length (8-18 words)
  const words = improved.split(/\s+/).filter(w => w);
  if (words.length > 18) {
    improved = words.slice(0, 18).join(' ') + '.';
  } else if (words.length < 5) {
    // Too short, return original
    return bullet;
  }
  
  return improved;
};

/**
 * ✅ FIX #3,#5,#7: Strengthen a weak experience bullet
 * Uses improved point logic with fake metric removal and ATS optimization
 * @param {string} bullet
 * @returns {string} Strengthened bullet
 */
const strengthenBullet = (bullet) => {
  // First try to improve the point
  let strengthened = improveBulletPoint(bullet);
  
  // If improvement didn't work, try direct rewrite
  if (strengthened === bullet) {
    const { replacement } = detectWeakVerb(bullet);
    if (replacement) {
      strengthened = bullet.replace(/^\w+/i, replacement);
    }
  }
  
  return strengthened;
};

module.exports = {
  STRONG_VERBS,
  WEAK_VERBS,
  VERB_REPLACEMENTS,
  GENERIC_WORDS,
  IMPACT_PATTERNS,
  IMPACT_TEMPLATES,
  TECH_KEYWORDS,
  
  // Functions
  tokenize,
  removeStopwords,
  detectWeakVerb,
  detectImpactCategory,
  getImpactStatement,
  hasMetrics,
  extractTechs,
  analyzeBullet,
  createSuggestionKey,
  rewriteBulletWithKeyword,
  createSkillContextBullet,
  strengthenBullet,
  // ✅ NEW: Safe suggestion guards
  isAlreadyImproved,
  shouldSuggest,
  improveBulletPoint
};
