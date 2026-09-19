import React from 'react';
import { useFields } from '../context/FieldContext';
import { Sprout, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RecommendationsPage() {
  const { selectedField } = useFields();

  const recommendations = [
    {
      title: 'Targeted Field Physical Inspection',
      urgency: 'HIGH',
      crop: selectedField ? selectedField.cropType : 'Tomato',
      issue: 'Early Blight Lesions in Block A',
      actionSteps: [
        'Inspect Hotspot #01 and #02 coordinates physically within 24 hours.',
        'Prune severely damaged lower foliage leaves to reduce spore dissemination.',
        'Collect tissue samples for lab verification before applying copper-based fungicide.',
        'Avoid overhead sprinkler irrigation during high humidity hours (after 5 PM).',
      ],
    },
    {
      title: 'Irrigation & Drainage Management',
      urgency: 'MODERATE',
      crop: selectedField ? selectedField.cropType : 'Tomato',
      issue: 'Water Accumulation near Hotspot #04',
      actionSteps: [
        'Clear field drainage furrows to prevent localized root waterlogging.',
        'Inspect drip irrigation line nozzles for pressure leaks in sector C.',
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          🌱 Agronomic Management Recommendations
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Actionable field intervention steps compiled from drone vision AI, crop type, severity, and weather factors.
        </p>
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-6">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-100">{rec.title}</h3>
                <span className="text-xs text-slate-400">
                  Target: {rec.crop} | Issue: <strong className="text-slate-200">{rec.issue}</strong>
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold">
                {rec.urgency} URGENCY
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">Recommended Action Steps:</span>
              <div className="space-y-2">
                {rec.actionSteps.map((step, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
