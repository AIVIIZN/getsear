import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { collectCrmHealthCandidates, crmHealthReadRoles, crmHealthReviewRoles } from '@/lib/crm/health'
import { buildCrmLaunchReadiness } from '@/lib/crm/launch-readiness'
import { listCrmHealthQuerySchema, reviewCrmHealthIssueSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmHealthReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmHealthQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return apiError(400, 'Invalid CRM health query', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  const db = createAdminClient()
  let latestRun = null

  if (parsed.data.include_scan) {
    const scan = await collectCrmHealthCandidates(db, user.org_id)
    const { data: run } = await db
      .from('crm_data_quality_runs')
      .insert({
        org_id: user.org_id,
        status: 'completed',
        run_source: 'manual',
        scanned_counts: scan.scanned_counts,
        issue_counts: scan.issue_counts,
        impact_score: scan.candidates[0]?.impact_score ?? 0,
        started_by_user_id: user.id,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    latestRun = run

    if (run) {
      for (const issue of scan.candidates) {
        const payload = {
          ...issue,
          org_id: user.org_id,
          run_id: run.id,
          status: 'review_required',
          updated_at: new Date().toISOString(),
        }
        const { data: existing } = await db
          .from('crm_health_issues')
          .select('id, status')
          .eq('org_id', user.org_id)
          .eq('issue_key', issue.issue_key)
          .maybeSingle()

        if (existing) {
          const retainedStatus = ['resolved', 'dismissed'].includes(existing.status) ? existing.status : payload.status
          await db.from('crm_health_issues').update({ ...payload, status: retainedStatus }).eq('id', existing.id).eq('org_id', user.org_id)
        } else {
          await db.from('crm_health_issues').insert(payload)
        }
      }

      await audit.record({
        actor: user,
        action: 'crm_health_scan_run',
        entity_type: 'crm_data_quality_run',
        entity_id: run.id,
        after_state: { issue_counts: scan.issue_counts, scanned_counts: scan.scanned_counts },
        description: 'Ran CRM health data quality scan',
        request,
      })
    }
  }

  let builder = db
    .from('crm_health_issues')
    .select('*, crm_data_quality_runs(id, started_at, completed_at, issue_counts)')
    .eq('org_id', user.org_id)
    .order('impact_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) builder = builder.eq('status', parsed.data.status)
  if (parsed.data.type) builder = builder.eq('issue_type', parsed.data.type)

  const { data, error } = await builder
  if (error) return apiError(500, 'Failed to fetch CRM health issues')

  const issues = data ?? []
  const launchReadiness = buildCrmLaunchReadiness({
    issues,
    lastScanAt: latestRun?.completed_at ?? issues[0]?.updated_at ?? null,
  })

  return NextResponse.json({ data: issues, latest_run: latestRun, launch_readiness: launchReadiness })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmHealthReviewRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = reviewCrmHealthIssueSchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'Invalid CRM health review', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  const db = createAdminClient()
  const { data: issue, error: issueError } = await db
    .from('crm_health_issues')
    .select('*')
    .eq('id', parsed.data.issue_id)
    .eq('org_id', user.org_id)
    .single()

  if (issueError || !issue) return apiError(404, 'CRM health issue not found')

  const now = new Date().toISOString()
  const nextStatus = parsed.data.action === 'approve_fix' ? 'approved' : parsed.data.action === 'resolve' ? 'resolved' : 'dismissed'
  const updatePayload = parsed.data.action === 'dismiss'
    ? { status: nextStatus, dismissed_by_user_id: user.id, dismissed_at: now, reviewed_by_user_id: user.id, reviewed_at: now, metadata: { ...(issue.metadata ?? {}), review_note: parsed.data.review_note, ...parsed.data.metadata }, updated_at: now }
    : parsed.data.action === 'resolve'
      ? { status: nextStatus, resolved_by_user_id: user.id, resolved_at: now, reviewed_by_user_id: user.id, reviewed_at: now, metadata: { ...(issue.metadata ?? {}), review_note: parsed.data.review_note, ...parsed.data.metadata }, updated_at: now }
      : { status: nextStatus, reviewed_by_user_id: user.id, reviewed_at: now, metadata: { ...(issue.metadata ?? {}), review_note: parsed.data.review_note, ...parsed.data.metadata }, updated_at: now }

  const { data: updated, error: updateError } = await db
    .from('crm_health_issues')
    .update(updatePayload)
    .eq('id', issue.id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateError || !updated) return apiError(500, 'Failed to review CRM health issue')

  await audit.record({
    actor: user,
    action: parsed.data.action === 'dismiss' ? 'crm_health_issue_dismissed' : parsed.data.action === 'resolve' ? 'crm_health_issue_resolved' : 'crm_health_issue_reviewed',
    entity_type: 'crm_health_issue',
    entity_id: issue.id,
    before_state: issue,
    after_state: updated,
    description: `Reviewed CRM health issue: ${issue.title}`,
    request,
  })

  return NextResponse.json({ data: updated })
}
