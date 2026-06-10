const express = require('express');
const router = express.Router();

const resumeController = require('../controllers/resumeController');
const authMiddleware = require('../middlewares/authMiddleware');
const { pdfDownloadLimiter } = require('../middlewares/rateLimitMiddleware');
const multer = require('multer');

// Configure Multer for PDF memory storage (Max 2MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF format is allowed!'), false);
    }
  }
});

router.use(authMiddleware);

// Create resume
router.post('/create', resumeController.createResume);

// Upload and Parse PDF Template for Autofill
router.post('/upload', upload.single('resume'), resumeController.uploadAndParse);

// Get all resumes (both endpoints work — / is alias for /my-resumes)
router.get('/', resumeController.getMyResumes);
router.get('/my-resumes', resumeController.getMyResumes);

// Download PDF (keep above /:id)
router.get('/download/pdf/:id', pdfDownloadLimiter, resumeController.downloadResumePDF);

// Update template only (fast endpoint for template changes)
router.patch('/:id/template', resumeController.updateTemplate);

// Update resume
router.put('/update/:id', resumeController.updateResume);

// Delete resume
router.delete('/delete/:id', resumeController.deleteResume);

// Get single resume (MUST be last)
router.get('/:id', resumeController.getResumeById);

module.exports = router;