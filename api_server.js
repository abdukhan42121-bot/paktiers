// ============================================================
//  PakTiers — ALL IN ONE
//  API Server + Discord Bot + Website
//  Railway pe deploy karo — bas 2 env vars chahiye:
//    BOT_TOKEN  = tera Discord bot token
//    API_SECRET = koi bhi secret string
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
} = require('discord.js');

// ════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════
const CONFIG = {
  BOT_TOKEN:           process.env.BOT_TOKEN,
  CLIENT_ID:           '1504744014526677003',
  GUILD_ID:            '1478080380014952610',
  TIERER_ROLE_ID:      '1504503176358006834',
  MATCH_CHANNEL_ID:    '1504510227322503189',
  TIER_SYNC_CHANNEL_ID:'1504510227322503189',
  API_SECRET: process.env.API_SECRET || 'paktiers-secret-change-me',
  PORT:       process.env.PORT       || 3001,
};

// ════════════════════════════════════════════════════════════
//  EXPRESS + WEBSOCKET
// ════════════════════════════════════════════════════════════
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── IN-MEMORY DB ─────────────────────────────────────────────
const MEM = {
  players: {},
  queues:  { Mace:[], Crystal:[], Sword:[], Axe:[], Netherite:[] },
  matches: [],
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

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type:'init', data: MEM }));
});

// ── TIER UTILS ────────────────────────────────────────────────
const TIER_PTS = { HT1:10,LT1:9,HT2:8,LT2:7,HT3:6,LT3:5,HT4:4,LT4:3,HT5:2,LT5:1 };

function getRankTitle(pts) {
  if (pts>=101) return { label:'COMBAT ACE',        emoji:'🔥' };
  if (pts>=51)  return { label:'COMBAT SPECIALIST', emoji:'⚡' };
  if (pts>=26)  return { label:'COMBAT CADET',      emoji:'🟢' };
  if (pts>=10)  return { label:'COMBAT NOICE',      emoji:'🔵' };
  return               { label:'ROOKIE',            emoji:'⚪' };
}

function enrichPlayer(p) {
  const totalPts = Object.values(p.tiers).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
  return { ...p, totalPts, rankTitle:getRankTitle(totalPts),
    avatar:`https://mc-heads.net/avatar/${p.ign}/64` };
}

// ════════════════════════════════════════════════════════════
//  BOT -> API ENDPOINTS
// ════════════════════════════════════════════════════════════
app.post('/bot/register', requireSecret, (req,res) => {
  const { discordId, ign } = req.body;
  if (!discordId||!ign) return res.status(400).json({ error:'Missing fields' });
  if (MEM.players[discordId]) return res.status(409).json({ error:'Already registered' });
  MEM.players[discordId] = { discordId, ign, tiers:{}, registeredAt:Date.now() };
  broadcast({ type:'player_registered', player:MEM.players[discordId] });
  res.json({ success:true, player:MEM.players[discordId] });
});

