// Workout analytics: 1RM estimation, per-session rollups, and PR detection.

/**
 * Epley estimated one-rep max: weight × (1 + reps/30).
 * A single rep returns the weight unchanged.
 */
export function epley1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
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
 * Normalized strength-progress trend per muscle group, for the overall chart.
 *
 * For each ISO week, takes the best estimated 1RM across that group's exercises,
 * carries the last known value forward through untrained weeks, and indexes each
 * group to 100 at its first data point — so every line shares one axis and you
 * can see at a glance which groups are climbing vs falling behind.
 *
 * Returns { weeks, groups, rows } where rows are Recharts-ready:
 *   [{ week: '2026-06-01', Chest: 100, Back: 108, ... }, ...]
 */
export function muscleProgressSeries(machines, workouts, sets) {
  const groupOf = new Map(machines.map((m) => [m.id, m.muscleGroup || 'Other']))
  const dateOf = new Map(workouts.map((w) => [w.id, w.date]))

  const byWeek = new Map() // weekISO -> Map(group -> best e1RM that week)
  for (const s of sets) {
    const date = dateOf.get(s.workoutId)
    if (!date) continue
    const e = epley1RM(s.weight, s.reps)
    if (e <= 0) continue
    const wk = weekStartISO(date)
    const group = groupOf.get(s.machineId) || 'Other'
    if (!byWeek.has(wk)) byWeek.set(wk, new Map())
    const gm = byWeek.get(wk)
    gm.set(group, Math.max(gm.get(group) || 0, e))
  }

  const weeks = [...byWeek.keys()].sort()
  const groups = [...new Set(weeks.flatMap((w) => [...byWeek.get(w).keys()]))]
  const lastVal = {}
  const baseline = {}
  const rows = weeks.map((wk) => {
    const row = { week: wk }
    const gm = byWeek.get(wk)
    for (const g of groups) {
      if (gm.has(g)) lastVal[g] = gm.get(g)
      const v = lastVal[g]
      if (v == null) {
        row[g] = null
        continue
      }
      if (baseline[g] == null) baseline[g] = v
      row[g] = Math.round((v / baseline[g]) * 100)
    }
    return row
  })

  return { weeks, groups, rows }
}
