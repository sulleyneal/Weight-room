/**
 * One-time migration: load a Weight Room JSON backup into the database.
 *
 *   npm run db:import -- ./my-backup.json           # replace (authoritative)
 *   npm run db:import -- ./older-backup.json --merge # idempotent union merge
 *
 * Default (replace): the backup is normalized and stored verbatim as the app
 * document — lossless and exactly-once, since a Weight Room backup is a complete
 * cumulative snapshot. Merge mode unions by stable id (machines by id then
 * name+model, workouts by date, sets by id), so feeding older backups never
 * duplicates anything.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseBackup, normalizeState } from '../lib/normalize'
import { loadState, saveState, putPhoto } from '../lib/state'
import type { AppData, Machine, Workout, WorkoutSet } from '../lib/types'

function mergeData(existing: AppData, incoming: AppData): AppData {
  const norm = (s: string) => (s || '').trim().toLowerCase()

  // Machines: by id, then by name+model.
  const machines: Machine[] = [...existing.machines]
  const byId = new Map(machines.map((m) => [m.id, m]))
  const byName = new Map(machines.map((m) => [`${norm(m.name)}|${norm(m.model)}`, m]))
  const machineIdRemap = new Map<string, string>()
  for (const m of incoming.machines) {
    const hit = byId.get(m.id) || byName.get(`${norm(m.name)}|${norm(m.model)}`)
    if (hit) {
      machineIdRemap.set(m.id, hit.id)
    } else {
      machines.push(m)
      byId.set(m.id, m)
      byName.set(`${norm(m.name)}|${norm(m.model)}`, m)
    }
  }

  // Workouts: by date (the workout key).
  const workouts: Workout[] = [...existing.workouts]
  const byDate = new Map(workouts.map((w) => [w.date, w]))
  const workoutIdRemap = new Map<string, string>()
  for (const w of incoming.workouts) {
    const hit = byDate.get(w.date)
    if (hit) {
      workoutIdRemap.set(w.id, hit.id)
    } else {
      workouts.push(w)
      byDate.set(w.date, w)
    }
  }

  // Sets: by id; remap machine/workout ids to the merged ones.
  const sets: WorkoutSet[] = [...existing.sets]
  const setIds = new Set(sets.map((s) => s.id))
  for (const s of incoming.sets) {
    if (setIds.has(s.id)) continue
    sets.push({
      ...s,
      machineId: machineIdRemap.get(s.machineId) || s.machineId,
      workoutId: workoutIdRemap.get(s.workoutId) || s.workoutId,
    })
    setIds.add(s.id)
  }

  // Routines: by id.
  const routines = [...existing.routines]
  const routineIds = new Set(routines.map((r) => r.id))
  for (const r of incoming.routines) {
    if (!routineIds.has(r.id)) {
      routines.push(r)
      routineIds.add(r.id)
    }
  }

  return normalizeState({
    machines,
    workouts,
    sets,
    routines,
    settings: { ...existing.settings, ...incoming.settings },
  })
}

async function main() {
  const file = process.argv[2]
  const merge = process.argv.includes('--merge')
  if (!file) {
    throw new Error('Usage: npm run db:import -- <backup.json> [--merge]')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.')
  }

  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const { data: incoming, photos } = parseBackup(raw)

  let toStore = incoming
  if (merge) {
    const { data: existing } = await loadState()
    toStore = mergeData(existing, incoming)
  }

  const result = await saveState(toStore)
  let photoCount = 0
  for (const [machineId, dataUrl] of Object.entries(photos)) {
    if (!dataUrl) continue
    const hash = createHash('sha256').update(dataUrl).digest('hex').slice(0, 16)
    await putPhoto(machineId, dataUrl, hash)
    photoCount++
  }

  console.log(
    `✅  Imported ${toStore.machines.length} exercises, ${toStore.workouts.length} workouts, ` +
      `${toStore.sets.length} sets, ${toStore.routines.length} routines, ${photoCount} photos ` +
      `(${merge ? 'merged' : 'replaced'}; version ${result.version}).`,
  )
}

main().catch((err) => {
  console.error('❌  Import failed:', err)
  process.exit(1)
})
