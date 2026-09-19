import React from 'react';
import { useFields } from '../context/FieldContext';
import StatusBadge from '../components/common/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { History, Plane, GitCompare, ArrowRight } from 'lucide-react';

export default function ScanHistoryPage() {
  const { latestScan, selectedField } = useFields();
  const navigate = useNavigate();

  const scanHistory = [
    {
      scanId: 'SCAN-2026-081',
      field: selectedField ? selectedField.fieldName : 'North Farm',
      date: 'Aug 29, 2026',
      health: 78,
      hotspots: 12,
      risk: 'HIGH',
      status: 'COMPLETED',
    },
    {
      scanId: 'SCAN-2026-074',
      field: selectedField ? selectedField.fieldName : 'North Farm',
      date: 'Aug 22, 2026',
      health: 84,
      hotspots: 6,
      risk: 'MEDIUM',
      status: 'COMPLETED',
    },
    {
      scanId: 'SCAN-2026-068',
      field: selectedField ? selectedField.fieldName : 'North Farm',
      date: 'Aug 15, 2026',
      health: 91,
      hotspots: 2,
      risk: 'LOW',
      status: 'COMPLETED',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            📜 Historical Drone Field Scans
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete archive of historical drone survey flights and spatial orthomosaic reconstructions.
          </p>
        </div>

        <button
          onClick={() => navigate('/compare')}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
        >
          <GitCompare className="w-4 h-4 text-emerald-400" /> Compare Scans Side-by-Side
        </button>
      </div>

      {/* History Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-4">Scan ID</th>
                <th className="p-4">Agricultural Field</th>
                <th className="p-4">Scan Date</th>
                <th className="p-4">Crop Health</th>
                <th className="p-4">Hotspots</th>
                <th className="p-4">Overall Risk</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {scanHistory.map((scan) => (
                <tr key={scan.scanId} className="hover:bg-slate-900/60 transition">
                  <td className="p-4 font-mono font-bold text-slate-100 flex items-center gap-2">
                    <Plane className="w-4 h-4 text-emerald-400" /> {scan.scanId}
                  </td>
                  <td className="p-4 font-medium">{scan.field}</td>
                  <td className="p-4 font-mono text-slate-400">{scan.date}</td>
                  <td className="p-4 font-mono font-extrabold text-emerald-400">{scan.health}%</td>
                  <td className="p-4 font-mono text-amber-400 font-bold">{scan.hotspots} zones</td>
                  <td className="p-4">
                    <StatusBadge severity={scan.risk} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={scan.status} />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => navigate('/scans')}
                      className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold hover:bg-emerald-900 transition cursor-pointer"
                    >
                      Reopen Analysis →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
