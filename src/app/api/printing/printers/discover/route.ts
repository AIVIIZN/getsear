import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/api/auth';
import { discoverPrinters } from '@/lib/printing/printer-discovery';

/** GET /api/printing/printers/discover — discover printers on the LAN */
export async function GET() {
  const user = await getAuthUser();
  if (user instanceof NextResponse) return user;

  const roleErr = requireRole(user, ['owner', 'admin']);
  if (roleErr) return roleErr;

  const relayUrl = process.env.PRINT_RELAY_URL ?? 'http://localhost:8088';

  try {
    const printers = await discoverPrinters(relayUrl);
    return NextResponse.json({ data: printers });
  } catch {
    return apiError(503, 'Failed to discover printers. Is the print relay running?');
  }
}
