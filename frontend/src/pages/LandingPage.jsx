import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, ShieldCheck, Cpu, Flame, Map, ArrowRight, CheckCircle2, Zap, Layers, Activity, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Agri-Drone AI Logo"
            className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-emerald-950/50 border border-emerald-500/40"
          />
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
              Agri-Drone AI
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 block -mt-1">
              Field Intelligence SaaS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-950 transition cursor-pointer"
          >
            Launch Dashboard 🚀
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-7xl mx-auto text-center space-y-8 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono mb-2">
          <Zap className="w-3.5 h-3.5" /> Powered by Ollama Qwen3-VL Vision Engine
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-100 tracking-tight leading-tight max-w-4xl mx-auto">
          AI-Powered <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">Drone Crop Intelligence</span> Platform
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Scan entire agricultural fields, reconstruct orthomosaic grid maps, detect vegetation stress, isolate high-risk hotspots, and perform targeted visual disease identification before yield loss occurs.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            onClick={() => navigate('/scans')}
            className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-950/80 flex items-center gap-2 transition cursor-pointer"
          >
            Start Field Drone Scan <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigate('/scans')}
            className="px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-amber-400" /> Explore Instant Demo Scan
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <Map className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-base">Full Field Mapping</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reconstructs high-resolution drone orthomosaics into spatial NxM grid tile matrix with localized GPS coordinates.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-teal-950 border border-teal-800 text-teal-400 flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-base">Hotspot Region Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Identifies abnormal vegetation stress tiles, extracts bounding box crop patches, and computes composite risk ratings.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-100 text-base">Qwen3-VL Targeted AI</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Queries local Ollama vision model on extracted hotspot image patches for visual symptoms, confidence %, and evidence.
            </p>
          </div>
        </div>
      </section>

      {/* CORE PRODUCT DIFFERENTIATOR COMPARISON SECTION (Prompt #45) */}
      <section className="py-16 px-6 max-w-6xl mx-auto border-t border-slate-800/80 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
            Architectural Superiority
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Why Generic Image-Upload Tools Fail in Agriculture
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
            Traditional tools guess a single photo. Our platform delivers field-level spatial intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Old Approach */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-red-900/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-sm text-red-400">❌ Old Basic Approach</span>
              <span className="text-[10px] font-mono text-slate-500">Generic Student Web App</span>
            </div>

            <div className="space-y-3 text-xs text-slate-400 font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                1. Upload Single Random Leaf Photo 📷
              </div>
              <div className="text-center text-slate-600">↓</div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-500">
                2. Send Entire Image to AI Model
              </div>
              <div className="text-center text-slate-600">↓</div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-500">
                3. Display Generic Unverified Disease Text
              </div>
            </div>
            <p className="text-xs text-slate-500 italic pt-2">
              Lacks spatial field boundaries, hotspot coordinates, weather context, or agronomic action plans.
            </p>
          </div>

          {/* Our SaaS Platform Architecture */}
          <div className="p-6 rounded-3xl bg-emerald-950/20 border border-emerald-500/40 space-y-4 shadow-xl shadow-emerald-950/50">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-sm text-emerald-400">✨ Agri-Drone AI Intelligence Pipeline</span>
              <span className="text-[10px] font-mono text-emerald-400">Precision SaaS</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>1. Entire Field Drone Scan & Reconstruction</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>2. Grid Region Vegetation & Stress Tiling</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>3. Hotspot Localization & Patch Extraction</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>4. Targeted Qwen3-VL Vision AI Diagnosis</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>5. Weather Synthesis, Risk Rating & Action Plan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        Agri-Drone AI &copy; 2026 Precision Agricultural Intelligence. All rights reserved.
      </footer>
    </div>
  );
}
