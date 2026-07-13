// Exercise → muscle mapping for the muscle-map share card.
//
// The data model only knows a machine's muscle GROUP, but the figure draws
// individual muscles — and "MUSCLES WORKED" must not light muscles that
// weren't worked (a Low Back session is not a lat session; a calf PR should
// light the calves). Machine names carry enough signal for the common cases;
// anything unrecognized falls back to every muscle of its group.
//
// Muscle slugs match the anatomical figure data in bodyAnatomy.js.

export const SLUG_GROUP = {
  chest: 'Chest',
  'upper-back': 'Back',
  'lower-back': 'Back',
  trapezius: 'Back',
  deltoids: 'Shoulders',
  biceps: 'Biceps',
  forearm: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Legs',
  adductors: 'Legs',
  gluteal: 'Legs',
  hamstring: 'Legs',
  calves: 'Legs',
  tibialis: 'Legs',
  abs: 'Core',
  obliques: 'Core',
}

const GROUP_DEFAULTS = {
  Chest: ['chest'],
  Back: ['upper-back', 'trapezius', 'lower-back'],
  Shoulders: ['deltoids'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Legs: ['quadriceps', 'gluteal', 'hamstring', 'calves'],
  Core: ['abs', 'obliques'],
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
  [/pushdown|triceps|dip/, ['triceps']],
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
