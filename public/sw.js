// ────────────────────────────────────────────────────────────────
// Service worker — cache static assets, network-first for HTML
// ────────────────────────────────────────────────────────────────
const CACHE = 'minal-v1'
const PRECACHE = ['/', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Skip same-origin only — let cross-origin (Supabase, etc.) go straight to network
  if (url.origin !== self.location.origin) return

  // Never cache API, auth, admin, or checkout
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/settings/') ||
    url.pathname.startsWith('/account/') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/cart')
  ) {
    return
  }

  // HTML → network-first, fall back to cache, fall back to homepage
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match('/'))
        ),
    )
    return
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (res.ok && res.status < 400) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
    }),
  )
})