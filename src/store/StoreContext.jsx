import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  emptyState,
  loadState,
  saveState,
  buildBackupPayload,
  parseBackup,
  mergeDayImport,
  normalizeState,
  normalizeRoutine,
  takeStartupWarning,
  readRawDocument,
  STORAGE_KEY,
  SCHEMA_VERSION,
} from '../lib/persistence.js'
import { isSyncEnabled, pushBackup } from '../lib/gistSync.js'
import { seedMachines, COMMON_EXERCISES, STARTER_PROGRAMS, PROGRAM_MACHINES } from '../data/seed.js'
import { uid } from '../lib/id.js'
import { todayISO, addDaysISO, epley1RM, setVolume, prSessionsForMachine } from '../lib/metrics.js'
import * as idb from '../lib/idb.js'

// ---- Reducer -------------------------------------------------------------

// Exported for tests only — the invariants it enforces (one workout per date,
// monotonically increasing set order, even for batched dispatches) are load-
// bearing and covered in tests/store.test.js.
export function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, loaded: true }

    case 'ADD_MACHINE':
      return { ...state, machines: [...state.machines, action.machine] }

    case 'ADD_MACHINES':
      return { ...state, machines: [...state.machines, ...action.machines] }

    case 'UPDATE_MACHINE':
      return {
        ...state,
        machines: state.machines.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      }

    case 'DELETE_MACHINE': {
      const workoutIdsToCheck = new Set(
        state.sets.filter((s) => s.machineId === action.id).map((s) => s.workoutId),
      )
      const sets = state.sets.filter((s) => s.machineId !== action.id)
      // Drop any workouts that no longer have sets.
      const usedWorkoutIds = new Set(sets.map((s) => s.workoutId))
      const workouts = state.workouts.filter(
        (w) => !workoutIdsToCheck.has(w.id) || usedWorkoutIds.has(w.id),
      )
      return {
        ...state,
        machines: state.machines.filter((m) => m.id !== action.id),
        sets,
        workouts,
        // Programs must not keep pointing at a machine that no longer exists.
        routines: state.routines.map((r) => ({
          ...r,
          items: r.items.filter((it) => it.machineId !== action.id),
        })),
      }
    }

    // Find-or-create the day's workout and compute the set's order INSIDE the
    // reducer: actions dispatched in the same task (rapid taps, synthetic
    // bursts) each see the latest state, so duplicate-date workouts and
    // clashing orders cannot be written. `date` is the workout key.
    case 'LOG_SET': {
      const existing = state.workouts.find((w) => w.date === action.date)
      const workoutId = existing ? existing.id : action.newWorkoutId
      const workouts = existing
        ? state.workouts
        : [...state.workouts, { id: workoutId, date: action.date }]
      let order = 0
      for (const s of state.sets) {
        if (s.workoutId === workoutId && s.machineId === action.machineId) {
          order = Math.max(order, (s.order ?? 0) + 1)
        }
      }
      const set = {
        id: action.setId,
        workoutId,
        machineId: action.machineId,
        weight: action.weight,
        reps: action.reps,
        order,
        t: action.t,
      }
      return { ...state, workouts, sets: [...state.sets, set] }
    }

    // Same find-or-create semantics for a batch of sets on one machine
    // (used by "Copy last workout").
    case 'ADD_SETS_FOR_DATE': {
      const existing = state.workouts.find((w) => w.date === action.date)
      const workoutId = existing ? existing.id : action.newWorkoutId
      const workouts = existing
        ? state.workouts
        : [...state.workouts, { id: workoutId, date: action.date }]
      let order = 0
      for (const s of state.sets) {
        if (s.workoutId === workoutId && s.machineId === action.machineId) {
          order = Math.max(order, (s.order ?? 0) + 1)
        }
      }
      const sets = action.sets.map((s, i) => ({
        ...s,
        workoutId,
        machineId: action.machineId,
        order: order + i,
      }))
      return { ...state, workouts, sets: [...state.sets, ...sets] }
    }

    case 'UPDATE_SET':
      return {
        ...state,
        sets: state.sets.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }

    case 'DELETE_SET': {
      const sets = state.sets.filter((s) => s.id !== action.id)
      // Prune empty workouts.
      const used = new Set(sets.map((s) => s.workoutId))
      const workouts = state.workouts.filter((w) => used.has(w.id))
      return { ...state, sets, workouts }
    }

    // Put a just-deleted set back (undo). The day's workout may have been
    // pruned by the delete, so find-or-create it by date; if the original
    // order was reused in the meantime, append instead of colliding.
    case 'RESTORE_SET': {
      if (state.sets.some((s) => s.id === action.set.id)) return state
      // The set's machine may have been deleted since ("removes the exercise
      // and all its logged sets" must stay true) — a restore would create an
      // invisible ghost set that inflates stats and can't be removed.
      if (!state.machines.some((m) => m.id === action.set.machineId)) return state
      const existing = state.workouts.find((w) => w.date === action.date)
      const workoutId = existing ? existing.id : action.newWorkoutId
      const workouts = existing
        ? state.workouts
        : [...state.workouts, { id: workoutId, date: action.date }]
      let order = action.set.order ?? 0
      let maxOrder = -1
      for (const s of state.sets) {
        if (s.workoutId === workoutId && s.machineId === action.set.machineId) {
          maxOrder = Math.max(maxOrder, s.order ?? 0)
          if ((s.order ?? 0) === order) order = null // collision → append
        }
      }
      if (order == null) order = maxOrder + 1
      return {
        ...state,
        workouts,
        sets: [...state.sets, { ...action.set, workoutId, order }],
      }
    }

    case 'DELETE_WORKOUT': {
      const sets = state.sets.filter((s) => s.workoutId !== action.id)
      const workouts = state.workouts.filter((w) => w.id !== action.id)
      return { ...state, sets, workouts }
    }

    case 'ADD_ROUTINE':
      return { ...state, routines: [...state.routines, action.routine] }

    case 'UPDATE_ROUTINE':
      return {
        ...state,
        routines: state.routines.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      }

    case 'DELETE_ROUTINE':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) }

    case 'SET_UNIT':
      return { ...state, settings: { ...state.settings, unit: action.unit } }

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }

    case 'REPLACE_ALL':
      return { ...action.payload, loaded: true }

    default:
      return state
  }
}

