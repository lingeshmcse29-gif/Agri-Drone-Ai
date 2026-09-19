import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function StatusBadge({ status, severity, risk }) {
  const { t } = useLanguage();

  if (severity) {
    const config = {
      LOW: { bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800', key: 'lowRisk' },
      MEDIUM: { bg: 'bg-amber-950/80 text-amber-300 border-amber-800', key: 'mediumRisk' },
      HIGH: { bg: 'bg-orange-950/80 text-orange-300 border-orange-800', key: 'highRiskBadge' },
      CRITICAL: { bg: 'bg-red-950/80 text-red-300 border-red-800 animate-pulse', key: 'criticalRiskBadge' },
    }[severity] || { bg: 'bg-slate-800 text-slate-300 border-slate-700', key: severity };

    return (
      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wider uppercase ${config.bg}`}>
        {t(config.key)}
      </span>
    );
  }

  if (status) {
    const statusConfig = {
      COMPLETED: { bg: 'bg-emerald-950 text-emerald-300 border-emerald-800', key: 'statusCompleted' },
      PROCESSING: { bg: 'bg-blue-950 text-blue-300 border-blue-800 animate-pulse', key: 'statusProcessing' },
      ANALYZING: { bg: 'bg-indigo-950 text-indigo-300 border-indigo-800 animate-pulse', key: 'statusAnalyzing' },
      UPLOADED: { bg: 'bg-amber-950 text-amber-300 border-amber-800', key: 'statusUploaded' },
      FAILED: { bg: 'bg-red-950 text-red-300 border-red-800', key: 'statusFailed' },
    }[status] || { bg: 'bg-slate-800 text-slate-300 border-slate-700', key: status };

    return (
      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusConfig.bg}`}>
        {t(statusConfig.key)}
      </span>
    );
  }

  return null;
}