app.post('/bot/tier', requireSecret, (req,res) => {
  const { discordId, weapon, tier } = req.body;
  const player = MEM.players[discordId];
  if (!player) return res.status(404).json({ error:'Player not found' });
  const oldTier = player.tiers[weapon];
  player.tiers[weapon] = tier;
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
  res.json({ totalPlayers:players.length, tieredPlayers:tiered.length,
    queuedNow, totalMatches:MEM.matches.length });
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
//  DISCORD BOT
// ════════════════════════════════════════════════════════════
const WEAPONS=['Mace','Crystal','Sword','Axe','Netherite'];
const TIERS=['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const WEAPON_EMOJI={ Mace:'🔨',Crystal:'💠',Sword:'⚔️',Axe:'🪓',Netherite:'🪨' };
const WEAPON_TO_MCTIERS={ Mace:'mace',Crystal:'vanilla',Sword:'sword',Axe:'axe',Netherite:'netherite' };
const TIER_COLOR={ HT1:0xFF6B00,LT1:0xFF9933,HT2:0xFFB800,LT2:0xFFD700,
  HT3:0x00C864,LT3:0x00A550,HT4:0x4FC3F7,LT4:0x29B6F6,HT5:0x888888,LT5:0x555555 };
const TIER_BAR={ HT1:'▰▰▰▰▰▰▰▰▰▰',LT1:'▰▰▰▰▰▰▰▰▰▱',HT2:'▰▰▰▰▰▰▰▰▱▱',LT2:'▰▰▰▰▰▰▰▱▱▱',
  HT3:'▰▰▰▰▰▰▱▱▱▱',LT3:'▰▰▰▰▰▱▱▱▱▱',HT4:'▰▰▰▰▱▱▱▱▱▱',LT4:'▰▰▰▱▱▱▱▱▱▱',HT5:'▰▰▱▱▱▱▱▱▱▱',LT5:'▰▱▱▱▱▱▱▱▱▱' };
const BRAND_COLOR=0x7FFF00;
const BOT_FOOTER='PakTiers · Pakistan Minecraft Community';

function getTierLabel(t){ return {HT1:'High T1',LT1:'Low T1',HT2:'High T2',LT2:'Low T2',HT3:'High T3',LT3:'Low T3',HT4:'High T4',LT4:'Low T4',HT5:'High T5',LT5:'Low T5'}[t]||t; }

// ── LOCAL FILE DB (persists across restarts) ──────────────────
const DATA_DIR=path.join(__dirname,'paktiers_data');
const PF=path.join(DATA_DIR,'players.json');
const QF=path.join(DATA_DIR,'queue.json');
const MF=path.join(DATA_DIR,'matches.json');
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
const initF=(f,d)=>{if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify(d,null,2));};
initF(PF,{}); initF(QF,{Mace:[],Crystal:[],Sword:[],Axe:[],Netherite:[]}); initF(MF,[]);
const rDB=(f)=>JSON.parse(fs.readFileSync(f,'utf8'));
const wDB=(f,d)=>fs.writeFileSync(f,JSON.stringify(d,null,2));

function syncToMem(){
  try{
    const p=rDB(PF),q=rDB(QF),m=rDB(MF);
    Object.assign(MEM.players,p);
    Object.assign(MEM.queues,q);
    m.forEach(match=>{if(!MEM.matches.find(x=>x.id===match.id))MEM.matches.push(match);});
    console.log(`📂 Loaded ${Object.keys(p).length} players from disk`);
  }catch(_){}
}

const LDB={
  get:id=>{const db=rDB(PF);return db[id]||null;},
  all:()=>rDB(PF),
  findIGN:ign=>Object.values(rDB(PF)).find(p=>p.ign.toLowerCase()===ign.toLowerCase())||null,

  register(id,ign){
    const db=rDB(PF); if(db[id])return null;
    db[id]={discordId:id,ign,registeredAt:Date.now(),tiers:{}};
    wDB(PF,db); MEM.players[id]=db[id]; return db[id];
  },
  setTier(id,w,t){
    const db=rDB(PF); if(!db[id])return null;
    db[id].tiers[w]=t; wDB(PF,db);
    if(MEM.players[id])MEM.players[id].tiers[w]=t; return db[id];
  },
  delTier(id,w){
    const db=rDB(PF); if(!db[id])return null;
    delete db[id].tiers[w]; wDB(PF,db);
    if(MEM.players[id])delete MEM.players[id].tiers[w]; return db[id];
  },
  getQ:w=>(rDB(QF)[w]||[]),
  allQ:()=>rDB(QF),
  joinQ(id,weapon){
    const db=rDB(QF); if(!db[weapon])db[weapon]=[];
    if(db[weapon].find(e=>e.discordId===id))return{ok:false,reason:'dupe'};
    db[weapon].push({discordId:id,joinedAt:Date.now()});
    wDB(QF,db); MEM.queues[weapon]=db[weapon];
    if(db[weapon].length>=2){
      const p1=db[weapon].shift(),p2=db[weapon].shift();
      wDB(QF,db); MEM.queues[weapon]=db[weapon];
      return{ok:true,match:[p1,p2]};
    }
    return{ok:true,match:null};
  },
  leaveQ(id,weapon){
    const db=rDB(QF); if(!db[weapon])return;
    db[weapon]=db[weapon].filter(e=>e.discordId!==id);
    wDB(QF,db); MEM.queues[weapon]=db[weapon];
  },
  leaveAllQ(id){
    const db=rDB(QF);
    for(const w of Object.keys(db))db[w]=db[w].filter(e=>e.discordId!==id);
    wDB(QF,db); Object.assign(MEM.queues,db);
  },
  addMatch(weapon,p1,p2){
    const db=rDB(MF);
    const m={id:Date.now(),weapon,players:[p1,p2],createdAt:Date.now(),status:'ongoing'};
    db.push(m); wDB(MF,db); MEM.matches.push(m); return m;
  },
};

// UUID cache
const uuidCache=new Map();
async function getMCUUID(ign){
  const k=ign.toLowerCase(),c=uuidCache.get(k);
  if(c&&Date.now()-c.t<1800000)return c.v;
  try{
    const r=await fetch(`https://api.mojang.com/users/profiles/minecraft/${ign}`);
    if(!r.ok)return null;
    const d=await r.json(); if(!d?.id)return null;
    const raw=d.id;
    const uuid=`${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
    uuidCache.set(k,{v:uuid,t:Date.now()}); return uuid;
  }catch(_){return null;}
}

async function syncEmbed(client,player,weapon,tier,byId){
  if(!CONFIG.TIER_SYNC_CHANNEL_ID)return;
  try{
    const ch=await client.channels.fetch(CONFIG.TIER_SYNC_CHANNEL_ID);
    if(!ch)return;
    const uuid=await getMCUUID(player.ign);
    await ch.send({embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
      .setTitle('🔄 PakTiers Tier Sync')
      .addFields(
        {name:'player',  value:player.ign,           inline:true},
        {name:'uuid',    value:uuid||'not-found',     inline:true},
        {name:'weapon',  value:WEAPON_TO_MCTIERS[weapon]||weapon,inline:true},
        {name:'tier',    value:tier,                  inline:true},
        {name:'tieredBy',value:`<@${byId}>`,          inline:true},
      ).setTimestamp().setFooter({text:BOT_FOOTER})]});
  }catch(_){}
}

// ── COMMANDS ──────────────────────────────────────────────────
const CMDS={};

CMDS.register={
  data:new SlashCommandBuilder().setName('register').setDescription('Register your Minecraft Java IGN')
    .addStringOption(o=>o.setName('ign').setDescription('Your MC Java username').setRequired(true).setMinLength(3).setMaxLength(16)),
  async execute(i){
    const ign=i.options.getString('ign');
    if(!/^[a-zA-Z0-9_]+$/.test(ign))
      return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Invalid IGN.')]});
    const r=LDB.register(i.user.id,ign);
    if(!r){
      const ex=LDB.get(i.user.id);
      return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF9933)
        .setDescription(`Already registered as **${ex.ign}**. Use \`/profile\` to view stats.`)]});
    }
    broadcast({type:'player_registered',player:MEM.players[i.user.id]});
    await i.reply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setTitle('✅ Registered Successfully!')
      .setDescription(`Welcome to **PakTiers**, **${ign}**! 🇵🇰`)
      .setThumbnail(`https://mc-heads.net/avatar/${ign}/128`)
      .addFields(
        {name:'🎮 IGN',value:`\`${ign}\``,inline:true},
        {name:'💻 Platform',value:'Java Edition',inline:true},
        {name:'🔰 Season',value:'Season 1',inline:true},
        {name:'📋 Next Steps',value:'1. Wait for a **Tierer** to evaluate you\n2. `/queue join` to find matches\n3. `/profile` to view your card'},
      ).setFooter({text:BOT_FOOTER}).setTimestamp()]});
  },
};

