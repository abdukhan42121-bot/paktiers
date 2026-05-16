// ============================================================
//  PakTiers — FIXED & OPTIMIZED VERSION
//  Discord Bot + API + Queue + Leaderboard
//  Fixed crashes, memory issues, fetch issues,
//  duplicate queue bugs, Railway issues, etc.
// ============================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { WebSocketServer } = require('ws');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActivityType,
} = require('discord.js');

// ============================================================
// CONFIG
// ============================================================

const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  API_SECRET: process.env.API_SECRET || 'paktiers-secret',

  CLIENT_ID: '1504744014526677003',
  GUILD_ID: '1478080380014952610',

  TIERER_ROLE_ID: '1504503176358006834',

  MATCH_CHANNEL_ID: '1504510227322503189',
  TIER_SYNC_CHANNEL_ID: '1504510227322503189',

  PORT: process.env.PORT || 3000,
};

if (!CONFIG.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN missing');
  process.exit(1);
}

// ============================================================
// EXPRESS + WS
// ============================================================

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
});

app.use(cors());
app.use(express.json());

app.get('/', (_, res) => {
  res.send('PakTiers API ONLINE');
});

// ============================================================
// DATABASE
// ============================================================

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const QUEUES_FILE = path.join(DATA_DIR, 'queues.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

function ensureFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
}

ensureFile(PLAYERS_FILE, {});
ensureFile(QUEUES_FILE, {
  Mace: [],
  Crystal: [],
  Sword: [],
  Axe: [],
  Netherite: [],
});
ensureFile(MATCHES_FILE, []);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const DB = {
  players: readJSON(PLAYERS_FILE),
  queues: readJSON(QUEUES_FILE),
  matches: readJSON(MATCHES_FILE),
};

function savePlayers() {
  writeJSON(PLAYERS_FILE, DB.players);
}

function saveQueues() {
  writeJSON(QUEUES_FILE, DB.queues);
}

function saveMatches() {
  writeJSON(MATCHES_FILE, DB.matches);
}

// ============================================================
// WEBSOCKET
// ============================================================

function broadcast(data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'init',
      data: DB,
    })
  );
});

// ============================================================
// CONSTANTS
// ============================================================

const WEAPONS = [
  'Mace',
  'Crystal',
  'Sword',
  'Axe',
  'Netherite',
];

const TIERS = [
  'HT1',
  'LT1',
  'HT2',
  'LT2',
  'HT3',
  'LT3',
  'HT4',
  'LT4',
  'HT5',
  'LT5',
];

const TIER_POINTS = {
  HT1: 10,
  LT1: 9,
  HT2: 8,
  LT2: 7,
  HT3: 6,
  LT3: 5,
  HT4: 4,
  LT4: 3,
  HT5: 2,
  LT5: 1,
};

const WEAPON_EMOJI = {
  Mace: ':mace:',
  Crystal: '::vanilla',
  Sword: '::sword',
  Axe: ':axe:',
  Netherite: ':netherite_helmet:',
};

function getRank(points) {
  if (points >= 100) return 'COMBAT ACE';
  if (points >= 50) return 'COMBAT SPECIALIST';
  if (points >= 25) return 'COMBAT CADET';

  return 'ROOKIE';
}

// ============================================================
// API
// ============================================================

function auth(req, res, next) {
  const secret = req.headers['x-api-secret'];

  if (secret !== CONFIG.API_SECRET) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  next();
}

app.get('/api/stats', (_, res) => {
  const players = Object.values(DB.players);

  const queued = Object.values(DB.queues).reduce(
    (a, b) => a + b.length,
    0
  );

  res.json({
    players: players.length,
    matches: DB.matches.length,
    queued,
  });
});

