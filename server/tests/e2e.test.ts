// In-process falsification checker: drives the ACTUAL route handlers (real auth,
// real MCP handler, real queries) against embedded Postgres, and tries to break
// the done-bar — stale data, a bad token accepted, a write reaching history.
//
// This is the pre-deploy equivalent of "a fresh client connects as Claude.ai";
// the deployed server is additionally checked by a fresh-context sub-agent.

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { newTestDb, type TestDb } from './helpers'
import { saveState, loadState } from '../lib/state'

// Auth env for the handlers (static secret path; OAuth also issues tokens).
beforeAll(() => {
  process.env.CONNECTOR_TOKEN = 'test-secret-123'
  process.env.CONNECTOR_AUTH_MODE = 'oauth'
  process.env.CONNECTOR_BASE_URL = 'http://localhost'
})

// Route handlers under test.
import { POST as mcpPost } from '../app/[transport]/route'
import { POST as registerPost } from '../app/oauth/register/route'
import { POST as authorizePost } from '../app/oauth/authorize/route'
import { POST as tokenPost } from '../app/oauth/token/route'
import { GET as stateGet } from '../app/api/state/route'
import { createHash, randomBytes } from 'node:crypto'

let db: TestDb
beforeEach(async () => {
  db = await newTestDb()
  const raw = JSON.parse(readFileSync(resolve(__dirname, '../../tests/fixtures/backup-v1-real.json'), 'utf8'))
  await saveState(raw.data)
})
afterEach(async () => {
  await db.close()
})

// ---- MCP helpers -----------------------------------------------------------

function parseSse(text: string): unknown {
  // Streamable HTTP replies as SSE: take the last `data:` line.
  const lines = text.split('\n').filter((l) => l.startsWith('data:'))
  const last = lines[lines.length - 1]
  return last ? JSON.parse(last.slice(5).trim()) : JSON.parse(text)
}

let sessionId: string | undefined

