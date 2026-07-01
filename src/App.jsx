import { useHashRoute, matchRoute } from './router.jsx'
import { useStore } from './store/StoreContext.jsx'
import BottomNav from './components/BottomNav.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MachinesPage from './pages/MachinesPage.jsx'
import MachineDetail from './pages/MachineDetail.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import LogWorkout from './pages/LogWorkout.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'

export default function App() {
  const path = useHashRoute()
  const { state } = useStore()

  if (!state.loaded) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-500">
        <div className="animate-pulse text-sm">Loading your weight room…</div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <main id="app-main" className="flex-1 overflow-y-auto pb-28 safe-top">
        <div className="max-w-lg mx-auto px-4 pt-5">{renderRoute(path)}</div>
      </main>
      <BottomNav path={path} />
    </div>
  )
}

function renderRoute(path) {
  let m
  if ((m = matchRoute('/machine/:id', path))) return <MachineDetail id={m.id} />
  if ((m = matchRoute('/log/:date', path))) return <LogWorkout date={m.date} />

  switch (path) {
    case '/':
      return <Dashboard />
    case '/machines':
      return <MachinesPage />
    case '/progress':
      return <ProgressPage />
    case '/log':
      return <LogWorkout />
    case '/settings':
      return <SettingsPage />
    case '/records':
      return <RecordsPage />
    default:
      return <Dashboard />
  }
}
