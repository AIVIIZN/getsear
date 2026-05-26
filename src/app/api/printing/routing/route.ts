import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const routingRuleSchema = z.object({
  station_name: z.string().min(1).max(100),
  primary_printer_id: z.string().uuid(),
  fallback_printer_id: z.string().uuid().nullable(),
})

const updateRoutingSchema = z.object({
  location_id: z.string().uuid(),
  rules: z.array(routingRuleSchema),
})

// ---------------------------------------------------------------------------
// GET — Fetch routing rules for a location
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('printer_routing_rules')
    .select('id, station_name, primary_printer_id, fallback_printer_id')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .order('station_name', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch routing rules')
  }

  return NextResponse.json({ data: data ?? [] })
}

// ---------------------------------------------------------------------------
// PUT — Replace all routing rules for a location (upsert)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateRoutingSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.flatten().fieldErrors, extra: { "details": parsed.error.flatten().fieldErrors } })
  }

  const { location_id, rules } = parsed.data
  const supabase = createAdminClient()

  // Verify location belongs to org
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('id', location_id)
    .eq('org_id', user.org_id)
    .single()

  if (!location) {
    return apiError(404, 'Location not found')
  }

  // Delete existing rules for this location
  await supabase
    .from('printer_routing_rules')
    .delete()
    .eq('org_id', user.org_id)
    .eq('location_id', location_id)

  if (rules.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Insert new rules
  const rowsToInsert = rules.map((rule) => ({
    org_id: user.org_id,
    location_id,
    station_name: rule.station_name,
    primary_printer_id: rule.primary_printer_id,
    fallback_printer_id: rule.fallback_printer_id,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('printer_routing_rules')
    .insert(rowsToInsert)
    .select('id, station_name, primary_printer_id, fallback_printer_id')

  if (insertError) {
    return apiError(500, 'Failed to save routing rules')
  }

  return NextResponse.json({ data: inserted ?? [] })
}
