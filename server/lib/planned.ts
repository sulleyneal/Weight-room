// Planned sessions — the ONLY thing the connector's write surface can create.
//
// House Rule 4 (least privilege) is enforced structurally: this module only
// ever INSERTs into `planned_sessions` (and lets the CLIENT mark one consumed).
// It imports nothing that can UPDATE or DELETE `sets`/`workouts`, and the MCP
// write tool calls only `insertPlannedSession`. There is no code path from a
// connector tool to logged history.

import { ensureSchema, getSql } from './db'
import { uid } from './id'
import type { PlannedExercise, PlannedSession } from './types'

interface PlannedRow {
  id: string
  name: string
  date: string | null
  exercises: PlannedExercise[] | string
  source: string
  status: string
  created_at: string | Date
  consumed_at: string | Date | null
}

function parseExercises(v: PlannedExercise[] | string): PlannedExercise[] {
  return typeof v === 'string' ? (JSON.parse(v) as PlannedExercise[]) : v
}

function rowToPlanned(r: PlannedRow): PlannedSession {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    exercises: parseExercises(r.exercises),
    source: r.source,
    status: r.status === 'consumed' ? 'consumed' : 'pending',
    createdAt: new Date(r.created_at).toISOString(),
    consumedAt: r.consumed_at ? new Date(r.consumed_at).toISOString() : null,
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

export interface PlannedExerciseInput {
  name: string
  sets?: number
  repLow?: number | null
  repHigh?: number | null
  weight?: number | null
}

export interface PlannedSessionInput {
  name: string
  date?: string | null
  exercises: PlannedExerciseInput[]
}

/** Coerce untrusted tool input into a safe planned-session shape. */
export function normalizePlannedInput(input: PlannedSessionInput): {
  name: string
  date: string | null
  exercises: PlannedExercise[]
} {
  const name = (input?.name || '').trim() || 'Planned session'
  const date = input?.date && DATE_RE.test(input.date) ? input.date : null
  const exercises: PlannedExercise[] = (Array.isArray(input?.exercises) ? input.exercises : [])
    .filter((e) => e && typeof e.name === 'string' && e.name.trim())
    .map((e) => {
      const repLow = clampInt(e.repLow, 1, 100)
      const repHigh = clampInt(e.repHigh, 1, 100)
      const weight = e.weight == null ? null : Math.max(0, Math.min(Number(e.weight) || 0, 20000))
      return {
        name: e.name.trim().slice(0, 120),
        sets: clampInt(e.sets, 1, 20) ?? 3,
        repLow,
        repHigh,
        weight,
      }
    })
  return { name: name.slice(0, 120), date, exercises }
}

/** Insert a planned session (create-only). Returns the stored row. */
export async function insertPlannedSession(input: PlannedSessionInput): Promise<PlannedSession> {
  await ensureSchema()
  const sql = getSql()
  const { name, date, exercises } = normalizePlannedInput(input)
  if (!exercises.length) {
    throw new Error('A planned session needs at least one exercise with a name.')
  }
  const id = uid('plan')
  const rows = (await sql`
    INSERT INTO planned_sessions (id, name, date, exercises, source, status)
    VALUES (${id}, ${name}, ${date}, ${JSON.stringify(exercises)}::jsonb, 'claude', 'pending')
    RETURNING *
  `) as PlannedRow[]
  return rowToPlanned(rows[0])
}

/** Planned sessions, newest first. Filter by status when given. */
export async function listPlannedSessions(status?: 'pending' | 'consumed'): Promise<PlannedSession[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = (status
    ? await sql`SELECT * FROM planned_sessions WHERE status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM planned_sessions ORDER BY created_at DESC`) as PlannedRow[]
  return rows.map(rowToPlanned)
}

/**
 * Mark a plan consumed — CLIENT-only (the phone calls this after loading a plan
 * into a session). Not a destructive op: it never removes logged history, only
 * flips a pending plan to consumed so it stops being re-offered.
 */
export async function consumePlannedSession(id: string): Promise<boolean> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    UPDATE planned_sessions
       SET status = 'consumed', consumed_at = now()
     WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `) as { id: string }[]
  return rows.length > 0
}
