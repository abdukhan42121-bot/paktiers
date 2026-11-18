# EclipseTiers · Railway MUI website (v2.6.4)

## v2.6.4 — Regional tester directory and Discord profiles

- The public `/testers` directory now includes only Discord members holding at least one of the six regional roles: `Tester-ME`, `Tester-AS`, `Tester-AU`, `Tester-EU`, `Tester-NA`, or `Tester-SA`. Legacy tierer roles and direct member permissions do not make someone publicly visible in the tester directory.
- Tester profiles display their Discord avatar, Discord name, region role(s), online status when Discord presence is available, linked Minecraft IGN/account details when registered, assigned gamemodes, Discord server join date, and real saved tier-record counts/activity.
- Selecting a tester card opens a responsive profile dialog with the available details and actions to open their Discord profile or join the EclipseTiers Discord server to ask a question.
- If a person holds multiple regional tester roles, all assigned regions are shown. No profile, rank, role, or activity information is fabricated.
- The existing six roles are provisioned by the bot. Assign `Tester-*` roles to the correct staff members in Discord; the website directory refreshes from the bot API automatically.

### Validation

`node --check api_server.js` and `node --check railway-gateway.js` passed. The React JSX was parser-checked using the installed TypeScript TSX parser. Dependencies are not installed in this workspace, so a Vite production build and live Discord API test were not run.

## v2.6.3 — Regional tester roles and `/skip`

- The bot automatically provisions six manual-assignment regional tester roles: `Tester-ME`, `Tester-AS`, `Tester-AU`, `Tester-EU`, `Tester-NA`, and `Tester-SA`.
- Each regional tester role can pull from its own region's waitlists and view/manage only that region's private waitlist channels and matching testing tickets. Existing global staff/tester permissions still work.
- Newly created single-player and group testing tickets include the relevant regional tester role for access, and the regional team is mentioned when the ticket opens.
- `/skip` is available inside an active tier-testing ticket when no test was taken (for example, the player did not respond). It records `Skipped — test not taken`, who marked it, and an optional reason. It never awards or changes a tier.
- For a group ticket with multiple pending players, use `/skip player:@user` to skip only that player. The ticket is archived to `/testinglogs` once every participant has a result or skip status. `/resultlogs` is not required for a skipped test.
- Let the bot reconnect after deployment to create the six tester roles, then assign each role manually to the correct regional testers in Discord. The role IDs are also saved in `regional_queue_setup.json`.

### Validation

`npm run check` (Node syntax checks for `api_server.js` and `railway-gateway.js`) passed. The dependencies are not installed in this workspace, so a Vite production build and live Discord interaction test were not run.

## v2.6.2 — Regional registration panel fix

- Replaced the outdated “Global server” panel copy with clear instructions for profile registration, selecting a gamemode role, and joining the matching regional queue.
- The registration region menu now shows all six supported codes with readable names: ME, AS, AU, EU, NA and SA.
- Corrected the registration flow labels to three steps: account type, region, and Minecraft IGN.
- `/setuppanel` now refreshes the existing recent registration/waitlist panel instead of always leaving a stale duplicate; it sends a new panel only when no matching panel is found.
- Gamemode role labels now explain that the role belongs to the member’s saved region. The queue instructions clarify that selecting a role does not itself place the member in a queue; they still press **Join waitlist** in the matching regional channel.
- Points, tier values, leaderboard ordering and tier calculations were not changed.

### Validation

`node --check api_server.js` and `node --check railway-gateway.js` passed. A full Vite production build and live Discord interaction test were not run in this workspace.

## v2.5.1 — Section crash fix

- Fixed a render-time `ReferenceError` in the shared tier-history card (`color` is now correctly read from the `colour` value). This crash could blank the History page and any player profile/dialog displaying tier history.
- Added a route-level React error boundary. If a future section component fails, the rest of the site remains visible and the visitor gets Reload / Return Home actions instead of a blank black screen. The underlying diagnostic is logged to the browser console.
- Hardened queue/history/tester rendering against null or unexpected API record shapes.
- Normalized numeric timestamps in seconds or milliseconds for display.
- At the v2.5.1 checkpoint, kept `api_server.js` byte-for-byte unchanged; the later v2.6.0+ regional queue releases extend that file.

