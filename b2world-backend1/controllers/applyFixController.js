/**
 * Apply Fix Controllers - Clean Rebuild
 * Single responsibility: Update resume + recalculate score
 */

const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const ATSReport = require('../models/ATSReport');
const ATSEngineAdapter = require('../services/atsEngineAdapter');
const { rewriteResume } = require('../services/rewrite.service');
const semanticService = require('../services/semantic.service');
const { buildSearchableResumeText } = require('../services/atsScoreCalculator');
const KeywordLibrary = require('../models/KeywordLibrary');
const { detectRole } = require('./ats.controller');

// ──────────────────────────────────────────────────────────────────────────────
// SAFETY: Strip known bad metric phrases before writing to resume
// ──────────────────────────────────────────────────────────────────────────────
const BAD_METRIC_PATTERNS = [
  /,?\s*resulting in \d+[x%+k,]+\s*improvement/gi,
  /,?\s*resulting in enterprise-scale improvement/gi,
  /,?\s*resulting in [\w.-]+\+?\s*improvement/gi,
  /,?\s*resulting in \d+[x%+k,]+.*$/gi,
  // ML metrics injected into unrelated bullets (e.g. Git/documentation bullets)
  /,?\s*achieving \d+%\s*model accuracy[^.]*\.?/gi,
  /,?\s*reducing inference latency by \d+%\.?/gi,
  // Other known bad fallbacks
  /,?\s*delivering measurable business value\.?$/gi,
];

