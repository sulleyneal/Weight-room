// Client sync of the whole app document. GET pulls; PUT pushes (last-write-wins
// with an optional version guard). Never touches planned_sessions.
import { loadState, saveState } from '@/lib/state'
import { requireApiAuth } from '@/lib/apiAuth'
import { apiJson, apiPreflight } from '@/lib/http'

export function OPTIONS(req: Request) {
  return apiPreflight(req)
}

export async function GET(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  const state = await loadState()
  return apiJson(req, state)
}

export async function PUT(req: Request) {
  const unauth = await requireApiAuth(req)
  if (unauth) return unauth
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return apiJson(req, { error: 'invalid_json' }, 400)
  }
  const data = 'data' in body ? body.data : body
  const ifVersion = typeof body.ifVersion === 'number' ? body.ifVersion : undefined
  try {
    const result = await saveState(data, { ifVersion })
    return apiJson(req, result, result.conflict ? 409 : 200)
  } catch (err) {
    return apiJson(req, { error: 'save_failed', message: (err as Error).message }, 400)
  }
}
