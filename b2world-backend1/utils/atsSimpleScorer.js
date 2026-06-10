/**
 * Simple ATS Scorer - Safe implementation
 * Uses .lean() to get plain JavaScript objects
 * No global variables, all functions are pure
 */

const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const ATSReport = require('../models/ATSReport');
const mongoose = require('mongoose');
const suggestionEngine = require('../utils/suggestionEngine');

// Normalize text for matching
const normalizeText = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Build resume text from all sections
function buildResumeText(resume) {
  if (!resume) return '';

  const sections = [];

  if (resume.summary) sections.push(resume.summary);

  // Skills
  if (Array.isArray(resume.skills)) {
    resume.skills.forEach(s => {
      if (Array.isArray(s.items)) {
        sections.push(...s.items);
      }
    });
  }

  // Experience
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (Array.isArray(e.bullets)) {
        sections.push(...e.bullets);
      }
      if (e.role) sections.push(e.role);
      if (e.company) sections.push(e.company);
    });
  }

  // Projects
  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) {
        sections.push(...p.bullets);
      }
      if (p.title) sections.push(p.title);
      if (Array.isArray(p.techStack)) {
        sections.push(...p.techStack);
      }
    });
  }

  // Education
  if (Array.isArray(resume.education)) {
    resume.education.forEach(e => {
      if (e.degree) sections.push(e.degree);
      if (e.institution) sections.push(e.institution);
    });
  }

  return normalizeText(sections.join(' '));
}

// Calculate action verb score
function calculateActionScore(resume) {
  if (!resume) return 0;

  const strongVerbs = new Set([
    'built', 'developed', 'implemented', 'designed', 'reduced', 'increased',
    'architected', 'optimized', 'led', 'created', 'delivered', 'achieved',
    'enhanced', 'improved', 'engineered', 'launched', 'established', 'spearheaded'
  ]);

  const weakVerbs = new Set([
    'worked', 'helped', 'assisted', 'responsible', 'supported', 'involved', 'handled'
  ]);

  const allBullets = [];
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (Array.isArray(e.bullets)) {
        allBullets.push(...e.bullets);
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) {
        allBullets.push(...p.bullets);
      }
    });
  }

  if (allBullets.length === 0) return 0;

  const bulletStarts = allBullets
    .map(b => normalizeText(b).split(' ')[0])
    .filter(Boolean);

  const strongCount = bulletStarts.filter(v => strongVerbs.has(v)).length;
  const weakCount = bulletStarts.filter(v => weakVerbs.has(v)).length;

  const baseScore = (strongCount / bulletStarts.length) * 100;
  const weakPenalty = (weakCount / bulletStarts.length) * 15;

  return Math.max(0, Math.round(baseScore - weakPenalty));
}

// Calculate completeness score
function calculateCompleteness(resume) {
  if (!resume) return 0;

  const checks = [
    { field: resume.summary, weight: 15 },
    { field: resume.skills?.length > 0, weight: 20 },
    { field: resume.experience?.length > 0, weight: 25 },
    { field: resume.projects?.length > 0, weight: 15 },
    { field: resume.education?.length > 0, weight: 10 },
    { field: resume.certifications?.length > 0 || resume.achievements?.length > 0, weight: 15 }
  ];

  let score = 0;
  checks.forEach(check => {
    if (check.field) score += check.weight;
  });

  return score;
}

// Calculate formatting score
function calculateFormatting(resume) {
  if (!resume) return 100;

  let penalty = 0;

  const allText = buildResumeText(resume);
  
  // Check for problematic characters
  if (/[*_~`#=]{3,}/.test(allText)) penalty += 20;
  if (/\|.+\|/.test(allText)) penalty += 20; // tables
  if (/[\u{1F300}-\u{1FAFF}]/u.test(allText)) penalty += 20; // emojis

  return Math.max(0, 100 - penalty);
}

// Calculate readability score
function calculateReadability(resume) {
  if (!resume) return 0;

  const allBullets = [];
  
  if (Array.isArray(resume.experience)) {
    resume.experience.forEach(e => {
      if (Array.isArray(e.bullets)) {
        allBullets.push(...e.bullets);
      }
    });
  }

  if (Array.isArray(resume.projects)) {
    resume.projects.forEach(p => {
      if (Array.isArray(p.bullets)) {
        allBullets.push(...p.bullets);
      }
    });
  }

  if (allBullets.length === 0) return 0;

  // Check for very long bullets
  const longBullets = allBullets.filter(b => b.split(' ').length > 35).length;
  const longPenalty = Math.min(30, longBullets * 7);

  return Math.max(0, 100 - longPenalty);
}

/**
 * Safe ATS Score Calculation
 * @param {string} resumeId - Resume ID
 * @param {string} jdId - Job Description ID (optional)
 * @returns {Promise<object>} Score result
 */
async function calculateATSScore(resumeId, jdId) {
  try {
    console.log('[ATS_SIMPLE] Starting scoring for resume:', resumeId, 'jd:', jdId);

    if (!resumeId) {
      throw new Error('resumeId is required');
    }

    // Use .lean() to get plain JS object
    const resume = await Resume.findById(resumeId).lean();

    if (!resume) {
      throw new Error('Resume not found');
    }

    console.log('[ATS_SIMPLE] Resume found, jdId on resume:', resume.jdId);

    let jdKeywords = [];
    let actualJdId = jdId || resume.jdId;

    if (actualJdId) {
      const jd = await JobDescription.findById(actualJdId).lean();
      if (jd && Array.isArray(jd.extractedKeywords)) {
        jdKeywords = jd.extractedKeywords.map(k => 
          typeof k === 'string' ? k : k.keyword
        );
        console.log('[ATS_SIMPLE] JD keywords:', jdKeywords.length);
      }
    }

    // Build resume text
    const resumeText = buildResumeText(resume);
    console.log('[ATS_SIMPLE] Resume text length:', resumeText.length);

    // Keyword match
    const normalizedResumeText = normalizeText(resumeText);
    const matchedKeywords = jdKeywords.filter(k => {
      const normalized = normalizeText(k);
      return normalizedResumeText.includes(normalized);
    });

    const keywordMatch = jdKeywords.length > 0
      ? Math.round((matchedKeywords.length / jdKeywords.length) * 100)
      : 0;

    console.log('[ATS_SIMPLE] Keyword match:', keywordMatch, '%');

    // Other scores
    const actionScore = calculateActionScore(resume);
    const completeness = calculateCompleteness(resume);
    const formatting = calculateFormatting(resume);
    const readability = calculateReadability(resume);

    console.log('[ATS_SIMPLE] Scores:', { keywordMatch, actionScore, completeness, formatting, readability });

    // Calculate total
    const totalScore = Math.round(
      keywordMatch * 0.4 +
      completeness * 0.2 +
      formatting * 0.2 +
      actionScore * 0.1 +
      readability * 0.1
    );

    console.log('[ATS_SIMPLE] Total score:', totalScore);

    return {
      totalScore,
      scoringMode: jdKeywords.length > 0 ? 'job-specific' : 'general',
      breakdown: {
        keywordMatch,
        completeness,
        formatting,
        actionVerbs: actionScore,
        readability
      },
      matchedKeywords,
      missingKeywords: jdKeywords.filter(k => !matchedKeywords.includes(k))
    };

  } catch (err) {
    console.error('[ATS_SIMPLE] Error:', err.message);
    throw err;
  }
}

module.exports = { calculateATSScore };
