// Round trip for the "Ask Claude" coach: parse a workout plan out of Claude's
// reply and match its exercises to the machine library so the next session can
// be preloaded with Claude's order, rep targets, and working weights.
//
// Preferred input is the fenced ```json import block the coach prompt asks
// Claude to append ({"weightRoomPlan": 1, "exercises": [...]}). Anything else
// falls back to a best-effort line parser for markdown-ish plans like
// "- Leg Press: 3×8–10 @ 270 lbs".

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

/** "8", 8, "8-10", "8–12" → { repLow, repHigh } (nulls when unparseable). */
function parseReps(reps) {
  if (reps == null) return { repLow: null, repHigh: null }
  if (typeof reps === 'number') {
    const n = clampInt(reps, 1, 100)
    return { repLow: n, repHigh: n }
  }
  const s = String(reps)
  const range = s.match(/(\d+)\s*(?:[-–—~]|to)\s*(\d+)/)
  if (range) return { repLow: clampInt(range[1], 1, 100), repHigh: clampInt(range[2], 1, 100) }
  const single = s.match(/\d+/)
  const n = single ? clampInt(single[0], 1, 100) : null
  return { repLow: n, repHigh: n }
}

function parseWeight(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
}

function normalizeExercise(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  const { repLow, repHigh } = parseReps(raw.reps)
  return {
    name,
    sets: clampInt(raw.sets, 1, 10) ?? 3,
    repLow,
    repHigh,
    weight: parseWeight(raw.weight),
    muscleGroup: typeof raw.muscleGroup === 'string' ? raw.muscleGroup.trim() : null,
  }
}

/** Try to interpret a candidate string as the JSON import block. */
function tryJsonPlan(candidate) {
  let obj
  try {
    obj = JSON.parse(candidate)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.exercises)) return null
  const exercises = obj.exercises.map(normalizeExercise).filter(Boolean)
  if (!exercises.length) return null
  return {
    source: 'json',
    workoutName: typeof obj.workout === 'string' ? obj.workout.trim() || null : null,
    exercises,
  }
}

// Sets-then-reps: "3 sets of 8-10", "3x8", "3 × 8–10 reps".
const SETS_FIRST = /(\d+)\s*(?:sets?\s*(?:of|[x×])?\s*|[x×]\s*)(\d+)(?:\s*[-–—]\s*(\d+))?/i
// Reps-then-sets: "8-10 reps for 3 sets", "8 reps × 3 sets".
const REPS_FIRST = /(\d+)(?:\s*[-–—]\s*(\d+))?\s*reps?\s*(?:[,x×]|for|across)?\s*(\d+)\s*sets?/i
// Weight with an explicit unit, or introduced by "@"/"at" (but not durations
// like "at 2 min").
const WEIGHT_UNIT = /(\d+(?:\.\d+)?)\s*(?:lbs?|kgs?|pounds?|kilos?)\b/i
const WEIGHT_AT = /(?:@|\bat\b)\s*(\d+(?:\.\d+)?)(?!\s*(?:min|sec|hr|:))/i

function parsePlanLine(line) {
  // Strip list markers and markdown emphasis so the name comes out clean.
  const clean = line.replace(/^[\s>*•]*(?:[-*•]|\d+[.)])?\s*/, '').replace(/\*\*?/g, '')
  if (!clean || !/[a-z]/i.test(clean)) return null

  let sets = null
  let repLow = null
  let repHigh = null
  let structureIdx = -1

  const sf = clean.match(SETS_FIRST)
  const rf = clean.match(REPS_FIRST)
  // Prefer whichever pattern appears first; SETS_FIRST also matches inside
  // "8-10 reps for 3 sets" ("10 reps for 3" → 10×3), so an earlier REPS_FIRST wins.
  if (sf && (!rf || sf.index <= rf.index)) {
    sets = clampInt(sf[1], 1, 10)
    repLow = clampInt(sf[2], 1, 100)
    repHigh = sf[3] ? clampInt(sf[3], 1, 100) : repLow
    structureIdx = sf.index
  } else if (rf) {
    repLow = clampInt(rf[1], 1, 100)
    repHigh = rf[2] ? clampInt(rf[2], 1, 100) : repLow
    sets = clampInt(rf[3], 1, 10)
    structureIdx = rf.index
  }
  if (sets == null || repLow == null) return null

  const wu = clean.match(WEIGHT_UNIT)
  const wa = clean.match(WEIGHT_AT)
  const weight = parseWeight(wu ? wu[1] : wa ? wa[1] : null)
  const weightIdx = wu ? wu.index : wa ? wa.index : Infinity

  // The exercise name is whatever precedes the first number we recognized —
  // keeping only the last sentence fragment so mid-prose matches stay sane.
  const nameEnd = Math.min(structureIdx, weightIdx)
  const name = clean
    .slice(0, nameEnd)
    .split(/[.!?;]/)
    .pop()
    .replace(/[\s:—–\-,.(@]+$/, '')
    .trim()
  if (name.length < 2 || name.length > 60 || !/^[a-z]/i.test(name)) return null

  return { name, sets, repLow, repHigh, weight, muscleGroup: null }
}

/**
 * Extract a workout plan from pasted text (typically Claude's whole reply).
 * Returns { source: 'json' | 'text', workoutName, exercises } or null.
 * Exercises: { name, sets, repLow, repHigh, weight, muscleGroup }.
 */
export function parseCoachPlan(text) {
  if (!text || !text.trim()) return null

  // 1) The whole paste is the JSON block, or the reply contains fenced blocks.
  const candidates = [text.trim()]
  const fences = text.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)
  for (const f of fences) candidates.push(f[1].trim())
  // Unfenced JSON at the end of a prose reply.
  const brace = text.indexOf('{')
  if (brace >= 0) candidates.push(text.slice(brace, text.lastIndexOf('}') + 1))
  for (const c of candidates) {
    const plan = tryJsonPlan(c)
    if (plan) return plan
  }

  // 2) Best-effort: scan prose lines for "<name> <sets>×<reps> [@ weight]".
  const seen = new Set()
  const exercises = []
  for (const line of text.split('\n')) {
    const ex = parsePlanLine(line)
    if (!ex) continue
    const key = ex.name.toLowerCase()
    if (seen.has(key)) continue // repeat mentions (e.g. the recap) — keep the first
    seen.add(key)
    exercises.push(ex)
  }
  return exercises.length ? { source: 'text', workoutName: null, exercises } : null
}

const normName = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // "(machine)" qualifiers
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Match parsed plan exercises against the machine library by name.
 * Returns [{ exercise, machine | null }] in plan order. Matching is exact on
 * normalized names first, then containment either way (so "Leg Press" finds
 * "Leg Press (HOIST)" and vice versa).
 */
export function matchPlanToMachines(exercises, machines) {
  const pool = machines.map((m) => ({ machine: m, key: normName(m.name) })).filter((e) => e.key)
  return exercises.map((exercise) => {
    const key = normName(exercise.name)
    let match = pool.find((e) => e.key === key)?.machine || null
    if (!match && key.length >= 4) {
      let best = null
      for (const e of pool) {
        if (e.key.length < 4) continue
        if (!e.key.includes(key) && !key.includes(e.key)) continue
        const diff = Math.abs(e.key.length - key.length)
        if (!best || diff < best.diff) best = { machine: e.machine, diff }
      }
      match = best?.machine || null
    }
    return { exercise, machine: match }
  })
}
