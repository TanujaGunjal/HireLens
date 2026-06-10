/**
 * Production-Grade JD Keyword Extractor
 * Enterprise-style extraction system with:
 * - Phrase detection
 * - Weighted scoring
 * - Frequency boosting
 * - Role confidence scoring
 * - Multi-word normalization
 * - Section-aware extraction
 * - Smart deduplication
 * - Tech clustering
 * 
 * File: b2world-backend1/utils/keywordExtractorProduction.js
 */

// ============================================================
// 1️⃣ NORMALIZATION ENGINE (Robust)
// ============================================================
function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\w\s\/\.\+\#\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// 2️⃣ SLASH + COMMA + PIPE SPLITTER
// ============================================================
function extractSeparatedTerms(text) {
  const separators = /[\/,\|]/;
  return text
    .split(separators)
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

// ============================================================
// 3️⃣ TECH DICTIONARY WITH WEIGHTS
// ============================================================
const TECH_MAP = {
  // Backend - Languages
  "java": { weight: 3, role: "backend" },
  "python": { weight: 3, role: "backend" },
  "javascript": { weight: 3, role: "backend" },
  "typescript": { weight: 3, role: "backend" },
  "go": { weight: 3, role: "backend" },
  "golang": { weight: 3, role: "backend" },
  "rust": { weight: 3, role: "backend" },
  "c++": { weight: 3, role: "backend" },
  "c#": { weight: 3, role: "backend" },
  "php": { weight: 2, role: "backend" },
  "ruby": { weight: 2, role: "backend" },
  "scala": { weight: 3, role: "backend" },
  "kotlin": { weight: 3, role: "backend" },
  "swift": { weight: 2, role: "backend" },

  // Backend - Frameworks
  "spring boot": { weight: 4, role: "backend" },
  "django": { weight: 4, role: "backend" },
  "flask": { weight: 3, role: "backend" },
  "express.js": { weight: 4, role: "backend" },
  "express": { weight: 4, role: "backend" },
  "node.js": { weight: 4, role: "backend" },
  "nodejs": { weight: 4, role: "backend" },
  "node": { weight: 3, role: "backend" },
  "nestjs": { weight: 4, role: "backend" },
  "fastapi": { weight: 4, role: "backend" },
  "rails": { weight: 3, role: "backend" },
  "ruby on rails": { weight: 4, role: "backend" },
  "laravel": { weight: 3, role: "backend" },
  "spring": { weight: 3, role: "backend" },
  ".net": { weight: 3, role: "backend" },
  "asp.net": { weight: 3, role: "backend" },

  // Database
  "mysql": { weight: 3, role: "database" },
  "postgresql": { weight: 3, role: "database" },
  "postgres": { weight: 3, role: "database" },
  "mongodb": { weight: 3, role: "database" },
  "mongo": { weight: 3, role: "database" },
  "redis": { weight: 3, role: "database" },
  "elasticsearch": { weight: 3, role: "database" },
  "dynamodb": { weight: 3, role: "database" },
  "cassandra": { weight: 3, role: "database" },
  "sqlite": { weight: 2, role: "database" },
  "oracle": { weight: 2, role: "database" },
  "firestore": { weight: 3, role: "database" },
  "sql": { weight: 3, role: "database" },
  "nosql": { weight: 3, role: "database" },

  // Cloud
  "aws": { weight: 3, role: "cloud" },
  "azure": { weight: 3, role: "cloud" },
  "gcp": { weight: 3, role: "cloud" },
  "google cloud": { weight: 3, role: "cloud" },
  "amazon web services": { weight: 4, role: "cloud" },
  "microsoft azure": { weight: 4, role: "cloud" },
  "heroku": { weight: 2, role: "cloud" },
  "vercel": { weight: 2, role: "cloud" },
  "netlify": { weight: 2, role: "cloud" },

  // DevOps
  "docker": { weight: 3, role: "devops" },
  "kubernetes": { weight: 4, role: "devops" },
  "k8s": { weight: 4, role: "devops" },
  "ci/cd": { weight: 4, role: "devops" },
  "cicd": { weight: 4, role: "devops" },
  "jenkins": { weight: 3, role: "devops" },
  "github actions": { weight: 3, role: "devops" },
  "gitlab ci": { weight: 3, role: "devops" },
  "terraform": { weight: 3, role: "devops" },
  "ansible": { weight: 3, role: "devops" },
  "aws lambda": { weight: 3, role: "devops" },
  "serverless": { weight: 3, role: "devops" },
  "cloudformation": { weight: 3, role: "devops" },

  // Architecture
  "microservices": { weight: 4, role: "backend" },
  "microservices architecture": { weight: 5, role: "backend" },
  "microservice": { weight: 4, role: "backend" },
  "restful api": { weight: 4, role: "backend" },
  "rest api": { weight: 4, role: "backend" },
  "rest": { weight: 3, role: "backend" },
  "graphql": { weight: 3, role: "backend" },
  "grpc": { weight: 3, role: "backend" },
  "websocket": { weight: 3, role: "backend" },
  "api gateway": { weight: 3, role: "backend" },
  "message queue": { weight: 3, role: "backend" },
  "rabbitmq": { weight: 3, role: "backend" },
  "kafka": { weight: 3, role: "backend" },

  // Frontend
  "react": { weight: 4, role: "frontend" },
  "reactjs": { weight: 4, role: "frontend" },
  "vue": { weight: 3, role: "frontend" },
  "vuejs": { weight: 3, role: "frontend" },
  "angular": { weight: 3, role: "frontend" },
  "angularjs": { weight: 3, role: "frontend" },
  "next.js": { weight: 4, role: "frontend" },
  "nextjs": { weight: 4, role: "frontend" },
  "svelte": { weight: 3, role: "frontend" },
  "html": { weight: 2, role: "frontend" },
  "css": { weight: 2, role: "frontend" },
  "sass": { weight: 2, role: "frontend" },
  "scss": { weight: 2, role: "frontend" },
  "tailwind": { weight: 3, role: "frontend" },
  "tailwindcss": { weight: 3, role: "frontend" },
  "bootstrap": { weight: 2, role: "frontend" },
  "material-ui": { weight: 3, role: "frontend" },
  "mui": { weight: 3, role: "frontend" },
  "webpack": { weight: 3, role: "frontend" },
  "vite": { weight: 3, role: "frontend" },

  // Mobile
  "react native": { weight: 4, role: "mobile" },
  "flutter": { weight: 3, role: "mobile" },
  "ios": { weight: 2, role: "mobile" },
  "android": { weight: 2, role: "mobile" },
  "xamarin": { weight: 2, role: "mobile" },

  // Core CS
  "data structures": { weight: 3, role: "core" },
  "algorithms": { weight: 3, role: "core" },
  "oop": { weight: 2, role: "core" },
  "object oriented programming": { weight: 3, role: "core" },
  "design patterns": { weight: 3, role: "core" },
  "system design": { weight: 4, role: "core" },
  "software architecture": { weight: 4, role: "core" },
  "clean code": { weight: 3, role: "core" },
  "refactoring": { weight: 3, role: "core" },

  // Data Science & ML
  "machine learning": { weight: 4, role: "data" },
  "ml": { weight: 3, role: "data" },
  "deep learning": { weight: 4, role: "data" },
  "artificial intelligence": { weight: 4, role: "data" },
  "ai": { weight: 3, role: "data" },
  "tensorflow": { weight: 4, role: "data" },
  "pytorch": { weight: 4, role: "data" },
  "scikit-learn": { weight: 4, role: "data" },
  "sklearn": { weight: 4, role: "data" },
  "pandas": { weight: 3, role: "data" },
  "numpy": { weight: 3, role: "data" },
  "data science": { weight: 4, role: "data" },
  "data analysis": { weight: 3, role: "data" },
  "nlp": { weight: 3, role: "data" },
  "natural language processing": { weight: 4, role: "data" },
  "computer vision": { weight: 4, role: "data" },

  // Tools
  "git": { weight: 2, role: "tool" },
  "github": { weight: 2, role: "tool" },
  "gitlab": { weight: 2, role: "tool" },
  "bitbucket": { weight: 2, role: "tool" },
  "jira": { weight: 2, role: "tool" },
  "confluence": { weight: 2, role: "tool" },
  "slack": { weight: 1, role: "tool" },

  // Testing
  "jest": { weight: 3, role: "testing" },
  "mocha": { weight: 3, role: "testing" },
  "cypress": { weight: 3, role: "testing" },
  "selenium": { weight: 3, role: "testing" },
  "playwright": { weight: 3, role: "testing" },
  "junit": { weight: 3, role: "testing" },
  "pytest": { weight: 3, role: "testing" },
  "unit testing": { weight: 3, role: "testing" },
  "integration testing": { weight: 3, role: "testing" },
  "e2e testing": { weight: 3, role: "testing" },
  "test driven development": { weight: 4, role: "testing" },
  "tdd": { weight: 3, role: "testing" },
  "bdd": { weight: 3, role: "testing" },

  // Methodologies
  "agile": { weight: 3, role: "methodology" },
  "scrum": { weight: 3, role: "methodology" },
  "kanban": { weight: 2, role: "methodology" },
  "waterfall": { weight: 1, role: "methodology" },
  "lean": { weight: 2, role: "methodology" },

  // Soft Skills / Responsibilities
  "communication": { weight: 2, role: "soft_skill" },
  "leadership": { weight: 2, role: "soft_skill" },
  "teamwork": { weight: 2, role: "soft_skill" },
  "problem solving": { weight: 3, role: "soft_skill" },
  "analytical": { weight: 3, role: "soft_skill" },
  "critical thinking": { weight: 3, role: "soft_skill" },
};

// ============================================================
// 4️⃣ PHRASE-FIRST MATCHING - Sort by length descending
// ============================================================
const sortedTech = Object.keys(TECH_MAP)
  .sort((a, b) => b.length - a.length);

// ============================================================
// 5️⃣ RESPONSIBILITY VERBS
// ============================================================
const RESPONSIBILITY_VERBS = new Set([
  'design', 'develop', 'deploy', 'implement', 'optimize', 
  'build', 'maintain', 'deliver', 'architect', 'integrate',
  'create', 'manage', 'lead', 'analyze', 'test', 'debug',
  'refactor', 'review', 'collaborate', 'communicate', 'lead'
]);

// ============================================================
// 6️⃣ STOPWORDS - Never include these
// ============================================================
const STOPWORDS = new Set([
  'role', 'experience', 'employment', 'location', 'year', 'years',
  'team', 'company', 'candidate', 'position', 'job', 'work', 'working',
  'opportunity', 'responsibility', 'requirement', 'qualification',
  'skill', 'skills', 'ability', 'knowledge', 'degree', 'bachelor',
  'master', 'education', 'must', 'should', 'preferred', 'nice',
  'etc', 'including', 'plus', 'new', 'looking', 'seeking', 'hire'
]);

// ============================================================
// SECTION INDICATORS FOR SECTION-AWARE EXTRACTION
// ============================================================
const REQUIRED_SECTION_INDICATORS = [
  'required', 'must have', 'must-have', 'mandatory', 'essential',
  'core', 'minimum', 'necessary', 'need to have'
];

const PREFERRED_SECTION_INDICATORS = [
  'preferred', 'nice to have', 'bonus', 'plus', 'desired',
  'advantage', 'preferred skills', 'would be nice'
];

// ============================================================
// MAIN EXTRACTION CLASS
// ============================================================
class KeywordExtractorProduction {
  /**
   * Extract keywords from Job Description
   * Returns ~20-25 weighted, ranked keywords
   * 
   * @param {string} jdText - Full job description text
   * @returns {Object} Extracted keywords with metadata
   */
  extractKeywords(jdText) {
    if (!jdText || typeof jdText !== 'string') {
      return { keywords: [], role: 'Software Engineer' };
    }

    // Stage 1: Preprocessing and normalization
    const normalizedText = normalize(jdText);
    
    // Stage 2: Detect sections for section-aware extraction
    const sectionMultipliers = this._detectSectionMultipliers(jdText);
    
    // Stage 3: Extract separated terms (Java / Python / Node.js)
    const separatedTerms = this._extractAllSeparatedTerms(jdText);
    
    // Stage 4: Phrase-first matching with weights
    const { found, frequencyMap } = this._extractKeywords(normalizedText, separatedTerms);
    
    // Stage 5: Score keywords with frequency boosting
    const scoredKeywords = this._scoreKeywords(found, frequencyMap, sectionMultipliers, normalizedText);
    
    // Stage 6: Extract responsibility verbs
    const responsibilityVerbs = this._extractResponsibilityVerbs(jdText);
    
    // Stage 7: Add responsibility verbs to keywords
    const allKeywords = this._combineWithVerbs(scoredKeywords, responsibilityVerbs);
    
    // Stage 8: Deduplicate and return top 25
    const deduplicated = this._deduplicate(allKeywords);
    
    // Stage 9: Detect role using weighted clustering
    const role = this._detectRole(deduplicated);
    
    return {
      keywords: deduplicated.slice(0, 25),
      role,
      metadata: {
        totalKeywords: deduplicated.length,
        skillsCount: deduplicated.filter(k => TECH_MAP[k.keyword]?.role === 'backend' || TECH_MAP[k.keyword]?.role === 'frontend').length,
        toolsCount: deduplicated.filter(k => TECH_MAP[k.keyword]?.role === 'devops' || TECH_MAP[k.keyword]?.role === 'tool').length,
      }
    };
  }

  /**
   * Extract all separated terms (slash, comma, pipe)
   */
  _extractAllSeparatedTerms(text) {
    const separatedTerms = new Set();
    const normalized = normalize(text);
    
    // Split by common separators
    const parts = normalized.split(/[\/,\|]+/);
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.length > 1 && trimmed.length < 30) {
        separatedTerms.add(trimmed);
      }
    });
    
    return Array.from(separatedTerms);
  }

  /**
   * Detect section multipliers for section-aware extraction
   */
  _detectSectionMultipliers(text) {
    const multipliers = {};
    const lowerText = text.toLowerCase();
    
    // Find required section
    for (const indicator of REQUIRED_SECTION_INDICATORS) {
      const idx = lowerText.indexOf(indicator);
      if (idx !== -1) {
        // Find the end of this section (next 500 chars or next section)
        const endIdx = Math.min(idx + 800, lowerText.length);
        const sectionText = lowerText.substring(idx, endIdx);
        
        // Apply multiplier to keywords found in this section
        for (const tech of sortedTech) {
          if (sectionText.includes(tech)) {
            multipliers[tech] = 1.5;
          }
        }
        break;
      }
    }
    
    // Find preferred/nice to have section and apply penalty
    for (const indicator of PREFERRED_SECTION_INDICATORS) {
      const idx = lowerText.indexOf(indicator);
      if (idx !== -1) {
        const endIdx = Math.min(idx + 800, lowerText.length);
        const sectionText = lowerText.substring(idx, endIdx);
        
        for (const tech of sortedTech) {
          if (sectionText.includes(tech)) {
            multipliers[tech] = (multipliers[tech] || 1) * 0.8;
          }
        }
        break;
      }
    }
    
    return multipliers;
  }

  /**
   * Phrase-first matching - always match longer phrases first
   */
  _extractKeywords(normalizedText, separatedTerms) {
    const found = [];
    const frequencyMap = {};
    
    // First, check separated terms for matches
    for (const term of separatedTerms) {
      for (const tech of sortedTech) {
        if (term.includes(tech) || tech.includes(term)) {
          const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          const matches = normalizedText.match(regex);
          if (matches) {
            frequencyMap[term] = (frequencyMap[term] || 0) + matches.length;
            if (!found.includes(term)) {
              found.push(term);
            }
          }
        }
      }
    }
    
    // Then match against sorted tech dictionary (phrase-first)
    for (const tech of sortedTech) {
      const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const matches = normalizedText.match(regex);
      
      if (matches && matches.length > 0) {
        // Only add if not already found as a longer phrase
        const alreadyFound = found.some(f => f.includes(tech) && f.length > tech.length);
        if (!alreadyFound) {
          frequencyMap[tech] = (frequencyMap[tech] || 0) + matches.length;
          if (!found.includes(tech)) {
            found.push(tech);
          }
        }
      }
    }
    
    return { found, frequencyMap };
  }

  /**
   * Score keywords with frequency boosting: score = weight × frequency
   */
  _scoreKeywords(found, frequencyMap, sectionMultipliers, normalizedText) {
    return found.map(keyword => {
      const techInfo = TECH_MAP[keyword];
      const baseWeight = techInfo ? techInfo.weight : 1;
      const frequency = frequencyMap[keyword] || 1;
      const sectionMultiplier = sectionMultipliers[keyword] || 1;
      
      // Score = weight × frequency × section multiplier
      const score = baseWeight * frequency * sectionMultiplier;
      
      return {
        keyword,
        score,
        weight: baseWeight,
        frequency,
        role: techInfo ? techInfo.role : 'general',
        sectionMultiplier
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Extract responsibility verbs from JD
   */
  _extractResponsibilityVerbs(text) {
    const normalized = normalize(text);
    const found = [];
    
    for (const verb of RESPONSIBILITY_VERBS) {
      const regex = new RegExp(`\\b${verb}\\b`, 'gi');
      const matches = normalized.match(regex);
      if (matches) {
        found.push({
          keyword: verb,
          score: matches.length * 2, // Base score for verbs
          weight: 2,
          frequency: matches.length,
          role: 'responsibility'
        });
      }
    }
    
    return found;
  }

  /**
   * Combine scored keywords with responsibility verbs
   */
  _combineWithVerbs(scoredKeywords, verbs) {
    const combined = [...scoredKeywords];
    const existingKeywords = new Set(scoredKeywords.map(k => k.keyword));
    
    // Add verbs that aren't already in keywords
    for (const verb of verbs) {
      if (!existingKeywords.has(verb.keyword)) {
        combined.push(verb);
      }
    }
    
    return combined.sort((a, b) => b.score - a.score);
  }

  /**
   * Deduplicate similar keywords
   */
  _deduplicate(keywords) {
    const seen = new Set();
    const deduplicated = [];
    
    for (const kw of keywords) {
      const normalized = kw.keyword.toLowerCase().trim();
      
      // Skip if already seen
      if (seen.has(normalized)) continue;
      
      // Skip stopwords
      if (STOPWORDS.has(normalized)) continue;
      
      // Skip very short tokens
      if (normalized.length < 2) continue;
      
      seen.add(normalized);
      deduplicated.push(kw);
    }
    
    return deduplicated;
  }

  /**
   * Role detection using weighted clustering
   */
  _detectRole(scoredKeywords) {
    let backendScore = 0;
    let frontendScore = 0;
    let dataScore = 0;
    let mobileScore = 0;
    let devopsScore = 0;

    for (const kw of scoredKeywords.slice(0, 15)) { // Top 15 only
      const role = TECH_MAP[kw.keyword]?.role || kw.role;
      const weight = kw.score;

      if (role === "backend") backendScore += weight;
      if (role === "frontend") frontendScore += weight;
      if (role === "data") dataScore += weight;
      if (role === "mobile") mobileScore += weight;
      if (role === "devops") devopsScore += weight;
    }

    // Determine the dominant role
    const scores = [
      { role: "Backend Developer", score: backendScore },
      { role: "Frontend Developer", score: frontendScore },
      { role: "Data Scientist/Engineer", score: dataScore },
      { role: "Mobile Developer", score: mobileScore },
      { role: "DevOps Engineer", score: devopsScore },
    ];

    scores.sort((a, b) => b.score - a.score);
    
    // If scores are too close, default to Full Stack
    if (scores[0].score === 0 || scores[0].score - scores[1].score < 2) {
      return "Full Stack Developer";
    }

    return scores[0].role;
  }

  /**
   * Full JD analysis - returns comprehensive result
   */
  analyzeJD(jdText) {
    const result = this.extractKeywords(jdText);
    
    return {
      role: result.role,
      keywords: result.keywords,
      metadata: result.metadata,
      summary: {
        totalKeywords: result.keywords.length,
        techKeywords: result.keywords.filter(k => 
          TECH_MAP[k.keyword] && 
          ['backend', 'frontend', 'database'].includes(TECH_MAP[k.keyword].role)
        ).length,
        tools: result.keywords.filter(k => 
          TECH_MAP[k.keyword] && 
          ['devops', 'tool'].includes(TECH_MAP[k.keyword].role)
        ).length,
      }
    };
  }
}

// Export instance
module.exports = new KeywordExtractorProduction();
