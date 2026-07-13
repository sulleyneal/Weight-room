// Test harness: an in-process Postgres (pglite) exposed through the same `Sql`
// interface the real Neon driver implements, so every query runs with no
// network. Inject with setSql(), migrations run on first ensureSchema().

import { PGlite } from '@electric-sql/pglite'
import type { Sql } from '../lib/db'
import { setSql } from '../lib/db'

export interface TestDb {
  pg: PGlite
  close: () => Promise<void>
}

function makeSql(pg: PGlite): Sql {
  const tagged = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = ''
    strings.forEach((s, i) => {
      text += s
      if (i < values.length) text += `$${i + 1}`
    })
    const res = await pg.query(text, values as unknown[])
    return res.rows as Record<string, unknown>[]
  }) as unknown as Sql
  tagged.unsafe = async (text: string) => {
    await pg.exec(text)
    return []
  }
  return tagged
}

/** Fresh empty database wired into the app's db layer. */
export async function newTestDb(): Promise<TestDb> {
  const pg = new PGlite()
  setSql(makeSql(pg))
  return {
    pg,
    close: async () => {
      setSql(null)
      await pg.close()
    },
  }
}
