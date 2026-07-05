import { uid } from '../lib/id.js'

// Muscle-group taxonomy used for the body-part split summary and filtering.
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Core',
]

// Equipment types. Everything is logged as weight x reps; "Bodyweight" just
// means the weight field represents total/added load (prefilled from the
// optional body-weight setting). "Machine" is the default for seeded entries.
export const EQUIPMENT_TYPES = ['Machine', 'Barbell', 'Dumbbell', 'Cable', 'Bodyweight', 'Other']

// Color per muscle group (Tailwind-ish hex) for chips and the split chart.
export const MUSCLE_COLORS = {
  Chest: '#f97316',
  Back: '#38bdf8',
  Shoulders: '#a855f7',
  Biceps: '#22c55e',
  Triceps: '#eab308',
  Legs: '#ef4444',
  Core: '#14b8a6',
  Other: '#94a3b8',
}

// Pre-seeded HOIST ROC-IT selectorized machines covering a full-body split.
// Model numbers reflect HOIST's ROC-IT (RS-) line.
const SEED = [
  {
    name: 'Chest Press',
    model: 'RS-2301',
    muscleGroup: 'Chest',
    notes: 'Seat height so handles align mid-chest. Neutral or wide grip.',
  },
  {
    name: 'Shoulder Press',
    model: 'RS-2401',
    muscleGroup: 'Shoulders',
    notes: 'Back flat against pad. Press without locking elbows.',
  },
  {
    name: 'Lat Pulldown',
    model: 'RS-1201',
    muscleGroup: 'Back',
    notes: 'Thigh pad snug. Pull to upper chest, drive elbows down.',
  },
  {
    name: 'Seated Row',
    model: 'RS-1203',
    muscleGroup: 'Back',
    notes: 'Chest on pad. Squeeze shoulder blades, neutral grip.',
  },
  {
    name: 'Biceps Curl',
    model: 'RS-1101',
    muscleGroup: 'Biceps',
    notes: 'Elbows on pad. Full range, controlled negative.',
  },
  {
    name: 'Triceps Extension',
    model: 'RS-1102',
    muscleGroup: 'Triceps',
    notes: 'Elbows pinned. Extend fully, slow return.',
  },
  {
    name: 'Leg Press',
    model: 'RS-4301',
    muscleGroup: 'Legs',
    notes: 'Feet shoulder-width mid-platform. Do not lock knees.',
  },
  {
    name: 'Leg Extension',
    model: 'RS-4401',
    muscleGroup: 'Legs',
    notes: 'Pad on lower shins. Pause at top.',
  },
  {
    name: 'Leg Curl',
    model: 'RS-4402',
    muscleGroup: 'Legs',
    notes: 'Seated. Pad above heels. Squeeze hamstrings.',
  },
  {
    name: 'Abdominal',
    model: 'RS-1601',
    muscleGroup: 'Core',
    notes: 'Crunch from the abs, not the arms. Controlled tempo.',
  },
  {
    name: 'Lower Back',
    model: 'RS-1602',
    muscleGroup: 'Core',
    notes: 'Extend from hips. Avoid hyperextending.',
  },
]

// Common free-weight & bodyweight movements, addable on top of the HOIST
// machine library (Settings → "Add common exercises"). Logged as weight x reps
// like everything else.
export const COMMON_EXERCISES = [
  { name: 'Barbell Bench Press', muscleGroup: 'Chest', type: 'Barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', type: 'Dumbbell' },
  { name: 'Barbell Back Squat', muscleGroup: 'Legs', type: 'Barbell' },
  { name: 'Barbell Deadlift', muscleGroup: 'Back', type: 'Barbell' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', type: 'Barbell' },
  { name: 'Barbell Row', muscleGroup: 'Back', type: 'Barbell' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', type: 'Barbell' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', type: 'Dumbbell' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', type: 'Dumbbell' },
  { name: 'Dumbbell Curl', muscleGroup: 'Biceps', type: 'Dumbbell' },
  { name: 'Barbell Curl', muscleGroup: 'Biceps', type: 'Barbell' },
  { name: 'Triceps Pushdown', muscleGroup: 'Triceps', type: 'Cable' },
  { name: 'Walking Lunge', muscleGroup: 'Legs', type: 'Dumbbell' },
  { name: 'Hip Thrust', muscleGroup: 'Legs', type: 'Barbell' },
  { name: 'Pull-up', muscleGroup: 'Back', type: 'Bodyweight' },
  { name: 'Chin-up', muscleGroup: 'Biceps', type: 'Bodyweight' },
  { name: 'Push-up', muscleGroup: 'Chest', type: 'Bodyweight' },
  { name: 'Dip', muscleGroup: 'Triceps', type: 'Bodyweight' },
  { name: 'Plank', muscleGroup: 'Core', type: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', type: 'Bodyweight' },
]

// Starter lower/upper split, alternated 3x/week (L-U-L, then U-L-U).
// Items reference machines BY NAME; installStarterPrograms resolves them to ids
// case-insensitively and creates any listed in `create` that don't exist yet.
// Rep targets are advisory — actual weight/reps are whatever gets logged.
export const STARTER_PROGRAMS = [
  {
    name: 'Lower Day',
    items: [
      { machine: 'Leg Press', sets: 3, repLow: 8, repHigh: 10 },
      { machine: 'Leg Curl', sets: 3, repLow: 10, repHigh: 12 },
      { machine: 'Leg Extension', sets: 2, repLow: 12, repHigh: 15 },
      { machine: 'Seated Rotary Calf', sets: 2, repLow: 15, repHigh: 15 },
      { machine: 'Lower Back', sets: 2, repLow: 12, repHigh: 15 },
      { machine: 'Abdominal', sets: 2, repLow: 15, repHigh: 15 },
    ],
  },
  {
    name: 'Upper Day',
    items: [
      // Pressing first, while fresh.
      { machine: 'Chest Press', sets: 3, repLow: 6, repHigh: 10 },
      { machine: 'Shoulder Press', sets: 3, repLow: 6, repHigh: 10 },
      { machine: 'Seated Row', sets: 3, repLow: 10, repHigh: 12 },
      { machine: 'Lat Pulldown', sets: 2, repLow: 10, repHigh: 12 },
      { machine: 'Biceps Curl', sets: 2, repLow: 10, repHigh: 12 },
      { machine: 'Triceps Extension', sets: 2, repLow: 10, repHigh: 12 },
    ],
  },
]

// Machines a starter program may need that aren't in the base seed library.
export const PROGRAM_MACHINES = [
  {
    name: 'Seated Rotary Calf',
    model: 'RS-1415',
    muscleGroup: 'Legs',
    type: 'Machine',
    notes: 'Full stretch at the bottom, pause at the top.',
  },
]

export function seedMachines() {
  const now = Date.now()
  return SEED.map((m, i) => ({
    id: uid('m'),
    name: m.name,
    model: m.model,
    muscleGroup: m.muscleGroup,
    type: 'Machine',
    notes: m.notes,
    hasPhoto: false,
    archived: false,
    createdAt: now + i,
  }))
}
