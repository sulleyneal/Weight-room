// Service worker for offline use at the gym (spotty signal).
//
// Strategy:
//  - Navigations: network-first (so a new deploy is picked up when online),
//    falling back to the cached app shell when offline.
//  - Other same-origin GETs (hashed JS/CSS/icons): stale-while-revalidate —
//    serve from cache instantly, refresh in the background.
// All data lives in localStorage/IndexedDB, so nothing here touches user data.
//
// The cache name carries a per-build id (stamped in at build time from the
// content-hashed asset names). Every deploy that changes assets therefore
// ships a byte-different sw.js, so browsers — notably iOS home-screen PWAs —
// install the new worker, whose `activate` deletes the previous cache. Without
// this, a fixed cache name lets a stale cache shadow a fresh deploy forever.

const CACHE = 'weight-room-__BUILD_ID__'
const CORE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
