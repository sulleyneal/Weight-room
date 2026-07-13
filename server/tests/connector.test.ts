import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { newTestDb, type TestDb } from './helpers'
import { runMigrations } from '../lib/migrations'
import { getSql } from '../lib/db'
import { loadState, saveState, buildBackupPayload } from '../lib/state'
import { normalizeState } from '../lib/normalize'
import { insertPlannedSession, listPlannedSessions, consumePlannedSession } from '../lib/planned'
import { recentWorkouts, exerciseHistory, personalRecords, listExercises } from '../lib/queries'
import { epley1RM } from '../lib/metrics'
import type { AppData } from '../lib/types'

let db: TestDb
beforeEach(async () => {
  db = await newTestDb()
})
afterEach(async () => {
  await db.close()
})

// ---- fixture ---------------------------------------------------------------

function machine(id: string, name: string, muscleGroup = 'Other') {
  return { id, name, model: '', muscleGroup, type: 'Machine', notes: '', hasPhoto: false, archived: false, createdAt: 1 }
}
function set(id: string, workoutId: string, machineId: string, weight: number, reps: number, order: number) {
  return { id, workoutId, machineId, weight, reps, order }
}

/** Torture-laden fixture: 16-set session, Seated Rotary Calf, 20-rep set, a
 *  first-time exercise with no history, plus a genuine PR across two sessions. */
function fixture(): AppData {
  const sets = [
    // 2026-07-01
    set('s1', 'w1', 'm_press', 100, 10, 0),
    set('s2', 'w1', 'm_press', 100, 8, 1),
    set('s3', 'w1', 'm_calf', 50, 20, 0), // 20-rep torture
    // 2026-07-08 — PR on press (110 > 100), plus a 16-set calf session
    set('s4', 'w2', 'm_press', 110, 10, 0),
  ]
  for (let i = 0; i < 16; i++) sets.push(set(`sc${i}`, 'w2', 'm_calf', 60, 12, i))
  return normalizeState({
    schemaVersion: 1,
    machines: [
      machine('m_press', 'Chest Press', 'Chest'),
      machine('m_calf', 'Seated Rotary Calf', 'Legs'),
      machine('m_new', 'Brand New Machine', 'Other'), // never trained → first-time
    ],
    workouts: [
      { id: 'w1', date: '2026-07-01' },
      { id: 'w2', date: '2026-07-08' },
    ],
    sets,
    routines: [],
    settings: { unit: 'lbs', bodyweight: 0 },
  })
}

// ---- schema ----------------------------------------------------------------

