// Read models for the MCP tools — turn the stored app document into the shapes
// Claude reads, using the ported metrics so numbers match the app exactly.

import { loadState } from './state'
import {
  epley1RM,
  prSessionsForMachine,
  sessionsForMachine,
  setVolume,
  round1,
} from './metrics'
import type { AppData, Machine, Workout, WorkoutSet } from './types'

function machineById(data: AppData): Map<string, Machine> {
  return new Map(data.machines.map((m) => [m.id, m]))
}

/** Resolve an exercise by name: exact (case-insensitive) then contains. */
export function findMachineByName(data: AppData, name: string): Machine | null {
  const q = (name || '').trim().toLowerCase()
  if (!q) return null
  const active = data.machines.filter((m) => !m.archived)
  return (
    active.find((m) => m.name.toLowerCase() === q) ||
    active.find((m) => m.name.toLowerCase().includes(q)) ||
    data.machines.find((m) => m.name.toLowerCase() === q) ||
    null
  )
}

export interface ExerciseInSession {
  name: string
  muscleGroup: string
  sets: { weight: number; reps: number }[]
  topWeight: number
  topReps: number
  est1RM: number
  isPR: boolean
}

export interface SessionSummary {
  date: string
  totalSets: number
  totalVolume: number
  prCount: number
  exercises: ExerciseInSession[]
}

function summarizeWorkout(
  data: AppData,
  workout: Workout,
  prCache: Map<string, Map<string, { weightPR: boolean; oneRmPR: boolean }>>,
): SessionSummary {
  const mById = machineById(data)
  const daySets = data.sets.filter((s) => s.workoutId === workout.id)
  const byMachine = new Map<string, WorkoutSet[]>()
  const order: string[] = []
  for (const s of daySets) {
    if (!byMachine.has(s.machineId)) {
      byMachine.set(s.machineId, [])
      order.push(s.machineId)
    }
    byMachine.get(s.machineId)!.push(s)
  }

  let totalVolume = 0
  let prCount = 0
  const exercises: ExerciseInSession[] = []
  for (const machineId of order) {
    const sets = byMachine.get(machineId)!.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const m = mById.get(machineId)
    let topWeight = 0
    let topReps = 0
    let est1RM = 0
    for (const s of sets) {
      const w = Number(s.weight) || 0
      if (w > topWeight || (w === topWeight && (Number(s.reps) || 0) > topReps)) {
        topWeight = w
        topReps = Number(s.reps) || 0
      }
      est1RM = Math.max(est1RM, epley1RM(s.weight, s.reps))
      totalVolume += setVolume(s)
    }
    let prMap = prCache.get(machineId)
    if (!prMap) {
      prMap = prSessionsForMachine(machineId, data.workouts, data.sets)
      prCache.set(machineId, prMap)
    }
    const flags = prMap.get(workout.id)
    const isPR = Boolean(flags && (flags.weightPR || flags.oneRmPR))
    if (isPR) prCount++
    exercises.push({
      name: m?.name || 'Unknown exercise',
      muscleGroup: m?.muscleGroup || 'Other',
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
      topWeight,
      topReps,
      est1RM: round1(est1RM),
      isPR,
    })
  }
  return {
    date: workout.date,
    totalSets: daySets.length,
    totalVolume: Math.round(totalVolume),
    prCount,
    exercises,
  }
}

export async function recentWorkouts(limit = 5): Promise<{ unit: string; sessions: SessionSummary[] }> {
  const { data } = await loadState()
  const loggedWorkoutIds = new Set(data.sets.map((s) => s.workoutId))
  const workouts = data.workouts
    .filter((w) => loggedWorkoutIds.has(w.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(1, Math.min(limit, 50)))
  const prCache = new Map<string, Map<string, { weightPR: boolean; oneRmPR: boolean }>>()
  return {
    unit: data.settings.unit,
    sessions: workouts.map((w) => summarizeWorkout(data, w, prCache)),
  }
}

export async function workoutByDate(date: string): Promise<{ unit: string; session: SessionSummary } | null> {
  const { data } = await loadState()
  const workout = data.workouts.find((w) => w.date === date)
  if (!workout) return null
  const prCache = new Map<string, Map<string, { weightPR: boolean; oneRmPR: boolean }>>()
  return { unit: data.settings.unit, session: summarizeWorkout(data, workout, prCache) }
}

export async function listExercises(): Promise<{
  unit: string
  exercises: { name: string; muscleGroup: string; type: string; sessions: number; archived: boolean }[]
}> {
  const { data } = await loadState()
  const sessionCount = new Map<string, Set<string>>()
  for (const s of data.sets) {
    if (!sessionCount.has(s.machineId)) sessionCount.set(s.machineId, new Set())
    sessionCount.get(s.machineId)!.add(s.workoutId)
  }
  const exercises = data.machines
    .map((m) => ({
      name: m.name,
      muscleGroup: m.muscleGroup,
      type: m.type,
      sessions: sessionCount.get(m.id)?.size || 0,
      archived: m.archived,
    }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
  return { unit: data.settings.unit, exercises }
}

export async function exerciseHistory(
  name: string,
  limit = 20,
): Promise<{
  unit: string
  exercise: string
  muscleGroup: string
  sessions: { date: string; topWeight: number; topReps: number; est1RM: number; volume: number; isPR: boolean }[]
} | null> {
  const { data } = await loadState()
  const machine = findMachineByName(data, name)
  if (!machine) return null
  const sessions = sessionsForMachine(machine.id, data.workouts, data.sets)
  const prMap = prSessionsForMachine(machine.id, data.workouts, data.sets)
  const recent = sessions.slice(-Math.max(1, Math.min(limit, 100)))
  return {
    unit: data.settings.unit,
    exercise: machine.name,
    muscleGroup: machine.muscleGroup,
    sessions: recent.map((s) => {
      const flags = prMap.get(s.workoutId)
      const top = s.sets.reduce(
        (acc, x) =>
          (Number(x.weight) || 0) > acc.w ? { w: Number(x.weight) || 0, r: Number(x.reps) || 0 } : acc,
        { w: 0, r: 0 },
      )
      return {
        date: s.date,
        topWeight: top.w,
        topReps: top.r,
        est1RM: round1(s.best1RM),
        volume: Math.round(s.volume),
        isPR: Boolean(flags && (flags.weightPR || flags.oneRmPR)),
      }
    }),
  }
}

export async function personalRecords(): Promise<{
  unit: string
  records: { exercise: string; muscleGroup: string; bestTopWeight: number; bestEst1RM: number; onDate: string | null }[]
}> {
  const { data } = await loadState()
  const records: {
    exercise: string
    muscleGroup: string
    bestTopWeight: number
    bestEst1RM: number
    onDate: string | null
  }[] = []
  for (const m of data.machines) {
    const sessions = sessionsForMachine(m.id, data.workouts, data.sets)
    if (!sessions.length) continue
    let bestTopWeight = 0
    let bestEst1RM = 0
    let onDate: string | null = null
    for (const s of sessions) {
      if (s.topSetWeight > bestTopWeight) bestTopWeight = s.topSetWeight
      if (s.best1RM > bestEst1RM) {
        bestEst1RM = s.best1RM
        onDate = s.date
      }
    }
    records.push({
      exercise: m.name,
      muscleGroup: m.muscleGroup,
      bestTopWeight,
      bestEst1RM: round1(bestEst1RM),
      onDate,
    })
  }
  records.sort((a, b) => b.bestEst1RM - a.bestEst1RM)
  return { unit: data.settings.unit, records }
}
