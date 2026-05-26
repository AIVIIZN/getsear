import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { syncDailySales } from '@/lib/integrations/quickbooks-journal'

const SyncSchema = z.object({
  location_id: z.string().uuid(),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = SyncSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const result = await syncDailySales(parsed.data.location_id, parsed.data.business_date)

  if (!result.success) {
    return apiError(500, result.error)
  }

  return NextResponse.json({
    data: {
      success: true,
      journal_entry_id: result.journalEntryId,
      total_synced: result.totalSynced,
    },
  })
}
