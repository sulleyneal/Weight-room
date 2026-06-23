import { navigate } from '../router.jsx'
import { IconChevronLeft } from './Icons.jsx'

export default function PageHeader({ title, subtitle, back, action }) {
  return (
    <div className="flex items-start justify-between mb-5 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <button
            onClick={() => navigate(back)}
            aria-label="Back"
            className="btn-ghost p-2 w-10 h-10 shrink-0"
          >
            <IconChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
