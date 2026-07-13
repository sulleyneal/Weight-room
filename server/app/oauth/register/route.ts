// RFC 7591 — OAuth Dynamic Client Registration. Claude registers a public
// client (PKCE, no secret) and gets a client_id.
import { registerClient } from '@/lib/auth'
import { jsonCors, corsPreflight } from '@/lib/http'

export function OPTIONS() {
  return corsPreflight()
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonCors({ error: 'invalid_client_metadata', error_description: 'Body must be JSON.' }, 400)
  }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === 'string')
    : []
  const name = typeof body.client_name === 'string' ? body.client_name : null

  const client = await registerClient(redirectUris, name)
  return jsonCors(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: client.name ?? undefined,
    },
    201,
  )
}
