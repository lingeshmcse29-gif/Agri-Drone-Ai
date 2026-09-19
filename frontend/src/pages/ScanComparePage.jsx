import React, { useState } from 'react';
import { useFields } from '../context/FieldContext';
import StatusBadge from '../components/common/StatusBadge';
import { GitCompare, TrendingDown, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function ScanComparePage() {
  const { selectedField } = useFields();
  const [scan1, setScan1] = useState('SCAN-2026-074');
  const [scan2, setScan2] = useState('SCAN-2026-081');

  const comparisonData = {
    previous: {
      id: 'SCAN-2026-074',
      date: 'Aug 22, 2026',
      health: 86,
      hotspots: 7,
      affectedAreaPct: 4.2,
      risk: 'MEDIUM',
    },
    current: {
      id: 'SCAN-2026-081',
      date: 'Aug 29, 2026',
      health: 74,
      hotspots: 12,
      affectedAreaPct: 8.7,
      risk: 'HIGH',
    },
    deltas: {
      healthDelta: -12,
      hotspotDelta: 5,
      affectedAreaDelta: 4.5,
      trend: 'DETERIORATING',
    },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            🔀 Drone Scan Comparison Mode
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare two drone survey flights side-by-side to evaluate health progression and disease spreading velocity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={scan1}
            onChange={(e) => setScan1(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-semibold rounded-xl px-3 py-2 text-slate-200"
          >
            <option value="SCAN-2026-074">Prev: SCAN-2026-074 (Aug 22)</option>
          </select>

          <span className="text-slate-500 font-bold text-xs">vs</span>

          <select
            value={scan2}
            onChange={(e) => setScan2(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-semibold rounded-xl px-3 py-2 text-slate-200"
          >
            <option value="SCAN-2026-081">Curr: SCAN-2026-081 (Aug 29)</option>
          </select>
        </div>
      </div>

      {/* Delta Banner */}
      <div className="p-5 rounded-3xl bg-red-950/20 border border-red-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-950 border border-red-800 text-red-400 flex items-center justify-center font-bold">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-red-400 block">
              Crop Health Trend: DETERIORATING (-12%)
            </span>
            <p className="text-xs text-slate-300">
              Hotspots expanded from 7 → 12 zones (+5 new anomalies). Affected area doubled from 4.2% → 8.7%.
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-red-950 text-red-300 border border-red-800 text-xs font-mono font-bold">
          HIGH SPREAD VELOCITY
        </span>
      </div>

      {/* Side-by-Side Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Previous Scan Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-slate-400 uppercase font-mono block">Baseline Scan</span>
              <span className="font-extrabold text-base text-slate-100">{comparisonData.previous.id}</span>
            </div>
            <StatusBadge severity={comparisonData.previous.risk} />
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Scan Date:</span>
              <span className="font-mono font-bold text-slate-200">{comparisonData.previous.date}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Crop Health:</span>
              <span className="font-mono font-extrabold text-emerald-400 text-base">{comparisonData.previous.health}%</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Active Hotspots:</span>
              <span className="font-mono font-bold text-amber-400">{comparisonData.previous.hotspots} zones</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Affected Field Area:</span>
              <span className="font-mono font-bold text-slate-300">{comparisonData.previous.affectedAreaPct}%</span>
            </div>
          </div>
        </div>

        {/* Current Scan Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-emerald-400 uppercase font-mono font-bold block">Current Scan</span>
              <span className="font-extrabold text-base text-slate-100">{comparisonData.current.id}</span>
            </div>
            <StatusBadge severity={comparisonData.current.risk} />
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Scan Date:</span>
              <span className="font-mono font-bold text-slate-200">{comparisonData.current.date}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Crop Health:</span>
              <span className="font-mono font-extrabold text-red-400 text-base">
                {comparisonData.current.health}% ({comparisonData.deltas.healthDelta}%)
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Active Hotspots:</span>
              <span className="font-mono font-bold text-red-400">
                {comparisonData.current.hotspots} zones (+{comparisonData.deltas.hotspotDelta})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Affected Field Area:</span>
              <span className="font-mono font-bold text-amber-400">
                {comparisonData.current.affectedAreaPct}% (+{comparisonData.deltas.affectedAreaDelta}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
