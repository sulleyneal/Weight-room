// Exercise → muscle-region mapping for the muscle-map card.
//
// The data model only knows a machine's muscle GROUP, but the figure draws
// individual regions — and "MUSCLES WORKED" must not light muscles that
// weren't worked (a Low Back session is not a lat session; a calf PR should
// light the calves). Machine names carry enough signal for the common cases;
// anything unrecognized falls back to every region of its group.

// Region keys match bodyMap.js FRONT/BACK_REGIONS.
const GROUP_DEFAULTS = {
  Chest: ['pec'],
  Back: ['lat', 'trap', 'erector'],
  Shoulders: ['deltF'],
  Biceps: ['biceps'],
  Triceps: ['tri'],
  Legs: ['quad', 'glute', 'ham', 'calfB'],
  Core: ['abs'],
  Other: [],
}

// First matching rule wins. Patterns test the lowercased exercise name.
const NAME_RULES = [
  [/calf|calves/, ['calfB']],
  [/leg curl|ham/, ['ham']],
  [/leg extension/, ['quad']],
  [/leg press|squat|hack/, ['quad', 'glute']],
  [/lunge/, ['quad', 'glute', 'ham']],
  [/romanian|rdl/, ['ham', 'glute']],
  [/deadlift/, ['ham', 'glute', 'erector', 'trap']],
  [/hip thrust|glute/, ['glute']],
  [/low back|lower back|back extension|hyperextension/, ['erector']],
  [/shrug/, ['trap']],
  [/face pull/, ['deltF', 'trap']],
  [/pulldown|pull-up|pull up|chin/, ['lat']],
  [/\brow\b|rowing/, ['lat', 'trap']],
  [/rotary torso|abdominal|crunch|\bab\b|plank|leg raise|torso/, ['abs']],
  [/lateral raise|shoulder|overhead|delt/, ['deltF']],
  [/pushdown|triceps|dip/, ['tri']],
  [/curl/, ['biceps']], // after leg curl / face pull rules
  [/bench|chest|fly|pec|push-up|push up/, ['pec']],
]

/** Region keys an exercise lights, from its name with group fallback. */
export function regionsForExercise(name, group) {
  const n = (name || '').toLowerCase()
  for (const [re, regions] of NAME_RULES) {
    if (re.test(n)) return regions
  }
  return GROUP_DEFAULTS[group] || GROUP_DEFAULTS.Other
}

/**
 * Volume per region for a session's exercises
 * ([{ name, group, volume }] → { regionKey: volume }).
 * An exercise's volume is credited fully to each of its regions (regions are
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
