/**
 * HTTP client for communicating with the local print relay service.
 *
 * The print relay runs on the restaurant's local network (same LAN as printers).
 * It receives print jobs from the Sear web app and forwards them to printers
 * via TCP socket connections. This is necessary because browsers cannot open
 * raw TCP sockets to printers directly.
 *
 * Default relay URL: http://localhost:8088
 */

import type {
  PrinterStatus,
  ConnectionType,
  DiscoveredPrinter,
} from './printer-interface';

interface PrintRequest {
  printerId: string;
  ipAddress: string;
  port: number;
  data: Uint8Array;
  connectionType: ConnectionType;
}

interface RelayStatus {
  relayOnline: boolean;
  version: string;
  connectedPrinters: number;
  uptime: number;
}

const DEFAULT_TIMEOUT = 10_000; // 10 seconds

export class PrintRelayClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8088') {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Send a print job to the relay, which forwards it to the printer.
   */
  async print(request: PrintRequest): Promise<void> {
    // Convert Uint8Array to base64 for JSON transport
    const base64Data = uint8ArrayToBase64(request.data);

    const response = await fetchWithTimeout(`${this.baseUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_id: request.printerId,
        ip_address: request.ipAddress,
        port: request.port,
        data: base64Data,
        connection_type: request.connectionType,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error');
      throw new PrintRelayError(
        `Print relay error (${response.status}): ${body}`,
        response.status
      );
    }
  }

  /**
   * Check the relay service health and status.
   */
  async getStatus(): Promise<RelayStatus> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/status`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          relayOnline: false,
          version: 'unknown',
          connectedPrinters: 0,
          uptime: 0,
        };
      }

      const data = (await response.json()) as RelayStatus;
      return { ...data, relayOnline: true };
    } catch {
      return {
        relayOnline: false,
        version: 'unknown',
        connectedPrinters: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Get the status of a specific printer via the relay.
   */
  async getPrinterStatus(printerId: string): Promise<PrinterStatus> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/status/${encodeURIComponent(printerId)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new PrintRelayError(
        `Failed to get printer status (${response.status})`,
        response.status
      );
    }

    return (await response.json()) as PrinterStatus;
  }

  /**
   * Discover printers on the local network.
   * The relay service scans for printers using mDNS/SNMP.
   */
  async discover(): Promise<DiscoveredPrinter[]> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/discover`, {
        method: 'GET',
      }, 30_000); // Discovery can take up to 30 seconds

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { printers: DiscoveredPrinter[] };
      return data.printers ?? [];
    } catch {
      return [];
    }
  }
}

export class PrintRelayError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PrintRelayError';
    this.statusCode = statusCode;
  }
}

/**
 * fetch() with a timeout via AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PrintRelayError(
        `Print relay request timed out after ${timeout}ms`,
        0
      );
    }
    throw new PrintRelayError(
      `Print relay connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      0
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert Uint8Array to base64 string for JSON transport.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
