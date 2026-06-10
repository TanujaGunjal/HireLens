/**
 * ================================================================================
 * REPLACE FIELD HELPER - PRODUCTION GRADE
 * ================================================================================
 * Safe field replacement with validation and double-apply detection
 * ================================================================================
 */

const { normalizeKeyword } = require('./keywordNormalizationHelper');

/**
 * Safely replace a field in resume
 * Handles all sections: summary, experience, projects, skills
 * Prevents double-apply by checking if text already exists
 */
const replaceField = (resume, suggestion) => {
  const { section, itemIndex, bulletIndex, improvedText, currentText } = suggestion;

  if (!resume) {
    throw new Error('Resume object is required');
  }

  if (!section || !improvedText) {
    throw new Error('Section and improvedText are required');
  }

  const finalText = String(improvedText).trim();
  if (!finalText) {
    throw new Error('improvedText cannot be empty');
  }

  console.log(`[replaceField] Starting: section=${section}, currentText="${currentText?.substring(0, 50)}..."`);

  // SUMMARY
  if (section === 'summary') {
    // Check for double-apply
    if (currentText && resume.summary) {
      const normalizedCurrent = normalizeText(resume.summary);
      const normalizedExpected = normalizeText(currentText);
      if (normalizedCurrent !== normalizedExpected) {
        console.log(`[replaceField] SKIP: Summary already changed. Current: "${resume.summary.substring(0, 40)}..."`);
        return { success: true, skipped: true, reason: 'Already applied' };
      }
    }

    resume.summary = finalText;
    console.log(`[replaceField] ✓ Updated summary`);
    return { success: true, skipped: false };
  }

  // EXPERIENCE
  if (section === 'experience') {
    if (itemIndex == null || bulletIndex == null) {
      throw new Error('itemIndex and bulletIndex required for experience');
    }

    if (!resume.experience || !Array.isArray(resume.experience)) {
      throw new Error('Resume has no experience section');
    }

    if (itemIndex < 0 || itemIndex >= resume.experience.length) {
      throw new Error(`Experience index ${itemIndex} out of bounds (0-${resume.experience.length - 1})`);
    }

    const exp = resume.experience[itemIndex];
    if (!exp.bullets || !Array.isArray(exp.bullets)) {
      throw new Error(`Experience[${itemIndex}] has no bullets array`);
    }

    if (bulletIndex < 0 || bulletIndex >= exp.bullets.length) {
      throw new Error(`Bullet index ${bulletIndex} out of bounds in experience[${itemIndex}] (0-${exp.bullets.length - 1})`);
    }

    // Check for double-apply
    if (currentText) {
      const actualText = exp.bullets[bulletIndex];
      const normalizedActual = normalizeText(actualText);
      const normalizedExpected = normalizeText(currentText);
      if (normalizedActual !== normalizedExpected) {
        console.log(`[replaceField] SKIP: Bullet already changed. Current: "${actualText.substring(0, 40)}..."`);
        return { success: true, skipped: true, reason: 'Already applied' };
      }
    }

    exp.bullets[bulletIndex] = finalText;
    resume.markModified('experience');
    console.log(`[replaceField] ✓ Updated experience[${itemIndex}].bullets[${bulletIndex}]`);
    return { success: true, skipped: false };
  }

  // PROJECTS
  if (section === 'projects') {
    if (itemIndex == null || bulletIndex == null) {
      throw new Error('itemIndex and bulletIndex required for projects');
    }

    if (!resume.projects || !Array.isArray(resume.projects)) {
      throw new Error('Resume has no projects section');
    }

    if (itemIndex < 0 || itemIndex >= resume.projects.length) {
      throw new Error(`Project index ${itemIndex} out of bounds (0-${resume.projects.length - 1})`);
    }

    const proj = resume.projects[itemIndex];
    if (!proj.bullets || !Array.isArray(proj.bullets)) {
      throw new Error(`Project[${itemIndex}] has no bullets array`);
    }

    if (bulletIndex < 0 || bulletIndex >= proj.bullets.length) {
      throw new Error(`Bullet index ${bulletIndex} out of bounds in projects[${itemIndex}] (0-${proj.bullets.length - 1})`);
    }

    // Check for double-apply
    if (currentText) {
      const actualText = proj.bullets[bulletIndex];
      const normalizedActual = normalizeText(actualText);
      const normalizedExpected = normalizeText(currentText);
      if (normalizedActual !== normalizedExpected) {
        console.log(`[replaceField] SKIP: Bullet already changed. Current: "${actualText.substring(0, 40)}..."`);
        return { success: true, skipped: true, reason: 'Already applied' };
      }
    }

    proj.bullets[bulletIndex] = finalText;
    resume.markModified('projects');
    console.log(`[replaceField] ✓ Updated projects[${itemIndex}].bullets[${bulletIndex}]`);
    return { success: true, skipped: false };
  }

  // SKILLS
  if (section === 'skills') {
    const catIdx = itemIndex ?? 0;

    // Initialize if needed
    if (!resume.skills || !Array.isArray(resume.skills)) {
      resume.skills = [];
    }

    if (!resume.skills[catIdx]) {
      resume.skills[catIdx] = {
        category: catIdx === 0 ? 'Technical Skills' : `Skills ${catIdx}`,
        items: [],
      };
    }

    if (!resume.skills[catIdx].items) {
      resume.skills[catIdx].items = [];
    }

    // Check for duplicate
    const exists = resume.skills[catIdx].items.some(
      item => normalizeText(item) === normalizeText(finalText)
    );

    if (exists) {
      console.log(`[replaceField] SKIP: Skill "${finalText}" already exists`);
      return { success: true, skipped: true, reason: 'Already exists' };
    }

    resume.skills[catIdx].items.push(finalText);
    resume.markModified('skills');
    console.log(`[replaceField] ✓ Added skill: "${finalText}"`);
    return { success: true, skipped: false };
  }

  throw new Error(`Unknown section: ${section}`);
};

/**
 * Normalize text for comparison
 */
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

module.exports = {
  replaceField,
  normalizeText,
};
