// OAuth 2.1 authorization endpoint. GET renders a minimal login page gated by
// the single connector secret; POST validates it and redirects back with an
// authorization code (PKCE-bound). This is the only human step in the flow.

import { checkLoginSecret, getClient, issueCode } from '@/lib/auth'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

function loginPage(params: Record<string, string>, error?: string): Response {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join('')
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connect Weight Room</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#0b0f17; color:#e2e8f0; font:16px/1.5 system-ui, sans-serif; }
  .card { width:min(92vw,360px); background:#111726; border:1px solid #26304a;
          border-radius:16px; padding:28px; }
  h1 { font-size:18px; margin:0 0 4px; }
  p { color:#94a3b8; font-size:14px; margin:0 0 20px; }
  label { display:block; font-size:13px; color:#94a3b8; margin-bottom:6px; }
  input[type=password] { width:100%; box-sizing:border-box; padding:12px;
          border-radius:10px; border:1px solid #26304a; background:#0b0f17;
          color:#e2e8f0; font-size:16px; }
  button { width:100%; margin-top:16px; padding:12px; border:0; border-radius:10px;
          background:#f97316; color:#fff; font-weight:700; font-size:16px; cursor:pointer; }
  .err { color:#f87171; font-size:13px; margin-bottom:12px; }
</style></head>
<body><form class="card" method="post" action="/oauth/authorize">
  <h1>Connect Weight Room</h1>
  <p>Enter your connector token to link this Claude connector to your gym data.</p>
  ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
  <label for="password">Connector token</label>
  <input id="password" name="password" type="password" autocomplete="off" autofocus />
  ${hidden}
  <button type="submit">Connect</button>
</form></body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

function carriedParams(sp: URLSearchParams): Record<string, string> {
  const keep = ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method']
  const out: Record<string, string> = {}
  for (const k of keep) {
    const v = sp.get(k)
    if (v != null) out[k] = v
  }
  return out
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const params = carriedParams(searchParams)
  if (!params.redirect_uri) {
    return new Response('Missing redirect_uri', { status: 400 })
  }
  return loginPage(params)
}

export async function POST(req: Request) {
  const form = await req.formData()
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : ''
  }
  const params = {
    response_type: get('response_type'),
    client_id: get('client_id'),
    redirect_uri: get('redirect_uri'),
    scope: get('scope'),
    state: get('state'),
    code_challenge: get('code_challenge'),
    code_challenge_method: get('code_challenge_method'),
  }
  const password = get('password')

  if (!params.redirect_uri) return new Response('Missing redirect_uri', { status: 400 })

  if (!checkLoginSecret(password)) {
    return loginPage(params, 'That token was not correct. Try again.')
  }

  // If the client registered redirect URIs, the requested one must be among
  // them. Unregistered clients (some MCP clients skip DCR) are allowed — the
  // secret is the real gate.
  if (params.client_id) {
    const client = await getClient(params.client_id)
    if (client && client.redirectUris.length && !client.redirectUris.includes(params.redirect_uri)) {
      return new Response('redirect_uri not registered for this client', { status: 400 })
    }
  }

  const code = await issueCode({
    clientId: params.client_id || 'public',
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge || null,
    codeMethod: params.code_challenge_method || null,
    scope: params.scope || null,
  })

  const redirect = new URL(params.redirect_uri)
  redirect.searchParams.set('code', code)
  if (params.state) redirect.searchParams.set('state', params.state)
  return Response.redirect(redirect.toString(), 302)
}
