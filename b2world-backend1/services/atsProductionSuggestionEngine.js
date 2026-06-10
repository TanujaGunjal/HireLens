/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS PRODUCTION SUGGESTION ENGINE
 * 
 * Generates 3-6 actionable, contextual suggestions for resume improvement
 * Based on actual resume content, not generic instructions
 * Includes real improved text examples
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { ACTION_VERBS, DOMAIN_KEYWORDS } = require('./atsConfig');
const { normalizeText } = require('./atsTextProcessor');
const { generateKeywordSuggestions } = require('./atsKeywordSuggestionEngine');

/**
 * Generates production-quality suggestions (3-6 total)
 * Combines multiple suggestion types for comprehensive improvement guidance
 * 
 * @param {Object} resume - Resume object
 * @param {Object} breakdown - Score breakdown { keywordMatch, sectionCompleteness, formatting, actionVerbs, readability }
 * @param {string[]} missingKeywords - Keywords from JD not found in resume
 * @param {string[]} allJDKeywords - All keywords from JD
 * @param {string} resumeText - Full searchable resume text
 * @returns {Array} - Array of 3-6 suggestions
 */
function generateProductionSuggestions(resume, breakdown, missingKeywords, allJDKeywords, resumeText) {
  const suggestions = [];
  const seenTypes = new Set();
  const usedBullets = new Set(); // Shared — prevents any bullet being targeted twice
  const maxSuggestions = 6;

  const isFresher = !resume.experience || resume.experience.length === 0;

  try {

    // 1. SMART KEYWORD SUGGESTIONS — section-aware, based on JD vs resume diff
    if (breakdown.keywordMatch < 80 && missingKeywords.length > 0) {
      const keywordSuggestions = generateKeywordSuggestions(
        resume,
        allJDKeywords,
        resumeText,
        { max: 4 }  // Reserve room for verb / metric suggestions
      );
      for (const ks of keywordSuggestions) {
        if (suggestions.length >= maxSuggestions) break;
        suggestions.push(ks);
      }
    }

    // FRESHER PATH — project-based suggestions
    if (isFresher) {
      if (resume.projects && resume.projects.length > 0 && suggestions.length < maxSuggestions) {
        const projectSugg = generateProjectBulletSuggestion(resume, usedBullets);
        if (projectSugg && !seenTypes.has('projects')) {
          suggestions.push(projectSugg);
          seenTypes.add('projects');
        }
      }

      if ((!resume.summary || resume.summary.length < 80) && suggestions.length < maxSuggestions) {
        suggestions.push({
          id: `sugg-summary-fresher-${Date.now()}`,
          type: 'summary',
          impact: 'medium',
          message: 'Strengthen your professional summary to highlight your technical skills and goals',
          currentText: resume.summary || '(No summary)',
          improvedText: 'Computer engineering student with hands-on experience in full-stack web development using React.js, Node.js, and MongoDB. Skilled in building RESTful APIs and responsive UIs through academic projects and hackathon participation. Eager to contribute to software development teams and grow as a developer.',
          section: 'summary',
          priority: 3
        });
      }

      if (breakdown.formatting < 70 && suggestions.length < maxSuggestions) {
        const structureSugg = generateStructureSuggestion(resume);
        if (structureSugg && !seenTypes.has('formatting')) {
          suggestions.push(structureSugg);
          seenTypes.add('formatting');
        }
      }

      return suggestions.slice(0, maxSuggestions);
    }

    // 2. WEAK VERB FIXES — up to 3 bullets, each a different bullet
    if (breakdown.actionVerbs < 80 && suggestions.length < maxSuggestions) {
      const verbSuggestions = generateAllWeakVerbSuggestions(resume, usedBullets, 3);
      for (const vs of verbSuggestions) {
        if (suggestions.length >= maxSuggestions) break;
        suggestions.push(vs);
      }
    }

    // 3. METRIC ADDITIONS — bullets without numbers, not already used
    if (suggestions.length < maxSuggestions) {
      const metricSugg = generateExperienceSuggestion(resume, usedBullets);
      if (metricSugg && !seenTypes.has('experience')) {
        suggestions.push(metricSugg);
        seenTypes.add('experience');
      }
    }

    // 4. SUMMARY IMPROVEMENT
    if ((!resume.summary || resume.summary.length < 100) && suggestions.length < maxSuggestions && !seenTypes.has('summary')) {
      suggestions.push({
        id: `sugg-summary-${Date.now()}`,
        type: 'summary',
        impact: 'medium',
        message: 'Strengthen your professional summary with specific skills and goals',
        currentText: resume.summary || '(No summary)',
        improvedText: 'Results-driven software developer with experience building scalable web applications using React.js, Node.js, Express, and MongoDB. Proven ability to design REST APIs, debug complex features, and collaborate with cross-functional teams. Passionate about delivering clean, efficient code and continuously learning modern development practices.',
        section: 'summary',
        priority: 4
      });
      seenTypes.add('summary');
    }

    // 5. FORMATTING
    if (breakdown.formatting < 70 && suggestions.length < maxSuggestions) {
      const structureSugg = generateStructureSuggestion(resume);
      if (structureSugg && !seenTypes.has('formatting')) {
        suggestions.push(structureSugg);
        seenTypes.add('formatting');
      }
    }

    // 6. FALLBACK
    if (suggestions.length < 2) {
      const fallback = generateGenericSuggestions(resume, breakdown, missingKeywords);
      for (const fb of fallback) {
        if (suggestions.length >= maxSuggestions) break;
        if (!seenTypes.has(fb.type)) {
          suggestions.push(fb);
          seenTypes.add(fb.type);
        }
      }
    }

    return suggestions.slice(0, maxSuggestions);

  } catch (error) {
    console.error('[ProductionSuggestionEngine] Error generating suggestions:', error.message);
    return [];
  }
}

