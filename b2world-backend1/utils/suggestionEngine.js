/**
 * Production-Grade Suggestion Engine
 * Fixed: Keywords auto-applicable, metric patterns manual, correct skills structure
 */

const normalizeText = (text = '') => {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const tokenize = (text = '') => normalizeText(text).split(' ').filter(Boolean);

// Simple hash for deterministic IDs
const hashStr = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// Generate deterministic suggestion ID
const generateSuggestionId = (section, targetIndex, suggestedText) => {
  const str = `${section}-${JSON.stringify(targetIndex)}-${suggestedText}`;
  return `sugg-${hashStr(str)}`;
};

// Check if bullet starts with action verb
const hasActionVerb = (text) => {
  if (!text) return false;
  const strongVerbs = new Set([
    'achieved', 'built', 'created', 'delivered', 'designed', 'developed',
    'directed', 'enhanced', 'established', 'executed', 'implemented',
    'improved', 'increased', 'launched', 'led', 'managed', 'optimized',
    'orchestrated', 'reduced', 'scaled', 'spearheaded', 'streamlined',
    'owned', 'partnered', 'collaborated', 'contributed', 'leveraged',
    'supported', 'drove', 'analyzed', 'automated', 'deployed',
    'identified', 'resolved', 'maintained', 'documented', 'tested',
  ]);
  const firstWord = tokenize(text)[0];
  return strongVerbs.has(firstWord);
};

// Check if bullet has metrics
const hasMetrics = (text) => {
  if (!text) return false;
  return /\b\d+%|\b\d+(?:x|\s*times?|[km]?)|\$[\d,]+|\b(improved|reduced|increased|decreased)\b/i.test(text);
};

// Count total skills across skills section and project techStack
const countTotalSkills = (resume) => {
  const allSkills = new Set();

  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(skillGroup => {
      if (Array.isArray(skillGroup.items)) {
        skillGroup.items.forEach(item => {
          if (!item) return;
          String(item).split(/[,•|/]/).map(s => s.trim()).filter(Boolean)
            .forEach(s => allSkills.add(s.toLowerCase()));
        });
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(proj => {
      if (Array.isArray(proj.techStack)) {
        proj.techStack.forEach(t => {
          if (t) allSkills.add(String(t).trim().toLowerCase());
        });
      }
    });
  }

  return allSkills.size;
};

// Helper: suggest a measurable outcome pattern without fake numbers
const suggestMeasurablePattern = (bullet) => {
  const b = (bullet || '').toLowerCase();
  if (/deploy|pipeline|ci.?cd|infrastructure|devops|automation/i.test(b))
    return ' (e.g., reduced deployment time by X%, increased release frequency)';
  if (/design|architect|scal|distributed|system/i.test(b))
    return ' (e.g., supported N+ concurrent users with Y% uptime)';
  if (/optim|improv|enhanc|perform|efficiency/i.test(b))
    return ' (e.g., X% faster response times, Y% error reduction)';
  if (/build|develop|implement|create|deliver/i.test(b))
    return ' (e.g., delivered X weeks ahead, achieved Y% test coverage)';
  if (/integrat|api|service|connect|endpoint/i.test(b))
    return ' (e.g., processes N+ daily transactions, zero data loss)';
  if (/test|debug|resolv|fix|quality|bug/i.test(b))
    return ' (e.g., reduced production bugs by X%, improved uptime to Y%)';
  if (/collaborat|mentor|train|lead|manage|team/i.test(b))
    return ' (e.g., improved team velocity by X%, trained Y people)';
  return ' (e.g., achieved X% improvement in Y metric)';
};

// Symmetric keyword-resume matching with synonym support
const TECH_SYNONYMS = {
  'nodejs': ['node', 'node.js', 'nodej'],
  'javascript': ['js'],
  'typescript': ['ts'],
  'postgresql': ['postgres', 'pg'],
  'mongodb': ['mongo'],
  'kubernetes': ['k8s', 'k8'],
  'python': ['py'],
  'react': ['reactjs', 'react.js'],
  'express': ['expressjs', 'express.js'],
  'restapi': ['rest', 'restful', 'rest api', 'rest apis'],
  'cicd': ['ci/cd', 'ci cd', 'continuous integration'],
  'datastructures': ['dsa', 'data structures', 'ds'],
  'springboot': ['spring boot', 'spring'],
};

const skillMatchesInResume = (keyword, resumeText) => {
  const kwLower = keyword.toLowerCase().trim();
  const resumeLower = resumeText.toLowerCase();

  if (resumeLower.includes(kwLower)) return true;

  for (const [canonical, synonyms] of Object.entries(TECH_SYNONYMS)) {
    const allForms = [canonical, ...synonyms];
    if (allForms.includes(kwLower)) {
      if (allForms.some(form => resumeLower.includes(form))) return true;
    }
  }

  const kwTokens = tokenize(kwLower);
  if (kwTokens.length > 1) {
    if (kwTokens.every(t => resumeLower.includes(t))) return true;
  }

  return false;
};

// Generate suggestions for resume
const generateSuggestions = (resume, atsScore = null, jd = null) => {
  const suggestions = [];
  
  if (!resume) return suggestions;
  
  // Get JD keywords if available
  let jdKeywords = [];
  if (jd && jd.extractedKeywords) {
    jdKeywords = jd.extractedKeywords.map(k => 
      typeof k === 'string' ? k : (k.keyword || '')
    ).filter(Boolean);
  }
  
  const resumeText = buildResumeText(resume);
  
  // ────────────────────────────────────────────────────────────
  // 1. KEYWORD SUGGESTIONS — AUTO-APPLICABLE ✅
  //    Adding a keyword to skills is deterministic — no user judgment needed
  // ────────────────────────────────────────────────────────────
  if (jdKeywords.length > 0) {
    const resumeFullText = buildResumeText(resume);
    
    const LOCATION_FILLER_WORDS = new Set([
      'india', 'united', 'states', 'california', 'new', 'york', 'london', 'bangalore',
      'hyderabad', 'mumbai', 'delhi', 'pune', 'tokyo', 'paris', 'berlin', 'remote',
      'about', 'looking', 'applications', 'type', 'employment', 'understand',
      'understanding', 'seeking', 'interested', 'passionate'
    ]);
    
    const missingKeywords = jdKeywords.filter(kw => !skillMatchesInResume(kw, resumeFullText));
    
    const APPROVED_TECH = new Set([
      'js', 'ts', 'py', 'go', 'c', 'c++', 'c#', 'java', 'php', 'ruby', 'rust',
      'sql', 'nosql', 'aws', 'gcp', 'azure', 'git', 'jwt', 'api', 'rest', 'graphql',
      'ci', 'cd', 'xml', 'json', 'html', 'css', 'yaml', 'docker', 'k8s', 'ai', 'ml'
    ]);
    
    const topMissing = missingKeywords
      .filter(kw => {
        const normalized = kw.toLowerCase().trim();
        if (LOCATION_FILLER_WORDS.has(normalized)) return false;
        return normalized.length >= 3 || APPROVED_TECH.has(normalized);
      })
      .slice(0, 5);
    
    topMissing.forEach((keyword, idx) => {
      suggestions.push({
        id: generateSuggestionId('keyword', { index: idx }, keyword),
        type: 'keyword',
        severity: 'high',
        section: 'skills',
        targetIndex: { skillIndex: 0 },
        current: '',
        improved: keyword,
        title: `Add missing keyword: "${keyword}"`,
        reason: `"${keyword}" is required in the job description but missing from your resume`,
        impact: 'high',
        // ✅ FIX: Keywords are AUTO-APPLICABLE — we know exactly what to add and where
        advisoryOnly: false,
        autoApplicable: true
      });
    });
  }
  
  // ────────────────────────────────────────────────────────────
  // 2. SUMMARY SUGGESTIONS — AUTO-APPLICABLE if there's improved text ✅
  // ────────────────────────────────────────────────────────────
  if (!resume.summary || resume.summary.length < 100) {
    suggestions.push({
      id: generateSuggestionId('summary', {}, 'summary'),
      type: 'content',
      severity: 'medium',
      section: 'summary',
      targetIndex: {},
      current: resume.summary || '',
      improved: 'Write a compelling 3-4 sentence professional summary highlighting your key skills and experience',
      title: 'Strengthen your professional summary',
      reason: 'A strong summary improves ATS visibility and recruiter engagement',
      impact: 'high',
      // Manual — user must write their own summary
      advisoryOnly: true,
      autoApplicable: false
    });
  }
  
  // ────────────────────────────────────────────────────────────
  // 3. SKILLS COUNT SUGGESTIONS — Advisory only
  // ────────────────────────────────────────────────────────────
  const totalSkills = countTotalSkills(resume);
  if (totalSkills < 6) {
    suggestions.push({
      id: generateSuggestionId('skills', { index: 0 }, 'more-skills'),
      type: 'content',
      severity: 'medium',
      section: 'skills',
      targetIndex: { skillIndex: 0 },
      current: `${totalSkills} skills`,
      improved: 'Add more relevant technical skills (programming languages, frameworks, tools)',
      title: 'Add more technical skills',
      reason: `Only ${totalSkills} skills found. Add more to improve ATS matching.`,
      impact: 'medium',
      advisoryOnly: true,
      autoApplicable: false
    });
  }
  
  // ────────────────────────────────────────────────────────────
  // 4. EXPERIENCE BULLET SUGGESTIONS
  //    - Weak verb → auto-applicable ✅ (we rewrite it deterministically)
  //    - Missing metric → manual only ❌ (user must fill in real numbers)
  // ────────────────────────────────────────────────────────────
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach((exp, expIdx) => {
      if (!Array.isArray(exp.bullets)) return;
      
      exp.bullets.forEach((bullet, bulletIdx) => {
        if (!bullet) return;
        
        const bulletStr = String(bullet).trim();
        
        // Skip corrupted/hint-like bullets
        if (/^add\s+/i.test(bulletStr) || /corrupted|error|bug|test|temp/i.test(bulletStr)) {
          return;
        }
        
        const hasVerb = hasActionVerb(bullet);
        const hasMetric = hasMetrics(bullet);
        
        if (!hasVerb) {
          const improved = improveBullet(bullet);
          if (improved !== bullet) {
            suggestions.push({
              id: generateSuggestionId('experience', { expIndex: expIdx, bulletIndex: bulletIdx }, bullet),
              type: 'content',
              severity: 'medium',
              section: 'experience',
              targetIndex: { expIndex: expIdx, bulletIndex: bulletIdx },
              current: bullet,
              improved: improved,
              title: 'Start with a strong action verb',
              reason: 'Start with a strong action verb for better ATS matching',
              impact: 'medium',
              // ✅ AUTO-APPLICABLE: We rewrote the verb deterministically
              advisoryOnly: false,
              autoApplicable: true
            });
          }
        } else if (!hasMetric) {
          // ❌ MANUAL: user must fill in actual numbers — we only show a template
          suggestions.push({
            id: generateSuggestionId('experience', { expIndex: expIdx, bulletIndex: bulletIdx }, bullet + '-metric'),
            type: 'content',
            severity: 'medium',
            section: 'experience',
            targetIndex: { expIndex: expIdx, bulletIndex: bulletIdx },
            current: bullet,
            improved: `${bullet}${suggestMeasurablePattern(bullet)}`,
            title: 'Quantify your experience impact',
            reason: 'Add measurable outcome to show concrete impact',
            impact: 'high',
            advisoryOnly: true,
            autoApplicable: false  // User must replace X% / Y metric with real numbers
          });
        }
      });
    });
  }
  
  // ────────────────────────────────────────────────────────────
  // 5. PROJECT BULLET SUGGESTIONS (same rules as experience)
  // ────────────────────────────────────────────────────────────
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach((proj, projIdx) => {
      if (!Array.isArray(proj.bullets)) return;
      
      proj.bullets.forEach((bullet, bulletIdx) => {
        if (!bullet) return;
        
        const bulletStr = String(bullet).trim();
        
        if (/^add\s+/i.test(bulletStr) || /corrupted|error|bug|test|temp|make\s+logic|stronf/i.test(bulletStr)) {
          return;
        }
        
        const hasVerb = hasActionVerb(bullet);
        const hasMetric = hasMetrics(bullet);
        
        if (!hasVerb) {
          const improved = improveBullet(bullet);
          if (improved !== bullet) {
            suggestions.push({
              id: generateSuggestionId('projects', { projIndex: projIdx, bulletIndex: bulletIdx }, bullet),
              type: 'content',
              severity: 'medium',
              section: 'projects',
              targetIndex: { projIndex: projIdx, bulletIndex: bulletIdx },
              current: bullet,
              improved: improved,
              title: 'Start with a strong action verb',
              reason: 'Start with a strong action verb',
              impact: 'medium',
              // ✅ AUTO-APPLICABLE: Deterministic verb rewrite
              advisoryOnly: false,
              autoApplicable: true
            });
          }
        } else if (!hasMetric) {
          // ❌ MANUAL: user fills in real numbers
          suggestions.push({
            id: generateSuggestionId('projects', { projIndex: projIdx, bulletIndex: bulletIdx }, bullet + '-metric'),
            type: 'content',
            severity: 'medium',
            section: 'projects',
            targetIndex: { projIndex: projIdx, bulletIndex: bulletIdx },
            current: bullet,
            improved: `${bullet}${suggestMeasurablePattern(bullet)}`,
            title: 'Quantify your project impact',
            reason: 'Add measurable outcome to demonstrate project success',
            impact: 'medium',
            advisoryOnly: true,
            autoApplicable: false  // User must fill in X% / Y metric with real numbers
          });
        }
      });
    });
  }
  
  // ────────────────────────────────────────────────────────────
  // 6. MISSING SECTIONS — Advisory only
  // ────────────────────────────────────────────────────────────
  const missingSections = [];
  if (!resume.summary || resume.summary.length < 50) missingSections.push('Professional Summary');
  if (!resume.skills || resume.skills.length === 0) missingSections.push('Skills');
  if (!resume.experience || resume.experience.length === 0) missingSections.push('Experience');
  if (!resume.projects || resume.projects.length === 0) missingSections.push('Projects');
  if (!resume.education || resume.education.length === 0) missingSections.push('Education');
  
  missingSections.forEach(section => {
    suggestions.push({
      id: generateSuggestionId('structure', { section }, section),
      type: 'structure',
      severity: 'high',
      section: section.toLowerCase().replace(' ', '_'),
      targetIndex: {},
      current: '',
      improved: `Add a "${section}" section`,
      title: `Add missing section: ${section}`,
      reason: `"${section}" is important for ATS completeness`,
      impact: 'high',
      advisoryOnly: true,
      autoApplicable: false
    });
  });
  
  // Deduplicate by ID and limit to 12 suggestions
  const seen = new Set();
  const deduped = [];
  for (const s of suggestions) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      deduped.push(s);
    }
  }
  
  // Sort: auto-applicable first, then by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  deduped.sort((a, b) => {
    // Auto-applicable suggestions float to the top
    if (a.autoApplicable && !b.autoApplicable) return -1;
    if (!a.autoApplicable && b.autoApplicable) return 1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  return deduped.slice(0, 12);
};

