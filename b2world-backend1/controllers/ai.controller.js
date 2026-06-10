/**
 * AI Controller — Resume Improvement Endpoint
 *
 * Route: POST /api/ai/improve
 *
 * Accepts resumeId + jdId, fetches both documents, calls ai.service,
 * and returns the improved sections WITHOUT writing to the database.
 * The frontend shows a preview; the user decides what to apply.
 */

const Resume        = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const { improveResume } = require('../services/ai.service');

// ── POST /api/ai/improve ─────────────────────────────────────────────────────
const improve = async (req, res) => {
  try {
    const { resumeId, jdId } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!resumeId || !jdId) {
      return res.status(400).json({
        success: false,
        message: 'resumeId and jdId are required.',
      });
    }

    // ── Fetch Resume (must belong to the authenticated user) ────────────────
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user._id }).lean();
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found or access denied.',
      });
    }

    // ── Fetch Job Description ────────────────────────────────────────────────
    const jd = await JobDescription.findOne({ _id: jdId, userId: req.user._id }).lean();
    if (!jd) {
      return res.status(404).json({
        success: false,
        message: 'Job description not found or access denied.',
      });
    }

    const jdText = jd.jdText;

    // ── Call AI Service ──────────────────────────────────────────────────────
    console.log(`[AI Controller] Improving resume ${resumeId} for JD ${jdId}`);
    const improved = await improveResume(resume, jdText);

    // _fallback: true  → all Gemini models were unavailable (offline result)
    // _fallback: false → real AI content returned
    const aiUsed = !improved._fallback;
    const { _fallback, ...improvedClean } = improved;

    // ── Return — NOT saved to DB intentionally ───────────────────────────────
    return res.status(200).json({
      success: true,
      aiUsed,
      message: aiUsed
        ? 'Resume improved successfully. Preview and apply sections you want.'
        : 'AI is temporarily busy. Showing your current resume with improvement tips.',
      data: {
        improved: improvedClean,  // { summary, experience[], projects[] }
        resumeId,
        jdId,
      },
    });


  } catch (err) {
    // Input/auth errors (missing ID, not-found resume/JD) still return proper codes.
    // AI errors should NEVER reach here — the service always returns a fallback.
    // But if something unexpected slips through, respond gracefully.
    console.error('[AI Controller] Unexpected error:', err.message);

    const status = err.status || 0;

    // Preserve validation / not-found codes
    if (status === 400 || status === 404) {
      return res.status(status).json({ success: false, message: err.message });
    }

    // For everything else — return a safe fallback (never crash the user's request)
    return res.status(200).json({
      success: true,
      aiUsed: false,
      message: 'AI is temporarily unavailable. Here are tips to improve your resume manually.',
      data: {
        improved: {
          summary: 'Use strong action verbs (Developed, Built, Led) and add measurable ' +
                   'outcomes (e.g., reduced latency by 30%). Align your skills section ' +
                   'with keywords from the job description.',
          experience: [],
          projects: [],
        },
        resumeId: req.body?.resumeId,
        jdId:     req.body?.jdId,
      },
    });
  }
};

module.exports = { improve };
