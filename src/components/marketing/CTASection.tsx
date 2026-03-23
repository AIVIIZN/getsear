'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

export function CTASection() {
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
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#F06B18] to-[#E05A0A] p-10 text-center md:p-16">
          <h2 className="text-[28px] font-bold text-white md:text-[40px]">
            Ready to switch?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[18px] leading-relaxed text-white/80">
            Book a 15-minute demo and see how Sear can save you thousands
            every month. No pressure, no contracts, no surprises.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/demo"
              className="btn-press inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[17px] font-semibold text-[#F06B18] shadow-lg transition-all hover:shadow-xl"
            >
              Book a Demo
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="btn-press inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-[17px] font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10"
            >
              See Pricing
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[14px] text-white/70">
            <span>No contracts</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Cancel anytime</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>No hidden fees</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Setup in under 2 hours</span>
          </div>
        </div>
      </div>
    </section>
  );
}
