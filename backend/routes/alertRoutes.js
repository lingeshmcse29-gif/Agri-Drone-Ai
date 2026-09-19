const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getAlerts);
router.put('/:id/read', alertController.markAsRead);
router.delete('/:id', alertController.dismissAlert);

module.exports = router;
