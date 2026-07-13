// The share cards. Three purpose-built layouts × two formats, drawn with
// plain Canvas 2D at 2× for crispness. Design language: near-black ground,
// blueprint grid, mono meta voice, huge Outfit numerals, hairline structure,
// muscle-group color coding. Legibility beats decoration — minimum text size
// on any card is 21px in 1080-space, mono, high contrast.
//
// Layout discipline: headers flow from the top, but every lower zone is
// anchored UP from the footer (footerTop), so content can never spill past
// the frame no matter the data (long names, 20 reps, 16 exercises…).

import { FORMATS, SCALE, INK, ACCENT, MARGIN, mono, sans, groupColor } from './theme.js'
import {
  drawGround,
  hairline,
  metaLabel,
  chip,
  accentTick,
  trackedText,
  measureTracked,
  fitText,
  wrapTwoLines,
  lineChart,
  sparkline,
  prRing,
  drawFigure,
  chipRight,
  WASH_ALPHA,
} from './draw.js'
import { unitLabel } from '../units.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function fmtCardDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAYS[dt.getDay()]} ${MONTHS[m - 1]} ${String(d).padStart(2, '0')} ${y}`
}

function fmtShortDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${String(d).padStart(2, '0')}`
}

function fmtNum(v) {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

// Estimated 1RMs are estimates — decimals read as spreadsheet output.
function fmtE1(v) {
  return String(Math.round(v))
}

function fmtVol(v) {
  return Math.round(v).toLocaleString('en-US')
}

// ---- shared chrome ---------------------------------------------------------

function header(ctx, w, dateIso) {
  const y = MARGIN + 44
  accentTick(ctx, MARGIN, y - 24, 26, ACCENT.brand)
  metaLabel(ctx, 'Weight Room', MARGIN + 18, y, { size: 24, color: INK.text, weight: 700 })
  metaLabel(ctx, fmtCardDate(dateIso), w - MARGIN, y, { size: 22, align: 'right' })
  hairline(ctx, MARGIN, y + 26, w - MARGIN)
  return y + 26 // header bottom
}

// Footer sits at a fixed depth; returns the y content must stay above.
function footer(ctx, w, h, leftText, unit) {
  const y = h - MARGIN - 14
  hairline(ctx, MARGIN, y - 40, w - MARGIN)
  metaLabel(ctx, leftText, MARGIN, y, { size: 22, color: INK.faint })
  metaLabel(ctx, `UNIT · ${unitLabel(unit)}`, w - MARGIN, y, {
    size: 22,
    color: INK.faint,
    align: 'right',
  })
  return y - 40 // the hairline: everything must stay above this
}

function footerTopOf(h) {
  return h - MARGIN - 54
}

function makeCanvas(spec) {
  const canvas = document.createElement('canvas')
  canvas.width = spec.w * SCALE
  canvas.height = spec.h * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'
  return { canvas, ctx }
}

function normalizePoints(values, flags = []) {
  const n = values.length
  if (!n) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  return values.map((v, i) => ({
    x: n === 1 ? 0.5 : i / (n - 1),
    y: span < 1e-9 ? 0.5 : 0.08 + 0.84 * ((v - min) / span),
    flag: Boolean(flags[i]),
  }))
}

// Title block used by PR + progress cards: kicker, fitted name, group label.
// Returns the y below the block. maxLines: 1 forces a single ellipsized line
// (used where a fixed hero slot sits below and must never be collided with).
function titleBlock(
  ctx,
  moment,
  y,
  contentW,
  { kickerChip = null, kicker, kickerColor, nameSize, maxLines = 2 },
) {
  if (kickerChip) {
    const cw = chip(ctx, kickerChip, MARGIN, y, { color: kickerColor, size: 30, pad: 20 })
    metaLabel(ctx, kicker, MARGIN + cw + 26, y + 10, { size: 24, color: kickerColor })
    y += 96
  } else {
    metaLabel(ctx, kicker, MARGIN, y, { size: 24, color: kickerColor })
    y += 72
  }
  const size = fitText(ctx, moment.name, (s) => sans(s, 800), nameSize, maxLines === 1 ? 44 : 54, contentW)
  ctx.font = sans(size, 800)
  ctx.fillStyle = INK.text
  let lines = wrapTwoLines(ctx, moment.name, contentW)
  if (maxLines === 1 && lines.length > 1) {
    let name = moment.name
    while (name.length > 2 && ctx.measureText(name + '…').width > contentW) {
      name = name.slice(0, -1).trimEnd()
    }
    lines = [name + '…']
  }
  y += size * 0.22
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y + size * 0.6)
    y += size * 1.06
  }
  metaLabel(ctx, moment.group, MARGIN, y + 26, { size: 24, color: groupColor(moment.group) })
  return y + 40
}

// ---- 1. Single-exercise PR card -------------------------------------------

export function renderPRCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2
  const footerTop = footerTopOf(h)
  const unit = unitLabel(moment.unit).toUpperCase()

  drawGround(ctx, w, h)
  header(ctx, w, moment.date)

  const kindText =
    moment.kind === 'both'
      ? 'TOP SET + EST. 1RM RECORD'
      : moment.kind === 'weight'
        ? 'TOP SET RECORD'
        : 'EST. 1RM RECORD'
  const firstEver = moment.prevBestTop == null && moment.prevBestE1 == null

  // Square is single-line-name (ellipsized) so the fixed hero slot below can
  // never be collided with; story has room for a two-line name.
  titleBlock(ctx, moment, story ? 400 : 240, contentW, {
    kickerChip: 'PR',
    kicker: firstEver ? 'FIRST SESSION ON RECORD' : kindText,
    kickerColor: ACCENT.pr,
    nameSize: story ? 92 : 74,
    maxLines: story ? 2 : 1,
  })

  // Fixed template geometry — identical on every PR card of a format, so a
  // profile grid of these reads as siblings (no data-dependent size drift).
  // The square drops the sparkline strip entirely (every square, always):
  // badge + name + hero + stats is all a 1:1 frame can hold with air.
  const sparkH = 240 // strip incl. its label (story only)
  const sparkTop = footerTop - sparkH - 44
  const statsY = story ? sparkTop - 132 : footerTop - 108
  const heroSize = story ? 330 : 240
  const heroBaseline = statsY - (story ? 190 : 132)

  const weightStr = fmtNum(moment.topWeight)
  const usedHero = fitText(ctx, weightStr, (s) => sans(s, 800), heroSize, 110, contentW - 250)
  ctx.font = sans(usedHero, 800)
  ctx.fillStyle = INK.text
  ctx.fillText(weightStr, MARGIN - 4, heroBaseline)
  const weightW = ctx.measureText(weightStr).width
  ctx.font = mono(38, 500)
  ctx.fillStyle = INK.dim
  trackedText(ctx, unit, MARGIN + weightW + 28, heroBaseline - usedHero * 0.56, 4)
  ctx.font = mono(60, 700)
  ctx.fillStyle = ACCENT.brand
  trackedText(ctx, `×${moment.topReps}`, MARGIN + weightW + 28, heroBaseline - 4, 2)

  // Sub-stats row. PREV TOP SET + GAIN share the top-set basis (est. 1RM is
  // its own column) so adjacent numbers can't be misread across bases.
  hairline(ctx, MARGIN, statsY - 44, w - MARGIN, INK.hairlineFaint)
  const hasGain = moment.deltaTop != null && moment.deltaTop > 0
  const cols = [
    { label: 'EST. 1RM', value: fmtE1(moment.e1rm) },
    {
      label: 'PREV TOP SET',
      value: moment.prevBestTop != null ? fmtNum(moment.prevBestTop) : '—',
    },
    hasGain
      ? { label: 'GAIN', chipText: `+${fmtNum(moment.deltaTop)}` }
      : { label: 'SESSIONS', value: String(moment.sessionCount) },
  ]
  const colW = contentW / 3
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW
    metaLabel(ctx, c.label, cx, statsY, { size: 22 })
    if (c.chipText) {
      chip(ctx, c.chipText, cx + 2, statsY + 42, { color: ACCENT.pos, size: 26 })
    } else {
      ctx.font = sans(54, 700)
      ctx.fillStyle = INK.text
      ctx.fillText(c.value, cx, statsY + 62)
    }
  })

  // Sparkline strip — story only; the first-ever case gets an honest labeled
  // state in the SAME slot (template never changes shape within a format).
  if (story && moment.history.length >= 2) {
    metaLabel(ctx, `EST. 1RM · LAST ${moment.history.length} SESSIONS`, MARGIN, sparkTop, {
      size: 22,
    })
    sparkline(
      ctx,
      // The last history point is today's PR — flag it so the terminal
      // marker uses the gold PR encoding.
      normalizePoints(
        moment.history.map((p) => p.e1rm),
        moment.history.map((_, i) => i === moment.history.length - 1),
      ),
      { x: MARGIN, y: sparkTop + 36, w: contentW, h: sparkH - 72 },
      { color: groupColor(moment.group), dotColor: ACCENT.pr },
    )
  } else if (story) {
    metaLabel(ctx, 'EST. 1RM · TREND', MARGIN, sparkTop, { size: 22 })
    const midY = sparkTop + 36 + (sparkH - 72) / 2
    hairline(ctx, MARGIN, midY, w - MARGIN, INK.hairlineFaint)
    prRing(ctx, MARGIN + 12, midY, 9, true)
    ctx.font = mono(28, 600)
    ctx.fillStyle = INK.dim
    trackedText(ctx, `${fmtE1(moment.e1rm)} EST. 1RM — BASELINE`, MARGIN + 38, midY + 10, 1)
  }

  footer(ctx, w, h, `${moment.group} · SINCE ${fmtShortDate(moment.history[0]?.date || moment.date)}`, moment.unit)
  return canvas
}

// ---- 2. Session summary card ----------------------------------------------

export function renderSessionCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2
  const footerTop = footerTopOf(h)

  drawGround(ctx, w, h)
  header(ctx, w, moment.date)

  // Title row: program day left, PR chip right on the same line.
  let y = story ? 372 : 252
  const title = (moment.programName || 'Training Session').toUpperCase()
  const prChipText = `${moment.prCount} PR${moment.prCount > 1 ? 'S' : ''} TODAY`
  let chipReserve = 0
  if (moment.prCount > 0) {
    ctx.font = mono(26, 700)
    chipReserve = measureTracked(ctx, prChipText, 26 * 0.12) + 96
  }
  const tSize = fitText(ctx, title, (s) => sans(s, 800), story ? 100 : 84, 48, contentW - chipReserve)
  ctx.font = sans(tSize, 800)
  ctx.fillStyle = INK.text
  ctx.fillText(title, MARGIN, y)
  if (moment.prCount > 0) {
    chipRight(ctx, prChipText, w - MARGIN, y - tSize * 0.32, { color: ACCENT.pr, size: 26 })
  }
  y += story ? 110 : 84

  // Stat strip.
  const stats = [
    { label: 'EXERCISES', value: String(moment.exercises.length) },
    { label: 'SETS', value: String(moment.totalSets) },
    { label: `VOLUME ${unitLabel(moment.unit).toUpperCase()}`, value: fmtVol(moment.totalVolume) },
    moment.durationMin != null
      ? { label: 'MINUTES', value: String(moment.durationMin) }
      : { label: 'PRS', value: String(moment.prCount) },
  ]
  const colW = contentW / stats.length
  stats.forEach((s, i) => {
    const cx = MARGIN + i * colW
    if (i) {
      ctx.strokeStyle = INK.hairlineFaint
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx - 24, y - 18)
      ctx.lineTo(cx - 24, y + 62)
      ctx.stroke()
    }
    metaLabel(ctx, s.label, cx, y, { size: 21 })
    const vSize = fitText(ctx, s.value, (n) => sans(n, 700), 56, 32, colW - 48)
    ctx.font = sans(vSize, 700)
    ctx.fillStyle = INK.text
    ctx.fillText(s.value, cx, y + 62)
  })
  y += story ? 150 : 118

  // Exercise table — adaptive density so real sessions fit without a chasm
  // of dead space: roomy two-line rows when few, compact rows when many.
  hairline(ctx, MARGIN, y - 36, w - MARGIN)
  metaLabel(ctx, 'EXERCISE', MARGIN, y, { size: 21 })
  metaLabel(ctx, 'TOP SET', w - MARGIN, y, { size: 21, align: 'right' })
  y += 16

  const rowsSpace = footerTop - y - 12
  const n = moment.exercises.length
  const roomyH = story ? 96 : 88
  const compactH = story ? 62 : 58
  let compact = n * roomyH > rowsSpace
  // Row anatomy is per-format so square siblings always match: squares are
  // always single-line rows; the sets sublabel appears only on roomy stories.
  const subline = story && !compact
  let rowH = compact ? compactH : roomyH
  let maxRows = Math.floor(rowsSpace / rowH)
  const overflow = n > maxRows
  const shown = moment.exercises.slice(0, overflow ? maxRows - 1 : n)
  const rowCount = shown.length + (overflow ? 1 : 0)
  // Height-aware: rows stretch toward the footer (story gets properly tall
  // rows). The first row stays pinned to the column header — any slack the
  // stretch can't absorb falls below the list, never between header and rows.
  rowH = Math.min(roomyH * (story ? 1.9 : 1.25), rowsSpace / rowCount)
  const tall = rowH > 120

  for (const ex of shown) {
    const mid = y + rowH / 2
    accentTick(ctx, MARGIN, mid - 13, 26, groupColor(ex.group))

    const rightSize = compact ? 30 : tall ? 38 : 32
    const rightStr = `${fmtNum(ex.topWeight)}×${ex.topReps}`
    ctx.font = mono(rightSize, 600)
    const rightW = measureTracked(ctx, rightStr, 1)
    ctx.font = mono(21, 700)
    const prW = ex.isPR ? measureTracked(ctx, 'PR', 2) + 44 : 0

    const nameSize = compact ? 32 : tall ? 42 : 36
    const nameMax = contentW - rightW - (subline ? 0 : prW) - 70
    ctx.font = sans(nameSize, 600)
    ctx.fillStyle = INK.text
    let name = ex.name
    while (name.length > 2 && ctx.measureText(name).width > nameMax) name = name.slice(0, -1)
    if (name !== ex.name) name = name.trimEnd() + '…'
    const nameY = subline ? mid - 4 : mid + nameSize * 0.34
    ctx.fillText(name, MARGIN + 24, nameY)
    if (subline) {
      metaLabel(ctx, `${ex.sets} SETS`, MARGIN + 24, mid + (tall ? 36 : 28), {
        size: 22,
        color: INK.faint,
      })
    }

    ctx.font = mono(rightSize, 600)
    ctx.fillStyle = INK.text
    const rightY = subline ? mid - 2 : mid + 10
    trackedText(ctx, rightStr, w - MARGIN - (subline ? 0 : prW), rightY, 1, 'right')
    if (ex.isPR) {
      // Same gold-ring PR mark the charts use.
      ctx.font = mono(21, 700)
      const prTextW = measureTracked(ctx, 'PR', 2)
      const markY = subline ? mid + (tall ? 30 : 22) : rightY - 7
      const textX = w - MARGIN
      ctx.fillStyle = ACCENT.pr
      trackedText(ctx, 'PR', textX, subline ? markY + 8 : rightY, 2, 'right')
      prRing(ctx, textX - prTextW - 18, subline ? markY : rightY - 7, 7)
    }
    hairline(ctx, MARGIN, y + rowH, w - MARGIN, INK.hairlineFaint)
    y += rowH
  }
  if (overflow) {
    // The overflow row is a real table row, not an apologetic whisper: count
    // on the left, the hidden work's aggregate volume on the right.
    const hidden = moment.exercises.slice(shown.length)
    const mid = y + rowH / 2
    accentTick(ctx, MARGIN, mid - 13, 26, INK.faint)
    ctx.font = sans(compact ? 32 : 36, 600)
    ctx.fillStyle = INK.dim
    ctx.fillText(`+ ${hidden.length} more exercises`, MARGIN + 24, mid + 12)
    const hiddenVol = hidden.reduce((sum, ex) => sum + ex.volume, 0)
    ctx.font = mono(compact ? 30 : 32, 600)
    ctx.fillStyle = INK.dim
    trackedText(ctx, `${fmtVol(hiddenVol)} VOL`, w - MARGIN, mid + 10, 1, 'right')
  }

  footer(ctx, w, h, `SESSION ${String(moment.sessionNumber).padStart(3, '0')}`, moment.unit)
  return canvas
}

// ---- 3. Progress-over-time card --------------------------------------------

export function renderProgressCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2
  const footerTop = footerTopOf(h)
  const color = groupColor(moment.group)
  const unit = unitLabel(moment.unit).toUpperCase()

  drawGround(ctx, w, h)
  header(ctx, w, moment.windowEnd)

  const nameBottom = titleBlock(ctx, moment, story ? 400 : 260, contentW, {
    kicker: 'PROGRESS REPORT',
    kickerColor: ACCENT.brand,
    nameSize: story ? 92 : 78,
  })

  // Stats row: current (big) / all-time best / gain-or-sessions. Session
  // count also lives in the footer, so the third slot can carry the delta.
  const statsY = nameBottom + (story ? 90 : 56)
  const hasDelta = moment.deltaE1 != null && Math.abs(moment.deltaE1) > 0.05
  const up = hasDelta && moment.deltaE1 > 0
  const cols = [
    { label: 'EST. 1RM NOW', value: fmtE1(moment.currentE1), big: true },
    { label: 'ALL-TIME BEST', value: fmtE1(moment.bestE1) },
    hasDelta
      ? { label: 'CHANGE', chipText: `${up ? '+' : '−'}${fmtE1(Math.abs(moment.deltaE1))}`, up }
      : { label: 'SESSIONS', value: String(moment.totalSessions) },
  ]
  const colW = contentW / 3
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW
    metaLabel(ctx, c.label, cx, statsY, { size: 21 })
    if (c.chipText) {
      chip(ctx, c.chipText, cx + 2, statsY + 44, { color: c.up ? ACCENT.pos : ACCENT.neg, size: 24 })
    } else {
      ctx.font = sans(c.big ? 72 : 52, c.big ? 800 : 700)
      ctx.fillStyle = c.big ? INK.text : INK.dim
      ctx.fillText(c.value, cx, statsY + (c.big ? 76 : 64))
    }
  })

  // Chart zone, anchored: axis row sits just above the footer.
  const axisY = footerTop - 18
  const chartTop = statsY + (story ? 160 : 120)
  const chartH = axisY - 52 - chartTop
  const chartBox = { x: MARGIN, y: chartTop, w: contentW - 118, h: chartH }
  const values = moment.series.map((p) => p.e1rm)
  const pts = normalizePoints(values, moment.series.map((p) => p.pr))

  if (moment.series.length >= 2) {
    lineChart(ctx, pts, chartBox, { color })
    // Y figures anchored to the padded extremes with small ticks (the values
    // sit exactly at the max/min point levels, not floating mid-air).
    const maxV = Math.max(...values)
    const minV = Math.min(...values)
    const maxY = chartTop + 0.08 * chartH
    const minY = chartTop + 0.92 * chartH
    ctx.strokeStyle = INK.hairline
    ctx.lineWidth = 1.5
    for (const ty of [maxY, minY]) {
      ctx.beginPath()
      ctx.moveTo(MARGIN + chartBox.w + 6, ty)
      ctx.lineTo(MARGIN + chartBox.w + 16, ty)
      ctx.stroke()
    }
    ctx.font = mono(30, 600)
    ctx.fillStyle = INK.dim
    trackedText(ctx, fmtE1(maxV), MARGIN + chartBox.w + 26, maxY + 10, 1)
    trackedText(ctx, fmtE1(minV), MARGIN + chartBox.w + 26, minY + 10, 1)
    // Axis row: dates + the one marker legend.
    metaLabel(ctx, fmtShortDate(moment.windowStart), MARGIN, axisY, { size: 24 })
    metaLabel(ctx, fmtShortDate(moment.windowEnd), MARGIN + chartBox.w, axisY, {
      size: 24,
      align: 'right',
    })
    const legend = []
    if (moment.series.some((p) => p.pr)) legend.push(['pr', 'PR'])
    legend.push(['latest', 'LATEST'])
    let lx = w / 2 - 150
    for (const [kind, label] of legend) {
      if (kind === 'pr') prRing(ctx, lx, axisY - 9, 7)
      else prRing(ctx, lx, axisY - 9, 7, true, moment.series[moment.series.length - 1].pr ? ACCENT.pr : color)
      lx += 20
      lx += metaLabel(ctx, label, lx, axisY, { size: 24 }) + 44
    }
  } else {
    // One session is a baseline, not a trend — a labeled marker in the same
    // encoding (a first session IS a PR). The story recomposes for height:
    // centered, larger lockup, instead of inheriting square rhythm.
    const midY = chartTop + chartH / 2
    ctx.strokeStyle = INK.hairlineFaint
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(MARGIN, midY)
    ctx.lineTo(MARGIN + chartBox.w, midY)
    ctx.stroke()
    if (story) {
      // Center on the CANVAS, not the plot area — the y-label gutter is
      // empty on this card and off-center reads as a bug.
      const cx = w / 2
      prRing(ctx, cx, midY - 120, 16, true)
      ctx.font = mono(52, 600)
      ctx.fillStyle = INK.text
      trackedText(ctx, `${fmtE1(moment.currentE1)} EST. 1RM`, cx, midY - 20, 2, 'center')
      metaLabel(ctx, `BASELINE · ${fmtShortDate(moment.windowEnd)}`, cx, midY + 48, {
        size: 26,
        align: 'center',
      })
    } else {
      const dotX = MARGIN + 96
      prRing(ctx, dotX, midY, 11, true)
      ctx.font = mono(34, 600)
      ctx.fillStyle = INK.text
      trackedText(ctx, `${fmtE1(moment.currentE1)} EST. 1RM`, dotX + 34, midY + 12, 1)
      metaLabel(ctx, `BASELINE · ${fmtShortDate(moment.windowEnd)}`, dotX + 34, midY + 56, {
        size: 24,
      })
    }
    metaLabel(ctx, 'FIRST SESSION LOGGED — TREND STARTS HERE', MARGIN, axisY, { size: 24 })
  }

  footer(
    ctx,
    w,
    h,
    `EST. 1RM · ${moment.series.length} SESSION${moment.series.length > 1 ? 'S' : ''} · SINCE ${fmtShortDate(moment.windowStart)}`,
    moment.unit,
  )
  return canvas
}

// ---- 4. Muscle-map card ------------------------------------------------------

export function renderMuscleCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2
  const footerTop = footerTopOf(h)

  drawGround(ctx, w, h)
  header(ctx, w, moment.date)

  // Kicker + title (program day), PR chip on the title line like the session card.
  let y = story ? 340 : 224
  metaLabel(ctx, 'MUSCLES WORKED', MARGIN, y, { size: 24, color: ACCENT.brand })
  y += story ? 150 : 128
  const title = (moment.programName || 'Training Session').toUpperCase()
  const prChipText = `${moment.prCount} PR${moment.prCount > 1 ? 'S' : ''} TODAY`
  let chipReserve = 0
  if (moment.prCount > 0) {
    ctx.font = mono(26, 700)
    chipReserve = measureTracked(ctx, prChipText, 26 * 0.12) + 96
  }
  const tSize = fitText(ctx, title, (s) => sans(s, 800), story ? 100 : 84, 44, contentW - chipReserve)
  ctx.font = sans(tSize, 800)
  ctx.fillStyle = INK.text
  ctx.fillText(title, MARGIN, y)
  if (moment.prCount > 0) {
    chipRight(ctx, prChipText, w - MARGIN, y - tSize * 0.32, { color: ACCENT.pr, size: 26 })
  }

  // Legend anchored above the footer; figures fill the space between.
  const legendRows = moment.groups.length > 4 ? 2 : 1
  const legendH = legendRows * 54
  const legendTop = footerTop - legendH - (story ? 44 : 24)
  const figTop = y + (story ? 90 : 56)
  const figLabelH = 56
  const figH = legendTop - figTop - figLabelH - (story ? 60 : 36)

  const figW = (figH / 400) * 200
  const gap = Math.min(story ? 200 : 150, contentW - figW * 2)
  const pairW = figW * 2 + gap
  const startX = MARGIN + (contentW - pairW) / 2
  drawFigure(ctx, 'front', moment.intensities, { x: startX, y: figTop, w: figW, h: figH })
  drawFigure(ctx, 'back', moment.intensities, { x: startX + figW + gap, y: figTop, w: figW, h: figH })
  metaLabel(ctx, 'FRONT', startX + figW / 2, figTop + figH + figLabelH - 12, {
    size: 24,
    align: 'center',
  })
  metaLabel(ctx, 'BACK', startX + figW + gap + figW / 2, figTop + figH + figLabelH - 12, {
    size: 24,
    align: 'center',
  })

  // Legend: dot + GROUP + share%, centered rows.
  ctx.font = mono(26, 600)
  const entries = moment.groups.map((g) => ({
    ...g,
    label: `${g.group.toUpperCase()} ${Math.round(g.share * 100)}%`,
    width: 26 + measureTracked(ctx, `${g.group.toUpperCase()} ${Math.round(g.share * 100)}%`, 2) + 44,
  }))
  const perRow = Math.ceil(entries.length / legendRows)
  for (let r = 0; r < legendRows; r++) {
    const row = entries.slice(r * perRow, (r + 1) * perRow)
    if (!row.length) continue
    const rowW = row.reduce((sum, e) => sum + e.width, 0) - 44
    let lx = MARGIN + (contentW - rowW) / 2
    const ly = legendTop + 26 + r * 54
    for (const e of row) {
      ctx.beginPath()
      ctx.arc(lx + 9, ly - 9, 9, 0, Math.PI * 2)
      ctx.fillStyle = groupColor(e.group)
      ctx.globalAlpha = WASH_ALPHA // dots render exactly like the washes
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.font = mono(26, 600)
      ctx.fillStyle = INK.dim
      trackedText(ctx, e.label, lx + 30, ly, 2)
      lx += e.width
    }
  }

  footer(
    ctx,
    w,
    h,
    `${moment.totalSets} SETS · ${fmtVol(moment.totalVolume)} VOL · SESSION ${String(moment.sessionNumber).padStart(3, '0')}`,
    moment.unit,
  )
  return canvas
}

export const CARD_RENDERERS = {
  pr: renderPRCard,
  session: renderSessionCard,
  progress: renderProgressCard,
  muscles: renderMuscleCard,
}
