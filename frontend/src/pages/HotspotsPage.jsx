import React, { useState } from 'react';
import { useFields } from '../context/FieldContext';
import HotspotDetailModal from '../components/hotspots/HotspotDetailModal';
import StatusBadge from '../components/common/StatusBadge';
import { Flame, Filter, Search, Eye, MapPin } from 'lucide-react';

export default function HotspotsPage() {
  const { activeHotspots, selectedField } = useFields();
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filteredHotspots = activeHotspots.filter((h) => {
    if (severityFilter === 'ALL') return true;
    return h.severity === severityFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            📍 Isolated Hotspot Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Suspicious field regions detected by grid tile vegetation stress analysis & Qwen3-VL vision AI.
          </p>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded-lg font-mono font-bold transition cursor-pointer ${
                severityFilter === sev ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Hotspot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHotspots.map((hs) => (
          <div
            key={hs._id || hs.hotspotId}
            onClick={() => setSelectedHotspot(hs)}
            className="glass-panel p-5 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-4 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-red-950/80 border border-red-800 text-red-400 font-mono font-bold text-xs flex items-center justify-center">
                  {hs.hotspotId}
                </span>
                <span className="text-sm font-bold text-slate-100 group-hover:text-emerald-400">
                  {hs.possibleDiseases && hs.possibleDiseases[0] ? hs.possibleDiseases[0].name : hs.stressType}
                </span>
              </div>
              <StatusBadge severity={hs.severity} />
            </div>

            {/* Thumbnail Patch */}
            <div className="w-full h-36 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden relative">
              <img
                src={hs.croppedImagePath || '/uploads/drone/sample_orthomosaic.jpg'}
                alt="Hotspot anomaly patch"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                onError={(e) => { e.target.src = '/uploads/drone/sample_orthomosaic.jpg'; }}
              />
              <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                Area: {hs.affectedArea} m²
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Risk: {hs.riskLevel || 82} / 100</span>
              <span className="text-emerald-400 font-bold">Conf: {((hs.confidence || 0.85) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hotspot Inspector Modal */}
      {selectedHotspot && (
        <HotspotDetailModal
          hotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
        />
      )}
    </div>
  );
}
