/**
 * AgriDrone AI — Crop Profiles Configuration
 *
 * Provides evidence-based visual stress patterns, candidate differential diagnoses,
 * diagnostic limitations, and conservative management guidelines for specific agricultural crops.
 *
 * SCIENTIFIC RULE: Zero fabricated disease guarantees.
 * Visible RGB stress can represent moisture deficiency, nutrient imbalance, senescence,
 * or biotic infection. Visual patterns are treated strictly as candidate hypotheses.
 */

const CROP_PROFILES = {
  tomato: {
    displayName: 'Tomato (Solanum lycopersicum)',
    commonVisualStressPatterns: [
      {
        patternId: 'lower_canopy_chlorosis',
        description: 'Progressive yellowing of lower foliage with green upper canopy',
        differentialHypotheses: ['Nitrogen Deficiency', 'Water Stress', 'Natural Senescence'],
      },
      {
        patternId: 'concentric_foliar_lesions',
        description: 'Dark brown to black necrotic spots with concentric ring margins',
        differentialHypotheses: ['Early Blight (Alternaria solani)', 'Target Spot (Corynespora cassiicola)'],
      },
      {
        patternId: 'water_soaked_blotch',
        description: 'Pale green to brown irregular water-soaked foliar lesions with wilting',
        differentialHypotheses: ['Late Blight (Phytophthora infestans)', 'Over-irrigation'],
      },
    ],
    diagnosticLimitations: [
      'RGB imagery cannot distinguish viral mosaic from certain physiological leaf curls.',
      'Close-range under-canopy inspection is required to detect early fungal sporulation.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Inspect lower leaf surfaces in affected zones within 24–48 hours.',
      },
      {
        type: 'VERIFY_IRRIGATION',
        description: 'Verify soil moisture profile and check for drip emitter blockages in hotspot zones.',
      },
      {
        type: 'COLLECT_CLOSE_RANGE_IMAGES',
        description: 'Capture high-resolution macro photography of foliar lesions for confirmation.',
      },
    ],
  },

  corn: {
    displayName: 'Maize / Corn (Zea mays)',
    commonVisualStressPatterns: [
      {
        patternId: 'elliptical_cigar_lesions',
        description: 'Long, elliptical grayish-green to tan foliar lesions parallel to leaf veins',
        differentialHypotheses: ['Northern Corn Leaf Blight (Exserohilum turcicum)', 'Drought Stress'],
      },
      {
        patternId: 'rectangular_leaf_lesions',
        description: 'Rectangular brown necrotic lesions bounded by leaf veins',
        differentialHypotheses: ['Gray Leaf Spot (Cercospora zeae-maydis)', 'Sunscald'],
      },
      {
        patternId: 'v_shaped_leaf_chlorosis',
        description: 'Yellowing beginning at the leaf tip and progressing down the midrib',
        differentialHypotheses: ['Nitrogen Deficiency', 'Soil Compaction'],
      },
    ],
    diagnosticLimitations: [
      'Canopy shading and tassel emergence can affect spectral index readings.',
      'Foliar fungal symptoms require stalk inspection to assess lodging risk.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Scout corn stand across hotspot coordinates to verify lesion spread.',
      },
      {
        type: 'CHECK_NUTRIENT_STATUS',
        description: 'Review side-dress nitrogen schedule and test leaf tissue if chlorosis is uniform.',
      },
      {
        type: 'MONITOR',
        description: 'Monitor upper ear leaves to ensure photosynthetic capacity is preserved.',
      },
    ],
  },

  wheat: {
    displayName: 'Wheat (Triticum aestivum)',
    commonVisualStressPatterns: [
      {
        patternId: 'linear_yellow_pustules',
        description: 'Linear yellow-orange stripes of pustules along leaf veins',
        differentialHypotheses: ['Stripe / Yellow Rust (Puccinia striiformis)', 'Foliar Scorching'],
      },
      {
        patternId: 'irregular_leaf_blotch',
        description: 'Oval to irregular brown specks coalescing into dry patches',
        differentialHypotheses: ['Septoria Leaf Blotch (Zymoseptoria tritici)', 'Moisture Stress'],
      },
    ],
    diagnosticLimitations: [
      'Dense tillering may conceal early infection in the lower third of the wheat canopy.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Walk field transects through hotspot areas checking flag leaves.',
      },
      {
        type: 'VERIFY_IRRIGATION',
        description: 'Assess soil water holding capacity and recent precipitation drainage.',
      },
    ],
  },

  rice: {
    displayName: 'Rice (Oryza sativa)',
    commonVisualStressPatterns: [
      {
        patternId: 'diamond_spindle_lesions',
        description: 'Elliptical or spindle-shaped lesions with gray centers and reddish-brown borders',
        differentialHypotheses: ['Rice Blast (Magnaporthe oryzae)', 'Brown Spot (Bipolaris oryzae)'],
      },
      {
        patternId: 'water_soaked_leaf_margins',
        description: 'Wavy, water-soaked yellowish lesions along the leaf margin',
        differentialHypotheses: ['Bacterial Leaf Blight (Xanthomonas oryzae)', 'Salinity Stress'],
      },
    ],
    diagnosticLimitations: [
      'Standing floodwater reflection can modulate RGB index values.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Inspect collar and sheath regions of rice hills in flagged coordinates.',
      },
      {
        type: 'VERIFY_IRRIGATION',
        description: 'Regulate water depth to prevent drought or excessive stagnant submergence.',
      },
    ],
  },

  cotton: {
    displayName: 'Cotton (Gossypium hirsutum)',
    commonVisualStressPatterns: [
      {
        patternId: 'angular_water_soaked_spots',
        description: 'Angular leaf spots restricted by small veinlets, turning dark brown to black',
        differentialHypotheses: ['Bacterial Blight (Xanthomonas citri pv. malvacearum)', 'Potassium Deficiency'],
      },
      {
        patternId: 'interveinal_chlorosis',
        description: 'Reddish-purple or bronze pigmentation between veins on mature leaves',
        differentialHypotheses: ['Magnesium / Potassium Imbalance', 'Spider Mite Damage'],
      },
    ],
    diagnosticLimitations: [
      'Square shed and boll rot cannot be evaluated solely from aerial RGB canopy imagery.',
    ],
    conservativeActions: [
      {
        type: 'SCOUT_FOR_PESTS',
        description: 'Examine leaf undersides for sucking pests and mites in anomaly zones.',
      },
      {
        type: 'INSPECT_FIELD',
        description: 'Check main stem and terminal nodes for vigor and internode length.',
      },
    ],
  },

  sugarcane: {
    displayName: 'Sugarcane (Saccharum officinarum)',
    commonVisualStressPatterns: [
      {
        patternId: 'chlorotic_leaf_streaks',
        description: 'Reddish-brown elongated spots running parallel to veins on older leaves',
        differentialHypotheses: ['Brown Rust (Puccinia melanocephala)', 'Drought Stress'],
      },
    ],
    diagnosticLimitations: [
      'Tall, dense crop canopy limits visibility into lower dead trash and stalk bases.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Sample outer perimeter and interior rows in hotspot zones.',
      },
      {
        type: 'VERIFY_IRRIGATION',
        description: 'Check furrow irrigation flow uniformity across block.',
      },
    ],
  },

  generic: {
    displayName: 'Generic Agricultural Crop',
    commonVisualStressPatterns: [
      {
        patternId: 'generalized_canopy_chlorosis',
        description: 'Visible drop in canopy greenness and increase in foliar stress ratio',
        differentialHypotheses: ['Moisture Stress (Deficit or Excess)', 'Nutrient Deficiency', 'Biotic Stress'],
      },
    ],
    diagnosticLimitations: [
      'RGB imagery is sensitive to visible spectrum reflectance only and cannot verify pathogens without ground testing.',
    ],
    conservativeActions: [
      {
        type: 'INSPECT_FIELD',
        description: 'Conduct ground inspection of flagged hotspot coordinates.',
      },
      {
        type: 'VERIFY_IRRIGATION',
        description: 'Check soil moisture at root zone in anomalous areas.',
      },
      {
        type: 'CONSULT_AGRONOMIST',
        description: 'Consult a local certified agronomic extension specialist before applying chemical controls.',
      },
    ],
  },
};

/**
 * Resolves the matching crop profile safely with fallback to 'generic'.
 *
 * @param {string} [cropType]
 * @returns {Object} Crop profile definition
 */
function getCropProfile(cropType) {
  if (!cropType || typeof cropType !== 'string') {
    return CROP_PROFILES.generic;
  }

  const normalized = cropType.trim().toLowerCase();
  for (const [key, profile] of Object.entries(CROP_PROFILES)) {
    if (normalized === key || normalized.includes(key)) {
      return profile;
    }
  }

  return CROP_PROFILES.generic;
}

module.exports = {
  CROP_PROFILES,
  getCropProfile,
};
