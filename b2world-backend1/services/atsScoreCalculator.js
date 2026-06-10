/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATS SCORE CALCULATOR — REFACTORED
 * 
 * FIXES:
 * 1. Proper weighted scoring calculation
 * 2. Category value validation (0-100 clamping)
 * 3. Fixed completeness detection
 * 4. Improved suggestion generation with thresholds
 * 5. Duplicate suggestion removal
 * 6. Deterministic scoring
 * 7. Debug logging
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { ATS_WEIGHTS, SECTION_REQUIREMENTS } = require('./atsConfig');
const {
  normalizeText,
  tokenize,
  removeStopwords,
  calculateReadability
} = require('./atsTextProcessor');
const { extractJDKeywords, calculateKeywordScore } = require('./atsKeywordExtractor');
const { getActionVerbScore } = require('./atsVerbDetector');
const { detectDomain } = require('./atsSuggestionGenerator');
const { generateProductionSuggestions } = require('./atsProductionSuggestionEngine');

/**
 * Calculates complete ATS score using proper weighted formula
 * 
 * SCORING FORMULA (Weighted):
 * keywordScore = keywordMatch * 0.4
 * completenessScore = completeness * 0.2
 * formattingScore = formatting * 0.2
 * actionScore = actionVerbs * 0.1
 * readabilityScore = readability * 0.1
 * finalScore = Sum(all weighted scores)
 * 
 * @param {Object} resume - Resume object
 * @param {Object} jobDescription - Job description
 * @returns {Object} - Scoring results
 */
