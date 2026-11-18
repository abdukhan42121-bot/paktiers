'use strict';

// Public website gateway. The original api_server.js runs as a private child
// process and is copied into this project byte-for-byte. Do not edit it here.
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const express = require('express');
const proxyLib = require('http-proxy');

const ROOT = __dirname;
const PUBLIC_PORT = Number(process.env.PORT || 8080);
const INTERNAL_PORT = Number(process.env.INTERNAL_API_PORT || 3101);
const API_TARGET = `http://127.0.0.1:${INTERNAL_PORT}`;
const DATA_DIR = path.join(ROOT, 'eclipsetiers_data');
// Keep this in sync with the public-hidden set in the untouched legacy API.
const HIDDEN_PUBLIC_IDS = new Set(['1121362942106017832']);

function readDataJson(filename, fallback) {
  try {
    const fullPath = path.join(DATA_DIR, filename);
    if (!fullPath.startsWith(DATA_DIR + path.sep) || !fs.existsSync(fullPath)) return fallback;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    console.warn(`[gateway] Could not read ${filename}:`, error.message);
    return fallback;
  }
}

function publicTierAward(log, index) {
  if (!log || HIDDEN_PUBLIC_IDS.has(String(log.playerId || '')) || HIDDEN_PUBLIC_IDS.has(String(log.tieredBy || ''))) return null;
  const playerIGN = String(log.playerIGN || '').trim();
  const weapon = String(log.weapon || '').trim();
  const tier = String(log.tier || '').trim();
  const timestamp = Number(log.timestamp || 0);
  if (!playerIGN || !weapon || !tier || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  return {
    id: `${timestamp}-${index}`, type: 'tier-change', playerIGN, weapon, tier,
    oldTier: log.oldTier ? String(log.oldTier) : null,
    tester: String(log.tieredByTag || 'EclipseTiers staff').slice(0, 80),
    timestamp
  };
}

function publicMatch(match, index) {
  if (!match || typeof match !== 'object') return null;
  const rawPlayers = Array.isArray(match.players) ? match.players : [match.player1, match.player2].filter(Boolean);
  if (rawPlayers.some(player => HIDDEN_PUBLIC_IDS.has(String(player?.discordId || player?.id || '')))) return null;
  const participants = rawPlayers.map(player => ({
    ign: String(player?.ign || '').trim() || 'Unknown player',
    joinedAt: Number(player?.joinedAt || 0) || null
  }));
  const createdAt = Number(match.createdAt || match.timestamp || match.id || 0);
  if (!participants.length || !Number.isFinite(createdAt) || createdAt <= 0) return null;
  return {
    id: String(match.id || `${createdAt}-${index}`),
    weapon: String(match.weapon || match.gamemode || 'Unknown'),
    participants, createdAt,
    status: String(match.status || 'Recorded').slice(0, 32)
  };
}

function publicQueueEvent(event, index) {
  if (!event || HIDDEN_PUBLIC_IDS.has(String(event.discordId || ''))) return null;
  const ign = String(event.ign || '').trim();
  const weapon = String(event.weapon || '').trim();
  const region = ['ME','AS','AU','EU','NA','SA'].includes(String(event.region || '').toUpperCase()) ? String(event.region).toUpperCase() : null;
  const action = event.action === 'joined' ? 'joined' : event.action === 'removed' ? 'removed' : null;
  const timestamp = Number(event.timestamp || 0);
  if (!ign || !weapon || !action || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  return {
    id: String(event.id || `${timestamp}-${index}`), ign, weapon, region, action, timestamp,
    joinedAt: Number(event.joinedAt || 0) || null,
    position: Number(event.position || 0) || null,
    waitedMs: Number(event.waitedMs || 0) || null
  };
}

// The legacy bot stores only the current queue. Observe its existing queue.json
// and persist a separate public-safe event stream from this release onward.
// This is deliberately a gateway-side extension; api_server.js stays untouched.
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
let previousQueueSnapshot = null;
let queueWatcherReady = false;

function readQueueSnapshot() {
  try {
    // A missing queue file means there was no persisted waitlist at baseline.
    // Start from an empty map so the first future join is observable.
    if (!fs.existsSync(QUEUE_FILE)) return new Map();
    const queues = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const snapshot = new Map();
    for (const [weapon, entries] of Object.entries(queues || {})) {
      (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
        const discordId = String(entry?.discordId || '');
        if (!discordId || HIDDEN_PUBLIC_IDS.has(discordId)) return;
        const key = `${weapon}:${discordId}`;
        snapshot.set(key, {
          discordId, ign: String(entry?.ign || 'Unknown player'), weapon: String(weapon),
          joinedAt: Number(entry?.joinedAt || 0) || null, position: index + 1
        });
      });
    }
    return snapshot;
  } catch (_) { return null; }
}

function syncQueueHistory() {
  const current = readQueueSnapshot();
  if (!current) return;
  if (!queueWatcherReady || !previousQueueSnapshot) {
    previousQueueSnapshot = current;
    queueWatcherReady = true;
    return;
  }

  const now = Date.now();
  const events = [];
  for (const [key, entry] of current.entries()) {
    if (!previousQueueSnapshot.has(key)) {
      events.push({
        id: `join-${now}-${events.length}`, action: 'joined', ign: entry.ign, weapon: entry.weapon,
        timestamp: entry.joinedAt || now, joinedAt: entry.joinedAt, position: entry.position
      });
    }
  }
  for (const [key, entry] of previousQueueSnapshot.entries()) {
    if (!current.has(key)) {
      events.push({
        id: `remove-${now}-${events.length}`, action: 'removed', ign: entry.ign, weapon: entry.weapon,
        timestamp: now, joinedAt: entry.joinedAt, position: entry.position,
        waitedMs: entry.joinedAt ? Math.max(0, now - entry.joinedAt) : null
      });
    }
  }
  previousQueueSnapshot = current;
  if (!events.length) return;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const historyPath = path.join(DATA_DIR, 'queue_history.json');
    const tempPath = `${historyPath}.${process.pid}.tmp`;
    const history = readDataJson('queue_history.json', []);
    const next = [...(Array.isArray(history) ? history : []), ...events];
    if (next.length > 5000) next.splice(0, next.length - 5000);
    fs.writeFileSync(tempPath, JSON.stringify(next, null, 2));
    fs.renameSync(tempPath, historyPath);
  } catch (error) {
    console.warn('[gateway] Could not persist queue activity:', error.message);
  }
}

