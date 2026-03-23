import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()

  // Fetch items where current_stock <= par_level
  const { data: items, error } = await db
    .from('inventory_items')
    .select('id, name, current_stock, par_level, reorder_point, unit, category')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('current_stock', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const alerts = (items ?? [])
    .filter((item: Record<string, unknown>) => {
      const stock = item.current_stock as number
      const par = item.par_level as number
      return stock <= par
    })
    .map((item: Record<string, unknown>) => {
      const stock = item.current_stock as number
      const reorder = item.reorder_point as number
      return {
        id: item.id,
        item_name: item.name,
        current_stock: stock,
        par_level: item.par_level,
        reorder_point: reorder,
        unit: item.unit,
        category: item.category ?? 'General',
        severity: stock <= reorder ? 'critical' : 'warning',
      }
    })

  return NextResponse.json({
    data: alerts,
    total: alerts.length,
    critical_count: alerts.filter((a: Record<string, unknown>) => a.severity === 'critical').length,
    warning_count: alerts.filter((a: Record<string, unknown>) => a.severity === 'warning').length,
  })
}
