import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar, Avatar, Alert, Autocomplete, Badge, Box, Button, Card, CardContent,
  Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControl, IconButton, InputAdornment, InputLabel,
  LinearProgress, Menu, MenuItem, Pagination, Paper, Select, Skeleton,
  Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Tab, TextField, Toolbar, Tooltip, Typography, useMediaQuery
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardCommandKeyRoundedIcon from '@mui/icons-material/KeyboardCommandKeyRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import { apiGet, useApiResource } from './api.js';

const DISCORD_INVITE = 'https://discord.gg/ZRqHVHWfZY';
const GAMEMODES = [
  { key: 'all', label: 'Overall', file: null },
  { key: 'Sword', label: 'Sword', file: 'Sword.png' },
  { key: 'Axe', label: 'Axe', file: 'Axe.png' },
  { key: 'Mace', label: 'Mace', file: 'Mace.png' },
  { key: 'Crystal', label: 'Crystal', file: 'Crystal.png' },
  { key: 'Netherite', label: 'NethOP', file: 'Netherite.png' },
  { key: 'UHC', label: 'UHC', file: 'UHC.png' },
  { key: 'Pot', label: 'Pot', file: 'Pot.png' },
  { key: 'SMP', label: 'SMP', file: 'SMP.png' },
  { key: 'DiaSMP', label: 'DiaSMP', file: 'Diasmp.png' },
  { key: 'SpearMace', label: 'SpearMace', file: 'SpearMace.png' },
  { key: 'Cart', label: 'Cart', file: 'Cart.png' }
];
const TIER_ORDER = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5'];
const TIER_COLOURS = {
  HT1: '#ff674f', LT1: '#e98258', HT2: '#f0bb56', LT2: '#d5b85e',
  HT3: '#62c98e', LT3: '#54ae85', HT4: '#68bde2', LT4: '#599fc5',
  HT5: '#a9a9b3', LT5: '#777985'
};
const tierSort = (tier) => TIER_ORDER.indexOf(String(tier || '').replace(/^R/, ''));
const safeName = (value) => String(value || '').trim();
const getTiers = (player) => player?.tiers && typeof player.tiers === 'object' ? player.tiers : {};
const getTotalPoints = (player) => Number(player?.totalPts ?? Object.values(getTiers(player)).reduce((sum, tier) => sum + ({ HT1:60, LT1:45, HT2:30, LT2:20, HT3:10, LT3:6, HT4:4, LT4:3, HT5:2, LT5:1 }[tier] || 0), 0));
const REGION_CODES = ['ME', 'AS', 'AU', 'EU', 'NA', 'SA'];
const normalizeRegion = (value) => {
  const raw = String(value || '').trim();
  const code = raw.toUpperCase().replace(/[^A-Z/]/g, '');
  if (REGION_CODES.includes(code)) return code;
  const lower = raw.toLowerCase().replace(/[🇵🇰🇮🇳🇦🇪🇸🇦🇬🇧🇺🇸🌏🌎🌍]/gu, '').trim();
  const aliases = {
    'middle east':'ME','mena':'ME','uae':'ME','united arab emirates':'ME','saudi arabia':'ME','ksa':'ME','qatar':'ME','kuwait':'ME','bahrain':'ME','oman':'ME',
    'asia':'AS','pakistan':'AS','pk':'AS','india':'AS','in':'AS','bangladesh':'AS','nepal':'AS','sri lanka':'AS','china':'AS','japan':'AS','singapore':'AS','as/au':'AS',
    'oceania':'AU','australia':'AU','new zealand':'AU','europe':'EU','united kingdom':'EU','uk':'EU','gb':'EU',
    'north america':'NA','united states':'NA','usa':'NA','us':'NA','canada':'NA','mexico':'NA',
    'south america':'SA','brazil':'SA','argentina':'SA','chile':'SA','peru':'SA'
  };
  if (aliases[lower]) return aliases[lower];
  for (const [name, region] of Object.entries(aliases)) if (name.length > 2 && lower.includes(name)) return region;
  return '—';
};
const getRegion = (player) => normalizeRegion(player?.region);
const getAvatar = (player) => player?.avatar || `https://mc-heads.net/avatar/${encodeURIComponent(player?.ign || 'Steve')}/64`;
const formatNumber = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US').format(Number(value)) : '—';
const formatDate = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(Number(value) || value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const formatDateTime = (value) => {
  if (value === null || value === undefined || value === '') return 'Date unavailable';
  let stamp = value;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) {
    stamp = Number(value);
    if (stamp > 0 && stamp < 100000000000) stamp *= 1000; // accept Unix seconds and milliseconds
  }
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const formatElapsed = (value, now = Date.now()) => {
  const stamp = Number(value || 0);
  if (!stamp || !Number.isFinite(stamp)) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor((now - stamp) / 60000));
  if (minutes < 1) return 'Just joined';
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m waiting`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h waiting`;
};
const gamemodeOf = (key) => GAMEMODES.find((mode) => mode.key === key) || { key, label: key, file: null };

function useRoute() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const update = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = (to) => {
    if (!to) return;
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return { path, navigate };
}

function playClick(enabled) {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.045);
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.06);
    oscillator.onended = () => context.close();
  } catch (_) { /* Browser may disable audio. */ }
}

function useStoredToggle(key, initial = false) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) === 'true'; } catch (_) { return initial; }
  });
  const update = (next) => {
    setValue(next);
    try { localStorage.setItem(key, String(next)); } catch (_) {}
  };
  return [value, update];
}

function App() {
  const { path, navigate } = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [soundEnabled, setSoundEnabled] = useStoredToggle('eclipsetiers:sound', false);
  const [snack, setSnack] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { data: stats } = useApiResource('/api/stats', 30000);
  const { data: testerData } = useApiResource('/api/testers', 60000);
  const [leaderboard] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      if ((event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault(); setSearchOpen(true);
      }
      if (event.key === 'Escape') { setSearchOpen(false); setSelectedPlayer(null); setDrawerOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const parsed = useMemo(() => {
    const url = new URL(path, window.location.origin);
    const playerMatch = url.pathname.match(/^\/player\/([^/]+)\/?$/i);
    return { pathname: url.pathname, search: url.searchParams, player: playerMatch ? decodeURIComponent(playerMatch[1]) : null };
  }, [path]);
  const route = parsed.player ? 'player' : parsed.pathname.replace(/\/$/, '') || '/';

  const nav = (to) => { playClick(soundEnabled); navigate(to); setDrawerOpen(false); };
  const openPlayer = (player) => { if (!player?.ign) return; setSelectedPlayer(player); };
  const closePlayer = () => setSelectedPlayer(null);
  const toast = (message) => setSnack(message);

  let content;
  if (route === '/' || route === '/home') content = <HomePage navigate={nav} openPlayer={openPlayer} stats={stats} testerData={testerData} />;
  else if (route === '/rankings') content = <RankingsPage openPlayer={openPlayer} />;
  else if (route === '/queue') content = <QueuePage />;
  else if (route === '/compare') content = <ComparePage initialLeft={parsed.search.get('left') || ''} initialRight={parsed.search.get('right') || ''} />;
  else if (route === '/testers') content = <TestersPage testerData={testerData} />;
  else if (route === '/history') content = <ActivityHistoryPage />;
  else if (route === '/tiertagger') content = <TierTaggerPage />;
  else if (route === 'player') content = <PlayerPage ign={parsed.player} openPlayer={openPlayer} />;
  else content = <NotFound navigate={nav} />;

  return <Box className="app-shell">
    <AppBar className="topbar" position="sticky" elevation={0}>
      <Toolbar className="topbar-inner">
        <Box className="brand-lockup" onClick={() => nav('/home')} role="button" tabIndex={0}>
          <img src="/brand/logo.png" alt="EclipseTiers" />
          <Box><Typography className="brand-name">ECLIPSETIERS</Typography><Typography className="brand-sub">GLOBAL RANKINGS</Typography></Box>
        </Box>
        <Box className="desktop-nav">
          <NavButton active={route === '/' || route === '/home'} onClick={() => nav('/home')}>Home</NavButton>
          <NavButton active={route === '/rankings'} onClick={() => nav('/rankings')}>Rankings</NavButton>
          <NavButton active={route === '/compare'} onClick={() => nav('/compare')}>Compare</NavButton>
          <NavButton active={route === '/tiertagger'} onClick={() => nav('/tiertagger')}>TierTagger</NavButton>
          <NavButton active={route === '/testers'} onClick={() => nav('/testers')}>Testers</NavButton>
          <NavButton active={route === '/history'} onClick={() => nav('/history')}>History</NavButton>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button className="search-shortcut" onClick={() => setSearchOpen(true)} startIcon={<SearchRoundedIcon />} endIcon={<Chip size="small" label="/" variant="outlined" />}>Search</Button>
          <Tooltip title="Preferences"><IconButton className="icon-button" onClick={(event) => setSettingsAnchor(event.currentTarget)}><TuneRoundedIcon /></IconButton></Tooltip>
          <Button className="discord-button" component="a" href={DISCORD_INVITE} target="_blank" rel="noreferrer" endIcon={<ArrowOutwardRoundedIcon />}>Discord</Button>
          <IconButton className="mobile-menu" onClick={() => setDrawerOpen(true)}><MenuRoundedIcon /></IconButton>
        </Stack>
      </Toolbar>
    </AppBar>

    <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ className: 'mobile-drawer' }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography fontWeight={850} letterSpacing={1.5}>ECLIPSETIERS</Typography><IconButton onClick={() => setDrawerOpen(false)}><CloseRoundedIcon /></IconButton>
        </Stack>
        {[
          ['/home', 'Home'], ['/rankings', 'Rankings'], ['/queue', 'Queue'], ['/compare', 'Compare'], ['/tiertagger', 'TierTagger'], ['/testers', 'Testers'], ['/history', 'History']
        ].map(([to, label]) => <Button key={to} fullWidth className="drawer-link" onClick={() => nav(to)}>{label}</Button>)}
        <Button fullWidth sx={{ mt: 2 }} component="a" href={DISCORD_INVITE} target="_blank" variant="contained">Join Discord</Button>
      </Box>
    </Drawer>

    <Menu anchorEl={settingsAnchor} open={Boolean(settingsAnchor)} onClose={() => setSettingsAnchor(null)} PaperProps={{ className: 'settings-menu' }}>
      <MenuItem onClick={() => { const next = !soundEnabled; setSoundEnabled(next); playClick(next); }}>
        {soundEnabled ? <VolumeUpRoundedIcon sx={{ mr: 1.2 }} /> : <VolumeOffRoundedIcon sx={{ mr: 1.2 }} />}
        UI sounds {soundEnabled ? 'on' : 'off'}
      </MenuItem>
      <MenuItem onClick={() => { document.documentElement.classList.toggle('reduce-motion'); setSettingsAnchor(null); }}>
        <AccessTimeRoundedIcon sx={{ mr: 1.2 }} /> Toggle reduced motion
      </MenuItem>
    </Menu>

    <Box component="main" className="main-content">
      <RouteErrorBoundary key={path} route={parsed.pathname}>{content}</RouteErrorBoundary>
    </Box>
    <Footer navigate={nav} />

    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} openPlayer={(player) => { setSearchOpen(false); openPlayer(player); }} navigate={nav} />
    <PlayerDialog player={selectedPlayer} onClose={closePlayer} navigate={nav} toast={toast} />
    <Snackbar open={Boolean(snack)} autoHideDuration={2600} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
  </Box>;
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep the full diagnostic in the browser console without exposing internals
    // to public visitors. The fallback below preserves access to navigation.
    console.error(`[EclipseTiers] Failed to render route ${this.props.route}:`, error, info?.componentStack || '');
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <Container maxWidth="md" className="page-container route-error-container">
      <Paper className="route-error-panel" elevation={0}>
        <Box className="route-error-icon"><InfoOutlinedIcon /></Box>
        <Typography className="eyebrow">SECTION RECOVERY</Typography>
        <Typography variant="h4" fontWeight={850}>This section hit a display error.</Typography>
        <Typography color="text.secondary">Your player data has not been changed. Reload this section or return to the homepage.</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
          <Button variant="contained" onClick={() => window.location.reload()}>Reload section</Button>
          <Button variant="outlined" component="a" href="/home">Return home</Button>
        </Stack>
      </Paper>
    </Container>;
  }
}

