import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { sessionsForMachine, trainingLoadSeries, fmtDate } from '../lib/metrics.js'
import { fmtWeight, fmtNumber } from '../lib/units.js'
import { MUSCLE_GROUPS, MUSCLE_COLORS } from '../data/seed.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import { IconChevronRight } from '../components/Icons.jsx'

// Render a dot only on days a workout actually happened.
function renderTrainedDot(props) {
  const { cx, cy, payload, index } = props
  if (cx == null || cy == null || !payload?.trained) {
    return <circle key={index} cx={cx || 0} cy={cy || 0} r={0} fill="none" />
  }
  return (
    <circle key={index} cx={cx} cy={cy} r={3.2} fill="#e2e8f0" stroke="#0d1320" strokeWidth={1.5} />
  )
}

const STATUS = {
  low: {
    label: 'Backing off',
    color: '#38bdf8',
    blurb: 'Your recent load is below your usual range — room to push, or a planned deload.',
  },
  optimal: {
    label: 'On track',
    color: '#22c55e',
    blurb: 'Your training load is in the productive zone. Keep it rolling.',
  },
  high: {
    label: 'Pushing hard',
    color: '#fb923c',
    blurb: 'Recent load is above your baseline — great for a push, watch recovery.',
  },
}

export default function ProgressPage() {
  const { state } = useStore()
  const unit = state.settings.unit
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')

  const load = useMemo(
    () => trainingLoadSeries(state.machines, state.workouts, state.sets, group),
    [state.machines, state.workouts, state.sets, group],
  )

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
        return (
          r.machine.name.toLowerCase().includes(q) ||
          (r.machine.model || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        if (!!a.last !== !!b.last) return a.last ? -1 : 1
        if (a.last && b.last) return b.last.date.localeCompare(a.last.date)
        return a.machine.name.localeCompare(b.machine.name)
      })
  }, [state.machines, state.workouts, state.sets, group, query])

  const hasLoad = load.rows.length >= 5
  const status = load.status ? STATUS[load.status] : null

  return (
    <div>
      <PageHeader title="Progress" subtitle="Your training-load path" />

      {hasLoad ? (
        <div className="card p-3 pr-4 mb-3">
          {status && (
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="font-bold" style={{ color: status.color }}>
                  {status.label}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {group === 'All' ? 'All training' : group}
              </span>
            </div>
          )}
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={load.rows} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#26304a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#26304a' }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: '#111726',
                    border: '1px solid #26304a',
                    borderRadius: 12,
                    color: '#e2e8f0',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name) => {
                    if (name === 'Load') return [`${fmtNumber(value)} ${unit}`, 'Load']
                    return null
                  }}
                />
                {/* Optimal band = invisible base (low) + green span up to high */}
                <Area dataKey="low" stackId="band" stroke="none" fill="none" isAnimationActive={false} />
                <Area
                  dataKey="span"
                  stackId="band"
                  stroke="none"
                  fill="#22c55e"
                  fillOpacity={0.18}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="acute"
                  name="Load"
                  stroke="#e2e8f0"
                  strokeWidth={2.5}
                  dot={renderTrainedDot}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 px-1">
            {status?.blurb} The green band is your productive range; the line is your recent load.
          </p>
        </div>
      ) : (
        <div className="card p-6 text-center text-slate-400 mb-3">
          Log a couple weeks of workouts to see your training-load path.
        </div>
      )}

      {/* Muscle-group filter (recomputes the path for that group) */}
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
                {sessions > 0 && (
                  <span className="text-[11px] text-slate-500">{sessions} sessions</span>
                )}
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