### Validation

The gateway and legacy API pass Node syntax checks; React JSX transpilation, CSS parsing, and package JSON parsing pass. The production Vite build still needs to run in Railway because dependencies could not be installed in this workspace.


A complete dark-only **React + Material UI** rebuild of the EclipseTiers public website, packaged to deploy on Railway. `railway-gateway.js` serves the website and starts the included API + Discord bot. The regional waitlist releases extend `api_server.js` with private regional queues and registration/role synchronization; the existing points, tier values and leaderboard calculations are preserved.

## Download and files

The project ZIP contains the entire deployable source. Important root files:

| File/folder | Purpose |
|---|---|
| `package.json` | Node dependencies, build and start scripts |
| `railway-gateway.js` | Public Railway entry point, frontend serving and private API proxy |
| `api_server.js` | API + Discord bot, including regional registration and queue provisioning |
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
- Queue dashboard with live public queue positions, join timestamps, elapsed waiting time, recent observed queue movement and automatic refresh. No guessed wait-time estimates.
- History & Activity page with searchable saved test/tier outcomes, available match archive, observed queue events and current live waitlist. Player profiles also include a recorded tier-update timeline.
- Regional tester directory and dashboard using the Discord API; only holders of `Tester-ME`, `Tester-AS`, `Tester-AU`, `Tester-EU`, `Tester-NA`, or `Tester-SA` appear. Discord-avatar cards open responsive profiles with available Minecraft details, region roles, assigned gamemodes, real tier-record activity and Discord contact actions.
- TierTagger page with the real supplied `1.3.0` JAR and compatibility details copied from the former site.
- Global motion: tactile click feedback, tile/card hover movement, page entrance, dialog/menu/drawer transitions, tab indicator motion and animated history rows. OS and manual reduced-motion settings are respected. Optional subtle UI sound toggle remains off by default.
- Cached-data fallback and clear stale/offline messaging.

### v2.2.0 visual repair

- Refreshed typography to **Plus Jakarta Sans** for interface text and **Space Grotesk** for display headings.
- Added global overflow and min-width safeguards to MUI cards, grids, chips, buttons, alerts and table cells.
- Increased previously tiny labels inside gamemode tier cards and player rows for readability.
- Reworked tablet and phone breakpoints for gamemode division cards, compare cards, profile actions, tester cards and queue cards.
- Added narrow-screen player-row fallbacks so skin, IGN, points and tier chips do not collide or clip.
- Preserved all API contracts, tier calculations, and the original `api_server.js`.

## Existing API and data safety

- `api_server.js` contains the regional registration and queue additions described in the v2.6.1/v2.6.2 notes. Existing points, tier values, leaderboard order and tier-calculation logic are preserved.
- The frontend consumes the existing `/api/stats`, `/api/leaderboard`, `/api/player/:ign`, `/api/queue` and `/api/testers` endpoints. The gateway adds read-only `/public-api/activity` and `/public-api/player-history/:ign` endpoints for safe history display. The backend remains responsible for tier calculations and leaderboard sort order.
- The gateway starts the original API/Discord bot process on a private internal port (`3101` by default) and exposes its HTTP API through the same public Railway service.
- The legacy single-player endpoint does not apply the hidden-player filter itself. The gateway checks that a requested IGN exists in the filtered public leaderboard before forwarding `/api/player/:ign`.
- The old backend WebSocket sends its complete in-memory state to any client that connects. The gateway intentionally does **not** forward that WebSocket. The MUI site uses efficient API polling instead.
- The legacy backend stores tier-update events in `tier_logs.json`, which the new gateway exposes as recorded tier-update history. It does not store periodic rank snapshots or a complete history of all test sessions (especially failed submissions). The UI does not fabricate those missing records. The testers endpoint provides current-month and all-time counts derived from the saved tier logs.
- The backend data folder `eclipsetiers_data/` is intentionally not bundled. Keep your existing Railway persistent volume and mount it at exactly the same path used by your current service. The API builds this folder relative to `api_server.js`.

