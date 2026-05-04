import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'
import { checkRateLimit, applyRateLimitHeaders } from '@/lib/api/rate-limit'
import {
  generateMenuPhoto,
  isPhotoPipelineConfigured,
} from '@/lib/menu/photo-pipeline'
import { audit } from '@/lib/audit/log'
import {
  badRequest,
  internalError,
  notFound,
  rateLimited,
} from '@/lib/api/error-response'

type RouteParams = { params: Promise<{ id: string }> }

interface MenuItemRow {
  id: string
  name: string
  description: string | null
  org_id: string
  image_url: string | null
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  if (!isPhotoPipelineConfigured()) {
    return badRequest('OPENAI_API_KEY not configured on this server')
  }

  const { id } = await params
  if (!id) {
    return badRequest('Item id is required')
  }

  // Cost guard: bulk tier (10/min/user) — prevents runaway billing.
  const rl = await checkRateLimit('bulk', `menu-photo-gen:${user.id}`)
  if (!rl.allowed) {
    const res = rateLimited(rl.retryAfterSeconds)
    applyRateLimitHeaders(res.headers, rl)
    return res
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemRaw, error: itemErr } = await (supabase.from('menu_items') as any)
    .select('id, name, description, org_id, image_url')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (itemErr || !itemRaw) {
    return notFound('Menu item')
  }
  const item = itemRaw as MenuItemRow

  let generated
  try {
    generated = await generateMenuPhoto({
      org_id: user.org_id,
      item_id: item.id,
      name: item.name,
      description: item.description,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Photo generation failed'
    if (message === 'OPENAI_API_KEY not configured') {
      return badRequest(message)
    }
    console.error('[menu-photo-generate] generation failed', {
      item_id: item.id,
      org_id: user.org_id,
      message,
    })
    return internalError('Failed to generate photo')
  }

  const generatedAt = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from('menu_items') as any)
    .update({ image_url: generated.url, updated_at: generatedAt })
    .eq('id', item.id)
    .eq('org_id', user.org_id)

  if (updateErr) {
    console.error('[menu-photo-generate] DB update failed', {
      item_id: item.id,
      message: updateErr.message,
    })
    return internalError('Failed to save photo URL')
  }

  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.menuItem(user.org_id, item.id), CACHE_REVALIDATE_PROFILE)

  await audit.record({
    actor: user,
    action: 'menu_photo_generated',
    entity_type: 'menu_item',
    entity_id: item.id,
    description: `AI-generated photo for "${item.name}"`,
    after_state: {
      image_url: generated.url,
      cost_cents: generated.cost_cents,
      storage_path: generated.storage_path,
    },
    request,
  })

  const res = NextResponse.json({
    data: {
      url: generated.url,
      generated_at: generatedAt,
    },
  })
  applyRateLimitHeaders(res.headers, rl)
  return res
}
