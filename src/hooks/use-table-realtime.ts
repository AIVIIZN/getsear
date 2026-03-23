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

type PostgresChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export interface TableRealtimeData {
  id: string
  status: string
  guest_count: number
  seated_at: string | null
  current_order_id: string | null
  current_server_id: string | null
  current_server_name: string | null
  section_color: string | null
  assigned_server_id: string | null
  pos_x: number
  pos_y: number
}

/**
 * Subscribe to real-time table status changes for a location.
 * Returns updated table data whenever a table changes status,
 * gets a section assignment, or any other field updates.
 */
export function useTableRealtime(
  locationId: string | null,
  onTableUpdate: (table: TableRealtimeData) => void,
  onTableInsert?: (table: TableRealtimeData) => void,
  onTableDelete?: (tableId: string) => void
) {
  const callbackRef = useRef(onTableUpdate)
  callbackRef.current = onTableUpdate

  const insertRef = useRef(onTableInsert)
  insertRef.current = onTableInsert

  const deleteRef = useRef(onTableDelete)
  deleteRef.current = onTableDelete

  useEffect(() => {
    if (!locationId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`tables-rt:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `location_id=eq.${locationId}`,
        },
        (payload: PostgresChange) => {
          switch (payload.eventType) {
            case 'UPDATE':
              callbackRef.current(payload.new as unknown as TableRealtimeData)
              break
            case 'INSERT':
              insertRef.current?.(payload.new as unknown as TableRealtimeData)
              break
            case 'DELETE':
              deleteRef.current?.((payload.old as { id: string }).id)
              break
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])
}
