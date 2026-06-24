import {
  VIEWBOX,
  SILHOUETTE,
  FRONT_REGIONS,
  BACK_REGIONS,
  FRONT_DETAILS,
  BACK_DETAILS,
  BASE_FILL,
  BASE_STROKE,
  DETAIL_STROKE,
  regionStyle,
} from '../lib/bodyMap.js'

function Shape({ s, ...rest }) {
  if (s.t === 'path') return <path d={s.d} {...rest} />
  if (s.t === 'line') return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...rest} />
  const transform = s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined
  return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={transform} {...rest} />
}

function Figure({ view, intensities, label }) {
  const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS
  const details = view === 'back' ? BACK_DETAILS : FRONT_DETAILS
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
        {details.map((s, i) => (
          <Shape
            key={`d${i}`}
            s={s}
            fill="none"
            stroke={DETAIL_STROKE}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        ))}
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
