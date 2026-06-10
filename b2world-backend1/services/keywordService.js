/**
 * Unified Keyword Extraction Service
 * 
 * Robust, generic keyword extraction for ANY job description.
 * Role-agnostic, deterministic, production-safe.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
  'must', 'shall', 'am', 'as', 'this', 'that', 'these', 'those', 'you', 'your',
  'we', 'our', 'they', 'their', 'he', 'she', 'it', 'its', 'them', 'who', 'which', 'what',
  'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'either', 'neither',
  'some', 'any', 'no', 'not', 'only', 'just', 'same', 'such', 'than', 'then', 'now',
  'also', 'very', 'too', 'quite', 'rather'
]);

const GENERIC_WORDS = new Set([
  'experience', 'knowledge', 'ability', 'skill', 'skills', 'year', 'years',
  'company', 'employer', 'team', 'work', 'working', 'job', 'position', 'role',
  'responsibility', 'responsibilities', 'requirement', 'requirements', 'qualification',
  'qualifications', 'duty', 'duties', 'candidate', 'applicant', 'employment',
  'salary', 'benefits', 'location', 'remote', 'hybrid', 'fulltime', 'full-time',
  'parttime', 'part-time', 'contract', 'temporary', 'permanent', 'junior', 'mid',
  'senior', 'lead', 'manager', 'director', 'head', 'chief', 'principal', 'staff',
  'plus', 'nice', 'good', 'great', 'excellent', 'strong', 'proven', 'track', 'record',
  'ideal', 'preferred', 'desired', 'looking', 'seeking', 'want', 'need', 'must',
  'should', 'would', 'could', 'may', 'might', 'able', 'capable', 'comprehensive',
  'demonstrated', 'proven', 'established', 'successful', 'effective', 'efficient'
]);

const LOCATION_WORDS = new Set([
  'pune', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'kolkata',
  'hyderabad', 'pune', 'india', 'usa', 'uk', 'europe', 'asia', 'singapore',
  'dubai', 'uae', 'canada', 'australia', 'germany', 'france', 'london', 'nyc',
  'new york', 'san francisco', 'seattle', 'boston', 'chicago', 'los angeles',
  'on-site', 'onsite', 'offsite', 'off-site', 'noida', 'gurgaon', 'gurugram'
]);

const TECH_HINTS = new Set([
  'javascript', 'java', 'python', 'typescript', 'c++', 'c#', 'golang', 'go',
  'rust', 'kotlin', 'swift', 'ruby', 'php', 'scala', 'r', 'perl', 'shell',
  'react', 'angular', 'vue', 'svelte', 'nextjs', 'next.js', 'nodejs', 'node.js',
  'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'fastapi',
  'aws', 'azure', 'gcp', 'google cloud', 'heroku', 'digitalocean',
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'gitlab',
  'github', 'bitbucket', 'jira', 'confluence',
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra',
  'dynamodb', 'firestore', 'sqlite', 'mariadb', 'oracle', 'mssql',
  'sql', 'nosql', 'graphql', 'rest', 'grpc', 'http', 'api',
  'microservice', 'microservices', 'monolith', 'serverless', 'lambda',
  'machine learning', 'ml', 'ai', 'deep learning', 'tensorflow', 'pytorch',
  'data science', 'analytics', 'statistics', 'visualization', 'tableau', 'powerbi',
  'agile', 'scrum', 'kanban', 'jira', 'ci/cd', 'cicd', 'devops', 'sre',
  'linux', 'unix', 'windows', 'macos', 'bash', 'powershell',
  'git', 'svn', 'mercurial', 'version control',
  'testing', 'unit test', 'integration test', 'e2e', 'selenium', 'jest',
  'cypress', 'junit', 'pytest', 'mocha', 'jasmine',
  'oop', 'oops', 'functional', 'imperative', 'declarative',
  'design pattern', 'mvc', 'mvvm', 'clean code', 'solid', 'dry', 'kiss'
]);

const ALIAS_MAP = {
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'python': 'python',
  'py': 'python',
  'java': 'java',
  'nodejs': 'node.js',
  'node js': 'node.js',
  'node': 'node.js',
  'reactjs': 'react',
  'react.js': 'react',
  'angularjs': 'angular',
  'angular.js': 'angular',
  'vuejs': 'vue',
  'vue.js': 'vue',
  'postgresql': 'postgresql',
  'postgres': 'postgresql',
  'mongodb': 'mongodb',
  'mongo': 'mongodb',
  'mysql': 'mysql',
  'redis': 'redis',
  'elasticsearch': 'elasticsearch',
  'es': 'elasticsearch',
  'aws': 'aws',
  'amazon web services': 'aws',
  'azure': 'azure',
  'microsoft azure': 'azure',
  'gcp': 'gcp',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'docker': 'docker',
  'k8s': 'kubernetes',
  'kubernetes': 'kubernetes',
  'terraform': 'terraform',
  'cicd': 'ci/cd',
  'ci/cd': 'ci/cd',
  'rest api': 'rest api',
  'restful': 'rest api',
  'graphql': 'graphql',
  'grpc': 'grpc',
  'microservice': 'microservices',
  'microservices': 'microservices',
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
  'dl': 'deep learning',
  'ux': 'user experience',
  'ui': 'user interface'
};

// Cache for extracted keywords per JD
const keywordCache = new Map();

/**
 * CRITICAL FIX: Normalize text - keep spaces!
 * Previous bug: removing all whitespace broke keyword matching
 */
