// Small response helpers. OAuth metadata / registration / token endpoints are
// fetched cross-origin by MCP clients, so they carry permissive CORS. The JSON
// data API uses a stricter, env-configured allowlist (see corsForApi).

export function jsonCors(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/** Allowed browser origins for the JSON data API (the Weight Room client). */
export function apiAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOW_ORIGINS || 'https://sulleyneal.github.io'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** CORS headers for the data API: echo the origin if allow-listed. */
export function corsForApi(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = apiAllowedOrigins()
  const ok = allowed.includes('*') || allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin || allowed[0] : allowed[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function apiJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsForApi(req),
    },
  })
}

export function apiPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: { ...corsForApi(req), 'Access-Control-Max-Age': '86400' } })
}
