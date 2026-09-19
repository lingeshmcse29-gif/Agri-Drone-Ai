import React from 'react';
import { useFields } from '../context/FieldContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { Activity, TrendingDown, ShieldAlert, BarChart3 } from 'lucide-react';

export default function RiskAnalyticsPage() {
  const { selectedField } = useFields();

  const healthData = [
    { day: 'Day 1', health: 92, hotspots: 1, area: 1.2 },
    { day: 'Day 3', health: 89, hotspots: 3, area: 2.8 },
    { day: 'Day 7', health: 84, hotspots: 6, area: 5.4 },
    { day: 'Day 10', health: 81, hotspots: 8, area: 7.2 },
    { day: 'Day 14', health: 78, hotspots: 12, area: 12.4 },
  ];

  const severityDistribution = [
    { name: 'Low Risk', value: 4, color: '#22c55e' },
    { name: 'Medium Risk', value: 5, color: '#eab308' },
    { name: 'High Risk', value: 3, color: '#f97316' },
    { name: 'Critical', value: 2, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          📊 Risk & Crop Health Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Longitudinal crop health tracking, severity distribution, and stress progression curves.
        </p>
      </div>

      {/* Top 2 Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Crop Health Over Time */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" /> Crop Health Progression (%)
            </h2>
            <span className="text-xs font-mono font-bold text-amber-400">-14% over 14 Days</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis domain={[50, 100]} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                />
                <Line type="monotone" dataKey="health" stroke="#22c55e" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hotspots Discovered Over Time */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" /> Hotspots Count Trend
            </h2>
            <span className="text-xs font-mono font-bold text-red-400">+11 New Anomalies</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                />
                <Bar dataKey="hotspots" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom 2 Charts: Severity Breakdown & Affected Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Severity Breakdown */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-slate-100">Hotspot Severity Distribution</h2>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Affected Area Trend (m²) */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-slate-100">Cumulative Affected Area (m²)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem' }} />
                <Line type="monotone" dataKey="area" stroke="#eab308" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
