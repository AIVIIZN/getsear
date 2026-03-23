import type { Metadata } from 'next';
import { DemoForm } from '@/components/marketing/DemoForm';
import { Clock, Shield, Headphones } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Book a Demo',
  description:
    'Book a free 15-minute demo of Sear POS. See transparent pricing, Valor Dual Pricing savings, and how to run your restaurant without contracts or proprietary hardware.',
  openGraph: {
    title: 'Book a Demo | Sear POS',
    description:
      'Book a free 15-minute demo. See how Sear can save your restaurant thousands per month.',
    url: 'https://getsear.com/demo',
  },
};

const trustPoints = [
  {
    icon: Clock,
    title: '15-minute demo',
    description: 'Quick and focused. We respect your time.',
  },
  {
    icon: Shield,
    title: 'No pressure',
    description: 'No aggressive follow-ups. No dark patterns.',
  },
  {
    icon: Headphones,
    title: 'Talk to a real person',
    description: 'Not a bot, not a sales script. A real conversation.',
  },
];

export default function DemoPage() {
  return (
    <section className="bg-[#FDFBF7] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2">
          {/* Left: value prop */}
          <div>
            <h1 className="text-[36px] font-bold tracking-tight text-[#1C1C1E] md:text-[48px]">
              See Sear in action
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-[#78756D] md:text-[20px]">
              Book a quick demo and we&apos;ll walk you through the full POS,
              show you the savings calculator with your real numbers, and answer
              every question.
            </p>

            <div className="mt-10 space-y-6">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F06B18]">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#1C1C1E]">
                        {point.title}
                      </h3>
                      <p className="mt-0.5 text-[14px] text-[#78756D]">
                        {point.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* What you'll see */}
            <div className="mt-10 rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-6">
              <h3 className="text-[16px] font-semibold text-[#1C1C1E]">
                What we&apos;ll cover
              </h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Live walkthrough of order entry, KDS, and menu management',
                  'Your personalized savings calculation with dual pricing',
                  'Hardware setup and migration plan',
                  'Answers to all your questions — no limit',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[14px] text-[#3D3D37]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F06B18]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-8 md:p-10">
            <h2 className="mb-8 text-center text-[22px] font-semibold text-[#1C1C1E]">
              Request a demo
            </h2>
            <DemoForm />
          </div>
        </div>
      </div>
    </section>
  );
}
