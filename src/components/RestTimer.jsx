import { useEffect, useRef, useState } from 'react'
import { IconClose } from './Icons.jsx'

const PRESETS = [
  { s: 60, label: '1:00' },
  { s: 90, label: '1:30' },
  { s: 120, label: '2:00' },
  { s: 180, label: '3:00' },
]

// Short beep via the Web Audio API (no asset needed).
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.55)
    osc.onended = () => ctx.close()
  } catch {
    /* ignore */
  }
}

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Rest timer. Renders a row of preset buttons; tapping one starts a countdown
 * that buzzes/vibrates at zero. Works off a target timestamp so it stays
 * accurate even if the tab is backgrounded.
 */
const PREF_KEY = 'weight-room:rest-secs'

function preferredSecs() {
  const v = Number(localStorage.getItem(PREF_KEY))
  return v >= 15 && v <= 600 ? v : 90
}

export default function RestTimer({ autoStartToken = 0 }) {
  const [target, setTarget] = useState(null) // epoch ms when rest ends
  const [remaining, setRemaining] = useState(0)
  const firedRef = useRef(false)

  // Auto-start with the last-used duration whenever a set is logged.
  const tokenRef = useRef(autoStartToken)
  useEffect(() => {
    if (autoStartToken !== tokenRef.current) {
      tokenRef.current = autoStartToken
      start(preferredSecs())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartToken])

  useEffect(() => {
    if (!target) return
    firedRef.current = false
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        beep()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        setTarget(null)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [target])

  function start(seconds) {
    setRemaining(seconds)
    setTarget(Date.now() + seconds * 1000)
  }

  if (target) {
    const left = remaining
    return (
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost flex-1 tabular-nums text-lg font-bold py-2"
          onClick={() => start(left + 30)}
          aria-label="Add 30 seconds"
        >
          {fmt(left)} <span className="text-xs text-slate-400 ml-1">+30s</span>
        </button>
        <button
          className="btn-ghost w-11 h-11 p-0"
          onClick={() => setTarget(null)}
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
          className="btn-ghost flex-1 py-2 text-sm tabular-nums"
          onClick={() => {
            localStorage.setItem(PREF_KEY, String(p.s)) // becomes the auto-start duration
            start(p.s)
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
