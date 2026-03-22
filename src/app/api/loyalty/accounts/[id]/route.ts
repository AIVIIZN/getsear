import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error } = await (supabase.from('loyalty_accounts') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (error || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch recent transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transactions } = await (supabase.from('loyalty_transactions') as any)
    .select('*')
    .eq('loyalty_account_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    data: {
      ...account,
      transactions: transactions ?? [],
    },
  })
}
