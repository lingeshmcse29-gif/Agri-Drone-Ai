import React from 'react';
import { CheckCircle2, Loader2, Plane, Map, Activity, Cpu, Flame, Bug, BarChart3, Sprout } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ScanPipelineProgress({ progress = 67, status = 'PROCESSING' }) {
  const { t } = useLanguage();

  const stages = [
    { name: t('stepImages'), icon: Plane, minProgress: 10, desc: 'Batch telemetry validated' },
    { name: t('stepReconstruction'), icon: Map, minProgress: 25, desc: 'Spatial orthomosaic grid built' },
    { name: t('stepVegetation'), icon: Activity, minProgress: 40, desc: 'ExG, VARI & foliage indices mapped' },
    { name: t('stepAIStress'), icon: Cpu, minProgress: 60, desc: 'Qwen3-VL anomaly scanning' },
    { name: t('stepHotspot'), icon: Flame, minProgress: 75, desc: 'Suspicious tiles isolated' },
    { name: t('stepDisease'), icon: Bug, minProgress: 88, desc: 'Visual symptoms checked' },
    { name: t('stepRisk'), icon: BarChart3, minProgress: 95, desc: 'Composite risk score compiled' },
    { name: t('stepRecs'), icon: Sprout, minProgress: 100, desc: 'Agronomic action steps ready' },
  ];

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="font-bold text-slate-200">{t('processingPipeline')}</span>
          </div>
          <span className="font-mono font-extrabold text-emerald-400 text-lg">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/50 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = progress >= stage.minProgress;
          const isCurrent = progress < stage.minProgress && (idx === 0 || progress >= stages[idx - 1].minProgress);

          return (
            <div
              key={stage.name}
              className={`p-3.5 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : isCurrent
                  ? 'bg-slate-900 border-teal-500/80 text-teal-300 ring-1 ring-teal-500/40 animate-pulse'
                  : 'bg-slate-950/60 border-slate-900 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${isDone ? 'text-emerald-400' : isCurrent ? 'text-teal-300' : 'text-slate-600'}`} />
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-teal-300 animate-spin" />
                ) : (
                  <span className="text-[10px] font-mono text-slate-600">Pending</span>
                )}
              </div>
              <p className="font-semibold text-xs text-slate-200">{stage.name}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{stage.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