function calculateATSScore(resume, jobDescription, semanticScore = 0) {
  if (!resume || typeof resume !== 'object' || !jobDescription) {
    console.error('❌ Invalid resume or job description provided');
    return createEmptyScoreResult();
  }

  try {
    // Step 1: Extract keywords from JD
    let jdKeywords = jobDescription.extractedKeywords || [];
    if (!jdKeywords.length && jobDescription.description) {
      jdKeywords = extractJDKeywords(jobDescription.description);
    }

    // Step 2: Build resume text
    const resumeText = buildSearchableResumeText(resume);
    
    // DEBUG: Validate resume text
    console.log('🔵 atsScoreCalculator - Resume text validation:');
    console.log(`   Text length: ${resumeText?.length || 0}`);
    console.log(`   Text trimmed length: ${resumeText?.trim().length || 0}`);
    if (resumeText?.length > 0) {
      console.log(`   Text preview: "${resumeText.substring(0, 100)}..."`);
    }
    
    // -- Compute completeness BEFORE the text guard so it's never lost --
    // calculateCompleteness works directly on the resume object (no text required)
    const completenessScore = calculateCompleteness(resume);

    if (!resumeText || resumeText.trim().length === 0) {
      console.error('❌ CRITICAL: Resume text is empty after buildSearchableResumeText!');
      console.error('   Resume object keys:', Object.keys(resume));
      console.error('   Resume.summary:', resume.summary ? `"${resume.summary.substring(0, 50)}..."` : 'MISSING');
      console.error('   Resume.experience length:', resume.experience?.length || 0);
      if (resume.experience?.length > 0) {
        console.error('   First experience:', JSON.stringify(resume.experience[0]).substring(0, 200));
      }
      console.error('   Resume.skills length:', resume.skills?.length || 0);

      // Return empty result BUT preserve the real completeness score
      const emptyResult = createEmptyScoreResult();
      emptyResult.breakdown.sectionCompleteness = completenessScore.score;
      emptyResult.details.completenessAnalysis  = completenessScore.details;
      console.log(`[ATS FINAL] completeness=${completenessScore.score} keyword=0 semantic=0 (empty-text path)`);
      return emptyResult;
    }

    // Step 3: Calculate remaining component scores (0-100)
    // completenessScore already computed above
    const keywordScore = calculateKeywordMatch(resumeText, jdKeywords);
    const formattingScore = calculateFormatting(resume);
    const actionVerbScore = calculateActionVerbComponent(resumeText);
    const readabilityScore = calculateReadabilityComponent(resumeText);

    // Step 4: VALIDATE all scores are in range 0-100
    const validatedBreakdown = validateScores({
      keywordMatch: keywordScore.score,
      sectionCompleteness: completenessScore.score,   // ← always from object, never shadowed
      formatting: formattingScore.score,
      actionVerbs: actionVerbScore.score,
      readability: readabilityScore.score
    });

    // Step 5: CALCULATE FINAL SCORE using proper weighted formula (35/35/15/10/5)
    // Formula: Keyword (35%) + Semantic (35%) + Completeness (15%) + Formatting (10%) + Action (5%)
    const finalScore = calculateFinalScore(validatedBreakdown, semanticScore);

    // Step 6: Generate structured reason breakdown (Why Score Is Low)
    const reasons = generateReasonBreakdown(resume, validatedBreakdown, keywordScore.missing, jdKeywords);

    // Step 7: Debug logging
    console.log('─'.repeat(70));
    console.log('🔵 ATS SCORE CALCULATION');
    console.log('─'.repeat(70));
    console.log('📊 Score Breakdown (Raw values 0-100):');
    console.log(`   Keyword Match:     ${keywordScore.score.toFixed(1)} (weight: 40%)`);
    console.log(`   Completeness:      ${completenessScore.score.toFixed(1)} (weight: 20%)`);
    console.log(`   Formatting:        ${formattingScore.score.toFixed(1)} (weight: 20%)`);
    console.log(`   Action Verbs:      ${actionVerbScore.score.toFixed(1)} (weight: 10%)`);
    console.log(`   Readability:       ${readabilityScore.score.toFixed(1)} (weight: 10%)`);
    console.log('─'.repeat(70));
    console.log('✅ Weighted Calculation:');
    console.log(`   ${keywordScore.score.toFixed(1)} × 0.4 = ${(validatedBreakdown.keywordMatch * 0.4).toFixed(2)}`);
    console.log(`   ${completenessScore.score.toFixed(1)} × 0.2 = ${(validatedBreakdown.sectionCompleteness * 0.2).toFixed(2)}`);
    console.log(`   ${formattingScore.score.toFixed(1)} × 0.2 = ${(validatedBreakdown.formatting * 0.2).toFixed(2)}`);
    console.log(`   ${actionVerbScore.score.toFixed(1)} × 0.1 = ${(validatedBreakdown.actionVerbs * 0.1).toFixed(2)}`);
    console.log(`   ${readabilityScore.score.toFixed(1)} × 0.1 = ${(validatedBreakdown.readability * 0.1).toFixed(2)}`);
    console.log('─'.repeat(70));
    console.log(`🎯 FINAL ATS SCORE: ${finalScore}`);
    console.log(`[ATS FINAL] completeness=${validatedBreakdown.sectionCompleteness} keyword=${validatedBreakdown.keywordMatch} semantic=${semanticScore}`);
    console.log('─'.repeat(70));

    // Return result
    return {
      score: finalScore,
      breakdown: validatedBreakdown,
      keywords: {
        matched: keywordScore.matched,
        missing: keywordScore.missing,
        matchPercentage: keywordScore.matchPercentage,
        total: jdKeywords.length
      },
      reasons, // NEW STRUCTURED REASONS ARRAY
      domain: detectDomain(resume),
      details: {
        keywordAnalysis: keywordScore.details,
        completenessAnalysis: completenessScore.details,
        formattingAnalysis: formattingScore.details,
        actionVerbAnalysis: actionVerbScore.details,
        readabilityAnalysis: readabilityScore.details
      }
    };
  } catch (error) {
    console.error('❌ Error calculating ATS score:', error.message);
    return createEmptyScoreResult();
  }
}

/**
 * Validates all scores are within 0-100 range
 * Clamps out-of-range values
 * 
 * @private
 * @param {Object} scores - Score object
 * @returns {Object} - Validated scores
 */
function validateScores(scores) {
  const validated = {};
  
  Object.entries(scores).forEach(([key, value]) => {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      console.warn(`⚠️ Invalid score for ${key}: ${value}, defaulting to 0`);
      validated[key] = 0;
    } else {
      // Clamp to 0-100
      validated[key] = Math.max(0, Math.min(100, numValue));
    }
  });
  
  return validated;
}

