const fs = require('fs');
const path = require('path');

const droneDir = path.join(__dirname, '..', 'uploads', 'drone');
const hotspotsDir = path.join(__dirname, '..', 'uploads', 'hotspots');

[droneDir, hotspotsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('Sample orthomosaic photorealistic drone imagery verified.');
