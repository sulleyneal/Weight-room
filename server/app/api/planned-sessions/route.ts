// Client pull of Claude's planned sessions. GET returns pending plans (default)
// or all with ?status=all. Consuming a plan is POST /api/planned-sessions/[id].
import { listPlannedSessions } from '@/lib/planned'
import { requireApiAuth } from '@/lib/apiAuth'
import { apiJson, apiPreflight } from '@/lib/http'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const plans = await listPlannedSessions(status === 'all' ? undefined : 'pending')
  return apiJson(req, { plannedSessions: plans })
}
