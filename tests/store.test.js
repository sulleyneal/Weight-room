import { describe, it, expect } from 'vitest'
import { reducer } from '../src/store/StoreContext.jsx'
import { emptyState } from '../src/lib/persistence.js'

const logSet = (i, over = {}) => ({
  type: 'LOG_SET',
  date: '2026-07-12',
  machineId: 'M',
  weight: 100,
  reps: 10,
  setId: `s${i}`,
  newWorkoutId: `w${i}`,
  t: 1000 + i,
  ...over,
})

describe('reducer LOG_SET', () => {
  it('a burst of dispatches creates exactly one workout with sequential orders', () => {
    // Simulates 15 clicks dispatched in a single task: each dispatch reduces
    // over the previous result, exactly like React processes a batch.
    let state = { ...emptyState(), loaded: true }
    for (let i = 0; i < 15; i++) state = reducer(state, logSet(i))
    expect(state.workouts).toHaveLength(1)
    expect(state.workouts[0].date).toBe('2026-07-12')
    expect(state.sets).toHaveLength(15)
    expect(state.sets.map((s) => s.order)).toEqual([...Array(15).keys()])
    expect(new Set(state.sets.map((s) => s.workoutId)).size).toBe(1)
  })

  it('interleaved machines in one burst still share the day workout', () => {
    let state = { ...emptyState(), loaded: true }
    state = reducer(state, logSet(0, { machineId: 'A' }))
    state = reducer(state, logSet(1, { machineId: 'B' }))
    state = reducer(state, logSet(2, { machineId: 'A' }))
    expect(state.workouts).toHaveLength(1)
    expect(state.sets.filter((s) => s.machineId === 'A').map((s) => s.order)).toEqual([0, 1])
    expect(state.sets.filter((s) => s.machineId === 'B').map((s) => s.order)).toEqual([0])
  })

  it('order continues past deletions (max+1, not count)', () => {
    let state = { ...emptyState(), loaded: true }
    for (let i = 0; i < 5; i++) state = reducer(state, logSet(i))
    state = reducer(state, { type: 'DELETE_SET', id: 's0' }) // orders left: 1,2,3,4
    state = reducer(state, logSet(9))
    const orders = state.sets.map((s) => s.order).sort((a, b) => a - b)
    expect(new Set(orders).size).toBe(orders.length) // no duplicate orders
    expect(Math.max(...orders)).toBe(5)
  })

  it('deleting the last set of a day prunes the workout', () => {
    let state = { ...emptyState(), loaded: true }
    state = reducer(state, logSet(0))
    state = reducer(state, { type: 'DELETE_SET', id: 's0' })
    expect(state.sets).toHaveLength(0)
    expect(state.workouts).toHaveLength(0)
  })
})

describe('reducer ADD_SETS_FOR_DATE', () => {
  it('reuses the day workout and appends after existing orders', () => {
    let state = { ...emptyState(), loaded: true }
    state = reducer(state, logSet(0))
    state = reducer(state, {
      type: 'ADD_SETS_FOR_DATE',
      date: '2026-07-12',
      machineId: 'M',
      newWorkoutId: 'w-copy',
      sets: [
        { id: 'c1', weight: 90, reps: 12, t: 2000 },
        { id: 'c2', weight: 90, reps: 10, t: 2001 },
      ],
    })
    expect(state.workouts).toHaveLength(1)
    expect(state.sets.map((s) => s.order)).toEqual([0, 1, 2])
  })
})

