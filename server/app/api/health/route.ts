// Liveness probe — no auth, no data. Confirms the server + DB are reachable.
import { ensureSchema } from '@/lib/db'
import { apiJson, apiPreflight } from '@/lib/http'
import { authMode } from '@/lib/auth'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  let db = 'ok'
  try {
    await ensureSchema()
  } catch {
    db = 'unavailable'
  }
  return apiJson(req, { ok: db === 'ok', db, authMode: authMode() })
}
