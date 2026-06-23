// Unit handling.
//
// IMPORTANT: weights are stored in whatever unit was active when entered. To
// keep things simple and avoid silent rounding drift, the app stores the raw
// number plus the global display unit. When the user toggles lbs<->kg we convert
// the displayed values on the fly rather than rewriting stored data. Stored
// numbers are treated as being in the *current* display unit; toggling the unit
// re-interprets/round-trips for display only.
//
// For a single-user gym log this "display unit" model is the least surprising:
// you pick lbs or kg once and log in that unit. The converters below exist for
// the toggle and for sensible step increments.

export const LB_PER_KG = 2.2046226218

export function lbsToKg(lbs) {
  return lbs / LB_PER_KG
}

export function kgToLbs(kg) {
  return kg * LB_PER_KG
}

// Step increments tuned per unit for the number steppers.
export function weightStep(unit) {
  return unit === 'kg' ? 2.5 : 5
}

export function unitLabel(unit) {
  return unit === 'kg' ? 'kg' : 'lbs'
}

// Format a weight for display with minimal decimals.
export function fmtWeight(value, unit) {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${str} ${unitLabel(unit)}`
}

export function fmtNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat().format(Math.round(value))
}
