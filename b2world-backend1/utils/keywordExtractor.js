const natural = require('natural');
const { removeStopwords } = require('stopword');

/**
 * KeywordExtractor - Extracts keywords from job descriptions
 * Uses NLP techniques for tokenization and keyword identification
 */

// Common tech skills and tools - Expanded for 2024+
const TECH_KEYWORDS = [
  // Core Programming Languages
  'javascript', 'python', 'java', 'typescript', 'c++', 'c#', 'go', 'golang', 'rust', 'php',
  'ruby', 'kotlin', 'swift', 'scala', 'r', 'matlab', 'perl', 'dart',

  // Frontend Frameworks & Libraries
  'react', 'reactjs', 'next.js', 'nextjs', 'vue', 'vuejs', 'nuxt', 'angular', 'svelte', 'solid',
  'jquery', 'backbone', 'ember', 'preact', 'alpine.js',

  // Backend Frameworks
  'node', 'node.js', 'nodejs', 'express', 'express.js', 'nestjs', 'fastify', 'koa',
  'django', 'flask', 'fastapi', 'spring', 'spring boot', 'asp.net', '.net core',
  'laravel', 'symfony', 'rails', 'ruby on rails', 'gin', 'echo', 'fiber',

  // Databases
  'sql', 'mongodb', 'postgresql', 'postgres', 'mysql', 'mariadb', 'redis', 'elasticsearch',
  'dynamodb', 'cassandra', 'neo4j', 'sqlite', 'oracle', 'mssql', 'couchdb', 'firebase',
  'supabase', 'planetscale', 'cockroachdb', 'snowflake', 'bigquery',

  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud',
  'docker', 'kubernetes', 'k8s', 'jenkins', 'github actions', 'gitlab ci', 'circleci',
  'travis ci', 'terraform', 'ansible', 'puppet', 'chef', 'cloudformation',
  'serverless', 'lambda', 'ec2', 's3', 'ecs', 'eks', 'fargate',

  // Version Control & CI/CD
  'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial', 'ci/cd', 'continuous integration',
  'continuous deployment', 'continuous delivery',

  // API & Architecture
  'api', 'rest', 'restful', 'rest api', 'graphql', 'grpc', 'soap', 'websocket', 'webrtc',
  'microservices', 'monolithic', 'event-driven', 'message queue', 'rabbitmq', 'kafka',
  'pub/sub', 'api gateway',

  // Frontend Technologies
  'html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'styled-components', 'tailwind',
  'tailwindcss', 'bootstrap', 'material-ui', 'mui', 'chakra ui', 'ant design',
  'vite', 'rollup', 'parcel', 'babel', 'eslint', 'prettier',

  // Mobile Development
  'mobile', 'ios', 'android', 'react native', 'flutter', 'swiftui',
  'objective-c', 'xamarin', 'ionic', 'cordova', 'capacitor',

  // Testing
  'testing', 'test automation', 'unit testing', 'integration testing', 'e2e testing',
  'jest', 'mocha', 'chai', 'jasmine', 'cypress', 'selenium', 'playwright', 'puppeteer',
  'vitest', 'testing library', 'enzyme', 'junit', 'pytest', 'testng',

  // Data Science & ML
  'machine learning', 'ml', 'deep learning', 'ai', 'artificial intelligence',
  'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy',
  'data science', 'data analysis', 'analytics', 'statistical analysis', 'nlp',
  'natural language processing', 'computer vision', 'opencv',

  // Data Visualization & BI
  'tableau', 'power bi', 'looker', 'metabase', 'd3.js', 'chart.js', 'plotly',
  'excel', 'google sheets', 'data visualization', 'dashboards',

  // Design & UX
  'ui/ux', 'ui', 'ux', 'user experience', 'user interface', 'figma', 'sketch', 'adobe xd',
  'photoshop', 'illustrator', 'invision', 'zeplin', 'prototyping', 'wireframing',
  'responsive design', 'mobile first', 'accessibility', 'a11y', 'wcag',

  // Methodologies & Practices
  'agile', 'scrum', 'kanban', 'waterfall', 'lean', 'tdd', 'test-driven development',
  'bdd', 'behavior-driven development', 'pair programming', 'code review',
  'solid principles', 'design patterns', 'clean code', 'refactoring',

  // Project Management & Tools
  'jira', 'confluence', 'trello', 'asana', 'monday.com', 'notion', 'slack', 'teams',
  'linear', 'clickup', 'basecamp',

  // Security
  'oauth', 'jwt', 'authentication', 'authorization', 'encryption', 'ssl', 'tls',
  'security', 'penetration testing', 'vulnerability assessment', 'owasp',

  // Other Technologies
  'blockchain', 'web3', 'ethereum', 'solidity', 'smart contracts', 'cryptocurrency',
  'iot', 'raspberry pi', 'arduino', 'embedded systems',
  'seo', 'google analytics', 'gtm', 'google tag manager', 'performance optimization',
  'webpack', 'cdn', 'caching', 'load balancing', 'horizontal scaling', 'vertical scaling',
];

