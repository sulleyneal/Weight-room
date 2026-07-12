// The share cards. Three purpose-built layouts × two formats, drawn with
// plain Canvas 2D at 2× for crispness. Design language: near-black ground,
// blueprint grid, mono meta voice, huge Outfit numerals, hairline structure,
// muscle-group color coding. Legibility beats decoration — minimum text size
// on any card is 22px in 1080-space (~7px at feed size, mono, high contrast).

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
  return y + 26
}

function footer(ctx, w, h, leftText, unit) {
  const y = h - MARGIN - 18
  hairline(ctx, MARGIN, y - 34, w - MARGIN)
  metaLabel(ctx, leftText, MARGIN, y, { size: 22, color: INK.faint })
  metaLabel(ctx, `UNIT · ${unitLabel(unit)}`, w - MARGIN, y, {
    size: 22,
    color: INK.faint,
    align: 'right',
  })
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

// Normalize a numeric series into 0..1 chart points with padding.
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

// ---- 1. Single-exercise PR card -------------------------------------------

export function renderPRCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2

  drawGround(ctx, w, h)
  header(ctx, w, moment.date)

  const kindText =
    moment.kind === 'both'
      ? 'TOP SET + EST. 1RM RECORD'
      : moment.kind === 'weight'
        ? 'TOP SET RECORD'
        : 'EST. 1RM RECORD'

  // Badge row
  let y = story ? 420 : 292
  const chipW = chip(ctx, 'PR', MARGIN, y, { color: ACCENT.pr, size: 30, pad: 20 })
  metaLabel(ctx, kindText, MARGIN + chipW + 26, y + 10, { size: 24, color: ACCENT.pr })

  // Exercise name (up to two lines, fitted)
  y += story ? 130 : 96
  const nameSize = fitText(ctx, moment.name, (s) => sans(s, 800), story ? 96 : 84, 56, contentW)
  ctx.font = sans(nameSize, 800)
  ctx.fillStyle = INK.text
  const lines = wrapTwoLines(ctx, moment.name, contentW)
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y)
    y += nameSize * 1.08
  }
  metaLabel(ctx, moment.group, MARGIN, y + 4, { size: 24, color: groupColor(moment.group) })
  y += story ? 150 : 96

  // HERO: the top set.
  const heroSize = story ? 300 : 240
  ctx.font = sans(heroSize, 800)
  ctx.fillStyle = INK.text
  const weightStr = fmtNum(moment.topWeight)
  // Fit "360" then annotate; if enormous numbers, shrink.
  const usedHero = fitText(ctx, weightStr, (s) => sans(s, 800), heroSize, 120, contentW - 260)
  ctx.font = sans(usedHero, 800)
  const heroBaseline = y + usedHero * 0.74
  ctx.fillText(weightStr, MARGIN - 4, heroBaseline)
  const weightW = ctx.measureText(weightStr).width
  ctx.font = mono(40, 500)
  ctx.fillStyle = INK.dim
  trackedText(ctx, unitLabel(moment.unit).toUpperCase(), MARGIN + weightW + 26, heroBaseline - usedHero * 0.52, 4)
  ctx.font = mono(56, 700)
  ctx.fillStyle = ACCENT.brand
  trackedText(ctx, `× ${moment.topReps}`, MARGIN + weightW + 26, heroBaseline - 6, 2)

  y = heroBaseline + (story ? 130 : 96)

  // Sub-stats: est 1RM / previous best / the gain (or session count).
  hairline(ctx, MARGIN, y - 56, w - MARGIN, INK.hairlineFaint)
  const hasGain = moment.deltaTop != null && moment.deltaTop > 0
  const cols = [
    { label: 'EST. 1RM', value: fmtNum(moment.e1rm) },
    {
      label: 'PREV BEST',
      value: moment.prevBestTop != null ? fmtNum(moment.prevBestTop) : '—',
    },
    hasGain
      ? { label: 'GAIN', chipText: `+${fmtNum(moment.deltaTop)} ${unitLabel(moment.unit).toUpperCase()}` }
      : { label: 'SESSIONS', value: String(moment.sessionCount) },
  ]
  const colW = contentW / 3
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW
    metaLabel(ctx, c.label, cx, y, { size: 22 })
    if (c.chipText) {
      chip(ctx, c.chipText, cx, y + 44, { color: ACCENT.pos, size: 24 })
    } else {
      ctx.font = sans(54, 700)
      ctx.fillStyle = INK.text
      ctx.fillText(c.value, cx, y + 64)
    }
  })

  y += story ? 220 : 150

  // Sparkline strip: est. 1RM trajectory including today.
  if (moment.history.length >= 2) {
    metaLabel(ctx, `EST. 1RM · LAST ${moment.history.length} SESSIONS`, MARGIN, y, { size: 22 })
    const box = { x: MARGIN, y: y + 26, w: contentW, h: story ? 200 : 130 }
    sparkline(ctx, normalizePoints(moment.history.map((p) => p.e1rm)), box, ACCENT.pr)
  } else {
    metaLabel(ctx, 'FIRST SESSION ON RECORD', MARGIN, y + 20, { size: 24, color: INK.dim })
  }

  footer(ctx, w, h, kindText, moment.unit)
  return canvas
}

