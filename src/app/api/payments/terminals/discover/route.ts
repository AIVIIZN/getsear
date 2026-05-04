/**
 * POST /api/payments/terminals/discover
 *
 * Triggers an mDNS / USB / Bluetooth / Tap-to-Pay scan and returns the merged
 * discovered-device list filtered by the org's bound processor.
 *
 * Auth: required.
 * Manager-PIN: required (sister 5.2.0c UI prompts for PIN before calling).
 *
 * Body: optional `{ manager_pin?: string, timeout_ms?: number }`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { requireProcessorBinding } from '@/lib/payments/processor-binding'
import { autoDetect } from '@/lib/payments/auto-detect'

const bodySchema = z.object({
  manager_pin: z.string().min(4).max(10),
  timeout_ms: z.number().int().min(500).max(15000).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Manager PIN is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // Validate manager PIN against any owner/admin/manager in the same org.
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, pin_hash')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .in('role', ['owner', 'admin', 'manager'])
    .not('pin_hash', 'is', null)

  if (!managers || managers.length === 0) {
    return NextResponse.json(
      { error: 'No managers configured for PIN validation' },
      { status: 403 }
    )
  }

  let pinValid = false
  for (const mgr of managers as Array<{ pin_hash: string | null }>) {
    if (!mgr.pin_hash) continue
    if (await compare(parsed.data.manager_pin, mgr.pin_hash)) {
      pinValid = true
      break
    }
  }

  if (!pinValid) {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }

  // Resolve the org's bound processor — discovery is processor-aware.
  let binding
  try {
    binding = await requireProcessorBinding(user.org_id)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'No processor binding for this org. Onboarding incomplete.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    )
  }

  const devices = await autoDetect(binding.processor, {
    timeoutMs: parsed.data.timeout_ms ?? 5000,
  })

  return NextResponse.json({ data: devices })
}