function NavButton({ children, active, onClick }) {
  return <Button onClick={onClick} className={`nav-button ${active ? 'active' : ''}`}>{children}</Button>;
}

function SectionHeading({ eyebrow, title, subtitle, action }) {
  return <Stack className="section-heading" direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} justifyContent="space-between" spacing={2}>
    <Box><Typography className="eyebrow">{eyebrow}</Typography><Typography variant="h4" className="section-title">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: .8, maxWidth: 660 }}>{subtitle}</Typography>}</Box>
    {action}
  </Stack>;
}

function StatusStrip({ stale, error, updatedAt }) {
  if (!stale && !error) return null;
  return <Alert className="status-alert" severity={stale ? 'warning' : 'error'} icon={stale ? <WifiOffRoundedIcon /> : <InfoOutlinedIcon />}>
    {stale ? 'Showing cached information. Live refresh is temporarily unavailable.' : 'Live data is currently unavailable. Cached results will appear when available.'}
    {updatedAt && ` Last successful update: ${new Date(updatedAt).toLocaleTimeString()}.`}
  </Alert>;
}

function StatCard({ label, value, icon, note }) {
  return <Card className="stat-card"><CardContent>
    <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="stat-label">{label}</Typography><Box className="stat-icon">{icon}</Box></Stack>
    <Typography variant="h4" className="stat-value">{value == null ? '—' : (typeof value === 'string' && value.trim() && Number.isNaN(Number(value)) ? value : formatNumber(value))}</Typography>
    <Typography className="stat-note">{note}</Typography>
  </CardContent></Card>;
}

function HomePage({ navigate, openPlayer, stats, testerData }) {
  const { data: leaderboardData, loading, error, stale, updatedAt } = useApiResource('/api/leaderboard?weapon=all', 30000);
  const players = Array.isArray(leaderboardData?.players) ? leaderboardData.players : [];
  const top = players.slice(0, 3);
  const testerStats = testerData?.dashboard || {};
  return <>
    <Container maxWidth="xl" className="page-container home-container">
      <Box className="hero-panel">
        <Box className="hero-copy">
          <Chip className="hero-kicker" icon={<span className="live-dot" />} label="THE GLOBAL MINECRAFT TIER NETWORK" />
          <Typography variant="h1" className="hero-title">The Standard of <Box component="span">Competitive Minecraft.</Box></Typography>
          <Typography className="hero-description">A home for ranked players, trusted testers and the competitive Minecraft community. Explore the rankings, compare tiers and track the people shaping the scene.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.3} className="hero-actions">
            <Button variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/rankings')}>View Rankings</Button>
            <Button className="hero-secondary" size="large" component="a" href={DISCORD_INVITE} target="_blank" endIcon={<ArrowOutwardRoundedIcon />}>Join Discord</Button>
            <Button className="hero-download" size="large" onClick={() => navigate('/tiertagger')} startIcon={<DownloadRoundedIcon />}>Download TierTagger</Button>
          </Stack>
          <Box className="hero-footnote"><ShieldRoundedIcon /><Typography>Community-driven rankings. Real player data. No fabricated stats.</Typography></Box>
        </Box>
        <Box className="hero-art-wrap"><Box className="hero-art-glow" /><img className="hero-art" src="/brand/hero-art.png" alt="EclipseTiers Minecraft tier artwork" /></Box>
        <Box className="hero-watermark">ET</Box>
      </Box>
      <StatusStrip stale={stale} error={error} updatedAt={updatedAt} />

      <Box className="stats-grid">
        <StatCard label="Total Registrations" value={stats?.totalPlayers} icon={<GroupsRoundedIcon />} note="Registered community players" />
        <StatCard label="Ranked Players" value={stats?.tieredPlayers} icon={<MilitaryTechRoundedIcon />} note="Players with at least one tier" />
        <StatCard label="Available Gamemodes" value={GAMEMODES.length - 1} icon={<SportsEsportsRoundedIcon />} note="Active ranking categories" />
        <StatCard label="Active Testers" value={testerStats.activeTesters} icon={<ShieldRoundedIcon />} note="Current tester directory" />
        <StatCard label="Tests This Month" value={testerStats.totalTestsThisMonth} icon={<StarRoundedIcon />} note="Recorded monthly test logs" />
      </Box>

      <Box className="home-section">
        <SectionHeading eyebrow="THE TOP THREE" title="Leading the rankings" subtitle="The current highest-ranked players, based on the existing EclipseTiers point system." action={<Button endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/rankings')}>Full leaderboard</Button>} />
        <Box className="podium-grid">
          <PodiumCard player={top[1]} place={2} loading={loading && !players.length} onClick={openPlayer} />
          <PodiumCard player={top[0]} place={1} featured loading={loading && !players.length} onClick={openPlayer} />
          <PodiumCard player={top[2]} place={3} loading={loading && !players.length} onClick={openPlayer} />
        </Box>
        {!loading && !players.length && <EmptyState title="No ranked players yet" detail="Ranked players will appear here once the public leaderboard contains tiered players." actionLabel="Visit Discord" actionHref={DISCORD_INVITE} />}
      </Box>

      <Box className="home-section">
        <SectionHeading eyebrow="EXPLORE THE NETWORK" title="Choose your gamemode" subtitle="Open a gamemode to view its dedicated ranking table and tier distribution." action={<Button endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/rankings')}>All rankings</Button>} />
        <Box className="mode-card-grid">
          {GAMEMODES.filter(mode => mode.key !== 'all').map(mode => <GamemodeCard key={mode.key} mode={mode} players={players} onClick={() => navigate(`/rankings?mode=${encodeURIComponent(mode.key)}`)} />)}
        </Box>
      </Box>

      <Box className="home-bottom-grid">
        <Card className="feature-card community-card"><CardContent>
          <Box className="feature-icon crimson"><ForumRoundedIcon /></Box><Typography variant="h5">Join the community</Typography>
          <Typography color="text.secondary">Meet other players, follow announcements and find out how to get tested and ranked.</Typography>
          <Button component="a" href={DISCORD_INVITE} target="_blank" endIcon={<ArrowOutwardRoundedIcon />} sx={{ mt: 2 }}>Open Discord</Button>
        </CardContent></Card>
        <Card className="feature-card tagger-card"><CardContent>
          <Box className="feature-icon gold"><DownloadRoundedIcon /></Box><Typography variant="h5">Bring tiers in-game</Typography>
          <Typography color="text.secondary">Use EclipseTiers TierTagger to view supported tier information directly in Minecraft.</Typography>
          <Button onClick={() => navigate('/tiertagger')} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2 }}>Explore TierTagger</Button>
        </CardContent></Card>
        <Card className="feature-card compare-card"><CardContent>
          <Box className="feature-icon silver"><CompareArrowsRoundedIcon /></Box><Typography variant="h5">Compare players</Typography>
          <Typography color="text.secondary">Compare overall points, gamemode tiers and each player's current position.</Typography>
          <Button onClick={() => navigate('/compare')} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2 }}>Open comparison</Button>
        </CardContent></Card>
        <Card className="feature-card history-feature-card"><CardContent>
          <Box className="feature-icon gold"><HistoryRoundedIcon /></Box><Typography variant="h5">Follow the history</Typography>
          <Typography color="text.secondary">Explore recorded tier updates, archived match records and live queue activity.</Typography>
          <Button onClick={() => navigate('/history')} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2 }}>Open activity history</Button>
        </CardContent></Card>
      </Box>
    </Container>
  </>;
}

function PodiumCard({ player, place, featured, loading, onClick }) {
  const medal = place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze';
  if (loading) return <Card className={`podium-card ${featured ? 'featured' : ''}`}><CardContent><Skeleton variant="circular" width={68} height={68} sx={{ mx: 'auto', mb: 2 }} /><Skeleton width="50%" sx={{ mx: 'auto' }} /><Skeleton width="30%" sx={{ mx: 'auto' }} /></CardContent></Card>;
  if (!player) return <Card className={`podium-card ${featured ? 'featured' : ''} podium-empty`}><CardContent><Typography className={`podium-place ${medal}`}>0{place}</Typography><Typography color="text.secondary">Awaiting player</Typography></CardContent></Card>;
  return <Card className={`podium-card ${featured ? 'featured' : ''} ${medal}`} onClick={() => onClick({ ...player, overallRank: place, selectedMode: 'all' })}>
    <CardContent><Box className={`podium-place ${medal}`}>{place === 1 ? '01' : `0${place}`}</Box><Avatar src={getAvatar(player)} alt={player.ign} className="podium-avatar" />
      <Typography className="podium-name">{player.ign}</Typography><Typography className="podium-region">{getRegion(player)}</Typography>
      <Typography className="podium-points">{formatNumber(getTotalPoints(player))} <span>PTS</span></Typography>
      <Stack direction="row" justifyContent="center" flexWrap="wrap" spacing={.6} sx={{ mt: 1 }}>{Object.entries(getTiers(player)).slice(0, 3).map(([key, tier]) => <TierBadge key={key} tier={tier} label={gamemodeOf(key).label} />)}</Stack>
    </CardContent>
  </Card>;
}

function GamemodeCard({ mode, players, onClick }) {
  const count = players.filter(p => Boolean(getTiers(p)[mode.key])).length;
  const top = players.filter(p => Boolean(getTiers(p)[mode.key])).sort((a, b) => tierSort(getTiers(a)[mode.key]) - tierSort(getTiers(b)[mode.key])).slice(0, 3);
  return <Card className="mode-card" onClick={onClick}>
    <CardContent>
      <Stack direction="row" alignItems="center" justifyContent="space-between"><Box className="mode-icon-box">{mode.file ? <img src={`/gamemodes/${mode.file}`} alt="" /> : <LeaderboardRoundedIcon />}</Box><ArrowOutwardRoundedIcon className="mode-arrow" /></Stack>
      <Typography className="mode-name">{mode.label}</Typography><Typography className="mode-count">{formatNumber(count)} ranked players</Typography>
      <Stack direction="row" spacing={-.6} className="mode-avatars">{top.map(p => <Tooltip key={p.ign} title={p.ign}><Avatar src={getAvatar(p)} /></Tooltip>)}{!top.length && <Typography color="text.secondary" fontSize={12}>No rankings yet</Typography>}</Stack>
      <Divider sx={{ my: 1.6 }} /><Typography className="mode-link">View leaderboard <ArrowForwardRoundedIcon /></Typography>
    </CardContent>
  </Card>;
}

