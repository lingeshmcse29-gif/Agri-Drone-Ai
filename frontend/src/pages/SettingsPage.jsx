import React, { useState } from 'react';
import { Settings, Cpu, Globe, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('qwen3-vl:8b');

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          ⚙️ Platform Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure local Ollama endpoint, Qwen3-VL model parameters, and weather notifications.
        </p>
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" /> AI Service & Ollama Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Ollama API Endpoint</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Configured Vision Model</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