app.get('/api/leaderboard', (_, res) => {
  const players = Object.values(DB.players);

  const ranked = players
    .map((p) => {
      const pts = Object.values(p.tiers || {}).reduce(
        (a, b) => a + (TIER_POINTS[b] || 0),
        0
      );

      return {
        ...p,
        points: pts,
        rank: getRank(pts),
      };
    })
    .sort((a, b) => b.points - a.points);

  res.json(ranked);
});

// ============================================================
// DISCORD BOT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ============================================================
// COMMANDS
// ============================================================

const commands = [];

// REGISTER

commands.push(
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Minecraft IGN')
    .addStringOption((o) =>
      o
        .setName('ign')
        .setDescription('Minecraft username')
        .setRequired(true)
    )
);

// PROFILE

commands.push(
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile')
);

// LEADERBOARD

commands.push(
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View leaderboard')
);

// QUEUE

commands.push(
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Queue commands')

    .addSubcommand((s) =>
      s
        .setName('join')
        .setDescription('Join queue')
        .addStringOption((o) =>
          o
            .setName('weapon')
            .setDescription('Weapon')
            .setRequired(true)
            .addChoices(
              ...WEAPONS.map((w) => ({
                name: w,
                value: w,
              }))
            )
        )
    )

    .addSubcommand((s) =>
      s
        .setName('leave')
        .setDescription('Leave queue')
    )

    .addSubcommand((s) =>
      s
        .setName('status')
        .setDescription('Queue status')
    )
);

// TIER

commands.push(
  new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Tier management')

    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set tier')

        .addUserOption((o) =>
          o
            .setName('user')
            .setDescription('Target')
            .setRequired(true)
        )

        .addStringOption((o) =>
          o
            .setName('weapon')
            .setDescription('Weapon')
            .setRequired(true)
            .addChoices(
              ...WEAPONS.map((w) => ({
                name: w,
                value: w,
              }))
            )
        )

        .addStringOption((o) =>
          o
            .setName('tier')
            .setDescription('Tier')
            .setRequired(true)
            .addChoices(
              ...TIERS.map((t) => ({
                name: t,
                value: t,
              }))
            )
        )
    )
);

// ============================================================
// DEPLOY COMMANDS
// ============================================================

async function deployCommands() {
  const rest = new REST({
    version: '10',
  }).setToken(CONFIG.BOT_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      CONFIG.CLIENT_ID,
      CONFIG.GUILD_ID
    ),
    {
      body: commands.map((c) => c.toJSON()),
    }
  );

  console.log('✅ Slash commands deployed');
}

// ============================================================
// BOT READY
// ============================================================

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: '/queue join',
        type: ActivityType.Playing,
      },
    ],
    status: 'online',
  });

  await deployCommands();
});

