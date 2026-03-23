'use client';

import { Tablet, Check, X } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

const hardwareComparison = [
  {
    provider: 'Sear',
    device: 'Any iPad or Android tablet',
    cost: '$329',
    costNote: 'one-time (you own it)',
    ownership: 'You own it',
    portable: true,
    highlight: true,
  },
  {
    provider: 'Toast',
    device: 'Toast Flex, Toast Go 2',
    cost: '$799-$999',
    costNote: 'or $0 down + contract lock-in',
    ownership: 'Proprietary — useless if you switch',
    portable: false,
    highlight: false,
  },
  {
    provider: 'Square',
    device: 'Square Terminal, Square Register',
    cost: '$149-$799',
    costNote: 'one-time',
    ownership: 'Proprietary to Square ecosystem',
    portable: false,
    highlight: false,
  },
  {
    provider: 'SpotOn',
    device: 'SpotOn Station, SpotOn Sidekick',
    cost: '$400-$850',
    costNote: 'or subsidized with contract',
    ownership: 'SpotOn proprietary',
    portable: false,
    highlight: false,
  },
  {
    provider: 'Clover',
    device: 'Clover Station Duo, Clover Flex',
    cost: '$599-$1,799',
    costNote: 'often leased through reseller',
    ownership: 'Locked to Fiserv/Clover',
    portable: false,
    highlight: false,
  },
];

export function PricingHardware() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section id="hardware" className="bg-[#FDFBF7] py-20 md:py-28" ref={ref}>
      <div
        className="mx-auto max-w-7xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF4EC] px-4 py-1.5">
            <Tablet size={16} className="text-[#F06B18]" />
            <span className="text-[13px] font-semibold text-[#9A4A12]">
              No Proprietary Hardware
            </span>
          </div>
          <h2 className="text-[32px] font-bold tracking-tight text-[#1C1C1E] md:text-[40px]">
            Your iPad. Your hardware. Your choice.
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[#78756D]">
            Why pay $999 for a terminal that becomes a paperweight? Sear runs
            on the iPad you already own, or buy one for $329.
          </p>
        </div>

        <div className="mt-16 overflow-x-auto rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-[rgba(60,60,67,0.12)]">
                <th className="px-6 py-4 text-[13px] font-semibold uppercase tracking-wider text-[#78756D]">
                  Provider
                </th>
                <th className="px-6 py-4 text-[13px] font-semibold uppercase tracking-wider text-[#78756D]">
                  Device
                </th>
                <th className="px-6 py-4 text-[13px] font-semibold uppercase tracking-wider text-[#78756D]">
                  Cost
                </th>
                <th className="px-6 py-4 text-center text-[13px] font-semibold uppercase tracking-wider text-[#78756D]">
                  Works if you switch
                </th>
              </tr>
            </thead>
            <tbody>
              {hardwareComparison.map((hw, i) => (
                <tr
                  key={hw.provider}
                  className={`border-b border-[rgba(60,60,67,0.06)] ${
                    hw.highlight
                      ? 'bg-[#FFF4EC]/50'
                      : i % 2 === 0
                        ? 'bg-white'
                        : 'bg-[#FDFBF7]'
                  }`}
                >
                  <td className="px-6 py-4">
                    <span
                      className={`text-[15px] font-semibold ${
                        hw.highlight ? 'text-[#F06B18]' : 'text-[#1C1C1E]'
                      }`}
                    >
                      {hw.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-[#3D3D37]">
                    {hw.device}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[15px] font-semibold ${
                        hw.highlight ? 'text-[#34C759]' : 'text-[#1C1C1E]'
                      }`}
                    >
                      {hw.cost}
                    </span>
                    <span className="block text-[12px] text-[#78756D]">
                      {hw.costNote}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {hw.portable ? (
                      <Check
                        size={20}
                        className="mx-auto text-[#34C759]"
                      />
                    ) : (
                      <X
                        size={20}
                        className="mx-auto text-[#FF3B30]"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8 md:p-10">
          <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
            Compatible hardware
          </h3>
          <p className="mt-2 text-[15px] text-[#78756D]">
            Sear works with standard, off-the-shelf hardware. No proprietary lock-in.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Tablets',
                items: 'iPad (any model), Android tablets',
              },
              {
                label: 'Receipt printers',
                items: 'Star Micronics, Epson (ESC/POS)',
              },
              {
                label: 'Payment terminals',
                items: 'Valor VP800, VP550, VP300 Pro, RCKT',
              },
              {
                label: 'Peripherals',
                items: 'Any RJ-11 cash drawer, barcode scanners',
              },
            ].map((cat) => (
              <div key={cat.label}>
                <p className="text-[14px] font-semibold text-[#1C1C1E]">
                  {cat.label}
                </p>
                <p className="mt-1 text-[13px] text-[#78756D]">
                  {cat.items}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
