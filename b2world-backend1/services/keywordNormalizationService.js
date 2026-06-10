/**
 * PRODUCTION ATS KEYWORD NORMALIZATION SERVICE
 * 
 * Handles:
 * - Keyword normalization (js → JavaScript, node → Node.js)
 * - Stopword/ignore list filtering
 * - Technical skill categorization
 * - Priority weighting
 */

class KeywordNormalizationService {
  constructor() {
    // Keyword normalization mapping (non-technical variations)
    this.normalizationMap = {
      'js': 'JavaScript',
      'node': 'Node.js',
      'node.js': 'Node.js',
      'nodej': 'Node.js',
      'mongo': 'MongoDB',
      'mongodb': 'MongoDB',
      'rest': 'REST API',
      'api': 'REST API',
      'aws': 'AWS',
      'gcp': 'Google Cloud',
      'azure': 'Microsoft Azure',
      'reactjs': 'React',
      'react.js': 'React',
      'react js': 'React',
      'vuejs': 'Vue.js',
      'vue.js': 'Vue.js',
      'angular.js': 'Angular',
      'angularjs': 'Angular',
      'typescript': 'TypeScript',
      'ts': 'TypeScript',
      'python3': 'Python',
      'py': 'Python',
      'sql': 'SQL',
      'mysql': 'MySQL',
      'postgres': 'PostgreSQL',
      'postgresql': 'PostgreSQL',
      'redis': 'Redis',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'k8s': 'Kubernetes',
      'jenkins': 'Jenkins',
      'git': 'Git',
      'github': 'GitHub',
      'gitlab': 'GitLab',
      'bitbucket': 'Bitbucket',
      'jira': 'Jira',
      'agile': 'Agile',
      'scrum': 'Scrum',
      'oop': 'Object-Oriented Programming',
      'oops': 'Object-Oriented Programming',
      'mvc': 'MVC',
      'mvvm': 'MVVM',
      'rest api': 'REST API',
      'graphql': 'GraphQL',
      'webpack': 'Webpack',
      'npm': 'NPM',
      'yarn': 'Yarn',
      'gradle': 'Gradle',
      'maven': 'Maven',
      'junit': 'JUnit',
      'testing': 'Testing',
      'ci/cd': 'CI/CD',
      'cicd': 'CI/CD',
      'devops': 'DevOps',
      'microservices': 'Microservices',
      'rest': 'REST API',
      'soap': 'SOAP',
      'json': 'JSON',
      'xml': 'XML',
      'html5': 'HTML5',
      'css3': 'CSS3',
      'css': 'CSS',
      'html': 'HTML',
      'responsive': 'Responsive Design',
      'junit5': 'JUnit',
      'mockito': 'Mockito',
      'selenium': 'Selenium',
      'junit4': 'JUnit',
      // ── Data Science ────────────────────────────────────────────────
      'scikit':           'Scikit-learn',
      'scikit-learn':     'Scikit-learn',
      'scikit learn':     'Scikit-learn',
      'sklearn':          'Scikit-learn',
      'ml':               'Machine Learning',
      'dl':               'Deep Learning',
      'nlp':              'Natural Language Processing',
      'powerbi':          'Power BI',
      'power bi':         'Power BI',
      'matplotlib':       'Matplotlib',
      'seaborn':          'Seaborn',
      'numpy':            'NumPy',
      'np':               'NumPy',
      'pandas':           'Pandas',
      'pd':               'Pandas',
      'pytorch':          'PyTorch',
      'torch':            'PyTorch',
      'tensorflow':       'TensorFlow',
      'tf':               'TensorFlow',
      'keras':            'Keras',
      'spark':            'Apache Spark',
      'pyspark':          'Apache Spark',
      'jupyter':          'Jupyter',
      'tableau':          'Tableau',
      'statistics':       'Statistics',
      'data visualization':  'Data Visualization',
      'data visualisation':  'Data Visualization',
      'predictive modeling': 'Predictive Modeling',
      'predictive modelling':'Predictive Modeling',
      'feature engineering': 'Feature Engineering',
      'data analysis':    'Data Analysis',
      'data science':     'Data Science',
      'machine learning': 'Machine Learning',
      'deep learning':    'Deep Learning',
    };

    // Stopwords and ignore list — words that should NEVER be marked as missing keywords
    this.ignoreList = new Set([
      // Common filler words
      'about', 'looking', 'understanding', 'experience', 'responsibilities',
      'role', 'position', 'opportunity', 'candidate', 'applicant',
      'employee', 'team', 'department', 'company', 'organization',
      
      // Job metadata
      'employment', 'type', 'full-time', 'part-time', 'contract', 'freelance',
      'permanent', 'temporary', 'internship', 'apprenticeship',
      'salary', 'compensation', 'benefits', 'package',
      
      // Location words
      'pune', 'bangalore', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'kolkata',
      'ahmedabad', 'london', 'new york', 'san francisco', 'los angeles',
      'toronto', 'vancouver', 'sydney', 'singapore', 'dubai',
      'india', 'usa', 'uk', 'canada', 'australia', 'germany', 'france',
      'work from', 'remote', 'hybrid', 'onsite', 'location', 'based',
      
      // HR/Generic words
      'apply', 'apply now', 'interested', 'please', 'thank', 'email',
      'send', 'cv', 'resume', 'attached', 'subject', 'line',
      'include', 'references', 'portfolio', 'github', 'linkedin',
      
      // Common short words (< 3 chars unless in normalization map)
      'we', 'us', 'it', 'is', 'if', 'or', 'at', 'to', 'in', 'on', 'by',
      'as', 'be', 'do', 'go', 'he', 'me', 'no', 'of', 'so',
      
      // Pronouns and articles
      'the', 'and', 'but', 'for', 'you', 'your', 'our', 'their', 'this',
      'that', 'these', 'those', 'a', 'an', 'i', 'you', 'he', 'she', 'they',
      
      // Generic responsibility words
      'manage', 'handling', 'support', 'assist', 'help', 'work', 'do',
      'perform', 'execute', 'complete', 'achieve', 'handle',
      
      // Time-related
      'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days',
    ]);

    // Technical keyword categories with weights
    this.technicalCategories = {
      'frontend': ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript', 'webpack', 'responsive'],
      'backend': ['node', 'python', 'java', 'golang', 'rust', 'c#', 'php', 'ruby', 'rails'],
      'database': ['sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra', 'dynamodb'],
      'cloud': ['aws', 'gcp', 'azure', 'heroku', 'netlify', 'vercel'],
      'devops': ['docker', 'kubernetes', 'jenkins', 'git', 'ci/cd', 'terraform', 'ansible'],
      'testing': ['junit', 'pytest', 'mocha', 'jest', 'selenium', 'cypress', 'testing'],
      'api': ['rest api', 'graphql', 'soap', 'webhook'],
      'architecture': ['microservices', 'monolithic', 'mvc', 'mvvm', 'design patterns'],
      'methodology': ['agile', 'scrum', 'kanban', 'devops'],
      'messaging': ['kafka', 'rabbitmq', 'redis', 'mqtt'],
      'data_science': [
        'python', 'pandas', 'numpy', 'scikit-learn', 'scikit learn', 'sklearn',
        'matplotlib', 'seaborn', 'tensorflow', 'pytorch', 'keras',
        'machine learning', 'deep learning', 'statistics', 'statistical analysis',
        'data visualization', 'data analysis', 'data science', 'data engineering',
        'tableau', 'power bi', 'powerbi', 'spark', 'hadoop', 'pyspark',
        'feature engineering', 'data preprocessing', 'predictive modeling',
        'natural language processing', 'nlp', 'computer vision',
        'jupyter', 'r', 'scala', 'data pipeline', 'etl', 'time series',
      ],
    };

    // Calculate technical keyword set for quick lookup
    this.technicalKeywords = new Set();
    Object.values(this.technicalCategories).forEach(keywords => {
      keywords.forEach(kw => this.technicalKeywords.add(kw.toLowerCase()));
    });
  }

