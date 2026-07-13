// Share-card design language: dark technical-monospace stat cards.
//
// Near-black ground, faint blueprint grid, JetBrains Mono for data/meta in
// wide-tracked uppercase, Outfit for hero numbers and names, hairline rules,
// thin color-coded accents keyed to muscle groups. Legibility beats
// decoration: minimum sizes below are chosen for phone-feed viewing.

import { MUSCLE_COLORS } from '../../data/seed.js'

export const FORMATS = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
}

// All cards render at 2× for crispness (2160 / 3840 physical).
export const SCALE = 2

export const INK = {
  bg: '#07090d', // page ground
  panel: '#0b0e14', // slightly lifted panel
  grid: 'rgba(148, 163, 184, 0.055)', // blueprint grid lines
  gridMajor: 'rgba(148, 163, 184, 0.09)',
  hairline: 'rgba(226, 232, 240, 0.14)',
  hairlineFaint: 'rgba(226, 232, 240, 0.08)',
  text: '#f4f6fb', // primary
  dim: '#9aa7ba', // secondary labels
  faint: '#5f6b7e', // tertiary / footers
}

export const ACCENT = {
  brand: '#f97316', // Weight Room orange
  pr: '#fbbf24', // record gold
  pos: '#34d399', // gains
  neg: '#f87171',
}

export function groupColor(group) {
  return MUSCLE_COLORS[group] || MUSCLE_COLORS.Other || ACCENT.brand
}

// Layout constants (in 1080-space units).
export const MARGIN = 84
export const GRID_PITCH = 108 // blueprint grid pitch

// Type helpers — single source for canvas font strings.
import { MONO, SANS } from './fonts.js'

export function mono(size, weight = 500) {
  return `${weight} ${size}px "${MONO}"`
}

export function sans(size, weight = 800) {
  return `${weight} ${size}px "${SANS}"`
}
