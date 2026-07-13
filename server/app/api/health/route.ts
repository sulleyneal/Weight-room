// Liveness + schema diagnostic — no auth, no user data. Reports whether the DB
// is reachable, whether the core table exists, which migrations are recorded,
// and the real error if something throws (so schema issues can be diagnosed
// without DB access). Discloses no secrets.
import { ensureSchema, getSql } from '@/lib/db'
import { apiJson, apiPreflight } from '@/lib/http'
import { authMode } from '@/lib/auth'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  const out: Record<string, unknown> = {
    ok: false,
    authMode: authMode(),
    tokenConfigured: Boolean(process.env.CONNECTOR_TOKEN),
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
  }

  // Step 1: run migrations (report the real error if it throws).
  try {
    await ensureSchema()
    out.migrated = true
  } catch (e) {
    out.migrated = false
    out.migrateError = String((e as Error)?.message || e).slice(0, 400)
  }

  // Step 2: independently inspect the schema, even if step 1 threw.
  try {
    const sql = getSql()
    const reg = (await sql`SELECT to_regclass('public.app_state') AS t`) as { t: string | null }[]
    out.appStateExists = Boolean(reg[0]?.t)
    const migs = (await sql`SELECT id FROM schema_migrations ORDER BY id`) as { id: number }[]
    out.migrations = migs.map((m) => Number(m.id))
  } catch (e) {
    out.inspectError = String((e as Error)?.message || e).slice(0, 400)
  }

  out.ok = out.migrated === true && out.appStateExists === true
  out.db = out.ok ? 'ok' : 'unavailable'
  return apiJson(req, out)
}