## Before deployment — important

Deploy this bundle as a replacement for the **existing website/API service**, not as a second Discord bot instance. Preserve the current Railway service's environment variables and persistent volume. Do not delete or replace the data volume. Make a backup of it before deploying.

Keep the existing secret and all bot configuration values, including `BOT_TOKEN`, `API_SECRET`, `CLIENT_ID`, `GUILD_ID`, `TIERER_ROLE_ID`, channel IDs and role IDs. Do not paste real tokens into GitHub. `PORT` is supplied by Railway; do not hardcode it. The child backend uses the internal port automatically.

## Railway deployment

1. Download and extract the latest `EclipseTiers-Railway-MUI-v2.6.2-Regional-Registration-Fix.zip`.
2. Upload the **contents** of this folder to the root of a GitHub repository. `package.json`, `railway-gateway.js` and `api_server.js` must be at the repository root.
3. In the existing Railway project, back up the service and its persistent `eclipsetiers_data` volume. Connect the service to the repository you just uploaded.
4. Keep all existing environment variables. Keep the same volume attached at the same mount path. Do not add a new blank volume in place of the existing one.
5. Use Railway's Railpack Node builder. Build command: `npm run build`. Start command: `npm start`. Node.js `22.12.0` or newer is required.
6. Set the service health-check path to `/healthz`. The endpoint returns healthy only after the private API answers `/api/stats`.
7. Deploy. Check `/healthz`, `/`, `/rankings`, `/queue`, `/compare`, `/testers`, `/history`, `/tiertagger`, `/public-api/activity` and a real `/player/PlayerIGN` URL. After a queue change, check that `eclipsetiers_data/queue_history.json` is created on the existing persistent volume.
8. Attach `eclipsetiers.site` in Railway Networking and add the DNS record exactly as Railway displays it. Do not guess the target value.

This repository intentionally has no legacy `railway.json` or `railway.toml`. Use the Railway service dashboard to choose the Railpack build and health check settings.

## Local development

Requirements: Node.js `22.12.0+`.

```bash
npm install
```

For local frontend development, start the gateway in one terminal:

```bash
PORT=8080 node railway-gateway.js
```

Then in another terminal:

```bash
npm run dev
```

Vite runs on `http://localhost:5173` and proxies the legacy API to the gateway child on `127.0.0.1:3101`, plus `/public-api` to the gateway on `127.0.0.1:8080`.

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
- No ranking formula or stored tier-value changes are part of this rebuild. Regional queue data is stored separately from the legacy global queue.


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



## v2.5.0 — Expanded activity history and global interaction motion

- Expanded the site-wide motion system to cover all buttons, anchors, tabs, drawer/menu/dialog transitions, form focus states, gamemode tiles, player rows, queue entries, history cards, tier icons, clickable cards and page entrances. Hover, press, focus and entrance states use a consistent timing curve; operating-system reduced-motion preferences and the manual reduced-motion toggle are respected.
- Added a public **History & Activity** page at `/history`, linked in desktop navigation, the mobile drawer, the footer and the homepage. It has Tier Updates, Match Records and Live Queue tabs.
- Added per-player tier-update timelines to the quick-view profile and dedicated `/player/:IGN` page.
- Improved the queue page with explicit current positions, join timestamps, elapsed waiting time, recent observed queue movement, a match archive section and a clear explanation of what queue data the existing bot does not retain.
- Added safe, read-only gateway endpoints `/public-api/activity` and `/public-api/player-history/:ign`. These return only public IGN, gamemode, tier, old tier, tester display name and timestamps; Discord IDs and ticket identifiers are omitted, and hidden users are excluded.
- Added a gateway-side observer for the existing persistent `queue.json`. It writes public-safe join/removal observations to `eclipsetiers_data/queue_history.json` from this release onward, without editing `api_server.js`. The observer is best-effort: very short-lived file changes between observations may be missed. It does not label whether a removal was a tester pull or a voluntary leave.
- Activity endpoints read `eclipsetiers_data/tier_logs.json` and `matches.json`, the same data directory used by the existing bot. The original `api_server.js` remains byte-for-byte unchanged.

