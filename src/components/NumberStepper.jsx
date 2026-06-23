import { IconPlus, IconMinus } from './Icons.jsx'

/**
 * Large-tap-target number stepper for fast set entry.
 * Minus / editable value / plus. Holds long-press auto-repeat via pointer.
 */
export default function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  label,
  suffix,
}) {
  const num = Number(value) || 0

  const clamp = (v) => Math.min(max, Math.max(min, v))
  const dec = () => onChange(clamp(roundToStep(num - step, step)))
  const inc = () => onChange(clamp(roundToStep(num + step, step)))

  return (
    <div className="flex flex-col">
      {label && <span className="label">{label}</span>}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={dec}
          aria-label={`Decrease ${label || 'value'}`}
          className="btn-ghost w-14 text-xl shrink-0"
        >
          <IconMinus size={22} />
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            value={value === '' ? '' : num}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') return onChange('')
              onChange(clamp(Number(v)))
            }}
            onBlur={(e) => {
              if (e.target.value === '') onChange(min)
            }}
            className="input text-center text-2xl font-bold tabular-nums h-full"
          />
          {suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={inc}
          aria-label={`Increase ${label || 'value'}`}
          className="btn-ghost w-14 text-xl shrink-0"
        >
          <IconPlus size={22} />
        </button>
      </div>
    </div>
  )
}

// Snap to the step grid to avoid floating-point drift (e.g. 2.5 increments).
function roundToStep(v, step) {
  if (step >= 1) return Math.round(v / step) * step
  const factor = 1 / step
  return Math.round(v * factor) / factor
}
