/**
 * resumeHelpers.js — Shared utility functions for resume validation
 * 
 * Contains reusable functions for checking resume completeness
 * and validating resume sections.
 */

/**
 * Robustly checks if resume has valid achievements.
 * 
 * Handles:
 * - undefined achievements
 * - empty array
 * - empty strings
 * - whitespace-only entries
 * - array of strings: ["achievement1", "achievement2"]
 * - array of objects: [{title: "Award", description: "Details"}]
 * 
 * @param {object} resume - The resume object
 * @returns {boolean} - true if achievements exist with at least one non-empty item
 */
function hasValidAchievements(resume) {
  if (!resume?.achievements) return false;
  if (!Array.isArray(resume.achievements)) return false;

  return resume.achievements.some((item) => {
    if (typeof item === "string") {
      return item.trim().length > 0;
    }
    if (typeof item === "object" && item !== null) {
      return Object.values(item).some(
        (val) => typeof val === "string" && val.trim().length > 0
      );
    }
    return false;
  });
}

/**
 * Extracts achievement text from various formats.
 * 
 * @param {string|object} item - Achievement item (string or object)
 * @returns {string|null} - The achievement text or null if invalid
 */
function getAchievementText(item) {
  if (typeof item === "string") {
    return item.trim().length > 0 ? item.trim() : null;
  }
  if (typeof item === "object" && item !== null) {
    const text = Object.values(item).find(
      (v) => typeof v === "string" && v.trim().length > 0
    );
    return text ? text.trim() : null;
  }
  return null;
}

module.exports = {
  hasValidAchievements,
  getAchievementText,
};
