import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  getSyncConfig,
  setSyncConfig,
  getSyncMeta,
  onSyncChange,
  pushBackup,
  pullBackup,
} from '../lib/gistSync.js'

function ago(ts) {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

/**
 * Opt-in cloud backup to a private GitHub Gist. The token is stored only on
 * this device (separate from app data, so it never rides along in exports).
 */
export default function CloudSyncCard({ onStatus }) {
  const { exportData, importData } = useStore()
  const [cfg, setCfg] = useState(getSyncConfig())
  const [meta, setMeta] = useState(getSyncMeta())
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      onSyncChange(() => {
        setCfg(getSyncConfig())
        setMeta(getSyncMeta())
      }),
    [],
  )

  async function connect() {
    const t = token.trim()
    if (!t) return
    setBusy(true)
    try {
      setSyncConfig({ token: t })
      await pushBackup(await exportData())
      setToken('')
      onStatus?.({ ok: true, msg: 'Cloud sync connected — first backup uploaded.' })
    } catch (err) {
      setSyncConfig(null)
      onStatus?.({ ok: false, msg: `Couldn’t connect: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    try {
      await pushBackup(await exportData())
      onStatus?.({ ok: true, msg: 'Backed up to cloud.' })
    } catch (err) {
      onStatus?.({ ok: false, msg: `Sync failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    if (
      !confirm(
        'Restore from cloud? This REPLACES everything on this device with the latest cloud backup.',
      )
    )
      return
    setBusy(true)
    try {
      await importData(await pullBackup())
      onStatus?.({ ok: true, msg: 'Restored from cloud backup.' })
    } catch (err) {
      onStatus?.({ ok: false, msg: `Restore failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  function disconnect() {
    if (confirm('Disconnect cloud sync on this device? The cloud backup itself is kept.')) {
      setSyncConfig(null)
      onStatus?.({ ok: true, msg: 'Cloud sync disconnected.' })
    }
  }

  if (!cfg?.token) {
    return (
      <div className="card p-4 space-y-3">
        <p className="text-sm text-slate-400">
          Back up automatically to a <span className="text-slate-200">private GitHub Gist</span>{' '}
          and restore on any device. Create a token at{' '}
          <span className="text-slate-200">github.com → Settings → Developer settings → Tokens (classic)</span>{' '}
          with only the <span className="text-slate-200">gist</span> scope.
        </p>
        <input
          type="password"
          className="input"
          placeholder="Paste GitHub token (gist scope)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <button className="btn-primary w-full" onClick={connect} disabled={busy || !token.trim()}>
          {busy ? 'Connecting…' : 'Connect & upload first backup'}
        </button>
        <p className="text-xs text-slate-500">
          The token stays on this device only — it is never included in exports or backups.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${meta.error ? 'bg-red-400' : 'bg-green-400'}`}
            />
            {meta.error ? 'Sync error' : 'Sync on'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {meta.error ? meta.error : `Last backup ${ago(meta.lastSync)} · auto-syncs after changes`}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={syncNow} disabled={busy}>
          {busy ? 'Working…' : 'Sync now'}
        </button>
        <button className="btn-ghost" onClick={restore} disabled={busy}>
          Restore from cloud
        </button>
      </div>
      <button className="text-xs text-slate-500 underline" onClick={disconnect}>
        Disconnect this device
      </button>
    </div>
  )
}
