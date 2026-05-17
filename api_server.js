// ============================================================
//  PakTiers — ALL IN ONE v5
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
  TICKET_STAFF_ROLE_ID: process.env.TICKET_STAFF_ROLE_ID || '',   // Staff role jo tickets me ping ho
  VERIFIED_ROLE_ID:          process.env.VERIFIED_ROLE_ID          || '',   // Role jo register ke baad mile
  TESTERS_ROLE_ID:           process.env.TESTERS_ROLE_ID           || '',   // "﹂Tᴇsᴛᴇʀs ﹁ 👥" role — /startqueue use kar sakta hai
  QUEUE_ANNOUNCE_CHANNEL_ID: process.env.QUEUE_ANNOUNCE_CHANNEL_ID || '',   // Channel jahan @everyone ping jayega
  PANEL_CHANNEL_ID:          process.env.PANEL_CHANNEL_ID          || '',   // Channel jahan waitlist panel msg rahega (for /setuppanel)

  API_SECRET: process.env.API_SECRET || 'paktiers-secret-change-me',
  PORT:       process.env.PORT       || 3001,

  // Cooldown days after tier assignment per gamemode
  TIER_COOLDOWN_DAYS: 2,
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
  queues:    { Mace:[], Crystal:[], Sword:[], Axe:[], Netherite:[], Vanilla:[], UHC:[], Pot:[], NethOP:[], SMP:[] },
  matches:   [],
  cooldowns: {},   // { discordId: { weapon: timestamp } }
  tickets:   {},   // { discordId: channelId }
};

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
  Pot:'pot', NethOP:'nethop', SMP:'smp',
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
    pot:'Pot', nethop:'NethOP', smp:'SMP',
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
//  DISCORD BOT
// ════════════════════════════════════════════════════════════
const WEAPONS = ['Mace','Crystal','Sword','Axe','Netherite','Vanilla','UHC','Pot','NethOP','SMP'];
const TIERS   = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const WEAPON_EMOJI = {
  Mace:'🔨', Crystal:'💠', Sword:'⚔️', Axe:'🪓', Netherite:'🪨',
  Vanilla:'🔮', UHC:'🔥', Pot:'🧪', NethOP:'⚫', SMP:'🟢',
};
const WEAPON_TO_MCTIERS = {
  Mace:'mace', Crystal:'vanilla', Sword:'sword', Axe:'axe', Netherite:'netherite',
  Vanilla:'vanilla', UHC:'uhc', Pot:'pot', NethOP:'nethop', SMP:'smp',
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

function getTierLabel(t) {
  return { HT1:'High T1',LT1:'Low T1',HT2:'High T2',LT2:'Low T2',
    HT3:'High T3',LT3:'Low T3',HT4:'High T4',LT4:'Low T4',
    HT5:'High T5',LT5:'Low T5' }[t] || t;
}

// ── COOLDOWN UTILS ────────────────────────────────────────
function getCooldownFile() { return path.join(DATA_DIR, 'cooldowns.json'); }

function saveCooldown(discordId, weapon) {
  const f = getCooldownFile();
  const db = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : {};
  if (!db[discordId]) db[discordId] = {};
  db[discordId][weapon] = Date.now();
  fs.writeFileSync(f, JSON.stringify(db, null, 2));
  if (!MEM.cooldowns[discordId]) MEM.cooldowns[discordId] = {};
  MEM.cooldowns[discordId][weapon] = Date.now();
}

function getCooldown(discordId, weapon) {
  const f = getCooldownFile();
  if (!fs.existsSync(f)) return null;
  const db = JSON.parse(fs.readFileSync(f,'utf8'));
  return db[discordId]?.[weapon] || null;
}

function isOnCooldown(discordId, weapon) {
  const ts = getCooldown(discordId, weapon);
  if (!ts) return { onCooldown: false };
  const elapsed = Date.now() - ts;
  const cooldownMs = CONFIG.TIER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (elapsed < cooldownMs) {
    const remaining = cooldownMs - elapsed;
    const hours = Math.floor(remaining / 3600000);
    const mins  = Math.floor((remaining % 3600000) / 60000);
    return { onCooldown: true, hours, mins, endsAt: ts + cooldownMs };
  }
  return { onCooldown: false };
}

// ── LOCAL FILE DB ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'paktiers_data');
const PF = path.join(DATA_DIR, 'players.json');
const QF = path.join(DATA_DIR, 'queue.json');
const MF = path.join(DATA_DIR, 'matches.json');
const TF = path.join(DATA_DIR, 'tickets.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive:true });
const initF = (f, d) => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(d, null, 2)); };
initF(PF, {});
initF(QF, { Mace:[],Crystal:[],Sword:[],Axe:[],Netherite:[],Vanilla:[],UHC:[],Pot:[],NethOP:[],SMP:[] });
initF(MF, []);
initF(TF, {});

