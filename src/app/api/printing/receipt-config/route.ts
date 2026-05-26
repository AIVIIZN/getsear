import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, requireRole } from '@/lib/api/auth';

const createReceiptConfigSchema = z.object({
  location_id: z.string().uuid(),
  header_text: z.string().max(500).optional().default(''),
  footer_text: z.string().max(500).optional().default('Thank you for dining with us!'),
  logo_path: z.string().nullable().optional(),
  show_dual_pricing: z.boolean().optional().default(true),
  show_qr_code: z.boolean().optional().default(false),
  qr_code_url: z.string().url().nullable().optional(),
});

/** GET /api/printing/receipt-config — get receipt config for a location */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const locationId = request.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return apiError(400, 'location_id is required');
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('receipt_config')
    .select('*')
    .eq('location_id', locationId)
    .eq('org_id', user.org_id)
    .maybeSingle();

  if (error) {
    return apiError(500, 'Failed to fetch receipt config');
  }

  return NextResponse.json({ data });
}

/** POST /api/printing/receipt-config — create receipt config */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin']);
  if (roleErr) return roleErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'Invalid JSON');
  }

  const parsed = createReceiptConfigSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } });
  }

  const supabase = createAdminClient();

  // Upsert — one config per location
  const { data, error } = await supabase
    .from('receipt_config')
    .upsert(
      {
        org_id: user.org_id,
        location_id: parsed.data.location_id,
        header_text: parsed.data.header_text,
        footer_text: parsed.data.footer_text,
        logo_path: parsed.data.logo_path ?? null,
        show_dual_pricing: parsed.data.show_dual_pricing,
        show_qr_code: parsed.data.show_qr_code,
        qr_code_url: parsed.data.qr_code_url ?? null,
      },
      { onConflict: 'location_id' }
    )
    .select()
    .single();

  if (error) {
    return apiError(500, 'Failed to save receipt config');
  }

  return NextResponse.json({ data }, { status: 201 });
}
