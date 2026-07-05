import { useMemo } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  startOfWeek,
  prSessionsForMachine,
  setVolume,
  fmtDate,
  todayISO,
} from '../lib/metrics.js'
import { fmtNumber, unitLabel } from '../lib/units.js'
import { MUSCLE_GROUPS, MUSCLE_COLORS } from '../data/seed.js'
import { navigate } from '../router.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import AskClaudeButton from '../components/AskClaudeButton.jsx'
import { IconPlus, IconTrophy, IconChevronRight, IconDumbbell } from '../components/Icons.jsx'

export default function Dashboard() {
  const { state } = useStore()
  const unit = state.settings.unit

  const machineById = useMemo(
    () => new Map(state.machines.map((m) => [m.id, m])),
    [state.machines],
  )

  // ---- Per-workout rollups ----
  const workoutsDesc = useMemo(() => {
    const setsByWorkout = new Map()
    for (const s of state.sets) {
      if (!setsByWorkout.has(s.workoutId)) setsByWorkout.set(s.workoutId, [])
      setsByWorkout.get(s.workoutId).push(s)
    }
    return [...state.workouts]
      .map((w) => {
        const sets = setsByWorkout.get(w.id) || []
        const machineIds = [...new Set(sets.map((s) => s.machineId))]
        const volume = sets.reduce((sum, s) => sum + setVolume(s), 0)
        return { ...w, sets, machineIds, volume }
      })
      .filter((w) => w.sets.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [state.workouts, state.sets])

  // ---- PRs per machine (workoutId -> flags) ----
  const prByWorkout = useMemo(() => {
    const map = new Map() // workoutId -> count of machines that PR'd
    for (const m of state.machines) {
      const prs = prSessionsForMachine(m.id, state.workouts, state.sets)
      for (const [workoutId, flags] of prs) {
        if (flags.weightPR || flags.oneRmPR) {
          map.set(workoutId, (map.get(workoutId) || 0) + 1)
        }
      }
    }
    return map
  }, [state.machines, state.workouts, state.sets])

  // ---- This-week stats ----
  const weekStart = useMemo(() => startOfWeek(), [])
  const weekStartISO = useMemo(() => {
    const tz = weekStart.getTimezoneOffset()
    return new Date(weekStart.getTime() - tz * 60000).toISOString().slice(0, 10)
  }, [weekStart])

  const stats = useMemo(() => {
    const weekWorkouts = workoutsDesc.filter((w) => w.date >= weekStartISO)
    const weekVolume = weekWorkouts.reduce((sum, w) => sum + w.volume, 0)
    const totalVolume = workoutsDesc.reduce((sum, w) => sum + w.volume, 0)
    let weekPRs = 0
    for (const w of weekWorkouts) weekPRs += prByWorkout.get(w.id) || 0
    return {
      weekCount: weekWorkouts.length,
      weekVolume,
      totalVolume,
      weekPRs,
    }
  }, [workoutsDesc, weekStartISO, prByWorkout])

  // ---- Body-part split (volume by muscle group, all-time) ----
  const split = useMemo(() => {
    const totals = {}
    let max = 0
    let grand = 0
    for (const s of state.sets) {
      const m = machineById.get(s.machineId)
      const group = m?.muscleGroup || 'Other'
      const v = setVolume(s)
      totals[group] = (totals[group] || 0) + v
      grand += v
    }
    const rows = MUSCLE_GROUPS.map((g) => ({ group: g, volume: totals[g] || 0 }))
      .filter((r) => r.volume > 0)
      .sort((a, b) => b.volume - a.volume)
    max = rows.reduce((mx, r) => Math.max(mx, r.volume), 0)
    return { rows, max, grand }
  }, [state.sets, machineById])

  const hasData = workoutsDesc.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Weight Room</h1>
          <p className="text-sm text-slate-400">{fmtDate(todayISO())}</p>
        </div>
        <button className="btn-primary px-3" onClick={() => navigate('/log')}>
          <IconPlus size={20} /> Log
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatTile label="This week" value={String(stats.weekCount)} sub="workouts" />
        <StatTile
          label="Volume (wk)"
          value={fmtNumber(stats.weekVolume)}
          sub={unitLabel(unit)}
        />
        <StatTile
          label="PRs (wk)"
          value={String(stats.weekPRs)}
          sub="hit"
          accent={stats.weekPRs > 0}
        />
      </div>

      {!hasData && <FirstRun />}

      {hasData && (
        <button
          className="card w-full flex items-center gap-3 p-3 mb-2 text-left hover:bg-ink-700/60 transition"
          onClick={() => navigate('/records')}
        >
          <IconTrophy size={20} className="text-yellow-400 shrink-0" />
          <span className="flex-1 font-semibold">Records, streaks & calendar</span>
          <IconChevronRight size={18} className="text-slate-500" />
        </button>
      )}

      {/* Hand the latest workout to Claude for next-session coaching */}
      {hasData && (
        <div className="mb-5 space-y-1">
          <AskClaudeButton
            label="Ask Claude to coach my next workout"
            className="card w-full flex items-center justify-center gap-2 p-3 font-semibold text-brand-400 hover:bg-ink-700/60 transition"
          />
        </div>
      )}

      {/* Body-part split */}
      {split.rows.length > 0 && (
        <section className="mb-6">
          <h2 className="font-bold mb-2 px-1">Body-part split</h2>
          <div className="card p-4 space-y-3">
            {split.rows.map((r) => {
              const color = MUSCLE_COLORS[r.group] || MUSCLE_COLORS.Other
              const pct = split.max ? (r.volume / split.max) * 100 : 0
              const share = split.grand ? Math.round((r.volume / split.grand) * 100) : 0
              return (
                <div key={r.group}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold" style={{ color }}>
                      {r.group}
                    </span>
                    <span className="text-slate-400">{share}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-ink-700 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent workouts */}
      {hasData && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-bold">Recent workouts</h2>
            <button className="text-sm text-brand-400" onClick={() => navigate('/progress')}>
              Progress →
            </button>
          </div>
          <div className="space-y-3">
            {workoutsDesc.slice(0, 8).map((w) => {
              const prCount = prByWorkout.get(w.id) || 0
              const groups = [
                ...new Set(
                  w.machineIds.map((id) => machineById.get(id)?.muscleGroup).filter(Boolean),
                ),
              ]
              return (
                <button
                  key={w.id}
                  onClick={() => navigate(`/log/${w.date}`)}
                  className="card w-full p-3 text-left hover:bg-ink-700/60 transition flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{fmtDate(w.date)}</span>
                      {prCount > 0 && (
                        <span className="chip bg-yellow-400/15 text-yellow-400 px-2 py-0.5">
                          <IconTrophy size={12} className="mr-1" /> {prCount} PR
                          {prCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      {w.machineIds.length} machine{w.machineIds.length > 1 ? 's' : ''} ·{' '}
                      {w.sets.length} sets · {fmtNumber(w.volume)} {unitLabel(unit)}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {groups.slice(0, 4).map((g) => (
                        <MuscleChip key={g} group={g} />
                      ))}
                    </div>
                  </div>
                  <IconChevronRight size={20} className="text-slate-500 shrink-0" />
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div className={`card p-3 text-center ${accent ? 'ring-1 ring-yellow-400/40' : ''}`}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums leading-tight mt-0.5">{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  )
}

function FirstRun() {
  return (
    <div className="card p-6 text-center mb-6">
      <div className="w-14 h-14 rounded-full bg-brand-500/15 text-brand-400 flex items-center justify-center mx-auto mb-3">
        <IconDumbbell size={28} />
      </div>
      <h2 className="font-bold text-lg mb-1">Welcome to your Weight Room</h2>
      <p className="text-sm text-slate-400 mb-4">
        Your HOIST ROC-IT machine library is pre-loaded. Log your first workout to start tracking
        progress.
      </p>
      <div className="flex gap-2 justify-center">
        <button className="btn-primary" onClick={() => navigate('/log')}>
          <IconPlus size={20} /> Log a workout
        </button>
        <button className="btn-ghost" onClick={() => navigate('/machines')}>
          View machines
        </button>
      </div>
    </div>
  )
}
