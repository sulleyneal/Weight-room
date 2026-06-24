// Thin line-art front/back anatomy used by the workout summary.
//
// The body is drawn as light contour lines (outline + muscle delineations) with
// no solid fill — a clean anatomical look. Muscle groups that were trained that
// day get a translucent color wash painted *behind* the line art; untrained
// groups draw nothing, so the figure reads like a neutral anatomy chart with
// color only where you worked.
//
// Geometry lives here once (as point data + a Catmull-Rom smoother) so the
// on-screen React preview (BodyMap.jsx) and the exported PNG (summaryImage.js)
// render an identical figure. Coordinates use a 200x400 viewBox, centered x=100.

import { MUSCLE_COLORS } from '../data/seed.js'

export const VIEW_W = 200
export const VIEW_H = 400
export const VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`

export const LINE_STROKE = '#c2cbdb'
export const OUTLINE_STROKE = '#d8e0ec'
export const LINE_WIDTH = 1.3
export const OUTLINE_WIDTH = 1.7

// ---- smoothing + mirroring ----
function bez(pts, closed) {
  const n = pts.length
  if (n < 2) return ''
  const P = closed
    ? (i) => pts[((i % n) + n) % n]
    : (i) => pts[Math.max(0, Math.min(n - 1, i))]
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `
  }
  return d + (closed ? 'Z' : '')
}
const mir = ([x, y]) => [200 - x, y]

// ---- body outline + head ----
const OUTLINE_PTS = [
  [100, 58], [112, 60], [124, 70], [142, 82], [150, 100], [152, 150], [156, 200],
  [154, 218], [146, 230], [140, 216], [138, 178], [134, 150], [126, 100], [120, 130],
  [116, 170], [126, 208], [132, 240], [124, 300], [126, 330], [115, 368], [122, 384],
  [104, 384], [106, 368], [108, 300], [106, 244], [100, 238],
]
export const BODY_OUTLINE = bez([...OUTLINE_PTS, ...OUTLINE_PTS.slice(1, -1).reverse().map(mir)], true)
export const HEAD_PATH =
  'M100 14 C111 14 119 23 119 35 C119 48 111 58 100 58 C89 58 81 48 81 35 C81 23 89 14 100 14 Z'

// ---- muscle contour lines (center drawn as-is; side mirrored to both sides) ----
const FRONT_LINES = {
  center: [[[100, 96], [100, 120], [100, 168]]],
  side: [
    [[100, 95], [110, 87], [119, 85]], // clavicle
    [[119, 86], [122, 96], [123, 104], [116, 116], [100, 118]], // pectoral
    [[123, 90], [138, 85], [148, 100], [147, 116]], // deltoid cap
    [[147, 112], [151, 132], [147, 152]], // biceps
    [[108, 122], [111, 144], [108, 167]], // rectus border
    [[100, 131], [108, 131]],
    [[100, 143], [108, 143]],
    [[100, 155], [108, 155]], // ab rows
    [[100, 185], [112, 173], [117, 168]], // lower-ab V
    [[120, 132], [116, 150], [119, 166]], // oblique
    [[126, 214], [131, 252], [125, 296]], // quad outer
    [[114, 220], [116, 258], [113, 296]], // quad center
    [[103, 218], [105, 258], [104, 296]], // quad inner
    [[104, 300], [114, 305], [123, 299]], // knee
    [[121, 314], [125, 340], [118, 362]], // shin
  ],
}
const BACK_LINES = {
  center: [
    [[100, 78], [100, 130], [100, 182]], // spine
    [[100, 208], [100, 232]], // glute cleft
  ],
  side: [
    [[100, 80], [118, 90], [124, 100]], // trap upper
    [[124, 100], [110, 112], [100, 120]], // trap lower
    [[125, 100], [123, 132], [108, 150], [100, 152]], // lat
    [[123, 90], [138, 85], [148, 100], [147, 114]], // rear delt
    [[147, 112], [151, 132], [147, 152]], // triceps
    [[105, 128], [105, 178]], // erector
    [[100, 206], [116, 207], [123, 219], [115, 232], [100, 231]], // glute
    [[126, 240], [131, 270], [125, 298]], // hamstring outer
    [[104, 242], [105, 272], [104, 298]], // hamstring inner
    [[122, 312], [127, 334], [118, 360]], // calf
  ],
}
function linePaths(set) {
  return [...set.center, ...set.side, ...set.side.map((a) => a.map(mir))].map((pts) =>
    bez(pts, false),
  )
}
export const FRONT_LINE_PATHS = linePaths(FRONT_LINES)
export const BACK_LINE_PATHS = linePaths(BACK_LINES)

