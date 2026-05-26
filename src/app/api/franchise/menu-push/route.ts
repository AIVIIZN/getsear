import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const menuPushSchema = z.object({
  location_ids: z.array(z.string().uuid()),
  items: z.array(z.object({
    id: z.string().uuid(),
    action: z.enum(['add', 'update', 'remove']),
  })),
  confirm: z.boolean(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = menuPushSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()
  const { location_ids, items, confirm } = parsed.data

  if (!confirm) {
    return apiError(400, 'Menu push requires confirmation')
  }

  let pushed = 0
  let failed = 0
  const errors: string[] = []

  for (const locationId of location_ids) {
    for (const item of items) {
      try {
        if (item.action === 'add' || item.action === 'update') {
          // Get corporate menu item
          const { data: corpItem } = await db
            .from('menu_items')
            .select('*')
            .eq('id', item.id)
            .single()

          if (!corpItem) {
            failed++
            errors.push(`Item ${item.id} not found`)
            continue
          }

          // Upsert to location
          const { error } = await db
            .from('menu_items')
            .upsert({
              ...corpItem,
              id: undefined, // Let DB generate new ID for location copy
              location_id: locationId,
              corporate_item_id: item.id,
              synced_at: new Date().toISOString(),
            }, {
              onConflict: 'corporate_item_id,location_id',
            })

          if (error) {
            failed++
            errors.push(`Failed to push ${corpItem.name} to location ${locationId}`)
          } else {
            pushed++
          }
        } else if (item.action === 'remove') {
          await db
            .from('menu_items')
            .update({ is_active: false })
            .eq('corporate_item_id', item.id)
            .eq('location_id', locationId)
          pushed++
        }
      } catch {
        failed++
      }
    }
  }

  return NextResponse.json({
    data: {
      pushed,
      failed,
      errors: errors.slice(0, 10),
      locations_affected: location_ids.length,
    },
  })
}
