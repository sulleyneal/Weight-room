// Mark a planned session consumed once the client has loaded it into a session.
// Client-only, non-destructive (never removes logged history).
import { consumePlannedSession } from '@/lib/planned'
import { requireApiAuth } from '@/lib/apiAuth'
import { apiJson, apiPreflight } from '@/lib/http'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  const { id } = await ctx.params
  const ok = await consumePlannedSession(id)
  return apiJson(req, { ok, id })
}
