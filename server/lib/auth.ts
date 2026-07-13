// Connector auth — bearer-first, OAuth-swappable.
//
// Every protected request is authorized by ONE check: a valid bearer token
// (`verifyBearer`). A token is valid if it equals CONNECTOR_TOKEN (the static
// path — used directly in bearer mode, and as the OAuth login secret) or it's a
// live access token this server issued. OAuth just mints those tokens. Flipping
// CONNECTOR_AUTH_MODE between "oauth" and "bearer" needs no code change.
//
// House Rule 3: secrets come from env only, never logged, never in the client.

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { ensureSchema, getSql } from './db'

export function authMode(): 'oauth' | 'bearer' {
  return process.env.CONNECTOR_AUTH_MODE === 'bearer' ? 'bearer' : 'oauth'
}

function connectorToken(): string {
  return process.env.CONNECTOR_TOKEN || ''
}

/** Constant-time string compare that won't throw on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** True if the given password matches the connector secret (constant-time). */
export function checkLoginSecret(password: string): boolean {
  const secret = connectorToken()
  return Boolean(secret) && safeEqual(password, secret)
}

/**
 * True ONLY for the static connector secret — not OAuth-issued tokens. The
 * full-access sync REST API (state replace, photo delete) requires this, so a
 * token minted for Claude via OAuth can reach the MCP tools (read + create a
 * planned session) but can NEVER overwrite logged history. House Rule 4.
 */
export function verifyStaticToken(token: string | null): boolean {
  if (!token) return false
  const secret = connectorToken()
  return Boolean(secret) && safeEqual(token, secret)
}

/** Public base URL of this server (no trailing slash). */
export function baseUrl(req: Request): string {
  const configured = process.env.CONNECTOR_BASE_URL
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host
  return `${proto}://${host}`
}

/** Extract a Bearer token from the Authorization header, or null. */
export function bearerFromRequest(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1].trim() : null
}

/** True if the token is the static connector secret or a live issued token. */
export async function verifyBearer(token: string | null): Promise<boolean> {
  if (!token) return false
  const secret = connectorToken()
  if (secret && safeEqual(token, secret)) return true
  if (!token.startsWith('at_')) return false
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT expires_at FROM access_tokens WHERE token = ${token}
  `) as { expires_at: string | Date | null }[]
  if (!rows[0]) return false
  const exp = rows[0].expires_at
  if (exp && new Date(exp).getTime() < Date.now()) return false
  return true
}

// ---- PKCE ------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Verify an S256 (or plain) PKCE challenge against a verifier. */
export function verifyPkce(
  verifier: string,
  challenge: string | null,
  method: string | null,
): boolean {
  if (!challenge) return true // no challenge was registered
  if (method === 'plain') return safeEqual(verifier, challenge)
  const hash = base64url(createHash('sha256').update(verifier).digest())
  return safeEqual(hash, challenge)
}

// ---- OAuth storage ---------------------------------------------------------

export interface OAuthClient {
  clientId: string
  redirectUris: string[]
  name: string | null
}

/** Dynamic Client Registration — mint a client_id for a set of redirect URIs. */
export async function registerClient(
  redirectUris: string[],
  name: string | null,
): Promise<OAuthClient> {
  await ensureSchema()
  const sql = getSql()
  const clientId = `client_${randomUUID().replace(/-/g, '')}`
  await sql`
    INSERT INTO oauth_clients (client_id, redirect_uris, name)
    VALUES (${clientId}, ${JSON.stringify(redirectUris)}::jsonb, ${name})
  `
  return { clientId, redirectUris, name }
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT client_id, redirect_uris, name FROM oauth_clients WHERE client_id = ${clientId}
  `) as { client_id: string; redirect_uris: string[] | string; name: string | null }[]
  if (!rows[0]) return null
  const uris =
    typeof rows[0].redirect_uris === 'string'
      ? (JSON.parse(rows[0].redirect_uris) as string[])
      : rows[0].redirect_uris
  return { clientId: rows[0].client_id, redirectUris: uris, name: rows[0].name }
}

/** Store an authorization code (short-lived, single-use, PKCE-bound). */
export async function issueCode(params: {
  clientId: string
  redirectUri: string
  codeChallenge: string | null
  codeMethod: string | null
  scope: string | null
}): Promise<string> {
  await ensureSchema()
  const sql = getSql()
  const code = `code_${randomUUID().replace(/-/g, '')}`
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
  await sql`
    INSERT INTO oauth_codes (code, client_id, redirect_uri, code_challenge, code_method, scope, expires_at)
    VALUES (${code}, ${params.clientId}, ${params.redirectUri}, ${params.codeChallenge},
            ${params.codeMethod}, ${params.scope}, ${expires})
  `
  return code
}

export interface CodeRow {
  clientId: string
  redirectUri: string
  codeChallenge: string | null
  codeMethod: string | null
  scope: string | null
}

/** Consume an auth code once (marks it used). Returns its data, or null. */
export async function consumeCode(code: string): Promise<CodeRow | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    UPDATE oauth_codes SET used = true
     WHERE code = ${code} AND used = false AND expires_at > now()
    RETURNING client_id, redirect_uri, code_challenge, code_method, scope
  `) as {
    client_id: string
    redirect_uri: string
    code_challenge: string | null
    code_method: string | null
    scope: string | null
  }[]
  if (!rows[0]) return null
  return {
    clientId: rows[0].client_id,
    redirectUri: rows[0].redirect_uri,
    codeChallenge: rows[0].code_challenge,
    codeMethod: rows[0].code_method,
    scope: rows[0].scope,
  }
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}

/** Mint an access token (+ refresh token) for a client. */
export async function issueTokens(clientId: string, scope: string | null): Promise<IssuedTokens> {
  await ensureSchema()
  const sql = getSql()
  const accessToken = `at_${randomUUID().replace(/-/g, '')}`
  const refreshToken = `rt_${randomUUID().replace(/-/g, '')}`
  const expiresIn = 60 * 60 * 24 * 30 // 30 days
  const accessExp = new Date(Date.now() + expiresIn * 1000).toISOString()
  const refreshExp = new Date(Date.now() + 60 * 60 * 24 * 365 * 1000).toISOString() // 1 year
  await sql`
    INSERT INTO access_tokens (token, client_id, scope, expires_at)
    VALUES (${accessToken}, ${clientId}, ${scope}, ${accessExp})
  `
  await sql`
    INSERT INTO access_tokens (token, client_id, scope, expires_at)
    VALUES (${refreshToken}, ${clientId}, ${scope}, ${refreshExp})
  `
  return { accessToken, refreshToken, expiresIn, scope: scope || '' }
}

/** Exchange a refresh token for a new access token. Returns null if invalid. */
export async function refreshTokens(refreshToken: string): Promise<IssuedTokens | null> {
  if (!refreshToken.startsWith('rt_')) return null
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT client_id, scope, expires_at FROM access_tokens WHERE token = ${refreshToken}
  `) as { client_id: string | null; scope: string | null; expires_at: string | Date | null }[]
  if (!rows[0]) return null
  if (rows[0].expires_at && new Date(rows[0].expires_at).getTime() < Date.now()) return null
  return issueTokens(rows[0].client_id || 'unknown', rows[0].scope)
}
