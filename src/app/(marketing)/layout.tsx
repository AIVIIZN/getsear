import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata: Metadata = {
  title: {
    default: 'Sear POS - Restaurant POS Without Contracts',
    template: '%s | Sear POS',
  },
  description:
    'The restaurant POS that doesn\'t lock you in. Month-to-month pricing, no proprietary hardware, Valor Dual Pricing saves 2-3% per transaction. Runs on iPad and Android.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://getsear.com',
    siteName: 'Sear POS',
    title: 'Sear POS - Restaurant POS Without Contracts',
    description:
      'Month-to-month POS for restaurants. No contracts, no proprietary hardware, transparent pricing. Save 2-3% on every card transaction with Valor Dual Pricing.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Sear POS - Restaurant Point of Sale',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sear POS - Restaurant POS Without Contracts',
    description:
      'Month-to-month POS for restaurants. No contracts, no proprietary hardware, transparent pricing.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FDFBF7]">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
