import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  getConnectorConfig,
  setConnectorConfig,
  getConnectorMeta,
  onConnectorChange,
  isConnectorEnabled,
  pushState,
  syncPhotos,
  testConnection,
} from '../lib/dbSync.js'

function ago(ts) {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

function dataOf(state) {
  return {
    machines: state.machines,
    workouts: state.workouts,
    sets: state.sets,
    routines: state.routines,
    settings: state.settings,
  }
}

/**
 * Opt-in sync to the Weight Room connector (Neon-backed) so Claude can read your
 * history and write planned sessions back. URL + token are stored only on this
 * device, never in exports.
 */
export default function ConnectorSyncCard({ onStatus }) {
  const { state } = useStore()
  const [cfg, setCfg] = useState(getConnectorConfig())
  const [meta, setMeta] = useState(getConnectorMeta())
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      onConnectorChange(() => {
        setCfg(getConnectorConfig())
        setMeta(getConnectorMeta())
      }),
    [],
  )

  async function connect() {
    const u = url.trim()
    const t = token.trim()
    if (!u || !t) return
    setBusy(true)
    try {
      setConnectorConfig({ url: u, token: t })
      const health = await testConnection()
      if (!health.ok) throw new Error('Server reached, but its database is unavailable.')
      await pushState(dataOf(state)) // seed the DB from this device
      await syncPhotos().catch(() => {})
      setUrl('')
      setToken('')
      onStatus?.({ ok: true, msg: 'Connector linked — your data is now readable by Claude.' })
    } catch (err) {
      setConnectorConfig(null)
      onStatus?.({ ok: false, msg: `Couldn’t connect: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    try {
      await pushState(dataOf(state))
      await syncPhotos().catch(() => {})
      window.dispatchEvent(new Event('connector-pull-now'))
      onStatus?.({ ok: true, msg: 'Synced to the connector.' })
    } catch (err) {
      onStatus?.({ ok: false, msg: `Sync failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  function disconnect() {
    if (confirm('Disconnect the connector on this device? Your data in the cloud is kept.')) {
      setConnectorConfig(null)
      onStatus?.({ ok: true, msg: 'Connector disconnected on this device.' })
    }
  }

  if (!isConnectorEnabled() || !cfg?.token) {
    return (
      <div className="card p-4 space-y-3">
        <p className="text-sm text-slate-400">
          Link a <span className="text-slate-200">Claude connector</span> so you can ask Claude to
          “pull my recent workouts” in any chat — and have it write your next planned session back
          into the app. Paste your connector’s URL and token below.
        </p>
        <input
          className="input"
          placeholder="Connector URL (https://…vercel.app)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
        />
        <input
          type="password"
          className="input"
          placeholder="Connector token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <button
          className="btn-primary w-full"
          onClick={connect}
          disabled={busy || !url.trim() || !token.trim()}
        >
          {busy ? 'Connecting…' : 'Connect & upload current data'}
        </button>
        <p className="text-xs text-slate-500">
          The URL and token stay on this device only — never included in exports or backups.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${meta.error ? 'bg-red-400' : 'bg-green-400'}`} />
            {meta.error ? 'Connector error' : 'Connector on'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {meta.error
              ? meta.error
              : `Synced ${ago(meta.lastPush)} · auto-syncs after changes, checks for plans on open`}
          </div>
        </div>
      </div>
      <button className="btn-primary w-full" onClick={syncNow} disabled={busy}>
        {busy ? 'Working…' : 'Sync now & check for plans'}
      </button>
      <button className="text-xs text-slate-500 underline" onClick={disconnect}>
        Disconnect this device
      </button>
    </div>
  )
}
