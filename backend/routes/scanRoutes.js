const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const upload = require('../middleware/uploadMiddleware');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, scanController.getScans);
router.post('/', optionalAuth, upload.array('droneImages', 20), scanController.createScan);
router.post('/demo', optionalAuth, scanController.createDemoScan);
router.get('/compare', optionalAuth, scanController.compareScans);
router.get('/:id/status', protect, scanController.getScanStatus);
router.get('/:id/diagnosis', protect, scanController.getScanDiagnosis);
router.get('/:id', optionalAuth, scanController.getScanById);
router.post('/:id/process', optionalAuth, scanController.processScan);

module.exports = router;
