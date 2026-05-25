'use client';

import { Shield, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useScrollFadeIn } from './useScrollFadeIn';

export function PricingProcessing() {
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
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[var(--color-text)] md:text-[40px]">
            Processing fees? What processing fees?
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-marketing-text-muted)]">
            Sear partners with Valor PayTech for Dual Pricing, which shifts
            the card processing cost to the cardholder — transparently and
            legally.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Traditional model */}
          <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-[var(--color-marketing-bg)] p-8">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-danger-strong)]/10 text-[var(--color-danger-strong)]">
              <CreditCard size={22} />
            </div>
            <h3 className="text-[20px] font-semibold text-[var(--color-text)]">
              Traditional Processing
            </h3>
            <p className="mt-2 text-[15px] text-[var(--color-marketing-text-muted)]">
              What most POS companies do
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  Visa/MC swipe
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-danger-strong)]">
                  2.49% + $0.15
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  Visa/MC keyed
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-danger-strong)]">
                  2.99% + $0.15
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  Amex
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-danger-strong)]">
                  3.09% + $0.15
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[15px] font-medium text-[var(--color-text)]">
                  On $50K/month
                </span>
                <span className="text-[17px] font-bold text-[var(--color-danger-strong)]">
                  -$1,300/mo
                </span>
              </div>
            </div>
          </div>

          {/* Valor Dual Pricing */}
          <div className="rounded-2xl border-2 border-[var(--color-primary)]/20 bg-[var(--color-marketing-bg-warm)]/30 p-8">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-success-strong)]/10 text-[var(--color-success-strong)]">
              <Shield size={22} />
            </div>
            <h3 className="text-[20px] font-semibold text-[var(--color-text)]">
              Valor Dual Pricing
            </h3>
            <p className="mt-2 text-[15px] text-[var(--color-marketing-text-muted)]">
              What Sear offers through Valor PayTech
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  Cash price (customer pays)
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-success-strong)]">
                  Listed price
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  Card price (customer pays)
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-marketing-text)]">
                  Listed + ~3.5% fee
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[var(--color-marketing-text)]">
                  You receive
                </span>
                <span className="text-[14px] font-semibold text-[var(--color-success-strong)]">
                  Full listed price
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[15px] font-medium text-[var(--color-text)]">
                  Your processing cost
                </span>
                <span className="text-[17px] font-bold text-[var(--color-success-strong)]">
                  $0/mo*
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[13px] text-[var(--color-marketing-text-muted)]">
            * Dual Pricing is subject to Valor PayTech&apos;s merchant
            agreement and applicable state regulations. Card service fee is
            clearly disclosed to customers at point of sale. Sear does not
            process payments directly.
          </p>
          <Link
            href="/demo"
            className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            Learn more about Dual Pricing
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
