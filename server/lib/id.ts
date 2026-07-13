import { randomUUID } from 'node:crypto'

/** Prefixed id, matching the client's `uid` format (e.g. "m_<uuid>"). */
export function uid(prefix = ''): string {
  const id = randomUUID()
  return prefix ? `${prefix}_${id}` : id
}
