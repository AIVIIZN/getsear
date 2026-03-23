'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { TablePicker } from './TablePicker'
import { Armchair, Users, Clock, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ReservationData {
  id: string
  customer_name: string
  party_size: number
  reservation_time: string
  table_id: string | null
  status: string
}

interface TableData {
  id: string
  name: string
  capacity: number
  status: string
  section_color?: string | null
  assigned_server_name?: string | null
}

interface ReservationSeatingFlowProps {
  reservation: ReservationData
  tables: TableData[]
  onSeated: (reservationId: string, tableId: string) => void
  onClose: () => void
}

/**
 * Reservation arrival -> table picker -> seat flow.
 * Opens when host taps "Seat" on a reservation.
 */
export function ReservationSeatingFlow({
  reservation,
  tables,
  onSeated,
  onClose,
}: ReservationSeatingFlowProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    reservation.table_id
  )
  const [seating, setSeating] = useState(false)

  const handleSeat = useCallback(async () => {
    if (!selectedTableId) return

    setSeating(true)
    try {
      // 1. Seat reservation with table assignment
      const resResponse = await fetch(`/api/reservations/${reservation.id}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: selectedTableId }),
      })

      if (!resResponse.ok) {
        const err = await resResponse.json()
        toast.error(err.error ?? 'Failed to seat reservation')
        return
      }

      // 2. Seat guests at the selected table
      const tableResponse = await fetch(`/api/tables/${selectedTableId}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_count: reservation.party_size }),
      })

      if (!tableResponse.ok) {
        const err = await tableResponse.json()
        toast.error(err.error ?? 'Failed to seat table')
        return
      }

      const selectedTable = tables.find((t) => t.id === selectedTableId)
      toast.success(
        `${selectedTable?.name ?? 'Table'} seated -- Party of ${reservation.party_size} (${reservation.customer_name})`
      )

      onSeated(reservation.id, selectedTableId)
    } catch {
      toast.error('Something went wrong seating this reservation')
    } finally {
      setSeating(false)
    }
  }, [selectedTableId, reservation, tables, onSeated])

  const formatTime = (time: string) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${h12}:${m} ${ampm}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-warm-xl animate-fade-in">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline font-bold text-foreground">Seat Reservation</h3>
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Reservation info */}
        <div className="mb-4 rounded-xl bg-secondary/50 p-3">
          <p className="text-base font-semibold text-foreground">
            {reservation.customer_name}
          </p>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Party of {reservation.party_size}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(reservation.reservation_time)}
            </span>
          </div>
        </div>

        {/* Table picker */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Select a table (seats {reservation.party_size}+)
          </p>
          <TablePicker
            tables={tables}
            minCapacity={reservation.party_size}
            selectedTableId={selectedTableId}
            highlightedTableId={reservation.table_id}
            onSelectTable={setSelectedTableId}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 touch-target"
            onClick={onClose}
            disabled={seating}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 touch-target"
            onClick={handleSeat}
            disabled={!selectedTableId || seating}
          >
            {seating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Armchair className="mr-1.5 h-4 w-4" />
            )}
            Seat
          </Button>
        </div>
      </div>
    </div>
  )
}
