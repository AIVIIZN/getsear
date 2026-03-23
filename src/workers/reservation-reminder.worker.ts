/**
 * Reservation Reminder Worker
 *
 * BullMQ cron worker that sends reservation reminder SMS.
 *
 * Two schedules:
 * - 24-hour reminder: Runs daily at 10:00 AM, finds tomorrow's reservations
 * - 2-hour reminder: Runs every 30 minutes, finds reservations in 2-2.5 hour window
 *
 * Queue: reservation-reminders
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/integrations/twilio-client'
import { isIntegrationActive } from '@/lib/integrations/config-store'

export const RESERVATION_REMINDER_QUEUE = 'reservation-reminders'

export interface ReminderJobData {
  type: '24hr' | '2hr'
}

export interface ReminderResult {
  reminders_sent: number
  reminders_skipped: number
  errors: string[]
  duration_ms: number
}

/**
 * Process a reservation reminder job.
 */
export async function processReservationReminderJob(
  data: ReminderJobData
): Promise<ReminderResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()

  console.log(`[reservation-reminder] Running ${data.type} reminders`)

  // Get all locations with active Twilio integration and reservation_reminder enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locations } = await (supabase.from('locations') as any)
    .select('id, name, timezone')
    .eq('is_active', true)

  if (!locations || locations.length === 0) {
    return { reminders_sent: 0, reminders_skipped: 0, errors: [], duration_ms: Date.now() - startTime }
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const location of locations) {
    // Check if Twilio is active for this location
    const isActive = await isIntegrationActive(location.id, 'twilio')
    if (!isActive) continue

    try {
      const reservations = await getUpcomingReservations(
        location.id,
        data.type,
        location.timezone ?? 'America/Chicago'
      )

      for (const reservation of reservations) {
        if (!reservation.customer_phone) {
          skipped++
          continue
        }

        const templateType = data.type === '24hr' ? 'reservation_reminder_24hr' as const : 'reservation_reminder_2hr' as const

        const variables: Record<string, string> = {
          customer_name: reservation.customer_name ?? 'Guest',
          location_name: location.name ?? 'the restaurant',
          reservation_time: formatTime(reservation.reservation_time, location.timezone),
          ...(data.type === '24hr' ? {
            reservation_date: 'tomorrow',
            party_size: String(reservation.party_size ?? 2),
          } : {}),
        }

        const result = await sendSms({
          locationId: location.id,
          to: reservation.customer_phone,
          templateType,
          variables,
          idempotencyKey: `reservation_reminder_${data.type}:${reservation.id}`,
        })

        if (result.success) {
          sent++
          // Mark reservation as reminder sent
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('reservations') as any)
            .update({
              [`reminder_${data.type}_sent_at`]: new Date().toISOString(),
            })
            .eq('id', reservation.id)
        } else if (result.error !== 'Duplicate message — already sent') {
          errors.push(`${reservation.customer_name}: ${result.error}`)
        } else {
          skipped++
        }
      }
    } catch (err) {
      errors.push(`${location.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const duration = Date.now() - startTime
  console.log(
    `[reservation-reminder] ${data.type} complete: ${sent} sent, ${skipped} skipped, ${errors.length} errors in ${duration}ms`
  )

  return {
    reminders_sent: sent,
    reminders_skipped: skipped,
    errors,
    duration_ms: duration,
  }
}

interface ReservationForReminder {
  id: string
  customer_name: string | null
  customer_phone: string | null
  reservation_time: string
  party_size: number | null
}

/**
 * Fetch reservations that need reminders.
 */
async function getUpcomingReservations(
  locationId: string,
  type: '24hr' | '2hr',
  timezone: string
): Promise<ReservationForReminder[]> {
  const supabase = createAdminClient()

  const now = new Date()
  let startWindow: Date
  let endWindow: Date

  if (type === '24hr') {
    // Tomorrow: 24-hour window from now
    startWindow = new Date(now.getTime() + 23 * 60 * 60 * 1000) // 23 hours from now
    endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000) // 25 hours from now
  } else {
    // 2-hour: window from 1.5 to 2.5 hours from now
    startWindow = new Date(now.getTime() + 1.5 * 60 * 60 * 1000)
    endWindow = new Date(now.getTime() + 2.5 * 60 * 60 * 1000)
  }

  const reminderSentField = type === '24hr' ? 'reminder_24hr_sent_at' : 'reminder_2hr_sent_at'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('reservations') as any)
    .select('id, customer_name, customer_phone, reservation_time, party_size')
    .eq('location_id', locationId)
    .in('status', ['confirmed', 'pending'])
    .gte('reservation_time', startWindow.toISOString())
    .lte('reservation_time', endWindow.toISOString())
    .is(reminderSentField, null)

  return data ?? []
}

/**
 * Format a time for display in SMS.
 */
function formatTime(isoTime: string, timezone: string): string {
  try {
    return new Date(isoTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
  } catch {
    return new Date(isoTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
}