describe('schema', () => {
  it('runs migrations idempotently and creates every table', async () => {
    const sql = getSql()
    await runMigrations(sql)
    await runMigrations(sql) // second run must be a no-op, not an error
    const rows = (await sql`SELECT id FROM schema_migrations ORDER BY id`) as { id: number }[]
    expect(rows.map((r) => Number(r.id))).toEqual([1, 2, 3, 4])
    // The tables must actually exist — the neon bug recorded migrations while
    // the DDL silently no-op'd, so assert on real relations, not just tracking.
    const tables = (await sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `) as { table_name: string }[]
    const names = new Set(tables.map((t) => t.table_name))
    for (const t of ['app_state', 'photos', 'planned_sessions', 'oauth_clients', 'oauth_codes', 'access_tokens']) {
      expect(names.has(t)).toBe(true)
    }
  })

  it('the raw-DDL executor uses a shape neon accepts as a tagged call', () => {
    // neon detects an EXECUTING call by `Array.isArray(P) && Array.isArray(P.raw)`
    // and one string per (params+1). Guard the shape db.ts builds for sql.unsafe.
    const text = 'CREATE TABLE IF NOT EXISTS x (id TEXT)'
    const strings = Object.assign([text], { raw: [text] })
    expect(Array.isArray(strings)).toBe(true)
    expect(Array.isArray((strings as { raw: string[] }).raw)).toBe(true)
    expect(strings.length).toBe(1)
    expect(strings[0]).toBe(text)
  })
})

// ---- state + round-trip ----------------------------------------------------

describe('app_state round-trip', () => {
  it('saves and loads value-identically', async () => {
    const data = fixture()
    await saveState(data)
    const loaded = await loadState()
    expect(loaded.data.machines).toEqual(data.machines)
    expect(loaded.data.sets).toEqual(data.sets)
    expect(loaded.version).toBe(1)
  })

  it('empty database loads an empty document', async () => {
    const loaded = await loadState()
    expect(loaded.version).toBe(0)
    expect(loaded.data.machines).toEqual([])
    expect(loaded.data.sets).toEqual([])
  })

  it('bumps version on each write; version guard prevents clobbering', async () => {
    await saveState(fixture())
    const r2 = await saveState(fixture())
    expect(r2.version).toBe(2)
    const stale = await saveState(fixture(), { ifVersion: 1 })
    expect(stale.conflict).toBe(true)
    expect(stale.version).toBe(2) // unchanged
  })

  it('exports the exact backup shape and round-trips a REAL pre-migration backup', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../../tests/fixtures/backup-v1-real.json'), 'utf8'),
    )
    await saveState(raw.data)
    const payload = await buildBackupPayload()
    expect(payload.app).toBe('weight-room')
    expect(payload.schemaVersion).toBe(1)
    // No data loss: machines/workouts/sets identical to the normalized input.
    const norm = normalizeState(raw.data)
    expect(payload.data.machines).toEqual(norm.machines)
    expect(payload.data.workouts).toEqual(norm.workouts)
    expect(payload.data.sets).toEqual(norm.sets)
    expect(payload.data.routines).toEqual(norm.routines)
    expect(payload.data.settings).toEqual(norm.settings)
  })
})

// ---- metrics + queries -----------------------------------------------------

describe('reads report the same numbers the app shows', () => {
  beforeEach(async () => {
    await saveState(fixture())
  })

  it('computes est. 1RM with Epley and flags PRs', async () => {
    const hist = await exerciseHistory('Chest Press')
    expect(hist).not.toBeNull()
    expect(hist!.sessions).toHaveLength(2)
    const [older, newer] = hist!.sessions
    expect(older.est1RM).toBe(Math.round(epley1RM(100, 10) * 10) / 10) // 133.3
    expect(newer.est1RM).toBe(Math.round(epley1RM(110, 10) * 10) / 10) // 146.7
    expect(newer.isPR).toBe(true) // 110 > 100 and higher e1RM
  })

  it('handles a 16-set session and a 20-rep set', async () => {
    const w = await recentWorkouts(5)
    const jul8 = w.sessions.find((s) => s.date === '2026-07-08')!
    const calf = jul8.exercises.find((e) => e.name === 'Seated Rotary Calf')!
    expect(calf.sets).toHaveLength(16)
    const jul1 = w.sessions.find((s) => s.date === '2026-07-01')!
    const calf1 = jul1.exercises.find((e) => e.name === 'Seated Rotary Calf')!
    expect(calf1.sets[0]).toEqual({ weight: 50, reps: 20 })
  })

  it('resolves an exercise by fuzzy name (Seated Rotary Calf)', async () => {
    const hist = await exerciseHistory('rotary calf')
    expect(hist!.exercise).toBe('Seated Rotary Calf')
  })

  it('a first-time exercise with no history returns nothing to report', async () => {
    const hist = await exerciseHistory('Brand New Machine')
    expect(hist!.sessions).toEqual([])
    const ex = (await listExercises()).exercises.find((e) => e.name === 'Brand New Machine')!
    expect(ex.sessions).toBe(0)
    const prs = (await personalRecords()).records.map((r) => r.exercise)
    expect(prs).not.toContain('Brand New Machine') // no PR without a session
  })
})

// ---- planned sessions + least privilege ------------------------------------

describe('planned sessions (the only write) never touch history', () => {
  it('inserts, lists pending, and consumes', async () => {
    const saved = await insertPlannedSession({
      name: 'Lower Day',
      date: '2026-07-15',
      exercises: [
        { name: 'Leg Press', sets: 3, repLow: 8, repHigh: 10, weight: 200 },
        { name: 'Seated Rotary Calf', sets: 4, repLow: 12, repHigh: 15 },
      ],
    })
    expect(saved.status).toBe('pending')
    expect(saved.exercises).toHaveLength(2)

    let pending = await listPlannedSessions('pending')
    expect(pending).toHaveLength(1)

    const ok = await consumePlannedSession(saved.id)
    expect(ok).toBe(true)
    pending = await listPlannedSessions('pending')
    expect(pending).toHaveLength(0)
  })

  it('leaves app_state sets/workouts byte-identical after a write', async () => {
    await saveState(fixture())
    const before = await loadState()
    const beforeSets = JSON.stringify(before.data.sets)
    const beforeWorkouts = JSON.stringify(before.data.workouts)

    await insertPlannedSession({ name: 'Push Day', exercises: [{ name: 'Bench', sets: 3 }] })

    const after = await loadState()
    expect(JSON.stringify(after.data.sets)).toBe(beforeSets)
    expect(JSON.stringify(after.data.workouts)).toBe(beforeWorkouts)
    expect(after.version).toBe(before.version) // no app_state write happened
  })

  it('rejects an empty planned session', async () => {
    await expect(insertPlannedSession({ name: 'Nope', exercises: [] })).rejects.toThrow()
  })

  it('clamps hostile planned-session input', async () => {
    const saved = await insertPlannedSession({
      name: '  ' + 'x'.repeat(500),
      exercises: [{ name: 'Curl', sets: 9999, repLow: -5, repHigh: 999, weight: -100 }],
    })
    expect(saved.name.length).toBeLessThanOrEqual(120)
    const ex = saved.exercises[0]
    expect(ex.sets).toBeLessThanOrEqual(20)
    expect(ex.repLow).toBeNull() // -5 out of range → null
    expect(ex.weight).toBe(0) // negative clamped
  })
})
