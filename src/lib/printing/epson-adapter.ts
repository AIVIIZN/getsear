/**
 * Epson printer adapter.
 * Supports network TCP connections.
 *
 * Models: TM-T88VII, TM-82II
 *
 * Epson printers use standard ESC/POS natively and support
 * Automatic Status Back (ASB) for real-time status reporting.
 */

import type {
  IPrinterAdapter,
  PrinterStatus,
  PrinterConfig,
} from './printer-interface';
import { ESCPOS, GS, ESC } from './escpos-commands';
import { PrintRelayClient } from './print-relay-client';

export class EpsonAdapter implements IPrinterAdapter {
  private config: PrinterConfig;
  private relay: PrintRelayClient;
  private connected = false;

  constructor(config: PrinterConfig, relayBaseUrl: string) {
    this.config = config;
    this.relay = new PrintRelayClient(relayBaseUrl);
  }

  async connect(): Promise<void> {
    if (!this.config.ip_address) {
      throw new Error('IP address required for Epson network connection');
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

    // Epson uses standard ESC/POS — prepend Epson-specific init
    const epsonInit = this.getEpsonInitSequence();
    const fullPayload = concatUint8Arrays(epsonInit, data);

    await this.relay.print({
      printerId: this.config.id,
      ipAddress: this.config.ip_address ?? '',
      port: this.config.port ?? 9100,
      data: fullPayload,
      connectionType: this.config.connection_type,
    });
  }

  async getStatus(): Promise<PrinterStatus> {
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
   * Epson-specific initialization.
   * Enables ASB (Automatic Status Back) for real-time monitoring.
   */
  private getEpsonInitSequence(): Uint8Array {
    return new Uint8Array([
      // Standard ESC @ initialize
      ...ESCPOS.INITIALIZE,
      // Enable ASB: GS a n — n=0xFF enables all status types
      GS, 0x61, 0xff,
      // Set print speed to high quality: ESC s 0
      ESC, 0x73, 0x00,
    ]);
  }

  /**
   * Parse Epson ASB (Automatic Status Back) response.
   * Epson sends 4 bytes of status automatically when enabled.
   *
   * Byte 1: Printer status (cover, online)
   * Byte 2: Offline status (cover, paper feed, error)
   * Byte 3: Error status (auto-cutter, unrecoverable, auto-recoverable)
   * Byte 4: Paper sensor (near end, out)
   */
  static parseEpsonASB(bytes: Uint8Array): PrinterStatus {
    if (bytes.length < 4) {
      return { online: false, paperOut: false, coverOpen: false, error: 'Invalid ASB response' };
    }

    const byte1 = bytes[0];
    const byte2 = bytes[1];
    const byte3 = bytes[2];
    const byte4 = bytes[3];

    const coverOpen = (byte1 & 0x04) !== 0;
    const offline = (byte2 & 0x04) !== 0;
    const cutterError = (byte3 & 0x08) !== 0;
    const unrecoverableError = (byte3 & 0x20) !== 0;
    const paperOut = (byte4 & 0x0c) !== 0;

    let error: string | null = null;
    if (unrecoverableError) {
      error = 'Unrecoverable printer error — power cycle required';
    } else if (cutterError) {
      error = 'Auto-cutter error — check for paper jam';
    }

    return {
      online: !offline,
      paperOut,
      coverOpen,
      error,
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
