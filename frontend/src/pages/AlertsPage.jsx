import React from 'react';
import { useFields } from '../context/FieldContext';
import StatusBadge from '../components/common/StatusBadge';
import api from '../services/api';
import { Bell, Check, Trash2, AlertTriangle, CloudSun, CheckCircle2 } from 'lucide-react';

export default function AlertsPage() {
  const { alerts, fetchAlerts, selectedField } = useFields();

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      await fetchAlerts();
    } catch (err) {
      console.warn('Mark read error:', err.message);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.delete(`/alerts/${id}`);
      await fetchAlerts();
    } catch (err) {
      console.warn('Dismiss alert error:', err.message);
    }
  };

  const alertFeed = alerts.length > 0 ? alerts : [
    {
      _id: 'a1',
      title: 'CRITICAL Risk Hotspot HS-02 Detected',
      message: 'Field North Farm (Block A): Late Blight suspected with 94% AI confidence. Affected area ~18.2 m².',
      severity: 'CRITICAL',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      _id: 'a2',
      title: 'Crop Stress Increasing',
      message: 'Field overall health decreased from 86% → 74%. 12 active hotspot zones isolated.',
      severity: 'HIGH',
      isRead: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      _id: 'a3',
      title: 'Weather Risk Factor Elevated',
      message: 'High relative humidity (81%) and rainfall expected. Monitor fungal disease-prone areas.',
      severity: 'MEDIUM',
      isRead: true,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            🚨 Field Alerts & Notifications
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time anomaly alerts generated from drone scanning pipeline and weather triggers.
          </p>
        </div>
      </div>

      {/* Alert Feed List */}
      <div className="space-y-4">
        {alertFeed.map((alert) => (
          <div
            key={alert._id}
            className={`p-5 rounded-3xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
              !alert.isRead
                ? 'bg-slate-900 border-red-500/40 ring-1 ring-red-500/20 shadow-lg shadow-red-950/20'
                : 'bg-slate-950/60 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-start gap-4 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm text-slate-100">{alert.title}</h3>
                  <StatusBadge severity={alert.severity} />
                  {!alert.isRead && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                <span className="text-[10px] text-slate-500 font-mono block pt-1">
                  {new Date(alert.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!alert.isRead && (
                <button
                  onClick={() => handleMarkAsRead(alert._id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Mark Read
                </button>
              )}
              <button
                onClick={() => handleDismiss(alert._id)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-800 transition cursor-pointer"
                title="Dismiss Alert"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
