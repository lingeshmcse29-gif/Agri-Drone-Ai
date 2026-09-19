import React from 'react';
import { useFields } from '../../context/FieldContext';
import { useLanguage } from '../../context/LanguageContext';
import { MapPin, CloudSun, Bell, RefreshCw, Cpu, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { fields, selectedField, setSelectedField, weather, unreadAlertsCount, systemHealth, refreshAllData } = useFields();
  const { lang, setLang, t, LANGUAGES } = useLanguage();
  const navigate = useNavigate();

  const isOllamaOnline = systemHealth && systemHealth.ollama === 'Online';

  return (
    <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
      {/* Left Greeting & Field Switcher */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            {t('goodMorning')}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {t('monitorFields')}
          </p>
        </div>

        {/* Field Selector Pill */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <select
            value={selectedField ? selectedField._id : ''}
            onChange={(e) => {
              const found = fields.find((f) => f._id === e.target.value);
              if (found) setSelectedField(found);
            }}
            className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            {fields.map((f) => (
              <option key={f._id} value={f._id} className="bg-slate-900 text-slate-200">
                {f.fieldName} ({f.cropType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Multilingual Indian Languages Dropdown Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-950/30">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-transparent text-emerald-300 font-bold focus:outline-none cursor-pointer text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-slate-200">
                {l.native} ({l.name})
              </option>
            ))}
          </select>
        </div>

        {/* Weather Brief */}
        {weather && (
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <CloudSun className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300 font-semibold">{weather.temperature}°C</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{weather.humidity}% humidity</span>
          </div>
        )}

        {/* System AI Engine Pill */}
        <button
          onClick={() => navigate('/system-status')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
            isOllamaOnline
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/70'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-950/70'
          }`}
          title="Click to view full System Health Status"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Qwen3-VL:</span>
          <span>{isOllamaOnline ? `● ${t('online')}` : t('fallbackMode')}</span>
        </button>

        {/* Alerts Bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
          title="Notifications & Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white font-bold text-[10px] flex items-center justify-center animate-bounce">
              {unreadAlertsCount}
            </span>
          )}
        </button>

        {/* Manual Refresh Button */}
        <button
          onClick={refreshAllData}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
