import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, requireRole } from '@/lib/api/auth';

const createPrinterSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  model: z.enum([
    'star_tsp143iv', 'star_tsp143iii', 'star_mc_print3', 'star_mpop', 'star_sm_l200',
    'epson_tm_t88vii', 'epson_tm_82ii',
  ]),
  connection_type: z.enum(['network', 'cloudprnt', 'bluetooth', 'usb']),
  ip_address: z.string().nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  role: z.enum(['receipt', 'kitchen', 'bar', 'label', 'expo']),
  station_name: z.string().nullable().optional(),
  cash_drawer_enabled: z.boolean().optional().default(false),
  cash_drawer_pin: z.union([z.literal(2), z.literal(5)]).optional().default(2),
  pulse_duration: z.number().int().min(100).max(800).optional().default(100),
});

/** GET /api/printing/printers — list printers for a location */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin', 'manager']);
  if (roleErr) return roleErr;

  const locationId = request.nextUrl.searchParams.get('location_id');

  const supabase = createAdminClient();
  let query = supabase
    .from('printers')
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true });

  if (locationId) {
    query = query.eq('location_id', locationId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch printers' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/printing/printers — create a new printer */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin']);
  if (roleErr) return roleErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createPrinterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('printers')
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      name: parsed.data.name,
      model: parsed.data.model,
      connection_type: parsed.data.connection_type,
      ip_address: parsed.data.ip_address ?? null,
      port: parsed.data.port ?? 9100,
      role: parsed.data.role,
      station_name: parsed.data.station_name ?? null,
      cash_drawer_enabled: parsed.data.cash_drawer_enabled,
      cash_drawer_pin: parsed.data.cash_drawer_pin,
      pulse_duration: parsed.data.pulse_duration,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create printer' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
