/**
 * atsController.js — Production-Grade ATS Controller
 *
 * PRODUCTION FIXES:
 * 1. calculateATSScore: uses atsService (single source of truth for scoring)
 * 2. applySuggestion: fixed section handlers, clean text, proper markModified
 * 3. achievements section: now BLOCKS apply (advisory only) — returns 400
 * 4. skills section: proper duplicate detection, markModified
 * 5. ATS recalculation after apply: uses same atsService for consistency
 * 6. Suggestions merged and deduplicated correctly after apply
 * 7. Debounce uses in-memory Map (not global[])
 * 8. No system-hint text leaking into resume content
 * 9. Proper MongoDB transaction + session handling
 * 10. Idempotent: applying same fix twice yields same result
 */

'use strict';

const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const ATSReport = require('../models/ATSReport');
const atsService = require('../services/atsService');
const ATSEngineAdapter = require('../services/atsEngineAdapter');
const SuggestionRuleEngine = require('../services/suggestionRuleEngine');
const { normalizeSuggestions } = require('../utils/suggestionNormalizer');
const { enrichSuggestionsWithAutoApplicable } = require('../utils/suggestionEngine');
const { buildSmartKeywordSuggestions, generateSmartSuggestion } = require('../utils/skillGapAnalyzer');
const { buildSearchableResumeText } = require('../services/atsScoreCalculator');
const { analyzeResume } = require('../services/analysisEngine');
const semanticService = require('../services/semantic.service');
const { rewriteResume, scoreRewriteImpact, generateExperienceFromProjects } = require('../services/rewrite.service');
const KeywordLibrary = require('../models/KeywordLibrary');
const cacheService   = require('../services/cache.service');
const cacheHelper    = require('../utils/cacheHelper');

// Intelligence Engine Services
const { generateActionPlan, extractHiringSignals } = require('../services/actionPlan.service');

function extractSkillsFromText(text) {
  const SKILL_KEYWORDS = [
    "react", "node", "express", "mongodb", "mysql",
    "jwt", "api", "rest", "docker", "aws",
    "system design", "redis", "kafka", "typescript"
  ];

  const found = new Set();
  const lower = text ? text.toLowerCase() : "";

  SKILL_KEYWORDS.forEach(skill => {
    if (lower.includes(skill)) {
      found.add(skill);
    }
  });

  return Array.from(found);
}

function generateSemanticReasons(resume, jd) {
  const reasons = [];

  if (!resume.experience || resume.experience.length === 0) {
    reasons.push("No real-world experience detected; JD expects production-level exposure.");
  }

  if (resume.projects?.length > 0 && (!resume.experience || resume.experience.length === 0)) {
    reasons.push("Projects present but lack production deployment or team collaboration context.");
  }

  if (resume.summary && !resume.summary.toLowerCase().includes("scalable")) {
    reasons.push("Resume summary lacks alignment with scalable system requirements in JD.");
  }

  if (resume.skills?.length < 5) {
    reasons.push("Insufficient skills detected compared to JD expectations.");
  }

  return reasons;
}

// ──────────────────────────── DEBOUNCE MAP ────────────────────────────
// In-memory debounce map for preventing double-click races
const _debounceMap = new Map();
const DEBOUNCE_TTL_MS = 2000;

const checkDebounce = (key) => {
  const lastTime = _debounceMap.get(key);
  if (lastTime && Date.now() - lastTime < DEBOUNCE_TTL_MS) return true;
  _debounceMap.set(key, Date.now());
  // Auto-cleanup after TTL
  setTimeout(() => _debounceMap.delete(key), DEBOUNCE_TTL_MS + 100);
  return false;
};

// Safety filter for suggestion types - matches ATSReport schema enum
// NOTE: 'bullet', 'verb', 'impact', 'section' added to prevent silent drops
const VALID_SUGGESTION_TYPES = new Set([
  'keyword', 'experience', 'skills', 'projects', 'education', 'certifications',
  'summary', 'formatting', 'readability', 'missing_keyword', 'content',
  'grammar', 'structure', 'weak_verb', 'weak_bullet', 'missing_metrics', 'suggestion',
  'bullet', 'verb', 'impact', 'section'
]);

const filterValidSuggestions = (suggestions) => {
  const filtered = suggestions.filter(s => VALID_SUGGESTION_TYPES.has(s.type));
  if (filtered.length < suggestions.length) {
    console.warn(`⚠️ Filtered ${suggestions.length - filtered.length} suggestions with invalid types`);
  }
  return filtered;
};


// ──────────────────────────── TEXT HELPERS ────────────────────────────

/**
 * Remove system-hint suffixes that should NOT appear in the resume.
 * Examples to strip:
 *   "...  — consider adding measurable impact..."
 *   "... - consider adding..."
 *   "(e.g., something)..."
 *   "Currently 5, target 10+"
 *   "improve by X%", "add XXX", "include XXX", etc.
 */
const cleanImprovedText = (text = '') => {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/\s*[—–\-]\s*(consider\s+adding|add\s+measurable|quantify\s+your|add\s+[\w\s]*?impact|add\s+[\w\s]*?outcome).*$/i, '')
    .replace(/\s*\(e\.g\.,?[^)]*\)\s*\.?$/i, '')
    .replace(/\s*[—–\-]\s*quantify.*$/i, '')
    .replace(/,?\s*currently\s+\d+,?\s*target\s+\d+\+?\.?$/i, '')
    .replace(/\s*—\s*[a-z].*$/i, '')
    .replace(/"\s*$/, '')
    .trim();
};

/** Parse skill names from a suggestion text */
const parseSkills = (text = '') => {
  // Extract quoted skills first
  const quoted = [...String(text).matchAll(/"([^"]+)"/g)].map(m => m[1].trim()).filter(Boolean);
  if (quoted.length > 0) return quoted;

  return String(text)
    .replace(/^add\s+/i, '')
    .split(/,|\||;|\band\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 60);
};

/** Repair bullet with consecutive strong verbs: keep only more specific verb */
const ALL_STRONG_VERBS = new Set([
  'achieved', 'analyzed', 'architected', 'automated', 'built', 'collaborated',
  'configured', 'contributed', 'coordinated', 'created', 'debugged', 'delivered',
  'deployed', 'designed', 'developed', 'diagnosed', 'directed', 'documented',
  'drove', 'enhanced', 'established', 'executed', 'facilitated', 'generated',
  'identified', 'implemented', 'improved', 'increased', 'integrated', 'launched',
  'led', 'leveraged', 'maintained', 'managed', 'mentored', 'migrated', 'monitored',
  'optimized', 'orchestrated', 'owned', 'reduced', 'refactored', 'resolved',
  'scaled', 'secured', 'shipped', 'spearheaded', 'streamlined', 'tested',
  'trained', 'transformed', 'upgraded', 'validated', 'wrote'
]);

const repairDoubleVerb = (text = '') => {
  if (!text || typeof text !== 'string') return text;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return text;
  const first = words[0].toLowerCase();
  const second = words[1].toLowerCase();
  // "Developed deployed..." → "Deployed..."
  if (ALL_STRONG_VERBS.has(first) && ALL_STRONG_VERBS.has(second)) {
    const repaired = words.slice(1).join(' ');
    return repaired.charAt(0).toUpperCase() + repaired.slice(1);
  }
  return text;
};

// OLD FUNCTION (to be replaced)
const _OLD_repairDoubleVerb = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return bullet;

  const strongVerbs = ['achieved', 'analyzed', 'architected', 'automated', 'built', 'collaborated',
    'configured', 'contributed', 'coordinated', 'created', 'debugged', 'delivered', 'deployed',
    'designed', 'developed', 'diagnosed', 'directed', 'documented', 'drove', 'enhanced',
    'established', 'executed', 'facilitated', 'generated', 'identified', 'implemented',
    'improved', 'increased', 'integrated', 'launched', 'led', 'leveraged', 'maintained',
    'managed', 'mentored', 'migrated', 'monitored', 'optimized', 'orchestrated', 'owned',
    'planned', 'presented', 'reduced', 'refactored', 'resolved', 'scaled', 'secured',
    'shipped', 'spearheaded', 'standardized', 'streamlined', 'supported', 'tested',
    'trained', 'transformed', 'upgraded', 'validated', 'wrote'
  ];

  const words = bullet.split(/\s+/);
  if (words.length < 3) return bullet; // Need at least "verb something verb"

  // Find consecutive verbs
  let repaired = [];
  let lastVerbIdx = -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^a-z]/g, '');
    const isVerb = strongVerbs.includes(word);

    if (isVerb) {
      if (lastVerbIdx >= 0 && i - lastVerbIdx <= 2) {
        // Consecutive verbs found — skip the second one (less specific)
        continue;
      }
      lastVerbIdx = i;
      repaired.push(words[i]);
    } else {
      repaired.push(words[i]);
    }
  }

  const result = repaired.join(' ').trim();
  return result || bullet; // Fallback if something goes wrong
};

// ──────────────────────────── SCORE MAPPING ────────────────────────────

/**
 * Convert atsService breakdown (flat) → ATSReport storage format (nested)
 */
