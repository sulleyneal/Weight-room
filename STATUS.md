# Audit status

Live progress log for the adversarial audit & level-up pass. See FINDINGS.md
(written at the end of the audit) for the full inventory of findings.

**Current phase:** 2 — attack pass #1 (hostile attacker + house-rules checker running against the built app)
**Last attacker verdict:** pending (pass #1 in progress)
**Biggest open gap:** unverified by attackers — hardening and perf work landed but not yet independently attacked

## Plan of record

1. Extract import/export/normalize logic into `lib/persistence.js` (pure, testable), harden it:
   corrupt-storage recovery stash, cross-tab `storage` adoption, save-failure surfacing,
   deep normalization on load/import. Backup format stays v1 byte-compatible.
2. Vitest suite: persistence, migrations, backup round-trip (with a real pre-change backup
   as fixture), all stat math, plan-import parser. `npm test`.
3. Fix correctness bugs from the audit read (duplicate-date workouts, epley1RM(w,1),
   dangling routine refs on machine delete, missing fields on imported/copied records).
4. Code-split Recharts routes; Lighthouse mobile ≥ 90 on dashboard with 5-year synthetic data.
5. Build → attack → fix loop with fresh-context attacker agents driving the real app in a
   browser until a full hostile pass finds nothing.
6. Level-up (post-green): persistent rest timer, undo for set deletion, PR logic resilient
   to rep-range switches — each addition goes through the attack loop.

## Phase log

- 2026-07-12: Full codebase read complete (every file). Real backup (13 machines / 8
  workouts / 140 sets / 2 routines / 12 photos) inspected and stashed as the round-trip
  fixture. Risk list ranked; plan posted.
- 2026-07-12: Phase 1 landed in 6 commits — storage layer extracted to pure functions and
  hardened (corrupt-data recovery stash + warning, save-failure banner, cross-tab storage
  adoption, deep normalization incl. duplicate-date workout merge), stat-math fixes
  (single-rep e1RM, band rounding), 0-rep entry guard, 52-test vitest suite (`npm test`),
  chart pages code-split (main bundle 669KB → 256KB), dashboard PR counting single-pass.
  Lighthouse mobile perf on the dashboard with a 5-year/15k-set dataset: **99** (was 87;
  TBT 490ms → 110ms). Attack pass #1 dispatched.
