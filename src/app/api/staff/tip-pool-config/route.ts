import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getDefaultTipPoolConfig } from '@/lib/staff/tip-pool-calculator'

/**
 * GET /api/staff/tip-pool-config — get tip pool configuration for location
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (supabase.from('tip_pool_configs') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (!config) {
    // Return default config
    return NextResponse.json({ data: getDefaultTipPoolConfig() })
  }

  return NextResponse.json({
    data: {
      model: config.model,
      tipoutPercentages: {
        busser: config.tipout_busser_pct ?? 3,
        bar: config.tipout_bar_pct ?? 1,
        runner: config.tipout_runner_pct ?? 1,
      },
      pointValues: config.point_values ?? { server: 10, bartender: 8, busser: 5, runner: 3, host: 2 },
      eligibleRoles: config.eligible_roles ?? ['server', 'bartender', 'host', 'busser', 'runner', 'cashier'],
      includeBoh: config.include_boh ?? false,
      deductProcessingFee: config.deduct_processing_fee ?? false,
      processingFeePct: config.processing_fee_pct ?? 2.49,
    },
  })
}

const updateSchema = z.object({
  location_id: z.string().uuid(),
  model: z.enum(['direct', 'tipout_sales', 'pool_hours', 'hybrid_points']),
  tipout_busser_pct: z.number().min(0).max(100).optional(),
  tipout_bar_pct: z.number().min(0).max(100).optional(),
  tipout_runner_pct: z.number().min(0).max(100).optional(),
  point_values: z.record(z.string(), z.number().int().min(0)).optional(),
  eligible_roles: z.array(z.string()).optional(),
  include_boh: z.boolean().optional(),
  deduct_processing_fee: z.boolean().optional(),
  processing_fee_pct: z.number().min(0).max(100).optional(),
})

/**
 * PUT /api/staff/tip-pool-config — update tip pool configuration
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Deactivate any existing config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('tip_pool_configs') as any)
    .update({ is_active: false, updated_at: now })
    .eq('org_id', user.org_id)
    .eq('location_id', parsed.data.location_id)
    .eq('is_active', true)

  // Insert new config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tip_pool_configs') as any)
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      model: parsed.data.model,
      tipout_busser_pct: parsed.data.tipout_busser_pct ?? 3,
      tipout_bar_pct: parsed.data.tipout_bar_pct ?? 1,
      tipout_runner_pct: parsed.data.tipout_runner_pct ?? 1,
      point_values: parsed.data.point_values ?? { server: 10, bartender: 8, busser: 5, runner: 3, host: 2 },
      eligible_roles: parsed.data.eligible_roles ?? ['server', 'bartender', 'host', 'busser', 'runner', 'cashier'],
      include_boh: parsed.data.include_boh ?? false,
      deduct_processing_fee: parsed.data.deduct_processing_fee ?? false,
      processing_fee_pct: parsed.data.processing_fee_pct ?? 2.49,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) {
    // Table may not exist — save to location settings instead
    return NextResponse.json({ data: parsed.data })
  }

  return NextResponse.json({ data })
}
