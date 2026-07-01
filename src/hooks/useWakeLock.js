import { useEffect } from 'react'

/**
 * Keep the screen awake while `active` (mid-workout, so the phone doesn't
 * sleep between sets). Re-acquires the lock when the tab becomes visible again
 * (the OS releases it on background). Silently no-ops where unsupported.
 */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock = null
    let disposed = false

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* low battery / unsupported — fine */
      }
    }
    acquire()

    const onVisible = () => {
      if (!disposed && document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}