  /**
   * Normalize a keyword to standard form
   * @param {string} keyword - Raw keyword
   * @returns {string|null} - Normalized keyword or null if should be ignored
   */
  normalize(keyword) {
    const lower = keyword.toLowerCase().trim();

    // Check ignore list first
    if (this.ignoreList.has(lower)) {
      return null;
    }

    // Apply normalization map
    if (this.normalizationMap[lower]) {
      return this.normalizationMap[lower];
    }

    // Check length (words < 3 chars are ignored unless technical)
    if (lower.length < 3 && !this.technicalKeywords.has(lower)) {
      return null;
    }

    // Return original casing for non-mapped keywords
    return keyword;
  }

  /**
   * Check if a keyword is technical
   * @param {string} keyword - Keyword to check
   * @returns {boolean}
   */
  isTechnical(keyword) {
    return this.technicalKeywords.has(keyword.toLowerCase());
  }

  /**
   * Get priority weight for a keyword (0-1 scale)
   * @param {string} keyword - Keyword to rate
   * @param {object} metadata - { frequency, inRequiredSection, inPreferred }
   * @returns {number}
   */
  getPriorityWeight(keyword, metadata = {}) {
    const lower = keyword.toLowerCase();
    let weight = 0;

    // Base weight: technical vs non-technical
    if (this.isTechnical(lower)) {
      weight = 0.8; // High base weight for technical
    } else {
      weight = 0.3; // Low base weight for non-technical
    }

    // Frequency multiplier
    if (metadata.frequency && metadata.frequency > 1) {
      weight *= (1 + Math.min(metadata.frequency * 0.1, 0.3)); // Up to 30% boost
    }

    // Section multiplier
    if (metadata.inRequiredSection) {
      weight *= 1.5; // 50% boost if in required section
    }
    if (metadata.inPreferred) {
      weight *= 1.2; // 20% boost if in preferred
    }

    return Math.min(weight, 1); // Cap at 1.0
  }

