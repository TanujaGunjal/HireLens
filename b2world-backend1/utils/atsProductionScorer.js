'use strict';

/**
 * Production-Grade ATS Scorer - Enterprise Level
 * 
 * Implements enterprise-level ATS scoring similar to Jobscan/Greenhouse/Lever
 * 
 * Scoring Architecture:
 * - Keyword Match (40%): REQUIRED vs PREFERRED, section-aware, frequency scaling
 * - Experience Quality (25%): Verbs, metrics, combos, diversity
 * - Section Completeness (15%): Critical vs optional sections
 * - Formatting/ATS Compatibility (10%): ATS-friendly checks
 * - Readability (10%): Bullet length, complexity
 * 
 * Score Distribution:
 * - Weak: 40-60
 * - Average: 60-75  
 * - Strong: 75-88
 * - Exceptional: 88-95
 * - 90+ only if: keyword>85, expQuality>80, completeness>90
 */

const ACTION_VERBS = new Set([
  'achieved', 'improved', 'increased', 'decreased', 'reduced', 'developed', 'created',
  'built', 'designed', 'implemented', 'launched', 'led', 'managed', 'coordinated',
  'optimized', 'streamlined', 'automated', 'established', 'pioneered', 'initiated',
  'delivered', 'executed', 'enhanced', 'resolved', 'analyzed', 'assessed', 'evaluated',
  'collaborated', 'facilitated', 'mentored', 'trained', 'presented', 'communicated',
  'negotiated', 'generated', 'accelerated', 'transformed', 'standardized', 'scaled',
  'architected', 'migrated', 'refactored', 'deployed', 'integrated', 'audited',
  'diagnosed', 'configured', 'maintained', 'documented', 'supported', 'contributed',
  'spearheaded', 'drove', 'influenced', 'orchestrated', 'revamped', 'reengineered',
  // ✅ ADD: all verbs used as replacements in improveBullet weakPatterns
  'partnered', 'owned', 'leveraged', 'served', 'expanded', 'consolidated'
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'responsible', 'involved', 'helped', 'worked', 'recently', 'currently', 'also'
]);

const METRICS_PATTERNS = [
  /(\d+\.?\d*)\s*%/,
  /(\d+\.?\d*)\s*x(?:times)?/i,
  /(\d+\.?\d*)\s*(?:million|thousand|hundred|k|m|b)\b/i,
  /(?:reduced|decreased|cut)\s+by\s+(\d+\.?\d*)\s*%?/i,
  /(?:improved|increased|boosted|enhanced|optimized|accelerated)\s+by\s+(\d+\.?\d*)\s*(?:x|%)?/i,
  /(\d+)\s*(?:\+|plus|or\s+more)/i,
  /(\d+)\s*(?:team\s*)?(?:members|people|users|customers|clients|employees)\b/i,
  /(?:saved|generated|earned|revenue|profit)\s+.*?[\$\€]?\s*(\d+\.?\d*)\s*(?:million|thousand|k)?/i,
];

const WEAK_PHRASES = {
  // Multi-word phrases (checked first — longest match wins)
  'worked on':        'Developed',
  'responsible for':  'Led',
  'involved in':      'Contributed to',
  'helped with':      'Collaborated on',
  'worked with':      'Collaborated with',  // ✅ was 'partnered with' (now in ACTION_VERBS)
  'was responsible':  'Owned',
  'participated in':  'Spearheaded',
  'part of':          'Drove',
  // Single-word starters (fallback) — ✅ NEW: were missing entirely
  'handled':          'Streamlined',
  'worked':           'Developed',
  'used':             'Leveraged',
  'did':              'Executed',
  'made':             'Created',
  'got':              'Achieved',
  'was':              'Served as',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const normalizeText = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  let normalized = text.toLowerCase().trim();
  
  normalized = normalized
    .replace(/\bc\+\+\b/gi, 'cpp')
    .replace(/\bc#\b/gi, 'csharp')
    .replace(/\bnode\.?js\b/gi, 'nodejs')
    .replace(/\bnext\.?js\b/gi, 'nextjs')
    .replace(/\b\.?net\b/gi, 'dotnet');
  
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  return normalized;
};

const stemWord = (word = '') => {
  if (!word || typeof word !== 'string') return '';
  return word.toLowerCase().trim()
    .replace(/(s|es|ed|ing|tion|ation)$/i, '')
    .replace(/y$/, 'i');
};

const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
};

