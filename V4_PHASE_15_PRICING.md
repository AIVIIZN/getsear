# Sear POS v4 — Phase 15: Public Website & Transparent Pricing

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** HIGH — sales enablement
**Estimated Sessions:** 2-3
**Depends On:** Phase 13 (Polish — design system finalized)

---

## 1.1 What is this?

A public-facing marketing website and transparent pricing page at getsear.com. Currently getsear.com serves the POS app directly. This phase adds a public landing page, pricing page, feature comparison, and demo request flow that exists alongside the app (app moves to app.getsear.com or /login path).

Every competitor hides their real pricing behind "Contact Sales" or buries fees in fine print. Toast's real cost is 3-5x their listed price after add-ons and processing fees. Sear's competitive advantage is radical transparency — publish everything, no hidden fees, no "call for quote."

This phase builds:
1. **Landing page** — Hero, features, social proof, CTA
2. **Pricing page** — Every cost published, Toast/Square/SpotOn comparison calculator
3. **Feature comparison** — Side-by-side vs Toast, Square, SpotOn, Clover
4. **Demo request** — Form that books a Calendly demo or starts a self-serve trial
5. **ROI calculator** — "How much will you save switching from Toast?" interactive tool

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config
- `UI_DESIGN.md` — design system tokens


## 1.2 Tech stack

- **Framework:** Next.js 15 (same app, public routes)
- **Styling:** Tailwind CSS v4 with marketing-specific tokens
- **Animation:** Framer Motion for scroll-triggered animations
- **Forms:** react-hook-form + zod
- **Analytics:** PostHog or Plausible (privacy-first)
- **Scheduling:** Calendly embed for demo booking
- **Email:** SendGrid for demo request confirmation


## 1.3 User roles

- **Public (unauthenticated):** Landing page, pricing, features, demo request
- **Owner (after login):** Redirects to back-office dashboard


## 1.4 Pages and features

### Page: Landing Page (`/`)
- **Hero section:** Headline: "The Restaurant POS That Doesn't Lock You In." Subhead: "Month-to-month. No contracts. No proprietary hardware. Keep 2-3% more on every card swipe." CTA: "See Pricing" + "Book a Demo"
- **Pain points section:** 3 cards — "Tired of 2-year contracts?", "Paying too much in processing fees?", "Hardware you can't take with you?"
- **Feature highlights:** 6 feature cards with icons — Order Entry, KDS, Menu Management, Reports, Online Ordering, Offline Mode
- **Hardware flexibility:** "Runs on any iPad or Android tablet. No proprietary hardware tax."
- **Dual pricing callout:** "Valor Dual Pricing saves you 2-3% on every card transaction. That's $1,000-$1,500/month on $50K in card volume."
- **Social proof:** Testimonials (placeholder until real customers), "Trusted by X restaurants" counter
- **CTA footer:** "Ready to switch? Book a 15-minute demo."
- **Design:** Clean, Apple-inspired, lots of white space, product screenshots, ember orange accents

### Page: Pricing (`/pricing`)
- **Core commitment:** "We publish everything. No hidden fees. No surprise rate increases."
- **Plans:**
  - **Starter:** $X/month — Core POS, KDS, Menu, Tables, Staff, Reports. Processing: Valor rates published.
  - **Growth:** $X/month — Everything in Starter + Online Ordering, Loyalty, Marketing, Scheduling
  - **Enterprise:** $X/month — Everything + Franchise, Multi-location, Dedicated Support, Custom Integrations
- **Processing fees section:** Valor dual pricing rates published clearly. Cash price vs card price explained. Estimated monthly savings calculator.
- **Hardware section:** "Bring your own iPad ($329) or Android tablet ($200). Compare: Toast terminal $799-$999."
- **No-contract badge:** "Month-to-month. Cancel anytime. No termination fees. Ever."
- **Add-on pricing:** Every optional module priced individually. No surprises.
- **FAQ:** Common pricing questions answered honestly