const toStorageBreakdown = (breakdown, scoringMode) => {
  const isJobSpecific = scoringMode === 'job-specific';
  return {
    keywordMatchScore: {
      score: isJobSpecific ? (breakdown.keywordMatch || 0) : 0,
      weight: isJobSpecific ? 40 : 0,
      details: {}
    },
    sectionCompletenessScore: {
      // ✅ FIXED: Use sectionCompleteness (not completeness) - matches engine output
      score: breakdown.sectionCompleteness || breakdown.completeness || 0,
      weight: isJobSpecific ? 20 : 30,
      details: {}
    },
    formattingScore: {
      score: breakdown.formatting || 0,
      weight: isJobSpecific ? 20 : 30,
      details: {}
    },
    actionVerbScore: {
      score: breakdown.actionVerbs || 0,
      weight: isJobSpecific ? 10 : 20,
      details: {}
    },
    readabilityScore: {
      score: breakdown.readability || 0,
      weight: isJobSpecific ? 10 : 20,
      details: {}
    }
  };
};

/** Convert keyword list to plain strings */
const toKeywordStrings = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map(kw => (typeof kw === 'string' ? kw : kw?.keyword || '').trim())
    .filter(Boolean);

// ──────────────────────────── CALCULATE ATS SCORE ────────────────────────────

const calculateATSScore = async (req, res) => {
  // SAFETY: Ensure response headers are set to JSON
  res.setHeader('Content-Type', 'application/json');
  
  let resumeId; // Define in outer scope so catch block can access it
  
  try {
    resumeId = req.body?.resumeId;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'Resume ID is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID format' });
    }

    // Fetch resume with ownership check
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }

    // ── Redis Cache Check ─────────────────────────────────────────────────
    // Cache key incorporates both resumeId and jdId so score updates when JD changes
    const jdIdForKey = resume.jdId ? String(resume.jdId) : 'no-jd';
    const atsCacheKey = `ats:${String(resumeId)}:${jdIdForKey}`;

    if (resume.jdId && cacheService.isRedisConnected()) {
      const cached = await cacheService.get(atsCacheKey);
      if (cached) {
        console.log(`[ATS] CACHE HIT  - ${atsCacheKey}`);
        return res.status(200).json(cached);
      }
      console.log(`[ATS] CACHE MISS - ${atsCacheKey}`);
    }
    // ─────────────────────────────────────────────────────────────────────

    const resumeText = JSON.stringify(resume);
    const extracted = extractSkillsFromText(resumeText);
    
    if (extracted.length > 0) {
      resume.skills = [
        ...(resume.skills || []),
        { category: 'Auto-Extracted', items: extracted }
      ];
    }

    console.log("✅ ATS SCORE: Resume found, jdId:", resume.jdId);

    // Check if JD is linked
    if (!resume.jdId) {
      console.log("⚠️ ATS SCORE: No JD linked to resume");
      return res.status(200).json({
        success: true,
        data: {
          totalScore: null,
          scoringMode: 'no-jd',
          message: 'Paste a Job Description to calculate ATS Score.',
          breakdown: {},
          missingKeywords: [],
          missingSections: [],
          suggestions: [],
          overallFeedback: { strengths: [], weaknesses: [], recommendations: [] }
        }
      });
    }

    // Fetch JD with ownership check
    const jd = await JobDescription.findOne({ _id: resume.jdId, userId: req.user._id });
    if (!jd) {
      console.error('🔥 ATS SCORE: JD not found for jdId:', resume.jdId);
      return res.status(404).json({ success: false, message: 'Job description not found' });
    }

    const analysis = analyzeResume(resume, jd);

    if (!analysis.valid) {
      return res.status(400).json({
        success: false,
        message: "JD could not be analyzed. Please add valid keywords."
      });
    }

    // Calculate score using production-grade ATS Engine via adapter
    const scoreResult = ATSEngineAdapter.scoreResume(resume, jd);
    let keywordScore = Math.round(scoreResult.score || 0);
    
    // ── Unified Skill Gap Analysis ────────────────────────────────────────
    const missing = analysis.missingSkills.map(s => typeof s === 'string' ? s : s.keyword);
    const present = analysis.matchedSkills.map(s => typeof s === 'string' ? s : s.keyword);
    
    // Legacy shape for backward compatibility
    const skillGap = { present, missing };
    
    const jdText = jd.jdText || jd.text || jd.description || '';

    // Pass the full resume object so the semantic service can split it into
    // summary / skills / experience / projects sections for better scoring.
    const semanticScore = await semanticService.getSemanticScore(resume.toObject ? resume.toObject() : resume, jdText);

    // Compute JS-side concept boost for logging (Python engine already includes this)
    const resumeFullText = buildSearchableResumeText(resume);
    const conceptBoostJS = semanticService.computeConceptBoost(resumeFullText, jdText);

    // Get JD keywords arrays safely
    const keywordArray = jd.extractedKeywords ? jd.extractedKeywords.map(k => k.keyword) : missing.concat(present);
    const resumeSkillsArray = (resume.skills || []).flatMap(s => s.items || []);
    const semanticMatches = await semanticService.getSkillSemanticMatches(resumeSkillsArray, keywordArray);

    const completenessScore = scoreResult.breakdown?.sectionCompleteness || 0;
    const formattingScore   = scoreResult.breakdown?.formatting          || 0;
    const actionScore       = scoreResult.breakdown?.actionVerbs         || 0;

    const hasExp = Array.isArray(resume.experience) && resume.experience.length > 0;
    const cw = hasExp ? 0.20 : 0.15;
    const fw = hasExp ? 0.05 : 0.10;

    const finalScore = Math.round(
      keywordScore      * 0.35 +
      semanticScore     * 0.35 +
      completenessScore * cw +
      formattingScore   * fw +
      actionScore       * 0.05
    );

    // Structured score log (single line, easy to grep)
    console.log(
      `[ATS] score=kw:${keywordScore} sem:${semanticScore} comp:${completenessScore} fmt:${formattingScore} act:${actionScore} => final:${finalScore}`
    );

    scoreResult.score = finalScore;

    const reasons    = generateSemanticReasons(resume, jd);
    const nextSteps  = [];
    if (missing.length > 0)  nextSteps.push(`Add "${missing[0]}" to your skills section`);
    if (semanticScore < 60)  nextSteps.push('Rewrite your summary to target JD themes directly');
    if (keywordScore < 60)   nextSteps.push('Quantify experience bullets using the XYZ metric format');

    const matchPercentage   = Math.round(scoreResult.score || 0);
    const engineSuggestions = scoreResult.suggestions || [];

    // ── Smart Keyword Suggestions (replace generic ones for missing keywords) ──
    // Upgrade existing generic keyword suggestions using the smart contextual templates.
    const enhancedEngineSuggestions = engineSuggestions.map(s => {
      if (s.type === 'keyword' && s.keyword) {
        const smartText = generateSmartSuggestion(s.keyword);
        return {
          ...s,
          message: `Add ${s.keyword} experience: ${smartText}`,
          reason: `Missing keyword: ${s.keyword}`,
          improvedText: smartText,
        };
      }
      return s;
    });

    // Build smart suggestions for any missing keywords that the engine didn't cover.
    const engineCoveredKeywords = new Set(
      enhancedEngineSuggestions
        .filter(s => s.type === 'keyword' && s.keyword)
        .map(s => s.keyword.toLowerCase())
    );
    const smartKeywordSuggestions = buildSmartKeywordSuggestions(
      missing.filter(kw => !engineCoveredKeywords.has(kw.toLowerCase()))
    );
    const mergedSuggestions = [...enhancedEngineSuggestions, ...smartKeywordSuggestions];

    // Format suggestions for API response
    const safeSuggestions = ATSEngineAdapter.formatSuggestionsForAPI(mergedSuggestions);
    
    // Ensure overallFeedback exists
    const overallFeedback = {
      strengths: [],
      weaknesses: [],
      recommendations: []
    };

    // Persist ATS report (audit trail)
    const transformedBreakdown = ATSEngineAdapter.transformBreakdownForATSReport(
      scoreResult.breakdown, scoreResult.details
    );

    let atsReport;
    try {
      atsReport = await ATSReport.create({
        resumeId: resume._id,
        userId:   req.user._id,
        jdId:     resume.jdId,
        totalScore: scoreResult.score,
        scoringMode: 'job-specific',
        keywordMatchPercent: scoreResult.breakdown?.keywordMatch || 0,
        breakdown: transformedBreakdown,
        missingKeywords: scoreResult.keywords?.missing || [],
        jdKeywords:      scoreResult.keywords?.matched || [],
        suggestions: safeSuggestions,
        overallFeedback,
        createdAt: new Date()
      });
    } catch (dbError) {
      console.error('[ATS] ATSReport save failed:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to save ATS report',
        error: process.env.NODE_ENV === 'development' ? dbError.message : 'Database error'
      });
    }

    // Update resume.atsScore for dashboard display
    await Resume.updateOne({ _id: resume._id }, { $set: { atsScore: scoreResult.score } });

    const responsePayload = {
      success: true,
      // ── Core score from ATSEngine ──────────────────────────────────────
      score: Math.round(scoreResult.score || 0),
      totalScore: Math.round(scoreResult.score || 0),  // legacy alias
      semanticScore: typeof semanticScore !== 'undefined' ? semanticScore : 0,
      conceptBoost: typeof conceptBoostJS !== 'undefined' ? Math.round(conceptBoostJS) : 0,
      keywordScore: typeof keywordScore !== 'undefined' ? keywordScore : Math.round(scoreResult.score || 0),
      scoringMode: 'job-specific',
      matchPercentage,

      // ── Breakdown scores ───────────────────────────────────────────────
      breakdown: {
        keywordMatch:        Math.round(scoreResult.breakdown?.keywordMatch        || 0),
        formatting:          Math.round(scoreResult.breakdown?.formatting          || 0),
        sectionCompleteness: Math.round(scoreResult.breakdown?.sectionCompleteness || 0),
        actionVerbs:         Math.round(scoreResult.breakdown?.actionVerbs         || 0),
        readability:         Math.round(scoreResult.breakdown?.readability         || 0),
      },

      // ── Suggestions ────────────────────────────────────────────────────
      suggestions: safeSuggestions,

      // ── Artificial Career Copilot Metrics ──────────────────────────────
      reasons: typeof reasons !== 'undefined' ? reasons : [],
      nextSteps: typeof nextSteps !== 'undefined' ? nextSteps : [],
      semanticMatches: typeof semanticMatches !== 'undefined' ? semanticMatches : [],

      // ── Missing keywords & sections ────────────────────────────────────
      missingKeywords: scoreResult.keywords?.missing || [],
      missingSections: scoreResult.details?.missingSections || [],

      // ── Skill Gap (from analyzeResume) ─────────────────────────────────
      matchedSkills: analysis.matchedSkills,
      missingSkills: analysis.missingSkills,
      totalKeywords: analysis.totalKeywords,
      matchedCount:  analysis.matchedCount,
      missingCount:  analysis.missingCount,
      predictedScore: analysis.predictedScore ?? null,

      // ── Legacy skillGap shape ──────────────────────────────────────────
      skillGap,

      overallFeedback,
    };

    // ── Cache the computed result (1 hour TTL) ────────────────────────────
    if (resume.jdId && cacheService.isRedisConnected()) {
      cacheService.set(atsCacheKey, responsePayload, 3600).catch(() => {});
    }

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error('[ATS] calculateATSScore error:', error.message, '| resumeId:', resumeId);
    
    // Determine appropriate status code and message
    let statusCode = 500;
    let message = 'Failed to calculate ATS score';
    
    if (error.message.includes('not found')) {
      statusCode = 404;
      message = error.message;
    } else if (error.message.includes('requires')) {
      statusCode = 400;
      message = error.message;
    }
    
    // SAFETY: Check if headers already sent before responding
    if (!res.headersSent) {
      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack.split('\n').slice(0, 3).join('\n')
        } : undefined
      });
    }
  }
};

