'use client';

import { Check, X, Minus } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

type CellValue = boolean | string;

interface ComparisonRow {
  dimension: string;
  sear: CellValue;
  toast: CellValue;
  square: CellValue;
  spoton: CellValue;
  clover: CellValue;
  source?: string;
}

const comparisonData: ComparisonRow[] = [
  {
    dimension: 'Monthly software cost',
    sear: '$69-$199/terminal',
    toast: '$0-$340/mo + add-ons',
    square: '$0-$153/mo/location',
    spoton: '$25-$195/mo',
    clover: '$14.95-$84.95/mo',
    source: 'https://pos.toasttab.com/pricing',
  },
  {
    dimension: 'Contract length',
    sear: 'Month-to-month',
    toast: '2-year standard',
    square: 'Month-to-month',
    spoton: '1-3 year standard',
    clover: '1-3 year via reseller',
    source: 'https://pos.toasttab.com/legal/terms-of-service',
  },
  {
    dimension: 'Early termination fee',
    sear: '$0',
    toast: 'Up to remaining contract',
    square: '$0',
    spoton: 'Varies by contract',
    clover: 'Varies by reseller',
  },
  {
    dimension: 'Processing rates',
    sear: '0% (Valor Dual Pricing)',
    toast: '2.49-2.99% + $0.15',
    square: '2.6% + $0.10',
    spoton: '1.99% + $0.20 (qualified)',
    clover: '2.3-2.6% + $0.10',
    source: 'https://pos.toasttab.com/pricing',
  },
  {
    dimension: 'Choose your processor',
    sear: 'Valor (optimized rates)',
    toast: 'Toast only (locked in)',
    square: 'Square only',
    spoton: 'SpotOn only',
    clover: 'Fiserv only',
  },
  {
    dimension: 'Hardware cost',
    sear: 'BYOD iPad ($329)',
    toast: '$799-$999 (proprietary)',
    square: '$149-$799',
    spoton: '$400-$850',
    clover: '$599-$1,799',
    source: 'https://pos.toasttab.com/hardware',
  },
  {
    dimension: 'Online ordering commission',
    sear: '0% (included)',
    toast: '0% (paid plan) or 2.99%',
    square: '0% (paid plan)',
    spoton: '0% (included)',
    clover: 'Third-party only',
  },
  {
    dimension: 'KDS included',
    sear: true,
    toast: '$25/mo add-on',
    square: 'Paid add-on',
    spoton: true,
    clover: false,
  },
  {
    dimension: 'Loyalty program included',
    sear: 'Growth plan+',
    toast: '$50/mo add-on',
    square: '$45/mo add-on',
    spoton: true,
    clover: '$9.95/mo add-on',
    source: 'https://pos.toasttab.com/pricing',
  },
  {
    dimension: 'Offline mode',
    sear: true,
    toast: true,
    square: true,
    spoton: 'Limited',
    clover: 'Limited',
  },
  {
    dimension: 'Drive-thru support',
    sear: true,
    toast: true,
    square: false,
    spoton: false,
    clover: false,
  },
  {
    dimension: 'Catering & events',
    sear: true,
    toast: '$75/mo add-on',
    square: false,
    spoton: false,
    clover: false,
  },
  {
    dimension: 'Staff scheduling',
    sear: 'Growth plan+',
    toast: '$25/mo add-on',
    square: '$35/mo add-on',
    spoton: true,
    clover: 'Third-party',
  },
  {
    dimension: 'Inventory management',
    sear: 'Growth plan+',
    toast: '$25/mo add-on',
    square: 'Basic only',
    spoton: true,
    clover: 'Basic only',
  },
];

const providers = [
  { key: 'sear' as const, label: 'Sear', highlight: true },
  { key: 'toast' as const, label: 'Toast', highlight: false },
  { key: 'square' as const, label: 'Square', highlight: false },
  { key: 'spoton' as const, label: 'SpotOn', highlight: false },
  { key: 'clover' as const, label: 'Clover', highlight: false },
];

function CellContent({ value }: { value: CellValue }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check size={18} className="mx-auto text-[#34C759]" />
    ) : (
      <X size={18} className="mx-auto text-[#FF3B30]" />
    );
  }

  if (value === 'Limited') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-[#FF9500]">
        <Minus size={14} />
        Limited
      </span>
    );
  }

  return (
    <span className="text-[13px] leading-snug text-[#3D3D37]">{value}</span>
  );
}

export function ComparisonTable() {
  const { ref, isVisible } = useScrollFadeIn<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      <div className="overflow-x-auto rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-[rgba(60,60,67,0.12)]">
              <th className="sticky left-0 z-10 bg-white px-6 py-5 text-[14px] font-semibold text-[#78756D]">
                Feature
              </th>
              {providers.map((p) => (
                <th
                  key={p.key}
                  className={`px-5 py-5 text-center text-[15px] font-semibold ${
                    p.highlight
                      ? 'bg-[#FFF4EC] text-[#F06B18]'
                      : 'text-[#1C1C1E]'
                  }`}
                >
                  {p.label}
                  {p.highlight && (
                    <span className="mt-1 block text-[11px] font-normal text-[#9A4A12]">
                      Recommended
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, i) => (
              <tr
                key={row.dimension}
                className={`border-b border-[rgba(60,60,67,0.06)] ${
                  i % 2 === 0 ? 'bg-white' : 'bg-[#FDFBF7]'
                }`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-6 py-4 text-[14px] font-medium text-[#1C1C1E]">
                  {row.dimension}
                  {row.source && (
                    <a
                      href={row.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-[11px] text-[#007AFF] hover:underline"
                      title="Source"
                    >
                      [src]
                    </a>
                  )}
                </td>
                {providers.map((p) => (
                  <td
                    key={p.key}
                    className={`px-5 py-4 text-center ${
                      p.highlight ? 'bg-[#FFF4EC]/50' : ''
                    }`}
                  >
                    <CellContent value={row[p.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-[#78756D]">
        Pricing and feature data sourced from publicly available information on
        each provider&apos;s website as of March 2026. Actual rates and features
        may vary. Processing rates shown are standard published rates; custom
        rates may be available. Links marked [src] go to the original source.
      </p>
    </div>
  );
}
