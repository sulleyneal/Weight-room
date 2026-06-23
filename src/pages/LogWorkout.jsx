import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { todayISO, fmtDate, epley1RM, sessionsForMachine } from '../lib/metrics.js'
import { weightStep, unitLabel, fmtWeight } from '../lib/units.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import NumberStepper from '../components/NumberStepper.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import Modal from '../components/Modal.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import {
  IconPlus,
  IconTrash,
  IconRepeat,
  IconCopy,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from '../components/Icons.jsx'

export default function LogWorkout({ date: routeDate }) {
  const store = useStore()
  const { state } = store
  const unit = state.settings.unit

  const [date, setDate] = useState(routeDate || todayISO())
  const [pickerOpen, setPickerOpen] = useState(false)
  // Machines explicitly added to this session that don't yet have sets.
  const [addedMachineIds, setAddedMachineIds] = useState([])

  useEffect(() => {
    if (routeDate) setDate(routeDate)
  }, [routeDate])

  // Reset the "added" list when the date changes.
  useEffect(() => {
    setAddedMachineIds([])
  }, [date])

  const workout = state.workouts.find((w) => w.date === date)
  const todaysSets = useMemo(
    () => (workout ? state.sets.filter((s) => s.workoutId === workout.id) : []),
    [workout, state.sets],
  )

  // Machine ids in display order: those with sets today (by first appearance)
  // followed by explicitly-added ones.
  const sessionMachineIds = useMemo(() => {
    const withSets = []
    const seen = new Set()
    for (const s of todaysSets) {
      if (!seen.has(s.machineId)) {
        seen.add(s.machineId)
        withSets.push(s.machineId)
      }
    }
    const extras = addedMachineIds.filter((id) => !seen.has(id))
    return [...withSets, ...extras]
  }, [todaysSets, addedMachineIds])

  function shiftDate(days) {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + days)
    setDate(dt.toISOString().slice(0, 10))
  }

  function addMachineToSession(machineId) {
    setPickerOpen(false)
    setAddedMachineIds((ids) => (ids.includes(machineId) ? ids : [...ids, machineId]))
  }

  const machineById = useMemo(
    () => new Map(state.machines.map((m) => [m.id, m])),
    [state.machines],
  )

  return (
    <div>
      <PageHeader title="Log workout" subtitle={fmtDate(date)} />

      {/* Date control */}
      <div className="card p-3 mb-4 flex items-center gap-2">
        <button className="btn-ghost w-12 h-12 p-0" onClick={() => shiftDate(-1)} aria-label="Previous day">
          <IconChevronLeft size={22} />
        </button>
        <label className="flex-1 relative">
          <span className="sr-only">Workout date</span>
          <IconCalendar
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="input pl-10 text-center"
          />
        </label>
        <button
          className="btn-ghost w-12 h-12 p-0 disabled:opacity-30"
          onClick={() => shiftDate(1)}
          disabled={date >= todayISO()}
          aria-label="Next day"
        >
          <IconChevronRight size={22} />
        </button>
      </div>

      {sessionMachineIds.length === 0 && (
        <div className="card p-8 text-center mb-4">
          <p className="text-slate-400 mb-1">No machines yet for this day.</p>
          <p className="text-slate-500 text-sm mb-4">Add a machine to start logging sets.</p>
        </div>
      )}

      <div className="space-y-4">
        {sessionMachineIds.map((machineId) => {
          const machine = machineById.get(machineId)
          if (!machine) return null
          return (
            <MachineBlock
              key={machineId}
              machine={machine}
              date={date}
              unit={unit}
              store={store}
            />
          )
        })}
      </div>

      <button className="btn-primary w-full mt-4" onClick={() => setPickerOpen(true)}>
        <IconPlus size={20} /> Add machine
      </button>

      <MachinePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        machines={state.machines.filter((m) => !m.archived)}
        excludeIds={sessionMachineIds}
        onPick={addMachineToSession}
      />
    </div>
  )
}

// ---- Per-machine set entry block ----------------------------------------

