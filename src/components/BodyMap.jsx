import {
  VIEWBOX,
  BODY_OUTLINE,
  HEAD_PATH,
  FRONT_REGIONS,
  BACK_REGIONS,
  FRONT_LINE_PATHS,
  BACK_LINE_PATHS,
  LINE_STROKE,
  OUTLINE_STROKE,
  LINE_WIDTH,
  OUTLINE_WIDTH,
  regionStyle,
} from '../lib/bodyMap.js'

function Wash({ s, fill, opacity }) {
  if (s.t === 'path') return <path d={s.d} fill={fill} fillOpacity={opacity} />
  const transform = s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined
  return (
    <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={transform} fill={fill} fillOpacity={opacity} />
  )
}

function Figure({ view, intensities, label }) {
  const regions = view === 'back' ? BACK_REGIONS : FRONT_REGIONS
  const linePaths = view === 'back' ? BACK_LINE_PATHS : FRONT_LINE_PATHS
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={VIEWBOX} className="w-full h-auto" role="img" aria-label={`${label} body map`}>
        {/* worked-muscle washes (behind the line art) */}
        {regions.map((r) => {
          const style = regionStyle(r.group, intensities)
          if (!style) return null
          return r.shapes.map((s, i) => (
            <Wash key={`${r.group}${i}`} s={s} fill={style.fill} opacity={style.opacity} />
          ))
        })}
        {/* outline + head */}
        <path d={BODY_OUTLINE} fill="none" stroke={OUTLINE_STROKE} strokeWidth={OUTLINE_WIDTH} />
        <path d={HEAD_PATH} fill="none" stroke={OUTLINE_STROKE} strokeWidth={OUTLINE_WIDTH} />
        {/* muscle contour lines */}
        {linePaths.map((d, i) => (
          <path
            key={`l${i}`}
            d={d}
            fill="none"
            stroke={LINE_STROKE}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.9}
          />
        ))}
      </svg>
      <span className="text-xs font-semibold text-slate-400 mt-1">{label}</span>
    </div>
  )
}

/** Front + back line-art body diagram with trained muscle groups washed in. */
export default function BodyMap({ intensities }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Figure view="front" intensities={intensities} label="Front" />
      <Figure view="back" intensities={intensities} label="Back" />
    </div>
  )
}