const isActionVerb = (word) => Boolean(word) && ACTION_VERBS.has(word.toLowerCase());

const hasMetrics = (text) => {
  if (!text || typeof text !== 'string') return false;
  return METRICS_PATTERNS.some(p => p.test(text));
};

const getFirstNWords = (text, n = 3) => {
  if (!text || typeof text !== 'string') return [];
  return text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, n);
};

const getFirstMeaningfulWord = (text) => {
  if (!text || typeof text !== 'string') return '';
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (!STOP_WORDS.has(w)) return w;
  }
  return words[0] || '';
};

const matchKeyword = (resumeText, keyword) => {
  if (!resumeText || !keyword) return false;
  
  const normText = normalizeText(resumeText);
  const normKw = normalizeText(keyword);
  
  if (normText.includes(normKw)) return true;
  
  const kwTokens = tokenize(keyword).map(t => stemWord(t));
  const textTokens = tokenize(resumeText).map(t => stemWord(t));
  
  if (kwTokens.length === 1) {
    return textTokens.some(tt => tt === kwTokens[0]);
  }
  
  return kwTokens.every(kt => textTokens.some(tt => tt === kt));
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const getKeywordSection = (resume, keyword) => {
  const normalizedKw = normalizeText(keyword);
  
  // Skills section = 1.2
  if (Array.isArray(resume.skills)) {
    for (const grp of resume.skills) {
      if (Array.isArray(grp.items)) {
        for (const item of grp.items) {
          if (matchKeyword(item, keyword)) return 'skills';
        }
      }
    }
  }
  
  // Experience = 1.0
  if (Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      const expText = [exp.company, exp.role, exp.jobTitle, ...(exp.bullets || [])].join(' ');
      if (matchKeyword(expText, keyword)) return 'experience';
    }
  }
  
  // Projects = 0.9
  if (Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      const projText = [proj.title, proj.name, proj.description, ...(proj.techStack || []), ...(proj.bullets || [])].join(' ');
      if (matchKeyword(projText, keyword)) return 'projects';
    }
  }
  
  // Summary = 0.8
  if (matchKeyword(resume.summary || '', keyword)) return 'summary';
  
  return 'other';
};

const getSectionMultiplier = (section) => {
  const multipliers = {
    'skills': 1.2,
    'experience': 1.0,
    'projects': 0.9,
    'summary': 0.8,
    'other': 0.7
  };
  return multipliers[section] || 0.7;
};

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD MATCH (40%)
// ─────────────────────────────────────────────────────────────────────────────

