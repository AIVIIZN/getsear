/**
 * Service Worker configuration constants.
 * Used by both the SW registration and the SW itself.
 */

/** App shell routes to precache for offline navigation */
export const APP_SHELL_ROUTES = [
  '/',
  '/orders',
  '/tables',
  '/kds',
  '/menu',
  '/staff',
  '/reports',
  '/settings',
] as const

/** API routes that should use Network-First strategy */
export const NETWORK_FIRST_PATTERNS = [
  '/api/',
] as const

/** Static asset patterns that should use Cache-First strategy */
export const CACHE_FIRST_PATTERNS = [
  '/_next/static/',
  '/fonts/',
  '/icons/',
  '/images/',
] as const

/** Cache names */
export const CACHE_NAMES = {
  /** Precached app shell (HTML, CSS, JS bundles) */
  appShell: 'sear-app-shell-v1',
  /** Runtime cached API responses */
  api: 'sear-api-v1',
  /** Static assets (images, fonts, icons) */
  static: 'sear-static-v1',
} as const

/** Max age for cached API responses (5 minutes) */
export const API_CACHE_MAX_AGE_S = 300

/** Max entries in the API cache */
export const API_CACHE_MAX_ENTRIES = 100

/** Max entries in the static cache */
export const STATIC_CACHE_MAX_ENTRIES = 200
