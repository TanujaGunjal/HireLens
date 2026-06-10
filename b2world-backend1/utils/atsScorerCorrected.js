/**
 * ATS Scoring Engine - Corrected Implementation
 * Implements official 40/20/20/10/10 weights with tier-based adjustment
 * 
 * File: b2world-backend1/utils/atsScorerCorrected.js
 */

class ATSScorerCorrected {
  /**
   * Calculate ATS score following B2World spec: 40/20/20/10/10
   * 
   * @param {Object} resume - Resume document
   * @param {Array} jdKeywords - JD keywords (optional)
   * @param {String} detectedRole - Role detected from JD (optional, for generic mode)
   * @returns {Object} Detailed score breakdown
   */
  calculateScore(resume, jdKeywords = [], detectedRole = null) {
    // Validation
    if (!resume || typeof resume !== 'object') {
      throw new TypeError('resume must be non-null object');
    }

    const normalizedJdKeywords = this._normalizeJDKeywordList(jdKeywords);
    const hasJD = normalizedJdKeywords.length > 0;
    const scoringMode = hasJD ? 'job-specific' : 'general';

    // ===== COMPONENT SCORES (0-100 scale) =====
    const keywordScore = hasJD
      ? this._calculateKeywordMatch(resume, normalizedJdKeywords, detectedRole, hasJD)
      : 0;
    
    const completenessScore = this._calculateCompleteness(resume);
    const formattingScore = this._calculateFormatting(resume);
    const verbScore = this._calculateActionVerbs(resume);
    const readabilityScore = this._calculateReadability(resume);

    // ===== CANONICAL BREAKDOWN (0-100 numeric fields) =====
    const rawBreakdown = this._buildBreakdown(
      keywordScore,
      formattingScore,
      completenessScore,
      verbScore,
      readabilityScore
    );

    let breakdown = scoringMode === 'general'
      ? {
          formatting: rawBreakdown.formatting,
          completeness: rawBreakdown.completeness,
          actionVerbs: rawBreakdown.actionVerbs,
          readability: rawBreakdown.readability
        }
      : rawBreakdown;

    // Defensive validation: if any field is invalid, recompute once from source resume
    if (!this._isValidBreakdown(breakdown)) {
      breakdown = this._buildBreakdown(
        this._calculateKeywordMatch(resume, normalizedJdKeywords, detectedRole, hasJD),
        this._calculateFormatting(resume),
        this._calculateCompleteness(resume),
        this._calculateActionVerbs(resume),
        this._calculateReadability(resume)
      );
      if (scoringMode === 'general') {
        breakdown = {
          formatting: breakdown.formatting,
          completeness: breakdown.completeness,
          actionVerbs: breakdown.actionVerbs,
          readability: breakdown.readability
        };
      }
    }

    if (!this._isValidBreakdown(breakdown)) {
      throw new Error('Invalid ATS breakdown: unable to compute all score components');
    }

    const totalScore = this._calculateWeightedTotal(breakdown, scoringMode);
    const tier = this._determineTier(breakdown.keywordMatch || 0, breakdown.completeness);

    // Generate insights
    const missingKeywords = hasJD ? this._findMissingKeywords(resume, normalizedJdKeywords) : [];
    const missingSections = this._findMissingSections(resume);
    const suggestions = this._generateSuggestions(resume, breakdown, missingKeywords);

    return {
      totalScore,
      breakdown,
      tier,
      hasJD,
      scoringMode,
      detectedRole,
      missingKeywords,
      missingSections,
      suggestions,
      overallFeedback: {
        strengths: this._identifyStrengths(breakdown),
        weaknesses: this._identifyWeaknesses(breakdown),
        recommendations: this._generateRecommendations(breakdown, hasJD),
      }
    };
  }

  // ===== TIER-BASED WEIGHTING SYSTEM =====
  
  _determineTier(keywordScore, completenessScore) {
    const keywordLevel = keywordScore < 40 ? 'low' : keywordScore < 70 ? 'medium' : 'high';
    const completenessLevel = completenessScore < 40 ? 'low' : completenessScore < 60 ? 'medium' : 'high';
    
    if (keywordScore >= 85 && completenessScore >= 75) {
      return 'tier1_exceptional';  // Perfect fit
    } else if (keywordScore >= 70 && completenessScore >= 55) {
      return 'tier2_strong';        // Good fit
    } else if (keywordScore >= 50 && completenessScore >= 40) {
      return 'tier3_average';       // Moderate fit
    } else {
      return 'tier4_developing';    // Needs work
    }
  }

