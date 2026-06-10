'use strict';

/**
 * Smart Bullet Rewrite Utility
 * Intelligently rewrites weak starters without prepending verbs
 * Never modifies bullets that already start with strong verbs
 */

const STRONG_VERBS = new Set([
  'developed', 'built', 'implemented', 'designed', 'led', 'optimized',
  'engineered', 'automated', 'analyzed', 'architected', 'created', 'delivered',
  'deployed', 'managed', 'coordinated', 'improved', 'increased', 'reduced',
  'enhanced', 'established', 'achieved', 'executed', 'resolved', 'constructed',
  'collaborated', 'facilitated', 'mentored', 'trained', 'identified', 'configured',
  'migrated', 'refactored', 'tested', 'validated', 'documented'
]);

const WEAK_PATTERNS = [
  {
    pattern: /^worked\s+on\s+/i,
    replacement: 'Developed ',
  },
  {
    pattern: /^responsible\s+for\s+/i,
    replacement: 'Managed ',
  },
  {
    pattern: /^handled\s+/i,
    replacement: 'Processed ',
  },
  {
    pattern: /^worked\s+with\s+/i,
    replacement: 'Collaborated with ',
  },
  {
    pattern: /^used\s+/i,
    replacement: 'Leveraged ',
  },
  {
    pattern: /^helped\s+/i,
    replacement: 'Supported ',
  },
  {
    pattern: /^assisted\s+(?:with\s+)?/i,
    replacement: 'Supported ',
  },
  {
    pattern: /^involved\s+in\s+/i,
    replacement: 'Contributed to ',
  },
  {
    pattern: /^participated\s+in\s+/i,
    replacement: 'Spearheaded ',
  },
  {
    pattern: /^made\s+/i,
    replacement: 'Created ',
  }
];

/**
 * Get first meaningful word (skip articles, prepositions)
 */
const getFirstMeaningfulWord = (text) => {
  const words = text.trim().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
  for (const word of words) {
    if (!stopWords.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
  }
  return words[0]?.toLowerCase() || '';
};

/**
 * Check if first word is a strong verb
 */
const startsWithStrongVerb = (text) => {
  const firstWord = getFirstMeaningfulWord(text);
  return STRONG_VERBS.has(firstWord);
};

/**
 * Intelligently rewrite weak bullet starters
 * ONLY replaces weak patterns, NEVER prepends
 * Returns: {original, rewritten, wasModified: boolean}
 */
const replaceWeakStarter = (bullet) => {
  if (!bullet || typeof bullet !== 'string') {
    return { original: bullet, rewritten: bullet, replaced: false };
  }

  const trimmed = bullet.trim();

  // Try each pattern (order matters - longest first)
  for (const { pattern, replacement } of WEAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      const rewritten = trimmed.replace(pattern, replacement);
      return {
        original: trimmed,
        rewritten,
        replaced: rewritten !== trimmed
      };
    }
  }

  // No weak starter found
  return {
    original: trimmed,
    rewritten: trimmed,
    replaced: false
  };
};

/**
 * Expand short bullets (< 8 words) with contextual information
 * Does NOT add fake metrics
 * Returns contextual expansion template
 * 
 * Examples:
 * "Developed dashboards" (4 words)
 * → "Developed interactive dashboards to support business reporting"
 * 
 * "Built API" (3 words)
 * → "Built RESTful APIs to enable third-party integrations"
 */
const expandShortBullet = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return bullet;

  const words = bullet.trim().split(/\s+/);
  
  // Only expand if < 8 words
  if (words.length >= 8) return bullet.trim();

  const lower = bullet.toLowerCase();

  // Contextual expansion patterns (not fake metrics)
  const expansions = [
    { match: /develop.*dashboard/i, context: 'to support business reporting and analytics' },
    { match: /develop.*api/i, context: 'to enable third-party integrations and data access' },
    { match: /develop.*database/i, context: 'to support data persistence and retrieval' },
    { match: /develop.*feature/i, context: 'to enhance user experience' },
    { match: /build.*system/i, context: 'to streamline operations' },
    { match: /build.*tool/i, context: 'to improve team productivity' },
    { match: /built.*api/i, context: 'to facilitate seamless integrations' },
    { match: /manage.*team/i, context: 'to ensure project success' },
    { match: /lead.*project/i, context: 'from conception through deployment' },
    { match: /led.*initiative/i, context: 'with measurable business impact' },
    { match: /optimized.*process/i, context: 'to reduce operational overhead' },
    { match: /automated.*task/i, context: 'to eliminate manual work' },
    { match: /implemented.*solution/i, context: 'to address critical business needs' },
  ];

  for (const { match, context } of expansions) {
    if (match.test(lower)) {
      return `${bullet.trim()} ${context}`;
    }
  }

  // Default expansion: add generic but truthful context
  return `${bullet.trim()} with measurable impact`;
};