describe('reducer RESTORE_SET (undo delete)', () => {
  // RESTORE_SET requires the set's machine to still exist (ghost-data guard),
  // so these states carry machine M.
  const withMachine = () => ({
    ...emptyState(),
    loaded: true,
    machines: [{ id: 'M', name: 'M' }],
  })

  it('restores a deleted set with its original identity and order', () => {
    let state = withMachine()
    for (let i = 0; i < 3; i++) state = reducer(state, logSet(i))
    const victim = state.sets[1]
    state = reducer(state, { type: 'DELETE_SET', id: victim.id })
    state = reducer(state, {
      type: 'RESTORE_SET',
      set: victim,
      date: '2026-07-12',
      newWorkoutId: 'w-new',
    })
    expect(state.sets.map((s) => s.id).sort()).toEqual(['s0', 's1', 's2'])
    expect(state.sets.find((s) => s.id === victim.id).order).toBe(victim.order)
    expect(state.workouts).toHaveLength(1)
  })

  it('recreates the pruned workout when undoing the day-s only set', () => {
    let state = withMachine()
    state = reducer(state, logSet(0))
    const victim = state.sets[0]
    state = reducer(state, { type: 'DELETE_SET', id: victim.id }) // workout pruned
    expect(state.workouts).toHaveLength(0)
    state = reducer(state, {
      type: 'RESTORE_SET',
      set: victim,
      date: '2026-07-12',
      newWorkoutId: 'w-new',
    })
    expect(state.workouts).toEqual([{ id: 'w-new', date: '2026-07-12' }])
    expect(state.sets[0]).toMatchObject({ id: 's0', workoutId: 'w-new', order: 0 })
  })

  it('appends instead of colliding when the original order was reused', () => {
    let state = withMachine()
    for (let i = 0; i < 2; i++) state = reducer(state, logSet(i)) // orders 0,1
    const victim = state.sets[1] // order 1
    state = reducer(state, { type: 'DELETE_SET', id: victim.id })
    state = reducer(state, logSet(5)) // takes order 1
    state = reducer(state, {
      type: 'RESTORE_SET',
      set: victim,
      date: '2026-07-12',
      newWorkoutId: 'w-new',
    })
    const orders = state.sets.map((s) => s.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect(state.sets.find((s) => s.id === victim.id).order).toBe(2)
  })

  it("refuses to restore a set whose machine was deleted (no ghost data)", () => {
    let state = {
      ...emptyState(),
      loaded: true,
      machines: [{ id: 'M', name: 'M' }],
    }
    state = reducer(state, logSet(0))
    const victim = state.sets[0]
    state = reducer(state, { type: 'DELETE_SET', id: victim.id })
    state = reducer(state, { type: 'DELETE_MACHINE', id: 'M' })
    state = reducer(state, {
      type: 'RESTORE_SET',
      set: victim,
      date: '2026-07-12',
      newWorkoutId: 'w-new',
    })
    expect(state.sets).toHaveLength(0)
    expect(state.workouts).toHaveLength(0)
  })

  it('is idempotent (double-undo cannot duplicate the set)', () => {
    let state = withMachine()
    state = reducer(state, logSet(0))
    const victim = state.sets[0]
    state = reducer(state, { type: 'DELETE_SET', id: victim.id })
    const action = { type: 'RESTORE_SET', set: victim, date: '2026-07-12', newWorkoutId: 'w-new' }
    state = reducer(state, action)
    state = reducer(state, action)
    expect(state.sets).toHaveLength(1)
  })
})

describe('reducer DELETE_MACHINE', () => {
  it('removes the machine, its sets, empty workouts, and routine references', () => {
    let state = {
      ...emptyState(),
      loaded: true,
      machines: [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ],
      routines: [
        { id: 'r', name: 'R', items: [{ machineId: 'A', sets: 3 }, { machineId: 'B', sets: 3 }], createdAt: 0 },
      ],
    }
    state = reducer(state, logSet(0, { machineId: 'A' }))
    state = reducer(state, { type: 'DELETE_MACHINE', id: 'A' })
    expect(state.machines.map((m) => m.id)).toEqual(['B'])
    expect(state.sets).toHaveLength(0)
    expect(state.workouts).toHaveLength(0) // day had only A's sets
    expect(state.routines[0].items).toEqual([{ machineId: 'B', sets: 3 }])
  })
})
