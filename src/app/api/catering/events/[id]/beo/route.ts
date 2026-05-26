import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBEOHtml, type BEOData } from '@/lib/catering/beo-template'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'kitchen'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const db = createAdminClient()

  const { data: event, error } = await db
    .from('catering_events')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !event) {
    return apiError(404, 'Event not found')
  }

  // Get org info
  const { data: org } = await db
    .from('organizations')
    .select('name, address, phone')
    .eq('id', user.org_id)
    .single()

  const beoData: BEOData = {
    event_name: (event.name as string) ?? '',
    event_date: new Date(event.event_date as string).toLocaleDateString(),
    event_time: (event.start_time as string) ?? '',
    end_time: (event.end_time as string) ?? '',
    guest_count: (event.guest_count as number) ?? 0,
    contact_name: (event.contact_name as string) ?? '',
    contact_phone: (event.contact_phone as string) ?? '',
    contact_email: (event.contact_email as string) ?? '',
    room_setup: (event.room_setup as string) ?? 'Standard',
    menu_selections: ((event.menu_selections as Array<Record<string, unknown>>) ?? []).map((course) => ({
      course: (course.course as string) ?? '',
      items: ((course.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
        name: (item.name as string) ?? '',
        description: (item.description as string) ?? '',
        price_per_person: (item.price_per_person as number) ?? 0,
      })),
    })),
    bar_package: (event.bar_package as string) ?? null,
    bar_price_per_person: (event.bar_price as number) ?? null,
    av_needs: ((event.av_needs as string[]) ?? []),
    special_instructions: (event.special_instructions as string) ?? '',
    staff_assignments: ((event.staff_assignments as Array<Record<string, unknown>>) ?? []).map((s) => ({
      role: (s.role as string) ?? '',
      name: (s.name as string) ?? '',
      start_time: (s.start_time as string) ?? '',
      end_time: (s.end_time as string) ?? '',
    })),
    timeline: ((event.timeline as Array<Record<string, unknown>>) ?? []).map((t) => ({
      time: (t.time as string) ?? '',
      activity: (t.activity as string) ?? '',
    })),
    restaurant_name: (org?.name as string) ?? '',
    restaurant_address: (org?.address as string) ?? '',
    restaurant_phone: (org?.phone as string) ?? '',
    restaurant_logo_url: null,
  }

  const html = generateBEOHtml(beoData)

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  return NextResponse.json({ data: beoData, html })
}
