// ============================================================
//  PakTiers — ALL IN ONE v5 (Combined + Ticket Fix)
//  NEW FEATURES:
//  ✅ Android/Bedrock + Java platform selection on register
//  ✅ Registration: crack/premium, region, IGN (ephemeral to player)
//  ✅ Specific register channel enforcement
//  ✅ Auto Discord roles per gamemode tier (HT1-LT5)
//  ✅ Queue cooldown system (2 days after getting a rank)
//  ✅ Ticket system when player joins queue (pings staff role)
//  ✅ Ticket channel auto-created with player name
// ============================================================

const express             = require('express');
const http                = require('http');
const { WebSocketServer } = require('ws');
const cors                = require('cors');
const path                = require('path');
const fs                  = require('fs');

const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionsBitField,
} = require('discord.js');

// ════════════════════════════════════════════════════════════
//  CONFIG — Railway me ye env vars set karo
// ════════════════════════════════════════════════════════════
const CONFIG = {
  BOT_TOKEN:            process.env.BOT_TOKEN,
  CLIENT_ID:            process.env.CLIENT_ID            || '1504744014526677003',
  GUILD_ID:             process.env.GUILD_ID             || '1478080380014952610',
  TIERER_ROLE_ID:       process.env.TIERER_ROLE_ID       || '1504503176358006834',
  MATCH_CHANNEL_ID:     process.env.MATCH_CHANNEL_ID     || '1504510227322503189',
  TIER_SYNC_CHANNEL_ID: process.env.TIER_SYNC_CHANNEL_ID || '1504510227322503189',

  // ── NEW CONFIG ──
  REGISTER_CHANNEL_ID:  process.env.REGISTER_CHANNEL_ID  || '',   // Channel jahan /register kaam kare
  QUEUE_CHANNEL_ID:     process.env.QUEUE_CHANNEL_ID     || '',   // Channel jahan /queue join kaam kare
  TICKET_CATEGORY_ID:   process.env.TICKET_CATEGORY_ID   || '',   // Category jahan tickets banenge
  TICKET_CATEGORY_NAME: 'Tier-TesTing--Tickets',            // Fallback/auto-created ticket category name
  TICKET_STAFF_ROLE_ID: process.env.TICKET_STAFF_ROLE_ID || '',   // Staff role jo tickets me ping ho
  VERIFIED_ROLE_ID:          process.env.VERIFIED_ROLE_ID          || '',   // Role jo register ke baad mile
  TESTERS_ROLE_ID:           process.env.TESTERS_ROLE_ID           || '',   // "﹂Tᴇsᴛᴇʀs ﹁ 👥" role — /startqueue use kar sakta hai
  QUEUE_ANNOUNCE_CHANNEL_ID: process.env.QUEUE_ANNOUNCE_CHANNEL_ID || '',   // Channel where @everyone ping will be sent
  PANEL_CHANNEL_ID:          process.env.PANEL_CHANNEL_ID          || '',   // Channel where waitlist panel message stays (for /setuppanel)
  REG_LOGS_CHANNEL_ID:       process.env.REG_LOGS_CHANNEL_ID       || '',   // Channel for registration logs

  // ── Paktiers Application Panel ──
  APPLICATION_CHANNEL_ID:    process.env.APPLICATION_CHANNEL_ID    || '1518103705889542274', // Channel where /setupticketpnl sends the panel
  APPLICATION_CATEGORY_ID:   process.env.APPLICATION_CATEGORY_ID   || '',   // Category where application tickets get created (auto-created if empty)

  // ── Paktiers Support Panel (simple "Open a ticket!" button) ──
  SUPPORT_CHANNEL_ID:        process.env.SUPPORT_CHANNEL_ID        || '1517571631550038256', // Channel where /setupsupportpnl sends the panel
  SUPPORT_CATEGORY_ID:       process.env.SUPPORT_CATEGORY_ID       || '',   // Category where support tickets get created (auto-created if empty)

  API_SECRET: process.env.API_SECRET || 'paktiers-secret-change-me',
  PORT:       process.env.PORT       || 3001,

  // Cooldown days after tier assignment per gamemode
  TIER_COOLDOWN_DAYS: 2,

  // ── GitHub Backup (/backup create, /backup load) ──
  GITHUB_TOKEN:      process.env.GITHUB_TOKEN      || '',            // GitHub Personal Access Token (repo scope)
  GITHUB_REPO:       process.env.GITHUB_REPO       || '',            // format: username/repo
  GITHUB_BRANCH:     process.env.GITHUB_BRANCH     || 'main',
  GITHUB_BACKUP_DIR: process.env.GITHUB_BACKUP_DIR || 'paktiers-backups', // folder inside repo
};

// ── QUEUE PERM ROLES — runtime mein /queueperm se set hote hain ──────────────
const QUEUE_PERM_FILE = path.join(__dirname, 'paktiers_data', 'queue_perms.json');
function loadQueuePerms() {
  try {
    if (fs.existsSync(QUEUE_PERM_FILE)) return JSON.parse(fs.readFileSync(QUEUE_PERM_FILE, 'utf8'));
  } catch(_) {}
  return { roles: [] };
}
function saveQueuePerms(data) {
  try {
    if (!fs.existsSync(path.join(__dirname, 'paktiers_data')))
      fs.mkdirSync(path.join(__dirname, 'paktiers_data'), { recursive: true });
    fs.writeFileSync(QUEUE_PERM_FILE, JSON.stringify(data, null, 2));
  } catch(_) {}
}
function hasQueuePerm(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (CONFIG.TESTERS_ROLE_ID && member.roles.cache.has(CONFIG.TESTERS_ROLE_ID)) return true;
  const perms = loadQueuePerms();
  return perms.roles.some(rid => member.roles.cache.has(rid));
}

// ── TIERER PERM ROLES + MEMBERS — runtime mein /tiererperm se set hote hain ──
const TIERER_PERM_FILE = path.join(__dirname, 'paktiers_data', 'tierer_perms.json');
function loadTiererPerms() {
  try {
    if (fs.existsSync(TIERER_PERM_FILE)) return JSON.parse(fs.readFileSync(TIERER_PERM_FILE, 'utf8'));
  } catch(_) {}
  return { roles: [], members: [] };
}
function saveTiererPerms(data) {
  try {
    if (!fs.existsSync(path.join(__dirname, 'paktiers_data')))
      fs.mkdirSync(path.join(__dirname, 'paktiers_data'), { recursive: true });
    fs.writeFileSync(TIERER_PERM_FILE, JSON.stringify(data, null, 2));
  } catch(_) {}
}
function hasTiererPerm(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (CONFIG.TIERER_ROLE_ID && member.roles.cache.has(CONFIG.TIERER_ROLE_ID)) return true;
  const perms = loadTiererPerms();
  if (perms.members.includes(member.id)) return true;
  return perms.roles.some(rid => member.roles.cache.has(rid));
}


// ════════════════════════════════════════════════════════════
//  EXPRESS + WEBSOCKET
// ════════════════════════════════════════════════════════════
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── IN-MEMORY DB ──────────────────────────────────────────
const MEM = {
  players:   {},
  queues:    { Mace:[], Crystal:[], Sword:[], Axe:[], Netherite:[], UHC:[], Pot:[], SMP:[], DiaSMP:[] },
  matches:   [],
  cooldowns: {},   // { discordId: { weapon: timestamp } }
  tickets:   {},   // { discordId: channelId }
};

const REMOVED_GAMEMODES = new Set(['Vanilla', 'NethOP', 'Cart', 'Carting', 'SpearMace']);
const GAMEMODE_ALIASES = {};

function normalizeGamemodeName(name) {
  if (!name) return name;
  if (REMOVED_GAMEMODES.has(name)) return null;
  return GAMEMODE_ALIASES[name] || name;
}

function sanitizeGamemodeObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const normalized = normalizeGamemodeName(key);
    if (!normalized) continue;
    out[normalized] = value;
  }
  return out;
}

function requireSecret(req, res, next) {
  if (req.headers['x-api-secret'] !== CONFIG.API_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ type: 'init', data: MEM }));
  ws.on('error', () => {});
});

const wsInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ── TIER UTILS ───────────────────────────────────────────
const TIER_PTS = { HT1:10,LT1:9,HT2:8,LT2:7,HT3:6,LT3:5,HT4:4,LT4:3,HT5:2,LT5:1 };

function getRankTitle(pts) {
  if (pts>=101) return { label:'COMBAT ACE',        emoji:'🔥' };
  if (pts>=51)  return { label:'COMBAT SPECIALIST', emoji:'⚡' };
  if (pts>=26)  return { label:'COMBAT CADET',      emoji:'🟢' };
  if (pts>=10)  return { label:'COMBAT NOICE',      emoji:'🔵' };
  return               { label:'ROOKIE',            emoji:'⚪' };
}

function enrichPlayer(p) {
  const totalPts = Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
  return { ...p, totalPts, rankTitle:getRankTitle(totalPts),
    avatar:`https://mc-heads.net/avatar/${p.ign}/64` };
}

// ════════════════════════════════════════════════════════════
//  BOT -> API ENDPOINTS
// ════════════════════════════════════════════════════════════
app.post('/bot/register', requireSecret, (req,res) => {
  const { discordId, ign, uuid, platform, accountType, region } = req.body;
  if (!discordId||!ign) return res.status(400).json({ error:'Missing fields' });
  if (MEM.players[discordId]) return res.status(409).json({ error:'Already registered' });
  MEM.players[discordId] = {
    discordId, ign, uuid: uuid||null,
    platform: platform||'Java',
    accountType: accountType||'Premium',
    region: region||'PK',
    tiers:{}, registeredAt:Date.now()
  };
  broadcast({ type:'player_registered', player:MEM.players[discordId] });
  res.json({ success:true, player:MEM.players[discordId] });
});

app.post('/bot/tier', requireSecret, (req,res) => {
  const { discordId, weapon, tier } = req.body;
  const player = MEM.players[discordId];
  if (!player) return res.status(404).json({ error:'Player not found' });
  const oldTier = player.tiers[weapon];
  player.tiers[weapon] = tier;
  // Set cooldown
  if (!MEM.cooldowns[discordId]) MEM.cooldowns[discordId] = {};
  MEM.cooldowns[discordId][weapon] = Date.now();
  broadcast({ type:'tier_updated', discordId, ign:player.ign, weapon, tier, oldTier });
  res.json({ success:true, player });
});

app.delete('/bot/tier', requireSecret, (req,res) => {
  const { discordId, weapon } = req.body;
  const player = MEM.players[discordId];
  if (!player) return res.status(404).json({ error:'Player not found' });
  delete player.tiers[weapon];
  broadcast({ type:'tier_removed', discordId, ign:player.ign, weapon });
  res.json({ success:true, player });
});

app.post('/bot/queue', requireSecret, (req,res) => {
  const { discordId, weapon, action } = req.body;
  const player = MEM.players[discordId];
  if (!player) return res.status(404).json({ error:'Player not found' });
  if (action==='join') {
    const q = MEM.queues[weapon];
    if (!q) return res.status(400).json({ error:'Invalid weapon' });
    if (q.find(e=>e.discordId===discordId)) return res.json({ success:true, match:null });
    q.push({ discordId, ign:player.ign, joinedAt:Date.now() });
    if (q.length>=2) {
      const [p1,p2]=[q.shift(),q.shift()];
      const match={ id:Date.now(), weapon, players:[p1,p2], createdAt:Date.now() };
      MEM.matches.push(match);
      broadcast({ type:'match_created', match });
      broadcast({ type:'queue_updated', queues:MEM.queues });
      return res.json({ success:true, match });
    }
    broadcast({ type:'queue_updated', queues:MEM.queues });
    return res.json({ success:true, match:null });
  }
  if (action==='leave') {
    if (weapon==='all') {
      for (const w of Object.keys(MEM.queues))
        MEM.queues[w]=MEM.queues[w].filter(e=>e.discordId!==discordId);
    } else {
      MEM.queues[weapon]=(MEM.queues[weapon]||[]).filter(e=>e.discordId!==discordId);
    }
    broadcast({ type:'queue_updated', queues:MEM.queues });
    return res.json({ success:true });
  }
  res.status(400).json({ error:'action must be join or leave' });
});

// ════════════════════════════════════════════════════════════
//  WEBSITE -> API ENDPOINTS
// ════════════════════════════════════════════════════════════
app.get('/api/stats', (req,res) => {
  const players   = Object.values(MEM.players);
  const tiered    = players.filter(p=>Object.keys(p.tiers).length>0);
  const queuedNow = Object.values(MEM.queues).reduce((s,q)=>s+q.length,0);
  res.json({ totalPlayers:players.length, tieredPlayers:tiered.length, queuedNow, totalMatches:MEM.matches.length });
});

app.get('/api/leaderboard', (req,res) => {
  const weapon = req.query.weapon||'all';
  let players  = Object.values(MEM.players).filter(p=>Object.keys(p.tiers).length>0);
  if (weapon!=='all') {
    players=players.filter(p=>p.tiers[weapon])
      .sort((a,b)=>(TIER_PTS[b.tiers[weapon]]||0)-(TIER_PTS[a.tiers[weapon]]||0));
  } else {
    players.sort((a,b)=>{
      const pa=Object.values(a.tiers).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
      const pb=Object.values(b.tiers).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
      return pb-pa;
    });
  }
  res.json({ players:players.map(enrichPlayer) });
});

app.get('/api/player/:ign', (req,res) => {
  const player=Object.values(MEM.players)
    .find(p=>p.ign.toLowerCase()===req.params.ign.toLowerCase());
  if (!player) return res.status(404).json({ error:'Not found' });
  res.json(enrichPlayer(player));
});

app.get('/api/queue', (req,res) => {
  const queues={};
  for (const [w,q] of Object.entries(MEM.queues))
    queues[w]=q.map(e=>({ ...e, avatar:`https://mc-heads.net/avatar/${e.ign}/32` }));
  res.json({ queues });
});

// ════════════════════════════════════════════════════════════
//  MOD API ENDPOINTS
// ════════════════════════════════════════════════════════════
const WEAPON_TO_MOD_GAMEMODE = {
  Mace:'mace', Crystal:'crystal', Sword:'sword', Axe:'axe',
  Netherite:'netherite', Vanilla:'vanilla', UHC:'uhc',
  Pot:'pot', NethOP:'nethop', SMP:'smp', DiaSMP:'diasmp',
};
const TIER_TO_MOD_VALUE = {
  HT1:100,LT1:90,HT2:80,LT2:70,HT3:60,LT3:50,HT4:40,LT4:30,HT5:20,LT5:10,
};

function toModPlayer(p) {
  const totalPts = Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
  const rankInfo = getRankTitle(totalPts);
  const ranks = {};
  for (const [weapon, tier] of Object.entries(p.tiers||{})) {
    const gamemode = WEAPON_TO_MOD_GAMEMODE[weapon] || weapon.toLowerCase();
    ranks[gamemode] = { gamemode, tier, rank:tier, tierValue:TIER_TO_MOD_VALUE[tier]||0,
      tierRank:TIER_TO_MOD_VALUE[tier]||0, retired:false };
  }
  return { ingameName:p.ign, uuid:p.ign, region:p.region||'PK',
    avatar:`https://mc-heads.net/avatar/${p.ign}/64`,
    totalPoints:totalPts, overallRank:totalPts, tierRank:totalPts,
    title:rankInfo.label, rank:rankInfo.label, ranks };
}

