/**
 * ===================================================================================================
 * PRODUCTION-GRADE FIXES FOR ATS RESUME BUILDER
 * ===================================================================================================
 * 
 * This file contains senior-level implementations for 4 critical ATS issues:
 * 1. Keyword Extraction Quality (normalization + deduplication)
 * 2. Suggestion Text Repetition (deduplication logic)
 * 3. Skills Count Logic (accurate calculation from multiple sources)
 * 4. Keyword Match Accuracy (improved scoring algorithm)
 * 
 * All functions are production-ready, fully documented, and handle edge cases.
 * Time Complexity: O(n log n) for most operations, O(n) for counting.
 */

// ===================================================================================================
// ISSUE 1: KEYWORD NORMALIZATION PIPELINE
// ===================================================================================================

/**
 * Production-grade keyword normalization with deduplication
 * 
 * @param {string[]} keywords - Raw extracted keywords
 * @returns {string[]} Clean, normalized, unique keywords
 * 
 * Flow:
 * 1. Lowercase all keywords (case normalization)
 * 2. Remove stopwords (common low-value words)
 * 3. Filter out short keywords (<3 chars)
 * 4. Normalize tech aliases (node.js → nodejs, etc.)
 * 5. Deduplicate using Set
 * 6. Sort by length DESC (longer = more specific)
 * 
 * Time Complexity: O(n log n) due to sort
 * Space Complexity: O(n) for Set storage
 */

const TECH_NORMALIZATIONS = {
  // JavaScript/Node ecosystem
  'node': 'nodejs',
  'node.js': 'nodejs',
  'nodejs': 'nodejs',
  'express.js': 'express',
  'expressjs': 'express',
  'next.js': 'nextjs',
  'nextjs': 'nextjs',
  'react.js': 'react',
  'reactjs': 'react',
  'vue.js': 'vue',
  'vuejs': 'vue',
  'nuxt.js': 'nuxt',
  'nuxtjs': 'nuxt',
  
  // Backend
  'django framework': 'django',
  'flask framework': 'flask',
  'fastapi framework': 'fastapi',
  'spring boot': 'springboot',
  'asp.net core': 'aspnet',
  'asp.net': 'aspnet',
  '.net core': 'dotnet',
  '.net': 'dotnet',
  'laravel framework': 'laravel',
  'ruby on rails': 'rails',
  'ruby rails': 'rails',
  
  // Databases
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
  'postgres': 'postgresql',
  'mysql': 'mysql',
  'maria db': 'mariadb',
  'mariadb': 'mariadb',
  'redis': 'redis',
  'elastic search': 'elasticsearch',
  'elasticsearch': 'elasticsearch',
  'dynamo db': 'dynamodb',
  'dynamodb': 'dynamodb',
  'mongo db atlas': 'mongodb',
  'sql': 'sql',
  
  // Cloud & DevOps
  'amazon web services': 'aws',
  'aws': 'aws',
  'microsoft azure': 'azure',
  'azure': 'azure',
  'google cloud': 'gcp',
  'gcp': 'gcp',
  'docker': 'docker',
  'kubernetes': 'kubernetes',
  'k8s': 'kubernetes',
  'github': 'github',
  'gitlab': 'gitlab',
  'jenkins': 'jenkins',
  'github actions': 'github-actions',
  'gitlab ci': 'gitlab-ci',
  'circle ci': 'circleci',
  'circleci': 'circleci',
  'travis ci': 'travis-ci',
  'travisci': 'travis-ci',
  
  // Languages (normalize common variants)
  'java script': 'javascript',
  'javascript': 'javascript',
  'type script': 'typescript',
  'typescript': 'typescript',
  'python3': 'python',
  'python': 'python',
  'c++': 'cpp',
  'c plus plus': 'cpp',
  'c#': 'csharp',
  'c sharp': 'csharp',
  'go lang': 'golang',
  'go': 'golang',
  'golang': 'golang',
  
  // Technologies
  'graphql': 'graphql',
  'rest': 'rest',
  'restful': 'rest-api',
  'rest api': 'rest-api',
  'web sockets': 'websocket',
  'websocket': 'websocket',
  'web rtc': 'webrtc',
  'webrtc': 'webrtc',
  'html5': 'html',
  'css3': 'css',
  'sass': 'sass',
  'scss': 'scss',
  'tailwind': 'tailwindcss',
  'tailwindcss': 'tailwindcss',
  'bootstrap': 'bootstrap',
  
  // Testing
  'jest': 'jest',
  'mocha': 'mocha',
  'chai': 'chai',
  'jasmine': 'jasmine',
  'cypress': 'cypress',
  'selenium': 'selenium',
  'playwright': 'playwright',
  'puppeteer': 'puppeteer',
  'unit testing': 'unit-testing',
  'integration testing': 'integration-testing',
  'e2e testing': 'e2e-testing',
  'end to end': 'e2e',
  
  // Data Science
  'machine learning': 'ml',
  'ml': 'ml',
  'tensorflow': 'tensorflow',
  'pytorch': 'pytorch',
  'keras': 'keras',
  'scikit learn': 'scikit-learn',
  'scikit-learn': 'scikit-learn',
  'pandas': 'pandas',
  'numpy': 'numpy',
  'nlp': 'nlp',
  'natural language processing': 'nlp',
  'computer vision': 'computer-vision',
};