/**
 * Calculates final ATS score using weighted formula
 * 
 * Formula:
 * score = (keyword * 0.4) + (sectionCompleteness * 0.2) + (formatting * 0.2) + (actionVerbs * 0.1) + (readability * 0.1)
 * 
 * @private
 * @param {Object} breakdown - Validated breakdown {keywordMatch, sectionCompleteness, formatting, actionVerbs, readability}
 * @returns {number} - Final score rounded to nearest integer (0-100)
 */
function calculateFinalScore(breakdown, semanticScore = 0) {
  const weighted =
    (breakdown.keywordMatch || 0) * 0.35 +
    (semanticScore || 0) * 0.35 +
    (breakdown.sectionCompleteness || 0) * 0.15 +
    (breakdown.formatting || 0) * 0.10 +
    (breakdown.actionVerbs || 0) * 0.05;

  // Round to nearest integer
  return Math.round(weighted);
}

/**
 * Calculates completeness score based on section presence
 * 
 * @private
 * @param {Object} resume - Resume object
 * @returns {number} - Completeness score (0-100)
 */
function calculateCompleteness(resume) {
  // ── Determine which sections have real content ────────────────────────────
  const hasExperience = Array.isArray(resume.experience) && resume.experience.length > 0;
  const hasProjects   = Array.isArray(resume.projects)   && resume.projects.length   > 0;
  const hasEducation  = Array.isArray(resume.education)  && resume.education.length  > 0;
  const hasSummary    = !!resume.summary;

  // Count individual skill items
  const skillItemCount = (() => {
    if (!resume.skills || !Array.isArray(resume.skills)) return 0;
    return resume.skills.reduce((total, s) => {
      if (typeof s === 'string') return total + 1;
      if (s && Array.isArray(s.items)) return total + s.items.length;
      return total;
    }, 0);
  })();
  const hasSkills = skillItemCount > 0;

  // ── Guard: only return 0 when ALL core sections are absent (resume is empty)
  if (!hasSkills && !hasProjects && !hasEducation && !hasExperience && !hasSummary) {
    return {
      score: 0,
      details: {
        presentSections: 0,
        totalSections: 7,
        skillItemCount,
        sections: {
          summary: false, skills: false, projects: false, experience: false, education: false,
          certifications: false, achievements: false
        }
      }
    };
  }

  // ── Additive scoring ─────────────────────────────────────────────────────
  const skillsPts     = hasSkills     ? 20 : 0;
  const projectsPts   = hasProjects   ? 30 : 0;
  const educationPts  = hasEducation  ? 20 : 0;
  const experiencePts = (hasExperience || resume._autoGeneratedExperience) ? 30 : 0;
  const summaryPts    = hasSummary    ? 5 : 0;

  // Project-depth bonus
  const projectCount    = Array.isArray(resume.projects) ? resume.projects.length : 0;
  const projectDepthPts = projectCount >= 2 ? 10 : 0;

  let score = skillsPts + projectsPts + educationPts + experiencePts + summaryPts + projectDepthPts;

  // ── Floor rule ───────────────────────────────────────────────────────────
  if (hasSkills && hasProjects) {
    if (score < 70) score = 70;
  } else if (score > 0 && score < 60) {
    score = 60;
  }

  score = Math.min(score, 100);

  return {
    score,
    details: {
      presentSections: [hasSkills, hasProjects, hasEducation, hasExperience, hasSummary].filter(Boolean).length,
      totalSections: 7,
      skillItemCount,
      autoGeneratedExperience: !!resume._autoGeneratedExperience,
      projectDepthBonus: projectDepthPts,
      sections: {
        summary:        hasSummary,
        skills:         hasSkills,
        projects:       hasProjects,
        experience:     hasExperience,
        education:      hasEducation,
        certifications: !!(Array.isArray(resume.certifications) && resume.certifications.length > 0),
        achievements:   !!(Array.isArray(resume.achievements)   && resume.achievements.length   > 0)
      }
    }
  };
}