CMDS.profile={
  data:new SlashCommandBuilder().setName('profile').setDescription("View a player's PakTiers profile")
    .addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(false))
    .addStringOption(o=>o.setName('ign').setDescription('Search by IGN').setRequired(false)),
  async execute(i){
    await i.deferReply();
    const ignArg=i.options.getString('ign'),userArg=i.options.getUser('user');
    const player=ignArg?LDB.findIGN(ignArg):userArg?LDB.get(userArg.id):LDB.get(i.user.id);
    if(!player)return i.editReply({embeds:[new EmbedBuilder().setColor(0xFF4444)
      .setTitle('❌ Player Not Found')
      .setDescription(ignArg?`No player with IGN **${ignArg}**`:"Not registered. Use `/register`.")
      .setFooter({text:BOT_FOOTER})]});
    const tiers=player.tiers||{};
    const entries=Object.entries(tiers).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
    const pts=entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
    const rank=getRankTitle(pts);
    const color=entries[0]?TIER_COLOR[entries[0][1]]:BRAND_COLOR;
    const block=entries.length===0?'```\nNo tiers yet. Contact a Tierer!\n```'
      :'```\n'+entries.map(([w,t])=>`${w.padEnd(11)} ${getTierLabel(t).padEnd(8)}  ${TIER_BAR[t]||'▱▱▱▱▱▱▱▱▱▱'}  +${TIER_PTS[t]}pt`).join('\n')+'\n```';
    const ranked=Object.values(LDB.all()).filter(p=>Object.keys(p.tiers||{}).length>0)
      .map(p=>({...p,pts:Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0)}))
      .sort((a,b)=>b.pts-a.pts);
    const pos=ranked.findIndex(p=>p.discordId===player.discordId)+1;
    await i.editReply({embeds:[new EmbedBuilder().setColor(color)
      .setTitle(`${rank.emoji}  ${player.ign}`)
      .setDescription(`**${rank.label}**\n⭐ **${pts} pts** · 🏅 **Rank ${pos>0?`#${pos} of ${ranked.length}`:'Unranked'}** · 🇵🇰`)
      .addFields(
        {name:'⚔️ Weapon Disciplines',value:block},
        {name:'🎮 Platform',value:'Java Edition',inline:true},
        {name:'📅 Registered',value:`<t:${Math.floor(player.registeredAt/1000)}:D>`,inline:true},
        {name:'🔰 Season',value:'Season 1',inline:true},
      ).setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`).setFooter({text:BOT_FOOTER}).setTimestamp()]});
  },
};

CMDS.tier={
  data:new SlashCommandBuilder().setName('tier').setDescription('Tier management (Tierer role required)')
    .addSubcommand(s=>s.setName('set').setDescription("Set a player's tier")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true).addChoices(...WEAPONS.map(w=>({name:w,value:w}))))
      .addStringOption(o=>o.setName('tier').setDescription('Tier').setRequired(true).addChoices(...TIERS.map(t=>({name:t,value:t})))))
    .addSubcommand(s=>s.setName('remove').setDescription("Remove a player's tier")
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true).addChoices(...WEAPONS.map(w=>({name:w,value:w})))))
    .addSubcommand(s=>s.setName('view').setDescription('View all tiers for a player')
      .addUserOption(o=>o.setName('player').setDescription('Discord user').setRequired(true))),
  async execute(i){
    const isAdmin=i.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTierer=CONFIG.TIERER_ROLE_ID?i.member.roles.cache.has(CONFIG.TIERER_ROLE_ID):false;
    if(!isAdmin&&!hasTierer)return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Need **Tierer** role.')]});
    const sub=i.options.getSubcommand(),target=i.options.getUser('player');
    const weapon=i.options.getString('weapon'),tier=i.options.getString('tier');
    const player=LDB.get(target.id);
    if(sub==='view'){
      if(!player)return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription(`❌ **${target.username}** not registered.`)]});
      const entries=Object.entries(player.tiers||{}).sort((a,b)=>(TIER_PTS[b[1]]||0)-(TIER_PTS[a[1]]||0));
      const pts=entries.reduce((s,[,t])=>s+(TIER_PTS[t]||0),0);
      return i.reply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`📋 Tiers — ${player.ign}`)
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .setDescription(entries.length?entries.map(([w,t])=>`${WEAPON_EMOJI[w]} **${w}** — ${getTierLabel(t)} \`${t}\``).join('\n'):'*No tiers*')
        .setFooter({text:`Total: ${pts} pts`})]});
    }
    if(sub==='set'){
      if(!player)return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription(`❌ **${target.username}** must \`/register\` first.`)]});
      const oldTier=player.tiers?.[weapon];
      LDB.setTier(target.id,weapon,tier);
      broadcast({type:'tier_updated',discordId:target.id,ign:player.ign,weapon,tier,oldTier});
      await i.reply({embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
        .setTitle(oldTier?'🔄 Tier Updated':'✅ Tier Assigned')
        .setThumbnail(`https://mc-heads.net/avatar/${player.ign}/128`)
        .addFields(
          {name:'Player',value:`**${player.ign}** (<@${target.id}>)`,inline:true},
          {name:'Weapon',value:`${WEAPON_EMOJI[weapon]} ${weapon}`,inline:true},
          {name:'\u200b',value:'\u200b',inline:true},
          oldTier?{name:'Change',value:`\`${oldTier}\` → \`${tier}\` (+${TIER_PTS[tier]}pts)`,inline:true}
                 :{name:'Tier',value:`\`${tier}\` — ${getTierLabel(tier)} (+${TIER_PTS[tier]}pts)`,inline:true},
          {name:'Tiered By',value:`<@${i.user.id}>`,inline:true},
          {name:'mctiers Gamemode',value:`\`${WEAPON_TO_MCTIERS[weapon]}\``,inline:true},
        ).setFooter({text:BOT_FOOTER}).setTimestamp()]});
      await syncEmbed(i.client,player,weapon,tier,i.user.id);
      try{await target.send({embeds:[new EmbedBuilder().setColor(TIER_COLOR[tier]||BRAND_COLOR)
        .setTitle(`${WEAPON_EMOJI[weapon]} Your ${weapon} tier ${oldTier?'updated':'assigned'}!`)
        .setDescription(`**${getTierLabel(tier)}** (\`${tier}\`) · +${TIER_PTS[tier]} pts\n\nUse \`/queue join\` for ${weapon}!`)
        .setFooter({text:BOT_FOOTER})]});}catch(_){}
      return;
    }
    if(sub==='remove'){
      if(!player||!player.tiers?.[weapon])return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF9933).setDescription(`⚠️ **${player?.ign||target.username}** has no ${weapon} tier.`)]});
      const removed=player.tiers[weapon];
      LDB.delTier(target.id,weapon);
      broadcast({type:'tier_removed',discordId:target.id,ign:player.ign,weapon});
      await i.reply({embeds:[new EmbedBuilder().setColor(0xFF4444).setTitle('🗑️ Tier Removed')
        .addFields(
          {name:'Player',value:`**${player.ign}** (<@${target.id}>)`,inline:true},
          {name:'Weapon',value:`${WEAPON_EMOJI[weapon]} ${weapon}`,inline:true},
          {name:'Removed Tier',value:`\`${removed}\``,inline:true},
          {name:'Removed By',value:`<@${i.user.id}>`,inline:true},
        ).setTimestamp()]});
      await syncEmbed(i.client,player,weapon,'REMOVED',i.user.id);
    }
  },
};

