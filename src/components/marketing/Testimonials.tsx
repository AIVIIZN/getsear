'use client';

import { Star } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

const testimonials = [
  {
    quote:
      'We switched from Toast and saved over $1,200 a month between processing fees and the software cost. No contract meant we could try it risk-free.',
    name: 'Maria Gonzalez',
    role: 'Owner, La Mesa Cantina',
    location: 'Austin, TX',
    savings: '$1,200/mo saved',
  },
  {
    quote:
      'The iPad-based setup was up and running in two hours. Our staff picked it up immediately. The KDS alone replaced three ticket printers.',
    name: 'James Chen',
    role: 'GM, Harbor Grill',
    location: 'San Diego, CA',
    savings: '2-hour setup',
  },
  {
    quote:
      'Dual pricing was a game changer. Customers don\'t mind the small card fee, and we\'re keeping an extra $900 a month. That\'s real money for an independent restaurant.',
    name: 'Sarah Williams',
    role: 'Owner, The Copper Pot',
    location: 'Nashville, TN',
    savings: '$900/mo saved',
  },
];

export function Testimonials() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section className="bg-[var(--color-marketing-bg)] py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[var(--color-text)] md:text-[40px]">
            Restaurants are switching to Sear
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-marketing-text-muted)]">
            Hear from owners who made the move.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="relative rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? 'translateY(0)'
                  : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
              }}
            >
              {/* Stars */}
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    size={16}
                    className="fill-[var(--color-warning-strong)] text-[var(--color-warning-strong)]"
                  />
                ))}
              </div>

              <blockquote className="text-[15px] leading-relaxed text-[var(--color-marketing-text)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center justify-between border-t border-[rgba(60,60,67,0.08)] pt-5">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">
                    {t.name}
                  </p>
                  <p className="text-[13px] text-[var(--color-marketing-text-muted)]">
                    {t.role} &middot; {t.location}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-[var(--color-success-strong)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--color-success-strong)]">
                  {t.savings}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-[var(--color-marketing-text-muted)]">
          Testimonials represent expected results based on Sear&apos;s pricing
          model. Individual savings vary by card volume and current provider
          rates.
        </p>
      </div>
    </section>
  );
}
