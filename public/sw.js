/**
 * Sear POS Service Worker
 * Hand-written using Workbox libraries from CDN.
 * Handles: precaching app shell, runtime caching, navigation fallback,
 * background sync trigger, update notification.
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

// Configure Workbox
workbox.setConfig({ debug: false })

const { precaching, routing, strategies, expiration, cacheableResponse } = workbox

// ─── Cache names ────────────────────────────────────────────────────
const APP_SHELL_CACHE = 'sear-app-shell-v1'
const API_CACHE = 'sear-api-v1'
const STATIC_CACHE = 'sear-static-v1'

// ─── Precache the app shell ─────────────────────────────────────────
// These are injected at build time or manually listed.
// For Next.js App Router, we cache the navigation shell.
precaching.precacheAndRoute([
  { url: '/', revision: Date.now().toString() },
])

// ─── Navigation requests → serve cached app shell ───────────────────
// For any navigation request (user types URL or clicks link),
// try network first, fall back to cached shell.
routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new strategies.NetworkFirst({
    cacheName: APP_SHELL_CACHE,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
    networkTimeoutSeconds: 3,
  })
)

// ─── API requests → Network-First ───────────────────────────────────
// Try server, fall back to cached response if offline.
routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new strategies.NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
    networkTimeoutSeconds: 5,
  })
)

// ─── Next.js static assets → Cache-First ────────────────────────────
routing.registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/'),
  new strategies.CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// ─── Images → Cache-First with longer expiry ────────────────────────
routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new strategies.CacheFirst({
    cacheName: 'sear-images-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
)

// ─── Next.js data/RSC requests → Network-First ─────────────────────
routing.registerRoute(
  ({ url }) =>
    url.pathname.includes('_next/data') ||
    url.searchParams.has('_rsc'),
  new strategies.NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60,
      }),
    ],
    networkTimeoutSeconds: 3,
  })
)

// ─── Skip waiting on message ────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Claim clients immediately ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all open tabs
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith('sear-') &&
                name !== APP_SHELL_CACHE &&
                name !== API_CACHE &&
                name !== STATIC_CACHE &&
                name !== 'sear-images-v1'
              )
            })
            .map((name) => caches.delete(name))
        )
      }),
    ])
  )
})

// ─── Background sync (if supported) ────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sear-sync-queue') {
    event.waitUntil(
      // Notify the client to process the sync queue
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'PROCESS_SYNC_QUEUE' })
        })
      })
    )
  }
})

// ─── Notify clients about updates ───────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_UPDATE_AVAILABLE' })
      })
    })
  )
})

console.log('[SW] Sear POS Service Worker loaded')
