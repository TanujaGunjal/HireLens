const express = require('express');
const router = express.Router();
const atsController = require('../controllers/ats.controller');
const applyFixController = require('../controllers/applyFixController');
const authMiddleware = require('../middlewares/authMiddleware');
const { generalLimiter } = require('../middlewares/rateLimitMiddleware');
const GenericModeService = require('../services/genericModeService');
const ATSReport = require('../models/ATSReport');

router.use(authMiddleware);

// Rate limiting on ATS endpoints to prevent abuse
router.post('/score', generalLimiter, atsController.calculateATSScore);
router.post('/generate', generalLimiter, atsController.generateResume);
router.post('/suggestions', generalLimiter, atsController.getSuggestions);

// Apply Fix Routes (UPDATED with smart replacement)
router.post('/apply-suggestion', generalLimiter, applyFixController.applySuggestion);
router.post('/apply-all-suggestions', generalLimiter, applyFixController.applyAllSuggestions);

// 🆕 Skill Gap Analysis API
router.get('/skill-gap/:resumeId/:jdId', generalLimiter, atsController.getSkillGap);

// 🆕 Auto-Fix: Inject missing skills automatically
router.post('/auto-fix/:resumeId/:jdId', generalLimiter, atsController.autoFixSkillGap);

// 🆕 Generic Mode: Score without JD (role-based keywords)
router.post('/score/generic/:role', generalLimiter, async (req, res) => {
  try {
    const { resumeId } = req.body;
    const { role } = req.params;

    if (!resumeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'resumeId is required' 
      });
    }

    const Resume = require('../models/Resume');
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ 
        success: false, 
        message: 'Resume not found' 
      });
    }

    // Use generic scoring service
    const genericService = new GenericModeService();
    const score = await genericService.scoreWithoutJD(resume, role);

    // Save report
    const report = new ATSReport({
      resumeId,
      userId: req.user._id,
      totalScore: score.totalScore,
      breakdown: score.breakdown,
      scoringMode: 'generic',
      detectedRole: role,
      suggestions: score.suggestions,
      overallFeedback: score.overallFeedback,
    });

    await report.save();

    return res.json({
      success: true,
      message: 'Generic ATS score calculated',
      data: {
        report: {
          totalScore: score.totalScore,
          breakdown: score.breakdown,
          scoringMode: 'generic',
          detectedRole: role,
          benchmark: score.benchmark,
          percentile: score.percentile,
          suggestions: score.suggestions,
        }
      }
    });

  } catch (error) {
    console.error('Generic mode scoring error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate generic ATS score',
      error: error.message
    });
  }
});

// 🆕 AI Rewrite: Improve resume with Gemini (summary, project bullets, skills)
router.post('/rewrite', generalLimiter, atsController.rewriteResumeController);

// Score history for production audit trail
router.get('/history/:resumeId', atsController.getScoreHistory);

module.exports = router;
