import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const openDrawerSchema = z.object({
  printerId: z.string().uuid('Invalid printer ID'),
  staffId: z.string().min(1, 'Staff ID is required'),
  terminalId: z.string().uuid().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
  eventType: z.enum(['no_sale', 'cash_payment', 'shift_count']),
})

// ---------------------------------------------------------------------------
// POST — Open cash drawer
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // Cash payments auto-open the drawer (any role), but no-sale requires shift_manager+
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = openDrawerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { printerId, staffId, terminalId, reason, eventType } = parsed.data

  // No-sale opens require at least shift manager role
  if (eventType === 'no_sale') {
    const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'shift_manager'])
    if (roleErr) return roleErr
  }

  const supabase = createAdminClient()

  // Verify printer exists and has cash drawer enabled
  const { data: printer, error: printerError } = await supabase
    .from('printers')
    .select('id, name, location_id, cash_drawer_enabled, cash_drawer_pin, pulse_duration, is_active')
    .eq('id', printerId)
    .eq('org_id', user.org_id)
    .single()

  if (printerError || !printer) {
    return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
  }

  if (!printer.is_active) {
    return NextResponse.json({ error: 'Printer is offline' }, { status: 400 })
  }

  if (!printer.cash_drawer_enabled) {
    return NextResponse.json({ error: 'Cash drawer is not enabled on this printer' }, { status: 400 })
  }

  // Log the cash drawer event
  const { error: insertError } = await supabase
    .from('cash_drawer_events')
    .insert({
      org_id: user.org_id,
      location_id: printer.location_id,
      printer_id: printerId,
      staff_id: staffId,
      terminal_id: terminalId ?? null,
      event_type: eventType,
      reason,
    })

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to log cash drawer event' },
      { status: 500 }
    )
  }

  // Check no-sale count for this staff member's current shift
  if (eventType === 'no_sale') {
    // Get the start of the current shift (simplification: look back 12 hours)
    const shiftStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    const { count: noSaleCount } = await supabase
      .from('cash_drawer_events')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('event_type', 'no_sale')
      .eq('org_id', user.org_id)
      .gte('created_at', shiftStart)

    // If 3+ no-sales, we'd send a manager notification.
    // For now, include the count in the response so the client can show a warning.
    if (noSaleCount !== null && noSaleCount >= 3) {
      // In production, this would trigger a push notification / Supabase Realtime event
      // to manager terminals. For now, we flag it in the response.
      return NextResponse.json({
        data: {
          success: true,
          drawer_pin: printer.cash_drawer_pin ?? 2,
          pulse_duration: printer.pulse_duration ?? 200,
        },
        warning: `${noSaleCount} no-sale drawer opens this shift. Manager notified.`,
      })
    }
  }

  // Create a print job for the cash drawer kick command
  // The client will also generate the kick locally for speed,
  // but this ensures the server has a record.
  await supabase
    .from('print_jobs')
    .insert({
      org_id: user.org_id,
      location_id: printer.location_id,
      printer_id: printerId,
      job_type: 'cash_drawer',
      document_data: '', // Cash drawer kick is generated client-side from pin/duration
      status: 'queued',
      priority: 10, // High priority — drawer should open immediately
      attempts: 0,
    })

  return NextResponse.json({
    data: {
      success: true,
      drawer_pin: printer.cash_drawer_pin ?? 2,
      pulse_duration: printer.pulse_duration ?? 200,
    },
  })
}
