import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadPlanForDate,
  savePlanForDate,
  clearPlanForDate,
} from '../src/lib/sessionPlan.js'
import { todayISO, addDaysISO } from '../src/lib/metrics.js'

const PLAN_KEY = 'weight-room:v1:plan'

beforeEach(() => {
  localStorage.clear()
})

const samplePlan = () => ({
  addedMachineIds: ['m1', 'm2'],
  sessionTargets: { m1: { machineId: 'm1', sets: 3, repLow: 8, repHigh: 12, weight: 100 } },
  templateOrder: ['m1', 'm2'],
})

describe('sessionPlan persistence', () => {
  it('round-trips a plan for a date', () => {
    const date = todayISO()
    savePlanForDate(date, samplePlan())
    expect(loadPlanForDate(date)).toEqual(samplePlan())
  })

  it('returns null when no plan exists for a date', () => {
    expect(loadPlanForDate(todayISO())).toBeNull()
  })

  it('keeps plans for different dates independent — one does not clobber another', () => {
    const today = todayISO()
    const yesterday = addDaysISO(today, -1)
    savePlanForDate(today, samplePlan())
    savePlanForDate(yesterday, { addedMachineIds: ['x'], sessionTargets: {}, templateOrder: ['x'] })
    // Saving/loading yesterday must not disturb today's plan.
    expect(loadPlanForDate(today)).toEqual(samplePlan())
    expect(loadPlanForDate(yesterday).addedMachineIds).toEqual(['x'])
  })

  it('treats an empty plan as no plan (save clears the slot)', () => {
    const date = todayISO()
    savePlanForDate(date, samplePlan())
    savePlanForDate(date, { addedMachineIds: [], sessionTargets: {}, templateOrder: [] })
    expect(loadPlanForDate(date)).toBeNull()
  })

  it('clearPlanForDate forgets only that date', () => {
    const today = todayISO()
    const yesterday = addDaysISO(today, -1)
    savePlanForDate(today, samplePlan())
    savePlanForDate(yesterday, { addedMachineIds: ['x'], sessionTargets: {}, templateOrder: [] })
    clearPlanForDate(today)
    expect(loadPlanForDate(today)).toBeNull()
    expect(loadPlanForDate(yesterday).addedMachineIds).toEqual(['x'])
  })

  it('ignores invalid date keys', () => {
    savePlanForDate('not-a-date', samplePlan())
    expect(loadPlanForDate('not-a-date')).toBeNull()
    expect(localStorage.getItem(PLAN_KEY)).toBeNull()
  })

  it('drops plans older than the retention window on the next save', () => {
    const today = todayISO()
    const ancient = addDaysISO(today, -60)
    // Seed a stale plan directly, then trigger a prune with a fresh save.
    localStorage.setItem(
      PLAN_KEY,
      JSON.stringify({ [ancient]: samplePlan() }),
    )
    savePlanForDate(today, samplePlan())
    expect(loadPlanForDate(ancient)).toBeNull()
    expect(loadPlanForDate(today)).toEqual(samplePlan())
  })

  it('survives a corrupt storage blob', () => {
    localStorage.setItem(PLAN_KEY, '{not json')
    expect(loadPlanForDate(todayISO())).toBeNull()
    // A subsequent save still works.
    savePlanForDate(todayISO(), samplePlan())
    expect(loadPlanForDate(todayISO())).toEqual(samplePlan())
  })

  it('normalizes malformed persisted shapes', () => {
    const date = todayISO()
    localStorage.setItem(
      PLAN_KEY,
      JSON.stringify({ [date]: { addedMachineIds: 'oops', sessionTargets: null, templateOrder: ['m1'] } }),
    )
    const plan = loadPlanForDate(date)
    expect(plan.addedMachineIds).toEqual([])
    expect(plan.sessionTargets).toEqual({})
    expect(plan.templateOrder).toEqual(['m1'])
  })
})
