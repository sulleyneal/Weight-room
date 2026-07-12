import { describe, it, expect, beforeEach } from 'vitest'
import {
  emptyState,
  normalizeState,
  normalizeRoutines,
  loadState,
  saveState,
  parseBackup,
  mergeDayImport,
  takeStartupWarning,
  getRecoveryStash,
  clearRecoveryStash,
  STORAGE_KEY,
  SCHEMA_VERSION,
} from '../src/lib/persistence.js'
import realBackup from './fixtures/backup-v1-real.json'

beforeEach(() => {
  localStorage.clear()
})

describe('normalizeState', () => {
  it('returns the empty shape for garbage input', () => {
    for (const junk of [null, undefined, 42, 'hi', [], { machines: 'nope' }]) {
      const s = normalizeState(junk)
      expect(s.machines).toEqual([])
      expect(s.workouts).toEqual([])
      expect(s.sets).toEqual([])
      expect(s.routines).toEqual([])
      expect(s.settings).toEqual({ unit: 'lbs', bodyweight: 0 })
    }
  })

  it('coerces malformed set values without dropping records', () => {
    const s = normalizeState({
      machines: [],
      workouts: [{ id: 'w1', date: '2026-01-01' }],
      sets: [
        { id: 's1', workoutId: 'w1', machineId: 'm1', weight: '150', reps: '8.6', order: '2' },
        { id: 's2', workoutId: 'w1', machineId: 'm1', weight: -5, reps: NaN, order: null },
        { id: 's3', workoutId: 'w1', machineId: 'm1', weight: Infinity, reps: 10 },
      ],
    })
    expect(s.sets).toHaveLength(3)
    expect(s.sets[0]).toMatchObject({ weight: 150, reps: 9, order: 2 })
    expect(s.sets[1]).toMatchObject({ weight: 0, reps: 0, order: 0 })
    expect(s.sets[2]).toMatchObject({ weight: 0, reps: 10 })
  })

  it('merges duplicate-date workouts and remaps their sets', () => {
    const s = normalizeState({
      machines: [],
      workouts: [
        { id: 'w1', date: '2026-01-01' },
        { id: 'w2', date: '2026-01-01' },
        { id: 'w3', date: '2026-01-02' },
      ],
      sets: [
        { id: 's1', workoutId: 'w1', machineId: 'm1', weight: 100, reps: 5 },
        { id: 's2', workoutId: 'w2', machineId: 'm1', weight: 110, reps: 5 },
        { id: 's3', workoutId: 'w3', machineId: 'm1', weight: 120, reps: 5 },
      ],
    })
    expect(s.workouts).toHaveLength(2)
    expect(s.sets.filter((x) => x.workoutId === 'w1')).toHaveLength(2)
    expect(s.sets.find((x) => x.id === 's2').workoutId).toBe('w1')
    expect(s.sets.find((x) => x.id === 's3').workoutId).toBe('w3')
  })

  it('preserves unknown extra keys on records (forward compatibility)', () => {
    const s = normalizeState({
      machines: [{ id: 'm1', name: 'X', futureField: 'keep me' }],
      workouts: [{ id: 'w1', date: '2026-01-01', mood: 'great' }],
      sets: [{ id: 's1', workoutId: 'w1', machineId: 'm1', weight: 1, reps: 1, rpe: 8 }],
    })
    expect(s.machines[0].futureField).toBe('keep me')
    expect(s.workouts[0].mood).toBe('great')
    expect(s.sets[0].rpe).toBe(8)
  })

  it('backfills machine defaults (type, flags) and assigns missing ids', () => {
    const s = normalizeState({ machines: [{ name: '  Leg Press  ' }, {}] })
    expect(s.machines[0]).toMatchObject({
      name: 'Leg Press',
      type: 'Machine',
      muscleGroup: 'Other',
      hasPhoto: false,
      archived: false,
    })
    expect(s.machines[0].id).toBeTruthy()
    expect(s.machines[1].name).toBe('Untitled Exercise')
  })

  it('whitelists the unit setting', () => {
    expect(normalizeState({ machines: [], settings: { unit: 'stone' } }).settings.unit).toBe('lbs')
    expect(normalizeState({ machines: [], settings: { unit: 'kg' } }).settings.unit).toBe('kg')
  })

  it('upgrades legacy exerciseIds routines to items', () => {
    const routines = normalizeRoutines([{ id: 'r1', name: 'Old', exerciseIds: ['m1', 'm2'] }])
    expect(routines[0].items).toEqual([
      { machineId: 'm1', sets: 3, repLow: null, repHigh: null },
      { machineId: 'm2', sets: 3, repLow: null, repHigh: null },
    ])
  })
})

