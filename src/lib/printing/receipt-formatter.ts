/**
 * Receipt formatter — turns order data into ESC/POS commands
 * laid out for 80mm thermal paper (42 characters per line, Font A).
 */

import { ESCPOSBuilder, PreviewBuilder } from './escpos';
import type { ReceiptConfig } from './printer-interface';

// ---------- Receipt Data Types ----------

export interface ReceiptOrderItem {
  name: string;
  quantity: number;
  /** Price per unit in cents */
  unit_price_cents: number;
  /** Total for this line (qty * unit_price + modifier totals) in cents */
  total_cents: number;
  modifiers: ReceiptModifier[];
}

export interface ReceiptModifier {
  name: string;
  /** Additional price in cents (0 if no-charge modifier) */
  price_cents: number;
}

export interface ReceiptOrderData {
  order_number: string;
  order_type: string;
  server_name: string;
  table_name: string | null;
  guest_count: number | null;
  items: ReceiptOrderItem[];
  /** Subtotal in cents */
  subtotal_cents: number;
  /** Tax in cents */
  tax_cents: number;
  /** Tax rate as a percentage, e.g. 8.875 */
  tax_rate: number;
  /** Total (card price) in cents — includes surcharge */
  total_cents: number;
  /** Cash price in cents — no surcharge */
  cash_total_cents: number;
  /** Surcharge rate as a percentage, e.g. 4.0 */
  surcharge_rate: number;
  payment_method: string | null;
  auth_code: string | null;
  tip_cents: number | null;
  ordered_at: string;
}

