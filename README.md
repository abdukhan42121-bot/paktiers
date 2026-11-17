# EclipseTiers · Railway MUI website (v2.3.0)

A complete dark-only **React + Material UI** rebuild of the EclipseTiers public website, packaged to deploy on Railway. The original `api_server.js` and Discord bot are included unchanged; `railway-gateway.js` starts that backend privately and serves the new MUI website on Railway's public port.

## Download and files

The project ZIP contains the entire deployable source. Important root files:

| File/folder | Purpose |
|---|---|
| `package.json` | Node dependencies, build and start scripts |
| `railway-gateway.js` | Public Railway entry point, frontend serving and private API proxy |
| `api_server.js` | Your supplied existing API + Discord bot source (unchanged) |
| `index.html` | Website document, SEO and social metadata |
| `src/` | React app, MUI theme, API cache and responsive styles |
| `static/brand/` | Original EclipseTiers logo, favicon and provided hero artwork |
| `static/gamemodes/` | Original gamemode icons extracted from your previous site |
| `static/downloads/` | Supplied TierTagger `1.3.0` JAR |
| `legacy-reference/` | Original previous-site HTML retained for reference only |

## Features included

- Dark obsidian, crimson, gold and silver Material UI design; responsive mobile and desktop layouts.
- Homepage hero: “The Standard of Competitive Minecraft.”, real backend statistics, current top-three podium and original gamemode cards.
- Rankings: horizontal original-icon gamemode tabs, cached instant rendering + background refresh, player search, region/tier filters, sorting, original ranking positions and 100 rows per page.
- Player rows show a larger Minecraft body skin, IGN/skin name, region, compact circular per-gamemode logos with tier codes, and overall points. Each mode uses its original gamemode logo: assigned modes show a crisp, full-colour logo and clearly highlighted tier badge; unassigned modes keep the logo visible but faded/grayscale with a quiet dash. The same visual treatment appears in player popups and shareable profile pages.
- Global search opens with `/` or `Ctrl+K`; partial and typo-tolerant matching; Enter/click opens a player popup.
- Player popup and shareable `/player/PlayerIGN` profile pages.
- Player comparison at `/compare`, including shareable query-string links and per-gamemode tier differences.
- Queue dashboard with live public queue positions and automatic refresh. No guessed wait-time estimates.
- Tester directory and dashboard using the existing Discord endpoint.
- TierTagger page with the real supplied `1.3.0` JAR and compatibility details copied from the former site.
- Optional subtle UI sound toggle (off by default), keyboard accessibility and reduced-motion CSS support.
- Cached-data fallback and clear stale/offline messaging.

### v2.2.0 visual repair

- Refreshed typography to **Plus Jakarta Sans** for interface text and **Space Grotesk** for display headings.
- Added global overflow and min-width safeguards to MUI cards, grids, chips, buttons, alerts and table cells.
- Increased previously tiny labels inside gamemode tier cards and player rows for readability.
- Reworked tablet and phone breakpoints for gamemode division cards, compare cards, profile actions, tester cards and queue cards.
- Added narrow-screen player-row fallbacks so skin, IGN, points and tier chips do not collide or clip.
- Preserved all API contracts, tier calculations, and the original `api_server.js`.

## Existing API and data safety

- **`api_server.js` is included byte-for-byte and is not modified.** Its source SHA-256 in this bundle is `2a7af00b2ad21161b92b2970ec4e0ae7649941f19a6ddcad257df6e55afe2557`.
- The frontend consumes the existing `/api/stats`, `/api/leaderboard`, `/api/player/:ign`, `/api/queue` and `/api/testers` endpoints. The backend remains responsible for tier calculations and leaderboard sort order.
- The gateway starts the original API/Discord bot process on a private internal port (`3101` by default) and exposes its HTTP API through the same public Railway service.
- The legacy single-player endpoint does not apply the hidden-player filter itself. The gateway checks that a requested IGN exists in the filtered public leaderboard before forwarding `/api/player/:ign`.
- The old backend WebSocket sends its complete in-memory state to any client that connects. The gateway intentionally does **not** forward that WebSocket. The MUI site uses efficient API polling instead.
- Historical rank snapshots, last-updated timestamps and individual testing histories are not exposed by the current backend. The UI does not fabricate those values. The testers endpoint does provide current-month and all-time tester counts; the homepage labels the available monthly total as “Tests This Month.”
- The backend data folder `eclipsetiers_data/` is intentionally not bundled. Keep your existing Railway persistent volume and mount it at exactly the same path used by your current service. The API builds this folder relative to `api_server.js`.

## Before deployment — important

Deploy this bundle as a replacement for the **existing website/API service**, not as a second Discord bot instance. Preserve the current Railway service's environment variables and persistent volume. Do not delete or replace the data volume. Make a backup of it before deploying.

Keep the existing secret and all bot configuration values, including `BOT_TOKEN`, `API_SECRET`, `CLIENT_ID`, `GUILD_ID`, `TIERER_ROLE_ID`, channel IDs and role IDs. Do not paste real tokens into GitHub. `PORT` is supplied by Railway; do not hardcode it. The child backend uses the internal port automatically.

## Railway deployment

