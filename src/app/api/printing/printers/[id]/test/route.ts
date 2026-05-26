import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, requireRole } from '@/lib/api/auth';
import { formatTestReceipt } from '@/lib/printing/receipt-formatter';
import { PrintRelayClient } from '@/lib/printing/print-relay-client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/printing/printers/[id]/test — send a test print */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin', 'manager']);
  if (roleErr) return roleErr;

  const { id } = await params;

  const supabase = createAdminClient();

  // Fetch the printer
  const { data: printer, error: printerError } = await supabase
    .from('printers')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single();

  if (printerError || !printer) {
    return apiError(404, 'Printer not found');
  }

  // Fetch the location name
  const { data: location } = await supabase
    .from('locations')
    .select('name')
    .eq('id', printer.location_id)
    .single();

  const locationName = location?.name ?? 'Sear POS';
  const printerName = printer.name as string;

  // Generate test receipt
  const testData = formatTestReceipt(printerName, locationName);

  // Send to relay
  const relayUrl = process.env.PRINT_RELAY_URL ?? 'http://localhost:8088';
  const relay = new PrintRelayClient(relayUrl);

  try {
    const status = await relay.getStatus();
    if (!status.relayOnline) {
      return apiError(503, 'Print relay is not running. Start the relay service on your local network.', { extra: { "offline": true } });
    }

    await relay.print({
      printerId: printer.id as string,
      ipAddress: (printer.ip_address as string) ?? '',
      port: (printer.port as number) ?? 9100,
      data: testData,
      connectionType: printer.connection_type as 'network' | 'cloudprnt' | 'bluetooth' | 'usb',
    });

    // Update last_print_at
    await supabase
      .from('printers')
      .update({ last_print_at: new Date().toISOString(), status: 'online' })
      .eq('id', id);

    return NextResponse.json({ success: true, message: 'Test print sent successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send test print';
    return apiError(500, message);
  }
}