app.get('/rankings/overall', (req,res) => {
  try {
    const leaderboard = Object.values(MEM.players)
      .filter(p=>Object.keys(p.tiers||{}).length>0)
      .sort((a,b)=>{
        const pa=Object.values(a.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        const pb=Object.values(b.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        return pb-pa;
      }).map(toModPlayer);
    res.json({ leaderboard });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/search_profile/:ign', (req,res) => {
  try {
    const query = req.params.ign.toLowerCase();
    const players = Object.values(MEM.players)
      .filter(p=>p.ign.toLowerCase().includes(query)).map(toModPlayer);
    res.json({ profile:{ players } });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

const TIER_TO_INT = {HT1:1,LT1:1,HT2:2,LT2:2,HT3:3,LT3:3,HT4:4,LT4:4,HT5:5,LT5:5};
const TIER_TO_POS = {HT1:1,LT1:2,HT2:1,LT2:2,HT3:1,LT3:2,HT4:1,LT4:2,HT5:1,LT5:2};

function toV2Player(p) {
  const rankings = {};
  for (const [weapon, tier] of Object.entries(p.tiers||{})) {
    const gamemode = WEAPON_TO_MOD_GAMEMODE[weapon] || weapon.toLowerCase();
    rankings[gamemode] = { tier:TIER_TO_INT[tier]||5, pos:TIER_TO_POS[tier]||2,
      peakTier:null, peakPos:null, attained:0, retired:false };
  }
  const totalPts = Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
  return { uuid:p.ign, name:p.ign, rankings, region:p.region||'PK',
    points:totalPts, overall:totalPts, badges:[], combat_master:false };
}

function findPlayerByUuidOrIgn(query) {
  const q = query.toLowerCase();
  return Object.values(MEM.players).find(x=>
    x.ign.toLowerCase()===q || (x.uuid&&x.uuid.toLowerCase()===q)
  ) || null;
}

app.get('/v2/mode/list', (req,res) => {
  res.json({
    mace:'Mace', crystal:'Crystal', sword:'Sword', axe:'Axe',
    netherite:'Netherite', vanilla:'Vanilla', uhc:'UHC',
    pot:'Pot', nethop:'NethOP', smp:'SMP', diasmp:'DiaSMP',
  });
});

app.get('/v2/profile/by-name/:name', (req,res) => {
  try {
    const p = Object.values(MEM.players).find(x=>x.ign.toLowerCase()===req.params.name.toLowerCase());
    if (!p) return res.status(404).json({ error:'Player not found' });
    res.json(toV2Player(p));
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/v2/profile/:uuid/rankings', (req,res) => {
  try {
    const p = findPlayerByUuidOrIgn(req.params.uuid);
    if (!p) return res.status(404).json({});
    const rankings = {};
    for (const [weapon, tier] of Object.entries(p.tiers||{})) {
      const gamemode = WEAPON_TO_MOD_GAMEMODE[weapon] || weapon.toLowerCase();
      rankings[gamemode] = { tier:TIER_TO_INT[tier]||5, pos:TIER_TO_POS[tier]||2,
        peakTier:null, peakPos:null, attained:0, retired:false };
    }
    res.json(rankings);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/v2/profile/:uuid', (req,res) => {
  try {
    const p = findPlayerByUuidOrIgn(req.params.uuid);
    if (!p) return res.status(404).json({ error:'Player not found' });
    res.json(toV2Player(p));
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ════════════════════════════════════════════════════════════
//  TESTERS API (website "Testers" section)
//  Testers = members with Tierer permission: the built-in
//  TIERER_ROLE_ID role, plus any roles/members added via
//  "/tiererperm add" — the command that grants people the
//  ability to test/tier players.
// ════════════════════════════════════════════════════════════
app.get('/api/testers', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) return res.json({ testers: [], count: 0, dashboard: { totalTestsThisMonth: 0, activeTesters: 0, onlineNow: 0, topContributor: null, topThree: [] } });
    await guild.members.fetch().catch(() => {});
    const payload = buildTesterDashboard(guild);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message, testers: [], count: 0, dashboard: { totalTestsThisMonth: 0, activeTesters: 0, onlineNow: 0, topContributor: null, topThree: [] } });
  }
});

// ════════════════════════════════════════════════════════════
//  DISCORD BOT
// ════════════════════════════════════════════════════════════
const WEAPONS = ['Mace','Crystal','Sword','Axe','Netherite','UHC','Pot','SMP','DiaSMP'];
const TIERS   = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const WEAPON_EMOJI = {
  Mace:'🔨', Crystal:'💠', Sword:'⚔️', Axe:'🪓', Netherite:'🪨',
  UHC:'🔥', Pot:'🧪', SMP:'🟢', DiaSMP:'💎',
};
const WEAPON_TO_MCTIERS = {
  Mace:'mace', Crystal:'crystal', Sword:'sword', Axe:'axe', Netherite:'netherite',
  UHC:'uhc', Pot:'pot', SMP:'smp', DiaSMP:'diasmp',
};
const TIER_COLOR = {
  HT1:0xFF6B00, LT1:0xFF9933, HT2:0xFFB800, LT2:0xFFD700,
  HT3:0x00C864, LT3:0x00A550, HT4:0x4FC3F7, LT4:0x29B6F6,
  HT5:0x888888, LT5:0x555555,
};
const TIER_BAR = {
  HT1:'▰▰▰▰▰▰▰▰▰▰', LT1:'▰▰▰▰▰▰▰▰▰▱', HT2:'▰▰▰▰▰▰▰▰▱▱', LT2:'▰▰▰▰▰▰▰▱▱▱',
  HT3:'▰▰▰▰▰▰▱▱▱▱', LT3:'▰▰▰▰▰▱▱▱▱▱', HT4:'▰▰▰▰▱▱▱▱▱▱', LT4:'▰▰▰▱▱▱▱▱▱▱',
  HT5:'▰▰▱▱▱▱▱▱▱▱', LT5:'▰▱▱▱▱▱▱▱▱▱',
};
const BRAND_COLOR = 0x7FFF00;
const BOT_FOOTER  = 'PakTiers · Pakistan Minecraft Community';

// ── PLATFORM / REGION / ACCOUNT DATA ──────────────────────
const PLATFORMS    = ['Java Edition'];
const REGIONS_LIST = ['Pakistan 🇵🇰', 'India 🇮🇳', 'UAE 🇦🇪', 'Saudi Arabia 🇸🇦', 'UK 🇬🇧', 'USA 🇺🇸', 'Other 🌍'];
const ACCOUNT_TYPES = ['Premium (Paid)', 'Cracked (Free)'];

// ── REGION → FLAG NORMALIZER ───────────────────────────────
// Player.region string se flag emoji nikaalta/attach karta hai — chahe
// region kaisa bhi stored ho (full name, code, purana synced entry, etc.)
const REGION_FLAG_MAP = {
  'pakistan':      '🇵🇰',
  'pk':            '🇵🇰',
  'india':         '🇮🇳',
  'in':            '🇮🇳',
  'uae':           '🇦🇪',
  'united arab emirates': '🇦🇪',
  'saudi arabia':  '🇸🇦',
  'ksa':           '🇸🇦',
  'uk':            '🇬🇧',
  'united kingdom':'🇬🇧',
  'usa':           '🇺🇸',
  'us':            '🇺🇸',
  'united states': '🇺🇸',
  'as/au':         '🌏',
  'asia':          '🌏',
  'au':            '🌏',
  'australia':     '🌏',
  'eu':            '🇪🇺',
  'europe':        '🇪🇺',
  'na':            '🌎',
  'other':         '🌍',
};

// Emoji regex — matches ANY existing flag/emoji already in the string
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function formatRegion(region) {
  if (!region) return 'Pakistan 🇵🇰';
  const raw = String(region).trim();
  if (EMOJI_RE.test(raw)) return raw; // already has a flag/emoji — leave as-is

  const lower = raw.toLowerCase();
  // exact match first, then "contains" match (handles things like "Region: Pakistan")
  let flag = REGION_FLAG_MAP[lower];
  if (!flag) {
    for (const key of Object.keys(REGION_FLAG_MAP)) {
      if (lower.includes(key)) { flag = REGION_FLAG_MAP[key]; break; }
    }
  }
  return flag ? `${raw} ${flag}` : `${raw} 🌍`;
}

// ── AUTO REACTIONS on public tier-update messages ──────────
const TIER_UPDATE_REACTIONS = ['🏆', '🎉', '🔥', '👍', '💀'];
async function autoReact(message) {
  for (const emoji of TIER_UPDATE_REACTIONS) {
    try { await message.react(emoji); } catch (_) {}
  }
}

// ── GAMEMODE ROLE MAP — AUTO CREATE ───────────────────────
// Bot khud roles banata hai if they don't exist.
// Role name format: "[PakTiers] Sword HT1" etc.
// In-memory cache: roleCache[weapon][tier] = roleId
const roleCache = {};   // populated on first use / bot ready

function roleName(weapon, tier) {
  return `[PakTiers] ${weapon} ${tier}`;
}

async function ensureRole(guild, weapon, tier) {
  if (!roleCache[weapon]) roleCache[weapon] = {};
  if (roleCache[weapon][tier]) {
    const cached = guild.roles.cache.get(roleCache[weapon][tier]);
    if (cached) return cached;
  }

  // Search existing roles by name
  const name = roleName(weapon, tier);
  let role = guild.roles.cache.find(r => r.name === name);

  if (!role) {
    // Create the role
    const TIER_COLORS_HEX = {
      HT1:0xFF6B00, LT1:0xFF9933, HT2:0xFFB800, LT2:0xFFD700,
      HT3:0x00C864, LT3:0x00A550, HT4:0x4FC3F7, LT4:0x29B6F6,
      HT5:0x888888, LT5:0x555555,
    };
    try {
      role = await guild.roles.create({
        name,
        color: TIER_COLORS_HEX[tier] || 0x99AAB5,
        reason: 'PakTiers auto-created tier role',
        mentionable: false,
      });
      console.log(`[ROLE] Created: ${name}`);
    } catch(err) {
      console.error(`[ROLE] Failed to create ${name}:`, err.message);
      return null;
    }
  }

  roleCache[weapon][tier] = role.id;
  return role;
}

function getGamemodeRoleId(guild, weapon, tier) {
  if (!guild || !weapon || !tier) return null;
  const cached = roleCache[weapon]?.[tier];
  if (cached) return cached;
  const name = roleName(weapon, tier);
  const role = guild.roles.cache.find(r => r.name === name);
  if (!role) return null;
  if (!roleCache[weapon]) roleCache[weapon] = {};
  roleCache[weapon][tier] = role.id;
  return role.id;
}

function getTierLabel(t) {
  return { HT1:'High T1',LT1:'Low T1',HT2:'High T2',LT2:'Low T2',
    HT3:'High T3',LT3:'Low T3',HT4:'High T4',LT4:'Low T4',
    HT5:'High T5',LT5:'Low T5' }[t] || t;
}

// ── COOLDOWN UTILS ────────────────────────────────────────
function getCooldownFile() { return path.join(DATA_DIR, 'cooldowns.json'); }

// LT3 ya usse neeche (LT3, LT4, LT5) = 7 din cooldown, baaki = CONFIG.TIER_COOLDOWN_DAYS
const LT3_OR_BELOW = new Set(['LT3']);
function getCooldownDays(tier) {
  return LT3_OR_BELOW.has(tier) ? 7 : CONFIG.TIER_COOLDOWN_DAYS;
}

function saveCooldown(discordId, weapon, tier) {
  const f = getCooldownFile();
  const db = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : {};
  if (!db[discordId]) db[discordId] = {};
  db[discordId][weapon] = { ts: Date.now(), tier: tier || null };
  fs.writeFileSync(f, JSON.stringify(db, null, 2));
  if (!MEM.cooldowns[discordId]) MEM.cooldowns[discordId] = {};
  MEM.cooldowns[discordId][weapon] = db[discordId][weapon];
}

function getCooldown(discordId, weapon) {
  const f = getCooldownFile();
  if (!fs.existsSync(f)) return null;
  const db = JSON.parse(fs.readFileSync(f,'utf8'));
  const raw = db[discordId]?.[weapon];
  if (!raw) return null;
  // backward compat: old format stored plain number
  if (typeof raw === 'number') return { ts: raw, tier: null };
  return raw;
}

function isOnCooldown(discordId, weapon) {
  const entry = getCooldown(discordId, weapon);
  if (!entry) return { onCooldown: false };
  const ts = entry.ts;
  const days = getCooldownDays(entry.tier);
  const cooldownMs = days * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - ts;
  if (elapsed < cooldownMs) {
    const remaining = cooldownMs - elapsed;
    const hours = Math.floor(remaining / 3600000);
    const mins  = Math.floor((remaining % 3600000) / 60000);
    return { onCooldown: true, hours, mins, endsAt: ts + cooldownMs, days };
  }
  return { onCooldown: false };
}

// ── LOCAL FILE DB ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'paktiers_data');
const PF = path.join(DATA_DIR, 'players.json');

// ── TIER LOGS — /logs command ke liye ────────────────────────
const TIER_LOG_FILE = path.join(DATA_DIR, 'tier_logs.json');
function loadTierLogs() {
  try {
    if (fs.existsSync(TIER_LOG_FILE)) return JSON.parse(fs.readFileSync(TIER_LOG_FILE, 'utf8'));
  } catch(_) {}
  return [];
}
function saveTierLog(entry) {
  try {
    const logs = loadTierLogs();
    logs.push(entry);
    if (logs.length > 5000) logs.splice(0, logs.length - 5000);
    fs.writeFileSync(TIER_LOG_FILE, JSON.stringify(logs, null, 2));
  } catch(_) {}
}

function startOfMonth(ts = Date.now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function buildTesterDashboard(guild) {
  const perms = loadTiererPerms();
  const roleIds = new Set(perms.roles || []);
  if (CONFIG.TIERER_ROLE_ID) roleIds.add(CONFIG.TIERER_ROLE_ID);
  const memberIds = new Set(perms.members || []);
  const monthStart = startOfMonth();

  const allLogs = loadTierLogs().filter(log => log && !log.synced);
  const monthLogs = allLogs.filter(log => Number(log.timestamp || 0) >= monthStart);

  const monthlyCounts = new Map();
  const lifetimeCounts = new Map();
  for (const log of allLogs) {
    if (!log?.tieredBy) continue;
    lifetimeCounts.set(log.tieredBy, (lifetimeCounts.get(log.tieredBy) || 0) + 1);
    if (Number(log.timestamp || 0) >= monthStart) {
      monthlyCounts.set(log.tieredBy, (monthlyCounts.get(log.tieredBy) || 0) + 1);
    }
  }

  const testers = [];
  if (guild) {
    guild.members.cache.forEach(member => {
      if (!member || member.user?.bot) return;
      const hasRole = [...roleIds].some(rid => member.roles.cache.has(rid));
      if (!hasRole && !memberIds.has(member.id)) return;

      const testsThisMonth = monthlyCounts.get(member.id) || 0;
      const testsAllTime = lifetimeCounts.get(member.id) || 0;
      const online = Boolean(member.presence && member.presence.status && member.presence.status !== 'offline');

      testers.push({
        id: member.id,
        username: member.user?.username || member.displayName || 'Unknown',
        displayName: member.displayName || member.user?.username || 'Unknown',
        avatar: member.user?.displayAvatarURL({ extension: 'png', size: 128 }) || `https://mc-heads.net/avatar/${encodeURIComponent(member.displayName || member.user?.username || 'Steve')}/128`,
        online,
        testsThisMonth,
        testsAllTime,
      });
    });
  }

  testers.sort((a, b) => (
    (b.testsThisMonth - a.testsThisMonth) ||
    (b.testsAllTime - a.testsAllTime) ||
    a.displayName.localeCompare(b.displayName)
  ));

  const dashboard = {
    totalTestsThisMonth: monthLogs.length,
    activeTesters: testers.length,
    onlineNow: testers.filter(t => t.online).length,
    topContributor: testers[0] || null,
    topThree: testers.slice(0, 3),
  };

  return { testers, count: testers.length, dashboard };
}
const QF = path.join(DATA_DIR, 'queue.json');
const MF = path.join(DATA_DIR, 'matches.json');
const TF = path.join(DATA_DIR, 'tickets.json');
const SF = path.join(DATA_DIR, 'settings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive:true });
const initF = (f, d) => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(d, null, 2)); };
initF(PF, {});
initF(QF, { Mace:[], Crystal:[], Sword:[], Axe:[], Netherite:[], UHC:[], Pot:[], SMP:[], DiaSMP:[] });
initF(MF, []);
initF(TF, {});
initF(SF, { regLogsChannelId: '', appManagerRoles: [], appManagerUsers: [], supManagerRoles: [], supManagerUsers: [] });

const rDB = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const wDB = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function loadSettings() {
  try { return rDB(SF); } catch(_) { return { regLogsChannelId: '', appManagerRoles: [], appManagerUsers: [], supManagerRoles: [], supManagerUsers: [] }; }
}
function saveSettings(data) {
  try { wDB(SF, data); } catch(_) {}
}

const persistedSettings = loadSettings();
if (persistedSettings?.regLogsChannelId) {
  CONFIG.REG_LOGS_CHANNEL_ID = persistedSettings.regLogsChannelId;
}

function syncToMem() {
  try {
    const p=rDB(PF), q=rDB(QF), m=rDB(MF);
    const cleanPlayers = {};
    for (const [id, player] of Object.entries(p)) {
      const tiers = sanitizeGamemodeObject(player.tiers || {});
      cleanPlayers[id] = { ...player, tiers };
    }
    const cleanQueues = sanitizeGamemodeObject(q);
    Object.assign(MEM.players, cleanPlayers);
    Object.assign(MEM.queues, cleanQueues);
    m.forEach(match => { if (!MEM.matches.find(x=>x.id===match.id)) MEM.matches.push(match); });
    if (fs.existsSync(getCooldownFile()))
      Object.assign(MEM.cooldowns, rDB(getCooldownFile()));
    if (fs.existsSync(TF))
      Object.assign(MEM.tickets, rDB(TF));
    console.log(`📂 Loaded ${Object.keys(p).length} players from disk`);
  } catch(_) {}
}

// ════════════════════════════════════════════════════════════
//  GITHUB BACKUP — /backup create, /backup load
// ════════════════════════════════════════════════════════════
const https = require('https');

function githubRequest(method, urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent':     'PakTiers-Bot',
        'Authorization':  `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept':         'application/vnd.github+json',
        'Content-Type':   'application/json',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch(_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function githubGetFileSha(repoPath) {
  const res = await githubRequest('GET', `/repos/${CONFIG.GITHUB_REPO}/contents/${encodeURI(repoPath)}?ref=${CONFIG.GITHUB_BRANCH}`);
  if (res.status === 200 && res.body && res.body.sha) return res.body.sha;
  return null;
}

async function githubPutFile(repoPath, contentStr, message) {
  const sha = await githubGetFileSha(repoPath);
  const body = {
    message,
    content: Buffer.from(contentStr, 'utf8').toString('base64'),
    branch:  CONFIG.GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await githubRequest('PUT', `/repos/${CONFIG.GITHUB_REPO}/contents/${encodeURI(repoPath)}`, body);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`GitHub PUT failed (${res.status}): ${res.body?.message || 'unknown error'}`);
  }
  return res.body;
}

async function githubGetFile(repoPath) {
  const res = await githubRequest('GET', `/repos/${CONFIG.GITHUB_REPO}/contents/${encodeURI(repoPath)}?ref=${CONFIG.GITHUB_BRANCH}`);
  if (res.status !== 200 || !res.body || !res.body.content) {
    throw new Error(`GitHub GET failed (${res.status}): ${res.body?.message || 'file not found'}`);
  }
  return Buffer.from(res.body.content, 'base64').toString('utf8');
}

// Files jo backup me shamil hote hain — sara tierlist data
function getBackupFileMap() {
  return {
    players:     PF,
    queue:       QF,
    matches:     MF,
    tickets:     TF,
    settings:    SF,
    tierLogs:    TIER_LOG_FILE,
    cooldowns:   getCooldownFile(),
    queuePerms:  QUEUE_PERM_FILE,
    tiererPerms: TIERER_PERM_FILE,
  };
}

function collectBackupData() {
  const fileMap = getBackupFileMap();
  const bundle = { createdAt: Date.now(), data: {} };
  for (const [key, filePath] of Object.entries(fileMap)) {
    try {
      bundle.data[key] = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
    } catch(_) { bundle.data[key] = null; }
  }
  return bundle;
}

function restoreBackupData(bundle) {
  const fileMap = getBackupFileMap();
  for (const [key, filePath] of Object.entries(fileMap)) {
    if (bundle.data[key] === undefined || bundle.data[key] === null) continue;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(bundle.data[key], null, 2));
    } catch(_) {}
  }
}

const LDB = {
  get:      id  => { const db=rDB(PF); return db[id]||null; },
  all:      ()  => rDB(PF),
  findIGN:  ign => Object.values(rDB(PF)).find(p=>p.ign.toLowerCase()===ign.toLowerCase())||null,

  register(id, ign, platform, accountType, region) {
    const db = rDB(PF); if (db[id]) return null;
    db[id] = { discordId:id, ign, platform:platform||'Java Edition',
      accountType:accountType||'Premium (Paid)', region:region||'Pakistan 🇵🇰',
      tiers:{}, registeredAt:Date.now() };
    wDB(PF, db); MEM.players[id]=db[id]; return db[id];
  },
  updateField(id, field, value) {
    const db = rDB(PF); if (!db[id]) return null;
    db[id][field] = value; wDB(PF, db);
    if (MEM.players[id]) MEM.players[id][field] = value;
    return db[id];
  },
  setTier(id, w, t) {
    const db = rDB(PF); if (!db[id]) return null;
    db[id].tiers[w]=t; wDB(PF, db);
    if (MEM.players[id]) MEM.players[id].tiers[w]=t;
    return db[id];
  },
  delTier(id, w) {
    const db = rDB(PF); if (!db[id]) return null;
    delete db[id].tiers[w]; wDB(PF, db);
    if (MEM.players[id]) delete MEM.players[id].tiers[w];
    return db[id];
  },
  getQ:     w => (rDB(QF)[w]||[]),
  allQ:     ()  => rDB(QF),
  joinQ(id, weapon) {
    const db = rDB(QF); if (!db[weapon]) db[weapon]=[];
    if (db[weapon].find(e=>e.discordId===id)) return { ok:false, reason:'dupe' };
    const pData = rDB(PF)[id];
    db[weapon].push({ discordId:id, ign: pData?.ign || null, joinedAt:Date.now() });
    wDB(QF, db); MEM.queues[weapon]=db[weapon];
    if (db[weapon].length>=2) {
      const p1=db[weapon].shift(), p2=db[weapon].shift();
      wDB(QF, db); MEM.queues[weapon]=db[weapon];
      return { ok:true, match:[p1,p2] };
    }
    return { ok:true, match:null };
  },
  leaveQ(id, weapon) {
    const db = rDB(QF); if (!db[weapon]) return;
    db[weapon]=db[weapon].filter(e=>e.discordId!==id);
    wDB(QF, db); MEM.queues[weapon]=db[weapon];
  },
  leaveAllQ(id) {
    const db = rDB(QF);
    for (const w of Object.keys(db)) db[w]=db[w].filter(e=>e.discordId!==id);
    wDB(QF, db); Object.assign(MEM.queues, db);
  },
  addMatch(weapon, p1, p2) {
    const db = rDB(MF);
    const m = { id:Date.now(), weapon, players:[p1,p2], createdAt:Date.now(), status:'ongoing' };
    db.push(m); wDB(MF, db); MEM.matches.push(m); return m;
  },
  // Ticket helpers
  getTicket: id => {
    const db = rDB(TF);
    const v = db[id] || null;
    if (!v) return null;
    return typeof v === 'string' ? { channelId: v } : v;
  },
  setTicket(id, ticketData) {
    const db = rDB(TF);
    const normalized = typeof ticketData === 'string'
      ? { channelId: ticketData }
      : { ...ticketData };
    db[id] = normalized;
    wDB(TF, db);
    MEM.tickets[id] = normalized;
  },
  delTicket(id) {
    const db = rDB(TF); delete db[id]; wDB(TF, db); delete MEM.tickets[id];
  },

  // Ticket-category manager helpers (appmanager / supmanager)
  getManagers(type) {
    const s = rDB(SF);
    return {
      roles: s[`${type}ManagerRoles`] || [],
      users: s[`${type}ManagerUsers`] || [],
    };
  },
  addManagerRole(type, roleId) {
    const s = rDB(SF);
    const key = `${type}ManagerRoles`;
    if (!s[key]) s[key] = [];
    if (!s[key].includes(roleId)) s[key].push(roleId);
    wDB(SF, s);
    return s[key];
  },
  addManagerUser(type, userId) {
    const s = rDB(SF);
    const key = `${type}ManagerUsers`;
    if (!s[key]) s[key] = [];
    if (!s[key].includes(userId)) s[key].push(userId);
    wDB(SF, s);
    return s[key];
  },
};

// ── UUID CACHE ────────────────────────────────────────────
const uuidCache = new Map();
async function getMCUUID(ign) {
  const k=ign.toLowerCase(), c=uuidCache.get(k);
  if (c && Date.now()-c.t<1800000) return c.v;
  try {
    const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${ign}`);
    if (!r.ok) return null;
    const d = await r.json(); if (!d?.id) return null;
    const raw = d.id;
    const uuid = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
    uuidCache.set(k, { v:uuid, t:Date.now() }); return uuid;
  } catch(_) { return null; }
}

async function syncEmbed(client, player, weapon, tier, byId) {
  if (!CONFIG.TIER_SYNC_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(CONFIG.TIER_SYNC_CHANNEL_ID);
    if (!ch) return;
    const uuid = await getMCUUID(player.ign);
    await ch.send({ embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
      .setTitle('🔄 PakTiers Tier Sync')
      .addFields(
        {name:'Player',   value:player.ign,                         inline:true},
        {name:'UUID',     value:uuid||'not-found',                  inline:true},
        {name:'Weapon',   value:WEAPON_TO_MCTIERS[weapon]||weapon,  inline:true},
        {name:'Tier',     value:tier,                               inline:true},
        {name:'Tiered By',value:`<@${byId}>`,                       inline:true},
      ).setTimestamp().setFooter({text:BOT_FOOTER})]});
  } catch(_) {}
}

async function sendRegistrationLog(client, player) {
  if (!CONFIG.REG_LOGS_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(CONFIG.REG_LOGS_CHANNEL_ID).catch(() => null);
    if (!ch) return;
    await ch.send({
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('📝 New Registration')
        .addFields(
          { name: 'Player', value: `${player.ign} (<@${player.discordId}>)`, inline: false },
          { name: 'Platform', value: player.platform || 'Java Edition', inline: true },
          { name: 'Account', value: player.accountType || 'Premium (Paid)', inline: true },
          { name: 'Region', value: formatRegion(player.region), inline: true },
          { name: 'Registered At', value: `<t:${Math.floor((player.registeredAt || Date.now()) / 1000)}:F>`, inline: false },
        )
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp()],
    });
  } catch(_) {}
}

// ════════════════════════════════════════════════════════════
//  TICKET SYSTEM
// ════════════════════════════════════════════════════════════

const TICKET_CATEGORY_NAME = CONFIG.TICKET_CATEGORY_NAME || 'Tier-TesTing--Tickets';

function sumPlayerPoints(player) {
  return Object.values(player?.tiers || {}).reduce((s, t) => s + (TIER_PTS[t] || 0), 0);
}

function formatPlayerTierList(player) {
  const entries = Object.entries(player?.tiers || {}).sort((a, b) => (TIER_PTS[b[1]] || 0) - (TIER_PTS[a[1]] || 0));
  if (!entries.length) return '*No tiers yet*';
  return entries.map(([w, t]) => `${WEAPON_EMOJI[w] || '•'} **${w}** — \`${t}\``).join('\n');
}

async function resolveTicketCategory(guild) {
  if (!guild) return null;

  if (CONFIG.TICKET_CATEGORY_ID) {
    const existing = await guild.channels.fetch(CONFIG.TICKET_CATEGORY_ID).catch(() => null);
    if (existing && existing.type === ChannelType.GuildCategory) {
      if (existing.name !== TICKET_CATEGORY_NAME) {
        await existing.edit({ name: TICKET_CATEGORY_NAME }).catch(() => {});
      }
      return existing;
    }
  }

  let category = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === TICKET_CATEGORY_NAME
  );

  if (!category) {
    category = await guild.channels.create({
      name: TICKET_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: 'PakTiers ticket category auto-created',
    }).catch(() => null);
  }

  if (category) CONFIG.TICKET_CATEGORY_ID = category.id;
  return category;
}

function buildTicketEmbed({ player, discordId, weapon = null, pullerId = null, openedById = null, mode = 'queue' }) {
  const previousTier = weapon ? (player.tiers?.[weapon] || null) : null;
  const previousRank = previousTier ? getTierLabel(previousTier) : 'Unranked';

  const title = mode === 'manual'
    ? '🎫 Player Ticket Opened'
    : '🎫 Queue Ticket Opened';

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(title)
    .addFields(
      { name: 'Minecraft Username', value: `**${player.ign}**`,                    inline: false },
      { name: 'Game Mode',          value: weapon ? `**${weapon}**` : 'General',   inline: false },
      { name: 'Previous Rank',      value: previousRank,                           inline: false },
      { name: 'Region',             value: formatRegion(player.region),        inline: false },
    )
    .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
    .setFooter({ text: 'PakTiers Queue Ticket \u00b7 Close when testing is done' })
    .setTimestamp();
}

async function createQueueTicket(client, guild, player, weapon, discordId, pullerId = null) {
  if (!guild) return null;

  try {
    const existing = LDB.getTicket(discordId);
    const existingChannelId = existing?.channelId || existing;
    if (existingChannelId) {
      const existingCh = await client.channels.fetch(existingChannelId).catch(() => null);
      if (existingCh) return existingCh;
    }
  } catch(_) {}

  try {
    const category = await resolveTicketCategory(guild);
    if (!category) return null;

    const safeName = (player.ign || `player-${discordId}`).replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
    const channelName = `ticket-${safeName}`;

    const permOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: discordId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];

    if (pullerId) {
      permOverwrites.push({
        id: pullerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    if (CONFIG.TICKET_STAFF_ROLE_ID) {
      permOverwrites.push({
        id: CONFIG.TICKET_STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: permOverwrites,
      topic: `Queue Ticket — ${player.ign} | ${weapon} | <@${discordId}> | pulledBy=${pullerId || 'unknown'}`,
    });

    LDB.setTicket(discordId, {
      channelId: ticketChannel.id,
      playerId: discordId,
      playerIGN: player.ign,
      weapon,
      testerId: pullerId || null,
      createdAt: Date.now(),
    });

    const staffPing = CONFIG.TICKET_STAFF_ROLE_ID ? `<@&${CONFIG.TICKET_STAFF_ROLE_ID}>` : '';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${discordId}`)
        .setLabel('🔒 Close Ticket')
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({
      content: `${staffPing} <@${discordId}> ${pullerId ? `<@${pullerId}>` : ''}`.trim(),
      embeds: [buildTicketEmbed({
        player,
        discordId,
        weapon,
        pullerId,
        mode: 'queue',
      })],
      components: [row],
    });

    return ticketChannel;
  } catch(err) {
    console.error('[TICKET ERROR]', err);
    return null;
  }
}

async function closeTicket(client, guild, discordId, closedBy) {
  const ticket = LDB.getTicket(discordId);
  const channelId = ticket?.channelId || ticket;
  if (!channelId) return false;
  try {
    const ch = await client.channels.fetch(channelId).catch(()=>null);
    if (ch) {
      await ch.send({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`🔒 Ticket closed by <@${closedBy}>. This channel will be deleted in 5 seconds.`)] });
      setTimeout(() => ch.delete().catch(()=>{}), 5000);
    }
    LDB.delTicket(discordId);
    return true;
  } catch(_) { return false; }
}

// ════════════════════════════════════════════════════════════
//  PAKTIERS APPLICATION PANEL + TICKETS
//  (Helper / Tester / Screensharer / Media)
// ════════════════════════════════════════════════════════════
const APPLICATION_CATEGORY_NAME = 'Paktiers-Applications';
const APPLICATION_TYPE_LABELS = {
  helper:       'Paktiers Helper Application',
  tester:       'Paktiers Tester Application',
  screensharer: 'Paktiers Screensharer Application',
  media:        'Paktiers Media Application',
};

async function resolveApplicationCategory(guild) {
  if (!guild) return null;

  if (CONFIG.APPLICATION_CATEGORY_ID) {
    const existing = await guild.channels.fetch(CONFIG.APPLICATION_CATEGORY_ID).catch(() => null);
    if (existing && existing.type === ChannelType.GuildCategory) return existing;
  }

  let category = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === APPLICATION_CATEGORY_NAME
  );

  if (!category) {
    category = await guild.channels.create({
      name: APPLICATION_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: 'Paktiers application ticket category auto-created',
    }).catch(() => null);
  }

  if (category) CONFIG.APPLICATION_CATEGORY_ID = category.id;
  return category;
}

async function createApplicationTicket(client, guild, member, appType) {
  if (!guild || !member) return null;
  const label = APPLICATION_TYPE_LABELS[appType] || 'Paktiers Application';

  try {
    const category = await resolveApplicationCategory(guild);
    if (!category) return null;

    const safeName   = (member.user?.username || member.id).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const channelName = `app-${appType}-${safeName}`;

    // Avoid duplicate open application of same type by same user
    const existingCh = guild.channels.cache.find(
      ch => ch.parentId === category.id && ch.name === channelName
    );
    if (existingCh) return existingCh;

    const permOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];

    if (CONFIG.TICKET_STAFF_ROLE_ID) {
      permOverwrites.push({
        id: CONFIG.TICKET_STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const { roles: appMgrRoles, users: appMgrUsers } = LDB.getManagers('app');
    for (const rid of appMgrRoles) {
      permOverwrites.push({
        id: rid,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }
    for (const uid of appMgrUsers) {
      permOverwrites.push({
        id: uid,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: permOverwrites,
      topic: `${label} — <@${member.id}>`,
    });

    const staffPing = CONFIG.TICKET_STAFF_ROLE_ID ? `<@&${CONFIG.TICKET_STAFF_ROLE_ID}>` : '';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_apptkt_${member.id}`)
        .setLabel('🔒 Close Application')
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({
      content: `${staffPing} <@${member.id}>`.trim(),
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle(`📋 ${label}`)
        .setDescription(
          `<@${member.id}> ne **${label}** ke liye apply kiya hai.\n\n` +
          `Staff will visit your ticket soon ✨`
        )
        .setFooter({ text: 'Paktiers Tierlist' })
        .setTimestamp()],
      components: [row],
    });

    return ticketChannel;
  } catch(err) {
    console.error('[APPLICATION TICKET ERROR]', err);
    return null;
  }
}

function buildApplicationPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: 'Application Panel' })
    .setTitle('Paktiers Application')
    .setDescription(
      'Thank you for showing interest in **Paktiers** Tierlist. Open an application ticket to apply for tester or moderator !!\n\n' +
      '__**Helper Application**__\n' +
      '• Must be 15 years old or above\n' +
      '• Any moderation experience is not required, but it\'s a plus!\n' +
      '• Must be active\n' +
      '• Be active at least 3 hours a day.\n' +
      '• Joined this server since 1 week or above\n' +
      '• Must be mature\n' +
      '• Be professional in handling tickets and in the application\n' +
      '• Must follow requirements, and rules.\n' +
      '• Be able to follow higher staffs instructions\n\n' +
      '__**Tester Application**__\n' +
      '• Must be 14 years old or above\n' +
      '• Must be active\n' +
      '• Must be Low tier 3 or above\n' +
      '• Must be professional handling tickets\n' +
      '• 15 Tests for Monthly Quota\n' +
      '• Must be mature and unbiased to every players\n' +
      '• Must not be toxic\n' +
      '• Must follow requirements, and rules\n' +
      '• Must follow the instructions from higher staffs\n' +
      '• Must be patient\n\n' +
      '❗ - Mass Pinging staff members will get you application ban.\n' +
      '❗ - Troll / Blank applications will get you an application ban.\n' +
      '❗ - **Application Cooldown: 5 Days**'
    )
    .setFooter({ text: 'Paktiers Tierlist' });
}

function buildApplicationSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('app_apply_select')
      .setPlaceholder('Make a selection')
      .addOptions(
        { label: 'Paktiers Helper Application',       value: 'helper' },
        { label: 'Paktiers Tester Application',       value: 'tester' },
        { label: 'Paktiers Screensharer Application', value: 'screensharer' },
        { label: 'Paktiers Media Application',        value: 'media' },
      ),
  );
}

// ════════════════════════════════════════════════════════════
//  PAKTIERS SUPPORT PANEL (simple "Open a ticket!" button)
// ════════════════════════════════════════════════════════════
const SUPPORT_CATEGORY_NAME = 'Paktiers-Support-Tickets';

async function resolveSupportCategory(guild) {
  if (!guild) return null;

  if (CONFIG.SUPPORT_CATEGORY_ID) {
    const existing = await guild.channels.fetch(CONFIG.SUPPORT_CATEGORY_ID).catch(() => null);
    if (existing && existing.type === ChannelType.GuildCategory) return existing;
  }

  let category = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === SUPPORT_CATEGORY_NAME
  );

  if (!category) {
    category = await guild.channels.create({
      name: SUPPORT_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: 'Paktiers support ticket category auto-created',
    }).catch(() => null);
  }

  if (category) CONFIG.SUPPORT_CATEGORY_ID = category.id;
  return category;
}

async function createSupportTicket(client, guild, member) {
  if (!guild || !member) return null;

  try {
    const category = await resolveSupportCategory(guild);
    if (!category) return null;

    const safeName    = (member.user?.username || member.id).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const channelName = `support-${safeName}`;

    // Avoid duplicate open support ticket for same user
    const existingCh = guild.channels.cache.find(
      ch => ch.parentId === category.id && ch.name === channelName
    );
    if (existingCh) return existingCh;

    const permOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];

    if (CONFIG.TICKET_STAFF_ROLE_ID) {
      permOverwrites.push({
        id: CONFIG.TICKET_STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const { roles: supMgrRoles, users: supMgrUsers } = LDB.getManagers('sup');
    for (const rid of supMgrRoles) {
      permOverwrites.push({
        id: rid,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }
    for (const uid of supMgrUsers) {
      permOverwrites.push({
        id: uid,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: permOverwrites,
      topic: `Paktiers Support Ticket — <@${member.id}>`,
    });

    const staffPing = CONFIG.TICKET_STAFF_ROLE_ID ? `<@&${CONFIG.TICKET_STAFF_ROLE_ID}>` : '';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_supporttkt_${member.id}`)
        .setLabel('🔒 Close Ticket')
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({
      content: `${staffPing} <@${member.id}>`.trim(),
      embeds: [new EmbedBuilder()
        .setColor(0xF5C842)
        .setTitle('🎫 Support Ticket Opened')
        .setDescription(`<@${member.id}> ne support ticket khola hai.\n\nStaff will visit your ticket soon ✨`)
        .setFooter({ text: 'Paktiers Support' })
        .setTimestamp()],
      components: [row],
    });

    return ticketChannel;
  } catch(err) {
    console.error('[SUPPORT TICKET ERROR]', err);
    return null;
  }
}

function buildSupportPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0xF5C842)
    .setTitle('Open a ticket!')
    .setDescription('By clicking the button, a ticket will be opened for you.')
    .setFooter({ text: 'Paktiers Support' });
}

function buildSupportButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('support_open_ticket')
      .setLabel('Open a ticket!')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Primary),
  );
}

// ════════════════════════════════════════════════════════════
//  AUTO ROLE ASSIGNMENT (auto-creates roles if missing)
// ════════════════════════════════════════════════════════════
async function assignTierRole(guild, member, weapon, tier, oldTier) {
  try {
    // Remove old tier role
    if (oldTier) {
      const oldRole = await ensureRole(guild, weapon, oldTier);
      if (oldRole) await member.roles.remove(oldRole).catch(()=>{});
    }
    // Add new tier role (auto-create if needed)
    const newRole = await ensureRole(guild, weapon, tier);
    if (newRole) await member.roles.add(newRole).catch(()=>{});
  } catch(err) {
    console.error('[ROLE ERROR]', err);
  }
}

// Pre-warm role cache on bot ready (ensure all 100 roles exist)
async function ensureAllRoles(guild) {
  const WEAPONS_LIST = ['Mace','Crystal','Sword','Axe','Netherite','UHC','Pot','SMP','DiaSMP'];
  const TIERS_LIST   = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
  console.log('[ROLE] Ensuring all tier roles exist...');
  for (const w of WEAPONS_LIST) {
    for (const t of TIERS_LIST) {
      await ensureRole(guild, w, t);
      await new Promise(r => setTimeout(r, 300)); // rate-limit friendly
    }
  }
  console.log('[ROLE] All tier roles ready.');
}

// ════════════════════════════════════════════════════════════
//  WAITLIST ROLES — auto-create "Waitlist-<Weapon>" roles
// ════════════════════════════════════════════════════════════
const waitlistRoleCache = {};  // weapon -> roleId

// ════════════════════════════════════════════════════════════
//  LIVE PANEL — CTL-style persistent queue message
// ════════════════════════════════════════════════════════════
const LIVE_PANEL_FILE = path.join(__dirname, 'paktiers_data', 'live_panels.json');

function loadLivePanels() {
  try { if (fs.existsSync(LIVE_PANEL_FILE)) return JSON.parse(fs.readFileSync(LIVE_PANEL_FILE, 'utf8')); } catch(_) {}
  return {};
}
function saveLivePanels(data) {
  try { fs.writeFileSync(LIVE_PANEL_FILE, JSON.stringify(data, null, 2)); } catch(_) {}
}

function buildLivePanelEmbed(weapon) {
  const q       = LDB.getQ(weapon);
  const panels  = loadLivePanels();
  const testers = panels[weapon]?.activeTesters || [];
  const currentTest = panels[weapon]?.currentTest || '*No active test*';

  const queueTxt  = q.length
    ? q.map((e, idx) => `${idx + 1}. <@${e.discordId}>`).join('\n')
    : '*There is nobody in the queue yet.*';

  const testerTxt = testers.length
    ? testers.map((id, idx) => `${idx + 1}. <@${id}>`).join('\n')
    : '*No active tester*';

  const now = new Date().toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  const reg = 'PK';

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`✅  ${weapon} Tester Available!`)
    .setDescription(
      `A **${weapon}** queue is open for the **PK** region!\n\n` +
      `The queue is now open and updates in real-time.`
    )
    .addFields(
      { name: '📋  Queue',          value: queueTxt,    inline: false },
      { name: '👥  Active Testers', value: testerTxt,   inline: false },
      { name: '🌍 Region',          value: 'PK',        inline: false },
      { name: '🧪 Current Test',    value: currentTest, inline: false },
    )
    .setFooter({ text: `🌍 Region: ${reg} | 🕐 Last Refresh: ${now}` });
}

async function refreshLivePanel(client, weapon) {
  const panels = loadLivePanels();
  const info   = panels[weapon];
  if (!info?.channelId || !info?.messageId) return;
  try {
    const ch  = await client.channels.fetch(info.channelId).catch(() => null);
    if (!ch) return;
    const msg = await ch.messages.fetch(info.messageId).catch(() => null);
    if (!msg) return;

    const embed   = buildLivePanelEmbed(weapon);
    const joinBtn = new ButtonBuilder().setCustomId(`wl_join_${weapon}`).setLabel('Join').setStyle(ButtonStyle.Success);
    const leavBtn = new ButtonBuilder().setCustomId(`wl_leave_${weapon}`).setLabel('Leave').setStyle(ButtonStyle.Danger);
    const pullBtn = new ButtonBuilder().setCustomId(`wl_pull_${weapon}`).setLabel('🎫 Pull').setStyle(ButtonStyle.Primary);
    const row     = new ActionRowBuilder().addComponents(joinBtn, leavBtn, pullBtn);

    await msg.edit({ content: '', embeds: [embed], components: [row] });
    panels[weapon].lastRefresh = Date.now();
    saveLivePanels(panels);
  } catch(err) {
    console.error(`[LIVE PANEL] refresh error (${weapon}):`, err.message);
  }
}

async function ensureWaitlistRole(guild, weapon) {
  if (waitlistRoleCache[weapon]) {
    const cached = guild.roles.cache.get(waitlistRoleCache[weapon]);
    if (cached) return cached;
  }
  const name = `Waitlist-${weapon}`;
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    try {
      role = await guild.roles.create({
        name,
        color: 0x5865F2,
        reason: 'PakTiers auto-created waitlist role',
        mentionable: false,
      });
      console.log(`[WAITLIST ROLE] Created: ${name}`);
    } catch(err) {
      console.error(`[WAITLIST ROLE] Failed to create ${name}:`, err.message);
      return null;
    }
  }
  waitlistRoleCache[weapon] = role.id;
  return role;
}

// ── Send / Refresh the persistent panel message ──────────────────────────────
async function sendWaitlistPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x7FFF00)
    .setTitle('📋  Evaluation Testing — Waitlist & Roles')
    .setDescription(
      '**Step 1: Register Your Profile**\n' +
      'Click the **Register / Update Profile** button below to set your in-game details.\n\n' +
      '**Step 2: Get a Waitlist Role**\n' +
      'After registering, select any gamemode below to get the corresponding **Waitlist** role. Each role has a **2-day cooldown**.\n\n' +
      '> • **Region:** Pakistan server\n' +
      '> • **Username:** Your registered Minecraft IGN\n\n' +
      '\u26A0\uFE0F **Providing false information will result in a denied test.**'
    )
    .setFooter({ text: 'PakTiers · Pakistan Minecraft Community' })
    .setTimestamp();

  const registerBtn = new ButtonBuilder()
    .setCustomId('panel_register')
    .setLabel('Register / Update Profile')
    .setStyle(ButtonStyle.Success)
    .setEmoji('📝');

  const gamemodeSelect = new StringSelectMenuBuilder()
    .setCustomId('panel_waitlist_select')
    .setPlaceholder('Select a gamemode to get the waitlist role ›')
    .addOptions(
      WEAPONS.map(w => ({
        label: `${w}`,
        description: `Join the ${w} waitlist`,
        value: w,
        emoji: WEAPON_EMOJI[w],
      }))
    );

  const row1 = new ActionRowBuilder().addComponents(registerBtn);
  const row2 = new ActionRowBuilder().addComponents(gamemodeSelect);

  return channel.send({ embeds: [embed], components: [row1, row2] });
}

// ════════════════════════════════════════════════════════════
//  QUEUE ACCESS CHECK
//  Player queue join kar sakta hai agar:
//  (a) us weapon ka tier hai, YA
//  (b) us weapon ki Waitlist-<weapon> role hai
// ════════════════════════════════════════════════════════════
async function hasQueueAccess(guild, discordId, player, weapon) {
  // (a) tier check
  if (player?.tiers?.[weapon]) return { allowed: true, via: 'tier', tier: player.tiers[weapon] };

  // (b) waitlist role check
  try {
    const roleName = `Waitlist-${weapon}`;
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (member && member.roles.cache.has(role.id))
        return { allowed: true, via: 'waitlist', tier: 'Waitlist' };
    }
  } catch(_) {}

  return { allowed: false };
}

// ════════════════════════════════════════════════════════════
//  COMMANDS
// ════════════════════════════════════════════════════════════
const CMDS = {};

// ── /msgsend ───────────────────────────────────────────────
CMDS.msgsend = {
  data: new SlashCommandBuilder()
    .setName('msgsend')
    .setDescription('Send a message to any channel')
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message content').setRequired(true)),

  async execute(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Administrator permission required.')] });
    }

    const channel = i.options.getChannel('channel');
    const message = i.options.getString('message');
    try {
      await channel.send({ content: message });
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0x57F287)
        .setDescription(`✅ Message sent to ${channel}.`)] });
    } catch (err) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Could not send message: ${err.message}`)] });
    }
  },
};

