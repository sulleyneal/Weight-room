import { useMemo } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  sessionsForMachine,
  setVolume,
  weekStartISO,
  addDaysISO,
  todayISO,
  fmtDateShort,
} from '../lib/metrics.js'
import { fmtWeight, fmtNumber, unitLabel } from '../lib/units.js'
import { navigate } from '../router.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MuscleChip from '../components/MuscleChip.jsx'
import { IconTrophy, IconChevronRight } from '../components/Icons.jsx'

const WEEKS = 20 // heatmap window

export default function RecordsPage() {
  const { state } = useStore()
  const unit = state.settings.unit

  // ---- daily volume + week rollups ----
  const { dailyVolume, weekVolume, workoutWeeks } = useMemo(() => {
    const dateOf = new Map(state.workouts.map((w) => [w.id, w.date]))
    const dailyVolume = new Map()
    const weekVolume = new Map()
    const workoutWeeks = new Set()
    for (const s of state.sets) {
      const date = dateOf.get(s.workoutId)
      if (!date) continue
      const v = setVolume(s)
      dailyVolume.set(date, (dailyVolume.get(date) || 0) + v)
      const wk = weekStartISO(date)
      weekVolume.set(wk, (weekVolume.get(wk) || 0) + v)
      workoutWeeks.add(wk)
    }
    return { dailyVolume, weekVolume, workoutWeeks }
  }, [state.workouts, state.sets])

  // ---- streak (consecutive weeks with at least one workout) ----
  const streak = useMemo(() => {
    const thisWeek = weekStartISO(todayISO())
    let cur = workoutWeeks.has(thisWeek) ? thisWeek : addDaysISO(thisWeek, -7)
    let n = 0
    while (workoutWeeks.has(cur)) {
      n++
      cur = addDaysISO(cur, -7)
    }
    return n
  }, [workoutWeeks])

  // ---- this week vs last ----
  const weekCompare = useMemo(() => {
    const thisWeek = weekStartISO(todayISO())
    const cur = weekVolume.get(thisWeek) || 0
    const prev = weekVolume.get(addDaysISO(thisWeek, -7)) || 0
    const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
    return { cur, prev, pct }
  }, [weekVolume])

  // ---- heatmap grid: WEEKS columns x 7 rows (Mon..Sun) ----
  const heatmap = useMemo(() => {
    const thisWeek = weekStartISO(todayISO())
    const cols = []
    let max = 0
    for (let w = WEEKS - 1; w >= 0; w--) {
      const start = addDaysISO(thisWeek, -7 * w)
      const days = []
      for (let d = 0; d < 7; d++) {
        const date = addDaysISO(start, d)
        const v = date <= todayISO() ? dailyVolume.get(date) || 0 : null // null = future
        if (v) max = Math.max(max, v)
        days.push({ date, v })
      }
      cols.push({ start, days })
    }
    return { cols, max }
  }, [dailyVolume])

  // ---- PRs per exercise ----
  const prs = useMemo(() => {
    return state.machines
      .filter((m) => !m.archived)
      .map((m) => {
        const sessions = sessionsForMachine(m.id, state.workouts, state.sets)
        if (!sessions.length) return null
        let bestTop = { v: 0, date: null }
        let best1RM = { v: 0, date: null }
        for (const s of sessions) {
          if (s.topSetWeight > bestTop.v) bestTop = { v: s.topSetWeight, date: s.date }
          if (s.best1RM > best1RM.v) best1RM = { v: s.best1RM, date: s.date }
        }
        return { machine: m, bestTop, best1RM }
      })
      .filter(Boolean)
      .sort((a, b) => (b.best1RM.date || '').localeCompare(a.best1RM.date || ''))
  }, [state.machines, state.workouts, state.sets])

  const totalWorkouts = useMemo(
    () => state.workouts.filter((w) => state.sets.some((s) => s.workoutId === w.id)).length,
    [state.workouts, state.sets],
  )

  return (
    <div>
      <PageHeader title="Records" subtitle="Streaks, history & all-time bests" back="/" />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Week streak" value={String(streak)} accent={streak >= 2} />
        <Stat label="Workouts" value={String(totalWorkouts)} />
        <Stat
          label="vs last week"
          value={weekCompare.pct == null ? '—' : `${weekCompare.pct > 0 ? '+' : ''}${weekCompare.pct}%`}
          accent={weekCompare.pct != null && weekCompare.pct > 0}
        />
      </div>

      {/* Heatmap */}
      <h2 className="font-bold mb-2 px-1">Training calendar</h2>
      <div className="card p-3 mb-1 overflow-x-auto">
        <div className="flex gap-[3px] justify-end min-w-max">
          {heatmap.cols.map((col) => (
            <div key={col.start} className="flex flex-col gap-[3px]">
              {col.days.map((d) => (
                <div
                  key={d.date}
                  title={d.v ? `${d.date}: ${fmtNumber(d.v)} ${unitLabel(unit)}` : d.date}
                  className="w-3 h-3 rounded-[3px]"
                  style={{ backgroundColor: cellColor(d.v, heatmap.max) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
          <span>{fmtDateShort(heatmap.cols[0]?.start)}</span>
          <span className="flex items-center gap-1">
            less
            {[0, 0.15, 0.4, 0.7, 1].map((r) => (
              <span
                key={r}
                className="w-2.5 h-2.5 rounded-[2px] inline-block"
                style={{ backgroundColor: cellColor(r * (heatmap.max || 1), heatmap.max) }}
              />
            ))}
            more
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mb-4 px-1">
        Last {WEEKS} weeks · each column is a week (Mon–Sun), shaded by volume.
      </p>

      {/* PRs */}
      <h2 className="font-bold mb-2 px-1">All-time bests</h2>
      {prs.length === 0 ? (
        <div className="card p-6 text-center text-slate-400">No logged sessions yet.</div>
      ) : (
        <div className="card divide-y divide-ink-700">
          {prs.map(({ machine, bestTop, best1RM }) => (
            <button
              key={machine.id}
              onClick={() => navigate(`/machine/${machine.id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-700/50 transition"
            >
              <IconTrophy size={16} className="text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{machine.name}</div>
                <div className="text-xs text-slate-400">
                  Top {fmtWeight(bestTop.v, unit)} ({fmtDateShort(bestTop.date)}) · 1RM{' '}
                  {fmtWeight(best1RM.v, unit)} ({fmtDateShort(best1RM.date)})
                </div>
              </div>
              <MuscleChip group={machine.muscleGroup} />
              <IconChevronRight size={16} className="text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function cellColor(v, max) {
  if (v == null) return 'transparent' // future day
  if (!v) return '#1a2235'
  const r = Math.min(1, v / (max || 1))
  const alpha = 0.25 + 0.75 * r
  return `rgba(249, 115, 22, ${alpha.toFixed(2)})`
}

function Stat({ label, value, accent }) {
  return (
    <div className={`card p-3 text-center ${accent ? 'ring-1 ring-yellow-400/40' : ''}`}>
      <div className="text-2xl font-extrabold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}
