import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMergeFields } from '@/lib/marketing/merge-fields'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const db = createAdminClient()

  // Fetch campaign
  const { data: campaign, error } = await db
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Get a sample customer from the segment for preview
  const { data: sampleCustomer } = await db
    .from('customers')
    .select('first_name, last_name, email, phone')
    .eq('org_id', user.org_id)
    .limit(1)
    .single()

  // Get org name
  const { data: org } = await db
    .from('organizations')
    .select('name')
    .eq('id', user.org_id)
    .single()

  const mergeData = {
    first_name: (sampleCustomer?.first_name as string) ?? 'Sarah',
    last_name: (sampleCustomer?.last_name as string) ?? 'Johnson',
    full_name: sampleCustomer
      ? `${sampleCustomer.first_name ?? ''} ${sampleCustomer.last_name ?? ''}`.trim()
      : 'Sarah Johnson',
    email: (sampleCustomer?.email as string) ?? 'sarah@example.com',
    phone: (sampleCustomer?.phone as string) ?? '5551234567',
    points_balance: 1250,
    tier: 'Gold',
    last_visit: 'March 15',
    total_visits: 24,
    total_spent: '$1,842.50',
    restaurant_name: (org?.name as string) ?? 'Our Restaurant',
    location_name: '',
  }

  const previewSms = campaign.sms_body
    ? resolveMergeFields(campaign.sms_body as string, mergeData)
    : null

  const previewEmailSubject = campaign.email_subject
    ? resolveMergeFields(campaign.email_subject as string, mergeData)
    : null

  const previewEmailBody = campaign.email_body
    ? resolveMergeFields(campaign.email_body as string, mergeData)
    : null

  return NextResponse.json({
    data: {
      campaign_id: id,
      sample_customer: mergeData,
      preview: {
        sms: previewSms,
        email_subject: previewEmailSubject,
        email_body: previewEmailBody,
      },
    },
  })
}
