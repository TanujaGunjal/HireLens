/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS CONFIGURATION & DICTIONARIES
 * 
 * Contains all constants, stopwords, action verbs, synonyms, and templates
 * used by the ATS scoring engine across all domains
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// STOPWORDS - Words that should NOT be considered keywords
// ═══════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  // Generic meaningless verbs
  'deliver', 'work', 'help', 'responsible', 'support', 'ability',
  'task', 'good', 'excellent', 'manage', 'assist', 'ensure',
  'provide', 'make', 'give', 'do', 'has', 'have', 'will',
  
  // Common articles & prepositions
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'from',
  'by', 'with', 'and', 'or', 'but', 'be', 'is', 'are', 'am',
  'was', 'were', 'being', 'been', 'can', 'could', 'may', 'might',
  'must', 'should', 'would', 'this', 'that', 'these', 'those',
  
  // Business jargon
  'need', 'required', 'skilled', 'experience', 'knowledge',
  'ability', 'understanding', 'familiarity', 'proficiency',
  
  // Common generic words
  'person', 'team', 'company', 'business', 'project', 'role',
  'position', 'job', 'candidate', 'ideal', 'key', 'ability',
  'time', 'day', 'week', 'month', 'year', 'working', 'working'
]);

// ═══════════════════════════════════════════════════════════════════════════
// ACTION VERBS - Strong verbs that indicate accomplishments
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_VERBS = new Set([
  // Development/Creation
  'developed', 'built', 'designed', 'implemented', 'created',
  'engineered', 'architected', 'constructed', 'coded', 'programmed',
  
  // Optimization/Improvement
  'optimized', 'improved', 'enhanced', 'refined', 'streamlined',
  'accelerated', 'automated', 'reduced', 'minimized', 'lowered',
  
  // Growth/Impact
  'increased', 'grew', 'expanded', 'scaled', 'multiplied',
  'boosted', 'elevated', 'strengthened', 'amplified',
  
  // Leadership/Strategy
  'led', 'directed', 'orchestrated', 'spearheaded', 'pioneered',
  'launched', 'initiated', 'established', 'founded', 'managed',
  
  // Analysis/Research
  'analyzed', 'investigated', 'examined', 'researched', 'identified',
  'discovered', 'diagnosed', 'evaluated', 'assessed', 'reviewed',
  
  // Integration/Connection
  'integrated', 'connected', 'linked', 'collaborated', 'partnered',
  'unified', 'consolidated', 'merged', 'coordinated', 'synchronized',
  
  // Communication/Delivery
  'delivered', 'executed', 'completed', 'shipped', 'released',
  'presented', 'documented', 'communicated', 'demonstrated',
  
  // Innovation
  'innovated', 'transformed', 'revolutionized', 'modernized',
  'revamped', 'restructured', 'reimplemented', 'overhauled',
  
  // Problem Solving
  'resolved', 'solved', 'fixed', 'debugged', 'troubleshot',
  'mitigated', 'prevented', 'eliminated', 'eradicated'
]);

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC SYNONYMS - Words that mean the same as keywords
// ═══════════════════════════════════════════════════════════════════════════

