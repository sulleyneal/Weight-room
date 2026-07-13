import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { StoreProvider } from './store/StoreContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)

// Register the service worker for offline use (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A new deploy ships a byte-different sw.js (its cache name carries the build
  // id). When that worker activates and claims this page, reload once so the
  // fresh HTML/JS actually take over — otherwise the tab keeps running the old
  // bundle until the next manual relaunch. Guarded against reload loops, and
  // skipped on the very first registration (no prior controller) so a clean
  // first visit doesn't bounce.
  let reloading = false
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return
    reloading = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
