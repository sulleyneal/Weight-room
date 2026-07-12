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
// Returns the y below the block.
function titleBlock(ctx, moment, y, contentW, { kickerChip = null, kicker, kickerColor, nameSize }) {
  if (kickerChip) {
    const cw = chip(ctx, kickerChip, MARGIN, y, { color: kickerColor, size: 30, pad: 20 })
    metaLabel(ctx, kicker, MARGIN + cw + 26, y + 10, { size: 24, color: kickerColor })
    y += 96
  } else {
    metaLabel(ctx, kicker, MARGIN, y, { size: 24, color: kickerColor })
    y += 72
  }
  const size = fitText(ctx, moment.name, (s) => sans(s, 800), nameSize, 54, contentW)
  ctx.font = sans(size, 800)
  ctx.fillStyle = INK.text
  const lines = wrapTwoLines(ctx, moment.name, contentW)
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

  const nameBottom = titleBlock(ctx, moment, story ? 400 : 268, contentW, {
    kickerChip: 'PR',
    kicker: firstEver ? 'FIRST SESSION ON RECORD' : kindText,
    kickerColor: ACCENT.pr,
    nameSize: story ? 92 : 78,
  })

  // Bottom-anchored zones (upward from the footer). The square format is
  // hero-focused — the e1RM sparkline only appears on the roomier story.
  const showSpark = story && moment.history.length >= 2
  const sparkH = 240 // strip incl. its label (story only)
  const sparkTop = footerTop - sparkH - 44
  const statsY = story ? sparkTop - 132 : footerTop - 108
  // Hero fills the space between the title block and the sub-stats.
  const heroSpace = statsY - 64 - nameBottom
  const heroSize = Math.min(story ? 330 : 290, Math.max(150, heroSpace - 40))

  const weightStr = fmtNum(moment.topWeight)
  const usedHero = fitText(ctx, weightStr, (s) => sans(s, 800), heroSize, 110, contentW - 250)
  ctx.font = sans(usedHero, 800)
  ctx.fillStyle = INK.text
  const heroBaseline = nameBottom + heroSpace / 2 + usedHero * 0.36
  ctx.fillText(weightStr, MARGIN - 4, heroBaseline)
  const weightW = ctx.measureText(weightStr).width
  ctx.font = mono(38, 500)
  ctx.fillStyle = INK.dim
  trackedText(ctx, unit, MARGIN + weightW + 28, heroBaseline - usedHero * 0.56, 4)
  ctx.font = mono(60, 700)
  ctx.fillStyle = ACCENT.brand
  trackedText(ctx, `×${moment.topReps}`, MARGIN + weightW + 28, heroBaseline - 4, 2)

  // Sub-stats row.
  hairline(ctx, MARGIN, statsY - 44, w - MARGIN, INK.hairlineFaint)
  const hasGain = moment.deltaTop != null && moment.deltaTop > 0
  const cols = [
    { label: 'EST. 1RM', value: fmtNum(moment.e1rm) },
    { label: 'PREV BEST', value: moment.prevBestTop != null ? fmtNum(moment.prevBestTop) : '—' },
    hasGain
      ? { label: 'GAIN', chipText: `+${fmtNum(moment.deltaTop)} ${unit}` }
      : { label: 'SESSIONS', value: String(moment.sessionCount) },
  ]
  const colW = contentW / 3
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW
    metaLabel(ctx, c.label, cx, statsY, { size: 22 })
    if (c.chipText) {
      chip(ctx, c.chipText, cx + 2, statsY + 42, { color: ACCENT.pos, size: 24 })
    } else {
      ctx.font = sans(54, 700)
      ctx.fillStyle = INK.text
      ctx.fillText(c.value, cx, statsY + 62)
    }
  })

  // Sparkline strip (story only), anchored above the footer.
  if (showSpark) {
    metaLabel(ctx, `EST. 1RM · LAST ${moment.history.length} SESSIONS`, MARGIN, sparkTop, {
      size: 22,
    })
    sparkline(
      ctx,
      normalizePoints(moment.history.map((p) => p.e1rm)),
      { x: MARGIN, y: sparkTop + 36, w: contentW, h: sparkH - 72 },
      ACCENT.pr,
    )
  } else if (story) {
    metaLabel(ctx, 'NEW MOVEMENT — THE TREND STARTS HERE', MARGIN, sparkTop + sparkH / 2, {
      size: 22,
    })
  }

  footer(ctx, w, h, `${moment.group} · SESSION ${moment.sessionCount}`, moment.unit)
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
  let chipReserve = 0
  if (moment.prCount > 0) {
    ctx.font = mono(26, 700)
    chipReserve = measureTracked(ctx, `${moment.prCount} PRS TODAY`, 3) + 60
  }
  const tSize = fitText(ctx, title, (s) => sans(s, 800), story ? 100 : 84, 48, contentW - chipReserve)
  ctx.font = sans(tSize, 800)
  ctx.fillStyle = INK.text
  ctx.fillText(title, MARGIN, y)
  if (moment.prCount > 0) {
    chip(ctx, `${moment.prCount} PR${moment.prCount > 1 ? 'S' : ''} TODAY`, w - MARGIN - chipReserve + 34, y - tSize * 0.32, {
      color: ACCENT.pr,
      size: 26,
    })
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
  let rowH = compact ? compactH : roomyH
  let maxRows = Math.floor(rowsSpace / rowH)
  const overflow = n > maxRows
  const shown = moment.exercises.slice(0, overflow ? maxRows - 1 : n)
  // Distribute leftover space so the table breathes to the footer.
  rowH = Math.min(rowH * 1.18, rowsSpace / (shown.length + (overflow ? 1 : 0)))

  for (const ex of shown) {
    const mid = y + rowH / 2
    accentTick(ctx, MARGIN, mid - 13, 26, groupColor(ex.group))

    const rightStr = `${fmtNum(ex.topWeight)}×${ex.topReps}`
    ctx.font = mono(compact ? 30 : 32, 600)
    const rightW = measureTracked(ctx, rightStr, 1)
    ctx.font = mono(21, 700)
    const prW = ex.isPR ? measureTracked(ctx, '● PR', 2) + 28 : 0

    const nameSize = compact ? 32 : 36
    const nameMax = contentW - rightW - (compact ? prW : 0) - 70
    ctx.font = sans(nameSize, 600)
    ctx.fillStyle = INK.text
    let name = ex.name
    while (name.length > 2 && ctx.measureText(name).width > nameMax) name = name.slice(0, -1)
    if (name !== ex.name) name = name.trimEnd() + '…'
    const nameY = compact ? mid + nameSize * 0.34 : mid - 4
    ctx.fillText(name, MARGIN + 24, nameY)
    if (!compact) {
      metaLabel(ctx, `${ex.sets} SETS`, MARGIN + 24, mid + 28, { size: 20, color: INK.faint })
    }

    ctx.font = mono(compact ? 30 : 32, 600)
    ctx.fillStyle = INK.text
    const rightY = compact ? mid + 10 : mid - 2
    trackedText(ctx, rightStr, w - MARGIN - (compact ? prW : 0), rightY, 1, 'right')
    if (ex.isPR) {
      ctx.font = mono(21, 700)
      ctx.fillStyle = ACCENT.pr
      trackedText(ctx, '● PR', w - MARGIN, compact ? rightY : mid + 28, 2, 'right')
    }
    hairline(ctx, MARGIN, y + rowH, w - MARGIN, INK.hairlineFaint)
    y += rowH
  }
  if (overflow) {
    metaLabel(ctx, `+ ${n - shown.length} MORE`, MARGIN, y + rowH / 2 + 8, { size: 22 })
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
    { label: 'EST. 1RM NOW', value: fmtNum(moment.currentE1), big: true },
    { label: 'ALL-TIME BEST', value: fmtNum(moment.bestE1) },
    hasDelta
      ? { label: 'CHANGE', chipText: `${up ? '+' : '−'}${fmtNum(Math.abs(moment.deltaE1))} ${unit}`, up }
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
    lineChart(ctx, pts, chartBox, { color, dotColor: ACCENT.pr })
    // Y figures on the right gutter, kept inside the chart's vertical range.
    const maxV = Math.max(...values)
    const minV = Math.min(...values)
    ctx.font = mono(24, 500)
    ctx.fillStyle = INK.dim
    trackedText(ctx, fmtNum(maxV), MARGIN + chartBox.w + 24, chartTop + 26, 1)
    trackedText(ctx, fmtNum(minV), MARGIN + chartBox.w + 24, chartTop + chartH, 1)
    // Axis row: dates + PR legend, one line.
    metaLabel(ctx, fmtShortDate(moment.windowStart), MARGIN, axisY, { size: 22 })
    metaLabel(ctx, fmtShortDate(moment.windowEnd), MARGIN + chartBox.w, axisY, {
      size: 22,
      align: 'right',
    })
    if (moment.series.some((p) => p.pr)) {
      const cx = w / 2 - 60
      ctx.beginPath()
      ctx.arc(cx, axisY - 8, 6, 0, Math.PI * 2)
      ctx.strokeStyle = ACCENT.pr
      ctx.lineWidth = 3
      ctx.fillStyle = INK.bg
      ctx.fill()
      ctx.stroke()
      metaLabel(ctx, 'PR SESSION', cx + 18, axisY, { size: 21 })
    }
  } else {
    ctx.strokeStyle = INK.hairlineFaint
    ctx.lineWidth = 1.5
    for (const fy of [0, 0.5, 1]) {
      ctx.beginPath()
      ctx.moveTo(MARGIN, chartTop + chartH * fy)
      ctx.lineTo(MARGIN + chartBox.w, chartTop + chartH * fy)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(MARGIN + chartBox.w / 2, chartTop + chartH / 2, 8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    metaLabel(ctx, 'FIRST SESSION LOGGED — TREND STARTS HERE', MARGIN, axisY, { size: 22 })
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

export const CARD_RENDERERS = {
  pr: renderPRCard,
  session: renderSessionCard,
  progress: renderProgressCard,
}