// ============================================================
// INTERACTIONS
// ============================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // ========================================================
    // REGISTER
    // ========================================================

    if (interaction.commandName === 'register') {
      const ign = interaction.options.getString('ign');

      if (DB.players[interaction.user.id]) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Already registered',
        });
      }

      DB.players[interaction.user.id] = {
        discordId: interaction.user.id,
        ign,
        tiers: {},
        createdAt: Date.now(),
      };

      savePlayers();

      broadcast({
        type: 'register',
        player: DB.players[interaction.user.id],
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Registered')
            .setDescription(
              `IGN: **${ign}**`
            ),
        ],
      });
    }

    // ========================================================
    // PROFILE
    // ========================================================

    if (interaction.commandName === 'profile') {
      const player = DB.players[interaction.user.id];

      if (!player) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Not registered',
        });
      }

      const pts = Object.values(player.tiers).reduce(
        (a, b) => a + (TIER_POINTS[b] || 0),
        0
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle(player.ign)
            .setDescription(
              `🏆 ${getRank(pts)}\n⭐ ${pts} points`
            ),
        ],
      });
    }

    // ========================================================
    // LEADERBOARD
    // ========================================================

    if (interaction.commandName === 'leaderboard') {
      const players = Object.values(DB.players)
        .map((p) => ({
          ...p,
          points: Object.values(p.tiers).reduce(
            (a, b) => a + (TIER_POINTS[b] || 0),
            0
          ),
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

      const text = players
        .map(
          (p, i) =>
            `**${i + 1}. ${p.ign}** — ${p.points} pts`
        )
        .join('\n');

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🏆 Leaderboard')
            .setDescription(text || 'No players'),
        ],
      });
    }

    // ========================================================
    // QUEUE
    // ========================================================

    if (interaction.commandName === 'queue') {
      const sub = interaction.options.getSubcommand();

      const player = DB.players[interaction.user.id];

      if (!player) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Register first',
        });
      }

      // JOIN

      if (sub === 'join') {
        const weapon =
          interaction.options.getString('weapon');

        const queue = DB.queues[weapon];

        if (
          queue.find(
            (x) => x.discordId === interaction.user.id
          )
        ) {
          return interaction.reply({
            ephemeral: true,
            content: '❌ Already in queue',
          });
        }

        queue.push({
          discordId: interaction.user.id,
          ign: player.ign,
        });

        saveQueues();

        // MATCH FOUND

        if (queue.length >= 2) {
          const p1 = queue.shift();
          const p2 = queue.shift();

          const match = {
            id: Date.now(),
            weapon,
            players: [p1, p2],
          };

          DB.matches.push(match);

          saveQueues();
          saveMatches();

          broadcast({
            type: 'match',
            match,
          });

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('⚔ Match Found')
                .setDescription(
                  `${p1.ign} vs ${p2.ign}`
                ),
            ],
          });
        }

        return interaction.reply({
          content: `✅ Joined ${weapon} queue`,
        });
      }

      // LEAVE

      if (sub === 'leave') {
        for (const weapon of WEAPONS) {
          DB.queues[weapon] = DB.queues[
            weapon
          ].filter(
            (x) =>
              x.discordId !== interaction.user.id
          );
        }

        saveQueues();

        return interaction.reply({
          content: '✅ Left queues',
        });
      }

      // STATUS

      if (sub === 'status') {
        const text = WEAPONS.map(
          (w) =>
            `${WEAPON_EMOJI[w]} ${w}: ${DB.queues[w].length}/2`
        ).join('\n');

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00ffff)
              .setTitle('📊 Queue Status')
              .setDescription(text),
          ],
        });
      }
    }

    // ========================================================
    // TIER
    // ========================================================

    if (interaction.commandName === 'tier') {
      const member = interaction.member;

      const allowed =
        member.permissions.has(
          PermissionFlagsBits.Administrator
        ) ||
        member.roles.cache.has(
          CONFIG.TIERER_ROLE_ID
        );

      if (!allowed) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ No permission',
        });
      }

      const sub =
        interaction.options.getSubcommand();

      if (sub === 'set') {
        const target =
          interaction.options.getUser('user');

        const weapon =
          interaction.options.getString('weapon');

        const tier =
          interaction.options.getString('tier');

        const player = DB.players[target.id];

        if (!player) {
          return interaction.reply({
            ephemeral: true,
            content: '❌ User not registered',
          });
        }

        player.tiers[weapon] = tier;

        savePlayers();

        broadcast({
          type: 'tier',
          player,
        });

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('✅ Tier Set')
              .setDescription(
                `${player.ign}\n${weapon}: ${tier}`
              ),
          ],
        });
      }
    }
  } catch (err) {
    console.error(err);

    if (interaction.deferred || interaction.replied) {
      interaction.followUp({
        ephemeral: true,
        content: '❌ Error occurred',
      });
    } else {
      interaction.reply({
        ephemeral: true,
        content: '❌ Error occurred',
      });
    }
  }
});

// ============================================================
// START
// ============================================================

server.listen(CONFIG.PORT, () => {
  console.log(
    `🌐 Server running on ${CONFIG.PORT}`
  );
});

client.login(CONFIG.BOT_TOKEN);