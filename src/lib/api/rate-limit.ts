import Redis from 'ioredis'

/**
 * Redis-backed sliding window rate limiter.
 * Works across PM2 cluster workers via shared Redis.
 */

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
    redis.on('error', (err) => {
      console.error('[RateLimit] Redis connection error:', err.message)
    })
  }
  return redis
}

export type RateLimitTier = 'auth' | 'public' | 'standard' | 'bulk' | 'payment'

interface TierConfig {
  limit: number
  windowSeconds: number
}

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  auth: { limit: 5, windowSeconds: 900 },       // 5 per 15 min
  public: { limit: 30, windowSeconds: 60 },      // 30 per 1 min
  standard: { limit: 100, windowSeconds: 60 },   // 100 per 1 min
  bulk: { limit: 10, windowSeconds: 60 },         // 10 per 1 min
  payment: { limit: 20, windowSeconds: 60 },      // 20 per 1 min
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // Unix timestamp in seconds
  retryAfterSeconds: number
}

/**
 * Check rate limit for an identifier (IP or user_id) at a given tier.
 * Uses Redis sliding window counter with MULTI/EXEC for atomicity.
 *
 * Key format: ratelimit:{tier}:{identifier}
 */
export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string
): Promise<RateLimitResult> {
  const config = TIER_CONFIGS[tier]
  const key = `ratelimit:${tier}:${identifier}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - config.windowSeconds

  try {
    const client = getRedis()

    // Sliding window: use a sorted set where score = timestamp
    const pipeline = client.multi()
    // Remove entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart)
    // Count current entries in the window
    pipeline.zcard(key)
    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 10)}`)
    // Set expiry on the key
    pipeline.expire(key, config.windowSeconds)

    const results = await pipeline.exec()

    if (!results) {
      // Redis returned null (connection issue) -- fail open
      return failOpen(config)
    }

    // zcard result is at index 1
    const currentCount = (results[1]?.[1] as number) ?? 0

    const resetAt = now + config.windowSeconds
    const remaining = Math.max(0, config.limit - currentCount - 1)

    if (currentCount >= config.limit) {
      // Over limit -- remove the entry we just added
      // (It was already added, but we should still deny)
      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: config.windowSeconds,
      }
    }

    return {
      allowed: true,
      limit: config.limit,
      remaining,
      resetAt,
      retryAfterSeconds: 0,
    }
  } catch {
    // Redis unavailable -- fail open so legitimate requests still work
    return failOpen(config)
  }
}

function failOpen(config: TierConfig): RateLimitResult {
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit,
    resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
    retryAfterSeconds: 0,
  }
}

/**
 * Apply rate limit headers to a response.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(result.resetAt))
}

/**
 * Get the client IP from a request (respects X-Forwarded-For behind Nginx).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return '127.0.0.1'
}
