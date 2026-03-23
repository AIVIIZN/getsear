'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, CalendarDays, Clock, Users, MapPin } from 'lucide-react'

interface ConfirmationData {
  id: string
  customer_name: string
  party_size: number
  date: string
  time: string
  display_time: string
  display_date: string
  location_name: string
  status: string
  special_requests: string | null
}

export default function ReservationConfirmation() {
  const params = useParams()
  const slug = params.slug as string
  const [data, setData] = useState<ConfirmationData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('sear_reservation_confirmation')
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        // Invalid data
      }
    }
  }, [])

  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-gray-500">
          No reservation found. Please{' '}
          <a
            href={`/reserve/${slug}`}
            className="font-medium underline"
            style={{ color: '#F06B18' }}
          >
            make a reservation
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* Success icon */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Reservation Confirmed
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          We look forward to seeing you, {data.customer_name}!
        </p>
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.location_name}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.display_date}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.display_time}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Party of {data.party_size}
              </p>
            </div>
          </div>

          {data.special_requests && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Special Requests
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {data.special_requests}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation ID */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400">
          Confirmation ID: <span className="font-mono">{data.id.slice(0, 8)}</span>
        </p>
      </div>

      {/* SMS note */}
      <div className="mt-6 rounded-xl bg-blue-50 p-4 text-center">
        <p className="text-sm text-blue-800">
          A confirmation SMS has been sent to your phone.
          You will receive a reminder 1 hour before your reservation.
        </p>
      </div>

      {/* Make another */}
      <div className="mt-6 text-center">
        <a
          href={`/reserve/${slug}`}
          className="text-sm font-medium hover:underline"
          style={{ color: '#F06B18' }}
        >
          Make another reservation
        </a>
      </div>

      {/* Powered by */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-300">
          Powered by <span className="font-medium">Sear POS</span>
        </p>
      </div>
    </div>
  )
}