// ── /backup ────────────────────────────────────────────────
CMDS.backup = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('PakTiers data ka GitHub backup lo ya restore karo')
    .addSubcommand(sub => sub.setName('create')
      .setDescription('Abhi ka sara tierlist data GitHub pe backup karo'))
    .addSubcommand(sub => sub.setName('load')
      .setDescription('GitHub se latest backup wapis load karo (current data overwrite ho jayega)')
      .addBooleanOption(o => o.setName('confirm').setDescription('true likho confirm karne ke liye').setRequired(true))),

  async execute(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Administrator permission required.')] });
    }
    if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITHUB_REPO) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ `GITHUB_TOKEN` aur `GITHUB_REPO` env vars set nahi hain. Railway → Variables me add karo.\n`GITHUB_REPO` format: `username/repo`')] });
    }

    const sub = i.options.getSubcommand();
    await i.deferReply({ ephemeral:true });

    // ── /backup create ──
    if (sub === 'create') {
      try {
        const bundle  = collectBackupData();
        const jsonStr = JSON.stringify(bundle, null, 2);
        const stamp   = new Date(bundle.createdAt).toISOString().replace(/[:.]/g, '-');

        await githubPutFile(`${CONFIG.GITHUB_BACKUP_DIR}/latest.json`, jsonStr, `PakTiers backup (latest) — ${stamp}`);
        await githubPutFile(`${CONFIG.GITHUB_BACKUP_DIR}/backup-${stamp}.json`, jsonStr, `PakTiers backup — ${stamp}`);

        return i.editReply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
          .setTitle('✅ Backup Complete')
          .setDescription(`Sara data GitHub pe save ho gaya.\n📁 \`${CONFIG.GITHUB_REPO}\` → \`${CONFIG.GITHUB_BACKUP_DIR}/\`\n👤 Players: **${Object.keys(bundle.data.players || {}).length}**`)
          .setFooter({ text: BOT_FOOTER }).setTimestamp()] });
      } catch(err) {
        console.error('[BACKUP CREATE]', err);
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription(`❌ Backup fail ho gaya: ${err.message}`)] });
      }
    }

    // ── /backup load ──
    if (sub === 'load') {
      const confirm = i.options.getBoolean('confirm');
      if (!confirm) {
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription('⚠️ Cancel ho gaya. `confirm: true` set karo agar current data overwrite karna hai.')] });
      }
      try {
        const jsonStr = await githubGetFile(`${CONFIG.GITHUB_BACKUP_DIR}/latest.json`);
        const bundle  = JSON.parse(jsonStr);
        restoreBackupData(bundle);

        // In-memory reload
        MEM.players = {}; MEM.matches = []; MEM.cooldowns = {}; MEM.tickets = {};
        Object.keys(MEM.queues).forEach(k => { MEM.queues[k] = []; });
        syncToMem();
        broadcast({ type: 'backup_restored' });

        return i.editReply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
          .setTitle('✅ Backup Restored')
          .setDescription(`GitHub se data wapis load ho gaya.\n🕒 Backup date: <t:${Math.floor((bundle.createdAt || Date.now()) / 1000)}:F>\n👤 Players: **${Object.keys(bundle.data.players || {}).length}**`)
          .setFooter({ text: BOT_FOOTER }).setTimestamp()] });
      } catch(err) {
        console.error('[BACKUP LOAD]', err);
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription(`❌ Load fail ho gaya: ${err.message}`)] });
      }
    }
  },
};

// ── /embedsend ─────────────────────────────────────────────
CMDS.embedsend = {
  data: new SlashCommandBuilder()
    .setName('embedsend')
    .setDescription('Send a formatted embed message to any channel')
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Body text (use \\n for new lines, supports emoji/markdown)').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. 5865F2').setRequired(false))
    .addAttachmentOption(o => o.setName('image').setDescription('Upload image (shown big at the bottom)').setRequired(false))
    .addAttachmentOption(o => o.setName('thumbnail').setDescription('Upload thumbnail (small image top-right)').setRequired(false)),

  async execute(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Administrator permission required.')] });
    }

    const channel     = i.options.getChannel('channel');
    const description = i.options.getString('description').replace(/\\n/g, '\n');
    const title        = i.options.getString('title');
    const colorInput    = i.options.getString('color');
    const image        = i.options.getAttachment('image')?.url || null;
    const thumbnail    = i.options.getAttachment('thumbnail')?.url || null;

    let color = 0x5865F2;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace('#',''), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder().setColor(color).setDescription(description);
    if (title) embed.setTitle(title);
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);

    try {
      await channel.send({ embeds: [embed] });
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0x57F287)
        .setDescription(`✅ Embed sent to ${channel}.`)] });
    } catch (err) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Could not send embed: ${err.message}`)] });
    }
  },
};

// ── /setreglogschannel ────────────────────────────────────
CMDS.setreglogschannel = {
  data: new SlashCommandBuilder()
    .setName('setreglogschannel')
    .setDescription('Set the channel used for registration logs')
    .addChannelOption(o => o.setName('channel').setDescription('Registration logs channel').setRequired(true)),

  async execute(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Administrator permission required.')] });
    }

    const channel = i.options.getChannel('channel');
    const settings = loadSettings();
    settings.regLogsChannelId = channel.id;
    saveSettings(settings);
    CONFIG.REG_LOGS_CHANNEL_ID = channel.id;

    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0x57F287)
      .setDescription(`✅ Registration logs channel set to ${channel}.`)] });
  },
};

// ── /openticket ───────────────────────────────────────────
CMDS.openticket = {
  data: new SlashCommandBuilder()
    .setName('openticket')
    .setDescription('Open a ticket for a player and show full details')
    .addUserOption(o => o.setName('player').setDescription('Player to open ticket for').setRequired(true))
    .addStringOption(o => o.setName('gamemode')
      .setDescription('Gamemode jiska ticket open karna hai')
      .setRequired(true)
      .addChoices(
        { name: '🔨 Mace',       value: 'Mace'       },
        { name: '💠 Crystal',    value: 'Crystal'    },
        { name: '⚔️ Sword',      value: 'Sword'      },
        { name: '🪓 Axe',        value: 'Axe'        },
        { name: '🪨 Netherite',  value: 'Netherite'  },
        { name: '🔥 UHC',        value: 'UHC'        },
        { name: '🧪 Pot',        value: 'Pot'        },
        { name: '🟢 SMP',        value: 'SMP'        },
        { name: '💎 DiaSMP',     value: 'DiaSMP'     },
      )),

  async execute(i) {
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff  = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const hasTierer = hasTiererPerm(i.member);
    const canUse    = isAdmin || hasStaff || hasTierer || hasQueuePerm(i.member);
    if (!canUse) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Tumhe ticket open karne ki permission nahi.')] });
    }

    const user     = i.options.getUser('player');
    const gamemode = i.options.getString('gamemode');
    const player   = LDB.get(user.id);
    if (!player) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ **${user.username}** registered nahi hai.`)] });
    }

    await i.deferReply({ ephemeral:true });

    const ticketChannel = await createQueueTicket(i.client, i.guild, player, gamemode, user.id, i.user.id);
    if (!ticketChannel) {
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Ticket create nahi ho saka. Category / permissions check karo.')] });
    }

    const gmEmoji = WEAPON_EMOJI[gamemode] || '🎮';
    return i.editReply({ embeds:[new EmbedBuilder().setColor(0x57F287)
      .setTitle('✅ Ticket Open Ho Gaya!')
      .addFields(
        { name: '👤 Player',   value: `<@${user.id}> (**${player.ign}**)`, inline: true },
        { name: '🎮 Gamemode', value: `${gmEmoji} **${gamemode}**`,         inline: true },
        { name: '📩 Channel',  value: `${ticketChannel}`,                   inline: false },
      )
      .setFooter({ text: BOT_FOOTER })
      .setTimestamp()] });
  },
};

// ── /register ─────────────────────────────────────────────
CMDS.register = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a player in PakTiers — works only in the designated channel'),

  async execute(i) {
    if (CONFIG.REGISTER_CHANNEL_ID && i.channelId !== CONFIG.REGISTER_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Please use <#${CONFIG.REGISTER_CHANNEL_ID}> for registration.`)] });
    }

    const existing = LDB.get(i.user.id);
    if (existing) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription(`⚠️ You are already registered as **${existing.ign}**. Use \`/profile\` to view it.`)] });
    }

    regState.set(i.user.id, { platform: 'Java Edition' });

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Choose your account type...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    await i.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 1/2')
        .setDescription('🖥️ **Platform: Java Edition**\n\nChoose your **account type**:')
        .addFields(
          { name:'💎 Premium (Paid)', value:'Official purchased Minecraft account', inline:false },
          { name:'🏴\u200d☠️ Cracked (Free)', value:'TLauncher or any other cracked launcher', inline:false },
        )
        .setFooter({ text:'Only you can see this | PakTiers' })],
      components: [accRow],
    });
  },
};

// ── /profile ──────────────────────────────────────────────
CMDS.profile = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("View a player's PakTiers profile")
    .addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(false))
    .addStringOption(o=>o.setName('ign').setDescription('Search by IGN').setRequired(false)),

  async execute(i) {
    await i.deferReply();
    const ignArg=i.options.getString('ign'), userArg=i.options.getUser('user');
    const player = ignArg ? LDB.findIGN(ignArg) : userArg ? LDB.get(userArg.id) : LDB.get(i.user.id);
    if (!player) return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setTitle('❌ Player Not Found')
      .setDescription(ignArg ? `**${ignArg}** naam ka koi player nahi mila.` : 'You are not registered. Use `/register`.')
      .setFooter({ text:BOT_FOOTER })] });

    const tiers   = player.tiers||{};
    const entries = Object.entries(tiers).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
    const pts     = entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
    const rank    = getRankTitle(pts);
    const color   = entries[0] ? TIER_COLOR[entries[0][1]] : BRAND_COLOR;
    const block   = entries.length===0
      ? '```\nThere are no tiers yet. Ask a Tierer to set one!\n```'
      : '```\n'+entries.map(([w,t])=>`${w.padEnd(11)} ${getTierLabel(t).padEnd(8)}  ${TIER_BAR[t]||'▱▱▱▱▱▱▱▱▱▱'}  +${TIER_PTS[t]}pt`).join('\n')+'\n```';

    const ranked = Object.values(LDB.all())
      .filter(p=>Object.keys(p.tiers||{}).length>0)
      .map(p=>({ ...p, pts:Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0) }))
      .sort((a,b)=>b.pts-a.pts);
    const pos = ranked.findIndex(p=>p.discordId===player.discordId)+1;

    await i.editReply({ embeds:[new EmbedBuilder().setColor(color)
      .setTitle(`${rank.emoji}  ${player.ign}`)
      .setDescription(`**${rank.label}**\n⭐ **${pts} pts** · 🏅 **Rank ${pos>0?`#${pos} of ${ranked.length}`:'Unranked'}** · 🇵🇰`)
      .addFields(
        { name:'⚔️ Weapon Disciplines', value:block },
        { name:'🎮 Platform',   value:player.platform||'Java Edition',    inline:true },
        { name:'🌍 Region',     value:formatRegion(player.region),      inline:true },
        { name:'🔑 Account',    value:player.accountType||'Premium',      inline:true },
        { name:'📅 Registered', value:`<t:${Math.floor(player.registeredAt/1000)}:D>`, inline:true },
        { name:'🔰 Season',     value:'Season 1',                         inline:true },
      )
      .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
      .setFooter({ text:BOT_FOOTER })
      .setTimestamp()] });
  },
};

// ── /tier ─────────────────────────────────────────────────
CMDS.tier = {
  data: new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Tier management (Tierer role required)')
    .addSubcommand(s=>s.setName('set').setDescription("Set a player's tier")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:w,value:w}))))
      .addStringOption(o=>o.setName('tier').setDescription('Tier').setRequired(true)
        .addChoices(...TIERS.map(t=>({name:t,value:t})))))
    .addSubcommand(s=>s.setName('remove').setDescription("Remove a player's tier")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:w,value:w})))))
    .addSubcommand(s=>s.setName('view').setDescription('View all tiers for a player')
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))),

  async execute(i) {
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTierer = hasTiererPerm(i.member);
    if (!isAdmin && !hasTierer)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ **Tierer** role chahiye.')]});

    const sub    = i.options.getSubcommand();
    const target = i.options.getUser('player');
    const weapon = i.options.getString('weapon');
    const tier   = i.options.getString('tier');
    const player = LDB.get(target.id);

    if (sub==='view') {
      if (!player) return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ **${target.username}** registered nahi.`)] });
      const entries = Object.entries(player.tiers||{}).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
      const pts = entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
      return i.reply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle(`📋 Tiers — ${player.ign}`)
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .setDescription(entries.length
          ? entries.map(([w,t])=>`${WEAPON_EMOJI[w]} **${w}** — ${getTierLabel(t)} \`${t}\``).join('\n')
          : '*Koi tier nahi*')
        .setFooter({ text:`Total: ${pts} pts` })] });
    }

    if (sub==='set') {
      if (!player) return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ **${target.username}** ko pehle \`/register\` karna hoga.`)] });
      const oldTier = player.tiers?.[weapon];
      LDB.setTier(target.id, weapon, tier);
      // Set cooldown (with tier info for LT3 = 1 week logic)
      saveCooldown(target.id, weapon, tier);
      // Log the tier action
      saveTierLog({
        tieredBy:     i.user.id,
        tieredByTag:  i.user.username,
        playerId:     target.id,
        playerIGN:    player.ign,
        weapon,
        tier,
        oldTier:      oldTier || null,
        timestamp:    Date.now(),
      });
      broadcast({ type:'tier_updated', discordId:target.id, ign:player.ign, weapon, tier, oldTier });
      broadcast({ type:'testers_updated' });

      // Auto assign Discord role
      try {
        const guild  = i.guild;
        const member = await guild.members.fetch(target.id).catch(()=>null);
        if (member) {
          await assignTierRole(guild, member, weapon, tier, oldTier);
          // Remove Waitlist-<weapon> role during cooldown
          const wlRole = guild.roles.cache.find(r => r.name === `Waitlist-${weapon}`);
          if (wlRole && member.roles.cache.has(wlRole.id)) {
            await member.roles.remove(wlRole).catch(() => {});
          }
        }
      } catch(_) {}

      // Ephemeral ack — sirf tester ko dikhega, isliye channel me "used /tier set" wala
      // indicator kisi aur ko nazar nahi aayega (ephemeral replies sirf invoker ko show hoti hain).
      await i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setDescription(`✅ **${player.ign}**'s ${weapon} tier set to **${getTierLabel(tier)}** \`${tier}\`.`)] });

      const tierUpdateEmbed = new EmbedBuilder()
        .setColor(TIER_COLOR[tier] || BRAND_COLOR)
        .setTitle(`${player.ign}'s Tier Update 🏆`)
        .setThumbnail(`https://mc-heads.net/head/${player.ign}/128`)
        .addFields(
          { name:'Tester',             value:`<@${i.user.id}>`,                         inline:false },
          { name:'Minecraft Username', value:`${player.ign}`,                           inline:false },
          { name:'Game Mode',          value:`${weapon.toUpperCase()}`,                 inline:false },
          { name:'Previous Rank',      value: oldTier ? getTierLabel(oldTier) : 'Unranked', inline:false },
          { name:'Rank Earned',        value: getTierLabel(tier),                       inline:false },
          { name:'Region',             value: formatRegion(player.region),              inline:false },
        )
        .setTimestamp();

      // Public message posted as a normal message (not an interaction reply) —
      // yeh player ko mention karta hai aur "used /tier set" text nahi dikhata.
      let publicMsg = null;
      try {
        publicMsg = await i.channel.send({ content:`<@${target.id}>`, embeds:[tierUpdateEmbed] });
      } catch (_) {}
      if (publicMsg) await autoReact(publicMsg);

      await syncEmbed(i.client, player, weapon, tier, i.user.id);

      // DM player
      try {
        const cdDays = getCooldownDays(tier);
        await target.send({ embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
          .setTitle(`${WEAPON_EMOJI[weapon]} Tumhara ${weapon} tier ${oldTier?'update':'assign'} ho gaya!`)
          .setDescription(`**${getTierLabel(tier)}** (\`${tier}\`) · +${TIER_PTS[tier]} pts\n\n⏳ **${cdDays} din** baad \`/queue join\` kar sakte ho ${weapon} ke liye!`)
          .setFooter({ text:BOT_FOOTER })] });
      } catch(_) {}
      return;
    }

    if (sub==='remove') {
      if (!player||!player.tiers?.[weapon])
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ **${player?.ign||target.username}** ka ${weapon} tier nahi.`)] });
      const removed = player.tiers[weapon];
      LDB.delTier(target.id, weapon);
      broadcast({ type:'tier_removed', discordId:target.id, ign:player.ign, weapon });

      // Remove Discord role
      try {
        const guild  = i.guild;
        const member = await guild.members.fetch(target.id).catch(()=>null);
        if (member) {
          const roleId = getGamemodeRoleId(guild, weapon, removed);
          if (roleId) {
            const role = guild.roles.cache.get(roleId);
            if (role) await member.roles.remove(role).catch(()=>{});
          }
        }
      } catch(_) {}

      await i.reply({ embeds:[new EmbedBuilder().setColor(0xFF4444).setTitle('🗑️ Tier Removed')
        .addFields(
          { name:'Player',       value:`**${player.ign}** (<@${target.id}>)`, inline:true },
          { name:'Weapon',       value:`${WEAPON_EMOJI[weapon]} ${weapon}`,   inline:true },
          { name:'Removed Tier', value:`\`${removed}\``,                      inline:true },
          { name:'Removed By',   value:`<@${i.user.id}>`,                     inline:true },
        ).setTimestamp()] });
      await syncEmbed(i.client, player, weapon, 'REMOVED', i.user.id);
    }
  },
};

