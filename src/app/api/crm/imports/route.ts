import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestOwnerRoles, hashGuestContactValue, normalizeGuestContactValue } from '@/lib/crm/api'
import { validateCrmImportRows } from '@/lib/crm/imports'
import { createCrmImportJobSchema, listCrmImportJobsQuerySchema } from '@/lib/schemas/crm'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type ValidatedImportRow = ReturnType<typeof validateCrmImportRows>['rows'][number]

async function loadDuplicateHashes(supabase: SupabaseAdmin, orgId: string, rows: Array<Record<string, unknown>>, mapping: { email?: string | null; phone?: string | null }) {
  const hashes = new Set<string>()
  for (const row of rows) {
    const emailValue = mapping.email ? row[mapping.email] : null
    const phoneValue = mapping.phone ? row[mapping.phone] : null
    if (emailValue) hashes.add(hashGuestContactValue(normalizeGuestContactValue({ contact_type: 'email', value: String(emailValue) })))
    if (phoneValue) hashes.add(hashGuestContactValue(normalizeGuestContactValue({ contact_type: 'phone', value: String(phoneValue) })))
  }
  if (hashes.size === 0) return new Set<string>()

  const { data } = await supabase
    .from('guest_contact_points')
    .select('value_hash')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('value_hash', Array.from(hashes))

  return new Set((data ?? []).map((row: { value_hash: string }) => row.value_hash))
}

async function createGuestFromImportRow(supabase: SupabaseAdmin, orgId: string, userId: string, locationId: string | null | undefined, row: ValidatedImportRow, sourceType: string) {
  const normalized = row.normalized_data
  const { data: guest, error } = await supabase
    .from('guests')
    .insert({
      org_id: orgId,
      location_id: locationId ?? null,
      display_name: normalized.display_name,
      first_name: normalized.first_name,
      last_name: normalized.last_name,
      birthday: normalized.birthday,
      lifecycle_stage: 'prospect',
      metadata: { import_source: sourceType, import_row_number: row.row_number },
    })
    .select()
    .single()

  if (error || !guest) throw new Error('guest_insert_failed')

  const contactRows = []
  if (normalized.email) {
    contactRows.push({
      org_id: orgId,
      location_id: locationId ?? null,
      guest_id: guest.id,
      contact_type: 'email',
      value: normalized.email,
      normalized_value: normalized.email,
      value_hash: row.email_hash,
      is_primary: true,
      is_verified: false,
      source: `crm_import:${sourceType}`,
      metadata: { import_row_number: row.row_number },
    })
  }
  if (normalized.phone) {
    contactRows.push({
      org_id: orgId,
      location_id: locationId ?? null,
      guest_id: guest.id,
      contact_type: 'phone',
      value: normalized.phone,
      normalized_value: normalized.phone,
      value_hash: row.phone_hash,
      is_primary: contactRows.length === 0,
      is_verified: false,
      source: `crm_import:${sourceType}`,
      metadata: { import_row_number: row.row_number },
    })
  }
  if (contactRows.length > 0) await supabase.from('guest_contact_points').insert(contactRows)

  if (normalized.email && normalized.consent_status !== 'unknown') {
    await supabase.from('guest_consents').insert({
      org_id: orgId,
      location_id: locationId ?? null,
      guest_id: guest.id,
      channel: 'email',
      purpose: 'marketing',
      status: normalized.consent_status,
      source: normalized.consent_source ?? `crm_import:${sourceType}`,
      proof: { import_row_number: row.row_number, source_type: sourceType },
      captured_by_user_id: userId,
    })
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: orgId,
    location_id: locationId ?? null,
    guest_id: guest.id,
    actor_user_id: userId,
    event_type: 'crm.import.guest_created',
    event_source: 'crm_import',
    title: 'Guest imported',
    body: `${normalized.display_name} was imported from ${sourceType}.`,
    visibility: 'manager',
    metadata: { import_row_number: row.row_number },
  })

  return guest
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestOwnerRoles])
  if (roleErr) return roleErr

  const parsed = listCrmImportJobsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('crm_import_jobs')
    .select('*, crm_import_rows(id, row_number, validation_status, errors, warnings, duplicate_guest_id, imported_guest_id)')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  const { data, error } = await query
  if (error) return apiError(500, 'Failed to fetch import jobs')

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestOwnerRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = createCrmImportJobSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const input = parsed.data
  const supabase = createAdminClient()
  const duplicateHashes = await loadDuplicateHashes(supabase, user.org_id, input.rows, input.mapping)
  const validation = validateCrmImportRows(input.rows, input.mapping, {
    duplicateHashes,
    requireConsentForMarketing: input.merge_rules.require_consent_for_marketing,
  })
  const status = input.commit ? 'importing' : 'validated'

  const { data: job, error: jobError } = await supabase
    .from('crm_import_jobs')
    .insert({
      org_id: user.org_id,
      location_id: input.location_id ?? null,
      source_type: input.source_type,
      status,
      file_name: input.file_name,
      mapping: input.mapping,
      merge_rules: input.merge_rules,
      validation_summary: validation.summary,
      original_row_count: validation.summary.original_row_count,
      valid_row_count: validation.summary.valid_row_count,
      invalid_row_count: validation.summary.invalid_row_count,
      duplicate_row_count: validation.summary.duplicate_row_count,
      rollback_safe: input.merge_rules.rollback_safe,
      created_by_user_id: user.id,
      started_at: input.commit ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (jobError || !job) return apiError(500, 'Failed to create import job')

  const importRows = validation.rows.map((row) => ({
    org_id: user.org_id,
    location_id: input.location_id ?? null,
    job_id: job.id,
    row_number: row.row_number,
    raw_data: row.raw_data,
    normalized_data: row.normalized_data,
    validation_status: row.validation_status,
    errors: row.errors,
    warnings: row.warnings,
    duplicate_guest_id: row.duplicate_guest_id ?? null,
  }))
  await supabase.from('crm_import_rows').insert(importRows)

  let importedCount = 0
  if (input.commit) {
    for (const row of validation.rows.filter((candidate) => candidate.validation_status === 'valid')) {
      const guest = await createGuestFromImportRow(supabase, user.org_id, user.id, input.location_id, row, input.source_type)
      importedCount += 1
      await supabase
        .from('crm_import_rows')
        .update({ validation_status: 'imported', imported_guest_id: guest.id, updated_at: new Date().toISOString() })
        .eq('job_id', job.id)
        .eq('row_number', row.row_number)
        .eq('org_id', user.org_id)
    }
  }

  const finalStatus = input.commit
    ? validation.summary.invalid_row_count > 0 || validation.summary.duplicate_row_count > 0 ? 'completed_with_errors' : 'completed'
    : 'validated'

  const { data: finalJob } = await supabase
    .from('crm_import_jobs')
    .update({
      status: finalStatus,
      imported_guest_count: importedCount,
      completed_at: input.commit ? new Date().toISOString() : null,
      report: { imported_guest_count: importedCount, validation: validation.summary },
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  await audit.record({
    actor: user,
    action: input.commit ? 'crm_import_completed' : 'crm_import_validated',
    entity_type: 'crm_import_job',
    entity_id: job.id,
    after_state: { job: finalJob ?? job, validation: validation.summary },
    description: input.commit ? `Imported ${importedCount} CRM guests from ${input.source_type}` : `Validated CRM import from ${input.source_type}`,
    request,
    location_id: input.location_id ?? null,
  })

  return NextResponse.json({ data: { job: finalJob ?? job, rows: validation.rows, summary: validation.summary } }, { status: input.commit ? 201 : 200 })
}
