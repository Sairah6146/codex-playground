import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!getToken());
  const [savedIds, setSavedIds] = useState(new Set());
  const [compareIds, setCompareIds] = useState([]);

  const refreshSaved = useCallback(async () => {
    if (!getToken()) { setSavedIds(new Set()); return; }
    try {
      const { results } = await api.saved();
      setSavedIds(new Set(results.map((r) => r.id)));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getToken()) { setProfile(null); return; }
    try {
      const { profile: p } = await api.getProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return; }
    api.me()
      .then(({ user: u, profile: p }) => { setUser(u); setProfile(p); })
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => { refreshSaved(); }, [user, refreshSaved]);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await api.login(email, password);
    setToken(token);
    setUser(u);
    await refreshProfile();
    return u;
  }, [refreshProfile]);

  const register = useCallback(async (email, password, name) => {
    const { token, user: u } = await api.register(email, password, name);
    setToken(token);
    setUser(u);
    await refreshProfile();
    return u;
  }, [refreshProfile]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setSavedIds(new Set());
  }, []);

  const toggleSave = useCallback(async (podcastId) => {
    if (savedIds.has(podcastId)) {
      await api.unsave(podcastId);
      setSavedIds((prev) => { const next = new Set(prev); next.delete(podcastId); return next; });
    } else {
      await api.save(podcastId);
      setSavedIds((prev) => new Set(prev).add(podcastId));
    }
  }, [savedIds]);

  const toggleCompare = useCallback((podcastId) => {
    setCompareIds((prev) => {
      if (prev.includes(podcastId)) return prev.filter((id) => id !== podcastId);
      if (prev.length >= 5) return prev;
      return [...prev, podcastId];
    });
  }, []);

  const value = useMemo(() => ({
    user, profile, authLoading, savedIds, compareIds,
    login, register, logout, toggleSave, toggleCompare, refreshProfile, setProfile,
  }), [user, profile, authLoading, savedIds, compareIds, login, register, logout, toggleSave, toggleCompare, refreshProfile]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
