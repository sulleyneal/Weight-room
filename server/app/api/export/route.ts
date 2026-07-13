// Full backup export — the exact { app, schemaVersion, exportedAt, data, photos }
// shape the client and other tools already read. Auth-gated.
import { buildBackupPayload } from '@/lib/state'
import { requireApiAuth } from '@/lib/apiAuth'
import { apiJson, apiPreflight } from '@/lib/http'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  const payload = await buildBackupPayload()
  return apiJson(req, payload)
}
