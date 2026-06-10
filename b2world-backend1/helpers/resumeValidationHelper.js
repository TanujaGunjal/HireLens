/**
 * ================================================================================
 * RESUME VALIDATION UTILITY - PRODUCTION GRADE
 * ================================================================================
 * Validates resume structure, consistency, and readiness for evaluation
 * ================================================================================
 */

class ResumeValidationError extends Error {
  constructor(message, severity = 'error') {
    super(message);
    this.severity = severity;
  }
}

/**
 * Validates complete resume structure
 */
const validateResumeStructure = (resume) => {
  if (!resume) {
    throw new ResumeValidationError('Resume object is null or undefined', 'fatal');
  }

  if (!resume._id) {
    throw new ResumeValidationError('Resume missing _id', 'fatal');
  }

  // Optional: summary
  if (resume.summary && typeof resume.summary !== 'string') {
    throw new ResumeValidationError('Summary must be a string', 'error');
  }

  // Experience validation
  if (resume.experience) {
    if (!Array.isArray(resume.experience)) {
      throw new ResumeValidationError('Experience must be an array', 'error');
    }
    resume.experience.forEach((exp, idx) => {
      if (!exp.bullets || !Array.isArray(exp.bullets)) {
        throw new ResumeValidationError(`Experience[${idx}].bullets must be an array`, 'error');
      }
      exp.bullets.forEach((bullet, bidx) => {
        if (typeof bullet !== 'string') {
          throw new ResumeValidationError(`Experience[${idx}].bullets[${bidx}] must be a string`, 'error');
        }
      });
    });
  }

  // Projects validation
  if (resume.projects) {
    if (!Array.isArray(resume.projects)) {
      throw new ResumeValidationError('Projects must be an array', 'error');
    }
    resume.projects.forEach((proj, idx) => {
      if (!proj.bullets || !Array.isArray(proj.bullets)) {
        throw new ResumeValidationError(`Projects[${idx}].bullets must be an array`, 'error');
      }
      proj.bullets.forEach((bullet, bidx) => {
        if (typeof bullet !== 'string') {
          throw new ResumeValidationError(`Projects[${idx}].bullets[${bidx}] must be a string`, 'error');
        }
      });
    });
  }

  // Skills validation
  if (resume.skills) {
    if (!Array.isArray(resume.skills)) {
      throw new ResumeValidationError('Skills must be an array', 'error');
    }
    resume.skills.forEach((skillGroup, idx) => {
      if (!skillGroup.items || !Array.isArray(skillGroup.items)) {
        throw new ResumeValidationError(`Skills[${idx}].items must be an array`, 'error');
      }
      skillGroup.items.forEach((item, iidx) => {
        if (typeof item !== 'string') {
          throw new ResumeValidationError(`Skills[${idx}].items[${iidx}] must be a string`, 'error');
        }
      });
    });
  }
};

/**
 * Validates job description structure
 */
const validateJobDescription = (jd) => {
  if (!jd) {
    throw new ResumeValidationError('Job description is null or undefined', 'fatal');
  }

  if (!jd._id) {
    throw new ResumeValidationError('Job description missing _id', 'fatal');
  }

  if (!jd.title || typeof jd.title !== 'string') {
    throw new ResumeValidationError('Job description must have a title string', 'error');
  }

  if (jd.extractedKeywords && !Array.isArray(jd.extractedKeywords)) {
    throw new ResumeValidationError('extractedKeywords must be an array', 'error');
  }
};

/**
 * Validates suggestion object structure
 */
const validateSuggestion = (suggestion) => {
  if (!suggestion) {
    throw new ResumeValidationError('Suggestion is null or undefined', 'error');
  }

  const required = ['section', 'improvedText'];
  required.forEach(field => {
    if (!suggestion[field]) {
      throw new ResumeValidationError(`Suggestion missing required field: ${field}`, 'error');
    }
  });

  // Validate section-specific requirements
  if (suggestion.section === 'experience' || suggestion.section === 'projects') {
    if (suggestion.itemIndex == null || suggestion.bulletIndex == null) {
      throw new ResumeValidationError(`${suggestion.section} suggestion missing itemIndex or bulletIndex`, 'error');
    }
  }

  // Validate improvedText is not a placeholder
  const hasPlaceholder = /\(e\.g\.|example\||<[^>]+>|\[.+?\])/i.test(suggestion.improvedText);
  if (hasPlaceholder) {
    throw new ResumeValidationError(`Suggestion contains placeholder patterns: ${suggestion.improvedText}`, 'error');
  }
};

/**
 * Validates batch of suggestions
 */
const validateSuggestionBatch = (suggestions) => {
  if (!Array.isArray(suggestions)) {
    throw new ResumeValidationError('Suggestions must be an array', 'error');
  }

  suggestions.forEach((sug, idx) => {
    try {
      validateSuggestion(sug);
    } catch (err) {
      throw new ResumeValidationError(`Suggestion[${idx}]: ${err.message}`, err.severity);
    }
  });
};

/**
 * Validates consistency between resume and suggestion
 */
const validateSuggestionApplicability = (resume, suggestion) => {
  const { section, itemIndex, bulletIndex, currentText } = suggestion;

  // Get current value
  let currentValue = '';
  
  if (section === 'summary') {
    currentValue = resume.summary || '';
  } else if (section === 'experience' && itemIndex != null && bulletIndex != null) {
    currentValue = resume.experience?.[itemIndex]?.bullets?.[bulletIndex] || '';
  } else if (section === 'projects' && itemIndex != null && bulletIndex != null) {
    currentValue = resume.projects?.[itemIndex]?.bullets?.[bulletIndex] || '';
  } else if (section === 'skills') {
    // For skills, we only care that it doesn't already exist
    return true;
  }

  // Normalize comparison
  const normalize = (str) => String(str || '').trim().toLowerCase();

  const currentNorm = normalize(currentValue);
  const expectedNorm = normalize(currentText);

  // If currentText doesn't match actual, suggestion was already applied
  if (expectedNorm && currentNorm !== expectedNorm) {
    return false; // Already applied
  }

  return true;
};

/**
 * Validates complete apply operation
 */
const validateApplyOperation = (resume, jd, suggestion) => {
  validateResumeStructure(resume);
  validateJobDescription(jd);
  validateSuggestion(suggestion);
  const isApplicable = validateSuggestionApplicability(resume, suggestion);
  
  return {
    isValid: true,
    isApplicable,
    errorMessage: isApplicable ? null : 'Suggestion appears to have been applied already',
  };
};

module.exports = {
  validateResumeStructure,
  validateJobDescription,
  validateSuggestion,
  validateSuggestionBatch,
  validateSuggestionApplicability,
  validateApplyOperation,
  ResumeValidationError,
};
