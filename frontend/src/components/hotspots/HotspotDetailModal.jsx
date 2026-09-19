import React from 'react';
import { X, CheckCircle2, CloudSun, Cpu, Sprout, AlertCircle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { useLanguage } from '../../context/LanguageContext';

export default function HotspotDetailModal({ hotspot, onClose }) {
  const { t } = useLanguage();
  if (!hotspot) return null;

  const sampleCroppedImage = hotspot.croppedImagePath || '/uploads/drone/sample_orthomosaic.jpg';

  // 1. GPS Coordinate Handling: Strictly authentic or honest unavailable notice
  const hasValidGps = typeof hotspot.latitude === 'number' &&
    isFinite(hotspot.latitude) &&
    typeof hotspot.longitude === 'number' &&
    isFinite(hotspot.longitude) &&
    (hotspot.latitude !== 0 || hotspot.longitude !== 0) &&
    hotspot.gpsStatus !== 'GPS_UNAVAILABLE';

  const gpsDisplay = hasValidGps
    ? `Lat ${hotspot.latitude >= 0 ? `${hotspot.latitude.toFixed(4)}° N` : `${Math.abs(hotspot.latitude).toFixed(4)}° S`} | Lng ${hotspot.longitude >= 0 ? `${hotspot.longitude.toFixed(4)}° E` : `${Math.abs(hotspot.longitude).toFixed(4)}° W`}`
    : 'GPS Unavailable (Pixel-space hotspot)';

  // 2. Dynamic Evidence Extraction from backend API response only
  const dynamicEvidence = [];
  if (Array.isArray(hotspot.possibleDiseases)) {
    hotspot.possibleDiseases.forEach((dis) => {
      if (Array.isArray(dis.evidence)) {
        dis.evidence.forEach((ev) => {
          if (ev && typeof ev === 'string' && !dynamicEvidence.includes(ev)) {
            dynamicEvidence.push(ev);
          }
        });
      }
    });
  }
  if (Array.isArray(hotspot.evidence?.visualEvidence)) {
    hotspot.evidence.visualEvidence.forEach((ev) => {
      if (ev && typeof ev === 'string' && !dynamicEvidence.includes(ev)) {
        dynamicEvidence.push(ev);
      }
    });
  }
  if (typeof hotspot.vegetationStressPct === 'number' && isFinite(hotspot.vegetationStressPct)) {
    dynamicEvidence.push(`Vegetation Stress Index: ${hotspot.vegetationStressPct.toFixed(1)}%`);
  }
  if (typeof hotspot.visualHealthScore === 'number' && isFinite(hotspot.visualHealthScore)) {
    dynamicEvidence.push(`Visual Health Score: ${hotspot.visualHealthScore}/100`);
  }
  if (typeof hotspot.exgMean === 'number' && isFinite(hotspot.exgMean)) {
    dynamicEvidence.push(`Excess Green (ExG) Mean: ${hotspot.exgMean.toFixed(2)}`);
  }

  // 3. Dynamic Weather Extraction
  const weatherObj = hotspot.weatherSnapshot || hotspot.weather || hotspot.scan?.weatherSnapshot || null;
  const hasWeather = weatherObj && (weatherObj.humidity !== undefined || weatherObj.temperature !== undefined);

  // 4. Inconclusive & Disease findings handling
  const hasDiseases = Array.isArray(hotspot.possibleDiseases) && hotspot.possibleDiseases.length > 0;
  const isInconclusive = hotspot.diagnosisStatus === 'INCONCLUSIVE' ||
    (typeof hotspot.confidence === 'number' && hotspot.confidence === 0 && !hasDiseases);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center font-mono font-bold text-lg">
            {hotspot.hotspotId}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-100">
                {t('hotspotDetails')}
              </h2>
              <StatusBadge severity={hotspot.severity} />
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {gpsDisplay}
            </p>
          </div>
        </div>

        {/* Top Grid: Cropped Image + KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cropped Hotspot Image Patch */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              📷 Extracted Drone Anomaly Patch
            </span>
            <div className="w-full h-56 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden relative group">
              <img
                src={sampleCroppedImage}
                alt="Hotspot anomaly patch"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                onError={(e) => { e.target.src = '/uploads/drone/sample_orthomosaic.jpg'; }}
              />
              <div className="absolute inset-0 border-2 border-red-500/80 rounded-2xl pointer-events-none"></div>
              <div className="absolute top-3 left-3 bg-red-950/90 text-red-300 border border-red-800 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold">
                HIGH STRESS REGION
              </div>
            </div>
          </div>

          {/* KPI Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">{t('aiConfidence')}</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {typeof hotspot.confidence === 'number' && isFinite(hotspot.confidence) && hotspot.confidence > 0
                  ? `${(hotspot.confidence * 100).toFixed(0)}%`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500">Qwen3-VL Vision</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">{t('compositeRisk')}</span>
              <span className="text-2xl font-extrabold text-red-400 font-mono">
                {hotspot.riskLevel !== undefined && isFinite(hotspot.riskLevel)
                  ? `${hotspot.riskLevel} / 100`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500">{hotspot.severity || 'UNKNOWN'} SEVERITY</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">{t('affectedArea')}</span>
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {hotspot.affectedArea !== undefined && isFinite(hotspot.affectedArea)
                  ? `${hotspot.affectedArea} m²`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500">Targeted Cluster</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Primary Stress</span>
              <span className="text-sm font-bold text-slate-200 capitalize truncate">
                {(hotspot.stressType || 'Foliar Stress').replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-slate-500">Spectral Anomaly</span>
            </div>
          </div>
        </div>

        {/* Possible Disease / Diagnostic Findings List */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" /> {t('possibleIssues')}
          </h3>

          {hasDiseases ? (
            <div className="space-y-2">
              {hotspot.possibleDiseases.map((dis, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">
                        {idx === 0 ? '🥇' : '🥈'} {dis.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950 text-amber-300 border border-amber-800">
                        {dis.status || 'SUSPECTED'}
                      </span>
                    </div>
                    {Array.isArray(dis.evidence) && dis.evidence.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Evidence: {dis.evidence.join(', ')}
                      </p>
                    )}
                  </div>
                  {typeof dis.confidence === 'number' && isFinite(dis.confidence) && (
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">
                      {(dis.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                {isInconclusive
                  ? 'Visual evidence is insufficient for a reliable diagnosis. Physical field scouting recommended.'
                  : 'No diagnostic finding available.'}
              </p>
            </div>
          )}
        </div>

        {/* Dynamic Visual Evidence */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">
            ✓ {t('visualEvidence')}
          </span>
          {dynamicEvidence.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {dynamicEvidence.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
              No additional visual evidence available.
            </div>
          )}
        </div>

        {/* Weather Context & Agronomic Recommendation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4" /> {t('weatherContext')}
            </span>
            {hasWeather ? (
              <p className="text-xs text-slate-300 leading-relaxed">
                {weatherObj.humidity !== undefined && `Humidity: ${weatherObj.humidity}% `}
                {weatherObj.temperature !== undefined && `| Temperature: ${weatherObj.temperature}°C `}
                {weatherObj.condition && `| ${weatherObj.condition}`}
              </p>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Weather data not available for this scan.
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Sprout className="w-4 h-4" /> {t('recommendedAction')}
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {hotspot.recommendation || 'Inspect physical foliage within 24 hours.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            {t('closeDetails')}
          </button>
        </div>
      </div>
    </div>
  );
}