/**
 * Generates keyword suggestion with improved text
 * Always adds keywords to skills — safe for all resume types
 * 
 * @private
 */
function generateKeywordSuggestion(resume, keyword) {
  // Always add keywords to skills — safe for all resume types
  return {
    id: `sugg-keyword-${Date.now()}`,
    type: 'keyword',
    impact: 'high',
    message: `Add "${keyword}" to your skills to match the job description`,
    currentText: 'Skills section',
    improvedText: keyword,
    section: 'skills',
    priority: 1
  };
}

/**
 * Generates experience enhancement suggestion with metrics
 * 
 * @private
 */
function generateExperienceSuggestion(resume, usedBullets = new Set()) {
  if (!resume.experience || resume.experience.length === 0) return null;

  let targetBullet = null;
  let bulletIndex = 0;
  let expIndex = 0;

  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    if (exp.bullets && exp.bullets.length > 0) {
      for (let j = 0; j < exp.bullets.length; j++) {
        const key = `exp-${i}-${j}`;
        if (usedBullets.has(key)) continue; // Already targeted by verb fix
        const bullet = exp.bullets[j];
        if (!hasMetrics(bullet)) {
          targetBullet = bullet;
          expIndex = i;
          bulletIndex = j;
          usedBullets.add(key);
          break;
        }
      }
      if (targetBullet) break;
    }
  }

  if (!targetBullet) return null;

  const improvedText = addMetricsToText(targetBullet);
  if (improvedText === targetBullet) return null;

  return {
    id: `sugg-exp-${Date.now()}`,
    type: 'experience',
    impact: 'high',
    message: 'Add quantifiable metrics to demonstrate impact',
    currentText: targetBullet,
    improvedText,
    section: 'experience',
    itemIndex: expIndex,
    bulletIndex,
    priority: 2
  };
}

/**
 * Generates action verb enhancement suggestion
 * 
 * @private
 */
