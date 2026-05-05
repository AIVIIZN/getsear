import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { sendSms } from '@/lib/integrations/twilio-client'

const notifySchema = z.object({
  waitlist_entry_id: z.string().uuid(),
})

/**
 * POST /api/waitlist/notify — Send SMS notification to waitlist guest
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = notifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch waitlist entry
  const { data: entry, error: fetchErr } = await supabase.from('waitlist_entries')
    .select('id, customer_name, customer_phone, party_size, status, location_id')
    .eq('id', parsed.data.waitlist_entry_id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchErr || !entry) {
    return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
  }

  if (entry.status !== 'waiting' && entry.status !== 'notified') {
    return NextResponse.json(
      { error: `Cannot notify entry with status "${entry.status}"` },
      { status: 400 }
    )
  }

  if (!entry.customer_phone) {
    return NextResponse.json({ error: 'No phone number for this guest' }, { status: 400 })
  }

  // Get location name for SMS
  const { data: location } = await supabase.from('locations')
    .select('name')
    .eq('id', entry.location_id)
    .single()

  const locationName = location?.name ?? 'our restaurant'

  // Send SMS via Twilio
  const smsResult = await sendSms({
    locationId: entry.location_id,
    to: entry.customer_phone,
    templateType: 'waitlist_alert',
    variables: {
      customer_name: entry.customer_name,
      location_name: locationName,
      party_size: String(entry.party_size),
      wait_time: '15 minutes',
    },
    idempotencyKey: `waitlist-notify-${entry.id}-${Date.now()}`,
  })

  // Update waitlist entry status to notified
  const now = new Date().toISOString()
  await supabase.from('waitlist_entries')
    .update({
      status: 'notified',
      notified_at: now,
      updated_at: now,
    })
    .eq('id', entry.id)

  return NextResponse.json({
    data: {
      notified: true,
      sms_sent: smsResult.success,
      sms_sid: smsResult.sid ?? null,
      sms_error: smsResult.error ?? null,
    },
  })
}