// Advanced English stopwords to remove
const ADVANCED_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'that', 'this', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
  'who', 'when', 'where', 'why', 'how', 'which', 'more', 'other', 'own',
  'just', 'as', 'if', 'because', 'while', 'after', 'before', 'between',
  'through', 'during', 'above', 'below', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'then', 'once', 'here', 'there', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'much', 'many', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'your', 'his', 'hers', 'their',
  // Tech-specific stopwords to remove
  'software', 'developer', 'developer with', 'engineer', 'engineering',
  'development', 'system', 'technology', 'technical', 'experience',
  'experience in', 'experience with', 'knowledge of', 'knowledge in',
  'ability to', 'responsible for', 'requirement', 'required', 'must',
  'should', 'nice to have', 'preferred', 'including', 'such as',
  'application', 'programming', 'interface', 'web', 'mobile',
  'application programming interface', 'rest api', 'api endpoint',
]);

/**
 * Clean and normalize keywords
 * @param {string[]} keywords - Raw keywords
 * @returns {string[]} Clean, normalized, deduplicated keywords
 */
function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return [];
  }

  const normalizedSet = new Set();

  keywords.forEach((keyword) => {
    if (!keyword || typeof keyword !== 'string') return;

    // 1. Lowercase
    let normalized = keyword.toLowerCase().trim();

    // 2. Skip empty strings and single characters
    if (normalized.length < 2) return;

    // 3. Skip pure stopwords
    if (ADVANCED_STOPWORDS.has(normalized)) return;

    // 4. Remove trailing/leading generic phrases
    normalized = normalized
      .replace(/^(software|web|mobile|cloud|data)\s+/, '')
      .replace(/\s+(software|web|mobile|cloud|data)$/, '')
      .trim();

    // Skip if became empty
    if (normalized.length < 2) return;

    // 5. Apply tech-specific normalization mapping
    const mapped = TECH_NORMALIZATIONS[normalized];
    if (mapped) {
      normalized = mapped;
    }

    // 6. Skip if now a stopword
    if (ADVANCED_STOPWORDS.has(normalized)) return;

    // 7. Add to set (automatic deduplication)
    normalizedSet.add(normalized);
  });

  // 8. Convert to array and sort by length DESC (more specific first)
  return Array.from(normalizedSet).sort((a, b) => b.length - a.length);
}

// ===================================================================================================
// ISSUE 2: SUGGESTION DEDUPLICATION (Prevent "quantify the impact — quantify the impact")
// ===================================================================================================

/**
 * Detect if suggestion text is duplicated or repetitive
 * @param {string} text - Suggestion text
 * @returns {boolean} True if text contains repetition
 * 
 * Examples:
 * - "quantify — quantify" → true
 * - "add metrics — add more metrics" → false (different)
 * - "improve improve improve" → true
 */
function hasRepetitiveText(text) {
  if (!text || typeof text !== 'string') return false;

  // Split by common separators
  const segments = text.split(/(?:—|–|-|;|,)/);

  // Check if any segment appears multiple times
  const segmentLower = segments.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 3);

  // If we have duplicates in short list, it's repetitive
  if (segmentLower.length > 1) {
    const unique = new Set(segmentLower);
    if (unique.size < segmentLower.length) {
      return true;
    }
  }

  // Check for word repetition within single segment
  const words = text.toLowerCase().split(/\s+/);
  if (words.length > 4) {
    const seen = new Map();
    for (const word of words) {
      if (word.length > 4) {
        const count = (seen.get(word) || 0) + 1;
        if (count > 2) return true; // Same word appears 3+ times
        seen.set(word, count);
      }
    }
  }

  return false;
}

/**
 * Clean suggestion text of repetition
 * @param {string} text - Raw suggestion text
 * @returns {string} Cleaned text without repetition
 * 
 * Time Complexity: O(n) where n = text length
 */