export interface ReceiptLocationData {
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const RECEIPT_WIDTH = 42;

/**
 * Build ESC/POS receipt commands from order data.
 * Returns a Uint8Array ready to send to the printer.
 */
export function formatReceipt(
  order: ReceiptOrderData,
  location: ReceiptLocationData,
  config: ReceiptConfig
): Uint8Array {
  const builder = new ESCPOSBuilder();
  buildReceipt(builder, order, location, config);
  return builder.build();
}

/**
 * Build a plain-text receipt preview string.
 * Used by the ReceiptPreview component.
 */
export function formatReceiptPreview(
  order: ReceiptOrderData,
  location: ReceiptLocationData,
  config: ReceiptConfig
): string {
  const preview = new PreviewBuilder();
  buildReceipt(preview, order, location, config);
  return preview.getPreview();
}

type Builder = ESCPOSBuilder | PreviewBuilder;

function buildReceipt(
  b: Builder,
  order: ReceiptOrderData,
  location: ReceiptLocationData,
  config: ReceiptConfig
): void {
  b.initialize();

  // ===== HEADER =====
  b.align('center');
  b.doubleSize(true);
  b.bold(true);
  b.textLine(location.name);
  b.bold(false);
  b.doubleSize(false);

  b.textLine(location.address_line1);
  if (location.address_line2) {
    b.textLine(location.address_line2);
  }
  b.textLine(`${location.city}, ${location.state} ${location.zip}`);
  b.textLine(location.phone);

  if (config.header_text) {
    b.textLine(config.header_text);
  }

  b.align('left');
  b.horizontalLine('=', RECEIPT_WIDTH);

  // ===== ORDER INFO =====
  const orderDate = new Date(order.ordered_at);
  const dateStr = orderDate.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const timeStr = orderDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  b.twoColumns(`Order #${order.order_number}`, order.order_type, RECEIPT_WIDTH);
  b.twoColumns(`Server: ${order.server_name}`, `Date: ${dateStr}`, RECEIPT_WIDTH);

  if (order.table_name) {
    b.twoColumns(`Table: ${order.table_name}`, `Time: ${timeStr}`, RECEIPT_WIDTH);
  } else {
    b.twoColumns('', `Time: ${timeStr}`, RECEIPT_WIDTH);
  }

  if (order.guest_count) {
    b.textLine(`Guests: ${order.guest_count}`);
  }

  b.horizontalLine('-', RECEIPT_WIDTH);

  // ===== ITEMS =====
  for (const item of order.items) {
    const qtyStr = `${item.quantity}x `;
    const priceStr = formatMoney(item.total_cents);
    const nameMaxLen = RECEIPT_WIDTH - qtyStr.length - priceStr.length - 1;
    const displayName =
      item.name.length > nameMaxLen
        ? item.name.slice(0, nameMaxLen)
        : item.name;

    b.bold(true);
    b.twoColumns(`${qtyStr}${displayName}`, priceStr, RECEIPT_WIDTH);
    b.bold(false);

    // Modifiers indented
    for (const mod of item.modifiers) {
      const modPrice = mod.price_cents > 0 ? ` +${formatMoney(mod.price_cents)}` : '';
      b.textLine(`   + ${mod.name}${modPrice}`);
    }
  }

  b.horizontalLine('-', RECEIPT_WIDTH);

  // ===== TOTALS =====
  b.twoColumns('Subtotal', formatMoney(order.subtotal_cents), RECEIPT_WIDTH);
  b.twoColumns(
    `Tax (${order.tax_rate}%)`,
    formatMoney(order.tax_cents),
    RECEIPT_WIDTH
  );

  if (order.tip_cents && order.tip_cents > 0) {
    b.twoColumns('Tip', formatMoney(order.tip_cents), RECEIPT_WIDTH);
  }

  b.horizontalLine('=', RECEIPT_WIDTH);

  b.bold(true);
  b.fontSize(2);
  b.twoColumns('TOTAL', formatMoney(order.total_cents), RECEIPT_WIDTH / 2);
  b.fontSize(1);
  b.bold(false);

  // ===== DUAL PRICING =====
  if (config.show_dual_pricing && order.surcharge_rate > 0) {
    b.lineFeed();
    b.twoColumns(
      `Card Price (${order.surcharge_rate}% surcharge)`,
      formatMoney(order.total_cents),
      RECEIPT_WIDTH
    );
    b.bold(true);
    b.twoColumns('Cash Price', formatMoney(order.cash_total_cents), RECEIPT_WIDTH);
    b.bold(false);
  }

  b.lineFeed();

  // ===== PAYMENT =====
  if (order.payment_method) {
    b.twoColumns('Payment', order.payment_method, RECEIPT_WIDTH);
  }
  if (order.auth_code) {
    b.twoColumns('Auth Code', order.auth_code, RECEIPT_WIDTH);
  }

  // ===== TIP & SIGNATURE LINES =====
  if (!order.tip_cents || order.tip_cents === 0) {
    b.lineFeed();
    b.twoColumns('Tip:', '________', RECEIPT_WIDTH);
    b.lineFeed();
    b.twoColumns('Total:', '________', RECEIPT_WIDTH);
  }

  b.lineFeed(2);
  b.horizontalLine('_', 32);
  b.align('center');
  b.textLine('Signature');
  b.align('left');

  b.lineFeed();

  // ===== FOOTER =====
  if (config.footer_text) {
    b.align('center');
    b.textLine(config.footer_text);
    b.align('left');
  }

  // ===== QR CODE =====
  if (config.show_qr_code && config.qr_code_url) {
    b.lineFeed();
    b.align('center');
    b.qrCode(config.qr_code_url, 6);
    b.align('left');
  }

  b.lineFeed(2);
  b.cut();
}

/** Format cents to dollar string, e.g. 1250 => "$12.50" */
function formatMoney(cents: number): string {
  const negative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const sign = negative ? '-' : '';
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`;
}

// ===== Kitchen Ticket Formatter =====

export interface KitchenTicketData {
  order_number: string;
  order_type: string;
  server_name: string;
  table_name: string | null;
  seat_number: number | null;
  course_name: string | null;
  items: KitchenTicketItem[];
  is_void: boolean;
  is_refire: boolean;
  ordered_at: string;
}

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  modifiers: string[];
  special_instructions: string | null;
  seat_number: number | null;
}

/** Build ESC/POS commands for a kitchen ticket */
export function formatKitchenTicket(ticket: KitchenTicketData): Uint8Array {
  const b = new ESCPOSBuilder();

  b.initialize();

  // VOID / REFIRE header
  if (ticket.is_void) {
    b.align('center');
    b.doubleSize(true);
    b.bold(true);
    b.textLine('*** VOID ***');
    b.doubleSize(false);
    b.bold(false);
    b.align('left');
  } else if (ticket.is_refire) {
    b.align('center');
    b.doubleSize(true);
    b.bold(true);
    b.textLine('*** REFIRE ***');
    b.doubleSize(false);
    b.bold(false);
    b.align('left');
  }

  // Order info
  b.bold(true);
  b.fontSize(2);
  b.textLine(`#${ticket.order_number}  ${ticket.order_type}`);
  b.fontSize(1);
  b.bold(false);

  b.textLine(`Server: ${ticket.server_name}`);
  if (ticket.table_name) {
    b.textLine(`Table: ${ticket.table_name}`);
  }
  if (ticket.course_name) {
    b.bold(true);
    b.textLine(`Course: ${ticket.course_name}`);
    b.bold(false);
  }

  const orderTime = new Date(ticket.ordered_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  b.textLine(`Time: ${orderTime}`);

  b.horizontalLine('-', RECEIPT_WIDTH);

  // Items — large text for kitchen readability
  for (const item of ticket.items) {
    b.fontSize(2);
    b.bold(true);
    const seatPrefix = item.seat_number ? `S${item.seat_number} ` : '';
    b.textLine(`${item.quantity}x ${seatPrefix}${item.name}`);
    b.fontSize(1);
    b.bold(false);

    for (const mod of item.modifiers) {
      b.textLine(`   > ${mod}`);
    }

    if (item.special_instructions) {
      b.bold(true);
      b.textLine(`   ** ${item.special_instructions} **`);
      b.bold(false);
    }
  }

  b.lineFeed();
  b.cut();

  return b.build();
}

/** Build a test receipt for printer configuration testing */
export function formatTestReceipt(printerName: string, locationName: string): Uint8Array {
  const b = new ESCPOSBuilder();

  b.initialize();
  b.align('center');
  b.doubleSize(true);
  b.bold(true);
  b.textLine('TEST PRINT');
  b.doubleSize(false);
  b.bold(false);
  b.lineFeed();
  b.textLine(locationName);
  b.textLine(`Printer: ${printerName}`);
  b.lineFeed();

  b.align('left');
  b.horizontalLine('-', RECEIPT_WIDTH);

  // Print all text sizes
  b.textLine('Font A (normal):');
  b.textLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  b.textLine('abcdefghijklmnopqrstuvwxyz');
  b.textLine('0123456789 !@#$%^&*()');
  b.lineFeed();

  b.fontB();
  b.textLine('Font B (small):');
  b.textLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789');
  b.fontA();
  b.lineFeed();

  b.bold(true);
  b.textLine('Bold text');
  b.bold(false);

  b.underline(true);
  b.textLine('Underlined text');
  b.underline(false);

  b.fontSize(2);
  b.textLine('Double size');
  b.fontSize(1);

  b.horizontalLine('-', RECEIPT_WIDTH);

  // Two column alignment test
  b.twoColumns('Left aligned', 'Right aligned', RECEIPT_WIDTH);
  b.twoColumns('Subtotal', '$42.50', RECEIPT_WIDTH);
  b.twoColumns('Tax (8.875%)', '$3.77', RECEIPT_WIDTH);
  b.twoColumns('Total', '$46.27', RECEIPT_WIDTH);

  b.horizontalLine('-', RECEIPT_WIDTH);

  b.align('center');
  const now = new Date();
  b.textLine(
    now.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
  );
  b.textLine('Sear POS - getsear.com');
  b.lineFeed();

  // QR code test
  b.qrCode('https://getsear.com', 4);

  b.lineFeed(2);
  b.align('left');
  b.cut();

  return b.build();
}
