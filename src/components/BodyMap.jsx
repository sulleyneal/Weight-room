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
  if (s.t === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...rest} />
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...rest} />
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