const rDB = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const wDB = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function syncToMem() {
  try {
    const p=rDB(PF), q=rDB(QF), m=rDB(MF);
    Object.assign(MEM.players, p);
    Object.assign(MEM.queues, q);
    m.forEach(match => { if (!MEM.matches.find(x=>x.id===match.id)) MEM.matches.push(match); });
    if (fs.existsSync(getCooldownFile()))
      Object.assign(MEM.cooldowns, rDB(getCooldownFile()));
    if (fs.existsSync(TF))
      Object.assign(MEM.tickets, rDB(TF));
    console.log(`📂 Loaded ${Object.keys(p).length} players from disk`);
  } catch(_) {}
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
  getTicket:   id  => { const db=rDB(TF); return db[id]||null; },
  setTicket(id, channelId) {
    const db = rDB(TF); db[id]=channelId; wDB(TF, db); MEM.tickets[id]=channelId;
  },
  delTicket(id) {
    const db = rDB(TF); delete db[id]; wDB(TF, db); delete MEM.tickets[id];
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

// ════════════════════════════════════════════════════════════
//  TICKET SYSTEM
// ════════════════════════════════════════════════════════════
async function createQueueTicket(client, guild, player, weapon, discordId) {
  if (!CONFIG.TICKET_CATEGORY_ID) return null;

  // Existing ticket check
  const existingId = LDB.getTicket(discordId);
  if (existingId) {
    try {
      const existing = await client.channels.fetch(existingId).catch(()=>null);
      if (existing) return existing;
    } catch(_) {}
  }

  try {
    const safeName = player.ign.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
    const channelName = `ticket-${safeName}`;

    const permOverwrites = [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: discordId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];

    if (CONFIG.TICKET_STAFF_ROLE_ID) {
      permOverwrites.push({
        id: CONFIG.TICKET_STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: permOverwrites,
      topic: `Queue Ticket — ${player.ign} | ${weapon} | <@${discordId}>`,
    });

    LDB.setTicket(discordId, ticketChannel.id);

    // Send ticket embed
    const staffPing = CONFIG.TICKET_STAFF_ROLE_ID ? `<@&${CONFIG.TICKET_STAFF_ROLE_ID}>` : '';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${discordId}`)
        .setLabel('🔒 Close Ticket')
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({
      content: `${staffPing} <@${discordId}>`,
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🎫 Queue Ticket Created')
        .setDescription(`A player has joined the **${weapon}** queue and needs attention.`)
        .addFields(
          { name:'1. Player Name', value:`**${player.ign}**`, inline:true },
          { name:'2. Discord',     value:`<@${discordId}>`, inline:true },
          { name:'3. Weapon',      value:`${WEAPON_EMOJI[weapon]} **${weapon}**`, inline:true },
          { name:'4. Tier',        value:`\`${player.tiers?.[weapon]||'N/A'}\``, inline:true },
          { name:'5. Platform',    value:player.platform||'Java Edition', inline:true },
          { name:'6. Region',      value:player.region||'PK', inline:true },
          { name:'7. Account',     value:player.accountType||'Premium', inline:true },
        )
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .setFooter({ text:'PakTiers Queue Ticket · Close when match is done' })
        .setTimestamp()],
      components: [row],
    });

    return ticketChannel;
  } catch(err) {
    console.error('[TICKET ERROR]', err);
    return null;
  }
}