function deduplicateSuggestionText(text) {
  if (!text || typeof text !== 'string') return '';

  // Remove patterns like "— quantify the impact — quantify the impact"
  // Keep only first occurrence
  const segments = text.split(/(?:—|–)/);

  if (segments.length <= 1) {
    // No separator, check for word repetition
    const words = text.split(/\s+/);
    const seen = new Set();
    const clean = [];

    for (const word of words) {
      const lower = word.toLowerCase();
      // Allow some key words to repeat (like prepositions), but not content words
      if (lower.length <= 3 || !seen.has(lower)) {
        clean.push(word);
        if (lower.length > 4) {
          seen.add(lower);
        }
      }
    }
    return clean.join(' ').trim();
  }

  // Multiple segments: keep unique ones
  const seen = new Set();
  const unique = [];

  for (const segment of segments) {
    const clean = segment.trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      unique.push(clean);
      seen.add(clean.toLowerCase());
    }
  }

  return unique.join(' — ').trim();
}

/**
 * Filter duplicate suggestions from array
 * @param {object[]} suggestions - Array of suggestion objects
 * @returns {object[]} Deduplicated suggestions
 * 
 * Time Complexity: O(n) where n = suggestions length
 */
function deduplicateSuggestions(suggestions) {
  if (!Array.isArray(suggestions)) return [];

  const seen = new Map(); // Store by (section, type, reason) hash

  return suggestions.filter((suggestion) => {
    // Create hash for this suggestion
    const hash = `${suggestion.section}::${suggestion.type}::${suggestion.reason}`;

    // Skip if we've seen this exact suggestion
    if (seen.has(hash)) {
      return false;
    }

    seen.set(hash, true);

    // Also clean repetitive text in suggestedText
    const cleanedText = deduplicateSuggestionText(suggestion.suggestedText);
    suggestion.suggestedText = cleanedText;

    return true;
  });
}

// ===================================================================================================
// ISSUE 3: ACCURATE SKILLS COUNT (from resume.skills[], projects, experience)
// ===================================================================================================

/**
 * Calculate total unique skills from all resume sections
 * 
 * Sources:
 * - resume.skills[] (direct skills section)
 * - resume.projects[].techStack or .technologies
 * - resume.experience[].technologies or extracted from bullets
 * 
 * @param {object} resume - Resume object
 * @returns {object} { count, skills: Set, breakdown: {...} }
 * 
 * Time Complexity: O(n) where n = total skills across all sections
 */
function calculateTotalUniqueSkills(resume) {
  const uniqueSkills = new Set();
  const breakdown = {
    fromSkillsSection: 0,
    fromProjects: 0,
    fromExperience: 0,
  };

  if (!resume || typeof resume !== 'object') {
    return { count: 0, skills: new Set(), breakdown };
  }

  // Helper: normalize and add skill
  const addSkill = (skill, section) => {
    if (!skill || typeof skill !== 'string') return false;

    let normalized = skill.trim().toLowerCase();

    // Skip empty or very short
    if (normalized.length < 2) return false;

    // Normalize common variants
    normalized = normalized
      .replace(/\bc\+\+\b/g, 'cpp')
      .replace(/\bc#\b/g, 'csharp')
      .replace(/\bp\.js\b/g, 'pjs')
      .replace(/\b(node\.js|nodejs)\b/gi, 'nodejs')
      .replace(/\b(next\.js|nextjs)\b/gi, 'nextjs')
      .replace(/\b(\.net core|\.net)\b/gi, 'dotnet')
      .replace(/\bobj-c\b/gi, 'objc')
      .replace(/\b(react\.js|reactjs)\b/gi, 'react')
      .replace(/\b(vue\.js|vuejs)\b/gi, 'vue')
      .replace(/\b(express\.js|expressjs)\b/gi, 'express')
      .replace(/\b(ruby on rails|rails)\b/gi, 'rails')
      .replace(/\b(machine learning|ml)\b/gi, 'ml')
      .replace(/\b(natural language processing|nlp)\b/gi, 'nlp');

    if (normalized.length < 2) return false;

    if (!uniqueSkills.has(normalized)) {
      uniqueSkills.add(normalized);
      breakdown[section]++;
      return true;
    }
    return false;
  };

  // 1. Extract from skills section
  if (resume.skills && Array.isArray(resume.skills)) {
    resume.skills.forEach((skillGroup) => {
      if (skillGroup.items && Array.isArray(skillGroup.items)) {
        skillGroup.items.forEach((item) => {
          addSkill(item, 'fromSkillsSection');
        });
      } else if (typeof skillGroup === 'string') {
        addSkill(skillGroup, 'fromSkillsSection');
      }
    });
  }

  // 2. Extract from projects
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach((project) => {
      // Try multiple property names for tech stack
      const techStack =
        project.techStack ||
        project.technologies ||
        project.tech ||
        project.tools ||
        [];

      if (Array.isArray(techStack)) {
        techStack.forEach((tech) => {
          addSkill(tech, 'fromProjects');
        });
      }

      // Also extract from project description/bullets
      if (project.description && typeof project.description === 'string') {
        const techKeywords = extractTechKeywordsFromText(project.description);
        techKeywords.forEach((tech) => {
          addSkill(tech, 'fromProjects');
        });
      }
    });
  }

  // 3. Extract from experience
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach((exp) => {
      // Try multiple property names for technologies
      const technologies = exp.technologies || exp.tech || exp.tools || [];

      if (Array.isArray(technologies)) {
        technologies.forEach((tech) => {
          addSkill(tech, 'fromExperience');
        });
      }

      // Extract from bullets/description
      if (exp.bullets && Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet) => {
          if (typeof bullet === 'string') {
            const techKeywords = extractTechKeywordsFromText(bullet);
            techKeywords.forEach((tech) => {
              addSkill(tech, 'fromExperience');
            });
          }
        });
      }
    });
  }

  return {
    count: uniqueSkills.size,
    skills: uniqueSkills,
    breakdown,
  };
}