// PRODUCTION FIX: Tech skills whitelist for prioritization
// Only include proven, widely-used tech skills (no junk phrases)
const TECH_WHITELIST = [
  // Backend/Runtime
  'node.js', 'express', 'java', 'python', 'go', 'rust', 'php', '.net', 'asp.net',
  
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'ember', 'html', 'css',
  'tailwind', 'bootstrap', 'material-ui', 'webpack', 'vite',
  
  // Database
  'mongodb', 'postgresql', 'mysql', 'mariadb', 'redis', 'elasticsearch', 'cassandra',
  'dynamodb', 'firestore', 'supabase', 'oracle', 'mssql', 'sqlite',
  
  // Cloud
  'aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify', 'cloudflare', 'digitalocean',
  
  // DevOps/CI-CD
  'docker', 'kubernetes', 'jenkins', 'gitlab ci', 'github actions', 'terraform', 'ansible',
  'aws lambda', 'cloudformation', 'helm', 'prometheus', 'grafana',
  
  // API/Architecture
  'rest', 'graphql', 'grpc', 'websocket', 'jwt', 'oauth', 'saml', 'soap',
  'microservices', 'serverless', 'caching', 'cdn',
  
  // Testing
  'jest', 'mocha', 'cypress', 'selenium', 'jasmine', 'junit', 'pytest', 'rspec',
  'testing', 'tdd', 'bdd', 'e2e',
  
  // Languages & Type Systems
  'javascript', 'typescript', 'python', 'java', 'go', 'ruby', 'php', 'c#', 'rust',
  
  // Version Control
  'git', 'github', 'gitlab', 'bitbucket', 'svn',
  
  // Data/ML
  'machine learning', 'ai', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
  'sql', 'data structures', 'algorithms',
  
  // Mobile
  'react native', 'flutter', 'ios', 'android', 'swift', 'kotlin',
];

// Requirement context indicators (used for importance scoring)
const REQUIREMENT_INDICATORS = [
  'required', 'must have', 'should have', 'experience in', 'experience with',
  'knowledge of', 'proficient in', 'familiar with', 'strong understanding',
  'expertise in', 'skilled in', 'ability to', 'responsible for',
];

