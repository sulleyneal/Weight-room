// Stylized front/back body diagrams used by the workout summary.
//
// Geometry is defined once here as plain shape data so both the on-screen React
// preview (BodyMap.jsx) and the exported PNG (summaryImage.js) render an
// identical figure. Each muscle region is tagged with a muscle group; regions
// whose group was trained that day get colored (shaded by relative volume),
// everything else stays a muted base tone.

import { MUSCLE_COLORS } from '../data/seed.js'

export const VIEW_W = 200
export const VIEW_H = 380
export const VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`

export const BASE_FILL = '#27314c'
export const BASE_STROKE = '#3a4663'
export const REGION_IDLE = '#33415f'

// Shared body silhouette (drawn underneath the muscle regions).
export const SILHOUETTE = [
  { t: 'ellipse', cx: 100, cy: 36, rx: 20, ry: 22 }, // head
  { t: 'rect', x: 90, y: 54, w: 20, h: 14, r: 6 }, // neck
  { t: 'rect', x: 60, y: 66, w: 80, h: 116, r: 20 }, // torso
  { t: 'rect', x: 38, y: 72, w: 22, h: 64, r: 11 }, // L upper arm
  { t: 'rect', x: 140, y: 72, w: 22, h: 64, r: 11 }, // R upper arm
  { t: 'rect', x: 36, y: 134, w: 20, h: 66, r: 10 }, // L forearm
  { t: 'rect', x: 144, y: 134, w: 20, h: 66, r: 10 }, // R forearm
  { t: 'rect', x: 66, y: 178, w: 68, h: 28, r: 12 }, // pelvis
  { t: 'rect', x: 68, y: 200, w: 28, h: 92, r: 14 }, // L thigh
  { t: 'rect', x: 104, y: 200, w: 28, h: 92, r: 14 }, // R thigh
  { t: 'rect', x: 70, y: 290, w: 24, h: 74, r: 12 }, // L calf
  { t: 'rect', x: 106, y: 290, w: 24, h: 74, r: 12 }, // R calf
]

const shoulders = [
  { t: 'ellipse', cx: 49, cy: 80, rx: 14, ry: 13 },
  { t: 'ellipse', cx: 151, cy: 80, rx: 14, ry: 13 },
]
const upperArms = [
  { t: 'rect', x: 38, y: 84, w: 22, h: 48, r: 11 },
  { t: 'rect', x: 140, y: 84, w: 22, h: 48, r: 11 },
]
const thighs = [
  { t: 'rect', x: 70, y: 206, w: 24, h: 78, r: 12 },
  { t: 'rect', x: 106, y: 206, w: 24, h: 78, r: 12 },
]

// Muscle regions per view. `group` matches the muscle-group taxonomy.
export const FRONT_REGIONS = [
  { group: 'Shoulders', shapes: shoulders },
  {
    group: 'Chest',
    shapes: [
      { t: 'rect', x: 66, y: 78, w: 32, h: 28, r: 9 },
      { t: 'rect', x: 102, y: 78, w: 32, h: 28, r: 9 },
    ],
  },
  { group: 'Core', shapes: [{ t: 'rect', x: 80, y: 110, w: 40, h: 60, r: 10 }] },
  { group: 'Biceps', shapes: upperArms },
  { group: 'Legs', shapes: thighs },
]

export const BACK_REGIONS = [
  { group: 'Shoulders', shapes: shoulders },
  { group: 'Back', shapes: [{ t: 'rect', x: 66, y: 76, w: 68, h: 50, r: 14 }] },
  { group: 'Triceps', shapes: upperArms },
  { group: 'Core', shapes: [{ t: 'rect', x: 80, y: 128, w: 40, h: 42, r: 10 }] },
  { group: 'Legs', shapes: thighs },
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
  if (ratio == null) return { fill: REGION_IDLE, opacity: 0.55 }
  const color = MUSCLE_COLORS[group] || MUSCLE_COLORS.Other
  return { fill: color, opacity: 0.45 + 0.55 * ratio }
}

/** Render a shape to an SVG element string with extra attributes. */
export function shapeToString(s, attrs = '') {
  if (s.t === 'ellipse') {
    return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`
  }
  return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${attrs}/>`
}

/**
 * Build the inner SVG markup for one figure (front or back) at native viewBox
 * coordinates. Caller wraps it in an <svg>/<g> with the right viewBox/transform.
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
  return base + muscles
}
