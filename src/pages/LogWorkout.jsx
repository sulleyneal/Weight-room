import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  todayISO,
  addDaysISO,
  fmtDate,
  fmtDateShort,
  epley1RM,
  sessionsForMachine,
  suggestProgression,
} from '../lib/metrics.js'
import { weightStep, unitLabel, fmtWeight } from '../lib/units.js'
import { downloadJSON } from '../lib/download.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import NumberStepper from '../components/NumberStepper.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import Modal from '../components/Modal.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import SummaryModal from '../components/SummaryModal.jsx'
import RestTimer from '../components/RestTimer.jsx'
import {
  IconPlus,
  IconTrash,
  IconRepeat,
  IconCopy,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconChart,
  IconList,
  IconSparkle,
} from '../components/Icons.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import ImportPlanModal from '../components/ImportPlanModal.jsx'
import AskClaudeButton from '../components/AskClaudeButton.jsx'
import { useWakeLock } from '../hooks/useWakeLock.js'

export default function LogWorkout({ date: routeDate }) {
  const store = useStore()
  const { state } = store
  const unit = state.settings.unit

  const [date, setDate] = useState(routeDate || todayISO())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [routinesOpen, setRoutinesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // Machines explicitly added to this session that don't yet have sets.
  const [addedMachineIds, setAddedMachineIds] = useState([])
  // Program state for this session: per-machine targets + the program's order.
  const [sessionTargets, setSessionTargets] = useState({})
  const [templateOrder, setTemplateOrder] = useState([])
  // Session to preload when the date next settles (e.g. starting a program).
  const pendingPreloadRef = useRef(null)

  useEffect(() => {
    if (routeDate) setDate(routeDate)
  }, [routeDate])

  // Reset session-scoped state when the date changes — unless a preload is pending.
  useEffect(() => {
    const pending = pendingPreloadRef.current
    pendingPreloadRef.current = null
    setAddedMachineIds(pending?.ids || [])
    setSessionTargets(pending?.targets || {})
    setTemplateOrder(pending?.order || [])
  }, [date])

  // Keep the screen awake while logging — no unlocking between sets.
  useWakeLock(true)

  const workout = state.workouts.find((w) => w.date === date)
  const todaysSets = useMemo(
    () => (workout ? state.sets.filter((s) => s.workoutId === workout.id) : []),
    [workout, state.sets],
  )

  // Elapsed session time (today only): from the first set logged this session.
  const sessionStart = useMemo(() => {
    if (date !== todayISO()) return null
    const ts = todaysSets.map((s) => s.t).filter(Boolean)
    return ts.length ? Math.min(...ts) : null
  }, [date, todaysSets])
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    if (!sessionStart) return
    const id = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [sessionStart])
  const elapsedMin = sessionStart ? Math.max(0, Math.round((nowTick - sessionStart) / 60000)) : null

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

  // Display order: with a program active, follow its order (do-first-on-top)
  // and append ad-hoc extras at the end; otherwise newest-added first.
  const orderedIds = useMemo(() => {
    if (!templateOrder.length) return [...sessionMachineIds].reverse()
    const rank = new Map(templateOrder.map((id, i) => [id, i]))
    const inProgram = sessionMachineIds
      .filter((id) => rank.has(id))
      .sort((a, b) => rank.get(a) - rank.get(b))
    const adHoc = sessionMachineIds.filter((id) => !rank.has(id))
    return [...inProgram, ...adHoc]
  }, [sessionMachineIds, templateOrder])

  function shiftDate(days) {
    // addDaysISO is timezone-safe; naive toISOString() lands on the previous
    // calendar day for every UTC-positive timezone.
    setDate(addDaysISO(date, days))
  }

  function addMachineToSession(machineId) {
    setPickerOpen(false)
    setAddedMachineIds((ids) => (ids.includes(machineId) ? ids : [...ids, machineId]))
  }

  function exportThisWorkout() {
    const payload = store.exportWorkout(date)
    if (!payload) return
    downloadJSON(`weight-room-${date}.json`, payload)
  }

  // Preload items ({ machineId, sets, repLow, repHigh, weight? }) into today's
  // session, in order, with their targets.
  function preloadSession(items) {
    const ids = items.map((it) => it.machineId)
    const targets = Object.fromEntries(items.map((it) => [it.machineId, it]))
    const today = todayISO()
    if (date === today) {
      setAddedMachineIds((prev) => [...new Set([...prev, ...ids])])
      setSessionTargets((prev) => ({ ...prev, ...targets }))
      setTemplateOrder((prev) => [...new Set([...prev, ...ids])])
    } else {
      pendingPreloadRef.current = { ids, targets, order: ids }
      setDate(today)
    }
  }

  function startRoutine(items) {
    preloadSession(
      items.filter((it) => state.machines.some((m) => m.id === it.machineId && !m.archived)),
    )
  }

  // Items from an imported Claude plan reference machines the import modal just
  // matched or created — some aren't in this render's state yet, so no filter.
  function startImportedPlan(items) {
    preloadSession(items)
  }

  /**
   * Target for a machine this session: the started program's item wins; else
   * fall back to any saved program containing the machine, so targets and the
   * range-topped cue still apply when logging ad hoc.
   */
  const targetFor = useMemo(() => {
    const fallback = new Map()
    for (const r of state.routines) {
      for (const it of r.items) {
        if (!fallback.has(it.machineId)) fallback.set(it.machineId, it)
      }
    }
    return (machineId) => sessionTargets[machineId] || fallback.get(machineId) || null
  }, [state.routines, sessionTargets])

  const daySummary = useMemo(
    () => (summaryOpen ? store.buildDaySummary(date) : null),
    [summaryOpen, date, store],
  )

  const machineById = useMemo(
    () => new Map(state.machines.map((m) => [m.id, m])),
    [state.machines],
  )

  return (
    <div>
      <PageHeader
        title="Log workout"
        subtitle={elapsedMin != null ? `${fmtDate(date)} · ${elapsedMin} min` : fmtDate(date)}
      />

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

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button className="btn-primary" onClick={() => setPickerOpen(true)}>
          <IconPlus size={20} /> Add exercise
        </button>
        <button className="btn-ghost" onClick={() => setRoutinesOpen(true)}>
          <IconList size={20} /> Routines
        </button>
        <button className="btn-ghost col-span-2 text-brand-400" onClick={() => setImportOpen(true)}>
          <IconSparkle size={20} /> Import Claude’s plan
        </button>
      </div>

      {sessionMachineIds.length === 0 && (
        <div className="card p-8 text-center mb-4">
          <p className="text-slate-400 mb-1">No exercises yet for this day.</p>
          <p className="text-slate-500 text-sm mb-4">
            Start a program, or add exercises one at a time.
          </p>
          {state.routines.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {state.routines.slice(0, 3).map((r) => (
                <button key={r.id} className="btn-primary px-4" onClick={() => startRoutine(r.items)}>
                  Start {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Program sessions render in program order (first movement on top);
          ad-hoc sessions keep newest-first so the active exercise stays up top. */}
      <div className="space-y-4">
        {orderedIds.map((machineId) => {
          const machine = machineById.get(machineId)
          if (!machine) return null
          return (
            <MachineBlock
              key={machineId}
              machine={machine}
              date={date}
              unit={unit}
              store={store}
              target={targetFor(machineId)}
            />
          )
        })}
      </div>

      {todaysSets.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="btn-ghost" onClick={() => setSummaryOpen(true)}>
            <IconChart size={20} /> Summary
          </button>
          <button className="btn-ghost" onClick={exportThisWorkout}>
            <IconDownload size={20} /> Export JSON
          </button>
          <AskClaudeButton className="btn-ghost col-span-2 text-brand-400 font-bold" />
        </div>
      )}

      <SummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} summary={daySummary} />

      <RoutinesModal
        open={routinesOpen}
        onClose={() => setRoutinesOpen(false)}
        onStart={startRoutine}
      />

      <ImportPlanModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={startImportedPlan}
      />

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

function MachineBlock({ machine, date, unit, store, target }) {
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

  // Sessions strictly before this date: "last time" hint + coaching suggestion.
  const priorSessions = useMemo(
    () => sessionsForMachine(machine.id, state.workouts, state.sets).filter((s) => s.date < date),
    [machine.id, state.workouts, state.sets, date],
  )
  const prevSession = priorSessions.length ? priorSessions[priorSessions.length - 1] : null
  const repRange =
    target && (target.repLow != null || target.repHigh != null)
      ? { low: target.repLow ?? target.repHigh, high: target.repHigh ?? target.repLow }
      : null
  const suggestion = useMemo(
    () => suggestProgression(priorSessions, weightStep(unit), repRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priorSessions, unit, repRange?.low, repRange?.high],
  )

  const lastTodaySet = sets[sets.length - 1] || null

  const isBodyweight = machine.type === 'Bodyweight'
  const bodyweight = state.settings.bodyweight || 0
  // A target with a weight comes from an imported Claude plan: its numbers seed
  // the steppers ahead of history (today's own logged sets still win).
  const plannedWeight = target?.weight != null && target.weight > 0 ? target.weight : null
  const defaultWeight =
    lastTodaySet?.weight ??
    plannedWeight ??
    lastEverSet?.weight ??
    (isBodyweight && bodyweight > 0 ? bodyweight : unit === 'kg' ? 20 : 45)

  const [weight, setWeight] = useState(defaultWeight)
  const [reps, setReps] = useState(
    lastTodaySet?.reps ??
      (plannedWeight != null ? repRange?.low : null) ??
      lastEverSet?.reps ??
      repRange?.low ??
      10,
  )
  // Bumped after each logged set; RestTimer auto-starts on the change.
  const [restToken, setRestToken] = useState(0)

  function afterSetLogged() {
    if (navigator.vibrate) navigator.vibrate(15)
    setRestToken((t) => t + 1)
  }

  // A 0-rep set is always a mis-tap (cleared field / stepper at 0) — block it
  // rather than pollute history and PR math with phantom sets.
  const repsValid = (Number(reps) || 0) > 0

  function addSet() {
    if (!repsValid) return
    store.logSet({ date, machineId: machine.id, weight, reps })
    afterSetLogged()
  }

  function repeatLastSet() {
    const ref = lastTodaySet || lastEverSet
    if (!ref) return addSet()
    store.logSet({ date, machineId: machine.id, weight: ref.weight, reps: ref.reps })
    setWeight(ref.weight)
    setReps(ref.reps)
    afterSetLogged()
  }

  function copyLastWorkout() {
    const n = store.copyLastWorkoutForMachine(machine.id, date)
    if (n === 0) alert('No previous session found for this exercise.')
  }

  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const top = sets.reduce((max, s) => Math.max(max, s.weight), 0)
  const best1rm = sets.reduce((max, s) => Math.max(max, epley1RM(s.weight, s.reps)), 0)

  // All target sets done AND every set hit the top of the rep range → the
  // double-progression signal to add weight next session.
  const rangeTopped = Boolean(
    target &&
      repRange &&
      sets.length >= target.sets &&
      sets.every((s) => (Number(s.reps) || 0) >= repRange.high),
  )

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-700/40 transition"
        onClick={() => navigate(`/machine/${machine.id}`)}
      >
        <MachinePhoto machine={machine} className="w-12 h-12 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{machine.name}</div>
          <div className="text-xs text-slate-400 truncate">{machine.model || machine.type}</div>
        </div>
        <MuscleChip group={machine.muscleGroup} />
      </button>

      {/* Program target + live range-topped cue */}
      {target && (
        <div className="px-3 pb-2 -mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Target{' '}
            <span className="font-semibold text-slate-300">
              {target.sets} × {repRange ? (repRange.low === repRange.high ? repRange.high : `${repRange.low}–${repRange.high}`) : 'any'}
            </span>
            {plannedWeight != null && (
              <>
                {' @ '}
                <span className="font-semibold text-brand-400">
                  {fmtWeight(plannedWeight, unit)}
                </span>
              </>
            )}
          </span>
          {rangeTopped ? (
            <span className="font-bold text-green-400">Range topped — add weight next time ▲</span>
          ) : (
            <span className="text-slate-500 tabular-nums">
              {Math.min(sets.length, target.sets)}/{target.sets} sets
            </span>
          )}
        </div>
      )}

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
        {prevSession && (
          <div className="rounded-xl bg-ink-700/50 border border-ink-600 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Last · {fmtDateShort(prevSession.date)}</span>
              {suggestion && (
                <button
                  className={`text-xs font-bold py-3 px-2 -my-3 -mx-2 ${
                    suggestion.mode === 'increase'
                      ? 'text-green-400'
                      : suggestion.mode === 'deload'
                        ? 'text-orange-400'
                        : 'text-brand-400'
                  }`}
                  onClick={() => {
                    setWeight(suggestion.weight)
                    setReps(suggestion.reps)
                  }}
                >
                  {suggestion.mode === 'increase' ? '▲' : suggestion.mode === 'deload' ? '▼' : '＋'}{' '}
                  {suggestion.label}: {fmtWeight(suggestion.weight, unit)} × {suggestion.reps} →
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {prevSession.sets.map((s, i) => (
                <span key={i} className="chip bg-ink-600 text-slate-300 px-2 py-0.5 tabular-nums">
                  {fmtWeight(s.weight, unit)} × {s.reps}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <NumberStepper
            label={isBodyweight ? `Weight incl. body (${unitLabel(unit)})` : `Weight (${unitLabel(unit)})`}
            value={weight}
            onChange={setWeight}
            step={weightStep(unit)}
            min={0}
          />
          <NumberStepper label="Reps" value={reps} onChange={setReps} step={1} min={0} />
        </div>
        <button className="btn-primary w-full" onClick={addSet} disabled={!repsValid}>
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

        <div className="pt-1">
          <RestTimer autoStartToken={restToken} />
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
    // Edits obey the same rules as entry: reps must be a positive number
    // before the save button enables (a 0-rep set should be deleted, not saved).
    const editValid = Math.round(Number(r)) >= 1 && Number(w) >= 0
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
          className="btn-primary p-0 w-10 h-10 text-xs"
          disabled={!editValid}
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

  // Sweaty-thumb rule: every control in this row keeps a ≥40px hit area, and
  // delete lives in its own fixed-width column so it can't be grazed while
  // tapping the numbers.
  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center bg-ink-700/40 rounded-lg">
      <span className="text-slate-500 font-semibold text-center">{index}</span>
      <button
        className="text-left font-semibold tabular-nums pl-1 py-3"
        onClick={() => setEditing(true)}
      >
        {fmtWeight(set.weight, unit)}
      </button>
      <button
        className="text-left font-semibold tabular-nums pl-1 py-3"
        onClick={() => setEditing(true)}
      >
        {set.reps} reps
      </button>
      <button
        className="text-slate-500 hover:text-red-400 flex items-center justify-center w-10 h-10 mx-auto"
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
    <Modal open={open} onClose={onClose} title="Add exercise to session">
      <input
        className="input mb-3"
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {list.length === 0 ? (
        <p className="text-slate-500 text-center py-8 text-sm">
          {machines.length === 0
            ? 'No exercises in your library yet.'
            : 'All exercises are already in this session.'}
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
                <div className="text-xs text-slate-400 truncate">{m.model || m.type}</div>
              </div>
              <MuscleChip group={m.muscleGroup} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