async function closeTicket(client, guild, discordId, closedBy) {
  const channelId = LDB.getTicket(discordId);
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
  const WEAPONS_LIST = ['Mace','Crystal','Sword','Axe','Netherite','Vanilla','UHC','Pot','NethOP','SMP'];
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
  const q      = LDB.getQ(weapon);
  const panels = loadLivePanels();
  const testers = panels[weapon]?.activeTesters || [];

  const queueTxt  = q.length
    ? q.map((e, idx) => `${idx + 1}. <@${e.discordId}>`).join('\n')
    : '*Abhi koi queue mein nahi hai.*';

  const testerTxt = testers.length
    ? testers.map((id, idx) => `${idx + 1}. <@${id}>`).join('\n')
    : '*Koi active tester nahi*';

  const now = new Date().toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`✅  ${weapon} Tester Available!`)
    .setDescription(
      `@here a **${weapon}** queue is open for the **PK** region!\n\n` +
      `The queue is now open and updates in real-time.`
    )
    .addFields(
      { name: '📋  Queue',          value: queueTxt,  inline: false },
      { name: '👥  Active Testers', value: testerTxt, inline: false },
    )
    .setFooter({ text: `🌍 Region: PK  |  🕐 Last Refresh: ${now}` });
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
      '> • **Username:** Apna Minecraft IGN jo tune register kiya\n\n' +
      '\u26A0\uFE0F **Failure to provide authentic information will result in a denied test.**'
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

// ── /register ─────────────────────────────────────────────
CMDS.register = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register karo PakTiers me — sirf designated channel me kaam karega'),

  async execute(i) {
    // Channel check
    if (CONFIG.REGISTER_CHANNEL_ID && i.channelId !== CONFIG.REGISTER_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Register karne ke liye <#${CONFIG.REGISTER_CHANNEL_ID}> channel use karo.`)] });
    }

    // Already registered?
    const existing = LDB.get(i.user.id);
    if (existing) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription(`⚠️ Tum already **${existing.ign}** ke naam se register ho. \`/profile\` se dekh sakte ho.`)] });
    }

    // Platform fixed as Java Edition — skip straight to account type
    regState.set(i.user.id, { platform: 'Java Edition' });

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Account type chunno...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    await i.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 1/2')
        .setDescription('🖥️ **Platform: Java Edition**\n\nApna **account type** chunno:')
        .addFields(
          { name:'💎 Premium (Paid)', value:'Original bought Minecraft account', inline:false },
          { name:'🏴\u200d☠️ Cracked (Free)', value:'TLauncher ya koi aur cracked launcher', inline:false },
        )
        .setFooter({ text:'Sirf tujhe dikh raha hai yeh | PakTiers' })],
      components: [accRow],
    });
  },
};

