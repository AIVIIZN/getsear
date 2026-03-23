import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  getCascadePreview,
  apply86Cascade,
  un86Ingredient,
} from '@/lib/menu/eighty-six-cascade'

type RouteParams = { params: Promise<{ id: string }> }

const apply86Schema = z.object({
  item_ids: z.array(z.string().uuid()),
  user_id: z.string().uuid(),
  org_id: z.string().uuid(),
  location_id: z.string().uuid(),
  reason: z.string().optional(),
})

const restore86Schema = z.object({
  user_id: z.string().uuid(),
  org_id: z.string().uuid(),
  location_id: z.string().uuid(),
})

/**
 * GET /api/menu/ingredients/[id]/86?preview=true&org_id=...
 * Returns cascade preview of which menu items would be affected.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const orgId = request.nextUrl.searchParams.get('org_id') ?? user.org_id

  const items = await getCascadePreview(id, orgId)
  return NextResponse.json({ data: items })
}

/**
 * POST /api/menu/ingredients/[id]/86
 * Apply 86 cascade to specified menu items.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'kitchen'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = apply86Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const result = await apply86Cascade(
    id,
    parsed.data.item_ids,
    parsed.data.user_id,
    parsed.data.org_id,
    parsed.data.location_id,
    parsed.data.reason
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to apply 86' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    affectedCount: result.affectedCount,
  })
}

/**
 * DELETE /api/menu/ingredients/[id]/86
 * Restore an 86'd ingredient and its affected menu items.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'kitchen'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = restore86Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const result = await un86Ingredient(
    id,
    parsed.data.user_id,
    parsed.data.org_id,
    parsed.data.location_id
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to restore' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    restoredCount: result.restoredCount,
  })
}