CMDS.queue={
  data:new SlashCommandBuilder().setName('queue').setDescription('Queue commands for matchmaking')
    .addSubcommand(s=>s.setName('join').setDescription('Join the queue for a weapon')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon').setRequired(true)
        .addChoices(...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('leave').setDescription('Leave a queue (or all)')
      .addStringOption(o=>o.setName('weapon').setDescription('Weapon (omit = all)').setRequired(false)
        .addChoices({name:'🚫 Leave ALL',value:'all'},...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))))
    .addSubcommand(s=>s.setName('status').setDescription('Show current queue status')),
  async execute(i){
    const sub=i.options.getSubcommand();
    if(sub==='status'){
      const queues=LDB.allQ(),all=LDB.all();
      const fields=WEAPONS.map(w=>{
        const q=queues[w]||[];
        return{name:`${WEAPON_EMOJI[w]} ${w} — ${q.length}/2`,
          value:q.length?q.map((e,idx)=>`${idx+1}. **${all[e.discordId]?.ign||'Unknown'}** (<@${e.discordId}>)`).join('\n'):'*Empty*',inline:false};
      });
      return i.reply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🏆 Queue Status')
        .setDescription(`**${WEAPONS.reduce((s,w)=>s+(queues[w]?.length||0),0)}** players in queue`)
        .addFields(fields).setFooter({text:BOT_FOOTER}).setTimestamp()]});
    }
    if(sub==='leave'){
      const player=LDB.get(i.user.id);
      if(!player)return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Not registered. Use `/register` first.')]});
      const weapon=i.options.getString('weapon');
      if(!weapon||weapon==='all'){
        LDB.leaveAllQ(i.user.id);
        broadcast({type:'queue_updated',queues:MEM.queues});
        return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF9933).setDescription(`👋 **${player.ign}** left all queues.`)]});
      }
      LDB.leaveQ(i.user.id,weapon);
      broadcast({type:'queue_updated',queues:MEM.queues});
      return i.reply({ephemeral:true,embeds:[new EmbedBuilder().setColor(0xFF9933).setDescription(`👋 **${player.ign}** left ${WEAPON_EMOJI[weapon]} **${weapon}** queue.`)]});
    }
    if(sub==='join'){
      await i.deferReply({ephemeral:true});
      const weapon=i.options.getString('weapon');
      const player=LDB.get(i.user.id);
      if(!player)return i.editReply({embeds:[new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Not registered. Use `/register` first.')]});
      if(!player.tiers?.[weapon])return i.editReply({embeds:[new EmbedBuilder().setColor(0xFF4444)
        .setTitle('No Tier for this Weapon')
        .setDescription(`You don't have a **${weapon}** tier yet. A **Tierer** must evaluate you.`)
        .addFields({name:'Your Tiers',value:Object.keys(player.tiers||{}).length
          ?Object.entries(player.tiers).map(([w,t])=>`${WEAPON_EMOJI[w]} ${w}: \`${t}\``).join('\n'):'*None yet*'})]});
      const result=LDB.joinQ(i.user.id,weapon);
      if(!result.ok&&result.reason==='dupe')
        return i.editReply({embeds:[new EmbedBuilder().setColor(0xFF9933).setDescription(`⚠️ Already in ${WEAPON_EMOJI[weapon]} **${weapon}** queue.`)]});
      if(result.match){
        const [e1,e2]=result.match;
        const p1=LDB.get(e1.discordId),p2=LDB.get(e2.discordId);
        const match=LDB.addMatch(weapon,e1.discordId,e2.discordId);
        broadcast({type:'match_created',match:{...match,players:[{discordId:e1.discordId,ign:p1?.ign||'Unknown'},{discordId:e2.discordId,ign:p2?.ign||'Unknown'}]}});
        broadcast({type:'queue_updated',queues:MEM.queues});
        const matchEmbed=new EmbedBuilder().setColor(BRAND_COLOR)
          .setTitle(`${WEAPON_EMOJI[weapon]} Match Found! — ${weapon}`)
          .setDescription('A **1v1** match has been created!')
          .addFields(
            {name:'🔵 Player 1',value:`**${p1?.ign||'Unknown'}** (<@${e1.discordId}>)\nTier: \`${p1?.tiers?.[weapon]||'N/A'}\``,inline:true},
            {name:'🔴 Player 2',value:`**${p2?.ign||'Unknown'}** (<@${e2.discordId}>)\nTier: \`${p2?.tiers?.[weapon]||'N/A'}\``,inline:true},
            {name:'Match ID',value:`\`#${match.id}\``,inline:false},
          ).setTimestamp().setFooter({text:'PakTiers Matchmaking · Good luck! 🇵🇰'});
        if(CONFIG.MATCH_CHANNEL_ID){
          try{const ch=await i.client.channels.fetch(CONFIG.MATCH_CHANNEL_ID);
            if(ch)await ch.send({content:`<@${e1.discordId}> vs <@${e2.discordId}>`,embeds:[matchEmbed]});}catch(_){}
        }
        return i.editReply({embeds:[matchEmbed]});
      }
      broadcast({type:'queue_updated',queues:MEM.queues});
      const q=LDB.getQ(weapon);
      const pos=q.findIndex(e=>e.discordId===i.user.id)+1;
      return i.editReply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
        .setTitle(`${WEAPON_EMOJI[weapon]} Joined Queue — ${weapon}`)
        .addFields(
          {name:'Player',value:`**${player.ign}**`,inline:true},
          {name:'Your Tier',value:`\`${player.tiers[weapon]}\``,inline:true},
          {name:'Position',value:`**#${pos}** in queue`,inline:true},
          {name:'⏳ Status',value:'Waiting for 1 more player…'},
        ).setFooter({text:'Use /queue leave to exit · PakTiers'}).setTimestamp()]});
    }
  },
};

