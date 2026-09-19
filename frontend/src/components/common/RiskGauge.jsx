import React from 'react';

export default function RiskGauge({ value = 78, label = "Field Health", size = 160 }) {
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  let strokeColor = '#22c55e'; // Green
  let statusText = 'Healthy';

  if (value < 50) {
    strokeColor = '#ef4444'; // Red
    statusText = 'Critical';
  } else if (value < 70) {
    strokeColor = '#f97316'; // Orange
    statusText = 'Stressed';
  } else if (value < 85) {
    strokeColor = '#eab308'; // Yellow
    statusText = 'Fair';
  }

  return (
    <div className="flex flex-col items-center justify-center relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth="12"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-extrabold text-white tracking-tight">{value}%</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{statusText}</span>
      </div>
    </div>
  );
}
