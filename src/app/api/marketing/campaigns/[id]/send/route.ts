import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * POST /api/marketing/campaigns/:id/send — send or schedule a campaign
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return NextResponse.json(
      { error: 'Campaign must be in draft or scheduled status to send' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const isScheduled = campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('campaigns') as any)
    .update({
      status: isScheduled ? 'scheduled' : 'sending',
      sent_at: isScheduled ? null : now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
