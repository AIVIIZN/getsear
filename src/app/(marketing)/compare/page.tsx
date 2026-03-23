import type { Metadata } from 'next';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Compare',
  description:
    'See how Sear POS compares to Toast, Square, SpotOn, and Clover. Side-by-side comparison of pricing, features, contracts, hardware, and processing rates.',
  openGraph: {
    title: 'Compare POS Systems | Sear POS',
    description:
      'Side-by-side comparison of Sear vs Toast vs Square vs SpotOn vs Clover. Pricing, contracts, hardware, features.',
    url: 'https://getsear.com/compare',
  },
};

export default function ComparePage() {
  return (
    <>
      <section className="bg-[#FDFBF7] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-[40px] font-bold tracking-tight text-[#1C1C1E] md:text-[52px]">
              How Sear compares
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-[#78756D] md:text-[20px]">
              An honest, side-by-side comparison. Every claim sourced. No spin.
            </p>
          </div>

          <div className="mt-16">
            <ComparisonTable />
          </div>

          {/* Summary cards */}
          <div className="mt-20 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8">
              <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
                vs. Toast
              </h3>
              <ul className="mt-4 space-y-3 text-[14px] text-[#3D3D37]">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  No 2-year contract (Toast requires one)
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  BYOD iPad vs $999 proprietary terminal
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  0% processing vs 2.49%+ locked rates
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  KDS included vs $25/mo add-on
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  Loyalty included (Growth) vs $50/mo add-on
                </li>
              </ul>
              <p className="mt-4 text-[12px] text-[#78756D]">
                Source:{' '}
                <a
                  href="https://pos.toasttab.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007AFF] hover:underline"
                >
                  Toast pricing page
                </a>
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8">
              <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
                vs. Square
              </h3>
              <ul className="mt-4 space-y-3 text-[14px] text-[#3D3D37]">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  0% processing vs 2.6% + $0.10
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  Full KDS included vs paid add-on
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  Drive-thru and catering support (Square lacks)
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  Built for restaurants (Square is general retail)
                </li>
              </ul>
              <p className="mt-4 text-[12px] text-[#78756D]">
                Source:{' '}
                <a
                  href="https://squareup.com/us/en/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007AFF] hover:underline"
                >
                  Square pricing page
                </a>
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8">
              <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
                vs. SpotOn
              </h3>
              <ul className="mt-4 space-y-3 text-[14px] text-[#3D3D37]">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  No 1-3 year contract (SpotOn often requires)
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  0% processing vs 1.99-2.89%
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  BYOD hardware vs $400-$850 proprietary
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                  Drive-thru and catering built-in
                </li>
              </ul>
              <p className="mt-4 text-[12px] text-[#78756D]">
                Source:{' '}
                <a
                  href="https://www.spoton.com/restaurant-pos/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007AFF] hover:underline"
                >
                  SpotOn pricing page
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
      <CTASection />
    </>
  );
}
