'use client';

import { TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useScrollFadeIn } from './useScrollFadeIn';

export function DualPricingCallout() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section className="bg-white py-20 md:py-28" ref={ref}>
      <div
        className="mx-auto max-w-7xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-text)] to-[var(--color-bg-muted)]">
          <div className="grid items-center gap-10 p-8 md:grid-cols-2 md:p-14">
            {/* Left: text */}
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)]/20 px-4 py-1.5">
                <TrendingUp size={16} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-semibold text-[var(--color-primary)]">
                  Valor Dual Pricing
                </span>
              </div>

              <h2 className="text-[28px] font-bold leading-tight text-white md:text-[36px]">
                Stop giving away 2&ndash;3% on every card transaction
              </h2>

              <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-neutral-350)]">
                With Valor Dual Pricing, customers see a cash price and a card
                price. Card users cover the processing fee. Cash users get a
                discount. You keep more of every dollar.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pricing#calculator"
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-alt)]"
                >
                  Calculate Your Savings
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* Right: numbers */}
            <div className="space-y-5">
              {/* Example card */}
              <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm">
                <p className="text-[14px] font-medium text-[var(--color-neutral-350)]">
                  Example: $50,000/month in card volume
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] text-[var(--color-neutral-350)]">
                      Traditional processing (2.6%)
                    </span>
                    <span className="text-[17px] font-semibold text-[var(--color-danger-strong)]">
                      &minus;$1,300/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] text-[var(--color-neutral-350)]">
                      Valor Dual Pricing
                    </span>
                    <span className="text-[17px] font-semibold text-[var(--color-success-strong)]">
                      $0/mo*
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-medium text-white">
                        Your savings
                      </span>
                      <span className="text-[24px] font-bold text-[var(--color-primary)]">
                        $1,300/mo
                      </span>
                    </div>
                    <p className="mt-1 text-right text-[14px] text-[var(--color-neutral-350)]">
                      That&apos;s <span className="font-semibold text-white">$15,600/year</span> back
                      in your pocket
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-[var(--color-marketing-text-muted)]">
                * Valor Dual Pricing shifts the card processing cost to the
                cardholder via a clearly disclosed service fee. Sear does not
                process payments directly. Rates subject to Valor&apos;s
                merchant agreement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