function RankingsPage({ openPlayer }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('mode') || 'all');
  const url = `/api/leaderboard?weapon=${encodeURIComponent(mode)}`;
  const { data, loading, error, stale, updatedAt, resourceKey } = useApiResource(url, 20000);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [tier, setTier] = useState('all');
  const [sort, setSort] = useState('rank');
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery('(max-width:800px)');
  useEffect(() => { setPage(1); }, [mode, query, region, tier, sort]);

  const dataMatchesMode = resourceKey === url;
  const rawPlayers = dataMatchesMode && Array.isArray(data?.players) ? data.players : [];
  // The API already returns the authoritative order for each requested mode.
  // Keep this order as originalRank and never re-calculate tier ranking values here.
  const ranked = rawPlayers.map((player, index) => ({ ...player, originalRank: index + 1 }));
  const filtered = useMemo(() => {
    let items = ranked.filter(player => {
      const matchesName = !query || String(player.ign || '').toLowerCase().includes(query.trim().toLowerCase());
      const matchesRegion = region === 'all' || normalizeRegion(player.region) === region;
      const tiers = getTiers(player);
      const activeTier = (mode === 'all' ? Object.values(tiers) : [getTierForMode(player, gamemodeOf(mode))]).map(value => String(value || '').replace(/^R/, ''));
      const matchesTier = tier === 'all' || activeTier.includes(tier);
      return matchesName && matchesRegion && matchesTier;
    });
    if (sort === 'points') items = [...items].sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    if (sort === 'name') items = [...items].sort((a, b) => String(a.ign).localeCompare(String(b.ign)));
    return items;
  }, [ranked, query, region, tier, sort, mode]);

  const pageSize = 100;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const regions = REGION_CODES;
  const activeMode = gamemodeOf(mode);

  const selectMode = (item) => {
    setMode(item.key);
    const next = new URL(window.location.href);
    if (item.key === 'all') next.searchParams.delete('mode');
    else next.searchParams.set('mode', item.key);
    window.history.replaceState({}, '', next);
  };

  return <Container maxWidth="xl" className="page-container">
    <PageBanner eyebrow="THE GLOBAL LADDER" title="Player rankings" subtitle="Explore the current EclipseTiers leaderboard, filter by region and tier, or open a player profile." />
    <StatusStrip stale={stale} error={error} updatedAt={updatedAt} />
    <Paper className="ranking-panel">
      <Box className="mode-tabs-wrap">
        <Box className="mode-tabs">
          {GAMEMODES.map(item => <Button key={item.key} className={`mode-tab ${mode === item.key ? 'active' : ''}`} onClick={() => selectMode(item)}>
            {item.file && <img src={`/gamemodes/${item.file}`} alt="" />}{item.label}
          </Button>)}
        </Box>
      </Box>
      <Box className="ranking-toolbar">
        <TextField size="small" placeholder="Search player IGN..." value={query} onChange={e => setQuery(e.target.value)} className="ranking-search" InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />
        <FormControl size="small" className="filter-select"><InputLabel>Region</InputLabel><Select label="Region" value={region} onChange={e => setRegion(e.target.value)}><MenuItem value="all">All regions</MenuItem>{regions.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" className="filter-select"><InputLabel>Tier</InputLabel><Select label="Tier" value={tier} onChange={e => setTier(e.target.value)}><MenuItem value="all">All tiers</MenuItem>{TIER_ORDER.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" className="filter-select sort-select"><InputLabel>Sort</InputLabel><Select label="Sort" value={sort} onChange={e => setSort(e.target.value)}><MenuItem value="rank">Original rank</MenuItem><MenuItem value="points">Points</MenuItem><MenuItem value="name">Player name</MenuItem></Select></FormControl>
      </Box>

      {mode !== 'all' ? <GamemodeLeaderboardView
        mode={activeMode}
        players={filtered}
        loading={!dataMatchesMode || (loading && !ranked.length)}
        failed={Boolean(error && dataMatchesMode && !ranked.length)}
        openPlayer={openPlayer}
      /> : <>
        <Box className="table-summary"><Typography>{formatNumber(filtered.length)} players found</Typography><Typography>Showing up to 100 per page</Typography></Box>
        {isMobile ? <Box className="classic-mobile-ranking-list">
          {(!dataMatchesMode || (loading && !ranked.length)) ? <EclipseLoadingScreen compact label="Loading overall rankings" /> : visible.map(player => <Paper
            key={player.ign}
            className="classic-mobile-player-card"
            onClick={() => openPlayer({ ...player, overallRank: player.originalRank, selectedMode: mode })}
            role="button"
            tabIndex={0}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPlayer({ ...player, overallRank: player.originalRank, selectedMode: mode }); } }}
            elevation={0}
          >
            <Box className="classic-mobile-player-top">
              <ClassicRankBadge rank={player.originalRank} />
              <ClassicPlayerIdentity player={player} compact />
              <ClassicPointsValue value={getTotalPoints(player)} compact />
            </Box>
            <Box className="classic-mobile-player-meta">
              <ClassicRegionPill region={getRegion(player)} />
              <Typography>{getAssignedModeCount(player)} / {GAMEMODES.length - 1} tiers</Typography>
            </Box>
            <ClassicTierStrip player={player} compact />
          </Paper>)}
          {dataMatchesMode && !loading && !visible.length && <EmptyState title={ranked.length ? 'No players match these filters' : 'No ranked players yet'} detail={ranked.length ? 'Try a different player name, region or tier.' : 'Once players receive a tier, their rankings will appear here.'} />}
        </Box> : <TableContainer className="leaderboard-table-wrap classic-leaderboard-wrap">
          <Table size="medium" stickyHeader className="leaderboard-table classic-leaderboard-table">
            <TableHead><TableRow>
              <TableCell width="76">#</TableCell>
              <TableCell width="260">Player</TableCell>
              <TableCell width="145">Region</TableCell>
              <TableCell width="520"><Stack direction="row" spacing={1} alignItems="baseline"><Typography component="span" fontSize="inherit" fontWeight={800}>Gamemode tiers</Typography><Typography component="span" className="table-player-caption">All 11 modes</Typography></Stack></TableCell>
              <TableCell width="116" align="right">Points</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(!dataMatchesMode || (loading && !ranked.length)) ? <TableRow><TableCell colSpan={5}><EclipseLoadingScreen compact label="Loading overall rankings" /></TableCell></TableRow> : visible.map(player => <TableRow
                key={player.ign}
                hover
                className="player-row classic-player-row"
                onClick={() => openPlayer({ ...player, overallRank: player.originalRank, selectedMode: mode })}
                tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPlayer({ ...player, overallRank: player.originalRank, selectedMode: mode }); } }}
              >
                <TableCell className="classic-rank-cell"><ClassicRankBadge rank={player.originalRank} /></TableCell>
                <TableCell className="classic-player-cell"><ClassicPlayerIdentity player={player} /></TableCell>
                <TableCell className="classic-region-cell"><ClassicRegionPill region={getRegion(player)} /></TableCell>
                <TableCell className="classic-tiers-cell"><ClassicTierStrip player={player} /></TableCell>
                <TableCell align="right" className="classic-points-cell"><ClassicPointsValue value={getTotalPoints(player)} /></TableCell>
              </TableRow>)}
              {dataMatchesMode && !loading && !visible.length && <TableRow><TableCell colSpan={5}><EmptyState title={ranked.length ? 'No players match these filters' : 'No ranked players yet'} detail={ranked.length ? 'Try a different player name, region or tier.' : 'Once players receive a tier, their rankings will appear here.'} /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>}
        <Box className="table-pagination"><Typography color="text.secondary">Page {page} of {pages}</Typography><Pagination page={page} count={pages} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" /></Box>
      </>}
    </Paper>
  </Container>;
}

