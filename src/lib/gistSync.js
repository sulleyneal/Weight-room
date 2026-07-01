// Cloud backup via a private GitHub Gist.
//
// Opt-in per device: the token and gist id live in their own localStorage keys,
// separate from app data, so they are NEVER included in JSON exports or synced
// backups. Anyone using the app without connecting sync is completely
// unaffected — everything stays local for them.
//
// Model: the whole backup payload (same shape as Settings → Export, photos
// included) is written to one file in a secret gist. Last write wins; restore
// is an explicit action. The token needs only the "gist" scope.

const CFG_KEY = 'weight-room:gist-sync' // { token, gistId }
const META_KEY = 'weight-room:gist-meta' // { lastSync, error }
const FILE_NAME = 'weight-room-backup.json'
const API = 'https://api.github.com'

export function getSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null
  } catch {
    return null
  }
}

export function setSyncConfig(cfg) {
  if (cfg && cfg.token) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
  } else {
    localStorage.removeItem(CFG_KEY)
    localStorage.removeItem(META_KEY)
  }
  notify()
}

export function isSyncEnabled() {
  return Boolean(getSyncConfig()?.token)
}

export function getSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {}
  } catch {
    return {}
  }
}

function setMeta(patch) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...getSyncMeta(), ...patch }))
  notify()
}

// Let UI (Settings) re-render when sync state changes.
function notify() {
  window.dispatchEvent(new Event('gist-sync-changed'))
}

export function onSyncChange(handler) {
  window.addEventListener('gist-sync-changed', handler)
  return () => window.removeEventListener('gist-sync-changed', handler)
}

async function gh(path, opts = {}) {
  const cfg = getSyncConfig()
  if (!cfg?.token) throw new Error('Sync is not connected.')
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub rejected the token. Check it has the "gist" scope.')
    if (res.status === 404) throw new Error('Backup gist not found (deleted, or token lacks access).')
    throw new Error(`GitHub error ${res.status}.`)
  }
  return res.json()
}

/** Upload the backup payload, creating the secret gist on first push. */
export async function pushBackup(payload) {
  const cfg = getSyncConfig()
  if (!cfg?.token) throw new Error('Sync is not connected.')
  const files = { [FILE_NAME]: { content: JSON.stringify(payload) } }
  try {
    let gist
    if (cfg.gistId) {
      gist = await gh(`/gists/${cfg.gistId}`, { method: 'PATCH', body: JSON.stringify({ files }) })
    } else {
      gist = await gh('/gists', {
        method: 'POST',
        body: JSON.stringify({ description: 'Weight Room backup', public: false, files }),
      })
      setSyncConfig({ ...cfg, gistId: gist.id })
    }
    setMeta({ lastSync: Date.now(), error: null })
    return gist.id
  } catch (err) {
    setMeta({ error: err.message })
    throw err
  }
}

/** Download and parse the latest cloud backup. */
export async function pullBackup() {
  const cfg = getSyncConfig()
  if (!cfg?.gistId) throw new Error('No cloud backup exists yet — sync once first.')
  const gist = await gh(`/gists/${cfg.gistId}`)
  const file = gist.files?.[FILE_NAME]
  if (!file) throw new Error('Backup file missing from the gist.')
  let content = file.content
  if (file.truncated && file.raw_url) {
    // Large backups (photos) come back truncated; fetch the raw file.
    const res = await fetch(file.raw_url)
    if (!res.ok) throw new Error('Could not download the full backup file.')
    content = await res.text()
  }
  return JSON.parse(content)
}