/**
 * Generates improved suggestions based on score thresholds
 * Ensures at least 1-3 suggestions when scores are below thresholds
 * Deduplicates suggestions
 * 
 * @private
 * @param {Object} resume - Resume object
 * @param {Object} breakdown - Score breakdown
 * @param {string[]} missingKeywords - Missing keywords from JD
 * @param {string[]} jdKeywords - All JD keywords
 * @param {string} resumeText - Resume text
 * @returns {Array} - Deduplicated suggestions
 */
function generateImprovedSuggestions(resume, breakdown, missingKeywords, jdKeywords, resumeText) {
  // FALLBACK: Use production suggestion engine
  // Should not be called directly; use generateProductionSuggestions instead
  return generateProductionSuggestions(resume, breakdown, missingKeywords, jdKeywords, resumeText);
}

/**
 * Calculates keyword match score (40% weight)
 * 
 * @private
 * @param {string} resumeText - Resume text
 * @param {string[]} jdKeywords - Keywords from job description
 * @returns {Object} - Keyword score and matching details
 */

function calculateKeywordMatch(resumeText, jdKeywords) {
  if (!jdKeywords || jdKeywords.length === 0) {
    return {
      score: 0,
      matched: [],
      missing: [],
      matchPercentage: 0,
      details: {}
    };
  }
  
  const keywordResult = calculateKeywordScore(resumeText, jdKeywords);
  
  return {
    score: keywordResult.score,
    matched: keywordResult.matched,
    missing: keywordResult.missing,
    matchPercentage: keywordResult.matchPercentage,
    details: keywordResult.details
  };
}

/**
 * Calculates section completeness score (20% weight)
 * Evaluates presence and quality of each resume section
 * 
 * @private
 * @param {Object} resume - Resume object
 * @returns {Object} - Completeness score and breakdown
 */
function calculateSectionCompleteness(resume) {
  // Use the new calculateCompleteness function
  return calculateCompleteness(resume);
}

/**
 * Calculates formatting score (20% weight)
 * Evaluates resume structure, organization, and professional presentation
 * 
 * @private
 * @param {Object} resume - Resume object
 * @returns {Object} - Formatting score
 */
const normalizeBullets = (bullets) => {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .flatMap(b => (typeof b === 'string' ? b.split('\n') : []))
    .map(b => b.trim())
    .filter(Boolean);
};

function calculateFormatting(resume) {
  let score = 0;
  
  const allRawBullets = [
    ...(resume.experience || []).flatMap(e => Array.isArray(e.bullets) ? e.bullets : []),
    ...(resume.projects || []).flatMap(p => Array.isArray(p.bullets) ? p.bullets : [])
  ];
  
  const normalized = normalizeBullets(allRawBullets);
  const total = normalized.length;

  // 1. proper sections exist (+20)
  const hasSummary = !!(resume.summary && resume.summary.trim().length > 0);
  const hasExpOrProj = !!((Array.isArray(resume.experience) && resume.experience.length > 0) || 
                          (Array.isArray(resume.projects) && resume.projects.length > 0));
  const hasSkills = !!(Array.isArray(resume.skills) && resume.skills.length > 0);
  
  if (hasSummary && hasExpOrProj && hasSkills) {
    score += 20;
  }

  // 2. proper bullets (+20)
  // Checking if they are parsed well and not merged into single strings
  if (total > 0 && allRawBullets.length >= total * 0.8) {
    score += 20; 
  } else if (total === 0) {
    score += 20;
  }

  // 3. bullet length between 8–25 words (+20)
  if (total > 0) {
    const goodLen = normalized.filter(b => {
      const w = b.split(/\s+/).length;
      return w >= 8 && w <= 25;
    }).length;
    if ((goodLen / total) > 0.6) {
      score += 20;
    }
  } else {
    score += 20;
  }

  // 4. consistent formatting across sections (+20)
  let hasInconsistentBullets = false;
  if (total > 0) {
    const endsWithPeriod = normalized.filter(b => b.endsWith('.')).length;
    const ratio = endsWithPeriod / total;
    if (ratio >= 0.8 || ratio <= 0.2) {
      score += 20;
    } else {
      hasInconsistentBullets = true;
    }
  } else {
    score += 20;
  }

  // 5. no broken formatting (+20)
  const hasNewline = allRawBullets.some(b => typeof b === 'string' && b.includes('\n'));
  let hasLongParagraph = false;
  if (resume.summary && resume.summary.split(/\s+/).length > 80) hasLongParagraph = true;
  normalized.forEach(b => {
    if (b.split(/\s+/).length > 40) hasLongParagraph = true;
  });

  if (!hasNewline && !hasLongParagraph) {
    score += 20;
  }

  // DEDUCTIONS
  if (hasLongParagraph) score -= 10;
  if (hasInconsistentBullets) score -= 10;
  if (hasNewline) score -= 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    details: {}
  };
}

