// Canvas drawing primitives for the share cards.
//
// Safari-safe by construction: plain Canvas 2D only — no OffscreenCanvas, no
// ctx.filter, no roundRect (manual path below), no ctx.letterSpacing (manual
// per-character tracking below, since Safari ignores the property).

import { INK, ACCENT, GRID_PITCH, MARGIN, mono } from './theme.js'

/** Manual rounded-rect path (ctx.roundRect is missing on older Safari). */
export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Draw text with manual letter-spacing (tracking, in px). Returns the width
 * actually drawn. align: 'left' | 'right' | 'center' (baseline unchanged).
 */
export function trackedText(ctx, text, x, y, tracking = 0, align = 'left') {
  const s = String(text)
  if (!tracking) {
    const prev = ctx.textAlign
    ctx.textAlign = align
    ctx.fillText(s, x, y)
    ctx.textAlign = prev
    return ctx.measureText(s).width
  }
  const total = measureTracked(ctx, s, tracking)
  let cx = x
  if (align === 'right') cx = x - total
  else if (align === 'center') cx = x - total / 2
  const prev = ctx.textAlign
  ctx.textAlign = 'left'
  for (const ch of s) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + tracking
  }
  ctx.textAlign = prev
  return total
}

export function measureTracked(ctx, text, tracking = 0) {
  const s = String(text)
  if (!tracking) return ctx.measureText(s).width
  let w = 0
  let n = 0
  for (const ch of s) {
    w += ctx.measureText(ch).width
    n++
  }
  return w + tracking * Math.max(0, n - 1)
}

/**
 * Fit a single line into maxWidth by stepping the font size down from
 * `size` to `minSize`. Sets ctx.font and returns the size used.
 */
export function fitText(ctx, text, fontFor, size, minSize, maxWidth, tracking = 0) {
  let s = size
  while (s > minSize) {
    ctx.font = fontFor(s)
    if (measureTracked(ctx, text, tracking) <= maxWidth) return s
    s -= 2
  }
  ctx.font = fontFor(minSize)
  return minSize
}

/** Greedy two-line wrap; returns [line] or [line1, line2] (2nd ellipsized). */
export function wrapTwoLines(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const words = String(text).split(/\s+/)
  let line1 = ''
  let i = 0
  for (; i < words.length; i++) {
    const attempt = line1 ? `${line1} ${words[i]}` : words[i]
    if (ctx.measureText(attempt).width > maxWidth && line1) break
    line1 = attempt
  }
  let line2 = words.slice(i).join(' ')
  if (line2 && ctx.measureText(line2).width > maxWidth) {
    while (line2 && ctx.measureText(line2 + '…').width > maxWidth) {
      line2 = line2.slice(0, -1).trimEnd()
    }
    line2 += '…'
  }
  return line2 ? [line1, line2] : [line1]
}

/** Card ground: near-black fill, faint blueprint grid, corner ticks. */
export function drawGround(ctx, w, h) {
  ctx.fillStyle = INK.bg
  ctx.fillRect(0, 0, w, h)

  // Blueprint grid, aligned to the margin frame.
  ctx.lineWidth = 1
  ctx.strokeStyle = INK.grid
  ctx.beginPath()
  for (let x = MARGIN; x <= w - MARGIN + 0.5; x += GRID_PITCH / 2) {
    ctx.moveTo(x, MARGIN)
    ctx.lineTo(x, h - MARGIN)
  }
  for (let y = MARGIN; y <= h - MARGIN + 0.5; y += GRID_PITCH / 2) {
    ctx.moveTo(MARGIN, y)
    ctx.lineTo(w - MARGIN, y)
  }
  ctx.stroke()

  // Registration ticks at the frame corners — quiet technical signature.
  const t = 22
  ctx.strokeStyle = INK.gridMajor
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [MARGIN, MARGIN, 1, 1],
    [w - MARGIN, MARGIN, -1, 1],
    [MARGIN, h - MARGIN, 1, -1],
    [w - MARGIN, h - MARGIN, -1, -1],
  ]) {
    ctx.moveTo(cx + dx * t, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * t)
  }
  ctx.stroke()
}

