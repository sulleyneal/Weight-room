# Weight Room — Live Connector build status

Glanceable progress for the client + server + database + MCP connector build.

**Current phase:** Foundation — server scaffold, schema, DB layer.
**Latest checker verdict:** (none yet — build in progress)
**Last deploy:** (not deployed yet)
**Biggest open gap:** need Neon dev connection string + Vercel deploy token from owner to run live e2e and deploy (path a).

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

- [in progress] Server scaffold (Next.js + Neon), schema migrations, DB layer.
