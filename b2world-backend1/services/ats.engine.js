/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS SCORING ENGINE — MAIN ENTRY POINT
 * 
 * Production-quality ATS resume scoring system that works for ANY resume domain
 * Deterministic, modular, and grammar-aware
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { calculateATSScore, buildSearchableResumeText } = require('./atsScoreCalculator');
const { extractJDKeywords, matchKeywords } = require('./atsKeywordExtractor');
const { detectActionVerbsInResume } = require('./atsVerbDetector');
const { generateSuggestions, generateImprovedBullet, detectDomain } = require('./atsSuggestionGenerator');
const { normalizeText } = require('./atsTextProcessor');

/**
 * Main ATS Scoring Engine
 * 
 * Usage:
 * ```
 * const atsEngine = require('./atsEngine');
 * const score = atsEngine.scoreResume(resume, jobDescription);
 * console.log(score.score, score.breakdown, score.suggestions);
 * ```
 */

class ATSEngine {
  /**
   * Scores a resume against a job description
   * Main entry point for ATS scoring
   * 
   * @param {Object} resume - Resume object
   * @param {Object} jobDescription - Job description details
   * @returns {Object} - Complete scoring results
   */
  static scoreResume(resume, jobDescription) {
    return calculateATSScore(resume, jobDescription);
  }

  /**
   * Extracts keywords from job description
   * Useful for understanding what JD is looking for
   * 
   * @param {string} jdText - Job description text
   * @returns {string[]} - Extracted keywords
   */
  static extractKeywords(jdText) {
    return extractJDKeywords(jdText);
  }

  /**
   * Matches resume keywords against JD keywords
   * Shows which keywords are present/missing
   * 
   * @param {string} resumeText - Resume text
   * @param {string[]} jdKeywords - Keywords from JD
   * @returns {Object} - Matching results
   */
  static matchKeywords(resumeText, jdKeywords) {
    return matchKeywords(resumeText, jdKeywords);
  }

  /**
   * Analyzes action verbs in resume
   * Detects strong action verbs throughout resume
   * 
   * @param {Object} resume - Resume object
   * @returns {Object} - Action verb analysis
   */
  static analyzeActionVerbs(resume) {
    return detectActionVerbsInResume(resume);
  }

  /**
   * Generates improvement suggestions for resume
   * Based on domain and missing keywords
   * 
   * @param {Object} resume - Resume object
   * @param {string[]} missingKeywords - Keywords to suggest adding
   * @returns {Object[]} - Array of improvement suggestions
   */
  static generateSuggestions(resume, missingKeywords) {
    const domain = detectDomain(resume);
    return generateSuggestions(resume, missingKeywords, domain);
  }

  /**
   * Generates a single improved bullet point
   * Useful for suggesting specific improvements
   * 
   * @param {Object} options - Generation options
   * @param {string} options.keyword - Technology/concept to highlight
   * @param {string} options.context - Additional context
   * @param {string} options.domain - Resume domain/role
   * @param {string} options.originalBullet - Original bullet (optional)
   * @returns {string} - Improved bullet point
   */
  static generateBullet(options) {
    return generateImprovedBullet(options);
  }

  /**
   * Detects the domain/role of a resume
   * Used for domain-specific suggestions and templates
   * 
   * @param {Object} resume - Resume object
   * @returns {string} - Domain identifier
   */
  static detectDomain(resume) {
    return detectDomain(resume);
  }

  /**
   * Recalculates score after applying a fix
   * Returns improvement metrics
   * 
   * @param {Object} originalResume - Resume before fix
   * @param {Object} updatedResume - Resume after fix
   * @param {Object} jobDescription - Job description
   * @returns {Object} - Score improvement result
   */
  static recalculateScoreAfterFix(originalResume, updatedResume, jobDescription) {
    const originalScore = calculateATSScore(originalResume, jobDescription);
    const newScore = calculateATSScore(updatedResume, jobDescription);
    
    return {
      previousScore: originalScore.score,
      newScore: newScore.score,
      improvement: newScore.score - originalScore.score,
      improvementPercentage: ((newScore.score - originalScore.score) / originalScore.score * 100).toFixed(2),
      previousBreakdown: originalScore.breakdown,
      newBreakdown: newScore.breakdown,
      changes: {
        keywordMatch: newScore.breakdown.keywordMatch - originalScore.breakdown.keywordMatch,
        sectionCompleteness: newScore.breakdown.sectionCompleteness - originalScore.breakdown.sectionCompleteness,
        formatting: newScore.breakdown.formatting - originalScore.breakdown.formatting,
        actionVerbs: newScore.breakdown.actionVerbs - originalScore.breakdown.actionVerbs,
        readability: newScore.breakdown.readability - originalScore.breakdown.readability
      }
    };
  }