function EclipseLoadingScreen({ label = 'Loading rankings', compact = false }) {
  return <Box className={`eclipse-loading-screen ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
    <Box className="eclipse-loader-mark"><span className="eclipse-loader-orbit" /><img src="/brand/logo.png" alt="" /></Box>
    <Typography className="eclipse-loading-title">{label}</Typography>
    <Typography className="eclipse-loading-subtitle">Synchronizing the EclipseTiers ladder</Typography>
    <LinearProgress className="eclipse-loading-progress" />
    <Box className="eclipse-loading-bars"><span /><span /><span /></Box>
  </Box>;
}

function GamemodeLeaderboardView({ mode, players, loading, failed, openPlayer }) {
  const groups = [1, 2, 3, 4, 5].map(level => ({
    level,
    players: players.filter(player => {
      const assigned = getTierForMode(player, mode);
      const match = String(assigned || '').match(/[1-5]/);
      return match ? Number(match[0]) === level : false;
    })
  }));
  const total = players.length;

  if (loading) return <EclipseLoadingScreen label={`Loading ${mode.label} leaderboard`} />;
  if (failed) return <Box className="mode-detail-empty"><EmptyState title="Rankings are temporarily unavailable" detail="The leaderboard service could not be reached. Cached results will appear as soon as they are available." /></Box>;

  return <Box className="gamemode-detail-view" key={mode.key}>
    <Box className="gamemode-detail-hero">
      <Box className="gamemode-detail-icon"><img src={`/gamemodes/${mode.file}`} alt={`${mode.label} logo`} /></Box>
      <Box className="gamemode-detail-copy"><Typography className="gamemode-detail-kicker">DEDICATED GAMEMODE LEADERBOARD</Typography><Typography className="gamemode-detail-title">{mode.label}</Typography><Typography className="gamemode-detail-subtitle">Players grouped by tier · Showing the top 10 in each tier first</Typography></Box>
      <Box className="gamemode-detail-total"><Typography className="gamemode-detail-count">{formatNumber(total)}</Typography><Typography className="gamemode-detail-total-label">RANKED PLAYERS</Typography></Box>
    </Box>
    {!total ? <EmptyState title={`No ${mode.label} players yet`} detail="Once players receive a tier in this gamemode, the leaderboard will appear here." /> : <Box className="gamemode-tier-groups">
      {groups.map(group => <GamemodeTierGroup key={`${mode.key}-${group.level}`} group={group} mode={mode} openPlayer={openPlayer} />)}
    </Box>}
  </Box>;
}

function GamemodeTierGroup({ group, mode, openPlayer }) {
  const [expanded, setExpanded] = useState(false);
  const preview = group.players.slice(0, 10);
  const shown = expanded ? group.players : preview;
  const tierColour = group.level === 1 ? '#e6b96e' : group.level === 2 ? '#d98f67' : group.level === 3 ? '#72bd91' : group.level === 4 ? '#6daaca' : '#9295a0';

  return <Paper className={`gamemode-tier-group tier-group-${group.level}`} style={{ '--tier-accent': tierColour }}>
    <Box className="gamemode-tier-group-head">
      <Box className="gamemode-tier-medal"><Typography>{group.level}</Typography></Box>
      <Box flex={1} minWidth={0}><Typography className="gamemode-tier-group-title">Tier {group.level}</Typography><Typography className="gamemode-tier-group-caption">{group.level === 1 ? 'Highest tier division' : group.level === 5 ? 'Entry tier division' : 'Competitive division'}</Typography></Box>
      <Chip size="small" className="gamemode-tier-count-chip" label={`${group.players.length} ${group.players.length === 1 ? 'player' : 'players'}`} />
    </Box>
    {group.players.length ? <Box className="gamemode-tier-player-list">
      {shown.map((player, index) => <GamemodePlayerRow key={player.ign} player={player} mode={mode} openPlayer={openPlayer} delay={Math.min(index, 9) * 35} />)}
    </Box> : <Box className="gamemode-tier-empty"><Typography>No players in this tier yet.</Typography></Box>}
    {group.players.length > 10 && <Box className="gamemode-show-all-wrap"><Button className="gamemode-show-all" onClick={() => setExpanded(value => !value)} endIcon={<ExpandMoreRoundedIcon className={expanded ? 'show-all-chevron expanded' : 'show-all-chevron'} />}>
      {expanded ? 'Show less' : `Show all ${formatNumber(group.players.length)} players`}
    </Button></Box>}
  </Paper>;
}

function GamemodePlayerRow({ player, mode, openPlayer, delay = 0 }) {
  const tier = getTierForMode(player, mode);
  const cleanTier = String(tier || '').replace(/^R/, '');
  const colour = TIER_COLOURS[cleanTier] || '#9699a5';
  return <Paper className="gamemode-player-row" onClick={() => openPlayer({ ...player, overallRank: player.originalRank, selectedMode: mode.key })} style={{ animationDelay: `${delay}ms` }} elevation={0}>
    <Typography className={`gamemode-player-rank ${player.originalRank <= 3 ? `rank-${player.originalRank}` : ''}`}>{String(player.originalRank).padStart(2, '0')}</Typography>
    <Avatar src={getAvatar(player)} alt={`${player.ign} Minecraft skin`} variant="rounded" className="gamemode-player-avatar" />
    <Box className="gamemode-player-identity">
      <Typography className="gamemode-player-ign" noWrap>{player.ign}</Typography>
      <Typography className="gamemode-player-meta" noWrap>{getRegion(player)} · {formatNumber(getTotalPoints(player))} pts · Skin {getSkinName(player)}</Typography>
    </Box>
    <Chip className="gamemode-player-tier" size="small" label={cleanTier || 'Unassigned'} sx={{ color: colour, borderColor: alpha(colour, .38), backgroundColor: alpha(colour, .10) }} />
  </Paper>;
}

function getSkinName(player) {
  if (safeName(player?.skinSource)) return safeName(player.skinSource);
  const avatarUrl = String(player?.avatar || '');
  const match = avatarUrl.match(/\/(?:avatar|body|head)\/([^/?]+)(?:\/|$)/i);
  if (match?.[1]) {
    try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
  }
  return safeName(player?.ign || 'Steve');
}

// The legacy API has used a few different casings for gamemode keys over time.
// Resolve the existing key without changing any stored tier or ranking values.
const MODE_TIER_ALIASES = {
  Sword: ['Sword', 'sword'], Axe: ['Axe', 'axe'], Mace: ['Mace', 'mace'],
  Crystal: ['Crystal', 'crystal'], Netherite: ['Netherite', 'NethOP', 'netherite', 'nethop'],
  UHC: ['UHC', 'uhc'], Pot: ['Pot', 'pot'], SMP: ['SMP', 'smp'],
  DiaSMP: ['DiaSMP', 'Diasmp', 'diasmp'], SpearMace: ['SpearMace', 'spearmace'],
  Cart: ['Cart', 'cart']
};

function getTierForMode(player, mode) {
  const tiers = getTiers(player);
  const aliases = MODE_TIER_ALIASES[mode.key] || [mode.key];
  for (const key of aliases) {
    if (tiers[key] !== undefined && tiers[key] !== null && String(tiers[key]).trim() !== '') return tiers[key];
  }
  const wanted = new Set(aliases.map(key => key.toLowerCase()));
  const found = Object.entries(tiers).find(([key, value]) => wanted.has(String(key).toLowerCase()) && value !== undefined && value !== null && String(value).trim() !== '');
  return found?.[1] ?? null;
}

function getAssignedModeCount(player) {
  return GAMEMODES.filter(mode => mode.key !== 'all' && Boolean(getTierForMode(player, mode))).length;
}

const REGION_TITLES = { ME:'Middle East', AS:'Asia', AU:'Oceania', EU:'Europe', NA:'North America', SA:'South America' };

function getSkinBody(player) {
  const skinName = getSkinName(player) || player?.ign;
  return skinName
    ? `https://mc-heads.net/body/${encodeURIComponent(String(skinName))}/64`
    : getAvatar(player);
}

function ClassicRankBadge({ rank }) {
  const tone = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'neutral';
  return <Box className={`classic-rank-badge ${tone}`} aria-label={`Rank ${rank}`}>{rank}</Box>;
}

function ClassicPlayerIdentity({ player, compact = false }) {
  return <Box className={`classic-player-identity ${compact ? 'compact' : ''}`}>
    <Box className="classic-skin-frame">
      <img
        src={getSkinBody(player)}
        alt={`${player.ign || 'Player'} Minecraft skin`}
        loading="lazy"
        decoding="async"
        onError={event => {
          const fallback = getAvatar(player);
          if (event.currentTarget.dataset.fallback !== 'used' && fallback && event.currentTarget.src !== fallback) {
            event.currentTarget.dataset.fallback = 'used';
            event.currentTarget.src = fallback;
          }
        }}
      />
    </Box>
    <Box className="classic-player-copy">
      <Typography className="classic-player-ign" title={player?.ign || 'Unknown'}>{player?.ign || 'Unknown'}</Typography>
      <Typography className="classic-player-skin" title={`Minecraft skin: ${getSkinName(player)}`}>Skin · {getSkinName(player)}</Typography>
    </Box>
  </Box>;
}

function ClassicRegionPill({ region }) {
  const code = normalizeRegion(region);
  return <Box className={`classic-region-pill ${code === '—' ? 'muted' : ''}`} title={REGION_TITLES[code] || 'Region not selected'}>
    <span>{code}</span>
  </Box>;
}

function ClassicPointsValue({ value, compact = false }) {
  return <Box className={`classic-points-value ${compact ? 'compact' : ''}`}>
    <Typography>{formatNumber(value)}</Typography>
    <span>POINTS</span>
  </Box>;
}

function ClassicTierStrip({ player, compact = false }) {
  const modes = GAMEMODES.filter(item => item.key !== 'all');
  return <Box className={`classic-tier-strip ${compact ? 'compact' : ''}`}>
    {modes.map(mode => {
      const tier = getTierForMode(player, mode);
      const cleanTier = String(tier || '').replace(/^R/, '');
      const colour = TIER_COLOURS[cleanTier] || '#7c818c';
      return <Tooltip key={mode.key} title={`${mode.label} · ${cleanTier || 'Unassigned'}`} arrow>
        <Box className={`classic-tier-slot ${tier ? 'assigned' : 'unassigned'}`}>
          <Box className="classic-tier-circle" style={tier ? { borderColor: alpha(colour, .7), backgroundColor: alpha(colour, .12), boxShadow: `0 0 12px ${alpha(colour, .12)}` } : undefined}>
            {mode.file && <img src={`/gamemodes/${mode.file}`} alt="" loading="lazy" decoding="async" />}
          </Box>
          <Typography className="classic-tier-value" style={tier ? { color: colour } : undefined}>{cleanTier || '—'}</Typography>
        </Box>
      </Tooltip>;
    })}
  </Box>;
}

function ModeTierGrid({ player, activeMode = 'all' }) {
  const modes = GAMEMODES.filter(mode => mode.key !== 'all');
  return <Box className="all-mode-tier-grid">
    {modes.map(mode => {
      const tier = getTierForMode(player, mode);
      const cleanTier = String(tier || '').replace(/^R/, '');
      const colour = TIER_COLOURS[cleanTier] || '#9699a5';
      const assigned = Boolean(tier);
      const retiredTier = player?.retiredTiers?.[mode.key] || player?.retiredTiers?.[mode.key.toLowerCase()];
      return <Tooltip key={mode.key} title={`${mode.label}: ${tier || (retiredTier ? `Unassigned · previous ${retiredTier}` : 'Unassigned')}`}>
        <Box
          className={`mode-tier-cell ${assigned ? 'assigned' : 'unassigned'} ${activeMode === mode.key ? 'selected' : ''}`}
          aria-label={`${mode.label}: ${tier || 'Unassigned'}`}
        >
          <Box className={`mode-tier-logo-wrap ${assigned ? 'logo-active' : 'logo-muted'}`}>
            {mode.file && <img src={`/gamemodes/${mode.file}`} alt={`${mode.label} logo`} className="mode-tier-icon" loading="lazy" decoding="async" />}
          </Box>
          <Typography className={`mode-tier-name ${assigned ? 'mode-tier-name-active' : 'mode-tier-name-muted'}`} noWrap>{mode.label}</Typography>
          {assigned ? (
            <Box className="mode-tier-pill" sx={{ color: colour, borderColor: alpha(colour, .42), backgroundColor: alpha(colour, .13), boxShadow: `0 0 16px ${alpha(colour, .10)}` }}>
              <Typography className="mode-tier-value">{cleanTier}</Typography>
            </Box>
          ) : (
            <Typography className="mode-tier-missing">—</Typography>
          )}
          {!assigned && retiredTier && <Typography className="mode-tier-retired">Prev. {retiredTier}</Typography>}
        </Box>
      </Tooltip>;
    })}
  </Box>;
}

function TierBadge({ tier, label }) {
  const cleanTier = String(tier || '').replace(/^R/, '');
  const colour = TIER_COLOURS[cleanTier] || '#9699a5';
  return <Chip size="small" className="tier-chip" label={<>{label && <span className="tier-gamemode">{label}</span>}{tier || '—'}</>} sx={{ color: colour, borderColor: alpha(colour, .38), backgroundColor: alpha(colour, .09) }} />;
}

function PageBanner({ eyebrow, title, subtitle, action }) {
  return <Box className="page-banner"><Box><Typography className="eyebrow">{eyebrow}</Typography><Typography variant="h2" className="page-title">{title}</Typography><Typography className="page-subtitle">{subtitle}</Typography></Box>{action}</Box>;
}

function PlayerDialog({ player, onClose, navigate, toast }) {
  const [data, setData] = useState(player);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setData(player);
    if (!player?.ign) return;
    let alive = true;
    setLoading(true);
    apiGet(`/api/player/${encodeURIComponent(player.ign)}`).then(result => { if (alive) setData(current => ({ ...result, overallRank: current?.overallRank, selectedMode: current?.selectedMode })); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [player?.ign]);
  if (!player) return null;
  const profileUrl = `${window.location.origin}/player/${encodeURIComponent(data?.ign || player.ign)}`;
  const copy = async () => { try { await navigator.clipboard.writeText(profileUrl); toast('Profile link copied'); } catch (_) { toast(profileUrl); } };
  return <Dialog open={Boolean(player)} onClose={onClose} fullWidth maxWidth="sm" className="profile-dialog">
    <DialogTitle className="dialog-title"><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography className="eyebrow">PLAYER PROFILE</Typography><IconButton onClick={onClose}><CloseRoundedIcon /></IconButton></Stack></DialogTitle>
    <DialogContent className="profile-dialog-content">
      <Stack direction="row" spacing={2} alignItems="center" className="profile-hero-row"><Avatar src={getAvatar(data || player)} alt={`${data?.ign || player.ign} Minecraft skin`} variant="rounded" className="profile-large-avatar skin-avatar" /><Box sx={{ minWidth: 0 }}><Typography variant="h4" className="profile-ign">{data?.ign || player.ign}</Typography><Typography color="text.secondary">{getRegion(data || player)} · {data?.platform || 'Java'} · Skin: {getSkinName(data || player)}</Typography><Stack direction="row" spacing={.8} sx={{ mt: 1 }}><Chip size="small" label={`${formatNumber(getTotalPoints(data || player))} points`} className="profile-points-chip" /><Chip size="small" label={`${getAssignedModeCount(data || player)} ranked modes`} variant="outlined" /></Stack></Box></Stack>
      <Box className="profile-metrics"><Box><Typography className="stat-label">CURRENT POSITION</Typography><Typography variant="h5">{data?.overallRank ? `#${data.overallRank}` : '—'}</Typography><Typography className="muted-caption">{data?.selectedMode && data.selectedMode !== 'all' ? `${gamemodeOf(data.selectedMode).label} leaderboard` : 'Overall leaderboard'}</Typography></Box><Box><Typography className="stat-label">REGISTERED</Typography><Typography variant="h6">{formatDate(data?.registeredAt)}</Typography></Box></Box>
      <Divider sx={{ my: 2.4 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={800}>All gamemode tiers</Typography><Typography className="muted-caption">{getAssignedModeCount(data || player)} of {GAMEMODES.length - 1} assigned</Typography></Box>{loading && <CircularProgress size={16} />}</Stack>
      <ModeTierGrid player={data || player} />
      <PlayerHistoryPanel ign={data?.ign || player.ign} compact />
      <Divider sx={{ my: 2.2 }} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button fullWidth variant="contained" startIcon={<ShareRoundedIcon />} onClick={copy}>Copy profile link</Button><Button fullWidth variant="outlined" onClick={() => { onClose(); navigate(`/player/${encodeURIComponent(data?.ign || player.ign)}`); }}>Open full profile</Button></Stack>
      <Typography className="profile-data-note">Only events saved by the existing tier log are shown. Failed test sessions and historical rank snapshots are not stored by the current backend.</Typography>
    </DialogContent>
  </Dialog>;
}

function PlayerPage({ ign, openPlayer }) {
  const { data, loading, error, stale } = useApiResource(`/api/player/${encodeURIComponent(ign)}`, 30000);
  const { data: board } = useApiResource('/api/leaderboard?weapon=all', 45000);
  const players = Array.isArray(board?.players) ? board.players : [];
  const originalRank = players.findIndex(p => String(p.ign).toLowerCase() === String(ign).toLowerCase()) + 1;
  if (loading && !data) return <Container maxWidth="lg" className="page-container"><Skeleton height={230} /><Skeleton height={400} /></Container>;
  if (error && !data) return <Container maxWidth="md" className="page-container"><EmptyState title="Player profile unavailable" detail={error.status === 404 ? 'This player is not listed on the public leaderboard.' : 'The player profile could not be loaded from the API.'} actionLabel="Back to rankings" actionHref="/rankings" /></Container>;
  return <Container maxWidth="lg" className="page-container profile-page">
    <Button className="back-link" onClick={() => window.history.back()}>← Back</Button>
    <StatusStrip stale={stale} />
    <Paper className="profile-page-card">
      <Box className="profile-page-banner" />
      <Box className="profile-page-main"><Avatar src={getAvatar(data)} alt={`${data?.ign || ign} Minecraft skin`} variant="rounded" className="profile-page-avatar skin-avatar" /><Box className="profile-page-heading"><Typography className="eyebrow">ECLIPSETIERS PLAYER</Typography><Typography variant="h2">{data?.ign || ign}</Typography><Typography color="text.secondary">{getRegion(data)} · {data?.accountType || 'Minecraft player'} · Skin: {getSkinName(data)} · Joined {formatDate(data?.registeredAt)}</Typography></Box><Box className="profile-page-actions"><Button startIcon={<ContentCopyRoundedIcon />} variant="outlined" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); } catch (_) {} }}>Copy link</Button><Button onClick={() => openPlayer(data)} variant="contained">Quick view</Button></Box></Box>
      <Box className="profile-page-stats"><Box><Typography className="stat-label">OVERALL POINTS</Typography><Typography variant="h4">{formatNumber(getTotalPoints(data))}</Typography></Box><Box><Typography className="stat-label">CURRENT RANK</Typography><Typography variant="h4">{originalRank > 0 ? `#${originalRank}` : '—'}</Typography></Box><Box><Typography className="stat-label">RANKED GAMEMODES</Typography><Typography variant="h4">{getAssignedModeCount(data)}</Typography></Box></Box>
      <Divider sx={{ my: 3 }} /><SectionHeading eyebrow="CURRENT TIER RECORD" title="All gamemode tiers" subtitle={`${getAssignedModeCount(data)} of ${GAMEMODES.length - 1} gamemodes assigned. Unassigned modes remain visible so the full player record is easy to scan.`} />
      <ModeTierGrid player={data} />
      <PlayerHistoryPanel ign={data?.ign || ign} />
      <Alert severity="info" className="history-note">The legacy backend stores tier update logs, but not failed test sessions or periodic ranking snapshots. The history section shows only the records it actually saves.</Alert>
    </Paper>
  </Container>;
}

