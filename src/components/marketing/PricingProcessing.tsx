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
          <h2 className="text-[32px] font-bold tracking-tight text-[#1C1C1E] md:text-[40px]">
            Processing fees? What processing fees?
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[#78756D]">
            Sear partners with Valor PayTech for Dual Pricing, which shifts
            the card processing cost to the cardholder — transparently and
            legally.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Traditional model */}
          <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-[#FDFBF7] p-8">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF3B30]/10 text-[#FF3B30]">
              <CreditCard size={22} />
            </div>
            <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
              Traditional Processing
            </h3>
            <p className="mt-2 text-[15px] text-[#78756D]">
              What most POS companies do
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  Visa/MC swipe
                </span>
                <span className="text-[14px] font-semibold text-[#FF3B30]">
                  2.49% + $0.15
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  Visa/MC keyed
                </span>
                <span className="text-[14px] font-semibold text-[#FF3B30]">
                  2.99% + $0.15
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  Amex
                </span>
                <span className="text-[14px] font-semibold text-[#FF3B30]">
                  3.09% + $0.15
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[15px] font-medium text-[#1C1C1E]">
                  On $50K/month
                </span>
                <span className="text-[17px] font-bold text-[#FF3B30]">
                  -$1,300/mo
                </span>
              </div>
            </div>
          </div>

          {/* Valor Dual Pricing */}
          <div className="rounded-2xl border-2 border-[#007AFF]/20 bg-[#FFF4EC]/30 p-8">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#34C759]/10 text-[#34C759]">
              <Shield size={22} />
            </div>
            <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
              Valor Dual Pricing
            </h3>
            <p className="mt-2 text-[15px] text-[#78756D]">
              What Sear offers through Valor PayTech
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  Cash price (customer pays)
                </span>
                <span className="text-[14px] font-semibold text-[#34C759]">
                  Listed price
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  Card price (customer pays)
                </span>
                <span className="text-[14px] font-semibold text-[#3D3D37]">
                  Listed + ~3.5% fee
                </span>
              </div>
              <div className="flex justify-between border-b border-[rgba(60,60,67,0.06)] pb-3">
                <span className="text-[14px] text-[#3D3D37]">
                  You receive
                </span>
                <span className="text-[14px] font-semibold text-[#34C759]">
                  Full listed price
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[15px] font-medium text-[#1C1C1E]">
                  Your processing cost
                </span>
                <span className="text-[17px] font-bold text-[#34C759]">
                  $0/mo*
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[13px] text-[#78756D]">
            * Dual Pricing is subject to Valor PayTech&apos;s merchant
            agreement and applicable state regulations. Card service fee is
            clearly disclosed to customers at point of sale. Sear does not
            process payments directly.
          </p>
          <Link
            href="/demo"
            className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-[#007AFF] hover:underline"
          >
            Learn more about Dual Pricing
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