// ──────────────────────────── GET SUGGESTIONS ────────────────────────────

const getSuggestions = async (req, res) => {
  try {
    const { resumeId, jdId } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'Resume ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID format' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Resolve JD
    let jdData = null;
    const resolvedJdId = jdId || resume.jdId;

    if (resolvedJdId && mongoose.Types.ObjectId.isValid(String(resolvedJdId))) {
      jdData = await JobDescription.findOne({ _id: resolvedJdId, userId: req.user._id });
    }

    if (!jdData) {
      // Try latest ATS report
      const latestReport = await ATSReport.findOne({
        resumeId: resume._id,
        jdId: { $ne: null }
      }).sort({ createdAt: -1 });

      if (latestReport?.jdId) {
        jdData = await JobDescription.findOne({ _id: latestReport.jdId, userId: req.user._id });
      }
    }

    if (!jdData) {
      console.log("⚠️ GET_SUGGESTIONS: No Job Description found");
      return res.status(200).json({
        success: true,
        data: { suggestions: [], count: 0 }
      });
    }

    // ✨ NEW: Generate suggestions using production-grade ATS Engine via adapter
    console.log("🔵 GET_SUGGESTIONS: Generating with new ATSEngine...");
    const engineSuggestions = ATSEngineAdapter.getSuggestions(resume, jdData);
    console.log("✅ GET_SUGGESTIONS: Generated", engineSuggestions.length, "suggestions");

    // Upgrade existing generic keyword suggestions using the smart templates
    const enhancedEngineSuggestions = engineSuggestions.map(s => {
      if (s.type === 'keyword' && s.keyword) {
        const smartText = generateSmartSuggestion(s.keyword);
        return {
          ...s,
          message: `Add ${s.keyword} experience: ${smartText}`,
          reason: `Missing keyword: ${s.keyword}`,
          improvedText: smartText,
        };
      }
      return s;
    });

    // Format for API response
    const suggestions = ATSEngineAdapter.formatSuggestionsForAPI(enhancedEngineSuggestions);

    return res.status(200).json({
      success: true,
      data: { suggestions, count: suggestions.length }
    });

  } catch (error) {
    console.error('[GET_SUGGESTIONS] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ──────────────────────────── APPLY SUGGESTION ────────────────────────────

const applySuggestion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Instantiate suggestion engine
    const suggestionEngine = new SuggestionRuleEngine();

    const { resumeId, suggestionId, section, suggestedText, improvedText, autoApplicable, targetIndex, itemIndex, bulletIndex, debounceToken } = req.body;

    // ✅ VALIDATION: Log incoming suggestion
    console.log('🔵 [APPLY_SUGGESTION] Incoming request:', {
      resumeId,
      suggestionId,
      section,
      suggestedText: suggestedText?.substring(0, 50),
      improvedText: improvedText?.substring(0, 50),
      itemIndex,
      bulletIndex,
      targetIndex
    });

    // VALIDATION: Require either suggestedText or improvedText
    const textToApply = suggestedText || improvedText;
    if (!resumeId || !section || (!textToApply)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'resumeId, section, and textToApply are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid resume ID format' });
    }

    // ── Debounce Check ──────────────────────────────────────────────────────
    if (debounceToken) {
      const debounceKey = `apply_${resumeId}_${debounceToken}`;
      if (checkDebounce(debounceKey)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(429).json({
          success: false,
          message: 'Operation in progress. Please wait.',
          retryAfter: DEBOUNCE_TTL_MS
        });
      }
    }

    // ── Load Resume ──────────────────────────────────────────────────────────
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!resume) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // ── Load JD for Score Recalculation ─────────────────────────────────────
    let jdKeywords = [];
    let existingJdId = resume.jdId || null;

    // Find the most recent ATS report with a JD
    const existingReport = await ATSReport.findOne({
      resumeId: resume._id,
      jdId: { $ne: null }
    }).sort({ createdAt: -1 }).session(session);

    if (!existingJdId && existingReport?.jdId) {
      existingJdId = existingReport.jdId;
      resume.jdId = existingJdId;
    }

    if (existingJdId) {
      const jd = await JobDescription.findOne({ _id: existingJdId, userId: req.user._id }).session(session);
      if (jd?.extractedKeywords) {
        jdKeywords = toKeywordStrings(jd.extractedKeywords);
      }
    }

    // ── Stale-Check (if sourceSuggestion available) ──────────────────────────
    if (suggestionId && existingReport?.suggestions?.length > 0) {
      const source = existingReport.suggestions.find(s => s.id === suggestionId);
      if (source?.currentText) {
        const _getActualText = () => {
          switch (section) {
            case 'summary': return resume.summary || '';
            case 'experience': {
              const ei = targetIndex?.expIndex ?? targetIndex?.index;
              const bi = targetIndex?.bulletIndex;
              if (ei == null || bi == null) return '';
              return resume.experience?.[ei]?.bullets?.[bi] || '';
            }
            case 'projects': {
              const pi = targetIndex?.projIndex ?? targetIndex?.index;
              const bi = targetIndex?.bulletIndex;
              if (pi == null || bi == null) return '';
              return resume.projects?.[pi]?.bullets?.[bi] || '';
            }
            default: return '';
          }
        };

        const actual = _getActualText();
        if (actual && normalizeForCompare(actual) !== normalizeForCompare(source.currentText)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'Suggestion is stale — the text has changed. Please refresh suggestions and try again.'
          });
        }
      }
    }

    // ── Apply Change by Section ──────────────────────────────────────────────
    let appliedSuccessfully = false;
    let appliedText = '';

    switch (section) {

      // ── summary ──
      case 'summary': {
        const cleanedSummary = cleanImprovedText(textToApply);
        if (!cleanedSummary) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
        }
        resume.summary = cleanedSummary;
        appliedSuccessfully = true;
        appliedText = cleanedSummary;
        console.log('✅ [APPLY_SUGGESTION] Applied to summary');
        break;
      }

      // ── experience ──
      case 'experience': {
        const cleanedText = cleanImprovedText(textToApply);
        if (!cleanedText) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
        }

        // Support both targetIndex format and direct parameters
        const expIdx = targetIndex?.expIndex ?? itemIndex ?? targetIndex?.index ?? null;
        const bulletIdx = targetIndex?.bulletIndex ?? bulletIndex ?? null;

        if (expIdx == null || bulletIdx == null) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'itemIndex and bulletIndex are required for experience suggestions'
          });
        }

        if (!resume.experience?.[expIdx]) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: `Invalid experience index: ${expIdx}` });
        }

        const exp = resume.experience[expIdx];
        if (!Array.isArray(exp.bullets) || bulletIdx < 0 || bulletIdx >= exp.bullets.length) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'Bullet index out of range. Please refresh suggestions and try again.'
          });
        }

        // Idempotency: don't apply if already same
        const existing = String(exp.bullets[bulletIdx] || '').trim();
        if (normalizeForCompare(existing) === normalizeForCompare(cleanedText)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'This suggestion has already been applied.'
          });
        }

        exp.bullets[bulletIdx] = cleanedText;
        resume.markModified('experience');
        appliedSuccessfully = true;
        appliedText = cleanedText;
        console.log(`✅ [APPLY_SUGGESTION] Applied to experience[${expIdx}].bullets[${bulletIdx}]`);
        break;
      }

      // ── projects ──
      case 'projects': {
        const cleanedText = cleanImprovedText(textToApply);
        if (!cleanedText) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
        }

        // Support both targetIndex format and direct parameters
        const projIdx = targetIndex?.projIndex ?? itemIndex ?? targetIndex?.index ?? null;
        const bulletIdx = targetIndex?.bulletIndex ?? bulletIndex ?? null;

        if (projIdx == null || bulletIdx == null) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'itemIndex and bulletIndex are required for project suggestions'
          });
        }

        if (!resume.projects?.[projIdx]) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: `Invalid project index: ${projIdx}` });
        }

        const proj = resume.projects[projIdx];
        if (!Array.isArray(proj.bullets) || bulletIdx < 0 || bulletIdx >= proj.bullets.length) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'Bullet index out of range. Please refresh suggestions and try again.'
          });
        }

        const existing = String(proj.bullets[bulletIdx] || '').trim();
        if (normalizeForCompare(existing) === normalizeForCompare(cleanedText)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'This suggestion has already been applied.'
          });
        }

        proj.bullets[bulletIdx] = cleanedText;
        resume.markModified('projects');
        appliedSuccessfully = true;
        appliedText = cleanedText;
        console.log(`✅ APPLY_SUGGESTION: Applied to projects[${projIdx}].bullets[${bulletIdx}]`);
        break;
      }

      // ── skills ──
      case 'skills': {
        // BLOCK advisory-only suggestions: if text is too long or matches advisory pattern, reject
        const textLength = (textToApply || '').length;
        const looksAdvisoryOnly = textLength > 80 || /^(?:add|include|consider|try|think\s+about)/i.test(textToApply);
        
        if (looksAdvisoryOnly) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'This is an advisory suggestion and cannot be automatically applied. Please manually review and add skills.',
            advisoryOnly: true
          });
        }

        let cleanedSkills = cleanImprovedText(textToApply);
        
        // If cleaned result is empty but original was a short keyword (1-3 words), use original
        if (!cleanedSkills) {
          const wordCount = textToApply.trim().split(/\s+/).length;
          if (wordCount >= 1 && wordCount <= 3) {
            cleanedSkills = textToApply.trim();
          } else {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
          }
        }

        const extractedSkills = parseSkills(cleanedSkills);
        if (extractedSkills.length === 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'No valid skills found in suggestion text' });
        }

        if (!resume.skills || resume.skills.length === 0) {
          resume.skills = [{ category: 'Technical Skills', items: [] }];
        }

        const categoryIdx = targetIndex?.categoryIndex ?? 0;
        const safeCategoryIdx = resume.skills[categoryIdx] ? categoryIdx : 0;
        const targetCategory = resume.skills[safeCategoryIdx];
        targetCategory.items = targetCategory.items || [];

        const existingLower = new Set(targetCategory.items.map(s => String(s).toLowerCase().trim()));
        let changed = false;

        // If specific item index provided, replace that item
        if (targetIndex?.itemIndex != null && extractedSkills.length > 0) {
          const itemIdx = targetIndex.itemIndex;
          while (targetCategory.items.length <= itemIdx) targetCategory.items.push('');
          const newSkill = extractedSkills[0];
          if (targetCategory.items[itemIdx] !== newSkill) {
            targetCategory.items[itemIdx] = newSkill;
            changed = true;
            appliedText = newSkill;
          }
        } else {
          // Add new skills (skip duplicates)
          for (const skill of extractedSkills) {
            const skillLower = skill.toLowerCase().trim();
            if (!existingLower.has(skillLower) && skill.trim()) {
              targetCategory.items.push(skill);
              existingLower.add(skillLower);
              changed = true;
            }
          }
          appliedText = extractedSkills.join(', ');
        }

        if (changed) {
          resume.markModified('skills');
          appliedSuccessfully = true;
          console.log(`✅ APPLY_SUGGESTION: Applied ${extractedSkills.length} skills`);
        } else {
          // Skills already present — idempotent, not an error
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'All suggested skills already exist in your resume.'
          });
        }
        break;
      }

      // ── achievements — ADVISORY ONLY ──
      case 'achievements': {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Achievements must be added manually for best quality.',
          advisoryOnly: true,
          suggestion: {
            section: 'achievements',
            message: 'Please manually review and add key achievements to boost your ATS score.',
            suggestedText: suggestedText
          }
        });
      }

      // ── education ──
      case 'education': {
        const cleanedDegree = cleanImprovedText(textToApply);
        if (!cleanedDegree) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
        }

        const eduIdx = targetIndex?.eduIndex ?? targetIndex?.index ?? (typeof targetIndex === 'number' ? targetIndex : null);

        if (eduIdx != null && resume.education?.[eduIdx]) {
          resume.education[eduIdx].degree = cleanedDegree;
          resume.markModified('education');
          appliedSuccessfully = true;
          appliedText = cleanedDegree;
          console.log(`✅ [APPLY_SUGGESTION] Applied to education[${eduIdx}]`);
        } else {
          resume.education = resume.education || [];
          resume.education.push({
            institution: '',
            degree: cleanedDegree,
            field: '',
            startDate: '',
            endDate: '',
            grade: '',
            location: ''
          });
          resume.markModified('education');
          appliedSuccessfully = true;
          appliedText = cleanedDegree;
          console.log(`✅ [APPLY_SUGGESTION] Added new education degree`);
        }
        break;
      }

      // ── certifications ──
      case 'certifications': {
        const cleanedCert = cleanImprovedText(textToApply);
        if (!cleanedCert) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: 'Suggestion text is empty after cleanup' });
        }

        const certIdx = targetIndex?.certIndex ?? targetIndex?.index ?? (typeof targetIndex === 'number' ? targetIndex : null);

        if (certIdx != null && resume.certifications?.[certIdx]) {
          resume.certifications[certIdx].name = cleanedCert;
          resume.markModified('certifications');
          appliedSuccessfully = true;
          appliedText = cleanedCert;
          console.log(`✅ [APPLY_SUGGESTION] Applied to certifications[${certIdx}]`);
        } else {
          resume.certifications = resume.certifications || [];
          resume.certifications.push({
            name: cleanedCert,
            issuer: '',
            date: '',
            credentialId: '',
            url: ''
          });
          resume.markModified('certifications');
          appliedSuccessfully = true;
          appliedText = cleanedCert;
          console.log(`✅ [APPLY_SUGGESTION] Added new certification`);
        }
        break;
      }

      default:
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Unsupported section: ${section}` });
    }

    if (!appliedSuccessfully) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Failed to apply suggestion: invalid target'
      });
    }

    // ── Save Resume ──────────────────────────────────────────────────────────
    await resume.save({ session });
    console.log(`[APPLY_FIX] Resume ${resume._id} saved. section=${section}`);

    // ── Recalculate ATS Score ────────────────────────────────────────────────
    let scoreResult;
    try {
      scoreResult = await atsService.calculateATSScore(String(resume._id), existingJdId ? String(existingJdId) : null);
      console.log(`[APPLY_FIX] Score recalculated: ${scoreResult.totalScore}/100 (mode=${scoreResult.scoringMode})`);
    } catch (scoringError) {
      console.error('[APPLY_FIX] Score recalculation failed:', scoringError.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: 'Suggestion applied but ATS recalculation failed. Please refresh.',
        error: process.env.NODE_ENV === 'development' ? scoringError.message : undefined,
        data: {
          updatedResume: resume.toObject(),
          resumeUpdated: true,
          scoreRecalculationFailed: true
        }
      });
    }

    // ── Update ATS Report ────────────────────────────────────────────────────
    const reportFilter = { resumeId: resume._id };
    if (existingJdId) reportFilter.jdId = existingJdId;

    // Regenerate suggestions using fresh resume state
    let jdForSuggestions = null;
    if (existingJdId) {
      jdForSuggestions = await JobDescription.findOne({ _id: existingJdId, userId: req.user._id }).session(session);
    }

    // ✅ FIX: Use correct method call pattern
    const _applyEngine = new SuggestionRuleEngine();
    const _missingKwForApply = Array.isArray(scoreResult.missingKeywords)
      ? scoreResult.missingKeywords.map(k => (typeof k === 'string' ? k : k?.keyword || '')).filter(Boolean)
      : [];
    const _rawFresh = _applyEngine.generateSuggestions(resume.toObject(), _missingKwForApply);
    const freshSuggestions = Array.isArray(_rawFresh) ? _rawFresh : [];

    // ✅ NORMALIZE suggestions before saving to database
    console.log('🔵 [APPLY_SUGGESTION] About to normalize', freshSuggestions.length, 'fresh suggestions');
    if (freshSuggestions.length > 0) {
      console.log('   Fresh [0] type:', freshSuggestions[0].type);
    }
    const normalizedSuggestions = normalizeSuggestions(freshSuggestions);
    console.log('✅ [APPLY_SUGGESTION] Normalized', normalizedSuggestions.length, 'suggestions to schema format');
    if (normalizedSuggestions.length > 0) {
      console.log('   Normalized [0] type:', normalizedSuggestions[0].type, '(should be valid enum, NOT keyword_missing)');
    }

    // Merge: normalizedSuggestions (scoreResult.suggestions removed as it's always undefined)
    const allSuggestions = [
      ...normalizedSuggestions,
    ].filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx);

    const normalizedMissingKeywords = toKeywordStrings(scoreResult.missingKeywords);

    // Create NEW report instead of updating existing one
    const newReport = await ATSReport.create({
      resumeId: reportFilter.resumeId,
      userId: req.user._id,
      jdId: reportFilter.jdId,
      totalScore: scoreResult.totalScore,
      score: scoreResult.totalScore,
      scoringMode: scoreResult.scoringMode,
      keywordMatchPercent: scoreResult.scoringMode === 'job-specific'
        ? (scoreResult.breakdown.keywordMatch || 0)
        : 0,
      breakdown: toStorageBreakdown(scoreResult.breakdown, scoreResult.scoringMode),
      missingKeywords: normalizedMissingKeywords,
      suggestions: allSuggestions,
      overallFeedback: scoreResult.overallFeedback || {},
      jdKeywords: jdKeywords,
      createdAt: new Date()
    });

    // Update Resume.atsScore for Dashboard
    await Resume.updateOne(
      { _id: reportFilter.resumeId },
      { $set: { atsScore: scoreResult.totalScore } }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ [APPLY_SUGGESTION] Done. score=${scoreResult.totalScore} suggestions=${allSuggestions.length}`);
    console.log(`✅ [APPLY_SUGGESTION] Applied: "${appliedText.substring(0, 60)}..."`);

    return res.status(200).json({
      success: true,
      message: 'Suggestion applied successfully',
      data: {
        updatedResume: resume.toObject(),
        updatedScore: scoreResult.totalScore,
        scoringMode: scoreResult.scoringMode,
        updatedBreakdown: scoreResult.breakdown,
        missingSections: scoreResult.missingSections || [],
        updatedSuggestions: allSuggestions,
        missingKeywords: normalizedMissingKeywords,
        overallFeedback: scoreResult.overallFeedback || {},
        appliedSuggestionId: suggestionId,
        usedJdId: existingJdId || null,
        keywordCountUsed: jdKeywords.length
      }
    });

  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) { /* ignore */ }
    session.endSession();

    console.error('[APPLY_SUGGESTION] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply suggestion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ──────────────────────────── GENERATE RESUME ────────────────────────────

const generateResume = async (req, res) => {
  try {
    const { resumeId, mode } = req.body;

    if (!resumeId || !mode) {
      return res.status(400).json({ success: false, message: 'resumeId and mode are required' });
    }

    if (!['optimize', 'generate'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'mode must be "optimize" or "generate"' });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    if (!resume.jdId) {
      return res.status(400).json({ success: false, message: 'No Job Description linked to this resume' });
    }

    const jd = await JobDescription.findOne({ _id: resume.jdId, userId: req.user._id });
    if (!jd) {
      return res.status(404).json({ success: false, message: 'Job Description not found' });
    }

    const resumeGenerator = require('../utils/resumeGenerator');
    let savedResume;

    if (mode === 'optimize') {
      const optimized = resumeGenerator.optimizeWithJD(resume.toObject(), jd);
      const updatePayload = { ...optimized };
      delete updatePayload._id;
      delete updatePayload.id;
      delete updatePayload.userId;
      delete updatePayload.createdAt;
      delete updatePayload.updatedAt;
      Object.assign(resume, updatePayload);
      resume.jdId = jd._id;
      savedResume = await resume.save();
    } else {
      const generated = resumeGenerator.generateFromJD(jd, {
        name: req.user.name,
        email: req.user.email
      });
      const createPayload = { ...generated };
      delete createPayload._id;
      delete createPayload.id;
      createPayload.userId = req.user._id;
      createPayload.jdId = jd._id;
      savedResume = await Resume.create(createPayload);
    }

    return res.status(200).json({
      success: true,
      message: mode === 'optimize' ? 'Resume optimized successfully' : 'Resume generated successfully',
      data: { resume: savedResume, resumeId: savedResume._id, jdId: jd._id }
    });

  } catch (error) {
    console.error('[GENERATE_RESUME] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process resume generation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ──────────────────────────── GET SCORE HISTORY ────────────────────────────

const getScoreHistory = async (req, res) => {
  try {
    const { resumeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID' });
    }

    // Verify ownership
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Get all reports for this resume, newest first
    const reports = await ATSReport.find({ resumeId })
      .sort({ createdAt: -1 })
      .limit(20)  // last 20 scores
      .populate('jdId', 'roleDetected jdText createdAt')  // include JD info
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        resumeId,
        history: reports.map(r => ({
          reportId:    r._id,
          totalScore:  r.totalScore,
          scoringMode: r.scoringMode,
          jdId:        r.jdId?._id || r.jdId,
          jdRole:      r.jdId?.roleDetected || null,
          scoredAt:    r.createdAt,
          breakdown: {
            keywordMatch:  r.breakdown?.keywordMatchScore?.score || 0,
            completeness:  r.breakdown?.sectionCompletenessScore?.score || 0,
            formatting:    r.breakdown?.formattingScore?.score || 0,
            actionVerbs:   r.breakdown?.actionVerbScore?.score || 0,
            readability:   r.breakdown?.readabilityScore?.score || 0,
          }
        })),
        latestScore: reports[0]?.totalScore ?? null,
        totalReports: reports.length
      }
    });

  } catch (error) {
    console.error('[GET_SCORE_HISTORY] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch score history'
    });
  }
};

