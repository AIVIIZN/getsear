'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Is there really no contract?',
    answer:
      'Correct. Sear is month-to-month. You can cancel at any time with no termination fee, no penalty, and no hassle. We earn your business every month.',
  },
  {
    question: 'How does Valor Dual Pricing work?',
    answer:
      'With Dual Pricing, your menu displays two prices: a cash price and a card price. The card price includes a clearly disclosed service fee (typically ~3.5%) that covers the processing cost. Cash-paying customers get the lower price. You receive the full listed price regardless of payment method, so your processing cost drops to effectively $0. This is fully legal and compliant in all 50 states.',
  },
  {
    question: 'What hardware do I need?',
    answer:
      'Any iPad (running iPadOS 16+) or Android tablet (running Android 12+). That\'s it. You probably already have one. If not, a new iPad starts at $329. You\'ll also need a Valor payment terminal (VP800, VP550, or VP300 Pro) for card processing, and optionally a receipt printer (Star Micronics or Epson) and cash drawer.',
  },
  {
    question: 'Can I switch from Toast/Square/SpotOn without downtime?',
    answer:
      'Yes. We offer guided migration assistance. We help import your menu, staff, and customer data. Most restaurants are fully operational on Sear within 2-4 hours. We schedule the cutover for a slow period (typically a Tuesday morning) so there\'s zero impact on service.',
  },
  {
    question: 'What happens if the internet goes down?',
    answer:
      'Sear has full offline mode. You can continue taking orders, sending to the kitchen, and processing cash payments. When connectivity returns, everything syncs automatically. Card payments queue and process as soon as the connection is restored.',
  },
  {
    question: 'Is online ordering really commission-free?',
    answer:
      'Yes. Online ordering is included in the Growth and Enterprise plans with zero commission per order. No per-order fees, no percentage of sales. Your customers order through your branded page, and you keep 100% of the revenue (minus standard card processing, which is covered by dual pricing).',
  },
  {
    question: 'How does pricing work for multiple terminals?',
    answer:
      'Each plan is priced per terminal per month. So if you have 3 terminals on the Growth plan, that\'s $129 x 3 = $387/month. For 5+ terminals or multi-location setups, contact us for volume pricing on the Enterprise plan.',
  },
  {
    question: 'What support is included?',
    answer:
      'Starter includes email and chat support during business hours. Growth includes priority phone + chat support with a target 2-hour response time. Enterprise includes a dedicated account manager and 24/7 phone support. All plans include free software updates and new feature releases.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      'Yes, at any time. Plan changes take effect at the start of your next billing cycle. Upgrading unlocks new modules immediately. Downgrading disables modules at the end of the current billing period — no data is lost.',
  },
  {
    question: 'Do you offer a free trial?',
    answer:
      'Yes. We offer a 14-day free trial on any plan. No credit card required to start. Book a demo and we\'ll set you up with a trial account pre-loaded with sample menu data so you can experience the full POS before committing.',
  },
];

function FAQAccordionItem({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`border-b border-[rgba(60,60,67,0.08)] ${
        index === 0 ? 'border-t' : ''
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="pr-4 text-[16px] font-semibold text-[var(--color-text)]">
          {item.question}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-[var(--color-marketing-text-muted)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-[15px] leading-relaxed text-[var(--color-marketing-text-muted)]">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PricingFAQ() {
  const { ref, isVisible } = useScrollFadeIn();

  return (
    <section className="bg-[var(--color-marketing-bg)] py-20 md:py-28" ref={ref}>
      <div
        className="mx-auto max-w-3xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[var(--color-text)] md:text-[40px]">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-marketing-text-muted)]">
            Honest answers to common questions. No sales pitch.
          </p>
        </div>

        <div className="mt-12">
          {faqs.map((faq, i) => (
            <FAQAccordionItem key={faq.question} item={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
