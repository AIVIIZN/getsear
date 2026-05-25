'use client';

import { useMemo } from 'react';
import { formatReceiptPreview } from '@/lib/printing/receipt-formatter';
import type { ReceiptOrderData, ReceiptLocationData } from '@/lib/printing/receipt-formatter';
import type { ReceiptConfig } from '@/lib/printing/printer-interface';
import { cn } from '@/lib/utils';

interface ReceiptPreviewProps {
  order: ReceiptOrderData;
  location: ReceiptLocationData;
  config: ReceiptConfig;
  className?: string;
}

/**
 * Renders a live receipt preview styled to look like a thermal receipt.
 * Monospace font, off-white background, torn-edge bottom.
 */
export function ReceiptPreview({
  order,
  location,
  config,
  className,
}: ReceiptPreviewProps) {
  const previewText = useMemo(
    () => formatReceiptPreview(order, location, config),
    [order, location, config]
  );

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        className="relative w-[320px] bg-[var(--color-marketing-bg-subtle)] px-5 pt-6 pb-8 font-mono text-[11px] leading-[1.5] text-[var(--color-neutral-900-lower)] tracking-tight"
        style={{
          boxShadow:
            '0 2px 8px hsla(24, 20%, 20%, 0.08), 0 4px 16px hsla(24, 20%, 20%, 0.06)',
          borderRadius: '4px 4px 0 0',
        }}
      >
        <pre className="whitespace-pre-wrap break-words m-0 p-0">
          {previewText}
        </pre>

        {/* Torn edge bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-4 -mb-4"
          style={{
            background: 'var(--color-marketing-bg-subtle)',
            maskImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'16\' viewBox=\'0 0 20 16\'%3E%3Cpath d=\'M0,0 L5,16 L10,0 L15,16 L20,0 L20,16 L0,16 Z\' fill=\'black\'/%3E%3C/svg%3E")',
            WebkitMaskImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'16\' viewBox=\'0 0 20 16\'%3E%3Cpath d=\'M0,0 L5,16 L10,0 L15,16 L20,0 L20,16 L0,16 Z\' fill=\'black\'/%3E%3C/svg%3E")',
            maskSize: '20px 16px',
            WebkitMaskSize: '20px 16px',
            maskRepeat: 'repeat-x',
            WebkitMaskRepeat: 'repeat-x',
          }}
        />
      </div>

      {/* Shadow below torn edge */}
      <div className="w-[300px] h-3 rounded-b-lg bg-gradient-to-b from-black/5 to-transparent" />
    </div>
  );
}

/** Sample data for previewing receipt layout in the config form */
export function getSampleReceiptData(): {
  order: ReceiptOrderData;
  location: ReceiptLocationData;
} {
  return {
    order: {
      order_number: '1042',
      order_type: 'Dine-In',
      server_name: 'Sarah M.',
      table_name: 'Table 12',
      guest_count: 4,
      items: [
        {
          name: 'Wagyu Burger',
          quantity: 2,
          unit_price_cents: 2400,
          total_cents: 5200,
          modifiers: [
            { name: 'Add Bacon', price_cents: 200 },
            { name: 'Medium Rare', price_cents: 0 },
          ],
        },
        {
          name: 'Caesar Salad',
          quantity: 1,
          unit_price_cents: 1400,
          total_cents: 1400,
          modifiers: [
            { name: 'No Croutons', price_cents: 0 },
          ],
        },
        {
          name: 'Craft IPA',
          quantity: 3,
          unit_price_cents: 900,
          total_cents: 2700,
          modifiers: [],
        },
      ],
      subtotal_cents: 9300,
      tax_cents: 825,
      tax_rate: 8.875,
      total_cents: 10525,
      cash_total_cents: 10125,
      surcharge_rate: 4.0,
      payment_method: 'Visa *4242',
      auth_code: 'A12345',
      tip_cents: null,
      ordered_at: new Date().toISOString(),
    },
    location: {
      name: 'Sear Steakhouse',
      address_line1: '123 Main Street',
      address_line2: null,
      city: 'Brooklyn',
      state: 'NY',
      zip: '11201',
      phone: '(718) 555-0199',
    },
  };
}
