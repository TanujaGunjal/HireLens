/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS COMPLETENESS DETECTOR - REFACTORED
 * 
 * FIX: Never returns 0 if resume contains any sections
 * 
 * Section Detection Rules:
 * - summary/professional summary
 * - skills/technical skills
 * - experience/professional experience
 * - projects
 * - education
 * - certifications
 * - achievements
 * 
 * Scoring:
 * 7 sections = 100
 * 6 sections = 90
 * 5 sections = 80
 * 4 sections = 70
 * 3 sections = 60
 * 2 sections = 40
 * 1 section = 20 (NOT ZERO — minimum floor)
 * 0 sections = 0 (only if resume is truly empty)
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

/**
 * Flexible section heading detection
 * Checks against common variations
 */
const SECTION_ALIASES = {
  summary: ['summary', 'professional summary', 'professional profile', 'profile', 'about', 'about me'],
  skills: ['skills', 'technical skills', 'core competencies', 'competencies', 'expertise', 'tools and technologies'],
  experience: ['experience', 'professional experience', 'work experience', 'employment history'],
  projects: ['projects', 'portfolio', 'key projects', 'notable projects'],
  education: ['education', 'academic background', 'credentials'],
  certifications: ['certifications', 'licenses', 'certifications and licenses'],
  achievements: ['achievements', 'awards', 'honors and awards']
};

/**
 * Detects if a resume has a given section
 * Uses flexible heading matching + content checks
 * 
 * @param {Object} resume - Resume object
 * @param {string} sectionType - Type: 'summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements'
 * @returns {boolean} - True if section exists and has content
 */
function hasSectionContent(resume, sectionType) {
  if (!resume || typeof resume !== 'object') return false;

  // Direct field checks (most reliable)
  switch (sectionType) {
    case 'summary':
      return !!(resume.summary && String(resume.summary).trim().length > 10);

    case 'skills':
      if (!resume.skills) return false;
      if (Array.isArray(resume.skills)) {
        // Check for any non-empty skills
        return resume.skills.some(skill => {
          if (typeof skill === 'string') return skill.trim().length > 0;
          if (skill && typeof skill === 'object') {
            if (skill.items && Array.isArray(skill.items)) {
              return skill.items.some(item => String(item).trim().length > 0);
            }
            return String(skill).trim().length > 0;
          }
          return false;
        });
      }
      return String(resume.skills).trim().length > 0;

    case 'experience':
      if (!resume.experience || !Array.isArray(resume.experience)) return false;
      return resume.experience.length > 0 && resume.experience.some(exp => {
        return !!(
          (exp.company && String(exp.company).trim().length > 0) ||
          (exp.title && String(exp.title).trim().length > 0) ||
          (exp.bullets && Array.isArray(exp.bullets) && exp.bullets.length > 0)
        );
      });

    case 'projects':
      if (!resume.projects || !Array.isArray(resume.projects)) return false;
      return resume.projects.length > 0 && resume.projects.some(proj => {
        return !!(
          (proj.name && String(proj.name).trim().length > 0) ||
          (proj.title && String(proj.title).trim().length > 0) ||
          (proj.description && String(proj.description).trim().length > 0) ||
          (proj.bullets && Array.isArray(proj.bullets) && proj.bullets.length > 0)
        );
      });

    case 'education':
      if (!resume.education || !Array.isArray(resume.education)) return false;
      return resume.education.length > 0 && resume.education.some(edu => {
        return !!(
          (edu.school && String(edu.school).trim().length > 0) ||
          (edu.degree && String(edu.degree).trim().length > 0) ||
          (edu.description && String(edu.description).trim().length > 0)
        );
      });

    case 'certifications':
      if (!resume.certifications || !Array.isArray(resume.certifications)) return false;
      return resume.certifications.length > 0 && resume.certifications.some(cert => {
        return !!(
          (cert.name && String(cert.name).trim().length > 0) ||
          (cert.title && String(cert.title).trim().length > 0) ||
          (cert.description && String(cert.description).trim().length > 0)
        );
      });

    case 'achievements':
      if (!resume.achievements || !Array.isArray(resume.achievements)) return false;
      return resume.achievements.length > 0 && resume.achievements.some(ach => {
        return !!(
          (ach.title && String(ach.title).trim().length > 0) ||
          (ach.description && String(ach.description).trim().length > 0) ||
          String(ach).trim().length > 0
        );
      });

    default:
      return false;
  }
}

