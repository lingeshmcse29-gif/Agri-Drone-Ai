const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/status', aiController.getSystemHealth);
router.post('/analyze-stress', aiController.testAiVision);
router.post('/chat', aiController.askAiChat);

module.exports = router;
