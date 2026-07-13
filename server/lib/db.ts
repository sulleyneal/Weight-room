/**
 * Database layer — Neon Postgres (serverless HTTP driver), reusing the
 * backpacking-gear-calculator pattern: lazy client, schema migrated on first
 * use and memoized per process.
 *
 * The `Sql` interface is a tagged-template query function plus `.unsafe(text)`
 * for raw DDL. Prod uses Neon; tests inject a pglite-backed implementation with
 * the same interface (see tests/helpers), so all SQL runs without a network.
 */
import { neon } from '@neondatabase/serverless'
import { runMigrations } from './migrations'

export type Sql = (<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>) & {
  unsafe: (text: string) => Promise<unknown>
}

let _sql: Sql | null = null

/** Inject a Sql implementation (tests). Pass null to reset to the real driver. */
export function setSql(sql: Sql | null): void {
  _sql = sql
  schemaReady = null
}

export function getSql(): Sql {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add the Neon integration in the Vercel ' +
        'Marketplace, or set DATABASE_URL in .env.local for local dev.',
    )
  }
  const base = neon(url)
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    base(strings, ...(values as never[]))) as unknown as Sql
  // Run raw DDL through neon's EXECUTING (tagged) path. neon detects a tagged
  // call by `Array.isArray(P) && Array.isArray(P.raw)`, so a one-element
  // template with a `.raw` runs `text` verbatim. NB: neon's own `sql.unsafe()`
  // returns a fragment for embedding — it does NOT execute — which silently
  // no-op'd every migration statement here before this fix.
  sql.unsafe = (text: string) => {
    const strings = Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray
    return base(strings)
  }
  _sql = sql
  return _sql
}

let schemaReady: Promise<void> | null = null

/** Runs pending migrations on first call, memoized per server process. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql()
    schemaReady = runMigrations(sql).catch((err) => {
      schemaReady = null // don't cache a failed migration
      throw err
    })
  }
  return schemaReady
}