function initialState() {
  return { ...emptyState(), loaded: false }
}

// ---- Context -------------------------------------------------------------

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const didHydrate = useRef(false)
  // User-facing data-safety notice: { tone: 'warn' | 'error', msg }.
  const [notice, setNotice] = useState(null)
  const saveFailedRef = useRef(false)
  // Last deleted set, undoable for a few seconds: { set, date, key }.
  // Expiry is wall-clock and owned HERE (not by the snackbar component) so
  // navigating away can't pause the window and revive a stale undo later.
  const [undoable, setUndoable] = useState(null)
  const undoTimerRef = useRef(null)

  // Raw document string as of hydration, to detect non-React writers that
  // slipped in before our first save (no storage event fires for
  // same-document writes).
  const rawAtHydrateRef = useRef(null)
  const firstSaveCheckedRef = useRef(false)

  // Hydrate once on mount: load saved data, or seed a fresh library.
  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    rawAtHydrateRef.current = readRawDocument()
    const saved = loadState()
    if (saved) {
      dispatch({ type: 'HYDRATE', payload: saved })
    } else {
      const fresh = { ...emptyState(), machines: seedMachines() }
      dispatch({ type: 'HYDRATE', payload: fresh })
    }
    const warning = takeStartupWarning()
    if (warning) setNotice({ tone: 'warn', msg: warning })
  }, [])

  // Persist on any data change (after hydration). A failed write (storage
  // full, private mode…) must never be silent — the user is still logging.
  useEffect(() => {
    if (!state.loaded) return
    // Before the very first save, re-check storage: if someone else wrote
    // between our load and now, adopt their document instead of blindly
    // overwriting it with what we hydrated.
    if (!firstSaveCheckedRef.current) {
      firstSaveCheckedRef.current = true
      const current = readRawDocument()
      if (current != null && current !== rawAtHydrateRef.current) {
        try {
          dispatch({ type: 'HYDRATE', payload: normalizeState(JSON.parse(current)) })
          return // the adopted state re-triggers this effect and saves then
        } catch {
          /* unreadable external write — proceed with our own state */
        }
      }
    }
    const ok = saveState(state)
    if (!ok && !saveFailedRef.current) {
      saveFailedRef.current = true
      setNotice({
        tone: 'error',
        msg: 'Saving to this device failed — storage may be full. Your changes only live in this tab right now: export a backup from Settings before closing.',
      })
    } else if (ok && saveFailedRef.current) {
      saveFailedRef.current = false
      setNotice(null)
    }
  }, [state.machines, state.workouts, state.sets, state.routines, state.settings, state.loaded])

  // Adopt changes written by another tab/window (same data, e.g. PWA + browser
  // tab both open at the gym). Without this, the stale tab's next save would
  // silently clobber the other tab's sets.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return
      try {
        dispatch({ type: 'HYDRATE', payload: normalizeState(JSON.parse(e.newValue)) })
      } catch {
        /* another writer left something unreadable; keep our in-memory state */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Cloud sync (opt-in): quietly push a full backup a few seconds after the
  // data settles. No-op unless the user connected a gist token in Settings.
  const syncTimer = useRef(null)
  useEffect(() => {
    if (!state.loaded || !isSyncEnabled()) return
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      buildBackupPayload(state)
        .then(pushBackup)
        .catch(() => {}) // status surfaces in Settings; never interrupt logging
    }, 8000)
    return () => clearTimeout(syncTimer.current)
  }, [state.machines, state.workouts, state.sets, state.routines, state.settings, state.loaded])

  // ---- Actions (memoized) ----
  const actions = useMemo(() => {
    return {
      // Exercises (machines, free weights, bodyweight…)
      addMachine({ name, model, muscleGroup, type, notes }, photoDataUrl) {
        const id = uid('m')
        const machine = {
          id,
          name: name?.trim() || 'Untitled Exercise',
          model: model?.trim() || '',
          muscleGroup: muscleGroup || 'Other',
          type: type || 'Machine',
          notes: notes?.trim() || '',
          hasPhoto: false,
          archived: false,
          createdAt: Date.now(),
        }
        dispatch({ type: 'ADD_MACHINE', machine })
        if (photoDataUrl) {
          idb.putPhoto(id, photoDataUrl).then(() => {
            dispatch({ type: 'UPDATE_MACHINE', id, patch: { hasPhoto: true } })
          })
        }
        return id
      },

      updateMachine(id, patch) {
        dispatch({ type: 'UPDATE_MACHINE', id, patch })
      },

      deleteMachine(id) {
        idb.deletePhoto(id).catch(() => {})
        dispatch({ type: 'DELETE_MACHINE', id })
        // A pending set-undo for this machine must die with it.
        setUndoable((u) => (u && u.set.machineId === id ? null : u))
      },

      // Photos
      async setMachinePhoto(id, dataUrl) {
        await idb.putPhoto(id, dataUrl)
        dispatch({ type: 'UPDATE_MACHINE', id, patch: { hasPhoto: true } })
      },

      async removeMachinePhoto(id) {
        await idb.deletePhoto(id)
        dispatch({ type: 'UPDATE_MACHINE', id, patch: { hasPhoto: false } })
      },

      getMachinePhoto(id) {
        return idb.getPhoto(id)
      },

      // Workouts & sets
      /**
       * Log one set on a date. The workout is found-or-created and the order
       * assigned inside the reducer (race-free). Values are clamped to the
       * same rules as everywhere else: weight ≥ 0, reps ≥ 1.
       */
      logSet({ date, machineId, weight, reps }) {
        // Defense in depth: a malformed date must never become a workout key
        // (the UI sanitizes, but the route param is attacker-controllable).
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return
        const w = Number(weight)
        const r = Math.round(Number(reps))
        dispatch({
          type: 'LOG_SET',
          date,
          machineId,
          weight: Number.isFinite(w) ? Math.min(Math.max(w, 0), 20000) : 0,
          reps: Number.isFinite(r) ? Math.min(Math.max(r, 1), 1000) : 1,
          setId: uid('s'),
          newWorkoutId: uid('w'),
          t: Date.now(), // wall-clock time logged, for session elapsed display
        })
      },

      updateSet(id, patch) {
        // Same rules as set entry: weights are non-negative and reps are
        // positive integers — the edit path must not admit values the add
        // path forbids (negative volume, phantom 0-rep sets).
        const clean = {}
        if (patch.weight != null) {
          const w = Number(patch.weight)
          clean.weight = Number.isFinite(w) ? Math.min(Math.max(w, 0), 20000) : 0
        }
        if (patch.reps != null) {
          const r = Math.round(Number(patch.reps))
          clean.reps = Number.isFinite(r) ? Math.min(Math.max(r, 1), 1000) : 1
        }
        dispatch({ type: 'UPDATE_SET', id, patch: clean })
      },

      deleteSet(id) {
        // Keep the deleted set undoable — the delete button lives an inch from
        // the edit buttons and gym thumbs are sweaty.
        const set = state.sets.find((s) => s.id === id)
        const workout = set && state.workouts.find((w) => w.id === set.workoutId)
        dispatch({ type: 'DELETE_SET', id })
        if (set && workout) {
          setUndoable({ set, date: workout.date, key: `${id}:${Date.now()}` })
          clearTimeout(undoTimerRef.current)
          undoTimerRef.current = setTimeout(() => setUndoable(null), 6000)
        }
      },

      undoDeleteSet(entry) {
        dispatch({
          type: 'RESTORE_SET',
          set: entry.set,
          date: entry.date,
          newWorkoutId: uid('w'),
        })
        clearTimeout(undoTimerRef.current)
        setUndoable(null)
      },

      clearUndoable() {
        clearTimeout(undoTimerRef.current)
        setUndoable(null)
      },

      deleteWorkout(id) {
        dispatch({ type: 'DELETE_WORKOUT', id })
      },

      /**
       * Copy the most recent other session's sets for a machine onto a date.
       * Returns the number of sets copied.
       */
      copyLastWorkoutForMachine(machineId, date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 0
        const target = state.workouts.find((w) => w.date === date)
        const candidates = state.workouts
          .filter((w) => w.id !== target?.id)
          .filter((w) => state.sets.some((s) => s.workoutId === w.id && s.machineId === machineId))
          .sort((a, b) => b.date.localeCompare(a.date))
        const source = candidates[0]
        if (!source) return 0
        const sourceSets = state.sets
          .filter((s) => s.workoutId === source.id && s.machineId === machineId)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        dispatch({
          type: 'ADD_SETS_FOR_DATE',
          date,
          machineId,
          newWorkoutId: uid('w'),
          sets: sourceSets.map((s) => ({
            id: uid('s'),
            weight: s.weight,
            reps: s.reps,
            t: Date.now(), // counts toward this session's elapsed time like any logged set
          })),
        })
        return sourceSets.length
      },

      // Settings
      setUnit(unit) {
        dispatch({ type: 'SET_UNIT', unit })
      },

      setBodyweight(value) {
        // Clamp immediately — a negative bodyweight would otherwise sit in
        // storage until the next reload's normalization repaired it.
        const n = Number(value)
        const clamped = Number.isFinite(n) ? Math.min(Math.max(n, 0), 2000) : 0
        dispatch({ type: 'SET_SETTING', key: 'bodyweight', value: clamped })
      },

      // Routines: ordered programs of { machineId, sets, repLow, repHigh }.
      addRoutine({ name, items }) {
        const routine = normalizeRoutine({
          id: uid('r'),
          name,
          items,
          createdAt: Date.now(),
        })
        dispatch({ type: 'ADD_ROUTINE', routine })
        return routine.id
      },

      updateRoutine(id, patch) {
        const clean = { ...patch }
        if (patch.items) {
          clean.items = normalizeRoutine({ id, name: 'x', items: patch.items }).items
        }
        dispatch({ type: 'UPDATE_ROUTINE', id, patch: clean })
      },

      deleteRoutine(id) {
        dispatch({ type: 'DELETE_ROUTINE', id })
      },

      /**
       * Install the starter Lower/Upper day programs. Items are declared by
       * machine NAME: they resolve to existing machines case-insensitively,
       * and machines listed in PROGRAM_MACHINES are created when missing
       * (e.g. Seated Rotary Calf). Routines whose name already exists are
       * left untouched. Returns a summary for user feedback.
       */
      installStarterPrograms() {
        const norm = (s) => (s || '').trim().toLowerCase()
        const byName = new Map(state.machines.filter((m) => !m.archived).map((m) => [norm(m.name), m]))
        const specByName = new Map(PROGRAM_MACHINES.map((m) => [norm(m.name), m]))
        const existingRoutines = new Set(state.routines.map((r) => norm(r.name)))

        const newMachines = []
        const resolve = (name) => {
          const key = norm(name)
          let m = byName.get(key)
          if (m) return m.id
          const spec = specByName.get(key) || { name, muscleGroup: 'Other', type: 'Machine' }
          m = {
            id: uid('m'),
            name: spec.name || name,
            model: spec.model || '',
            muscleGroup: spec.muscleGroup || 'Other',
            type: spec.type || 'Machine',
            notes: spec.notes || '',
            hasPhoto: false,
            archived: false,
            createdAt: Date.now() + newMachines.length,
          }
          newMachines.push(m)
          byName.set(key, m)
          return m.id
        }

        let added = 0
        let skipped = 0
        const newRoutines = []
        for (const program of STARTER_PROGRAMS) {
          if (existingRoutines.has(norm(program.name))) {
            skipped++
            continue
          }
          newRoutines.push(
            normalizeRoutine({
              id: uid('r'),
              name: program.name,
              items: program.items.map((it) => ({
                machineId: resolve(it.machine),
                sets: it.sets,
                repLow: it.repLow,
                repHigh: it.repHigh,
              })),
              createdAt: Date.now() + added,
            }),
          )
          added++
        }

        if (newMachines.length) dispatch({ type: 'ADD_MACHINES', machines: newMachines })
        for (const r of newRoutines) dispatch({ type: 'ADD_ROUTINE', routine: r })
        return { added, skipped, machinesCreated: newMachines.length }
      },

      /** Add the common free-weight/bodyweight exercises not already present. */
      addCommonExercises() {
        const existing = new Set(state.machines.map((m) => m.name.trim().toLowerCase()))
        const now = Date.now()
        const toAdd = COMMON_EXERCISES.filter(
          (e) => !existing.has(e.name.toLowerCase()),
        ).map((e, i) => ({
          id: uid('m'),
          name: e.name,
          model: '',
          muscleGroup: e.muscleGroup,
          type: e.type,
          notes: '',
          hasPhoto: false,
          archived: false,
          createdAt: now + i,
        }))
        if (toAdd.length) dispatch({ type: 'ADD_MACHINES', machines: toAdd })
        return toAdd.length
      },

      /**
       * Build a self-contained export of a single day's workout. Machine
       * details are denormalized into each entry (with per-set and per-machine
       * metrics) so the file is readable and useful on its own — no need for
       * the full library. Returns null if no sets were logged that day.
       */
      exportWorkout(date) {
        const workout = state.workouts.find((w) => w.date === date)
        if (!workout) return null
        const sets = state.sets.filter((s) => s.workoutId === workout.id)
        if (!sets.length) return null

        const machineById = new Map(state.machines.map((m) => [m.id, m]))
        const byMachine = new Map()
        for (const s of sets) {
          if (!byMachine.has(s.machineId)) byMachine.set(s.machineId, [])
          byMachine.get(s.machineId).push(s)
        }

        let totalVolume = 0
        let totalSets = 0
        const machines = []
        for (const [machineId, machineSets] of byMachine) {
          const m = machineById.get(machineId)
          const ordered = [...machineSets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          let topSetWeight = 0
          let best1RM = 0
          let volume = 0
          const outSets = ordered.map((s) => {
            const est1RM = Math.round(epley1RM(s.weight, s.reps) * 10) / 10
            topSetWeight = Math.max(topSetWeight, Number(s.weight) || 0)
            best1RM = Math.max(best1RM, est1RM)
            volume += setVolume(s)
            return { weight: s.weight, reps: s.reps, order: s.order ?? 0, est1RM }
          })
          totalVolume += volume
          totalSets += outSets.length
          machines.push({
            id: machineId,
            name: m?.name || 'Unknown machine',
            model: m?.model || '',
            muscleGroup: m?.muscleGroup || 'Other',
            notes: m?.notes || '',
            sets: outSets,
            topSetWeight,
            best1RM,
            volume,
          })
        }

        return {
          app: 'weight-room',
          type: 'workout',
          schemaVersion: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          unit: state.settings.unit,
          workout: {
            date: workout.date,
            machines,
            totals: { machines: machines.length, sets: totalSets, volume: totalVolume },
          },
        }
      },

      // Data management
      exportData() {
        return buildBackupPayload(state)
      },

      async importData(payload) {
        const { data, photos } = parseBackup(payload)
        await idb.replaceAllPhotos(photos)
        dispatch({ type: 'REPLACE_ALL', payload: data })
        setUndoable(null) // a pre-import set must not be undoable into the new data
      },

      /**
       * Merge a single-day export (from exportWorkout) into the current log
       * without touching anything else. Machines are matched to existing ones
       * by id, then by name+model (case-insensitive); unmatched machines are
       * created. Sets are appended to the workout for that date (a workout is
       * created if none exists). Returns a summary for user feedback.
       */
      importWorkout(payload) {
        const { state: next, summary } = mergeDayImport(state, payload)
        dispatch({ type: 'REPLACE_ALL', payload: next })
        return summary
      },

      async resetAll() {
        await idb.replaceAllPhotos({})
        const fresh = { ...emptyState(), machines: seedMachines() }
        dispatch({ type: 'REPLACE_ALL', payload: fresh })
        setUndoable(null)
      },

      /** Generate a few weeks of plausible sample sets across seeded machines. */
      loadSampleHistory() {
        const machines = state.machines.filter((m) => !m.archived)
        if (!machines.length) return
        // Dates must reuse an existing workout — the app treats date as the
        // workout key, so creating a second record for the same day would
        // split that day's data.
        const workoutIdByDate = new Map(state.workouts.map((w) => [w.date, w.id]))
        const workouts = []
        const sets = []
        // 6 sessions over the last ~3 weeks, 3 machines each.
        const today = todayISO()
        for (let session = 0; session < 6; session++) {
          const date = addDaysISO(today, -session * 3)
          let workoutId = workoutIdByDate.get(date)
          if (!workoutId) {
            workoutId = uid('w')
            workoutIdByDate.set(date, workoutId)
            workouts.push({ id: workoutId, date })
          }
          const picks = machines.slice((session * 3) % machines.length).slice(0, 3)
          const chosen = picks.length >= 3 ? picks : machines.slice(0, 3)
          chosen.forEach((m, mi) => {
            const base = 40 + mi * 25 + (5 - session) * 5 // progressive overload over time
            for (let setIdx = 0; setIdx < 3; setIdx++) {
              sets.push({
                id: uid('s'),
                workoutId,
                machineId: m.id,
                weight: base + setIdx * 0,
                reps: 12 - setIdx * 2,
                order: setIdx,
              })
            }
          })
        }
        dispatch({
          type: 'REPLACE_ALL',
          payload: {
            ...state,
            workouts: [...state.workouts, ...workouts],
            sets: [...state.sets, ...sets],
          },
        })
      },
    }
  }, [state])

  const value = useMemo(
    () => ({ state, notice, dismissNotice: () => setNotice(null), undoable, ...actions }),
    [state, notice, undoable, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}

// Convenience selector hooks.
export function useUnit() {
  return useStore().state.settings.unit
}

export function useMachines() {
  return useStore().state.machines
}
