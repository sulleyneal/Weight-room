import { describe, it, expect } from 'vitest'
import {
  epley1RM,
  setVolume,
  sessionsForMachine,
  machineBests,
  prSessionsForMachine,
  prCountByWorkout,
  suggestProgression,
  trainingLoadSeries,
  todayISO,
  addDaysISO,
  weekStartISO,
} from '../src/lib/metrics.js'
import realBackup from './fixtures/backup-v1-real.json'

describe('epley1RM', () => {
  it('applies weight × (1 + reps/30) for multi-rep sets', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 2)
    expect(epley1RM(300, 3)).toBeCloseTo(330, 5)
  })

  it('returns the weight unchanged for a true single', () => {
    expect(epley1RM(315, 1)).toBe(315)
  })

  it('returns 0 for degenerate input', () => {
    expect(epley1RM(0, 10)).toBe(0)
    expect(epley1RM(100, 0)).toBe(0)
    expect(epley1RM(-100, 5)).toBe(0)
    expect(epley1RM('junk', 'junk')).toBe(0)
  })
})

describe('setVolume', () => {
  it('is weight × reps with safe coercion', () => {
    expect(setVolume({ weight: 100, reps: 10 })).toBe(1000)
    expect(setVolume({ weight: 'x', reps: 10 })).toBe(0)
  })
})

// Shared synthetic history: one machine, three sessions.
const workouts = [
  { id: 'w1', date: '2026-01-05' },
  { id: 'w2', date: '2026-01-07' },
  { id: 'w3', date: '2026-01-09' },
]
const sets = [
  // w1: 100×10, 100×9
  { id: 'a', workoutId: 'w1', machineId: 'M', weight: 100, reps: 10, order: 0 },
  { id: 'b', workoutId: 'w1', machineId: 'M', weight: 100, reps: 9, order: 1 },
  // w2: 105×8, 105×8 (weight PR, 1RM drops below w1? 105×8→133 vs 100×10→133.33 → no 1RM PR)
  { id: 'c', workoutId: 'w2', machineId: 'M', weight: 105, reps: 8, order: 0 },
  { id: 'd', workoutId: 'w2', machineId: 'M', weight: 105, reps: 8, order: 1 },
  // w3: 105×10 (1RM PR, no weight PR)
  { id: 'e', workoutId: 'w3', machineId: 'M', weight: 105, reps: 10, order: 0 },
  // unrelated machine + orphan set (workout deleted) must be ignored
  { id: 'f', workoutId: 'w1', machineId: 'OTHER', weight: 999, reps: 10, order: 0 },
  { id: 'g', workoutId: 'w-gone', machineId: 'M', weight: 500, reps: 10, order: 0 },
]

describe('sessionsForMachine', () => {
  it('groups by session, sorts chronologically, computes rollups', () => {
    const sessions = sessionsForMachine('M', workouts, sets)
    expect(sessions.map((s) => s.date)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09'])
    const [s1, s2, s3] = sessions
    expect(s1.topSetWeight).toBe(100)
    expect(s1.volume).toBe(100 * 10 + 100 * 9)
    expect(s1.best1RM).toBeCloseTo(100 * (1 + 10 / 30), 5)
    expect(s2.topSetWeight).toBe(105)
    expect(s3.best1RM).toBeCloseTo(105 * (1 + 10 / 30), 5)
  })

  it('ignores orphan sets whose workout no longer exists', () => {
    const sessions = sessionsForMachine('M', workouts, sets)
    expect(sessions.some((s) => s.sets.some((x) => x.id === 'g'))).toBe(false)
  })
})

describe('machineBests', () => {
  it('takes the max across sessions', () => {
    const bests = machineBests('M', workouts, sets)
    expect(bests.bestTopSetWeight).toBe(105)
    expect(bests.best1RM).toBeCloseTo(105 * (1 + 10 / 30), 5)
  })
})

describe('prSessionsForMachine', () => {
  it('flags weight and 1RM PRs independently, first session is always both', () => {
    const prs = prSessionsForMachine('M', workouts, sets)
    expect(prs.get('w1')).toEqual({ weightPR: true, oneRmPR: true })
    // w2: heavier top set (weight PR) but 105×8 e1RM (133.0) < w1's 133.33
    expect(prs.get('w2')).toEqual({ weightPR: true, oneRmPR: false })
    // w3: same top weight (no weight PR) but higher e1RM
    expect(prs.get('w3')).toEqual({ weightPR: false, oneRmPR: true })
  })

  it('a tie is not a PR', () => {
    const w = [
      { id: 'w1', date: '2026-01-01' },
      { id: 'w2', date: '2026-01-02' },
    ]
    const s = [
      { id: 'a', workoutId: 'w1', machineId: 'M', weight: 100, reps: 10 },
      { id: 'b', workoutId: 'w2', machineId: 'M', weight: 100, reps: 10 },
    ]
    expect(prSessionsForMachine('M', w, s).get('w2')).toEqual({ weightPR: false, oneRmPR: false })
  })

  it('independent recomputation over the real backup finds identical PR flags', () => {
    // Brute-force reference implementation, written differently on purpose.
    const { machines, workouts: rw, sets: rs } = realBackup.data
    const dateOf = Object.fromEntries(rw.map((w) => [w.id, w.date]))
    for (const m of machines) {
      const mySets = rs.filter((s) => s.machineId === m.id && dateOf[s.workoutId])
      const byDate = {}
      for (const s of mySets) {
        const d = dateOf[s.workoutId]
        byDate[d] = byDate[d] || { workoutId: s.workoutId, top: 0, e1: 0 }
        byDate[d].top = Math.max(byDate[d].top, s.weight)
        byDate[d].e1 = Math.max(byDate[d].e1, s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30))
      }
      const dates = Object.keys(byDate).sort()
      let bw = 0
      let b1 = 0
      const expected = {}
      for (const d of dates) {
        expected[byDate[d].workoutId] = {
          weightPR: byDate[d].top > bw + 1e-9,
          oneRmPR: byDate[d].e1 > b1 + 1e-9,
        }
        bw = Math.max(bw, byDate[d].top)
        b1 = Math.max(b1, byDate[d].e1)
      }
      const actual = prSessionsForMachine(m.id, rw, rs)
      for (const [workoutId, flags] of Object.entries(expected)) {
        expect(actual.get(workoutId), `${m.name} ${workoutId}`).toEqual(flags)
      }
    }
  })
})

