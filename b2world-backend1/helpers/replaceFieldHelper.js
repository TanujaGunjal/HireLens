/**
 * ================================================================================
 * REPLACE FIELD HELPER - PRODUCTION GRADE
 * ================================================================================
 * Safe, validated field replacement with double-apply detection
 * ================================================================================
 */

class ReplaceFieldError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Validates resume field path and bounds
 */
const validateResumeField = (resume, section, itemIndex, bulletIndex) => {
  if (!section) throw new ReplaceFieldError('Section is required', 'INVALID_SECTION');

  if (section === 'summary') {
    return; // No index validation needed
  }

  if (section === 'experience') {
    if (itemIndex == null || bulletIndex == null) {
      throw new ReplaceFieldError('itemIndex and bulletIndex required for experience', 'MISSING_INDEX');
    }
    if (!resume.experience || !Array.isArray(resume.experience)) {
      throw new ReplaceFieldError('No experience section', 'INVALID_EXPERIENCE');
    }
    if (itemIndex < 0 || itemIndex >= resume.experience.length) {
      throw new ReplaceFieldError(`Experience index ${itemIndex} out of bounds (0-${resume.experience.length - 1})`, 'INDEX_OUT_OF_BOUNDS');
    }
    if (!resume.experience[itemIndex].bullets || !Array.isArray(resume.experience[itemIndex].bullets)) {
      throw new ReplaceFieldError(`No bullets in experience[${itemIndex}]`, 'INVALID_BULLETS');
    }
    if (bulletIndex < 0 || bulletIndex >= resume.experience[itemIndex].bullets.length) {
      throw new ReplaceFieldError(`Bullet index ${bulletIndex} out of bounds in experience[${itemIndex}]`, 'BULLET_INDEX_OUT_OF_BOUNDS');
    }
    return;
  }

  if (section === 'projects') {
    if (itemIndex == null || bulletIndex == null) {
      throw new ReplaceFieldError('itemIndex and bulletIndex required for projects', 'MISSING_INDEX');
    }
    if (!resume.projects || !Array.isArray(resume.projects)) {
      throw new ReplaceFieldError('No projects section', 'INVALID_PROJECTS');
    }
    if (itemIndex < 0 || itemIndex >= resume.projects.length) {
      throw new ReplaceFieldError(`Project index ${itemIndex} out of bounds (0-${resume.projects.length - 1})`, 'INDEX_OUT_OF_BOUNDS');
    }
    if (!resume.projects[itemIndex].bullets || !Array.isArray(resume.projects[itemIndex].bullets)) {
      throw new ReplaceFieldError(`No bullets in projects[${itemIndex}]`, 'INVALID_BULLETS');
    }
    if (bulletIndex < 0 || bulletIndex >= resume.projects[itemIndex].bullets.length) {
      throw new ReplaceFieldError(`Bullet index ${bulletIndex} out of bounds in projects[${itemIndex}]`, 'BULLET_INDEX_OUT_OF_BOUNDS');
    }
    return;
  }

  if (section === 'skills') {
    // Skills are flexible; create if needed
    return;
  }

  throw new ReplaceFieldError(`Unknown section: ${section}`, 'UNKNOWN_SECTION');
};

/**
 * Gets current field value
 */
const getFieldValue = (resume, section, itemIndex, bulletIndex) => {
  if (section === 'summary') {
    return resume.summary || '';
  }

  if (section === 'experience') {
    return resume.experience?.[itemIndex]?.bullets?.[bulletIndex] || '';
  }

  if (section === 'projects') {
    return resume.projects?.[itemIndex]?.bullets?.[bulletIndex] || '';
  }

  if (section === 'skills') {
    const catIdx = itemIndex ?? 0;
    if (!resume.skills?.[catIdx]?.items) return '';
    // For skills, we check if it exists
    return resume.skills[catIdx].items.includes(improvedText) ? improvedText : '';
  }

  return '';
};

/**
 * Detects if suggestion was already applied
 * Returns true if currentText no longer matches resume
 */
const isAlreadyApplied = (resume, section, itemIndex, bulletIndex, currentText) => {
  const actualValue = getFieldValue(resume, section, itemIndex, bulletIndex);
  
  // Normalize for comparison
  const normalizeCompare = (str) => String(str || '').trim().toLowerCase();
  
  return normalizeCompare(actualValue) !== normalizeCompare(currentText);
};

/**
 * Replaces field value safely
 * Handles exact replacement without prepending/appending
 */
const replaceField = (resume, section, itemIndex, bulletIndex, improvedText) => {
  validateResumeField(resume, section, itemIndex, bulletIndex);

  const finalText = String(improvedText || '').trim();

  if (!finalText) {
    throw new ReplaceFieldError('improvedText cannot be empty', 'EMPTY_TEXT');
  }

  if (section === 'summary') {
    resume.summary = finalText;
  } 
  else if (section === 'experience') {
    resume.experience[itemIndex].bullets[bulletIndex] = finalText;
    resume.markModified('experience');
  } 
  else if (section === 'projects') {
    resume.projects[itemIndex].bullets[bulletIndex] = finalText;
    resume.markModified('projects');
  } 
  else if (section === 'skills') {
    const catIdx = itemIndex ?? 0;
    
    // Initialize skills if missing
    if (!resume.skills || !Array.isArray(resume.skills)) {
      resume.skills = [];
    }

    // Create category if needed
    if (!resume.skills[catIdx]) {
      resume.skills[catIdx] = { 
        category: catIdx === 0 ? 'Technical Skills' : `Skills ${catIdx}`,
        items: [] 
      };
    }

    // Ensure items array exists
    if (!Array.isArray(resume.skills[catIdx].items)) {
      resume.skills[catIdx].items = [];
    }

    // Check for duplicate (case-insensitive)
    const normalizeSkill = (s) => String(s || '').trim().toLowerCase();
    const exists = resume.skills[catIdx].items.some(s => normalizeSkill(s) === normalizeSkill(finalText));

    if (!exists) {
      resume.skills[catIdx].items.push(finalText);
    }

    resume.markModified('skills');
  }
};

module.exports = {
  replaceField,
  validateResumeField,
  getFieldValue,
  isAlreadyApplied,
  ReplaceFieldError,
};
