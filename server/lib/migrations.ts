/**
 * Schema migrations — ordered, tracked, idempotent (same pattern as the
 * backpacking-gear-calculator repo).
 *
 * Applied ids are recorded in `schema_migrations`, so `runMigrations` only runs
 * what's missing. The Neon HTTP driver runs ONE statement per round-trip, so
 * migrations are arrays of single, individually-idempotent statements.
 *
 * Tables:
 *   app_state        — one JSONB row: the whole Weight Room document, shape-
 *                      identical to a backup's `data`. Round-trips losslessly.
 *   photos           — one row per machineId (dataURL + hash), synced lazily.
 *   planned_sessions — Claude's ONLY write target. Separate from all logged
 *                      history; append/consume, never overwrites a set.
 *   oauth_clients / oauth_codes / access_tokens — connector auth.
 */
import type { Sql } from './db'

export interface Migration {
  id: number
  name: string
  statements: string[]
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'app_state + photos + planned_sessions',
    statements: [
      `CREATE TABLE IF NOT EXISTS app_state (
         id          TEXT PRIMARY KEY DEFAULT 'singleton',
         data        JSONB NOT NULL DEFAULT '{}'::jsonb,
         version     BIGINT NOT NULL DEFAULT 1,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS photos (
         machine_id  TEXT PRIMARY KEY,
         data_url    TEXT NOT NULL,
         hash        TEXT,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS planned_sessions (
         id           TEXT PRIMARY KEY,
         name         TEXT NOT NULL,
         date         TEXT,
         exercises    JSONB NOT NULL DEFAULT '[]'::jsonb,
         source       TEXT NOT NULL DEFAULT 'claude',
         status       TEXT NOT NULL DEFAULT 'pending',
         created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
         consumed_at  TIMESTAMPTZ
       )`,
      `CREATE INDEX IF NOT EXISTS planned_sessions_status_idx
         ON planned_sessions (status, created_at)`,
    ],
  },
  {
    id: 2,
    name: 'oauth: clients, codes, access tokens',
    statements: [
      `CREATE TABLE IF NOT EXISTS oauth_clients (
         client_id      TEXT PRIMARY KEY,
         client_secret  TEXT,
         redirect_uris  JSONB NOT NULL DEFAULT '[]'::jsonb,
         name           TEXT,
         created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS oauth_codes (
         code            TEXT PRIMARY KEY,
         client_id       TEXT NOT NULL,
         redirect_uri    TEXT NOT NULL,
         code_challenge  TEXT,
         code_method     TEXT,
         scope           TEXT,
         expires_at      TIMESTAMPTZ NOT NULL,
         used            BOOLEAN NOT NULL DEFAULT false,
         created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS access_tokens (
         token       TEXT PRIMARY KEY,
         client_id   TEXT,
         scope       TEXT,
         expires_at  TIMESTAMPTZ,
         created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    ],
  },
  {
    id: 3,
    name: 'repair: ensure all tables exist (fixes silent DDL no-op)',
    // Migrations 1 & 2 were recorded as applied while their raw-DDL statements
    // silently no-op'd (a neon driver-adapter bug), so their tables never got
    // created and are now skipped. This re-runs every CREATE idempotently; on a
    // healthy DB it's a harmless no-op, on the broken one it heals the schema.
    statements: [
      `CREATE TABLE IF NOT EXISTS app_state (
         id          TEXT PRIMARY KEY DEFAULT 'singleton',
         data        JSONB NOT NULL DEFAULT '{}'::jsonb,
         version     BIGINT NOT NULL DEFAULT 1,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS photos (
         machine_id  TEXT PRIMARY KEY,
         data_url    TEXT NOT NULL,
         hash        TEXT,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS planned_sessions (
         id           TEXT PRIMARY KEY,
         name         TEXT NOT NULL,
         date         TEXT,
         exercises    JSONB NOT NULL DEFAULT '[]'::jsonb,
         source       TEXT NOT NULL DEFAULT 'claude',
         status       TEXT NOT NULL DEFAULT 'pending',
         created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
         consumed_at  TIMESTAMPTZ
       )`,
      `CREATE INDEX IF NOT EXISTS planned_sessions_status_idx
         ON planned_sessions (status, created_at)`,
      `CREATE TABLE IF NOT EXISTS oauth_clients (
         client_id      TEXT PRIMARY KEY,
         client_secret  TEXT,
         redirect_uris  JSONB NOT NULL DEFAULT '[]'::jsonb,
         name           TEXT,
         created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS oauth_codes (
         code            TEXT PRIMARY KEY,
         client_id       TEXT NOT NULL,
         redirect_uri    TEXT NOT NULL,
         code_challenge  TEXT,
         code_method     TEXT,
         scope           TEXT,
         expires_at      TIMESTAMPTZ NOT NULL,
         used            BOOLEAN NOT NULL DEFAULT false,
         created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS access_tokens (
         token       TEXT PRIMARY KEY,
         client_id   TEXT,
         scope       TEXT,
         expires_at  TIMESTAMPTZ,
         created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    ],
  },
]

/**
 * Applies migrations not yet recorded in `schema_migrations`, in id order.
 * Safe to call repeatedly and concurrently (every statement is idempotent and
 * the tracking insert is guarded by ON CONFLICT).
 */
export async function runMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  const applied = (await sql`SELECT id FROM schema_migrations`) as { id: number }[]
  const done = new Set(applied.map((r) => Number(r.id)))

  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue
    for (const stmt of migration.statements) {
      await sql.unsafe(stmt)
    }
    await sql`
      INSERT INTO schema_migrations (id, name)
      VALUES (${migration.id}, ${migration.name})
      ON CONFLICT (id) DO NOTHING
    `
  }
}
