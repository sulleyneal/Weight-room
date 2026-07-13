import { useEffect, useRef } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  isConnectorEnabled,
  pullPlannedSessions,
  consumePlannedSession,
} from '../lib/dbSync.js'
import { matchPlanToMachines } from '../lib/planImport.js'
import { loadPlanForDate, savePlanForDate } from '../lib/sessionPlan.js'
import { todayISO } from '../lib/metrics.js'
import { MUSCLE_GROUPS } from '../data/seed.js'

// Renders nothing. Polls the connector for planned sessions Claude wrote and
// surfaces them in the app's session plan — the "Claude writes a workout back
// into the app" half of the connector. Runs in the background: on mount, on tab
// focus, and every 60s. Never touches logged history.
export default function ConnectorSync() {
  const store = useStore()
  // Keep latest state/actions in a ref so the effect can stay mount-only.
  const ref = useRef(store)
  ref.current = store
  const runningRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function applyPlan(plan) {
      const s = ref.current
      const machines = s.state.machines.filter((m) => !m.archived)
      const rows = matchPlanToMachines(plan.exercises || [], machines)
      const items = rows.map(({ exercise, machine }) => {
        const machineId =
          machine?.id ||
          s.addMachine({
            name: exercise.name,
            muscleGroup: MUSCLE_GROUPS.includes(exercise.muscleGroup)
              ? exercise.muscleGroup
              : 'Other',
          })
        return {
          machineId,
          sets: exercise.sets,
          repLow: exercise.repLow,
          repHigh: exercise.repHigh,
          weight: exercise.weight,
        }
      })
      if (!items.length) return

      const date = plan.date || todayISO()
      const existing = loadPlanForDate(date) || {
        addedMachineIds: [],
        sessionTargets: {},
        templateOrder: [],
      }
      const ids = items.map((it) => it.machineId)
      const targets = Object.fromEntries(items.map((it) => [it.machineId, it]))
      savePlanForDate(date, {
        addedMachineIds: [...new Set([...existing.addedMachineIds, ...ids])],
        sessionTargets: { ...existing.sessionTargets, ...targets },
        templateOrder: [...new Set([...existing.templateOrder, ...ids])],
      })
      // Let an open Log screen pick it up live.
      window.dispatchEvent(new CustomEvent('connector-plan-applied', { detail: { date } }))
      s.pushNotice(`Claude sent a plan: “${plan.name}” — open Log to start it.`, 'info')
    }

    async function pull() {
      if (cancelled || runningRef.current || !isConnectorEnabled()) return
      runningRef.current = true
      try {
        const plans = await pullPlannedSessions()
        // Oldest first, so multiple queued plans apply in order.
        for (const plan of [...plans].reverse()) {
          if (cancelled) break
          await applyPlan(plan)
          await consumePlannedSession(plan.id).catch(() => {})
        }
      } catch {
        /* surfaced in Settings; never interrupt the app */
      } finally {
        runningRef.current = false
      }
    }

    pull()
    const onFocus = () => pull()
    window.addEventListener('focus', onFocus)
    window.addEventListener('connector-pull-now', onFocus)
    const id = setInterval(pull, 60000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('connector-pull-now', onFocus)
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