function QueuePage() {
  const [selectedRegion, setSelectedRegion] = useState('ME');
  const { data, loading, error, stale, updatedAt } = useApiResource(`/api/queue?region=${selectedRegion}`, 12000);
  const { data: activity } = useApiResource('/public-api/activity?limit=12', 45000);
  const regionalQueues = data?.regionalQueues && typeof data.regionalQueues === 'object' ? data.regionalQueues : null;
  const sourceQueues = regionalQueues ? regionalQueues[selectedRegion] : null;
  const queues = sourceQueues && typeof sourceQueues === 'object' && !Array.isArray(sourceQueues) ? sourceQueues : {};
  const modes = Object.entries(queues).map(([key, value]) => [key, Array.isArray(value) ? value.filter(entry => entry && typeof entry === 'object') : []]);
  const total = modes.reduce((sum, [, items]) => sum + items.length, 0);
  const matches = Array.isArray(activity?.matches) ? activity.matches : [];
  const queueEvents = Array.isArray(activity?.queueEvents) ? activity.queueEvents.filter(event => normalizeRegion(event?.region) === selectedRegion) : [];
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  return <Container maxWidth="xl" className="page-container">
    <PageBanner eyebrow="LIVE ACTIVITY" title="Testing queue" subtitle="Choose a region to view only its gamemode waitlists. Each regional waitlist is isolated from the others." action={<Chip icon={<span className="live-dot" />} label="Live updates" className="live-chip" />} />
    <StatusStrip stale={stale} error={error} updatedAt={updatedAt} />
    <Paper className="ranking-panel regional-queue-region-picker">
      <Typography className="eyebrow">SELECT REGION</Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt:1 }}>
        {REGION_CODES.map(code => <Button key={code} variant={selectedRegion === code ? 'contained' : 'outlined'} onClick={() => setSelectedRegion(code)} aria-pressed={selectedRegion === code}>{code}</Button>)}
      </Stack>
      <Typography color="text.secondary" fontSize={12} sx={{ mt:1.2 }}>{REGION_TITLES[selectedRegion]} · Only this region's waitlists are shown below.</Typography>
    </Paper>
    <Box className="queue-overview"><StatCard label={`${selectedRegion} players queued`} value={total} icon={<GroupsRoundedIcon />} note="In the selected region" /><StatCard label="Gamemodes active" value={modes.filter(([, list]) => list.length).length} icon={<SportsEsportsRoundedIcon />} note={`Active ${selectedRegion} waitlists`} /><StatCard label="Refresh interval" value="12s" icon={<RefreshRoundedIcon />} note="Automatic background refresh" /></Box>
    <Box className="queue-section-heading"><Box><Typography className="eyebrow">{selectedRegion} WAITLISTS</Typography><Typography variant="h5">Players waiting for a test</Typography></Box><Chip size="small" label={`${total} waiting`} /></Box>
    {loading && !data ? <EclipseLoadingScreen compact label={`Loading ${selectedRegion} waitlists`} /> : !regionalQueues ? <Paper className="queue-region-unavailable"><Typography variant="h6">Regional waitlists are not connected yet</Typography><Typography color="text.secondary">The regional queue service has not been provisioned. The previous mixed-region queue is hidden here so players from another region are never shown by mistake.</Typography></Paper> : <Box className="queue-grid">{modes.map(([key, list]) => <Card key={`${selectedRegion}-${key}`} className="queue-card motion-tile"><CardContent><Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb:2 }}><Box className="mini-mode-icon">{gamemodeOf(key).file && <img src={`/gamemodes/${gamemodeOf(key).file}`} alt="" />}</Box><Box flex={1}><Typography fontWeight={850}>{gamemodeOf(key).label}</Typography><Typography className="muted-caption">{selectedRegion} regional queue</Typography></Box><Chip size="small" label={list.length} /></Stack>
      {list.length ? list.map((entry,index) => <Stack key={`${entry.ign}-${entry.joinedAt}-${index}`} direction="row" spacing={1.1} alignItems="center" className="queue-player"><Typography className="queue-position">{String(index+1).padStart(2,'0')}</Typography><Avatar src={entry.avatar || `https://mc-heads.net/avatar/${encodeURIComponent(entry.ign || 'Steve')}/32`} /><Box flex={1} minWidth={0}><Typography fontWeight={750} noWrap>{entry.ign || 'Unknown player'}</Typography><Typography className="muted-caption">Joined {formatDateTime(entry.joinedAt)}</Typography></Box><Chip size="small" label={formatElapsed(entry.joinedAt,clock)} className="waiting-chip" /></Stack>) : <Typography className="queue-empty">No players currently queued in {selectedRegion}.</Typography>}
      </CardContent></Card>)}</Box>}
    <Box className="queue-history-callout"><Box><Typography fontWeight={850}>Queue archive</Typography><Typography color="text.secondary" fontSize={13}>Regional waitlist events are recorded from this release onward. Older events cannot be reconstructed.</Typography></Box><Button variant="outlined" onClick={() => { window.history.pushState({}, '', '/history'); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo({ top:0, behavior:'smooth' }); }}>Open all history</Button></Box>
    {queueEvents.length > 0 && <Box className="queue-recent-events"><Box className="queue-section-heading"><Box><Typography className="eyebrow">LATEST MOVEMENT</Typography><Typography variant="h5">Recent queue activity</Typography></Box><Chip size="small" label={`${queueEvents.length} recorded`} /></Box><Box className="queue-event-history-list">{queueEvents.slice(0,5).map(event => <QueueEventCard key={event.id} event={event} />)}</Box></Box>}
    <Box className="queue-section-heading queue-match-heading"><Box><Typography className="eyebrow">RECORDED MATCHES</Typography><Typography variant="h5">Match activity</Typography></Box><Typography color="text.secondary" fontSize={12}>{matches.length} archived records available</Typography></Box>
    {matches.length ? <Box className="history-match-grid">{matches.map(match => <MatchHistoryCard key={match.id} match={match} />)}</Box> : <EmptyState title="No archived matches available" detail="The current queue flow does not consistently save match records to the persistent match archive. Nothing is being made up here." />}
  </Container>;
}