// ── /profile ──────────────────────────────────────────────
CMDS.profile = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("Player ka PakTiers profile dekho")
    .addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(false))
    .addStringOption(o=>o.setName('ign').setDescription('IGN se dhundo').setRequired(false)),

  async execute(i) {
    await i.deferReply();
    const ignArg=i.options.getString('ign'), userArg=i.options.getUser('user');
    const player = ignArg ? LDB.findIGN(ignArg) : userArg ? LDB.get(userArg.id) : LDB.get(i.user.id);
    if (!player) return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setTitle('❌ Player Not Found')
      .setDescription(ignArg ? `**${ignArg}** naam ka koi player nahi mila.` : 'Tum registered nahi ho. `/register` use karo.')
      .setFooter({ text:BOT_FOOTER })] });

    const tiers   = player.tiers||{};
    const entries = Object.entries(tiers).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
    const pts     = entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
    const rank    = getRankTitle(pts);
    const color   = entries[0] ? TIER_COLOR[entries[0][1]] : BRAND_COLOR;
    const block   = entries.length===0
      ? '```\nAbhi koi tier nahi. Tierer se milwao!\n```'
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
        { name:'🌍 Region',     value:player.region||'Pakistan 🇵🇰',      inline:true },
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
    .addSubcommand(s=>s.setName('set').setDescription("Player ka tier set karo")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:w,value:w}))))
      .addStringOption(o=>o.setName('tier').setDescription('Tier').setRequired(true)
        .addChoices(...TIERS.map(t=>({name:t,value:t})))))
    .addSubcommand(s=>s.setName('remove').setDescription("Player ka tier hatao")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:w,value:w})))))
    .addSubcommand(s=>s.setName('view').setDescription('Player ke saare tiers dekho')
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))),

  async execute(i) {
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTierer = CONFIG.TIERER_ROLE_ID ? i.member.roles.cache.has(CONFIG.TIERER_ROLE_ID) : false;
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
      // Set cooldown
      saveCooldown(target.id, weapon);
      broadcast({ type:'tier_updated', discordId:target.id, ign:player.ign, weapon, tier, oldTier });

      // Auto assign Discord role
      try {
        const guild  = i.guild;
        const member = await guild.members.fetch(target.id).catch(()=>null);
        if (member) await assignTierRole(guild, member, weapon, tier, oldTier);
      } catch(_) {}

      await i.reply({ embeds:[new EmbedBuilder()
        .setColor(TIER_COLOR[tier] || BRAND_COLOR)
        .setTitle(`${player.ign}'s Tier Update 🏆`)
        .setThumbnail(`https://mc-heads.net/head/${player.ign}/128`)
        .addFields(
          { name:'Tester',             value:`<@${i.user.id}>`,                         inline:false },
          { name:'Minecraft Username', value:`${player.ign}`,                           inline:false },
          { name:'Game Mode',          value:`${weapon.toUpperCase()}`,                 inline:false },
          { name:'Previous Rank',      value: oldTier ? getTierLabel(oldTier) : 'Unranked', inline:false },
          { name:'Rank Earned',        value: getTierLabel(tier),                       inline:false },
          { name:'Region',             value: player.region || 'Pakistan 🇵🇰',          inline:false },
        )
        .setTimestamp()] });

      await syncEmbed(i.client, player, weapon, tier, i.user.id);

      // DM player
      try {
        await target.send({ embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
          .setTitle(`${WEAPON_EMOJI[weapon]} Tumhara ${weapon} tier ${oldTier?'update':'assign'} ho gaya!`)
          .setDescription(`**${getTierLabel(tier)}** (\`${tier}\`) · +${TIER_PTS[tier]} pts\n\n⏳ **${CONFIG.TIER_COOLDOWN_DAYS} din** baad \`/queue join\` kar sakte ho ${weapon} ke liye!`)
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
          const roleId = getGamemodeRoleId(weapon, removed);
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
    .addSubcommand(s=>s.setName('join').setDescription('Queue join karo')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('leave').setDescription('Queue chodo (ya sab)')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon (chodo = sab)').setRequired(false)
        .addChoices({name:'🚫 Leave ALL',value:'all'},...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('status').setDescription('Queue status dekho'))
    .addSubcommand(s=>s.setName('start').setDescription('Queue open karo — waitlist channel me @everyone ping (Testers only)')
      .addStringOption(o=>o.setName('gamemode').setDescription('Gamemode select karo').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w}))))
      .addStringOption(o=>o.setName('message').setDescription('Extra message (optional)').setRequired(false))),

  async execute(i) {
    const sub = i.options.getSubcommand();

    // Channel check for join
    if (sub==='join' && CONFIG.QUEUE_CHANNEL_ID && i.channelId !== CONFIG.QUEUE_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Queue join karne ke liye <#${CONFIG.QUEUE_CHANNEL_ID}> channel use karo.`)] });
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
        .setDescription('❌ Registered nahi. `/register` use karo.')] });
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
        .setDescription('❌ Registered nahi. `/register` use karo.')] });

      const access = await hasQueueAccess(i.guild, i.user.id, player, weapon);
      if (!access.allowed) return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setTitle('❌ Access Nahi — No Tier & No Waitlist Role')
        .setDescription(
          `Tum **${weapon}** queue join nahi kar sakte.\n\n` +
          `**2 tarike hain join karne ke:**\n` +
          `• Kisi **Tierer** se apna ${weapon} tier karwao, **YA**\n` +
          `• Panel mein **${weapon}** gamemode select karo — Waitlist role lo`
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
          .setFooter({ text:`${CONFIG.TIER_COOLDOWN_DAYS} din ka cooldown tier milne ke baad · PakTiers` })] });
      }

      const result = LDB.joinQ(i.user.id, weapon);
      if (!result.ok && result.reason==='dupe')
        return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum already ${WEAPON_EMOJI[weapon]} **${weapon}** queue me ho.`)] });

      // ── CREATE TICKET ──────────────────────────────────────
      const guild = i.guild;
      if (guild && CONFIG.TICKET_CATEGORY_ID) {
        createQueueTicket(i.client, guild, player, weapon, i.user.id).catch(()=>{});
      }

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
          { name:'🎫 Ticket',   value:'Ticket create ho gaya! Staff ko notification gaya.', inline:false },
          { name:'⏳ Status',   value:'1 aur player ka wait hai…' },
        ).setFooter({ text:'Queue chhodni ho to /queue leave · PakTiers' }).setTimestamp()] });
    }

    // ── START (Testers only) ─────────────────────────────────
    if (sub === 'start') {
      if (!hasQueuePerm(i.member))
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Permission Denied')
          .setDescription('Yeh command sirf **Testers** ya queue permission wale roles use kar sakte hain.')
          .setFooter({ text:BOT_FOOTER })] });

      await i.deferReply({ ephemeral:true });

      const weapon   = i.options.getString('gamemode');
      const extraMsg = i.options.getString('message') || null;
      const emoji    = WEAPON_EMOJI[weapon] || '⚔️';

      // ── Auto-find waitlist-<weapon> channel in guild ──────
      const waitlistName = `waitlist-${weapon.toLowerCase()}`;
      let announceChannel = null;
      try {
        const allChannels = await i.guild.channels.fetch();
        announceChannel = allChannels.find(c =>
          c.isTextBased() && c.name.toLowerCase() === waitlistName
        ) || null;
      } catch(_) {}

      // Fallback: QUEUE_ANNOUNCE_CHANNEL_ID env, then current channel
      if (!announceChannel && CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID) {
        try { announceChannel = await i.client.channels.fetch(CONFIG.QUEUE_ANNOUNCE_CHANNEL_ID).catch(()=>null); } catch(_) {}
      }
      if (!announceChannel) announceChannel = i.channel;

      // ── CTL-style live panel ──────────────────────────────
      const panels = loadLivePanels();

      // Purana panel delete karo
      if (panels[weapon]?.channelId && panels[weapon]?.messageId) {
        try {
          const oldCh  = await i.client.channels.fetch(panels[weapon].channelId).catch(() => null);
          const oldMsg = oldCh ? await oldCh.messages.fetch(panels[weapon].messageId).catch(() => null) : null;
          if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch(_) {}
      }

      panels[weapon] = { channelId: announceChannel.id, messageId: null, activeTesters: [], lastRefresh: Date.now() };
      saveLivePanels(panels);

      const embed   = buildLivePanelEmbed(weapon);
      const joinBtn = new ButtonBuilder().setCustomId(`wl_join_${weapon}`).setLabel('Join').setStyle(ButtonStyle.Success);
      const leavBtn = new ButtonBuilder().setCustomId(`wl_leave_${weapon}`).setLabel('Leave').setStyle(ButtonStyle.Danger);
      const pullBtn = new ButtonBuilder().setCustomId(`wl_pull_${weapon}`).setLabel('🎫 Pull').setStyle(ButtonStyle.Primary);
      const liveRow = new ActionRowBuilder().addComponents(joinBtn, leavBtn, pullBtn);

      let sent = false;
      let sentMsg = null;
      try {
        sentMsg = await announceChannel.send({
          content: `@here`,
          embeds: [embed],
          components: [liveRow],
          allowedMentions: { parse: ['here'] },
        });
        panels[weapon].messageId = sentMsg.id;
        saveLivePanels(panels);
        sent = true;
      } catch(err) {
        console.error('[QUEUE START ERROR]', err);
      }

      return i.editReply({ embeds:[new EmbedBuilder()
        .setColor(sent ? 0x00C864 : 0xFF4444)
        .setTitle(sent ? '✅ Live Queue Panel Create Ho Gaya!' : '⚠️ Announcement Failed')
        .setDescription(sent
          ? `**${weapon}** live panel <#${announceChannel.id}> mein create ho gaya!\nHar join/leave/pull pe auto-update hoga.`
          : `Message send karne mein masla aaya.`)
        .addFields(
          { name:`${WEAPON_EMOJI[weapon]||'⚔️'} Gamemode`, value: weapon,                     inline:true },
          { name:'📢 Channel',                              value: `<#${announceChannel.id}>`, inline:true },
        )
        .setFooter({ text:BOT_FOOTER })] });
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
    const hasTierer = CONFIG.TIERER_ROLE_ID ? i.member.roles.cache.has(CONFIG.TIERER_ROLE_ID) : false;
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
    const hasTierer = CONFIG.TIERER_ROLE_ID ? i.member.roles.cache.has(CONFIG.TIERER_ROLE_ID) : false;
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
        .setDescription('❌ Pehle **Register / Update Profile** button dabaao aur register karo.')] });

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
          .setDescription(`**${weapon}** waitlist role ke liye **${h}h ${m}m** baad apply karo.`)] });
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
          `Tumhe **Waitlist-${weapon}** role mil gaya!

` +
          `Jab **${weapon}** queue open hogi, tumhe ping milega.
` +
          `Join karne ke liye queue channel mein **Join** button dabaao.`
        )
        .addFields(
          { name:'🎮 IGN',      value:`**${player.ign}**`,           inline:true },
          { name:'💻 Platform', value:player.platform||'Java',        inline:true },
          { name:'🌍 Region',   value:player.region||'PK',           inline:true },
        )
        .setFooter({ text:'PakTiers · Pakistan Minecraft Community' })
        .setTimestamp()] });
    } catch(err) {
      console.error('[PANEL WAITLIST ROLE]', err);
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Role assign karne mein masla: ${err.message}`)] });
    }
  }

  if (prefix !== 'reg') return;
  if (uid !== i.user.id) {
    return i.reply({ ephemeral:true, content:'❌ Yeh tumhara menu nahi hai.' });
  }

  const selected = i.values[0];

  if (step === 'platform') {
    // Save platform, move to account type
    regState.set(i.user.id, { platform: selected });

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Account type chunno...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 1/2')
        .setDescription(`✅ Platform: **${selected}**\n\nAb apna **account type** chunno:`)
        .addFields(
          { name:'💎 Premium (Paid)', value:'Original bought Minecraft account', inline:false },
          { name:'🏴‍☠️ Cracked (Free)', value:'TLauncher ya koi aur cracked launcher', inline:false },
        )
        .setFooter({ text:'Sirf tujhe dikh raha hai | PakTiers' })],
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
        .setPlaceholder('🌍 Apna region chunno...')
        .addOptions(REGIONS_LIST.map(r => ({ label:r, value:r }))),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 2/2')
        .setDescription(`✅ Platform: **${state.platform}**\n✅ Account: **${selected}**\n\nAb apna **region** chunno:`)
        .setFooter({ text:'Sirf tujhe dikh raha hai | PakTiers' })],
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
        .setLabel('✏️ IGN Enter Karo')
        .setStyle(ButtonStyle.Primary),
    );

    return i.update({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — IGN')
        .setDescription(`✅ Platform: **${state.platform}**\n✅ Account: **${state.accountType}**\n✅ Region: **${selected}**\n\n⬇️ Ab niche button dabao aur apna **Minecraft IGN** daalo:`)
        .setFooter({ text:'Sirf tujhe dikh raha hai | PakTiers' })],
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
    if (existing) {
      // Already registered — show their current profile ephemeral
      const tiers   = existing.tiers || {};
      const entries = Object.entries(tiers).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
      const pts     = entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setTitle('⚠️ Already Registered')
        .setThumbnail(`https://mc-heads.net/avatar/${existing.ign}/128`)
        .setDescription(
          `Tum already **${existing.ign}** ke naam se registered ho.

` +
          `Apni details update karne ke liye pehle \`/profile\` dekho.
` +
          `Agar IGN change karna ho to staff se rabta karo.`
        )
        .addFields(
          { name:'🎮 IGN',      value:`**${existing.ign}**`,          inline:true },
          { name:'💻 Platform', value:existing.platform||'Java',       inline:true },
          { name:'🌍 Region',   value:existing.region||'PK',          inline:true },
          { name:'⭐ Points',   value:`**${pts} pts**`,               inline:true },
        )
        .setFooter({ text:'PakTiers · Pakistan Minecraft Community' })] });
    }

    // Not registered — trigger registration flow (same as /register)
    if (CONFIG.REGISTER_CHANNEL_ID && i.channelId !== CONFIG.REGISTER_CHANNEL_ID) {
      return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setDescription(`❌ Register karne ke liye <#${CONFIG.REGISTER_CHANNEL_ID}> channel use karo.`)] });
    }

    regState.set(i.user.id, { platform: 'Java Edition' });

    const accRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`reg_account_${i.user.id}`)
        .setPlaceholder('🔑 Account type chunno...')
        .addOptions(ACCOUNT_TYPES.map(a => ({ label:a, value:a }))),
    );

    return i.reply({
      ephemeral:true,
      embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('📋 PakTiers Registration — Step 1/2')
        .setDescription('\uD83D\uDDA5\uFE0F **Platform: Java Edition**\n\nApna **account type** chunno:')
        .addFields(
          { name:'💎 Premium (Paid)', value:'Original bought Minecraft account', inline:false },
          { name:'🏴‍☠️ Cracked (Free)', value:'TLauncher ya koi aur cracked launcher', inline:false },
        )
        .setFooter({ text:'Sirf tujhe dikh raha hai | PakTiers' })],
      components:[accRow],
    });
  }

  // Close ticket button
  if (i.customId.startsWith('close_ticket_')) {
    const targetId = i.customId.replace('close_ticket_','');
    const isAdmin   = i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaff  = CONFIG.TICKET_STAFF_ROLE_ID ? i.member.roles.cache.has(CONFIG.TICKET_STAFF_ROLE_ID) : false;
    const hasTierer = CONFIG.TIERER_ROLE_ID ? i.member.roles.cache.has(CONFIG.TIERER_ROLE_ID) : false;
    const isOwner   = i.user.id === targetId;
    if (!isAdmin && !hasStaff && !hasTierer && !isOwner)
      return i.reply({ ephemeral:true, content:'❌ Tumhe yeh ticket band karne ki permission nahi.' });
    await i.reply({ ephemeral:true, content:'🔒 Ticket band ho raha hai...' });
    return closeTicket(i.client, i.guild, targetId, i.user.id);
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
          .setDescription('❌ Pehle `/register` karo.')] });

      const access = await hasQueueAccess(i.guild, i.user.id, player, weapon);
      if (!access.allowed)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setTitle('❌ Access Nahi')
          .setDescription(
            `Tum **${weapon}** queue join nahi kar sakte.\n\n` +
            `**2 tarike hain:**\n` +
            `• Kisi **Tierer** se tier karwao, **YA**\n` +
            `• Panel mein **${weapon}** select karo — Waitlist role lo`
          )] });

      const cd = isOnCooldown(i.user.id, weapon);
      if (cd.onCooldown)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription(`⏳ **${weapon}** cooldown active hai — ${cd.hours}h ${cd.mins}m remaining.`)] });

      const result = LDB.joinQ(i.user.id, weapon);
      if (!result.ok && result.reason === 'dupe')
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`⚠️ Tum already **${weapon}** queue mein ho.`)] });

      // Create ticket
      if (i.guild && CONFIG.TICKET_CATEGORY_ID)
        createQueueTicket(i.client, i.guild, player, weapon, i.user.id).catch(()=>{});

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
          { name:'🎫 Ticket', value:'Staff ko ticket gaya!',       inline:false },
        )
        .setFooter({ text:'Queue chhodni ho to "Leave Queue" button dabao · PakTiers' })
        .setTimestamp()] });
    }

    // ── LEAVE ─────────────────────────────────────────────────
    if (action === 'leave') {
      if (!player)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
          .setDescription('❌ Tum registered nahi ho.')] });

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
          .setDescription('❌ Yeh button sirf **Testers** ya queue permission wale roles use kar sakte hain.')] });

      const q = LDB.getQ(weapon);
      if (!q.length)
        return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
          .setDescription(`📭 **${weapon}** queue abhi khali hai — koi player wait nahi kar raha.`)] });

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
        saveLivePanels(pnls);
      }
      refreshLivePanel(i.client, weapon).catch(() => {});

      // Open ticket for pulled player
      let ticketChannel = null;
      if (i.guild && CONFIG.TICKET_CATEGORY_ID) {
        ticketChannel = await createQueueTicket(i.client, i.guild, target, weapon, entry.discordId).catch(()=>null);
      } else if (!CONFIG.TICKET_CATEGORY_ID) {
        console.warn('[PULL] TICKET_CATEGORY_ID not set — ticket nahi banega. Railway env vars check karo.');
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
            content:`📢 <@${entry.discordId}> — Tester ne tumhe pull kiya! Test ke liye ready ho jao.`,
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
                .setDescription(`**${i.user.username}** (Tester) ne tumhe **${weapon}** queue se pull kiya hai!\nServer pe aao aur test ke liye ready ho jao. 🇵🇰`)
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

  // IGN button — show modal
  if (i.customId.startsWith('reg_ignbtn_')) {
    const uid = i.customId.replace('reg_ignbtn_','');
    if (uid !== i.user.id)
      return i.reply({ ephemeral:true, content:'❌ Yeh tumhara button nahi.' });

    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`reg_modal_${i.user.id}`)
      .setTitle('Apna Minecraft IGN Daalo');

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
    return i.reply({ ephemeral:true, content:'❌ Yeh tumhara form nahi.' });

  const ign   = i.fields.getTextInputValue('ign_input').trim();
  const state = regState.get(i.user.id) || {};

  if (!/^[a-zA-Z0-9_]+$/.test(ign))
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription('❌ Invalid IGN. Sirf letters, numbers aur underscore allowed hain.')] });

  // Check IGN already taken
  const taken = LDB.findIGN(ign);
  if (taken)
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setDescription(`❌ **${ign}** pehle se register hai. Apna IGN dobara check karo.`)] });

  const result = LDB.register(i.user.id, ign, state.platform, state.accountType, state.region);
  if (!result) {
    const ex = LDB.get(i.user.id);
    return i.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xFF9933)
      .setDescription(`⚠️ Tum already **${ex.ign}** ke naam se register ho.`)] });
  }

  regState.delete(i.user.id);
  broadcast({ type:'player_registered', player:MEM.players[i.user.id] });

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

  // Public announcement (same channel, non-ephemeral)
  try {
    const ch = i.channel;
    if (ch) {
      await ch.send({ embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle('🆕 New Player Joined PakTiers!')
        .setDescription(`<@${i.user.id}> (**${ign}**) ne PakTiers join kar liya! 🎉\n\n*Platform:* ${state.platform||'?'} | *Region:* ${state.region||'?'}`)
        .setThumbnail(`https://mc-heads.net/avatar/${ign}/128`)
        .setFooter({ text:BOT_FOOTER })
        .setTimestamp()] });
    }
  } catch(_) {}
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
    const e = new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Kuch gadbad ho gayi.');
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