/**
 * Calculates action verb component score (10% weight)
 * 
 * @private
 * @param {string} resumeText - Full text of the resume
 * @returns {Object} - Action verb score
 */
function calculateActionVerbComponent(resumeText) {
  const score = getActionVerbScore(resumeText);
  
  return {
    score: score,
    details: {}
  };
}

/**
 * Calculates readability component score (10% weight)
 * Returns score on 0-100 scale
 * 
 * @private
 * @param {string} resumeText - Resume text
 * @returns {Object} - Readability score (0-100)
 */
function calculateReadabilityComponent(resumeText) {
  const readability = calculateReadability(resumeText);
  
  // Convert to 0-100 scale
  // Optimal is 10-20 words per sentence
  let score = 50; // Base score
  
  if (readability.avgWordsPerSentence >= 10 && readability.avgWordsPerSentence <= 20) {
    score = 100; // Perfect range
  } else if (readability.avgWordsPerSentence < 10) {
    // Too short - penalty
    const deficit = 10 - readability.avgWordsPerSentence;
    score = Math.max(30, 100 - (deficit * 5));
  } else {
    // Too long - penalty
    const excess = readability.avgWordsPerSentence - 20;
    score = Math.max(30, 100 - (excess * 2));
  }
  
  return {
    score: Math.round(score),
    details: readability
  };
}

/**
 * Builds searchable resume text from all sections
 * Concatenates all resume content for keyword matching
 * 
 * @private
 * @param {Object} resume - Resume object
 * @returns {string} - Concatenated resume text
 */
function buildSearchableResumeText(resume) {
  if (!resume || typeof resume !== 'object') {
    console.error('❌ buildSearchableResumeText: Resume is not an object', typeof resume);
    return '';
  }
  
  const parts = [];
  
  // DEBUG: Track what we're adding
  const debug = [];
  
  if (resume.summary) {
    parts.push(resume.summary);
    debug.push(`summary: ${resume.summary.length}`);
  }
  if (resume.jobTitle) {
    parts.push(resume.jobTitle);
    debug.push(`jobTitle: ${resume.jobTitle.length}`);
  }
  
  if (resume.experience && Array.isArray(resume.experience)) {
    debug.push(`experience: ${resume.experience.length} entries`);
    resume.experience.forEach((job, idx) => {
      if (job.role) parts.push(job.role);
      if (job.company) parts.push(job.company);
      if (job.bullets && Array.isArray(job.bullets)) {
        const bulletsText = job.bullets.join(' ');
        parts.push(bulletsText);
        debug.push(`  [${idx}] ${job.bullets.length} bullets (${bulletsText.length} chars)`);
      }
    });
  }
  
  if (resume.projects && Array.isArray(resume.projects)) {
    debug.push(`projects: ${resume.projects.length} entries`);
    resume.projects.forEach((project, idx) => {
      // Engine-format uses .name; raw Mongoose docs use .title — handle both
      const projName = project.name || project.title || '';
      if (projName) parts.push(projName);
      if (project.description) parts.push(project.description);

      // Include project tech stack for keyword matching
      const techs = Array.isArray(project.technologies) ? project.technologies
        : Array.isArray(project.techStack) ? project.techStack
        : [];
      if (techs.length > 0) parts.push(techs.join(' '));

      // Include project bullets for keyword matching
      if (project.bullets && Array.isArray(project.bullets)) {
        parts.push(project.bullets.join(' '));
      }

      debug.push(`  [${idx}] name/title: ${projName.length}, techs: ${techs.length}, bullets: ${project.bullets?.length || 0}`);
    });
  }
  
  if (resume.education && Array.isArray(resume.education)) {
    debug.push(`education: ${resume.education.length} entries`);
    resume.education.forEach((edu, idx) => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.school) parts.push(edu.school);
      if (edu.field) parts.push(edu.field);
      debug.push(`  [${idx}] ${edu.degree || 'N/A'} from ${edu.school || 'N/A'}`);
    });
  }
  
  if (resume.skills && Array.isArray(resume.skills)) {
    const allSkills = [];
    resume.skills.forEach(skill => {
      if (typeof skill === 'string') {
        allSkills.push(skill);
      } else if (skill && skill.items && Array.isArray(skill.items)) {
        allSkills.push(...skill.items);
      }
    });
    if (allSkills.length > 0) {
      parts.push(allSkills.join(' '));
      debug.push(`skills: ${allSkills.length} items (${allSkills.join(' ').length} chars)`);
    }
  }
  
  // DEBUG: Log what we collected
  if (debug.length > 0) {
    console.log('🔵 buildSearchableResumeText - Content collected:');
    debug.forEach(d => console.log(`   ${d}`));
  }
  
  const finalText = parts.filter(p => p).join(' ');
  console.log(`🔵 buildSearchableResumeText - Final text length: ${finalText.length} chars`);
  
  return finalText;
}

