import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, requireRole } from '@/lib/api/auth';

const updateReceiptConfigSchema = z.object({
  header_text: z.string().max(500).optional(),
  footer_text: z.string().max(500).optional(),
  logo_path: z.string().nullable().optional(),
  show_dual_pricing: z.boolean().optional(),
  show_qr_code: z.boolean().optional(),
  qr_code_url: z.string().url().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/printing/receipt-config/[id] */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin']);
  if (roleErr) return roleErr;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateReceiptConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from('receipt_config')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Receipt config not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('receipt_config')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update receipt config' }, { status: 500 });
  }

  return NextResponse.json({ data });
}
