import type { Metadata } from 'next';
import { PricingPlans } from '@/components/marketing/PricingPlans';
import { ROICalculator } from '@/components/marketing/ROICalculator';
import { PricingFAQ } from '@/components/marketing/PricingFAQ';
import { PricingHardware } from '@/components/marketing/PricingHardware';
import { PricingProcessing } from '@/components/marketing/PricingProcessing';
import { CTASection } from '@/components/marketing/CTASection';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent POS pricing from $69/month per terminal. No contracts, no hidden fees. Compare Starter, Growth, and Enterprise plans. See how much you\'ll save with Valor Dual Pricing.',
  openGraph: {
    title: 'Pricing | Sear POS',
    description:
      'Transparent POS pricing from $69/month. No contracts, no hidden fees. ROI calculator shows your savings.',
    url: 'https://getsear.com/pricing',
  },
};

export default function PricingPage() {
  return (
    <>
      <PricingPlans />
      <PricingProcessing />
      <PricingHardware />
      <ROICalculator />
      <PricingFAQ />
      <CTASection />
    </>
  );
}
