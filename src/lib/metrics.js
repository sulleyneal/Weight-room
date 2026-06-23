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