// ---- 2. Session summary card ----------------------------------------------

export function renderSessionCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2

  drawGround(ctx, w, h)
  header(ctx, w, moment.date)

  // Title: the program day (or SESSION), huge.
  let y = story ? 400 : 280
  const title = (moment.programName || 'Training Session').toUpperCase()
  const tSize = fitText(ctx, title, (s) => sans(s, 800), story ? 108 : 92, 54, contentW)
  ctx.font = sans(tSize, 800)
  ctx.fillStyle = INK.text
  ctx.fillText(title, MARGIN, y)

  if (moment.prCount > 0) {
    y += story ? 84 : 66
    chip(ctx, `${moment.prCount} PR${moment.prCount > 1 ? 'S' : ''} TODAY`, MARGIN, y, {
      color: ACCENT.pr,
      size: 24,
    })
    y += story ? 96 : 72
  } else {
    y += story ? 120 : 84
  }

  // Stat strip
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
      ctx.moveTo(cx - 24, y - 20)
      ctx.lineTo(cx - 24, y + 66)
      ctx.stroke()
    }
    metaLabel(ctx, s.label, cx, y, { size: 21 })
    const vSize = fitText(ctx, s.value, (n) => sans(n, 700), 58, 34, colW - 48)
    ctx.font = sans(vSize, 700)
    ctx.fillStyle = INK.text
    ctx.fillText(s.value, cx, y + 66)
  })
  y += story ? 170 : 128

  // Exercise table.
  hairline(ctx, MARGIN, y - 40, w - MARGIN)
  metaLabel(ctx, 'EXERCISE', MARGIN, y, { size: 21 })
  metaLabel(ctx, 'TOP SET', w - MARGIN, y, { size: 21, align: 'right' })
  y += 20

  const footerTop = h - MARGIN - 70
  const rowsSpace = footerTop - y - 16
  const maxRows = Math.floor(rowsSpace / 72)
  const shown = moment.exercises.slice(0, moment.exercises.length > maxRows ? maxRows - 1 : maxRows)
  const rowH = Math.min(84, rowsSpace / Math.max(shown.length + (moment.exercises.length > shown.length ? 1 : 0), 1))

  for (const ex of shown) {
    const rowY = y + rowH / 2 + 12
    accentTick(ctx, MARGIN, y + rowH / 2 - 14, 28, groupColor(ex.group))
    // Name, truncated to leave room for the right column.
    const rightStr = `${fmtNum(ex.topWeight)}×${ex.topReps}`
    ctx.font = mono(30, 600)
    const rightW = measureTracked(ctx, rightStr, 1)
    const prPad = ex.isPR ? 74 : 0
    const nameMax = contentW - rightW - prPad - 60
    ctx.font = sans(34, 600)
    ctx.fillStyle = INK.text
    let name = ex.name
    while (name.length > 2 && ctx.measureText(name).width > nameMax) {
      name = name.slice(0, -1)
    }
    if (name !== ex.name) name = name.trimEnd() + '…'
    ctx.fillText(name, MARGIN + 22, rowY)
    metaLabel(ctx, `${ex.sets} SETS`, MARGIN + 22, rowY + 26, { size: 20, color: INK.faint })

    ctx.font = mono(30, 600)
    ctx.fillStyle = INK.text
    trackedText(ctx, rightStr, w - MARGIN, rowY, 1, 'right')
    if (ex.isPR) {
      ctx.font = mono(20, 700)
      ctx.fillStyle = ACCENT.pr
      trackedText(ctx, '● PR', w - MARGIN, rowY + 26, 2, 'right')
    }
    hairline(ctx, MARGIN, y + rowH, w - MARGIN, INK.hairlineFaint)
    y += rowH
  }
  if (moment.exercises.length > shown.length) {
    metaLabel(ctx, `+ ${moment.exercises.length - shown.length} MORE`, MARGIN, y + rowH / 2 + 8, {
      size: 22,
    })
  }

  footer(
    ctx,
    w,
    h,
    moment.durationMin != null ? `${moment.totalSets} SETS · ${moment.durationMin} MIN` : `${moment.totalSets} SETS`,
    moment.unit,
  )
  return canvas
}

