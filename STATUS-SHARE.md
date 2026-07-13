# Share-imagery level-up — status

**Current phase:** DONE. Brand checker #4 (fresh context, pixel measurements):
**"BAR MET — nothing left to find"** — sibling templates pixel-identical, all
arithmetic exact (recomputed independently), one marker grammar across every
card, legible at 400px feed size, edge states designed rather than broken.
House-rules checker: 7/7 PASS on the running build (2 taps to a 2160×2160 PNG,
zero external requests, fonts lazy-load only at share time, no layout shift on
the log page, backup round-trip value-identical, 76/76 tests).
**Latest cards:** `docs/share-previews/`; every card × format × torture case
re-renders live at `#/share-lab` on any device.

**Safari note (the Run Receipt scar):** a true WebKit browser could not be
installed in the audit environment (proxy blocked the download), so the proof
is: Safari-safe canvas primitives only (no html2canvas, no roundRect /
letterSpacing / ctx.filter / OffscreenCanvas — manual implementations), the
Share tap calls navigator.share synchronously with a pre-rendered blob (inside
iOS's user-activation window), fonts loaded via FontFace + document.fonts
(the canvas-supported path on WebKit), and `#/share-lab` ships in production —
open it once on the iPhone to eyeball the full matrix on real WebKit.

## What was built

- Razed the old export path (SVG body-map summary via `summaryImage.js`).
- New system under `src/lib/share/`: bundled JetBrains Mono + Outfit (latin
  variable woff2, ~31KB each, lazy-loaded at share time), canvas drawing kit
  with Safari-safe primitives only (no html2canvas, no ctx.filter/letterSpacing/
  roundRect/OffscreenCanvas), three purpose-built cards × two formats
  (1080×1080, 1080×1920), all drawn at 2× (2160/3840 px files).
- Cards: single-exercise PR (record chip, huge top-set numerals, gain chip,
  story-format e1RM sparkline), session summary (program-day title, stat strip,
  adaptive-density exercise table), progress report (real e1RM chart with
  PR-flagged sessions).
- Share studio (`ShareModal`): card picker → format toggle → live preview;
  the PNG blob is pre-rendered so the Share tap calls `navigator.share`
  synchronously inside iOS Safari's user-activation window. Save fallback.
  Taps from a logged workout: Share card → Share → share sheet = 3.
- Layout discipline: every lower zone anchors up from the footer, so long
  names / 20-rep sets / 16-exercise sessions can't spill the frame
  (torture-cased in `#/share-lab`).

## Loop log

- iter 1 (self-review): caught and fixed — square-format footer overflows on
  PR/progress cards, gain chip colliding with the SESSIONS column, headline PR
  picker preferring first-ever sessions over real records, session table
  showing 3 of 7 exercises with dead space below.
- iter 2 (brand checker #1: BAR NOT MET, 4 bar-failures + nits; house-rules
  checker: 7/7 PASS). Fixed all: first-time progress lone-dot chart replaced
  with a labeled baseline marker (PR-ring encoding consistent with the other
  charts); story session layouts are height-aware (tall rows + centered
  remainder — no more third-of-frame black); PR-square template geometry is
  fixed (one hero size, one gap, sparkline slot always present with an honest
  first-ever state); PR footer no longer contradicts the session card's
  SESSION NNN stamp; est. 1RMs rounded everywhere; gain/change chips drop the
  duplicated unit; PREV BEST relabelled PREV TOP SET (no cross-base misread);
  '+N MORE' overflow is a real table row with the hidden volume aggregate;
  chart axis/legend micro-type bumped for feed-size legibility.
- iter 3 (brand checker #2: BAR NOT MET — caught a catastrophic regression my
  fixed-geometry change introduced: the exercise-name block collided with the
  hero numeral on every square PR card; also PR-marker encoding still split
  across three systems, first-time progress story inherited square rhythm,
  torture fixtures shared a date/session number). Fixed: square PR cards use a
  single-line ellipsized name above a fixed hero slot (collision impossible by
  construction; sparkline is story-only, consistently); ONE marker system
  everywhere (gold ring = PR, ring+core = latest, legend covers both, session
  rows use the same ring); first-time progress story recomposed (centered,
  larger baseline lockup); axis figures anchored to their point levels with
  ticks; fixture dates disambiguated; square session rows single-line
  everywhere (sublabels are story-only).
- iter 4 (brand checker #3: BAR NOT MET on two measurable edge-state faults —
  baseline lockup centered on plot area instead of canvas; story table header
  orphaned by slack distribution). Fixed both + label unification.
- FINAL (brand checker #4, fresh context): **BAR MET — nothing left to find.**
  Remaining nitpicks it explicitly would not block a ship on (quiet zone on the
  5-row story, sparkline endpoint-only rings à la Whoop/Oura, three baseline
  lockup stylings) are recorded here as accepted.
