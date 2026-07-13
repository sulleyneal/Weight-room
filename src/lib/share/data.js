// Builders that turn raw app state into share-card "moments".
// Pure functions — testable without a canvas.

import {
  epley1RM,
  setVolume,
  sessionsForMachine,
  prSessionsForMachine,
} from '../metrics.js'
import {
  computeIntensities,
  regionEffortsFor,
  groupTotalsFromRegions,
} from './muscleRegions.js'

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

function topSetOf(sets) {
  let top = null
  for (const s of sets) {
    if (
      !top ||
      s.weight > top.weight ||
      (s.weight === top.weight && s.reps > top.reps)
    ) {
      top = s
    }
  }
  return top
}

/** The workout for a date, or null. */
function workoutFor(state, date) {
  return state.workouts.find((w) => w.date === date) || null
}

/**
 * Session moment: everything the summary card needs for one day.
 * Exercises appear in the order they were performed (first set's t/order).
 */
export function buildSessionMoment(state, date) {
  const workout = workoutFor(state, date)
  if (!workout) return null
  const daySets = state.sets.filter((s) => s.workoutId === workout.id)
  if (!daySets.length) return null

  const machineById = new Map(state.machines.map((m) => [m.id, m]))
  const firstSeen = new Map()
  const grouped = new Map()
  daySets.forEach((s, i) => {
    if (!grouped.has(s.machineId)) {
      grouped.set(s.machineId, [])
      firstSeen.set(s.machineId, s.t ?? i)
    }
    grouped.get(s.machineId).push(s)
  })

  let totalVolume = 0
  let prCount = 0
  const exercises = []
  for (const [machineId, sets] of grouped) {
    const m = machineById.get(machineId)
    const ordered = [...sets].sort(byOrder)
    const top = topSetOf(ordered)
    const volume = ordered.reduce((sum, s) => sum + setVolume(s), 0)
    totalVolume += volume
    const flags = prSessionsForMachine(machineId, state.workouts, state.sets).get(workout.id)
    const isPR = Boolean(flags && (flags.weightPR || flags.oneRmPR))
    if (isPR) prCount++
    exercises.push({
      machineId,
      name: m?.name || 'Unknown exercise',
      group: m?.muscleGroup || 'Other',
      sets: ordered.length,
      reps: ordered.reduce((sum, s) => sum + (Number(s.reps) || 0), 0),
      topWeight: top?.weight ?? 0,
      topReps: top?.reps ?? 0,
      volume,
      isPR,
      seq: firstSeen.get(machineId),
    })
  }
  exercises.sort((a, b) => a.seq - b.seq)

  // Session duration from set timestamps when available.
  const ts = daySets.map((s) => s.t).filter((t) => Number.isFinite(t) && t > 0)
  const durationMin =
    ts.length >= 2 ? Math.max(1, Math.round((Math.max(...ts) - Math.min(...ts)) / 60000)) : null

  // Which program does this session most resemble?
  let programName = null
  if (state.routines.length) {
    let best = 0
    for (const r of state.routines) {
      const ids = new Set(r.items.map((it) => it.machineId))
      const overlap = exercises.filter((e) => ids.has(e.machineId)).length
      if (overlap > best) {
        best = overlap
        programName = r.name
      }
    }
    if (best < Math.ceil(exercises.length / 2)) programName = null
  }

  // Lifetime session number up to this date — the receipt-style footer stamp.
  const loggedIds = new Set(state.sets.map((s) => s.workoutId))
  const sessionNumber = state.workouts.filter(
    (w) => loggedIds.has(w.id) && w.date <= date,
  ).length

  return {
    date,
    unit: state.settings.unit,
    programName,
    durationMin,
    totalSets: daySets.length,
    totalVolume,
    prCount,
    sessionNumber,
    exercises,
  }
}

/**
 * PR moments for a date: one per machine that set a record that day.
 * Includes enough history for a sparkline and the previous bests for deltas.
 */