// Role detection keywords — each entry: [keyword, weight]
const ROLE_KEYWORDS = {
  'Senior Software Engineer': [
    ['senior software engineer', 10], ['sr. software engineer', 10], ['sr software engineer', 10],
    ['senior sde', 8], ['senior developer', 6], ['senior engineer', 5],
  ],
  'Full Stack Developer': [
    ['full stack developer', 10], ['fullstack developer', 10], ['full-stack developer', 10],
    ['full stack engineer', 8], ['full-stack engineer', 8],
    ['full stack', 3], ['fullstack', 3], ['full-stack', 3],
  ],
  'Frontend Developer': [
    ['frontend developer', 10], ['front-end developer', 10], ['frontend engineer', 8],
    ['front-end engineer', 8], ['ui developer', 7], ['ui engineer', 7],
    ['frontend', 2], ['front-end', 2],
  ],
  'Backend Developer': [
    ['backend developer', 10], ['back-end developer', 10], ['backend engineer', 8],
    ['back-end engineer', 8], ['server-side developer', 7],
    ['backend', 2], ['back-end', 2],
  ],
  'DevOps Engineer': [
    ['devops engineer', 10], ['devops developer', 8], ['site reliability engineer', 8],
    ['platform engineer', 6],
    ['devops', 5], ['infrastructure engineer', 4],
  ],
  'Data Scientist': [
    ['data scientist', 10], ['ml engineer', 8], ['machine learning engineer', 8],
    ['ai engineer', 7], ['research scientist', 6],
    ['machine learning', 2], ['data science', 2],
  ],
  'Data Analyst': [
    ['data analyst', 10], ['business analyst', 8], ['analytics engineer', 8],
    ['bi analyst', 7],
    ['analytics', 2], ['data analysis', 2],
  ],
  'Product Manager': [
    ['product manager', 10], ['product owner', 8], ['program manager', 7],
    ['roadmap', 2], ['stakeholder', 1],
  ],
  'UI/UX Designer': [
    ['ux designer', 10], ['ui designer', 10], ['ui/ux designer', 10],
    ['product designer', 8], ['interaction designer', 8],
    ['figma', 2], ['user experience', 2],
  ],
  'QA Engineer': [
    ['qa engineer', 10], ['quality assurance engineer', 10], ['test engineer', 8],
    ['sdet', 8], ['automation engineer', 6],
    ['quality assurance', 3], ['test automation', 2],
  ],
  'Mobile Developer': [
    ['mobile developer', 10], ['ios developer', 10], ['android developer', 10],
    ['react native developer', 8], ['flutter developer', 8],
    ['mobile engineer', 6],
  ],
  'Software Engineer': [
    ['software development engineer', 6], ['software engineer', 5],
    ['software developer', 5], ['sde', 4], ['engineer', 1],
  ],
};

class KeywordExtractor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf     = new natural.TfIdf();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  extract(jdText) {
    if (!jdText || typeof jdText !== 'string') {
      throw new Error('jdText must be a non-empty string');
    }

    const normalizedText = this.normalizeText(jdText);

    const skills           = this.extractSkills(normalizedText);
    const tools            = this.extractTools(normalizedText);
    // Pass original jdText so bullet/line characters are preserved
    const responsibilities = this.extractResponsibilities(jdText);
    const qualifications   = this.extractQualifications(jdText);
    const role             = this.detectRole(normalizedText);
    const experienceLevel  = this.detectExperienceLevel(jdText);
    const categorized      = this.categorizeKeywords(normalizedText, skills, tools);
    
    // 🔥 FIX #1: PRODUCTION HARDENING - Reduce keyword denominator
    // Original: All extracted keywords (40-60+) → Score ceiling at ~80
    // Fix: Keep only top 15-20 by importance + frequency
    // Result: Strong resume 18/20 = 90% (was 18/50 = 36%)
    const allKeywords = this.reduceKeywordsToPriority(categorized);
    console.log(`[ATS_HARDENING] Keywords: ${categorized.length} → ${allKeywords.length} (priority filtered)`);

