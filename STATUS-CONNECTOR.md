# Weight Room — Live Connector build status

Glanceable progress for the client + server + database + MCP connector build.

**Current phase:** Built + proven in-process. Blocked on owner credentials for the LIVE deploy.
**Latest checker verdict:** In-process falsification checker GREEN — 24/24 server tests
(full OAuth+PKCE+DCR handshake, bad/missing token → 401, reads match DB, write can't
touch history, no delete/overwrite tool exists, real-backup round-trip, torture cases).
Client: 85/85, builds clean.
**Last deploy:** (not deployed yet — needs Neon URL + Vercel access)
**Biggest open gap:** Owner must provide a Neon dev connection string + a fresh JSON
export (for migration), and either a Vercel token or self-deploy, so the server can go
live and the fresh-context sub-agent checker + real Claude.ai connect can run.

## Architecture (approved plan)

- **Client** stays a static Vite SPA on GitHub Pages — no rewrite, no change to the
  log-a-set flow. Gains one opt-in background sync module (`src/lib/dbSync.js`).
- **Server** = new Next.js app in `server/`, deployed to Vercel as its own project,
  reusing the backpacking-gear-calculator Neon + migrations pattern. Hosts the DB,
  the JSON API, and the remote MCP endpoint at `/mcp`.
- Client ↔ server over HTTPS (CORS-allowlisted to the Pages origin). Claude ↔ server
  server-to-server at `/mcp`.

## Data model

- `app_state` — one JSONB row holding `{ machines, workouts, sets, routines, settings }`,
  identical in shape to `buildBackupPayload`. Round-trips to the backup format losslessly.
- `photos` — one row per machineId (dataURL + hash), synced lazily.
- `planned_sessions` — Claude's write target, SEPARATE from all logged history.
- OAuth tables (`oauth_clients`, `oauth_codes`, `access_tokens`) for the connector auth.

## House-rule enforcement

1. Data sacred — DB stores the exact backup document; `GET /api/export` reconstructs it.
2. Never slower — sync is debounced/background/non-blocking; zero change to logging.
3. Token is a secret — server reads it from env only; never in repo/bundle/logs.
4. Least privilege — write tools INSERT into `planned_sessions`/`routines` only; no code
   path from MCP to UPDATE/DELETE of `sets`/`workouts`.
5. Fresh-context checker sub-agents audit the five rules + try to falsify the done-bar.

## Progress log

- [done] Server scaffold (Next.js + Neon), schema migrations, DB layer.
- [done] Ported metrics + normalization; app_state round-trips a real backup losslessly.
- [done] JSON API: /api/state (GET/PUT), /api/planned-sessions (+consume), /api/export,
  /api/photos, /api/health. CORS to the Pages origin, bearer-gated.
- [done] MCP server at /mcp (Streamable HTTP): 6 read tools + 1 least-privilege write
  (create_planned_session → planned_sessions only).
- [done] Auth: OAuth 2.1 + PKCE + DCR (metadata, /oauth/register|authorize|token),
  single-secret login gate, bearer-swappable via CONNECTOR_AUTH_MODE.
- [done] Client: src/lib/dbSync.js (background push, offline-tolerant, lazy photos),
  ConnectorSync (pulls Claude's plans → session plan, live), Settings connector card.
  Log-a-set flow untouched; 85/85 client tests still green.
- [done] Migration script (db:import, replace or idempotent --merge).
- [done] Tests: 24 server (pglite) incl. the in-process falsification checker + torture
  cases; real pre-migration backup round-trips value-identically.
- [BLOCKED] Live deploy to Vercel + fresh-context sub-agent checker vs the deployed URL +
  house-rules checker — needs owner credentials (see "Biggest open gap").

## Owner to-do (unblocks the finish)

1. Create a Neon Postgres DB and hand me its connection string (a dev/throwaway one is
   fine — rotate after).
2. Export a fresh JSON backup from the app (Settings → Data → Export) and give it to me,
   for the one-time migration.
3. Either paste a short-lived Vercel access token (I deploy + set env), or import the repo
   into Vercel yourself (root dir = server/) and I'll run the checker against your URL.
