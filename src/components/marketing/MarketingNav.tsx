'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(60,60,67,0.08)] bg-[#FDFBF7]/95 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007AFF]">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <span className="text-xl font-semibold tracking-tight text-[#1C1C1E]">
            Sear
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/#features"
            className="text-[15px] font-medium text-[#3D3D37] transition-colors hover:text-[#007AFF]"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="text-[15px] font-medium text-[#3D3D37] transition-colors hover:text-[#007AFF]"
          >
            Pricing
          </Link>
          <Link
            href="/compare"
            className="text-[15px] font-medium text-[#3D3D37] transition-colors hover:text-[#007AFF]"
          >
            Compare
          </Link>
          <Link
            href="/demo"
            className="text-[15px] font-medium text-[#3D3D37] transition-colors hover:text-[#007AFF]"
          >
            Demo
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-5 py-2.5 text-[15px] font-medium text-[#3D3D37] transition-colors hover:bg-[#F5F3F0]"
          >
            Log in
          </Link>
          <Link
            href="/demo"
            className="btn-press rounded-full bg-[#007AFF] px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0066D6]"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#3D3D37] transition-colors hover:bg-[#F5F3F0] md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[rgba(60,60,67,0.08)] bg-[#FDFBF7] px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              href="/#features"
              onClick={() => setMobileOpen(false)}
              className="text-[17px] font-medium text-[#3D3D37]"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="text-[17px] font-medium text-[#3D3D37]"
            >
              Pricing
            </Link>
            <Link
              href="/compare"
              onClick={() => setMobileOpen(false)}
              className="text-[17px] font-medium text-[#3D3D37]"
            >
              Compare
            </Link>
            <Link
              href="/demo"
              onClick={() => setMobileOpen(false)}
              className="text-[17px] font-medium text-[#3D3D37]"
            >
              Demo
            </Link>
            <div className="mt-2 flex flex-col gap-3 border-t border-[rgba(60,60,67,0.08)] pt-4">
              <Link
                href="/login"
                className="rounded-xl py-3 text-center text-[17px] font-medium text-[#3D3D37] transition-colors hover:bg-[#F5F3F0]"
              >
                Log in
              </Link>
              <Link
                href="/demo"
                className="btn-press rounded-xl bg-[#007AFF] py-3 text-center text-[17px] font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
