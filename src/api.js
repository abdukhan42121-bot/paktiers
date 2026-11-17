import { useEffect, useState } from 'react';

const CACHE_PREFIX = 'eclipsetiers:v2:';

export function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && Object.prototype.hasOwnProperty.call(value, 'data') ? value : null;
  } catch (_) { return null; }
}

export function writeCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, savedAt: Date.now() })); }
  catch (_) { /* Private browsing / quota: continue without local cache. */ }
}

export async function apiGet(path, options = {}) {
  const response = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal: options.signal
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const body = await response.json(); if (body?.error) message = body.error; } catch (_) {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function useApiResource(key, interval = 30000) {
  const cached = readCache(key);
  const [data, setData] = useState(() => cached?.data ?? null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(() => cached?.savedAt ?? null);
  const [resourceKey, setResourceKey] = useState(() => cached ? key : null);

  useEffect(() => {
    const saved = readCache(key);
    setData(saved?.data ?? null);
    setLoading(!saved);
    setError(null);
    setUpdatedAt(saved?.savedAt ?? null);
    setResourceKey(saved ? key : null);
    let alive = true;
    let controller;
    let timer;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await apiGet(key, { signal: controller.signal });
        if (!alive) return;
        setData(result);
        setResourceKey(key);
        setError(null);
        setUpdatedAt(Date.now());
        setLoading(false);
        writeCache(key, result);
      } catch (err) {
        if (!alive || err.name === 'AbortError') return;
        setError(err);
        setResourceKey(key);
        setLoading(false);
      }
    };
    refresh();
    if (interval > 0) timer = window.setInterval(refresh, interval);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      controller?.abort();
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, interval]);

  return { data, loading, error, updatedAt, resourceKey, stale: Boolean(error && data && resourceKey === key) };
}
