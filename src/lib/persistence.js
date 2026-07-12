// App-data persistence layer.
//
// Everything except photos lives in localStorage as a single normalized JSON
// document. This module is the ONLY place that talks to localStorage, and it
// owns the full data lifecycle as pure, testable functions:
//
//   loadState / saveState        — the localStorage gateway
//   normalizeState               — deep-clean any state-shaped data (load & import)
//   parseBackup                  — validate + normalize a full-backup payload
//   buildBackupPayload           — produce the export payload (same v1 shape)
//   mergeDayImport               — merge a single-day export into a state
//
// Swapping to a real database later means reimplementing `loadState` /
// `saveState` (e.g. as async fetches) and the store calling them — no UI
// changes required.
//
// Data safety rules encoded here:
//  - Corrupt storage is NEVER silently replaced: the raw blob is stashed under
//    a recovery key and a startup warning is queued before the app reseeds.
//  - Normalization never drops records — it coerces bad values and merges
//    duplicate-date workouts (remapping their sets), but a set/workout/machine
//    that exists stays.
//  - The v1 backup format is load-bearing (external tools read it). Exports
//    keep the exact { app, schemaVersion, exportedAt, data, photos } shape and
//    clean v1 data round-trips value-identical.

import { uid } from './id.js'

const STORAGE_KEY = 'weight-room:v1'
// Raw copy of an unparseable main document, kept for manual recovery.
const RECOVERY_KEY = 'weight-room:v1:recovered'
// One-shot message shown after a load problem (corrupt storage etc.).
const WARNING_KEY = 'weight-room:v1:startup-warning'

export const SCHEMA_VERSION = 1

// The normalized shape persisted to disk.
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    machines: [], // { id, name, model, muscleGroup, type, notes, hasPhoto, archived, createdAt }
    workouts: [], // { id, date }  (date = 'YYYY-MM-DD', unique per date)
    sets: [], // { id, workoutId, machineId, weight, reps, order, t? }
    // Routines are ordered programs. Each item: { machineId, sets, repLow, repHigh }
    // (targets are advisory — actual weight/reps are whatever gets logged).
    routines: [], // { id, name, items: [item], createdAt }
    settings: { unit: 'lbs', bodyweight: 0 },
  }
}

// ---- Field coercion helpers ------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function nonNegNum(v, fallback = 0) {
  const n = num(v, fallback)
  return n >= 0 ? n : fallback
}

function str(v, fallback = '') {
  return typeof v === 'string' ? v : fallback
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---- Deep normalization ----------------------------------------------------

/**
 * Bring a routine (from storage or an old backup) to the current items shape.
 * Early routines stored a bare `exerciseIds` list — those become items with
 * default targets. Items with missing/invalid targets get nulls (no target).
 */
export function normalizeRoutine(r) {
  const clampInt = (v, lo, hi) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null
  }
  let items = []
  if (Array.isArray(r.items)) {
    items = r.items
      .filter((it) => it && it.machineId)
      .map((it) => ({
        machineId: it.machineId,
        sets: clampInt(it.sets, 1, 10) ?? 3,
        repLow: clampInt(it.repLow, 1, 100),
        repHigh: clampInt(it.repHigh, 1, 100),
      }))
  } else if (Array.isArray(r.exerciseIds)) {
    items = r.exerciseIds.map((machineId) => ({
      machineId,
      sets: 3,
      repLow: null,
      repHigh: null,
    }))
  }
  return { id: r.id || uid('r'), name: str(r.name) || 'Routine', items, createdAt: num(r.createdAt, 0) }
}

export function normalizeRoutines(routines) {
  return (Array.isArray(routines) ? routines : []).filter(isObj).map(normalizeRoutine)
}

function normalizeMachine(raw) {
  return {
    ...raw,
    id: raw.id || uid('m'),
    name: str(raw.name).trim() || 'Untitled Exercise',
    model: str(raw.model),
    muscleGroup: str(raw.muscleGroup) || 'Other',
    type: str(raw.type) || 'Machine',
    notes: str(raw.notes),
    hasPhoto: Boolean(raw.hasPhoto),
    archived: Boolean(raw.archived),
    createdAt: num(raw.createdAt, 0),
  }
}

