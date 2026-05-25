import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmAutomationManageRoles, runCrmAutomation } from '@/lib/crm/automations'
import { createAdminClient } from '@/lib/supabase/admin'
import { testCrmAutomationSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAutomationManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = testCrmAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const result = await runCrmAutomation({ db, user, automationId: id, testInput: { ...parsed.data, dry_run: true }, mode: 'test' })
  if (result.error) return NextResponse.json({ error: result.error, data: result.result }, { status: result.status })

  return NextResponse.json({ data: result.result })
}
