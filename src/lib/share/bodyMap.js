// Refined line-art front/back anatomy for the muscle-map share card.
//
// Authored as mirrored point data smoothed with Catmull-Rom → SVG path
// strings, rendered via Path2D (Safari-safe). The body is composed of parts
// (head, open-sided neck, torso+legs, hanging arms) so silhouettes stay
// clean; muscle-group washes are separate closed regions CLIPPED to the body
// with knockout strokes between them, so adjacent same-color muscles (trap /
// lat / erector) read as distinct shapes. Coordinates use a 200×400 viewBox,
// centered x=100; right-side regions are mirrored at draw time.

import { MUSCLE_COLORS } from '../../data/seed.js'

export const VIEW_W = 200
export const VIEW_H = 400

export const LINE_STROKE = '#c2cbdb'
export const OUTLINE_STROKE = '#d8e0ec'
export const LINE_WIDTH = 1.1
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
const mirPts = (pts) => pts.map(mir)

// ---- body parts ----
export const HEAD =
  'M100 12 C111 12 118 21 118 33 C118 45 111 54 100 54 C89 54 82 45 82 33 C82 21 89 12 100 12 Z'
// Open-sided neck: two strokes, no seam across chin or chest.
export const NECK_L = bez([[92, 48], [91, 62], [88, 72]], false)
export const NECK_R = bez([[108, 48], [109, 62], [112, 72]], false)

const TORSO_R = [
  [100, 72], [116, 74], [138, 80], [150, 88], [146, 102], [141, 116],
  [136, 140], [131, 164], [132, 182], [135, 198], [134, 216], [131, 242],
  [126, 272], [122, 296], [123, 316], [122, 334], [115, 362], [113, 376],
  [118, 384], [112, 388], [104, 388], [103, 376], [104, 356], [107, 330],
  [105, 306], [107, 278], [110, 252], [104, 230], [100, 226],
]
export const TORSO = bez([...TORSO_R, ...mirPts(TORSO_R.slice(1, -1)).reverse()], true)

const ARM_R_PTS = [
  [139, 84], [152, 82], [162, 92], [165, 106], [166, 124], [167, 146],
  [165, 164], [159, 188], [155, 206], [156, 218], [151, 226], [144, 220],
  [145, 204], [147, 184], [149, 158], [148, 134], [144, 112], [141, 96],
]
export const ARM_R = bez(ARM_R_PTS, true)
export const ARM_L = bez(mirPts(ARM_R_PTS), true)

// ---- interior contour lines ----
const mirLine = (pts) => bez(mirPts(pts), false)
const clavicle = [[100, 86], [112, 82], [126, 82], [136, 86]]
const pecUnder = [[100, 122], [112, 125], [124, 120], [131, 111]]
const rectusBorder = [[112, 132], [114, 152], [112, 176], [108, 192]]
const quadSeamOuter = [[118, 244], [121, 272], [117, 296]]
const quadSeamInner = [[108, 250], [110, 276], [108, 298]]
const knee = [[108, 306], [114, 310], [120, 306]]
const shin = [[116, 322], [118, 344], [112, 364]]

export const FRONT_LINES = [
  bez(clavicle, false), mirLine(clavicle),
  bez([[100, 88], [100, 124]], false),
  bez(pecUnder, false), mirLine(pecUnder),
  bez(rectusBorder, false), mirLine(rectusBorder),
  bez([[92, 144], [108, 144]], false),
  bez([[92, 158], [108, 158]], false),
  bez([[93, 172], [107, 172]], false),
  bez([[88, 196], [100, 210], [112, 196]], false),
  bez(quadSeamOuter, false), mirLine(quadSeamOuter),
  bez(quadSeamInner, false), mirLine(quadSeamInner),
  bez(knee, false), mirLine(knee),
  bez(shin, false), mirLine(shin),
]

const trapLine = [[100, 76], [116, 84], [124, 96]]
const latLine = [[124, 98], [130, 124], [118, 152], [104, 162]]
const erectorSeam = [[106, 130], [106, 176]]
const hamSeam = [[112, 252], [114, 278], [111, 300]]
const calfHead = [[110, 318], [114, 334], [112, 352]]
const triSeam = [[156, 120], [158, 142]]

export const BACK_LINES = [
  bez(trapLine, false), mirLine(trapLine),
  bez([[100, 76], [100, 196]], false),
  bez(latLine, false), mirLine(latLine),
  bez(erectorSeam, false), mirLine(erectorSeam),
  bez([[100, 208], [100, 238]], false),
  bez([[86, 214], [100, 222], [114, 214]], false),
  bez(hamSeam, false), mirLine(hamSeam),
  bez(calfHead, false), mirLine(calfHead),
  bez(triSeam, false), mirLine(triSeam),
]

// ---- muscle-group wash regions (right side; mirrored at draw time) ----
const REGION_PATHS = {
  deltF: bez([[139, 84], [152, 82], [162, 92], [165, 104], [158, 112], [146, 108], [140, 96]], true),
  pec: bez([[102, 92], [124, 90], [135, 99], [132, 112], [120, 120], [104, 118]], true),
  biceps: bez([[147, 112], [158, 114], [164, 128], [161, 146], [151, 148], [146, 130]], true),
  abs: bez([[94, 130], [106, 130], [110, 136], [111, 158], [108, 184], [100, 198], [92, 184], [89, 158], [90, 136]], true),
  quad: bez([[133, 222], [136, 252], [130, 288], [120, 300], [109, 294], [107, 262], [112, 234], [124, 220]], true),
  trap: bez([[100, 74], [118, 82], [122, 92], [110, 104], [100, 110]], true),
  lat: bez([[124, 100], [132, 118], [126, 140], [112, 154], [105, 158], [106, 132], [114, 112]], true),
  tri: bez([[148, 110], [160, 112], [165, 128], [162, 146], [152, 148], [146, 128]], true),
  erector: bez([[102, 120], [108, 122], [108, 180], [102, 184]], true),
  glute: bez([[85, 208], [100, 205], [115, 208], [119, 226], [109, 242], [91, 242], [81, 226]], true),
  ham: bez([[131, 244], [133, 270], [126, 296], [112, 300], [108, 274], [110, 250], [120, 242]], true),
  calfB: bez([[121, 316], [123, 336], [115, 356], [108, 352], [106, 332], [110, 316]], true),
}

// Entries: { group, d, noMirror? } — noMirror for center-line regions.
export const FRONT_REGIONS = [
  { group: 'Shoulders', d: REGION_PATHS.deltF },
  { group: 'Chest', d: REGION_PATHS.pec },
  { group: 'Biceps', d: REGION_PATHS.biceps },
  { group: 'Core', d: REGION_PATHS.abs, noMirror: true },
  { group: 'Legs', d: REGION_PATHS.quad },
]
export const BACK_REGIONS = [
  { group: 'Shoulders', d: REGION_PATHS.deltF },
  { group: 'Back', d: REGION_PATHS.trap },
  { group: 'Back', d: REGION_PATHS.lat },
  { group: 'Back', d: REGION_PATHS.erector },
  { group: 'Triceps', d: REGION_PATHS.tri },
  { group: 'Legs', d: REGION_PATHS.glute },
  { group: 'Legs', d: REGION_PATHS.ham },
  { group: 'Legs', d: REGION_PATHS.calfB },
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
  return { fill: color, opacity: 0.3 + 0.4 * ratio }
}