const KEYWORD_SYNONYMS = {
  // Frontend Framework synonyms
  'react': ['reactjs', 'react.js', 'react js', 'reactxjs'],
  'angular': ['angularjs', 'angular.js', 'angular js'],
  'vue': ['vuejs', 'vue.js', 'vue js'],
  'next': ['nextjs', 'next.js', 'next js', 'nextxjs'],
  
  // Backend/Runtime synonyms
  'node': ['nodejs', 'node.js', 'node js'],
  'python': ['py', 'python3', 'python 3'],
  'java': ['jvm', 'javase', 'java se', 'java 8', 'java 11', 'java 17'],
  'golang': ['go', 'go lang', 'golang'],
  'csharp': ['c#', 'c sharp', 'dotnet', '.net'],
  'php': ['php7', 'php8', 'laravel'],
  'rust': ['rustlang', 'rust lang'],
  
  // Database synonyms
  'postgres': ['postgresql', 'postgres sql', 'psql'],
  'mysql': ['mysql', 'mysql database'],
  'mongodb': ['mongo', 'mongo db'],
  'redis': ['redis cache', 'redis'],
  'elasticsearch': ['elastic search', 'elastic'],
  'sql': ['sql database', 'sql server', 'mysql', 'postgres', 'sqlite'],
  
  // Cloud/DevOps synonyms
  'aws': ['amazon aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds'],
  'azure': ['microsoft azure', 'azure cloud'],
  'gcp': ['google cloud', 'google cloud platform', 'gcp'],
  'docker': ['containerization', 'containers', 'dockerfile'],
  'kubernetes': ['k8s', 'k8', 'kube'],
  'terraform': ['infrastructure as code', 'iac'],
  'jenkins': ['ci/cd', 'continuous integration'],
  'gitlab': ['gitlab ci', 'gitops'],
  'github': ['github actions', 'git'],
  
  // Data/Analytics synonyms
  'tableau': ['tableau', 'tableau dashboard'],
  'powerbi': ['power bi', 'powerbi', 'power bi'],
  'excel': ['pivot tables', 'spreadsheet'],
  'sql': ['sql query', 'sql', 'database query'],
  'r': ['programming language r', 'r programming'],
  'tableau': ['data visualization', 'visualization'],
  'looker': ['data studio', 'business intelligence'],
  
  // Data Science/ML synonyms
  'tensorflow': ['tf', 'tensorflow'],
  'pytorch': ['pytorch', 'torch'],
  'scikit': ['scikit-learn', 'sklearn', 'scikit learn'],
  'pandas': ['pandas dataframe', 'pandas'],
  'numpy': ['np', 'numpy'],
  'spark': ['pyspark', 'apache spark', 'spark'],
  'hadoop': ['mapreduce', 'hdfs'],
  'machine learning': ['ml', 'deep learning', 'neural network', 'ai', 'artificial intelligence'],
  'nlp': ['natural language processing', 'nlp', 'language model'],
  
  // QA/Testing synonyms
  'jest': ['jest testing', 'jest'],
  'pytest': ['pytest', 'python testing'],
  'selenium': ['browser automation', 'selenium', 'automation testing'],
  'cypress': ['cypress testing', 'e2e testing'],
  'junit': ['java testing', 'junit'],
  'testing': ['unit tests', 'integration tests', 'e2e tests', 'testing'],
  
  // API synonyms
  'rest': ['rest api', 'restful', 'rest'],
  'graphql': ['graphql api', 'graphql'],
  'soap': ['soap api', 'xml rpc'],
  'grpc': ['grpc', 'protocol buffers'],
  
  // Communication/Platforms
  'git': ['github', 'gitlab', 'bitbucket', 'version control'],
  'jira': ['project management', 'issue tracking'],
  'slack': ['communication', 'chat'],
  'confluence': ['documentation', 'wiki'],
  'agile': ['scrum', 'kanban', 'sprint'],
  'microservices': ['micro services', 'service oriented', 'soa'],
  'monolithic': ['monolith', 'legacy'],
  'aws': ['cloud', 'cloud computing'],
  'gcp': ['cloud', 'cloud computing'],
  'azure': ['cloud', 'cloud computing']
};

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN DETECTION - Map resume content to domain for templates
// ═══════════════════════════════════════════════════════════════════════════

