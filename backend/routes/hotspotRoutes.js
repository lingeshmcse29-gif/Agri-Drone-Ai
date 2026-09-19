const express = require('express');
const router = express.Router();
const hotspotController = require('../controllers/hotspotController');

router.get('/', hotspotController.getHotspots);
router.get('/:id', hotspotController.getHotspotById);
router.put('/:id/status', hotspotController.updateHotspotStatus);

module.exports = router;