const sanitizeBullet = (text) => {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;
  for (const pattern of BAD_METRIC_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Fix double punctuation/spaces
  cleaned = cleaned.replace(/\.\s*\./g, '.').replace(/,\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
  // Ensure proper sentence ending
  if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += '.';
  return cleaned;
};

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: Apply a suggestion to resume object (in-memory)
// ──────────────────────────────────────────────────────────────────────────────
// Handles all section types: skills, experience, projects, summary
// Prevents duplicates and properly applies improvements

const applySuggestionToResume = (resume, suggestion) => {
  const { section, itemIndex, bulletIndex, improvedText, originalText } = suggestion;
  
  if (!section || !improvedText) {
    return { success: false, reason: 'Missing section or improvedText' };
  }

  try {
    switch (section) {
      // ─────────────────────────────────────────────────────────────
      // SKILLS: Add keyword safely (no duplicates)
      // ─────────────────────────────────────────────────────────────
      case 'skills': {
        if (!resume.skills) resume.skills = [];
        
        // Check if skill already exists
        const skillExists = (resume.skills || []).some(s => {
          if (typeof s === 'string') {
            return s.toLowerCase().includes(improvedText.toLowerCase());
          }
          if (s.items && Array.isArray(s.items)) {
            return s.items.some(i => String(i).toLowerCase().includes(improvedText.toLowerCase()));
          }
          if (s.category && s.items) {
            return s.items.some(i => String(i).toLowerCase().includes(improvedText.toLowerCase()));
          }
          return false;
        });

        if (skillExists) {
          return { success: true, skipped: true, reason: 'Skill already exists' };
        }

        // Add to first category if it exists with items structure
        if (resume.skills.length > 0 && resume.skills[0]?.items) {
          resume.skills[0].items.push(improvedText);
        } else {
          // Otherwise create new skill object or push string
          if (resume.skills.length > 0 && typeof resume.skills[0] === 'string') {
            resume.skills.push(improvedText);
          } else if (resume.skills.length > 0 && resume.skills[0].category) {
            resume.skills[0].items = resume.skills[0].items || [];
            resume.skills[0].items.push(improvedText);
          } else {
            resume.skills.push({ category: 'Technical Skills', items: [improvedText] });
          }
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // SUMMARY: Replace summary completely
      // ─────────────────────────────────────────────────────────────
      case 'summary': {
        const oldLength = (resume.summary || '').length;
        resume.summary = improvedText;
        
        if (oldLength > 50) {
          return { success: true, skipped: false, reason: 'Summary updated' };
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // EXPERIENCE: Replace or add bullet
      // ─────────────────────────────────────────────────────────────
      case 'experience': {
        if (!resume.experience || !resume.experience[itemIndex]) {
          return { success: false, reason: `Invalid experience index: ${itemIndex}` };
        }

        const exp = resume.experience[itemIndex];
        if (!exp.bullets) exp.bullets = [];

        const cleanImprovedText = sanitizeBullet(improvedText);

        if (bulletIndex !== undefined && bulletIndex >= 0 && bulletIndex < exp.bullets.length) {
          // REPLACE existing bullet
          exp.bullets[bulletIndex] = cleanImprovedText;
        } else if (bulletIndex !== undefined && bulletIndex === exp.bullets.length) {
          // APPEND at end
          exp.bullets.push(cleanImprovedText);
        } else {
          // ADD new bullet
          exp.bullets.push(cleanImprovedText);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // PROJECTS: Replace or add bullet
      // ─────────────────────────────────────────────────────────────
      case 'projects': {
        if (!resume.projects || !resume.projects[itemIndex]) {
          return { success: false, reason: `Invalid projects index: ${itemIndex}` };
        }

        const project = resume.projects[itemIndex];
        if (!project.bullets) project.bullets = [];

        const cleanProjectText = sanitizeBullet(improvedText);

        if (bulletIndex !== undefined && bulletIndex >= 0 && bulletIndex < project.bullets.length) {
          // REPLACE existing bullet
          project.bullets[bulletIndex] = cleanProjectText;
        } else if (bulletIndex !== undefined && bulletIndex === project.bullets.length) {
          // APPEND at end
          project.bullets.push(cleanProjectText);
        } else {
          // ADD new bullet
          project.bullets.push(cleanProjectText);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // EDUCATION: Handle education updates
      // ─────────────────────────────────────────────────────────────
      case 'education': {
        if (!resume.education || resume.education.length === 0) {
          resume.education = [];
        }

        const parts = improvedText.split(',').map(p => p.trim());
        const degree = parts[0] || 'N/A';
        const institution = parts[1] || 'N/A';
        const year = parts[2] || 'N/A';

        if (!resume.education[itemIndex]) {
          // Create new education entry ensuring MongoDB validation passes
          resume.education[itemIndex] = {
            degree: degree,
            institution: institution,
            year: year,
            description: improvedText
          };
        } else {
          // Update existing entry with parsed values
          resume.education[itemIndex].degree = degree;
          resume.education[itemIndex].institution = institution;
          resume.education[itemIndex].year = year;
          resume.education[itemIndex].description = improvedText;
        }

        break;
      }

      // ─────────────────────────────────────────────────────────────
      // CERTIFICATIONS: Handle certifications updates
      // ─────────────────────────────────────────────────────────────
      case 'certifications': {
        if (!resume.certifications) resume.certifications = [];

        if (itemIndex !== undefined && itemIndex >= 0 && resume.certifications[itemIndex]) {
          const cert = resume.certifications[itemIndex];
          cert.name = improvedText;
        } else {
          // Add new certification
          resume.certifications.push({
            name: improvedText,
            issuer: '',
            date: new Date().toISOString().split('T')[0]
          });
        }
        break;
      }

      default:
        return { success: false, reason: `Unknown section: ${section}` };
    }

    return { success: true, skipped: false, reason: 'Suggestion applied successfully' };
  } catch (error) {
    console.error('[applySuggestionToResume] Error:', error);
    return { success: false, reason: error.message };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// APPLY SINGLE SUGGESTION
// ──────────────────────────────────────────────────────────────────────────────

const applySuggestion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      resumeId, 
      jdId,
      jobDescriptionId,  // REQUIRED: Must be passed from frontend
      section, 
      itemIndex, 
      bulletIndex, 
      improvedText, 
      suggestedText, 
      currentText 
    } = req.body;
    const resolvedJdId = jdId || jobDescriptionId;
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[applySuggestion] START [${operationId}]`);
    console.log(`[applySuggestion] Input: resumeId=${resumeId}, jdId=${jobDescriptionId}, section=${section}`);

    // VALIDATE REQUIRED FIELDS
    if (!resumeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: resumeId',
      });
    }

    if (!resolvedJdId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: jobDescriptionId. Frontend must pass the JD ID being used for scoring.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid resume ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedJdId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid jobDescriptionId format' });
    }

    // VALIDATE SUGGESTION - Must have section and improvedText/suggestedText
    console.log(`[applySuggestion] Validating suggestion: section=${section}, improvedText=${improvedText}, suggestedText=${suggestedText}`);
    
    if (!section) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: section (must be "skills", "experience", "projects", or "summary")',
      });
    }

    if (!improvedText && !suggestedText) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: improvedText or suggestedText',
      });
    }

    const suggestion = {
      section,
      itemIndex: itemIndex ?? undefined,
      bulletIndex: bulletIndex ?? undefined,
      improvedText: improvedText || suggestedText,
      currentText,
    };

    console.log(`[applySuggestion] ✓ Suggestion validated:`, {
      section: suggestion.section,
      itemIndex: suggestion.itemIndex,
      bulletIndex: suggestion.bulletIndex,
      improvedTextLength: suggestion.improvedText?.length,
      currentTextLength: suggestion.currentText?.length
    });

    // STEP 0: Fetch JobDescription FIRST (before anything else)
    // This ensures we have the correct JD and fail fast if it doesn't exist
    console.log(`[applySuggestion] STEP 0: Fetching JobDescription by ID=${resolvedJdId}...`);
    const jd = await JobDescription.findOne({ _id: resolvedJdId }).session(session);
    if (!jd) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: `Job Description not found. Please re-link the JD from the ATS Score page.` 
      });
    }
    console.log(`[applySuggestion] ✓ JobDescription fetched: ${jd._id}, JD title: "${jd.jobTitle || jd.title || 'N/A'}"`);

    // STEP 1: Fetch latest resume
    console.log(`[applySuggestion] STEP 1: Fetching resume from DB...`);
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!resume) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    console.log(`[applySuggestion] ✓ Resume fetched: _id=${resume._id}`);

    // STEP 2: Validate suggestion
    console.log(`[applySuggestion] STEP 2: Validating suggestion...`);
    console.log(`[applySuggestion] ✓ Suggestion valid: section=${suggestion.section}`);

    // STEP 3 & 4: Apply suggestion (with double-apply prevention)
    console.log(`[applySuggestion] STEP 3: Applying suggestion...`);
    console.log(`[applySuggestion] STEP 4: Checking for double-apply...`);
    
    let applyResult = { success: false, reason: 'Unknown error' };
    const suggestionType = suggestion.type || '';
    const suggestionText = suggestion.improvedText || suggestion.suggestedText || improvedText || '';
    
    // ── CASE 1: Keyword suggestion — extract keywords and add to skills ──
    if (
      suggestionType === 'keyword' ||
      suggestionType === 'missing_keyword' ||
      suggestionText.toLowerCase().startsWith('add missing keywords:') ||
      suggestionText.toLowerCase().startsWith('add more')
    ) {
      // Parse "Add missing keywords: Docker, Kubernetes, CI/CD" → ['Docker', 'Kubernetes', 'CI/CD']
      let keywordsPart = suggestionText.replace(/^add (missing |more |job description )?keywords?[:\s]*/i, '').trim();
      const cleanPart = keywordsPart.split(/\bto\b/i)[0].trim();
      const keywords = cleanPart
        .split(/[,;]+/)
        .map(k => k.trim())
        .filter(k => k.length > 1 && k.length < 50 && !/improve|match|ats|score|resume/i.test(k));
      
      if (keywords.length === 0) {
        console.log(`[applySuggestion] ⚠ No parseable keywords from: "${suggestionText.substring(0, 50)}..."`);
        applyResult = { success: true, reason: 'No valid keywords found', skipped: true };
      } else {
        // Ensure skills array and first category exist
        if (!resume.skills) resume.skills = [];
        if (resume.skills.length === 0) {
          resume.skills.push({ category: 'Technical Skills', items: [] });
        }
        const skillCat = resume.skills.find(s => s.items) || resume.skills[0];
        if (!skillCat.items) skillCat.items = [];
        
        let addedAny = false;
        for (const kw of keywords) {
          const alreadyExists = skillCat.items.some(
            existing => existing.toLowerCase() === kw.toLowerCase()
          );
          if (!alreadyExists) {
            skillCat.items.push(kw);
            addedAny = true;
            console.log(`[applySuggestion] ✓ Added keyword to skills: "${kw}"`);
          }
        }
        if (addedAny) {
          resume.markModified('skills');
          applyResult = { success: true, skipped: false, reason: 'Keywords added' };
        } else {
          applyResult = { success: true, skipped: true, reason: 'All keywords already exist' };
        }
      }
    }
    // ── CASE 2: Section completeness / advisory — skip, cannot auto-apply ──
    else if (
      suggestionType === 'completeness' ||
      suggestionType === 'suggestion' ||
      suggestionText.toLowerCase().startsWith('add missing sections') ||
      suggestionText.toLowerCase().startsWith('use stronger action verbs') ||
      suggestionText.toLowerCase().startsWith('improve bullet point structure')
    ) {
      console.log(`[applySuggestion] ⚠ Skipping advisory suggestion (type: ${suggestionType})`);
      applyResult = { success: true, skipped: true, reason: 'Advisory suggestion cannot be auto-applied' };
    }
    // ── CASE 3: Specific section/index suggestions (existing logic) ──
    else {
      applyResult = applySuggestionToResume(resume, suggestion);
    }
    
    if (applyResult.skipped) {
      await session.abortTransaction();
      session.endSession();
      console.log(`[applySuggestion] ⊘ Suggestion already applied (skipped)`);
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Suggestion already applied',
      });
    }

    if (!applyResult.success) {
      throw new Error(applyResult.reason || 'Failed to apply suggestion');
    }
    console.log(`[applySuggestion] ✓ Suggestion applied successfully`);

    // STEP 5: Save resume
    console.log(`[applySuggestion] STEP 5: Saving resume to DB...`);
    await resume.save({ session });
    console.log(`[applySuggestion] ✓ Resume saved to DB`);

    // DEBUG: Log saved resume structure
    console.log(`[applySuggestion] DEBUG - Resume structure after save:`);
    console.log(`[applySuggestion]   - Summary: ${resume.summary ? `"${resume.summary.substring(0, 50)}..."` : 'MISSING'}`);
    console.log(`[applySuggestion]   - Skills: ${resume.skills?.length || 0} categories`);
    if (resume.skills && resume.skills.length > 0) {
      resume.skills.forEach((cat, idx) => {
        console.log(`[applySuggestion]     - [${idx}] ${cat.category}: ${cat.items?.length || 0} items`);
        if (cat.items?.length > 0) {
          console.log(`[applySuggestion]        Items: ${cat.items.slice(0, 3).join(', ')}`);
        }
      });
    }
    console.log(`[applySuggestion]   - Experience: ${resume.experience?.length || 0} entries`);
    if (resume.experience && resume.experience.length > 0) {
      resume.experience.forEach((exp, idx) => {
        console.log(`[applySuggestion]     - [${idx}] ${exp.company} / ${exp.role}: ${exp.bullets?.length || 0} bullets`);
      });
    }
    console.log(`[applySuggestion]   - Projects: ${resume.projects?.length || 0} entries`);

    // STEP 6: RE-FETCH resume from DB (CRITICAL - fresh data)
    console.log(`[applySuggestion] STEP 6: RE-FETCHING resume from DB (CRITICAL step)...`);
    const freshResume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!freshResume) {
      throw new Error('Resume lost after save (critical error)');
    }
    console.log(`[applySuggestion] ✓ Resume re-fetched from DB (fresh data)`);

    // DEBUG: Log re-fetched resume to verify it matches saved data
    console.log(`[applySuggestion] DEBUG - Resume structure after refetch:`);
    console.log(`[applySuggestion]   - Summary: ${freshResume.summary ? `"${freshResume.summary.substring(0, 50)}..."` : 'MISSING'}`);
    console.log(`[applySuggestion]   - Skills: ${freshResume.skills?.length || 0} categories`);
    if (freshResume.skills && freshResume.skills.length > 0) {
      freshResume.skills.forEach((cat, idx) => {
        console.log(`[applySuggestion]     - [${idx}] ${cat.category}: ${cat.items?.length || 0} items`);
        if (cat.items?.length > 0) {
          console.log(`[applySuggestion]        Items: ${cat.items.slice(0, 3).join(', ')}`);
        }
      });
    }
    console.log(`[applySuggestion]   - Experience: ${freshResume.experience?.length || 0} entries`);
    console.log(`[applySuggestion]   - Projects: ${freshResume.projects?.length || 0} entries`);
    
    // DEBUG: Verify section was actually updated
    if (suggestion.section === 'skills') {
      console.log(`[applySuggestion] DEBUG - SKILLS SECTION VERIFICATION`);
      console.log(`[applySuggestion]   - Expected skill added: "${suggestion.improvedText}"`);
      const skillsText = (freshResume.skills || []).flatMap(s => s.items || []).join(', ');
      console.log(`[applySuggestion]   - All skills now: ${skillsText || 'EMPTY'}`);
      console.log(`[applySuggestion]   - Skill present? ${skillsText.toLowerCase().includes(suggestion.improvedText.toLowerCase())}`);
    } else if (suggestion.section === 'experience') {
      console.log(`[applySuggestion] DEBUG - EXPERIENCE SECTION VERIFICATION`);
      console.log(`[applySuggestion]   - Expected bullet added: "${suggestion.improvedText}"`);
      const expIdx = suggestion.itemIndex;
      if (freshResume.experience?.[expIdx]?.bullets?.[suggestion.bulletIndex]) {
        const actualBullet = freshResume.experience[expIdx].bullets[suggestion.bulletIndex];
        console.log(`[applySuggestion]   - Actual bullet: "${actualBullet}"`);
        console.log(`[applySuggestion]   - Matches? ${actualBullet === suggestion.improvedText}`);
      }
    }

    // STEP 7: Recalculate ATS score (using FRESH resume and PROVIDED JD)
    console.log(`[applySuggestion] STEP 7: Recalculating ATS score (using FRESH resume + correct JD)...`);
    
    // DEBUG: Validate resume structure before scoring
    console.log(`[applySuggestion] DEBUG - Resume structure validation BEFORE scoring:`);
    console.log(`[applySuggestion]   - Resume has summary? ${!!freshResume.summary} (length: ${freshResume.summary?.length || 0})`);
    console.log(`[applySuggestion]   - Resume has experience? ${!!freshResume.experience} (${freshResume.experience?.length || 0} entries)`);
    if (freshResume.experience && freshResume.experience.length > 0) {
      freshResume.experience.forEach((exp, idx) => {
        console.log(`[applySuggestion]     [${idx}] ${exp.company}/${exp.role}: ${exp.bullets?.length || 0} bullets`);
        if (exp.bullets?.length > 0) {
          console.log(`[applySuggestion]         First bullet: "${exp.bullets[0].substring(0, 60)}..."`);
        }
      });
    }
    console.log(`[applySuggestion]   - Resume has projects? ${!!freshResume.projects} (${freshResume.projects?.length || 0} entries)`);
    console.log(`[applySuggestion]   - Resume has skills? ${!!freshResume.skills} (${freshResume.skills?.length || 0} categories)`);
    console.log(`[applySuggestion]   - Resume has education? ${!!freshResume.education} (${freshResume.education?.length || 0} entries)`);
    
    // Validate resume is not empty
    const hasContent = !!(freshResume.summary?.trim() || freshResume.experience?.length || freshResume.skills?.length || freshResume.education?.length);
    if (!hasContent) {
      console.error(`[applySuggestion] ❌ CRITICAL: Resume is empty before scoring!`);
      throw new Error('Resume content is missing. Cannot calculate ATS score on empty resume.');
    }
    
    const scoreResult = ATSEngineAdapter.scoreResume(freshResume, jd);
    
    // Validate score result
    if (!scoreResult) {
      console.error(`[applySuggestion] ❌ CRITICAL: scoreResume returned null/undefined!`);
      throw new Error('ATS Engine failed to return score result');
    }
    
    if (scoreResult.score === 0 && !scoreResult.breakdown.keywordMatch && !scoreResult.breakdown.sectionCompleteness) {
      console.error(`[applySuggestion] ⚠️ WARNING: Score is 0 across all metrics!`);
      console.error(`[applySuggestion]   Breakdown:`, scoreResult.breakdown);
      console.error(`[applySuggestion]   Keywords: matched=${scoreResult.keywords?.matched?.length}, missing=${scoreResult.keywords?.missing?.length}`);
    }
    
    console.log(`[applySuggestion] ✓ Score calculated: ${scoreResult.score}`);
    console.log(`[applySuggestion]   Breakdown: keyword=${scoreResult.breakdown.keywordMatch}, completeness=${scoreResult.breakdown.sectionCompleteness}, formatting=${scoreResult.breakdown.formatting}, verbs=${scoreResult.breakdown.actionVerbs}, readability=${scoreResult.breakdown.readability}`);

    // STEP 8: Regenerate suggestions
    console.log(`[applySuggestion] STEP 8: Regenerating suggestions...`);
    const formattedSuggestions = ATSEngineAdapter.formatSuggestionsForAPI(scoreResult.suggestions || []);
    const allSuggestions = formattedSuggestions.map(s => ({
      id: s.id || `sugg-${Math.random().toString(36).substr(2, 9)}`,
      section: s.section || '',
      itemIndex: s.itemIndex ?? s.targetIndex?.itemIndex,
      bulletIndex: s.bulletIndex ?? s.targetIndex?.bulletIndex,
      currentText: s.currentText || '',
      improvedText: s.improvedText || '',
      impact: s.impact || 'medium',
      reason: s.reason || '',
      type: s.type || 'content',
    }));
    console.log(`[applySuggestion] ✓ Generated ${allSuggestions.length} suggestions`);

    // STEP 9: Save ATS Report (using PROVIDED jdId, not stale value)
    console.log(`[applySuggestion] STEP 9: Saving new ATSReport with jdId=${jobDescriptionId}...`);

    // ✅ CRITICAL FIX: Transform breakdown to nested schema format before saving
    // Raw format: { keywordMatch, sectionCompleteness, formatting, actionVerbs, readability }
    // Schema format: { keywordMatchScore: { score, weight }, sectionCompletenessScore: ... }
    const transformedBreakdown = ATSEngineAdapter.transformBreakdownForATSReport(
      scoreResult.breakdown,
      scoreResult.details
    );

    // ✅ CRITICAL FIX: Build flat breakdown for frontend display
    // Frontend reads: keywordMatch, formatting, completeness, actionVerbs, readability
    const frontendBreakdown = {
      keywordMatch: scoreResult.breakdown?.keywordMatch || 0,
      formatting: scoreResult.breakdown?.formatting || 0,
      completeness: scoreResult.breakdown?.sectionCompleteness || 0,
      actionVerbs: scoreResult.breakdown?.actionVerbs || 0,
      readability: scoreResult.breakdown?.readability || 0,
    };

    await ATSReport.create([{
      resumeId: freshResume._id,
      userId: req.user._id,
      jdId: jobDescriptionId,
      totalScore: scoreResult.score,
      breakdown: transformedBreakdown,
      suggestions: allSuggestions,
      missingKeywords: scoreResult.keywords?.missing || [],
      overallFeedback: {},
      generatedAt: new Date(),
    }], { session });

    await Resume.updateOne({ _id: freshResume._id }, { atsScore: scoreResult.score }, { session });
    console.log(`[applySuggestion] ✓ ATSReport saved with transformed breakdown`);

    // STEP 10: Return response
    console.log(`[applySuggestion] STEP 10: Returning response...`);
    await session.commitTransaction();
    session.endSession();

    console.log(`[applySuggestion] ✅ SUCCESS [${operationId}]`);

    return res.status(200).json({
      success: true,
      data: {
        updatedScore: scoreResult.score,
        updatedBreakdown: frontendBreakdown,
        updatedSuggestions: allSuggestions,
        missingKeywords: scoreResult.keywords?.missing || [],
        overallFeedback: scoreResult.details || {},
      },
    });
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) {}
    session.endSession();
    console.error('[applySuggestion] ERROR:', error.message);
    return res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// APPLY ALL SUGGESTIONS (batch)
// ──────────────────────────────────────────────────────────────────────────────

const applyAllSuggestions = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      resumeId,
      jdId,
      jobDescriptionId  // REQUIRED: Must be passed from frontend
    } = req.body;
    const resolvedJdId = jdId || jobDescriptionId;
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[applyAllSuggestions] START [${operationId}]`);
    console.log(`[applyAllSuggestions] Input: resumeId=${resumeId}, jdId=${jobDescriptionId}`);

    // VALIDATE REQUIRED FIELDS
    if (!resumeId || !mongoose.Types.ObjectId.isValid(resumeId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid resumeId' });
    }

    if (!resolvedJdId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: jobDescriptionId. Frontend must pass the JD ID being used for scoring.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedJdId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid jobDescriptionId format' });
    }

    // STEP 0: Fetch JobDescription FIRST (before anything else)
    console.log(`[applyAllSuggestions] STEP 0: Fetching JobDescription by ID=${resolvedJdId}...`);
    const jd = await JobDescription.findOne({ _id: resolvedJdId }).session(session);
    if (!jd) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: `Job Description not found. Please re-link the JD from the ATS Score page.` 
      });
    }
    console.log(`[applyAllSuggestions] ✓ JobDescription fetched: ${jd._id}, JD title: "${jd.jobTitle || jd.title || 'N/A'}"`);

    // STEP 1: Fetch resume
    console.log(`[applyAllSuggestions] STEP 1: Fetching resume...`);
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!resume) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    console.log(`[applyAllSuggestions] ✓ Resume fetched: _id=${resume._id}`);

    // Get suggestions from latest report
    console.log(`[applyAllSuggestions] Fetching latest suggestions...`);
    const latestReport = await ATSReport.findOne({ resumeId })
      .sort({ createdAt: -1 })
      .session(session);

    const suggestions = latestReport?.suggestions || [];
    console.log(`[applyAllSuggestions] Found ${suggestions.length} suggestions to apply`);

    if (suggestions.length === 0) {
      await session.abortTransaction();
      session.endSession();
      console.log(`[applyAllSuggestions] No valid suggestions to apply`);
      return res.status(200).json({
        success: true,
        data: {
          appliedCount: 0,
          updatedSuggestions: [],
        },
      });
    }

    let appliedCount = 0;

    // 🔥 NEW: Trigger DEEP AI REWRITE instead of shallow suggestion loop
    console.log(`[applyAllSuggestions] STEP 2: Triggering Deep AI Rewrite...`);
    
    // Get missing keywords and stats
    const originalResult = ATSEngineAdapter.scoreResume(resume, jd);
    const atsBreakdown = originalResult.breakdown || {};
    const skillGap = {
      missing: originalResult.keywords?.missing || [],
      present: originalResult.keywords?.matched || []
    };

    // Load KeywordLibrary
    let keywordsLibrary = [];
    try {
      const role = jd.roleDetected || '';
      if (role) {
        const libDoc = await KeywordLibrary.findOne({
          role: { $regex: new RegExp(role, 'i') },
          isActive: true
        });
        if (libDoc) keywordsLibrary = libDoc.keywords.map(k => k.term);
      }
    } catch (err) { console.warn('KeywordLibrary lookup failed'); }

    // Call deep rewrite
    const rewriteResult = await rewriteResume({
      resume: resume.toObject ? resume.toObject() : resume,
      jd: { description: jd.jdText, detectedRole: jd.roleDetected || detectRole(jd.jdText) },
      atsBreakdown,
      skillGap,
      keywordsLibrary
    });

    // Apply rewrite results to resume
    if (rewriteResult.summary) resume.summary = rewriteResult.summary;
    if (rewriteResult.projects?.length) {
      resume.projects = rewriteResult.projects.map((rp, i) => {
        const original = resume.projects?.[i] || {};
        return {
          ...original,
          title: rp.title || rp.name || original.title || '',
          bullets: rp.bullets.length ? rp.bullets : (original.bullets || [])
        };
      });
    }
    if (rewriteResult.skills?.added?.length) {
      if (!resume.skills) resume.skills = [];
      const existingItems = resume.skills.flatMap(s => s.items || []);
      const newItems = rewriteResult.skills.added.filter(
        sk => !existingItems.some(e => e.toLowerCase() === sk.toLowerCase())
      );
      if (newItems.length) {
        resume.skills.push({ category: 'AI Optimized Skills', items: newItems });
      }
    }

    appliedCount = 1; // Mark as changed
    console.log(`[applyAllSuggestions] ✓ AI Rewrite completed and applied.`);

    console.log(`[applyAllSuggestions] ✓ Applied ${appliedCount} suggestions in memory`);

    if (appliedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      console.log(`[applyAllSuggestions] No changes made`);
      return res.status(200).json({
        success: true,
        data: { appliedCount: 0, updatedSuggestions: [] },
      });
    }

    // STEP 4: Save resume ONCE
    console.log(`[applyAllSuggestions] STEP 3: Saving resume (single save)...`);
    await resume.save({ session });
    console.log(`[applyAllSuggestions] ✓ Resume saved to DB`);

    // DEBUG: Log saved resume structure
    console.log(`[applyAllSuggestions] DEBUG - Resume structure after save:`);
    console.log(`[applyAllSuggestions]   - Skills: ${resume.skills?.length || 0} categories`);
    if (resume.skills && resume.skills.length > 0) {
      resume.skills.forEach((cat, idx) => {
        console.log(`[applyAllSuggestions]     - [${idx}] ${cat.category}: ${cat.items?.length || 0} items`);
      });
    }
    console.log(`[applyAllSuggestions]   - Experience bullets updated: ${appliedCount} changes applied`);

    // STEP 5: Re-fetch resume from DB (CRITICAL - fresh data)
    console.log(`[applyAllSuggestions] STEP 4: RE-FETCHING resume from DB...`);
    const freshResume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).session(session);
    if (!freshResume) {
      throw new Error('Resume lost after save (critical error)');
    }
    console.log(`[applyAllSuggestions] ✓ Resume re-fetched from DB (fresh data)`);

    // DEBUG: Log re-fetched resume
    console.log(`[applyAllSuggestions] DEBUG - Resume structure after refetch:`);
    console.log(`[applyAllSuggestions]   - Skills: ${freshResume.skills?.length || 0} categories`);
    if (freshResume.skills && freshResume.skills.length > 0) {
      freshResume.skills.forEach((cat, idx) => {
        console.log(`[applyAllSuggestions]     - [${idx}] ${cat.category}: ${cat.items?.length || 0} items`);
      });
    }

    // STEP 6: Recalculate score ONCE (using FRESH resume and PROVIDED JD)
    console.log(`[applyAllSuggestions] STEP 5: Recalculating ATS score (using FRESH resume + correct JD)...`);
    const scoreResult = ATSEngineAdapter.scoreResume(freshResume, jd);
    console.log(`[applyAllSuggestions] ✓ Score calculated: ${scoreResult.score}`);

    // STEP 7: Regenerate suggestions (from evaluation result)
    console.log(`[applyAllSuggestions] STEP 6: Regenerating suggestions...`);
    const formattedNewSuggestions = ATSEngineAdapter.formatSuggestionsForAPI(scoreResult.suggestions || []);
    const updatedSuggestions = formattedNewSuggestions.map(s => ({
      id: s.id || `sugg-${Math.random().toString(36).substr(2, 9)}`,
      section: s.section || '',
      itemIndex: s.itemIndex ?? s.targetIndex?.itemIndex,
      bulletIndex: s.bulletIndex ?? s.targetIndex?.bulletIndex,
      currentText: s.currentText || '',
      improvedText: s.improvedText || '',
      impact: s.impact || 'medium',
      reason: s.reason || '',
      type: s.type || 'content',
    }));
    console.log(`[applyAllSuggestions] ✓ Generated ${updatedSuggestions.length} new suggestions`);

    // STEP 8: Save new report (using PROVIDED jdId, not stale value)
    console.log(`[applyAllSuggestions] STEP 7: Saving new ATSReport with jdId=${jobDescriptionId}...`);

    // ✅ CRITICAL FIX: Transform breakdown to nested schema format before saving
    const transformedBreakdown = ATSEngineAdapter.transformBreakdownForATSReport(
      scoreResult.breakdown,
      scoreResult.details
    );

    // ✅ CRITICAL FIX: Build flat breakdown for frontend display
    const frontendBreakdown = {
      keywordMatch: scoreResult.breakdown?.keywordMatch || 0,
      formatting: scoreResult.breakdown?.formatting || 0,
      completeness: scoreResult.breakdown?.sectionCompleteness || 0,
      actionVerbs: scoreResult.breakdown?.actionVerbs || 0,
      readability: scoreResult.breakdown?.readability || 0,
    };

    await ATSReport.create([{
      resumeId: freshResume._id,
      userId: req.user._id,
      jdId: jobDescriptionId,
      totalScore: scoreResult.score,
      breakdown: transformedBreakdown,
      suggestions: updatedSuggestions,
      missingKeywords: scoreResult.keywords?.missing || [],
      overallFeedback: {},
      generatedAt: new Date(),
    }], { session });

    await Resume.updateOne({ _id: freshResume._id }, { atsScore: scoreResult.score }, { session });

    await session.commitTransaction();
    session.endSession();

    console.log(`[applyAllSuggestions] ✅ SUCCESS - Applied ${appliedCount} suggestions, saved once, recalc once, score: ${scoreResult.score} [${operationId}]`);

    return res.status(200).json({
      success: true,
      data: {
        appliedCount,
        updatedScore: scoreResult.score,
        updatedBreakdown: frontendBreakdown,
        updatedSuggestions,
        missingKeywords: scoreResult.keywords?.missing || [],
        overallFeedback: scoreResult.details || {},
      },
    });
  } catch (error) {
    try { await session.abortTransaction(); } catch (_) {}
    session.endSession();
    console.error('[applyAllSuggestions] ERROR:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { applySuggestion, applyAllSuggestions };