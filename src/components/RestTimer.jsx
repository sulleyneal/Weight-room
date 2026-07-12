import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  subscribe,
  getRemaining,
  startRest,
  stopRest,
  preferredSecs,
  setPreferredSecs,
} from '../lib/restTimer.js'
import { IconClose } from './Icons.jsx'

const PRESETS = [
  { s: 60, label: '1:00' },
  { s: 90, label: '1:30' },
  { s: 120, label: '2:00' },
  { s: 180, label: '3:00' },
]

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Rest timer UI over the shared engine in lib/restTimer.js. There is ONE
 * countdown app-wide: it keeps running (and stays visible on every exercise
 * card) while you scroll, navigate, or refresh mid-workout. Tapping a preset
 * starts it and becomes the auto-start duration for future sets.
 */
export default function RestTimer({ autoStartToken = 0 }) {
  const remaining = useSyncExternalStore(subscribe, getRemaining)

  // Auto-start with the last-used duration whenever a set is logged.
  const tokenRef = useRef(autoStartToken)
  useEffect(() => {
    if (autoStartToken !== tokenRef.current) {
      tokenRef.current = autoStartToken
      startRest(preferredSecs())
    }
  }, [autoStartToken])

  if (remaining != null) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost flex-1 tabular-nums text-lg font-bold py-2"
          onClick={() => startRest(remaining + 30)}
          aria-label="Add 30 seconds"
        >
          {fmt(remaining)} <span className="text-xs text-slate-400 ml-1">+30s</span>
        </button>
        <button
          className="btn-ghost w-11 h-11 p-0"
          onClick={stopRest}
          aria-label="Stop rest timer"
        >
          <IconClose size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mr-1">
        Rest
      </span>
      {PRESETS.map((p) => (
        <button
          key={p.s}
          className="btn-ghost flex-1 py-2.5 text-sm tabular-nums"
          onClick={() => {
            setPreferredSecs(p.s) // becomes the auto-start duration
            startRest(p.s)
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
