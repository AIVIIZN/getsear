import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, requireRole } from '@/lib/api/auth';

const updatePrinterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.enum([
    'star_tsp143iv', 'star_tsp143iii', 'star_mc_print3', 'star_mpop', 'star_sm_l200',
    'epson_tm_t88vii', 'epson_tm_82ii',
  ]).optional(),
  connection_type: z.enum(['network', 'cloudprnt', 'bluetooth', 'usb']).optional(),
  ip_address: z.string().nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  role: z.enum(['receipt', 'kitchen', 'bar', 'label', 'expo']).optional(),
  station_name: z.string().nullable().optional(),
  cash_drawer_enabled: z.boolean().optional(),
  cash_drawer_pin: z.union([z.literal(2), z.literal(5)]).optional(),
  pulse_duration: z.number().int().min(100).max(800).optional(),
  is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/printing/printers/[id] */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('printers')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

/** PATCH /api/printing/printers/[id] */
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

  const parsed = updatePrinterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify printer belongs to this org
  const { data: existing } = await supabase
    .from('printers')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('printers')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/** DELETE /api/printing/printers/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin']);
  if (roleErr) return roleErr;

  const { id } = await params;

  const supabase = createAdminClient();

  // Verify printer belongs to this org
  const { data: existing } = await supabase
    .from('printers')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('printers')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete printer' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
