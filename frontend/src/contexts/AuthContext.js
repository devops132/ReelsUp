
import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem('authUser');
    const t = localStorage.getItem('authToken');
    if (u && t) {
      try { setUser(JSON.parse(u)); setToken(t); } catch {}
    }
  }, []);

  const login = async (email, password) => {
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!resp.ok) throw new Error('bad creds');
      const data = await resp.json();
      setToken(data.token); setUser(data.user);
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      return true;
    } catch { return false; }
  };

  const register = async (email, password, name, business) => {
    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, business })
      });
      if (!resp.ok) return false;
      return await login(email, password);
    } catch { return false; }
  };

  const logout = () => {
    setUser(null); setToken(null);
    localStorage.removeItem('authToken'); localStorage.removeItem('authUser');
  };

  const refreshProfile = async () => {
    try {
      const resp = await fetch('/api/user/me', { headers: { Authorization: token ? ('Bearer ' + token) : '' } });
      if (!resp.ok) return false;
      const data = await resp.json();
      setUser(data);
      localStorage.setItem('authUser', JSON.stringify(data));
      return true;
    } catch { return false; }
  };

  return <AuthContext.Provider value={{ user, token, login, register, logout, refreshProfile }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth(){ return useContext(AuthContext); }
