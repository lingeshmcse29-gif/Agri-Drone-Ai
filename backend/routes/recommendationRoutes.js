const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.get('/', recommendationController.getRecommendations);
router.put('/:id/status', recommendationController.updateRecommendationStatus);

module.exports = router;