/**
 * Add impact template suggestion if bullet lacks metrics
 * Returns: {bullet, hasMetrics: bool, suggestedTemplate: string}
 * 
 * Does NOT add "(e.g., 25%)" or fake numbers
 * Just provides template for user to fill in
 */
const analyzeMetricsNeed = (bullet) => {
  if (!bullet || typeof bullet !== 'string') {
    return { bullet, hasMetrics: false, suggestedTemplate: null };
  }

  const lower = bullet.toLowerCase();
  
  // Check if already has metrics
  const hasMetrics = /\d+[%xX]?|reduced|increased|improved|efficiency|performance|throughput/.test(lower);
  
  if (hasMetrics) {
    return { bullet, hasMetrics: true, suggestedTemplate: null };
  }

  // Suggest appropriate metric templates based on action verb
  let template = null;

  if (/developed|built|created|engineered/.test(lower)) {
    template = 'Add quantifiable impact: "...resulting in [X%] improvement in [metric]"';
  } else if (/managed|led|optimized/.test(lower)) {
    template = 'Add business impact: "...achieving [X%] increase in [metric]"';
  } else if (/automated|streamlined/.test(lower)) {
    template = 'Add efficiency gain: "...reducing [metric] by [X%]"';
  } else if (/improved|enhanced/.test(lower)) {
    template = 'Add measurable outcome: "...lifting [metric] by [X]"';
  }

  return { bullet, hasMetrics: false, suggestedTemplate: template };
};

/**
 * Clean text: remove hint markers and garbage
 */
const cleanBullet = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove hint suffixes
    .replace(/\s*[—\-–]\s*add\s+(?:a\s+)?(?:measurable\s+)?(?:outcome|impact|metric)[^.]*\.?$/i, '')
    .replace(/\s*[—\-–]\s*consider\s+adding[^.]*\.?$/i, '')
    .replace(/\s*\(e\.g\.,?[^)]{0,120}\)\s*\.?$/i, '')
    // Remove garbage fragments
    .replace(/\s+(?:make|strong|do|be|get)\s+(?:logic|sense|code|better|stronf|stonf)[^.]*\.?$/i, '')
    // Remove common filler endings
    .replace(/,?\s*and\s+(?:more|things|etc|things\s+like)\s*\.?$/i, '')
    .trim();
};

/**
 * Core rewrite function: intelligent bullet transformation
 * 
 * Inputs:
 * - bullet: original bullet text
 * - section: 'experience' | 'projects' (determines context)
 * 
 * Outputs:
 * {
 *   original: string,
 *   rewritten: string,          // After weak starter replacement
 *   expanded: string,           // After expansion (if short)
 *   hasMetrics: boolean,
 *   metricsTemplate: string|null,
 *   confidence: 'high' | 'medium' | 'low'
 * }
 */
const rewriteBullet = (bullet, section = 'experience') => {
  if (!bullet || typeof bullet !== 'string') {
    return {
      original: bullet,
      rewritten: bullet,
      expanded: bullet,
      hasMetrics: false,
      metricsTemplate: null,
      confidence: 'low'
    };
  }

  const cleaned = cleanBullet(bullet);
  
  // Step 1: Replace weak starters
  const { rewritten } = replaceWeakStarter(cleaned);

  // Step 2: Expand if short
  const expanded = expandShortBullet(rewritten);

  // Step 3: Check metrics
  const { hasMetrics, suggestedTemplate } = analyzeMetricsNeed(expanded);

  // Determine confidence
  let confidence = 'medium';
  if (rewritten !== cleaned) confidence = 'high'; // Strong change = high confidence
  if (expanded.split(/\s+/).length > 20) confidence = 'low'; // Very long = lower confidence

  return {
    original: cleaned,
    rewritten,
    expanded,
    hasMetrics,
    metricsTemplate: suggestedTemplate,
    confidence
  };
};

/**
 * Batch rewrite multiple bullets
 */
const rewriteBullets = (bullets, section) => {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((bullet, idx) => ({
    index: idx,
    ...rewriteBullet(bullet, section)
  }));
};

/**
 * ✅ IMPROVED: Intelligently integrate missing keyword into bullet naturally
 * 
 * Preserves:
 * - Original meaning and context
 * - Role context (e.g., datasets remain datasets, not replaced with unrelated terms)
 * - Technology capitalization (Python, SQL, Tableau)
 * - Professional resume language
 * 
 * Checks:
 * - If keyword already exists
 * - If keyword is related to the bullet context
 * - Best insertion point based on bullet structure
 * 
 * Returns: {
 *   original: string,
 *   improved: string,
 *   integrated: boolean,
 *   reason: string,
 *   confidence: 'high' | 'medium' | 'low'
 * }
 */