// ---- 3. Progress-over-time card --------------------------------------------

export function renderProgressCard(moment, formatKey = 'square') {
  const spec = FORMATS[formatKey]
  const { canvas, ctx } = makeCanvas(spec)
  const { w, h } = spec
  const story = formatKey === 'story'
  const contentW = w - MARGIN * 2
  const color = groupColor(moment.group)

  drawGround(ctx, w, h)
  header(ctx, w, moment.windowEnd)

  let y = story ? 400 : 272
  metaLabel(ctx, 'PROGRESS REPORT', MARGIN, y, { size: 24, color: ACCENT.brand })
  y += story ? 96 : 72
  const nameSize = fitText(ctx, moment.name, (s) => sans(s, 800), story ? 96 : 80, 50, contentW)
  ctx.font = sans(nameSize, 800)
  ctx.fillStyle = INK.text
  const lines = wrapTwoLines(ctx, moment.name, contentW)
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y)
    y += nameSize * 1.08
  }
  metaLabel(ctx, moment.group, MARGIN, y + 2, { size: 24, color })

  y += story ? 130 : 86

  // Current figures row.
  const cols = [
    { label: 'EST. 1RM NOW', value: fmtNum(moment.currentE1), big: true },
    { label: 'ALL-TIME BEST', value: fmtNum(moment.bestE1) },
    { label: 'SESSIONS', value: String(moment.totalSessions) },
  ]
  const colW = contentW / 3
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW
    metaLabel(ctx, c.label, cx, y, { size: 21 })
    ctx.font = sans(c.big ? 76 : 54, c.big ? 800 : 700)
    ctx.fillStyle = c.big ? INK.text : INK.dim
    ctx.fillText(c.value, cx, y + (c.big ? 78 : 64))
  })
  if (moment.deltaE1 != null && Math.abs(moment.deltaE1) > 0.05) {
    const up = moment.deltaE1 > 0
    chip(
      ctx,
      `${up ? '+' : '−'}${fmtNum(Math.abs(moment.deltaE1))} ${unitLabel(moment.unit).toUpperCase()}`,
      MARGIN + colW * 2,
      y + 44,
      { color: up ? ACCENT.pos : ACCENT.neg, size: 22 },
    )
  }
  y += story ? 210 : 140

  // The real chart.
  const chartH = story ? 560 : 330
  const chartBox = { x: MARGIN, y, w: contentW - 120, h: chartH }
  const values = moment.series.map((p) => p.e1rm)
  const pts = normalizePoints(values, moment.series.map((p) => p.pr))

  if (moment.series.length >= 2) {
    lineChart(ctx, pts, chartBox, { color, dotColor: ACCENT.pr })
    // Y-axis figures (max / min), mono, right of the chart.
    const maxV = Math.max(...values)
    const minV = Math.min(...values)
    ctx.font = mono(24, 500)
    ctx.fillStyle = INK.dim
    trackedText(ctx, fmtNum(maxV), MARGIN + chartBox.w + 22, y + 30, 1)
    trackedText(ctx, fmtNum(minV), MARGIN + chartBox.w + 22, y + chartH - 6, 1)
    // X-axis: window dates.
    metaLabel(ctx, fmtShortDate(moment.windowStart), MARGIN, y + chartH + 44, { size: 22 })
    metaLabel(ctx, fmtShortDate(moment.windowEnd), MARGIN + chartBox.w, y + chartH + 44, {
      size: 22,
      align: 'right',
    })
    // Legend: PR dots.
    if (moment.series.some((p) => p.pr)) {
      ctx.beginPath()
      ctx.arc(MARGIN + 8, y + chartH + 84, 6, 0, Math.PI * 2)
      ctx.strokeStyle = ACCENT.pr
      ctx.lineWidth = 3
      ctx.fillStyle = INK.bg
      ctx.fill()
      ctx.stroke()
      metaLabel(ctx, 'PR SESSION', MARGIN + 28, y + chartH + 92, { size: 21 })
    }
  } else {
    // First-time exercise: honest empty state, still composed.
    ctx.strokeStyle = INK.hairlineFaint
    ctx.lineWidth = 1.5
    for (const fy of [0, 0.5, 1]) {
      ctx.beginPath()
      ctx.moveTo(MARGIN, y + chartH * fy)
      ctx.lineTo(MARGIN + chartBox.w, y + chartH * fy)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(MARGIN + chartBox.w / 2, y + chartH / 2, 8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    metaLabel(ctx, 'FIRST SESSION LOGGED — TREND STARTS HERE', MARGIN, y + chartH + 44, {
      size: 22,
    })
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
