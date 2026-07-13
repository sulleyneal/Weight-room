// app_state + photos + backup round-trip.
//
// The DB holds the Weight Room document verbatim in one JSONB row, so the
// export payload is reconstructed byte-shape-identically to the client's
// buildBackupPayload (House Rule 1). Reads for the MCP tools parse this row.

import { ensureSchema, getSql } from './db'
import { normalizeState } from './normalize'
import type { AppData, BackupPayload, Photos, SCHEMA_VERSION as SV } from './types'
import { SCHEMA_VERSION } from './types'
import { emptyData } from './normalize'

interface StateRow {
  data: AppData | string
  version: string | number
  updated_at: string | Date
}

function parseData(v: AppData | string): AppData {
  return typeof v === 'string' ? (JSON.parse(v) as AppData) : v
}

export interface LoadedState {
  data: AppData
  version: number
  updatedAt: string
}

/** Current app document (normalized), or an empty one if nothing stored yet. */
export async function loadState(): Promise<LoadedState> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT data, version, updated_at FROM app_state WHERE id = 'singleton'
  `) as StateRow[]
  if (!rows[0]) {
    return { data: emptyData(), version: 0, updatedAt: new Date(0).toISOString() }
  }
  return {
    data: normalizeState(parseData(rows[0].data)),
    version: Number(rows[0].version),
    updatedAt: new Date(rows[0].updated_at).toISOString(),
  }
}

/**
 * Replace the whole app document (client → DB push). Last-write-wins, but
 * `ifVersion` lets a caller avoid clobbering a newer write. Returns the stored
 * version. NEVER touches planned_sessions — that table is Claude's alone.
 */
export async function saveState(
  data: unknown,
  opts: { ifVersion?: number } = {},
): Promise<{ version: number; updatedAt: string; conflict: boolean }> {
  await ensureSchema()
  const sql = getSql()
  const clean = normalizeState(data)
  const json = JSON.stringify(clean)

  const current = (await sql`
    SELECT version FROM app_state WHERE id = 'singleton'
  `) as { version: string | number }[]
  const curVersion = current[0] ? Number(current[0].version) : 0

  if (opts.ifVersion != null && opts.ifVersion < curVersion) {
    const loaded = await loadState()
    return { version: loaded.version, updatedAt: loaded.updatedAt, conflict: true }
  }

  const nextVersion = curVersion + 1
  const rows = (await sql`
    INSERT INTO app_state (id, data, version, updated_at)
    VALUES ('singleton', ${json}::jsonb, ${nextVersion}, now())
    ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, version = EXCLUDED.version, updated_at = now()
    RETURNING version, updated_at
  `) as { version: string | number; updated_at: string | Date }[]
  return {
    version: Number(rows[0].version),
    updatedAt: new Date(rows[0].updated_at).toISOString(),
    conflict: false,
  }
}

// ---- photos ----------------------------------------------------------------

export async function getAllPhotos(): Promise<Photos> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`SELECT machine_id, data_url FROM photos`) as {
    machine_id: string
    data_url: string
  }[]
  const out: Photos = {}
  for (const r of rows) out[r.machine_id] = r.data_url
  return out
}

/** Hashes the client currently has, so it only uploads changed photos. */
export async function getPhotoHashes(): Promise<Record<string, string>> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`SELECT machine_id, hash FROM photos`) as {
    machine_id: string
    hash: string | null
  }[]
  const out: Record<string, string> = {}
  for (const r of rows) out[r.machine_id] = r.hash || ''
  return out
}

export async function putPhoto(machineId: string, dataUrl: string, hash: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO photos (machine_id, data_url, hash, updated_at)
    VALUES (${machineId}, ${dataUrl}, ${hash}, now())
    ON CONFLICT (machine_id) DO UPDATE
      SET data_url = EXCLUDED.data_url, hash = EXCLUDED.hash, updated_at = now()
  `
}

export async function deletePhoto(machineId: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`DELETE FROM photos WHERE machine_id = ${machineId}`
}

// ---- backup round-trip -----------------------------------------------------

/** The exact { app, schemaVersion, exportedAt, data, photos } backup payload. */
export async function buildBackupPayload(): Promise<BackupPayload> {
  const { data } = await loadState()
  const photos = await getAllPhotos()
  return {
    app: 'weight-room',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      machines: data.machines,
      workouts: data.workouts,
      sets: data.sets,
      routines: data.routines,
      settings: data.settings,
    },
    photos,
  }
}

export type { SV }
