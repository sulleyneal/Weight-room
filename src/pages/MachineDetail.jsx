import { lazy, Suspense, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import {
  sessionsForMachine,
  prSessionsForMachine,
  fmtDate,
  fmtDateShort,
} from '../lib/metrics.js'
import { fmtWeight, fmtNumber, unitLabel } from '../lib/units.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MachinePhoto from '../components/MachinePhoto.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import MachineForm from '../components/MachineForm.jsx'
const ShareModal = lazy(() => import('../components/ShareModal.jsx'))
import { IconEdit, IconTrash, IconPlus, IconTrophy, IconImage } from '../components/Icons.jsx'

const METRICS = [
  { key: 'best1RM', label: 'Est. 1RM', color: '#f97316' },
  { key: 'topSetWeight', label: 'Top set', color: '#38bdf8' },
  { key: 'volume', label: 'Volume', color: '#22c55e' },
]

export default function MachineDetail({ id }) {
  const { state, deleteMachine } = useStore()
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [metric, setMetric] = useState('best1RM')
  const unit = state.settings.unit

  const machine = state.machines.find((m) => m.id === id)

  const sessions = useMemo(
    () => sessionsForMachine(id, state.workouts, state.sets),
    [id, state.workouts, state.sets],
  )
  const prMap = useMemo(
    () => prSessionsForMachine(id, state.workouts, state.sets),
    [id, state.workouts, state.sets],
  )

  if (!machine) {
    return (
      <div>
        <PageHeader title="Exercise" back="/machines" />
        <div className="card p-8 text-center text-slate-400">This exercise no longer exists.</div>
      </div>
    )
  }

  const chartData = sessions.map((s) => ({
    date: s.date,
    label: fmtDateShort(s.date),
    best1RM: Math.round(s.best1RM * 10) / 10,
    topSetWeight: s.topSetWeight,
    volume: s.volume,
  }))

  const allTime = sessions.reduce(
    (acc, s) => ({
      best1RM: Math.max(acc.best1RM, s.best1RM),
      topSet: Math.max(acc.topSet, s.topSetWeight),
      volume: Math.max(acc.volume, s.volume),
    }),
    { best1RM: 0, topSet: 0, volume: 0 },
  )

  const activeMetric = METRICS.find((m) => m.key === metric)

  function handleDelete() {
    if (
      confirm(
        `Delete "${machine.name}"? This removes the exercise and all its logged sets. This cannot be undone.`,
      )
    ) {
      deleteMachine(machine.id)
      navigate('/machines')
    }
  }

  return (
    <div>
      <PageHeader
        title={machine.name}
        subtitle={machine.model || machine.type || 'Exercise'}
        back="/machines"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost p-2 w-10 h-10" onClick={() => setEditing(true)} aria-label="Edit">
              <IconEdit size={20} />
            </button>
            <button className="btn-ghost p-2 w-10 h-10" onClick={handleDelete} aria-label="Delete">
              <IconTrash size={20} />
            </button>
          </div>
        }
      />

      {/* Placard photo + meta */}
      <div className="card p-3 mb-4">
        <MachinePhoto machine={machine} className="w-full h-52" rounded="rounded-xl" />
        <div className="flex items-center gap-2 mt-3">
          <MuscleChip group={machine.muscleGroup} size="md" />
        </div>
        {machine.notes && (
          <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{machine.notes}</p>
        )}
      </div>

      <button className="btn-primary w-full mb-4" onClick={() => navigate('/log')}>
        <IconPlus size={20} /> Log a set on this exercise
      </button>

      {/* All-time stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Best 1RM" value={fmtWeight(allTime.best1RM, unit)} />
        <Stat label="Best top set" value={fmtWeight(allTime.topSet, unit)} />
        <Stat label="Sessions" value={String(sessions.length)} />
      </div>

      {sessions.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          No history yet. Log a workout to see your progress chart.
        </div>
      ) : (
        <>
          {/* Metric switcher */}
          <div className="flex gap-2 mb-3">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`flex-1 chip justify-center py-2 border ${
                  metric === m.key
                    ? 'bg-ink-600 border-brand-500 text-white'
                    : 'bg-ink-700 border-ink-600 text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="card p-3 pr-4 mb-4">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#26304a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#26304a' }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111726',
                      border: '1px solid #26304a',
                      borderRadius: 12,
                      color: '#e2e8f0',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [
                      metric === 'volume'
                        ? `${fmtNumber(value)} ${unitLabel(unit)}`
                        : fmtWeight(value, unit),
                      activeMetric.label,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke={activeMetric.color}
                    strokeWidth={3}
                    dot={{ r: 3, fill: activeMetric.color }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History table */}
          <h3 className="font-bold mb-2 px-1">History</h3>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-ink-700">
              <span>Date</span>
              <span className="text-right">Top</span>
              <span className="text-right">1RM</span>
              <span className="text-right">Vol</span>
            </div>
            {[...sessions].reverse().map((s) => {
              const pr = prMap.get(s.workoutId) || {}
              const isPR = pr.weightPR || pr.oneRmPR
              return (
                <div
                  key={s.workoutId}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2.5 border-b border-ink-700/60 last:border-0 items-center"
                >
                  <span className="text-sm flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{fmtDate(s.date)}</span>
                    {isPR && <IconTrophy size={14} className="text-yellow-400 shrink-0" />}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {fmtWeight(s.topSetWeight, unit)}
                  </span>
                  <span className="text-right text-sm tabular-nums text-slate-300">
                    {fmtWeight(s.best1RM, unit)}
                  </span>
                  <span className="text-right text-sm tabular-nums text-slate-400">
                    {fmtNumber(s.volume)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Set detail for latest session */}
          <LatestSetBreakdown sessions={sessions} unit={unit} />

          <button className="btn-ghost w-full mt-4" onClick={() => setSharing(true)}>
            <IconImage size={20} /> Share progress card
          </button>
        </>
      )}

      <MachineForm open={editing} onClose={() => setEditing(false)} machine={machine} />
      {sessions.length > 0 && sharing && (
        <Suspense fallback={null}>
          <ShareModal
            open
            onClose={() => setSharing(false)}
            date={sessions[sessions.length - 1].date}
            initialMachineId={machine.id}
          />
        </Suspense>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-lg font-extrabold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

function LatestSetBreakdown({ sessions, unit }) {
  const latest = sessions[sessions.length - 1]
  if (!latest) return null
  return (
    <div className="mt-4">
      <h3 className="font-bold mb-2 px-1">Latest session — {fmtDate(latest.date)}</h3>
      <div className="card p-3 flex flex-wrap gap-2">
        {latest.sets.map((s, i) => (
          <span key={s.id} className="chip bg-ink-700 text-slate-200 px-3 py-2">
            <span className="text-slate-500 mr-1.5">{i + 1}</span>
            {fmtWeight(s.weight, unit)} × {s.reps}
          </span>
        ))}
      </div>
    </div>
  )
}