function TestersPage({ testerData }) {
  const { data, loading, error, stale, updatedAt } = useApiResource('/api/testers', 60000);
  const source = data || testerData || {};
  const testers = Array.isArray(source.testers) ? source.testers : [];
  const dashboard = source.dashboard || {};
  const [query, setQuery] = useState('');
  const [selectedTester, setSelectedTester] = useState(null);
  const visible = testers.filter(t => t && typeof t === 'object' && [t.displayName, t.username, t.ign, ...(t.regions || []).map(region => region.code)].some(value => String(value || '').toLowerCase().includes(query.toLowerCase())));
  return <Container maxWidth="xl" className="page-container"><PageBanner eyebrow="THE PEOPLE BEHIND THE TIERS" title="Regional tester directory" subtitle="Meet the verified regional testers helping maintain the EclipseTiers ranking system. Only members holding a regional Tester role appear here." action={<Button component="a" href={DISCORD_INVITE} target="_blank" startIcon={<ForumRoundedIcon />} variant="contained">Join the community</Button>} /><StatusStrip stale={stale} error={error} updatedAt={updatedAt} />
    <Box className="stats-grid tester-stats"><StatCard label="Regional Testers" value={dashboard.activeTesters ?? testers.length} icon={<ShieldRoundedIcon />} note="Members with a regional Tester role" /><StatCard label="Online Now" value={dashboard.onlineNow} icon={<WifiRoundedIcon />} note="Discord presence when available" /><StatCard label="Tier Records This Month" value={dashboard.totalTestsThisMonth} icon={<StarRoundedIcon />} note="Saved results by current regional testers" /><StatCard label="Top Contributor" value={dashboard.topContributor?.displayName || dashboard.topContributor?.username || '—'} icon={<MilitaryTechRoundedIcon />} note="By current-month tier records" /></Box>
    <Paper className="directory-panel"><Stack className="directory-toolbar" direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}><Box><Typography variant="h5">Our regional testers</Typography><Typography color="text.secondary">{formatNumber(testers.length)} verified Discord tester profiles</Typography></Box><TextField size="small" placeholder="Search testers, IGN or region..." value={query} onChange={e => setQuery(e.target.value)} sx={{ width: { xs: '100%', sm: 310 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }} /></Stack>
      {loading && !data && !testerData ? <Box sx={{ p: 3 }}><Skeleton height={90} /><Skeleton height={90} /><Skeleton height={90} /></Box> : visible.length ? <Box className="tester-grid">{visible.map(tester => <Card key={tester.discordId || tester.id} className="tester-card tester-card-clickable" role="button" tabIndex={0} aria-label={`Open ${tester.displayName || tester.username} tester profile`} onClick={() => setSelectedTester(tester)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTester(tester); } }}><CardContent><Stack direction="row" spacing={1.5} alignItems="center"><Box className="tester-avatar-wrap"><Avatar src={tester.avatar} alt={`${tester.displayName || tester.username} Discord avatar`} className="tester-avatar" /><span className={tester.online ? 'online-indicator online' : 'online-indicator'} /></Box><Box flex={1} minWidth={0}><Typography fontWeight={850} noWrap>{tester.displayName || tester.username}</Typography><Typography color="text.secondary" fontSize={12}>@{tester.username}</Typography></Box><Chip size="small" label={tester.online ? 'Online' : 'Offline'} className={tester.online ? 'online-chip' : 'offline-chip'} /></Stack><Stack direction="row" spacing={.6} flexWrap="wrap" useFlexGap sx={{ mt: 1.4 }}>{(tester.regions || []).map(region => <Chip key={region.code} size="small" label={`${region.code} · ${region.label}`} className="tester-region-chip" />)}</Stack><Typography className="tester-card-ign" noWrap>{tester.ign ? `Minecraft: ${tester.ign}` : 'Minecraft account not linked'}</Typography><Divider sx={{ my: 1.5 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography className="stat-label">MONTHLY RECORDS</Typography><Typography variant="h5">{formatNumber(tester.testsThisMonth)}</Typography></Box><Box textAlign="right"><Typography className="stat-label">ALL-TIME RECORDS</Typography><Typography variant="h5">{formatNumber(tester.testsAllTime)}</Typography></Box></Stack><Typography className="tester-card-open-hint">View profile & ask a question <ArrowOutwardRoundedIcon /></Typography></CardContent></Card>)}</Box> : <EmptyState title="No regional testers found" detail={testers.length ? 'Try another search term.' : 'Only members with Tester-ME, Tester-AS, Tester-AU, Tester-EU, Tester-NA or Tester-SA roles appear here. Assign a regional Tester role in Discord to list someone.'} />}
    </Paper>
    <TesterProfileDialog tester={selectedTester} onClose={() => setSelectedTester(null)} />
  </Container>;
}

function TesterProfileDialog({ tester, onClose }) {
  if (!tester) return null;
  const regions = Array.isArray(tester.regions) ? tester.regions : [];
  const gamemodes = Array.isArray(tester.gamemodes) ? tester.gamemodes : [];
  const recentActivity = Array.isArray(tester.recentActivity) ? tester.recentActivity : [];
  const info = [
    ['Minecraft IGN', tester.ign || 'Not linked'],
    ['Account type', tester.accountType || 'Not provided'],
    ['Platform', tester.platform || 'Not provided'],
    ['Discord member since', tester.joinedAt ? formatDate(tester.joinedAt) : 'Not available'],
    ['Discord account created', tester.accountCreatedAt ? formatDate(tester.accountCreatedAt) : 'Not available'],
    ['Minecraft registered', tester.registeredAt ? formatDate(tester.registeredAt) : 'Not linked'],
  ];
  return <Dialog open={Boolean(tester)} onClose={onClose} fullWidth maxWidth="sm" className="tester-profile-dialog" PaperProps={{ className: 'tester-profile-paper' }}>
    <DialogTitle className="tester-profile-title"><Box><Typography className="eyebrow">REGIONAL TESTER PROFILE</Typography><Typography variant="h5">{tester.displayName || tester.username}</Typography></Box><IconButton onClick={onClose} aria-label="Close tester profile"><CloseRoundedIcon /></IconButton></DialogTitle>
    <DialogContent dividers>
      <Stack direction="row" spacing={2} alignItems="center" className="tester-profile-identity"><Avatar src={tester.avatar} alt={`${tester.displayName || tester.username} Discord avatar`} className="tester-profile-avatar" /><Box minWidth={0} flex={1}><Typography fontWeight={850} variant="h6" noWrap>{tester.displayName || tester.username}</Typography><Typography color="text.secondary">{tester.discordTag || `@${tester.username}`}</Typography><Stack direction="row" flexWrap="wrap" gap={.6} sx={{ mt: 1 }}>{regions.map(region => <Chip key={region.code} size="small" label={`${region.code} · ${region.label}`} className="tester-region-chip" />)}<Chip size="small" label={tester.online ? 'Online' : 'Offline'} className={tester.online ? 'online-chip' : 'offline-chip'} /></Stack></Box></Stack>
      <Box className="tester-profile-counts"><Box><Typography className="stat-label">THIS MONTH</Typography><Typography variant="h4">{formatNumber(tester.testsThisMonth)}</Typography><Typography className="muted-caption">Tier records</Typography></Box><Box><Typography className="stat-label">ALL TIME</Typography><Typography variant="h4">{formatNumber(tester.testsAllTime)}</Typography><Typography className="muted-caption">Tier records</Typography></Box></Box>
      <Typography className="tester-dialog-section-label">PROFILE DETAILS</Typography><Box className="tester-detail-grid">{info.map(([label, value]) => <Box className="tester-detail-item" key={label}><Typography className="stat-label">{label}</Typography><Typography>{value}</Typography></Box>)}</Box>
      <Typography className="tester-dialog-section-label">ASSIGNED GAMEMODES</Typography><Stack direction="row" flexWrap="wrap" gap={.7}>{gamemodes.length ? gamemodes.map(mode => <Chip key={mode} size="small" label={mode} className="tester-mode-chip" />) : <Typography color="text.secondary" fontSize={13}>No gamemode assignments have been published yet.</Typography>}</Stack>
      <Typography className="tester-dialog-section-label">RECENT TIER ACTIVITY</Typography>{recentActivity.length ? <Stack spacing={.8}>{recentActivity.map((record, index) => <Box className="tester-activity-row" key={`${record.timestamp}-${record.playerIGN}-${index}`}><Box minWidth={0} flex={1}><Typography fontWeight={750}>{record.playerIGN}</Typography><Typography color="text.secondary" fontSize={12}>{record.weapon}{record.tier ? ` · ${record.tier}` : ''}</Typography></Box><Typography color="text.secondary" fontSize={11}>{record.timestamp ? formatDate(record.timestamp) : 'Date unavailable'}</Typography></Box>)}</Stack> : <Typography color="text.secondary" fontSize={13}>No public tier activity records are available yet.</Typography>}
      <Paper className="tester-question-panel"><Typography fontWeight={800}>Have a question for this tester?</Typography><Typography color="text.secondary" fontSize={12}>Open their Discord profile or join the EclipseTiers server to ask about testing, regions or gamemodes.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}><Button component="a" href={tester.profileUrl || `https://discord.com/users/${tester.discordId || tester.id}`} target="_blank" rel="noreferrer" variant="outlined" endIcon={<ArrowOutwardRoundedIcon />}>Discord profile</Button><Button component="a" href={DISCORD_INVITE} target="_blank" rel="noreferrer" variant="contained" endIcon={<ForumRoundedIcon />}>Ask in Discord</Button></Stack></Paper>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close profile</Button></DialogActions>
  </Dialog>;
}
function ActivityHistoryPage() {
  const { data, loading, error, stale, updatedAt } = useApiResource('/public-api/activity?limit=80', 45000);
  const { data: queueData } = useApiResource('/api/queue', 12000);
  const [tab, setTab] = useState('tiers');
  const [historySearch, setHistorySearch] = useState('');
  const tierAwards = Array.isArray(data?.tierAwards) ? data.tierAwards : [];
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const queueEvents = Array.isArray(data?.queueEvents) ? data.queueEvents : [];
  const needle = historySearch.trim().toLocaleLowerCase('en-US');
  const filteredTierAwards = needle ? tierAwards.filter(record => [record.playerIGN, record.weapon, record.tier, record.oldTier, record.tester].some(value => String(value || '').toLocaleLowerCase('en-US').includes(needle))) : tierAwards;
  const filteredMatches = needle ? matches.filter(match => [match?.weapon, match?.status, ...(Array.isArray(match?.participants) ? match.participants : []).map(person => person?.ign)].some(value => String(value || '').toLocaleLowerCase('en-US').includes(needle))) : matches;
  const filteredQueueEvents = needle ? queueEvents.filter(event => [event.ign, event.weapon, event.action].some(value => String(value || '').toLocaleLowerCase('en-US').includes(needle))) : queueEvents;
  const queues = queueData?.queues && typeof queueData.queues === 'object' && !Array.isArray(queueData.queues) ? queueData.queues : {};
  const liveQueue = Object.entries(queues).flatMap(([weapon, entries]) => (Array.isArray(entries) ? entries : []).filter(entry => entry && typeof entry === 'object').map((entry, index) => ({ ...entry, weapon, position: index + 1 }))).sort((a,b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
  return <Container maxWidth="xl" className="page-container activity-page">
    <PageBanner eyebrow="THE ECLIPSETIERS ARCHIVE" title="History & activity" subtitle="Explore saved test/tier outcomes, available match records, observed queue movement and the live testing waitlist. Entries are sourced from EclipseTiers data files." action={<Chip icon={<HistoryRoundedIcon />} label="Live archive" className="live-chip" />} />
    <StatusStrip stale={stale} error={error} updatedAt={updatedAt} />
    <Box className="activity-stat-grid">
      <StatCard label="Recorded tier updates" value={data?.counts?.tierChanges ?? '—'} icon={<TimelineRoundedIcon />} note="Saved tier log events" />
      <StatCard label="Archived matches" value={data?.counts?.matchRecords ?? '—'} icon={<SportsScoreRoundedIcon />} note="Records in matches.json" />
      <StatCard label="Players waiting" value={liveQueue.length} icon={<HourglassBottomRoundedIcon />} note="Current public waitlist" />
      <StatCard label="Archive checked" value={data?.generatedAt ? formatDateTime(data.generatedAt) : '—'} icon={<QueryStatsRoundedIcon />} note="Last data-file read" />
    </Box>
    <Paper className="activity-panel">
      <Box className="activity-panel-heading"><Box><Typography className="eyebrow">PUBLIC RECORDS</Typography><Typography variant="h5">Browse activity</Typography></Box><Chip size="small" label="Read-only" variant="outlined" /></Box>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); setHistorySearch(''); }} className="activity-tabs" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        <Tab value="tiers" label={`Test & tier records (${tierAwards.length})`} icon={<TimelineRoundedIcon />} iconPosition="start" />
        <Tab value="matches" label={`Match records (${matches.length})`} icon={<SportsScoreRoundedIcon />} iconPosition="start" />
        <Tab value="queue" label={`Queue activity (${queueEvents.length})`} icon={<HourglassBottomRoundedIcon />} iconPosition="start" />
      </Tabs>
      <Box className="history-filter-bar"><TextField size="small" fullWidth value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder={tab === 'tiers' ? 'Search player, tester, gamemode or tier...' : tab === 'queue' ? 'Search player, gamemode or queue action...' : 'Search player, gamemode or match status...'} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment>, endAdornment: historySearch ? <InputAdornment position="end"><IconButton size="small" onClick={() => setHistorySearch('')} aria-label="Clear history search"><CloseRoundedIcon fontSize="small" /></IconButton></InputAdornment> : null }} /></Box>
      {tab === 'tiers' && <Box className="activity-record-list">
        {loading && !data ? <EclipseLoadingScreen compact label="Loading tier history" /> : filteredTierAwards.length ? filteredTierAwards.map(record => <TierHistoryCard key={record.id} record={record} />) : <EmptyState title={needle && tierAwards.length ? 'No matching tier records' : 'No tier update records yet'} detail={needle && tierAwards.length ? 'Try another player, tester, gamemode or tier.' : data?.sources?.tierLogs === false ? 'The tier log file is not present on the service volume yet.' : 'No public tier update entries are currently available.'} />}
        <Alert severity="info" className="history-source-note">This archive contains tier records created by passed test submissions and manual tier assignments. The existing bot does not save failed submissions or a separate complete test-session record, so this is not a full audit of every test.</Alert>
      </Box>}
      {tab === 'matches' && <Box className="activity-record-list">
        {filteredMatches.length ? <Box className="history-match-grid">{filteredMatches.map(match => <MatchHistoryCard key={match.id} match={match} />)}</Box> : <EmptyState title={needle && matches.length ? 'No matching matches' : 'No archived matches yet'} detail={needle && matches.length ? 'Try another player, gamemode or status.' : data?.sources?.matchArchive === false ? 'The match archive file is not present on the service volume.' : 'The existing queue flow does not consistently persist match history, so there are no records to display.'} />}
        <Alert severity="info" className="history-source-note">Only matches actually written to the existing match archive can appear here. Missing records are not reconstructed or invented.</Alert>
      </Box>}
      {tab === 'queue' && <Box className="activity-record-list">
        {filteredQueueEvents.length ? <Box className="queue-event-history-list">{filteredQueueEvents.map(event => <QueueEventCard key={event.id} event={event} />)}</Box> : <EmptyState title={needle && queueEvents.length ? 'No matching queue events' : 'No archived queue events yet'} detail={needle && queueEvents.length ? 'Try another player, gamemode or action.' : 'New join and removal events will appear here after the gateway observes changes to the persistent queue file. Older events are not available.'} />}
        <Box className="queue-live-subsection"><Typography fontWeight={850}>Current waitlist</Typography>{liveQueue.length ? <Box className="live-queue-history-list">{liveQueue.map(entry => <LiveQueueHistoryCard key={`${entry.weapon}-${entry.ign}-${entry.joinedAt}`} entry={entry} />)}</Box> : <Typography color="text.secondary" fontSize={12}>No players are currently waiting.</Typography>}</Box>
        <Alert severity="info" className="history-source-note">The gateway records observed changes to the persistent queue file from this release onward. Very short-lived changes may be missed by file observation. The legacy bot does not record whether a removal was a tester pull or a voluntary leave.</Alert>
      </Box>}
    </Paper>
    <Box className="activity-footnote"><ShieldRoundedIcon /><Typography>Private Discord IDs, ticket references and hidden player records are not included in this public activity feed.</Typography></Box>
  </Container>;
}

