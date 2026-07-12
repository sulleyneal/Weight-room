# Adversarial audit — findings

Everything the audit found, what was fixed, what was deliberately left, and how
data versioning works. Produced by a build → attack → fix loop: fixes were made,
then fresh-context attacker agents (who had not seen the reasoning) drove the
built app in a real browser through hostile scenarios and reported what broke.
STATUS.md tracks the live phase log.

## Data-loss paths (found & fixed)

1. **Corrupt localStorage silently reseeded and then overwrote the old data.**
   `loadState()` caught any parse error, returned null, the app seeded a fresh
   library, and the next save clobbered the (possibly recoverable) blob.
   *Fixed:* the unparseable blob is stashed under `weight-room:v1:recovered`
   (newest, plus one previous generation in `…:recovered-prev`) and a visible
   startup banner tells you to export it before logging anything.

2. **Two tabs clobbered each other (last write wins).** No `storage` listener
   existed; the staler tab's next save erased the other tab's sets.
   *Fixed:* tabs adopt each other's writes via the `storage` event. Verified by
   an attacker with simultaneous adds from two tabs (8/8 sets survived).

3. **Failed saves were silent.** `saveState()` returns false on quota errors and
   nobody checked; you could log a whole workout into RAM and lose it on close.
   *Fixed:* a persistent error banner appears and clears when saving recovers.

4. **Startup save could clobber a non-React write.** Between hydrate and the
   first save there was a window where an external writer's document was blindly
   overwritten (same-document writes fire no storage event). *Fixed:* the first
   save re-reads the document and adopts a changed one instead of overwriting.

5. **Set editing silently rewrote numbers on reload.** The edit path stored
   negative/zero/absurd values verbatim (dashboard showed negative weekly volume
   plus a PR badge for it), then normalization "repaired" them on the next load —
   the same data showed different numbers on two views. *Fixed:* `updateSet`
   clamps to the entry rules (weight 0–20000, reps 1–1000 integer) immediately,
   and the edit row's save button disables on invalid reps.

## Wrong-date / wrong-math bugs (found & fixed)

6. **Day navigation was broken in every UTC-positive timezone** (attacker's worst
   finding). `shiftDate()` serialized a local-midnight `Date` with
   `toISOString()`, which converts to UTC: in UTC+ zones "previous day" jumped
   two days, "next day" never advanced, and sets were silently logged up to 8
   days off — polluting history, PRs, and streaks. The same pattern sat in
   `loadSampleHistory`. *Fixed:* all date arithmetic goes through the
   timezone-safe helpers (`todayISO`/`addDaysISO`); verified by an attacker in
   Pacific/Auckland, Europe/Berlin, Pacific/Honolulu, and UTC.

7. **`epley1RM(w, 1)` returned `w × 1.033`** while its own doc comment said a
   single rep returns the weight unchanged. A 1-rep max *is* a max. *Fixed*
   (affects only 1-rep sets; the real dataset contains none).

8. **Duplicate-workout burst race.** Set-log dispatches batched into one task
   each created their own same-date workout (UI hid all but one; the next load
   merged them but set order was permanently lost). Sequential taps at maximum
   Playwright speed were always safe — this needed synthetic same-task bursts —
   but the invariant was enforced nowhere. *Fixed:* logging is now a
   reducer-level action that finds-or-creates the day's workout and assigns
   order (max+1) against the latest state; covered by reducer burst tests.

9. **`loadSampleHistory` created duplicate-date workouts** (readers assume date
   uniqueness). *Fixed:* reuses the existing workout for the date; deep
   normalization also merges any pre-existing duplicates and remaps their sets.

10. **Training-load band rounding.** `span` was rounded independently of
    `low`/`high`, so the plotted band top drifted 1 unit off `high`. *Fixed.*

## Attack pass #2 findings (all fixed)