export function hairline(ctx, x1, y, x2, color = INK.hairline) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
}

/** Uppercase mono label with wide tracking (the card's meta voice). */
export function metaLabel(ctx, text, x, y, { size = 22, color = INK.dim, align = 'left', weight = 500 } = {}) {
  ctx.font = mono(size, weight)
  ctx.fillStyle = color
  return trackedText(ctx, String(text).toUpperCase(), x, y, size * 0.22, align)
}

/** Thin outlined chip (e.g. "PR", "+15 LBS"). Returns chip width. */
export function chip(ctx, text, x, y, { color, size = 24, pad = 14 } = {}) {
  ctx.font = mono(size, 700)
  const tw = measureTracked(ctx, text, size * 0.12)
  const w = tw + pad * 2
  const h = size + pad * 1.15
  roundRectPath(ctx, x, y - h / 2, w, h, h / 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = color
  trackedText(ctx, text, x + pad, y + size * 0.36, size * 0.12)
  return w
}

/** Small solid accent tick (muscle-group coding). */
export function accentTick(ctx, x, y, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 5, h)
}

/**
 * The ONE mark for "PR session" everywhere on the cards: an open gold ring.
 * `core: true` adds a filled center — that variant means "latest session"
 * (gold core when the latest is itself a PR, series-colored otherwise).
 */
export function prRing(ctx, x, y, r = 7, core = false, coreColor = ACCENT.pr) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = INK.bg
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = ACCENT.pr
  ctx.stroke()
  if (core) {
    ctx.beginPath()
    ctx.arc(x, y, Math.max(2.5, r * 0.45), 0, Math.PI * 2)
    ctx.fillStyle = coreColor
    ctx.fill()
  }
}

/** Latest-session marker for a non-PR endpoint: series-colored ring + core. */
function latestRing(ctx, x, y, r, color) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = INK.bg
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, Math.max(2.5, r * 0.45), 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

/**
 * Real data line-chart. points: [{x: 0..1, y: 0..1, flag?: bool}] normalized.
 * One marker system: flagged (PR) sessions get the gold ring; the terminal
 * point is ring+core ("latest"), gold when it is itself a PR, series-colored
 * when not. Draws faint baselines plus the series inside {x, y, w, h}.
 */
export function lineChart(ctx, points, box, { color, baseline = true } = {}) {
  const { x, y, w, h } = box
  if (baseline) {
    ctx.strokeStyle = INK.hairlineFaint
    ctx.lineWidth = 1.5
    for (const fy of [0, 0.5, 1]) {
      ctx.beginPath()
      ctx.moveTo(x, y + h * fy)
      ctx.lineTo(x + w, y + h * fy)
      ctx.stroke()
    }
  }
  if (!points.length) return
  const px = (p) => x + p.x * w
  const py = (p) => y + (1 - p.y) * h

  if (points.length > 1) {
    ctx.strokeStyle = color
    ctx.lineWidth = 3.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    points.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p))))
    ctx.stroke()
  }

  points.forEach((p, i) => {
    const isLast = i === points.length - 1
    if (isLast) {
      if (p.flag) prRing(ctx, px(p), py(p), 9, true)
      else latestRing(ctx, px(p), py(p), 9, color)
    } else if (p.flag) {
      prRing(ctx, px(p), py(p), 7)
    }
  })
}

/** Compact sparkline (no frame); same marker system as lineChart. */
export function sparkline(ctx, points, box, { color, dotColor } = {}) {
  if (points.length < 2) return
  const { x, y, w, h } = box
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  points.forEach((p, i) => {
    const cx = x + p.x * w
    const cy = y + (1 - p.y) * h
    i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy)
  })
  ctx.stroke()
  const last = points[points.length - 1]
  const lx = x + last.x * w
  const ly = y + (1 - last.y) * h
  if (last.flag) prRing(ctx, lx, ly, 8, true, dotColor)
  else latestRing(ctx, lx, ly, 8, color)
}
