import Link from 'next/link';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Compare', href: '/compare' },
    { label: 'Online Ordering', href: '/#features' },
    { label: 'KDS', href: '/#features' },
  ],
  Company: [
    { label: 'About', href: '/' },
    { label: 'Book a Demo', href: '/demo' },
    { label: 'Contact', href: '/demo' },
    { label: 'Careers', href: '/' },
  ],
  Resources: [
    { label: 'Help Center', href: '/' },
    { label: 'System Status', href: '/' },
    { label: 'Hardware Guide', href: '/pricing#hardware' },
    { label: 'API Docs', href: '/' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/privacy' },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgba(60,60,67,0.08)] bg-[var(--color-marketing-bg-cream)]">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16">
        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <span className="text-lg font-bold text-white">S</span>
              </div>
              <span className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
                Sear
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[var(--color-marketing-text-muted)]">
              The restaurant POS that doesn&apos;t lock you in. Month-to-month,
              no contracts, runs on your own hardware.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-marketing-text-muted)]">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-[var(--color-marketing-text)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[rgba(60,60,67,0.08)] pt-8 md:flex-row">
          <p className="text-[13px] text-[var(--color-marketing-text-muted)]">
            &copy; {new Date().getFullYear()} Sear POS. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[var(--color-success-strong)]/10 px-3 py-1 text-[12px] font-medium text-[var(--color-success-strong)]">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-success-strong)]" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
