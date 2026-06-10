const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const ResumeParserService = require('../services/resumeParser.service');
const cacheHelper = require('../utils/cacheHelper');

const isFilled = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.length > 0 && val.some(isFilled);
  if (typeof val === 'object') return Object.values(val).some(isFilled);
  return true;
};

const cleanArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item) => isFilled(item));
};

// ✅ CRITICAL: Filter out incomplete nested objects (missing required fields)
const validateAndCleanExperience = (experience) => {
  if (!Array.isArray(experience)) return [];
  return experience.filter(exp => 
    exp && 
    typeof exp === 'object' && 
    (exp.company || '').trim() !== '' && 
    (exp.role || '').trim() !== '' &&
    (exp.startDate || '').trim() !== ''
  );
};

const validateAndCleanProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects.filter(proj => 
    proj && 
    typeof proj === 'object' && 
    (proj.title || '').trim() !== ''
  );
};

const validateAndCleanEducation = (education) => {
  if (!Array.isArray(education)) return [];
  return education.filter(edu => 
    edu && 
    typeof edu === 'object' && 
    (edu.institution || '').trim() !== '' && 
    (edu.degree || '').trim() !== ''
  );
};

const validateAndCleanCertifications = (certs) => {
  if (!Array.isArray(certs)) return [];
  return certs.filter(cert => 
    cert && 
    typeof cert === 'object' && 
    (cert.name || '').trim() !== ''
  );
};

const normalizeSkills = (skills) => {
  if (!skills) return [];
  if (typeof skills === 'string') {
    return [{ category: 'General', items: skills.split(',').map(s => s.trim()).filter(Boolean) }];
  }
  if (!Array.isArray(skills)) return [];
  return skills.filter(s => isFilled(s));
};

/**
 * normalizeAchievements — THE single source of truth for achievements.
 *
 * Accepts both sources that could arrive in req.body:
 *   body.achievementsText  — textarea string from current frontend (one line per bullet)
 *   body.achievements      — legacy array (strings or objects) for backwards compat
 *
 * Always returns: clean string[]  e.g. ["Won hackathon 2023", "Published IEEE paper"]
 * Safe for: undefined, null, "", whitespace-only, mixed formats.
 */
const normalizeAchievements = (achievementsText, achievementsArray) => {
  const seen = new Set();
  const lines = [];

  const add = (line) => {
    const clean = String(line).replace(/^[\s\u2022\-\*]+/, '').trim();
    if (clean && !seen.has(clean)) { seen.add(clean); lines.push(clean); }
  };

  // Source 1: textarea string (primary — current frontend sends this)
  if (typeof achievementsText === 'string' && achievementsText.trim()) {
    achievementsText.split('\n').forEach(add);
  }

  // Source 2: array fallback (legacy API calls, old data)
  if (Array.isArray(achievementsArray)) {
    achievementsArray.forEach(a => {
      if (!a) return;
      if (typeof a === 'string') { add(a); return; }
      if (typeof a === 'object') {
        const title = (a.title || '').trim();
        const desc  = (a.description || '').trim();
        add(desc ? `${title}: ${desc}` : title);
      }
    });
  }

  return lines;
};

