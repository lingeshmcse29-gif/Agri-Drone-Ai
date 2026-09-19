import React, { useState } from 'react';
import { useFields } from '../context/FieldContext';
import { useLanguage } from '../context/LanguageContext';
import RiskGauge from '../components/common/RiskGauge';
import InteractiveFieldMap from '../components/map/InteractiveFieldMap';
import HotspotDetailModal from '../components/hotspots/HotspotDetailModal';
import StatusBadge from '../components/common/StatusBadge';
import { MapPin, Plane, Flame, AlertTriangle, ArrowUpRight, Cpu, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { fields, selectedField, latestScan, activeHotspots, systemHealth } = useFields();
  const { t } = useLanguage();
  const [inspectedHotspot, setInspectedHotspot] = useState(null);
  const navigate = useNavigate();

  const healthScore = latestScan ? latestScan.healthyPercentage : 78;
  const totalArea = fields.reduce((acc, f) => acc + (f.area || 0), 0).toFixed(1);
  const criticalHotspots = activeHotspots.filter((h) => h.severity === 'CRITICAL' || h.severity === 'HIGH').length;

  const isOllamaOnline = systemHealth && systemHealth.ollama === 'Online';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome & KPI Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* KPI 1: Crop Health */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">🌱 {t('cropHealth')}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <span className="text-3xl font-extrabold text-white font-mono mt-2">{healthScore}%</span>
          <span className="text-[10px] text-emerald-400 font-medium">{t('healthyCanopy')}</span>
        </div>

        {/* KPI 2: Total Fields */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">🗺️ {t('totalFields')}</span>
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-3xl font-extrabold text-white font-mono mt-2">{fields.length}</span>
          <span className="text-[10px] text-slate-400 font-medium">{totalArea} Ha</span>
        </div>

        {/* KPI 3: Active Hotspots */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">📍 {t('activeHotspots')}</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-3xl font-extrabold text-amber-400 font-mono mt-2">
            {activeHotspots.length}
          </span>
          <span className="text-[10px] text-amber-400/80 font-medium">Flagged Zones</span>
        </div>

        {/* KPI 4: High Risk Zones */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">⚠️ {t('highRisk')}</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-3xl font-extrabold text-red-400 font-mono mt-2">
            {criticalHotspots}
          </span>
          <span className="text-[10px] text-red-400/80 font-medium">Action Required</span>
        </div>

        {/* KPI 5: Latest Scan */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">🚁 {t('latestScan')}</span>
            <Plane className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-sm font-extrabold text-slate-200 mt-2 truncate">
            {latestScan ? new Date(latestScan.scanDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:42 AM'}
          </span>
          <span className="text-[10px] text-teal-400 font-medium">{t('online')}</span>
        </div>

        {/* KPI 6: AI Qwen Status */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">🤖 {t('visionEngine')}</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <span className={`text-xs font-bold font-mono mt-2 ${isOllamaOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isOllamaOnline ? 'qwen3-vl:8b' : t('fallbackMode')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {isOllamaOnline ? `● ${t('online')}` : `● ${t('fallbackMode')}`}
          </span>
        </div>
      </div>

      {/* Main Section: Health Overview & Interactive Field Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Field Health Circular Gauge */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-100 flex items-center justify-between">
              <span>{t('overallFieldHealth')}</span>
              <button
                onClick={() => navigate('/scans')}
                className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Scan Field <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Field: <strong className="text-slate-200">{selectedField ? selectedField.fieldName : 'North Farm'}</strong> ({selectedField ? selectedField.cropType : 'Tomato'})
            </p>
          </div>

          {/* Circular Progress Gauge */}
          <div className="my-2">
            <RiskGauge value={healthScore} label={t('cropHealth')} size={180} />
          </div>

          {/* Health Distribution Breakdown */}
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {t('healthyCanopy')}
              </span>
              <span className="font-mono font-bold text-emerald-400">{healthScore}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> {t('stressedLeaves')}
              </span>
              <span className="font-mono font-bold text-amber-400">
                {latestScan ? latestScan.affectedPercentage || 15 : 15}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> {t('criticalAnomaly')}
              </span>
              <span className="font-mono font-bold text-red-400">7%</span>
            </div>
          </div>

          {/* Instant Launch Demo Button Banner */}
          <button
            onClick={() => navigate('/scans')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-950 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-slate-950" /> {t('launchDemoScan')}
          </button>
        </div>

        {/* Right 2 Columns: Interactive Field Intelligence Map */}
        <div className="lg:col-span-2 space-y-4">
          <InteractiveFieldMap
            field={selectedField}
            hotspots={activeHotspots}
            onSelectHotspot={(hs) => setInspectedHotspot(hs)}
          />
        </div>
      </div>

      {/* Bottom Feed: Active Hotspots & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Hotspots Feed */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" /> {t('activeHotspots')}
              </h3>
              <p className="text-xs text-slate-400">
                Isolated by drone image tiling & vision AI
              </p>
            </div>

            <button
              onClick={() => navigate('/hotspots')}
              className="text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
            >
              View All Hotspots →
            </button>
          </div>

          {activeHotspots.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeHotspots.map((hs, idx) => (
                <div
                  key={idx}
                  onClick={() => setInspectedHotspot(hs)}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition">
                        {hs.hotspotId}
                      </span>
                      <StatusBadge severity={hs.severity} />
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      {hs.possibleDiseases && hs.possibleDiseases[0] ? hs.possibleDiseases[0].name : hs.stressType}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Area: {hs.affectedArea ? `${hs.affectedArea} m²` : 'N/A'} | Conf: {typeof hs.confidence === 'number' && hs.confidence > 0 ? `${(hs.confidence * 100).toFixed(0)}%` : 'Inconclusive'}
                    </p>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-800 group-hover:bg-emerald-600 group-hover:text-slate-950 text-slate-300 flex items-center justify-center transition">
                    →
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <p className="text-xs text-slate-400">No active anomaly hotspots detected in this field.</p>
            </div>
          )}
        </div>

        {/* AI Field Summary */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" /> {t('aiFieldSummary')}
            </h3>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Crop Type:</span>
                <span className="font-bold text-slate-200">{selectedField ? selectedField.cropType : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Overall Risk:</span>
                <span className={`font-bold ${latestScan?.overallRisk === 'CRITICAL' ? 'text-red-400' : latestScan?.overallRisk === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {latestScan?.overallRisk ? `${latestScan.overallRisk} RISK` : 'NORMAL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Diagnostic Status:</span>
                <span className="font-bold text-amber-300">
                  {latestScan?.diagnosticSummary?.status || (activeHotspots.length > 0 ? 'SUSPECTED' : 'NO_VISIBLE_ABNORMALITY')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Primary Finding:</span>
                <span className="font-bold text-slate-200 truncate max-w-[160px]">
                  {latestScan?.diagnosticSummary?.primaryFinding || (activeHotspots.length > 0 ? (activeHotspots[0]?.possibleDiseases?.[0]?.name || activeHotspots[0]?.stressType) : 'Healthy Stand')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed italic">
              {latestScan?.aiSummary || 'Automated drone scan complete. Physical ground scouting advised for flagged coordinates.'}
            </p>
          </div>

          <button
            onClick={() => navigate('/disease-analysis')}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Explore Full Visual Diagnostics →
          </button>
        </div>
      </div>

      {/* Hotspot Inspector Modal */}
      {inspectedHotspot && (
        <HotspotDetailModal
          hotspot={inspectedHotspot}
          onClose={() => setInspectedHotspot(null)}
        />
      )}
    </div>
  );
}
