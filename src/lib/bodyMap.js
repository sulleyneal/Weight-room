// Stylized-but-anatomical front/back body diagrams used by the workout summary.
//
// Geometry is defined once here as plain shape data so both the on-screen React
// preview (BodyMap.jsx) and the exported PNG (summaryImage.js) render an
// identical figure. Each muscle region is tagged with a muscle group; regions
// whose group was trained that day get colored (shaded by relative volume),
// everything else stays a muted base tone.
//
// The silhouette outline path was produced by smoothing a set of anatomical
// landmark points (Catmull-Rom). See scripts notes; coordinates are in a
// 200x400 viewBox, centered on x=100.

import { MUSCLE_COLORS } from '../data/seed.js'

export const VIEW_W = 200
export const VIEW_H = 400
export const VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`

export const BASE_FILL = '#27314c'
export const BASE_STROKE = '#3a4663'
export const REGION_IDLE = '#33415f'
// Faint contour lines that signal orientation (front vs back).
export const DETAIL_STROKE = '#566590'

const BODY_OUTLINE =
  'M 100 58 C 104 58 108 58 112 60 C 116 62 119 66.3 124 70 C 129 73.7 137.7 77 142 82 ' +
  'C 146.3 87 148.3 88.7 150 100 C 151.7 111.3 151 133.3 152 150 C 153 166.7 155.7 188.7 156 200 ' +
  'C 156.3 211.3 155.7 213 154 218 C 152.3 223 148.3 230.3 146 230 C 143.7 229.7 141.3 224.7 140 216 ' +
  'C 138.7 207.3 139 189 138 178 C 137 167 136 163 134 150 C 132 137 128.3 103.3 126 100 ' +
  'C 123.7 96.7 121.7 118.3 120 130 C 118.3 141.7 115 157 116 170 C 117 183 123.3 196.3 126 208 ' +
  'C 128.7 219.7 132.3 224.7 132 240 C 131.7 255.3 125 285 124 300 C 123 315 127.5 318.7 126 330 ' +
  'C 124.5 341.3 115.7 359 115 368 C 114.3 377 123.8 381.3 122 384 C 120.2 386.7 106.7 386.7 104 384 ' +
  'C 101.3 381.3 105.3 382 106 368 C 106.7 354 108 320.7 108 300 C 108 279.3 107.3 254.3 106 244 ' +
  'C 104.7 233.7 102 238 100 238 C 98 238 95.3 233.7 94 244 C 92.7 254.3 92 279.3 92 300 ' +
  'C 92 320.7 93.3 354 94 368 C 94.7 382 98.7 381.3 96 384 C 93.3 386.7 79.8 386.7 78 384 ' +
  'C 76.2 381.3 85.7 377 85 368 C 84.3 359 75.5 341.3 74 330 C 72.5 318.7 77 315 76 300 ' +
  'C 75 285 68.3 255.3 68 240 C 67.7 224.7 71.3 219.7 74 208 C 76.7 196.3 83 183 84 170 ' +
  'C 85 157 81.7 141.7 80 130 C 78.3 118.3 76.3 96.7 74 100 C 71.7 103.3 68 137 66 150 ' +
  'C 64 163 63 167 62 178 C 61 189 61.3 207.3 60 216 C 58.7 224.7 56.3 229.7 54 230 ' +
  'C 51.7 230.3 47.7 223 46 218 C 44.3 213 43.7 211.3 44 200 C 44.3 188.7 47 166.7 48 150 ' +
  'C 49 133.3 48.3 111.3 50 100 C 51.7 88.7 53.7 87 58 82 C 62.3 77 71 73.7 76 70 ' +
  'C 81 66.3 84 62 88 60 C 92 58 96 58 100 58 Z'

// Shared body silhouette (outline + head), drawn beneath the muscle regions.
export const SILHOUETTE = [
  { t: 'path', d: BODY_OUTLINE },
  { t: 'ellipse', cx: 100, cy: 36, rx: 17, ry: 21 },
]

const delts = [
  { t: 'ellipse', cx: 138, cy: 92, rx: 13, ry: 12 },
  { t: 'ellipse', cx: 62, cy: 92, rx: 13, ry: 12 },
]
const upperArms = [
  { t: 'ellipse', cx: 146, cy: 128, rx: 8, ry: 22, rot: -6 },
  { t: 'ellipse', cx: 54, cy: 128, rx: 8, ry: 22, rot: 6 },
]
const thighs = [
  { t: 'ellipse', cx: 116, cy: 270, rx: 13, ry: 46 },
  { t: 'ellipse', cx: 84, cy: 270, rx: 13, ry: 46 },
]

export const FRONT_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Chest',
    shapes: [
      { t: 'ellipse', cx: 112, cy: 110, rx: 15, ry: 11, rot: -12 },
      { t: 'ellipse', cx: 88, cy: 110, rx: 15, ry: 11, rot: 12 },
    ],
  },
  { group: 'Core', shapes: [{ t: 'path', d: 'M86 130 Q100 126 114 130 L112 172 Q100 178 88 172 Z' }] },
  { group: 'Biceps', shapes: upperArms },
  { group: 'Legs', shapes: thighs },
]

export const BACK_REGIONS = [
  { group: 'Shoulders', shapes: delts },
  {
    group: 'Back',
    shapes: [
      { t: 'path', d: 'M84 84 Q100 78 116 84 L112 104 Q100 100 88 104 Z' },
      {
        t: 'path',
        d: 'M88 106 Q118 112 120 118 L116 165 Q100 150 100 150 Q100 150 84 165 L80 118 Q82 112 88 106 Z',
      },
    ],
  },
  { group: 'Triceps', shapes: upperArms },
  { group: 'Core', shapes: [{ t: 'path', d: 'M88 150 Q100 146 112 150 L110 178 Q100 182 90 178 Z' }] },
  {
    group: 'Legs',
    shapes: [
      { t: 'ellipse', cx: 116, cy: 272, rx: 13, ry: 46 },
      { t: 'ellipse', cx: 84, cy: 272, rx: 13, ry: 46 },
    ],
  },
]

// Orientation cues drawn as thin contour lines on top of the figure so you can
// tell front from back at a glance, independent of which muscles are colored.
export const FRONT_DETAILS = [
  { t: 'path', d: 'M90 84 L100 95 L110 84' }, // clavicle / sternal notch "V"
  { t: 'line', x1: 100, y1: 96, x2: 100, y2: 172 }, // sternum + linea alba
  { t: 'path', d: 'M97 150 Q100 154 103 150' }, // navel
]
export const BACK_DETAILS = [
  { t: 'line', x1: 100, y1: 80, x2: 100, y2: 182 }, // spine
  { t: 'path', d: 'M87 98 Q91 94 92 105' }, // left scapula
  { t: 'path', d: 'M113 98 Q109 94 108 105' }, // right scapula
  { t: 'line', x1: 100, y1: 210, x2: 100, y2: 232 }, // glute cleft
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

/** Fill + opacity for a region given the computed intensities. */
export function regionStyle(group, intensities) {
  const ratio = intensities[group]
  if (ratio == null) return { fill: REGION_IDLE, opacity: 0.5 }
  const color = MUSCLE_COLORS[group] || MUSCLE_COLORS.Other
  return { fill: color, opacity: 0.5 + 0.5 * ratio }
}

/** Render a shape to an SVG element string with extra attributes. */
export function shapeToString(s, attrs = '') {
  if (s.t === 'path') return `<path d="${s.d}" ${attrs}/>`
  if (s.t === 'line') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${attrs}/>`
  const rot = s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : ''
  return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${rot} ${attrs}/>`
}

const DETAIL_ATTRS = `fill="none" stroke="${DETAIL_STROKE}" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.8"`

/**
 * Build the inner SVG markup for one figure (front or back) at native viewBox
 * coordinates. Caller wraps it in an <svg> with the right viewBox/size.
 */
export function figureMarkup(view, intensities) {
  const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS
  const base = SILHOUETTE.map((s) =>
    shapeToString(s, `fill="${BASE_FILL}" stroke="${BASE_STROKE}" stroke-width="1.5"`),
  ).join('')
  const muscles = regions
    .map((r) => {
      const { fill, opacity } = regionStyle(r.group, intensities)
      return r.shapes
        .map((s) => shapeToString(s, `fill="${fill}" fill-opacity="${opacity}"`))
        .join('')
    })
    .join('')
  const details = (view === 'back' ? BACK_DETAILS : FRONT_DETAILS)
    .map((s) => shapeToString(s, DETAIL_ATTRS))
    .join('')
  return base + muscles + details
}
