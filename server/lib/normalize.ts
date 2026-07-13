// Deep normalization — a faithful TypeScript port of the client's
// persistence.js normalizeState / normalizeRoutine. Keeping this identical is
// House Rule 1: a backup normalized here must equal one normalized in the app,
// so data round-trips value-identical.

import { uid } from './id'
import type { AppData, Machine, Routine, Settings, SCHEMA_VERSION as SV } from './types'
import { SCHEMA_VERSION } from './types'

const isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v)

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function nonNegNum(v: unknown, fallback = 0): number {
  const n = num(v, fallback)
  return n >= 0 ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidISODate(d: string): boolean {
  return DATE_RE.test(d) && Number.isFinite(new Date(d).getTime())
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    machines: [],
    workouts: [],
    sets: [],
    routines: [],
    settings: { unit: 'lbs', bodyweight: 0 },
  }
}

export function normalizeRoutine(r: Record<string, unknown>): Routine {
  const clampInt = (v: unknown, lo: number, hi: number): number | null => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null
  }
  let items: Routine['items'] = []
  if (Array.isArray(r.items)) {
    items = (r.items as Record<string, unknown>[])
      .filter((it) => it && it.machineId)
      .map((it) => ({
        machineId: it.machineId as string,
        sets: clampInt(it.sets, 1, 10) ?? 3,
        repLow: clampInt(it.repLow, 1, 100),
        repHigh: clampInt(it.repHigh, 1, 100),
      }))
  } else if (Array.isArray(r.exerciseIds)) {
    items = (r.exerciseIds as string[]).map((machineId) => ({
      machineId,
      sets: 3,
      repLow: null,
      repHigh: null,
    }))
  }
  return {
    id: (r.id as string) || uid('r'),
    name: str(r.name) || 'Routine',
    items,
    createdAt: num(r.createdAt, 0),
  }
}

export function normalizeRoutines(routines: unknown): Routine[] {
  return (Array.isArray(routines) ? routines : []).filter(isObj).map(normalizeRoutine)
}

export function normalizeMachine(raw: Record<string, unknown>): Machine {
  return {
    ...raw,
    id: (raw.id as string) || uid('m'),
    name: str(raw.name).trim() || 'Untitled Exercise',
    model: str(raw.model),
    muscleGroup: str(raw.muscleGroup) || 'Other',
    type: str(raw.type) || 'Machine',
    notes: str(raw.notes),
    hasPhoto: Boolean(raw.hasPhoto),
    archived: Boolean(raw.archived),
    createdAt: num(raw.createdAt, 0),
  } as Machine
}

/**
 * Deep-clean any state-shaped data into the persisted shape. Records are
 * coerced, never dropped; unknown extra keys are preserved. Duplicate-date
 * workouts are merged (sets remapped), matching the client exactly.
 */
export function normalizeState(data: unknown): AppData {
  const base = emptyData()
  const src = isObj(data) ? data : {}

  const machines = (Array.isArray(src.machines) ? src.machines : [])
    .filter(isObj)
    .map(normalizeMachine)

  const workoutIdRemap = new Map<string, string>()
  const byDate = new Map<string, { id: string; date: string; [k: string]: unknown }>()
  const workouts: AppData['workouts'] = []
  for (const raw of (Array.isArray(src.workouts) ? src.workouts : []) as Record<string, unknown>[]) {
    if (!isObj(raw)) continue
    const w = { ...raw, id: (raw.id as string) || uid('w'), date: str(raw.date) }
    if (!isValidISODate(w.date)) continue
    if (byDate.has(w.date)) {
      workoutIdRemap.set(w.id, byDate.get(w.date)!.id)
      continue
    }
    byDate.set(w.date, w)
    workouts.push(w)
  }

  const sets = (Array.isArray(src.sets) ? src.sets : ([] as Record<string, unknown>[]))
    .filter(isObj)
    .map((raw) => {
      const s: Record<string, unknown> = {
        ...raw,
        id: (raw.id as string) || uid('s'),
        workoutId: workoutIdRemap.get(raw.workoutId as string) || raw.workoutId,
        machineId: raw.machineId,
        weight: nonNegNum(raw.weight),
        reps: Math.round(nonNegNum(raw.reps)),
        order: Math.round(num(raw.order, 0)),
      }
      if (raw.t != null) s.t = num(raw.t, 0)
      return s
    })

  const settings = {
    ...base.settings,
    ...(isObj(src.settings) ? src.settings : {}),
  } as Settings
  settings.unit = settings.unit === 'kg' ? 'kg' : 'lbs'
  settings.bodyweight = nonNegNum(settings.bodyweight)

  return {
    schemaVersion: SCHEMA_VERSION,
    machines,
    workouts: workouts as AppData['workouts'],
    sets: sets as AppData['sets'],
    routines: normalizeRoutines(src.routines),
    settings,
  }
}

/**
 * Validate + normalize a full-backup payload (current or legacy shape).
 * Returns { data, photos }. Throws with a clear message when unusable.
 */
export function parseBackup(payload: unknown): { data: AppData; photos: Record<string, string> } {
  const p = payload as Record<string, unknown> | null
  if (p?.type === 'workout') {
    throw new Error("That's a single-day file, not a full backup.")
  }
  const data = (isObj(p?.data) ? p!.data : p) as Record<string, unknown>
  if (!isObj(data) || !Array.isArray(data.machines)) {
    throw new Error('Invalid backup file: missing machines.')
  }
  const photos = (isObj(p?.photos) ? (p!.photos as Record<string, string>) : {}) || {}
  return { data: normalizeState(data), photos }
}

export type { SV }
