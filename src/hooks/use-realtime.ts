'use client'

import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel } from '@supabase/supabase-js'

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type PostgresChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

/**
 * Subscribe to real-time changes on a Supabase table.
 * Automatically cleans up on unmount.
 */
export function useRealtimeTable(
  table: string,
  filter: string | undefined,
  onInsert?: (record: Record<string, unknown>) => void,
  onUpdate?: (record: Record<string, unknown>) => void,
  onDelete?: (record: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    const channelName = `${table}:${filter ?? 'all'}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload: PostgresChange) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new)
              break
            case 'UPDATE':
              onUpdate?.(payload.new)
              break
            case 'DELETE':
              onDelete?.(payload.old)
              break
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, onInsert, onUpdate, onDelete])

  return channelRef
}

/**
 * Subscribe to real-time order changes for a specific location.
 */
export function useRealtimeOrders(
  locationId: string,
  onOrderChange: (order: Record<string, unknown>, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) {
  const callbackRef = useRef(onOrderChange)
  callbackRef.current = onOrderChange

  useEffect(() => {
    const supabase = getSupabase()

    const channel = supabase
      .channel(`orders:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `location_id=eq.${locationId}`,
        },
        (payload: PostgresChange) => {
          callbackRef.current(
            payload.eventType === 'DELETE' ? payload.old : payload.new,
            payload.eventType
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])
}

/**
 * Subscribe to real-time KDS ticket events for a station.
 */
export function useRealtimeKds(
  stationId: string,
  onTicketChange: (ticket: Record<string, unknown>, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) {
  const callbackRef = useRef(onTicketChange)
  callbackRef.current = onTicketChange

  useEffect(() => {
    const supabase = getSupabase()

    const channel = supabase
      .channel(`kds:${stationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kds_ticket_events',
          filter: `station_id=eq.${stationId}`,
        },
        (payload: PostgresChange) => {
          callbackRef.current(
            payload.eventType === 'DELETE' ? payload.old : payload.new,
            payload.eventType
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [stationId])
}

/**
 * Subscribe to table status changes for a floor plan.
 */
export function useRealtimeTables(
  floorPlanId: string,
  onTableChange: (table: Record<string, unknown>) => void
) {
  const callbackRef = useRef(onTableChange)
  callbackRef.current = onTableChange

  useEffect(() => {
    const supabase = getSupabase()

    const channel = supabase
      .channel(`tables:${floorPlanId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
          filter: `floor_plan_id=eq.${floorPlanId}`,
        },
        (payload: PostgresChange) => {
          callbackRef.current(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [floorPlanId])
}

/**
 * Subscribe to menu item 86 status changes.
 * When an item is 86'd or un-86'd, the callback fires with the updated item.
 * Use this on the POS to grey out unavailable items in real time.
 */
export function useRealtime86(
  orgId: string,
  onItemUpdate: (item: { id: string; is_86d: boolean; name: string }) => void
) {
  const callbackRef = useRef(onItemUpdate)
  callbackRef.current = onItemUpdate

  useEffect(() => {
    if (!orgId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`menu-86:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
          filter: `org_id=eq.${orgId}`,
        },
        (payload: PostgresChange) => {
          const item = payload.new as { id: string; is_86d: boolean; name: string }
          if (item.id) {
            callbackRef.current(item)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])
}