describe('prCountByWorkout', () => {
  it('matches the per-machine prSessionsForMachine loop exactly (real backup)', () => {
    const { machines, workouts: rw, sets: rs } = realBackup.data
    const expected = new Map()
    for (const m of machines) {
      for (const [workoutId, flags] of prSessionsForMachine(m.id, rw, rs)) {
        if (flags.weightPR || flags.oneRmPR) {
          expected.set(workoutId, (expected.get(workoutId) || 0) + 1)
        }
      }
    }
    const actual = prCountByWorkout(rw, rs)
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected))
  })

  it('ignores orphan sets and counts multiple machines PRing the same day', () => {
    const counts = prCountByWorkout(workouts, sets)
    // w1: machine M PRs and machine OTHER PRs (first session each) = 2
    expect(counts.get('w1')).toBe(2)
    expect(counts.get('w2')).toBe(1)
    expect(counts.get('w3')).toBe(1)
    expect(counts.get('w-gone')).toBeUndefined()
  })
})

describe('suggestProgression', () => {
  const session = (date, entries) => ({
    workoutId: date,
    date,
    sets: entries.map(([weight, reps], i) => ({ id: `${date}${i}`, weight, reps, order: i })),
    topSetWeight: Math.max(...entries.map(([w]) => w)),
    best1RM: Math.max(...entries.map(([w, r]) => (r === 1 ? w : w * (1 + r / 30)))),
    volume: entries.reduce((sum, [w, r]) => sum + w * r, 0),
    bestSet: null,
  })

  it('suggests adding weight when every top-weight set hit the range top', () => {
    const s = suggestProgression([session('d1', [[100, 10], [100, 10], [100, 10]])], 5, {
      low: 8,
      high: 10,
    })
    expect(s).toMatchObject({ mode: 'increase', weight: 105, reps: 8 })
  })

  it('suggests one more rep while inside the range', () => {
    const s = suggestProgression([session('d1', [[100, 10], [100, 8]])], 5, { low: 8, high: 10 })
    expect(s).toMatchObject({ mode: 'reps', weight: 100, reps: 9 })
  })

  it('suggests a ~10% deload after two consecutive e1RM drops', () => {
    const s = suggestProgression(
      [
        session('d1', [[110, 10]]),
        session('d2', [[110, 8]]),
        session('d3', [[110, 6]]),
      ],
      5,
      { low: 8, high: 10 },
    )
    expect(s.mode).toBe('deload')
    expect(s.weight).toBe(100) // 99 snapped to the 5-step grid
    expect(s.reps).toBe(10)
  })

  it('snaps suggested weights to the plate/stack step', () => {
    const s = suggestProgression([session('d1', [[102, 12]])], 2.5, { low: 8, high: 12 })
    expect(s.mode).toBe('increase')
    expect(s.weight % 2.5).toBe(0)
  })

  it('returns null with no history', () => {
    expect(suggestProgression([], 5, null)).toBeNull()
  })
})

describe('trainingLoadSeries', () => {
  const machines = [{ id: 'M', muscleGroup: 'Legs' }]

  it('returns empty with no data', () => {
    expect(trainingLoadSeries(machines, [], [])).toEqual({ rows: [], status: null, last: null })
  })

  it('builds a contiguous daily series ending today with a sane status', () => {
    const today = todayISO()
    const w = [
      { id: 'w1', date: addDaysISO(today, -10) },
      { id: 'w2', date: addDaysISO(today, -5) },
      { id: 'w3', date: addDaysISO(today, -1) },
    ]
    const s = w.map((x, i) => ({
      id: `s${i}`,
      workoutId: x.id,
      machineId: 'M',
      weight: 100,
      reps: 10,
    }))
    const { rows, status } = trainingLoadSeries(machines, w, s)
    expect(rows[rows.length - 1].date).toBe(today)
    expect(rows).toHaveLength(11)
    expect(rows.filter((r) => r.trained)).toHaveLength(3)
    expect(['low', 'optimal', 'high']).toContain(status)
    for (const r of rows) {
      expect(r.high).toBeGreaterThanOrEqual(r.low)
      expect(r.span).toBe(Math.max(0, r.high - r.low))
    }
  })

  it('filters by muscle group', () => {
    const today = todayISO()
    const w = [{ id: 'w1', date: addDaysISO(today, -2) }]
    const s = [{ id: 's1', workoutId: 'w1', machineId: 'M', weight: 100, reps: 10 }]
    expect(trainingLoadSeries(machines, w, s, 'Chest').rows).toEqual([])
    expect(trainingLoadSeries(machines, w, s, 'Legs').rows.length).toBeGreaterThan(0)
  })
})

describe('date helpers', () => {
  it('addDaysISO crosses month/year boundaries', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29') // leap year
  })

  it('weekStartISO returns the Monday of the containing week', () => {
    expect(weekStartISO('2026-07-12')).toBe('2026-07-06') // a Sunday → prior Monday
    expect(weekStartISO('2026-07-06')).toBe('2026-07-06') // Monday maps to itself
  })

  it('todayISO looks like an ISO date', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