// ── /queue ────────────────────────────────────────────────
CMDS.queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Queue commands for matchmaking')
    .addSubcommand(s=>s.setName('join').setDescription('Join the queue')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('leave').setDescription('Leave the queue (or all queues)')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon (leave all = all queues)').setRequired(false)
        .addChoices({name:'🚫 Leave ALL',value:'all'},...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('status').setDescription('View queue status')),

  async execute(i) {
    const sub = i.options.getSubcommand();

    // Channel check for join
    if (sub==='join' && CONFIG.QUEUE_CHANNEL_ID && i.channelId !== CONFIG.QUEUE_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Please use <#${CONFIG.QUEUE_CHANNEL_ID}> to join the queue.`)] });
    }

    if (sub==='status') {
      const queues=LDB.allQ(), all=LDB.all();
      const fields=WEAPONS.map(w=>{
        const q=queues[w]||[];
        return { name:`${WEAPON_EMOJI[w]} ${w} — ${q.length}/2`,
          value:q.length ? q.map((e,idx)=>`${idx+1}. **${all[e.discordId]?.ign||e.ign||'Unknown'}** (<@${e.discordId}>)`).join('\n') : '*Empty*',
          inline:false };
      });
      return i.reply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('🏆 Queue Status')
        .setDescription(`**${WEAPONS.reduce((s,w)=>s+(queues[w]?.length||0),0)}** players in queue`)
        .addFields(fields).setFooter({text:BOT_FOOTER}).setTimestamp()] });
    }

    if (sub==='leave') {
      const player=LDB.get(i.user.id);
      if (!player) return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ You are not registered. Use `/register`.')] });
      const weapon=i.options.getString('weapon');
      if (!weapon||weapon==='all') {
        LDB.leaveAllQ(i.user.id);
        broadcast({ type:'queue_updated', queues:MEM.queues });
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`👋 **${player.ign}** ne saari queues chod di.`)] });
      }
      LDB.leaveQ(i.user.id, weapon);
      broadcast({ type:'queue_updated', queues:MEM.queues });
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription(`👋 **${player.ign}** ne ${WEAPON_EMOJI[weapon]} **${weapon}** queue chodi.`)] });
    }

    if (sub==='join') {
      await i.deferReply({ ephemeral:true });
      const weapon = i.options.getString('weapon');
      const player = LDB.get(i.user.id);

      if (!player) return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ You are not registered. Use `/register`.')] });

      const access = await hasQueueAccess(i.guild, i.user.id, player, weapon);
      if (!access.allowed) return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setTitle('❌ Access Nahi — No Tier & No Waitlist Role')
        .setDescription(
          `Tum **${weapon}** queue join nahi kar sakte.\n\n` +
          `**2 tarike hain join karne ke:**\n` +
          `• Kisi **Tierer** se get your ${weapon} tier, **YA**\n` +
          `• Select **${weapon}** in the panel — get the waitlist role`
        )
        .addFields({ name:'Tumhare Tiers', value:Object.keys(player.tiers||{}).length
          ? Object.entries(player.tiers).map(([w,t])=>`${WEAPON_EMOJI[w]} ${w}: \`${t}\``).join('\n')
          : '*Koi tier nahi*' })
        .setFooter({ text:'PakTiers · Pakistan Minecraft Community' })] });

      // ── COOLDOWN CHECK ─────────────────────────────────────
      const cd = isOnCooldown(i.user.id, weapon);
      if (cd.onCooldown) {
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle(`⏳ ${weapon} Queue — Cooldown Active`)
          .setDescription(`Tumhe **${weapon}** ka tier recently mila hai.\nCooldown khatam hone tak wait karo.`)
          .addFields(
            { name:'⏰ Remaining',    value:`**${cd.hours}h ${cd.mins}m**`, inline:true },
            { name:'✅ Available at', value:`<t:${Math.floor(cd.endsAt/1000)}:F>`, inline:true },
          )
          .setFooter({ text:`${cd.days || CONFIG.TIER_COOLDOWN_DAYS} din ka cooldown tier milne ke baad · PakTiers` })] });
      }

      const result = LDB.joinQ(i.user.id, weapon);
      if (!result.ok && result.reason==='dupe')
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum already ${WEAPON_EMOJI[weapon]} **${weapon}** queue me ho.`)] });

      if (result.match) {
        const [e1,e2] = result.match;
        const p1=LDB.get(e1.discordId), p2=LDB.get(e2.discordId);
        const match=LDB.addMatch(weapon, e1.discordId, e2.discordId);
        broadcast({ type:'match_created', match:{ ...match, players:[
          { discordId:e1.discordId, ign:p1?.ign||'Unknown' },
          { discordId:e2.discordId, ign:p2?.ign||'Unknown' },
        ]}});
        broadcast({ type:'queue_updated', queues:MEM.queues });

        const matchEmbed = new EmbedBuilder().setColor(BRAND_COLOR)
          .setTitle(`${WEAPON_EMOJI[weapon]} Match Found! — ${weapon}`)
          .setDescription('**1v1** match create ho gaya!')
          .addFields(
            { name:'🔵 Player 1', value:`**${p1?.ign||'Unknown'}** (<@${e1.discordId}>)\nTier: \`${p1?.tiers?.[weapon]||'N/A'}\``, inline:true },
            { name:'🔴 Player 2', value:`**${p2?.ign||'Unknown'}** (<@${e2.discordId}>)\nTier: \`${p2?.tiers?.[weapon]||'N/A'}\``, inline:true },
            { name:'Match ID',    value:`\`#${match.id}\``, inline:false },
          ).setTimestamp().setFooter({ text:'PakTiers Matchmaking · Good luck! 🇵🇰' });

        if (CONFIG.MATCH_CHANNEL_ID) {
          try {
            const ch = await i.client.channels.fetch(CONFIG.MATCH_CHANNEL_ID);
            if (ch) await ch.send({ content:`<@${e1.discordId}> vs <@${e2.discordId}>`, embeds:[matchEmbed] });
          } catch(_) {}
        }
        return i.editReply({ embeds:[matchEmbed] });
      }

      broadcast({ type:'queue_updated', queues:MEM.queues });
      const q   = LDB.getQ(weapon);
      const pos = q.findIndex(e=>e.discordId===i.user.id)+1;

      return i.editReply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle(`${WEAPON_EMOJI[weapon]} Joined Queue — ${weapon}`)
        .addFields(
          { name:'Player',      value:`**${player.ign}**`,              inline:true },
          { name:'Your Tier',   value:`\`${player.tiers?.[weapon] || 'Waitlist'}\``, inline:true },
          { name:'Position',    value:`**#${pos}** in queue`,           inline:true },
          { name:'⏳ Status',   value:'Tester ke pull karne ka wait karo…' },
        ).setFooter({ text:'Use /queue leave to exit the queue · PakTiers' }).setTimestamp()] });
    }

  },
};

// ── /leaderboard ──────────────────────────────────────────
CMDS.leaderboard = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('PakTiers leaderboard dekho')
    .addStringOption(o=>o.setName('weapon').setDescription('Weapon filter').setRequired(false)
      .addChoices({name:'🏆 All Weapons',value:'all'},...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))),
  async execute(i) {
    await i.deferReply();
    const weapon = i.options.getString('weapon')||'all';
    let ranked = Object.values(LDB.all()).filter(p=>Object.keys(p.tiers||{}).length>0);
    if (weapon!=='all') {
      ranked=ranked.filter(p=>p.tiers?.[weapon])
        .sort((a,b)=>(TIER_PTS[b.tiers[weapon]]||0)-(TIER_PTS[a.tiers[weapon]]||0));
    } else {
      ranked.sort((a,b)=>{
        const pa=Object.values(a.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        const pb=Object.values(b.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        return pb-pa;
      });
    }
    if (!ranked.length) return i.editReply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setDescription('Abhi koi ranked player nahi!')] });
    const medals=['🥇','🥈','🥉'];
    const rows=ranked.slice(0,10).map((p,idx)=>{
      const medal=medals[idx]||`**${idx+1}.**`;
      if (weapon==='all') {
        const pts=Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        const rk=getRankTitle(pts);
        return`${medal} **${p.ign}** · ${Object.keys(p.tiers||{}).map(w=>WEAPON_EMOJI[w]).join('')}\n   ${rk.emoji} ${rk.label} · **${pts} pts**`;
      }
      return`${medal} **${p.ign}** · \`${p.tiers[weapon]}\` · ${TIER_PTS[p.tiers[weapon]]||0} pts`;
    });
    await i.editReply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setTitle(weapon==='all' ? '🏆 PakTiers — Overall Leaderboard' : `${WEAPON_EMOJI[weapon]} PakTiers — ${weapon} Leaderboard`)
      .setDescription(rows.join('\n\n'))
      .addFields(
        { name:'Total Ranked', value:`**${ranked.length}** players`, inline:true },
        { name:'Season',       value:'**S1**',                       inline:true },
      ).setFooter({ text:BOT_FOOTER }).setTimestamp()] });
  },
};

// ── /help ─────────────────────────────────────────────────
CMDS.help = {
  data: new SlashCommandBuilder().setName('help').setDescription('PakTiers ke saare commands dekho'),
  async execute(i) {
    await i.reply({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setTitle('🏆 PakTiers Bot — Commands')
      .setDescription("Pakistan's Minecraft Java PvP ranking system 🇵🇰")
      .addFields(
        { name:'👤 Player',   value:'`/register` · `/profile [user]` · `/leaderboard [weapon]`' },
        { name:'⚔️ Queue',   value:'`/queue join <weapon>` · `/queue leave [weapon]` · `/queue status`' },
        { name:'🛡️ Tierer',  value:'`/tier set` · `/tier remove` · `/tier view` *(Tierer role required)*' },
        { name:'📊 Tiers',   value:'`HT1 > LT1 > HT2 > LT2 > HT3 > LT3 > HT4 > LT4 > HT5 > LT5`' },
        { name:'⏳ Cooldown', value:`Tier milne ke baad **${CONFIG.TIER_COOLDOWN_DAYS} din** tak us gamemode ka queue band rehta hai` },
        { name:'🎫 Tickets',  value:'Queue join karte hi automatic ticket create hota hai staff ko notify karne ke liye' },
        { name:'🖥️ Platform', value:'Java Edition only' },
      ).setFooter({ text:BOT_FOOTER })] });
  },
};

// ── /closeticket ──────────────────────────────────────────
CMDS.closeticket = {
  data: new SlashCommandBuilder()
    .setName('closeticket')
    .setDescription('Kisi player ka queue ticket band karo (Staff only)')
    .addUserOption(o=>o.setName('player').setDescription('Player jiska ticket band karna hai').setRequired(true)),
  async execute(i) {
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff  = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const hasTierer = hasTiererPerm(i.member);
    if (!isAdmin && !hasStaff && !hasTierer)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Staff ya Tierer role chahiye.')]});
    const target = i.options.getUser('player');
    const closed = await closeTicket(i.client, i.guild, target.id, i.user.id);
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder()
      .setColor(closed ? 0x00C864 : 0xFF9933)
      .setDescription(closed ? `✅ **${target.username}** ka ticket band ho gaya.` : `⚠️ **${target.username}** ka koi open ticket nahi mila.`)] });
  },
};


// ── /syncroles ─────────────────────────────────────────────
CMDS.syncroles = {
  data: new SlashCommandBuilder()
    .setName('syncroles')
    .setDescription('Saare players ke tiers ke hisab se Discord roles sync karo (Admin/Tierer only)'),

  async execute(i) {
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTierer = hasTiererPerm(i.member);
    if (!isAdmin && !hasTierer)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Admin ya Tierer role chahiye.')] });

    await i.deferReply({ ephemeral:true });

    const allPlayers = LDB.all();
    const playerList = Object.values(allPlayers).filter(p => Object.keys(p.tiers||{}).length > 0);

    if (!playerList.length)
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription('⚠️ Koi bhi tiered player nahi mila.')] });

    let success = 0, failed = 0, skipped = 0;
    const errors = [];

    for (const player of playerList) {
      try {
        const member = await i.guild.members.fetch(player.discordId).catch(() => null);
        if (!member) { skipped++; continue; }

        for (const [weapon, tier] of Object.entries(player.tiers || {})) {
          const role = await ensureRole(i.guild, weapon, tier);
          if (role) {
            await member.roles.add(role).catch(() => {});
          }
        }
        success++;
      } catch(err) {
        failed++;
        errors.push(`${player.ign}: ${err.message}`);
      }
      // Rate limit friendly
      await new Promise(r => setTimeout(r, 200));
    }

    return i.editReply({ embeds:[new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('✅ Role Sync Complete')
      .addFields(
        { name:'✅ Synced',  value:`**${success}** players`, inline:true },
        { name:'⏭️ Skipped', value:`**${skipped}** (left server)`, inline:true },
        { name:'❌ Failed',  value:`**${failed}** players`, inline:true },
        errors.length
          ? { name:'⚠️ Errors', value:errors.slice(0,5).join('\n'), inline:false }
          : { name:'​', value:'​', inline:false },
      )
      .setDescription(`Sab registered players ke tiers ke mutabiq roles assign ho gaye.`)
      .setFooter({ text:BOT_FOOTER })
      .setTimestamp()] });
  },
};


// ── /queueperm ────────────────────────────────────────────
CMDS.queueperm = {
  data: new SlashCommandBuilder()
    .setName('queueperm')
    .setDescription('Queue start/stop/pull permission kisi role ko do ya lo (Admin only)')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Role ko queue permission do')
      .addRoleOption(o => o.setName('role').setDescription('Role jise permission deni hai').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Role ki queue permission hato')
      .addRoleOption(o => o.setName('role').setDescription('Role jis ki permission hatani hai').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('Queue permission wale saare roles dekho')),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf **Admin** yeh command use kar sakta hai.')] });

    const sub   = i.options.getSubcommand();
    const perms = loadQueuePerms();

    if (sub === 'list') {
      const roles = perms.roles;
      const builtinLines = [];
      if (CONFIG.TESTERS_ROLE_ID) builtinLines.push(`• <@&${CONFIG.TESTERS_ROLE_ID}> *(built-in: TESTERS_ROLE_ID)*`);

      const customLines = roles.length
        ? roles.map(rid => `• <@&${rid}>`).join('\n')
        : '*Koi custom role nahi*';

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('🔑 Queue Permission Roles')
        .addFields(
          { name:'Built-in', value: builtinLines.length ? builtinLines.join('\n') : '*None set*', inline:false },
          { name:'Custom (/queueperm add)', value: customLines, inline:false },
        )
        .setDescription('Ye saare roles **/queue start**, **Pull button**, aur **/queue join** (testers) use kar sakte hain.')
        .setFooter({ text: BOT_FOOTER })] });
    }

    const role = i.options.getRole('role');

    if (sub === 'add') {
      if (perms.roles.includes(role.id))
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ **${role.name}** ke paas pehle se queue permission hai.`)] });

      perms.roles.push(role.id);
      saveQueuePerms(perms);
      return i.reply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setTitle('✅ Queue Permission Di Gayi')
        .setDescription(`<@&${role.id}> (**${role.name}**) ab yeh sab kar sakta hai:\n• \`/queue start\` — queue announce karna\n• 🎫 **Pull** button — player pull karna\n• Queue join karna (waitlist flow)`)
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp()] });
    }

    if (sub === 'remove') {
      if (!perms.roles.includes(role.id))
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ **${role.name}** ke paas queue permission nahi hai.`)] });

      perms.roles = perms.roles.filter(rid => rid !== role.id);
      saveQueuePerms(perms);
      return i.reply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setTitle('🗑️ Queue Permission Hatayi Gayi')
        .setDescription(`<@&${role.id}> (**${role.name}**) ki queue permission hata di gayi.`)
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp()] });
    }
  },
};

// ── /tiererperm ───────────────────────────────────────────
CMDS.tiererperm = {
  data: new SlashCommandBuilder()
    .setName('tiererperm')
    .setDescription('Tier set karne ki permission kisi role/member ko do ya lo (Admin only)')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Role ya member ko Tierer permission do')
      .addRoleOption(o => o.setName('role').setDescription('Role jise Tierer permission deni hai').setRequired(false))
      .addUserOption(o => o.setName('member').setDescription('Member jise Tierer permission deni hai').setRequired(false)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Role ya member ki Tierer permission hato')
      .addRoleOption(o => o.setName('role').setDescription('Role jis ki Tierer permission hatani hai').setRequired(false))
      .addUserOption(o => o.setName('member').setDescription('Member jis ki Tierer permission hatani hai').setRequired(false)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('Saare roles aur members dekho jinke paas Tierer permission hai')),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf **Admin** yeh command use kar sakta hai.')] });

    const sub   = i.options.getSubcommand();
    const perms = loadTiererPerms();

    // ── LIST ─────────────────────────────────────────────────
    if (sub === 'list') {
      const builtinLines = [];
      if (CONFIG.TIERER_ROLE_ID) builtinLines.push(`• <@&${CONFIG.TIERER_ROLE_ID}> *(built-in: TIERER_ROLE_ID)*`);

      const roleLines = perms.roles.length
        ? perms.roles.map(rid => `• <@&${rid}>`).join('\n')
        : '*Koi custom role nahi*';

      const memberLines = perms.members.length
        ? perms.members.map(uid => `• <@${uid}>`).join('\n')
        : '*Koi custom member nahi*';

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('🛡️ Tierer Permission List')
        .addFields(
          { name:'Built-in Roles', value: builtinLines.length ? builtinLines.join('\n') : '*None set*', inline:false },
          { name:'Custom Roles (/tiererperm add role)', value: roleLines, inline:false },
          { name:'Custom Members (/tiererperm add member)', value: memberLines, inline:false },
        )
        .setDescription('Yeh saare `/tier set`, `/tier remove`, `/syncroles`, aur dusre Tierer-only commands use kar sakte hain.')
        .setFooter({ text: BOT_FOOTER })] });
    }

    const role   = i.options.getRole('role');
    const member = i.options.getUser('member');

    if (!role && !member)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription('⚠️ Kam se kam ek **role** ya **member** dena zaroori hai.')] });

    // ── ADD ──────────────────────────────────────────────────
    if (sub === 'add') {
      const added = [];
      const already = [];

      if (role) {
        if (perms.roles.includes(role.id)) {
          already.push(`<@&${role.id}> (${role.name})`);
        } else {
          perms.roles.push(role.id);
          added.push(`<@&${role.id}> (${role.name})`);
        }
      }

      if (member) {
        if (perms.members.includes(member.id)) {
          already.push(`<@${member.id}> (${member.username})`);
        } else {
          perms.members.push(member.id);
          added.push(`<@${member.id}> (${member.username})`);
        }
      }

      if (added.length) saveTiererPerms(perms);

      const lines = [];
      if (added.length)   lines.push(`✅ **Permission di gayi:**\n${added.join('\n')}`);
      if (already.length) lines.push(`⚠️ **Pehle se permission hai:**\n${already.join('\n')}`);

      return i.reply({ embeds:[new EmbedBuilder()
        .setColor(added.length ? 0x00C864 : 0xFF9933)
        .setTitle('🛡️ Tierer Permission — Add')
        .setDescription(lines.join('\n\n') + '\n\nYeh log ab `/tier set`, `/tier remove`, aur baaki Tierer-only commands use kar sakte hain.')
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp()] });
    }

    // ── REMOVE ───────────────────────────────────────────────
    if (sub === 'remove') {
      const removed = [];
      const notFound = [];

      if (role) {
        if (!perms.roles.includes(role.id)) {
          notFound.push(`<@&${role.id}> (${role.name})`);
        } else {
          perms.roles = perms.roles.filter(rid => rid !== role.id);
          removed.push(`<@&${role.id}> (${role.name})`);
        }
      }

      if (member) {
        if (!perms.members.includes(member.id)) {
          notFound.push(`<@${member.id}> (${member.username})`);
        } else {
          perms.members = perms.members.filter(uid => uid !== member.id);
          removed.push(`<@${member.id}> (${member.username})`);
        }
      }

      if (removed.length) saveTiererPerms(perms);

      const lines = [];
      if (removed.length)  lines.push(`🗑️ **Permission hatayi gayi:**\n${removed.join('\n')}`);
      if (notFound.length) lines.push(`⚠️ **Permission thi hi nahi:**\n${notFound.join('\n')}`);

      return i.reply({ embeds:[new EmbedBuilder()
        .setColor(removed.length ? 0xFF4444 : 0xFF9933)
        .setTitle('🛡️ Tierer Permission — Remove')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp()] });
    }
  },
};

// ── /setuppanel ────────────────────────────────────────────
CMDS.setuppanel = {
  data: new SlashCommandBuilder()
    .setName('setuppanel')
    .setDescription('Waitlist panel channel mein send karo (Admin only)')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel jahan panel bhejo (default: current)')
      .setRequired(false)
    ),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf Admin yeh command use kar sakta hai.')] });

    await i.deferReply({ ephemeral:true });
    const targetChannel = i.options.getChannel('channel') || i.channel;
    try {
      await sendWaitlistPanel(targetChannel);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setDescription(`✅ Waitlist panel <#${targetChannel.id}> mein send ho gaya!`)] });
    } catch(err) {
      console.error('[PANEL ERROR]', err);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Panel send karne mein masla: ${err.message}`)] });
    }
  },
};


// ── /setupticketpnl ──────────────────────────────────────────
CMDS.setupticketpnl = {
  data: new SlashCommandBuilder()
    .setName('setupticketpnl')
    .setDescription('Paktiers Application panel channel mein send karo (Admin only)')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel jahan panel bhejo (default: configured application channel)')
      .setRequired(false)
    ),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf Admin yeh command use kar sakta hai.')] });

    await i.deferReply({ ephemeral:true });

    let targetChannel = i.options.getChannel('channel');
    if (!targetChannel && CONFIG.APPLICATION_CHANNEL_ID) {
      targetChannel = await i.client.channels.fetch(CONFIG.APPLICATION_CHANNEL_ID).catch(() => null);
    }
    if (!targetChannel) targetChannel = i.channel;

    try {
      await targetChannel.send({
        embeds: [buildApplicationPanelEmbed()],
        components: [buildApplicationSelectRow()],
      });
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setDescription(`✅ Paktiers Application panel <#${targetChannel.id}> mein send ho gaya!`)] });
    } catch(err) {
      console.error('[APP PANEL ERROR]', err);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Panel send karne mein masla: ${err.message}`)] });
    }
  },
};


// ── /setupsupportpnl ──────────────────────────────────────────
CMDS.setupsupportpnl = {
  data: new SlashCommandBuilder()
    .setName('setupsupportpnl')
    .setDescription('Paktiers Support ticket panel channel mein send karo (Admin only)')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel jahan panel bhejo (default: configured support channel)')
      .setRequired(false)
    ),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf Admin yeh command use kar sakta hai.')] });

    await i.deferReply({ ephemeral:true });

    let targetChannel = i.options.getChannel('channel');
    if (!targetChannel && CONFIG.SUPPORT_CHANNEL_ID) {
      targetChannel = await i.client.channels.fetch(CONFIG.SUPPORT_CHANNEL_ID).catch(() => null);
    }
    if (!targetChannel) targetChannel = i.channel;

    try {
      await targetChannel.send({
        embeds: [buildSupportPanelEmbed()],
        components: [buildSupportButtonRow()],
      });
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setDescription(`✅ Paktiers Support panel <#${targetChannel.id}> mein send ho gaya!`)] });
    } catch(err) {
      console.error('[SUPPORT PANEL ERROR]', err);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Panel send karne mein masla: ${err.message}`)] });
    }
  },
};


// ── /appmanager ───────────────────────────────────────────────
CMDS.appmanager = {
  data: new SlashCommandBuilder()
    .setName('appmanager')
    .setDescription('Application tickets ki access do role/member ko (Admin only)')
    .addRoleOption(o => o
      .setName('role')
      .setDescription('Role jisko sab application tickets dikhni chahiye')
      .setRequired(false)
    )
    .addUserOption(o => o
      .setName('member')
      .setDescription('Member jisko sab application tickets dikhni chahiye')
      .setRequired(false)
    ),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf Admin yeh command use kar sakta hai.')] });

    const role   = i.options.getRole('role');
    const member = i.options.getUser('member');
    if (!role && !member)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Role ya member mein se kam az kam ek do.')] });

    await i.deferReply({ ephemeral:true });

    try {
      const category = await resolveApplicationCategory(i.guild);
      if (!category)
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Application category nahi mil saki.')] });

      const targetId = role ? role.id : member.id;
      if (role)   LDB.addManagerRole('app', role.id);
      if (member) LDB.addManagerUser('app', member.id);

      const channels = i.guild.channels.cache.filter(
        ch => ch.parentId === category.id && ch.type === ChannelType.GuildText
      );

      let updated = 0;
      for (const ch of channels.values()) {
        try {
          await ch.permissionOverwrites.edit(targetId, {
            ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
          });
          updated++;
        } catch(_) {}
      }

      const mention = role ? `<@&${role.id}>` : `<@${member.id}>`;
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setDescription(
          `✅ ${mention} ko ${updated} open application ticket(s) ki access mil gayi.\n` +
          `Ab se har naye application ticket mein bhi inko automatically access milegi.`
        )] });
    } catch(err) {
      console.error('[APPMANAGER ERROR]', err);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Masla aa gaya: ${err.message}`)] });
    }
  },
};