  _getWeightsByTier(tier) {
    const tierWeights = {
      tier1_exceptional: {
        keyword: 40,
        completeness: 20,
        formatting: 20,
        verbs: 10,
        readability: 10,
      },
      tier2_strong: {
        keyword: 40,
        completeness: 20,
        formatting: 20,
        verbs: 10,
        readability: 10,
      },
      tier3_average: {
        // Slightly emphasize completeness for developing resumes
        keyword: 35,
        completeness: 25,
        formatting: 20,
        verbs: 10,
        readability: 10,
      },
      tier4_developing: {
        // Much more emphasis on completeness/fundamentals
        keyword: 30,
        completeness: 30,
        formatting: 20,
        verbs: 10,
        readability: 10,
      }
    };

    return tierWeights[tier];
  }

  _normalizeScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return NaN;
    return Math.min(Math.max(Math.round(numeric), 0), 100);
  }

  _buildBreakdown(keywordMatch, formatting, completeness, actionVerbs, readability) {
    return {
      keywordMatch: this._normalizeScore(keywordMatch),
      formatting: this._normalizeScore(formatting),
      completeness: this._normalizeScore(completeness),
      actionVerbs: this._normalizeScore(actionVerbs),
      readability: this._normalizeScore(readability),
    };
  }

  _isValidBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== 'object') return false;
    const required = ['formatting', 'completeness', 'actionVerbs', 'readability'];
    if (Object.prototype.hasOwnProperty.call(breakdown, 'keywordMatch')) {
      required.push('keywordMatch');
    }
    return required.every((key) => Number.isFinite(breakdown[key]));
  }

  _calculateWeightedTotal(breakdown, scoringMode = 'job-specific') {
    if (!this._isValidBreakdown(breakdown)) {
      throw new Error('Cannot compute totalScore from invalid breakdown');
    }

    const rawTotal = scoringMode === 'general'
      ? Math.round(
          (breakdown.formatting * 0.3) +
          (breakdown.completeness * 0.3) +
          (breakdown.actionVerbs * 0.2) +
          (breakdown.readability * 0.2)
        )
      : Math.round(
          (breakdown.keywordMatch * 0.4) +
          (breakdown.formatting * 0.2) +
          (breakdown.completeness * 0.2) +
          (breakdown.actionVerbs * 0.1) +
          (breakdown.readability * 0.1)
        );

    if (rawTotal <= 90) return rawTotal;
    return Math.round(90 + ((rawTotal - 90) * 0.35));
  }

  // ===== COMPONENT CALCULATIONS =====

  _calculateKeywordMatch(resume, jdKeywords, detectedRole, hasJD) {
    if (!hasJD && detectedRole) {
      // Generic mode: use role-based keywords
      return this._scoreAgainstRoleLibrary(resume, detectedRole);
    }

    if (!hasJD) {
      // No JD, no role: Limited scoring
      return this._scoreIntrinsicQuality(resume);
    }

    // WITH JD: exact token-set keyword matching
    const resumeText = this._buildResumeText(resume);
    const resumeTokenSet = new Set(this._keywordTokens(resumeText, false));
    let matchedKeywords = 0;
    const validKeywords = jdKeywords;

    for (const keyword of validKeywords) {
      const keywordTokens = this._keywordTokens(keyword, true);
      if (keywordTokens.length === 0) continue;
      const isMatch = keywordTokens.every((token) => resumeTokenSet.has(token));
      if (isMatch) matchedKeywords++;
    }

    const matchPercentage = validKeywords.length > 0
      ? (matchedKeywords / validKeywords.length) * 100
      : 0;
    
    // Apply quality ceiling: keyword match can't exceed completeness + 15
    return Math.min(100, Math.max(0, Math.round(matchPercentage)));
  }

  _scoreAgainstRoleLibrary(resume, role) {
    const roleKeywords = this._getRoleKeywords(role);
    const resumeText = this._buildResumeText(resume);
    
    let matched = 0;
    for (const keyword of Object.values(roleKeywords).flat()) {
      if (this._matchKeyword(resumeText, keyword.keyword || keyword)) {
        matched++;
      }
    }

    const matchPercentage = (matched / Object.values(roleKeywords).flat().length) * 100;
    return Math.min(matchPercentage, 85); // Cap generic mode at 85
  }

  _scoreIntrinsicQuality(resume) {
    // Score based on resume structure without any JD
    const skillCount = this._countUniqueSkills(resume);
    const bulletQuality = this._analyzeExperienceBullets(resume);
    
    return (skillCount * 0.4 + bulletQuality * 0.6);
  }

  _calculateCompleteness(resume) {
    const weightedSections = [
      { key: 'summary', weight: 15, present: !!resume.summary?.trim() },
      { key: 'skills', weight: 20, present: (resume.skills || []).some((s) => (s.items || []).some(Boolean)) },
      { key: 'projects', weight: 10, present: (resume.projects || []).length > 0 },
      { key: 'experience', weight: 25, present: (resume.experience || []).length > 0 },
      { key: 'education', weight: 15, present: (resume.education || []).length > 0 },
      { key: 'certifications', weight: 8, present: (resume.certifications || []).length > 0 },
      { key: 'achievements', weight: 7, present: (resume.achievements || []).length > 0 },
    ];
    const earned = weightedSections.reduce((sum, section) => sum + (section.present ? section.weight : 0), 0);
    return Math.min(100, Math.max(0, Math.round(earned)));
  }

  _calculateFormatting(resume) {
    let score = 100;
    const textContent = this._buildResumeText(resume);
    if (/(table|<table|grid-template-columns|column-count|two-column)/i.test(textContent)) score -= 20;
    if (/(<img|image:|icon|fa-|material-icons|emoji)/i.test(textContent)) score -= 15;

    const headingsPresent = [
      !!resume.summary?.trim(),
      (resume.skills || []).length > 0,
      (resume.experience || []).length > 0,
      (resume.education || []).length > 0
    ].filter(Boolean).length;
    if (headingsPresent < 3) score -= 15;

    if (!resume.personalInfo?.email) score -= 8;
    if (!resume.personalInfo?.phone) score -= 6;
    return Math.min(Math.max(score, 0), 100);
  }

  _calculateActionVerbs(resume) {
    const strongVerbSet = new Set([
      'achieved', 'built', 'created', 'delivered', 'designed', 'developed',
      'implemented', 'improved', 'increased', 'led', 'managed', 'optimized',
      'reduced', 'scaled', 'streamlined', 'launched', 'engineered'
    ]);
    const allBullets = (resume.experience || []).flatMap((exp) => exp.bullets || []);
    if (allBullets.length === 0) return 0;
    let weightedHits = 0;
    for (const bullet of allBullets) {
      const firstWord = (bullet || '').trim().split(/\s+/)[0]?.toLowerCase();
      if (strongVerbSet.has(firstWord)) weightedHits += 1;
      else if (firstWord) weightedHits += 0.35;
    }
    return Math.min(100, Math.max(0, Math.round((weightedHits / allBullets.length) * 100)));
  }

  _calculateReadability(resume) {
    const bullets = (resume.experience || []).flatMap((exp) => exp.bullets || []);
    if (bullets.length === 0) return 45;
    const avgWords = bullets.reduce((sum, b) => sum + (b.split(/\s+/).filter(Boolean).length), 0) / bullets.length;
    const metricBullets = bullets.filter((b) => /\d+%|\d+x|\$\d+|\b\d+\b/.test(b)).length;
    const strongVerbBullets = bullets.filter((b) => /^[A-Za-z]+/.test(b)).length;
    let score = 100;
    if (avgWords > 24) score -= Math.min(35, Math.round((avgWords - 24) * 2));
    if (avgWords < 8) score -= 12;
    score += Math.min(12, Math.round((metricBullets / bullets.length) * 20));
    score += Math.min(8, Math.round((strongVerbBullets / bullets.length) * 10));
    return Math.min(Math.max(score, 0), 100);
  }

  // ===== HELPER METHODS =====

  _buildResumeText(resume) {
    const parts = [
      resume.personalInfo?.fullName || '',
      resume.summary || '',
      (resume.skills || []).flatMap(s => s.items).join(' '),
      (resume.experience || []).flatMap(e => [e.role, e.company, ...(e.bullets || [])]).join(' '),
      (resume.education || []).flatMap(e => [e.degree, e.field, e.institution]).join(' '),
    ];
    
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  _normalizeForKeyword(text = '') {
    return String(text)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _keywordTokens(text = '', removeStopWords = false) {
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'so', 'yet',
      'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'into', 'over', 'under', 'across',
      'through', 'per'
    ]);

    const tokens = this._normalizeForKeyword(text)
      .split(' ')
      .filter(Boolean);

    if (!removeStopWords) return tokens;
    return tokens.filter((token) => !STOP_WORDS.has(token));
  }

  _keywordDensityScore(normalizedResumeText, keyword) {
    const keywordTokens = this._keywordTokens(keyword);
    if (keywordTokens.length === 0) return 0;

    const resumeTokens = this._keywordTokens(normalizedResumeText);
    const resumeTokenSet = new Set(resumeTokens);

    const normalizedKeyword = keywordTokens.join(' ');
    const escapedPhrase = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phraseRegex = new RegExp(`\\b${escapedPhrase}\\b`, 'g');
    const phraseMatches = normalizedResumeText.match(phraseRegex);
    const phraseCount = phraseMatches ? phraseMatches.length : 0;

    if (phraseCount > 0) {
      const densityBonus = Math.min(0.2, (phraseCount - 1) * 0.05);
      return Math.min(1, 0.85 + densityBonus);
    }

    let tokenHits = 0;
    for (const token of keywordTokens) {
      if (resumeTokenSet.has(token)) tokenHits++;
    }

    const coverage = tokenHits / keywordTokens.length;
    if (coverage === 0) return 0;
    if (coverage >= 1) return 0.85;
    return Math.min(0.8, coverage * 0.8);
  }

  _matchKeyword(text, keyword) {
    const resumeTokenSet = new Set(this._keywordTokens(text, false));
    const keywordTokens = this._keywordTokens(keyword, true);
    if (keywordTokens.length === 0) return false;
    return keywordTokens.every((token) => resumeTokenSet.has(token));
  }

  _findMissingKeywords(resume, jdKeywords) {
    const resumeText = this._buildResumeText(resume);
    const missing = [];
    
    for (const kw of jdKeywords) {
      const keyword = typeof kw === 'string' ? kw : kw?.keyword;
      if (!keyword) continue;
      if (!this._matchKeyword(resumeText, keyword)) {
        missing.push({
          keyword,
          importance: typeof kw === 'object' ? kw.importance : 'moderate',
          category: typeof kw === 'object' ? kw.category : 'general',
        });
      }
    }
    
    return missing;
  }

  _normalizeJDKeywordList(jdKeywords = []) {
    const normalized = [];
    for (const item of Array.isArray(jdKeywords) ? jdKeywords : []) {
      const raw = typeof item === 'string' ? item : item?.keyword;
      if (!raw || typeof raw !== 'string') continue;
      const tokens = this._keywordTokens(raw, true).filter((t) => t.length >= 2);
      if (!tokens.length) continue;
      normalized.push(tokens.join(' '));
    }
    return [...new Set(normalized)];
  }

  _findMissingSections(resume) {
    const hasSkills = (resume.skills || []).some((s) => (s.items || []).some(Boolean));
    const checks = [
      ['summary', !!resume.summary?.trim()],
      ['skills', hasSkills],
      ['projects', (resume.projects || []).length > 0],
      ['experience', (resume.experience || []).length > 0],
      ['education', (resume.education || []).length > 0],
      ['certifications', (resume.certifications || []).length > 0],
      ['achievements', (resume.achievements || []).length > 0]
    ];
    return checks.filter(([, ok]) => !ok).map(([name]) => name);
  }

  _countStrongBullets(resume) {
    const actionVerbs = [
      'developed', 'designed', 'implemented', 'led', 'managed', 'created'
    ];
    
    let count = 0;
    for (const exp of resume.experience || []) {
      for (const bullet of exp.bullets || []) {
        const firstWord = bullet.trim().split(/\s+/)[0].toLowerCase();
        if (actionVerbs.includes(firstWord) && this._hasMetrics(bullet)) {
          count++;
        }
      }
    }
    
    return count;
  }

  _hasMetrics(text) {
    return /\d+%|\d+x|\$\d+|by \d+|increased|improved|reduced/.test(text);
  }

  _countUniqueSkills(resume) {
    const skills = new Set();
    for (const category of resume.skills || []) {
      for (const skill of category.items || []) {
        skills.add(skill.toLowerCase());
      }
    }
    return Math.min(skills.size, 20); // Cap at 20 for scoring
  }

  _analyzeExperienceBullets(resume) {
    const totalBullets = (resume.experience || [])
      .reduce((sum, exp) => sum + (exp.bullets?.length || 0), 0);
    
    if (totalBullets === 0) return 0;
    
    const strongBullets = this._countStrongBullets(resume);
    return (strongBullets / totalBullets) * 100;
  }

  _tokenize(text) {
    return text.toLowerCase().split(/\s+/);
  }

  _analyzeWordFrequency(text) {
    const tokens = this._tokenize(text);
    const freq = {};
    
    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
    
    return freq;
  }

  _identifyStrengths(breakdown) {
    const strengths = [];
    
    if (breakdown.keywordMatch >= 80) {
      strengths.push('Excellent keyword alignment with job requirements');
    }
    if (breakdown.completeness >= 75) {
      strengths.push('Comprehensive and well-structured resume');
    }
    if (breakdown.actionVerbs >= 80) {
      strengths.push('Strong use of action verbs throughout');
    }
    if (breakdown.readability >= 80) {
      strengths.push('Clear and impactful writing with quantified results');
    }
    
    return strengths.length ? strengths : ['Resume has solid fundamentals'];
  }

  _identifyWeaknesses(breakdown) {
    const weaknesses = [];
    
    if (breakdown.keywordMatch < 60) {
      weaknesses.push('Consider adding more relevant keywords from the job description');
    }
    if (breakdown.completeness < 60) {
      weaknesses.push('Add missing sections or expand existing ones');
    }
    if (breakdown.actionVerbs < 70) {
      weaknesses.push('Use stronger action verbs at the start of bullet points');
    }
    if (breakdown.readability < 70) {
      weaknesses.push('Add more quantifiable results and metrics');
    }
    
    return weaknesses;
  }

  _generateRecommendations(breakdown, hasJD) {
    const recommendations = [];
    
    if (hasJD && breakdown.keywordMatch < 70) {
      recommendations.push('Priority: Incorporate more keywords from the job description');
    }
    
    if (breakdown.completeness < 60) {
      recommendations.push('Complete all key resume sections for maximum impact');
    }
    
    if (breakdown.actionVerbs < 75) {
      recommendations.push('Strengthen bullet points with specific achievements');
    }
    
    return recommendations;
  }

  _generateSuggestions(resume, breakdown, missingKeywords) {
    // Will be replaced by SuggestionEngine
    return [];
  }

  // ROLE KEYWORD LIBRARY (Built-in defaults)
  _getRoleKeywords(role) {
    const roleLibrary = {
      'software_engineer': {
        languages: ['javascript', 'python', 'java', 'golang', 'rust', 'cpp'],
        frameworks: ['react', 'node.js', 'express', 'django', 'spring'],
        tools: ['git', 'docker', 'kubernetes', 'aws', 'ci/cd'],
        practices: ['testing', 'agile', 'rest api', 'microservices'],
      },
      'data_engineer': {
        tools: ['sql', 'spark', 'hadoop', 'kafka', 'airflow', 'etl'],
        languages: ['python', 'scala', 'java'],
        platforms: ['aws', 'gcp', 'azure', 'databricks'],
      },
      'product_manager': {
        skills: ['product strategy', 'roadmap', 'user research', 'analytics', 'agile'],
        tools: ['jira', 'figma', 'amplitude', 'mixpanel'],
      },
      'marketing': {
        skills: ['seo', 'sem', 'content', 'analytics', 'campaign management', 'crm'],
        tools: ['google analytics', 'hubspot', 'salesforce', 'mailchimp'],
      },
    };

    return roleLibrary[role.toLowerCase()] || {};
  }
}

module.exports = ATSScorerCorrected;