1. Download and extract `EclipseTiers-Railway-MUI.zip`.
2. Upload the **contents** of this folder to the root of a GitHub repository. `package.json`, `railway-gateway.js` and `api_server.js` must be at the repository root.
3. In the existing Railway project, back up the service and its persistent `eclipsetiers_data` volume. Connect the service to the repository you just uploaded.
4. Keep all existing environment variables. Keep the same volume attached at the same mount path. Do not add a new blank volume in place of the existing one.
5. Use Railway's Railpack Node builder. Build command: `npm run build`. Start command: `npm start`. Node.js `22.12.0` or newer is required.
6. Set the service health-check path to `/healthz`. The endpoint returns healthy only after the private API answers `/api/stats`.
7. Deploy. Check `/healthz`, `/`, `/rankings`, `/queue`, `/compare`, `/testers`, `/tiertagger` and a real `/player/PlayerIGN` URL.
8. Attach `eclipsetiers.site` in Railway Networking and add the DNS record exactly as Railway displays it. Do not guess the target value.

This repository intentionally has no legacy `railway.json` or `railway.toml`. Use the Railway service dashboard to choose the Railpack build and health check settings.

## Local development

Requirements: Node.js `22.12.0+`.

```bash
npm install
```

For local frontend development, start the original backend in one terminal:

```bash
PORT=3001 node api_server.js
```

Then in another terminal:

```bash
npm run dev
```

Vite runs on `http://localhost:5173` and proxies API requests to `127.0.0.1:3001`.

For a production-style local run:

```bash
npm run build
npm start
```

The gateway serves the built site on `PORT` (defaults to `8080`) and starts `api_server.js` on `INTERNAL_API_PORT` (defaults to `3101`).

## Notes

- The Discord invite in the UI is the one already present in the supplied previous site: `https://discord.gg/ZRqHVHWfZY`.
- TierTagger compatibility on the download page follows the provided previous site: Minecraft `1.21.1–1.21.11`, Fabric Loader `0.16.0+`, Fabric API, ModMenu `11.0.3+`, Java `21+`.
- The homepage uses the actual supplied logo artwork as a visual image and the exact original mode images extracted from the supplied legacy HTML.
- No `api_server.js` changes, DB migrations or ranking formula changes are part of this frontend rebuild.


## Player row update

The leaderboard now presents the Minecraft skin head, IGN, skin source name, region, points, and every supported gamemode for each public ranked player. Gamemode cells use the original gamemode logos. Assigned modes show a crisp logo and tier-coloured badge; unassigned modes show a muted grayscale/faded logo with a subtle dash. Profiles and quick-view dialogs use the same complete 11-mode grid. The assignment count is derived from the live tier object; the tier calculations and API are unchanged.


## Gamemode logo clarity update

- All 11 original gamemode icons are shown in the player tier matrix.
- If the player has a tier, its gamemode icon is full opacity and the assigned tier appears in a tier-coloured pill.
- If no tier is assigned, that gamemode icon is grayscale and faded, with a quiet dash instead of a prominent placeholder.
- This is shared across leaderboard cards, desktop rows, quick-view profiles and dedicated player profile pages.

## Assigned / unassigned gamemode logo behavior

The current player matrix distinguishes the state visually: assigned tiers keep their original logo crisp, saturated and lightly highlighted, with the tier shown in its own color; modes without a current tier keep the logo visible but grayscale and softened, with only a muted dash. The mode-tier resolver accepts the API's legacy `DiaSMP` / `Diasmp` casing variants (and case variants for the other modes), preventing a real assigned tier from being shown as unassigned. No stored values or ranking calculations are changed.


## Dedicated gamemode leaderboard update

- Selecting an individual gamemode now opens the classic dedicated view, with players grouped into the five tier divisions, matching the previous site's per-gamemode layout.
- Each tier division shows its first 10 players by default and has its own **Show all N players** / **Show less** control. Empty divisions remain visible with a quiet empty message.
- Player rows show their mode-rank position, Minecraft skin head, IGN, skin source, region, overall points and their assigned tier in that gamemode.
- The original API's per-gamemode response order is preserved for the default view. Frontend filtering does not recalculate tiers or ranking points.
- Branded eclipse-orbit loading states, animated tier panels, staggered player-row entrances, hover transitions and reduced-motion handling are included. Cached data displays immediately; uncached gamemode switches show the custom loader.
- Overall rankings remain unchanged and keep their 100-row pagination. The 10-player preview applies to each tier group on individual gamemode views.
## v2.3.0 — Classic leaderboard player rows

- Rebuilt the overall leaderboard rows using the original EclipseTiers row hierarchy: rank medal, Minecraft body skin, IGN/skin name, region badge, compact gamemode icon slots and total points.
- Replaced the large per-player gamemode tile matrix in the leaderboard with a compact horizontal 11-mode logo strip. Assigned tiers show a crisp original logo and tier-coloured ring/value; unassigned modes use a muted grayscale logo and dash.
- Mobile leaderboard cards keep the same information hierarchy and show the 11 modes in a compact 6+5 grid.
- Dedicated gamemode split now restores the original five tier columns on wide displays and adapts down to three, two and one column at smaller breakpoints.
- Ranking order, API routes, point calculations, player data and `api_server.js` are not modified by this UI update.