// ── /supmanager ───────────────────────────────────────────────
CMDS.supmanager = {
  data: new SlashCommandBuilder()
    .setName('supmanager')
    .setDescription('Support tickets ki access do role/member ko (Admin only)')
    .addRoleOption(o => o
      .setName('role')
      .setDescription('Role jisko sab support tickets dikhni chahiye')
      .setRequired(false)
    )
    .addUserOption(o => o
      .setName('member')
      .setDescription('Member jisko sab support tickets dikhni chahiye')
      .setRequired(false)
    ),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf Admin yeh command use kar sakta hai.')] });

    const role   = i.options.getRole('role');
    const member = i.options.getUser('member');
    if (!role && !member)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Role ya member mein se kam az kam ek do.')] });

    await i.deferReply({ ephemeral:true });

    try {
      const category = await resolveSupportCategory(i.guild);
      if (!category)
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Support category nahi mil saki.')] });

      const targetId = role ? role.id : member.id;
      if (role)   LDB.addManagerRole('sup', role.id);
      if (member) LDB.addManagerUser('sup', member.id);

      const channels = i.guild.channels.cache.filter(
        ch => ch.parentId === category.id && ch.type === ChannelType.GuildText
      );

      let updated = 0;
      for (const ch of channels.values()) {
        try {
          await ch.permissionOverwrites.edit(targetId, {
            ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
          });
          updated++;
        } catch(_) {}
      }

      const mention = role ? `<@&${role.id}>` : `<@${member.id}>`;
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
        .setDescription(
          `✅ ${mention} ko ${updated} open support ticket(s) ki access mil gayi.\n` +
          `Ab se har naye support ticket mein bhi inko automatically access milegi.`
        )] });
    } catch(err) {
      console.error('[SUPMANAGER ERROR]', err);
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Masla aa gaya: ${err.message}`)] });
    }
  },
};


// ════════════════════════════════════════════════════════════
//  /startqueue — CTL-STYLE LIVE QUEUE PANEL (NEW COMMAND)
//  Usage: /startqueue gamemode:Axe region:AS/AU
// ════════════════════════════════════════════════════════════

// Storage for active startqueue panels: weapon -> { channelId, messageId, testerId, region }
const SQ_PANEL_FILE = path.join(__dirname, 'paktiers_data', 'sq_panels.json');
const SQ_QUEUE_LIMIT = 15;

function loadSQPanels() {
  try { if (fs.existsSync(SQ_PANEL_FILE)) return JSON.parse(fs.readFileSync(SQ_PANEL_FILE, 'utf8')); } catch(_) {}
  return {};
}
function saveSQPanels(data) {
  try { fs.writeFileSync(SQ_PANEL_FILE, JSON.stringify(data, null, 2)); } catch(_) {}
}

function addToSQQueue(discordId, weapon, ign) {
  const db = rDB(QF);
  if (!db[weapon]) db[weapon] = [];
  const q = db[weapon];

  if (q.find(e => e.discordId === discordId)) return { ok: false, reason: 'dupe' };
  if (q.length >= SQ_QUEUE_LIMIT) return { ok: false, reason: 'full' };

  q.push({ discordId, ign, joinedAt: Date.now() });
  db[weapon] = q;
  wDB(QF, db);
  MEM.queues[weapon] = q;
  return { ok: true, position: q.length };
}

// Build the exact CTL-style embed
function buildSQEmbed(weapon, region, testerIds) {
  const q   = LDB.getQ(weapon);
  const reg = region || 'AS/AU';
  const panels = loadSQPanels();
  const currentTest = panels[weapon]?.currentTest || '*No active test*';
  const queueCount = q.length;
  const queueLimit = SQ_QUEUE_LIMIT;

  // Queue list — numbered mentions
  const queueLines = queueCount
    ? q.map((e, idx) => `${idx + 1}. <@${e.discordId}>`).join('\n')
    : '*Queue mein koi nahi.*';

  // Active testers list
  const testerLines = (testerIds && testerIds.length)
    ? testerIds.map((id, idx) => `${idx + 1}. <@${id}>`).join('\n')
    : '*No active tester.*';

  const now = new Date().toLocaleTimeString('en-PK', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  return new EmbedBuilder()
    .setColor(0x57F287)  // CTL green
    .setTitle(`✅  ${weapon} Tester Available!`)
    .setDescription(
      `A **${weapon}** queue is open for the **${reg}** region!\n\n` +
      `The queue is now open and updates in real-time.`
    )
    .addFields(
      { name: `📋 Queue (${queueCount}/${queueLimit})`, value: queueLines, inline: false },
      { name: '👥 Active Testers', value: testerLines, inline: false },
      { name: '🌍 Region', value: reg, inline: false },
      { name: '🧪 Current Test', value: currentTest, inline: false },
    )
    .setFooter({ text: `🌍 Region: ${reg} | 🕐 Last Refresh: ${now}` });
}

// Build Join / Leave / Pull buttons row
function buildSQButtons(weapon) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sq_join_${weapon}`).setLabel('Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sq_leave_${weapon}`).setLabel('Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`sq_pull_${weapon}`).setLabel('🎫 Pull').setStyle(ButtonStyle.Primary),
  );
}

// Refresh the live panel message in-place
async function refreshSQPanel(client, weapon) {
  const panels = loadSQPanels();
  const info   = panels[weapon];
  if (!info?.channelId || !info?.messageId) return;
  try {
    const ch  = await client.channels.fetch(info.channelId).catch(() => null);
    if (!ch) return;
    const msg = await ch.messages.fetch(info.messageId).catch(() => null);
    if (!msg) return;
    await msg.edit({
      content:    '',
      embeds:     [buildSQEmbed(weapon, info.region, info.testers || [])],
      components: [buildSQButtons(weapon)],
    });
    panels[weapon].lastRefresh = Date.now();
    saveSQPanels(panels);
  } catch(err) {
    console.error(`[SQ PANEL] refresh error (${weapon}):`, err.message);
  }
}

CMDS.startqueue = {
  data: new SlashCommandBuilder()
    .setName('startqueue')
    .setDescription('CTL-style live queue panel kholo (Testers only)')
    .addStringOption(o => o
      .setName('gamemode')
      .setDescription('Choose a gamemode')
      .setRequired(true)
      .addChoices(...WEAPONS.map(w => ({ name: `${WEAPON_EMOJI[w]} ${w}`, value: w })))
    )
    .addStringOption(o => o
      .setName('region')
      .setDescription('Region (default: AS/AU)')
      .setRequired(false)
      .addChoices(
        { name: 'AS/AU', value: 'AS/AU' },
        { name: 'PK',    value: 'PK'    },
        { name: 'EU',    value: 'EU'    },
        { name: 'NA',    value: 'NA'    },
        { name: 'SA',    value: 'SA'    },
      )
    )
    .addStringOption(o => o
      .setName('message')
      .setDescription('Extra announcement message (optional)')
      .setRequired(false)
    ),

  async execute(i) {
    // ── Permission check ─────────────────────────────────────
    if (!hasQueuePerm(i.member))
      return i.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setTitle('❌ Permission Denied')
        .setDescription('Only **Testers** or roles with queue permission can use this command.')
        .setFooter({ text: BOT_FOOTER })] });

    await i.deferReply({ ephemeral: true });

    const weapon = i.options.getString('gamemode');
    const region = i.options.getString('region') || 'AS/AU';
    const extraMsg = i.options.getString('message') || null;
    const emoji  = WEAPON_EMOJI[weapon] || '⚔️';

    // ── Find target channel: waitlist-<weapon> ────────────────
    const targetName = `waitlist-${weapon.toLowerCase()}`;
    let targetCh = null;

    try {
      const all = await i.guild.channels.fetch();
      targetCh = all.find(c => c?.isTextBased?.() && c.name.toLowerCase() === targetName) || null;
    } catch(_) {}

    // Fallback chain: env var → current channel
    if (!targetCh && CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID) {
      try { targetCh = await i.client.channels.fetch(CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID).catch(() => null); } catch(_) {}
    }
    if (!targetCh) targetCh = i.channel;

    // ── Bot permission check ──────────────────────────────────
    const me    = i.guild.members.me;
    const perms = targetCh.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.ViewChannel)) {
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setTitle('❌ Bot Ko Permission Nahi')
        .setDescription(
          `Bot ko <#${targetCh.id}> mein message send karne ki permission nahi hai.\n\n` +
          `**Fix:** Channel settings → Permissions → Bot role → ✅ View Channel + ✅ Send Messages`
        )
        .setFooter({ text: BOT_FOOTER })] });
    }

    // ── Delete old panel for this weapon if exists ────────────
    const panels = loadSQPanels();
    console.log(`[STARTQUEUE] panels keys: ${Object.keys(panels).join(', ')}`);

    if (panels[weapon]?.channelId && panels[weapon]?.messageId) {
      try {
        const oldCh  = await i.client.channels.fetch(panels[weapon].channelId).catch(() => null);
        const oldMsg = oldCh ? await oldCh.messages.fetch(panels[weapon].messageId).catch(() => null) : null;
        if (oldMsg) await oldMsg.delete().catch(() => {});
      } catch(_) {}
    }

    // ── Delete "Queue Closed" embed if it exists ──────────────
    const closedKey = `closed_${weapon}`;
    console.log(`[STARTQUEUE] closedKey: ${closedKey}, exists: ${!!panels[closedKey]}`);
    if (panels[closedKey]?.channelId && panels[closedKey]?.messageId) {
      try {
        const closedCh  = await i.client.channels.fetch(panels[closedKey].channelId).catch(() => null);
        const closedMsg = closedCh ? await closedCh.messages.fetch(panels[closedKey].messageId).catch(() => null) : null;
        if (closedMsg) {
          await closedMsg.delete().catch(() => {});
          console.log(`[STARTQUEUE] Deleted closed embed for ${weapon}`);
        } else {
          console.log(`[STARTQUEUE] Closed msg not found in channel (may be already deleted)`);
        }
      } catch(e) {
        console.error(`[STARTQUEUE] Error deleting closed msg:`, e.message);
      }
      delete panels[closedKey];
      saveSQPanels(panels);
    }

    // ── Send the live panel ───────────────────────────────────
    let sentMsg = null;
    try {
      const baseContent = `a **${weapon}** queue is open for the **PK** region!`;
      const fullContent = extraMsg ? `${baseContent}\n\n📢 ${extraMsg}` : baseContent;
      sentMsg = await targetCh.send({
        content:           fullContent,
        embeds:            [buildSQEmbed(weapon, region, [i.user.id])],
        components:        [buildSQButtons(weapon)],
        allowedMentions:   { parse: ['everyone'] },
      });
    } catch(err) {
      console.error('[STARTQUEUE SEND ERROR]', err.message, 'Code:', err.code);
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setTitle('⚠️ Panel Send Nahi Hua')
        .setDescription(
          `<#${targetCh.id}> mein message send nahi hua.\n\n` +
          `**Error:** \`${err.message}\` (Code: ${err.code || 'N/A'})\n\n` +
          `Check karo:\n• Bot ko channel mein **Send Messages** permission hai?\n• Channel ki permission override toh nahi?`
        )
        .addFields(
          { name: `${emoji} Gamemode`, value: weapon,              inline: true },
          { name: '📢 Channel',        value: `<#${targetCh.id}>`, inline: true },
        )
        .setFooter({ text: BOT_FOOTER })] });
    }

    // ── Save panel info ───────────────────────────────────────
    panels[weapon] = {
      channelId:   targetCh.id,
      messageId:   sentMsg.id,
      testers:     [i.user.id],   // tester jo ne start kiya
      region,
      startedBy:   i.user.id,
      startedAt:   Date.now(),
      lastRefresh: Date.now(),
    };
    saveSQPanels(panels);

    // ── Confirm to tester (ephemeral) ─────────────────────────
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0x00C864)
      .setTitle('✅ Live Queue Panel Shuru Ho Gaya!')
      .setDescription(
        `**${emoji} ${weapon}** ka CTL-style live panel <#${targetCh.id}> mein send ho gaya!\n\n` +
        `Panel khud update hoga jab bhi koi Join / Leave / Pull kare.`
      )
      .addFields(
        { name: `${emoji} Gamemode`, value: weapon,              inline: true },
        { name: '📢 Channel',        value: `<#${targetCh.id}>`, inline: true },
        { name: '🌍 Region',         value: region,              inline: true },
        ...(extraMsg ? [{ name: '💬 Message', value: extraMsg, inline: false }] : []),
      )
      .setFooter({ text: BOT_FOOTER })
      .setTimestamp()] });
  },
};

// ════════════════════════════════════════════════════════════
//  /closequeue — CTL-STYLE QUEUE CLOSED EMBED
//  Usage: /closequeue gamemode:Sword reason:Last tester left
// ════════════════════════════════════════════════════════════
CMDS.closequeue = {
  data: new SlashCommandBuilder()
    .setName('closequeue')
    .setDescription('Queue band karo — CTL-style closed embed bhejo (Testers only)')
    .addStringOption(o => o
      .setName('gamemode')
      .setDescription('Choose a gamemode')
      .setRequired(true)
      .addChoices(...WEAPONS.map(w => ({ name: `${WEAPON_EMOJI[w]} ${w}`, value: w })))
    )
    .addStringOption(o => o
      .setName('reason')
      .setDescription('Band karne ki wajah (default: Last tester left the queue)')
      .setRequired(false)
    ),

  async execute(i) {
    // ── Permission check ──────────────────────────────────────
    if (!hasQueuePerm(i.member))
      return i.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setTitle('❌ Permission Denied')
        .setDescription('Only **Testers** or roles with queue permission can use this command.')
        .setFooter({ text: BOT_FOOTER })] });

    await i.deferReply({ ephemeral: true });

    const weapon = i.options.getString('gamemode');
    const reason = i.options.getString('reason') || 'Last tester left the queue';
    const emoji  = WEAPON_EMOJI[weapon] || '⚔️';

    // ── Find waitlist channel ─────────────────────────────────
    const targetName = `waitlist-${weapon.toLowerCase()}`;
    let targetCh = null;
    try {
      const all = await i.guild.channels.fetch();
      targetCh = all.find(c => c?.isTextBased?.() && c.name.toLowerCase() === targetName) || null;
    } catch(_) {}
    if (!targetCh && CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID) {
      try { targetCh = await i.client.channels.fetch(CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID).catch(() => null); } catch(_) {}
    }
    if (!targetCh) targetCh = i.channel;

    // ── Delete the live panel message if it exists ────────────
    const sqPanels = loadSQPanels();
    if (sqPanels[weapon]?.channelId && sqPanels[weapon]?.messageId) {
      try {
        const oldCh  = await i.client.channels.fetch(sqPanels[weapon].channelId).catch(() => null);
        const oldMsg = oldCh ? await oldCh.messages.fetch(sqPanels[weapon].messageId).catch(() => null) : null;
        if (oldMsg) await oldMsg.delete().catch(() => {});
      } catch(_) {}
      // Clear panel record
      delete sqPanels[weapon];
      saveSQPanels(sqPanels);
    }

    // Also clear old live panel if exists
    const livePanels = loadLivePanels();
    if (livePanels[weapon]?.channelId && livePanels[weapon]?.messageId) {
      try {
        const oldCh  = await i.client.channels.fetch(livePanels[weapon].channelId).catch(() => null);
        const oldMsg = oldCh ? await oldCh.messages.fetch(livePanels[weapon].messageId).catch(() => null) : null;
        if (oldMsg) await oldMsg.delete().catch(() => {});
      } catch(_) {}
      delete livePanels[weapon];
      saveLivePanels(livePanels);
    }

    // ── Clear the queue for this weapon ──────────────────────
    LDB.leaveAllQ && (() => {
      const db = JSON.parse(fs.existsSync(QF) ? fs.readFileSync(QF,'utf8') : '{}');
      db[weapon] = [];
      fs.writeFileSync(QF, JSON.stringify(db, null, 2));
      MEM.queues[weapon] = [];
    })();
    broadcast({ type: 'queue_updated', queues: MEM.queues });

    // ── Build CTL-style "Queue Closed" embed ──────────────────
    const now = new Date();
    const sessionTime = now.toLocaleDateString('en-PK', {
      day: '2-digit', month: 'long', year: 'numeric',
    }) + ' at ' + now.toLocaleTimeString('en-PK', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const closedEmbed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle(`🔒  ${weapon} Queue Closed`)
      .setDescription(
        `This testing session has ended. You will be notified here when a new queue opens.`
      )
      .addFields(
        { name: '📋  Reason',       value: reason,      inline: false },
        { name: '🕐  Session Ended', value: sessionTime, inline: false },
      )
      .setFooter({ text: 'Thank you for testing!' });

    // ── Send closed embed to waitlist channel ─────────────────
    let sent = false;
    try {
      const closedMsg = await targetCh.send({ embeds: [closedEmbed] });
      sent = true;
      // Save closed message ID — fresh load karo taake koi key miss na ho
      const freshPanels = loadSQPanels();
      freshPanels[`closed_${weapon}`] = { channelId: targetCh.id, messageId: closedMsg.id };
      saveSQPanels(freshPanels);
      console.log(`[CLOSEQUEUE] Saved closed_${weapon} messageId: ${closedMsg.id}`);
    } catch(err) {
      console.error('[CLOSEQUEUE SEND ERROR]', err.message);
    }

    // ── Confirm to tester ─────────────────────────────────────
    return i.editReply({ embeds: [new EmbedBuilder()
      .setColor(sent ? 0xFF4444 : 0xFF9933)
      .setTitle(sent ? `🔒 ${weapon} Queue Band Ho Gaya!` : '⚠️ Send Nahi Hua')
      .setDescription(sent
        ? `**${emoji} ${weapon}** queue band kar di gayi.\nClosed embed <#${targetCh.id}> mein send ho gaya.\nQueue clear ho gayi.`
        : `Closed embed send nahi hua. Bot permission check karo.`
      )
      .addFields(
        { name: `${emoji} Gamemode`, value: weapon,              inline: true },
        { name: '📢 Channel',        value: `<#${targetCh.id}>`, inline: true },
        { name: '📋 Reason',         value: reason,              inline: true },
      )
      .setFooter({ text: BOT_FOOTER })
      .setTimestamp()] });
  },
};

