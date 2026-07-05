import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from './Modal.jsx'
import MuscleChip from './MuscleChip.jsx'
import { IconPlus, IconTrash, IconEdit } from './Icons.jsx'

/** "3×8–10" (or "3 sets" when the item has no rep target). */
export function fmtTarget(it) {
  if (it.repLow == null && it.repHigh == null) return `${it.sets} sets`
  if (it.repLow != null && it.repHigh != null && it.repLow !== it.repHigh) {
    return `${it.sets}×${it.repLow}–${it.repHigh}`
  }
  return `${it.sets}×${it.repHigh ?? it.repLow}`
}

const DEFAULT_ITEM = { sets: 3, repLow: 8, repHigh: 12 }

/**
 * Manage and start routines (ordered programs with set × rep-range targets).
 * `onStart` receives the routine's items so the caller can preload the session.
 */
export default function RoutinesModal({ open, onClose, onStart }) {
  const { state, addRoutine, updateRoutine, deleteRoutine, installStarterPrograms } = useStore()
  // view: 'list' | 'edit'; editing holds a draft { id?, name, items }
  const [view, setView] = useState('list')
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(null)

  const machines = useMemo(
    () => state.machines.filter((m) => !m.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [state.machines],
  )
  const machineById = useMemo(
    () => new Map(state.machines.map((m) => [m.id, m])),
    [state.machines],
  )

  const pickerList = useMemo(() => {
    const inDraft = new Set((draft?.items || []).map((it) => it.machineId))
    const q = query.trim().toLowerCase()
    return machines
      .filter((m) => !inDraft.has(m.id))
      .filter(
        (m) => !q || m.name.toLowerCase().includes(q) || (m.type || '').toLowerCase().includes(q),
      )
  }, [machines, draft, query])

  function reset() {
    setView('list')
    setDraft(null)
    setQuery('')
    setNotice(null)
  }

  function close() {
    reset()
    onClose()
  }

  function beginCreate() {
    setDraft({ id: null, name: '', items: [] })
    setView('edit')
  }

  function beginEdit(r) {
    setDraft({ id: r.id, name: r.name, items: r.items.map((it) => ({ ...it })) })
    setView('edit')
  }

  function saveDraft() {
    if (!draft.name.trim() || draft.items.length === 0) return
    if (draft.id) {
      updateRoutine(draft.id, { name: draft.name.trim(), items: draft.items })
    } else {
      addRoutine({ name: draft.name, items: draft.items })
    }
    reset()
  }

  function patchItem(i, patch) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }))
  }

  function moveItem(i, dir) {
    setDraft((d) => {
      const items = [...d.items]
      const j = i + dir
      if (j < 0 || j >= items.length) return d
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...d, items }
    })
  }

  function handleInstall() {
    const r = installStarterPrograms()
    setNotice(
      r.added
        ? `Installed ${r.added} program${r.added > 1 ? 's' : ''}${
            r.machinesCreated ? ` (+${r.machinesCreated} new machine)` : ''
          }.`
        : 'Lower/Upper Day already exist.',
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={view === 'edit' ? (draft?.id ? 'Edit program' : 'New program') : 'Programs'}
      footer={
        view === 'edit' ? (
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={reset}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1"
              onClick={saveDraft}
              disabled={!draft?.name?.trim() || !draft?.items?.length}
            >
              Save program
            </button>
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={beginCreate}>
            <IconPlus size={20} /> New program
          </button>
        )
      }
    >
      {view === 'edit' ? (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Program name (e.g. Lower Day)"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoFocus={!draft.id}
          />

          {/* Ordered items with targets */}
          {draft.items.length > 0 && (
            <div className="space-y-1.5">
              {draft.items.map((it, i) => {
                const m = machineById.get(it.machineId)
                return (
                  <div key={`${it.machineId}${i}`} className="rounded-xl bg-ink-700 border border-ink-600 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 font-semibold text-sm truncate">
                        {i + 1}. {m?.name || 'Missing exercise'}
                      </span>
                      <button className="btn-ghost w-8 h-8 p-0 text-sm" onClick={() => moveItem(i, -1)} aria-label="Move up">
                        ↑
                      </button>
                      <button className="btn-ghost w-8 h-8 p-0 text-sm" onClick={() => moveItem(i, 1)} aria-label="Move down">
                        ↓
                      </button>
                      <button
                        className="text-slate-500 hover:text-red-400 p-1"
                        onClick={() =>
                          setDraft((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }))
                        }
                        aria-label="Remove"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm">
                      <TargetInput value={it.sets} onChange={(v) => patchItem(i, { sets: v })} aria="Sets" />
                      <span className="text-slate-500">sets ×</span>
                      <TargetInput value={it.repLow} onChange={(v) => patchItem(i, { repLow: v })} aria="Reps low" />
                      <span className="text-slate-500">–</span>
                      <TargetInput value={it.repHigh} onChange={(v) => patchItem(i, { repHigh: v })} aria="Reps high" />
                      <span className="text-slate-500">reps</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add exercises */}
          <input
            className="input"
            placeholder="Search to add exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {pickerList.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    items: [...d.items, { machineId: m.id, ...DEFAULT_ITEM }],
                  }))
                }
                className="w-full flex items-center gap-3 p-2 rounded-xl bg-ink-700 hover:bg-ink-600 text-left"
              >
                <IconPlus size={16} className="text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="font-semibold block truncate text-sm">{m.name}</span>
                  <span className="text-xs text-slate-400">{m.model || m.type}</span>
                </span>
                <MuscleChip group={m.muscleGroup} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {notice && <p className="text-sm text-green-400 text-center mb-3">{notice}</p>}
          {state.routines.length === 0 ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-slate-500 text-sm">
                No programs yet. Programs preload a workout — exercises in order, with set and
                rep-range targets.
              </p>
              <button className="btn-primary mx-auto" onClick={handleInstall}>
                Install Lower/Upper split
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {state.routines.map((r) => {
                const parts = r.items
                  .map((it) => {
                    const m = machineById.get(it.machineId)
                    return m ? `${m.name} ${fmtTarget(it)}` : null
                  })
                  .filter(Boolean)
                return (
                  <div key={r.id} className="card p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{r.name}</div>
                        <div className="text-xs text-slate-400 line-clamp-2">
                          {parts.length ? parts.join(' · ') : 'No exercises'}
                        </div>
                      </div>
                      <button
                        className="text-slate-500 hover:text-slate-300 p-1"
                        aria-label="Edit program"
                        onClick={() => beginEdit(r)}
                      >
                        <IconEdit size={18} />
                      </button>
                      <button
                        className="text-slate-500 hover:text-red-400 p-1"
                        aria-label="Delete program"
                        onClick={() => {
                          if (confirm(`Delete program "${r.name}"?`)) deleteRoutine(r.id)
                        }}
                      >
                        <IconTrash size={18} />
                      </button>
                      <button
                        className="btn-primary px-4 py-2"
                        onClick={() => {
                          onStart(r.items)
                          close()
                        }}
                      >
                        Start
                      </button>
                    </div>
                  </div>
                )
              })}
              <button className="text-xs text-slate-500 underline mx-auto block pt-1" onClick={handleInstall}>
                Install the starter Lower/Upper split
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

function TargetInput({ value, onChange, aria }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={aria}
      className="input py-1.5 px-1 w-12 text-center text-sm"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Math.max(1, Math.round(Number(v)) || 1))
      }}
    />
  )
}
