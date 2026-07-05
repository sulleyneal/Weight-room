// "Ask Claude" coach prompt: package the most recent workout plus enough
// context (per-exercise history, program targets, training-load status) into
// a self-contained markdown prompt that any Claude surface can answer well.

import {
  sessionsForMachine,
  machineBests,
  prSessionsForMachine,
  trainingLoadSeries,
  fmtDate,
} from './metrics.js'
import { unitLabel, weightStep } from './units.js'

function fmtW(value, unit) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${str} ${unitLabel(unit)}`
}

function fmtItemTarget(it) {
  if (it.repLow == null && it.repHigh == null) return `${it.sets} sets`
  if (it.repLow != null && it.repHigh != null && it.repLow !== it.repHigh) {
    return `${it.sets}×${it.repLow}–${it.repHigh}`
  }
  return `${it.sets}×${it.repHigh ?? it.repLow}`
}

const LOAD_STATUS_TEXT = {
  low: 'below my optimal training-load band (backing off / detraining risk)',
  optimal: 'inside my optimal training-load band (productive zone)',
  high: 'above my optimal training-load band (pushing hard / overreaching risk)',
}

/**
 * Build the coaching prompt from app state. Returns a markdown string, or
 * null when there is no logged workout to analyze.
 */
export function buildCoachPrompt(state) {
  const { machines, workouts, sets, routines, settings } = state
  const unit = settings.unit

  const setsByWorkout = new Map()
  for (const s of sets) {
    if (!setsByWorkout.has(s.workoutId)) setsByWorkout.set(s.workoutId, [])
    setsByWorkout.get(s.workoutId).push(s)
  }
  const logged = workouts
    .filter((w) => (setsByWorkout.get(w.id) || []).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!logged.length) return null

  const latest = logged[logged.length - 1]
  const machineById = new Map(machines.map((m) => [m.id, m]))

  // Program target lookup: first routine item mentioning each machine.
  const targetByMachine = new Map()
  for (const r of routines) {
    for (const it of r.items) {
      if (!targetByMachine.has(it.machineId)) targetByMachine.set(it.machineId, it)
    }
  }

  // ---- Most recent workout, exercise by exercise ----
  const latestSets = setsByWorkout.get(latest.id)
  const byMachine = new Map()
  for (const s of latestSets) {
    if (!byMachine.has(s.machineId)) byMachine.set(s.machineId, [])
    byMachine.get(s.machineId).push(s)
  }

  const exerciseLines = []
  for (const [machineId, mSets] of byMachine) {
    const m = machineById.get(machineId)
    const name = m?.name || 'Unknown exercise'
    const ordered = [...mSets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const setStr = ordered.map((s) => `${fmtW(s.weight, unit)} × ${s.reps}`).join(', ')

    const parts = [`- **${name}**${m?.muscleGroup ? ` (${m.muscleGroup})` : ''}: ${setStr}`]

    const target = targetByMachine.get(machineId)
    if (target) parts.push(`  - Program target: ${fmtItemTarget(target)}`)

    const sessions = sessionsForMachine(machineId, workouts, sets)
    const prior = sessions.filter((s) => s.date < latest.date)
    const prev = prior[prior.length - 1]
    if (prev) {
      const prevStr = prev.sets.map((s) => `${fmtW(s.weight, unit)} × ${s.reps}`).join(', ')
      parts.push(`  - Previous session (${prev.date}): ${prevStr}`)
    } else {
      parts.push('  - First time logging this exercise.')
    }

    const bests = machineBests(machineId, workouts, sets)
    if (bests.bestTopSetWeight > 0) {
      parts.push(
        `  - All-time best: top set ${fmtW(bests.bestTopSetWeight, unit)}, est. 1RM ${fmtW(bests.best1RM, unit)}`,
      )
    }

    const prFlags = prSessionsForMachine(machineId, workouts, sets).get(latest.id)
    if (prev && prFlags && (prFlags.weightPR || prFlags.oneRmPR)) {
      parts.push('  - This session set a PR. 🎉')
    }

    exerciseLines.push(parts.join('\n'))
  }

  // ---- Programs (and which one this workout most resembles) ----
  const programLines = routines.map((r) => {
    const items = r.items
      .map((it) => {
        const m = machineById.get(it.machineId)
        return m ? `${m.name} ${fmtItemTarget(it)}` : null
      })
      .filter(Boolean)
    return `- **${r.name}**: ${items.join(' · ') || 'no exercises'}`
  })

  let matchedProgram = null
  if (routines.length) {
    let best = 0
    for (const r of routines) {
      const ids = new Set(r.items.map((it) => it.machineId))
      const overlap = [...byMachine.keys()].filter((id) => ids.has(id)).length
      if (overlap > best) {
        best = overlap
        matchedProgram = r
      }
    }
    if (best < Math.ceil(byMachine.size / 2)) matchedProgram = null
  }

  // ---- Recent frequency + training load ----
  const recent = logged.slice(-8).map((w) => {
    const groups = [
      ...new Set(
        (setsByWorkout.get(w.id) || [])
          .map((s) => machineById.get(s.machineId)?.muscleGroup)
          .filter(Boolean),
      ),
    ]
    const n = (setsByWorkout.get(w.id) || []).length
    return `- ${w.date}: ${n} set${n === 1 ? '' : 's'} (${groups.join(', ')})`
  })

  const load = trainingLoadSeries(machines, workouts, sets)
  const loadText = load.status ? LOAD_STATUS_TEXT[load.status] : null

  // ---- Assemble ----
  const out = []
  out.push(
    'You are my strength coach. Below is data from my workout tracker (Weight Room). ' +
      `All weights are in ${unitLabel(unit)}.` +
      (settings.bodyweight ? ` My body weight is ${fmtW(settings.bodyweight, unit)}.` : ''),
  )
  out.push('')
  out.push(`## Most recent workout — ${latest.date} (${fmtDate(latest.date)})`)
  if (matchedProgram) out.push(`This session followed my "${matchedProgram.name}" program.`)
  out.push('')
  out.push(exerciseLines.join('\n'))

  if (programLines.length) {
    out.push('')
    out.push('## My programs')
    out.push(
      'I alternate these across roughly 3 sessions a week. Rep ranges are double-progression targets: top the range on every set → add weight and drop back to the bottom of the range.',
    )
    out.push(programLines.join('\n'))
  }

  out.push('')
  out.push('## Recent training days')
  out.push(recent.join('\n'))
  if (loadText) {
    out.push('')
    out.push(`My current 7-day training load is ${loadText}.`)
  }

  out.push('')
  out.push('## What I want from you')
  out.push(
    [
      '1. Which workout should I do next, and when? (Consider my split and how recently each muscle group was trained.)',
      `2. For each exercise in that next workout: a specific weight and rep target in ${unitLabel(unit)} (my plates/stack move in ${weightStep(unit)} ${unitLabel(unit)} steps), and whether I should add weight, add reps, or deload.`,
      '3. Call out anything that looks stalled or imbalanced, with one concrete fix.',
      'Keep it concise and specific — a short plan I can follow at the gym, not an essay.',
    ].join('\n'),
  )

  return out.join('\n')
}
