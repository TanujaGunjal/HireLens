const JobDescription = require('../models/JobDescription');
const Resume = require('../models/Resume');
const ATSReport = require('../models/ATSReport');
const mongoose = require('mongoose');
const KeywordExtractorEnhanced = require('../utils/keywordExtractorEnhanced');
const resumeGenerator = require('../utils/resumeGenerator');
const atsService = require('../services/atsService');
const KeywordNormalizationService = require('../services/keywordNormalizationService');

const JD_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'will', 'would', 'should', 'can', 'could', 'may',
  'might', 'must', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'also', 'etc'
]);

const JD_GENERIC_NOUNS = new Set([
  'knowledge', 'year', 'years', 'role', 'developer', 'software', 'company', 'candidate', 'position',
  'experience', 'team', 'teams', 'ability', 'abilities', 'work', 'working', 'job', 'requirement', 'requirements',
  'skills', 'skill', 'environment', 'business', 'professional', 'responsibilities', 'responsibility', 'task', 'tasks',
  'required',
  // Block ATS/resume app internal terms that leak from project JDs:
  'admin', 'section', 'summary', 'formatting', 'completeness', 'readability',
  'templates', 'builder', 'suggestions', 'score', 'existing', 'missing',
  'bullets', 'keywordmatch', 'action', 'verbs', 'match', 'check',
  'download', 'logic', 'clean', 'modify', 'fix', 'strictly',
  // Generic non-skill nouns:
  'name', 'email', 'phone', 'location', 'title', 'part', 'text', 'data',
  'type', 'list', 'item', 'value', 'field', 'form', 'page', 'view',
  'module', 'component', 'feature', 'function', 'method', 'class',
  'object', 'array', 'string', 'number', 'boolean', 'null', 'undefined'
]);

const JD_COMMON_VERBS = new Set([
  'have', 'has', 'had', 'make', 'makes', 'made', 'use', 'uses', 'used', 'get', 'gets', 'got'
]);

const RESPONSIBILITY_VERBS = new Set([
  'design', 'develop', 'deploy', 'implement', 'optimize', 'build', 'maintain', 'deliver', 'architect', 'integrate'
]);

const TECH_TOKENS = new Set([
  'javascript', 'typescript', 'python', 'java', 'golang', 'go', 'rust', 'csharp', 'cpp', 'sql', 'nosql',
  'react', 'angular', 'vue', 'nodejs', 'express', 'nestjs', 'nextjs', 'django', 'flask', 'spring', 'laravel',
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'graphql', 'rest', 'api',
  'microservices', 'docker', 'kubernetes', 'terraform', 'jenkins', 'github', 'gitlab', 'aws', 'azure', 'gcp',
  'tableau', 'powerbi', 'spark', 'hadoop', 'machine', 'learning', 'nlp', 'pandas', 'numpy', 'scikit'
]);

