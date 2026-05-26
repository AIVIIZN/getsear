import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMPLATES, type SmsTemplateType } from '@/lib/integrations/sms-templates'

const UpsertTemplateSchema = z.object({
  location_id: z.string().uuid(),
  template_type: z.enum(['order_ready', 'reservation_reminder_24hr', 'reservation_reminder_2hr', 'waitlist_alert', 'marketing']),
  name: z.string().min(1).max(100),
  body: z.string().min(1).max(1600),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return apiError(400, 'location_id required')
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: templates, error } = await (supabase.from('sms_templates') as any)
    .select('*')
    .eq('location_id', locationId)
    .order('template_type')

  if (error) {
    return apiError(500, error.message)
  }

  // If no templates exist, return defaults
  if (!templates || templates.length === 0) {
    const defaults = Object.entries(DEFAULT_TEMPLATES).map(([type, tmpl]) => ({
      id: null,
      location_id: locationId,
      template_type: type,
      name: tmpl.name,
      body: tmpl.body,
      is_active: true,
      is_default: true,
    }))
    return NextResponse.json({ data: defaults })
  }

  return NextResponse.json({ data: templates })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = UpsertTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const supabase = createAdminClient()

  // Upsert — one template per location per type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('sms_templates') as any)
    .select('id')
    .eq('location_id', parsed.data.location_id)
    .eq('template_type', parsed.data.template_type)
    .maybeSingle()

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sms_templates') as any)
      .update({
        name: parsed.data.name,
        body: parsed.data.body,
        is_active: parsed.data.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) return apiError(500, error.message)
    return NextResponse.json({ data })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sms_templates') as any)
    .insert({
      location_id: parsed.data.location_id,
      template_type: parsed.data.template_type,
      name: parsed.data.name,
      body: parsed.data.body,
      is_active: parsed.data.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) return apiError(500, error.message)
  return NextResponse.json({ data })
}
