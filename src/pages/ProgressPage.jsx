import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { sessionsForMachine, fmtDate } from '../lib/metrics.js'
import { fmtWeight } from '../lib/units.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import { IconChevronRight } from '../components/Icons.jsx'

export default function ProgressPage() {
  const { state } = useStore()
  const unit = state.settings.unit
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    return state.machines
      .filter((m) => !m.archived)
      .map((m) => {
        const sessions = sessionsForMachine(m.id, state.workouts, state.sets)
        const last = sessions[sessions.length - 1] || null
        const best1RM = sessions.reduce((mx, s) => Math.max(mx, s.best1RM), 0)
        // Trend vs previous session's best 1RM.
        let trend = 0
        if (sessions.length >= 2) {
          trend = sessions[sessions.length - 1].best1RM - sessions[sessions.length - 2].best1RM
        }
        return { machine: m, sessions: sessions.length, last, best1RM, trend }
      })
      .filter((r) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return r.machine.name.toLowerCase().includes(q) || r.machine.model.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        // Machines with history first, most recently used first.
        if (!!a.last !== !!b.last) return a.last ? -1 : 1
        if (a.last && b.last) return b.last.date.localeCompare(a.last.date)
        return a.machine.name.localeCompare(b.machine.name)
      })
  }, [state.machines, state.workouts, state.sets, query])

  return (
    <div>
      <PageHeader title="Progress" subtitle="Pick a machine to see its trend" />

      <input
        className="input mb-4"
        placeholder="Search machines…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="space-y-3">
        {rows.map(({ machine, sessions, last, best1RM, trend }) => (
          <button
            key={machine.id}
            onClick={() => navigate(`/machine/${machine.id}`)}
            className="card w-full flex items-center gap-3 p-3 text-left hover:bg-ink-700/60 transition"
          >
            <MachinePhoto machine={machine} className="w-14 h-14 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{machine.name}</div>
              {last ? (
                <div className="text-xs text-slate-400 truncate">
                  Last: {fmtDate(last.date)} · best 1RM {fmtWeight(best1RM, unit)}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No history yet</div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <MuscleChip group={machine.muscleGroup} />
                {sessions > 0 && (
                  <span className="text-[11px] text-slate-500">{sessions} sessions</span>
                )}
                {Math.abs(trend) > 0.05 && (
                  <span
                    className={`text-[11px] font-semibold ${
                      trend > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {trend > 0 ? '▲' : '▼'} {fmtWeight(Math.abs(trend), unit)}
                  </span>
                )}
              </div>
            </div>
            <IconChevronRight size={20} className="text-slate-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