function generateActionVerbSuggestion(resume) {
  let weakBullet = null;
  let expIndex = -1;
  let bulletIndex = -1;

  // Find a bullet with weak verbs
  if (resume.experience && resume.experience.length > 0) {
    for (let i = 0; i < resume.experience.length; i++) {
      const exp = resume.experience[i];
      if (exp.bullets && exp.bullets.length > 0) {
        for (let j = 0; j < exp.bullets.length; j++) {
          const bullet = exp.bullets[j];
          if (startsWithWeakVerb(bullet)) {
            weakBullet = bullet;
            expIndex = i;
            bulletIndex = j;
            break;
          }
        }
        if (weakBullet) break;
      }
    }
  }

  if (!weakBullet) return null;

  const improvedText = replaceWeakVerb(weakBullet);
  if (improvedText === weakBullet) return null;

  return {
    id: `sugg-verb-${Date.now()}`,
    type: 'action_verb',
    impact: 'medium',
    message: 'Use stronger action verbs to showcase accomplishments',
    currentText: weakBullet,
    improvedText: improvedText,
    section: 'experience',
    itemIndex: expIndex,
    bulletIndex: bulletIndex,
    priority: 3
  };
}

/**
 * Generates skill addition suggestion
 * 
 * @private
 */
function generateSkillSuggestion(resume, missingKeywords) {
  if (!missingKeywords || missingKeywords.length === 0) return null;

  const skillToAdd = missingKeywords[0];
  
  return {
    id: `sugg-skill-${Date.now()}`,
    type: 'skills',
    impact: 'high',
    message: `Add "${skillToAdd}" to your technical skills`,
    currentText: 'Skills section',
    improvedText: skillToAdd,
    section: 'skills',
    priority: 4
  };
}

/**
 * Generates structure/formatting suggestion
 * 
 * @private
 */
function generateStructureSuggestion(resume) {
  const issues = [];

  // Check for missing sections
  if (!resume.summary || resume.summary.trim().length < 20) {
    issues.push({
      type: 'formatting',
      impact: 'medium',
      message: 'Add or expand your professional summary (50-100 words)',
      currentText: resume.summary || '(No summary)',
      improvedText: 'Experienced software engineer with 5+ years in full-stack development specializing in Node.js React. Proven track record of delivering scalable solutions and mentoring junior developers.',
      section: 'summary',
      priority: 5
    });
  }

  if (!resume.education || resume.education.length === 0) {
    issues.push({
      type: 'formatting',
      impact: 'medium',
      message: 'Add education section to provide full professional profile',
      currentText: '(No education)',
      improvedText: 'B.S. Computer Science, [University Name], 2020',
      section: 'education',
      priority: 5
    });
  }

  return issues.length > 0 ? issues[0] : null;
}

/**
 * Generates readability suggestion
 * 
 * @private
 */
