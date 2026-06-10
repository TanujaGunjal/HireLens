/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SKILL GAP ANALYZER + SMART SUGGESTION GENERATOR
 *
 * Compares resume skills against JD keywords to find:
 *   - present  : keywords already covered in the resume
 *   - missing  : keywords the JD requires but the resume lacks
 *
 * Also generates context-aware suggestion messages (not generic "Add X").
 *
 * RULES:
 *  - Does NOT modify scoring logic
 *  - Does NOT change any existing API shape (only adds new fields)
 *  - Fully self-contained — import anywhere without side-effects
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Smart suggestion templates ───────────────────────────────────────────────
// Maps lowercase keywords → concrete, resume-ready sentences.
// Falls back to a generic template when the keyword isn't listed.

const SMART_SUGGESTION_TEMPLATES = {
  // Databases
  mysql:          'Designed and optimized relational schemas in MySQL, improving query performance by reducing join complexity',
  postgresql:     'Used PostgreSQL with advanced indexing and window functions for high-performance analytical queries',
  mongodb:        'Leveraged MongoDB for flexible document storage, handling unstructured data at scale',
  redis:          'Implemented Redis caching layer to reduce API response times and lower database load',
  sqlite:         'Used SQLite for lightweight embedded storage in cross-platform desktop and mobile applications',
  elasticsearch:  'Integrated Elasticsearch to deliver full-text search and real-time log analytics',

  // APIs & Architecture
  'rest api':     'Designed and built RESTful APIs following HTTP/JSON best practices for scalable backend communication',
  'rest apis':    'Designed and built RESTful APIs following HTTP/JSON best practices for scalable backend communication',
  restful:        'Implemented RESTful architecture enabling decoupled, stateless communication between services',
  graphql:        'Built GraphQL APIs enabling flexible, client-driven data fetching and reducing over-fetching',
  grpc:           'Used gRPC for efficient inter-service communication in a microservices environment',
  microservices:  'Architected microservices-based backend, improving independent deployability and fault isolation',
  'system design':'Applied system design principles — load balancing, caching, and horizontal scaling — to build resilient production systems',
  websocket:      'Implemented WebSocket-based real-time features (live chat, notifications) using Socket.IO',

  // Cloud & DevOps
  aws:            'Deployed and managed cloud infrastructure on AWS (EC2, S3, Lambda, RDS), ensuring high availability',
  azure:          'Provisioned and maintained Azure cloud resources, including App Service and Azure Functions',
  gcp:            'Used Google Cloud Platform services (Cloud Run, BigQuery, Cloud Storage) for scalable deployments',
  docker:         'Containerized applications using Docker, enabling consistent environments across dev/staging/production',
  kubernetes:     'Orchestrated containerized workloads with Kubernetes for zero-downtime deployments and auto-scaling',
  'ci/cd':        'Set up CI/CD pipelines (GitHub Actions / Jenkins) to automate testing, builds, and deployments',
  terraform:      'Defined infrastructure-as-code with Terraform, enabling reproducible cloud environments',
  jenkins:        'Configured Jenkins pipelines for automated build, test, and deployment workflows',
  linux:          'Administered Linux servers, optimising system performance and automating operations with Bash scripting',

  // Frontend
  react:          'Built responsive, component-driven UIs with React and hooks, improving developer velocity and UX',
  'react.js':     'Built responsive, component-driven UIs with React and hooks, improving developer velocity and UX',
  'next.js':      'Developed SEO-optimised, server-side-rendered web applications using Next.js',
  angular:        'Developed enterprise-grade SPAs with Angular, RxJS, and component-driven architecture',
  vue:            'Created reactive, component-based UIs with Vue.js and Vuex state management',
  typescript:     'Adopted TypeScript across the codebase to enforce type safety and catch runtime errors at compile time',
  redux:          'Managed complex client-side state using Redux with middleware for async flows',
  tailwind:       'Styled modern, responsive interfaces rapidly using Tailwind CSS utility classes',

  // Backend
  'node.js':      'Built high-throughput, event-driven APIs with Node.js and Express, handling concurrent requests efficiently',
  nodejs:         'Built high-throughput, event-driven APIs with Node.js and Express, handling concurrent requests efficiently',
  express:        'Developed RESTful backend services with Express.js, including JWT authentication and middleware layers',
  django:         'Built scalable web applications and REST APIs using Django and Django REST Framework',
  flask:          'Created lightweight microservices and APIs with Flask, integrating with external data sources',
  spring:         'Developed production-grade Java microservices with Spring Boot, Spring Security, and JPA',
  fastapi:        'Built high-performance async APIs with FastAPI, including automatic OpenAPI documentation',

  // Languages
  python:         'Used Python for backend services, data processing pipelines, and automation scripts',
  java:           'Developed robust enterprise applications in Java, applying OOP design patterns',
  javascript:     'Delivered full-stack features in JavaScript (ES6+), covering both client and server logic',
  golang:         'Written high-performance, concurrent backend services in Go with goroutines and channels',
  'c++':          'Implemented performance-critical modules in C++, optimising memory usage and execution speed',

  // Data & AI/ML
  'machine learning': 'Applied machine learning algorithms (classification, regression, clustering) to solve business problems',
  tensorflow:     'Built and fine-tuned deep learning models using TensorFlow for production inference',
  pytorch:        'Trained and deployed neural network models with PyTorch for computer vision and NLP tasks',
  pandas:         'Processed and analysed large datasets using pandas, delivering actionable business insights',
  'data analysis':'Conducted end-to-end data analysis: ingestion, cleaning, exploratory analysis, and visualisation',

  // Soft skills / processes
  agile:          'Worked within an Agile/Scrum team — participating in sprint planning, stand-ups, and retrospectives',
  scrum:          'Collaborated in Scrum sprints, contributing to backlog grooming, daily stand-ups, and velocity tracking',
  'unit testing': 'Wrote unit and integration tests, achieving high code coverage and reducing regression bugs',
  testing:        'Implemented automated testing strategies (unit, integration, E2E) to ensure software quality',
  git:            'Used Git for version control, including branching strategies, pull requests, and code reviews',
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Extracts a flat list of skill strings from the MongoDB resume's skills array.
 * Handles both { category, items[] } shape and plain-string arrays.
 *
 * @param   {Object} resume  - Mongo resume document (or plain object)
 * @returns {string[]}       - Flat list of skill strings
 */
function extractResumeSkillStrings(resume) {
  if (!resume) return [];
  const raw = resume.toObject ? resume.toObject() : resume;
  const skills = raw.skills || [];

  if (!Array.isArray(skills)) return [];

  const flat = [];
  for (const entry of skills) {
    if (typeof entry === 'string') {
      flat.push(entry.trim());
    } else if (entry && Array.isArray(entry.items)) {
      for (const item of entry.items) {
        if (typeof item === 'string' && item.trim()) flat.push(item.trim());
      }
    }
  }
  return flat;
}

/**
 * Build a searchable text blob from the resume for keyword presence checks.
 * Includes summary, skills, experience bullets, project descriptions, etc.
 *
 * @param   {Object} resume - Mongo resume document or plain object
 * @returns {string}        - Lowercased, joined text
 */
function buildResumeSearchText(resume) {
  if (!resume) return '';
  const raw = resume.toObject ? resume.toObject() : resume;
  const parts = [];

  if (raw.summary) parts.push(raw.summary);

  // Skills flat list
  parts.push(...extractResumeSkillStrings(raw));

  // Experience
  if (Array.isArray(raw.experience)) {
    for (const exp of raw.experience) {
      if (exp.role) parts.push(exp.role);
      if (exp.company) parts.push(exp.company);
      if (Array.isArray(exp.bullets)) parts.push(...exp.bullets);
      if (Array.isArray(exp.achievements)) parts.push(...exp.achievements);
    }
  }

  // Projects
  if (Array.isArray(raw.projects)) {
    for (const proj of raw.projects) {
      if (proj.title || proj.name) parts.push(proj.title || proj.name);
      if (proj.description) parts.push(proj.description);
      if (Array.isArray(proj.bullets)) parts.push(...proj.bullets);
      if (Array.isArray(proj.techStack)) parts.push(...proj.techStack);
    }
  }

  // Certifications
  if (Array.isArray(raw.certifications)) {
    for (const cert of raw.certifications) {
      if (cert.name) parts.push(cert.name);
    }
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * getSkillGap
 *
 * Compares JD keywords against the full resume text to determine which
 * keywords are present and which are missing.
 *
 * @param   {Object}   mongoResume  - Mongoose Resume document or plain object
 * @param   {string[]} jdKeywords   - Extracted keywords from the Job Description
 * @returns {{ present: string[], missing: string[] }}
 */
function getSkillGap(mongoResume, jdKeywords) {
  if (!Array.isArray(jdKeywords) || jdKeywords.length === 0) {
    return { present: [], missing: [] };
  }

  const searchText = buildResumeSearchText(mongoResume);
  const present = [];
  const missing = [];

  for (const keyword of jdKeywords) {
    if (!keyword || typeof keyword !== 'string') continue;
    const normalized = keyword.toLowerCase().trim();
    if (!normalized) continue;

    // Consider a keyword present if found anywhere in the resume text
    const found = searchText.includes(normalized);

    if (found) {
      present.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return { present, missing };
}

/**
 * generateSmartSuggestion
 *
 * Returns a context-aware, resume-ready sentence for a missing keyword.
 * Uses the template map first; falls back to a generic template.
 *
 * @param   {string} keyword  - The missing keyword/skill
 * @returns {string}          - An actionable, resume-quality suggestion sentence
 */
function generateSmartSuggestion(keyword) {
  if (!keyword || typeof keyword !== 'string') return '';
  const key = keyword.toLowerCase().trim();
  return (
    SMART_SUGGESTION_TEMPLATES[key] ||
    `Gained hands-on experience with ${keyword} through project work and applied it to deliver measurable results`
  );
}

/**
 * buildSmartKeywordSuggestions
 *
 * Converts a list of missing keywords into full suggestion objects
 * with contextual messages, ready to be included in the API response.
 *
 * @param   {string[]} missingKeywords  - Keywords not found in the resume
 * @returns {Array}                     - Array of suggestion objects
 */
function buildSmartKeywordSuggestions(missingKeywords) {
  if (!Array.isArray(missingKeywords)) return [];

  return missingKeywords.slice(0, 8).map((keyword, idx) => ({
    id: `smart-kw-${keyword.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
    type: 'keyword',
    section: 'projects',
    impact: 'high',
    message: `Add ${keyword} experience: ${generateSmartSuggestion(keyword)}`,
    reason: `Missing keyword: ${keyword}`,
    currentText: `"${keyword}" not found in resume`,
    improvedText: generateSmartSuggestion(keyword),
    keyword,
    priority: idx + 1,
    itemIndex: 0,
    bulletIndex: 0,
  }));
}

module.exports = {
  getSkillGap,
  generateSmartSuggestion,
  buildSmartKeywordSuggestions,
  extractResumeSkillStrings,
  buildResumeSearchText,
};