describe('loadState / saveState', () => {
  it('round-trips a saved state', () => {
    const state = normalizeState(realBackup.data)
    expect(saveState(state)).toBe(true)
    expect(loadState()).toEqual(state)
  })

  it('returns null with no stored data and leaves no warning', () => {
    expect(loadState()).toBeNull()
    expect(takeStartupWarning()).toBeNull()
  })

  it('stashes corrupt data for recovery instead of silently discarding it', () => {
    localStorage.setItem(STORAGE_KEY, '{"machines": [truncated-by-quota…')
    expect(loadState()).toBeNull()
    expect(getRecoveryStash()).toContain('truncated-by-quota')
    const warning = takeStartupWarning()
    expect(warning).toMatch(/could not be read/i)
    // warning is one-shot
    expect(takeStartupWarning()).toBeNull()
    // an existing stash is never overwritten by a second failure
    localStorage.setItem(STORAGE_KEY, 'also-bad')
    loadState()
    expect(getRecoveryStash()).toContain('truncated-by-quota')
    clearRecoveryStash()
    expect(getRecoveryStash()).toBeNull()
  })

  it('normalizes legacy/dirty stored data on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        machines: [{ id: 'm1', name: 'Old Machine' }], // pre-`type` era
        workouts: [
          { id: 'w1', date: '2026-01-01' },
          { id: 'w2', date: '2026-01-01' }, // duplicate date
        ],
        sets: [{ id: 's1', workoutId: 'w2', machineId: 'm1', weight: '90', reps: '10' }],
        routines: [{ id: 'r1', name: 'Legacy', exerciseIds: ['m1'] }],
      }),
    )
    const s = loadState()
    expect(s.machines[0].type).toBe('Machine')
    expect(s.workouts).toHaveLength(1)
    expect(s.sets[0]).toMatchObject({ workoutId: 'w1', weight: 90, reps: 10 })
    expect(s.routines[0].items[0].machineId).toBe('m1')
    expect(s.schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('parseBackup', () => {
  it('accepts the real v1 backup and preserves every record value-identically', () => {
    const { data, photos } = parseBackup(realBackup)
    expect(data.machines).toEqual(realBackup.data.machines)
    expect(data.workouts).toEqual(realBackup.data.workouts)
    expect(data.sets).toEqual(realBackup.data.sets)
    expect(data.routines).toEqual(realBackup.data.routines)
    expect(data.settings).toEqual(realBackup.data.settings)
    expect(Object.keys(photos)).toEqual(Object.keys(realBackup.photos))
  })

  it('accepts a bare legacy payload (data fields at the top level)', () => {
    const { data } = parseBackup({ machines: [{ id: 'm1', name: 'X' }], sets: [] })
    expect(data.machines).toHaveLength(1)
  })

  it('rejects non-backups with a clear message', () => {
    expect(() => parseBackup(null)).toThrow(/missing machines/i)
    expect(() => parseBackup({})).toThrow(/missing machines/i)
    expect(() => parseBackup({ data: { workouts: [] } })).toThrow(/missing machines/i)
  })

  it('redirects single-day files to the day importer', () => {
    expect(() => parseBackup({ type: 'workout', workout: { date: '2026-01-01' } })).toThrow(
      /single-day/i,
    )
  })

  it('importing the same backup twice replaces rather than duplicates', () => {
    const once = parseBackup(realBackup).data
    const twice = parseBackup(realBackup).data // fresh parse of same file
    expect(twice.sets).toHaveLength(once.sets.length)
    expect(twice).toEqual(once)
  })
})

describe('mergeDayImport', () => {
  const baseState = () => ({
    ...emptyState(),
    machines: [
      {
        id: 'm1',
        name: 'Chest Press',
        model: 'RS-2301',
        muscleGroup: 'Chest',
        type: 'Machine',
        notes: '',
        hasPhoto: false,
        archived: false,
        createdAt: 1,
      },
    ],
    workouts: [{ id: 'w1', date: '2026-07-01' }],
    sets: [{ id: 's1', workoutId: 'w1', machineId: 'm1', weight: 100, reps: 10, order: 0 }],
  })

  const dayFile = (date, machines) => ({
    app: 'weight-room',
    type: 'workout',
    schemaVersion: 1,
    unit: 'lbs',
    workout: { date, machines },
  })

  it('matches machines by id, then by name+model, and appends sets in order', () => {
    const payload = dayFile('2026-07-02', [
      {
        id: 'other-id',
        name: 'chest press', // case-insensitive name+model match
        model: 'rs-2301',
        sets: [
          { weight: 105, reps: 10, order: 1 },
          { weight: 105, reps: 12, order: 0 },
        ],
      },
    ])
    const { state, summary } = mergeDayImport(baseState(), payload)
    expect(summary).toMatchObject({ machinesMatched: 1, machinesAdded: 0, setsAdded: 2 })
    const day = state.workouts.find((w) => w.date === '2026-07-02')
    const daySets = state.sets.filter((s) => s.workoutId === day.id)
    expect(daySets.map((s) => s.reps)).toEqual([12, 10]) // sorted by incoming order
    expect(daySets.map((s) => s.order)).toEqual([0, 1])
    expect(daySets.every((s) => s.machineId === 'm1')).toBe(true)
  })

  it('creates unmatched machines with full defaults (including type)', () => {
    const payload = dayFile('2026-07-02', [
      { id: 'x', name: 'Hack Squat', model: '', muscleGroup: 'Legs', sets: [{ weight: 200, reps: 8 }] },
    ])
    const { state, summary } = mergeDayImport(baseState(), payload)
    expect(summary.machinesAdded).toBe(1)
    const created = state.machines.find((m) => m.name === 'Hack Squat')
    expect(created.type).toBe('Machine')
    expect(created.archived).toBe(false)
    expect(created.hasPhoto).toBe(false)
  })

  it('appends to an existing day without touching its prior sets', () => {
    const payload = dayFile('2026-07-01', [
      { id: 'm1', name: 'Chest Press', model: 'RS-2301', sets: [{ weight: 110, reps: 8 }] },
    ])
    const { state, summary } = mergeDayImport(baseState(), payload)
    expect(summary.dayHadData).toBe(true)
    const daySets = state.sets.filter((s) => s.workoutId === 'w1')
    expect(daySets).toHaveLength(2)
    expect(daySets[1]).toMatchObject({ weight: 110, reps: 8, order: 1 }) // order continues
    expect(state.workouts).toHaveLength(1) // no duplicate workout for the date
  })

  it('never mutates the input state', () => {
    const input = baseState()
    const snapshot = JSON.parse(JSON.stringify(input))
    mergeDayImport(input, dayFile('2026-07-02', [{ id: 'm1', name: 'Chest Press', model: 'RS-2301', sets: [{ weight: 1, reps: 1 }] }]))
    expect(input).toEqual(snapshot)
  })

  it('rejects invalid day files', () => {
    expect(() => mergeDayImport(baseState(), {})).toThrow(/single-day/i)
    expect(() => mergeDayImport(baseState(), dayFile('bad-date', []))).toThrow(/valid workout date/i)
    expect(() => mergeDayImport(baseState(), { type: 'workout', workout: { date: '2026-01-01' } })).toThrow()
  })
})
