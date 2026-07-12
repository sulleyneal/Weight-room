import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from './Modal.jsx'
import MuscleChip from './MuscleChip.jsx'
import { parseCoachPlan, matchPlanToMachines } from '../lib/planImport.js'
import { fmtWeight } from '../lib/units.js'
import { MUSCLE_GROUPS } from '../data/seed.js'

/** "3×8–10" for a parsed plan exercise. */
function fmtPlanTarget(ex) {
  if (ex.repLow == null) return `${ex.sets} sets`
  if (ex.repHigh != null && ex.repHigh !== ex.repLow) return `${ex.sets}×${ex.repLow}–${ex.repHigh}`
  return `${ex.sets}×${ex.repLow}`
}

/**
 * Import a workout plan pasted back from Claude ("Ask Claude" round trip).
 * Parses the reply, previews the matched exercises, and hands the caller
 * session-ready items: { machineId, sets, repLow, repHigh, weight }.
 * Unmatched exercises are created in the library on import.
 */
export default function ImportPlanModal({ open, onClose, onImport }) {
  const { state, addMachine } = useStore()
  const unit = state.settings.unit
  const [text, setText] = useState('')
  const [excluded, setExcluded] = useState(() => new Set())

  const plan = useMemo(() => parseCoachPlan(text), [text])
  const rows = useMemo(() => {
    if (!plan) return []
    return matchPlanToMachines(
      plan.exercises,
      state.machines.filter((m) => !m.archived),
    )
  }, [plan, state.machines])

  const includedCount = rows.length - [...excluded].filter((i) => i < rows.length).length

  function close() {
    setText('')
    setExcluded(new Set())
    onClose()
  }

  function toggleRow(i) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function importPlan() {
    const chosen = rows.filter((_, i) => !excluded.has(i))
    if (!chosen.length) return
    const items = chosen.map(({ exercise, machine }) => {
      const machineId =
        machine?.id ||
        addMachine({
          name: exercise.name,
          muscleGroup: MUSCLE_GROUPS.includes(exercise.muscleGroup) ? exercise.muscleGroup : 'Other',
        })
      return {
        machineId,
        sets: exercise.sets,
        repLow: exercise.repLow,
        repHigh: exercise.repHigh,
        weight: exercise.weight,
      }
    })
    onImport(items, plan.workoutName)
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import Claude’s plan"
      footer={
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={close}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={importPlan}
            disabled={!rows.length || includedCount === 0}
          >
            Load workout{includedCount > 0 ? ` (${includedCount})` : ''}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-400 mb-3">
        Paste Claude’s reply (from “Ask Claude”) and the plan below preloads today’s session —
        exercises in order, with targets and weights.
      </p>
      <textarea
        className="input min-h-28 text-sm"
        placeholder="Paste Claude’s reply here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      {text.trim() && !plan && (
        <p className="text-sm text-orange-400 mt-3">
          Couldn’t find a workout plan in that text. Paste Claude’s full reply — it should end with
          a small <span className="font-mono">json</span> plan block. If it doesn’t, ask Claude to
          “repeat the plan as the JSON import block”.
        </p>
      )}

      {plan && (
        <div className="mt-3 space-y-1.5">
          {plan.workoutName && (
            <p className="text-sm font-bold text-slate-300">{plan.workoutName}</p>
          )}
          {rows.map(({ exercise, machine }, i) => {
            const off = excluded.has(i)
            return (
              <button
                key={`${exercise.name}${i}`}
                onClick={() => toggleRow(i)}
                className={`w-full flex items-center gap-2 p-2 rounded-xl border text-left ${
                  off
                    ? 'bg-ink-800 border-ink-700 opacity-40'
                    : 'bg-ink-700 border-ink-600'
                }`}
                aria-pressed={!off}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {machine ? machine.name : exercise.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtPlanTarget(exercise)}
                    {exercise.weight != null && <> @ {fmtWeight(exercise.weight, unit)}</>}
                  </div>
                </div>
                {machine ? (
                  <MuscleChip group={machine.muscleGroup} />
                ) : (
                  <span className="chip bg-orange-500/15 text-orange-400 text-xs px-2 py-0.5">
                    New exercise
                  </span>
                )}
              </button>
            )
          })}
          <p className="text-xs text-slate-500 pt-1">
            Tap an exercise to skip it. “New exercise” entries get added to your library.
          </p>
        </div>
      )}
    </Modal>
  )
}
