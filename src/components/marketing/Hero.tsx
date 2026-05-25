import Link from 'next/link';
import { DeviceMockup } from './DeviceMockup';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-marketing-bg)] pb-16 pt-12 md:pb-24 md:pt-20">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--color-marketing-bg-warm)]/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text content */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-marketing-bg-warm)] px-4 py-1.5">
              <span className="text-[13px] font-semibold text-[var(--color-marketing-accent-dark)]">
                No contracts. No lock-in. Ever.
              </span>
            </div>

            <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight text-[var(--color-text)] md:text-[56px]">
              The Restaurant POS That Doesn&apos;t{' '}
              <span className="text-[var(--color-primary)]">Lock You In</span>
            </h1>

            <p className="mt-6 text-[18px] leading-relaxed text-[var(--color-marketing-text-muted)] md:text-[20px]">
              Month-to-month pricing. No proprietary hardware. Keep 2&ndash;3%
              more on every card swipe with Valor Dual Pricing. Built for
              independent restaurants and multi-location groups.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/pricing"
                className="btn-press inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-8 py-4 text-[17px] font-semibold text-white shadow-lg shadow-[var(--color-primary)]/25 transition-all hover:bg-[var(--color-primary-alt)] hover:shadow-xl hover:shadow-[var(--color-primary)]/30"
              >
                See Pricing
              </Link>
              <Link
                href="/demo"
                className="btn-press inline-flex items-center justify-center rounded-full border border-[rgba(60,60,67,0.12)] bg-white px-8 py-4 text-[17px] font-semibold text-[var(--color-text)] shadow-sm transition-all hover:border-[rgba(60,60,67,0.20)] hover:shadow-md"
              >
                Book a Demo
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap items-center gap-6 text-[14px] text-[var(--color-marketing-text-muted)]">
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-success-strong)]">
                  <path d="M13.3 4.7L6.5 11.5L2.7 7.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                No contracts
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-success-strong)]">
                  <path d="M13.3 4.7L6.5 11.5L2.7 7.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Cancel anytime
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-success-strong)]">
                  <path d="M13.3 4.7L6.5 11.5L2.7 7.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                No hidden fees
              </span>
            </div>
          </div>

          {/* iPad mockup */}
          <div className="relative">
            <DeviceMockup className="w-full max-w-[560px]">
              {/* Simulated POS screen */}
              <div className="flex h-full w-full flex-col bg-[var(--color-bg-muted)]">
                {/* Top bar */}
                <div className="flex items-center justify-between bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-[var(--color-primary)]" />
                    <span className="text-[11px] font-semibold text-[var(--color-text)] md:text-[13px]">
                      Sear POS
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-md bg-[var(--color-neutral-150)] px-2 py-1 text-[9px] font-medium text-[var(--color-marketing-text)] md:text-[11px]">
                      Table 4
                    </div>
                    <div className="rounded-md bg-[var(--color-success-strong)]/10 px-2 py-1 text-[9px] font-medium text-[var(--color-success-strong)] md:text-[11px]">
                      Connected
                    </div>
                  </div>
                </div>
                {/* Content area */}
                <div className="flex flex-1">
                  {/* Menu grid */}
                  <div className="flex-1 p-3">
                    <div className="mb-2 flex gap-2">
                      {['Appetizers', 'Entrees', 'Drinks'].map((cat) => (
                        <div
                          key={cat}
                          className={`rounded-full px-2.5 py-1 text-[8px] font-medium md:text-[10px] ${
                            cat === 'Entrees'
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-white text-[var(--color-marketing-text)]'
                          }`}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'Ribeye Steak', price: '$42' },
                        { name: 'Grilled Salmon', price: '$28' },
                        { name: 'Chicken Parm', price: '$22' },
                        { name: 'Pasta Primavera', price: '$18' },
                        { name: 'Caesar Salad', price: '$14' },
                        { name: 'Lobster Tail', price: '$52' },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="rounded-lg bg-white p-2 shadow-sm"
                        >
                          <div className="mb-1 h-6 rounded bg-[var(--color-neutral-150)] md:h-8" />
                          <p className="text-[7px] font-medium text-[var(--color-text)] md:text-[9px]">
                            {item.name}
                          </p>
                          <p className="text-[7px] font-semibold text-[var(--color-primary)] md:text-[9px]">
                            {item.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Order panel */}
                  <div className="w-[30%] border-l border-[rgba(60,60,67,0.12)] bg-white p-2">
                    <p className="text-[8px] font-semibold text-[var(--color-text)] md:text-[10px]">
                      Current Order
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { name: 'Ribeye Steak', qty: 1, price: '$42.00' },
                        { name: 'Caesar Salad', qty: 2, price: '$28.00' },
                        { name: 'Grilled Salmon', qty: 1, price: '$28.00' },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <p className="text-[7px] text-[var(--color-text)] md:text-[9px]">
                              {item.qty}x {item.name}
                            </p>
                          </div>
                          <p className="text-[7px] font-medium text-[var(--color-marketing-text)] md:text-[9px]">
                            {item.price}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-[rgba(60,60,67,0.12)] pt-2">
                      <div className="flex justify-between">
                        <span className="text-[8px] font-semibold text-[var(--color-text)] md:text-[10px]">
                          Total
                        </span>
                        <span className="text-[8px] font-bold text-[var(--color-primary)] md:text-[10px]">
                          $98.00
                        </span>
                      </div>
                    </div>
                    <button className="mt-2 w-full rounded-lg bg-[var(--color-primary)] py-1.5 text-[8px] font-semibold text-white md:text-[10px]">
                      Send to Kitchen
                    </button>
                  </div>
                </div>
              </div>
            </DeviceMockup>
          </div>
        </div>
      </div>
    </section>
  );
}