const normalizeToken = (value = '') =>
  String(value).toLowerCase().replace(/[^\w+#.]/g, '');

const filterExtractedKeywordObjects = (items = []) => {
  const seen = new Set();
  const filtered = [];

  for (const item of items) {
    const raw = typeof item === 'string' ? item : item?.keyword;
    if (!raw) continue;

    const tokens = String(raw)
      .toLowerCase()
      .replace(/[^\w\s+#.]/g, ' ')
      .split(/\s+/)
      .map((t) => normalizeToken(t))
      .filter((t) => t.length >= 3)
      .filter((t) => !/^\d+$/.test(t))
      .filter((t) => !JD_STOPWORDS.has(t))
      .filter((t) => !JD_GENERIC_NOUNS.has(t));
    const meaningfulTokens = tokens.filter((t) => !JD_COMMON_VERBS.has(t));

    const keep =
      meaningfulTokens.length > 0 &&
      meaningfulTokens.some((t) => TECH_TOKENS.has(t) || RESPONSIBILITY_VERBS.has(t) || /[+#.]/.test(t));

    if (!keep) continue;

    const keyword = meaningfulTokens.join(' ').trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);

    filtered.push({
      keyword,
      frequency: typeof item?.frequency === 'number' ? item.frequency : 1,
      category: item?.category || 'other'
    });
  }

  return filtered;
};

const ROLE_KEYWORD_LIBRARY = {
  'Full Stack Developer': ['full stack', 'frontend', 'backend', 'react', 'node', 'api'],
  'Java Developer': ['java', 'spring', 'hibernate', 'jvm', 'microservices'],
  'Data Analyst': ['sql', 'tableau', 'power bi', 'analytics', 'dashboard', 'excel'],
  'HR': ['recruitment', 'talent', 'hr', 'employee engagement', 'onboarding'],
  'Sales': ['sales', 'lead generation', 'crm', 'pipeline', 'quota', 'client']
};

const detectRoleFromLibrary = (jdText = '', extractedKeywords = []) => {
  const text = `${String(jdText || '')} ${extractedKeywords.map((k) => k.keyword || '').join(' ')}`.toLowerCase();
  
  // Extended role detection with more patterns
  const ROLE_PATTERNS = [
    { role: 'Full Stack Developer', terms: ['full stack', 'fullstack', 'full-stack', 'frontend', 'backend', 'react', 'node', 'vue', 'angular'] },
    { role: 'Frontend Developer', terms: ['frontend', 'front-end', 'react', 'vue', 'angular', 'ui developer', 'html', 'css'] },
    { role: 'Backend Developer', terms: ['backend', 'back-end', 'node.js', 'java', 'python', 'api developer', 'server-side'] },
    { role: 'Java Developer', terms: ['java', 'spring', 'hibernate', 'jvm', 'microservices', 'maven'] },
    { role: 'Python Developer', terms: ['python', 'django', 'flask', 'fastapi', 'pandas'] },
    { role: 'DevOps Engineer', terms: ['devops', 'ci/cd', 'docker', 'kubernetes', 'terraform', 'jenkins', 'aws', 'azure'] },
    { role: 'Data Scientist', terms: ['data science', 'machine learning', 'ml', 'pandas', 'tensorflow', 'pytorch'] },
    { role: 'Data Analyst', terms: ['data analyst', 'sql', 'tableau', 'power bi', 'analytics', 'dashboard', 'excel'] },
    { role: 'Mobile Developer', terms: ['android', 'ios', 'react native', 'flutter', 'swift', 'kotlin'] },
    { role: 'Software Engineer', terms: ['software engineer', 'software developer', 'sde', 'swe'] },
    { role: 'HR', terms: ['recruitment', 'talent', 'hr', 'human resources', 'employee engagement'] },
    { role: 'Sales', terms: ['sales', 'lead generation', 'crm', 'pipeline', 'quota', 'client'] }
  ];

  let bestRole = 'Software Engineer';
  let bestScore = 0;

  for (const { role, terms } of ROLE_PATTERNS) {
    const score = terms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  // CRITICAL: Validate that detected role is a clean short string
  // If roleDetected ever somehow contains long text, use fallback
  if (!bestRole || bestRole.length > 40 || /^(you are|we are)/i.test(bestRole)) {
    return 'Software Engineer';
  }

  return bestRole;
};

// ================= SEPARATED JD ENDPOINTS =================

// 1. ANALYZE JD - Only processes jdText, NO resume lookup
const analyzeJD = async (req, res) => {
  try {
    const { jdText, resumeId } = req.body;

    console.log("🔵 ANALYZE JD - REQ.USER:", req.user?._id ? `${req.user._id} (${req.user.email})` : 'UNDEFINED ❌');
    console.log("🔵 ANALYZE JD - JD TEXT LENGTH:", jdText?.length || 0);
    console.log("🔵 ANALYZE JD - RESUME ID:", resumeId || 'NONE');

    // Validation - only jdText is required
    if (!jdText || jdText.trim().length < 20) {
      console.log("❌ ANALYZE JD: JD text too short or missing");
      return res.status(400).json({ 
        success: false, 
        message: 'Job description text is required (minimum 20 characters)' 
      });
    }

    if (jdText.length > 50000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Job description is too long. Maximum 50,000 characters allowed.' 
      });
    }

    // Validate resumeId format if provided
    let resume = null;
    if (resumeId) {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        console.log("❌ ANALYZE JD: Invalid resumeId format");
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid resume ID format' 
        });
      }

      // Check resume exists and belongs to user
      resume = await Resume.findOne({ _id: resumeId, userId: req.user._id });
      if (!resume) {
        console.log("❌ ANALYZE JD: Resume not found or unauthorized");
        return res.status(404).json({ 
          success: false, 
          message: 'Resume not found' 
        });
      }
      console.log("✅ ANALYZE JD: Resume found and validated:", resumeId);
    }

    // Extract keywords
    let extracted;
    try {
      const enhancedExtractor = new KeywordExtractorEnhanced();
      const enhancedKeywords = enhancedExtractor.extractKeywords(jdText);
      
      if (!enhancedKeywords || enhancedKeywords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Could not extract keywords from the job description. Please ensure it contains technical skills and requirements.'
        });
      }
      
      const mapCategoryToEnum = (cat) => {
        const mapping = {
          'language': 'skill',
          'framework': 'skill',
          'database': 'skill',
          'cloud': 'tool',
          'tool': 'tool',
          'practice': 'responsibility',
          'soft_skill': 'qualification',
          'concept': 'skill',
          'general': 'other'
        };
        return mapping[cat] || 'other';
      };
      
      const extractedKeywordObjects = enhancedKeywords.map(kw => ({
        keyword: kw.keyword,
        frequency: kw.frequency || 1,
        category: mapCategoryToEnum(kw.category)
      }));
      const filteredKeywordObjects = filterExtractedKeywordObjects(extractedKeywordObjects);
      if (!filteredKeywordObjects.length) {
        return res.status(400).json({
          success: false,
          message: 'No meaningful technical keywords found. Please paste a detailed technical job description.'
        });
      }
      
      // 🎯 PHASE 6 INTEGRATION: Normalize keywords (js→JavaScript, filter garbage)
      const normService = new KeywordNormalizationService();
      const normalizedKeywords = normService.filterAndNormalizeKeywords(
        filteredKeywordObjects.map(k => k.keyword),
        { frequency: filteredKeywordObjects.map(k => k.frequency) }
      );
      console.log('✅ PHASE 6: Normalized', filteredKeywordObjects.length, 'keywords →', normalizedKeywords.length, 'high-quality keywords');
      
      // Replace with normalized versions
      const normalizedKeywordObjects = normalizedKeywords.map(nk => ({
        keyword: nk.keyword,
        frequency: nk.frequency || 1,
        category: 'skill',
        priority: nk.priority,
        isTechnical: nk.isTechnical
      }));
      
      const mappedRole = detectRoleFromLibrary(jdText, normalizedKeywordObjects) || enhancedExtractor.extractRole(jdText) || 'Professional';
      extracted = {
        allKeywords: normalizedKeywordObjects.map(kw => kw.keyword),
        role: mappedRole,
        experienceLevel: 'Mid',
        skills: normalizedKeywordObjects
          .filter(kw => kw.isTechnical)
          .map(kw => kw.keyword),
        tools: normalizedKeywordObjects
          .filter(kw => kw.isTechnical)
          .map(kw => kw.keyword),
        responsibilities: (() => {
          const lines = jdText.split('\n').map(l => l.trim()).filter(l => l.length > 15);
          const responsibilityPatterns = [
            /^[-•*]\s+/,           // Bullet points: "- Design REST APIs"
            /^\d+\.\s+/,           // Numbered: "1. Build scalable systems"
            /^(design|develop|build|implement|create|maintain|architect|deploy|optimize|write|own|lead|manage|collaborate|work)/i
          ];
          
          const found = lines.filter(line => 
            responsibilityPatterns.some(pattern => pattern.test(line)) &&
            // Exclude lines with "you are", "we are", "we offer", "about us" etc.
            !/^(you are|we are|we offer|about|our team|the company|this role|join us)/i.test(line) &&
            line.length < 200
          );
          
          // Clean bullet markers
          return found
            .map(l => l.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
            .filter(l => l.length > 10)
            .slice(0, 8);
        })(),
        qualifications: normalizedKeywordObjects
          .filter(kw => kw.isTechnical && kw.priority >= 0.8)
          .map(kw => kw.keyword),
        extractedKeywords: normalizedKeywordObjects,
        metadata: {
          extractorVersion: '2.0-enhanced-phase6',
          totalKeywords: normalizedKeywordObjects.length,
          skillsCount: normalizedKeywordObjects.filter(k => k.isTechnical).length,
          toolsCount: normalizedKeywordObjects.filter(k => k.isTechnical).length,
          wordCount: jdText.split(/\s+/).length,
          hasEducationReq: /education|degree|bachelor|master/i.test(jdText),
          hasExperienceReq: /experience|years/i.test(jdText)
        }
      };
    } catch (extractionError) {
      console.error('Keyword Extraction Error:', extractionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze job description. Please check the format and try again.'
      });
    }

    if (!extracted || !extracted.allKeywords || extracted.allKeywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract keywords from the job description.'
      });
    }

    // Save JD to database
    const jd = new JobDescription({
      userId: req.user._id,
      resumeId: resume ? resume._id : null,
      jdText,
      extractedKeywords: extracted.extractedKeywords,
      roleDetected: extracted.role,
      experienceLevel: extracted.experienceLevel,
      requiredSkills: extracted.skills,
      responsibilities: extracted.responsibilities,
      qualifications: extracted.qualifications,
      metadata: extracted.metadata
    });

    await jd.save();
    console.log("✅ JD SAVED:", { _id: jd._id, userId: jd.userId, keywordCount: extracted.extractedKeywords.length });

    // CRITICAL: Link JD to Resume if resumeId was provided
    if (resume && jd._id) {
      console.log("🔵 ANALYZE JD: Linking JD to Resume...", { jdId: jd._id, resumeId: resume._id });
      resume.jdId = jd._id;
      await resume.save();
      console.log("✅ ANALYZE JD: Resume updated with jdId:", { resumeId: resume._id, jdId: resume.jdId });
    }

    // Response with jdId
    const responseData = {
      success: true,
      message: 'Job description analyzed successfully',
      data: {
        jdId: jd._id,
        roleDetected: extracted.role,
        extractedKeywords: extracted.extractedKeywords,
        extractedTools: extracted.tools || [],
        extractedResponsibilities: extracted.responsibilities || []
      }
    };

    if (resume) {
      responseData.data.resumeId = resume._id;
      responseData.data.jdLinked = true;
    }

    console.log("✅ ANALYZE JD COMPLETE:", { jdId: jd._id, resumeLinked: !!resume });
    res.status(200).json(responseData);

  } catch (error) {
    console.error('🔥 ANALYZE JD ERROR:', error.message);
    console.error('🔥 ERROR STACK:', error.stack);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid job description data',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'An unexpected error occurred while analyzing the job description',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. GENERATE RESUME - Creates new resume from JD (no existing resume needed)
const generateResume = async (req, res) => {
  try {
    const { jdId } = req.body;

    console.log("🔵 GENERATE RESUME - REQ.USER:", req.user?._id ? `${req.user._id} (${req.user.email})` : 'UNDEFINED ❌');
    console.log("🔵 GENERATE RESUME - JD ID:", jdId || 'UNDEFINED');

    if (!jdId) {
      return res.status(400).json({
        success: false,
        message: 'jdId is required for generating resume'
      });
    }

    const jd = await JobDescription.findOne({ _id: jdId, userId: req.user._id });
    if (!jd) {
      return res.status(404).json({ success: false, message: 'JD not found' });
    }

    console.log('[GENERATE] JD found:', { jdId, role: jd.roleDetected });

    const userProfile = {
      name: req.user.name || 'Your Name',
      email: req.user.email || '',
      // Pass any stored profile fields if available
      phone: req.user.phone || '',
      location: req.user.location || '',
    };

    // CRITICAL: Sanitize the detected role BEFORE calling generateFromJD
    // Ensure jd.roleDetected is a clean short string
    if (!jd.roleDetected || jd.roleDetected.length > 50 || /^(you|we|i have|the candidate)/i.test(jd.roleDetected)) {
      jd.roleDetected = 'Software Engineer';
    }
    
    let generatedResume;
    try {
      generatedResume = resumeGenerator.generateFromJD(jd, userProfile);
      console.log('[GENERATE] Resume generated from scratch');
    } catch (generateError) {
      console.error('[GENERATE] Generation error:', generateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate resume',
        error: process.env.NODE_ENV === 'development' ? generateError.message : undefined
      });
    }

    if (!generatedResume) {
      return res.status(500).json({
        success: false,
        message: 'Resume generation returned empty data'
      });
    }

    const ResumeModel = require('../models/Resume');
    let savedResume;

    try {
      const createPayload = { ...generatedResume };
      delete createPayload._id;
      delete createPayload.id;
      createPayload.userId = req.user._id;

      const newResume = new ResumeModel(createPayload);
      savedResume = await newResume.save();

      console.log('[GENERATE] Resume saved successfully:', { resumeId: savedResume._id });
    } catch (saveError) {
      console.error('[GENERATE] Save error:', saveError.message);
      
      if (saveError.name === 'ValidationError') {
        const fieldErrors = Object.entries(saveError.errors).map(([field, error]) => ({
          field,
          message: error.message
        }));
        return res.status(400).json({
          success: false,
          message: 'Resume validation failed',
          details: fieldErrors
        });
      }
      
      throw saveError;
    }

    res.status(200).json({
      success: true,
      message: 'Resume generated from JD',
      data: { 
        resume: savedResume,
        resumeId: savedResume._id
      }
    });

    console.log("✅ RESUME GENERATED SUCCESSFULLY:", { resumeId: savedResume._id, jdId: jdId });
  } catch (error) {
    console.error('🔥 GENERATE RESUME ERROR:', error.message);
    console.error('🔥 ERROR STACK:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 3. OPTIMIZE RESUME - Optimizes existing resume with JD (requires resumeId)
// FIX: Automatically calculate ATS score after linking JD
const optimizeResume = async (req, res) => {
  try {
    const { jdId, existingResumeId } = req.body;

    console.log("🔵 OPTIMIZE RESUME - REQ.USER:", req.user?._id ? `${req.user._id} (${req.user.email})` : 'UNDEFINED ❌');
    console.log("🔵 OPTIMIZE RESUME - JD ID:", jdId || 'UNDEFINED');
    console.log("🔵 OPTIMIZE RESUME - RESUME ID:", existingResumeId || 'UNDEFINED');

    // Validation - resumeId is REQUIRED for optimize
    if (!existingResumeId) {
      return res.status(400).json({
        success: false,
        message: 'resumeId is required for optimization'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(existingResumeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resumeId format'
      });
    }

    // Fetch existing resume
    const ResumeModel = require('../models/Resume');
    const existingResume = await ResumeModel.findOne({ _id: existingResumeId, userId: req.user._id });
    if (!existingResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Fetch JD
    if (!jdId) {
      return res.status(400).json({
        success: false,
        message: 'jdId is required for optimization'
      });
    }

    const jd = await JobDescription.findOne({ _id: jdId, userId: req.user._id });
    if (!jd) {
      return res.status(404).json({ success: false, message: 'JD not found' });
    }

    console.log('[OPTIMIZE] JD found:', { jdId, role: jd.roleDetected });

    // Optimize resume with JD
    let generatedResume;
    try {
      generatedResume = resumeGenerator.optimizeWithJD(existingResume.toObject(), jd);
      console.log('[OPTIMIZE] Resume optimized successfully');
    } catch (optimizeError) {
      console.error('[OPTIMIZE] Optimization error:', optimizeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to optimize resume',
        error: process.env.NODE_ENV === 'development' ? optimizeError.message : undefined
      });
    }

// Save optimized resume
    let savedResume;

    try {
      const updatePayload = { ...generatedResume };
      delete updatePayload._id;
      delete updatePayload.id;
      delete updatePayload.userId;
      delete updatePayload.createdAt;
      delete updatePayload.updatedAt;

      Object.assign(existingResume, updatePayload);
      existingResume.userId = req.user._id;
      
      // CRITICAL FIX: Link JD to resume so ATSScore page knows JD is linked
      console.log('[OPTIMIZE] Setting jdId on resume:', jd._id);
      existingResume.jdId = jd._id;
      console.log('[OPTIMIZE] Resume jdId before save:', existingResume.jdId);
      
      savedResume = await existingResume.save();
      console.log('[OPTIMIZE] Resume jdId after save:', savedResume.jdId);

      console.log('[OPTIMIZE] Resume optimized successfully:', { resumeId: savedResume._id, jdId: jd._id });
    } catch (saveError) {
      console.error('[OPTIMIZE] Save error:', saveError.message);
      
      if (saveError.name === 'ValidationError') {
        const fieldErrors = Object.entries(saveError.errors).map(([field, error]) => ({
          field,
          message: error.message
        }));
        return res.status(400).json({
          success: false,
          message: 'Resume validation failed',
          details: fieldErrors
        });
      }
      
      throw saveError;
    }

    // ========================================================
    // FIX: Automatically calculate ATS score after JD linking
    // ========================================================
    let scoreResult = null;
    try {
      console.log('[OPTIMIZE] Calculating ATS score...');
      scoreResult = await atsService.calculateATSScore(savedResume._id, jd._id);
      
      if (scoreResult && scoreResult.totalScore !== null) {
        // Save ATS Report - CREATE new record for audit trail
        await ATSReport.create({
          resumeId: savedResume._id,
          userId: req.user._id,
          jdId: jd._id,
          totalScore: scoreResult.totalScore,
          score: scoreResult.totalScore,
          scoringMode: scoreResult.scoringMode,
          breakdown: {
            keywordMatchScore: { score: scoreResult.breakdown?.keywordMatch || 0, weight: 40, details: {} },
            sectionCompletenessScore: { score: scoreResult.breakdown?.completeness || 0, weight: 20, details: {} },
            formattingScore: { score: scoreResult.breakdown?.formatting || 0, weight: 20, details: {} },
            actionVerbScore: { score: scoreResult.breakdown?.actionVerbs || 0, weight: 10, details: {} },
            readabilityScore: { score: scoreResult.breakdown?.readability || 0, weight: 10, details: {} }
          },
          missingKeywords: scoreResult.missingKeywords || [],
          matchedKeywords: scoreResult.matchedKeywords || [],
          keywordMatchPercent: scoreResult.breakdown?.keywordMatch || 0,
          createdAt: new Date()
        });

        // Update Resume with latest atsScore for Dashboard visibility
        await Resume.updateOne(
          { _id: savedResume._id },
          { $set: { atsScore: scoreResult.totalScore } }
        );
        
        console.log('[OPTIMIZE] ATS score calculated and saved:', { score: scoreResult.totalScore });
      }
    } catch (scoreError) {
      console.error('[OPTIMIZE] ATS score calculation error:', scoreError.message);
      // Don't fail the whole request if scoring fails - just log the error
    }

    // Return the response with score and jdId
    res.status(200).json({
      success: true,
      message: 'Resume optimized successfully',
      data: { 
        resume: savedResume,
        resumeId: savedResume._id,
        jdId: jd._id,
        score: scoreResult ? {
          totalScore: scoreResult.totalScore,
          scoringMode: scoreResult.scoringMode,
          breakdown: scoreResult.breakdown,
          matchedKeywords: scoreResult.matchedKeywords || [],
          missingKeywords: scoreResult.missingKeywords || []
        } : null
      }
    });

    console.log("✅ RESUME OPTIMIZED SUCCESSFULLY:", { resumeId: savedResume._id, jdId: jd._id, score: scoreResult?.totalScore });
  } catch (error) {
    console.error('🔥 OPTIMIZE RESUME ERROR:', error.message);
    console.error('🔥 ERROR STACK:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 4. GET JD - Fetch a specific job description by ID
const getJD = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid JD ID format' });
    }

    // Fetch JD (user-specific or public)
    const jd = await JobDescription.findById(id);
    if (!jd) {
      return res.status(404).json({ success: false, message: 'Job Description not found' });
    }

    // Return JD data
    res.status(200).json({
      success: true,
      data: {
        jdId: jd._id,
        jdText: jd.jdText,
        role: jd.role,
        extractedKeywords: jd.extractedKeywords || [],
        createdAt: jd.createdAt
      }
    });
  } catch (error) {
    console.error('🔥 GET JD ERROR:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job description',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { analyzeJD, generateResume, optimizeResume, getJD };
