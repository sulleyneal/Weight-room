import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { sessionsForMachine, muscleProgressSeries, fmtDate, fmtDateShort } from '../lib/metrics.js'
import { fmtWeight } from '../lib/units.js'
import { MUSCLE_GROUPS, MUSCLE_COLORS } from '../data/seed.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import { IconChevronRight } from '../components/Icons.jsx'

export default function ProgressPage() {
  const { state } = useStore()
  const unit = state.settings.unit
  const [group, setGroup] = useState('All') // 'All' or a muscle group
  const [query, setQuery] = useState('')

  const trend = useMemo(
    () => muscleProgressSeries(state.machines, state.workouts, state.sets),
    [state.machines, state.workouts, state.sets],
  )

  // Groups to draw: all that have data, or just the selected one.
  const drawnGroups = useMemo(() => {
    if (group !== 'All') return trend.groups.includes(group) ? [group] : []
    return trend.groups
  }, [trend.groups, group])

  const rows = useMemo(() => trend.rows.map((r) => ({ ...r, label: fmtDateShort(r.week) })), [
    trend.rows,
  ])

  const exerciseRows = useMemo(() => {
    return state.machines
      .filter((m) => !m.archived)
      .filter((m) => group === 'All' || m.muscleGroup === group)
      .map((m) => {
        const sessions = sessionsForMachine(m.id, state.workouts, state.sets)
        const last = sessions[sessions.length - 1] || null
        const best1RM = sessions.reduce((mx, s) => Math.max(mx, s.best1RM), 0)
        let delta = 0
        if (sessions.length >= 2) {
          delta = sessions[sessions.length - 1].best1RM - sessions[sessions.length - 2].best1RM
        }
        return { machine: m, sessions: sessions.length, last, best1RM, delta }
      })
      .filter((r) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return r.machine.name.toLowerCase().includes(q) || (r.machine.model || '').toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (!!a.last !== !!b.last) return a.last ? -1 : 1
        if (a.last && b.last) return b.last.date.localeCompare(a.last.date)
        return a.machine.name.localeCompare(b.machine.name)
      })
  }, [state.machines, state.workouts, state.sets, group, query])

  const hasTrend = rows.length >= 2 && drawnGroups.length > 0

  return (
    <div>
      <PageHeader title="Progress" subtitle="Strength trend vs your starting point" />

      {/* Overall trend chart */}
      {hasTrend ? (
        <div className="card p-3 pr-4 mb-3">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#26304a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#26304a' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111726',
                    border: '1px solid #26304a',
                    borderRadius: 12,
                    color: '#e2e8f0',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <ReferenceLine y={100} stroke="#475569" strokeDasharray="4 4" />
                {drawnGroups.map((g) => (
                  <Line
                    key={g}
                    type="monotone"
                    dataKey={g}
                    stroke={MUSCLE_COLORS[g] || MUSCLE_COLORS.Other}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 px-1">
            Each line = best est. 1RM for that muscle group, indexed to 100% at its first session.
            Above 100% = stronger than you started; flat or dipping = falling behind.
          </p>
        </div>
      ) : (
        <div className="card p-6 text-center text-slate-400 mb-3">
          Log a couple of sessions to see your strength trend across muscle groups.
        </div>
      )}

      {/* Muscle-group filter (doubles as the chart legend) */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3">
        {['All', ...MUSCLE_GROUPS].map((g) => {
          const active = group === g
          const color = g === 'All' ? '#f97316' : MUSCLE_COLORS[g]
          return (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`chip px-3 py-2 whitespace-nowrap border ${
                active ? 'text-white' : 'bg-ink-700 text-slate-300 border-ink-600'
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {g !== 'All' && (
                <span
                  className="w-2 h-2 rounded-full mr-1.5 inline-block align-middle"
                  style={{ backgroundColor: active ? '#fff' : color }}
                />
              )}
              {g}
            </button>
          )
        })}
      </div>

      <input
        className="input mb-3"
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="space-y-3">
        {exerciseRows.map(({ machine, sessions, last, best1RM, delta }) => (
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
                {sessions > 0 && <span className="text-[11px] text-slate-500">{sessions} sessions</span>}
                {Math.abs(delta) > 0.05 && (
                  <span
                    className={`text-[11px] font-semibold ${
                      delta > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {delta > 0 ? '▲' : '▼'} {fmtWeight(Math.abs(delta), unit)}
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