setTimeout(() => {
  syncQueueHistory(); // Establish a baseline; never treat already-waiting players as new joins.
  const poller = setInterval(syncQueueHistory, 2000);
  poller.unref();
  try { fs.watchFile(QUEUE_FILE, { interval: 1000, persistent: false }, syncQueueHistory); } catch (_) {}
}, 2500).unref();

setTimeout(() => {
  const regionalFile = path.join(DATA_DIR, 'regional_queues.json');
  let previous = null;
  let ready = false;
  const readRegional = () => {
    try {
      // The regional queue file is created by the bot on first use. Until it
      // exists, skip this poll so migrated/existing entries become the initial
      // baseline instead of being reported as new joins.
      if (!fs.existsSync(regionalFile)) return null;
      const data = JSON.parse(fs.readFileSync(regionalFile, 'utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        console.warn('[gateway] Regional queue file has an unexpected root shape; keeping the last valid snapshot.');
        return null;
      }
      const snap = new Map();
      for (const region of ['ME','AS','AU','EU','NA','SA']) {
        const modes = data[region];
        if (!modes || typeof modes !== 'object' || Array.isArray(modes)) continue;
        for (const [weapon, entries] of Object.entries(modes)) {
          (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
            const discordId = String(entry?.discordId || '');
            if (!discordId || HIDDEN_PUBLIC_IDS.has(discordId)) return;
            const key = `${region}:${weapon}:${discordId}`;
            snap.set(key, { discordId, ign:String(entry.ign || 'Unknown player'), region, weapon:String(weapon), joinedAt:Number(entry.joinedAt || 0) || null, position:index + 1 });
          });
        }
      }
      return snap;
    } catch (error) {
      console.warn('[gateway] Could not read regional queue snapshot:', error.message);
      return null;
    }
  };
  const syncRegional = () => {
    try {
      const current = readRegional();
      // A malformed/partially-written file is ignored. Never let a transient
      // data issue turn the polling/watch callback into an uncaught exception.
      if (!(current instanceof Map)) return;
      if (!ready || !(previous instanceof Map)) { previous = current; ready = true; return; }
      const now = Date.now();
      const events = [];
      for (const [key, entry] of current.entries()) {
        if (!previous.has(key)) events.push({ id:`rjoin-${now}-${events.length}`, action:'joined', ...entry, timestamp:entry.joinedAt || now });
      }
      for (const [key, entry] of previous.entries()) {
        if (!current.has(key)) events.push({ id:`rremove-${now}-${events.length}`, action:'removed', ...entry, timestamp:now, waitedMs:entry.joinedAt ? Math.max(0, now-entry.joinedAt) : null });
      }
      previous = current;
      if (!events.length) return;
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive:true });
        const historyPath = path.join(DATA_DIR, 'regional_queue_history.json');
        const tempPath = `${historyPath}.${process.pid}.tmp`;
        const oldHistory = readDataJson('regional_queue_history.json', []);
        const history = Array.isArray(oldHistory) ? oldHistory : [];
        history.push(...events);
        if (history.length > 5000) history.splice(0, history.length - 5000);
        fs.writeFileSync(tempPath, JSON.stringify(history, null, 2));
        fs.renameSync(tempPath, historyPath);
      } catch (error) { console.warn('[gateway] Could not persist regional queue history:', error.message); }
    } catch (error) {
      console.warn('[gateway] Regional queue watcher recovered from an unexpected error:', error.message);
    }
  };
  syncRegional(); // establish baseline; pre-existing entries are not backdated as new joins
  const poller = setInterval(syncRegional, 1500);
  poller.unref();
  try { fs.watchFile(regionalFile, { interval: 1000, persistent:false }, syncRegional); } catch (_) {}
}, 3000).unref();

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

