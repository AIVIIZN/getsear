/**
 * Star Micronics printer adapter.
 * Supports network TCP and CloudPRNT (HTTP polling) connections.
 *
 * Models: TSP143IV, TSP143III, mC-Print3, mPOP, SM-L200
 *
 * Network TCP: Direct socket connection to port 9100 (via print relay).
 * CloudPRNT: Printer polls the Sear server for jobs via HTTP —
 *   the adapter queues jobs and the CloudPRNT endpoint serves them.
 */

import type {
  IPrinterAdapter,
  PrinterStatus,
  PrinterConfig,
} from './printer-interface';
import { ESCPOS } from './escpos-commands';
import { PrintRelayClient } from './print-relay-client';

export class StarMicronicsAdapter implements IPrinterAdapter {
  private config: PrinterConfig;
  private relay: PrintRelayClient;
  private connected = false;

  constructor(config: PrinterConfig, relayBaseUrl: string) {
    this.config = config;
    this.relay = new PrintRelayClient(relayBaseUrl);
  }

  async connect(): Promise<void> {
    if (this.config.connection_type === 'cloudprnt') {
      // CloudPRNT printers poll us — "connecting" just validates the config
      this.connected = true;
      return;
    }

    // Network TCP — verify printer is reachable via relay
    if (!this.config.ip_address) {
      throw new Error('IP address required for network connection');
    }

    const status = await this.relay.getStatus();
    if (!status.relayOnline) {
      throw new Error(
        'Print relay service is not running. Start the relay on the local network.'
      );
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error('Printer not connected. Call connect() first.');
    }

    // Star printers use standard ESC/POS with a Star-specific initialization
    // Prepend Star initialization sequence if needed
    const starInit = this.getStarInitSequence();
    const fullPayload = concatUint8Arrays(starInit, data);

    await this.relay.print({
      printerId: this.config.id,
      ipAddress: this.config.ip_address ?? '',
      port: this.config.port ?? 9100,
      data: fullPayload,
      connectionType: this.config.connection_type,
    });
  }

  async getStatus(): Promise<PrinterStatus> {
    if (this.config.connection_type === 'cloudprnt') {
      // CloudPRNT printers report status via their polling requests
      // We return the last known status from the relay cache
      try {
        const relayStatus = await this.relay.getPrinterStatus(this.config.id);
        return relayStatus;
      } catch {
        return {
          online: false,
          paperOut: false,
          coverOpen: false,
          error: 'Unable to reach CloudPRNT printer',
        };
      }
    }

    // Network TCP — send DLE EOT status request via relay
    try {
      const relayStatus = await this.relay.getPrinterStatus(this.config.id);
      return relayStatus;
    } catch {
      return {
        online: false,
        paperOut: false,
        coverOpen: false,
        error: 'Printer unreachable',
      };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Star-specific initialization bytes.
   * Includes ESC @ (initialize) plus Star mode settings.
   */
  private getStarInitSequence(): Uint8Array {
    // Standard ESC/POS init works for Star printers in ESC/POS emulation mode
    // Most Star printers ship in ESC/POS mode by default
    return new Uint8Array([...ESCPOS.INITIALIZE]);
  }

  /**
   * Parse Star Micronics ASB (Automatic Status Back) response bytes.
   * Star uses a 4-byte status block.
   */
  static parseStarStatus(bytes: Uint8Array): PrinterStatus {
    if (bytes.length < 4) {
      return { online: false, paperOut: false, coverOpen: false, error: 'Invalid status response' };
    }

    const byte1 = bytes[0];
    const byte2 = bytes[1];
    const byte3 = bytes[2];

    const coverOpen = (byte1 & 0x20) !== 0;
    const offline = (byte1 & 0x08) !== 0;
    const paperOut = (byte2 & 0x0c) !== 0;
    const hasError = (byte3 & 0x40) !== 0;

    return {
      online: !offline,
      paperOut,
      coverOpen,
      error: hasError ? 'Printer error detected' : null,
    };
  }
}

/** Helper to concatenate two Uint8Arrays */
function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
