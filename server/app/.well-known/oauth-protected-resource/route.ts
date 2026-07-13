// RFC 9728 — OAuth Protected Resource Metadata. Points Claude at this server as
// its own authorization server.
import { baseUrl } from '@/lib/auth'
import { jsonCors, corsPreflight } from '@/lib/http'

export function OPTIONS() {
  return corsPreflight()
}

export function GET(req: Request) {
  const base = baseUrl(req)
  return jsonCors({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['weightroom'],
    bearer_methods_supported: ['header'],
  })
}
