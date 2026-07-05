// App-data persistence layer.
//
// Everything except photos lives in localStorage as a single normalized JSON
// document. This module is the ONLY place that talks to localStorage, and it
// exposes a small repository-style API (load/save). Swapping to a real database
// later means reimplementing `loadState` / `saveState` (e.g. as async fetches)
// and the store calling them — no UI changes required.

const STORAGE_KEY = 'weight-room:v1'

export const SCHEMA_VERSION = 1

// The normalized shape persisted to disk.
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    machines: [], // { id, name, model, muscleGroup, type, notes, hasPhoto, archived, createdAt }
    workouts: [], // { id, date }  (date = 'YYYY-MM-DD')
    sets: [], // { id, workoutId, machineId, weight, reps, order }
    // Routines are ordered programs. Each item: { machineId, sets, repLow, repHigh }
    // (targets are advisory — actual weight/reps are whatever gets logged).
    routines: [], // { id, name, items: [item], createdAt }
    settings: { unit: 'lbs', bodyweight: 0 },
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return migrate(parsed)
  } catch (err) {
    console.error('Failed to load saved data:', err)
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
  return { id: r.id, name: r.name || 'Routine', items, createdAt: r.createdAt || 0 }
}

export function normalizeRoutines(routines) {
  return (routines || []).filter(Boolean).map(normalizeRoutine)
}

// Forward-compatible migration hook. Currently a no-op beyond shape-filling.
function migrate(state) {
  const base = emptyState()
  return {
    ...base,
    ...state,
    settings: { ...base.settings, ...(state.settings || {}) },
    // Backfill equipment type for entries created before it existed.
    machines: (state.machines || []).map((m) => ({ type: 'Machine', ...m })),
    workouts: state.workouts || [],
    sets: state.sets || [],
    routines: normalizeRoutines(state.routines),
  }
}

export { STORAGE_KEY }
