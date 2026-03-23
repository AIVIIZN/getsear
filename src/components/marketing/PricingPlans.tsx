'use client';

import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import { useScrollFadeIn } from './useScrollFadeIn';

interface Plan {
  name: string;
  price: number;
  period: string;
  description: string;
  popular: boolean;
  features: string[];
  cta: string;
  ctaHref: string;
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 69,
    period: '/mo per terminal',
    description:
      'Everything you need to run a single-location restaurant. No contracts.',
    popular: false,
    features: [
      'Full POS order entry (9 order types)',
      'Kitchen Display System (KDS)',
      'Menu management with modifiers',
      'Table management & floor plans',
      'Staff management & clock in/out',
      'Sales & labor reports',
      'Cash & card payments (Valor)',
      'Receipt printing (Star, Epson)',
      'Offline mode with auto-sync',
      'Email & chat support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/demo',
  },
  {
    name: 'Growth',
    price: 129,
    period: '/mo per terminal',
    description:
      'For restaurants ready to grow revenue with online ordering, loyalty, and marketing.',
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'Commission-free online ordering',
      'Loyalty program (points, visits, spend)',
      'Customer CRM & VIP management',
      'Email & SMS marketing campaigns',
      'Staff scheduling & labor forecast',
      'Inventory tracking & food cost',
      'Reservations & waitlist with SMS',
      'Advanced analytics & PMIX reports',
      'Priority support (phone + chat)',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/demo',
  },
  {
    name: 'Enterprise',
    price: 199,
    period: '/mo per terminal',
    description:
      'For multi-location groups and franchises. Volume discounts available.',
    popular: false,
    features: [
      'Everything in Growth, plus:',
      'Multi-location management',
      'Franchise royalty reporting',
      'Catering & event management',
      'Delivery zone management',
      'Drive-thru lane management',
      'House accounts & corporate billing',
      'Custom integrations & API access',
      'Consolidated cross-location reports',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    ctaHref: '/demo',
  },
];

export function PricingPlans() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section className="bg-[#FDFBF7] py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-[#34C759]/20 bg-[#34C759]/10 px-4 py-1.5">
            <span className="text-[13px] font-semibold text-[#34C759]">
              No contracts. No hidden fees. Cancel anytime.
            </span>
          </div>
          <h2 className="text-[32px] font-bold tracking-tight text-[#1C1C1E] md:text-[40px]">
            Transparent pricing. Always.
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[#78756D]">
            We publish everything. No &ldquo;contact sales for pricing.&rdquo;
            What you see is what you pay.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-500 ${
                plan.popular
                  ? 'border-[#F06B18]/30 bg-white shadow-xl shadow-[#F06B18]/10 md:-mt-4 md:mb-[-16px] md:pb-12 md:pt-10'
                  : 'border-[rgba(60,60,67,0.08)] bg-white'
              }`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? 'translateY(0)'
                  : 'translateY(24px)',
                transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F06B18] px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-white shadow-lg shadow-[#F06B18]/25">
                    <Star size={12} className="fill-white" />
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-[20px] font-semibold text-[#1C1C1E]">
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[48px] font-bold tracking-tight text-[#1C1C1E]">
                  ${plan.price}
                </span>
                <span className="text-[15px] text-[#78756D]">
                  {plan.period}
                </span>
              </div>

              <p className="mt-3 text-[15px] leading-relaxed text-[#78756D]">
                {plan.description}
              </p>

              <Link
                href={plan.ctaHref}
                className={`btn-press mt-8 inline-flex items-center justify-center rounded-full py-3.5 text-[15px] font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-[#F06B18] text-white shadow-lg shadow-[#F06B18]/25 hover:bg-[#E05A0A]'
                    : 'bg-[#1C1C1E] text-white hover:bg-[#2C2C2E]'
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-8 flex-1 space-y-3 border-t border-[rgba(60,60,67,0.08)] pt-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-[14px] text-[#3D3D37]"
                  >
                    {feature.endsWith(':') ? (
                      <span className="font-semibold text-[#1C1C1E]">
                        {feature}
                      </span>
                    ) : (
                      <>
                        <Check
                          size={16}
                          className="mt-0.5 shrink-0 text-[#34C759]"
                        />
                        {feature}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
