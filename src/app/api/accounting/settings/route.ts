import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const accountMappingSchema = z.object({
  sales_account: z.string().max(100).optional(),
  tax_account: z.string().max(100).optional(),
  tips_account: z.string().max(100).optional(),
  cash_account: z.string().max(100).optional(),
  card_account: z.string().max(100).optional(),
  gift_card_account: z.string().max(100).optional(),
  discount_account: z.string().max(100).optional(),
  cogs_account: z.string().max(100).optional(),
  labor_account: z.string().max(100).optional(),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('accounting_integrations')
    .select('settings')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  if (error) {
    return apiError(500, 'Failed to fetch settings')
  }

  return NextResponse.json({ data: data?.settings ?? {} })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = accountMappingSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Fetch existing settings to merge
  const { data: existing } = await supabase.from('accounting_integrations')
    .select('settings')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  const mergedSettings = {
    ...(existing?.settings ?? {}),
    ...parsed.data,
  }

  // Upsert so it works even if no row exists yet
  const { data, error } = await supabase.from('accounting_integrations')
    .upsert(
      {
        org_id: user.org_id,
        provider: 'quickbooks',
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,provider' }
    )
    .select('settings')
    .single()

  if (error) {
    return apiError(500, 'Failed to update settings')
  }

  return NextResponse.json({ data: data.settings })
}