// ---- muscle highlight zones (filled behind the lines, only when trained) ----
const delts = [
  { t: 'ellipse', cx: 138, cy: 96, rx: 12, ry: 13 },
  { t: 'ellipse', cx: 62, cy: 96, rx: 12, ry: 13 },
]
const arms = [
  { t: 'ellipse', cx: 149, cy: 130, rx: 8, ry: 22, rot: -4 },
  { t: 'ellipse', cx: 51, cy: 130, rx: 8, ry: 22, rot: 4 },
]

export const FRONT_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Chest',
    shapes: [
      { t: 'ellipse', cx: 112, cy: 106, rx: 14, ry: 12, rot: -8 },
      { t: 'ellipse', cx: 88, cy: 106, rx: 14, ry: 12, rot: 8 },
    ],
  },
  { group: 'Core', shapes: [{ t: 'path', d: 'M90 120 Q100 117 110 120 L108 168 Q100 174 92 168 Z' }] },
  { group: 'Biceps', shapes: arms },
  {
    group: 'Legs',
    shapes: [
      { t: 'ellipse', cx: 116, cy: 255, rx: 15, ry: 44 },
      { t: 'ellipse', cx: 84, cy: 255, rx: 15, ry: 44 },
    ],
  },
]

export const BACK_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Back',
    shapes: [
      { t: 'path', d: 'M100 80 L124 100 L100 124 L76 100 Z' },
      { t: 'path', d: 'M124 100 Q122 134 108 150 L100 150 L100 124 Z' },
      { t: 'path', d: 'M76 100 Q78 134 92 150 L100 150 L100 124 Z' },
    ],
  },
  { group: 'Triceps', shapes: arms },
  { group: 'Core', shapes: [{ t: 'path', d: 'M94 128 Q100 126 106 128 L106 178 Q100 182 94 178 Z' }] },
  {
    group: 'Legs',
    shapes: [
      { t: 'ellipse', cx: 112, cy: 219, rx: 12, ry: 13 },
      { t: 'ellipse', cx: 88, cy: 219, rx: 12, ry: 13 },
      { t: 'ellipse', cx: 116, cy: 270, rx: 14, ry: 40 },
      { t: 'ellipse', cx: 84, cy: 270, rx: 14, ry: 40 },
    ],
  },
]

/**
 * Normalize a map of group -> volume into group -> intensity ratio (0..1),
 * where the most-worked group is 1. Groups with no volume are omitted.
 */
export function computeIntensities(groupVolumes) {
  const max = Math.max(0, ...Object.values(groupVolumes))
  const out = {}
  if (max <= 0) return out
  for (const [group, vol] of Object.entries(groupVolumes)) {
    if (vol > 0) out[group] = vol / max
  }
  return out
}

/** Fill + opacity for a worked region, or null when the group wasn't trained. */
export function regionStyle(group, intensities) {
  const ratio = intensities[group]
  if (ratio == null) return null
  const color = MUSCLE_COLORS[group] || MUSCLE_COLORS.Other
  return { fill: color, opacity: 0.32 + 0.45 * ratio }
}

/** Render a fill shape (ellipse/path) to an SVG element string. */
export function shapeToString(s, attrs = '') {
  if (s.t === 'path') return `<path d="${s.d}" ${attrs}/>`
  const rot = s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : ''
  return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${rot} ${attrs}/>`
}

/**
 * Build the inner SVG markup for one figure (front or back): worked-muscle
 * washes, then the outline + head, then the muscle contour lines on top.
 */
export function figureMarkup(view, intensities) {
  const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS
  const linePathList = view === 'back' ? BACK_LINE_PATHS : FRONT_LINE_PATHS

  const washes = regions
    .map((r) => {
      const style = regionStyle(r.group, intensities)
      if (!style) return ''
      return r.shapes
        .map((s) => shapeToString(s, `fill="${style.fill}" fill-opacity="${style.opacity}"`))
        .join('')
    })
    .join('')

  const body =
    `<path d="${BODY_OUTLINE}" fill="none" stroke="${OUTLINE_STROKE}" stroke-width="${OUTLINE_WIDTH}"/>` +
    `<path d="${HEAD_PATH}" fill="none" stroke="${OUTLINE_STROKE}" stroke-width="${OUTLINE_WIDTH}"/>`

  const lines = linePathList
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`,
    )
    .join('')

  return washes + body + lines
}
