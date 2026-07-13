import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { loadShareFonts } from '../lib/share/fonts.js'
import { buildSessionMoment, buildPRMoments, buildProgressMoment } from '../lib/share/data.js'
import { CARD_RENDERERS } from '../lib/share/cards.js'
import PageHeader from '../components/PageHeader.jsx'

// ---------------------------------------------------------------------------
// Share lab (#/share-lab): renders every card type × format against the
// current data AND a set of synthetic torture cases. Not linked from the nav —
// it exists for QA (automated screenshot harness + checking real devices,
// e.g. open it on an iPhone to verify canvas/font rendering on WebKit).
// ---------------------------------------------------------------------------

const D = (n) => {
  const d = new Date(2026, 5, 1 + n) // June 2026 onward, deterministic
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function syntheticState({
  exercises = 6,
  sessions = 10,
  longNames = false,
  reps = 12,
  prToday = true,
  startDay = 0, // distinct per fixture so no two mock cards share a date
}) {
  const machines = Array.from({ length: exercises }, (_, i) => ({
    id: `m${i}`,
    name: longNames && i === 0 ? 'Seated Rotary Calf' : longNames ? `Single-Arm Cable Lateral Raise ${i}` : ['Leg Press', 'Chest Press', 'Lat Pulldown', 'Seated Row', 'Leg Curl', 'Shoulder Press', 'Biceps Curl', 'Triceps Extension', 'Leg Extension', 'Abdominal', 'Rotary Torso', 'Low Back', 'Seated Rotary Calf', 'Hip Thrust', 'Face Pull', 'Hack Squat'][i % 16],
    muscleGroup: ['Legs', 'Chest', 'Back', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps'][i % 8],
    type: 'Machine',
    model: '',
    notes: '',
    hasPhoto: false,
    archived: false,
    createdAt: i,
  }))
  const workouts = Array.from({ length: sessions }, (_, i) => ({
    id: `w${i}`,
    date: D(startDay + i * 3),
  }))
  const sets = []
  let sid = 0
  workouts.forEach((w, wi) => {
    machines.forEach((m, mi) => {
      const base = 100 + mi * 40
      const weight = base + wi * (prToday || wi < sessions - 1 ? 10 : -10)
      for (let k = 0; k < (exercises >= 16 ? 1 : 3); k++) {
        sets.push({
          id: `s${sid++}`,
          workoutId: w.id,
          machineId: m.id,
          weight,
          reps: reps - k,
          order: k,
          t: 1780000000000 + wi * 86400000 + mi * 300000 + k * 120000,
        })
      }
    })
  })
  return {
    machines,
    workouts,
    sets,
    routines: [
      {
        id: 'r0',
        name: 'Lower Day',
        items: machines.slice(0, Math.min(exercises, 6)).map((m) => ({ machineId: m.id, sets: 3, repLow: 8, repHigh: 12 })),
        createdAt: 0,
      },
    ],
    settings: { unit: 'lbs', bodyweight: 245 },
  }
}

function firstTimeState() {
  const s = syntheticState({ exercises: 1, sessions: 1 })
  return s
}

function buildAllCases(state) {
  const cases = []
  const push = (label, type, moment) => moment && cases.push({ label, type, moment })

  // Real data (whatever is loaded in the app) — latest logged day.
  const logged = state.workouts
    .filter((w) => state.sets.some((s) => s.workoutId === w.id))
    .sort((a, b) => a.date.localeCompare(b.date))
  const latest = logged[logged.length - 1]
  if (latest) {
    const prs = buildPRMoments(state, latest.date)
    push('real · headline PR', 'pr', prs[0])
    push('real · session', 'session', buildSessionMoment(state, latest.date))
    const firstMachine = state.sets.find((s) => s.workoutId === latest.id)?.machineId
    if (firstMachine) push('real · progress', 'progress', buildProgressMoment(state, firstMachine))
  }

  // Torture cases (distinct startDay per fixture — no two mock cards may
  // share a date, or same-day session numbering would look contradictory).
  const big = syntheticState({ exercises: 16, sessions: 6, startDay: 0 })
  push('torture · 16-exercise session', 'session', buildSessionMoment(big, big.workouts[5].date))

  const calf = syntheticState({ exercises: 4, sessions: 8, longNames: true, reps: 20, startDay: 30 })
  const calfPRs = buildPRMoments(calf, calf.workouts[7].date)
  push('torture · long name + 20 reps PR', 'pr', calfPRs[0])
  push('torture · long-name progress', 'progress', buildProgressMoment(calf, 'm1'))

  const fresh = firstTimeState()
  const freshPRs = buildPRMoments(fresh, fresh.workouts[0].date)
  push('torture · first-time PR (no history)', 'pr', freshPRs[0])
  push('torture · first-time progress', 'progress', buildProgressMoment(fresh, 'm0'))

  const flat = syntheticState({ exercises: 5, sessions: 6, prToday: false, startDay: 60 })
  const flatSession = buildSessionMoment(flat, flat.workouts[5].date)
  push('torture · zero-PR session', 'session', flatSession)

  return cases
}

export default function ShareLab() {
  const { state } = useStore()
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const urls = []
    ;(async () => {
      try {
        await loadShareFonts()
        const out = []
        for (const c of buildAllCases(state)) {
          for (const format of ['square', 'story']) {
            const canvas = CARD_RENDERERS[c.type](c.moment, format)
            const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
            const url = URL.createObjectURL(blob)
            urls.push(url)
            out.push({
              id: `${c.label} · ${format}`,
              url,
              w: canvas.width,
              h: canvas.height,
            })
          }
        }
        if (!cancelled) setItems(out)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [state])

  return (
    <div>
      <PageHeader title="Share lab" subtitle="QA harness — every card × format × torture case" />
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {!items.length && !error && (
        <p className="text-slate-500 text-sm animate-pulse">Rendering cards…</p>
      )}
      <div className="space-y-6" data-testid="share-lab-grid">
        {items.map((it) => (
          <figure key={it.id}>
            <figcaption className="text-xs text-slate-400 mb-1 font-mono">
              {it.id} · {it.w}×{it.h}
            </figcaption>
            <img
              src={it.url}
              alt={it.id}
              data-card={it.id}
              className="w-full rounded-xl border border-ink-700"
            />
          </figure>
        ))}
      </div>
    </div>
  )
}