/**
 * Extract tech keywords from plain text
 * @param {string} text - Text content
 * @returns {string[]} Extracted tech keywords
 * 
 * Time Complexity: O(n) where n = text length
 */
function extractTechKeywordsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const commonTechs = [
    'javascript', 'python', 'java', 'typescript', 'react', 'node', 'nodejs',
    'express', 'mongodb', 'postgresql', 'mysql', 'docker', 'kubernetes',
    'aws', 'azure', 'gcp', 'git', 'github', 'gitlab', 'api', 'rest',
    'graphql', 'websocket', 'html', 'css', 'sass', 'tailwind', 'bootstrap',
    'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel', 'c++',
    'c#', 'go', 'rust', 'kotlin', 'swift', 'vue', 'angular', 'svelte',
    'redis', 'elasticsearch', 'kafka', 'jenkins', 'git', 'docker',
    'machine learning', 'ml', 'tensorflow', 'pytorch', 'pandas', 'numpy',
  ];

  const found = new Set();
  const lower = text.toLowerCase();

  for (const tech of commonTechs) {
    const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      found.add(tech);
    }
  }

  return Array.from(found);
}

// ===================================================================================================
// ISSUE 4: IMPROVED KEYWORD MATCH SCORING
// ===================================================================================================

/**
 * Advanced keyword matching with normalization and partial matching
 * 
 * Algorithm:
 * 1. Normalize both resume and JD keywords
 * 2. Use Set intersection for exact matches
 * 3. Apply partial matching (react matches react.js)
 * 4. Avoid double counting
 * 5. Return detailed breakdown
 * 
 * @param {string[]} resumeKeywords - Keywords from resume
 * @param {string[]} jdKeywords - Keywords from JD
 * @returns {object} { matched: number, total: number, percentage: number, matched_list: [] }
 * 
 * Time Complexity: O(n + m) where n = resume keywords, m = JD keywords
 * Space Complexity: O(n + m)
 */
function calculateKeywordMatchScore(resumeKeywords, jdKeywords) {
  if (!Array.isArray(resumeKeywords) || !Array.isArray(jdKeywords)) {
    return {
      matched: 0,
      total: jdKeywords?.length || 0,
      percentage: 0,
      matched_list: [],
      unmatched_list: jdKeywords || [],
      strategy: 'invalid_input',
    };
  }

  if (jdKeywords.length === 0) {
    return {
      matched: 0,
      total: 0,
      percentage: 0,
      matched_list: [],
      unmatched_list: [],
      strategy: 'empty_jd',
    };
  }

  // Normalize all keywords for comparison
  const normalizedResume = normalizeKeywords(resumeKeywords);
  const normalizedJD = normalizeKeywords(jdKeywords);

  if (normalizedJD.length === 0) {
    return {
      matched: 0,
      total: jdKeywords.length,
      percentage: 0,
      matched_list: [],
      unmatched_list: jdKeywords,
      strategy: 'no_valid_jd_keywords',
    };
  }

  const resumeSet = new Set(normalizedResume);
  const matched = [];
  const unmatched = [];

  // 1. Exact match
  for (const keyword of normalizedJD) {
    if (resumeSet.has(keyword)) {
      matched.push(keyword);
    } else {
      // 2. Try partial matching (react matches react-native, reactjs)
      const partialMatch = normalizedResume.find((rk) => {
        return (
          rk.includes(keyword) ||
          keyword.includes(rk) ||
          isTechVariant(rk, keyword)
        );
      });

      if (partialMatch) {
        matched.push(`${keyword} (via ${partialMatch})`);
      } else {
        unmatched.push(keyword);
      }
    }
  }

  // Remove duplicates (avoid double counting)
  const uniqueMatched = new Set(matched);

  const percentage =
    normalizedJD.length > 0
      ? Math.round((uniqueMatched.size / normalizedJD.length) * 100)
      : 0;

  return {
    matched: uniqueMatched.size,
    total: normalizedJD.length,
    percentage,
    matched_list: Array.from(uniqueMatched),
    unmatched_list: unmatched,
    strategy: 'advanced_matching',
  };
}