function generateReadabilitySuggestion(resume) {
  // Check for very long bullets
  if (resume.experience && resume.experience.length > 0) {
    for (const exp of resume.experience) {
      if (exp.bullets && exp.bullets.length > 0) {
        for (const bullet of exp.bullets) {
          if (bullet.length > 200) {
            return {
              id: `sugg-read-${Date.now()}`,
              type: 'readability',
              impact: 'low',
              message: 'Break down lengthy bullet points for better readability',
              currentText: bullet,
              improvedText: bullet.substring(0, 100) + '... [Split into multiple bullets for clarity]',
              section: 'experience',
              priority: 6
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Generates additional generic suggestions as fallback
 * 
 * @private
 */
function generateGenericSuggestions(resume, breakdown, missingKeywords) {
  const suggestions = [];

  // Project showcase
  if (!resume.projects || resume.projects.length === 0) {
    suggestions.push({
      id: `sugg-proj-${Date.now()}`,
      type: 'projects',
      impact: 'medium',
      message: 'Showcase key projects to demonstrate technical capabilities',
      currentText: '(No projects)',
      improvedText: 'Project: E-Commerce Platform - Built scalable Node.js/React application handling 50k+ daily transactions',
      section: 'projects',
      priority: 5
    });
  }

  // Certifications
  if (!resume.certifications || resume.certifications.length === 0) {
    suggestions.push({
      id: `sugg-cert-${Date.now()}`,
      type: 'certifications',
      impact: 'low',
      message: 'Add relevant certifications to enhance credibility',
      currentText: '(No certifications)',
      improvedText: 'AWS Certified Solutions Architect – Associate',
      section: 'certifications',
      priority: 6
    });
  }

  return suggestions;
}

/**
 * HELPER FUNCTIONS
 */

function hasMetrics(text) {
  return /(\d+k|\d{2,}%|\d+\+|increased|improved|reduced)/.test(text);
}

function addMetricsToText(text) {
  const t = text.trim();

  // API / backend / service bullets
  if (/api|endpoint|rest|backend|server|service/i.test(t)) {
    return t.replace(/\.\s*$/, '') + ', handling 500+ daily requests and reducing response time by 30%.';
  }

  // UI / frontend bullets
  if (/ui|interface|component|frontend|react|css|html/i.test(t)) {
    return t.replace(/\.\s*$/, '') + ', improving page load time by 25% and enhancing user experience.';
  }

  // Database / storage bullets
  if (/database|mongodb|sql|query|data|storage/i.test(t)) {
    return t.replace(/\.\s*$/, '') + ', reducing query latency by 40% and supporting 1,000+ records.';
  }

  // Testing / debugging bullets
  if (/test|debug|bug|quality|qa/i.test(t)) {
    return t.replace(/\.\s*$/, '') + ', reducing bug count by 35% and improving code coverage to 80%.';
  }

  // Git / version control / collaboration bullets
  if (/git|version|collab|team|meeting|document/i.test(t)) {
    return t.replace(/\.\s*$/, '') + ', improving team delivery speed by 20%.';
  }

  // Generic fallback — append a reasonable outcome
  return t.replace(/\.\s*$/, '') + ', contributing to a 20% improvement in overall project efficiency.';
}

function startsWithWeakVerb(text) {
  const weakVerbs = [
    'responsible for',
    'worked on',
    'involved in',
    'helped', 
    'assisted',
    'did',
    'made',
    'did work with',
    'was part of',
    'contributed to',
    'participated'
  ];

  return weakVerbs.some(verb => text.toLowerCase().startsWith(verb));
}

function replaceWeakVerb(text) {
  const verbMap = {
    'responsible for': 'Engineered',
    'worked on': 'Developed',
    'involved in': 'Spearheaded',
    'helped': 'Facilitated',
    'assisted': 'Supported',
    'did': 'Executed',
    'made': 'Developed',
    'was part of': 'Contributed to',
    'participated': 'Collaborated'
  };

  const ALREADY_STRONG = [
    'architected', 'developed', 'built', 'engineered', 'implemented',
    'designed', 'optimized', 'led', 'created', 'deployed', 'launched',
    'managed', 'analyzed', 'integrated', 'automated', 'delivered',
    'established', 'orchestrated', 'spearheaded', 'streamlined',
    'facilitated', 'supported', 'collaborated', 'executed', 'contributed'
  ];

  const firstWord = text.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  if (ALREADY_STRONG.includes(firstWord)) {
    return text; // Already strong — no suggestion needed
  }

  for (const [weak, strong] of Object.entries(verbMap)) {
    if (text.toLowerCase().startsWith(weak)) {
      let remainder = text.substring(weak.length).trim();

      // Strip trailing gerund to avoid "Developed developing APIs"
      if ((weak === 'worked on' || weak === 'involved in') && /^[a-z]+ing\s/i.test(remainder)) {
        const parts = remainder.split(/\s+/);
        if (parts.length > 1) {
          remainder = parts.slice(1).join(' ');
        }
      }

      const cleanRemainder = remainder.charAt(0).toUpperCase() + remainder.slice(1);
      return `${strong} ${cleanRemainder}`;
    }
  }

  return text;
}

function addKeywordToText(text, keyword) {
  if (text.includes(keyword)) return text;
  
  // Insert keyword naturally
  if (text.includes('technologies')) {
    return text.replace('technologies', `technologies including ${keyword}`);
  }
  
  if (text.includes('using')) {
    return text.replace('using', `using ${keyword} and`);
  }

  return `${text.substring(0, text.length - 1)}, leveraging ${keyword}`;
}

function detectDomain(resume) {
  const allText = [
    resume.summary || '',
    resume.jobTitle || '',
    (resume.experience || [])
      .map(e => `${e.role || ''} ${(e.bullets || []).join(' ')}`)
      .join(' '),
    (resume.skills || [])
      .flatMap(s => s.items || [])
      .join(' ')
  ].join(' ').toLowerCase();

  // Simple domain detection
  if (allText.includes('data') && allText.includes('python')) return 'data_scientist';
  if (allText.includes('frontend') || allText.includes('react')) return 'frontend_engineer';
  if (allText.includes('backend') || allText.includes('server')) return 'backend_engineer';
  if (allText.includes('devops') || allText.includes('kubernetes')) return 'devops_engineer';
  
  return 'software_engineer';
}

/**
 * Generates one suggestion per weak-verb bullet, up to maxCount.
 * Uses usedBullets Set to prevent targeting the same bullet twice.
 */
function generateAllWeakVerbSuggestions(resume, usedBullets, maxCount = 3) {
  const results = [];
  if (!resume.experience) return results;

  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    if (!exp.bullets) continue;
    for (let j = 0; j < exp.bullets.length; j++) {
      if (results.length >= maxCount) break;
      const bullet = exp.bullets[j];
      const key = `exp-${i}-${j}`;
      if (usedBullets.has(key)) continue;
      if (!startsWithWeakVerb(bullet)) continue;

      const improved = replaceWeakVerb(bullet);
      if (improved === bullet) continue;

      usedBullets.add(key);
      results.push({
        id: `sugg-verb-${i}-${j}-${Date.now()}`,
        type: 'action_verb',
        impact: 'medium',
        message: 'Use a stronger action verb to showcase your contribution',
        currentText: bullet,
        improvedText: improved,
        section: 'experience',
        itemIndex: i,
        bulletIndex: j,
        priority: 3
      });
    }
    if (results.length >= maxCount) break;
  }
  return results;
}

/**
 * Finds the best project bullet to improve (for fresher resumes).
 * Targets bullets with weak verbs or no metrics.
 */
function generateProjectBulletSuggestion(resume, usedBullets) {
  if (!resume.projects || resume.projects.length === 0) return null;

  for (let i = 0; i < resume.projects.length; i++) {
    const project = resume.projects[i];
    if (!project.bullets || project.bullets.length === 0) continue;

    for (let j = 0; j < project.bullets.length; j++) {
      const bullet = project.bullets[j];
      if (!bullet || bullet.length < 10) continue;
      const key = `proj-${i}-${j}`;
      if (usedBullets && usedBullets.has(key)) continue;
      if (hasMetrics(bullet)) continue;

      const firstWord = bullet.trim().split(/\s+/)[0].toLowerCase();
      const STRONG = ['developed', 'built', 'created', 'designed', 'implemented',
        'engineered', 'architected', 'optimized', 'deployed', 'integrated'];

      let improvedText;
      if (STRONG.includes(firstWord)) {
        improvedText = addMetricsToText(bullet);
      } else if (startsWithWeakVerb(bullet)) {
        const verbReplaced = replaceWeakVerb(bullet);
        improvedText = addMetricsToText(verbReplaced !== bullet ? verbReplaced : bullet);
      } else {
        continue;
      }

      if (improvedText === bullet) continue;
      if (usedBullets) usedBullets.add(key);

      return {
        id: `sugg-proj-${Date.now()}`,
        type: 'projects',
        section: 'projects',
        impact: 'high',
        message: 'Strengthen this project bullet with a stronger verb and measurable impact',
        currentText: bullet,
        improvedText,
        itemIndex: i,
        bulletIndex: j,
        priority: 2
      };
    }
  }
  return null;
}

module.exports = {
  generateProductionSuggestions
};