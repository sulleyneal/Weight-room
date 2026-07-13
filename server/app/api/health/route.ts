// Liveness probe — no auth, no data. Confirms the server + DB + schema are
// reachable. It actually SELECTs from app_state so it can't report ok while the
// table is missing (a past migration bug hid exactly that).
import { ensureSchema, getSql } from '@/lib/db'
import { apiJson, apiPreflight } from '@/lib/http'
import { authMode } from '@/lib/auth'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  let db = 'ok'
  try {
    await ensureSchema()
    await getSql()`SELECT 1 FROM app_state LIMIT 1`
  } catch {
    db = 'unavailable'
  }
  // tokenConfigured reports only WHETHER a secret is set (never its value), so a
  // missing/blank CONNECTOR_TOKEN can be diagnosed without leaking anything.
  return apiJson(req, {
    ok: db === 'ok',
    db,
    authMode: authMode(),
    tokenConfigured: Boolean(process.env.CONNECTOR_TOKEN),
  })
}