const DOMAIN_KEYWORDS = {
  'software_engineer': [
    'algorithm', 'api', 'architecture', 'backend', 'frontend', 'full-stack',
    'microservices', 'scalability', 'performance', 'database', 'sql',
    'system design', 'code review', 'testing', 'deployment', 'ci/cd',
    'debugging', 'refactoring', 'codebase', 'framework', 'library'
  ],
  
  'data_analyst': [
    'analytics', 'reporting', 'insight', 'dashboard', 'visualization',
    'data quality', 'metrics', 'sql', 'tableau', 'power bi',
    'spreadsheet', 'excel', 'pivot table', 'statistical', 'trend',
    'analysis', 'reporting', 'kpi', 'business intelligence', 'etl'
  ],
  
  'data_scientist': [
    'machine learning', 'model', 'prediction', 'training', 'neural network',
    'deep learning', 'python', 'tensorflow', 'pytorch', 'scikit-learn',
    'numpy', 'pandas', 'statistics', 'algorithm', 'data mining',
    'feature engineering', 'classification', 'regression', 'clustering',
    'nlp', 'computer vision'
  ],
  
  'product_manager': [
    'roadmap', 'feature', 'prioritization', 'stakeholder', 'product strategy',
    'user research', 'metrics', 'kpi', 'product launch', 'team leadership',
    'cross-functional', 'agile', 'sprint', 'backlog', 'market analysis',
    'competitive analysis', 'requirements', 'user story'
  ],
  
  'marketing': [
    'campaign', 'marketing', 'social media', 'content', 'seo', 'sem',
    'engagement', 'brand', 'strategy', 'analytics', 'conversion',
    'customer acquisition', 'roi', 'advertising', 'email marketing',
    'lead generation', 'growth', 'copywriting'
  ],
  
  'sales': [
    'pipeline', 'revenue', 'quota', 'customer acquisition', 'sales cycle',
    'proposal', 'negotiation', 'lead generation', 'prospecting', 'closing',
    'territory', 'account management', 'sales strategy', 'commision',
    'customer relationship', 'contract', 'deal'
  ],
  
  'hr': [
    'recruiting', 'talent acquisition', 'employee relations', 'onboarding',
    'training', 'development', 'performance', 'compensation', 'benefits',
    'hr policy', 'employee engagement', 'hiring', 'culture', 'retention',
    'compliance', 'workforce planning'
  ],
  
  'finance': [
    'accounting', 'financial analysis', 'budgeting', 'forecasting',
    'audit', 'tax', 'cash flow', 'financial statement', 'variance analysis',
    'cost management', 'reporting', 'reconciliation', 'compliance',
    'risk management', 'investment', 'loan', 'equity'
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTION TEMPLATES - Domain-specific templates for bullet improvements
// ═══════════════════════════════════════════════════════════════════════════

const SUGGESTION_TEMPLATES = {
  'software_engineer': [
    'Developed {keyword} {context} improving system {metric} by {value}%',
    'Architected {keyword} {context} serving {metric} requests with {value}% availability',
    'Optimized {keyword} {context} reducing response time from {baseline} to {value}ms',
    'Implemented {keyword} {context} achieving {value}x performance improvement',
    'Engineered {keyword} {context} handling {metric} concurrent users'
  ],
  
  'data_analyst': [
    'Created {keyword} {context} that revealed {metric} opportunity for {value}% improvement',
    'Developed {keyword} dashboard tracking {metric} KPIs reducing reporting time by {value}%',
    'Analyzed {keyword} {context} identifying trends that improved {metric} efficiency by {value}%',
    'Built {keyword} {context} providing real-time {metric} visibility across stakeholders',
    'Generated {keyword} {context} insights enabling {value}% improvement in decision-making accuracy'
  ],
  
  'data_scientist': [
    'Trained {keyword} model achieving {value}% accuracy on {metric} prediction task',
    'Developed {keyword} {context} improving {metric} prediction accuracy by {value} percentage points',
    'Engineered {keyword} pipeline processing {metric} records with {value}% success rate',
    'Built {keyword} {context} reducing model inference time by {value}% while maintaining accuracy',
    'Implemented {keyword} algorithm achieving {value}x improvement in {metric}'
  ],
  
  'product_manager': [
    'Led product strategy for {keyword} resulting in {value}% increase in {metric}',
    'Prioritized {keyword} features that improved {metric} engagement by {value}%',
    'Collaborated with engineering on {keyword} roadmap achieving {metric} target ahead of schedule',
    'Analyzed {keyword} {context} informing product decisions that increased {metric} by {value}%',
    'Managed {keyword} launch that onboarded {metric} users with {value}% activation rate'
  ],
  
  'marketing': [
    'Launched {keyword} campaign resulting in {value}% increase in {metric} engagement',
    'Created {keyword} {context} strategy that generated {metric} leads with {value}% conversion',
    'Managed {keyword} strategy improving {metric} growth by {value}% YoY',
    'Developed {keyword} content that reached {metric} audience with {value}% engagement rate',
    'Orchestrated {keyword} initiative that increased brand {metric} by {value}%'
  ],
  
  'sales': [
    'Closed {metric} deals worth ${value}M through {keyword} pipeline management',
    'Generated {metric} pipeline with {value}% close rate leveraging {keyword} strategy',
    'Grew territory revenue by {value}% through {keyword} customer acquisition',
    'Negotiated {keyword} contracts averaging {value}% above quota',
    'Managed {metric} accounts with {value}% retention rate using {keyword} approach'
  ],
  
  'hr': [
    'Improved {metric} retention by {value}% through {keyword} employee engagement programs',
    'Reduced {metric} time to hire by {value}% implementing {keyword} recruiting strategy',
    'Led {keyword} initiative resulting in {value}% improvement in employee satisfaction',
    'Onboarded {metric} employees achieving {value}% retention rate using {keyword} program',
    'Developed {keyword} {context} that improved {metric} compliance by {value}%'
  ],
  
  'finance': [
    'Managed {metric} budget achieving {value}% cost reduction through {keyword} optimization',
    'Forecasted {keyword} performance with {value}% accuracy using {context} analysis',
    'Identified {metric} inefficiencies through {keyword} analysis resulting in ${value}M savings',
    'Reconciled {metric} accounts monthly achieving {value}% accuracy rate',
    'Improved {keyword} reporting {context} reducing close time by {value}%'
  ],
  
  'default': [
    'Enhanced {keyword} capabilities by {value}% through strategic {context} implementation',
    'Optimized {keyword} {context} achieving {value}% improvement in {metric}',
    'Improved {keyword} performance resulting in {value}% productivity gain',
    'Developed {keyword} {context} that increased {metric} by {value}%',
    'Implemented {keyword} solution reducing {metric} by {value}%'
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// ATS SCORING WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════

const ATS_WEIGHTS = {
  keywordMatch: 0.40,        // 40%
  sectionCompleteness: 0.20, // 20%
  formatting: 0.20,          // 20%
  actionVerbs: 0.10,         // 10%
  readability: 0.10          // 10%
};

// ═══════════════════════════════════════════════════════════════════════════
// SCORE BOUNDARIES - For realistic score distribution
// ═══════════════════════════════════════════════════════════════════════════

const SCORE_BOUNDARIES = {
  poor: { min: 40, max: 60 },      // Poor résumé
  average: { min: 60, max: 75 },   // Average résumé
  good: { min: 75, max: 85 },      // Good résumé
  excellent: { min: 85, max: 95 }  // Excellent résumé
};

// ═══════════════════════════════════════════════════════════════════════════
// COMMON METRICS & VALUES - For suggestion templates
// ═══════════════════════════════════════════════════════════════════════════

const METRICS = {
  performance: ['response time', 'latency', 'throughput', 'query time'],
  efficiency: ['time', 'resources', 'processes', 'workflows'],
  growth: ['users', 'engagement', 'conversion', 'revenue', 'adoption'],
  quality: ['accuracy', 'reliability', 'stability', 'uptime', 'availability'],
  cost: ['costs', 'expenses', 'budget', 'overhead']
};

const BASELINE_VALUES = {
  percentage: [15, 20, 25, 30, 35, 40, 45, 50],
  time: [50, 100, 200, 300, 500, 1000, 2000],
  multiplier: [2, 3, 4, 5, 10, 100, 1000],
  users: [100, 500, 1000, 5000, 10000, 100000]
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION COMPLETENESS REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_REQUIREMENTS = {
  contactInfo: {
    name: true,
    email: true,
    phone: false,
    weight: 0.05
  },
  summary: {
    present: true,
    minLength: 50,
    weight: 0.15
  },
  experience: {
    minRoles: 2,
    bulletsPerRole: 3,
    weight: 0.40
  },
  education: {
    present: true,
    weight: 0.15
  },
  skills: {
    present: true,
    minSkills: 5,
    weight: 0.15
  },
  projects: {
    present: false,
    weight: 0.10
  }
};

module.exports = {
  STOPWORDS,
  ACTION_VERBS,
  KEYWORD_SYNONYMS,
  DOMAIN_KEYWORDS,
  SUGGESTION_TEMPLATES,
  ATS_WEIGHTS,
  SCORE_BOUNDARIES,
  METRICS,
  BASELINE_VALUES,
  SECTION_REQUIREMENTS
};
