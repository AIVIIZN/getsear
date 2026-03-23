'use client';

import { FileWarning, CreditCard, Lock } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

const painPoints = [
  {
    icon: FileWarning,
    title: 'Tired of 2-year contracts?',
    description:
      'Toast, SpotOn, and others lock you into multi-year agreements with hefty termination fees. Sear is month-to-month. Cancel anytime. No penalty. Ever.',
    stat: '$0',
    statLabel: 'termination fees',
  },
  {
    icon: CreditCard,
    title: 'Paying too much in processing fees?',
    description:
      'Toast charges 2.49%+$0.15 per transaction and won\'t let you choose your processor. Sear partners with Valor for dual pricing, so your customers cover the card fee — saving you 2-3% on every swipe.',
    stat: '2-3%',
    statLabel: 'saved per transaction',
  },
  {
    icon: Lock,
    title: 'Hardware you can\'t take with you?',
    description:
      'Toast\'s proprietary terminals cost $799-$999 and become paperweights if you switch. Sear runs on any iPad ($329) or Android tablet. Your hardware, your choice.',
    stat: '$329',
    statLabel: 'iPad vs $999 Toast terminal',
  },
];

export function PainPoints() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section className="bg-white py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[#1C1C1E] md:text-[40px]">
            Sound familiar?
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[#78756D]">
            The POS industry profits from locking restaurants in. We built Sear
            to change that.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {painPoints.map((point, i) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="group relative rounded-2xl border border-[rgba(60,60,67,0.08)] bg-[#FDFBF7] p-8 transition-all duration-500 hover:border-[#F06B18]/20 hover:shadow-lg"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible
                    ? 'translateY(0)'
                    : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`,
                }}
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F06B18] transition-colors group-hover:bg-[#F06B18] group-hover:text-white">
                  <Icon size={24} />
                </div>
                <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
                  {point.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#78756D]">
                  {point.description}
                </p>
                <div className="mt-6 border-t border-[rgba(60,60,67,0.08)] pt-5">
                  <span className="text-[28px] font-bold text-[#F06B18]">
                    {point.stat}
                  </span>
                  <span className="ml-2 text-[14px] text-[#78756D]">
                    {point.statLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