const normalize = (text = "") => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // keep spaces!
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Alias for backward compatibility
 */
const normalizeText = normalize;

/**
 * Extract unigrams and bigrams from text
 */
const extractNgrams = (text, n = 2) => {
  const tokens = text.split(/\s+/).filter(t => t.length > 0);
  const ngrams = [];
  
  // Add unigrams
  tokens.forEach(token => ngrams.push(token));
  
  // Add bigrams
  if (n >= 2) {
    for (let i = 0; i < tokens.length - 1; i++) {
      ngrams.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }
  
  return ngrams;
};

/**
 * Check if a token is a technical hint
 */
const isTechnicalHint = (token) => {
  const lower = token.toLowerCase();
  return TECH_HINTS.has(lower) || 
         [...TECH_HINTS].some(hint => lower.includes(hint)) ||
         /\d+%?$/.test(token);
};

/**
 * Calculate technical weight score for a keyword
 */
const getTechnicalWeight = (keyword) => {
  const lower = keyword.toLowerCase();
  
  if (TECH_HINTS.has(lower)) return 10;
  if ([...TECH_HINTS].some(hint => lower.includes(hint))) return 5;
  if (/v\d+/.test(keyword)) return 8;
  
  const toolPatterns = ['js', 'api', 'sql', 'db', 'ui', 'ux', 'ci', 'cd'];
  if (toolPatterns.some(p => lower.endsWith(p))) return 6;
  
  return 1;
};

/**
 * Main keyword extraction function
 */
const extractKeywordsFromJD = (jdText, limit = 30) => {
  if (!jdText || typeof jdText !== 'string') {
    return [];
  }
  
  const truncatedText = jdText.substring(0, 10000);
  
  const textHash = Buffer.from(truncatedText).toString('base64').substring(0, 32);
  if (keywordCache.has(textHash)) {
    return keywordCache.get(textHash).slice(0, limit);
  }
  
  const normalized = normalize(truncatedText);
  const ngrams = extractNgrams(normalized, 2);
  const keywordScores = new Map();
  
  ngrams.forEach(ngram => {
    const tokens = ngram.split(/\s+/);
    
    if (tokens.some(t => STOPWORDS.has(t))) return;
    if (tokens.some(t => GENERIC_WORDS.has(t))) return;
    if (tokens.some(t => LOCATION_WORDS.has(t))) return;
    if (tokens.some(t => t.length < 2)) return;
    if (/^\d+$/.test(ngram)) return;
    
    const mapped = ALIAS_MAP[ngram.toLowerCase()] || ngram;
    const currentScore = keywordScores.get(mapped) || 0;
    const techWeight = getTechnicalWeight(mapped);
    keywordScores.set(mapped, currentScore + techWeight);
  });
  
  const sorted = [...keywordScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([keyword]) => keyword);
  
  const unique = [...new Set(sorted)].slice(0, limit);
  
  keywordCache.set(textHash, unique);
  
  if (keywordCache.size > 100) {
    const firstKey = keywordCache.keys().next().value;
    keywordCache.delete(firstKey);
  }
  
  return unique;
};

/**
 * CRITICAL FIX: Universal resume text builder
 * Concatenates all resume sections for keyword matching
 */
const buildResumeText = (resume) => {
  if (!resume || typeof resume !== 'object') {
    console.log('[KEYWORD_SERVICE] buildResumeText: Invalid resume object');
    return '';
  }

  const sections = [];

  // Log resume state for debugging
  console.log('[KEYWORD_SERVICE] buildResumeText:');
  console.log('  - Summary exists:', !!resume.summary);
  console.log('  - Skills count:', resume.skills?.length || 0);
  console.log('  - Experience count:', resume.experience?.length || 0);
  console.log('  - Projects count:', resume.projects?.length || 0);

  // Summary
  if (resume.summary) {
    sections.push(resume.summary);
  }

  // Skills
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(s => {
      if (Array.isArray(s.items)) {
        sections.push(...s.items);
      }
    });
  }

  // Experience
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      if (Array.isArray(exp.bullets)) {
        sections.push(...exp.bullets);
      }
    });
  }

  // Projects
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) {
        sections.push(...p.bullets);
      }
    });
  }

  // Achievements
  if (Array.isArray(resume.achievements)) {
    sections.push(...resume.achievements);
  }

  // Certifications
  if (Array.isArray(resume.certifications)) {
    sections.push(...resume.certifications);
  }

  const combinedText = sections.join(' ');
  const normalizedText = normalize(combinedText);

  console.log('[KEYWORD_SERVICE] Resume text built:', normalizedText.length, 'chars');

  return normalizedText;
};

