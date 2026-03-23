import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/Hero';
import { PainPoints } from '@/components/marketing/PainPoints';
import { FeatureHighlights } from '@/components/marketing/FeatureHighlights';
import { DualPricingCallout } from '@/components/marketing/DualPricingCallout';
import { Testimonials } from '@/components/marketing/Testimonials';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Sear POS - The Restaurant POS That Doesn\'t Lock You In',
  description:
    'Month-to-month restaurant POS with no contracts and no proprietary hardware. Save 2-3% on every card transaction with Valor Dual Pricing. Runs on any iPad or Android tablet.',
  openGraph: {
    title: 'Sear POS - The Restaurant POS That Doesn\'t Lock You In',
    description:
      'Month-to-month restaurant POS with no contracts and no proprietary hardware. Save 2-3% on every card transaction.',
    url: 'https://getsear.com',
  },
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <PainPoints />
      <FeatureHighlights />
      <DualPricingCallout />
      <Testimonials />
      <CTASection />
    </>
  );
}
