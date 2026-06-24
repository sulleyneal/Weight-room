import { useState } from 'react'
import Modal from './Modal.jsx'
import BodyMap from './BodyMap.jsx'
import MuscleChip from './MuscleChip.jsx'
import { fmtDate } from '../lib/metrics.js'
import { fmtWeight, fmtNumber, unitLabel } from '../lib/units.js'
import { exportSummaryImage } from '../lib/summaryImage.js'
import { IconDownload, IconTrophy } from './Icons.jsx'

const canShareFiles =
  typeof navigator !== 'undefined' &&
  !!navigator.canShare &&
  (() => {
    try {
      return navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })
    } catch {
      return false
    }
  })()

/** Visual workout summary for a single day, with PNG export / share. */
export default function SummaryModal({ open, onClose, summary }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!summary) return null
  const unit = summary.unit

  async function run(preferShare) {
    setBusy(true)
    setMsg(null)
    try {
      const result = await exportSummaryImage(summary, { preferShare })
      setMsg(result === 'shared' ? 'Shared.' : 'Image saved.')
    } catch (err) {
      if (err?.name !== 'AbortError') setMsg(`Couldn’t export: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Workout summary"
      footer={
        <div className="space-y-2">
          {msg && <p className="text-sm text-center text-slate-400">{msg}</p>}
          <div className="flex gap-2">
            {canShareFiles && (
              <button className="btn-ghost flex-1" onClick={() => run(true)} disabled={busy}>
                Share
              </button>
            )}
            <button className="btn-primary flex-1" onClick={() => run(false)} disabled={busy}>
              <IconDownload size={20} /> {busy ? 'Rendering…' : 'Save image'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-xs font-bold tracking-widest text-brand-400">WEIGHT ROOM</div>
          <div className="text-lg font-extrabold">{fmtDate(summary.date)}</div>
        </div>

        {/* Body muscle map */}
        <div className="card p-4">
          <BodyMap intensities={summary.intensities} />
        </div>

        {/* Muscles worked */}
        {summary.groups.length > 0 && (
          <div>
            <h3 className="label">Muscles worked</h3>
            <div className="flex flex-wrap gap-2">
              {summary.groups.map((g) => (
                <span key={g.group} className="inline-flex items-center gap-1.5">
                  <MuscleChip group={g.group} />
                  <span className="text-xs text-slate-500">{Math.round(g.share * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Machines" value={String(summary.stats.machines)} />
          <Stat label="Sets" value={String(summary.stats.sets)} />
          <Stat label={`Vol (${unitLabel(unit)})`} value={fmtNumber(summary.stats.volume)} />
          <Stat label="PRs" value={String(summary.stats.prs)} accent={summary.stats.prs > 0} />
        </div>

        {/* Machine breakdown */}
        <div>
          <h3 className="label">Machines</h3>
          <div className="card divide-y divide-ink-700">
            {summary.machines.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="font-semibold truncate flex items-center gap-1.5">
                  <span className="truncate">{m.name}</span>
                  {m.isPR && <IconTrophy size={14} className="text-yellow-400 shrink-0" />}
                </span>
                <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                  {fmtWeight(m.topSetWeight, unit)} · {m.sets.length} sets · {fmtNumber(m.volume)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`card p-2 text-center ${accent ? 'ring-1 ring-yellow-400/40' : ''}`}>
      <div className="text-lg font-extrabold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}