/**
 * Deep-clean any state-shaped data into the persisted shape. Used on every
 * load and every import so nothing malformed enters the store. Records are
 * coerced, never dropped; unknown extra keys on records are preserved (they
 * may belong to a newer app version). Duplicate-date workouts are merged into
 * one (their sets remapped), since the app treats date as the workout key.
 */
export function normalizeState(data) {
  const base = emptyState()
  const src = isObj(data) ? data : {}

  const machines = (Array.isArray(src.machines) ? src.machines : [])
    .filter(isObj)
    .map(normalizeMachine)

  // Workouts: coerce, then merge duplicates by date (first one wins).
  const workoutIdRemap = new Map()
  const byDate = new Map()
  const workouts = []
  for (const raw of Array.isArray(src.workouts) ? src.workouts : []) {
    if (!isObj(raw)) continue
    const w = { ...raw, id: raw.id || uid('w'), date: str(raw.date) }
    if (DATE_RE.test(w.date) && byDate.has(w.date)) {
      workoutIdRemap.set(w.id, byDate.get(w.date).id)
      continue
    }
    if (DATE_RE.test(w.date)) byDate.set(w.date, w)
    workouts.push(w)
  }

  const sets = (Array.isArray(src.sets) ? src.sets : []).filter(isObj).map((raw) => {
    const s = {
      ...raw,
      id: raw.id || uid('s'),
      workoutId: workoutIdRemap.get(raw.workoutId) || raw.workoutId,
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
  }
  settings.unit = settings.unit === 'kg' ? 'kg' : 'lbs'
  settings.bodyweight = nonNegNum(settings.bodyweight)

  return {
    schemaVersion: SCHEMA_VERSION,
    machines,
    workouts,
    sets,
    routines: normalizeRoutines(src.routines),
    settings,
  }
}

// ---- localStorage gateway ----------------------------------------------------

function queueStartupWarning(message) {
  try {
    localStorage.setItem(WARNING_KEY, message)
  } catch {
    /* storage unusable — nothing more we can do */
  }
}

/** One-shot startup warning left by a previous load/save problem (or null). */
export function takeStartupWarning() {
  try {
    const msg = localStorage.getItem(WARNING_KEY)
    if (msg) localStorage.removeItem(WARNING_KEY)
    return msg || null
  } catch {
    return null
  }
}

/** Raw main document string as currently stored (or null). */
export function readRawDocument() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function loadState() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (err) {
    console.error('Storage unavailable:', err)
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!isObj(parsed)) throw new Error('not an object')
    return normalizeState(parsed)
  } catch (err) {
    // NEVER silently reseed over data that exists but won't parse: stash the
    // raw blob for manual recovery and queue a visible warning. The newest
    // corrupt blob is the most valuable; keep one previous generation too.
    console.error('Failed to parse saved data:', err)
    try {
      const prior = localStorage.getItem(RECOVERY_KEY)
      if (prior != null && prior !== raw) {
        localStorage.setItem(`${RECOVERY_KEY}-prev`, prior)
      }
      localStorage.setItem(RECOVERY_KEY, raw)
      queueStartupWarning(
        'Your saved data could not be read and a fresh library was loaded. ' +
          'The unreadable data was kept for recovery — export it from Settings → Data before logging anything important.',
      )
    } catch {
      queueStartupWarning(
        'Your saved data could not be read and a fresh library was loaded.',
      )
    }
    return null
  }
}

