import { describe, it, expect } from 'vitest'
import {
  buildSessionMoment,
  buildPRMoments,
  buildProgressMoment,
} from '../src/lib/share/data.js'
import realBackup from './fixtures/backup-v1-real.json'

const state = { ...realBackup.data }
const LATEST = '2026-07-09'

describe('buildSessionMoment', () => {
  it('rolls up the real latest session correctly', () => {
    const m = buildSessionMoment(state, LATEST)
    expect(m).toBeTruthy()
    expect(m.exercises.length).toBeGreaterThan(0)
    expect(m.totalSets).toBe(state.sets.filter((s) => s.workoutId === state.workouts.find((w) => w.date === LATEST).id).length)
    // Volume equals the independent sum.
    const wid = state.workouts.find((w) => w.date === LATEST).id
    const vol = state.sets
      .filter((s) => s.workoutId === wid)
      .reduce((sum, s) => sum + s.weight * s.reps, 0)
    expect(m.totalVolume).toBe(vol)
    // Session number is the count of logged days up to the date.
    expect(m.sessionNumber).toBe(8)
    // Exercises are unique and each top set exists among that day's sets.
    for (const ex of m.exercises) {
      const has = state.sets.some(
        (s) => s.workoutId === wid && s.machineId === ex.machineId && s.weight === ex.topWeight && s.reps === ex.topReps,
      )
      expect(has, ex.name).toBe(true)
    }
  })

  it('returns null for a day with no sets', () => {
    expect(buildSessionMoment(state, '2020-01-01')).toBeNull()
  })
})

describe('buildPRMoments', () => {
  it('ranks real records above first-ever sessions', () => {
    const prs = buildPRMoments(state, LATEST)
    expect(prs.length).toBeGreaterThan(0)
    const firstEverIdx = prs.findIndex((p) => p.prevBestTop == null && p.prevBestE1 == null)
    const realIdx = prs.findIndex((p) => p.prevBestTop != null || p.prevBestE1 != null)
    if (firstEverIdx >= 0 && realIdx >= 0) {
      expect(realIdx).toBeLessThan(firstEverIdx)
    }
    // Deltas are computed against priors, never negative for a weight PR.
    for (const p of prs) {
      if (p.kind !== 'e1rm' && p.deltaTop != null) expect(p.deltaTop).toBeGreaterThan(0)
      expect(p.history.length).toBeGreaterThanOrEqual(1)
      expect(p.history[p.history.length - 1].date).toBe(LATEST)
    }
  })

  it('returns empty for a day without PRs or sets', () => {
    expect(buildPRMoments(state, '2020-01-01')).toEqual([])
  })
})

describe('buildProgressMoment', () => {
  it('builds a chronological series with PR flags for a real machine', () => {
    const legPress = state.machines.find((m) => m.name === 'Leg Press')
    const m = buildProgressMoment(state, legPress.id)
    expect(m.series.length).toBeGreaterThanOrEqual(2)
    const dates = m.series.map((p) => p.date)
    expect([...dates].sort()).toEqual(dates)
    expect(m.currentE1).toBe(m.series[m.series.length - 1].e1rm)
    expect(m.bestE1).toBeGreaterThanOrEqual(m.currentE1 - 1e-9)
    expect(m.deltaE1).toBeCloseTo(m.currentE1 - m.series[0].e1rm, 6)
  })

  it('returns null for an unknown machine', () => {
    expect(buildProgressMoment(state, 'nope')).toBeNull()
  })
})