// Improve bullet with better action verb
const improveBullet = (bullet) => {
  if (!bullet) return bullet;

  const weakPatterns = [
    { pattern: /^(was\s+responsible\s+for)\s+/i,  replacement: 'Owned ' },
    { pattern: /^(responsible\s+for)\s+/i,         replacement: 'Led ' },
    { pattern: /^(worked\s+on)\s+/i,               replacement: 'Developed ' },
    { pattern: /^(worked\s+with)\s+/i,             replacement: 'Collaborated with ' },
    { pattern: /^(worked)\s+/i,                    replacement: 'Developed ' },
    { pattern: /^(helped\s+(?:with\s+)?)/i,        replacement: 'Improved ' },
    { pattern: /^(involved\s+in)\s+/i,             replacement: 'Contributed to ' },
    { pattern: /^(handled)\s+/i,                   replacement: 'Streamlined ' },
    { pattern: /^(used)\s+/i,                      replacement: 'Leveraged ' },
    { pattern: /^(made)\s+/i,                      replacement: 'Created ' },
    { pattern: /^(did)\s+/i,                       replacement: 'Executed ' },
    { pattern: /^(participated\s+in)\s+/i,         replacement: 'Spearheaded ' },
    { pattern: /^(assisted\s+(?:with\s+)?)/i,      replacement: 'Supported ' },
    { pattern: /^(part\s+of)\s+/i,                 replacement: 'Drove ' },
  ];

  for (const { pattern, replacement } of weakPatterns) {
    if (pattern.test(bullet)) {
      const replaced = bullet.replace(pattern, replacement);
      return replaced.charAt(0).toUpperCase() + replaced.slice(1);
    }
  }

  if (!hasActionVerb(bullet)) {
    const words = bullet.trim().split(/\s+/);
    const weakFirstWords = new Set(['worked', 'handled', 'used', 'did', 'made', 'was', 'got', 'helped']);
    const lower = bullet.toLowerCase();

    let verb = 'Developed';
    if (/\b(team|stakeholder|client|colleague)\b/.test(lower))           verb = 'Collaborated with';
    else if (/\b(data|cleaning|clean|processing|transform)\b/.test(lower)) verb = 'Streamlined';
    else if (/\b(report|dashboard|chart|visual)\b/.test(lower))           verb = 'Built';
    else if (/\b(sql|query|queries|database)\b/.test(lower))              verb = 'Optimized';
    else if (/\b(pipeline|etl|automat|script)\b/.test(lower))            verb = 'Automated';

    if (weakFirstWords.has(words[0]?.toLowerCase())) {
      const rest = words.slice(1).join(' ');
      const result = `${verb} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
      return result.charAt(0).toUpperCase() + result.slice(1);
    }
    const result = `${verb} ${bullet.charAt(0).toLowerCase()}${bullet.slice(1)}`;
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  return bullet;
};

// Build resume text for keyword matching
const buildResumeText = (resume) => {
  const sections = [];
  
  if (resume.summary) sections.push(resume.summary);
  
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(s => {
      if (s.category) sections.push(s.category);
      if (Array.isArray(s.items)) sections.push(...s.items);
    });
  }
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      sections.push(e.company, e.role);
      if (Array.isArray(e.bullets)) sections.push(...e.bullets);
    });
  }
  
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      sections.push(p.title, p.description);
      if (Array.isArray(p.techStack)) sections.push(...p.techStack);
      if (Array.isArray(p.bullets)) sections.push(...p.bullets);
    });
  }
  
  if (Array.isArray(resume.education)) {
    resume.education.forEach(e => {
      sections.push(e.institution, e.degree, e.field);
    });
  }
  
  return sections.join(' ');
};

/**
 * Enrich suggestions with autoApplicable flag
 * NOTE: generateSuggestions() now sets autoApplicable directly.
 * This function is kept for backward compatibility when called on
 * suggestions from other sources (e.g. atsService scoreResult).
 * 
 * RULES:
 * - Keywords (type: 'keyword', has improved text, no placeholder): AUTO ✅
 * - Bullet verb rewrites (type: 'content', no X%/e.g. pattern): AUTO ✅
 * - Metric patterns (has 'e.g.,' or 'X%' in improved): MANUAL ❌
 * - Advisory-only suggestions: MANUAL ❌
 */
const enrichSuggestionsWithAutoApplicable = (suggestions) => {
  if (!Array.isArray(suggestions)) return [];

  return suggestions.map(s => {
    // If autoApplicable is already explicitly set, preserve it
    if (s.autoApplicable === true || s.autoApplicable === false) {
      return s;
    }

    let autoApplicable = false;

    // 1. KEYWORDS: Auto-applicable — add to skills section
    if (s.type === 'keyword' && s.improved && !s.improved.includes('(e.g.,')) {
      autoApplicable = true;
    }
    // 2. CONTENT (verb rewrites): Auto-applicable if no placeholder patterns
    else if (
      s.type === 'content' &&
      s.advisoryOnly !== true &&
      s.improved &&
      !s.improved.includes('(e.g.,') &&
      !s.improved.includes('X%') &&
      !s.improved.includes('Y%') &&
      !s.improved.includes('Y metric') &&
      !s.improved.includes('N+')
    ) {
      autoApplicable = true;
    }

    return {
      ...s,
      autoApplicable,
      advisoryOnly: !autoApplicable
    };
  });
};

module.exports = {
  generateSuggestions,
  enrichSuggestionsWithAutoApplicable,
  improveBullet,
  buildResumeText,
  countTotalSkills,
  hasActionVerb,
  hasMetrics
};