function MachineBlock({ machine, date, unit, store }) {
  const { state } = store

  const workout = state.workouts.find((w) => w.date === date)
  const sets = useMemo(() => {
    if (!workout) return []
    return state.sets
      .filter((s) => s.workoutId === workout.id && s.machineId === machine.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [workout, state.sets, machine.id])

  // Most recent prior set for sensible defaults.
  const lastEverSet = useMemo(() => {
    const sessions = sessionsForMachine(machine.id, state.workouts, state.sets)
    const prior = sessions.filter((s) => s.date < date || (s.date === date && s.sets.length))
    const last = sessions[sessions.length - 1]
    void prior
    if (!last) return null
    return last.sets[last.sets.length - 1] || null
  }, [machine.id, state.workouts, state.sets, date])

  const lastTodaySet = sets[sets.length - 1] || null
  const seedSet = lastTodaySet || lastEverSet

  const [weight, setWeight] = useState(seedSet?.weight ?? (unit === 'kg' ? 20 : 45))
  const [reps, setReps] = useState(seedSet?.reps ?? 10)

  function addSet() {
    const workoutId = store.ensureWorkout(date)
    store.addSet({ workoutId, machineId: machine.id, weight, reps })
  }

  function repeatLastSet() {
    const ref = lastTodaySet || lastEverSet
    if (!ref) return addSet()
    const workoutId = store.ensureWorkout(date)
    store.addSet({ workoutId, machineId: machine.id, weight: ref.weight, reps: ref.reps })
    setWeight(ref.weight)
    setReps(ref.reps)
  }

  function copyLastWorkout() {
    const workoutId = store.ensureWorkout(date)
    const n = store.copyLastWorkoutForMachine(machine.id, workoutId)
    if (n === 0) alert('No previous session found for this machine.')
  }

  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const top = sets.reduce((max, s) => Math.max(max, s.weight), 0)
  const best1rm = sets.reduce((max, s) => Math.max(max, epley1RM(s.weight, s.reps)), 0)

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-700/40 transition"
        onClick={() => navigate(`/machine/${machine.id}`)}
      >
        <MachinePhoto machine={machine} className="w-12 h-12 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{machine.name}</div>
          <div className="text-xs text-slate-400 truncate">{machine.model}</div>
        </div>
        <MuscleChip group={machine.muscleGroup} />
      </button>

      {/* Logged sets */}
      {sets.length > 0 && (
        <div className="px-3 pb-1">
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-1 pb-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span />
          </div>
          <div className="space-y-1.5">
            {sets.map((s, i) => (
              <SetRow key={s.id} index={i + 1} set={s} unit={unit} store={store} />
            ))}
          </div>
        </div>
      )}

      {/* Entry */}
      <div className="p-3 border-t border-ink-700 mt-1 space-y-3">
        <div className="space-y-3">
          <NumberStepper
            label={`Weight (${unitLabel(unit)})`}
            value={weight}
            onChange={setWeight}
            step={weightStep(unit)}
            min={0}
          />
          <NumberStepper label="Reps" value={reps} onChange={setReps} step={1} min={0} />
        </div>
        <button className="btn-primary w-full" onClick={addSet}>
          <IconPlus size={20} /> Add set
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost text-sm" onClick={repeatLastSet}>
            <IconRepeat size={18} /> Repeat last set
          </button>
          <button className="btn-ghost text-sm" onClick={copyLastWorkout}>
            <IconCopy size={18} /> Copy last workout
          </button>
        </div>

        {sets.length > 0 && (
          <div className="flex justify-between text-xs text-slate-400 pt-1">
            <span>Top: {fmtWeight(top, unit)}</span>
            <span>Est. 1RM: {fmtWeight(best1rm, unit)}</span>
            <span>Vol: {Math.round(volume).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SetRow({ index, set, unit, store }) {
  const [editing, setEditing] = useState(false)
  const [w, setW] = useState(set.weight)
  const [r, setR] = useState(set.reps)

  if (editing) {
    return (
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center">
        <span className="text-slate-500 font-semibold text-center">{index}</span>
        <input
          type="number"
          inputMode="decimal"
          className="input py-2 text-center"
          value={w}
          onChange={(e) => setW(e.target.value)}
        />
        <input
          type="number"
          inputMode="numeric"
          className="input py-2 text-center"
          value={r}
          onChange={(e) => setR(e.target.value)}
        />
        <button
          className="btn-primary p-0 w-9 h-9 text-xs"
          onClick={() => {
            store.updateSet(set.id, { weight: w, reps: r })
            setEditing(false)
          }}
          aria-label="Save set"
        >
          ✓
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center bg-ink-700/40 rounded-lg py-1.5">
      <span className="text-slate-500 font-semibold text-center">{index}</span>
      <button className="text-left font-semibold tabular-nums pl-1" onClick={() => setEditing(true)}>
        {fmtWeight(set.weight, unit)}
      </button>
      <button className="text-left font-semibold tabular-nums pl-1" onClick={() => setEditing(true)}>
        {set.reps} reps
      </button>
      <button
        className="text-slate-500 hover:text-red-400 flex justify-center"
        onClick={() => store.deleteSet(set.id)}
        aria-label="Delete set"
      >
        <IconTrash size={18} />
      </button>
    </div>
  )
}

// ---- Machine picker modal ------------------------------------------------

function MachinePicker({ open, onClose, machines, excludeIds, onPick }) {
  const [query, setQuery] = useState('')
  const exclude = new Set(excludeIds)

  const list = machines
    .filter((m) => !exclude.has(m.id))
    .filter((m) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.model.toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Modal open={open} onClose={onClose} title="Add machine to session">
      <input
        className="input mb-3"
        placeholder="Search machines…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {list.length === 0 ? (
        <p className="text-slate-500 text-center py-8 text-sm">
          {machines.length === 0
            ? 'No machines in your library yet.'
            : 'All machines are already in this session.'}
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="w-full flex items-center gap-3 p-2 rounded-xl bg-ink-700 hover:bg-ink-600 text-left"
            >
              <MachinePhoto machine={m} className="w-11 h-11 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                <div className="text-xs text-slate-400 truncate">{m.model}</div>
              </div>
              <MuscleChip group={m.muscleGroup} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
