// Weight Room data shapes — mirror the client's persisted document exactly so
// the DB round-trips to the backup format losslessly.

export interface Machine {
  id: string
  name: string
  model: string
  muscleGroup: string
  type: string
  notes: string
  hasPhoto: boolean
  archived: boolean
  createdAt: number
  [key: string]: unknown // unknown extra keys are preserved (newer app versions)
}

export interface Workout {
  id: string
  date: string // 'YYYY-MM-DD', unique per date
  [key: string]: unknown
}

export interface WorkoutSet {
  id: string
  workoutId: string
  machineId: string
  weight: number
  reps: number
  order: number
  t?: number
  [key: string]: unknown
}

export interface RoutineItem {
  machineId: string
  sets: number
  repLow: number | null
  repHigh: number | null
}

export interface Routine {
  id: string
  name: string
  items: RoutineItem[]
  createdAt: number
}

export interface Settings {
  unit: 'lbs' | 'kg'
  bodyweight: number
  [key: string]: unknown
}

export interface AppData {
  schemaVersion: number
  machines: Machine[]
  workouts: Workout[]
  sets: WorkoutSet[]
  routines: Routine[]
  settings: Settings
}

export type Photos = Record<string, string> // machineId -> dataURL

export interface BackupPayload {
  app: 'weight-room'
  schemaVersion: number
  exportedAt: string
  data: Omit<AppData, 'schemaVersion'> & { schemaVersion?: number }
  photos: Photos
}

// ---- Planned sessions (Claude's write target) ------------------------------

export interface PlannedExercise {
  name: string
  sets: number
  repLow: number | null
  repHigh: number | null
  weight: number | null
}

export interface PlannedSession {
  id: string
  name: string
  date: string | null
  exercises: PlannedExercise[]
  source: string
  status: 'pending' | 'consumed'
  createdAt: string
  consumedAt: string | null
}

export const SCHEMA_VERSION = 1
