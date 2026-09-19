import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Flame, Eye, Layers, Sparkles, Sliders, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

// Custom Leaflet DivIcon for Hotspot markers
const createHotspotIcon = (severity, hotspotId) => {
  const color = severity === 'CRITICAL' ? '#ef4444' : severity === 'HIGH' ? '#f97316' : '#eab308';
  const pulseClass = severity === 'CRITICAL' ? 'hotspot-pulse-critical' : 'hotspot-pulse-high';

  return L.divIcon({
    className: 'custom-hotspot-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: bold;
        font-size: 10px;
        box-shadow: 0 0 14px ${color};
      " class="${pulseClass}">
        ${hotspotId}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function InteractiveFieldMap({ field, hotspots = [], onSelectHotspot }) {
  const [mapMode, setMapMode] = useState('orthomosaic'); // 'orthomosaic' | 'ndvi' | 'gis'
  const [hoveredHs, setHoveredHs] = useState(null);

  const centerLat = field ? field.latitude : 10.5850;
  const centerLng = field ? field.longitude : 77.0150;

  const polygonPositions = (field && field.boundary && field.boundary.length >= 3)
    ? field.boundary
    : [
        [centerLat + 0.0020, centerLng - 0.0030],
        [centerLat + 0.0020, centerLng + 0.0030],
        [centerLat - 0.0020, centerLng + 0.0030],
        [centerLat - 0.0020, centerLng - 0.0030],
      ];

  const lats = polygonPositions.map((pt) => pt[0]);
  const lngs = polygonPositions.map((pt) => pt[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const imageBounds = [[minLat, minLng], [maxLat, maxLng]];

  return (
    <div className="relative w-full h-[560px] rounded-3xl overflow-hidden glass-panel border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Map Toolbar Header */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
              <span>{field ? field.fieldName : 'North Farm (Block A)'}</span>
              <span className="text-xs text-emerald-400 font-mono font-normal">
                ({field ? field.cropType : 'Tomato'} — {field ? field.area : 4.8} ha)
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Drone Orthomosaic Resolution: 2.4 cm/pixel | Band: High-Res Visual RGB (ExG / VARI / GLI Indices)
            </p>
          </div>
        </div>

        {/* View Mode Selector Tabs (Drone Deploy / Pix4D Style) */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setMapMode('orthomosaic')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              mapMode === 'orthomosaic'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🚁 Drone Orthomosaic (RGB)
          </button>

          <button
            onClick={() => setMapMode('ndvi')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              mapMode === 'ndvi'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌿 RGB Vegetation Proxy (VARI / ExG)
          </button>

          <button
            onClick={() => setMapMode('gis')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              mapMode === 'gis'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗺️ Satellite GIS Bounds
          </button>
        </div>
      </div>

      {/* Main Map / Orthomosaic Display Area */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden">
        {mapMode === 'orthomosaic' || mapMode === 'ndvi' ? (
          /* Seamless Native Drone Precision Orthomosaic Viewer (Pix4D / DroneDeploy Style) */
          <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden group">
            {/* Background High-Res Orthomosaic Image */}
            <img
              src="/uploads/drone/sample_orthomosaic.jpg"
              alt="Drone Orthomosaic Field Survey"
              className={`w-full h-full object-cover transition-all duration-700 ${
                mapMode === 'ndvi' ? 'hue-rotate-60 contrast-125 saturate-150 brightness-90' : ''
              }`}
            />

            {/* Subtle Grid Lines Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

            {/* Outer Field Boundary Line Overlay */}
            <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none shadow-[0_0_20px_rgba(34,197,94,0.3)]"></div>

            {/* Interactive SVG Bounding Boxes & Hotspot Pin Overlay */}
            <div className="absolute inset-0 pointer-events-auto">
              {hotspots.map((hs) => {
                const color = hs.severity === 'CRITICAL' ? '#ef4444' : hs.severity === 'HIGH' ? '#f97316' : '#eab308';
                const pulseClass = hs.severity === 'CRITICAL' ? 'hotspot-pulse-critical' : 'hotspot-pulse-high';

                // Hotspot relative coordinates inside container
                const left = `${hs.x}%`;
                const top = `${hs.y}%`;
                const width = `${Math.max(12, hs.width)}%`;
                const height = `${Math.max(12, hs.height)}%`;

                return (
                  <React.Fragment key={hs._id || hs.hotspotId}>
                    {/* Bounding Box Box Highlight around Anomaly */}
                    <div
                      style={{
                        left,
                        top,
                        width,
                        height,
                        borderColor: color,
                        boxShadow: `0 0 15px ${color}80, inset 0 0 15px ${color}30`,
                      }}
                      className="absolute border-2 rounded-xl transition-all duration-300 hover:scale-105 hover:bg-slate-900/30 cursor-pointer group/box"
                      onClick={() => onSelectHotspot && onSelectHotspot(hs)}
                      onMouseEnter={() => setHoveredHs(hs)}
                      onMouseLeave={() => setHoveredHs(null)}
                    >
                      {/* Bounding Box Label Tag */}
                      <span
                        style={{ backgroundColor: color }}
                        className="absolute -top-3 left-2 text-[10px] font-mono font-extrabold text-slate-950 px-2 py-0.5 rounded-md shadow-lg uppercase"
                      >
                        {hs.hotspotId} | {hs.severity}
                      </span>
                    </div>

                    {/* Hotspot Center Pin */}
                    <div
                      style={{ left: `calc(${hs.x}% + ${hs.width / 2}%)`, top: `calc(${hs.y}% + ${hs.height / 2}%)` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                      onClick={() => onSelectHotspot && onSelectHotspot(hs)}
                    >
                      <div
                        style={{ backgroundColor: color }}
                        className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-white text-[10px] font-mono shadow-xl ${pulseClass}`}
                      >
                        {hs.hotspotId}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Hover Tooltip Popup Drawer */}
            {hoveredHs && (
              <div className="absolute top-4 left-4 z-30 bg-slate-950/95 border border-slate-800 p-3 rounded-2xl backdrop-blur-md shadow-2xl space-y-1 text-xs max-w-xs animate-fade-in">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
                  <span className="font-bold text-slate-100 font-mono">{hoveredHs.hotspotId}</span>
                  <StatusBadge severity={hoveredHs.severity} />
                </div>
                <p className="text-slate-300 font-semibold">
                  {hoveredHs.possibleDiseases && hoveredHs.possibleDiseases[0] ? hoveredHs.possibleDiseases[0].name : hoveredHs.stressType}
                </p>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                  <span>Conf: {((hoveredHs.confidence || 0.85) * 100).toFixed(0)}%</span>
                  <span>Area: {hoveredHs.affectedArea} m²</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Satellite GIS Mode */
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={16}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri World Imagery"
            />
            <Polygon
              positions={polygonPositions}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 0.2,
                weight: 3,
                dashArray: '8,4',
              }}
            />
            {hotspots
              .filter((hs) => typeof hs.latitude === 'number' && typeof hs.longitude === 'number' && !isNaN(hs.latitude) && !isNaN(hs.longitude))
              .map((hs) => {
                const lat = hs.latitude;
                const lng = hs.longitude;
                const icon = createHotspotIcon(hs.severity, hs.hotspotId);
                return (
                  <Marker key={hs._id || hs.hotspotId} position={[lat, lng]} icon={icon}>
                    <Popup>
                      <div className="p-2 space-y-1 text-slate-900">
                        <span className="font-bold text-xs block">{hs.hotspotId} ({hs.severity})</span>
                        <p className="text-xs">{hs.stressType}</p>
                        <div className="text-[10px] text-slate-600 font-mono">
                          GPS: {hs.gpsStatus || (hs.isGpsEstimated ? 'GPS_ESTIMATED' : 'GPS_AVAILABLE')}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        )}

        {/* Phase 5 Notice: Displayed when GIS mode is active but hotspots lack geographic coordinates */}
        {mapMode === 'gis' && hotspots.length > 0 && hotspots.every((hs) => hs.latitude === null || hs.latitude === undefined) && (
          <div className="absolute top-4 left-4 z-20 bg-slate-950/90 border border-amber-500/40 px-3.5 py-2 rounded-xl backdrop-blur-md text-xs text-amber-300 shadow-xl flex items-center gap-2 max-w-sm">
            <span>📍</span>
            <span>Geographic coordinates unavailable for this scan. Hotspots preserved in pixel-space (switch to Drone Orthomosaic view).</span>
          </div>
        )}

        {/* Legend Drawer in Bottom Right */}
        <div className="absolute bottom-4 right-4 z-20 bg-slate-950/90 border border-slate-800 p-3 rounded-2xl backdrop-blur-md text-xs space-y-1.5 shadow-2xl">
          <span className="font-bold text-slate-200 text-[11px] block border-b border-slate-800 pb-1">
            {mapMode === 'orthomosaic' && '🚁 Drone Orthomosaic Overlay'}
            {mapMode === 'ndvi' && '🌿 RGB Vegetation Proxy (VARI / ExG)'}
            {mapMode === 'gis' && '🗺️ Satellite GIS Farmland'}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-slate-300">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> 🟢 Healthy Crop Canopy
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-300">
            <span className="w-3 h-3 rounded bg-orange-500 inline-block"></span> 🟠 Foliage Stress Anomaly Box
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-300">
            <span className="w-3 h-3 rounded bg-red-500 inline-block"></span> 🔴 Critical Disease Threat
          </div>
        </div>
      </div>
    </div>
  );
}
