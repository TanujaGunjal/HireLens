const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');


router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/resumes', adminController.getAllResumes);
router.get('/users', adminController.getAllUsers);
router.get('/stats', adminController.getStats);
router.get('/activity', adminController.getActivity);
router.get('/templates', adminController.getAllTemplates);
router.post('/template/create', adminController.createTemplate);
router.put('/template/update/:id', adminController.updateTemplate);
router.get('/keywords', adminController.getKeywordLibraries);
router.post('/keywords/role', adminController.addRoleKeywordLibrary);
router.delete('/keywords/role/:role', adminController.deleteRoleKeywordLibrary);
router.post('/keywords/add', adminController.addKeywordToRole);
router.delete('/keywords/remove', adminController.removeKeywordFromRole);
router.put('/keywords/update/:id', adminController.updateKeywordLibrary);
router.get('/suggestion-rules', adminController.getSuggestionRules);
router.put('/suggestion-rules/:id', adminController.updateSuggestionRules);

module.exports = router;
