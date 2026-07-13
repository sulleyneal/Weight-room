/**
 * Provision / migrate the schema explicitly. Optional — the app also migrates
 * lazily on first DB use. Usage: npm run db:init
 */
import { getSql } from '../lib/db'
import { MIGRATIONS, runMigrations } from '../lib/migrations'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Put it in .env.local or run `vercel env pull .env.local`.')
  }
  const sql = getSql()
  await runMigrations(sql)
  const rows = (await sql`SELECT id, name FROM schema_migrations ORDER BY id`) as {
    id: number
    name: string
  }[]
  console.log(`✅  Migrations up to date (${rows.length}/${MIGRATIONS.length} applied):`)
  for (const r of rows) console.log(`   #${r.id}  ${r.name}`)
}

main().catch((err) => {
  console.error('❌  Database init failed:', err)
  process.exit(1)
})