const calculateKeywordScore = (resume, jdKeywords) => {
  if (!jdKeywords || !jdKeywords.length) return 0;
  
  const resumeText = buildResumeText(resume);
  const totalTokens = tokenize(resumeText).length;
  
  let totalPossibleWeight = 0;
  let matchedWeightedScore = 0;
  const keywordCounts = {};
  
  for (const kw of jdKeywords) {
    const keyword = typeof kw === 'string' ? kw : kw?.keyword;
    if (!keyword) continue;
    
    // Determine if REQUIRED or PREFERRED
    const isRequired = typeof kw === 'object' && kw.importance === 'required';
    const baseWeight = isRequired ? 2 : 1; // REQUIRED = 2, PREFERRED = 1
    
    // Track frequency
    if (!keywordCounts[keyword]) {
      keywordCounts[keyword] = { count: 0, sections: new Set() };
    }
    
    // Check presence and count frequency
    if (matchKeyword(resumeText, keyword)) {
      keywordCounts[keyword].count++;
      keywordCounts[keyword].sections.add(getKeywordSection(resume, keyword));
    }
    
    totalPossibleWeight += baseWeight;
  }
  
  // Calculate weighted score with frequency scaling
  for (const [keyword, data] of Object.entries(keywordCounts)) {
    const kw = jdKeywords.find(k => (typeof k === 'string' ? k : k?.keyword) === keyword);
    const isRequired = typeof kw === 'object' && kw.importance === 'required';
    const baseWeight = isRequired ? 2 : 1;
    
    if (data.count > 0) {
      // Get best section multiplier
      let bestMultiplier = 0.7;
      for (const section of data.sections) {
        const mult = getSectionMultiplier(section);
        if (mult > bestMultiplier) bestMultiplier = mult;
      }
      
      // Frequency scaling: 1=60%, 2=85%, 3+=100%
      const frequencyMultiplier = data.count === 1 ? 0.60 : data.count === 2 ? 0.85 : 1.0;
      
      matchedWeightedScore += baseWeight * bestMultiplier * frequencyMultiplier;
    }
  }
  
  if (totalPossibleWeight === 0) return 0;
  
  let rawScore = (matchedWeightedScore / totalPossibleWeight) * 100;
  
  // Keyword stuffing penalty (>5% density)
  let stuffingPenalty = 0;
  for (const [keyword, data] of Object.entries(keywordCounts)) {
    if (data.count > 0) {
      const keywordTokens = tokenize(keyword).length;
      const density = (data.count * keywordTokens) / totalTokens;
      if (density > 0.05) {
        stuffingPenalty += 5;
      }
    }
  }
  
  rawScore = Math.max(0, rawScore - stuffingPenalty);
  
  // Smoothing curve: score = (score/100)^0.9 * 100
  const smoothScore = Math.pow(rawScore / 100, 0.9) * 100;
  
  return Math.round(Math.min(smoothScore, 100));
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIENCE QUALITY (25%)
// ─────────────────────────────────────────────────────────────────────────────

const calculateExperienceQuality = (resume) => {
  const allBullets = getAllBullets(resume);
  
  if (!allBullets.length) return 0;
  
  let bulletsWithVerbs = 0;
  let bulletsWithMetrics = 0;
  let bulletsWithBoth = 0;
  const uniqueVerbs = new Set();
  
  for (const bullet of allBullets) {
    const first3Words = getFirstNWords(bullet, 3);
    const firstMeaningful = getFirstMeaningfulWord(bullet);
    const hasVerb = first3Words.some(w => isActionVerb(w)) || isActionVerb(firstMeaningful);
    const hasMetric = hasMetrics(bullet);
    
    if (hasVerb) {
      bulletsWithVerbs++;
      const verb = first3Words.find(w => isActionVerb(w)) || firstMeaningful;
      uniqueVerbs.add(verb.toLowerCase());
    }
    if (hasMetric) bulletsWithMetrics++;
    if (hasVerb && hasMetric) bulletsWithBoth++;
  }
  
  const n = allBullets.length;
  
  // Verb score = 30%
  const verbScore = (bulletsWithVerbs / n) * 30;
  
  // Metric score = 40%
  const metricScore = (bulletsWithMetrics / n) * 40;
  
  // Verb+Metric combo bonus = 20%
  const comboScore = (bulletsWithBoth / n) * 20;
  
  // Verb diversity bonus = 10% (more unique verbs = better)
  const diversityRatio = Math.min(uniqueVerbs.size / 10, 1); // Cap at 10 unique verbs
  const diversityScore = diversityRatio * 10;
  
  return Math.round(verbScore + metricScore + comboScore + diversityScore);
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPLETENESS (15%)
// ─────────────────────────────────────────────────────────────────────────────

const calculateSectionCompleteness = (resume) => {
  let score = 0;
  
  // Critical sections: 15 points each
  const hasPersonalInfo = resume.personalInfo?.fullName && resume.personalInfo?.email;
  const hasSummary = typeof resume.summary === 'string' && resume.summary.trim().length > 50;
  const hasSkills = Array.isArray(resume.skills) && resume.skills.some(s => Array.isArray(s.items) && s.items.length > 0);
  const hasExperience = Array.isArray(resume.experience) && resume.experience.length > 0;
  const hasEducation = Array.isArray(resume.education) && resume.education.length > 0;
  
  if (hasPersonalInfo) score += 15;
  if (hasSummary) score += 15;
  if (hasSkills) score += 15;
  if (hasExperience) score += 15;
  if (hasEducation) score += 15;
  
  // Optional sections: 5 points each
  const hasProjects = Array.isArray(resume.projects) && resume.projects.length > 0;
  const hasCerts = Array.isArray(resume.certifications) && resume.certifications.length > 0;
  const hasAchievements = Array.isArray(resume.achievements) && resume.achievements.length > 0;
  
  if (hasProjects) score += 5;
  if (hasCerts) score += 5;
  if (hasAchievements) score += 5;
  
  return Math.min(score, 100);
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING / ATS COMPATIBILITY (10%)
// ─────────────────────────────────────────────────────────────────────────────

const calculateFormattingScore = (resume) => {
  let score = 100;
  
  const allBullets = getAllBullets(resume);
  
  // Bullet length penalty (>200 chars)
  let longBullets = 0;
  for (const bullet of allBullets) {
    if (bullet.length > 200) longBullets++;
  }
  score -= Math.min(longBullets * 5, 25);
  
  // Special character overuse
  if (typeof resume.summary === 'string') {
    const specialCount = (resume.summary.match(/[!@#$%^&*()_+=\[\]{};:'",.<>?/\\]/g) || []).length;
    if (specialCount > 10) score -= 10;
  }
  
  // Duplicate bullets
  const uniqueBullets = new Set(allBullets.map(b => b.toLowerCase()));
  const duplicates = allBullets.length - uniqueBullets.size;
  if (duplicates > 0) score -= duplicates * 8;
  
  // Paragraph blocks (bullets that are very long without punctuation)
  let paragraphBlocks = 0;
  for (const bullet of allBullets) {
    if (bullet.length > 300 && !bullet.includes('.')) paragraphBlocks++;
  }
  score -= paragraphBlocks * 5;
  
  // Skills with very long items
  if (Array.isArray(resume.skills)) {
    let longSkills = 0;
    for (const grp of resume.skills) {
      if (Array.isArray(grp.items)) {
        for (const item of grp.items) {
          if (typeof item === 'string' && item.length > 40) longSkills++;
        }
      }
    }
    score -= Math.min(longSkills * 2, 10);
  }
  
  return Math.max(score, 30); // Floor at 30
};

// ─────────────────────────────────────────────────────────────────────────────
// READABILITY (10%)
// ─────────────────────────────────────────────────────────────────────────────

const calculateReadabilityScore = (resume) => {
  const allBullets = getAllBullets(resume);
  
  if (!allBullets.length) return 40;
  
  let score = 80;
  let totalLength = 0;
  
  for (const bullet of allBullets) {
    const len = bullet.length;
    totalLength += len;
    
    // Ideal length: 80-140 chars
    if (len > 180) score -= 4;
    else if (len > 140) score -= 2;
    else if (len < 30) score -= 3;
    
    // Missing action verb
    const first3Words = getFirstNWords(bullet, 3);
    if (!first3Words.some(w => isActionVerb(w))) score -= 3;
    
    // Missing metrics
    if (!hasMetrics(bullet)) score -= 2;
  }
  
  // Average length check
  const avgLength = totalLength / allBullets.length;
  if (avgLength < 50 || avgLength > 200) score -= 10;
  
  // Summary length
  if (typeof resume.summary === 'string') {
    if (resume.summary.length > 500) score -= 5;
    if (resume.summary.length > 800) score -= 10;
  }
  
  return Math.max(score, 25); // Floor at 25
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const getAllBullets = (resume) => {
  const bullets = [];
  for (const section of ['experience', 'projects']) {
    if (Array.isArray(resume[section])) {
      for (const item of resume[section]) {
        if (Array.isArray(item.bullets)) {
          bullets.push(...item.bullets.filter(b => typeof b === 'string'));
        }
      }
    }
  }
  return bullets;
};

const buildResumeText = (resume) => {
  const sections = [];
  
  if (resume.personalInfo) {
    sections.push(
      resume.personalInfo.fullName,
      resume.personalInfo.email,
      resume.personalInfo.phone,
      resume.personalInfo.location
    );
  }
  
  if (resume.summary) sections.push(resume.summary);
  
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(grp => {
      if (grp.category) sections.push(grp.category);
      if (Array.isArray(grp.items)) sections.push(...grp.items);
    });
  }
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(exp => {
      sections.push(exp.company, exp.role, exp.jobTitle);
      if (Array.isArray(exp.bullets)) sections.push(...exp.bullets);
    });
  }
  
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      sections.push(proj.title, proj.name, proj.description);
      if (Array.isArray(proj.techStack)) sections.push(...proj.techStack);
      if (Array.isArray(proj.bullets)) sections.push(...proj.bullets);
    });
  }
  
  if (Array.isArray(resume.education)) {
    resume.education.forEach(edu => {
      sections.push(edu.institution, edu.degree, edu.field);
    });
  }
  
  return sections.filter(Boolean).join(' ');
};

const findMissingKeywords = (resume, jdKeywords) => {
  if (!jdKeywords || !jdKeywords.length) return [];
  
  const resumeText = buildResumeText(resume);
  const missing = [];
  
  for (const kw of jdKeywords) {
    const keyword = typeof kw === 'string' ? kw : kw?.keyword;
    if (keyword && !matchKeyword(resumeText, keyword)) {
      missing.push({
        keyword,
        category: typeof kw === 'object' && kw.category ? kw.category : 'skill',
        importance: typeof kw === 'object' && kw.importance ? kw.importance : 'Nice to have'
      });
    }
  }
  
  return missing.slice(0, 15);
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCORER
// ─────────────────────────────────────────────────────────────────────────────

const calculateATSScore = (resume, jdKeywords = []) => {
  const hasJD = jdKeywords && jdKeywords.length > 0;
  const scoringMode = hasJD ? 'job-specific' : 'general';
  
  // Calculate component scores
  const keywordMatchScore = hasJD ? calculateKeywordScore(resume, jdKeywords) : 0;
  const experienceQualityScore = calculateExperienceQuality(resume);
  const sectionCompletenessScore = calculateSectionCompleteness(resume);
  const formattingScore = calculateFormattingScore(resume);
  const readabilityScore = calculateReadabilityScore(resume);
  
  // Calculate weighted total
  let totalScore;
  if (hasJD) {
    totalScore = Math.round(
      keywordMatchScore * 0.40 +
      experienceQualityScore * 0.25 +
      sectionCompletenessScore * 0.15 +
      formattingScore * 0.10 +
      readabilityScore * 0.10
    );
  } else {
    // General mode: no keyword component, redistribute
    totalScore = Math.round(
      experienceQualityScore * 0.30 +
      sectionCompletenessScore * 0.30 +
      formattingScore * 0.20 +
      readabilityScore * 0.20
    );
    
    // Cap general mode at 80
    totalScore = Math.min(totalScore, 80);
  }
  
  // Only allow 90+ if strict conditions met
  if (totalScore >= 90) {
    if (hasJD && (keywordMatchScore < 85 || experienceQualityScore < 80 || sectionCompletenessScore < 90)) {
      totalScore = Math.min(totalScore, 89);
    }
  }
  
  const missingKeywords = findMissingKeywords(resume, jdKeywords);
  
  return {
    totalScore,
    scoringMode,
    breakdown: {
      keywordMatchScore,
      experienceQualityScore,
      sectionCompletenessScore,
      formattingScore,
      readabilityScore
    },
    missingKeywords,
    suggestions: generateSuggestions(resume, missingKeywords),
    scoringDetails: {
      keywordMatch: hasJD ? { weight: 40 } : { weight: 0 },
      experienceQuality: { weight: 25 },
      sectionCompleteness: { weight: 15 },
      formatting: { weight: 10 },
      readability: { weight: 10 }
    }
  };
};

const generateSuggestions = (resume, missingKeywords) => {
  const suggestions = [];
  let id = 1;
  const push = (s) => suggestions.push({ ...s, id: `sugg-${id++}`, applied: false });
  
  // Missing keywords
  for (const mk of missingKeywords.slice(0, 5)) {
    push({
      type: 'keyword',
      severity: 'critical',
      section: mk.category === 'skill' ? 'skills' : 'experience',
      currentText: '',
      suggestedText: `Add "${mk.keyword}" to your ${mk.category === 'skill' ? 'skills' : 'experience'} section`,
      reason: `"${mk.keyword}" is a ${mk.importance} keyword in the job description`,
      impact: 'high'
    });
  }
  
  // Summary check
  if (!resume.summary || resume.summary.trim().length < 100) {
    push({
      type: 'content',
      severity: 'critical',
      section: 'summary',
      currentText: resume.summary || '',
      suggestedText: 'Write a compelling 3-4 sentence professional summary',
      reason: 'A strong summary improves ATS visibility',
      impact: 'high'
    });
  }
  
  // Experience bullets
  if (Array.isArray(resume.experience)) {
    for (const [expIdx, exp] of resume.experience.entries()) {
      if (!Array.isArray(exp.bullets)) continue;
      for (const [bulletIdx, bullet] of exp.bullets.entries()) {
        if (typeof bullet !== 'string') continue;
        
        const first3Words = getFirstNWords(bullet, 3);
        const hasVerb = first3Words.some(w => isActionVerb(w));
        const hasMetric = hasMetrics(bullet);
        
        if (!hasVerb) {
          push({
            type: 'content',
            severity: 'suggestion',
            section: 'experience',
            targetIndex: { expIndex: expIdx, bulletIndex: bulletIdx },
            currentText: bullet,
            suggestedText: improveBullet(bullet),
            reason: 'Start with a strong action verb',
            impact: 'medium'
          });
        } else if (!hasMetric) {
          push({
            type: 'content',
            severity: 'suggestion',
            section: 'experience',
            targetIndex: { expIndex: expIdx, bulletIndex: bulletIdx },
            currentText: bullet,
            suggestedText: `${bullet} — quantify your impact`,
            reason: 'Quantifiable achievements score higher',
            impact: 'high'
          });
        }
      }
    }
  }
  
  return suggestions.slice(0, 15);
};

const improveBullet = (bullet) => {
  if (typeof bullet !== 'string') return bullet;
  
  let improved = bullet.trim();
  
  // Sort WEAK_PHRASES by key length DESC so multi-word phrases match before single words
  const sortedPhrases = Object.entries(WEAK_PHRASES)
    .sort(([a], [b]) => b.length - a.length);

  for (const [weak, strong] of sortedPhrases) {
    // Match at START of bullet only (^ anchor prevents mid-sentence replacement)
    const re = new RegExp(`^(${weak.replace(/\s+/g, '\\s+')})\\b`, 'i');
    if (re.test(improved)) {
      // Remove the matched weak phrase and prepend the strong verb
      const rest = improved.replace(re, '').trim();
      improved = `${strong} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`.trim();
      // Ensure starts uppercase
      return improved.charAt(0).toUpperCase() + improved.slice(1);
    }
  }

  // Fallback: no weak phrase matched — check if starts with action verb
  const first3Words = getFirstNWords(improved, 3);
  if (!first3Words.some(w => isActionVerb(w))) {
    // Context-aware verb selection
    const lower = improved.toLowerCase();
    let verb = 'Developed';
    if (/\b(team|stakeholder|client|colleague)\b/.test(lower)) verb = 'Collaborated with';
    else if (/\b(data|cleaning|processing|transformation)\b/.test(lower)) verb = 'Streamlined';
    else if (/\b(report|dashboard|chart|visual)\b/.test(lower)) verb = 'Built';
    else if (/\b(sql|query|database)\b/.test(lower)) verb = 'Optimized';

    // Strip weak first word if present before prepending
    const words = improved.split(/\s+/);
    const weakStarters = new Set(['worked', 'handled', 'used', 'did', 'made', 'was', 'got']);
    const rest = weakStarters.has(words[0]?.toLowerCase())
      ? words.slice(1).join(' ')
      : improved;

    improved = `${verb} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
    return improved.charAt(0).toUpperCase() + improved.slice(1);
  }

  return improved;
  // ❌ DO NOT append metrics hints — it's handled as a separate suggestion
};
};

// Export
module.exports = { calculateATSScore };
module.exports.default = calculateATSScore;