11. **HIGH — a garbage date in the `#/log/:date` route blanked the app.**
    `#/log/banana` + one set wrote `date: "banana"` as a workout key; it
    survived normalization, threw `RangeError` on the Records page, and with no
    error boundary the entire tree (nav included) unmounted — a trap only a URL
    edit could escape. *Fixed four layers deep:* the route param and date input
    are sanitized (real calendar date, clamped to today), `logSet`/`copyLast…`
    refuse malformed dates, `normalizeState` drops invalid-date workouts (their
    sets are kept as orphans — no set data destroyed), and a route-level error
    boundary keeps the nav alive with a "your data is safe" card if any page
    ever crashes again.

12. **Future-dated workouts** could be created by typing a date (the input's
    `max` isn't enforced on manual entry) or via the route. *Fixed:* both paths
    clamp to today.

13. **"Import a day" produced colliding set orders after a middle-set delete**
    — `mergeDayImport` used count instead of max(order)+1 (the reducer fix from
    pass #1 hadn't been applied to this parallel path). *Fixed + tested.*

14. **Settings bodyweight accepted negatives** until the next reload repaired
    it. *Fixed:* clamped immediately (0–2000).

## Attack pass #3 findings (fixed)

15. **MEDIUM — delete-machine × pending-undo ghost.** Delete a set (undo
    snackbar appears) → delete the entire exercise → return and tap Undo: the
    set resurrected for a machine that no longer exists — invisible on the log
    page, unremovable via UI, inflating volume/PR/streak stats, and making
    Records self-contradictory. Enabled by the snackbar's dismiss timer pausing
    while the log page was unmounted. *Fixed three layers deep:* `RESTORE_SET`
    refuses when the set's machine is gone; deleting a machine (or importing a
    backup / resetting) invalidates a pending undo; the undo window expires on
    wall clock in the store provider, not in the component.

Pass #3 also confirmed: every pass-1/2 fix held under re-attack (date injection
neutralized at all four layers with no reachable render crash, timezone nav
exact in Auckland, 15-click bursts clean, two-tab simultaneous logging
lossless, round-trip byte-identical, quota-full shows the red banner and
recovers, offline works, no tap target under 32px, huge-state pages ~60ms).

## Hardening (no observed failure, but fragile)

- **Import validation was shallow.** Any `{machines: […]}` object entered the
  store unnormalized. Now every load and import passes through
  `normalizeState`: field coercion, duplicate-date merge, legacy-shape upgrades
  (`exerciseIds` routines, machines without `type`), unknown record keys
  preserved for forward compatibility. Records are never dropped.
- **Dangling references.** Deleting a machine now also removes it from program
  items (previously programs kept a "Missing exercise" entry).
- **0-rep sets.** Entry and edit both refuse them (phantom sets polluted volume
  and PR math). Weights are clamped to 0–20000, reps to 1–1000.
- **`copyLastWorkoutForMachine`** now stamps sets with `t` so session elapsed
  time counts them, and appends orders after existing ones.

## Performance

- **Recharts (~384KB) was in the boot path** for every page including set
  logging. The two chart pages are now lazy routes; main bundle 669KB → 256KB.
- **Dashboard PR counting was O(machines × sets)** — recomputed per-machine
  session scans on the main thread at startup. Replaced with a single-pass
  `prCountByWorkout` (equivalence-tested against the per-machine loop).
- **Result:** Lighthouse mobile performance on the dashboard with a 5-year /
  15k-set synthetic dataset: **99** (was 87; TBT 490ms → 110ms). Attacker-measured
  interactive times on the same dataset: dashboard 95ms, records 258ms, machine
  detail with 468 sessions 217ms.

## Usability (mid-workout)

- **Tap targets:** the log screen had 82 elements under 40px, including a
  40×18px instant-delete-set button in the same grid as 24px edit buttons.
  Set-row controls now have ≥40px hit areas; delete is 40×40 in its own column;
  rest presets and the progression-suggestion chip were enlarged (suggestion via
  negative-margin padding, zero layout change).

## Deliberately left as-is

- **`user-scalable=no` viewport.** Costs an accessibility point; kept because
  accidental pinch-zoom mid-set is worse for this app's one user. Revisit if
  anyone else ever uses it.
- **Unit toggle does not convert stored weights** — documented design decision
  (weights are stored in the display unit; toggling reinterprets).
