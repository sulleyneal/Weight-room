// Builds a shareable workout-summary image (PNG) from a day summary.
//
// The whole summary — header, body muscle map, stats, muscle legend, and
// machine breakdown — is composed as a single SVG string, then rasterized to a
// PNG via an offscreen canvas. No external resources are referenced, so the
// canvas stays untainted and toBlob() works everywhere.

import { figureMarkup, VIEWBOX } from './bodyMap.js'
import { MUSCLE_COLORS } from '../data/seed.js'
import { fmtDate } from '../lib/metrics.js'
import { unitLabel, fmtNumber } from '../lib/units.js'

const W = 1080
const H = 1350

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

function figure(x, y, w, h, view, intensities, label) {
  const cx = x + w / 2
  return `
    <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${VIEWBOX}">${figureMarkup(
      view,
      intensities,
    )}</svg>
    <text x="${cx}" y="${y + h + 32}" text-anchor="middle" font-size="26" font-weight="700" fill="#94a3b8">${label}</text>`
}

function statTile(x, y, w, label, value, accent) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="120" rx="20" fill="#111726" stroke="#26304a"/>
    <text x="${x + w / 2}" y="${y + 66}" text-anchor="middle" font-size="46" font-weight="800" fill="${
      accent || '#f8fafc'
    }">${esc(value)}</text>
    <text x="${x + w / 2}" y="${y + 98}" text-anchor="middle" font-size="22" fill="#94a3b8">${esc(label)}</text>`
}

export function buildSummarySVG(summary) {
  const unit = unitLabel(summary.unit)
  const parts = []

  // Background
  parts.push(`<rect width="${W}" height="${H}" fill="#0b0f17"/>`)
  parts.push(`<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="36" fill="#0d1320" stroke="#1a2235"/>`)

  // Header
  parts.push(
    `<text x="64" y="96" font-size="26" font-weight="800" letter-spacing="3" fill="#f97316">WEIGHT ROOM</text>`,
  )
  parts.push(
    `<text x="64" y="156" font-size="54" font-weight="800" fill="#f8fafc">${esc(fmtDate(summary.date))}</text>`,
  )
  parts.push(`<text x="64" y="196" font-size="28" fill="#94a3b8">Workout summary</text>`)

  // Body figures (hero)
  const figY = 220
  const figH = 420
  const figW = Math.round(200 * (figH / 380)) // preserve aspect (~221)
  const gap = 96
  const groupW = figW * 2 + gap
  const startX = Math.round((W - groupW) / 2)
  parts.push(figure(startX, figY, figW, figH, 'front', summary.intensities, 'Front'))
  parts.push(figure(startX + figW + gap, figY, figW, figH, 'back', summary.intensities, 'Back'))

  let y = figY + figH + 70 // below figure labels

  // Muscles-worked chips
  parts.push(`<text x="64" y="${y}" font-size="30" font-weight="700" fill="#f8fafc">Muscles worked</text>`)
  y += 24
  let cx = 64
  const maxX = W - 64
  for (const g of summary.groups) {
    const color = MUSCLE_COLORS[g.group] || MUSCLE_COLORS.Other
    const label = `${g.group} · ${Math.round(g.share * 100)}%`
    const wbox = Math.round(54 + label.length * 12.5)
    if (cx + wbox > maxX) {
      cx = 64
      y += 56
    }
    parts.push(`<rect x="${cx}" y="${y}" width="${wbox}" height="46" rx="23" fill="${color}22" stroke="${color}"/>`)
    parts.push(`<circle cx="${cx + 25}" cy="${y + 23}" r="8" fill="${color}"/>`)
    parts.push(
      `<text x="${cx + 42}" y="${y + 31}" font-size="24" font-weight="600" fill="${color}">${esc(label)}</text>`,
    )
    cx += wbox + 16
  }
  y += 90

  // Stats row
  const tileGap = 18
  const tileW = Math.round((W - 128 - tileGap * 3) / 4)
  const tiles = [
    ['Machines', String(summary.stats.machines), null],
    ['Sets', String(summary.stats.sets), null],
    [`Volume (${unit})`, fmtNumber(summary.stats.volume), null],
    ['PRs', String(summary.stats.prs), summary.stats.prs > 0 ? '#facc15' : null],
  ]
  tiles.forEach((t, i) => {
    parts.push(statTile(64 + i * (tileW + tileGap), y, tileW, t[0], t[1], t[2]))
  })
  y += 120 + 56

  // Machine breakdown
  parts.push(`<text x="64" y="${y}" font-size="30" font-weight="700" fill="#f8fafc">Machines</text>`)
  y += 20
  const maxRows = 7
  const shown = summary.machines.slice(0, maxRows)
  for (const m of shown) {
    y += 44
    const star = m.isPR ? ` <tspan fill="#facc15">★</tspan>` : ''
    parts.push(
      `<text x="64" y="${y}" font-size="26" font-weight="600" fill="#e2e8f0">${esc(m.name)}${star}</text>`,
    )
    const right = `${Math.round(m.topSetWeight)} ${unit} top · ${m.sets.length} sets · ${fmtNumber(m.volume)} vol`
    parts.push(`<text x="${W - 64}" y="${y}" text-anchor="end" font-size="22" fill="#94a3b8">${esc(right)}</text>`)
    parts.push(`<line x1="64" y1="${y + 14}" x2="${W - 64}" y2="${y + 14}" stroke="#1a2235"/>`)
  }
  if (summary.machines.length > maxRows) {
    y += 40
    parts.push(
      `<text x="64" y="${y}" font-size="22" fill="#64748b">+ ${summary.machines.length - maxRows} more</text>`,
    )
  }

  // Footer
  parts.push(
    `<text x="${W / 2}" y="${H - 44}" text-anchor="middle" font-size="20" fill="#475569">sulleyneal.github.io/Weight-room</text>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${parts.join(
    '',
  )}</svg>`
}

/**
 * Render the summary to PNG and either share it (mobile, when supported) or
 * download it. Returns 'shared' | 'downloaded'.
 */
export async function exportSummaryImage(summary, { preferShare = false } = {}) {
  const svg = buildSummarySVG(summary)
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Could not render the summary image.'))
      img.src = svgUrl
    })

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, W, H)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the image.')
    const filename = `weight-room-summary-${summary.date}.png`

    if (preferShare && typeof navigator !== 'undefined' && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Workout summary' })
        return 'shared'
      }
    }

    const dlUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(dlUrl)
    return 'downloaded'
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
