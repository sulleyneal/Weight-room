// Workout analytics: 1RM estimation, per-session rollups, and PR detection.

/**
 * Epley estimated one-rep max: weight × (1 + reps/30).
 * A single rep IS a one-rep max, so it returns the weight unchanged.
 */
export function epley1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return w * (1 + r / 30)
}

/** Volume for a single set = weight × reps. */
export function setVolume(set) {
  return (Number(set.weight) || 0) * (Number(set.reps) || 0)
}

/**
 * Group a machine's sets into per-session summaries, sorted oldest→newest.
 * Each entry: { workoutId, date, sets, topSetWeight, best1RM, volume, bestSet }
 */
export function sessionsForMachine(machineId, workouts, sets) {
  const byWorkout = new Map()
  for (const s of sets) {
    if (s.machineId !== machineId) continue
    if (!byWorkout.has(s.workoutId)) byWorkout.set(s.workoutId, [])
    byWorkout.get(s.workoutId).push(s)
  }

  const workoutById = new Map(workouts.map((w) => [w.id, w]))
  const out = []
  for (const [workoutId, sessionSets] of byWorkout) {
    const workout = workoutById.get(workoutId)
    if (!workout) continue
    const ordered = [...sessionSets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let topSetWeight = 0
    let best1RM = 0
    let bestSet = null
    let volume = 0
    for (const s of ordered) {
      const w = Number(s.weight) || 0
      const oneRm = epley1RM(s.weight, s.reps)
      if (w > topSetWeight) topSetWeight = w
      if (oneRm > best1RM) {
        best1RM = oneRm
        bestSet = s
      }
      volume += setVolume(s)
    }
    out.push({
      workoutId,
      date: workout.date,
      sets: ordered,
      topSetWeight,
      best1RM,
      volume,
      bestSet,
    })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

/**
 * Compute the all-time bests for a machine across all prior sessions.
 * Returns { bestTopSetWeight, best1RM }.
 */
export function machineBests(machineId, workouts, sets) {
  const sessions = sessionsForMachine(machineId, workouts, sets)
  let bestTopSetWeight = 0
  let best1RM = 0
  for (const s of sessions) {
    if (s.topSetWeight > bestTopSetWeight) bestTopSetWeight = s.topSetWeight
    if (s.best1RM > best1RM) best1RM = s.best1RM
  }
  return { bestTopSetWeight, best1RM }
}

/**
 * Detect PRs for each session of a machine by walking sessions chronologically.
 * Returns a Map of workoutId -> { weightPR: bool, oneRmPR: bool }.
 * A session is a PR if its top-set weight or best 1RM exceeds everything before it.
 */
export function prSessionsForMachine(machineId, workouts, sets) {
  const sessions = sessionsForMachine(machineId, workouts, sets)
  const result = new Map()
  let bestWeight = 0
  let best1RM = 0
  for (const s of sessions) {
    const weightPR = s.topSetWeight > bestWeight + 1e-9
    const oneRmPR = s.best1RM > best1RM + 1e-9
    result.set(s.workoutId, { weightPR, oneRmPR })
    if (s.topSetWeight > bestWeight) bestWeight = s.topSetWeight
    if (s.best1RM > best1RM) best1RM = s.best1RM
  }
  return result
}

/** Total volume across every set in the data set (optionally filtered). */
export function totalVolume(sets) {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

/**
 * Count, per workout, how many machines set a PR (top-set weight or est. 1RM
 * above everything before it) in that session. Semantically identical to
 * running prSessionsForMachine for every machine, but a single pass over sets
 * — O(sets) instead of O(machines × sets) — so the dashboard stays fast with
 * years of history. Returns Map of workoutId -> count.
 */
export function prCountByWorkout(workouts, sets) {
  const dateOf = new Map(workouts.map((w) => [w.id, w.date]))

  // machineId -> workoutId -> { date, top, e1 } session aggregates.
  const perMachine = new Map()
  for (const s of sets) {
    const date = dateOf.get(s.workoutId)
    if (!date) continue
    let sessions = perMachine.get(s.machineId)
    if (!sessions) {
      sessions = new Map()
      perMachine.set(s.machineId, sessions)
    }
    let agg = sessions.get(s.workoutId)
    if (!agg) {
      agg = { date, top: 0, e1: 0 }
      sessions.set(s.workoutId, agg)
    }
    const w = Number(s.weight) || 0
    if (w > agg.top) agg.top = w
    const e1 = epley1RM(s.weight, s.reps)
    if (e1 > agg.e1) agg.e1 = e1
  }

  const counts = new Map()
  for (const sessions of perMachine.values()) {
    const ordered = [...sessions.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date))
    let bestTop = 0
    let best1 = 0
    for (const [workoutId, agg] of ordered) {
      if (agg.top > bestTop + 1e-9 || agg.e1 > best1 + 1e-9) {
        counts.set(workoutId, (counts.get(workoutId) || 0) + 1)
      }
      if (agg.top > bestTop) bestTop = agg.top
      if (agg.e1 > best1) best1 = agg.e1
    }
  }
  return counts
}

/** ISO week boundaries (Mon–Sun) for a given date. */
export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Mon=0
  d.setDate(d.getDate() - day)
  return d
}

export function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset()
  const local = new Date(d.getTime() - tz * 60000)
  return local.toISOString().slice(0, 10)
}

/** Human-friendly date label, e.g. "Mon, Jun 23". */
export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function fmtDateShort(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** ISO date (local) of the Monday that starts the week containing `iso`. */
export function weekStartISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const ws = startOfWeek(new Date(y, m - 1, d))
  const tz = ws.getTimezoneOffset()
  return new Date(ws.getTime() - tz * 60000).toISOString().slice(0, 10)
}

/**
 * Double-progression coaching suggestion from an exercise's prior sessions
 * (chronological, most recent last). Returns null with no history, else
 * { mode: 'increase' | 'reps' | 'deload', weight, reps, label }.
 *
 * `repRange` ({ low, high }, optional) comes from a program/routine target for
 * the movement; without one, a generic 8–10-ish range applies.
 *
 * Heuristic:
 *  - Every top-weight set hit the top of the rep range → earned a weight
 *    increase (drop back to the bottom of the range).
 *  - Best e1RM fell two sessions running → deload ~10% and rebuild.
 *  - Otherwise → same weight, one more rep than the worst top-weight set.
 */
export function suggestProgression(prevSessions, step, repRange) {
  const n = prevSessions.length
  if (!n) return null
  const last = prevSessions[n - 1]
  if (!last.sets.length || last.topSetWeight <= 0) return null

  const high = repRange?.high ?? 10
  const low = repRange?.low ?? 8
  const snap = (w) => Math.max(step, Math.round(w / step) * step)
  const topSets = last.sets.filter((s) => (Number(s.weight) || 0) >= last.topSetWeight - 1e-9)
  const worstReps = Math.min(...topSets.map((s) => Number(s.reps) || 0))

  if (worstReps >= high) {
    return {
      mode: 'increase',
      weight: snap(last.topSetWeight + step),
      reps: low,
      label: 'Add weight',
    }
  }

  const prev = prevSessions[n - 2]
  const prev2 = prevSessions[n - 3]
  if (
    prev &&
    prev2 &&
    last.best1RM < prev.best1RM - 1e-9 &&
    prev.best1RM < prev2.best1RM - 1e-9
  ) {
    return {
      mode: 'deload',
      weight: snap(last.topSetWeight * 0.9),
      reps: high,
      label: 'Deload & rebuild',
    }
  }

  return {
    mode: 'reps',
    weight: last.topSetWeight,
    reps: Math.min(Math.max(worstReps + 1, Math.min(low, 6)), high),
    label: 'Add a rep',
  }
}

/** ISO date `n` days after `iso` (local). */
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const tz = dt.getTimezoneOffset()
  return new Date(dt.getTime() - tz * 60000).toISOString().slice(0, 10)
}

