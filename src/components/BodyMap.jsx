import {
  VIEWBOX,
  SILHOUETTE,
  FRONT_REGIONS,
  BACK_REGIONS,
  BASE_FILL,
  BASE_STROKE,
  regionStyle,
} from '../lib/bodyMap.js'

function Shape({ s, ...rest }) {
  if (s.t === 'path') return <path d={s.d} {...rest} />
  const transform = s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined
  return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={transform} {...rest} />
}

function Figure({ view, intensities, label }) {
  const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={VIEWBOX} className="w-full h-auto" role="img" aria-label={`${label} body map`}>
        {SILHOUETTE.map((s, i) => (
          <Shape key={`b${i}`} s={s} fill={BASE_FILL} stroke={BASE_STROKE} strokeWidth={1.5} />
        ))}
        {regions.map((r) =>
          r.shapes.map((s, i) => {
            const { fill, opacity } = regionStyle(r.group, intensities)
            return <Shape key={`${r.group}${i}`} s={s} fill={fill} fillOpacity={opacity} />
          }),
        )}
      </svg>
      <span className="text-xs font-semibold text-slate-400 mt-1">{label}</span>
    </div>
  )
}

/** Front + back body diagram with trained muscle groups highlighted. */
export default function BodyMap({ intensities }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Figure view="front" intensities={intensities} label="Front" />
      <Figure view="back" intensities={intensities} label="Back" />
    </div>
  )
}
