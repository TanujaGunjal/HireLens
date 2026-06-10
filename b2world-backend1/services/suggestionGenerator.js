'use strict';

/**
 * Production Suggestion Generator
 * Uses evaluateResume() as single source of truth
 * Generates properly structured suggestions with autoApplicable flag
 */

const { evaluateResume, getAllBullets } = require('./evaluateResume');
const { rewriteBullet, integrateKeywordInBullet } = require('../utils/bulletRewriter');
const { normalizeText } = require('../utils/keywordNormalizer');

let suggestionIdCounter = 0;
const generateSuggestionId = (type, section, index) => {
  return `sugg-${++suggestionIdCounter}-${type}-${section}-${index}-${Date.now()}`;
};

/**
 * Generate suggestions from evaluation result
 * All suggestions must have consistent structure
 */
const generateSuggestions = (resume, jobDescription) => {
  const evaluation = evaluateResume(resume, jobDescription);
  const suggestions = [];

  // ────────────────────────────────────────────────────────────
  // 1: ACTION VERB SUGGESTIONS (Auto-applicable)
  // ────────────────────────────────────────────────────────────
  
  evaluation.detectedWeakBullets.forEach(weakBullet => {
    const improved = rewriteBullet(weakBullet.text);
    
    // Only suggest if rewriting actually changes something
    if (improved && improved !== weakBullet.text) {
      suggestions.push({
        id: generateSuggestionId('verb', weakBullet.section, weakBullet.bulletIndex),
        type: 'verb',
        category: 'action-verb',
        section: weakBullet.section,
        itemIndex: weakBullet.itemIndex,
        bulletIndex: weakBullet.bulletIndex,
        autoApplicable: true,  // ✅ CRITICAL: This can be auto-applied
        currentText: weakBullet.text,
        improvedText: improved,
        impactLevel: 'high',
        reason: 'Bullet starts with weak starter; can be strengthened',
        suggestion: `Replace "${weakBullet.text.substring(0, 40)}" with "${improved.substring(0, 40)}"`,
        confidenceScore: 0.85
      });
    }
  });

  // ────────────────────────────────────────────────────────────
  // 2: METRICS SUGGESTIONS (Manual - requires user input)
  // ────────────────────────────────────────────────────────────
  
  evaluation.detectedMetricsGaps.forEach(metricGap => {
    suggestions.push({
      id: generateSuggestionId('metrics', metricGap.section, metricGap.bulletIndex),
      type: 'metrics',
      category: 'measurable-impact',
      section: metricGap.section,
      itemIndex: metricGap.itemIndex,
      bulletIndex: metricGap.bulletIndex,
      autoApplicable: false,  // ❌ CRITICAL: User must manually add metrics
      currentText: metricGap.text,
      improvedText: null,  // User will provide this
      impactLevel: 'high',
      reason: 'Bullet lacks quantifiable metrics; suggest user adds them',
      suggestion: `Add measurable impact to "${metricGap.text.substring(0, 40)}"`,
      exampleTemplate: 'Consider adding: "...resulting in X% improvement" or "...achieving Y million impact"',
      confidenceScore: 0.90
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3: KEYWORD INTEGRATION SUGGESTIONS (Smart - integrates into bullets)
  // ────────────────────────────────────────────────────────────
  
  // Get all bullets from experience and projects
  const allBullets = getAllBullets(resume);
  const topMissingKeywords = evaluation.missingKeywords.slice(0, 8);
  
  topMissingKeywords.forEach((keyword, idx) => {
    let bestIntegration = null;
    let bestBulletIndex = -1;
    
    // Try to integrate keyword into existing experience bullets
    for (let i = 0; i < allBullets.length; i++) {
      const bullet = allBullets[i];
      const integration = integrateKeywordInBullet(bullet.text, keyword);
      
      // If successfully integrated, save this as a candidate
      if (integration.integrated && integration.confidence !== 'low') {
        bestIntegration = integration;
        bestBulletIndex = i;
        break; // Take the first good match
      }
    }
    
    // Create suggestion based on integration result
    if (bestIntegration && bestIntegration.integrated) {
      // High-quality integration suggestion
      suggestions.push({
        id: generateSuggestionId('keyword-integration', 'experience', bestBulletIndex),
        type: 'keyword-integration',
        category: 'keyword-integration',
        section: allBullets[bestBulletIndex]?.section || 'experience',
        itemIndex: allBullets[bestBulletIndex]?.itemIndex || 0,
        bulletIndex: allBullets[bestBulletIndex]?.bulletIndex || 0,
        autoApplicable: bestIntegration.confidence === 'high',
        currentText: bestIntegration.original,
        improvedText: bestIntegration.improved,
        impactLevel: idx < 3 ? 'high' : 'medium',
        reason: `Integrate missing keyword "${keyword}" naturally into experience bullet`,
        suggestion: `Enhance bullet: "${bestIntegration.original.substring(0, 45)}..." with "${keyword}"`,
        confidenceScore: bestIntegration.confidence === 'high' ? 0.85 : 0.70
      });
    } else {
      // Fallback: simple keyword suggestion for skills section
      suggestions.push({
        id: generateSuggestionId('keyword', 'skills', idx),
        type: 'keyword',
        category: 'missing-keyword',
        section: 'skills',
        itemIndex: null,
        bulletIndex: null,
        autoApplicable: false,
        currentText: null,
        improvedText: keyword,
        impactLevel: idx < 3 ? 'high' : 'medium',
        reason: `Missing keyword from job description: "${keyword}"`,
        suggestion: `Add "${keyword}" to your skills section`,
        confidenceScore: 0.95
      });
    }
  });

  // ────────────────────────────────────────────────────────────
  // 4: SECTION COMPLETENESS SUGGESTIONS (Manual - requires content)
  // ────────────────────────────────────────────────────────────
  
  evaluation.improvementAreas.forEach(area => {
    if (area.category === 'Completeness') {
      area.actionItems.forEach((actionItem, idx) => {
        suggestions.push({
          id: generateSuggestionId('section', 'structure', idx),
          type: 'section',
          category: 'incomplete-section',
          section: deriveSectionFromAction(actionItem),
          itemIndex: null,
          bulletIndex: null,
          autoApplicable: false,  // ❌ CRITICAL: User must write content
          currentText: null,
          improvedText: null,
          impactLevel: 'medium',
          reason: `Section incomplete or missing: ${actionItem}`,
          suggestion: `Enhance: ${actionItem}`,
          confidenceScore: 0.80
        });
      });
    }
  });

  return suggestions;
};

/**
 * Derive section name from action description
 */
const deriveSectionFromAction = (action) => {
  if (action.includes('Summary')) return 'summary';
  if (action.includes('Experience')) return 'experience';
  if (action.includes('Skills')) return 'skills';
  if (action.includes('Certifications')) return 'certifications';
  return 'summary';
};

/**
 * Get human-readable feedback based on evaluation
 * MUST align with actual scores
 */
const generateFeedback = (evaluation) => {
  const { scores, bulletStats, improvementAreas } = evaluation;

  const feedback = {
    overallMessage: `Your resume scores ${scores.total}/100.`,
    strengthMessage: null,
    improvementMessage: null,
    nextSteps: []
  };

  // ─ Strengths
  if (scores.keyword >= 80) {
    feedback.strengthMessage = `Strong keyword alignment (${scores.keyword}%) - your resume matches key terms in the job description.`;
  } else if (scores.keyword >= 60) {
    feedback.strengthMessage = `Good keyword coverage (${scores.keyword}%).`;
  }

  if (scores.actionVerbs >= 80) {
    feedback.strengthMessage = (feedback.strengthMessage || '') + ` Most bullets (${bulletStats.strong}/${bulletStats.strong + bulletStats.weak}) start with strong action verbs.`;
  }

  // ─ Improvements needed (MUST match improvementAreas)
  if (scores.keyword < 60) {
    feedback.improvementMessage = `Add ${evaluation.missingKeywords.length} key terms from the job description.`;
    feedback.nextSteps.push('Include missing keywords: ' + evaluation.missingKeywords.slice(0, 3).join(', '));
  }

  if (scores.actionVerbs < 75) {
    feedback.improvementMessage = (feedback.improvementMessage || '') + ` Strengthen ${bulletStats.weak} bullets with better action verbs.`;
    feedback.nextSteps.push(`Replace weak starters in ${bulletStats.weak} bullets`);
  }

  if (bulletStats.needMetrics > bulletStats.strong * 0.4) {
    feedback.improvementMessage = (feedback.improvementMessage || '') + ` Add metrics to ${bulletStats.needMetrics} bullets.`;
    feedback.nextSteps.push(`Quantify impact in ${bulletStats.needMetrics} bullets`);
  }

  if (!feedback.strengthMessage) {
    feedback.strengthMessage = `Resume is ${scores.total >= 75 ? 'strong' : scores.total >= 60 ? 'adequate' : 'needs improvement'}.`;
  }

  return feedback;
};

module.exports = {
  generateSuggestions,
  generateFeedback,
};
