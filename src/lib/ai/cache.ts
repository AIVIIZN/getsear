/**
 * AI Response Cache
 *
 * Caches AI responses to avoid redundant API calls.
 * Uses in-memory LRU cache with TTL (Redis optional enhancement).
 *
 * TTL:
 * - Real-time queries (sales today, current shift): 15 minutes
 * - Trend/forecast queries (weekly/monthly): 1 hour
 * - Insights: 6 hours
 */

import crypto from 'crypto'

interface CacheEntry {
  value: string
  expiresAt: number
}

const TTL_REALTIME = 15 * 60 * 1000  // 15 minutes
const TTL_TRENDS = 60 * 60 * 1000     // 1 hour
const TTL_INSIGHTS = 6 * 60 * 60 * 1000 // 6 hours
const MAX_ENTRIES = 500

// In-memory cache (per process)
const cache = new Map<string, CacheEntry>()

function generateCacheKey(params: {
  orgId: string
  locationId: string
  query: string
}): string {
  const raw = `${params.orgId}:${params.locationId}:${params.query}`
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * Determine TTL based on query content.
 */
function determineTTL(query: string): number {
  const q = query.toLowerCase()

  // Trend/historical queries get longer TTL
  if (
    q.includes('trend') ||
    q.includes('forecast') ||
    q.includes('predict') ||
    q.includes('last month') ||
    q.includes('last year') ||
    q.includes('13 week') ||
    q.includes('quarterly')
  ) {
    return TTL_TRENDS
  }

  // Insight queries
  if (q.includes('insight')) {
    return TTL_INSIGHTS
  }

  // Default: real-time
  return TTL_REALTIME
}

/**
 * Evict expired entries and enforce max size.
 */
function evictExpired(): void {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key)
    }
  }

  // If still over limit, remove oldest
  if (cache.size > MAX_ENTRIES) {
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES)
    for (const [key] of toRemove) {
      cache.delete(key)
    }
  }
}

/**
 * Get a cached response.
 */
export function getCachedResponse(params: {
  orgId: string
  locationId: string
  query: string
}): string | null {
  const key = generateCacheKey(params)
  const entry = cache.get(key)

  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }

  return entry.value
}

/**
 * Cache a response.
 */
export function setCachedResponse(params: {
  orgId: string
  locationId: string
  query: string
  response: string
  ttlMs?: number
}): void {
  evictExpired()

  const key = generateCacheKey(params)
  const ttl = params.ttlMs ?? determineTTL(params.query)

  cache.set(key, {
    value: params.response,
    expiresAt: Date.now() + ttl,
  })
}

/**
 * Clear all cached entries for an org/location.
 */
export function clearCache(orgId: string, locationId?: string): void {
  // Since we use hashed keys, we need to clear everything
  // In a Redis implementation, we'd use key patterns
  cache.clear()
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { entries: number; maxEntries: number } {
  evictExpired()
  return { entries: cache.size, maxEntries: MAX_ENTRIES }
}