// ════════════════════════════════════════════════════════════
//  /synclogs — PURANE TIERS KO LOGS MEIN ADD KARO
//  players.json se saare existing tiers sync karta hai
// ════════════════════════════════════════════════════════════
CMDS.synclogs = {
  data: new SlashCommandBuilder()
    .setName('synclogs')
    .setDescription('Purane saare tiers ko tier_logs mein sync karo (Admin only)'),

  async execute(i) {
    const isAdmin = i.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return i.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Sirf **Admin** yeh command use kar sakta hai.')] });

    await i.deferReply({ ephemeral: true });

    const allPlayers = LDB.all();
    const existing   = loadTierLogs();

    // Existing logs mein already synced entries mark karo (duplicate avoid)
    const alreadySynced = new Set(
      existing.filter(l => l.synced).map(l => `${l.playerId}_${l.weapon}`)
    );

    let added = 0;
    const newEntries = [];

    for (const player of Object.values(allPlayers)) {
      for (const [weapon, tier] of Object.entries(player.tiers || {})) {
        const key = `${player.discordId}_${weapon}`;
        if (alreadySynced.has(key)) continue;

        newEntries.push({
          tieredBy:    'SYNC',
          tieredByTag: 'synced-from-db',
          playerId:    player.discordId,
          playerIGN:   player.ign,
          weapon,
          tier,
          oldTier:     null,
          timestamp:   player.registeredAt || Date.now(),
          synced:      true,  // flag — yeh manually synced entry hai
        });
        added++;
      }
    }

    // Save all new entries
    if (newEntries.length) {
      const merged = [...existing, ...newEntries];
      try {
        fs.writeFileSync(TIER_LOG_FILE, JSON.stringify(merged, null, 2));
        broadcast({ type:'testers_updated' });
      } catch(err) {
        return i.editReply({ embeds: [new EmbedBuilder().setColor(0xFF4444)
          .setDescription(`❌ File save error: ${err.message}`)] });
      }
    }

    return i.editReply({ embeds: [new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('✅ Logs Sync Ho Gaye!')
      .addFields(
        { name: '👥 Players Scanned', value: `**${Object.keys(allPlayers).length}**`, inline: true },
        { name: '📋 Entries Added',   value: `**${added}**`,                          inline: true },
        { name: '⏭️ Already Synced',  value: `**${alreadySynced.size}**`,             inline: true },
      )
      .setDescription(added > 0
        ? `${added} tier entries sync ho gayi hain. Ab \`/logs\` use karo kisi bhi tester ke logs dekhne ke liye.`
        : `Saare entries pehle se sync hain. Koi naya entry nahi mila.`
      )
      .setFooter({ text: BOT_FOOTER })
      .setTimestamp()] });
  },
};


//  Usage: /logs user:<discord_user>
//         /logs username:"XYZ"
// ════════════════════════════════════════════════════════════
CMDS.logs = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Kisi tester ke aaj ke tier logs dekho (Tierer/Admin only)')
    .addUserOption(o => o
      .setName('user')
      .setDescription('Tester ka Discord mention')
      .setRequired(false)
    )
    .addStringOption(o => o
      .setName('username')
      .setDescription('Tester ka Discord username (agar mention nahi kar sakte)')
      .setRequired(false)
    )
    .addStringOption(o => o
      .setName('date')
      .setDescription('Choose a day: today / yesterday / all (default: today)')
      .setRequired(false)
      .addChoices(
        { name: 'Today (Aaj)',        value: 'today'     },
        { name: 'Yesterday (Kal)',    value: 'yesterday' },
        { name: 'All Time (Saare)',   value: 'all'       },
      )
    ),

  async execute(i) {
    // ── Permission check ─────────────────────────────────────
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTierer = hasTiererPerm(i.member);
    if (!isAdmin && !hasTierer)
      return i.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ **Tierer** ya **Admin** role chahiye yeh command use karne ke liye.')] });

    await i.deferReply();

    const targetUser     = i.options.getUser('user');
    const targetUsername = i.options.getString('username');
    const dateFilter     = i.options.getString('date') || 'today';

    // ── Load all logs ─────────────────────────────────────────
    const allLogs = loadTierLogs();

    if (!allLogs.length)
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xFF9933)
        .setTitle('📋 Tier Logs')
        .setDescription('⚠️ Abhi tak koi tier log nahi. Logs tabhi bante hain jab `/tier set` use hota hai.')
        .setFooter({ text: BOT_FOOTER })] });

    // ── Filter by tester ──────────────────────────────────────
    let filtered = allLogs;
    let labelName = 'Saare Testers';
    let searchedByPlayer = false;

    if (targetUser) {
      // Discord mention — match by ID, exclude synced entries
      filtered  = allLogs.filter(l => l.tieredBy === targetUser.id && !l.synced);
      labelName = targetUser.username;
    } else if (targetUsername) {
      const q = targetUsername.toLowerCase();
      // Pehle tester username se dhundo (non-synced)
      const byTester = allLogs.filter(l =>
        !l.synced && (l.tieredByTag || '').toLowerCase().includes(q)
      );
      if (byTester.length > 0) {
        filtered  = byTester;
        labelName = targetUsername;
      } else {
        // Tester nahi mila — player IGN se try karo (synced data)
        filtered  = allLogs.filter(l => (l.playerIGN || '').toLowerCase().includes(q));
        labelName = targetUsername;
        searchedByPlayer = filtered.length > 0;
      }
    }

    // ── Filter by date ────────────────────────────────────────
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yestStart  = todayStart - 86400000;

    if (dateFilter === 'today') {
      filtered = filtered.filter(l => l.timestamp >= todayStart);
    } else if (dateFilter === 'yesterday') {
      filtered = filtered.filter(l => l.timestamp >= yestStart && l.timestamp < todayStart);
    }
    // 'all' = no date filter

    // ── No results ────────────────────────────────────────────
    if (!filtered.length) {
      const dateLabel = dateFilter === 'today' ? 'aaj' : dateFilter === 'yesterday' ? 'kal' : 'kabhi';
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xFF9933)
        .setTitle(`📋 Logs — ${labelName}`)
        .setDescription(
          `⚠️ **${labelName}** ke naam se koi log nahi mila.\n\n` +
          `• Agar tester hai: \`/logs user:@mention\` try karo\n` +
          `• Purane data ke liye: \`date:all\` option use karo`
        )
        .setFooter({ text: BOT_FOOTER })] });
    }

    // ── Build stats ───────────────────────────────────────────
    const totalTests = filtered.length;

    // Per-weapon breakdown
    const weaponCount = {};
    for (const l of filtered) {
      weaponCount[l.weapon] = (weaponCount[l.weapon] || 0) + 1;
    }
    const weaponLines = Object.entries(weaponCount)
      .sort((a, b) => b[1] - a[1])
      .map(([w, c]) => `${WEAPON_EMOJI[w] || '⚔️'} **${w}** — ${c} test${c > 1 ? 's' : ''}`)
      .join('\n');

    // Per-tier breakdown
    const tierCount = {};
    for (const l of filtered) {
      tierCount[l.tier] = (tierCount[l.tier] || 0) + 1;
    }
    const tierLines = Object.entries(tierCount)
      .sort((a, b) => (TIER_PTS[b[0]] || 0) - (TIER_PTS[a[0]] || 0))
      .map(([t, c]) => `\`${t}\` — ${c}x`)
      .join('  ');

    // Recent 10 entries (latest first)
    const recent = [...filtered].reverse().slice(0, 10);
    const recentLines = recent.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString('en-PK', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
      const arrow = l.oldTier ? `~~${l.oldTier}~~ → ` : '';
      return `• \`${time}\` **${l.playerIGN}** — ${WEAPON_EMOJI[l.weapon] || '⚔️'} ${l.weapon} ${arrow}**${l.tier}**`;
    }).join('\n');

    // Date label for embed title
    const dateLabelMap = { today: 'Aaj', yesterday: 'Kal', all: 'All Time' };
    const syncNotice = searchedByPlayer
      ? '\n⚠️ *Yeh purana synced data hai — tester naam available nahi tha.*'
      : '';

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`📊 Tier Logs — ${labelName} (${dateLabelMap[dateFilter]})`)
      .setDescription(syncNotice || null)
      .addFields(
        { name: '🔢 Total Tests', value: `**${totalTests}**`, inline: true },
        { name: '⚔️ Weapons',    value: weaponLines || '*N/A*', inline: false },
        { name: '🏅 Tiers Given', value: tierLines  || '*N/A*', inline: false },
        { name: `📋 Recent ${Math.min(10, filtered.length)} Entries`, value: recentLines, inline: false },
      )
      .setFooter({ text: `${BOT_FOOTER} · /logs` })
      .setTimestamp();

    return i.editReply({ embeds: [embed] });
  },
};

// ════════════════════════════════════════════════════════════
//  INTERACTION HANDLER — Registration Flow (Select Menus)
// ════════════════════════════════════════════════════════════

// Temporary storage for multi-step registration
const regState = new Map(); // userId -> { platform, accountType, region, step }

async function handleSelectMenu(i) {
  const [prefix, step, uid] = i.customId.split('_');

  // ── Panel: gamemode waitlist role select ──────────────────
  if (i.customId === 'panel_waitlist_select') {
    const weapon = i.values[0];
    const player = LDB.get(i.user.id);

    if (!player)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ First click **Register / Update Profile** and register.')] });

    // Cooldown check — reuse tier cooldown per weapon for waitlist
    const WAITLIST_COOLDOWN_MS = CONFIG.TIER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const wlCDKey = `wl_${i.user.id}_${weapon}`;
    const wlCDStore = global._wlCooldowns || (global._wlCooldowns = {});
    if (wlCDStore[wlCDKey]) {
      const remaining = WAITLIST_COOLDOWN_MS - (Date.now() - wlCDStore[wlCDKey]);
      if (remaining > 0) {
        const h = Math.floor(remaining/3600000), m = Math.floor((remaining%3600000)/60000);
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle(`⏳ ${weapon} Waitlist — Cooldown Active`)
          .setDescription(`**${weapon}** You can apply for the waitlist role again in **${h}h ${m}m**.`)] });
      }
    }

    // Assign Waitlist-<weapon> role
    try {
      const role = await ensureWaitlistRole(i.guild, weapon);
      if (role) {
        const member = await i.guild.members.fetch(i.user.id).catch(()=>null);
        if (member) await member.roles.add(role).catch(()=>{});
      }
      wlCDStore[wlCDKey] = Date.now();

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0x7FFF00)
        .setTitle(`✅ Waitlist Role Mila — ${WEAPON_EMOJI[weapon]} ${weapon}`)
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .setDescription(
          `You have received **Waitlist-${weapon}** role received!

` +
          `Jab **${weapon}** queue opens, tumhe ping milega.
` +
          `To join, click the **Join** button in the queue channel.`
        )
        .addFields(
          { name:'🎮 IGN',      value:`**${player.ign}**`,           inline:true },
          { name:'💻 Platform', value:player.platform||'Java',        inline:true },
          { name:'🌍 Region',   value:formatRegion(player.region),           inline:true },
        )
        .setFooter({ text:'PakTiers · Pakistan Minecraft Community' })
        .setTimestamp()] });
    } catch(err) {
      console.error('[PANEL WAITLIST ROLE]', err);
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Role assign karne mein masla: ${err.message}`)] });
    }
  }

  // ── Application Panel: type select ────────────────────────
  if (i.customId === 'app_apply_select') {
    const appType = i.values[0];
    const label = APPLICATION_TYPE_LABELS[appType] || 'Paktiers Application';

    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id).catch(() => null);
    if (!member) {
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Member fetch nahi hua, dobara try karo.')] });
    }

    const ticketChannel = await createApplicationTicket(i.client, i.guild, member, appType);
    if (!ticketChannel) {
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Application ticket create nahi ho saka. Staff ko inform karo.')] });
    }

    return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
      .setTitle(`✅ ${label} Submitted!`)
      .setDescription(`Tumhara application ticket khul gaya: <#${ticketChannel.id}>`)] });
  }

  if (prefix !== 'reg') return;
  if (uid !== i.user.id) {
    return i.reply({ ephemeral:true, content:'❌ This is not your menu.' });
  }

  const selected = i.values[0];

  if (step === 'platform') {
    // Save platform, move to account type
    regState.set(i.user.id, { platform: selected });

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Choose your account type...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 1/2')
        .setDescription(`✅ Platform: **${selected}**\n\nNow choose your **account type**:`)
        .addFields(
          { name:'💎 Premium (Paid)', value:'Original bought Minecraft account', inline:false },
          { name:'🏴‍☠️ Cracked (Free)', value:'TLauncher ya koi aur cracked launcher', inline:false },
        )
        .setFooter({ text:'Only you can see this | PakTiers' })],
      components: [accRow],
    });
  }

  if (step === 'account') {
    const state = regState.get(i.user.id) || {};
    state.accountType = selected;
    regState.set(i.user.id, state);

    const regionRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_region_${i.user.id}`)
        .setPlaceholder('🌍 Choose your region...')
        .addOptions(REGIONS_LIST.map(r => ({ label:r, value:r }))),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 2/2')
        .setDescription(`✅ Platform: **${state.platform}**\n✅ Account: **${selected}**\n\nNow choose your **region**:`)
        .setFooter({ text:'Only you can see this | PakTiers' })],
      components: [regionRow],
    });
  }

  if (step === 'region') {
    const state = regState.get(i.user.id) || {};
    state.region = selected;
    regState.set(i.user.id, state);

    // Now ask for IGN via modal button
    const ignRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reg_ignbtn_${i.user.id}`)
        .setLabel('✏️ Enter IGN')
        .setStyle(ButtonStyle.Primary),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — IGN')
        .setDescription(`✅ Platform: **${state.platform}**\n✅ Account: **${state.accountType}**\n✅ Region: **${selected}**\n\n⬇️ Now click the button below and enter your **Minecraft IGN**:`)
        .setFooter({ text:'Only you can see this | PakTiers' })],
      components: [ignRow],
    });
  }
}

