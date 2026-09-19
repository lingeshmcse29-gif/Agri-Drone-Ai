const Field = require('../models/Field');
const { getFieldWeather } = require('../services/weatherService');

exports.getWeatherForField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    let lat = 11.0168;
    let lng = 76.9558;
    let fieldName = 'North Farm';

    if (fieldId) {
      const field = await Field.findById(fieldId);
      if (field) {
        lat = field.latitude;
        lng = field.longitude;
        fieldName = field.fieldName;
      }
    }

    const weather = await getFieldWeather(lat, lng);
    res.json({ success: true, fieldName, location: { lat, lng }, weather });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
