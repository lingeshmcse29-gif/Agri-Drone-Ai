import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 'demo-farmer',
    name: 'Harish (Farmer)',
    email: 'farmer@agridrone.ai',
    role: 'farmer',
  });
  const [token, setToken] = useState(localStorage.getItem('agri_drone_token') || 'demo-token');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Optionally fetch user profile if token present
    if (token && token !== 'demo-token') {
      api.get('/auth/me')
        .then((res) => {
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
          }
        })
        .catch(() => {
          // Keep demo fallback if server token check fails
        });
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('agri_drone_token', res.data.token);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      // Demo fallback login
      const demoUser = { id: 'demo-farmer', name: email.split('@')[0] || 'Farmer', email, role: 'farmer' };
      setUser(demoUser);
      setToken('demo-token');
      localStorage.setItem('agri_drone_token', 'demo-token');
      return { success: true };
    }
  };

  const signup = async (name, email, password, role) => {
    try {
      const res = await api.post('/auth/register', { name, email, password, role });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('agri_drone_token', res.data.token);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      const demoUser = { id: 'demo-farmer', name, email, role: role || 'farmer' };
      setUser(demoUser);
      setToken('demo-token');
      localStorage.setItem('agri_drone_token', 'demo-token');
      return { success: true };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('agri_drone_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
