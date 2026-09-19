import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const FieldContext = createContext();

export const FieldProvider = ({ children }) => {
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [latestScan, setLatestScan] = useState(null);
  const [activeHotspots, setActiveHotspots] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [weather, setWeather] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFields = async () => {
    try {
      const res = await api.get('/fields');
      if (res.data.success && res.data.fields.length > 0) {
        setFields(res.data.fields);
        if (!selectedField) {
          setSelectedField(res.data.fields[0]);
        }
      }
    } catch (err) {
      console.warn('Field fetch error:', err.message);
    }
  };

  const fetchLatestScan = async (fieldId) => {
    try {
      const targetId = fieldId || (selectedField ? selectedField._id : null);
      const res = await api.get(`/scans${targetId ? `?fieldId=${targetId}` : ''}`);
      if (res.data.success && res.data.scans.length > 0) {
        const topScan = res.data.scans[0];
        setLatestScan(topScan);

        // Fetch hotspots for this scan
        const hsRes = await api.get(`/hotspots?scanId=${topScan._id}`);
        if (hsRes.data.success) {
          setActiveHotspots(hsRes.data.hotspots);
        }
      }
    } catch (err) {
      console.warn('Scan fetch error:', err.message);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      if (res.data.success) {
        setAlerts(res.data.alerts);
        setUnreadAlertsCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Alert fetch error:', err.message);
    }
  };

  const fetchWeather = async (fieldId) => {
    try {
      const targetId = fieldId || (selectedField ? selectedField._id : '');
      const res = await api.get(`/weather/${targetId}`);
      if (res.data.success) {
        setWeather(res.data.weather);
      }
    } catch (err) {
      console.warn('Weather fetch error:', err.message);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const res = await api.get('/ai/status');
      if (res.data.success) {
        setSystemHealth(res.data.system);
      }
    } catch (err) {
      setSystemHealth({
        frontend: 'Online',
        backend: 'Connecting...',
        mongodb: 'Unknown',
        weatherApi: 'Connected',
        ollama: 'Offline',
      });
    }
  };

  const refreshAllData = async () => {
    setLoading(true);
    await fetchFields();
    await fetchAlerts();
    await checkSystemHealth();
    setLoading(false);
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  useEffect(() => {
    if (selectedField) {
      fetchLatestScan(selectedField._id);
      fetchWeather(selectedField._id);
    }
  }, [selectedField]);

  return (
    <FieldContext.Provider
      value={{
        fields,
        selectedField,
        setSelectedField,
        latestScan,
        setLatestScan,
        activeHotspots,
        alerts,
        unreadAlertsCount,
        weather,
        systemHealth,
        loading,
        refreshAllData,
        fetchLatestScan,
        fetchAlerts,
        fetchWeather,
        checkSystemHealth,
      }}
    >
      {children}
    </FieldContext.Provider>
  );
};

export const useFields = () => useContext(FieldContext);
