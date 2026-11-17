'use strict';

// Public website gateway. The original api_server.js runs as a private child
// process and is copied into this project byte-for-byte. Do not edit it here.
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const express = require('express');
const proxyLib = require('http-proxy');

const ROOT = __dirname;
const PUBLIC_PORT = Number(process.env.PORT || 8080);
const INTERNAL_PORT = Number(process.env.INTERNAL_API_PORT || 3101);
const API_TARGET = `http://127.0.0.1:${INTERNAL_PORT}`;

const backend = spawn(process.execPath, [path.join(ROOT, 'api_server.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: ['ignore', 'inherit', 'inherit']
});
backend.on('error', error => console.error('[gateway] Could not start existing API process:', error.message));
backend.on('exit', (code, signal) => {
  console.error(`[gateway] Existing API/Discord process exited (code=${code}, signal=${signal || 'none'}).`);
});

const app = express();
const proxy = proxyLib.createProxyServer({ target: API_TARGET, changeOrigin: true, xfwd: true });
proxy.on('error', (error, req, res) => {
  console.error('[gateway] API proxy error:', error.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  }
  if (res && !res.writableEnded) res.end(JSON.stringify({ error: 'EclipseTiers API is temporarily unavailable.' }));
});

app.disable('x-powered-by');
app.get('/healthz', async (_req, res) => {
  let api = 'starting';
  try {
    const response = await fetch(`${API_TARGET}/api/stats`, { signal: AbortSignal.timeout(2500) });
    api = response.ok ? 'online' : `http-${response.status}`;
  } catch (_) { api = 'offline'; }
  const healthy = backend.exitCode === null && api === 'online';
  res.status(healthy ? 200 : 503).json({ ok: healthy, service: 'eclipsetiers-web', api, timestamp: new Date().toISOString() });
});

// The legacy single-player endpoint does not apply the hidden-player filter.
// Only expose a profile if the IGN is in the already-filtered public leaderboard.
app.use(async (req, res, next) => {
  const match = req.method === 'GET' && req.path.match(/^\/api\/player\/([^/]+)$/i);
  if (!match) return next();
  let ign;
  try { ign = decodeURIComponent(match[1]).toLocaleLowerCase('en-US'); }
  catch (_) { return res.status(400).json({ error: 'Invalid player name.' }); }
  try {
    const response = await fetch(`${API_TARGET}/api/leaderboard?weapon=all`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return res.status(503).json({ error: 'Public rankings are temporarily unavailable.' });
    const payload = await response.json();
    const players = Array.isArray(payload.players) ? payload.players : [];
    const isPublic = players.some(player => String(player.ign || '').toLocaleLowerCase('en-US') === ign);
    if (!isPublic) return res.status(404).json({ error: 'Player not found.' });
    return next();
  } catch (error) {
    console.error('[gateway] Could not verify public player visibility:', error.message);
    return res.status(503).json({ error: 'Could not verify player visibility. Please retry.' });
  }
});

// Keep API, mod API and bot endpoints on the original service. Match at the
// root middleware level so Express does not strip the mounted prefix before
// http-proxy forwards the original URL. This gateway intentionally does not
// forward the backend WebSocket because its init message contains full
// in-memory records (including private fields).
app.use((req, res, next) => {
  const requestPath = req.path || '';
  if (requestPath.startsWith('/api/') || requestPath === '/api' ||
      requestPath.startsWith('/v2/') || requestPath === '/v2' ||
      requestPath === '/rankings/overall' || requestPath.startsWith('/bot/')) {
    return proxy.web(req, res);
  }
  return next();
});

app.use(express.static(path.join(ROOT, 'dist'), {
  index: false,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.includes(`${path.sep}downloads${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  }
}));

// React routes: /home, /rankings, /compare, /testers, /tiertagger, /player/:IGN
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(ROOT, 'dist', 'index.html'), error => {
    if (error) res.status(503).type('text').send('Website build not found. Run npm run build before starting Railway.');
  });
});

const server = http.createServer(app);
server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`[gateway] EclipseTiers website listening on ${PUBLIC_PORT}; private API port ${INTERNAL_PORT}`);
});

function shutdown(signal) {
  console.log(`[gateway] ${signal} received. Shutting down.`);
  server.close(() => {});
  if (backend && backend.exitCode === null) backend.kill('SIGTERM');
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
