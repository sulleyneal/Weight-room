// Shared rest-timer engine: ONE countdown for the whole app, backed by
// localStorage so it survives navigating between exercises/pages and even a
// mid-gym refresh. Previously each exercise card owned its own timer state,
// so scrolling to the next machine silently killed the running rest.
//
// Components consume it via useSyncExternalStore(subscribe, getRemaining).
// getRemaining() returns null when idle, otherwise whole seconds left. The
// snapshot is cached and only recomputed right before notifying, as React
// requires.

const TARGET_KEY = 'weight-room:rest-target' // epoch ms when the rest ends
const PREF_KEY = 'weight-room:rest-secs' // last-used preset (auto-start duration)

const listeners = new Set()
let intervalId = null
let target = null
let remaining = null // cached snapshot

function persistTarget(value) {
  try {
    if (value == null) localStorage.removeItem(TARGET_KEY)
    else localStorage.setItem(TARGET_KEY, String(value))
  } catch {
    /* storage unavailable — timer still works in-memory */
  }
}

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

function computeRemaining() {
  remaining = target == null ? null : Math.max(0, Math.round((target - Date.now()) / 1000))
}

function notify() {
  computeRemaining()
  for (const fn of listeners) fn()
}

function stopTicking() {
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function tick() {
  if (target == null) return stopTicking()
  if (Date.now() >= target) {
    // Fires exactly once, module-wide — no matter how many timer components
    // are mounted.
    target = null
    persistTarget(null)
    stopTicking()
    beep()
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }
  notify()
}

function startTicking() {
  if (intervalId == null) intervalId = setInterval(tick, 250)
}

// Resume a rest that was running before a refresh. A target that expired
// while the page was closed is discarded silently (no minutes-late beep).
try {
  const stored = Number(localStorage.getItem(TARGET_KEY))
  if (Number.isFinite(stored) && stored > Date.now()) {
    target = stored
    startTicking()
  } else if (stored) {
    persistTarget(null)
  }
} catch {
  /* ignore */
}
computeRemaining()

export function subscribe(fn) {
  listeners.add(fn)
  if (target != null) startTicking()
  return () => listeners.delete(fn)
}

/** Snapshot for useSyncExternalStore: null when idle, else whole seconds left. */
export function getRemaining() {
  return remaining
}

export function startRest(seconds) {
  target = Date.now() + seconds * 1000
  persistTarget(target)
  startTicking()
  notify()
}

export function stopRest() {
  target = null
  persistTarget(null)
  stopTicking()
  notify()
}

export function preferredSecs() {
  try {
    const v = Number(localStorage.getItem(PREF_KEY))
    return v >= 15 && v <= 600 ? v : 90
  } catch {
    return 90
  }
}

export function setPreferredSecs(seconds) {
  try {
    localStorage.setItem(PREF_KEY, String(seconds))
  } catch {
    /* ignore */
  }
}