CMDS.leaderboard={
  data:new SlashCommandBuilder().setName('leaderboard').setDescription('View PakTiers leaderboard')
    .addStringOption(o=>o.setName('weapon').setDescription('Filter by weapon').setRequired(false)
      .addChoices({name:'🏆 All Weapons',value:'all'},...WEAPONS.map(w=>({name:`${WEAPON_EMOJI[w]} ${w}`,value:w})))),
  async execute(i){
    await i.deferReply();
    const weapon=i.options.getString('weapon')||'all';
    let ranked=Object.values(LDB.all()).filter(p=>Object.keys(p.tiers||{}).length>0);
    if(weapon!=='all'){
      ranked=ranked.filter(p=>p.tiers?.[weapon]).sort((a,b)=>(TIER_PTS[b.tiers[weapon]]||0)-(TIER_PTS[a.tiers[weapon]]||0));
    }else{
      ranked.sort((a,b)=>{
        const pa=Object.values(a.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        const pb=Object.values(b.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        return pb-pa;
      });
    }
    if(!ranked.length)return i.editReply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR).setDescription('No ranked players yet!')]});
    const medals=['🥇','🥈','🥉'];
    const rows=ranked.slice(0,10).map((p,idx)=>{
      const medal=medals[idx]||`**${idx+1}.**`;
      if(weapon==='all'){
        const pts=Object.values(p.tiers||{}).reduce((s,t)=>s+(TIER_PTS[t]||0),0);
        const rk=getRankTitle(pts);
        return`${medal} **${p.ign}** · ${Object.keys(p.tiers||{}).map(w=>WEAPON_EMOJI[w]).join('')}\n   ${rk.emoji} ${rk.label} · **${pts} pts**`;
      }
      return`${medal} **${p.ign}** · \`${p.tiers[weapon]}\` · ${TIER_PTS[p.tiers[weapon]]||0} pts`;
    });
    await i.editReply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR)
      .setTitle(weapon==='all'?'🏆 PakTiers — Overall Leaderboard':`${WEAPON_EMOJI[weapon]} PakTiers — ${weapon} Leaderboard`)
      .setDescription(rows.join('\n\n'))
      .addFields({name:'Total Ranked',value:`**${ranked.length}** players`,inline:true},{name:'Season',value:'**S1**',inline:true})
      .setFooter({text:BOT_FOOTER}).setTimestamp()]});
  },
};

