// RFC 8414 — OAuth 2.1 Authorization Server Metadata. Advertises the authorize /
// token / registration endpoints and PKCE support so Claude can run the flow.
import { baseUrl } from '@/lib/auth'
import { jsonCors, corsPreflight } from '@/lib/http'

export function OPTIONS() {
  return corsPreflight()
}

export function GET(req: Request) {
  const base = baseUrl(req)
  return jsonCors({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['weightroom'],
  })
}