// ── CREATE ───────────────────────────────────────────────────────────────────
const createResume = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const body = req.body || {};
    const achievements = normalizeAchievements(body.achievementsText, body.achievements);

    const resumeData = {
      userId:    req.user._id,
      resumeTitle: body.resumeTitle || 'Untitled Resume',
      personalInfo: {
        fullName:  body.personalInfo?.fullName  || 'Your Name',
        email:     body.personalInfo?.email     || 'email@example.com',
        phone:     body.personalInfo?.phone     || '',
        location:  body.personalInfo?.location  || '',
        linkedin:  body.personalInfo?.linkedin  || '',
        github:    body.personalInfo?.github    || '',
        portfolio: body.personalInfo?.portfolio || '',
      },
      summary:        body.summary || '',
      skills:         normalizeSkills(body.skills),
      experience:     validateAndCleanExperience(body.experience),
      projects:       validateAndCleanProjects(body.projects),
      education:      validateAndCleanEducation(body.education),
      certifications: validateAndCleanCertifications(body.certifications),
      achievements,                                      // ← FIXED
      languages:     Array.isArray(body.languages) ? body.languages.filter(isFilled) : [],
      templateId:    body.templateId || 'classic',
      isPublic:      body.isPublic ?? false,
      downloadCount: 0,
    };

    const resume = new Resume(resumeData);
    await resume.save();

    console.log("✅ RESUME SAVED SUCCESSFULLY:", { _id: resume._id, userId: resume.userId, title: resume.resumeTitle });
    return res.status(201).json({ success: true, message: 'Resume created successfully', data: { resume } });
  } catch (error) {
    console.error('🔥 CREATE RESUME ERROR:', error.message);
    console.error('🔥 ERROR STACK:', error.stack);
    console.error('🔥 VALIDATION ERRORS:', error.errors ? Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`).join(', ') : 'NONE');
    return res.status(500).json({ success: false, message: error.message || 'Failed to create resume' });
  }
};

// ── GET ALL ──────────────────────────────────────────────────────────────────
const getMyResumes = async (req, res) => {
  try {
    // CRITICAL FIX: Cast to ObjectId — req.user._id may be a plain string
    // when the user object is restored from Redis cache (JSON.parse loses the
    // ObjectId type). Aggregation $match does NOT auto-cast unlike findOne().
    const userId = new mongoose.Types.ObjectId(String(req.user._id));

    // Prevent browser 304 stale cache responses
    res.set('Cache-Control', 'no-store');

    // Single aggregation: fetch resumes + latest ATSReport score in one query
    const resumes = await Resume.aggregate([
      // 1. Match user's resumes (ObjectId-safe)
      { $match: { userId } },
      { $sort: { createdAt: -1 } },

      // 2. Join latest ATSReport for each resume
      {
        $lookup: {
          from: 'atsreports',
          let: { resumeId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$resumeId', '$$resumeId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { totalScore: 1, scoringMode: 1, jdId: 1, createdAt: 1, _id: 0 } }
          ],
          as: 'latestReport'
        }
      },

      // 3. Flatten the latestReport array to object
      {
        $addFields: {
          latestReport: { $arrayElemAt: ['$latestReport', 0] }
        }
      },

      // 4. Project only what the dashboard needs
      {
        $project: {
          _id: 1,
          resumeTitle: 1,
          jdId: 1,
          createdAt: 1,
          updatedAt: 1,
          downloadCount: 1,
          // Expose latest ATS score directly on the resume object
          atsScore:    { $ifNull: ['$latestReport.totalScore',    null] },
          scoringMode: { $ifNull: ['$latestReport.scoringMode',   null] },
          scoredAt:    { $ifNull: ['$latestReport.createdAt',     null] },
          scoredJdId:  { $ifNull: ['$latestReport.jdId',         null] },
        }
      }
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Resume] GET /api/resume → ${resumes.length} resumes for user ${req.user._id}`);
    }
    return res.status(200).json({ success: true, data: { resumes, count: resumes.length } });
  } catch (error) {
    console.error('[Resume] getMyResumes error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch resumes' });
  }
};

// ── GET ONE ──────────────────────────────────────────────────────────────────
const getResumeById = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.status(200).json({ success: true, data: { resume } });
  } catch (error) {
    console.error('[Resume] getResumeById error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch resume' });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
const updateResume = async (req, res) => {
  try {
    const achievements = normalizeAchievements(req.body.achievementsText, req.body.achievements);

    // ✅ CRITICAL FIX #4: Fetch current resume first to preserve required fields
    const currentResume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!currentResume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // ✅ Merge personalInfo safely (preserve required fields if not explicitly updated)
    const personalInfoUpdate = req.body.personalInfo ? { ...currentResume.personalInfo.toObject(), ...req.body.personalInfo } : currentResume.personalInfo;
    
    // ✅ Validate personalInfo has required fields
    if (!personalInfoUpdate || !personalInfoUpdate.fullName || !personalInfoUpdate.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Personal Info must include fullName and email' 
      });
    }

    // CRITICAL FIX #3: Explicit whitelist — never spread req.body directly into DB
    // ✅ CRITICAL FIX #5: Validate nested objects have required fields before saving
    // Prevents overwriting: userId, downloadCount, jdId, _id, etc.
    const updateData = {
      resumeTitle:    typeof req.body.resumeTitle === 'string' ? req.body.resumeTitle.trim() : undefined,
      personalInfo:   personalInfoUpdate,
      summary:        typeof req.body.summary === 'string' ? req.body.summary : undefined,
      skills:         normalizeSkills(req.body.skills),
      experience:     validateAndCleanExperience(req.body.experience),
      projects:       validateAndCleanProjects(req.body.projects),
      education:      validateAndCleanEducation(req.body.education),
      certifications: validateAndCleanCertifications(req.body.certifications),
      achievements,
      languages:      Array.isArray(req.body.languages) ? req.body.languages.filter(isFilled) : undefined,
      templateId:     typeof req.body.templateId === 'string' ? req.body.templateId : undefined,
      isPublic:       typeof req.body.isPublic === 'boolean' ? req.body.isPublic : undefined,
      // NEVER allowed from user input: userId, downloadCount, _id, createdAt
    };

    // Allow jdId to be updated (enables re-scoring with different JD)
    if (req.body.jdId) {
      updateData.jdId = req.body.jdId;
    }

    // Strip undefined keys so we don't accidentally nullify fields not sent
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    
    // 🗑️ Invalidate cache when resume is updated
    console.log(`🗑️ Invalidating cache for resume ${resume._id}`);
    cacheHelper.invalidateResumeAnalyses(String(resume._id)).catch((error) => {
      console.error('⚠️ Failed to invalidate resume cache:', error);
      // Don't fail the request if cache invalidation fails
    });
    
    console.log("✅ UPDATE RESUME SUCCESS:", { _id: resume._id, title: resume.resumeTitle });
    return res.status(200).json({ success: true, message: 'Resume updated successfully', data: { resume } });
  } catch (error) {
    console.error('🔥 Update Resume Error:', error.message);
    console.error('🔥 Error Details:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
const deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    
    // 🗑️ Invalidate cache when resume is deleted
    console.log(`🗑️ Invalidating cache for deleted resume ${resume._id}`);
    cacheHelper.invalidateResumeAnalyses(String(resume._id)).catch((error) => {
      console.error('⚠️ Failed to invalidate resume cache:', error);
    });
    
    return res.status(200).json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete Resume Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete resume' });
  }
};

