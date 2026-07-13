// Persisted "session plan": the exercises added to a day's session — from an
// imported Claude plan, a started routine, or the exercise picker — together
// with their per-exercise targets and program order, BEFORE any set is logged.
//
// Why this exists: that plan used to live only in React state, so backgrounding
// the app on mobile (which reloads the page) wiped an imported/started workout
// that had no logged sets yet. Logged sets survive in the main store; the plan
// did not. This keeps it alive until the user logs it or clears it.
//
// Deliberately SEPARATE from the app's backup/export data (`weight-room:v1`):
// this is ephemeral session scaffolding, not logged history, and must never
// change the sacred backup format. Keyed by date so glancing at another day
// can't clobber today's plan.

import { todayISO, addDaysISO } from './metrics.js'

const PLAN_KEY = 'weight-room:v1:plan'
// Drop plans older than this so the map can't grow without bound if a planned
// day is never logged or cleared.
const RETAIN_DAYS = 30

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

function planIsEmpty(p) {
  return !(
    p &&
    ((p.addedMachineIds && p.addedMachineIds.length) ||
      (p.templateOrder && p.templateOrder.length) ||
      (p.sessionTargets && Object.keys(p.sessionTargets).length))
  )
}

function normalizePlan(p) {
  return {
    addedMachineIds: Array.isArray(p?.addedMachineIds) ? p.addedMachineIds : [],
    sessionTargets:
      p?.sessionTargets && typeof p.sessionTargets === 'object' ? p.sessionTargets : {},
    templateOrder: Array.isArray(p?.templateOrder) ? p.templateOrder : [],
  }
}

function readAll() {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

// Keep only non-empty, valid, recent plans.
function prune(map) {
  let cutoff = ''
  try {
    cutoff = addDaysISO(todayISO(), -RETAIN_DAYS)
  } catch {
    cutoff = ''
  }
  const out = {}
  for (const [date, p] of Object.entries(map)) {
    if (!isDate(date) || date < cutoff) continue
    const plan = normalizePlan(p)
    if (!planIsEmpty(plan)) out[date] = plan
  }
  return out
}

function writeAll(map) {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(PLAN_KEY)
    else localStorage.setItem(PLAN_KEY, JSON.stringify(map))
  } catch {
    /* storage full/blocked — plan persistence is best-effort, never fatal */
  }
}

/** The persisted plan for a date, or null if none. */
export function loadPlanForDate(date) {
  if (!isDate(date)) return null
  const p = readAll()[date]
  if (!p) return null
  const plan = normalizePlan(p)
  return planIsEmpty(plan) ? null : plan
}

/** Persist (or, if empty, clear) the plan for a date. */
export function savePlanForDate(date, plan) {
  if (!isDate(date)) return
  const map = readAll()
  const normalized = normalizePlan(plan)
  if (planIsEmpty(normalized)) delete map[date]
  else map[date] = normalized
  writeAll(prune(map))
}

/** Forget the plan for a date. */
export function clearPlanForDate(date) {
  if (!isDate(date)) return
  const map = readAll()
  if (date in map) {
    delete map[date]
    writeAll(prune(map))
  }
}
