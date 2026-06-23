import { navigate } from '../router.jsx'
import { IconHome, IconDumbbell, IconPlus, IconChart, IconSettings } from './Icons.jsx'

const items = [
  { path: '/', label: 'Home', icon: IconHome, match: (p) => p === '/' },
  {
    path: '/machines',
    label: 'Machines',
    icon: IconDumbbell,
    match: (p) => p.startsWith('/machines') || p.startsWith('/machine/'),
  },
  { path: '/log', label: 'Log', icon: IconPlus, primary: true, match: (p) => p.startsWith('/log') },
  { path: '/progress', label: 'Progress', icon: IconChart, match: (p) => p.startsWith('/progress') },
  { path: '/settings', label: 'Settings', icon: IconSettings, match: (p) => p.startsWith('/settings') },
]

export default function BottomNav({ path }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-ink-800/95 backdrop-blur border-t border-ink-700 safe-bottom">
      <div className="max-w-lg mx-auto grid grid-cols-5 px-2 pt-1.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.match(path)
          if (item.primary) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-4"
                aria-label={item.label}
              >
                <span className="w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 active:scale-95 transition">
                  <Icon size={28} />
                </span>
              </button>
            )
          }
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-1.5 gap-0.5 ${
                active ? 'text-brand-400' : 'text-slate-400'
              }`}
              aria-label={item.label}
            >
              <Icon size={22} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
