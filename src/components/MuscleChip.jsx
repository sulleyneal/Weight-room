import { MUSCLE_COLORS } from '../data/seed.js'

export default function MuscleChip({ group, size = 'sm' }) {
  const color = MUSCLE_COLORS[group] || MUSCLE_COLORS.Other
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <span
      className={`chip ${pad}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span
        className="w-2 h-2 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {group}
    </span>
  )
}