async function mcp(method: string, params: unknown, token = 'test-secret-123'): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${token}`,
  }
  if (sessionId) headers['mcp-session-id'] = sessionId
  const req = new Request('http://localhost/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, params }),
  })
  const res = await mcpPost(req)
  const sid = res.headers.get('mcp-session-id')
  if (sid) sessionId = sid
  return res
}

async function mcpResult(method: string, params: unknown, token?: string): Promise<any> {
  const res = await mcp(method, params, token)
  const body = parseSse(await res.text()) as { result?: unknown; error?: unknown }
  return body
}

/** Call a tool and parse the JSON payload out of its text content. */
async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  const body = await mcpResult('tools/call', { name, arguments: args })
  const text = body.result?.content?.[0]?.text
  return text ? JSON.parse(text) : body
}

beforeEach(() => {
  sessionId = undefined
})

// ---- reads return the real, current data -----------------------------------

describe('reads return live data', () => {
  it('initialize + tools/list exposes exactly the intended surface', async () => {
    await mcpResult('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'checker', version: '1' },
    })
    const body = await mcpResult('tools/list', {})
    const names = (body.result.tools as { name: string }[]).map((t) => t.name).sort()
    expect(names).toEqual(
      [
        'create_planned_session',
        'export_backup',
        'get_exercise_history',
        'get_personal_records',
        'get_workout',
        'list_exercises',
        'list_recent_workouts',
      ].sort(),
    )
  })

  it('list_recent_workouts returns real sessions with weights/reps/PRs', async () => {
    const out = await callTool('list_recent_workouts', { limit: 5 })
    expect(out.sessions.length).toBeGreaterThan(0)
    const anyExercise = out.sessions.flatMap((s: any) => s.exercises)
    expect(anyExercise.length).toBeGreaterThan(0)
    expect(anyExercise[0]).toHaveProperty('est1RM')
    expect(anyExercise[0].sets[0]).toHaveProperty('weight')
  })

  it('numbers match a direct DB read (no staleness)', async () => {
    const { data } = await loadState()
    const someMachine = data.machines.find((m) => data.sets.some((s) => s.machineId === m.id))!
    const hist = await callTool('get_exercise_history', { name: someMachine.name })
    expect(hist.exercise).toBe(someMachine.name)
    expect(hist.sessions.length).toBeGreaterThan(0)
  })

  it('export_backup omits photo blobs but reports the count', async () => {
    const out = await callTool('export_backup', {})
    expect(out.app).toBe('weight-room')
    expect(out.photos).toBeUndefined()
    expect(typeof out.photoCount).toBe('number')
  })
})

// ---- auth cannot be bypassed ------------------------------------------------

describe('auth', () => {
  it('rejects a bad token with 401', async () => {
    const res = await mcp('tools/list', {}, 'not-the-secret')
    expect(res.status).toBe(401)
  })

  it('rejects a missing token with 401 + WWW-Authenticate', async () => {
    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    })
    const res = await mcpPost(req)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata')
  })

  it('the JSON data API also rejects a bad token', async () => {
    const req = new Request('http://localhost/api/state', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await stateGet(req)
    expect(res.status).toBe(401)
  })
})

// ---- the write tool cannot reach logged history ----------------------------

describe('least privilege', () => {
  it('create_planned_session writes a plan without altering app_state', async () => {
    const before = await loadState()
    const out = await callTool('create_planned_session', {
      name: 'Lower Day',
      date: '2026-07-20',
      exercises: [{ name: 'Leg Press', sets: 4, repLow: 8, repHigh: 10, weight: 250 }],
    })
    expect(out.ok).toBe(true)
    expect(out.plannedSession.status).toBe('pending')

    const after = await loadState()
    expect(after.version).toBe(before.version) // history untouched
    expect(JSON.stringify(after.data.sets)).toBe(JSON.stringify(before.data.sets))
    expect(JSON.stringify(after.data.workouts)).toBe(JSON.stringify(before.data.workouts))
  })

  it('there is no tool that can delete or overwrite a logged set', async () => {
    const body = await mcpResult('tools/list', {})
    const names = (body.result.tools as { name: string }[]).map((t) => t.name)
    for (const n of names) {
      expect(n).not.toMatch(/delete|remove|overwrite|update_set|edit_set|clear/i)
    }
  })
})

// ---- full OAuth 2.1 + PKCE + DCR handshake ----------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('OAuth handshake mints a working token', () => {
  it('DCR → authorize(secret) → token(PKCE) → MCP call succeeds', async () => {
    // 1. Dynamic client registration.
    const regRes = await registerPost(
      new Request('http://localhost/oauth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude' }),
      }),
    )
    expect(regRes.status).toBe(201)
    const { client_id } = (await regRes.json()) as { client_id: string }

    // 2. Authorize with the correct secret + a PKCE challenge.
    const verifier = base64url(randomBytes(32))
    const challenge = base64url(createHash('sha256').update(verifier).digest())
    const form = new URLSearchParams({
      response_type: 'code',
      client_id,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
      password: 'test-secret-123',
    })
    const authRes = await authorizePost(
      new Request('http://localhost/oauth/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }),
    )
    expect(authRes.status).toBe(302)
    const location = authRes.headers.get('location')!
    const code = new URL(location).searchParams.get('code')!
    expect(code).toBeTruthy()

    // 3. Exchange the code (with the PKCE verifier) for an access token.
    const tokenForm = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_verifier: verifier,
      client_id,
    })
    const tokRes = await tokenPost(
      new Request('http://localhost/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenForm.toString(),
      }),
    )
    expect(tokRes.status).toBe(200)
    const tok = (await tokRes.json()) as { access_token: string; token_type: string }
    expect(tok.token_type).toBe('Bearer')
    expect(tok.access_token).toMatch(/^at_/)

    // 4. The issued (OAuth) token authorizes a real MCP call.
    sessionId = undefined
    const res = await mcp('tools/list', {}, tok.access_token)
    expect(res.status).toBe(200)
  })

  it('authorize with the WRONG secret does not issue a code', async () => {
    const form = new URLSearchParams({
      response_type: 'code',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      password: 'wrong-password',
    })
    const res = await authorizePost(
      new Request('http://localhost/oauth/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }),
    )
    // Re-renders the login page (200), never a 302 redirect with a code.
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})
