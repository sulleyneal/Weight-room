// Exercise → muscle mapping for the muscle-map share card.
//
// The data model only knows a machine's muscle GROUP, but the figure draws
// individual muscles — and "MUSCLES WORKED" must not light muscles that
// weren't worked (a Low Back session is not a lat session; a calf PR should
// light the calves). Machine names carry enough signal for the common cases;
// anything unrecognized falls back to every muscle of its group.
//
// Muscle slugs match the anatomical figure data in bodyAnatomy.js.

// Which muscle GROUP owns each anatomical slug — this is what colors the figure
// and builds the "muscles worked" legend, so figure and legend always agree.
export const SLUG_GROUP = {
  chest: 'Chest',
  'upper-back': 'Lats',
  'lower-back': 'Back',
  trapezius: 'Back',
  deltoids: 'Shoulders',
  biceps: 'Biceps',
  forearm: 'Forearms',
  triceps: 'Triceps',
  quadriceps: 'Legs',
  adductors: 'Legs',
  gluteal: 'Glutes',
  hamstring: 'Legs',
  calves: 'Calves',
  tibialis: 'Calves',
  abs: 'Abs',
  obliques: 'Core',
}

// Fallback muscles for an exercise whose name isn't recognized, by its assigned
// group. Compound groups list every muscle they typically hit (a leg press then
// lights quads + glutes in their own colors — informative, not a bug).
const GROUP_DEFAULTS = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Lats: ['upper-back'],
  Shoulders: ['deltoids'],
  Biceps: ['biceps'],
  Forearms: ['forearm'],
  Triceps: ['triceps'],
  Legs: ['quadriceps', 'hamstring', 'adductors'],
  Glutes: ['gluteal'],
  Calves: ['calves', 'tibialis'],
  Core: ['abs', 'obliques'],
  Abs: ['abs'],
  Other: [],
}

// First matching rule wins. Patterns test the lowercased exercise name.
const NAME_RULES = [
  [/calf|calves/, ['calves', 'tibialis']],
  [/leg curl|hamstring/, ['hamstring']],
  [/leg extension/, ['quadriceps']],
  [/leg press|squat|hack/, ['quadriceps', 'gluteal', 'adductors']],
  [/lunge/, ['quadriceps', 'gluteal', 'hamstring']],
  [/romanian|rdl/, ['hamstring', 'gluteal']],
  [/deadlift/, ['hamstring', 'gluteal', 'lower-back', 'trapezius']],
  [/hip thrust|glute/, ['gluteal']],
  [/adductor|abductor/, ['adductors']],
  [/low back|lower back|back extension|hyperextension/, ['lower-back']],
  [/shrug/, ['trapezius']],
  [/face pull/, ['deltoids', 'trapezius']],
  [/pulldown|pull-up|pull up|chin/, ['upper-back', 'biceps']],
  [/\brow\b|rowing/, ['upper-back', 'trapezius']],
  [/rotary torso|oblique|twist/, ['obliques']],
  [/abdominal|crunch|\bab\b|plank|leg raise/, ['abs']],
  [/lateral raise|shoulder|overhead|delt/, ['deltoids']],
  [/\bdips?\b/, ['chest', 'triceps']],
  [/pushdown|triceps/, ['triceps']],
  [/forearm|wrist/, ['forearm']],
  [/curl/, ['biceps']], // after leg curl / face pull rules
  [/bench|chest|fly|pec|push-up|push up/, ['chest']],
]

/** Muscle slugs an exercise lights, from its name with group fallback. */
export function regionsForExercise(name, group) {
  const n = (name || '').toLowerCase()
  for (const [re, regions] of NAME_RULES) {
    if (re.test(n)) return regions
  }
  return GROUP_DEFAULTS[group] || GROUP_DEFAULTS.Other
}

/**
 * Volume per muscle slug for a session's exercises
 * ([{ name, group, volume }] → { slug: volume }).
 * An exercise's volume is credited fully to each of its muscles (muscles are
 * lit by how hard they were hit, not by splitting bookkeeping).
 */
export function regionVolumesFor(exercises) {
  const out = {}
  for (const ex of exercises) {
    for (const key of regionsForExercise(ex.name, ex.group)) {
      out[key] = (out[key] || 0) + ex.volume
    }
  }
  return out
}

/**
 * Normalize a map of key -> volume into key -> intensity ratio (0..1),
 * where the most-worked key is 1. Keys with no volume are omitted.
 */
export function computeIntensities(volumes) {
  const max = Math.max(0, ...Object.values(volumes))
  const out = {}
  if (max <= 0) return out
  for (const [key, vol] of Object.entries(volumes)) {
    if (vol > 0) out[key] = vol / max
  }
  return out
}

/**
 * "Effort" per muscle slug for a session's exercises. Effort is volume
 * (weight × reps) when there's load, but falls back to total reps for a
 * bodyweight / zero-load exercise — so doing the reps still lights the muscle
 * even with no weight entered. Weighted sessions are unchanged (effort == volume).
 */
export function regionEffortsFor(exercises) {
  const out = {}
  for (const ex of exercises) {
    const effort = ex.volume > 0 ? ex.volume : ex.reps || ex.sets || 0
    if (effort <= 0) continue
    for (const key of regionsForExercise(ex.name, ex.group)) {
      out[key] = (out[key] || 0) + effort
    }
  }
  return out
}

/** Aggregate per-slug values into per-GROUP totals (for the legend). */
export function groupTotalsFromRegions(regionValues) {
  const out = {}
  for (const [slug, v] of Object.entries(regionValues)) {
    const group = SLUG_GROUP[slug] || 'Other'
    out[group] = (out[group] || 0) + v
  }
  return out
}
