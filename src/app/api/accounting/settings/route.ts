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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('accounting_integrations') as any)
    .select('settings')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = accountMappingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch existing settings to merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('accounting_integrations') as any)
    .select('settings')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  const mergedSettings = {
    ...(existing?.settings ?? {}),
    ...parsed.data,
  }

  // Upsert so it works even if no row exists yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('accounting_integrations') as any)
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
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ data: data.settings })
}
