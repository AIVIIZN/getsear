'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel } from '@supabase/supabase-js'

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EightySixEvent {
  /** Single item toggle */
  item_id?: string
  item_name?: string
  is_86d?: boolean
  /** Cascade event */
  ingredient_id?: string
  ingredient_name?: string
  item_ids?: string[]
  item_names?: string[]
  action?: '86' | 'restore'
  performed_by: string
  timestamp: string
}

interface UseRealtime86Options {
  /** Location ID to subscribe to */
  locationId: string
  /** Called when any menu item's 86 status changes */
  onItemUpdate: (itemId: string, is86d: boolean) => void
  /** Called with a notification message for toast display */
  onNotification?: (message: string) => void
  /** Whether to play an audio notification */
  playSound?: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to Supabase Realtime 86 events for a location.
 *
 * Listens on both:
 * - Broadcast channel `86:{locationId}` for cascade and toggle events
 * - Postgres changes on `menu_items` for direct DB updates
 *
 * Fires onItemUpdate for each affected item so the local menu state
 * can be updated instantly (< 3 seconds propagation target).
 */
export function useRealtime86({
  locationId,
  onItemUpdate,
  onNotification,
  playSound = true,
}: UseRealtime86Options) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onItemUpdateRef = useRef(onItemUpdate)
  const onNotificationRef = useRef(onNotification)

  onItemUpdateRef.current = onItemUpdate
  onNotificationRef.current = onNotification

  const playNotificationSound = useCallback(() => {
    if (!playSound) return
    try {
      // Use Web Audio API for a short alert tone
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880 // A5
      gain.gain.value = 0.15
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not supported, silently skip
    }
  }, [playSound])

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`86:${locationId}`, {
        config: { broadcast: { self: false } },
      })
      // Listen for broadcast events (cascade and toggle)
      .on('broadcast', { event: '86_toggle' }, ({ payload }) => {
        const event = payload as EightySixEvent
        if (event.item_id && event.is_86d !== undefined) {
          onItemUpdateRef.current(event.item_id, event.is_86d)

          const msg = event.is_86d
            ? `${event.item_name ?? 'Item'} has been 86'd`
            : `${event.item_name ?? 'Item'} has been restored`
          onNotificationRef.current?.(msg)
          playNotificationSound()
        }
      })
      .on('broadcast', { event: '86_cascade' }, ({ payload }) => {
        const event = payload as EightySixEvent
        const is86d = event.action === '86'
        const itemIds = event.item_ids ?? []

        for (const itemId of itemIds) {
          onItemUpdateRef.current(itemId, is86d)
        }

        if (itemIds.length > 0) {
          const msg = is86d
            ? `${event.ingredient_name ?? 'Ingredient'} has been 86'd -- ${itemIds.length} items affected`
            : `${event.ingredient_name ?? 'Ingredient'} restored -- ${itemIds.length} items back`
          onNotificationRef.current?.(msg)
          playNotificationSound()
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId, playNotificationSound])

  return channelRef
}