CMDS.help={
  data:new SlashCommandBuilder().setName('help').setDescription('Show all PakTiers commands'),
  async execute(i){
    await i.reply({embeds:[new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🏆 PakTiers Bot — Commands')
      .setDescription("Pakistan's Minecraft Java PvP ranking system 🇵🇰")
      .addFields(
        {name:'👤 Player',value:'`/register <ign>` · `/profile [user]` · `/leaderboard [weapon]`'},
        {name:'⚔️ Queue', value:'`/queue join <weapon>` · `/queue leave [weapon]` · `/queue status`'},
        {name:'🛡️ Tierer',value:'`/tier set` · `/tier remove` · `/tier view` *(Tierer role required)*'},
        {name:'📊 Tiers', value:'`HT1 > LT1 > HT2 > LT2 > HT3 > LT3 > HT4 > LT4 > HT5 > LT5`'},
      ).setFooter({text:BOT_FOOTER})]});
  },
};

// ── DEPLOY + START ─────────────────────────────────────────────
async function deployCommands(){
  const rest=new REST({version:'10'}).setToken(CONFIG.BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID,CONFIG.GUILD_ID),
    {body:Object.values(CMDS).map(c=>c.data.toJSON())});
  console.log(`✅ Deployed ${Object.keys(CMDS).length} slash commands`);
}

