import { describe, it, expect } from 'vitest'
import { parseCoachPlan, matchPlanToMachines } from '../src/lib/planImport.js'

const JSON_REPLY = `Nice work. Do **Upper Day** next.

\`\`\`json
{
  "weightRoomPlan": 1,
  "workout": "Upper Day",
  "exercises": [
    { "name": "Chest Press", "sets": 3, "reps": "8-10", "weight": 145 },
    { "name": "Lat Pulldown", "sets": 3, "reps": 8, "weight": 122.5 },
    { "name": "Face Pull", "sets": 3, "reps": "12-15", "weight": 40, "muscleGroup": "Shoulders" }
  ]
}
\`\`\``

describe('parseCoachPlan', () => {
  it('parses the JSON import block out of a full reply', () => {
    const plan = parseCoachPlan(JSON_REPLY)
    expect(plan.source).toBe('json')
    expect(plan.workoutName).toBe('Upper Day')
    expect(plan.exercises).toHaveLength(3)
    expect(plan.exercises[0]).toMatchObject({ name: 'Chest Press', sets: 3, repLow: 8, repHigh: 10, weight: 145 })
    expect(plan.exercises[1]).toMatchObject({ repLow: 8, repHigh: 8, weight: 122.5 })
    expect(plan.exercises[2].muscleGroup).toBe('Shoulders')
  })

  it('parses a bare JSON paste (no fences, no prose)', () => {
    const plan = parseCoachPlan('{"exercises":[{"name":"Leg Press","sets":3,"reps":10,"weight":250}]}')
    expect(plan.source).toBe('json')
    expect(plan.exercises[0].name).toBe('Leg Press')
  })

  it('falls back to line parsing for prose plans', () => {
    const plan = parseCoachPlan(
      'Next session:\n- Leg Press: 3x10-12 @ 250 lbs\n- Leg Curl — 3 sets of 12 at 90\n- Seated Row: 8-10 reps for 3 sets, 100 lbs',
    )
    expect(plan.source).toBe('text')
    expect(plan.exercises).toHaveLength(3)
    expect(plan.exercises[0]).toMatchObject({ name: 'Leg Press', sets: 3, repLow: 10, repHigh: 12, weight: 250 })
    expect(plan.exercises[1]).toMatchObject({ name: 'Leg Curl', sets: 3, repLow: 12, weight: 90 })
    expect(plan.exercises[2]).toMatchObject({ name: 'Seated Row', repLow: 8, repHigh: 10, sets: 3 })
  })

  it('does not read rest durations as weights', () => {
    const plan = parseCoachPlan('- Chest Press: 3x8, rest at 2 min between sets')
    expect(plan.exercises[0].weight).toBeNull()
  })

  it('clamps absurd values instead of importing them', () => {
    const plan = parseCoachPlan(
      '{"exercises":[{"name":"X","sets":50,"reps":5000,"weight":-10}]}',
    )
    expect(plan.exercises[0].sets).toBe(3) // out-of-range → default
    expect(plan.exercises[0].repLow).toBeNull()
    expect(plan.exercises[0].weight).toBeNull()
  })

  it('returns null when there is no plan', () => {
    expect(parseCoachPlan('thanks, great workout!')).toBeNull()
    expect(parseCoachPlan('')).toBeNull()
    expect(parseCoachPlan(null)).toBeNull()
  })
})

describe('matchPlanToMachines', () => {
  const machines = [
    { id: 'm1', name: 'Chest Press (HOIST)' },
    { id: 'm2', name: 'Lat Pulldown' },
    { id: 'm3', name: 'Row' },
  ]

  it('matches exactly, then by containment either way', () => {
    const rows = matchPlanToMachines(
      [{ name: 'Lat Pulldown' }, { name: 'Chest Press' }, { name: 'Face Pull' }],
      machines,
    )
    expect(rows[0].machine.id).toBe('m2')
    expect(rows[1].machine.id).toBe('m1')
    expect(rows[2].machine).toBeNull()
  })

  it('does not containment-match very short names', () => {
    const rows = matchPlanToMachines([{ name: 'Row' }], [{ id: 'x', name: 'Barbell Row' }])
    expect(rows[0].machine).toBeNull() // exact-only for < 4 chars
  })
})