### History data limitations (important)

- `tier_logs.json` records tier updates with the player, gamemode, tier, old tier, staff display name and timestamp. It is not a full test-session database: the existing bot does not persist failed `/submitresult` submissions as public test records, and `/tier set` entries can also be present. The website labels these as **recorded tier updates**, not a complete record of every test.
- The existing queue file remains a **current waitlist** with `joinedAt` timestamps. The gateway observes changes to that file and begins a separate public-safe queue archive from this release onward. This cannot reconstruct older events, may miss very short-lived changes, and cannot distinguish a tester pull from a voluntary leave.
- The match archive is exposed only when records actually exist in `matches.json`. The current bot flow does not consistently write match records to that file, so an empty archive remains an honest empty state.
- The backend does not store periodic rank snapshots. Historical rank position and rank-over-time charts are not generated from incomplete tier logs.

### Local development for v2.5.0

Start the gateway (it launches the existing API/Discord process on internal port `3101` and serves the public read-only activity endpoints on `8080`):

```bash
PORT=8080 node railway-gateway.js
```

In another terminal run Vite:

```bash
npm run dev
```

Vite proxies `/api`, `/v2`, `/rankings` and `/bot` to the internal API port `3101`, and `/public-api` to the gateway at `8080`.


## v2.5.0 verification notes

- At the v2.5.0 checkpoint, `api_server.js` remained byte-for-byte identical to the supplied original backend; later regional releases added the isolated registration and queue functionality.
- The new queue archive is produced by the gateway as a separate file in the same persistent data directory; it is not a migration of the bot's current waitlist.
- The History page separates saved tier/test outcomes, archived match records, observed queue events and the current live queue. Data that the backend does not persist is clearly labelled unavailable.
- Run `npm run build` with Node.js `22.12.0+` to produce the production assets before `npm start`. The package includes source; `node_modules`, `dist`, `.env` and user data are intentionally excluded.

---

## v2.6.0 — Six private regional waitlists

The Discord bot now supports exactly six region codes: **ME, AS, AU, EU, NA, SA**. Registration uses those codes only; older stored country names are normalized into their closest supported region where possible (Pakistan/India → AS, UAE/Saudi Arabia → ME, Australia → AU, UK → EU, USA/Canada/Mexico → NA). An unknown/Other legacy value is not silently assigned to a random region; the player should update their profile and choose one of the six codes.

### What the bot provisions

On bot startup, and on demand with `/setupregionalqueues`, the bot creates or repairs:

- 6 region access roles: `Region-ME`, `Region-AS`, `Region-AU`, `Region-EU`, `Region-NA`, `Region-SA`.
- 66 gamemode waitlist roles: `Waitlist-ME-Sword`, `Waitlist-AS-Sword`, etc. (one per region × each of the 11 configured gamemodes).
- 6 private Discord categories (`me-waitlists`, `as-waitlists`, etc.).
- 66 text channels (one channel per gamemode inside each region category), each with its own persistent Join / Leave / Pull panel.

A registered member receives only the region access role matching their profile. Each region category denies `View Channel` to `@everyone`, grants it to that one region role, and also grants access to configured tester/tierer/ticket-staff queue roles and the bot. Administrator roles continue to bypass channel restrictions. Each member can therefore see only their selected region's waitlist categories, while authorized staff can moderate all regions.

The per-region waitlist button accepts players only when the code in their registered profile matches the category. Join assigns the matching region × gamemode waitlist role; Leave and Pull remove that role. Pull remains limited to testers/staff with queue permission and opens the existing testing ticket workflow. The old global queue file and its legacy button IDs are retained for compatibility; new regional queue data is stored separately.

### Required Discord permissions