- **Day-merge re-import duplicates sets by design** — the confirm dialog warns
  ("Imported sets will be ADDED to that day"). It is a merge tool, not a sync.
- **"Import a day (merge)" keeps a pending set-undo alive** (unlike full import /
  reset / machine delete, which invalidate it). Verified harmless by the final
  attacker — the merge preserves the machine and day, so the undo stays
  semantically coherent (zero ghosts, zero order collisions).
- **Same-document non-React writes after startup** (devtools/extensions writing
  the key mid-session) are still last-write-wins: no storage event fires and
  true state merging is out of scope for a single-user app. Cross-tab operation
  is safe via storage events; the startup window is closed.
- **9e99-style absurd weights are now clamped at entry/edit (20000)**, but values
  already stored by older versions are preserved on load (normalization only
  enforces non-negativity — historical data is sacred).
- **README says Vercel; the repo actually deploys to GitHub Pages** via
  `.github/workflows/deploy.yml` on pushes to `main`. Treated Pages as truth.
- **PR semantics unchanged.** "Ignore rep-range-switch artifacts" was considered:
  current PR flags are precisely defined (all-time top-set weight record OR
  all-time e1RM record, per machine) and the e1RM criterion already normalizes
  across rep ranges. Any "artifact filter" would make PRs fuzzier and rewrite
  which historical sessions show trophies. Left alone deliberately; the math is
  independently verified against a brute-force recompute in tests and by two
  attacker agents.
- **Same-document external writes after the first save** (devtools/extensions
  writing the key mid-session) remain last-write-wins — no storage event fires
  for them and state merging is out of scope for a single-user app. Cross-tab
  operation is safe via storage events; the startup window is closed.

## Dead code / lies removed

- `NumberStepper` advertised "long-press auto-repeat via pointer" — no such
  handlers existed. Comment removed (rapid taps work and are tested).
- `ensureWorkout`/`addSet`/`ADD_SET(S)`/`ADD_WORKOUT` replaced by the reducer-
  level `LOG_SET`/`ADD_SETS_FOR_DATE` (the old shapes were the race source).

## Versioning & migration scheme

- The persisted document and the backup format remain **schemaVersion 1** — no
  breaking change was needed, so old backups and old localStorage load without
  a version bump.
- **Every load and import passes through `normalizeState`** (idempotent deep
  clean): this is the migration hook. A future v2 would bump `SCHEMA_VERSION`,
  branch on the stored version inside `loadState`/`parseBackup`, and upgrade in
  place — the pure-function layout in `src/lib/persistence.js` is built for it.
- **Round-trip guarantee (tested, and verified in-browser by two independent
  agents):** a clean v1 backup imports and re-exports with `data.*` value-
  identical (byte-identical in the attacker's jq diff), photos byte-identical;
  only top-level `exportedAt` changes. A real pre-change backup file is the
  permanent fixture (`tests/fixtures/backup-v1-real.json`, photos stubbed).
- Unknown keys on records survive normalization, so a *newer* app version's
  data degrades gracefully in an older one.

## Level-up (shipped after the audit went green, then re-attacked)

- **Persistent rest timer.** The timer used to live inside each exercise card —
  scrolling to the next machine or refreshing killed a running rest. Now a
  single app-wide countdown (localStorage-backed) that survives navigation and
  refresh, shows on every card, beeps exactly once, and discards targets that
  expired while the page was closed. Zero added taps.
- **Undo for set deletion.** Delete-set is one tap with no confirm (by design —
  confirms would slow entry). A 6-second "Set deleted — Undo" snackbar restores
  the exact set, recreating the pruned day workout if needed, collision-safe on
  order, idempotent against double-taps.

## Test suite

`npm test` — vitest, jsdom. Covers: storage gateway (round-trip, corrupt-data
recovery, legacy upgrades), deep normalization, backup parse + day-merge import,
reducer invariants (burst logging, order monotonicity, machine deletion), all
stat math (e1RM, volume, per-session rollups, PR detection — including an
independent brute-force recompute over the real backup — double-progression
suggestions, training load, date helpers), and the Claude plan parser.
