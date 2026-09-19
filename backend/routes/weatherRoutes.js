const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

router.get('/:fieldId?', weatherController.getWeatherForField);

module.exports = router;
