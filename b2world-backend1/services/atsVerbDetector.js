/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS ACTION VERB DETECTOR
 * 
 * Detects and scores action verbs in resume text
 * Action verbs indicate accomplishments and impact
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const ACTION_VERBS = [
  "developed","built","designed","implemented",
  "optimized","engineered","integrated","created"
];

function getActionVerbScore(text) {
  if (!text) return 0;

  text = text.toLowerCase();

  let count = 0;

  ACTION_VERBS.forEach(verb => {
    if (text.includes(verb)) count++;
  });

  return Math.min((count / 5) * 100, 100);
}

// Facade for backward compatibility
function detectActionVerbsInResume(resume) {
  return {
    totalActionVerbs: 0,
    totalBullets: 0,
    percentageWithActionVerbs: 100,
    bulletsWithVerbs: 0,
    bulletsBySection: {},
    detectedVerbs: [],
    score: 0,
    details: []
  };
}

module.exports = {
  getActionVerbScore,
  detectActionVerbsInResume
};