### Page: Compare (`/compare`)
- **Interactive comparison table:** Sear vs Toast vs Square vs SpotOn vs Clover
- **Comparison dimensions:**
  - Monthly software cost (real cost, not starter price)
  - Processing rates
  - Contract terms
  - Hardware requirements and cost
  - Included modules
  - Online ordering (commission-free?)
  - Offline mode
  - Payment processor choice
  - KDS included?
  - Loyalty included?
  - Drive-thru support
  - Catering support
- **Source citations:** Every competitor claim links to a source (their pricing page, review sites, etc.)

### Feature: ROI Calculator (`/pricing#calculator`)
- **Interactive widget on pricing page:**
  - Input: Current monthly card volume ($)
  - Input: Current processing rate (%)
  - Input: Current monthly software cost ($)
  - Input: Current hardware lease cost ($/month)
  - Output: "You'd save $X/month with Sear" with breakdown
  - Output: "That's $X/year" with prominent display
- **Default values pre-filled:** $50K card volume, 2.6% processing, $250/month software
- **Animated counter:** Savings number counts up as user adjusts sliders

### Page: Demo Request (`/demo`)
- **Two paths:**
  - "Book a Live Demo" — Calendly embed for 15-minute call
  - "Start Free Trial" — Self-serve signup flow (create org, seed demo data)
- **Form fields:** Restaurant name, your name, email, phone, number of locations, current POS system (dropdown: Toast/Square/SpotOn/Clover/R Power/Other/None)
- **Confirmation:** Email via SendGrid with next steps
- **CRM integration:** Store leads in `demo_requests` table for follow-up


## 1.5 Look and feel