export function buildPRMoments(state, date) {
  const workout = workoutFor(state, date)
  if (!workout) return []
  const machineById = new Map(state.machines.map((m) => [m.id, m]))
  const machineIds = [...new Set(state.sets.filter((s) => s.workoutId === workout.id).map((s) => s.machineId))]

  const out = []
  for (const machineId of machineIds) {
    const flags = prSessionsForMachine(machineId, state.workouts, state.sets).get(workout.id)
    if (!flags || (!flags.weightPR && !flags.oneRmPR)) continue

    const sessions = sessionsForMachine(machineId, state.workouts, state.sets)
    const idx = sessions.findIndex((s) => s.workoutId === workout.id)
    if (idx < 0) continue
    const today = sessions[idx]
    const prior = sessions.slice(0, idx)
    const prevBestTop = prior.reduce((mx, s) => Math.max(mx, s.topSetWeight), 0)
    const prevBestE1 = prior.reduce((mx, s) => Math.max(mx, s.best1RM), 0)

    const m = machineById.get(machineId)
    const top = topSetOf(today.sets)
    out.push({
      machineId,
      date,
      unit: state.settings.unit,
      name: m?.name || 'Unknown exercise',
      group: m?.muscleGroup || 'Other',
      topWeight: top?.weight ?? 0,
      topReps: top?.reps ?? 0,
      e1rm: today.best1RM,
      kind: flags.weightPR && flags.oneRmPR ? 'both' : flags.weightPR ? 'weight' : 'e1rm',
      prevBestTop: prevBestTop > 0 ? prevBestTop : null,
      prevBestE1: prevBestE1 > 0 ? prevBestE1 : null,
      deltaTop: prevBestTop > 0 ? (top?.weight ?? 0) - prevBestTop : null,
      deltaE1: prevBestE1 > 0 ? today.best1RM - prevBestE1 : null,
      history: sessions.slice(0, idx + 1).slice(-14).map((s) => ({ date: s.date, e1rm: s.best1RM })),
      sessionCount: idx + 1,
    })
  }
  // Headline order: real records first (biggest e1RM jump wins), first-ever
  // sessions last — "first time on a machine" is not the story of the day.
  out.sort((a, b) => {
    const aFirst = a.prevBestTop == null && a.prevBestE1 == null
    const bFirst = b.prevBestTop == null && b.prevBestE1 == null
    if (aFirst !== bFirst) return aFirst ? 1 : -1
    return (b.deltaE1 ?? 0) - (a.deltaE1 ?? 0) || b.e1rm - a.e1rm
  })
  return out
}

/**
 * Progress moment for one machine: the real trend, recent window, PR flags.
 */
export function buildProgressMoment(state, machineId, windowSessions = 20) {
  const machine = state.machines.find((m) => m.id === machineId)
  if (!machine) return null
  const all = sessionsForMachine(machineId, state.workouts, state.sets)
  if (!all.length) return null
  const prMap = prSessionsForMachine(machineId, state.workouts, state.sets)
  const sessions = all.slice(-windowSessions)

  const series = sessions.map((s) => {
    const flags = prMap.get(s.workoutId)
    return {
      date: s.date,
      e1rm: s.best1RM,
      top: s.topSetWeight,
      pr: Boolean(flags && (flags.weightPR || flags.oneRmPR)),
    }
  })
  const current = series[series.length - 1]
  const first = series[0]
  const bestE1 = all.reduce((mx, s) => Math.max(mx, s.best1RM), 0)

  return {
    machineId,
    unit: state.settings.unit,
    name: machine.name,
    group: machine.muscleGroup || 'Other',
    series,
    currentE1: current.e1rm,
    currentTop: current.top,
    bestE1,
    deltaE1: series.length > 1 ? current.e1rm - first.e1rm : null,
    totalSessions: all.length,
    windowStart: first.date,
    windowEnd: current.date,
  }
}

/**
 * Muscle-map moment: group volumes/shares/intensities for the body-figure
 * card, derived from the session moment.
 */
export function buildMuscleMoment(state, date) {
  const session = buildSessionMoment(state, date)
  if (!session) return null
  // The whole map is muscle-driven: effort per anatomical slug (volume when
  // there's load, reps when there isn't — so bodyweight work still lights),
  // then the legend aggregates those same slugs into GROUPS. Figure colors and
  // legend always agree, and a calf raise lights calves, not "legs" wholesale.
  const regionEfforts = regionEffortsFor(session.exercises)
  const groupTotals = groupTotalsFromRegions(regionEfforts)
  const totalEffort = Object.values(groupTotals).reduce((a, b) => a + b, 0)
  const groups = Object.entries(groupTotals)
    .map(([group, volume]) => ({
      group,
      volume,
      share: totalEffort ? volume / totalEffort : 0,
    }))
    .sort((a, b) => b.volume - a.volume)
  return {
    ...session,
    groups,
    intensities: computeIntensities(regionEfforts),
  }
}

/** Machines trained on a date, for the progress-card picker. */
export function machinesTrainedOn(state, date) {
  const workout = workoutFor(state, date)
  if (!workout) return []
  return [...new Set(state.sets.filter((s) => s.workoutId === workout.id).map((s) => s.machineId))]
}

export { epley1RM }
