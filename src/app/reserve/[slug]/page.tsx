'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Minus, Plus, ChevronLeft } from 'lucide-react'

interface TimeSlot {
  time: string
  display_time: string
  available_tables: number
  total_tables: number
  status: 'available' | 'limited' | 'unavailable'
}

export default function ReserveWidget() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [locationName, setLocationName] = useState<string>('')
  const [step, setStep] = useState<'select' | 'info'>('select')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [partySize, setPartySize] = useState(2)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Guest info
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  // Fetch availability
  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedTime(null)
    try {
      const res = await fetch(
        `/api/reserve/${slug}?date=${selectedDate}&party_size=${partySize}`
      )
      if (!res.ok) {
        if (res.status === 404) {
          setError('Restaurant not found.')
          return
        }
        setError('Unable to load availability.')
        return
      }
      const json = await res.json()
      setLocationName(json.data.location_name ?? '')
      setSlots(json.data.available_slots ?? [])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [slug, selectedDate, partySize])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  // Submit booking
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTime || !guestName || !guestPhone) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/reserve/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedTime,
          party_size: partySize,
          customer_name: guestName,
          customer_phone: guestPhone,
          customer_email: guestEmail || undefined,
          special_requests: specialRequests || undefined,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Unable to complete booking.')
        return
      }

      const json = await res.json()
      // Store confirmation data and navigate
      sessionStorage.setItem(
        'sear_reservation_confirmation',
        JSON.stringify(json.data)
      )
      router.push(`/reserve/${slug}/confirmation`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Date display
  const dateObj = new Date(selectedDate + 'T12:00:00')
  const displayDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Min date = today
  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // Max date = 90 days out
  const maxDateObj = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const maxDate = `${maxDateObj.getFullYear()}-${String(maxDateObj.getMonth() + 1).padStart(2, '0')}-${String(maxDateObj.getDate()).padStart(2, '0')}`

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#F06B18' }}
        >
          <span className="text-xl text-white font-bold">S</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {locationName || 'Make a Reservation'}
        </h1>
        {locationName && (
          <p className="mt-1 text-sm text-gray-500">Make a Reservation</p>
        )}
      </div>

      {step === 'select' && (
        <div className="space-y-5">
          {/* Date picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20"
            />
            <p className="mt-1 text-xs text-gray-400">{displayDate}</p>
          </div>

          {/* Party size */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Party Size
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="min-w-[48px] text-center text-2xl font-bold tabular-nums text-gray-900">
                {partySize}
              </span>
              <button
                type="button"
                onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <Plus className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-500">
                guest{partySize !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Available times */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Available Times
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500">
                  No available times for this date and party size.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedTime === slot.time
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={`flex flex-col items-center rounded-full px-3 py-2.5 text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-[#F06B18] text-white shadow-md'
                          : 'border border-gray-200 bg-white text-gray-900 hover:border-[#F06B18]/50 hover:bg-[#F06B18]/5'
                      }`}
                      style={{ minHeight: 44, minWidth: 60 }}
                    >
                      {slot.display_time}
                      {slot.status === 'limited' && !isSelected && (
                        <span className="text-[10px] text-amber-600">Limited</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Next button */}
          <button
            type="button"
            disabled={!selectedTime}
            onClick={() => setStep('info')}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#F06B18' }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'info' && (
        <form onSubmit={handleBook} className="space-y-4">
          {/* Back */}
          <button
            type="button"
            onClick={() => setStep('select')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {/* Summary */}
          <div className="rounded-xl bg-white border border-gray-100 p-3 text-sm">
            <p className="font-medium text-gray-900">
              {displayDate} at{' '}
              {slots.find((s) => s.time === selectedTime)?.display_time}
            </p>
            <p className="text-gray-500">
              Party of {partySize}
            </p>
          </div>

          {/* Guest info */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full name"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Phone *
            </label>
            <input
              type="tel"
              required
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Special Requests
            </label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Allergies, celebrations, accessibility needs..."
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Book button */}
          <button
            type="submit"
            disabled={submitting || !guestName || !guestPhone}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#F06B18' }}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Book Table'
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            By booking, you agree to our cancellation policy.
          </p>
        </form>
      )}

      {/* Powered by */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-300">
          Powered by <span className="font-medium">Sear POS</span>
        </p>
      </div>
    </div>
  )
}
