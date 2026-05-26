import { apiError } from '@/lib/api/error-response'
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

  // P0 fix (5.99.6 #2): the previous version queried a non-existent
  // `marketing_campaigns` table and read `email_subject` / `email_body`
  // columns that don't exist either. Real table is `campaigns` with
  // `subject`, `body_html`, and `sms_body`.
  const { data: campaign, error } = await db
    .from('campaigns')
    .select('id, org_id, subject, body_html, sms_body')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !campaign) {
    return apiError(404, 'Campaign not found')
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

  // The real campaigns table uses `subject` and `body_html`, not
  // `email_subject` / `email_body`. Read the right columns.
  const previewEmailSubject = campaign.subject
    ? resolveMergeFields(campaign.subject as string, mergeData)
    : null

  const previewEmailBody = campaign.body_html
    ? resolveMergeFields(campaign.body_html as string, mergeData)
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
