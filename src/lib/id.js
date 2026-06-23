// Small id helper. Prefers crypto.randomUUID when available, with a fallback
// for older browsers / non-secure contexts.
export function uid(prefix = '') {
  let id
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    id = crypto.randomUUID()
  } else {
    id = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
  return prefix ? `${prefix}_${id}` : id
}
