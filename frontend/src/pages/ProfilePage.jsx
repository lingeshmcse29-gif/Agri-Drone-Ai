import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { User, Mail, Shield, MapPin, Calendar, LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            👤 {t('userProfile')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Precision farming SaaS account details and agronomist permissions.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white font-bold text-xs shadow-lg shadow-red-950/50 transition cursor-pointer flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Log Out Account
        </button>
      </div>

      {/* Main Profile Info Card */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-950/50">
              {user ? user.name.charAt(0) : 'H'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{user ? user.name : 'Harish'}</h2>
              <p className="text-xs text-slate-400">{user ? user.email : 'farmer@agridrone.ai'}</p>
              <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase">
                Role: {user ? user.role : 'farmer'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800/80 text-slate-300 hover:text-red-300 font-semibold text-xs transition cursor-pointer flex items-center gap-2"
          >
            <LogOut className="w-4 h-4 text-red-400" /> Sign Out
          </button>
        </div>

        {/* Account Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Organization / Sector</span>
            <p className="text-slate-200 font-bold text-sm">North Valley Agriculture Co.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Primary Location</span>
            <p className="text-slate-200 font-bold text-sm">Coimbatore Field Operations</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">System Status</span>
            <p className="text-emerald-400 font-bold text-sm">● Active Subscription (SaaS)</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Telemetry Engine</span>
            <p className="text-teal-300 font-bold text-sm">Qwen3-VL Vision Enabled</p>
          </div>
        </div>

        {/* Bottom Danger Zone Action */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Account Session</h3>
            <p className="text-xs text-slate-400">Log out from your current browser session safely.</p>
          </div>

          <button
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg shadow-red-950 transition cursor-pointer flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