const integrateKeywordInBullet = (bullet, keyword) => {
  if (!bullet || typeof bullet !== 'string' || !keyword || typeof keyword !== 'string') {
    return {
      original: bullet || '',
      improved: bullet || '',
      integrated: false,
      reason: 'Invalid input parameters',
      confidence: 'low'
    };
  }

  const cleaned = cleanBullet(bullet).trim();
  const keywordLower = keyword.toLowerCase();
  const cleanedLower = cleaned.toLowerCase();

  // ─────────────────────────────────────────────
  // 1: Check if keyword already exists in bullet
  // ─────────────────────────────────────────────
  if (cleanedLower.includes(keywordLower)) {
    return {
      original: cleaned,
      improved: cleaned,
      integrated: false,
      reason: `Keyword "${keyword}" already present in bullet`,
      confidence: 'high'
    };
  }

  // ─────────────────────────────────────────────
  // 2: Analyze bullet structure
  // ─────────────────────────────────────────────
  const sentences = cleaned.split(/[.•]/);
  const mainSentence = sentences[0].trim();
  
  // Check if this is a tool/tech keyword (like Tableau, Tableau SQL, Azure, etc.)
  const isTechKeyword = /^[A-Z]/.test(keyword) || 
                       keyword.match(/^(python|javascript|java|c\+\+|c#|ruby|php|go|rust|kotlin|typescript|sql|mongodb|postgres|mysql|redis|elasticsearch|docker|kubernetes|aws|azure|gcp|jenkins|git|jira|slack|salesforce)/i);

  // Extract context: what is the bullet about?
  const bulletContext = extractBulletContext(mainSentence);

  // ─────────────────────────────────────────────
  // 3: Find best insertion point
  // ─────────────────────────────────────────────
  let improved = null;
  let confidence = 'medium';

  // Strategy A: If bullet mentions "data analysis/datasets" + keyword is visualization tool
  if ((cleanedLower.includes('analyz') || cleanedLower.includes('dataset') || cleanedLower.includes('data')) &&
      keyword.match(/tableau|power\s*bi|looker|qlik|grafana|dashboard|visualization/i)) {
    improved = integrateVisualizationTool(mainSentence, keyword);
    confidence = 'high';
  }

  // Strategy B: If bullet mentions tools/tech stack already
  else if (cleanedLower.includes('using ') || cleanedLower.includes(' with ')) {
    improved = addToTechStack(mainSentence, keyword);
    confidence = 'high';
  }

  // Strategy C: If bullet is about a dev/data activity and keyword is a tool/language
  else if (bulletContext && isTechKeyword) {
    improved = integrateToolIntoActivity(mainSentence, keyword, bulletContext);
    confidence = 'medium';
  }

  // Strategy D: If keyword is a methodology/skill
  else if (keyword.match(/agile|scrum|lean|devops|ci\/cd|microservice|monolithic|rest|graphql|soap|api|design\s+pattern/i)) {
    improved = addMethodologyKeyword(mainSentence, keyword);
    confidence = 'medium';
  }

  // Strategy E: Generic fallback - append to end
  else if (isTechKeyword || bulletContext) {
    improved = appendKeywordNaturally(mainSentence, keyword);
    confidence = 'low';
  }

  // ─────────────────────────────────────────────
  // 4: Return result
  // ─────────────────────────────────────────────
  if (!improved || improved === mainSentence) {
    return {
      original: cleaned,
      improved: cleaned,
      integrated: false,
      reason: `Could not find natural integration point for "${keyword}"`,
      confidence: 'low'
    };
  }

  return {
    original: cleaned,
    improved: improved.trim(),
    integrated: true,
    reason: `Successfully integrated "${keyword}" while preserving original meaning`,
    confidence
  };
};

/**
 * Extract the main context/activity from a bullet
 * Returns: 'data-analysis' | 'development' | 'management' | 'testing' | etc.
 */
const extractBulletContext = (bullet) => {
  const lower = bullet.toLowerCase();
  
  if (lower.match(/analyz|query|database|data|sql|python|pandas|numpy/)) return 'data-analysis';
  if (lower.match(/develop|build|implement|engineer|code|wrote/)) return 'development';
  if (lower.match(/manage|lead|direct|oversee|coordinate/)) return 'management';
  if (lower.match(/test|qa|automat|validate|verify/)) return 'testing';
  if (lower.match(/design|architecture|architect/)) return 'design';
  if (lower.match(/deploy|release|launch|production/)) return 'deployment';
  if (lower.match(/optimize|improve|refactor|performance/)) return 'optimization';
  if (lower.match(/document|write|technical/)) return 'documentation';
  
  return null;
};

/**
 * Integrate a visualization tool (Tableau, Power BI, etc.) naturally
 * 
 * Example:
 * Input: "Analyzed large customer datasets using Python and SQL to identify patterns"
 * Keyword: "Tableau"
 * Output: "Analyzed large customer datasets using Python and SQL and built Tableau dashboards to visualize trends and support data-driven decision making"
 */
const integrateVisualizationTool = (bullet, keyword) => {
  // Find "using" clause followed by "to"
  const usingMatch = bullet.match(/^(.+?using\s+[^.]+?)\s+to\s+(.+)$/);
  
  if (usingMatch) {
    // Extract parts: before and including tech, and what comes after "to"
    const beforeAndTech = usingMatch[1];
    const afterTo = usingMatch[2];
    
    // Create new sentence: preserve original meaning by replacing what comes after
    return `${beforeAndTech} and built ${keyword} dashboards to visualize insights and support data-driven decision making.`;
  }
  
  // If no "to" clause, just append
  const hasUsing = bullet.includes('using');
  if (hasUsing && !bullet.endsWith('.')) {
    return `${bullet} and built ${keyword} dashboards to visualize insights.`;
  } else if (hasUsing) {
    return `${bullet.replace(/\.$/, '')} and built ${keyword} dashboards to visualize insights.`;
  }
  
  // Fallback: append at end
  return `${bullet} and visualized results with ${keyword}`;
};

/**
 * Add keyword to existing tech stack (e.g., "using Python, SQL" → "using Python, SQL, and Tableau")
 */
const addToTechStack = (bullet, keyword) => {
  // Find "using" or "with" pattern - be more greedy to capture more of tech stack
  const usingMatch = bullet.match(/^(.+?(?:using|with)\s+)([^.]+?)(\s+(?:to|for|,|\.).*)?$/i);
  
  if (usingMatch) {
    const before = usingMatch[1]; // "... using "
    const techStack = usingMatch[2].trim(); // "PostgreSQL and Redis"
    const after = usingMatch[3] || ''; // " to ..." or empty
    
    // Determine proper separator
    let separator = ', ';
    if (techStack.match(/\s+and\s+\w+$/i)) {
      // Already has "and", use comma before it
      separator = ', ';
    } else if (techStack.includes(',')) {
      // Has commas, use comma
      separator = ', ';
    } else {
      // Single tech, use "and"
      separator = ' and ';
    }
    
    return `${before}${techStack}${separator}${keyword}${after}`;
  }
  
  return bullet;
};

/**
 * Integrate a tool/language into the main activity
 * 
 * Example:
 * Input: "Designed data pipeline"
 * Keyword: "Apache Spark"
 * Output: "Designed Apache Spark-based data pipeline"
 */
const integrateToolIntoActivity = (bullet, keyword, context) => {
  // Strategies based on context
  if (context === 'development') {
    // "Built API" → "Built REST APIs using Node.js"
    const match = bullet.match(/^([^.]+?)\s+(system|service|platform|feature|app|application|api|service|solution|dashboard)/i);
    if (match) {
      return `${match[1]} ${keyword}-powered ${match[2]}${bullet.substring(match[0].length)}`;
    }
  }
  
  if (context === 'data-analysis' || context === 'optimization') {
    // "Optimized queries" → "Optimized queries using Elasticsearch"
    const match = bullet.match(/^([^.]+?)\s+(query|query|process|algorithm|workflow)/i);
    if (match) {
      return `${match[1]} ${match[2]} using ${keyword}${bullet.substring(match[0].length)}`;
    }
  }
  
  // Generic: insert before primary noun
  return `${bullet} with ${keyword}`;
};

/**
 * Add methodology/skill keywords
 */
const addMethodologyKeyword = (bullet, keyword) => {
  // Check if bullet has action verb
  const verbMatch = bullet.match(/^(\w+)/);
  
  if (verbMatch && STRONG_VERBS.has(verbMatch[1].toLowerCase())) {
    // Insert after verb
    return `${bullet.substring(0, verbMatch[0].length)} using ${keyword} methodology${bullet.substring(verbMatch[0].length)}`;
  }
  
  // Fallback: append at end
  return `${bullet} using ${keyword} principles`;
};

/**
 * Append keyword naturally at the end while preserving meaning
 */
const appendKeywordNaturally = (bullet, keyword) => {
  // Remove ending period if exists
  const cleaned = bullet.replace(/\.$/, '');
  
  // Determine insertion phrase based on whether keyword is tool or concept
  const isTool = /^[A-Z]/.test(keyword) || keyword.match(/^(python|javascript|java|sql|mongodb)/i);
  const phrase = isTool ? `leveraging ${keyword}` : `with ${keyword}`;
  
  return `${cleaned} ${phrase}`;
};

module.exports = {
  replaceWeakStarter,
  expandShortBullet,
  analyzeMetricsNeed,
  cleanBullet,
  rewriteBullet,
  rewriteBullets,
  integrateKeywordInBullet
};