    return {
      allKeywords,
      skills,
      tools,
      responsibilities,
      qualifications,
      role,
      experienceLevel,
      metadata: {
        wordCount:        normalizedText.split(/\s+/).length,
        skillsCount:      skills.length,
        toolsCount:       tools.length,
        hasEducationReq:  this.hasEducationRequirement(jdText),
        hasExperienceReq: this.hasExperienceRequirement(jdText),
        keywordsBeforeReduction:  categorized.length,
        keywordsAfterReduction:   allKeywords.length,
      },
    };
  }

  /**
   * 🔥 FIX #1: Reduce keywords to top 15-20 most important
   * Scores by importance (critical=3, high=2, medium=1) + frequency boost
   * Goal: Fix score ceiling of 80 when denominator is 40-60
   */
  reduceKeywordsToPriority(keywords) {
    if (!Array.isArray(keywords) || keywords.length === 0) return keywords;
    if (keywords.length <= 20) return keywords; // Already reasonable size
    
    const scored = keywords.map(kw => ({
      ...kw,
      priorityScore: (
        ({ critical: 3, high: 2, medium: 1 }[kw.importance || 'medium']) +
        ((kw.frequency || 0) * 0.1) +
        (kw.category === 'skill' ? 0.5 : 0)
      )
    }));
    
    scored.sort((a, b) => b.priorityScore - a.priorityScore);
    // Keep 15-20 keywords (or ~35% of total, whichever is smaller)
    const limit = Math.max(15, Math.min(20, Math.ceil(scored.length * 0.35)));
    const result = scored.slice(0, limit).map(({ priorityScore, ...kw }) => kw);
    
    // Safety: ensure minimum keywords returned (never empty from valid input)
    if (result.length === 0 && scored.length > 0) {
      console.warn('[KEYWORD_EXTRACT] WARNING: reduceKeywordsToPriority returned empty, fallback to first 15');
      return scored.slice(0, Math.min(15, scored.length)).map(({ priorityScore, ...kw }) => kw);
    }
    
    return result;
  }

  // ---------------------------------------------------------------------------
  // Text normalisation
  // ---------------------------------------------------------------------------

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\-\/\+\#\.]/g, ' ')  // keep technical chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------------------------
  // Skill / tool extraction
  // ---------------------------------------------------------------------------

  extractSkills(text) {
    // PRODUCTION FIX: Clean keyword extraction with normalization + deduplication
    return this.cleanExtractKeywords(text);
  }

  /**
   * PRODUCTION-GRADE KEYWORD EXTRACTION
   * Fixes: duplicates, noise, normalization, deduplication
   * 
   * Pipeline:
   * 1. Text cleaning (lowercase, punctuation)
   * 2. Phrase extraction (max 2-word noun phrases)
   * 3. Filter out noise (remove tracking stopwords)
   * 4. Tech normalization (node → node.js aliases)
   * 5. Deduplicate using Set
   * 6. Whitelist prioritization (tech skills first)
   * 7. Return top 10 clean keywords
   * 
   * Time Complexity: O(n) where n = text length
   * Space Complexity: O(k) where k = unique keywords
   */
  cleanExtractKeywords(text) {
    if (!text || typeof text !== 'string') return [];

    // ============================================================
    // STEP 1: Text Preprocessing
    // ============================================================
    const cleaned = this.preprocessText(text);

    // ============================================================
    // STEP 2: Extract candidate phrases (max 2 words)
    // ============================================================
    const candidates = this.extractPhrases(cleaned);

    // ============================================================
    // STEP 3: Filter noise (phrases ending with stopwords)
    // ============================================================
    const filtered = this.filterNoisy(candidates);

    // ============================================================
    // STEP 4: Normalize tech aliases
    // ============================================================
    const normalized = this.normalizeTech(filtered);

    // ============================================================
    // STEP 5: Deduplicate
    // ============================================================
    const unique = Array.from(new Set(normalized));

    // ============================================================
    // STEP 6: Prioritize real tech skills + whitelist boost
    // ============================================================
    const scored = unique.map(keyword => ({
      keyword,
      score: this.scoreKeyword(keyword, cleaned)
    }));

    // Sort: whitelist matches first, then by score
    scored.sort((a, b) => {
      const aIsWhitelisted = TECH_WHITELIST.includes(a.keyword);
      const bIsWhitelisted = TECH_WHITELIST.includes(b.keyword);
      
      if (aIsWhitelisted !== bIsWhitelisted) {
        return aIsWhitelisted ? -1 : 1;
      }
      return b.score - a.score;
    });

    // ============================================================
    // STEP 7: Return top 10 keywords
    // ============================================================
    return scored.slice(0, 10).map(item => item.keyword);
  }

  /**
   * Step 1: Preprocess text
   * - Lowercase
   * - Remove punctuation (keep tech-relevant chars like +, #, -)
   * - Trim whitespace
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\+\#\.\-\/]/g, ' ') // Keep: +, #, ., -, /
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Step 2: Extract noun phrases (max 2 words)
   * - Match 1-2 word phrases
   * - Filter for tech-like patterns (contains letters/numbers/symbols)
   * 
   * Time: O(n) where n = word count
   */
  extractPhrases(text) {
    const words = text.split(/\s+/);
    const phrases = new Set();

    // Single words
    words.forEach(word => {
      if (word.length >= 2 && /[a-z0-9\+\#]/.test(word)) {
        phrases.add(word);
      }
    });

    // Two-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];

      if (word1.length >= 2 && word2.length >= 2) {
        const phrase = `${word1} ${word2}`;
        // Only keep if looks technical (contains letters/numbers/tech chars)
        if (/[a-z0-9]/.test(phrase)) {
          phrases.add(phrase);
        }
      }
    }

    return Array.from(phrases);
  }

  /**
   * Step 3: Filter out noisy phrases
   * Remove phrases ending with common stopwords that indicate noise
   * 
   * Examples:
   * ❌ "software developer with" → remove "with"
   * ❌ "a software developer" → remove "a"
   * ❌ "are looking" → generic phrase
   * ❌ "in java" → starts with "in"
   * ✅ "software developer" → keep
   * ✅ "java" → keep
   */
  filterNoisy(phrases) {
    // Trailing stopwords that indicate incomplete/noisy phrases
    const trailingStopwords = [
      'with', 'and', 'or', 'the', 'a', 'an', 'as', 'in', 'of', 'by',
      'for', 'to', 'from', 'on', 'at', 'is', 'are', 'be', 'have', 'who', 'that'
    ];
    
    // Leading stopwords that create noisy 2-word phrases
    const leadingStopwords = [
      'the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'by', 'to', 'for', 'and', 'or'
    ];
    
    // Generic phrases with no tech content (remove entirely)
    const genericPhrases = new Set([
      'are looking', 'we are', 'are seeking', 'looking for', 'seeking', 'we seek',
      'experience in', 'experience with', 'requirements', 'required', 'must have',
      'culture fit', 'team fit', 'background in', 'candidates', 'our team',
      'something new', 'something exciting', 'stay updated', 'keep up',
      'industry', 'world', 'this point', 'day one', 'time'
    ]);

    return phrases.filter(phrase => {
      if (!phrase) return false;
      
      const lower = phrase.toLowerCase().trim();
      
      // Filter out generic phrases
      if (genericPhrases.has(lower)) return false;
      
      // Must have at least one letter/number
      if (!/[a-z0-9]/i.test(phrase)) return false;

      // Don't end with tracking stopwords
      const words = phrase.split(/\s+/);
      const lastWord = words[words.length - 1].toLowerCase();
      if (trailingStopwords.includes(lastWord)) return false;

      // For 2-word phrases, don't start with stopwords
      if (words.length === 2) {
        const firstWord = words[0].toLowerCase();
        if (leadingStopwords.includes(firstWord)) return false;
      }
      
      // Single-word filters: remove common non-tech words
      if (words.length === 1) {
        const singleWordJunk = [
          'experience', 'opportunity', 'role', 'position', 'team', 'company',
          'culture', 'background', 'requirements', 'candidate', 'person',
          'something', 'working', 'etc', 'co', 'amp', 'ability'
        ];
        if (singleWordJunk.includes(lower)) return false;
      }

      return true;
    });
  }

  /**
   * Step 4: Normalize tech aliases to canonical forms
   * node → node.js, nodejs → node.js, mongo → mongodb, etc.
   * 
   * Time: O(n) where n = number of phrases
   */
  normalizeTech(phrases) {
    const TECH_NORMALIZATION_MAP = {
      // JavaScript/Node.js ecosystem
      'node': 'node.js',
      'nodejs': 'node.js',
      'node js': 'node.js',
      'express.js': 'express',
      'expressjs': 'express',
      'express js': 'express',
      'next.js': 'next.js',
      'nextjs': 'next.js',
      'next js': 'next.js',
      'react.js': 'react',
      'reactjs': 'react',
      'react js': 'react',
      'vue.js': 'vue',
      'vuejs': 'vue',
      'vue js': 'vue',
      'nuxt.js': 'nuxt',
      'nuxtjs': 'nuxt',
      'nuxt js': 'nuxt',
      'angular.js': 'angular',
      'angularjs': 'angular',
      'angular js': 'angular',

      // Database
      'mongo': 'mongodb',
      'mongodb': 'mongodb',
      'mongo db': 'mongodb',
      'postgres': 'postgresql',
      'postgresql': 'postgresql',
      'postgre sql': 'postgresql',
      'mariadb': 'mariadb',
      'maria db': 'mariadb',
      'mssql': 'mssql',
      'ms sql': 'mssql',
      'sql server': 'mssql',

      // Backend frameworks
      'spring boot': 'spring boot',
      'django': 'django',
      'flask': 'flask',
      'fastapi': 'fastapi',
      'fast api': 'fastapi',
      'aspnet': 'asp.net',
      'asp net': 'asp.net',
      '.net core': '.net',
      '.net': '.net',

      // API & Architecture
      'rest': 'rest',
      'restful': 'rest',
      'rest api': 'rest',
      'graphql': 'graphql',
      'graph ql': 'graphql',
      'grpc': 'grpc',
      'web socket': 'websocket',
      'websocket': 'websocket',

      // Cloud
      'aws': 'aws',
      'amazon web services': 'aws',
      'azure': 'azure',
      'gcp': 'gcp',
      'google cloud': 'gcp',

      // DevOps
      'docker': 'docker',
      'kubernetes': 'kubernetes',
      'k8s': 'kubernetes',
      'jenkins': 'jenkins',
      'github actions': 'github actions',
      'gitlab ci': 'gitlab ci',

      // Frontend
      'html5': 'html',
      'html': 'html',
      'css3': 'css',
      'css': 'css',
      'tailwind': 'tailwind',
      'tailwind css': 'tailwind',
      'material ui': 'material-ui',
      'materialui': 'material-ui',

      // Languages
      'javascript': 'javascript',
      'java script': 'javascript',
      'typescript': 'typescript',
      'type script': 'typescript',
      'python': 'python',
      'java': 'java',
      'ruby': 'ruby',
      'go': 'go',
      'golang': 'go',
      'go lang': 'go',
      'rust': 'rust',
      'php': 'php',
      'csharp': 'c#',
      'c sharp': 'c#',

      // Testing
      'jest': 'jest',
      'mocha': 'mocha',
      'jasmine': 'jasmine',
      'cypress': 'cypress',
      'selenium': 'selenium',
      'playwright': 'playwright',
      'unit testing': 'testing',
      'integration testing': 'testing',
      'e2e testing': 'testing',
      'end to end testing': 'testing',

      // Other
      'git': 'git',
      'github': 'github',
      'gitlab': 'gitlab',
      'bitbucket': 'bitbucket',
      'data structures': 'data structures',
      'algorithms': 'algorithms',
      'machine learning': 'machine learning',
      'ml': 'machine learning',
      'ai': 'ai',
      'artificial intelligence': 'ai',
    };

    return phrases.map(phrase => {
      const lower = phrase.toLowerCase();
      return TECH_NORMALIZATION_MAP[lower] || phrase;
    });
  }

  /**
   * Step 5: Score keyword based on whitelist + presence in text
   * Whitelist matches score higher
   * Frequent mentions score higher
   * 
   * Time: O(1) for whitelist check, O(m) for frequency count
   */
  scoreKeyword(keyword, text) {
    let score = 0;

    // Whitelist boost
    if (TECH_WHITELIST.includes(keyword.toLowerCase())) {
      score += 100;
    }

    // Frequency boost (how many times mentioned)
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = (text.match(regex) || []).length;
    score += Math.min(matches * 10, 30); // Cap at 30

    // Length bonus (longer, more specific keywords)
    score += keyword.split(/\s+/).length;

    return score;
  }

  extractTools(text) {
    const toolKeywords = [
      'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
      'slack', 'docker', 'kubernetes', 'jenkins', 'travis', 'circleci',
      'aws', 'azure', 'gcp', 'heroku', 'netlify', 'vercel',
      'vscode', 'intellij', 'eclipse', 'visual studio',
    ];

    const tools = new Set();
    toolKeywords.forEach(tool => {
      const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) tools.add(tool);
    });
    return Array.from(tools);
  }

  extractTechnicalPhrases(text) {
    const phrases = new Set();
    const words   = text.split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) {
      const two   = `${words[i]} ${words[i + 1]}`;
      const three = i < words.length - 2 ? `${words[i]} ${words[i + 1]} ${words[i + 2]}` : '';

      if (this.isTechnicalPhrase(two))            phrases.add(two);
      if (three && this.isTechnicalPhrase(three)) phrases.add(three);
    }
    return Array.from(phrases);
  }

  isTechnicalPhrase(phrase) {
    const patterns = [
      /\b(web|mobile|cloud|data|software|system|network|database|front.?end|back.?end|full.?stack)\s+(development|engineering|architecture|design|analysis|developer|engineer)\b/,
      /\b(rest|restful|graphql|soap|grpc)\s+(api|endpoint|service)\b/,
      /\b(unit|integration|end.?to.?end|e2e|regression|smoke|load|stress|performance)\s+(testing|test|tests)\b/,
      /\b(machine|deep|reinforcement|supervised|unsupervised)\s+(learning|learning model)\b/,
      /\b(natural language|computer)\s+(processing|vision)\b/,
      /\b(neural|convolutional|recurrent)\s+network\b/,
      /\b(continuous|ci.?cd)\s+(integration|deployment|delivery)\b/,
      /\b(container|service)\s+orchestration\b/,
      /\b(infrastructure|configuration)\s+(as code|management)\b/,
      /\b(cloud|serverless|microservices)\s+architecture\b/,
      /\b(object.?oriented|functional|procedural|declarative)\s+programming\b/,
      /\b(responsive|adaptive|mobile.?first)\s+design\b/,
      /\b(user|customer)\s+(experience|interface|research|testing)\b/,
      /\b(ui.?ux|ux.?ui)\s+(design|designer|research)\b/,
      /\b(agile|scrum|kanban|waterfall|lean)\s+(methodology|development|framework)\b/,
      /\b(test.?driven|behavior.?driven|domain.?driven)\s+development\b/,
      /\b(data|business)\s+(analytics|intelligence|visualization|warehouse|lake|pipeline|mining)\b/,
      /\b(real.?time|batch)\s+processing\b/,
      /\b(etl|elt)\s+pipeline\b/,
      /\b(version|source)\s+control\b/,
      /\b(code|peer)\s+review\b/,
      /\b(penetration|security)\s+testing\b/,
      /\b(vulnerability|risk)\s+assessment\b/,
      /\b(performance|load)\s+optimization\b/,
      /\b(horizontal|vertical)\s+scaling\b/,
      /\b(test.?driven\s+development|behavior.?driven\s+development|domain.?driven\s+design)\b/,
      /\b(single\s+page\s+application|progressive\s+web\s+app|software\s+development\s+lifecycle)\b/,
      /\b(application\s+programming\s+interface|representational\s+state\s+transfer)\b/,
    ];
    return patterns.some(p => p.test(phrase));
  }

  // ---------------------------------------------------------------------------
  // Responsibilities & qualifications
  // ---------------------------------------------------------------------------

  /**
   * FIX: The original regex used corrupted UTF-8 bytes (â€¢) instead of the
   * actual bullet character (•).  Also fixed \d+ inside [] which matched a
   * literal '+', not "one or more digits".
   */
  extractResponsibilities(text) {
    const results = [];
    for (const line of text.split(/[\n\r]+/)) {
      const trimmed = line.trim();
      if (
        /^[•\-*]|^\d+\./.test(trimmed) ||
        /^(responsible for|will be|you will|develop|design|implement|maintain|create|build)/i.test(trimmed)
      ) {
        const cleaned = trimmed.replace(/^[•\-*]\s*|^\d+\.\s*/, '').trim();
        if (cleaned.length > 20 && cleaned.length < 200) results.push(cleaned);
      }
    }
    return results.slice(0, 10);
  }

  /** FIX: same bullet-character correction as extractResponsibilities */
  extractQualifications(text) {
    const results    = [];
    const qualPattern = /(bachelor|master|degree|diploma|certification|years of experience|experience with|experience in)/i;

    for (const line of text.split(/[\n\r]+/)) {
      const trimmed = line.trim();
      if (qualPattern.test(trimmed)) {
        const cleaned = trimmed.replace(/^[•\-*]\s*|^\d+\.\s*/, '').trim();
        if (cleaned.length > 15 && cleaned.length < 200) results.push(cleaned);
      }
    }
    return results.slice(0, 8);
  }

  // ---------------------------------------------------------------------------
  // Role & experience detection
  // ---------------------------------------------------------------------------

  detectRole(text) {
    const lowerText = text.toLowerCase();
    const titleText = lowerText.slice(0, 200); // job-title area
    let bestMatch = 'Software Engineer';
    let maxScore  = 0;

    for (const [role, entries] of Object.entries(ROLE_KEYWORDS)) {
      let score = 0;
      for (const [keyword, weight] of entries) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex   = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(lowerText)) {
          const titleBoost = regex.test(titleText) ? 2 : 1;
          score += weight * titleBoost;
        }
      }
      if (score > maxScore) { maxScore = score; bestMatch = role; }
    }
    return bestMatch;
  }

  /**
   * FIX: check seniority from HIGH → LOW so a senior JD mentioning
   * "junior engineers" (as subordinates) never returns 'Entry'.
   * FIX: Mid-level regex widened to cover ranges like "4-6 years".
   * FIX: em-dash (–) added alongside hyphen (-) in year-range patterns.
   */
  detectExperienceLevel(text) {
    const t = text.toLowerCase();

    if (/\b(10\+\s*years?|manager|director|head of|vp|vice president|executive|c-level|cto|ceo)\b/i.test(t)) {
      return 'Executive';
    }
    if (/\b(8\+\s*years?|7[-–]\d+|8[-–]\d+|lead\s+engineer|principal|staff\s+engineer|tech\s+lead|engineering\s+manager)\b/i.test(t)) {
      return 'Lead';
    }
    if (/\b(5\+\s*years?|5[-–]\d+|senior\s+software|senior\s+engineer|senior\s+developer|sr\.?\s*software|sr\.?\s*engineer|experienced\s+engineer)\b/i.test(t)) {
      return 'Senior';
    }
    // Broadened: covers "2-5 years", "3-6 years", "4-6 years", etc.
    if (/\b([2-4][-–][4-7]\s*years?|mid[-\s]level|intermediate\s+(developer|engineer))\b/i.test(t)) {
      return 'Mid';
    }
    if (/\b(0[-–][12]\s*years?|fresher|entry[-\s]level\s+(role|position|candidate|engineer)|recent\s+graduate|new\s+graduate|intern)\b/i.test(t)) {
      return 'Entry';
    }
    return 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  hasEducationRequirement(text) {
    return /(bachelor|master|degree|diploma|education|b\.tech|b\.e\.|m\.tech|mba)/i.test(text);
  }

  hasExperienceRequirement(text) {
    return /(\d+\+?\s*years?|experience|proven track record)/i.test(text);
  }

  categorizeKeywords(text, skills, tools) {
    const keywords = [];
    const seen     = new Set();

    const add = (keyword, category) => {
      const key = keyword.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      keywords.push({
        keyword,
        frequency:  this.countOccurrences(text, keyword),
        category,
        importance: this.calculateKeywordImportance(text, keyword),
      });
    };

    skills.forEach(s => add(s, 'skill'));
    tools.forEach(t  => add(t,  'tool'));

    const order = { critical: 3, high: 2, medium: 1 };
    keywords.sort((a, b) => {
      const d = (order[b.importance] || 0) - (order[a.importance] || 0);
      return d !== 0 ? d : b.frequency - a.frequency;
    });
    return keywords;
  }

  calculateKeywordImportance(text, keyword) {
    const lowerText = text.toLowerCase();
    const escaped   = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const critical = ['required','must have','mandatory','essential','critical','need to have','necessary','core competency'];
    const high     = ['strong','proficient','expert','advanced','extensive experience','deep understanding','solid knowledge','years of experience with'];

    const ctxRegex = new RegExp(`.{0,50}${escaped}.{0,50}`, 'gi');
    for (const match of (lowerText.match(ctxRegex) || [])) {
      if (critical.some(i => match.includes(i))) return 'critical';
      if (high.some(i => match.includes(i)))     return 'high';
    }
    return this.countOccurrences(text, keyword) >= 3 ? 'high' : 'medium';
  }

  countOccurrences(text, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
    return matches ? matches.length : 0;
  }
}

module.exports = new KeywordExtractor();