function TierHistoryCard({ record, compact = false }) {
  const mode = gamemodeOf(record.weapon);
  const newTier = String(record.tier || '').replace(/^R/, '');
  const colour = TIER_COLOURS[newTier] || '#d6b36a';
  return <Paper className={`tier-history-card motion-tile ${compact ? 'compact' : ''}`} elevation={0}>
    <Box className="history-mode-icon">{mode.file ? <img src={`/gamemodes/${mode.file}`} alt={`${mode.label} logo`} /> : <TimelineRoundedIcon />}</Box>
    <Box className="history-record-main"><Box className="history-record-title"><Typography fontWeight={850}>{record.playerIGN}</Typography><Chip size="small" label={mode.label} variant="outlined" /></Box><Typography className="history-record-change">{record.oldTier ? `${record.oldTier} → ` : 'New tier · '}<strong style={{ color: colour }}>{record.tier}</strong></Typography><Typography className="history-record-by">Recorded by {record.tester || 'EclipseTiers staff'}</Typography></Box>
    <Box className="history-record-time"><Typography>{formatDate(record.timestamp)}</Typography><Typography>{new Date(Number(record.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography></Box>
  </Paper>;
}

function MatchHistoryCard({ match }) {
  const mode = gamemodeOf(match.weapon);
  const people = Array.isArray(match.participants) ? match.participants.filter(person => person && typeof person === 'object') : [];
  return <Paper className="match-history-card motion-tile" elevation={0}>
    <Box className="match-history-mode">{mode.file && <img src={`/gamemodes/${mode.file}`} alt="" />}<Typography>{mode.label}</Typography></Box>
    <Box className="match-participants">{people.map((person, index) => <React.Fragment key={`${person.ign}-${index}`}><Box className="match-participant"><Avatar src={`https://mc-heads.net/avatar/${encodeURIComponent(person.ign || 'Steve')}/40`} /><Typography>{person.ign}</Typography></Box>{index < people.length - 1 && <span className="match-versus">VS</span>}</React.Fragment>)}</Box>
    <Box className="match-history-meta"><Chip size="small" label={match.status || 'Recorded'} /><Typography>{formatDateTime(match.createdAt)}</Typography></Box>
  </Paper>;
}


function QueueEventCard({ event }) {
  const mode = gamemodeOf(event.weapon);
  const joined = event.action === 'joined';
  return <Paper className={`queue-event-card motion-tile ${joined ? 'joined' : 'removed'}`} elevation={0}>
    <Box className={`queue-event-mark ${joined ? 'joined' : 'removed'}`}>{joined ? <ArrowForwardRoundedIcon /> : <CloseRoundedIcon />}</Box>
    <Box className="history-mode-icon">{mode.file ? <img src={`/gamemodes/${mode.file}`} alt="" /> : <HourglassBottomRoundedIcon />}</Box>
    <Box className="queue-event-main"><Typography fontWeight={850}>{event.ign}</Typography><Typography className="muted-caption">{mode.label} · {event.region ? `${event.region} region · ` : ''}{joined ? `Joined at position ${event.position || '—'}` : 'Removed from waitlist'}</Typography></Box>
    <Box className="history-record-time"><Typography>{formatDate(event.timestamp)}</Typography><Typography>{new Date(Number(event.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>{!joined && event.waitedMs != null && <Typography>Waited {formatElapsed(Number(event.timestamp) - Number(event.waitedMs), Number(event.timestamp)).replace(' waiting','')}</Typography>}</Box>
  </Paper>;
}

function LiveQueueHistoryCard({ entry }) {
  const mode = gamemodeOf(entry.weapon);
  return <Paper className="live-queue-history-card motion-tile" elevation={0}>
    <Typography className="queue-position">#{String(entry.position).padStart(2, '0')}</Typography>
    <Avatar src={entry.avatar || `https://mc-heads.net/avatar/${encodeURIComponent(entry.ign || 'Steve')}/40`} />
    <Box flex={1} minWidth={0}><Typography fontWeight={850} noWrap>{entry.ign}</Typography><Typography className="muted-caption">{mode.label} · Joined {formatDateTime(entry.joinedAt)}</Typography></Box>
    <Chip size="small" label="Waiting" className="waiting-chip" />
  </Paper>;
}

function PlayerHistoryPanel({ ign, compact = false }) {
  const key = `/public-api/player-history/${encodeURIComponent(ign || '')}`;
  const { data, loading, error } = useApiResource(key, 60000);
  const records = Array.isArray(data?.records) ? data.records : [];
  return <Box className={`player-history-panel ${compact ? 'compact' : ''}`}>
    <Box className="player-history-heading"><Box><Typography className="eyebrow">PLAYER TIMELINE</Typography><Typography variant={compact ? 'subtitle1' : 'h5'} fontWeight={850}>Recorded tier updates</Typography></Box><Chip size="small" label={`${records.length} records`} variant="outlined" /></Box>
    {loading && !data ? <Stack spacing={1}><Skeleton height={58} /><Skeleton height={58} /></Stack> : error && !data ? <Typography color="text.secondary">Player history is temporarily unavailable.</Typography> : records.length ? <Box className="player-history-list">{records.slice(0, compact ? 4 : 30).map(record => <TierHistoryCard key={record.id} record={record} compact />)}</Box> : <EmptyState title="No saved tier changes" detail={data?.available === false ? 'The tier history file is not available on this service.' : 'There are no recorded tier updates for this player yet.'} />}
    <Typography className="history-data-caption">Only saved tier-update records are shown. The legacy backend does not retain failed-test sessions or periodic rank snapshots.</Typography>
  </Box>;
}

function ComparePage({ initialLeft, initialRight }) {
  const { data, loading, error } = useApiResource('/api/leaderboard?weapon=all', 45000);
  const players = data?.players || [];
  const [leftName, setLeftName] = useState(initialLeft);
  const [rightName, setRightName] = useState(initialRight);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [compareError, setCompareError] = useState('');
  useEffect(() => { setLeftName(initialLeft); setRightName(initialRight); }, [initialLeft, initialRight]);
  useEffect(() => {
    if (!initialLeft || !initialRight) return;
    let alive = true;
    Promise.all([apiGet(`/api/player/${encodeURIComponent(initialLeft)}`), apiGet(`/api/player/${encodeURIComponent(initialRight)}`)]).then(([a, b]) => { if (alive) { setLeft(a); setRight(b); } }).catch(err => { if (alive) setCompareError(err.message); });
    return () => { alive = false; };
  }, [initialLeft, initialRight]);
  const compare = async () => {
    setCompareError('');
    try {
      const [a, b] = await Promise.all([apiGet(`/api/player/${encodeURIComponent(leftName)}`), apiGet(`/api/player/${encodeURIComponent(rightName)}`)]);
      setLeft(a); setRight(b);
      const url = `/compare?left=${encodeURIComponent(a.ign)}&right=${encodeURIComponent(b.ign)}`;
      window.history.replaceState({}, '', url);
    } catch (err) { setCompareError(err.message || 'Could not find one of these public profiles.'); setLeft(null); setRight(null); }
  };
  const leftPoints = getTotalPoints(left), rightPoints = getTotalPoints(right);
  return <Container maxWidth="lg" className="page-container"><PageBanner eyebrow="HEAD TO HEAD" title="Player comparison" subtitle="Compare current overall points, regional details and individual gamemode tiers." />
    <Paper className="compare-select-panel"><Box className="compare-select-grid"><Autocomplete options={players} getOptionLabel={option => option.ign || ''} loading={loading} value={players.find(p => p.ign === leftName) || null} onChange={(_, value) => setLeftName(value?.ign || '')} renderInput={params => <TextField {...params} label="First player" placeholder="Search IGN" />} /><Box className="versus-mark">VS</Box><Autocomplete options={players} getOptionLabel={option => option.ign || ''} loading={loading} value={players.find(p => p.ign === rightName) || null} onChange={(_, value) => setRightName(value?.ign || '')} renderInput={params => <TextField {...params} label="Second player" placeholder="Search IGN" />} /></Box><Button variant="contained" fullWidth onClick={compare} disabled={!leftName || !rightName || leftName.toLowerCase() === rightName.toLowerCase()} sx={{ mt: 2 }}>Compare players</Button>{compareError && <Alert severity="warning" sx={{ mt: 2 }}>{compareError}</Alert>}{error && <Alert severity="info" sx={{ mt: 2 }}>Leaderboard suggestions may be temporarily unavailable.</Alert>}</Paper>
    {left && right ? <><Box className="compare-score-grid"><ComparePlayerCard player={left} winner={leftPoints > rightPoints} /><Box className="compare-score-center"><Typography className="eyebrow">POINT DIFFERENCE</Typography><Typography variant="h3">{formatNumber(Math.abs(leftPoints - rightPoints))}</Typography><Typography color="text.secondary">points</Typography></Box><ComparePlayerCard player={right} winner={rightPoints > leftPoints} /></Box>
      <Paper className="compare-table-panel"><Typography variant="h5" sx={{ mb: 2 }}>Gamemode breakdown</Typography><Table><TableHead><TableRow><TableCell>Gamemode</TableCell><TableCell align="center">{left.ign}</TableCell><TableCell align="center">{right.ign}</TableCell><TableCell align="right">Advantage</TableCell></TableRow></TableHead><TableBody>{GAMEMODES.filter(m => m.key !== 'all').map(mode => { const a = getTiers(left)[mode.key]; const b = getTiers(right)[mode.key]; const advantage = a && b ? tierSort(a) < tierSort(b) ? left.ign : tierSort(b) < tierSort(a) ? right.ign : 'Equal' : a ? left.ign : b ? right.ign : '—'; return <TableRow key={mode.key}><TableCell><Stack direction="row" alignItems="center" spacing={1}><Box className="mini-mode-icon">{mode.file && <img src={`/gamemodes/${mode.file}`} alt="" />}</Box>{mode.label}</Stack></TableCell><TableCell align="center">{a ? <TierBadge tier={a} /> : '—'}</TableCell><TableCell align="center">{b ? <TierBadge tier={b} /> : '—'}</TableCell><TableCell align="right"><Typography fontWeight={750} color={advantage === left.ign ? 'primary.light' : advantage === right.ign ? 'secondary.light' : 'text.secondary'}>{advantage}</Typography></TableCell></TableRow>; })}</TableBody></Table></Paper></> : <Box className="compare-empty"><CompareArrowsRoundedIcon /><Typography variant="h5">Ready for a comparison?</Typography><Typography color="text.secondary">Choose two public player profiles above to compare their current tiers and points.</Typography></Box>}
  </Container>;
}

function ComparePlayerCard({ player, winner }) {
  return <Card className={`compare-player-card ${winner ? 'winner' : ''}`}><CardContent><Avatar src={getAvatar(player)} className="compare-avatar" /><Typography variant="h5">{player.ign}</Typography><Typography color="text.secondary">{getRegion(player)}</Typography><Typography variant="h3" className="compare-points">{formatNumber(getTotalPoints(player))}</Typography><Typography className="stat-label">OVERALL POINTS</Typography>{winner && <Chip size="small" label="Higher points" color="success" sx={{ mt: 1 }} />}</CardContent></Card>;
}

function TierTaggerPage() {
  return <Container maxWidth="lg" className="page-container"><PageBanner eyebrow="ECLIPSETIERS CLIENT MOD" title="TierTagger" subtitle="Bring public EclipseTiers player tiers into Minecraft with the official Fabric client mod." />
    <Paper className="tagger-hero"><Box className="tagger-emblem"><img src="/brand/logo.png" alt="EclipseTiers logo" /></Box><Box className="tagger-copy"><Chip label="LATEST PROVIDED RELEASE · 1.3.0" className="release-chip" /><Typography variant="h3">Know the tier.<br /><Box component="span" color="secondary.main">Stay in the game.</Box></Typography><Typography color="text.secondary">EclipseTiers TierTagger is a client-side Fabric mod that fetches and displays supported player tiers in Minecraft, with in-game player lookup and gamemode controls.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}><Button variant="contained" size="large" href="/downloads/EclipseTiers-TierTagger-1.3.0.jar" download startIcon={<DownloadRoundedIcon />}>Download TierTagger 1.3.0</Button><Button variant="outlined" size="large" href="https://discord.gg/ZRqHVHWfZY" target="_blank" endIcon={<ArrowOutwardRoundedIcon />}>Get support</Button></Stack><Typography className="file-meta">JAR · 1.3.0 · 243 KB · supplied release artifact</Typography></Box></Paper>
    <Box className="tagger-feature-grid"><Card><CardContent><Box className="feature-icon crimson"><MilitaryTechRoundedIcon /></Box><Typography variant="h6">Live tier tags</Typography><Typography color="text.secondary">View supported tier information on player nametags while playing.</Typography></CardContent></Card><Card><CardContent><Box className="feature-icon gold"><SportsEsportsRoundedIcon /></Box><Typography variant="h6">Multiple gamemodes</Typography><Typography color="text.secondary">Sword, Axe, Crystal, Pot, SMP, UHC, Mace, SpearMace, Cart and more.</Typography></CardContent></Card><Card><CardContent><Box className="feature-icon silver"><PersonSearchRoundedIcon /></Box><Typography variant="h6">In-game lookup</Typography><Typography color="text.secondary">Look up player tier information without leaving Minecraft.</Typography></CardContent></Card></Box>
    <Paper className="requirements-panel"><Typography variant="h5">Requirements</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>Compatibility details from the provided TierTagger release page.</Typography><Box className="requirement-grid"><Requirement label="Minecraft" value="1.21.1 – 1.21.11" /><Requirement label="Mod loader" value="Fabric Loader ≥ 0.16.0" /><Requirement label="Dependency" value="Fabric API" /><Requirement label="Mod menu" value="ModMenu ≥ 11.0.3" /><Requirement label="Java" value="Java 21+" /></Box><Alert severity="info" sx={{ mt: 2.3 }}>Install Fabric for a compatible Minecraft version, add Fabric API and ModMenu, then place the downloaded JAR in your Minecraft mods folder.</Alert></Paper>
  </Container>;
}

function Requirement({ label, value }) { return <Box className="requirement-item"><Typography className="stat-label">{label}</Typography><Typography fontWeight={750}>{value}</Typography></Box>; }

function GlobalSearch({ open, onClose, openPlayer, navigate }) {
  const { data, loading } = useApiResource('/api/leaderboard?weapon=all', 60000);
  const players = data?.players || [];
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { if (!open) { setQuery(''); setActiveIndex(0); } }, [open]);
  useEffect(() => setActiveIndex(0), [query]);
  const matches = useMemo(() => {
    if (!query.trim()) return players.slice(0, 5);
    const q = query.trim().toLowerCase();
    return players.map(p => ({ player: p, score: fuzzyScore(String(p.ign || '').toLowerCase(), q) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 8).map(x => x.player);
  }, [players, query]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" className="search-dialog"><DialogContent sx={{ p: 0 }}>
    <TextField autoFocus fullWidth variant="standard" placeholder="Search players by IGN..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setActiveIndex(index => Math.min(index + 1, matches.length - 1)); } else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); } else if (e.key === 'Enter' && query.trim() && matches[activeIndex]) { e.preventDefault(); const chosen = matches[activeIndex]; openPlayer({ ...chosen, overallRank: players.findIndex(p => p.ign === chosen.ign) + 1, selectedMode: 'all' }); } }} className="global-search-input" InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton onClick={onClose}><CloseRoundedIcon /></IconButton></InputAdornment> }} />
    <Divider /><Box className="search-results"><Typography className="search-section-label">{query ? 'PLAYER MATCHES' : 'QUICK ACCESS'}</Typography>{matches.map((player, index) => <Button key={player.ign} className={`search-result ${activeIndex === index ? 'selected' : ''}`} fullWidth onMouseEnter={() => setActiveIndex(index)} onClick={() => openPlayer({ ...player, overallRank: players.findIndex(p => p.ign === player.ign) + 1, selectedMode: 'all' })}><Avatar src={getAvatar(player)} /><Box flex={1} textAlign="left"><Typography fontWeight={800}>{player.ign}</Typography><Typography className="muted-caption">{getRegion(player)} · {formatNumber(getTotalPoints(player))} points</Typography></Box><ArrowOutwardRoundedIcon /></Button>)}{!matches.length && <Typography className="search-no-results">{loading ? 'Loading player directory...' : 'No matching public players found.'}</Typography>}<Divider sx={{ my: 1.3 }} /><Button fullWidth className="search-all-link" onClick={() => { onClose(); navigate('/rankings'); }}>Open full rankings <ArrowForwardRoundedIcon /></Button></Box>
    <Box className="search-shortcut-hint"><KeyboardCommandKeyRoundedIcon fontSize="small" /> Search anywhere · Press Escape to close</Box>
  </DialogContent></Dialog>;
}

function fuzzyScore(name, query) {
  if (!query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 75;
  if (name.includes(query)) return 55;
  if (query.length < 3) return 0;
  const distance = levenshtein(name.slice(0, Math.max(name.length, query.length)), query);
  return distance <= Math.max(1, Math.floor(query.length / 4)) ? 30 - distance : 0;
}
function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = old; }
  }
  return row[b.length];
}

function EmptyState({ title, detail, actionLabel, actionHref }) {
  return <Box className="empty-state"><Box className="empty-mark"><LeaderboardRoundedIcon /></Box><Typography variant="h6">{title}</Typography><Typography color="text.secondary">{detail}</Typography>{actionLabel && <Button sx={{ mt: 1.5 }} component="a" href={actionHref} target={actionHref?.startsWith('http') ? '_blank' : undefined}>{actionLabel}</Button>}</Box>;
}

function NotFound({ navigate }) {
  return <Container maxWidth="md" className="page-container"><EmptyState title="Page not found" detail="The EclipseTiers page you requested does not exist." actionLabel="Return home" actionHref="/home" /><Box textAlign="center"><Button onClick={() => navigate('/home')}>Go home</Button></Box></Container>;
}

function Footer({ navigate }) {
  return <Box component="footer" className="site-footer"><Container maxWidth="xl"><Box className="footer-main"><Box className="footer-brand"><Stack direction="row" spacing={1.2} alignItems="center"><img src="/brand/logo.png" alt="" /><Box><Typography className="brand-name">ECLIPSETIERS</Typography><Typography className="brand-sub">GLOBAL RANKINGS</Typography></Box></Stack><Typography color="text.secondary" sx={{ mt: 2, maxWidth: 330 }}>The Standard of Competitive Minecraft. A community-built home for player tiers, rankings and testing.</Typography></Box><Box><Typography className="footer-label">EXPLORE</Typography><Button onClick={() => navigate('/home')}>Home</Button><Button onClick={() => navigate('/rankings')}>Rankings</Button><Button onClick={() => navigate('/compare')}>Compare</Button><Button onClick={() => navigate('/queue')}>Queue</Button></Box><Box><Typography className="footer-label">COMMUNITY</Typography><Button onClick={() => navigate('/testers')}>Testers</Button><Button onClick={() => navigate('/history')}>History</Button><Button onClick={() => navigate('/tiertagger')}>TierTagger</Button><Button component="a" href={DISCORD_INVITE} target="_blank">Discord <ArrowOutwardRoundedIcon fontSize="inherit" /></Button></Box></Box><Box className="footer-gamemodes"><Typography className="footer-label">GAMEMODE SHORTCUTS</Typography><Stack direction="row" flexWrap="wrap" gap={.5}>{GAMEMODES.filter(mode => mode.key !== 'all').map(mode => <Button key={mode.key} onClick={() => navigate(`/rankings?mode=${encodeURIComponent(mode.key)}`)}>{mode.label}</Button>)}</Stack></Box><Divider sx={{ my: 3 }} /><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography className="footer-copyright">© {new Date().getFullYear()} EclipseTiers. Community project.</Typography><Typography className="footer-copyright">Ranking calculations are provided by the existing EclipseTiers API.</Typography></Stack></Container></Box>;
}

export default App;
