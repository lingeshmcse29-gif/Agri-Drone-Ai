import React, { useState } from 'react';
import { useFields } from '../context/FieldContext';
import InteractiveFieldMap from '../components/map/InteractiveFieldMap';
import HotspotDetailModal from '../components/hotspots/HotspotDetailModal';
import StatusBadge from '../components/common/StatusBadge';
import { MapPin, Flame, Eye, Layers } from 'lucide-react';

export default function FieldMapPage() {
  const { selectedField, activeHotspots } = useFields();
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  return (
    <div className="space-y-6 pb-12">
      {/* Map Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            🗺️ Precision Field Map Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interactive GIS map displaying polygon boundaries, RGB vegetation index heatmaps (ExG/VARI), and pulsing hotspot clusters.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">
            {selectedField ? selectedField.fieldName : 'North Farm'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{selectedField ? selectedField.cropType : 'Tomato'}</span>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <InteractiveFieldMap
        field={selectedField}
        hotspots={activeHotspots}
        onSelectHotspot={(hs) => setSelectedHotspot(hs)}
      />

      {/* Hotspot Drawer List Below Map */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" /> Map Hotspot Zones ({activeHotspots.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {activeHotspots.map((hs) => (
            <div
              key={hs._id || hs.hotspotId}
              onClick={() => setSelectedHotspot(hs)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-400">
                  {hs.hotspotId}
                </span>
                <StatusBadge severity={hs.severity} />
              </div>

              <p className="text-xs font-semibold text-slate-300">
                {hs.possibleDiseases && hs.possibleDiseases[0] ? hs.possibleDiseases[0].name : hs.stressType}
              </p>

              <div className="text-[11px] text-slate-400 flex justify-between font-mono">
                <span>Conf: {((hs.confidence || 0.85) * 100).toFixed(0)}%</span>
                <span>Area: {hs.affectedArea} m²</span>
              </div>
            </div>
          ))}
        </div>
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