/**
 * CRITICAL FIX: Correct keyword match calculation
 * Simple includes check after normalization
 */
const calculateKeywordMatch = (jdKeywords, resumeText) => {
  console.log('[KEYWORD_SERVICE] calculateKeywordMatch called:');
  console.log('  - jdKeywords:', jdKeywords?.length || 0);
  console.log('  - resumeText:', resumeText?.substring(0, 100) || '(empty)');

  if (!jdKeywords || !Array.isArray(jdKeywords) || !resumeText) {
    return {
      keywordMatch: 0,
      matchedKeywords: [],
      missingKeywords: []
    };
  }

  const normalizedResume = normalize(resumeText);
  const matched = [];
  const missing = [];
  
  jdKeywords.forEach(keyword => {
    const normalizedKeyword = normalize(keyword);
    if (normalizedResume.includes(normalizedKeyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const total = jdKeywords.length;
  const matchPercent = total > 0 ? Math.round((matched.length / total) * 100) : 0;

  console.log('[KEYWORD_SERVICE] Match result:', {
    matched: matched.length,
    missing: missing.length,
    total: total,
    percent: matchPercent
  });

  return {
    keywordMatch: matchPercent,
    matchedKeywords: matched,
    missingKeywords: missing
  };
};

const clearKeywordCache = () => {
  keywordCache.clear();
};

module.exports = {
  extractKeywordsFromJD,
  buildResumeText,
  calculateKeywordMatch,
  clearKeywordCache,
  normalize,
  normalizeText,
  TECH_HINTS,
  ALIAS_MAP
};
