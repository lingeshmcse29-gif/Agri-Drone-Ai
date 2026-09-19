import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AskAIPage from './pages/AskAIPage';
import DashboardPage from './pages/DashboardPage';
import FieldsPage from './pages/FieldsPage';
import DroneScanPage from './pages/DroneScanPage';
import FieldMapPage from './pages/FieldMapPage';
import HotspotsPage from './pages/HotspotsPage';
import DiseaseAnalysisPage from './pages/DiseaseAnalysisPage';
import RiskAnalyticsPage from './pages/RiskAnalyticsPage';
import WeatherPage from './pages/WeatherPage';
import AlertsPage from './pages/AlertsPage';
import RecommendationsPage from './pages/RecommendationsPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import ScanComparePage from './pages/ScanComparePage';
import SystemStatusPage from './pages/SystemStatusPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Main SaaS Platform Application Routes */}
      <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
      <Route path="/ask-ai" element={<AppLayout><AskAIPage /></AppLayout>} />
      <Route path="/fields" element={<AppLayout><FieldsPage /></AppLayout>} />
      <Route path="/scans" element={<AppLayout><DroneScanPage /></AppLayout>} />
      <Route path="/map" element={<AppLayout><FieldMapPage /></AppLayout>} />
      <Route path="/hotspots" element={<AppLayout><HotspotsPage /></AppLayout>} />
      <Route path="/disease-analysis" element={<AppLayout><DiseaseAnalysisPage /></AppLayout>} />
      <Route path="/analytics" element={<AppLayout><RiskAnalyticsPage /></AppLayout>} />
      <Route path="/weather" element={<AppLayout><WeatherPage /></AppLayout>} />
      <Route path="/alerts" element={<AppLayout><AlertsPage /></AppLayout>} />
      <Route path="/recommendations" element={<AppLayout><RecommendationsPage /></AppLayout>} />
      <Route path="/history" element={<AppLayout><ScanHistoryPage /></AppLayout>} />
      <Route path="/compare" element={<AppLayout><ScanComparePage /></AppLayout>} />
      <Route path="/system-status" element={<AppLayout><SystemStatusPage /></AppLayout>} />
      <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
      <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />

      {/* Catch-all redirect to Dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
