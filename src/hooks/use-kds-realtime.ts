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

export interface KdsMessage {
  id: string
  from_station_id: string
  from_station_name: string
  to_station_id: string | null
  to_station_name: string | null
  message: string
  message_type: 'quick' | 'custom'
  is_read: boolean
  read_by: string[]
  created_at: string
  location_id: string
}

export interface StationStatusEvent {
  station_id: string
  station_name: string
  failover_active?: boolean
  backup_printer_id?: string | null
  timestamp: string
}

export interface KitchenStatusEvent {
  location_id: string
  kitchen_closed: boolean
  changed_by: string
  changed_at: string
}

/**
 * Subscribe to KDS message broadcasts for a location.
 * Messages are broadcast via Supabase Realtime channel `kds_messages:{location_id}`.
 */
export function useRealtimeKdsMessages(
  locationId: string,
  onMessageReceived: (message: KdsMessage) => void
) {
  const callbackRef = useRef(onMessageReceived)
  callbackRef.current = onMessageReceived
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`kds_messages:${locationId}`)
      .on('broadcast', { event: 'message_received' }, (payload) => {
        callbackRef.current(payload.payload as KdsMessage)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])

  return channelRef
}

/**
 * Subscribe to KDS station status changes for a location.
 * Handles station_online, station_offline, and station_config_updated events.
 */
export function useRealtimeKdsStations(
  locationId: string,
  onStationOnline?: (event: StationStatusEvent) => void,
  onStationOffline?: (event: StationStatusEvent) => void,
  onConfigUpdated?: (event: { station_id: string; updated_at: string }) => void
) {
  const onOnlineRef = useRef(onStationOnline)
  const onOfflineRef = useRef(onStationOffline)
  const onConfigRef = useRef(onConfigUpdated)
  onOnlineRef.current = onStationOnline
  onOfflineRef.current = onStationOffline
  onConfigRef.current = onConfigUpdated

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`kds_stations:${locationId}`)
      .on('broadcast', { event: 'station_online' }, (payload) => {
        onOnlineRef.current?.(payload.payload as StationStatusEvent)
      })
      .on('broadcast', { event: 'station_offline' }, (payload) => {
        onOfflineRef.current?.(payload.payload as StationStatusEvent)
      })
      .on('broadcast', { event: 'station_config_updated' }, (payload) => {
        onConfigRef.current?.(payload.payload as { station_id: string; updated_at: string })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])

  return channelRef
}

/**
 * Subscribe to kitchen status changes (open/closed) for a location.
 * Uses the existing kitchen:{location_id} broadcast channel.
 */
export function useRealtimeKitchenStatus(
  locationId: string,
  onKitchenStatusChange: (event: KitchenStatusEvent) => void
) {
  const callbackRef = useRef(onKitchenStatusChange)
  callbackRef.current = onKitchenStatusChange
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`kitchen:${locationId}`)
      .on('broadcast', { event: 'kitchen_status' }, (payload) => {
        callbackRef.current(payload.payload as KitchenStatusEvent)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])

  return channelRef
}
