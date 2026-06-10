/**
 * Enhanced Keyword Extractor
 * Enterprise-grade NLP for JD keyword extraction
 * 
 * File: b2world-backend1/utils/keywordExtractorEnhanced.js
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
  'must', 'shall', 'am', 'as', 'this', 'that', 'these', 'those', 'you', 'your',
  'we', 'our', 'he', 'she', 'it', 'its', 'them', 'their', 'who', 'which', 'what',
  'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'either', 'neither',
  'some', 'any', 'no', 'not', 'only', 'just', 'same', 'such', 'than'
]);

const SKILL_SYNONYMS = {
  'programming': ['coding', 'development', 'software development', 'code'],
  'rest api': ['restful', 'rest apis', 'rest'],
  'node.js': ['nodejs', 'node'],
  'next.js': ['nextjs', 'next'],
  'backend': ['back-end', 'server-side', 'server side'],
  'frontend': ['front-end', 'client-side', 'client side', 'ui'],
  'microservice': ['microservices'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  'devops': ['dev-ops', 'infrastructure'],
  'machine learning': ['ml', 'deep learning', 'ai', 'artificial intelligence'],
  'data science': ['data analytics', 'analytics'],
  'cloud': ['aws', 'azure', 'gcp', 'cloud computing'],
};

class KeywordExtractorEnhanced {
  /**
   * Extract keywords from Job Description
   * Returns categorized, ranked keywords
   * 
   * @param {string} jdText - Full job description text
   * @returns {Array} Extracted keywords with metadata
   */
  extractKeywords(jdText) {
    if (!jdText || typeof jdText !== 'string') {
      return [];
    }

    // Stage 1: Preprocessing
    const cleaned = this._preprocess(jdText);
    
    // Stage 2: Tokenization
    const tokens = this._tokenize(cleaned);
    
    // Stage 3: Filter & Normalize (including remove generic terms)
    const filtered = this._filterGenericTerms(tokens);
    
    // Stage 4: Extract phrases (multi-word keywords)
    const phrases = this._extractPhrases(filtered, tokens);
    
    // Stage 5: Count frequencies
    const scored = this._scoreByFrequency(phrases, jdText);
    
    // Stage 6: Categorize
    const categorized = this._categorize(scored);
    
    // Stage 7: Rank importance
    const ranked = this._rankByImportance(categorized, jdText);
    
    // Stage 8: Deduplicate with synonyms
    const deduplicated = this._deduplicateWithSynonyms(ranked);
    
    // FIXED: Return MAX 25 high-value keywords
    return deduplicated.slice(0, 25);
  }

  /**
   * Filter out generic terms that are not technical skills
   */
  _filterGenericTerms(tokens) {
    const GENERIC_VERBS = new Set([
      'develop', 'developing', 'developed', 'maintain', 'maintained', 'maintaining',
      'optimize', 'optimized', 'create', 'created', 'build', 'built', 'work', 'working',
      'help', 'helped', 'assist', 'assisted', 'support', 'supported', 'coordinate', 'coordinated'
    ]);
    
    const GENERIC_NOUNS = new Set([
      'experience', 'knowledge', 'developer', 'software', 'system', 'application',
      'project', 'team', 'working', 'ability', 'skill', 'skills', 'year', 'years',
      'responsibility', 'responsibilities', 'requirement', 'requirements', 'qualification',
      'qualifications', 'duty', 'duties', 'role', 'position', 'job', 'work'
    ]);
    
    return tokens.filter(token => {
      // Remove stopwords
      if (STOPWORDS.has(token)) return false;
      // Remove tokens < 3 chars
      if (token.length < 3) return false;
      // Remove generic verbs
      if (GENERIC_VERBS.has(token)) return false;
      // Remove generic nouns
      if (GENERIC_NOUNS.has(token)) return false;
      return true;
    });
  }

  _preprocess(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove special chars except spaces
      .replace(/\s+/g, ' ')       // Collapse multiple spaces
      .trim();
  }

  _tokenize(text) {
    return text.split(/\s+/).filter(token => token.length > 0);
  }

  _filterStopwords(tokens) {
    return tokens.filter(token => {
      if (STOPWORDS.has(token)) return false;
      if (token.length < 2) return false;
      return true;
    });
  }

  /**
   * Extract multi-word phrases (tech-specific)
   * Examples: 'rest api', 'machine learning', 'data pipeline'
   */
  _extractPhrases(filtered, original) {
    const phrases = [];
    const text = original.join(' ');
    
    // Common tech phrases (2-4 words)
    const techPatterns = [
      // 3-word phrases
      /machine learning/gi,
      /data science/gi,
      /user experience/gi,
      /user interface/gi,
      /continuous integration/gi,
      /continuous deployment/gi,
      /rest api/gi,
      /object oriented/gi,
      /design pattern/gi,
      /agile development/gi,
      /cloud infrastructure/gi,
      /data warehouse/gi,
      /big data/gi,
      /code review/gi,
      /server side/gi,
      /client side/gi,
      /unit test/gi,
      /integration test/gi,
      /system design/gi,
      /software architecture/gi,
      /api design/gi,
      /database design/gi,
      /front end/gi,
      /back end/gi,
      
      // 2-word phrases
      /web development/gi,
      /mobile development/gi,
      /full stack/gi,
      /high availability/gi,
      /load balancing/gi,
      /auto scaling/gi,
      /fault tolerance/gi,
      /distributed system/gi,
      /message queue/gi,
      /job scheduler/gi,
      /workflow orchestration/gi,
      // ── Data Science ──
      /data visualization/gi,
      /data visualisation/gi,
      /predictive modeling/gi,
      /predictive modelling/gi,
      /predictive analytics/gi,
      /feature engineering/gi,
      /feature extraction/gi,
      /data preprocessing/gi,
      /model performance/gi,
      /model evaluation/gi,
      /natural language processing/gi,
      /computer vision/gi,
      /deep learning/gi,
      /neural network/gi,
      /statistical analysis/gi,
      /statistical modeling/gi,
      /time series/gi,
      /data pipeline/gi,
      /data engineering/gi,
      /business intelligence/gi,
      /machine learning model/gi,
      /scikit learn/gi,
      /power bi/gi,
      /a b testing/gi,
      /reinforcement learning/gi,
      // ── Backend/Cloud missing ──
      /api development/gi,
      /software development/gi,
      /cloud computing/gi,
      /data structure/gi,
      /version control/gi,
      /object oriented/gi,
      /test driven/gi,
      /event driven/gi,
      /domain driven/gi,
      /spring boot/gi,
      /react native/gi,
      /next js/gi,
      /nest js/gi,
    ];

    for (const pattern of techPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches.map(m => m.toLowerCase()));
      }
    }

    // Only add single tokens that are genuinely technical (4+ chars, not common words)
    const NOISE = new Set([
      'data','using','large','small','good','best','high','low','new','fast',
      'make','take','give','know','need','based','driven','cross','model','models',
      'learn','build','team','strong','multiple','including','within','across',
      'through','other','various','about','their','from','with','that','this',
      'will','have','your','more','also','each','used','well','able','both',
    ]);
    phrases.push(...filtered.filter(w => w.length >= 4 && !NOISE.has(w)));

    return [...new Set(phrases)]; // Deduplicate
  }

  /**
   * Score keywords by frequency
   */
  _scoreByFrequency(phrases, text) {
    const scored = phrases.map(phrase => {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      const matches = text.match(regex) || [];
      const frequency = matches.length;
      
      return {
        keyword: phrase.trim(),
        frequency,
        score: frequency * (phrase.split(/\s+/).length), // Favor multi-word phrases
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Categorize keywords by type
   */
  _categorize(scored) {
    const CATEGORIES = {
      language: ['javascript', 'python', 'java', 'golang', 'rust', 'cpp', 'c#', 'typescript', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r'],
      framework: ['react', 'vue', 'angular', 'node.js', 'django', 'flask', 'spring', 'rails', 'laravel', 'nestjs'],
      database: ['mongodb', 'postgresql', 'mysql', 'redis', 'dynamodb', 'firestore', 'elasticsearch', 'cassandra', 'sql', 'nosql'],
      cloud: ['aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'docker', 'heroku', 'cloudflare'],
      tool: ['git', 'jira', 'slack', 'figma', 'jenkins', 'terraform', 'ansible', 'gradle', 'maven', 'npm', 'yarn'],
      practice: ['agile', 'scrum', 'testing', 'ci/cd', 'devops', 'microservice', 'code review', 'tdd', 'pair programming'],
      soft_skill: ['communication', 'leadership', 'teamwork', 'problem solving', 'analytical', 'critical thinking'],
      concept: ['algorithm', 'data structure', 'design pattern', 'architecture', 'system design', 'scalability'],
    };

    return scored.map(item => {
      let category = 'general';
      const keyword = item.keyword.toLowerCase();

      for (const [cat, keywords] of Object.entries(CATEGORIES)) {
        if (keywords.some(kw => keyword.includes(kw) || kw.includes(keyword))) {
          category = cat;
          break;
        }
      }

      return {
        ...item,
        category,
      };
    });
  }

  /**
   * Rank by importance based on position and context
   */
  _rankByImportance(categorized, text) {
    const lines = text.split('\n');
    
    return categorized.map(item => {
      let importance = 'Nice_to_have';
      
      // Check position in document
      const pattern = new RegExp(`\\b${item.keyword}\\b`, 'gi');
      const matches = Array.from(text.matchAll(pattern));
      
      if (matches.length >= 3) {
        importance = 'Critical'; // Mentioned 3+ times
      } else if (matches.length === 2) {
        importance = 'Important';
      }
      
      // Check if in "required" section
      if (text.includes('required')) {
        const requiredSection = text.substring(
          text.indexOf('required'),
          Math.min(text.indexOf('required') + 1000, text.length)
        );
        if (requiredSection.includes(item.keyword)) {
          importance = 'Critical';
        }
      }
      
      // Check if in "nice to have" section
      if (text.includes('nice to have') || text.includes('optional')) {
        const niceSection = text.substring(
          text.indexOf('nice') || text.indexOf('optional'),
          Math.min((text.indexOf('nice') || text.indexOf('optional')) + 1000, text.length)
        );
        if (niceSection.includes(item.keyword)) {
          importance = 'Nice_to_have';
        }
      }
      
      return {
        ...item,
        importance,
      };
    });
  }

  /**
   * Deduplicate similar keywords (using synonyms)
   */
  _deduplicateWithSynonyms(ranked) {
    const kept = [];
    const seenNormalized = new Set();

    for (const item of ranked) {
      const normalized = this._normalizeKeyword(item.keyword);
      
      if (seenNormalized.has(normalized)) {
        continue; // Skip duplicate
      }
      
      seenNormalized.add(normalized);
      kept.push(item);
    }

    return kept;
  }

  /**
   * Normalize keyword for synonym matching
   */
  _normalizeKeyword(keyword) {
    const lower = keyword.toLowerCase().trim();
    
    for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      if (lower === canonical || synonyms.includes(lower)) {
        return canonical;
      }
    }

    return lower;
  }

  /**
   * Extract role from JD
   */
  extractRole(jdText) {
    const rolePatterns = [
      /(?:looking for|seeking|hire|need)(?:\s+a|\s+an)?\s+([^\n,\.]+?)(?:developer|engineer|specialist|architect|manager)/i,
      /^([^\n,\.]+?)(?:developer|engineer|specialist|architect|manager)/im,
      /(?:job title|position):\s*([^\n,\.]+)/i,
      /(?:role|position):\s*([^\n,\.]+)/i,
    ];

    for (const pattern of rolePatterns) {
      const match = jdText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Software Engineer'; // Default
  }

  /**
   * Extract responsibilities from JD
   */
  extractResponsibilities(jdText) {
    const responsibilities = [];
    
    // Look for bullet points or numbered lists
    const lines = jdText.split('\n');
    let inResponsibilities = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('responsibility') || line.toLowerCase().includes('duty')) {
        inResponsibilities = true;
        continue;
      }
      
      if (inResponsibilities && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
        responsibilities.push(line.replace(/^[-•\d+\.]\s*/, '').trim());
      }
      
      if (inResponsibilities && line.trim() === '') {
        inResponsibilities = false;
      }
    }

    return responsibilities.slice(0, 10); // Top 10
  }

  /**
   * Extract requirements from JD
   */
  extractRequirements(jdText) {
    const requirements = [];
    
    const lines = jdText.split('\n');
    let inRequirements = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('requirement') || line.toLowerCase().includes('qualification')) {
        inRequirements = true;
        continue;
      }
      
      if (inRequirements && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
        requirements.push(line.replace(/^[-•\d+\.]\s*/, '').trim());
      }
      
      if (inRequirements && line.trim() === '') {
        inRequirements = false;
      }
    }

    return requirements.slice(0, 15); // Top 15
  }

  /**
   * Full JD analysis
   */
  analyzeJD(jdText) {
    return {
      role: this.extractRole(jdText),
      keywords: this.extractKeywords(jdText),
      responsibilities: this.extractResponsibilities(jdText),
      requirements: this.extractRequirements(jdText),
      summary: jdText.substring(0, 200), // First 200 chars
    };
  }
}

module.exports = KeywordExtractorEnhanced;