export function saveState(state) {
  try {
    // Persist only the data fields — never any transient UI state.
    const toSave = {
      schemaVersion: SCHEMA_VERSION,
      machines: state.machines,
      workouts: state.workouts,
      sets: state.sets,
      routines: state.routines,
      settings: state.settings,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    return true
  } catch (err) {
    console.error('Failed to save data:', err)
    return false
  }
}

/** Raw contents of the corrupt-data recovery stash (or null). */
export function getRecoveryStash() {
  try {
    return localStorage.getItem(RECOVERY_KEY)
  } catch {
    return null
  }
}

export function clearRecoveryStash() {
  try {
    localStorage.removeItem(RECOVERY_KEY)
    localStorage.removeItem(`${RECOVERY_KEY}-prev`)
  } catch {
    /* ignore */
  }
}

// ---- Backup import/export ----------------------------------------------------

/**
 * Build the full backup payload (Settings export and cloud sync both use this,
 * so they always stay in the same shape). Includes photos as base64 data-URLs.
 * NOTE: sync credentials live in their own storage keys and are intentionally
 * never part of this payload.
 */
export async function buildBackupPayload(state) {
  const { getAllPhotos } = await import('./idb.js')
  const photos = await getAllPhotos()
  return {
    app: 'weight-room',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      machines: state.machines,
      workouts: state.workouts,
      sets: state.sets,
      routines: state.routines,
      settings: state.settings,
    },
    photos, // { [machineId]: dataUrl }
  }
}

/**
 * Validate and normalize a full-backup payload (current or legacy shape).
 * Returns { data, photos } where data is a clean state. Throws with a
 * user-facing message when the payload is not a usable backup.
 */
export function parseBackup(payload) {
  if (payload?.type === 'workout') {
    throw new Error("That's a single-day file — use “Import a day” instead.")
  }
  const data = payload?.data || payload
  if (!isObj(data) || !Array.isArray(data.machines)) {
    throw new Error('Invalid backup file: missing machines.')
  }
  const photos = isObj(payload?.photos) ? payload.photos : {}
  return { data: normalizeState(data), photos }
}

/**
 * Merge a single-day export (from exportWorkout) into a state without
 * touching anything else. Machines are matched to existing ones by id, then
 * by name+model (case-insensitive); unmatched machines are created. Sets are
 * appended to the workout for that date (a workout is created if none
 * exists). Pure: returns { state, summary } and never mutates the input.
 */
export function mergeDayImport(state, payload, now = Date.now()) {
  const wk = payload?.workout
  if (!payload || payload.type !== 'workout' || !wk || !Array.isArray(wk.machines)) {
    throw new Error('Not a single-day workout file.')
  }
  const date = wk.date
  if (!DATE_RE.test(date || '')) {
    throw new Error('File is missing a valid workout date.')
  }

  const machines = [...state.machines]
  const norm = (s) => (s || '').trim().toLowerCase()
  const findMachine = (m) => {
    let found = machines.find((x) => x.id === m.id)
    if (found) return found
    return (
      machines.find(
        (x) => norm(x.name) === norm(m.name) && norm(x.model) === norm(m.model),
      ) || null
    )
  }

  const workouts = [...state.workouts]
  let workout = workouts.find((w) => w.date === date)
  const dayHadData = Boolean(workout) && state.sets.some((s) => s.workoutId === workout.id)
  if (!workout) {
    workout = { id: uid('w'), date }
    workouts.push(workout)
  }

  const sets = [...state.sets]
  let machinesAdded = 0
  let machinesMatched = 0
  let setsAdded = 0

  for (const m of wk.machines) {
    if (!isObj(m)) continue
    let target = findMachine(m)
    if (!target) {
      target = normalizeMachine({
        id: uid('m'),
        name: m.name,
        model: m.model,
        muscleGroup: m.muscleGroup,
        type: m.type,
        notes: m.notes,
        createdAt: now,
      })
      machines.push(target)
      machinesAdded++
    } else {
      machinesMatched++
    }
    const incoming = Array.isArray(m.sets) ? m.sets.filter(isObj) : []
    incoming.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let order = sets.filter(
      (s) => s.workoutId === workout.id && s.machineId === target.id,
    ).length
    for (const s of incoming) {
      sets.push({
        id: uid('s'),
        workoutId: workout.id,
        machineId: target.id,
        weight: nonNegNum(s.weight),
        reps: Math.round(nonNegNum(s.reps)),
        order: order++,
      })
      setsAdded++
    }
  }

  return {
    state: { ...state, machines, workouts, sets },
    summary: { date, machinesAdded, machinesMatched, setsAdded, dayHadData },
  }
}

export { STORAGE_KEY }
