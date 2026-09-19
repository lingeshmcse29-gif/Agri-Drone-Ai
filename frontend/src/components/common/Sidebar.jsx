import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Plane,
  Map as MapIcon,
  Flame,
  Bug,
  Activity,
  CloudSun,
  Bell,
  CheckSquare,
  History,
  GitCompare,
  Server,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bot,
} from 'lucide-react';
import { useFields } from '../../context/FieldContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { unreadAlertsCount, systemHealth } = useFields();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { key: 'dashboard', name: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { key: 'askAi', name: t('askAi'), path: '/ask-ai', icon: Bot, highlight: true },
    { key: 'fields', name: t('fields'), path: '/fields', icon: MapPin },
    { key: 'droneScans', name: t('droneScans'), path: '/scans', icon: Plane, highlight: true },
    { key: 'fieldMap', name: t('fieldMap'), path: '/map', icon: MapIcon },
    { key: 'hotspots', name: t('hotspots'), path: '/hotspots', icon: Flame },
    { key: 'diseaseAnalysis', name: t('diseaseAnalysis'), path: '/disease-analysis', icon: Bug },
    { key: 'riskAnalytics', name: t('riskAnalytics'), path: '/analytics', icon: Activity },
    { key: 'weather', name: t('weather'), path: '/weather', icon: CloudSun },
    { key: 'alerts', name: t('alerts'), path: '/alerts', icon: Bell, badge: unreadAlertsCount },
    { key: 'recommendations', name: t('recommendations'), path: '/recommendations', icon: CheckSquare },
    { key: 'scanHistory', name: t('scanHistory'), path: '/history', icon: History },
    { key: 'scanCompare', name: t('scanCompare'), path: '/compare', icon: GitCompare },
    { key: 'systemStatus', name: t('systemStatus'), path: '/system-status', icon: Server },
    { key: 'profile', name: t('profile'), path: '/profile', icon: User },
    { key: 'settings', name: t('settings'), path: '/settings', icon: Settings },
  ];

  const isOllamaOnline = systemHealth && systemHealth.ollama === 'Online';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-slate-950 border-r border-slate-800/80 transition-all duration-300 z-30 sticky top-0 h-screen ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="Agri-Drone AI Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-emerald-950/50 shrink-0 border border-emerald-500/40"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                  Agri-Drone AI
                </span>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono">
                  Precision Farming
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* AI Status Banner */}
        {!collapsed && (
          <div className="mx-3 my-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOllamaOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              <span className="text-slate-300 font-medium">{t('qwenVision')}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${isOllamaOnline ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
              {isOllamaOnline ? `● ${t('online')}` : t('fallbackMode')}
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/30 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  } ${item.highlight ? 'ring-1 ring-emerald-500/40 bg-emerald-950/20' : ''}`
                }
              >
                <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
                {!collapsed && <span className="truncate flex-1">{item.name}</span>}
                {!collapsed && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px]">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/90">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/40">
                {user ? user.name.charAt(0) : 'H'}
              </div>
              {!collapsed && (
                <div className="truncate text-xs">
                  <p className="font-semibold text-slate-200 truncate">{user ? user.name : 'Harish'}</p>
                  <p className="text-slate-400 text-[10px] truncate">{user ? user.email : 'farmer@agridrone.ai'}</p>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                title="Log Out Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800/90 p-2 z-40 backdrop-blur-md flex justify-around">
        <NavLink to="/dashboard" className={({ isActive }) => `flex flex-col items-center p-1 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">{t('dashboard')}</span>
        </NavLink>
        <NavLink to="/scans" className={({ isActive }) => `flex flex-col items-center p-1 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
          <Plane className="w-5 h-5" />
          <span className="text-[10px]">{t('droneScans')}</span>
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => `flex flex-col items-center p-1 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
          <MapIcon className="w-5 h-5" />
          <span className="text-[10px]">{t('fieldMap')}</span>
        </NavLink>
        <NavLink to="/hotspots" className={({ isActive }) => `flex flex-col items-center p-1 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
          <Flame className="w-5 h-5" />
          <span className="text-[10px]">{t('hotspots')}</span>
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `flex flex-col items-center p-1 relative ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
          <Bell className="w-5 h-5" />
          <span className="text-[10px]">{t('alerts')}</span>
          {unreadAlertsCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </NavLink>
      </nav>
    </>
  );
}