- **Marketing pages:** Distinct from app — more spacious, larger typography, scroll animations
- **Color:** Ember orange (#F06B18) as primary CTA color. Background: warm white. Text: near-black.
- **Typography:** System font stack, larger sizes (48px hero, 32px section headers, 18px body)
- **Screenshots:** Real product screenshots (from Phase 13 polish) in device mockups (iPad frame)
- **Animation:** Fade-in-up on scroll for sections. Counter animation on savings calculator. Subtle parallax on hero.
- **Mobile responsive:** Marketing pages must look great on phone (restaurant owners browse on mobile)
- **Footer:** Links to pricing, features, compare, demo, login, privacy policy, terms


## 1.6 Business rules

- **Pricing must be real:** Do not publish placeholder prices. If prices aren't decided yet, use realistic ranges with a note: "Final pricing coming soon — book a demo for early access rates."
- **Competitor claims must be sourced:** Every claim about Toast/Square/etc. must be verifiable. Link to source.
- **ROI calculator math must be conservative:** Under-promise on savings. Use Valor's actual published rates, not optimistic estimates.
- **Demo requests stored:** Every demo request creates a row in `demo_requests` table with timestamp, source page, UTM parameters.
- **No dark patterns:** No pre-checked boxes, no hidden terms, no "limited time" pressure tactics. Transparent pricing means transparent marketing.
- **SEO basics:** Meta titles, descriptions, Open Graph tags, structured data for pricing page.


## 1.7 Integrations

- **SendGrid:** Demo request confirmation email
- **Calendly:** Demo booking embed
- **PostHog/Plausible:** Analytics (privacy-first, no cookies if possible)
- **Supabase:** `demo_requests` table for lead storage


## 1.8 Modules planned but not for this phase

- Blog/content marketing — future
- Customer portal (existing customer login to manage billing) — future
- Affiliate/referral program page — future
- Case studies with real restaurant data — future (need real customers first)


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/app/(marketing)/layout.tsx` | Marketing layout — different nav/footer from app |
| `src/app/(marketing)/page.tsx` | Landing page |
| `src/app/(marketing)/pricing/page.tsx` | Pricing page with plans and calculator |
| `src/app/(marketing)/compare/page.tsx` | Feature comparison page |
| `src/app/(marketing)/demo/page.tsx` | Demo request + Calendly embed |
| `src/components/marketing/Hero.tsx` | Landing page hero section |
| `src/components/marketing/PainPoints.tsx` | Pain point cards section |
| `src/components/marketing/FeatureHighlights.tsx` | Feature card grid |
| `src/components/marketing/DualPricingCallout.tsx` | Dual pricing savings section |
| `src/components/marketing/Testimonials.tsx` | Social proof section |
| `src/components/marketing/PricingPlans.tsx` | Plan cards with feature lists |
| `src/components/marketing/ROICalculator.tsx` | Interactive savings calculator |
| `src/components/marketing/ComparisonTable.tsx` | Side-by-side competitor comparison |
| `src/components/marketing/DemoForm.tsx` | Demo request form |
| `src/components/marketing/MarketingNav.tsx` | Marketing site navigation |
| `src/components/marketing/MarketingFooter.tsx` | Marketing site footer |
| `src/components/marketing/DeviceMockup.tsx` | iPad/tablet frame for screenshots |
| `src/app/api/demo-request/route.ts` | POST demo request — store + send confirmation email |

### Database Migrations
| Migration | Changes |
|-----------|---------|
| `add_demo_requests` | Create `demo_requests` table (id, restaurant_name, contact_name, email, phone, locations_count, current_pos, source_page, utm_params jsonb, created_at) |


## Acceptance Criteria

### Landing Page
- [ ] Landing page loads at getsear.com with hero, features, pricing CTA, and demo CTA
- [ ] Page scores 90+ on Lighthouse performance (no heavy images, optimized)
- [ ] Mobile responsive — looks great on iPhone 15 viewport (390x844)
- [ ] All CTAs link to correct pages (pricing, demo)
- [ ] Product screenshots show in iPad device mockups

### Pricing Page
- [ ] All plans listed with clear monthly prices and included features
- [ ] Processing rates published with Valor dual pricing explanation
- [ ] Hardware comparison: "Your iPad ($329) vs Toast terminal ($999)"
- [ ] No-contract commitment prominently displayed
- [ ] ROI calculator: user enters $50K card volume, 2.6% rate → sees monthly and annual savings
- [ ] Calculator updates in real-time as sliders move
- [ ] FAQ section answers at least 8 common pricing questions

### Compare Page
- [ ] Side-by-side table comparing Sear vs Toast vs Square vs SpotOn vs Clover
- [ ] At least 12 comparison dimensions filled in with accurate data
- [ ] Source links provided for competitor claims
- [ ] Sear advantages highlighted but not in a misleading way

### Demo Flow
- [ ] "Book a Demo" opens Calendly embed — user can pick a time
- [ ] "Start Free Trial" opens signup form
- [ ] Form submission stores row in `demo_requests` table
- [ ] Confirmation email sent via SendGrid within 30 seconds
- [ ] Form validates: email format, phone format, required fields


## Workflow Tests

### Workflow 1: Restaurant Owner Discovers Sear
1. Owner Googles "POS without contracts" → lands on getsear.com
2. Reads hero: "Month-to-month. No contracts. No proprietary hardware."
3. Scrolls to features → sees Order Entry, KDS, Online Ordering, Offline Mode
4. Clicks "See Pricing" → pricing page loads
5. Sees plans, processing rates, hardware comparison
6. Uses ROI calculator: enters $60K/month card volume, 2.75% current rate
7. Calculator shows: "Save $1,350/month ($16,200/year) with Sear Dual Pricing"
8. Clicks "Book a Demo" → Calendly loads → picks Thursday 2 PM
9. Gets confirmation email within 30 seconds

### Workflow 2: Toast Customer Comparing
1. Owner on pricing page clicks "Compare" tab
2. Sees Sear vs Toast side-by-side
3. Notes: Sear = month-to-month, Toast = 2-year contract
4. Notes: Sear = BYOD iPad, Toast = proprietary $999 terminal
5. Notes: Sear = Valor dual pricing, Toast = locked processing at 2.49-2.99%
6. Each Toast claim links to source (Toast pricing page, review sites)
7. Owner clicks "Start Free Trial" → creates account → sees demo restaurant with sample data
