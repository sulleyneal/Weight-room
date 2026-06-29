import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from './Modal.jsx'
import MuscleChip from './MuscleChip.jsx'
import { IconPlus, IconTrash } from './Icons.jsx'

/**
 * Manage and start routines (saved exercise templates). `onStart` receives the
 * routine's exercise ids so the caller can preload them into the session.
 */
export default function RoutinesModal({ open, onClose, onStart }) {
  const { state, addRoutine, deleteRoutine } = useStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState([])
  const [query, setQuery] = useState('')

  const machines = useMemo(
    () => state.machines.filter((m) => !m.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [state.machines],
  )
  const machineById = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines])

  const filtered = useMemo(() => {
    if (!query.trim()) return machines
    const q = query.toLowerCase()
    return machines.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.type || '').toLowerCase().includes(q),
    )
  }, [machines, query])

  function reset() {
    setCreating(false)
    setName('')
    setPicked([])
    setQuery('')
  }

  function toggle(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function saveRoutine() {
    if (!name.trim() || picked.length === 0) return
    addRoutine({ name, exerciseIds: picked })
    reset()
  }

  function close() {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={creating ? 'New routine' : 'Routines'}
      footer={
        creating ? (
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={reset}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1"
              onClick={saveRoutine}
              disabled={!name.trim() || picked.length === 0}
            >
              Save routine
            </button>
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setCreating(true)}>
            <IconPlus size={20} /> New routine
          </button>
        )
      }
    >
      {creating ? (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Routine name (e.g. Push Day)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            {picked.length} selected — tap to add the exercises this routine includes.
          </p>
          <div className="space-y-1.5">
            {filtered.map((m) => {
              const on = picked.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left ${
                    on ? 'bg-brand-500/15 border-brand-500' : 'bg-ink-700 border-ink-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
                      on ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-500'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold block truncate">{m.name}</span>
                    <span className="text-xs text-slate-400">{m.model || m.type}</span>
                  </span>
                  <MuscleChip group={m.muscleGroup} />
                </button>
              )
            })}
          </div>
        </div>
      ) : state.routines.length === 0 ? (
        <p className="text-slate-500 text-center py-8 text-sm">
          No routines yet. Create one to preload a workout in a single tap.
        </p>
      ) : (
        <div className="space-y-2">
          {state.routines.map((r) => {
            const names = r.exerciseIds
              .map((id) => machineById.get(id)?.name)
              .filter(Boolean)
            return (
              <div key={r.id} className="card p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {names.length ? names.join(' · ') : 'No exercises'}
                    </div>
                  </div>
                  <button
                    className="text-slate-500 hover:text-red-400 p-1"
                    aria-label="Delete routine"
                    onClick={() => {
                      if (confirm(`Delete routine "${r.name}"?`)) deleteRoutine(r.id)
                    }}
                  >
                    <IconTrash size={18} />
                  </button>
                  <button
                    className="btn-primary px-4 py-2"
                    onClick={() => {
                      onStart(r.exerciseIds)
                      close()
                    }}
                  >
                    Start
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
