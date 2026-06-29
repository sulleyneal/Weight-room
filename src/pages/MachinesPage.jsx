import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { MUSCLE_GROUPS } from '../data/seed.js'
import { navigate, Link } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import MachineForm from '../components/MachineForm.jsx'
import { IconPlus, IconChevronRight, IconSettings } from '../components/Icons.jsx'

export default function MachinesPage() {
  const { state } = useStore()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const machines = useMemo(() => {
    return state.machines
      .filter((m) => !m.archived)
      .filter((m) => filter === 'All' || m.muscleGroup === filter)
      .filter((m) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return (
          m.name.toLowerCase().includes(q) ||
          (m.model || '').toLowerCase().includes(q) ||
          m.muscleGroup.toLowerCase().includes(q) ||
          (m.type || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.machines, filter, query])

  return (
    <div>
      <PageHeader
        title="Exercises"
        subtitle={`${state.machines.length} in your library`}
        action={
          <button className="btn-primary px-3" onClick={() => setAdding(true)}>
            <IconPlus size={20} /> Add
          </button>
        }
      />

      <input
        className="input mb-3"
        placeholder="Search name, model, muscle, equipment…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-2">
        {['All', ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`chip px-3 py-2 whitespace-nowrap border ${
              filter === g
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-ink-700 text-slate-300 border-ink-600'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {machines.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="space-y-3">
          {machines.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/machine/${m.id}`)}
              className="card w-full flex items-center gap-3 p-3 text-left hover:bg-ink-700/60 transition"
            >
              <MachinePhoto machine={m} className="w-16 h-16 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{m.name}</div>
                <div className="text-sm text-slate-400 truncate">
                  {m.model || m.type || 'Exercise'}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <MuscleChip group={m.muscleGroup} />
                  {m.type && m.type !== 'Machine' && (
                    <span className="text-[11px] text-slate-500">{m.type}</span>
                  )}
                </div>
              </div>
              <IconChevronRight size={20} className="text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/settings" className="text-sm text-slate-400 inline-flex items-center gap-1">
          <IconSettings size={16} /> Manage data & units
        </Link>
      </div>

      <MachineForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-slate-400 mb-4">No exercises match your filters.</p>
      <button className="btn-primary mx-auto" onClick={onAdd}>
        <IconPlus size={20} /> Add an exercise
      </button>
    </div>
  )
}