  /**
   * Classify keyword by category
   * @param {string} keyword
   * @returns {string|null}
   */
  getCategory(keyword) {
    const lower = keyword.toLowerCase();
    for (const [category, keywords] of Object.entries(this.technicalCategories)) {
      if (keywords.some(kw => kw === lower)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Filter keywords: remove noise, normalize, deduplicate
   * @param {array} keywords - Raw keywords
   * @param {object} metadata - { frequencies, requiredSection }
   * @returns {array} - Clean keywords with metadata
   */
  filterAndNormalizeKeywords(keywords, metadata = {}) {
    const seen = new Set();
    const result = [];

    const frequencies = metadata.frequencies || {};
    const requiredSection = metadata.requiredSection || [];

    for (const keyword of keywords) {
      const normalized = this.normalize(keyword);
      
      // Skip if normalized to null (ignored)
      if (!normalized) continue;

      // Skip duplicates
      const lower = normalized.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);

      // Calculate priority
      const priority = this.getPriorityWeight(normalized, {
        frequency: frequencies[lower] || 1,
        inRequiredSection: requiredSection.some(s => s.toLowerCase().includes(lower)),
      });

      result.push({
        keyword: normalized,
        priority,
        category: this.getCategory(normalized),
        isTechnical: this.isTechnical(normalized),
      });
    }

    // Sort by priority descending
    return result.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Split missing keywords into high/medium/low impact
   * @param {array} missingKeywords - Missing keywords with priority
   * @returns {object} - { high, medium, low }
   */
  categorizeBySeverity(missingKeywords) {
    const result = {
      high: [],    // priority >= 0.7 AND technical
      medium: [],  // priority >= 0.5
      low: []      // priority < 0.5
    };

    for (const kw of missingKeywords) {
      if (kw.priority >= 0.7 && kw.isTechnical) {
        result.high.push(kw);
      } else if (kw.priority >= 0.5) {
        result.medium.push(kw);
      } else {
        result.low.push(kw);
      }
    }

    return result;
  }
}

module.exports = KeywordNormalizationService;
