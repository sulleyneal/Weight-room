// Connector sync — opt-in, local-first background sync to the Weight Room
// connector server (Neon-backed). The server URL + token live in their own
// localStorage keys, separate from app data, so they are NEVER part of a JSON
// export or backup. The app always logs locally first; this pushes in the
// background and pulls Claude's planned sessions. Nothing here blocks logging.

import { getAllPhotos } from './idb.js'

const CFG_KEY = 'weight-room:connector' // { url, token }
const META_KEY = 'weight-room:connector-meta' // { lastPush, lastPull, error, version }

export function getConnectorConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null
  } catch {
    return null
  }
}

export function setConnectorConfig(cfg) {
  if (cfg && cfg.url && cfg.token) {
    localStorage.setItem(
      CFG_KEY,
      JSON.stringify({ url: String(cfg.url).replace(/\/+$/, ''), token: cfg.token }),
    )
  } else {
    localStorage.removeItem(CFG_KEY)
    localStorage.removeItem(META_KEY)
  }
  notify()
}

export function isConnectorEnabled() {
  const cfg = getConnectorConfig()
  return Boolean(cfg?.token && cfg?.url)
}

export function getConnectorMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {}
  } catch {
    return {}
  }
}

function setMeta(patch) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...getConnectorMeta(), ...patch }))
  notify()
}

function notify() {
  window.dispatchEvent(new Event('connector-sync-changed'))
}

export function onConnectorChange(handler) {
  window.addEventListener('connector-sync-changed', handler)
  return () => window.removeEventListener('connector-sync-changed', handler)
}

async function api(path, opts = {}) {
  const cfg = getConnectorConfig()
  if (!cfg?.token || !cfg?.url) throw new Error('Connector is not configured.')
  const res = await fetch(`${cfg.url}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Connector rejected the token.')
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `Server error ${res.status}.`)
  }
  return res.json()
}

/** Health probe (no auth) — used by "Test connection". */
export async function testConnection() {
  const cfg = getConnectorConfig()
  if (!cfg?.url) throw new Error('Enter the connector URL first.')
  const res = await fetch(`${cfg.url}/api/health`)
  if (!res.ok) throw new Error(`Server returned ${res.status}.`)
  return res.json()
}

/** Push the whole app document (background, last-write-wins). */
export async function pushState(data) {
  try {
    const result = await api('/api/state', { method: 'PUT', body: JSON.stringify({ data }) })
    setMeta({ lastPush: Date.now(), error: null, version: result.version })
    return result
  } catch (err) {
    setMeta({ error: err.message })
    throw err
  }
}

/** Pull pending planned sessions written by Claude. */
export async function pullPlannedSessions() {
  const { plannedSessions } = await api('/api/planned-sessions?status=pending')
  setMeta({ lastPull: Date.now(), error: null })
  return plannedSessions || []
}

/** Mark a plan consumed after it's been loaded into a session. */
export async function consumePlannedSession(id) {
  return api(`/api/planned-sessions/${encodeURIComponent(id)}`, { method: 'POST' })
}

/** Pull the full backup from the server (for restore on a new device). */
export async function pullBackup() {
  return api('/api/export')
}

async function hashDataUrl(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return [...new Uint8Array(buf)]
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Non-secure context without SubtleCrypto — fall back to a cheap hash.
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return (h >>> 0).toString(16)
  }
}

/**
 * Lazy photo sync: only upload photos whose hash differs from the server's, and
 * remove server photos no longer present locally. Best-effort and background.
 */
export async function syncPhotos() {
  const { hashes } = await api('/api/photos')
  const local = await getAllPhotos()
  for (const [id, dataUrl] of Object.entries(local)) {
    if (!dataUrl) continue
    const h = await hashDataUrl(dataUrl)
    if (hashes[id] !== h) {
      await api('/api/photos', { method: 'PUT', body: JSON.stringify({ machineId: id, dataUrl, hash: h }) })
    }
  }
  for (const id of Object.keys(hashes)) {
    if (!(id in local)) {
      await api(`/api/photos?machineId=${encodeURIComponent(id)}`, { method: 'DELETE' })
    }
  }
}
