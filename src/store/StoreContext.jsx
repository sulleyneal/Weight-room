import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { emptyState, loadState, saveState, SCHEMA_VERSION } from '../lib/persistence.js'
import { seedMachines } from '../data/seed.js'
import { uid } from '../lib/id.js'
import { todayISO, epley1RM, setVolume } from '../lib/metrics.js'
import * as idb from '../lib/idb.js'

// ---- Reducer -------------------------------------------------------------

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, loaded: true }

    case 'ADD_MACHINE':
      return { ...state, machines: [...state.machines, action.machine] }

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
      }
    }

    case 'ADD_WORKOUT':
      return { ...state, workouts: [...state.workouts, action.workout] }

    case 'ADD_SET':
      return { ...state, sets: [...state.sets, action.set] }

    case 'ADD_SETS':
      return { ...state, sets: [...state.sets, ...action.sets] }

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

    case 'DELETE_WORKOUT': {
      const sets = state.sets.filter((s) => s.workoutId !== action.id)
      const workouts = state.workouts.filter((w) => w.id !== action.id)
      return { ...state, sets, workouts }
    }

    case 'SET_UNIT':
      return { ...state, settings: { ...state.settings, unit: action.unit } }

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

  // Hydrate once on mount: load saved data, or seed a fresh library.
  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    const saved = loadState()
    if (saved) {
      dispatch({ type: 'HYDRATE', payload: saved })
    } else {
      const fresh = { ...emptyState(), machines: seedMachines() }
      dispatch({ type: 'HYDRATE', payload: fresh })
    }
  }, [])

  // Persist on any data change (after hydration).
  useEffect(() => {
    if (!state.loaded) return
    saveState(state)
  }, [state.machines, state.workouts, state.sets, state.settings, state.loaded])

  // ---- Actions (memoized) ----
  const actions = useMemo(() => {
    return {
      // Machines
      addMachine({ name, model, muscleGroup, notes }, photoDataUrl) {
        const id = uid('m')
        const machine = {
          id,
          name: name?.trim() || 'Untitled Machine',
          model: model?.trim() || '',
          muscleGroup: muscleGroup || 'Other',
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
      /** Find an existing workout for a date or create one; returns its id. */
      ensureWorkout(date) {
        const existing = state.workouts.find((w) => w.date === date)
        if (existing) return existing.id
        const workout = { id: uid('w'), date }
        dispatch({ type: 'ADD_WORKOUT', workout })
        return workout.id
      },

      addSet({ workoutId, machineId, weight, reps }) {
        const order =
          state.sets.filter((s) => s.workoutId === workoutId && s.machineId === machineId)
            .length
        const set = {
          id: uid('s'),
          workoutId,
          machineId,
          weight: Number(weight) || 0,
          reps: Number(reps) || 0,
          order,
        }
        dispatch({ type: 'ADD_SET', set })
        return set
      },

      updateSet(id, patch) {
        const clean = {}
        if (patch.weight != null) clean.weight = Number(patch.weight) || 0
        if (patch.reps != null) clean.reps = Number(patch.reps) || 0
        dispatch({ type: 'UPDATE_SET', id, patch: clean })
      },

      deleteSet(id) {
        dispatch({ type: 'DELETE_SET', id })
      },

      deleteWorkout(id) {
        dispatch({ type: 'DELETE_WORKOUT', id })
      },

      /**
       * Copy the most recent session's sets for a machine into the given workout.
       * Returns the number of sets copied.
       */
      copyLastWorkoutForMachine(machineId, targetWorkoutId) {
        // Find the latest workout date (other than the target) that has sets for this machine.
        const targetWorkout = state.workouts.find((w) => w.id === targetWorkoutId)
        const candidates = state.workouts
          .filter((w) => w.id !== targetWorkoutId)
          .filter((w) => state.sets.some((s) => s.workoutId === w.id && s.machineId === machineId))
          .sort((a, b) => b.date.localeCompare(a.date))
        const source = candidates[0]
        if (!source) return 0
        const sourceSets = state.sets
          .filter((s) => s.workoutId === source.id && s.machineId === machineId)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const baseOrder = state.sets.filter(
          (s) => s.workoutId === targetWorkoutId && s.machineId === machineId,
        ).length
        const newSets = sourceSets.map((s, i) => ({
          id: uid('s'),
          workoutId: targetWorkoutId,
          machineId,
          weight: s.weight,
          reps: s.reps,
          order: baseOrder + i,
        }))
        if (newSets.length) dispatch({ type: 'ADD_SETS', sets: newSets })
        void targetWorkout
        return newSets.length
      },

      // Settings
      setUnit(unit) {
        dispatch({ type: 'SET_UNIT', unit })
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
      async exportData() {
        const photos = await idb.getAllPhotos()
        return {
          app: 'weight-room',
          schemaVersion: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          data: {
            machines: state.machines,
            workouts: state.workouts,
            sets: state.sets,
            settings: state.settings,
          },
          photos, // { [machineId]: dataUrl }
        }
      },

      async importData(payload) {
        if (payload?.type === 'workout') {
          throw new Error("That's a single-day file — use “Import a day” instead.")
        }
        const data = payload?.data || payload
        if (!data || !Array.isArray(data.machines)) {
          throw new Error('Invalid backup file: missing machines.')
        }
        const next = {
          ...emptyState(),
          machines: data.machines,
          workouts: data.workouts || [],
          sets: data.sets || [],
          settings: { ...emptyState().settings, ...(data.settings || {}) },
        }
        await idb.replaceAllPhotos(payload?.photos || {})
        dispatch({ type: 'REPLACE_ALL', payload: next })
      },

      /**
       * Merge a single-day export (from exportWorkout) into the current log
       * without touching anything else. Machines are matched to existing ones
       * by id, then by name+model (case-insensitive); unmatched machines are
       * created. Sets are appended to the workout for that date (a workout is
       * created if none exists). Returns a summary for user feedback.
       */
      importWorkout(payload) {
        const wk = payload?.workout
        if (!payload || payload.type !== 'workout' || !wk || !Array.isArray(wk.machines)) {
          throw new Error('Not a single-day workout file.')
        }
        const date = wk.date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
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
        const dayHadData =
          Boolean(workout) && state.sets.some((s) => s.workoutId === workout.id)
        if (!workout) {
          workout = { id: uid('w'), date }
          workouts.push(workout)
        }

        const sets = [...state.sets]
        let machinesAdded = 0
        let machinesMatched = 0
        let setsAdded = 0

        for (const m of wk.machines) {
          let target = findMachine(m)
          if (!target) {
            target = {
              id: uid('m'),
              name: (m.name || 'Untitled Machine').trim(),
              model: (m.model || '').trim(),
              muscleGroup: m.muscleGroup || 'Other',
              notes: (m.notes || '').trim(),
              hasPhoto: false,
              archived: false,
              createdAt: Date.now(),
            }
            machines.push(target)
            machinesAdded++
          } else {
            machinesMatched++
          }
          const incoming = Array.isArray(m.sets) ? [...m.sets] : []
          incoming.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          let order = sets.filter(
            (s) => s.workoutId === workout.id && s.machineId === target.id,
          ).length
          for (const s of incoming) {
            sets.push({
              id: uid('s'),
              workoutId: workout.id,
              machineId: target.id,
              weight: Number(s.weight) || 0,
              reps: Number(s.reps) || 0,
              order: order++,
            })
            setsAdded++
          }
        }

        dispatch({ type: 'REPLACE_ALL', payload: { ...state, machines, workouts, sets } })
        return { date, machinesAdded, machinesMatched, setsAdded, dayHadData }
      },

      async resetAll() {
        await idb.replaceAllPhotos({})
        const fresh = { ...emptyState(), machines: seedMachines() }
        dispatch({ type: 'REPLACE_ALL', payload: fresh })
      },

      /** Generate a few weeks of plausible sample sets across seeded machines. */
      loadSampleHistory() {
        const machines = state.machines.filter((m) => !m.archived)
        if (!machines.length) return
        const workouts = []
        const sets = []
        // 6 sessions over the last ~3 weeks, 3 machines each.
        const today = new Date()
        for (let session = 0; session < 6; session++) {
          const d = new Date(today)
          d.setDate(today.getDate() - session * 3)
          const date = d.toISOString().slice(0, 10)
          const workoutId = uid('w')
          workouts.push({ id: workoutId, date })
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

  const value = useMemo(() => ({ state, ...actions }), [state, actions])

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
