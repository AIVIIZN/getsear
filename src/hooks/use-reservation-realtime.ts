'use client'

import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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

export interface ReservationRealtimeData {
  id: string
  status: string
  table_id: string | null
  customer_name: string
  party_size: number
  reservation_date: string
  reservation_time: string
}

/**
 * Subscribe to real-time reservation changes for a location.
 * Fires when reservations are created, updated, or cancelled.
 */
export function useReservationRealtime(
  locationId: string | null,
  onReservationChange: (
    reservation: ReservationRealtimeData,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  ) => void
) {
  const callbackRef = useRef(onReservationChange)
  callbackRef.current = onReservationChange

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`reservations-rt:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `location_id=eq.${locationId}`,
        },
        (payload: PostgresChange) => {
          callbackRef.current(
            (payload.eventType === 'DELETE' ? payload.old : payload.new) as unknown as ReservationRealtimeData,
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
 * Subscribe to real-time waitlist changes for a location.
 */
export function useWaitlistRealtime(
  locationId: string | null,
  onWaitlistChange: (
    entry: Record<string, unknown>,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  ) => void
) {
  const callbackRef = useRef(onWaitlistChange)
  callbackRef.current = onWaitlistChange

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`waitlist-rt:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist_entries',
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