const client=new Client({intents:[
  GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,GatewayIntentBits.MessageContent,
]});

client.once('ready',async()=>{
  console.log(`🤖 Bot online as ${client.user.tag}`);
  client.user.setPresence({activities:[{name:'⚔️ /queue join · PakTiers',type:0}],status:'online'});
  try{await deployCommands();}catch(e){console.error('Deploy error:',e);}
});

client.on('interactionCreate',async i=>{
  if(!i.isChatInputCommand())return;
  const cmd=CMDS[i.commandName]; if(!cmd)return;
  try{await cmd.execute(i);}catch(err){
    console.error(`[ERROR] /${i.commandName}:`,err);
    const e=new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Something went wrong.');
    if(i.replied||i.deferred)await i.followUp({embeds:[e],ephemeral:true}).catch(()=>{});
    else await i.reply({embeds:[e],ephemeral:true}).catch(()=>{});
  }
});

// ════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════
syncToMem();

server.listen(CONFIG.PORT,()=>{
  console.log(`🌐 Server running on port ${CONFIG.PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🔑 Secret: ${CONFIG.API_SECRET==='paktiers-secret-change-me'?'⚠️  DEFAULT':'Set ✓'}`);
});

if(CONFIG.BOT_TOKEN){
  client.login(CONFIG.BOT_TOKEN);
}else{
  console.warn('⚠️  BOT_TOKEN not set — bot wont start. Add it in Railway Variables.');
}