/**
 * Training-load "activity path": acute training load vs an optimal band derived
 * from chronic load — so you can see whether you're under-training (below the
 * band), in the productive zone, or pushing too hard (above it).
 *
 * - Daily load = total volume (Σ weight×reps) that day, optionally filtered to a
 *   muscle group.
 * - acute = ~7-day EWMA of daily load (the plotted line).
 * - chronic = ~28-day EWMA (the baseline the band is built from).
 * - band = [chronic × 0.8, chronic × 1.3] (the green "optimal" range).
 *
 * Both EWMAs seed to the window's mean daily load so the band is stable from the
 * first point. Computed over the last ~120 days. Returns Recharts-ready rows
 * plus the latest status ('low' | 'optimal' | 'high').
 */
export function trainingLoadSeries(machines, workouts, sets, group = 'All') {
  const groupOf = new Map(machines.map((m) => [m.id, m.muscleGroup || 'Other']))
  const dateOf = new Map(workouts.map((w) => [w.id, w.date]))

  const daily = new Map() // iso -> volume
  let minDate = null
  for (const s of sets) {
    const date = dateOf.get(s.workoutId)
    if (!date) continue
    if (group !== 'All' && (groupOf.get(s.machineId) || 'Other') !== group) continue
    daily.set(date, (daily.get(date) || 0) + setVolume(s))
    if (!minDate || date < minDate) minDate = date
  }
  if (!minDate) return { rows: [], status: null, last: null }

  const end = todayISO()
  const windowStart = addDaysISO(end, -120)
  const start = minDate > windowStart ? minDate : windowStart

  const days = []
  for (let d = start; d <= end; d = addDaysISO(d, 1)) days.push(d)
  const vols = days.map((d) => daily.get(d) || 0)
  const mean = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0

  const aAlpha = 2 / (7 + 1)
  const cAlpha = 2 / (28 + 1)
  let acute = mean
  let chronic = mean
  const rows = days.map((d, i) => {
    const v = vols[i]
    acute += aAlpha * (v - acute)
    chronic += cAlpha * (v - chronic)
    // Round low/high first so the stacked band (low + span) lands exactly on high.
    const low = Math.round(chronic * 0.8)
    const high = Math.round(chronic * 1.3)
    return {
      date: d,
      label: fmtDateShort(d),
      acute: Math.round(acute),
      low,
      high,
      span: Math.max(0, high - low),
      trained: v > 0, // a workout happened this day → show a dot
    }
  })

  const last = rows[rows.length - 1]
  let status = 'optimal'
  if (last) {
    if (last.acute > last.high) status = 'high'
    else if (last.acute < last.low) status = 'low'
  }
  return { rows, status, last }
}