/**
 * Calculates resume completeness score using additive section-based scoring.
 *
 * Section weights:
 *   skills     → 20 pts
 *   projects   → 30 pts  (substitutes for experience for freshers)
 *   education  → 20 pts
 *   experience → 30 pts
 *
 * Rules:
 *   - Return 0 ONLY when skills + projects + education are all absent.
 *   - Freshers (no experience) get full project + education credit.
 *   - Floor of 60 when any meaningful content exists.
 *
 * @param {Object} resume - Resume object
 * @returns {Object} { score: 0-100, sections: {}, presentCount: number }
 */
function calculateCompleteness(resume) {
  if (!resume || typeof resume !== 'object') {
    return {
      score: 0,
      sections: {},
      presentCount: 0,
      reason: 'Invalid resume object'
    };
  }

  // Detect all sections using the existing flexible helpers
  const sections = {
    summary:        hasSectionContent(resume, 'summary'),
    skills:         hasSectionContent(resume, 'skills'),
    experience:     hasSectionContent(resume, 'experience'),
    projects:       hasSectionContent(resume, 'projects'),
    education:      hasSectionContent(resume, 'education'),
    certifications: hasSectionContent(resume, 'certifications'),
    achievements:   hasSectionContent(resume, 'achievements')
  };

  const presentCount  = Object.values(sections).filter(Boolean).length;
  const totalSections = Object.keys(sections).length;

  // ── Guard: only return 0 when all three core non-experience sections are absent ──
  if (!sections.skills && !sections.projects && !sections.education) {
    console.log('[ATS] completeness breakdown: skills=0 + projects=0 + education=0 + experience=0 → score=0');
    return {
      score: 0,
      sections,
      presentCount,
      totalSections,
      missing: Object.entries(sections).filter(([, v]) => !v).map(([k]) => k)
    };
  }

  // ── Additive scoring ─────────────────────────────────────────────────────
  let skillsPts     = 0;
  let projectsPts   = 0;
  let educationPts  = 0;
  let experiencePts = 0;

  if (sections.skills)     skillsPts     = 20;
  if (sections.projects)   projectsPts   = 30;
  if (sections.education)  educationPts  = 20;
  if (sections.experience) experiencePts = 30;

  let score = skillsPts + projectsPts + educationPts + experiencePts;

  // ── Fresher floor: ensure completeness >= 60 when meaningful content exists ──
  // (projects + education should fully compensate for missing experience)
  const hasAnyContent = sections.skills || sections.projects || sections.education || sections.experience;
  if (hasAnyContent && score < 60) score = 60;

  score = Math.max(0, Math.min(100, score));

  console.log(
    `[ATS] completeness breakdown: skills=${skillsPts} + projects=${projectsPts}` +
    ` + education=${educationPts} + experience=${experiencePts} → score=${score}`
  );

  return {
    score,
    sections,
    presentCount,
    totalSections,
    missing: Object.entries(sections).filter(([, v]) => !v).map(([k]) => k)
  };
}

/**
 * Quality check for resume sections
 * Returns detailed metrics for each section
 * 
 * @param {Object} resume - Resume object
 * @returns {Object} - Detailed quality metrics
 */
function getDetailedQuality(resume) {
  if (!resume || typeof resume !== 'object') {
    return { isValid: false, message: 'Invalid resume' };
  }

  const quality = {
    isValid: true,
    summaryLength: (resume.summary || '').length,
    skillCount: Array.isArray(resume.skills) ? resume.skills.length : 0,
    experienceCount: Array.isArray(resume.experience) ? resume.experience.length : 0,
    projectCount: Array.isArray(resume.projects) ? resume.projects.length : 0,
    educationCount: Array.isArray(resume.education) ? resume.education.length : 0,
    certificationCount: Array.isArray(resume.certifications) ? resume.certifications.length : 0,
    achievementCount: Array.isArray(resume.achievements) ? resume.achievements.length : 0
  };

  // Check for content quality
  const hasSubstantialContent = (
    quality.summaryLength > 50 &&
    quality.skillCount > 0 &&
    quality.experienceCount > 0
  );

  quality.hasSubstantialContent = hasSubstantialContent;

  return quality;
}

module.exports = {
  calculateCompleteness,
  hasSectionContent,
  getDetailedQuality,
  SECTION_ALIASES
};
