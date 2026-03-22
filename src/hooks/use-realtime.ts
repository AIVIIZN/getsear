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
          onOrderChange(
            payload.eventType === 'DELETE' ? payload.old : payload.new,
            payload.eventType
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId, onOrderChange])
}

/**
 * Subscribe to real-time KDS ticket events for a station.
 */
export function useRealtimeKds(
  stationId: string,
  onTicketChange: (ticket: Record<string, unknown>, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) {
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
          onTicketChange(
            payload.eventType === 'DELETE' ? payload.old : payload.new,
            payload.eventType
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [stationId, onTicketChange])
}

/**
 * Subscribe to table status changes for a floor plan.
 */
export function useRealtimeTables(
  floorPlanId: string,
  onTableChange: (table: Record<string, unknown>) => void
) {
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
          onTableChange(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [floorPlanId, onTableChange])
}
