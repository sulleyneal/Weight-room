import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Fresh module per test so module-level state (target, interval) resets.
async function freshTimer() {
  vi.resetModules()
  return import('../src/lib/restTimer.js')
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('rest timer engine', () => {
  it('counts down and clears at zero', async () => {
    const t = await freshTimer()
    t.startRest(90)
    expect(t.getRemaining()).toBe(90)
    const seen = []
    t.subscribe(() => seen.push(t.getRemaining()))
    vi.advanceTimersByTime(30_000)
    expect(t.getRemaining()).toBe(60)
    vi.advanceTimersByTime(61_000)
    expect(t.getRemaining()).toBeNull() // fired and idle
    expect(seen[seen.length - 1]).toBeNull()
  })

  it('persists the target so a reload resumes the countdown', async () => {
    const t = await freshTimer()
    t.startRest(120)
    // Simulate a page reload: fresh module reads the same localStorage.
    const t2 = await freshTimer()
    expect(t2.getRemaining()).toBeGreaterThanOrEqual(119)
  })

  it('discards a target that expired while the page was closed (no late beep)', async () => {
    localStorage.setItem('weight-room:rest-target', String(Date.now() - 5000))
    const t = await freshTimer()
    expect(t.getRemaining()).toBeNull()
    expect(localStorage.getItem('weight-room:rest-target')).toBeNull()
  })

  it('stopRest clears state and storage', async () => {
    const t = await freshTimer()
    t.startRest(60)
    t.stopRest()
    expect(t.getRemaining()).toBeNull()
    expect(localStorage.getItem('weight-room:rest-target')).toBeNull()
  })

  it('clamps the preferred duration to sane bounds', async () => {
    const t = await freshTimer()
    expect(t.preferredSecs()).toBe(90) // default
    t.setPreferredSecs(120)
    expect(t.preferredSecs()).toBe(120)
    localStorage.setItem('weight-room:rest-secs', '99999')
    expect(t.preferredSecs()).toBe(90)
  })
})
