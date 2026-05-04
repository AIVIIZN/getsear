/**
 * Sear POS Service Worker (V5.3.1).
 *
 * Caching policy (per V5.3.1 spec — strict):
 *   - Caches the app shell + critical static assets only.
 *   - NEVER caches /api/* responses (would leak stale order/payment data
 *     across terminals and break realtime invariants).
 *   - NEVER caches Next.js RSC/data requests (same staleness reason).
 *   - Mutations (POST/PUT/PATCH/DELETE) bypass the SW entirely — those go
 *     through src/lib/offline/queue.ts which buffers them in IndexedDB.
 *
 * Hand-written (no Workbox) to make the API-bypass invariant audit-friendly.
 */

const SHELL_CACHE = 'sear-shell-v2'
const STATIC_CACHE = 'sear-static-v2'
const IMAGE_CACHE = 'sear-images-v2'

// Critical assets to precache on install. These are app-shell paths that
// every authenticated user hits on cold start. Keep this list short — the SW
// will runtime-cache other static assets on first use.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // addAll fails atomically if any URL 404s. Use individual adds with
        // catch so a missing icon doesn't kill the install.
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] precache miss for', url, err)
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Drop any cache that doesn't match the current version names.
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('sear-') &&
              name !== SHELL_CACHE &&
              name !== STATIC_CACHE &&
              name !== IMAGE_CACHE)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  )
})

// ─── Fetch routing ─────────────────────────────────────────────────
//
// Strict policy. Any request that doesn't match a known cache rule falls
// through to the network with no cache interaction.

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 1. Mutations — never touch the cache. The IndexedDB queue handles offline.
  if (request.method !== 'GET') return

  // 2. Cross-origin — bypass entirely.
  if (url.origin !== self.location.origin) return

  // 3. /api/* — NEVER CACHE. Always go to network. If offline, fail through
  //    so the caller (e.g. fetch() in a route handler) sees the network error
  //    and falls back to its own offline strategy.
  if (url.pathname.startsWith('/api/')) return

  // 4. Next.js RSC/data — NEVER CACHE (same staleness rationale as /api).
  if (
    url.pathname.includes('/_next/data') ||
    url.searchParams.has('_rsc')
  ) {
    return
  }

  // 5. Navigation requests — network-first, fall back to cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // 6. Static assets — cache-first.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // 7. Images — cache-first with the image cache.
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // 8. Anything else — pass through.
})

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request)
    // Cache successful navigation responses against the shell cache. We key
    // on '/' so an offline navigation to any route returns the shell — the
    // client-side router takes over from there.
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put('/', networkResponse.clone()).catch(() => {})
    }
    return networkResponse
  } catch {
    // Offline — serve the cached shell. If the shell isn't cached, return
    // a synthetic offline page (no API calls embedded).
    const cache = await caches.open(SHELL_CACHE)
    const cached = await cache.match('/')
    if (cached) return cached
    return new Response(
      '<!doctype html><meta charset=utf-8><title>Sear POS — Offline</title>' +
        '<style>body{font-family:system-ui;padding:48px;text-align:center;color:#1d1d1f}</style>' +
        '<h1>Sear POS</h1><p>You are offline. Reconnect to continue.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
    )
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.ok && response.status !== 206) {
      cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch (err) {
    // No cached copy and offline — propagate the error so the page can react.
    throw err
  }
}

// ─── Messaging ─────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Background sync (queue replay trigger) ────────────────────────
//
// When the browser fires a 'sync' event for our tag, ping every open client
// so the page-level replayer (src/lib/offline/sync.ts) can drain the queue.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sear-mutation-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'REPLAY_MUTATION_QUEUE' }))
      })
    )
  }
})

console.log('[SW] Sear POS Service Worker loaded — API responses will NOT be cached.')
