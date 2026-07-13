// Thin line-art front/back anatomy for the muscle-map share card.
//
// The body is drawn as light contour lines (outline + muscle delineations)
// with no solid fill; muscle groups trained that day get a translucent color
// wash painted behind the line art. Geometry is point data + a Catmull-Rom
// smoother producing SVG path strings, rendered onto the card canvas via
// Path2D (Safari-safe). Coordinates use a 200x400 viewBox, centered x=100.

import { MUSCLE_COLORS } from '../../data/seed.js'

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
  [100, 56], [113, 58], [126, 66], [148, 80], [160, 102], [160, 152], [159, 200],
  [156, 218], [147, 231], [141, 217], [139, 178], [135, 150], [129, 99], [122, 132],
  [114, 172], [126, 206], [137, 244], [125, 300], [130, 332], [116, 370], [123, 386],
  [104, 386], [106, 370], [108, 300], [104, 246], [100, 240],
]
export const BODY_OUTLINE = bez([...OUTLINE_PTS, ...OUTLINE_PTS.slice(1, -1).reverse().map(mir)], true)
export const HEAD_PATH =
  'M100 14 C111 14 119 23 119 35 C119 48 111 58 100 58 C89 58 81 48 81 35 C81 23 89 14 100 14 Z'

// ---- muscle contour lines (center drawn as-is; side mirrored to both sides) ----
const FRONT_LINES = {
  center: [[[100, 96], [100, 122], [100, 172]]],
  side: [
    [[100, 93], [111, 85], [122, 84]], // clavicle
    [[122, 84], [126, 96], [127, 106], [117, 118], [100, 120]], // pectoral
    [[124, 88], [142, 82], [158, 102], [157, 120]], // deltoid cap
    [[157, 116], [161, 140], [156, 160]], // biceps
    [[109, 124], [112, 148], [109, 170]], // rectus border
    [[100, 134], [109, 134]],
    [[100, 147], [109, 147]],
    [[100, 159], [109, 159]], // ab rows
    [[100, 188], [113, 175], [119, 170]], // lower-ab V
    [[121, 134], [117, 154], [121, 170]], // oblique
    [[129, 216], [134, 256], [127, 298]], // quad outer
    [[115, 222], [117, 262], [114, 300]], // quad center
    [[104, 220], [106, 262], [105, 300]], // quad inner
    [[105, 302], [115, 307], [125, 301]], // knee
    [[123, 316], [128, 344], [119, 366]], // shin
  ],
}
const BACK_LINES = {
  center: [
    [[100, 78], [100, 132], [100, 184]], // spine
    [[100, 208], [100, 234]], // glute cleft
  ],
  side: [
    [[100, 78], [120, 90], [127, 102]], // trap upper
    [[127, 102], [112, 114], [100, 122]], // trap lower
    [[128, 102], [126, 136], [110, 154], [100, 156]], // lat
    [[124, 88], [142, 82], [158, 102], [157, 118]], // rear delt
    [[157, 116], [161, 140], [156, 160]], // triceps
    [[106, 130], [106, 182]], // erector
    [[100, 206], [118, 208], [126, 221], [117, 234], [100, 233]], // glute
    [[129, 242], [134, 274], [127, 300]], // hamstring outer
    [[104, 244], [106, 274], [105, 300]], // hamstring inner
    [[123, 314], [129, 338], [119, 362]], // calf
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
  { t: 'ellipse', cx: 146, cy: 100, rx: 14, ry: 14 },
  { t: 'ellipse', cx: 54, cy: 100, rx: 14, ry: 14 },
]
const arms = [
  { t: 'ellipse', cx: 158, cy: 136, rx: 9, ry: 24, rot: -4 },
  { t: 'ellipse', cx: 42, cy: 136, rx: 9, ry: 24, rot: 4 },
]

export const FRONT_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Chest',
    shapes: [
      { t: 'ellipse', cx: 114, cy: 108, rx: 16, ry: 13, rot: -8 },
      { t: 'ellipse', cx: 86, cy: 108, rx: 16, ry: 13, rot: 8 },
    ],
  },
  { group: 'Core', shapes: [{ t: 'path', d: 'M89 122 Q100 119 111 122 L109 170 Q100 176 91 170 Z' }] },
  { group: 'Biceps', shapes: arms },
  {
    group: 'Legs',
    shapes: [
      { t: 'ellipse', cx: 118, cy: 258, rx: 17, ry: 46 },
      { t: 'ellipse', cx: 82, cy: 258, rx: 17, ry: 46 },
    ],
  },
]

export const BACK_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Back',
    shapes: [
      { t: 'path', d: 'M100 78 L128 102 L100 126 L72 102 Z' },
      { t: 'path', d: 'M128 102 Q126 138 110 156 L100 156 L100 126 Z' },
      { t: 'path', d: 'M72 102 Q74 138 90 156 L100 156 L100 126 Z' },
    ],
  },
  { group: 'Triceps', shapes: arms },
  { group: 'Core', shapes: [{ t: 'path', d: 'M93 130 Q100 128 107 130 L107 182 Q100 186 93 182 Z' }] },
  {
    group: 'Legs',
    shapes: [
      { t: 'ellipse', cx: 114, cy: 221, rx: 13, ry: 14 },
      { t: 'ellipse', cx: 86, cy: 221, rx: 13, ry: 14 },
      { t: 'ellipse', cx: 118, cy: 272, rx: 16, ry: 42 },
      { t: 'ellipse', cx: 82, cy: 272, rx: 16, ry: 42 },
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
