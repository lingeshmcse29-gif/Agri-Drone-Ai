import React from 'react';
import { useFields } from '../context/FieldContext';
import { CloudSun, Droplets, Wind, Sun, Umbrella, ShieldAlert, Thermometer } from 'lucide-react';

export default function WeatherPage() {
  const { weather, selectedField } = useFields();

  const current = weather || {
    temperature: 29,
    humidity: 78,
    rainProbability: 65,
    windSpeed: 12,
    uvIndex: 7.1,
    condition: 'Partly Cloudy & Humid',
    fungalRiskFactor: 'HIGH',
    forecast: [
      { day: 'Today', temp: 29, humidity: 78, rainProb: 65, condition: 'Light Showers' },
      { day: 'Tomorrow', temp: 31, humidity: 74, rainProb: 40, condition: 'Partly Cloudy' },
      { day: 'Day 3', temp: 28, humidity: 82, rainProb: 75, condition: 'Scattered Rain' },
      { day: 'Day 4', temp: 30, humidity: 70, rainProb: 20, condition: 'Sunny' },
      { day: 'Day 5', temp: 32, humidity: 68, rainProb: 15, condition: 'Clear Sky' },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            🌦️ Environmental & Weather Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time field microclimate telemetry & 5-day disease risk forecast.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono">
          Fungal Spore Risk: <strong className="text-red-400 font-bold uppercase">{current.fungalRiskFactor || 'HIGH'}</strong>
        </div>
      </div>

      {/* Main Weather Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/60 text-amber-400 flex items-center justify-center">
            <Thermometer className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Temperature</span>
            <p className="text-2xl font-extrabold text-white font-mono">{current.temperature}°C</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-950/60 text-blue-400 flex items-center justify-center">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Relative Humidity</span>
            <p className="text-2xl font-extrabold text-blue-400 font-mono">{current.humidity}%</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-950/60 text-teal-400 flex items-center justify-center">
            <Umbrella className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Rain Probability</span>
            <p className="text-2xl font-extrabold text-teal-400 font-mono">{current.rainProbability}%</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Wind Speed</span>
            <p className="text-2xl font-extrabold text-slate-200 font-mono">{current.windSpeed} km/h</p>
          </div>
        </div>
      </div>

      {/* Weather + AI Risk Context Banner (Prompt #23) */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Microclimate Risk Synthesis
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          High relative humidity (<strong className="text-amber-300">{current.humidity}%</strong>) combined with expected rainfall (<strong className="text-amber-300">{current.rainProbability}%</strong>) creates optimal ambient conditions for <em>Alternaria solani</em> (Early Blight) spore germination in Tomato crop foliage.
        </p>
      </div>

      {/* 5-Day Forecast Grid */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100">5-Day Field Microclimate Forecast</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {(current.forecast || []).map((day, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <span className="font-bold text-xs text-slate-300 block">{day.day}</span>
              <CloudSun className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-lg font-extrabold text-white font-mono">{day.temp}°C</p>
              <p className="text-[11px] text-slate-400 font-mono">{day.humidity}% Humidity</p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-medium">
                {day.condition}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
