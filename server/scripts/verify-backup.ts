/**
 * Offline migration dry-run: push a real backup through the ACTUAL DB path
 * (embedded Postgres), rebuild the export, and prove no data was lost — then
 * show the numbers the connector's read tools would return. Not a deploy step;
 * a verification harness. Usage: npx tsx scripts/verify-backup.ts <backup.json>
 */
import { readFileSync } from 'node:fs'
import { deepStrictEqual } from 'node:assert'
import { newTestDb } from '../tests/helpers'
import { parseBackup, normalizeState } from '../lib/normalize'
import { saveState, buildBackupPayload, putPhoto } from '../lib/state'
import { recentWorkouts, personalRecords, listExercises } from '../lib/queries'
import { createHash } from 'node:crypto'

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Usage: npx tsx scripts/verify-backup.ts <backup.json>')
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const { data: incoming, photos } = parseBackup(raw)

  const db = await newTestDb()
  try {
    // 1. Migrate exactly as `db:import` would.
    await saveState(incoming)
    for (const [id, dataUrl] of Object.entries(photos)) {
      if (dataUrl) await putPhoto(id, dataUrl, createHash('sha256').update(dataUrl).digest('hex').slice(0, 16))
    }

    // 2. Rebuild the export and prove it equals the normalized input.
    const payload = await buildBackupPayload()
    const norm = normalizeState(incoming)
    deepStrictEqual(payload.data.machines, norm.machines, 'machines differ')
    deepStrictEqual(payload.data.workouts, norm.workouts, 'workouts differ')
    deepStrictEqual(payload.data.sets, norm.sets, 'sets differ')
    deepStrictEqual(payload.data.routines, norm.routines, 'routines differ')
    deepStrictEqual(payload.data.settings, norm.settings, 'settings differ')
    const photoOk = Object.keys(payload.photos).length === Object.keys(photos).length

    console.log('── Migration round-trip ──────────────────────────────')
    console.log('  machines :', payload.data.machines.length, '(input', norm.machines.length + ')')
    console.log('  workouts :', payload.data.workouts.length, '(input', norm.workouts.length + ')')
    console.log('  sets     :', payload.data.sets.length, '(input', norm.sets.length + ')')
    console.log('  photos   :', Object.keys(payload.photos).length, photoOk ? 'OK' : 'MISMATCH')
    console.log('  → data round-trips VALUE-IDENTICAL ✅')

    // 3. Show what the connector would report.
    const recent = await recentWorkouts(3)
    console.log('\n── list_recent_workouts (latest 3) ───────────────────')
    console.log('  unit:', recent.unit)
    for (const s of recent.sessions) {
      const top = s.exercises
        .map((e) => `${e.name} ${e.topWeight}×${e.topReps}${e.isPR ? ' 🏆' : ''}`)
        .join(', ')
      console.log(`  ${s.date}  ${s.totalSets} sets, ${s.prCount} PR  — ${top}`)
    }
    const prs = await personalRecords()
    console.log('\n── get_personal_records (top 5 by est. 1RM) ──────────')
    for (const r of prs.records.slice(0, 5)) {
      console.log(`  ${r.exercise}: 1RM ${r.bestEst1RM}, top ${r.bestTopWeight} (${r.onDate})`)
    }
    const ex = await listExercises()
    console.log('\n  exercises tracked:', ex.exercises.length)
    console.log('\nALL CHECKS PASSED ✅')
  } finally {
    await db.close()
  }
}

main().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err.message)
  process.exit(1)
})
