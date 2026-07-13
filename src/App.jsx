import { Component, lazy, Suspense } from 'react'
import { useHashRoute, matchRoute, navigate } from './router.jsx'
import { useStore } from './store/StoreContext.jsx'
import BottomNav from './components/BottomNav.jsx'
import ConnectorSync from './components/ConnectorSync.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MachinesPage from './pages/MachinesPage.jsx'
import LogWorkout from './pages/LogWorkout.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'

// The two chart pages pull in Recharts (~180KB min) — lazy-load them so the
// dashboard and the log-a-set path never pay for it.
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'))
const MachineDetail = lazy(() => import('./pages/MachineDetail.jsx'))
// QA harness for the share cards (unlinked route; also handy on a real phone).
const ShareLab = lazy(() => import('./pages/ShareLab.jsx'))

// A crash in one page must never blank the whole app (the data underneath is
// fine — losing the nav would trap the user on the broken screen). Resets on
// navigation so other pages stay reachable.
class RouteErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Page crashed:', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.path !== this.props.path && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card p-6 text-center">
          <p className="font-bold mb-1">This page hit an error.</p>
          <p className="text-sm text-slate-400 mb-4">
            Your data is safe — this screen just failed to render.
          </p>
          <button
            className="btn-primary mx-auto"
            onClick={() => {
              this.setState({ error: null })
              navigate('/')
            }}
          >
            Back to dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const path = useHashRoute()
  const { state, notice, dismissNotice } = useStore()

  if (!state.loaded) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-500">
        <div className="animate-pulse text-sm">Loading your weight room…</div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <ConnectorSync />
      <main id="app-main" className="flex-1 overflow-y-auto pb-28 safe-top">
        <div className="max-w-lg mx-auto px-4 pt-5">
          {notice && (
            <div
              role="alert"
              className={`card p-3 mb-4 text-sm flex items-start gap-2 ${
                notice.tone === 'error'
                  ? 'border-red-500/50 text-red-300'
                  : notice.tone === 'info'
                    ? 'border-brand-500/50 text-brand-200'
                    : 'border-yellow-500/50 text-yellow-200'
              }`}
            >
              <span className="flex-1">{notice.msg}</span>
              <button
                className="text-slate-400 hover:text-slate-200 font-bold px-1"
                onClick={dismissNotice}
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          )}
          <RouteErrorBoundary path={path}>
            <Suspense
              fallback={
                <div className="py-16 text-center text-slate-500 animate-pulse text-sm">
                  Loading…
                </div>
              }
            >
              {renderRoute(path)}
            </Suspense>
          </RouteErrorBoundary>
        </div>
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
    case '/share-lab':
      return <ShareLab />
    default:
      return <Dashboard />
  }
}