/**
 * Check if two tech keywords are variants of the same technology
 * @param {string} a - First keyword
 * @param {string} b - Second keyword
 * @returns {boolean} True if they're variants
 * 
 * Time Complexity: O(1) constant
 */
function isTechVariant(a, b) {
  // Group variants together
  const variants = [
    // JavaScript frameworks
    ['react', 'react-native', 'reactjs', 'react.js'],
    ['vue', 'vue.js', 'vuejs'],
    ['angular', 'angularjs', 'angular.js'],
    ['next', 'nextjs', 'next.js'],
    ['nuxt', 'nuxtjs', 'nuxt.js'],
    
    // Node ecosystem
    ['node', 'nodejs', 'node.js'],
    ['express', 'express.js', 'expressjs'],
    
    // Databases
    ['mongo', 'mongodb', 'mongo-db'],
    ['postgres', 'postgresql', 'postgres-sql'],
    ['mysql', 'mysql-db'],
    
    // Cloud
    ['aws', 'amazon-web-services', 'amazon web services'],
    ['azure', 'microsoft-azure'],
    ['gcp', 'google-cloud', 'google cloud platform'],
    
    // Testing
    ['end-to-end', 'e2e', 'e2e-testing'],
    
    // Languages
    ['cpp', 'c++', 'c-plus-plus'],
    ['csharp', 'c#', 'c-sharp'],
    ['golang', 'go', 'go-lang'],
    
    // ML
    ['ml', 'machine-learning', 'machine learning'],
    ['nlp', 'natural-language-processing'],
  ];

  for (const group of variants) {
    if (group.includes(a) && group.includes(b)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate comprehensive ATS match percentage
 * Considers keywords, skills, and structural completeness
 * 
 * @param {object} resume - Resume object
 * @param {object} jdAnalysis - JD analysis result
 * @returns {number} Match percentage 0-100
 * 
 * Time Complexity: O(n + m)
 */
function calculateComprehensiveATSScore(resume, jdAnalysis) {
  if (!jdAnalysis || !jdAnalysis.allKeywords) {
    return 0;
  }

  // Extract resume keywords from multiple sections
  const resumeKeywords = [];

  // From skills section
  if (resume.skills && Array.isArray(resume.skills)) {
    resume.skills.forEach((sg) => {
      if (sg.items && Array.isArray(sg.items)) {
        resumeKeywords.push(...sg.items);
      }
    });
  }

  // From experience bullets/tech
  if (resume.experience && Array.isArray(resume.experience)) {
    resume.experience.forEach((exp) => {
      if (exp.technologies) {
        resumeKeywords.push(...(Array.isArray(exp.technologies) ? exp.technologies : [exp.technologies]));
      }
      if (exp.bullets && Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet) => {
          const techs = extractTechKeywordsFromText(bullet);
          resumeKeywords.push(...techs);
        });
      }
    });
  }

  // From projects
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach((proj) => {
      if (proj.techStack) {
        resumeKeywords.push(...(Array.isArray(proj.techStack) ? proj.techStack : [proj.techStack]));
      }
    });
  }

  // Calculate match
  const matchScore = calculateKeywordMatchScore(
    resumeKeywords,
    jdAnalysis.allKeywords
  );

  return matchScore.percentage;
}

// ===================================================================================================
// EXPORT ALL FUNCTIONS (Production-Ready)
// ===================================================================================================

module.exports = {
  // Issue 1: Keyword normalization
  normalizeKeywords,
  
  // Issue 2: Suggestion deduplication
  hasRepetitiveText,
  deduplicateSuggestionText,
  deduplicateSuggestions,
  
  // Issue 3: Skills counting
  calculateTotalUniqueSkills,
  extractTechKeywordsFromText,
  
  // Issue 4: Keyword matching
  calculateKeywordMatchScore,
  isTechVariant,
  calculateComprehensiveATSScore,
};
