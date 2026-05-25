'use client';

import {
  ShoppingCart,
  Monitor,
  BookOpen,
  BarChart3,
  Globe,
  WifiOff,
} from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

const features = [
  {
    icon: ShoppingCart,
    title: 'Order Entry',
    description:
      'Fast, intuitive order flow built for touchscreens. 9 order types, coursing, split checks, modifier trees, and real-time KDS sync.',
  },
  {
    icon: Monitor,
    title: 'Kitchen Display (KDS)',
    description:
      'Bump-screen workflow with aging timers, expo mode, station routing, and ticket recall. Replace your paper printers.',
  },
  {
    icon: BookOpen,
    title: 'Menu Management',
    description:
      'Categories, modifier groups, 86 toggle, 9 price levels, allergen tagging, and daypart scheduling. Update across all stations instantly.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description:
      'Sales, labor cost, PMIX, server performance, speed of service, and franchise royalties. Real data to drive real decisions.',
  },
  {
    icon: Globe,
    title: 'Online Ordering',
    description:
      'Commission-free ordering through your own branded page. No per-order fees. QR code ordering, scheduled pickup, and delivery integration.',
  },
  {
    icon: WifiOff,
    title: 'Offline Mode',
    description:
      'Keep taking orders when the internet drops. Full offline queue with automatic sync when connectivity returns. Never lose a sale.',
  },
];

export function FeatureHighlights() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section id="features" className="bg-[var(--color-marketing-bg)] py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[var(--color-text)] md:text-[40px]">
            Everything you need to run your restaurant
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-marketing-text-muted)]">
            21 modules. One platform. No add-on pricing surprises.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8 transition-all duration-300 hover:border-[var(--color-primary)]/20 hover:shadow-md"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible
                    ? 'translateY(0)'
                    : 'translateY(20px)',
                  transition: `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s`,
                }}
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-marketing-bg-warm)] text-[var(--color-primary)]">
                  <Icon size={22} />
                </div>
                <h3 className="text-[18px] font-semibold text-[var(--color-text)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-marketing-text-muted)]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
