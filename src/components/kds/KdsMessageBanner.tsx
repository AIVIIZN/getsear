'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KdsMessage } from '@/hooks/use-kds-realtime'

const MAX_VISIBLE_BANNERS = 3
const AUTO_DISMISS_MS = 10000 // 10 seconds

interface BannerMessage extends KdsMessage {
  _bannerId: string
  _createdAt: number
}

interface KdsMessageBannerProps {
  stationId: string | null
  onDismiss?: (messageId: string) => void
}

/**
 * Temporary banner at top of KDS screen for incoming messages.
 * Auto-dismisses after 10 seconds. Stacks if multiple arrive (max 3 visible).
 *
 * This component manages its own queue of incoming messages.
 * Messages are added via the addMessage static method or through
 * the useKdsMessageBanner hook.
 */
export function KdsMessageBanner({ stationId, onDismiss }: KdsMessageBannerProps) {
  const [banners, setBanners] = useState<BannerMessage[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissBanner = useCallback(
    (bannerId: string) => {
      setBanners((prev) => prev.filter((b) => b._bannerId !== bannerId))
      const timer = timersRef.current.get(bannerId)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(bannerId)
      }
      onDismiss?.(bannerId)
    },
    [onDismiss]
  )

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  // Exposed method to add a message banner
  const addBanner = useCallback(
    (message: KdsMessage) => {
      // Don't show banners for messages sent by this station
      if (message.from_station_id === stationId) return

      // Don't show if message is for a different station (non-broadcast)
      if (message.to_station_id !== null && message.to_station_id !== stationId) return

      const bannerId = message.id || `banner_${Date.now()}_${Math.random()}`
      const bannerMsg: BannerMessage = {
        ...message,
        _bannerId: bannerId,
        _createdAt: Date.now(),
      }

      setBanners((prev) => {
        // Keep only the most recent MAX_VISIBLE_BANNERS
        const updated = [...prev, bannerMsg]
        if (updated.length > MAX_VISIBLE_BANNERS) {
          const removed = updated.shift()
          if (removed) {
            const timer = timersRef.current.get(removed._bannerId)
            if (timer) {
              clearTimeout(timer)
              timersRef.current.delete(removed._bannerId)
            }
          }
        }
        return updated
      })

      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        dismissBanner(bannerId)
      }, AUTO_DISMISS_MS)
      timersRef.current.set(bannerId, timer)
    },
    [stationId, dismissBanner]
  )

  // Expose addBanner via ref so parent can call it
  // We store it on the component instance via a global registry keyed by stationId
  useEffect(() => {
    if (stationId) {
      bannerRegistry.set(stationId, addBanner)
      return () => {
        bannerRegistry.delete(stationId)
      }
    }
  }, [stationId, addBanner])

  if (banners.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-[48px] z-40 flex flex-col gap-1.5 px-4 pt-2">
      {banners.map((banner) => (
        <div
          key={banner._bannerId}
          className={cn(
            'flex items-center gap-3 rounded-xl bg-[var(--color-kds-surface-active)] px-4 py-3 shadow-lg',
            'border border-[var(--color-kds-message-border)] animate-slide-in-top',
            'cursor-pointer transition-opacity hover:opacity-90'
          )}
          onClick={() => dismissBanner(banner._bannerId)}
          role="alert"
        >
          <MessageSquare className="h-5 w-5 flex-shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-primary)]">
                {banner.from_station_name}
              </span>
              {banner.to_station_id === null && (
                <span className="rounded bg-[var(--color-kds-surface-pressed)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--color-kds-text-muted)]">
                  Broadcast
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-white truncate">
              {banner.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismissBanner(banner._bannerId)
            }}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-kds-text-muted)] hover:bg-[var(--color-kds-surface-hover)] hover:text-white"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * Global registry so parent components can trigger banners
 * without needing to pass messages through props.
 */
const bannerRegistry = new Map<string, (message: KdsMessage) => void>()

/**
 * Show a message banner on a specific station's KDS screen.
 * Call this from realtime event handlers.
 */
export function showKdsBanner(stationId: string, message: KdsMessage): void {
  const addBanner = bannerRegistry.get(stationId)
  if (addBanner) {
    addBanner(message)
  }
}