The bot needs **Manage Roles**, **Manage Channels**, **View Channels**, **Send Messages**, **Read Message History**, **Embed Links**, and **Manage Messages**. Move the bot's highest role above the newly created `Region-*` and `Waitlist-*-*` roles. The server also needs enough remaining capacity for up to 72 additional roles and 72 channels (6 categories + 66 text channels). Existing roles/channels are found and reused by name, so restarts do not duplicate them.

If startup provisioning cannot finish, grant the permissions above and run `/setupregionalqueues` as a server administrator. `/startqueue` now points to an existing regional gamemode channel and refreshes its panel.

### Persistent Railway data

Keep the existing `eclipsetiers_data` volume mounted at the same path (`/app/eclipsetiers_data` when the project root is `/app`). The bot writes:

- `regional_queues.json` — current queues grouped by region and gamemode.
- `regional_queue_setup.json` — role, category and channel IDs used for idempotent setup.
- `regional_queue_panels.json` — persistent regional panel message IDs.
- `regional_queue_history.json` — queue events observed from the new regional waitlists.

Do not replace the existing volume with a new empty one. Back it up before deploying. Existing old country names are mapped when recognized; an `Other`/unknown region needs the player to update their profile.

### Website behaviour

The `/queue` page displays six region selectors and renders only the selected region's waitlists. `/api/queue` continues returning the legacy `queues` object for compatibility and adds `regionalQueues` keyed by the six region codes. History merges the existing legacy queue archive and the new regional queue archive.

### Deployment

Deploy all files in this package to the same Railway service that runs `railway-gateway.js`. Keep existing environment variables (`BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `API_SECRET`, and the existing application/ticket channel and role IDs). The gateway starts the included `api_server.js`; this release necessarily adds the regional queue/Discord provisioning code to that server, while leaving the points, tier values, leaderboard sorting and tier calculation logic untouched. After deploy, check Railway logs for `[REGIONAL QUEUE] Infrastructure ready` and use `/setupregionalqueues` if necessary.


### Region-specific queue API and privacy safeguards

- The website requests `/api/queue?region=ME` (or one of the other five codes) when a region tab is selected. The response contains that requested region's queue bucket only; invalid region query values receive HTTP 400.
- The compatibility `queues` property remains present with empty arrays, so the old mixed-region `queue.json` is not re-exposed through the public queue endpoint. Homepage queue totals count only active regional waitlists.
- If the regional queue service has not been provisioned yet, the website shows a setup notice instead of falling back to the old mixed-region list.
- Recent queue events on the queue page are filtered to the selected region. Discord privacy is enforced separately with region roles and channel permission overwrites; testers/queue staff/admins can still access all regions.
- If an older player had an unrecognized region and a legacy waitlist entry, the entry is kept in the backup/legacy queue until the player updates their profile and chooses one of the six supported codes. The profile-update flow then attempts to migrate that player's remaining legacy entries into the selected regional queue.


## v2.6.1 — selected-region API and privacy hardening

- The website now calls `/api/queue?region=<CODE>` on every region selection. The API validates the code and returns only the selected region bucket. The legacy `queues` property stays present but contains empty arrays, so the old mixed-region waitlist is not publicly returned.
- The queue page no longer falls back to mixed legacy data if regional queue provisioning is missing; it shows a clear setup notice instead. Recent queue events are filtered to the selected region.
- Unsupported/unknown legacy region values are returned as unassigned instead of silently defaulting to AS. New registrations and bot registration API calls must supply one of ME, AS, AU, EU, NA or SA.
- Regional text channels are created with their permission overwrites immediately. Old unscoped waitlist channels have old generic waitlist-role overwrites removed, leaving only configured staff/bot access and denying @everyone, so legacy roles cannot reveal a mixed-region queue.
- When an existing player corrects an unknown region, the profile update attempts to migrate that player's remaining legacy queue entries into the selected region and restore the matching region/gamemode waitlist roles.
- Regional queues have no arbitrary player cap. Discord panel messages show a preview of up to 15 entries while preserving the full queue and its exact count.
- Points, tier values and existing leaderboard ranking calculations are unchanged. The Discord regional queue feature requires the isolated changes in `api_server.js`; this server file is therefore intentionally extended in this release.
