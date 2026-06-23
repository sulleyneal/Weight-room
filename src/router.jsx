import { useEffect, useState } from 'react'

// Tiny hash-based router — keeps the app a dependency-free static SPA that works
// from any path (including file://) without server rewrites.

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')

  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const path = hash.replace(/^#/, '') || '/'
  return path
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash !== target) {
    window.location.hash = target
  }
  // Scroll the main content back to top on navigation.
  requestAnimationFrame(() => {
    const main = document.getElementById('app-main')
    if (main) main.scrollTo({ top: 0 })
  })
}

/** Match '/machine/:id' style routes. Returns params or null. */
export function matchRoute(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean)
  const aParts = path.split('/').filter(Boolean)
  if (pParts.length !== aParts.length) return null
  const params = {}
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(aParts[i])
    } else if (pParts[i] !== aParts[i]) {
      return null
    }
  }
  return params
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