// Public, read-only activity endpoints. These expose only the safe fields needed
// by the website; Discord IDs, ticket identifiers and private database fields
// are never returned. The original api_server.js remains untouched.
app.get('/public-api/activity', (req, res) => {
  const requested = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requested) ? Math.min(100, Math.max(1, requested)) : 40;
  const tierLogPath = path.join(DATA_DIR, 'tier_logs.json');
  const matchPath = path.join(DATA_DIR, 'matches.json');
  const queueHistoryPath = path.join(DATA_DIR, 'queue_history.json');
  const regionalQueueHistoryPath = path.join(DATA_DIR, 'regional_queue_history.json');
  const legacyQueueEvents = readDataJson('queue_history.json', []);
  const regionalQueueEvents = readDataJson('regional_queue_history.json', []);
  const rawQueueEvents = [
    ...(Array.isArray(legacyQueueEvents) ? legacyQueueEvents : []),
    ...(Array.isArray(regionalQueueEvents) ? regionalQueueEvents : [])
  ];
  const rawLogs = readDataJson('tier_logs.json', []);
  const rawMatches = readDataJson('matches.json', []);
  const tierAwards = (Array.isArray(rawLogs) ? rawLogs : [])
    .filter(log => log && !log.synced)
    .map(publicTierAward)
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
  const matches = (Array.isArray(rawMatches) ? rawMatches : [])
    .map(publicMatch)
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
  const queueEvents = (Array.isArray(rawQueueEvents) ? rawQueueEvents : [])
    .map(publicQueueEvent)
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
  res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
  res.json({
    generatedAt: Date.now(),
    sources: { tierLogs: fs.existsSync(tierLogPath), matchArchive: fs.existsSync(matchPath), queueArchive: fs.existsSync(queueHistoryPath) || fs.existsSync(regionalQueueHistoryPath), rankSnapshots: false, failedTestArchive: false },
    counts: { tierChanges: tierAwards.length, matchRecords: matches.length, queueEvents: queueEvents.length },
    tierAwards: tierAwards.slice(0, limit),
    matches: matches.slice(0, limit),
    queueEvents: queueEvents.slice(0, limit)
  });
});

app.get('/public-api/player-history/:ign', async (req, res) => {
  let ign;
  try { ign = decodeURIComponent(req.params.ign).trim(); }
  catch (_) { return res.status(400).json({ error: 'Invalid player name.' }); }
  if (!ign || ign.length > 32) return res.status(400).json({ error: 'Invalid player name.' });
  try {
    const boardResponse = await fetch(`${API_TARGET}/api/leaderboard?weapon=all`, { signal: AbortSignal.timeout(5000) });
    if (!boardResponse.ok) return res.status(503).json({ error: 'Public rankings are temporarily unavailable.' });
    const board = await boardResponse.json();
    const publicPlayer = (Array.isArray(board.players) ? board.players : [])
      .find(player => String(player.ign || '').toLocaleLowerCase('en-US') === ign.toLocaleLowerCase('en-US'));
    if (!publicPlayer) return res.status(404).json({ error: 'Player not found.' });
    const rawLogs = readDataJson('tier_logs.json', []);
    const records = (Array.isArray(rawLogs) ? rawLogs : [])
      .filter(log => log && !log.synced && !HIDDEN_PUBLIC_IDS.has(String(log.playerId || '')) &&
        String(log.playerIGN || '').toLocaleLowerCase('en-US') === ign.toLocaleLowerCase('en-US'))
      .map(publicTierAward).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
    res.json({ ign: publicPlayer.ign, records, available: fs.existsSync(path.join(DATA_DIR, 'tier_logs.json')), generatedAt: Date.now() });
  } catch (error) {
    console.error('[gateway] Could not load player history:', error.message);
    res.status(503).json({ error: 'Player history is temporarily unavailable.' });
  }
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
