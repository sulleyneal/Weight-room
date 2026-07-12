# Share-imagery level-up — status

**Current phase:** build → check loop, iteration 1 self-review done; brand
checker + house-rules checker dispatched.
**Latest cards:** rendered from the real backup + torture cases via the
`#/share-lab` QA route (open it on any device to re-render live); current
previews in `docs/share-previews/`.
**Biggest open gap:** awaiting first fresh-context brand verdict.

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