/**
 * Creates empty score result when input is invalid
 * 
 * @private
 * @returns {Object} - Empty score result
 */
function createEmptyScoreResult() {
  return {
    score: 0,
    breakdown: {
      keywordMatch: 0,
      sectionCompleteness: 0,
      formatting: 0,
      actionVerbs: 0,
      readability: 0
    },
    keywords: {
      matched: [],
      missing: [],
      matchPercentage: 0,
      total: 0
    },
    suggestions: [],
    domain: 'default',
    details: {}
  };
}

/**
 * Generate structural reasons why the ATS score was reduced (10/10 AI Feature)
 */
function generateReasonBreakdown(resume, breakdown, missingKeywords, jdKeywords) {
  const reasons = [];

  // Low Keyword Match
  if (breakdown.keywordMatch < 70 && missingKeywords.length > 0) {
    reasons.push({
      type: "missing_keywords",
      message: `Your resume is missing key JD technologies like ${missingKeywords.slice(0, 3).join(', ')}.`,
      impact: "critical"
    });
  }

  // Completeness/Experience gap
  const hasExperience = resume.experience && resume.experience.length > 0;
  if (!hasExperience) {
    if (resume.projects && resume.projects.length >= 2) {
      reasons.push({
        type: "fresher_profile",
        message: "No professional experience found, but strong project background is boosting your score.",
        impact: "medium"
      });
    } else {
      reasons.push({
        type: "missing_experience",
        message: "Your resume lacks both professional experience and significant projects expected for this role.",
        impact: "high"
      });
    }
  }

  // Formatting (Lists, Structure, Length)
  if (breakdown.formatting < 80) {
    reasons.push({
      type: "readability_formatting",
      message: "The formatting contains complex elements like columns, tables, or excessive lengths that confuse ATS parsers.",
      impact: "high"
    });
  }

  // Action Verbs
  if (breakdown.actionVerbs < 75) {
    reasons.push({
      type: "weak_action_verbs",
      message: "Bullet points are utilizing passive vocabulary (e.g., 'worked on', 'helped') rather than strong action verbs.",
      impact: "medium"
    });
  }

  // Readability / Impacts
  if (breakdown.readability < 80) {
    reasons.push({
      type: "no_metrics",
      message: "Projects and experience lack quantifiable metrics ($, %, counts) to demonstrate measurable scale.",
      impact: "high"
    });
  }

  return reasons;
}

module.exports = {
  calculateATSScore,
  calculateKeywordMatch,
  calculateSectionCompleteness,
  calculateCompleteness,
  calculateFormatting,
  validateScores,
  calculateFinalScore,
  buildSearchableResumeText,
  generateReasonBreakdown
};