async function handleButtonClick(i) {
  const parts = i.customId.split('_');

  // ── Panel: Register / Update Profile button ──────────────
  if (i.customId === 'panel_register') {
    // Check if already registered
    const existing = LDB.get(i.user.id);

    if (CONFIG.REGISTER_CHANNEL_ID && i.channelId !== CONFIG.REGISTER_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Please use <#${CONFIG.REGISTER_CHANNEL_ID}> for registration.`)] });
    }

    // Start registration/update flow — existing players can re-register (IGN update + tier transfer)
    if (existing) {
      // Store flag: this is an UPDATE, not fresh register
      regState.set(i.user.id, { platform: existing.platform || 'Java Edition', isUpdate: true, oldIgn: existing.ign });
    } else {
      regState.set(i.user.id, { platform: 'Java Edition', isUpdate: false });
    }

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Choose your account type...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    const titleTxt = existing ? '📋 PakTiers — Update Profile (Step 1/2)' : '📋 PakTiers Registration — Step 1/2';
    const descTxt  = existing
      ? `♻️ **Updating profile for ${existing.ign}**\n\nChoose your **account type**:`
      : '🖥️ **Platform: Java Edition**\n\nChoose your **account type**:';

    return i.reply({
      ephemeral:true,
      embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle(titleTxt)
        .setDescription(descTxt)
        .addFields(
          { name:'💎 Premium (Paid)', value:'Original bought Minecraft account', inline:false },
          { name:'🏴‍☠️ Cracked (Free)', value:'TLauncher ya koi aur cracked launcher', inline:false },
        )
        .setFooter({ text:'Only you can see this | PakTiers' })],
      components:[accRow],
    });
  }

  // Close ticket button
  if (i.customId.startsWith('close_ticket_')) {
    const targetId = i.customId.replace('close_ticket_','');
    const ticket   = LDB.getTicket(targetId);
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff  = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const hasTierer = hasTiererPerm(i.member);
    const isOwner   = i.user.id === targetId;
    const isPuller  = ticket?.testerId && ticket.testerId === i.user.id;
    if (!isAdmin && !hasStaff && !hasTierer && !isOwner && !isPuller)
      return i.reply({ ephemeral:true, content:'❌ Tumhe yeh ticket band karne ki permission nahi.' });
    await i.reply({ ephemeral:true, content:'🔒 Ticket band ho raha hai...' });
    return closeTicket(i.client, i.guild, targetId, i.user.id);
  }

  // Close application ticket button
  if (i.customId.startsWith('close_apptkt_')) {
    const targetId = i.customId.replace('close_apptkt_','');
    const isAdmin  = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const isOwner  = i.user.id === targetId;
    if (!isAdmin && !hasStaff && !isOwner)
      return i.reply({ ephemeral:true, content:'❌ Tumhe yeh application band karne ki permission nahi.' });
    await i.reply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription(`🔒 Application closed by <@${i.user.id}>. Channel 5 second mein delete ho jayega.`)] });
    return setTimeout(() => i.channel.delete().catch(()=>{}), 5000);
  }

  // ── Support Panel: "Open a ticket!" button ────────────────
  if (i.customId === 'support_open_ticket') {
    await i.deferReply({ ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id).catch(() => null);
    if (!member) {
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Member fetch nahi hua, dobara try karo.')] });
    }

    const ticketChannel = await createSupportTicket(i.client, i.guild, member);
    if (!ticketChannel) {
      return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Support ticket create nahi ho saka. Staff ko inform karo.')] });
    }

    return i.editReply({ embeds:[new EmbedBuilder().setColor(0x00C864)
      .setDescription(`✅ Tumhara support ticket khul gaya: <#${ticketChannel.id}>`)] });
  }

  // Close support ticket button
  if (i.customId.startsWith('close_supporttkt_')) {
    const targetId = i.customId.replace('close_supporttkt_','');
    const isAdmin  = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const isOwner  = i.user.id === targetId;
    if (!isAdmin && !hasStaff && !isOwner)
      return i.reply({ ephemeral:true, content:'❌ Tumhe yeh ticket band karne ki permission nahi.' });
    await i.reply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription(`🔒 Ticket closed by <@${i.user.id}>. Channel 5 second mein delete ho jayega.`)] });
    return setTimeout(() => i.channel.delete().catch(()=>{}), 5000);
  }

  // ── WAITLIST QUEUE BUTTONS (from /startqueue announce) ────────────────────
  // wl_join_<weapon>  — join queue
  // wl_leave_<weapon> — leave queue
  // wl_pull_<weapon>  — tester pulls first waiting player and opens ticket
  if (i.customId.startsWith('wl_')) {
    const [, action, weapon] = i.customId.split('_');
    const player = LDB.get(i.user.id);

    // ── JOIN ──────────────────────────────────────────────────
    if (action === 'join') {
      if (!player)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Please use `/register` first.')] });

      const access = await hasQueueAccess(i.guild, i.user.id, player, weapon);
      if (!access.allowed)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Access Nahi')
          .setDescription(
            `Tum **${weapon}** queue join nahi kar sakte.\n\n` +
            `**2 tarike hain:**\n` +
            `• Kisi **Tierer** se tier karwao, **YA**\n` +
            `• Select **${weapon}** in the panel — get the waitlist role`
          )] });

      const cd = isOnCooldown(i.user.id, weapon);
      if (cd.onCooldown)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription(`⏳ **${weapon}** cooldown active hai — ${cd.hours}h ${cd.mins}m remaining.`)] });

      const result = LDB.joinQ(i.user.id, weapon);
      if (!result.ok && result.reason === 'dupe')
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum already **${weapon}** queue mein ho.`)] });

      broadcast({ type:'queue_updated', queues:MEM.queues });
      refreshLivePanel(i.client, weapon).catch(() => {});
      const q   = LDB.getQ(weapon);
      const pos = q.findIndex(e=>e.discordId===i.user.id)+1;

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle(`${WEAPON_EMOJI[weapon]} Queue Joined — ${weapon}`)
        .addFields(
          { name:'Player',    value:`**${player.ign}**`,           inline:true },
          { name:'Your Tier', value:`\`${player.tiers?.[weapon] || 'Waitlist'}\``, inline:true },
          { name:'Position',  value:`**#${pos}** in queue`,        inline:true },
          { name:'⏳ Status',  value:'Tester ke pull karne ka wait karo…', inline:false },
        )
        .setFooter({ text:'Use the Leave Queue button to exit the queue · PakTiers' })
        .setTimestamp()] });
    }

    // ── LEAVE ─────────────────────────────────────────────────
    if (action === 'leave') {
      if (!player)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ You are not registered.')] });

      LDB.leaveQ(i.user.id, weapon);
      broadcast({ type:'queue_updated', queues:MEM.queues });
      refreshLivePanel(i.client, weapon).catch(() => {});
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription(`👋 Tum **${weapon}** queue se nikal gaye.`)] });
    }

    // ── PULL (Testers only) ───────────────────────────────────
    if (action === 'pull') {
      if (!hasQueuePerm(i.member))
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Only **Testers** or roles with queue permission can use this button.')] });

      const q = LDB.getQ(weapon);
      if (!q.length)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`📭 **${weapon}** the queue is currently empty — koi player wait nahi kar raha.`)] });

      // Pull = remove first player from queue
      const entry  = q[0];
      const target = LDB.get(entry.discordId);

      if (!target)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Queue entry mili lekin player data nahi mila.')] });

      // Remove player from queue
      LDB.leaveQ(entry.discordId, weapon);
      broadcast({ type:'queue_updated', queues:MEM.queues });

      // Active tester update karo
      const pnls = loadLivePanels();
      if (pnls[weapon]) {
        if (!pnls[weapon].activeTesters) pnls[weapon].activeTesters = [];
        if (!pnls[weapon].activeTesters.includes(i.user.id))
          pnls[weapon].activeTesters.push(i.user.id);
        pnls[weapon].currentTest = `<@${i.user.id}> is testing <@${entry.discordId}>`;
        pnls[weapon].currentTestAt = Date.now();
        pnls[weapon].currentTesterId = i.user.id;
        pnls[weapon].currentPlayerId = entry.discordId;
        saveLivePanels(pnls);
      }
      refreshLivePanel(i.client, weapon).catch(() => {});


      // Open ticket for pulled player
      let ticketChannel = null;
      if (i.guild) {
        ticketChannel = await createQueueTicket(i.client, i.guild, target, weapon, entry.discordId, i.user.id).catch(()=>null);
      } else {
        console.warn('[PULL] Guild unavailable — ticket nahi banega.');
      }

      const joinedAt = entry.joinedAt
        ? `<t:${Math.floor(entry.joinedAt/1000)}:R>`
        : 'Unknown';

      // Rich embed shown to tester (ephemeral)
      const pullEmbed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle(`🎫 Player Pulled — ${WEAPON_EMOJI[weapon]} ${weapon}`)
        .setThumbnail(`https://mc-heads.net/avatar/${target.ign}/128`)
        .setDescription(
          `Next player in **${weapon}** queue pulled.\n` +
          (ticketChannel ? `Ticket: <#${ticketChannel.id}>` : 'Ticket already existed or could not be created.')
        )
        .addFields(
          { name:'1. 🎮 IGN',         value:`**${target.ign}**`,                                        inline:true },
          { name:'2. 👤 Discord',      value:`<@${entry.discordId}>`,                                    inline:true },
          { name:'🧪 Testing',        value:`<@${i.user.id}> is testing <@${entry.discordId}>`,       inline:false },
          { name:'3. 💻 Platform',     value:target.platform    || 'Java Edition',                       inline:true },
          { name:'4. 🔑 Account',      value:target.accountType || 'Premium',                            inline:true },
          { name:'5. 🌍 Region',       value:target.region      || 'PK',                                 inline:true },
          { name:`6. ${WEAPON_EMOJI[weapon]} Tier`, value:`\`${target.tiers?.[weapon] || 'N/A'}\``,      inline:true },
          { name:'7. ⏱️ Joined Queue', value:joinedAt,                                                   inline:true },
          { name:'8. 📅 Registered',   value:`<t:${Math.floor(target.registeredAt/1000)}:D>`,            inline:true },
        )
        .setFooter({ text:`Pulled by ${i.user.username} · PakTiers` })
        .setTimestamp();

      // Notify inside ticket channel OR DM player as fallback
      if (ticketChannel) {
        try {
          await ticketChannel.send({
            content:`📢 <@${entry.discordId}> — A tester pulled you! Get ready for the test.`,
            embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
              .setTitle('🎫 Pulled by Tester')
              .setDescription(`<@${i.user.id}> (**${i.user.username}**) ne tujhe **${weapon}** queue se pull kiya.\nTest ke liye ready ho jao!`)
              .setFooter({ text:BOT_FOOTER })
              .setTimestamp()],
          });
        } catch(_) {}
      } else {
        // Ticket nahi bana — player ko DM karo
        try {
          const pulledMember = await i.guild.members.fetch(entry.discordId).catch(()=>null);
          if (pulledMember) {
            await pulledMember.send({
              embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
                .setTitle(`🎫 ${weapon} Queue — Pulled!`)
                .setDescription(`**${i.user.username}** (Tester) ne tumhe **${weapon}** queue se pull kiya hai!\nCome to the server and get ready for the test. 🇵🇰`)
                .setFooter({ text:BOT_FOOTER })
                .setTimestamp()],
            }).catch(()=>{});
          }
        } catch(_) {}
      }

      return i.reply({ ephemeral:true, embeds:[pullEmbed] });
    }

    return; // unknown wl_ sub-action
  }

  // ── /startqueue BUTTONS: sq_join_ / sq_leave_ / sq_pull_ ──────────────────
  if (i.customId.startsWith('sq_')) {
    // customId format: sq_join_Axe / sq_leave_Axe / sq_pull_Axe
    const withoutPrefix = i.customId.slice(3);           // "join_Axe"
    const underIdx      = withoutPrefix.indexOf('_');
    const action        = withoutPrefix.slice(0, underIdx);   // "join"
    const weapon        = withoutPrefix.slice(underIdx + 1);  // "Axe"

    const player = LDB.get(i.user.id);

    // ── SQ JOIN ───────────────────────────────────────────────
    if (action === 'join') {
      if (!player)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Registered Nahi')
          .setDescription('To join the queue, first use `/register` or click the **Register / Update Profile** button.')
          .setFooter({ text: BOT_FOOTER })] });

      const access = await hasQueueAccess(i.guild, i.user.id, player, weapon);
      if (!access.allowed)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Access Nahi')
          .setDescription(
            `Tum **${weapon}** queue join nahi kar sakte.\n\n` +
            `**Queue join karne ke 2 tarike:**\n` +
            `• Kisi **Tierer** se get your ${weapon} tier\n` +
            `• Select **${weapon}** in the panel — get the waitlist role`
          )
          .setFooter({ text: BOT_FOOTER })] });

      const cd = isOnCooldown(i.user.id, weapon);
      if (cd.onCooldown)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle(`⏳ Cooldown Active — ${weapon}`)
          .setDescription(`Tumhara **${weapon}** cooldown abhi active hai.\n**${cd.hours}h ${cd.mins}m** baad try karo.`)
          .setFooter({ text: BOT_FOOTER })] });

      const result = addToSQQueue(i.user.id, weapon, player.ign);
      if (!result.ok && result.reason === 'dupe')
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum already **${weapon}** queue mein ho.`)] });
      if (!result.ok && result.reason === 'full')
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Queue Full')
          .setDescription(`Abhi **${weapon}** queue full hai. Max **${SQ_QUEUE_LIMIT}** players at a time join kar sakte hain.`)
          .setFooter({ text: BOT_FOOTER })] });

      broadcast({ type:'queue_updated', queues:MEM.queues });
      refreshSQPanel(i.client, weapon).catch(() => {});

      const q   = LDB.getQ(weapon);
      const pos = q.findIndex(e => e.discordId === i.user.id) + 1;

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0x57F287)
        .setTitle(`${WEAPON_EMOJI[weapon]} Queue Joined — ${weapon}`)
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .addFields(
          { name:'🎮 Player',    value:`**${player.ign}**`,                               inline:true },
          { name:'⚔️ Tier',     value:`\`${player.tiers?.[weapon] || 'Waitlist'}\``,      inline:true },
          { name:'📋 Position', value:`**#${pos}** in queue`,                             inline:true },
          { name:'⏳ Status',   value:'Tester ke pull karne ka wait karo…',               inline:false },
        )
        .setFooter({ text:'Use the Leave button to exit the queue · PakTiers' })
        .setTimestamp()] });
    }

    // ── SQ LEAVE ──────────────────────────────────────────────
    if (action === 'leave') {
      if (!player)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ You are not registered.')] });

      const q = LDB.getQ(weapon);
      const inQ = q.find(e => e.discordId === i.user.id);
      if (!inQ)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum **${weapon}** queue mein nahi ho.`)] });

      LDB.leaveQ(i.user.id, weapon);
      broadcast({ type:'queue_updated', queues:MEM.queues });
      refreshSQPanel(i.client, weapon).catch(() => {});

      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setTitle(`👋 Queue Chod Di — ${weapon}`)
        .setDescription(`**${player.ign}** ne **${weapon}** queue chod di.`)
        .setFooter({ text: BOT_FOOTER })] });
    }

    // ── SQ PULL (Testers only) ────────────────────────────────
    if (action === 'pull') {
      if (!hasQueuePerm(i.member))
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Permission Denied')
          .setDescription('Only **Testers** or roles with queue permission can use this button.')
          .setFooter({ text: BOT_FOOTER })] });

      const q = LDB.getQ(weapon);
      if (!q.length)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setTitle(`📭 Queue Khali — ${weapon}`)
          .setDescription(`**${weapon}** queue mein abhi koi player nahi hai.`)] });

      // Pull first player
      const entry  = q[0];
      const target = LDB.get(entry.discordId);

      if (!target)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Queue entry mili lekin player data nahi mila.')] });

      LDB.leaveQ(entry.discordId, weapon);
      broadcast({ type:'queue_updated', queues:MEM.queues });

      // Update active testers list in SQ panel
      const sqPanels = loadSQPanels();
      if (sqPanels[weapon]) {
        if (!sqPanels[weapon].testers) sqPanels[weapon].testers = [];
        if (!sqPanels[weapon].testers.includes(i.user.id))
          sqPanels[weapon].testers.push(i.user.id);
        sqPanels[weapon].currentTest = `<@${i.user.id}> is testing <@${entry.discordId}>`;
        sqPanels[weapon].currentTestAt = Date.now();
        sqPanels[weapon].currentTesterId = i.user.id;
        sqPanels[weapon].currentPlayerId = entry.discordId;
        saveSQPanels(sqPanels);
      }
      refreshSQPanel(i.client, weapon).catch(() => {});

      // Create / fetch ticket
      let ticketChannel = null;
      if (i.guild) {
        ticketChannel = await createQueueTicket(i.client, i.guild, target, weapon, entry.discordId, i.user.id).catch(() => null);
      }

      const joinedAt = entry.joinedAt ? `<t:${Math.floor(entry.joinedAt/1000)}:R>` : 'Unknown';

      const pullEmbed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle(`🎫 Player Pulled — ${WEAPON_EMOJI[weapon]} ${weapon}`)
        .setThumbnail(`https://mc-heads.net/avatar/${target.ign}/128`)
        .setDescription(
          `**${weapon}** queue ka next player pull ho gaya.\n` +
          (ticketChannel ? `Ticket: <#${ticketChannel.id}>` : '⚠️ Ticket create nahi hua — player ko DM gaya.')
        )
        .addFields(
          { name:'1. 🎮 IGN',         value:`**${target.ign}**`,                                         inline:true },
          { name:'2. 👤 Discord',      value:`<@${entry.discordId}>`,                                     inline:true },
          { name:'3. 💻 Platform',     value:target.platform    || 'Java Edition',                        inline:true },
          { name:'4. 🔑 Account',      value:target.accountType || 'Premium',                             inline:true },
          { name:'5. 🌍 Region',       value:target.region      || 'PK',                                  inline:true },
          { name:`6. ${WEAPON_EMOJI[weapon]} Tier`, value:`\`${target.tiers?.[weapon] || 'N/A'}\``,       inline:true },
          { name:'7. ⏱️ Joined Queue', value:joinedAt,                                                    inline:true },
          { name:'8. 📅 Registered',   value:`<t:${Math.floor(target.registeredAt/1000)}:D>`,             inline:true },
        )
        .setFooter({ text:`Pulled by ${i.user.username} · PakTiers` })
        .setTimestamp();

      // Notify in ticket OR DM
      if (ticketChannel) {
        try {
          await ticketChannel.send({
            content: `📢 <@${entry.discordId}> <@${i.user.id}> — <@${i.user.id}> ne tumhe pull kiya! Get ready for the test.`,
            embeds:  [new EmbedBuilder().setColor(0x57F287)
              .setTitle('🎫 Pulled!')
              .setDescription(`**${i.user.username}** (Tester) ne tujhe **${weapon}** queue se pull kiya!\nServer pe aao aur ready ho jao. 🇵🇰`)
              .setFooter({ text: BOT_FOOTER })
              .setTimestamp()],
          });
        } catch(_) {}
      } else {
        try {
          const pulledMember = await i.guild.members.fetch(entry.discordId).catch(() => null);
          if (pulledMember) {
            await pulledMember.send({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
              .setTitle(`🎫 ${weapon} Queue — Pulled!`)
              .setDescription(`**${i.user.username}** (Tester) ne tumhe **${weapon}** queue se pull kiya!\nCome to the server and get ready for the test. 🇵🇰`)
              .setFooter({ text: BOT_FOOTER })
              .setTimestamp()] }).catch(() => {});
          }
        } catch(_) {}
      }

      return i.reply({ ephemeral:true, embeds:[pullEmbed] });
    }

    return; // unknown sq_ sub-action
  }
  if (i.customId.startsWith('reg_ignbtn_')) {
    const uid = i.customId.replace('reg_ignbtn_','');
    if (uid !== i.user.id)
      return i.reply({ ephemeral:true, content:'❌ This is not your button.' });

    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`reg_modal_${i.user.id}`)
      .setTitle('Enter your Minecraft IGN');

    const ignInput = new TextInputBuilder()
      .setCustomId('ign_input')
      .setLabel('Minecraft Java IGN')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(16)
      .setPlaceholder('e.g. CTLTierlist')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(ignInput));
    return i.showModal(modal);
  }
}

async function handleModal(i) {
  if (!i.customId.startsWith('reg_modal_')) return;
  const uid = i.customId.replace('reg_modal_','');
  if (uid !== i.user.id)
    return i.reply({ ephemeral:true, content:'❌ This is not your form.' });

  const ign   = i.fields.getTextInputValue('ign_input').trim();
  const state = regState.get(i.user.id) || {};

  if (!/^[a-zA-Z0-9_]+$/.test(ign))
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription('❌ Invalid IGN. Sirf letters, numbers aur underscore allowed hain.')] });

  // ── UPDATE flow (existing player re-registering) ──────────
  if (state.isUpdate) {
    const existing = LDB.get(i.user.id);
    if (!existing) {
      regState.delete(i.user.id);
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription('❌ Player data nahi mila. Pehle register karo.')] });
    }

    // Check if new IGN already taken by someone else
    const taken = LDB.findIGN(ign);
    if (taken && taken.discordId !== i.user.id)
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ **${ign}** pehle se kisi aur ke paas register hai.`)] });

    const oldIgn   = existing.ign;
    const oldTiers = { ...existing.tiers };

    // Update player record — keep tiers intact
    const db = JSON.parse(fs.readFileSync(PF,'utf8'));
    db[i.user.id] = {
      ...db[i.user.id],
      ign,
      platform:    state.platform    || existing.platform,
      accountType: state.accountType || existing.accountType,
      region:      state.region      || existing.region,
      updatedAt:   Date.now(),
    };
    fs.writeFileSync(PF, JSON.stringify(db, null, 2));
    if (MEM.players[i.user.id]) Object.assign(MEM.players[i.user.id], db[i.user.id]);

    regState.delete(i.user.id);
    broadcast({ type:'player_updated', player: db[i.user.id] });
    await sendRegistrationLog(i.client, db[i.user.id]);

    // Assign verified role
    if (CONFIG.VERIFIED_ROLE_ID) {
      try {
        const member = await i.guild.members.fetch(i.user.id).catch(()=>null);
        if (member) {
          const role = i.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
          if (role) await member.roles.add(role).catch(()=>{});
        }
      } catch(_) {}
    }

    const tierEntries = Object.entries(oldTiers);
    const tierSummary = tierEntries.length
      ? tierEntries.map(([w,t])=>`${WEAPON_EMOJI[w]||'•'} **${w}** — \`${t}\``).join('\n')
      : '*Koi tier nahi tha*';

    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setTitle('✅ Profile Updated! 🎉')
      .setDescription(`Profile update ho gaya, **${ign}**! 🇵🇰\nSaare purane tiers transfer ho gaye hain.`)
      .setThumbnail(`https://mc-heads.net/avatar/${ign}/128`)
      .addFields(
        { name:'🔄 Old IGN',    value:`\`${oldIgn}\``,            inline:true },
        { name:'✅ New IGN',    value:`\`${ign}\``,               inline:true },
        { name:'💻 Platform',   value:state.platform||'?',        inline:true },
        { name:'🔑 Account',    value:state.accountType||'?',     inline:true },
        { name:'🌍 Region',     value:state.region||'?',          inline:true },
        { name:'⚔️ Tiers Transferred', value: tierSummary,        inline:false },
      )
      .setFooter({ text:BOT_FOOTER })
      .setTimestamp()] });
  }

  // ── FRESH REGISTRATION flow ───────────────────────────────
  // Check IGN already taken
  const taken = LDB.findIGN(ign);
  if (taken)
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription(`❌ **${ign}** pehle se register hai. Apna IGN dobara check karo.`)] });

  const result = LDB.register(i.user.id, ign, state.platform, state.accountType, state.region);
  if (!result) {
    const ex = LDB.get(i.user.id);
    // Player already exists — treat as update
    regState.set(i.user.id, { ...state, isUpdate: true, oldIgn: ex.ign });
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
      .setDescription(`⚠️ Tum already **${ex.ign}** ke naam se registered ho.\nProfile update ke liye dobara button click karo.`)] });
  }

  regState.delete(i.user.id);
  broadcast({ type:'player_registered', player:MEM.players[i.user.id] });
  await sendRegistrationLog(i.client, MEM.players[i.user.id]);

  // Assign verified role
  if (CONFIG.VERIFIED_ROLE_ID) {
    try {
      const member = await i.guild.members.fetch(i.user.id).catch(()=>null);
      if (member) {
        const role = i.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
        if (role) await member.roles.add(role).catch(()=>{});
      }
    } catch(_) {}
  }

  await i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
    .setTitle('✅ Registration Complete! 🎉')
    .setDescription(`Welcome to **PakTiers**, **${ign}**! 🇵🇰`)
    .setThumbnail(`https://mc-heads.net/avatar/${ign}/128`)
    .addFields(
      { name:'🎮 IGN',         value:`\`${ign}\``,           inline:true },
      { name:'💻 Platform',    value:state.platform||'?',    inline:true },
      { name:'🔑 Account',     value:state.accountType||'?', inline:true },
      { name:'🌍 Region',      value:state.region||'?',      inline:true },
      { name:'🔰 Season',      value:'Season 1',             inline:true },
      { name:'📋 Next Steps',  value:'1. Tierer se evaluation karwao\n2. `/queue join` se match dhundo\n3. `/profile` se apni card dekho', inline:false },
    )
    .setFooter({ text:BOT_FOOTER })
    .setTimestamp()] });

}

// ════════════════════════════════════════════════════════════
//  DEPLOY + START
// ════════════════════════════════════════════════════════════
async function deployCommands() {
  const rest = new REST({ version:'10' }).setToken(CONFIG.BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
    { body: Object.values(CMDS).map(c=>c.data.toJSON()) });
  console.log(`✅ Deployed ${Object.keys(CMDS).length} slash commands`);
}

const client = new Client({ intents:[
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.MessageContent,
]});

client.once('ready', async () => {
  console.log(`🤖 Bot online as ${client.user.tag}`);
  client.user.setPresence({ activities:[{ name:'⚔️ /queue join · PakTiers', type:0 }], status:'online' });
  try { await deployCommands(); } catch(e) { console.error('Deploy error:', e); }

  // Auto-create all HT1-LT5 roles for every gamemode
  // Then sync existing players' roles
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    await guild.roles.fetch(); // populate cache

    // Step 1: ensure all 100 roles exist
    await ensureAllRoles(guild);

    // Step 2: sync every registered player's roles on startup
    console.log('[ROLE SYNC] Syncing existing players on startup...');
    const allPlayers = Object.values(LDB.all()).filter(p => Object.keys(p.tiers||{}).length > 0);
    for (const player of allPlayers) {
      try {
        const member = await guild.members.fetch(player.discordId).catch(() => null);
        if (!member) continue;
        for (const [weapon, tier] of Object.entries(player.tiers || {})) {
          const role = await ensureRole(guild, weapon, tier);
          if (role) await member.roles.add(role).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 200));
      } catch(_) {}
    }
    console.log(`[ROLE SYNC] Done — ${allPlayers.length} players processed.`);
  } catch(e) { console.error('[ROLE INIT]', e); }
});

client.on('interactionCreate', async i => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = CMDS[i.commandName]; if (!cmd) return;
      await cmd.execute(i);
    } else if (i.isStringSelectMenu()) {
      await handleSelectMenu(i);
    } else if (i.isButton()) {
      await handleButtonClick(i);
    } else if (i.isModalSubmit()) {
      await handleModal(i);
    }
  } catch(err) {
    console.error(`[ERROR] interaction:`, err);
    const e = new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Something went wrong.');
    try {
      if (i.replied || i.deferred) await i.followUp({ embeds:[e], ephemeral:true }).catch(()=>{});
      else await i.reply({ embeds:[e], ephemeral:true }).catch(()=>{});
    } catch(_) {}
  }
});

// ════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════
syncToMem();

server.listen(CONFIG.PORT, () => {
  console.log(`🌐 Server running on port ${CONFIG.PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🔑 Secret: ${CONFIG.API_SECRET==='paktiers-secret-change-me' ? '⚠️  DEFAULT' : 'Set ✓'}`);
});

if (CONFIG.BOT_TOKEN) {
  client.login(CONFIG.BOT_TOKEN);
} else {
  console.warn('⚠️  BOT_TOKEN not set — bot wont start. Railway Variables me add karo.');
}
