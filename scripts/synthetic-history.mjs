// Generate a large synthetic dataset (default ~5 years of an upper/lower
// split) in the exact localStorage document shape, for perf testing and
// hostile "huge state" scenarios.
//
//   node scripts/synthetic-history.mjs [years] > big-state.json
//
// Then in the browser: localStorage.setItem('weight-room:v1', <file contents>)

const YEARS = Number(process.argv[2]) || 5

const MACHINES = [
  ['Chest Press', 'Chest'],
  ['Shoulder Press', 'Shoulders'],
  ['Lat Pulldown', 'Back'],
  ['Seated Row', 'Back'],
  ['Biceps Curl', 'Biceps'],
  ['Triceps Extension', 'Triceps'],
  ['Leg Press', 'Legs'],
  ['Leg Extension', 'Legs'],
  ['Leg Curl', 'Legs'],
  ['Abdominal', 'Core'],
  ['Rotary Torso', 'Core'],
  ['Seated Rotary Calf', 'Legs'],
  ['Low Back', 'Back'],
]

const UPPER = [0, 1, 2, 3, 4, 5]
const LOWER = [6, 7, 8, 9, 10, 11, 12]

// Deterministic PRNG so runs are reproducible.
let seed = 42
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const machines = MACHINES.map(([name, group], i) => ({
  id: `m_syn_${i}`,
  name,
  model: `RS-${2300 + i}`,
  muscleGroup: group,
  type: 'Machine',
  notes: '',
  hasPhoto: false,
  archived: false,
  createdAt: 1600000000000 + i,
}))

const workouts = []
const sets = []
let setN = 0

const today = new Date()
const start = new Date(today)
start.setFullYear(start.getFullYear() - YEARS)

// 4 sessions a week (Mon/Tue/Thu/Fri), alternating upper/lower.
let sessionIdx = 0
for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
  const dow = d.getDay()
  if (![1, 2, 4, 5].includes(dow)) continue
  if (rand() < 0.12) continue // skipped sessions
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const workoutId = `w_syn_${workouts.length}`
  workouts.push({ id: workoutId, date })

  const day = sessionIdx % 2 === 0 ? UPPER : LOWER
  sessionIdx++
  const progress = (d - start) / (today - start) // 0..1 over the years

  for (const mi of day) {
    const base = 60 + mi * 15
    const weight = Math.round((base + progress * base * 0.8 + (rand() - 0.5) * 10) / 5) * 5
    const nSets = 2 + (rand() < 0.5 ? 1 : 0)
    for (let s = 0; s < nSets; s++) {
      sets.push({
        id: `s_syn_${setN++}`,
        workoutId,
        machineId: `m_syn_${mi}`,
        weight: Math.max(20, weight),
        reps: 8 + Math.floor(rand() * 5) - (s > 0 ? 1 : 0),
        order: s,
      })
    }
  }
}

const state = {
  schemaVersion: 1,
  machines,
  workouts,
  sets,
  routines: [
    {
      id: 'r_syn_upper',
      name: 'Upper Day',
      items: UPPER.map((mi) => ({ machineId: `m_syn_${mi}`, sets: 3, repLow: 8, repHigh: 12 })),
      createdAt: 1600000000000,
    },
    {
      id: 'r_syn_lower',
      name: 'Lower Day',
      items: LOWER.map((mi) => ({ machineId: `m_syn_${mi}`, sets: 3, repLow: 8, repHigh: 12 })),
      createdAt: 1600000000001,
    },
  ],
  settings: { unit: 'lbs', bodyweight: 245 },
}

console.error(
  `synthetic: ${YEARS}y → ${workouts.length} workouts, ${sets.length} sets, ${JSON.stringify(state).length} bytes`,
)
process.stdout.write(JSON.stringify(state))