// ──────────────────────────── APPLY ALL FIXES (BATCH) ────────────────────────

/**
 * Apply all auto-applicable suggestions in one batch
 * 
 * CRITICAL RULES:
 * 1. Only apply suggestions where autoApplicable === true
 * 2. Filter out manual-only suggestions (autoApplicable === false)
 * 3. Apply changes in-memory, save resume ONCE
 * 4. Recalculate ATS score ONCE
 * 5. Return { success, updateCount, updatedResume, updatedScore }
 */
const applyAllSuggestions = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Instantiate suggestion engine
    const suggestionEngine = new SuggestionRuleEngine();

    const { resumeId, debounceToken } = req.body;

    // ── Input Validation ──────────────────────────────────────────────────────
    if (!resumeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'resumeId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid resume ID format' });
    }

    // ── Debounce Check ──────────────────────────────────────────────────────
    if (debounceToken) {
      const debounceKey = `apply_all_${resumeId}_${debounceToken}`;
      if (checkDebounce(debounceKey)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(429).json({
          success: false,
          message: 'Operation in progress. Please wait.',
          retryAfter: DEBOUNCE_TTL_MS
        });
      }
    }

    // ── Load Resume ──────────────────────────────────────────────────────────
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!resume) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // ── Load JD for Score Recalculation ─────────────────────────────────────
    let jdKeywords = [];
    let existingJdId = resume.jdId || null;

    const existingReport = await ATSReport.findOne({
      resumeId: resume._id,
      jdId: { $ne: null }
    }).sort({ createdAt: -1 }).session(session);

    if (!existingJdId && existingReport?.jdId) {
      existingJdId = existingReport.jdId;
      resume.jdId = existingJdId;
    }

    if (existingJdId) {
      const jd = await JobDescription.findOne({ _id: existingJdId, userId: req.user._id }).session(session);
      if (jd?.extractedKeywords) {
        jdKeywords = toKeywordStrings(jd.extractedKeywords);
      }
    }

    // ── Get Current Suggestions ──────────────────────────────────────────────
    const currentReport = await ATSReport.findOne({
      resumeId: resume._id
    }).sort({ createdAt: -1 }).session(session);

    const allSuggestions = currentReport?.suggestions || [];

    // ── FILTER: Only auto-applicable suggestions ─────────────────────────────
    const autoFixableSuggestions = allSuggestions.filter(s => s.autoApplicable === true);

    if (autoFixableSuggestions.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'No auto-applicable fixes available',
        data: {
          updateCount: 0,
          applicableSuggestionCount: 0,
          totalSuggestionCount: allSuggestions.length,
          updatedResume: resume.toObject(),
          updatedScore: resume.atsScore || 0
        }
      });
    }

    // ── Apply All Auto-Fixes In-Memory ───────────────────────────────────────
    let appliedCount = 0;
    const appliedSuggestionIds = [];

    console.log(`🔵 APPLY_ALL: Processing ${autoFixableSuggestions.length} auto-applicable suggestions`);

    for (const suggestion of autoFixableSuggestions) {
      try {
        // VALIDATION: Ensure improvedText exists
        const improvedText = suggestion.improvedText || suggestion.suggestedText;
        if (!improvedText) {
          console.log(`⚠️ Skipping suggestion ${suggestion.id}: missing improvedText`);
          continue;
        }

        const { section, itemIndex, bulletIndex } = suggestion;
        if (!section) {
          console.log(`⚠️ Skipping suggestion ${suggestion.id}: missing section`);
          continue;
        }

        // Clean the improved text
        const cleanedText = cleanImprovedText(improvedText);
        if (!cleanedText) {
          console.log(`⚠️ Skipping suggestion ${suggestion.id}: text empty after cleanup`);
          continue;
        }

        let applied = false;

        console.log(`🔵 APPLY_ALL: Applying suggestion to ${section}`);

        // ── Apply by section ──
        if (section === 'summary') {
          resume.summary = cleanedText;
          applied = true;
          console.log(`✅ Applied to summary`);
        } else if (section === 'experience' && itemIndex != null && bulletIndex != null) {
          if (resume.experience?.[itemIndex]?.bullets?.[bulletIndex] != null) {
            resume.experience[itemIndex].bullets[bulletIndex] = cleanedText;
            resume.markModified('experience');
            applied = true;
            console.log(`✅ Applied to experience[${itemIndex}].bullets[${bulletIndex}]`);
          } else {
            console.log(`⚠️ Invalid experience index: ${itemIndex}, ${bulletIndex}`);
          }
        } else if (section === 'projects' && itemIndex != null && bulletIndex != null) {
          if (resume.projects?.[itemIndex]?.bullets?.[bulletIndex] != null) {
            resume.projects[itemIndex].bullets[bulletIndex] = cleanedText;
            resume.markModified('projects');
            applied = true;
            console.log(`✅ Applied to projects[${itemIndex}].bullets[${bulletIndex}]`);
          } else {
            console.log(`⚠️ Invalid project index: ${itemIndex}, ${bulletIndex}`);
          }
        } else if (section === 'skills') {
          const extractedSkills = parseSkills(cleanedText);
          if (extractedSkills.length > 0) {
            if (!resume.skills || resume.skills.length === 0) {
              resume.skills = [{ category: 'Technical Skills', items: [] }];
            }
            const categoryIdx = itemIndex ?? 0;
            const safeCategoryIdx = resume.skills[categoryIdx] ? categoryIdx : 0;
            const targetCategory = resume.skills[safeCategoryIdx];
            targetCategory.items = targetCategory.items || [];

            const existingLower = new Set(targetCategory.items.map(s => String(s).toLowerCase().trim()));
            for (const skill of extractedSkills) {
              const skillLower = skill.toLowerCase().trim();
              if (!existingLower.has(skillLower)) {
                targetCategory.items.push(skill);
                existingLower.add(skillLower);
                applied = true;
              }
            }
            if (applied) {
              resume.markModified('skills');
              console.log(`✅ Applied ${extractedSkills.length} skills`);
            }
          } else {
            console.log(`⚠️ No skills extracted from: ${cleanedText}`);
          }
        } else {
          console.log(`⚠️ Unknown section: ${section}`);
        }

        if (applied) {
          appliedCount++;
          appliedSuggestionIds.push(suggestion.id);
          console.log(`🟢 Suggestion ${suggestion.id} applied successfully`);
        }
      } catch (e) {
        console.error(`🔥 [APPLY_ALL] Failed to apply suggestion ${suggestion.id}:`, e.message);
        // Continue with next suggestion
      }
    }

    console.log(`📊 APPLY_ALL: Applied ${appliedCount}/${autoFixableSuggestions.length} suggestions`);

    if (appliedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'No changes were made. All applicable fixes were already applied.',
        data: {
          updateCount: 0,
          applicableSuggestionCount: autoFixableSuggestions.length,
          totalSuggestionCount: allSuggestions.length,
          updatedResume: resume.toObject(),
          updatedScore: resume.atsScore || 0
        }
      });
    }

    // ── Save Resume (ONCE) ──────────────────────────────────────────────────
    await resume.save({ session });
    console.log(`[APPLY_ALL] Resume ${resume._id} saved. Applied ${appliedCount} fixes.`);

    // ── Recalculate ATS Score (ONCE) ────────────────────────────────────────
    let scoreResult;
    try {
      scoreResult = await atsService.calculateATSScore(String(resume._id), existingJdId ? String(existingJdId) : null);
      console.log(`[APPLY_ALL] Score recalculated: ${scoreResult.totalScore}/100 (mode=${scoreResult.scoringMode})`);
    } catch (scoringError) {
      console.error('[APPLY_ALL] Score recalculation failed:', scoringError.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: 'Fixes applied but ATS recalculation failed. Please refresh.',
        error: process.env.NODE_ENV === 'development' ? scoringError.message : undefined,
        data: {
          updateCount: appliedCount,
          updatedResume: resume.toObject(),
          scoreRecalculationFailed: true
        }
      });
    }

    // ── Update ATS Report ────────────────────────────────────────────────────
    const reportFilter = { resumeId: resume._id };
    if (existingJdId) reportFilter.jdId = existingJdId;

    // Regenerate suggestions using fresh resume state
    let jdForSuggestions = null;
    if (existingJdId) {
      jdForSuggestions = await JobDescription.findOne({ _id: existingJdId, userId: req.user._id }).session(session);
    }

    // ✅ FIX: Use correct method call pattern (same as applySuggestion)
    const _applyAllEngine = new SuggestionRuleEngine();
    const _missingKwForApplyAll = Array.isArray(scoreResult.missingKeywords)
      ? scoreResult.missingKeywords.map(k => (typeof k === 'string' ? k : k?.keyword || '')).filter(Boolean)
      : [];
    const _rawFreshAll = _applyAllEngine.generateSuggestions(resume.toObject(), _missingKwForApplyAll);
    const freshSuggestions = Array.isArray(_rawFreshAll) ? _rawFreshAll : [];
    
    // ✅ NORMALIZE suggestions before saving to database
    console.log('🔵 [APPLY_ALL] About to normalize', freshSuggestions.length, 'fresh suggestions');
    if (freshSuggestions.length > 0) {
      console.log('   Fresh [0] type:', freshSuggestions[0].type);
    }
    const normalizedNewSuggestions = normalizeSuggestions(freshSuggestions);
    console.log('✅ [APPLY_ALL] Normalized', normalizedNewSuggestions.length, 'suggestions to schema format');
    if (normalizedNewSuggestions.length > 0) {
      console.log('   Normalized [0] type:', normalizedNewSuggestions[0].type, '(should be valid enum, NOT keyword_missing)');
    }
    
    const allNewSuggestions = [...normalizedNewSuggestions].filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx);

    const normalizedMissingKeywords = toKeywordStrings(scoreResult.missingKeywords);

    // Create NEW report instead of updating
    const newReport = await ATSReport.create({
      resumeId: reportFilter.resumeId,
      userId: req.user._id,
      jdId: reportFilter.jdId,
      totalScore: scoreResult.totalScore,
      score: scoreResult.totalScore,
      scoringMode: scoreResult.scoringMode,
      keywordMatchPercent: scoreResult.scoringMode === 'job-specific'
        ? (scoreResult.breakdown.keywordMatch || 0)
        : 0,
      breakdown: toStorageBreakdown(scoreResult.breakdown, scoreResult.scoringMode),
      missingKeywords: normalizedMissingKeywords,
      suggestions: allNewSuggestions,
      overallFeedback: scoreResult.overallFeedback || {},
      jdKeywords: jdKeywords,
      createdAt: new Date()
    });

    // Update Resume.atsScore for Dashboard
    await Resume.updateOne(
      { _id: reportFilter.resumeId },
      { $set: { atsScore: scoreResult.totalScore } }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(`[APPLY_ALL] Complete. Applied ${appliedCount} fixes. New score=${scoreResult.totalScore}`);

    return res.status(200).json({
      success: true,
      message: `Successfully applied ${appliedCount} auto-fixes to your resume`,
      data: {
        updateCount: appliedCount,
        appliedSuggestionIds: appliedSuggestionIds,
        applicableSuggestionCount: autoFixableSuggestions.length,
        totalSuggestionCount: allSuggestions.length,
        updatedResume: resume.toObject(),
        updatedScore: scoreResult.totalScore,
        scoringMode: scoreResult.scoringMode,
        updatedBreakdown: scoreResult.breakdown,
        updatedSuggestions: allNewSuggestions,
        missingKeywords: normalizedMissingKeywords,
        overallFeedback: scoreResult.overallFeedback || {},
        usedJdId: existingJdId || null,
        keywordCountUsed: jdKeywords.length
      }
    });

  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) { /* ignore */ }
    session.endSession();

    console.error('[APPLY_ALL_SUGGESTIONS] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply all fixes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Replaced by analyzeResume in services/analysisEngine.js

/**
 * GET /api/ats/skill-gap/:resumeId/:jdId
 */
const getSkillGap = async (reqOrPayload, res) => {
  try {
    let resume, jd;
    
    // Internal usage signature support
    if (reqOrPayload && reqOrPayload.resume && reqOrPayload.jd) {
      resume = reqOrPayload.resume;
      jd = reqOrPayload.jd;
    } else {
      // Standard Express usage
      const { resumeId, jdId } = reqOrPayload.params;
      resume = await Resume.findOne({ _id: resumeId, userId: reqOrPayload.user._id });
      jd = await JobDescription.findOne({ _id: jdId, userId: reqOrPayload.user._id });
      
      if (!resume || !jd) {
        if (res) return res.status(404).json({ success: false, message: 'Resume or Job Description not found' });
        throw new Error('Resume or Job Description not found');
      }
    }

    const analysis = analyzeResume(resume, jd);

    if (!analysis.valid) {
      const errRes = { message: "JD not properly analyzed", matchedSkills: [], missingSkills: [], matchPercentage: 0, actions: [] };
      if (res) return res.status(400).json(errRes);
      return errRes;
    }

    // Transform missing skills into an Action Plan
    const actions = generateActionPlan(analysis.missingSkills, jd.roleDetected || jd.detectedRole || '');
    
    // Create new response object
    const payload = {
      ...analysis,
      actions
    };

    if (res) return res.status(200).json(payload);
    return payload;

  } catch (error) {
    console.error('[SkillGap] Error:', error);
    if (res) return res.status(500).json({ success: false, message: 'Internal Server Error' });
    throw error;
  }
};

/**
 * POST /api/ats/auto-fix/:resumeId/:jdId
 * Injects missing hard skills into resume.skills, context keywords into project bullets.
 */
const autoFixSkillGap = async (req, res) => {
  try {
    const { resumeId, jdId } = req.params;
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    const jd    = await JobDescription.findOne({ _id: jdId, userId: req.user._id });
    if (!resume || !jd) return res.status(404).json({ success: false, message: 'Resume or Job Description not found' });

    const scoreBeforeResult = ATSEngineAdapter.scoreResume(resume, jd);
    const scoreBefore = Math.round(scoreBeforeResult.score || 0);

    const analysis = analyzeResume(resume, jd);
    if (!analysis.valid || analysis.missingSkills.length === 0) {
      return res.status(200).json({
        success: true, message: 'No missing skills to fix or JD empty.',
        data: { scoreBefore, scoreAfter: scoreBefore, addedKeywords: [], contextKeywordsInjected: [], predictedScore: scoreBefore }
      });
    }
    const missingSkills = analysis.missingSkills;

    const hardMissing    = missingSkills.filter(s => s.type === 'hard').map(s => s.keyword);
    const contextMissing = missingSkills.filter(s => s.type === 'context').map(s => s.keyword);

    // Inject hard skills into resume.skills
    if (!resume.skills) resume.skills = [];
    if (resume.skills.length === 0) resume.skills.push({ category: 'Technical Skills', items: [] });
    const skillCat = resume.skills.find(s => s.items) || resume.skills[0];
    if (!skillCat.items) skillCat.items = [];
    const addedKeywords = [];
    for (const kw of hardMissing) {
      if (!skillCat.items.some(e => e.toLowerCase() === kw.toLowerCase())) {
        skillCat.items.push(kw); addedKeywords.push(kw);
        console.log(`[AutoFix] ✓ Added hard skill: "${kw}"`);
      }
    }
    resume.markModified('skills');

    // Inject context keywords as a single bullet in first project
    if (contextMissing.length > 0 && resume.projects?.length > 0) {
      const proj = resume.projects[0];
      if (!proj.bullets) proj.bullets = [];
      const alreadyInjected = proj.bullets.some(b => b.includes('Relevant knowledge areas'));
      if (!alreadyInjected) {
        proj.bullets.push(`(Relevant knowledge areas: ${contextMissing.join(', ')})`);
        resume.markModified('projects');
        console.log(`[AutoFix] ✓ Injected context keywords into project[0]`);
      }
    }

    await resume.save();
    const freshResume  = await Resume.findById(resumeId);
    const scoreResult  = ATSEngineAdapter.scoreResume(freshResume, jd);
    const scoreAfter   = Math.round(scoreResult.score || 0);

    const frontendBreakdown = {
      keywordMatch: scoreResult.breakdown?.keywordMatch || 0,
      formatting:   scoreResult.breakdown?.formatting   || 0,
      completeness: scoreResult.breakdown?.sectionCompleteness || 0,
      actionVerbs:  scoreResult.breakdown?.actionVerbs  || 0,
      readability:  scoreResult.breakdown?.readability  || 0,
    };

    await ATSReport.create([{
      resumeId: freshResume._id, userId: req.user._id, jdId,
      totalScore: scoreAfter,
      breakdown: ATSEngineAdapter.transformBreakdownForATSReport(scoreResult.breakdown, scoreResult.details),
      suggestions: ATSEngineAdapter.formatSuggestionsForAPI(scoreResult.suggestions || []),
      missingKeywords: scoreResult.keywords?.missing || [],
      overallFeedback: {}, generatedAt: new Date(),
    }]);
    await Resume.updateOne({ _id: freshResume._id }, { atsScore: scoreAfter });

    console.log(`[AutoFix] Score: ${scoreBefore} → ${scoreAfter}`);
    return res.status(200).json({
      success: true,
      message: `Auto-fix applied. Score improved from ${scoreBefore} to ${scoreAfter}.`,
      data: { scoreBefore, scoreAfter, addedKeywords, contextKeywordsInjected: contextMissing,
        updatedBreakdown: frontendBreakdown, predictedScore: scoreAfter }
    });
  } catch (error) {
    console.error('[AutoFix] Error:', error);
    return res.status(500).json({ success: false, message: 'Auto-fix failed: ' + error.message });
  }
};

// ─────────────────────────── REWRITE RESUME ──────────────────────────────
function detectRole(jdText) {
  const text = (jdText || '').toLowerCase();
  const hasBackend = ['api', 'backend', 'node', 'database'].some(k => text.includes(k));
  const hasFrontend = ['ui', 'frontend', 'react', 'ux'].some(k => text.includes(k));
  
  if (hasBackend && hasFrontend) return 'fullstack';
  if (hasBackend) return 'backend';
  if (hasFrontend) return 'frontend';
  return 'generic';
}

/**
 * POST /api/ats/rewrite
 *
 * Full pipeline:
 *  1. Fetch resume + linked JD
 *  2. ATS score the ORIGINAL resume  → originalScore
 *  3. Pull matching KeywordLibrary entry for role-aligned keywords
 *  4. Call rewriteResume service (Gemini)
 *  5. Build a simulated "rewritten" resume copy (in-memory — no DB write)
 *  6. ATS score the SIMULATED resume  → newScore
 *  7. Build section-level diff
 *  8. Return { originalScore, newScore, diff, rewrittenResume, improvements }
 */
const rewriteResumeController = async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'resumeId is required' });
    }

    // 1. Fetch resume (ownership check)
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }

    // 2. Fetch linked JD
    const jd = resume.jdId
      ? await JobDescription.findById(resume.jdId)
      : null;

    if (!jd || !jd.jdText) {
      return res.status(400).json({
        success: false,
        message: 'No linked Job Description found. Please add a JD first.'
      });
    }

    // Normalise JD into a simple object the rewrite service expects
    const jdDoc = {
      description:      jd.jdText,
      roleDetected:     jd.roleDetected || '',
      extractedKeywords: (jd.extractedKeywords || []).map(k =>
        typeof k === 'string' ? k : k.keyword
      ),
    };

    // ── Pre-Scoring Formatting Normalization ─────────────────────────────────
    const normalizeBullets = (bullets) => {
      if (!Array.isArray(bullets)) return [];
      return bullets
        .flatMap(b => (typeof b === 'string' ? b.split('\n') : []))
        .map(b => b.trim())
        .filter(Boolean);
    };

    let normalizedCount = 0;
    if (resume.experience && Array.isArray(resume.experience)) {
      resume.experience.forEach(exp => {
        if (Array.isArray(exp.bullets)) {
          exp.bullets = normalizeBullets(exp.bullets);
          normalizedCount += exp.bullets.length;
        }
      });
    }
    if (resume.projects && Array.isArray(resume.projects)) {
      resume.projects.forEach(proj => {
        if (Array.isArray(proj.bullets)) {
          proj.bullets = normalizeBullets(proj.bullets);
          normalizedCount += proj.bullets.length;
        }
      });
    }
    console.log(`[Format] normalized bullets count: ${normalizedCount}`);

    // ── Auto Experience Generation ─────────────────────────────────────────
    // NOTE: Auto-experience injection is handled globally inside
    // ATSEngineAdapter.scoreResume() via deep-clone, so both base scoring
    // and rewrite scoring see the same normalized resume. No action needed here.

    // 3. Score ORIGINAL resume
    console.log('[Rewrite] Scoring original resume...');
    const originalResult = ATSEngineAdapter.scoreResume(resume, jd);
    
    // Calculate hybrid score dynamically for precision 
    let originalScore = originalResult.score ?? 0;
    try {
      const jdText = jd.jdText || jd.description || jd.content || '';
      const semScore = await semanticService.getSemanticScore({ experience: buildSearchableResumeText(resume) }, jdText);
      const hasExp = Array.isArray(resume.experience) && resume.experience.length > 0;
      const compWeight = hasExp ? 0.20 : 0.15;
      const fmtWeight  = hasExp ? 0.05 : 0.10;

      originalScore = Math.round(
        (originalResult.breakdown?.keywordMatch || 0) * 0.35 +
        semScore * 0.35 +
        (originalResult.breakdown?.sectionCompleteness || 0) * compWeight +
        (originalResult.breakdown?.formatting || 0) * fmtWeight +
        (originalResult.breakdown?.actionVerbs || 0) * 0.05
      );
    } catch(err) { console.warn('Semantic fallback for original rewrite score'); }
    
    console.log("Rewrite: Original Score", originalScore);
    const atsBreakdown   = originalResult.breakdown ?? {};
    const missing        = originalResult.keywords?.missing ?? [];

    // 4. Build skill gap object for the rewrite prompt
    const skillGap = {
      missing:  missing,
      present:  originalResult.keywords?.matched ?? [],
    };

    // 5. Pull KeywordLibrary for the detected role (optional — graceful if missing)
    let keywordsLibrary = [];
    try {
      const role = jd.roleDetected || '';
      if (role) {
        const libDoc = await KeywordLibrary.findOne({
          role: { $regex: new RegExp(role, 'i') },
          isActive: true,
        });
        if (libDoc) {
          keywordsLibrary = libDoc.keywords.map(k => k.term);
          console.log(`[Rewrite] KeywordLibrary matched role "${role}" — ${keywordsLibrary.length} terms loaded.`);
        }
      }
    } catch (libErr) {
      console.warn('[Rewrite] KeywordLibrary lookup failed (non-fatal):', libErr.message);
    }

    // 6. Call Gemini rewrite service inside retry loop
    console.log('[Rewrite] Calling AI rewrite service...');
    let attempt = 1;
    let maxAttempts = 2;
    let bestRewrite = null;
    let bestScore = originalScore;
    let finalSimulatedResume = null;
    let finalSimulatedResult = null;   // hoisted so it's accessible after the loop

    // Hoist resumePlain here so it is accessible both inside the loop and after it
    const resumePlain = resume.toObject ? resume.toObject() : { ...resume };

    // ── Auto Experience Generation ────────────────────────────────────────────
    // If the candidate has no experience, synthesize entries from projects
    // BEFORE scoring so completeness and keyword scoring both benefit.
    const autoExpResult = generateExperienceFromProjects(resumePlain);
    if (autoExpResult._autoGenerated) {
      resumePlain.experience = autoExpResult.experience;
      resumePlain._autoGeneratedExperience = true;   // flag picked up by calculateCompleteness
      console.log(`[Rewrite] Auto-generated ${autoExpResult.experience.length} experience entries from projects.`);
    }

    const detectedRole = detectRole(jd.jdText || jd.description || '');
    jdDoc.detectedRole = detectedRole;

    while (attempt <= maxAttempts) {
      console.log(`[Rewrite] Attempt ${attempt}/${maxAttempts}`);
      const rewriteResult = await rewriteResume({
        resume:          resumePlain,
        jd:              jdDoc,
        atsBreakdown,
        skillGap,
        keywordsLibrary,
        isRetry:         attempt > 1
      });

      // 7. Build in-memory simulated resume
      const simulatedResume = JSON.parse(JSON.stringify(resumePlain)); // deep clone

      if (rewriteResult.summary) simulatedResume.summary = rewriteResult.summary;

      // Merge rewritten experience bullets (keep original company/title, only replace bullets)
      if (rewriteResult.experience?.length) {
        simulatedResume.experience = (simulatedResume.experience || []).map((exp, i) => {
          const rewritten = rewriteResult.experience[i];
          if (!rewritten || !rewritten.bullets?.length) return exp;
          return { ...exp, bullets: rewritten.bullets };
        });
      }

      // Merge rewritten project bullets — rp.name is the new key
      if (rewriteResult.projects?.length) {
        simulatedResume.projects = rewriteResult.projects.map((rp, i) => {
          const original = simulatedResume.projects?.[i] || {};
          return {
            ...original,
            name:    rp.name || original.name || original.title || '',
            title:   rp.name || original.title || original.name || '', // keep both for compat
            bullets: rp.bullets?.length ? rp.bullets : (original.bullets || []),
          };
        });
      }

      // Merge rewritten skills — rewriteResult.skills is now a flat string[]
      if (Array.isArray(rewriteResult.skills) && rewriteResult.skills.length) {
        // Collect all existing skill strings for dedup
        const existingFlat = (simulatedResume.skills || []).flatMap(s =>
          Array.isArray(s.items) ? s.items : (typeof s === 'string' ? [s] : [])
        );
        const existingSet = new Set(existingFlat.map(s => s.toLowerCase()));

        // Only keep genuinely new skills, deduplicated, max 12 total new
        const newItems = rewriteResult.skills
          .filter(sk => typeof sk === 'string' && sk.trim() && !existingSet.has(sk.toLowerCase()))
          .slice(0, 12);

        if (newItems.length) {
          simulatedResume.skills = [
            ...(simulatedResume.skills || []),
            { category: 'AI-Added', items: newItems },
          ];
        }
      } else if (rewriteResult.skills?.added?.length) {
        // Legacy path: { added: [] } — kept for safety
        const existingFlat = (simulatedResume.skills || []).flatMap(s =>
          Array.isArray(s.items) ? s.items : (typeof s === 'string' ? [s] : [])
        );
        const existingSet = new Set(existingFlat.map(s => s.toLowerCase()));
        const newItems = rewriteResult.skills.added
          .filter(sk => typeof sk === 'string' && sk.trim() && !existingSet.has(sk.toLowerCase()))
          .slice(0, 12);
        if (newItems.length) {
          simulatedResume.skills = [
            ...(simulatedResume.skills || []),
            { category: 'AI-Added', items: newItems },
          ];
        }
      }

      let newScore = originalScore;
      let newResult = null;          // ← hoisted — always in scope, never throws ReferenceError
      try {
        newResult = ATSEngineAdapter.scoreResume(simulatedResume, jd);
        newScore = newResult.score ?? originalScore;
        console.log(`[Rewrite] Original Score: ${originalScore}`);
        
        try {
          const jdText = jd.jdText || jd.description || jd.content || '';
          const text = buildSearchableResumeText(simulatedResume); 
          const semScore = await semanticService.getSemanticScore({ experience: text }, jdText);
          
          newScore = Math.round(
            (newResult.breakdown?.keywordMatch || 0) * 0.35 +
            semScore * 0.35 +
            (newResult.breakdown?.sectionCompleteness || 0) * 0.15 +
            (newResult.breakdown?.formatting || 0) * 0.10 +
            (newResult.breakdown?.actionVerbs || 0) * 0.05
          );
        } catch (semErr) {
          console.warn('[Rewrite] Semantic scoring unavailable — using keyword-only score.');
        }
        console.log(`[Rewrite] New Score: ${newScore}`);
      } catch (scoreErr) {
        console.warn('[Rewrite] Re-scoring failed (non-fatal):', scoreErr.message);
      }

      if (newScore > bestScore || !bestRewrite) {
        bestScore = newScore;
        bestRewrite = rewriteResult;
        finalSimulatedResume = simulatedResume;
        finalSimulatedResult = newResult;   // safe — newResult is always declared now
      }

      if (newScore >= originalScore + 5) {
        break;
      } else {
        console.log(`[Rewrite] Score improvement < +5. Tracking retry...`);
        attempt++;
      }
    }

    const rewriteResult   = bestRewrite || {};
    const simulatedResume = finalSimulatedResume || resumePlain;
    let newScore          = bestScore;

    // Bullet impact score (0–30 avg, measures metric/performance/scale density)
    const impactScore = scoreRewriteImpact(rewriteResult);
    console.log(`[Rewrite] Impact Score: ${impactScore}/30`);

    // 9. Build section-level diff
    const diff = {
      summary: {
        before: resumePlain.summary || '',
        after:  rewriteResult.summary || resumePlain.summary || '',
      },
      experience: (rewriteResult.experience || []).map((re, i) => ({
        title:   re.title || resumePlain.experience?.[i]?.role || resumePlain.experience?.[i]?.jobTitle || '',
        company: re.company || resumePlain.experience?.[i]?.company || '',
        before:  resumePlain.experience?.[i]?.bullets || [],
        after:   re.bullets || [],
      })),
      projects: (rewriteResult.projects || []).map((rp, i) => ({
        name:   rp.name || resumePlain.projects?.[i]?.name || resumePlain.projects?.[i]?.title || '',
        before: resumePlain.projects?.[i]?.bullets || [],
        after:  rp.bullets || [],
      })),
      skills: {
        // Handle both flat string[] (new) and legacy { added: [] }
        added: Array.isArray(rewriteResult.skills)
          ? rewriteResult.skills
          : (rewriteResult.skills?.added || []),
      },
    };

    const improvements = [];
    if (diff.summary.before !== diff.summary.after) {
      improvements.push('Summary improved for ATS alignment and semantic clarity');
    }
    if (diff.experience.some(e => e.before.join('') !== e.after.join(''))) {
      improvements.push('Experience bullets rewritten with stronger action verbs and measurable impact');
    }
    if (diff.projects.some(p => p.before.join('') !== p.after.join(''))) {
      improvements.push('Project bullets rewritten with clear structure and JD keyword alignment');
    }
    if (diff.skills.added.length > 0) {
      improvements.push(`${diff.skills.added.length} missing relevant skills added`);
    }

    // 10. Generate Hiring Signals & Confidence Metrics
    const missingSkills = originalResult.keywords?.missing || [];
    const signals = extractHiringSignals(simulatedResume, jd, missingSkills);
    
    // Predict shortlist probability
    // (ats score * 0.5) + (completeness * 0.3) + semantic alignment modifier
    const atsPerc = (newScore / 100) * 0.6;
    const compPerc = ((finalSimulatedResult?.breakdown?.sectionCompleteness || 0) / 100) * 0.4;
    const rawProb = atsPerc + compPerc;
    const shortlist_probability_after = Math.min(1.0, Math.max(0.0, rawProb));
    
    const atsPercOrig = (originalScore / 100) * 0.6;
    const compPercOrig = ((originalResult?.breakdown?.sectionCompleteness || 0) / 100) * 0.4;
    const shortlist_probability_before = Math.min(1.0, Math.max(0.0, atsPercOrig + compPercOrig));

    console.log(`[ATS FINAL] completeness=${finalSimulatedResult?.breakdown?.sectionCompleteness ?? 'N/A'} keyword=${finalSimulatedResult?.breakdown?.keywordMatch ?? 'N/A'} semantic=N/A (rewrite path) impactScore=${impactScore}`);
    console.log(`[Rewrite] ✅ Done. Score: ${originalScore} → ${newScore}. Impact: ${impactScore}/30. Confidence: ${shortlist_probability_after.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      // Top-level aliases for clients that read these directly
      scoreBefore:     originalScore,
      scoreAfter:      newScore,
      impactScore,                    // 0–30: bullet metric/performance density
      rewrittenResume: simulatedResume,
      message: `AI rewrite complete. Score projected to improve from ${originalScore} to ${newScore}.`,
      data: {
        originalScore,
        newScore,
        scoreDelta:      newScore - originalScore,
        impactScore,
        diff,
        rewrittenResume: simulatedResume,
        improvements,
        signals,
        shortlist_probability_before: Number(shortlist_probability_before.toFixed(2)),
        shortlist_probability_after:  Number(shortlist_probability_after.toFixed(2)),
        isFallback: rewriteResult._fallback ?? false,
      },
    });

  } catch (error) {
    console.error('[Rewrite] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Resume rewrite failed: ' + error.message,
    });
  }
};

module.exports = { calculateATSScore, getSuggestions, applySuggestion, applyAllSuggestions, generateResume, getScoreHistory, getSkillGap, autoFixSkillGap, rewriteResumeController, detectRole };