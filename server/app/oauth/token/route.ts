// OAuth 2.1 token endpoint — authorization_code (with PKCE) and refresh_token.
import { consumeCode, issueTokens, refreshTokens, verifyPkce } from '@/lib/auth'
import { jsonCors, corsPreflight } from '@/lib/http'

export function OPTIONS() {
  return corsPreflight()
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonCors({ error: 'invalid_request', error_description: 'Expected form-encoded body.' }, 400)
  }
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : ''
  }
  const grantType = get('grant_type')

  if (grantType === 'authorization_code') {
    const code = get('code')
    const redirectUri = get('redirect_uri')
    const verifier = get('code_verifier')
    if (!code) return jsonCors({ error: 'invalid_request', error_description: 'Missing code.' }, 400)

    const row = await consumeCode(code)
    if (!row) return jsonCors({ error: 'invalid_grant', error_description: 'Code invalid, used, or expired.' }, 400)
    if (redirectUri && row.redirectUri && redirectUri !== row.redirectUri) {
      return jsonCors({ error: 'invalid_grant', error_description: 'redirect_uri mismatch.' }, 400)
    }
    if (row.codeChallenge && !verifyPkce(verifier, row.codeChallenge, row.codeMethod)) {
      return jsonCors({ error: 'invalid_grant', error_description: 'PKCE verification failed.' }, 400)
    }
    const tokens = await issueTokens(row.clientId, row.scope)
    return jsonCors({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    })
  }

  if (grantType === 'refresh_token') {
    const refreshToken = get('refresh_token')
    const tokens = await refreshTokens(refreshToken)
    if (!tokens) return jsonCors({ error: 'invalid_grant', error_description: 'Refresh token invalid.' }, 400)
    return jsonCors({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    })
  }

  return jsonCors({ error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` }, 400)
}
