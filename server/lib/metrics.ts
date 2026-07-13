// Workout analytics — a faithful port of the client's metrics.js, so the
// connector reports the SAME numbers the app shows (est. 1RM, PRs, top sets).

import type { Workout, WorkoutSet } from './types'

export function epley1RM(weight: number, reps: number): number {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return w * (1 + r / 30)
}

export function setVolume(set: { weight: number; reps: number }): number {
  return (Number(set.weight) || 0) * (Number(set.reps) || 0)
}

export interface MachineSession {
  workoutId: string
  date: string
  sets: WorkoutSet[]
  topSetWeight: number
  best1RM: number
  volume: number
  bestSet: WorkoutSet | null
}

export function sessionsForMachine(
  machineId: string,
  workouts: Workout[],
  sets: WorkoutSet[],
): MachineSession[] {
  const byWorkout = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    if (s.machineId !== machineId) continue
    if (!byWorkout.has(s.workoutId)) byWorkout.set(s.workoutId, [])
    byWorkout.get(s.workoutId)!.push(s)
  }

  const workoutById = new Map(workouts.map((w) => [w.id, w]))
  const out: MachineSession[] = []
  for (const [workoutId, sessionSets] of byWorkout) {
    const workout = workoutById.get(workoutId)
    if (!workout) continue
    const ordered = [...sessionSets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let topSetWeight = 0
    let best1RM = 0
    let bestSet: WorkoutSet | null = null
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
    out.push({ workoutId, date: workout.date, sets: ordered, topSetWeight, best1RM, volume, bestSet })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

export function machineBests(
  machineId: string,
  workouts: Workout[],
  sets: WorkoutSet[],
): { bestTopSetWeight: number; best1RM: number } {
  const sessions = sessionsForMachine(machineId, workouts, sets)
  let bestTopSetWeight = 0
  let best1RM = 0
  for (const s of sessions) {
    if (s.topSetWeight > bestTopSetWeight) bestTopSetWeight = s.topSetWeight
    if (s.best1RM > best1RM) best1RM = s.best1RM
  }
  return { bestTopSetWeight, best1RM }
}

export function prSessionsForMachine(
  machineId: string,
  workouts: Workout[],
  sets: WorkoutSet[],
): Map<string, { weightPR: boolean; oneRmPR: boolean }> {
  const sessions = sessionsForMachine(machineId, workouts, sets)
  const result = new Map<string, { weightPR: boolean; oneRmPR: boolean }>()
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

/** Round a 1RM to one decimal, as the client's export does. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
