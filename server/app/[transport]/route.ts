// Remote MCP server — Streamable HTTP via mcp-handler. Claude connects to
// `<base>/mcp`. Auth is enforced by withMcpAuth → verifyBearer (static token or
// an OAuth-issued token); the same wrapper serves both auth modes.
//
// Tool surface (House Rule 4): every read tool is read-only; the ONLY write
// tool inserts a planned session into its own table. No tool can reach logged
// history for update/delete.

import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { z } from 'zod'
import { verifyBearer } from '@/lib/auth'
import {
  recentWorkouts,
  workoutByDate,
  listExercises,
  exerciseHistory,
  personalRecords,
} from '@/lib/queries'
import { buildBackupPayload } from '@/lib/state'
import { insertPlannedSession } from '@/lib/planned'

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date like 2026-07-13.')

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

const handler = createMcpHandler(
  (server) => {
    // ---- reads (read-only) --------------------------------------------------
    server.tool(
      'list_recent_workouts',
      'List the most recent logged workouts with exercises, weights, reps, est. 1RM, and PR flags.',
      { limit: z.number().int().min(1).max(50).optional() },
      async ({ limit }) => json(await recentWorkouts(limit ?? 5)),
    )

    server.tool(
      'get_workout',
      'Get one workout by date (YYYY-MM-DD): every exercise, set, and PR that day.',
      { date: DATE },
      async ({ date }) => {
        const result = await workoutByDate(date)
        return json(result ?? { message: `No workout logged on ${date}.` })
      },
    )

    server.tool(
      'list_exercises',
      'List all exercises in the library with their muscle group and how many sessions each has.',
      {},
      async () => json(await listExercises()),
    )

    server.tool(
      'get_exercise_history',
      'Session-by-session history for one exercise (by name): top set, est. 1RM, volume, PR flags.',
      { name: z.string().min(1), limit: z.number().int().min(1).max(100).optional() },
      async ({ name, limit }) => {
        const result = await exerciseHistory(name, limit ?? 20)
        return json(result ?? { message: `No exercise found matching "${name}".` })
      },
    )

    server.tool(
      'get_personal_records',
      'Best top-set weight and best est. 1RM for every exercise, ranked by est. 1RM.',
      {},
      async () => json(await personalRecords()),
    )

    server.tool(
      'export_backup',
      'Export the full Weight Room backup document (machines, workouts, sets, routines, settings). Photos are omitted here for size; use the API export for photos.',
      {},
      async () => {
        const payload = await buildBackupPayload()
        // Drop photo blobs from the tool response (they can be megabytes).
        return json({ ...payload, photos: undefined, photoCount: Object.keys(payload.photos).length })
      },
    )

    // ---- write (least privilege — planned_sessions only) --------------------
    server.tool(
      'create_planned_session',
      'Write a named planned workout into the app (e.g. next Lower Day) with per-exercise sets, rep targets, and optional weights. It appears in the app ready to execute. This is the ONLY write; it can never modify or delete already-logged history.',
      {
        name: z.string().min(1).describe('Session name, e.g. "Lower Day"'),
        date: DATE.optional().describe('Optional target date; defaults to whenever you next log.'),
        exercises: z
          .array(
            z.object({
              name: z.string().min(1),
              sets: z.number().int().min(1).max(20).optional(),
              repLow: z.number().int().min(1).max(100).nullable().optional(),
              repHigh: z.number().int().min(1).max(100).nullable().optional(),
              weight: z.number().min(0).max(20000).nullable().optional(),
            }),
          )
          .min(1)
          .describe('Ordered exercises with targets.'),
      },
      async ({ name, date, exercises }) => {
        const saved = await insertPlannedSession({ name, date: date ?? null, exercises })
        return json({
          ok: true,
          message: `Planned session "${saved.name}" is queued — open Weight Room and it will be ready to load.`,
          plannedSession: saved,
        })
      },
    )
  },
  { serverInfo: { name: 'weight-room', version: '1.0.0' } },
  { basePath: '/', maxDuration: 60, verboseLogs: false },
)

// Enforce auth on every MCP request. verifyToken returns AuthInfo on success,
// undefined on failure → mcp-handler answers 401 with the OAuth challenge that
// points Claude at the protected-resource metadata.
const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  const ok = await verifyBearer(bearerToken ?? null)
  if (!ok) return undefined
  return {
    token: bearerToken as string,
    clientId: 'weight-room-connector',
    scopes: ['weightroom'],
    extra: {},
  }
}

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authed as GET, authed as POST, authed as DELETE }