// ── UPDATE TEMPLATE ──────────────────────────────────────────────────────────
const updateTemplate = async (req, res) => {
  try {
    console.log("🔵 UPDATE TEMPLATE - ID:", req.params.id);
    console.log("🔵 UPDATE TEMPLATE - New Template:", req.body.templateId);

    const { templateId } = req.body;
    
    if (!templateId || typeof templateId !== 'string') {
      return res.status(400).json({ success: false, message: 'templateId is required and must be a string' });
    }

    // ✅ STEP 5: Normalize template ID before saving
    const normalizedTemplate = normalizeTemplateId(templateId);
    console.log(`✅ Normalized template: "${templateId}" → "${normalizedTemplate}"`);

    // Validate templateId is one of the allowed values
    const validTemplates = ['classic', 'fresher', 'tech'];
    if (!validTemplates.includes(normalizedTemplate)) {
      return res.status(400).json({ success: false, message: `Template must be one of: ${validTemplates.join(', ')}` });
    }

    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { templateId: normalizedTemplate } },
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    console.log("✅ TEMPLATE UPDATED:", { _id: resume._id, templateId: resume.templateId });
    return res.status(200).json({ 
      success: true, 
      message: 'Template updated successfully', 
      data: { resume } 
    });
  } catch (error) {
    console.error('🔥 Update Template Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update template' });
  }
};

// ✅ STEP 5: Normalize template ID to handle aliases (experienced-tech → tech)
const normalizeTemplateId = (templateId) => {
  if (!templateId) return 'classic';
  const normalized = templateId.toLowerCase().trim();
  
  // Handle 'experienced-tech' alias → convert to 'tech'
  if (normalized === 'experienced-tech') {
    console.log(`[PDF Download] Normalizing: "experienced-tech" → "tech"`);
    return 'tech';
  }
  
  // Validate against allowed templates
  const validTemplates = ['classic', 'fresher', 'tech'];
  if (!validTemplates.includes(normalized)) {
    console.warn(`[PDF Download] Unknown template "${templateId}", defaulting to "classic"`);
    return 'classic';
  }
  
  return normalized;
};

// ── DOWNLOAD PDF ─────────────────────────────────────────────────────────────
const downloadResumePDF = async (req, res) => {
  try {
    // CRITICAL FIX: Fetch FRESH resume data and increment counter atomically
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[PDF Download] Fetching resume: ${req.params.id}`);
    
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $inc: { downloadCount: 1 } },
      { new: true, lean: true }
    );
    
    if (!resume) {
      console.log(`[PDF Download] ❌ Resume not found or access denied`);
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }
    if (!resume.personalInfo?.fullName) {
      console.log(`[PDF Download] ❌ Resume incomplete - missing full name`);
      return res.status(400).json({ success: false, message: 'Resume is incomplete. Please add your name.' });
    }

    // Log template information for debugging
    console.log(`[PDF Download] Resume ID: ${resume._id}`);
    console.log(`[PDF Download] User ID: ${req.user._id}`);
    console.log(`[PDF Download] Full Name: ${resume.personalInfo.fullName}`);
    console.log(`[PDF Download] Template (from DB): "${resume.templateId}"`);
    console.log(`[PDF Download] Template Type: ${typeof resume.templateId}`);
    console.log(`[PDF Download] Download Count: ${resume.downloadCount}`);

    // ✅ STEP 5: Normalize and validate template
    const templateToUse = normalizeTemplateId(resume.templateId);
    
    // Ensure template is normalized in the resume object before PDF generation
    resume.templateId = templateToUse;
    console.log(`[PDF Download] ✅ Using template (after normalization): "${templateToUse}"`);
    console.log(`[PDF Download] ✅ Resume templateId set to: "${resume.templateId}" for PDF generation`);
    
    const pdfGenerator = require('../utils/pdfGenerator');
    const pdfBuffer = await pdfGenerator.generatePDF(resume);
    const filename  = pdfGenerator.generateFilename(resume);

    console.log(`[PDF Download] ✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
    console.log(`[PDF Download] Filename: ${filename}`);
    console.log(`${'='.repeat(60)}\n`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ Download Resume Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating resume PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ── UPLOAD AND PARSE PDF ───────────────────────────────────────────────────────
const uploadAndParse = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only PDF is allowed.' });
    }

    const { confidence, parsedResume } = await ResumeParserService.parsePDF(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Resume parsed successfully',
      data: {
        confidence,
        parsedResume
      }
    });
  } catch (error) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extract text from PDF.' });
  }
};

module.exports = { createResume, getMyResumes, getResumeById, updateResume, updateTemplate, deleteResume, downloadResumePDF, uploadAndParse };