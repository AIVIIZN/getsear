/**
 * Printer discovery — delegates to the print relay service
 * which scans the LAN for printers via mDNS, SNMP, and raw TCP probing.
 */

import type { DiscoveredPrinter } from './printer-interface';
import { PrintRelayClient } from './print-relay-client';

/**
 * Discover printers on the local network.
 * Requires the print relay service to be running.
 *
 * @param relayBaseUrl - The base URL of the print relay service
 * @returns Array of discovered printers
 */
export async function discoverPrinters(
  relayBaseUrl = 'http://localhost:8088'
): Promise<DiscoveredPrinter[]> {
  const relay = new PrintRelayClient(relayBaseUrl);

  // First check if relay is online
  const status = await relay.getStatus();
  if (!status.relayOnline) {
    return [];
  }

  return relay.discover();
}

/**
 * Check if a specific printer is reachable at the given IP:port.
 * Uses the relay to attempt a TCP connection.
 */
export async function checkPrinterReachable(
  ipAddress: string,
  port: number,
  relayBaseUrl = 'http://localhost:8088'
): Promise<boolean> {
  const relay = new PrintRelayClient(relayBaseUrl);

  try {
    const status = await relay.getStatus();
    if (!status.relayOnline) {
      return false;
    }

    // Use the relay's status endpoint with the printer's address
    const response = await fetch(
      `${relayBaseUrl}/check?ip=${encodeURIComponent(ipAddress)}&port=${port}`,
      { method: 'GET', signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) return false;
    const data = (await response.json()) as { reachable: boolean };
    return data.reachable;
  } catch {
    return false;
  }
}
