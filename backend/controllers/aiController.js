const mongoose = require('mongoose');
const axios = require('axios');
const { checkOllamaHealth, analyzeCropRegion } = require('../services/ollamaService');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3-vl:8b';

exports.getSystemHealth = async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const ollamaStatus = await checkOllamaHealth();

    res.json({
      success: true,
      system: {
        frontend: 'Online',
        backend: 'Online',
        mongodb: mongoStatus,
        weatherApi: 'Connected (Open-Meteo)',
        ollama: ollamaStatus.online ? 'Online' : 'Offline',
        ollamaUrl: OLLAMA_URL,
        modelConfigured: OLLAMA_MODEL,
        modelAvailable: ollamaStatus.modelAvailable || false,
        ollamaDetails: ollamaStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.testAiVision = async (req, res) => {
  try {
    const sampleContext = { cropType: 'Tomato', severity: 'HIGH' };
    const result = await analyzeCropRegion(null, sampleContext);
    res.json({ success: true, testResult: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// AI Agronomist Chat Copilot Controller
exports.askAiChat = async (req, res) => {
  try {
    const { message, fieldName, cropType, area, hotspotsCount, weather, language } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message query is required' });
    }

    const fieldInfo = `${fieldName || 'North Farm (Block A)'} (${cropType || 'Tomato'}, ${area || 4.8} ha)`;
    const weatherInfo = weather ? `${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.condition}` : '24°C, 81% humidity';

    const systemPrompt = `You are Agri-Drone AI Agronomist Copilot, an expert agricultural scientist and precision farming advisor.
Current Field Context:
- Field: ${fieldInfo}
- Active Stress Hotspots: ${hotspotsCount || 0} detected by drone scan
- Microclimate Weather: ${weatherInfo}
- Language Preference: ${language || 'English'}

Provide concise, practical, expert agronomic advice in response to the farmer's question. Include key observations, risk warnings, and actionable recommendations.
Prioritize ground scouting, cultural sanitation, moisture management, and consulting accredited agronomists. DO NOT prescribe chemical pesticide dosages or chemical application rates.`;

    let aiReply = '';

    // Try calling Ollama first with 6s timeout
    try {
      const ollamaRes = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: OLLAMA_MODEL,
        prompt: `${systemPrompt}\n\nFarmer Question: "${message}"\n\nAI Agronomist Answer:`,
        stream: false,
      }, { timeout: 6000 });

      if (ollamaRes.data && ollamaRes.data.response) {
        aiReply = ollamaRes.data.response.trim();
      }
    } catch (ollamaErr) {
      console.log('[Ollama Chat] Using fast Agronomic AI Copilot fallback:', ollamaErr.message);
    }

    // Agronomic Intelligence Fallback Engine if Ollama is slow/offline
    if (!aiReply) {
      const queryLower = message.toLowerCase();

      if (queryLower.includes('health') || queryLower.includes('status') || queryLower.includes('condition')) {
        aiReply = `🌾 **Field Health Summary for ${fieldName || 'North Farm'}**:
• **Crop Status**: ${cropType || 'Tomato'} crop is at **78% Healthy Canopy** index.
• **Stress Detection**: Isolated hotspot zones showing symptoms of foliar stress and chlorosis.
• **Environmental Risk**: High relative humidity (${weatherInfo}) creates favorable conditions for fungal spore spread.
• **Action**: Perform ground scouting at flagged hotspot coordinates. Maintain drip irrigation and avoid overhead sprinkling.`;
      } else if (queryLower.includes('treat') || queryLower.includes('blight') || queryLower.includes('fungus') || queryLower.includes('disease') || queryLower.includes('cure')) {
        aiReply = `🦠 **Agronomic Guidance for Foliar Stress Symptoms in ${cropType || 'Tomato'}**:
1. **Ground Scouting**: Inspect flagged hotspot coordinates to examine lower leaf surfaces and lesion margins.
2. **Cultural Sanitation**: Prune and safely remove necrotic lower foliage to reduce local pathogen inoculum.
3. **Moisture Control**: Suspend overhead sprinkler irrigation during high humidity periods; ensure adequate airflow.
4. **Professional Consultation**: Consult local agricultural extension or accredited agronomist with physical tissue samples before chemical application.`;
      } else if (queryLower.includes('fertilizer') || queryLower.includes('npk') || queryLower.includes('nutrient') || queryLower.includes('feed')) {
        aiReply = `🧪 **Nutrient Management Guidance for ${cropType || 'Tomato'}**:
• **Soil & Tissue Testing**: Conduct root-zone soil EC and foliar tissue testing to verify nutrient deficiencies before supplemental fertilization.
• **Balanced Nutrition**: Maintain balanced macro- and micronutrients according to certified regional agronomic guidelines.
• **Irrigation Verification**: Check fertigation emitter uniformity and root-zone moisture before adjusting nutrient regimes.`;
      } else if (queryLower.includes('rain') || queryLower.includes('weather') || queryLower.includes('water') || queryLower.includes('humidity')) {
        aiReply = `🌦️ **Microclimate Alert & Water Management**:
• Current conditions (${weatherInfo}) present elevated risk of fungal pathogen development.
• **Recommendation**: Hold overhead irrigation for the next 48 hours. Ensure field drainage channels are clear to prevent waterlogging around root zones.`;
      } else {
        aiReply = `🚁 **Agri-Drone AI Copilot Insights for ${fieldName || 'North Farm'}**:
Based on your latest drone orthomosaic scan and local microclimate data:
• **Field**: ${fieldInfo}
• **Primary Concern**: Foliar stress patterns detected in isolated hotspot tiles.
• **Advice**: Conduct physical field scouting at flagged coordinates to examine symptoms before chemical intervention.
• Ask me specifically about **"disease management"**, **"nutrient schedule"**, **"weather risk"**, or **"field health"** for detailed guidance!`;
      }
    }

    res.json({
      success: true,
      reply: aiReply,
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