  /**
   * Batch scores multiple resumes against multiple job descriptions
   * Useful for screening large resume pools
   * 
   * @param {Object[]} resumes - Array of resume objects
   * @param {Object[]} jobDescriptions - Array of job description objects
   * @returns {Object} - Batch scoring results
   */
  static batchScore(resumes, jobDescriptions) {
    return {
      results: resumes.map(resume => 
        jobDescriptions.map(jd => ({
          result: calculateATSScore(resume, jd),
          jobId: jd.id,
          resumeId: resume.id
        }))
      ),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gets recommendations for improving a resume
   * Combines keyword analysis, verb analysis, and structural checks
   * 
   * @param {Object} resume - Resume object
   * @param {Object} jobDescription - Job description
   * @returns {Object} - Detailed recommendations
   */
  static getRecommendations(resume, jobDescription) {
    const score = calculateATSScore(resume, jobDescription);
    const domain = detectDomain(resume);
    const actionVerbAnalysis = detectActionVerbsInResume(resume);
    
    const recommendations = [];
    
    // Keyword recommendations
    if (score.keywords.matchPercentage < 70) {
      const topMissing = score.keywords.missing.slice(0, 3);
      recommendations.push({
        category: 'keywords',
        priority: 'high',
        issue: 'Missing critical keywords from job description',
        missing: topMissing,
        action: `Add these keywords to your experience: ${topMissing.join(', ')}`
      });
    }
    
    // Action verb recommendations
    if (actionVerbAnalysis.percentageWithActionVerbs < 70) {
      recommendations.push({
        category: 'action_verbs',
        priority: 'high',
        issue: 'Many bullets lack strong action verbs',
        percentage: actionVerbAnalysis.percentageWithActionVerbs,
        bulletsNeedingImprovement: actionVerbAnalysis.totalBullets - actionVerbAnalysis.bulletsWithVerbs,
        action: 'Replace weak verbs like "helped", "managed", "worked" with stronger alternatives like "developed", "architected", "engineered"'
      });
    }
    
    // Structure recommendations
    const completeness = score.details.completenessAnalysis.details;
    if (!completeness.summary || completeness.summary === 0) {
      recommendations.push({
        category: 'structure',
        priority: 'medium',
        issue: 'Professional summary is missing or too short',
        action: 'Add a 2-3 sentence professional summary highlighting your key skills and achievements'
      });
    }
    
    // Formatting recommendations
    if (score.breakdown.formatting < 80) {
      recommendations.push({
        category: 'formatting',
        priority: 'low',
        issue: 'Resume formatting could be improved',
        action: 'Ensure consistent date format, proper bullet points, and professional spacing'
      });
    }
    
    return {
      overallScore: score.score,
      domain,
      recommendations: recommendations.sort((a, b) => {
        const priorityMap = { high: 1, medium: 2, low: 3 };
        return priorityMap[a.priority] - priorityMap[b.priority];
      })
    };
  }
}

/**
 * Export individual functions for modular use
 */
module.exports = {
  // Main class
  ATSEngine,
  
  // Core functions
  scoreResume: ATSEngine.scoreResume,
  extractKeywords: ATSEngine.extractKeywords,
  matchKeywords: ATSEngine.matchKeywords,
  analyzeActionVerbs: ATSEngine.analyzeActionVerbs,
  generateSuggestions: ATSEngine.generateSuggestions,
  generateBullet: ATSEngine.generateBullet,
  detectDomain: ATSEngine.detectDomain,
  recalculateScoreAfterFix: ATSEngine.recalculateScoreAfterFix,
  batchScore: ATSEngine.batchScore,
  getRecommendations: ATSEngine.getRecommendations,
  
  // Utilities
  buildSearchableResumeText,
  normalizeText,
  calculateATSScore
};
