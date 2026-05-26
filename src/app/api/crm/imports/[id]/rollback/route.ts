import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestOwnerRoles } from '@/lib/crm/api'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestOwnerRoles])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()
  const { data: job } = await supabase
    .from('crm_import_jobs')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!job) return apiError(404, 'Import job not found')
  if (!job.rollback_safe) return apiError(409, 'Import job is not marked rollback-safe')
  if (job.status === 'rolled_back') return apiError(409, 'Import job already rolled back')

  const { data: rows } = await supabase
    .from('crm_import_rows')
    .select('id, imported_guest_id')
    .eq('job_id', id)
    .eq('org_id', user.org_id)
    .eq('validation_status', 'imported')
    .not('imported_guest_id', 'is', null)

  const guestIds = Array.from(new Set((rows ?? []).map((row: { imported_guest_id: string }) => row.imported_guest_id)))
  const now = new Date().toISOString()

  if (guestIds.length > 0) {
    await supabase
      .from('guests')
      .update({
        profile_status: 'archived',
        deleted_at: now,
        updated_at: now,
        metadata: { rolled_back_import_job_id: id },
      } as never)
      .eq('org_id', user.org_id)
      .in('id', guestIds)

    await supabase
      .from('guest_contact_points')
      .update({ deleted_at: now, updated_at: now } as never)
      .eq('org_id', user.org_id)
      .in('guest_id', guestIds)
  }

  await supabase
    .from('crm_import_rows')
    .update({ validation_status: 'rolled_back', updated_at: now } as never)
    .eq('job_id', id)
    .eq('org_id', user.org_id)
    .eq('validation_status', 'imported')

  const { data: rolledBackJob } = await supabase
    .from('crm_import_jobs')
    .update({
      status: 'rolled_back',
      rolled_back_at: now,
      rolled_back_by_user_id: user.id,
      report: { ...(job.report ?? {}), rolled_back_guest_count: guestIds.length },
      updated_at: now,
    } as never)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  await audit.record({
    actor: user,
    action: 'crm_import_rolled_back',
    entity_type: 'crm_import_job',
    entity_id: id,
    before_state: job as Record<string, unknown>,
    after_state: { job: rolledBackJob, rolled_back_guest_count: guestIds.length },
    description: `Rolled back CRM import ${id}`,
    request,
    location_id: job.location_id ?? null,
  })

  return NextResponse.json({ data: { job: rolledBackJob, rolled_back_guest_count: guestIds.length } })
}
