    # Sear POS — Complete System Architecture

**Product:** Sear POS (getsear.com)
**Version:** 1.0
**Date:** 2026-03-20
**Status:** Design Phase

---

> Sear POS is a modern, modular restaurant point-of-sale system built for independent operators and multi-location groups. It runs on hardware you already own (iPads), integrates Valor Payments with built-in Dual Pricing to potentially eliminate your processing fees, and never locks you into a contract. Month-to-month, transparent pricing. The software restaurants deserve.

---

## Table of Contents

1. [Vision & Strategy](#1-vision--strategy)
2. [Market Research & Competitive Analysis](#2-market-research--competitive-analysis)
3. [User Personas & Requirements](#3-user-personas--requirements)
4. [Restaurant Operations Deep Dive](#4-restaurant-operations-deep-dive)
5. [System Architecture](#5-system-architecture)
6. [Payment Processing Architecture](#6-payment-processing-architecture)
7. [UI/UX Design System](#7-uiux-design-system)
8. [Module Catalog](#8-module-catalog)
9. [Integration Ecosystem](#9-integration-ecosystem)
10. [Implementation Roadmap](#10-implementation-roadmap)

**Appendices:**
- [A. Complete Database Schema](#appendix-a-complete-database-schema)
- [B. API Reference](#appendix-b-api-reference)
- [C. Regulatory Compliance Reference](#appendix-c-regulatory-compliance-reference)
- [D. Hardware Compatibility Guide](#appendix-d-hardware-compatibility-guide)
- [E. Financial Model & Pricing](#appendix-e-financial-model--pricing)

---


# Part 1: Vision & Strategy

## 1.1 Product Overview

Sear POS is a cloud-native, modular restaurant point-of-sale system that prioritizes operator freedom. Built on Python 3.12/Flask/Jinja2 with a Supabase (PostgreSQL) backend, it runs on any modern tablet (iPad or Android) through a Progressive Web App delivered from a Google Cloud VM.

### Core Principles

1. **Integrated Valor Payments with Dual Pricing** — All payment processing runs through Valor PayTech, Sear's exclusive payment processing partner. Valor's Dual Pricing shows both cash and card prices, potentially offsetting 100% of processing fees for the restaurant. Card data never touches Sear's servers — Valor handles all PCI-sensitive operations via Valor Connect (MQTT) and REST APIs. Supported hardware: VP800 (dual display), VP550, VP300 Pro (PIN pad), RCKT (mobile Bluetooth).

2. **BYOD (Bring Your Own Device)** — Works on iPads and Android tablets the restaurant already owns. No proprietary hardware requirements. Standard receipt printers, cash drawers, and card readers supported.

3. **Month-to-Month, No Contracts** — If Sear is good enough, restaurants stay. No 2-year commitments, no early termination fees, no auto-renewal traps.

4. **Hot-Swappable Modules** — Core POS is always on. Everything else (KDS, online ordering, inventory, loyalty, scheduling, payroll) snaps on and off monthly. Pay for what you use.

5. **Offline-First** — The POS works when the internet doesn't. Orders, payments (store-and-forward), clock-ins, and kitchen routing all function on local network alone. When connectivity returns, everything syncs.

6. **Multi-Location Native** — Built from day one for restaurant groups. Shared menu templates, consolidated reporting, staff that floats between locations, gift cards that work everywhere. Organization > Location > Terminal hierarchy.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, Flask, Jinja2 |
| Database | Supabase (PostgreSQL 15+) with Row-Level Security |
| Frontend | htmx + Alpine.js + Tailwind CSS (Progressive Web App) |
| Hosting | Google Cloud VM (Compute Engine) |
| Real-Time | Supabase Realtime (WebSockets) + SSE fallback |
| SMS | Twilio |
| Email | SendGrid |
| Task Queue | Celery + Redis |
| IDs | UUIDv7 (time-sortable) |
| Timestamps | All `timestamptz` in UTC |

### Competitive Position

Sear occupies the gap between Square (too simple for real restaurants) and Toast (too expensive and too locked-in). The pitch is straightforward: everything Toast does at one-third the total cost, without the hardware lock-in, without the contract — and with Valor's Dual Pricing that can reduce your effective processing cost to $0.

| Feature | Toast | Square | Sear |
|---------|-------|--------|------|
| Monthly software cost (2-3 terminals) | $225-500+ | $0-150 | $23-49 (2/3 less than Toast) |
| Payment processor | Locked (Toast, 2.49%+$0.15) | Locked (Square, 2.6%+$0.10) | Valor Payments with Dual Pricing (potentially $0 effective cost) |
| Hardware | Proprietary | Square-only readers | Any iPad + Valor terminals (VP800, VP550, RCKT) |
| Contract | 2-3 years | None | None |
| Offline mode | Yes | Limited | Yes (full) |
| KDS | $? add-on | Limited | $29/screen |
| Coursing | Yes | No | Yes |
| Kitchen routing | Yes | Limited | Yes |
| Multi-location | Extra cost | Extra cost | Built-in |
| Online ordering | $75/mo add-on | Included | Included |
| Processing cost to restaurant | 2.49% + $0.15 (restaurant pays) | 2.6% + $0.10 (restaurant pays) | $0 (4% Dual Pricing — customer pays, not restaurant) |

## 1.2 Target Market

### Primary: Independent Restaurants (1-5 Locations)

- 45-200 seat full-service restaurants
- Fast-casual concepts
- Bars and nightclubs
- Food trucks
- Ghost kitchens / virtual brands

These operators are underserved. Toast is too expensive once add-ons stack up. Square lacks restaurant-specific depth (coursing, kitchen routing, bar tabs). Clover's app marketplace is fragmented. These owners want something that works, costs less than $250/month, and doesn't trap them.

### Secondary: Multi-Location Restaurant Groups (5-50 Locations)

- Regional chains
- Franchise groups
- Multi-concept operators

These groups need consolidated reporting, menu inheritance across locations, centralized staff management, and enterprise-grade uptime. They're currently on Aloha, MICROS, or Toast Enterprise, paying $1.2-1.8M over 3 years. Sear targets a 3-year TCO of $400-600K — roughly one-third.

### Tertiary: Emerging Concepts

- Ghost kitchen operators running multiple virtual brands from one kitchen
- Catering-focused operations
- Pop-up and seasonal concepts that need month-to-month flexibility

## 1.3 Revenue Model

### Pricing Philosophy: 2/3 Less Than Toast on Software

Every Sear software price point is set at roughly 1/3 of Toast's equivalent — a full 2/3 reduction. Toast Core is $69/month; Sear Starter is $23/month. Toast charges $75/month for online ordering as an add-on; Sear includes it at the Professional tier. The math is simple: take whatever Toast charges, divide by 3.

### Software Subscription

| Tier | Monthly Price | Toast Equivalent | Includes |
|------|-------------|------------------|----------|
| Starter | $23/month | Toast Core ($69) | 2 terminals, core POS, menu management, staff/time clock, basic reporting, Valor payment processing with Dual Pricing |
| Professional | $49/month | Toast Core + Online Ordering + Loyalty ($194+) | 4 terminals, + online ordering, + loyalty, + gift cards, + KDS |
| Enterprise | Custom ($65-99/location) | Toast Enterprise ($200+/location) | Unlimited terminals, all modules, SLA, dedicated support, SSO, API access |

Additional terminals: $9/month each (Toast: $\~25-75/terminal).
Additional KDS screens: $15/month each.

### Module Add-Ons

Optional modules priced individually ($9-29/month per module). All priced at 1/3 of Toast's equivalent add-on cost. Restaurants activate and deactivate monthly based on need. No commitment beyond the current month.

### Payment Processing Revenue (Primary Revenue)

This is where Sear makes its real money. Sear operates as a Valor PayTech ISV partner using Valor's **Dual Pricing** model:

- **Card-paying customers are charged a 4% fee** (displayed as the card price vs. the lower cash price at point of sale)
- **Sear keeps 1.9%** of that 4% as revenue
- **Valor keeps 2.1%** to cover interchange, network fees, and their margin
- **The restaurant pays $0 in processing fees** — the card-paying customer absorbs the cost

**Revenue math on a restaurant doing $80K/month in card sales:**

| Line Item | Amount |
|-----------|--------|
| 4% charged to card customers | $3,200/month |
| Sear's 1.9% cut | **$1,520/month** |
| Valor's 2.1% cut | $1,680/month |
| Restaurant's processing cost | **$0/month** |

**Combined revenue per restaurant ($80K card volume + Professional plan):**
- Software: $49/month
- Processing: $1,520/month
- **Total: $1,569/month per restaurant**

The software subscription is the customer acquisition hook. Processing revenue is the engine. This is similar to Toast's model (Toast makes most of its money on processing, not software), except Sear's total cost to the restaurant is dramatically lower because the customer — not the restaurant — absorbs the processing fee through Dual Pricing.

### Second Location Pricing

60% of primary location price. The infrastructure is shared; the cost should reflect that.


# Part 2: Market Research & Competitive Analysis




# Restaurant POS System -- Exhaustive Research Report

---

## 1. COMPETITIVE LANDSCAPE

### Toast POS

**Pricing Tiers (2025-2026):**
- **Starter Kit**: $0/month, processing at 3.09% + 15c per in-person transaction
- **Core**: $69/month, processing at 2.49% + 15c
- **Restaurant Basics Bundle**: $110/month + $4/employee (adds payroll & scheduling)
- **Payroll & POS Bundle**: $90/month + $9/employee/month
- **Pay-As-You-Go options**: Basic (3.09% + 15c), Core (3.39% + 15c), Growth (3.69% + 15c)
- Card-not-present (online orders): 3.50% + 15c across all plans
- Custom pricing for multi-location

**Full Feature List:**
- Flexible POS customization (table, counter, kiosk setups)
- Toast Go 2 handheld mobile POS (waterproof)
- Commission-free online ordering
- Delivery integrations (DoorDash, Uber Eats, Grubhub)
- Toast Payroll & HR with time tracking and wage calculation
- Digital self-service kiosks
- Marketing and loyalty programs
- Real-time inventory management
- Kitchen Display System (KDS)
- Menu management
- Reporting and analytics
- Gift cards
- 24/7/365 support (Toast Care) included in all plans

**Known Weaknesses & Customer Complaints (G2, Capterra, Reddit):**
- **Mandatory payment processing lock-in**: No third-party processor allowed
- **Proprietary hardware lock-in**: Must use Toast hardware
- **2-3 year contracts** with expensive early termination fees
- **Hidden fees and cost escalation**: Monthly fees, add-on fees, fee increases through 2024-2025 pushed operators to reconsider
- **Support inconsistency**: Long wait times, difficulty reaching knowledgeable reps
- **WiFi/network dependency**: Unreliable during peak hours
- **Technical glitches** with mobile and QR ordering
- **Billing discrepancies** reported
- **Scalability concerns**: Works well for small restaurants but struggles for larger operations
- **Phishing/security concerns**: Reddit threads in 2025 describe scam calls targeting Toast customers; MFA not universally enforced
- **Lack of update notifications**: Updates occur without prior warning

Sources: [Toast Pricing](https://pos.toasttab.com/pricing), [NerdWallet Toast Review](https://www.nerdwallet.com/business/software/reviews/toast-pos), [POSUSA Toast Review](https://www.posusa.com/toast-pos-review/), [G2 Toast Pros & Cons](https://www.g2.com/products/toast/reviews?qs=pros-and-cons), [Capterra Toast Reviews](https://www.capterra.com/p/136301/Toast-POS/reviews/), [Flyght Blog on Toast Vulnerabilities](https://www.whatisflyght.com/blog/burnt-toast-when-your-pos-becomes-your-biggest-vulnerability), [UpMenu Toast Pricing](https://www.upmenu.com/blog/toast-pricing/)

---

### Radish POS

**Overview:** QSR-focused POS platform (rebranded in 2024). Not a full-service restaurant POS -- specifically built for quick-service.

**Features:**
- Intuitive POS with conversational ordering modifiers
- Cash drawer management (multiple drawers, activity tracking)
- Cash management (paid-ins, paid-outs, cash drops)
- Open/close tabs, save orders for deferred payment
- Integrated payments (cash, credit, checks, mobile)
- Special discounts and offers (preset and automatic)
- House accounts with customer profiles and order history
- Menu organization with custom categories, item variants, modifier workflows
- SKU and barcode scanning
- Kitchen Display System (KDS)
- Real-time cloud-based reporting and analytics
- X & Z reports, department sales reports, discount tracking, audit reports
- Employee profiles, permissions, sales performance tracking
- Built-in timecard management, payroll with overtime calculations
- Online ordering (commission-free, syncs with in-store menu)
- Speed screens for popular items
- Light and dark mode display options

**Pricing Innovation -- TrueMargin:**
Proprietary cash discount/dual pricing program. Prices items based on cash margins; calculates separate card price to offset processing fees. Claimed to save small-to-medium QSRs thousands monthly. Specific monthly software pricing not publicly listed.

**Differentiators vs Toast:**
- QSR-specific (not trying to be everything to everyone)
- TrueMargin pricing model (unique cash discount approach)
- No long-term contract lock-in evident in their marketing
- Simpler, more focused feature set for counter-service

Sources: [Radish Homepage](https://www.getradish.com/), [Radish All Features](https://www.getradish.com/all-features), [Radish TrueMargin](https://www.getradish.com/product/truemargin), [Radish Payments](https://www.getradish.com/product/payments)

---

### Square for Restaurants

**Pricing (late 2025 overhaul):**
- **Free**: $0/month, 2.6% + 15c in-person, 3.3% + 30c online
- **Plus**: $49/month/location, 2.5% + 15c in-person, 2.9% + 30c online
- **Premium**: $149/month/location, 2.4% + 15c in-person, 2.9% + 30c online

**Key Features:**
- Cloud-based POS, KDS with ticket flow and kitchen pacing analytics
- Real-time inventory sync with AI-powered demand forecasting
- Menu management (auto-syncs on-premise + online across locations)
- Consolidated delivery partner orders (DoorDash, Grubhub) in one platform
- Integrated payroll & scheduling, shift management, break tracking
- Offline payment processing
- Pre-authorization for bar tabs
- Customer loyalty program
- Staff management
- Reporting and analytics
- No long-term contracts

**Strengths:** Low barrier to entry (free tier), no contracts, broad hardware ecosystem, strong ecosystem of add-ons
**Weaknesses:** Less restaurant-specific depth than Toast, flat-rate pricing can be expensive at high volume, limited enterprise features

Sources: [Square Restaurant Pricing](https://squareup.com/us/en/point-of-sale/restaurants/pricing), [NerdWallet Square Review](https://www.nerdwallet.com/business/software/reviews/square-for-restaurants), [SoftwareAdvice Square](https://www.softwareadvice.com/retail/square-for-restaurants-profile/)

---

### Clover POS

**Pricing (restaurant-specific):**
- **Starter**: $79/month (core POS, basic order management, standard reporting)
- **Quick Service**: $135/month for 36 months (or $849 upfront + $89.95/month)
- **Full-Service**: $179/month for 36 months (or $1,799 upfront + $89.95/month)
- Realistic monthly costs: small cafes $300-700/month; busy full-service $1,000-1,800/month (including processing, software, add-ons)

**Features:** Standard across tiers (unusual). Three restaurant tiers: Starter (front-of-house wait station), Standard (server stations/tableside ordering), Advanced (full FOH/BOH connection).

**Key Issue:** Many features (online orders, employee management, loyalty, appointment booking) are separated from core POS and tied to higher tiers or paid apps from the Clover App Market.

Sources: [NerdWallet Clover Review](https://www.nerdwallet.com/reviews/small-business/clover-pos-review), [Clover Restaurant Pricing](https://www.clover.com/pricing/restaurant), [UpMenu Clover Pricing](https://www.upmenu.com/blog/clover-pos-pricing/)

---

### SpotOn

**Pricing:**
- Core software bundle: monthly processing volume x 0.20% (up to $200) + $50
- Software subscriptions: $0 to $135/month
- Processing rates: 1.99% + 25c to 2.89% + 25c
- Hardware stations: $500-$850 each

**Key Features:** Commission-free online ordering, SpotOn Teamwork (scheduling, 1-click payroll, tip management), integrations with MarginEdge, QuickBooks, FreshKDS

**Why Restaurants Switch to SpotOn:**
- Transparent pricing, no long-term contracts
- Affordable processing fees
- 24/7/365 human support at no extra cost, no long wait times
- Tools designed to save time and increase profitability

Sources: [SpotOn Pricing](https://www.spoton.com/pricing/), [DCRS SpotOn Review](https://dcrs.com/2025/09/09/why-spoton-restaurant-pos-is-taking-over-the-scene/), [POSUSA SpotOn Review](https://www.posusa.com/spoton-restaurant-pos-review/)

---

### TouchBistro

**Pricing:** Starting at $69/month, tiered by number of iPad licenses. No long-term contracts.

**Key Features:**
- iPad-native (built specifically for iPadOS -- does NOT work on Android)
- Hybrid POS (works offline when internet is down)
- Kitchen Display System
- Tableside ordering and payment processing
- Inventory and recipe management
- Labor management (forecasting, scheduling, task management)
- 50+ standard reports
- Floor plan/table management

**Strengths:** iPad-native performance, offline capability, no contracts
**Weaknesses:** iPad-only (no Android), complaints about customer service, contract difficulties when exiting, technical glitches reported

Sources: [TouchBistro Pricing](https://www.touchbistro.com/pricing/), [POSUSA TouchBistro Review](https://www.posusa.com/touchbistro-pos-review/), [NerdWallet TouchBistro Review](https://www.nerdwallet.com/reviews/small-business/touchbistro)

---

### Lightspeed Restaurant

**Pricing:** Starting at $69/month for a single register. KDS is $30/screen extra. 1-year contract required. Lightspeed Payments: 2.6% + 10c per in-person transaction.

**Key Features:** Online ordering, contactless ordering, order & pay at table, takeout/delivery, CRM & loyalty, Lightspeed Pulse app, floor management, customer tracking, inventory tracking, gift cards, offline mode, iOS mobile app. Integrates with QuickBooks, Xero, third-party scheduling/reservations/delivery apps.

**Support:** 24/7 phone support.

Sources: [NerdWallet Lightspeed Review](https://www.nerdwallet.com/business/software/reviews/lightspeed-restaurant-pos), [POSUSA Lightspeed Review](https://www.posusa.com/lightspeed-restaurant-pos-review/)

---

### Aloha POS (NCR Voyix)

**Overview:** Powers 75,000+ restaurants worldwide including Chipotle, Firehouse Subs, Wendy's, Buffalo Wild Wings, Raising Cane's. Best for mid-size to enterprise and multi-location chains.

**Key Features:** Windows-based POS, kitchen management, takeout/delivery, connected payments, mobile ordering/pay-at-table, EMV chip card + PCI-compliant processing, centralized payment management via NCR Connected Payments. Highly customizable for complex multi-location needs.

**Status (2025):** Under new CEO James Kelly (Feb 2025), working to shed "legacy" reputation. New four-year contract with Buffalo Wild Wings.

Sources: [NCR Voyix Aloha Cloud](https://www.ncrvoyix.com/restaurant/aloha-cloud-pos), [POSUSA Aloha Review](https://www.posusa.com/aloha-pos-review/), [Restaurant Business on NCR Voyix](https://www.restaurantbusinessonline.com/technology/after-140-years-pos-giant-ncr-looks-reinvent-itself)

---

### TOP 10 FEATURES CUSTOMERS COMPLAIN ABOUT (ACROSS ALL PLATFORMS)

1. **Offline reliability**: Systems fail during peak hours when WiFi drops; orders don't sync to kitchen
2. **Contract lock-in and termination fees**: 2-3 year contracts with punitive exit costs (Toast, Clover)
3. **Hidden/escalating costs**: Processing fees, add-on fees, hardware costs that aren't transparent upfront
4. **Customer support quality**: Long wait times, unknowledgeable reps, slow resolution (Toast, TouchBistro, SkyTab)
5. **Payment processor lock-in**: Forced to use the POS vendor's processing with no third-party option (Toast)
6. **Handheld device reliability**: Battery life not lasting full shifts, connectivity drops during service
7. **Reporting limitations**: Insufficient customization, inability to get specific data cuts operators need
8. **System crashes during peak hours**: Lag, order loss, slow transaction processing when it matters most
9. **Poor onboarding/training**: Confusing interfaces, inadequate training materials, steep learning curve
10. **Integration gaps**: Key third-party tools (accounting, scheduling, delivery platforms) either don't integrate or require expensive middleware

Sources: [Peblla POS Reliability Insights](https://www.peblla.com/blog/why-pos-handheld-reliability-is-critical-for-restaurants-in-2025-insights-from-reddit), [ExpertMarket POS Problems](https://www.expertmarket.com/pos/common-pos-problems-in-restaurants), [Modisoft POS Issues](https://modisoft.com/a-poor-pos-system-is-a-bad-recipe-for-full-service-restaurants/)

---

## 2. REGULATORY & COMPLIANCE

### PCI DSS 4.0

- **Current version**: PCI DSS 4.0; future-dated requirements became effective March 31, 2025
- **2026 enforcement**: First assessment/SAQ/ROC filings under 4.0 requirements
- **Key requirements for POS**:
  - MFA required for all access to cardholder data environment (Req 8.4.2)
  - Passwords minimum 12 characters (or 8 if system doesn't support 12) (Req 8.3.6)
  - 500+ requirements across 12 domains
  - Annual compliance validation, quarterly scans, continuous monitoring
  - Real-time monitoring mandatory
  - Penetration testing required after significant changes
  - Cloud and API security addressed for modern architectures

Sources: [Payment Nerds PCI DSS 4.0](https://paymentnerds.com/blog/dss-4-0-what-merchants-must-do-before-the-2026-enforcement-deadline/), [PCI SSC Official](https://www.pcisecuritystandards.org), [Ignyteplatform PCI Checklist](https://www.ignyteplatform.com/blog/security/pci-dss-requirements-checklist/)

### PA-DSS / PCI SSF (Software Security Framework)

- **PA-DSS retired October 2022**, replaced by PCI Software Security Framework (SSF)
- SSF has two independent programs:
  - **Secure Software Lifecycle (Secure SLC)**: Development process standards
  - **Secure Software Standard (SSS)**: Application security requirements
- Supports modern development methodologies, architectures, and release cycles
- New payment applications must be validated by SSF-certified companies
- All prior PA-DSS validated applications moved to "Acceptable Only for Pre-Existing Deployments"

Sources: [Secureframe PA-DSS vs PCI DSS](https://secureframe.com/blog/pa-dss-vs-pci-dss), [PCI SSC Transition Guide](https://listings.pcisecuritystandards.org/documents/Transitioning_from_PA-DSS_to_SSF_Resource_Guide.pdf)

### PCI PTS (PIN Transaction Security)

- Standards define physical and logical security for payment devices (PEDs, POI devices)
- **Version 7.0 released in 2025** -- major update strengthening security baseline for card-present transactions
- Devices validated by PCI Recognized Laboratories
- SRED (Secure Reading and Exchange of Data) certified devices provide account data encryption
- PTS devices with SRED used with P2PE solutions can reduce merchant PCI DSS scope

Sources: [PCI SSC PTS Devices](https://www.pcisecuritystandards.org/assessors_and_solutions/pin_transaction_devices), [Clone Systems PTS POI v7.0](https://www.clone-systems.com/breaking-down-pci-pts-poi-v7-0-smarter-standards-for-safer-payments/)

### State-by-State Sales Tax (Restaurant-Specific)

**Key rules:**
- Prepared food is generally ALWAYS taxable, regardless of state grocery tax status
- "Prepared food" definitions vary by state (e.g., heated food, combined ingredients, sold with utensils)
- As of April 2026, 13 states still impose statewide sales tax on groceries
- Arkansas and Illinois eliminated state-level grocery taxes effective Jan 1, 2026 (joining Kansas in 2025)

**State examples:**
- **Oklahoma**: Food/food ingredients exempt from state sales tax (Aug 2024); prepared food, alcohol, dietary supplements still taxed at 4.5%
- **Massachusetts**: Prepared foods under $2.75 exempt
- **New York City**: Prepared meals under $2.50 exempt (if sold without utensils)
- **Washington**: "Prepared food" = seller combines 2+ ingredients, sells heated, or sells with utensils

**Alcohol tax**: Separate and always applicable. Rates vary significantly by state.

Sources: [TaxHero Food Tax](https://taxhero.net/blog/sales-tax-on-food/), [Commenda Sales Tax Guide](https://www.commenda.io/sales-tax/sales-tax-on-groceries), [TaxJar Restaurant Tax](https://www.taxjar.com/blog/food/sales-tax-by-state-to-go-restaurant-orders), [VATUpdate State Guide](https://www.vatupdate.com/2025/07/16/state-by-state-guide-understanding-sales-tax-on-groceries-prepared-food-and-restaurant-meals/)

### Tip Credit Laws

**Federal**: Tipped minimum wage remains $2.13/hour. Max federal tip credit = $5.12/hour. If tips don't reach $7.25/hour, employer covers the difference.

**State variations:**
- **No tip credit states** (full minimum wage required): California ($16.50/hour as of July 2025), plus others
- **Enhanced tip credit states** (above federal $2.13 minimum): Florida (tipped cash wage $10.98, min wage $14.00 effective Sep 2025); New York City (food service cash wage $11.35, tip allowance up to $5.65, total min $17.00)
- **Federal minimum states**: Multiple states still allow $2.13/hour cash wage

Sources: [DOL Tipped Employee Wages](https://www.dol.gov/agencies/whd/state/minimum-wage/tipped), [Paycor Tipped Wages by State](https://www.paycor.com/resource-center/articles/minimum-wage-tipped-employees-by-state/), [TouchBistro Tipped Wage Rates](https://www.touchbistro.com/blog/the-state-of-tipped-minimum-wage-in-the-restaurant-industry/)

### ADA Accessibility for POS Interfaces

- ADA is the law; WCAG (Web Content Accessibility Guidelines) is the technical playbook
- **WCAG Level AA** is the compliance target per DOJ guidance and court precedents
- 2024 DOJ rule established WCAG 2.1 Level AA as enforceable standard for Title II (state/local government)
- For kiosk/closed-platform POS: WCAG may not directly apply (Section 508 treats kiosks as closed systems), but ADA requires **tactilely discernible input controls** with at least one per function
- Web-based POS interfaces (admin dashboards, online ordering): WCAG Level AA applies

Sources: [Access Board ADA Standards](https://www.access-board.gov/ada/), [Accessibility.Works WCAG Guide](https://www.accessibility.works/blog/wcag-ada-website-compliance-standards-requirements), [KMA ADA Kiosk FAQ](https://kma.global/ada-faq/)

### GDPR/CCPA for Customer Data (Loyalty, Email)

- GDPR: Granular consent required (separate opt-in for analytics, marketing, personalization); no pre-checked boxes; easy withdrawal; data minimization; fines up to 20M EUR
- CCPA/CPRA: Clear disclosures, explicit opt-in, easy opt-out, rewards must reflect value of data collected; fines up to $7,500/violation
- 20+ US states have enacted comprehensive privacy laws as of 2025
- Loyalty programs: Only collect essential info; tie collection to stated purpose; provide one-click unsubscribe; persistent preference centers

Sources: [Reward the World GDPR/CCPA Loyalty](https://rewardtheworld.net/gdpr-and-ccpa-in-loyalty-programs-2025-update/), [Red Clover Loyalty Compliance](https://redcloveradvisors.com/loyalty-program-compliance/), [Loyal Thinking CCPA Loyalty](https://loyalthinking.com/2025/08/ccpa-compliance-for-loyalty-programs-key-rules/)

### Health Department Integration

- No states currently require digital reporting from POS to health departments
- Health departments conduct unannounced annual inspections
- POS systems can assist compliance by: tracking food handler certifications, uploading permits/licenses, automating health safety checklists, organizing sales reports for tax audits
- Digital checklists are an emerging best practice but not mandated

Sources: [OneHubPOS Compliance Guide](https://onehubpos.com/blog/restaurant-compliance-checklist-for-2025)

### Alcohol Service Laws Affecting POS

**Age verification**: All states require minimum purchase age of 21. POS must prompt for ID verification. ID scanners can verify authenticity.

**Server age**: Most states require 18+ to serve alcohol; 17 states require 21+ to bartend.

**Happy hour restrictions by state:**
- **States that ban happy hour entirely**: Some states (notably Massachusetts has strict restrictions)
- **Pennsylvania**: Max 4 hours/day, 14 hours/week, must end by midnight
- **Illinois**: Discounted drinks max 4 hours/day before 10 PM, max 15 hours/week
- **Washington**: Max 4 hours on particular days
- **Florida**: Allows happy hour; bans "all you can drink" specials
- **Connecticut**: Max 1 drink delivered per person at a time
- **Virginia**: Prohibits multiple drinks for single price (no 2-for-1)

Sources: [Wikipedia Alcohol Laws](https://en.wikipedia.org/wiki/List_of_alcohol_laws_of_the_United_States), [Alcohol.law Happy Hour](https://www.alcohol.law/digest/unhappy-hour-regulations), [OysterLink Server Age Guide](https://oysterlink.com/spotlight/legal-age-to-serve-alcohol/)

### EMV Liability Shift

- Effective October 2015 in US
- If counterfeit chip card presented and merchant lacks EMV terminal: merchant liable
- If merchant has EMV terminal but issuer hasn't issued chip card: issuer liable
- If both EMV-compliant and chip properly processed: issuer liable
- Result: 76% decline in counterfeit fraud (Visa data, 2015-2017)
- Each EMV transaction generates unique cryptographic value (can't duplicate)

Sources: [Chargeback Gurus EMV](https://www.chargebackgurus.com/blog/emv-chips-liability-shift), [US Payments Forum EMV](https://www.uspaymentsforum.org/understanding-the-u-s-emv-fraud-liability-shifts/)

### Surcharging/Cash Discount Legality

**States that PROHIBIT surcharging**: California, Connecticut, Maine, Massachusetts

**States with SPECIFIC RESTRICTIONS**: Colorado, Minnesota (must build into advertised price as of Jan 2025), New Jersey, Nevada, South Dakota, Oklahoma, New York, Virginia (must disclose in total price as of July 2025)

**Card network limits**: Visa caps at 3%, Mastercard at 4%. Cannot exceed actual cost of acceptance. Debit and prepaid cards CANNOT be surcharged in any state.

**Cash discounts**: Legal in ALL 50 states.

**Kansas**: Surcharging became legal Jan 1, 2025, with clear/conspicuous notice requirement.

Sources: [LawPay Surcharge Rules](https://www.lawpay.com/about/blog/credit-card-surcharge-rules/), [GetVMS Surcharge Laws](https://www.getvms.com/credit-card-surcharge-laws-by-state/), [PaymentCloud Surcharge Guide](https://paymentcloudinc.com/blog/credit-card-surcharge-laws-by-state/)

---

## 3. PAYMENT PROCESSING INDUSTRY

### End-to-End Payment Flow

**Participants:**
1. **Cardholder** presents card (swipe/dip/tap)
2. **Merchant POS/Terminal** captures and encrypts payment data
3. **Payment Gateway** routes encrypted data to processor
4. **Payment Processor** routes to acquiring bank
5. **Acquiring Bank** (merchant's bank) forwards via card network
6. **Card Network** (Visa/MC/Amex/Discover) routes to issuing bank
7. **Issuing Bank** (cardholder's bank) verifies funds, checks fraud, approves/declines
8. **Response** flows back through the chain

**Three phases:** Authorization (real-time) -> Clearing (overnight) -> Settlement (1-3 business days)

Sources: [Financial Professionals Credit Card Processing](https://www.financialprofessionals.org/training-resources/resources/articles/Details/credit-card-processing-explained-what-it-is-and-how-it-works), [Stripe Interchange Fees](https://stripe.com/resources/more/interchange-fees-101-what-they-are-how-they-work-and-how-to-cut-costs), [SDK Finance Payment Processing Architecture](https://sdk.finance/blog/payment-processing-systems-architecture-workflow-and-business-use-cases/)

### Major Payment Processors with Restaurant APIs

| Processor | Key Notes |
|-----------|-----------|
| **Valor PayTech** | **Sear's integrated processor.** Founded 2019, HQ Jericho NY. ~264 employees, ~$15M revenue, 250K+ connected devices. Processor-agnostic infrastructure (works with TSYS, Fiserv, WorldPay, Elavon, EPX, Priority, Repay on the backend). Key differentiator: Dual Pricing. API at valorapi.readme.io. Integration via Valor Connect (MQTT) or REST API. Hardware: VP800, VP550, VP300 Pro, RCKT (mobile Bluetooth), VL500. |
| **Stripe** | Stripe Terminal SDK (iOS, Android, React Native, JS); WisePOS E, WisePad 3, Reader S700, M2 |
| **Square** | Fully integrated ecosystem; Reader, Terminal, Register hardware |
| **Worldpay (FIS)** | Enterprise-grade; broad international coverage |
| **Heartland (Global Payments)** | Restaurant-focused; POS integrations |
| **TSYS (Global Payments)** | Merged with Global Payments; enterprise |
| **First Data/Fiserv** | Clover parent company; broad merchant services |
| **Elavon (US Bank)** | Restaurant-specific solutions |
| **Global Payments** | Owns Heartland & TSYS; one of the largest |

> **Note:** While the table above lists major processors in the market for reference, Sear POS exclusively integrates with Valor PayTech. Valor's processor-agnostic backend infrastructure means restaurants benefit from competitive interchange rates across TSYS, Fiserv, WorldPay, Elavon, and others — without Sear needing to maintain separate integrations with each.

### Pricing Models Comparison

**Interchange Plus (IC+):**
- Pays interchange + network costs + fixed processor markup
- Most transparent; see exactly what you pay per transaction
- Typically lowest cost for businesses processing $10K+/month
- Best for restaurants with decent volume and mixed card types

**Flat Rate:**
- Single fixed fee for all transactions regardless of card type
- Simple and predictable
- Set high enough to guarantee processor profitability -- operators often overpay
- Best for new/low-volume businesses

**Tiered:**
- Groups into qualified, mid-qualified, non-qualified tiers
- Least transparent -- processors don't clearly explain categorization
- Typically most expensive; avoid for restaurants

Sources: [Lightspeed Pricing Models](https://www.lightspeedhq.com/blog/interchange-plus-rates-vs-flat-processing-fees/), [Toast Interchange vs Flat](https://pos.toasttab.com/blog/interchange-plus-pricing-flat-credit-card-rates-explained), [PayCompass Pricing Comparison](https://paycompass.com/blog/interchange-plus-vs-flat-rate-vs-tiered-pricing/)

### Average Interchange Rates (2025-2026)

**Visa:**
- Regulated debit: 0.05% + $0.22
- Credit retail: 1.51% + $0.10
- Rewards/Signature Preferred: 2.10% + $0.10
- Corporate: 2.10% + $0.10
- Business: 2.20% + $0.10

**Mastercard:**
- Regulated debit: 0.05% + $0.22
- Credit consumer: 1.58% + $0.10
- World Elite: 2.30% + $0.10
- Corporate: 1.90% + $0.10
- Highest tier: up to 2.95% + $0.20

**American Express:**
- Generally 2.5%+ for restaurants (higher than Visa/MC)
- No standardized public rate table -- varies by volume, ticket size, card-present vs not
- OptBlue program lets small merchants bundle Amex through their processor
- Rates change biannually (April and October)

**Discover:** Rates generally comparable to Visa/MC but less publicly documented.

**Pending settlement (Nov 2025):** If approved, networks agreed to lower interchange by 0.10% over 5 years and cap standard cards at 1.25%.

Sources: [AllayPay Interchange Rates](https://allaypay.com/blog/processing/current-interchange-rates-in-the-usa-updated-2026/), [Host Merchant Services US Rates](https://www.hostmerchantservices.com/current-us-interchange-rates/), [Swipesum Amex Rates](https://www.swipesum.com/insights/understanding-american-express-interchange-rates)

### PayFac vs Traditional Merchant Accounts

**PayFac (Payment Facilitation):**
- PayFac is the primary merchant; your customers become "sub-merchants" under master account
- Fast onboarding (minutes vs days)
- Flat-rate pricing (simpler but potentially more expensive)
- PayFac owns all risk, handles underwriting, compliance
- Examples: Square, Stripe (when acting as PayFac)
- Best for: POS vendors who want embedded payments with simple onboarding

**Traditional Merchant Account:**
- Each business gets own Merchant ID (MID)
- 2-3 day underwriting/application process
- More complex pricing but potentially cheaper at volume
- Merchant has direct control, more customization
- Best for: high-volume businesses wanting lowest rates

Sources: [PAYARC Traditional vs PayFac](https://payarc.com/traditional-merchant-services-vs-payment-facilitation/), [NMI PayFac Model](https://www.nmi.com/blog/payfacs-the-ins-and-outs-of-the-payment-facilitator-model/), [Stripe Processor vs Payfac](https://stripe.com/resources/more/payment-processor-vs-payment-facilitator-how-they-are-different-and-how-to-choose-one)

### Tokenization

- EMV chip creates unique cryptographic value per transaction
- Valor terminals return a token to the application (no raw card data touches POS)
- End-to-end or point-to-point encryption on all Valor terminal hardware (VP800, VP550, VP300 Pro, RCKT)
- PCI PTS SRED-certified devices encrypt at point of capture
- P2PE (Point-to-Point Encryption) solutions reduce merchant PCI scope

### Pre-Authorization (Bar Tabs)

- Card is pre-authorized for a set amount to verify validity and hold funds
- Customer retains physical card possession
- Hold typically lasts ~36 hours (varies by card network/issuing bank)
- Prevents expired/canceled card use and "walkouts"
- Single card read; additional items added to tab without re-swiping
- Final settlement amount adjusted at tab close (includes tip)

Sources: [Square Pre-Auth](https://squareup.com/help/us/en/article/8455-enable-and-configure-preauthorization-for-bar-tabs), [Toast Pre-Auth](https://pos.toasttab.com/blog/what-is-preauthorization), [SpotOn Bar Tabs](https://www.spoton.com/blog/bar-tabs-pre-authorization-speed-up-transactions-eliminate-walkouts/)

### Tip Adjustment Post-Authorization

- Card authorized for meal amount at time of payment
- Guest adds tip on receipt/screen
- Server enters tip amount into POS (typically end of shift)
- Final transaction amount (meal + tip) settles in the batch
- Manual batching common for restaurants because final amount unknown at authorization time

### Batch Settlement

- End of business day: all authorized transactions grouped as a batch
- Batch submitted to processor -> processor alerts acquiring bank -> acquiring bank alerts issuing banks via card networks -> funds transfer
- **Clearing**: completed overnight
- **Settlement**: 1-3 business days after transaction
- **Same-day funding**: requires batch close before processor's cut-off (often 1-2 PM ET)
- Restaurants use manual batching because tip adjustments change final amounts

Sources: [Stripe Settlement](https://stripe.com/resources/more/payment-settlement-explained-how-it-works-and-how-long-it-takes), [Helcim Batches Guide](https://www.helcim.com/guides/batches-and-settlements/), [Microsintegratedpayments Restaurant Settlement](https://microsintegratedpayments.com/blog/payment-settlement-funding/)

---

## 4. RESTAURANT INDUSTRY STANDARDS & WORKFLOWS

### Service Models

| Model | Description |
|-------|-------------|
| **Full-service** | Table service, servers, courses, tipping |
| **Quick-service (QSR)** | Counter ordering, fast prep, limited menu |
| **Fast-casual** | Counter ordering, higher-quality food, may bring to table |
| **Bars/Nightclubs** | Tab-based, heavy drink focus, ID verification |
| **Food trucks** | Mobile, limited menu, quick payment |
| **Ghost kitchens** | Delivery-only, no dine-in, multiple virtual brands |
| **Cafeterias** | Self-serve or line service, institutional |

### Kitchen Workflow

Order received at POS -> sent to KDS/printer by station -> prep begins -> expo reviews quality/completeness -> serve to guest

### Kitchen Station Types

Grill, saute, fry, cold/salad, pastry/dessert, expo (expeditor), bar. Each station can have its own KDS display.

### KDS Order Routing

- Items automatically routed to correct station based on item-to-station mapping
- Routing considers equipment availability and workload
- Coursing groups items by course (starters, mains, desserts) for sequenced prep
- Bump bars let cooks mark orders complete without touching screens
- KDS deployments cut average ticket times 20-30%
- Fine dining: KDS controls start of prep for each course, ensuring dishes arrive together

Sources: [OrderingStack KDS Guide](https://orderingstack.com/blog/a-guide-to-kitchen-display-system-kds-in-restaurant), [Chowbus KDS](https://www.chowbus.com/blog/kds-kitchen-display-system), [Fresh Technology KDS Features](https://www.fresh.technology/blog/kitchen-display-system-features-you-need)

### Standard Modifier Patterns

1. **Size/Quantity**: Small, medium, large, half/full portion (force 1 selection)
2. **Temperature/Prep**: Rare, medium-rare, medium, well-done (force 1 selection)
3. **Sides**: Choice of side with entree (force 1 selection, max 1)
4. **Ingredients/Add-ons**: Extra cheese, no onions, add bacon (optional, multiple allowed)
5. **Substitutions**: Swap fries for salad, gluten-free bun
6. **Allergies**: Nut allergy, dairy-free, gluten-free (flagged items)
7. **Prefixes**: Add, No, Extra, Side, Light, On-Side -- applied to any modifier without duplicating items
8. **Keyword styles**: "gluten-free", "on side", "no dairy" linked to modifier display

Sources: [Aloha POS Modifier Groups](https://docs.ncrvoyix.com/restaurant/aloha-pos/implementing/field_definitions/modifier_groups), [Quantic Modifiers](https://getquantic.com/support/modifiers-groups-and-modifiers-fs/), [Toast Menu Hierarchy](https://doc.toasttab.com/doc/platformguide/adminMenuHierarchy.html)

### Coursing (Fine Dining)

Items grouped by course number. KDS holds subsequent courses until expo fires them. Ensures starters are cleared before mains arrive. Critical for timing and guest experience.

### Open/Close Procedures

**Open**: Count cash drawer, verify starting balance, log into POS, check inventory levels, verify daily specials entered

**Close**: 
- Print X report (preview sales without resetting)
- Servers enter all tips, close all tabs
- Print Z report (final sales summary, resets counters)
- Cash drawer count and reconciliation
- Tip reconciliation (tips match reported amounts)
- Review voids, comps, discounts for the day

Sources: [Lightspeed Z Report](https://resto-support.lightspeedhq.com/hc/en-us/articles/115001725973-Closing-Report-Z), [Square Close of Day](https://squareup.com/help/us/en/article/6594-end-of-day-reporting-with-square-for-restaurants), [Toast Close Out](https://doc.toasttab.com/doc/platformguide/platformCloseOutDayOverview.html)

### Receipt Format

Standard thermal receipt includes: restaurant name/address/phone, date/time, server name, table/check number, itemized list with prices, subtotal, tax (itemized by type), total, payment method, tip line (for credit), last 4 of card, transaction ID, merchant copy vs customer copy.

### 86ing

Marking an item as unavailable/out of stock. Operationally: manager or kitchen marks item as 86'd in POS -> item grays out or shows warning on order screens -> servers informed immediately -> prevents new orders of that item -> can be reversed when restocked.

### Discount Types

1. **Percentage off** (e.g., 10% off, 20% off)
2. **Dollar amount off** (e.g., $5 off)
3. **Comp** (full item removal from bill -- guest relations, quality issues)
4. **Employee meal** (tracked separately as employee benefit; can integrate with payroll deduction)
5. **Manager comp** (requires manager passcode/permissions)
6. **Owner/investor meals** (tracked separately)
7. **Marketing/promo code** (valid within date ranges, can be single-use, may require code entry)
8. **Waste/spill** (rung on separate ticket and comped)

Sources: [Toast Restaurant Discounts](https://pos.toasttab.com/blog/on-the-line/restaurant-discounts), [RestaurantOwner Comps Guide](https://www.restaurantowner.com/public/How-to-Get-Control-of-Your-Comps-Discounts-and-Promos.cfm), [Prix Fixe Comps vs Discounts](https://prixfixe.accountants/blog/2019/3/24/comps-vs-discounts-vs-voids-how-are-they-different)

### Split Checks

- **By item**: Each guest selects their items from the check
- **By seat**: Items pre-assigned to seat numbers, auto-split
- **Equal split**: Total divided evenly across N payments
- **Custom split**: Arbitrary dollar amounts per payment method

### Transfers

- **Table-to-table**: Move check from one table to another (guest moves)
- **Server-to-server**: Reassign check when server goes off shift or sections change

### Void/Refund Workflows

**Void**: Applied before item is made/delivered. "(VOIDED)" appears on KDS. If split checks exist, system prompts for which check. Requires manager approval in most configurations.

**Refund**: Applied after payment finalized. Receipts included in Z report must be refunded through back office. All split amounts voided if bill was split; refund ticket printed with negative amount.

Sources: [Toast Voiding Orders](https://doc.toasttab.com/doc/platformguide/adminVoidingOrders.html), [Square Check Management](https://squareup.com/help/us/en/article/8166-comp-void-and-reassign-checks-with-square-for-restaurants)

---

## 5. HARDWARE & DEVICE COMPATIBILITY

### iPad Models for POS

**Current lineup (2025-2026):**
- **iPad (2025)**: 11" screen -- good general-purpose POS terminal
- **iPad Air (2026)**: 11" and 13" models -- good balance of performance/cost
- **iPad mini (A17 Pro)**: 8.3" -- suitable for handheld/tableside ordering
- **iPad Pro (2025)**: 11" and 13" -- overkill for POS but maximum performance

Most POS vendors (Square, TouchBistro, Lightspeed) support current-generation iPads. TouchBistro is iPad-only. Screen size choice depends on use case: 11" for countertop terminals, 8.3" for handheld/tableside.

Sources: [TheRestaurantHQ iPad POS Guide](https://www.therestauranthq.com/technology/best-ipad-restaurant-pos-system/), [Apple iPad Compare](https://www.apple.com/ipad/compare/)

### Android Tablet Options

- **Samsung Galaxy Tab Active 3**: Durable, water-resistant -- popular for POS
- **Lenovo Tab P12**: Good performance for commercial use
- **Lenovo ThinkTab**: Enterprise-focused (announced 2026)
- Key factors: durability, water resistance, long battery life, software compatibility
- Supported by eHopper, Square (Android), Shopify POS, and others

Sources: [Hashmato Top POS Tablets](https://hashmato.com/best-tablets-pos-system/), [eHopper Samsung POS](https://ehopper.com/samsung-pos/), [Lenovo Commercial Tablets](https://techtoday.lenovo.com/us/en/tablets)

### Receipt Printers (iPad-Compatible)

**Star Micronics:**
- **mPOP**: Combo receipt printer + cash drawer; Apple MFi certified; Bluetooth + iOS connectivity; 2" thermal printer; "drop-in and print" paper loading. Dual-chip (Bluetooth iOS + Bluetooth 2.1 for Android/Windows)
- **TSP143III LAN**: Ethernet network printer, compatible with iOS
- All Star Bluetooth printers: Apple MFi certified for iPad/iPhone

**Epson:**
- **TM-82II**: Compatible with Square, iOS and Android
- Network and Bluetooth models available

**Connection types**: USB (most common), Ethernet/Network, Bluetooth

Sources: [Star Micronics mPOP](https://starmicronics.com/product/mpop-receipt-printer-and-cash-drawer-combo/), [Star Micronics Apple POS](https://starmicronics.com/apple-pos-system-solutions/), [Square Printer Compatibility](https://squareup.com/us/en/compatibility/accessories/printers)

### Cash Drawers

- **Star Micronics mPOP**: Integrated printer + cash drawer combo (unique "Flat Bill" till design)
- **APG**: Standard standalone cash drawers, connect to printer via RJ12 cable (printer-driven)
- Cash drawers typically kick open when receipt prints (printer-driven kick)

### Card Readers (iPad-Compatible)

**Valor PayTech terminals (Sear's integrated payment hardware):**
- **Valor VP800**: Dual-display countertop terminal. Customer-facing screen + merchant screen. Chip/swipe/contactless.
- **Valor VP550**: Countertop terminal. Chip/swipe/contactless. Compact footprint.
- **Valor VP300 Pro**: PIN pad. Used as customer-facing input device paired with POS.
- **Valor RCKT**: Mobile Bluetooth terminal. Pairs with iOS/Android devices. Ideal for tableside payments, food trucks, outdoor seating.
- **Valor VL500**: Versatile terminal option.
- All Valor terminals: end-to-end encryption, EMV certified, return tokens (no raw card data). Connected via Valor Connect (MQTT cloud protocol) or local network.

Sources: [Valor PayTech](https://valorpaytech.com), [Valor API Docs](https://valorapi.readme.io)

### Kitchen Display Hardware

- **Commercial-grade touchscreen monitors**: 15-22"+ screens, heat/humidity rated, $600-1,200/station
- **Non-touchscreen monitor + bump bar**: Standard display + Android box or mini PC, $500-900/station
- **Bump bars**: Industrial-grade keypads (programmable keys for bump, next, reroute, view details); heat/humidity tested
- **Providers**: QSR Automations, PARTech, SkyTab, Oracle, Fresh KDS
- **Tablets**: Can be used as KDS but less durable than commercial displays in kitchen environments

Sources: [SkyTab KDS Hardware](https://www.skytab.com/pos-hardware/kitchen-display-system), [PARTech KDS](https://partech.com/products/kds-hardware/), [QSR Automations Bump Bars](https://qsrautomations.com/display-bump-bars/)

### Barcode Scanners & Scales

- Standard USB or Bluetooth barcode scanners compatible with most POS
- Deli scales: 15-30 lb capacity, print embedded barcode labels
- Scale integration: USB or wireless Bluetooth to POS
- Embedded barcode labels scanned at checkout like regular items
- Useful for delis, meat markets, weight-based items

Sources: [POSNation Scales](https://www.posnation.com/blog/scales), [Semicron Deli POS](https://www.semicron.com/deli.html)

### Customer-Facing Displays

- Dual-screen POS terminals (e.g., eHopper 2x 15.6" 1080p)
- Secondary iPad paired over WiFi (Lightspeed approach)
- AirPlay-compatible external displays
- Functions: order review, tipping prompts, digital advertising when idle, loyalty program promotion

Sources: [TouchBistro CFD](https://www.touchbistro.com/customer-facing-display/), [Lightspeed CFD](https://www.lightspeedhq.com/pos/restaurant/customer-facing-display/), [Electronic Payments CFD Benefits](https://electronicpayments.com/blog/7-practical-ways-a-pos-with-a-touchscreen-customer-facing-display-can-benefit-your-counter-service-restaurant/)

### iPad Kiosk Mode

**Guided Access** (built-in, no MDM required): Locks to single app, disables hardware buttons. Good for single devices. No remote management.

**Single App Mode (SAM)** via MDM: For supervised/managed devices. Locks to one app, prevents app switching during service. Remote management, bulk deployment.

**MDM providers**: SimpleMDM, Hexnode, 42Gears, ManageEngine, Trio, EasyControl. Essential for multi-device restaurant deployments.

Sources: [SimpleMDM iOS Kiosk](https://simplemdm.com/blog/how-to-use-ios-single-app-mode/), [Trio iPad Kiosk](https://www.trio.so/blog/ipad-kiosk-mode/), [EasyControl iPad Guide](https://www.easycontrol.io/blog/ipad-kiosk-mode-the-complete-2025-guide)

### Network Requirements

- **Dual-band WiFi** recommended (2.4GHz for range, 5GHz for speed)
- **Hardwired Ethernet** preferred where possible (terminals, printers)
- All devices must be on same local network for offline mode
- **Star SteadyLAN**: Provides Ethernet to iOS device via Lightning/USB-C cable through networked printer
- **Offline capability**: Critical -- must handle orders and local payments when internet drops. Local network (WiFi) must still work even if internet is down for device-to-device communication.
- **Cellular failover** (mobile hotspot) as backup recommended

Sources: [Toast Offline Mode](https://doc.toasttab.com/doc/platformguide/adminOfflineModeOverview.html), [TouchBistro Hybrid POS](https://www.touchbistro.com/blog/what-is-a-hybrid-pos/), [Star Micronics Offline](https://starmicronics.com/blog/restaurant-pos-offline-mode/)

---

## 6. INTEGRATION ECOSYSTEM (Ranked by Importance)

### Tier 1 -- Critical (must-have at launch or shortly after)

1. **Payment Processing** (Valor PayTech) -- Core functionality, non-negotiable. All payment processing through Valor via REST API and Valor Connect (MQTT).
2. **Delivery Platforms** (DoorDash, Uber Eats, Grubhub) -- 40% of total restaurant revenue comes from delivery; these platforms control 70%+ of the delivery app market. Integration approaches: direct API plugins (Toast, Revel, Lightspeed offer these) OR middleware aggregators (Chowly, Cuboh, Deliverect, KitchenHub)
3. **Accounting** (QuickBooks, Xero) -- QuickBooks Online Advanced is the dominant choice; auto-sync sales, labor, tax data. Xero used internationally.
4. **Employee Scheduling/Labor** (7shifts, HotSchedules/Fourth, When I Work, Homebase) -- 7shifts is the restaurant industry leader; syncs with payroll; critical for labor cost management

### Tier 2 -- High Priority (needed within first 6 months)

5. **Payroll** (Gusto, ADP, Paychex) -- Gusto popular for SMB; ADP/Paychex for enterprise. Integrates with scheduling tools.
6. **Reservations** (OpenTable, Resy, Yelp Reservations) -- OpenTable seats 1.6B diners/year at 60,000 restaurants. Essential for full-service.
7. **Loyalty** (built-in preferred; standalone options include Paytronix, FiveStars/SumUp) -- Built-in loyalty reduces friction and captures more data
8. **Inventory/Food Cost** (MarketMan, BlueCart, Restaurant365) -- MarketMan integrates with DoorDash, Uber Eats, Grubhub, OpenTable, 7shifts. Restaurant365 is all-in-one.

### Tier 3 -- Nice to Have

9. **Review Management** (Yelp, Google Business) -- Reputation monitoring
10. **Recipe/Food Cost Management** (MarginEdge, Plate IQ) -- Recipe costing, invoice processing
11. **Music** (Rockbot, Soundtrack Your Brand) -- Licensed background music
12. **Food Waste Tracking** (Leanpath) -- Sustainability compliance, cost reduction

Sources: [7shifts Restaurant Management Apps](https://www.7shifts.com/blog/restaurant-management-app/), [ChowNow POS Integration Guide](https://get.chownow.com/blog/integrate-pos-system-uber-doordash-grubhub/), [KitchenHub POS Integration API](https://www.trykitchenhub.com/pos), [Lavu Must-Have Integrations](https://lavu.com/must-have-restaurant-pos-integrations-save-time-and-money/)

---

## 7. INDUSTRY TRENDS (2024-2026)

### AI in Restaurants

- **Voice ordering**: Crossed critical threshold in 2026 from experimental to essential infrastructure. Taco Bell processing millions of AI drive-thru orders. SoundHound AI a leading vendor.
- **Predictive analytics**: AI analyzes sales data + traffic patterns for demand forecasting, staff scheduling, inventory prediction
- **Dynamic pricing**: Real-time price adjustments based on demand, time of day, and location activity. Trend toward "invisible AI" that quietly manages pricing and personalized loyalty
- **Automated scheduling**: AI optimizes labor based on predicted demand

Sources: [Food Institute AI Impact](https://foodinstitute.com/focus/6-ways-ai-will-impact-restaurants-in-2026/), [QSR Web AI-Driven Restaurant](https://www.qsrweb.com/articles/why-2026-is-the-year-of-the-ai-driven-restaurant/), [SoundHound Automated Ordering](https://www.soundhound.com/voice-ai-blog/making-the-switch-to-automated-restaurant-ordering-what-you-need-to-know/)

### QR Code Ordering

- Self-checkout kiosks with QR code scanning gaining adoption
- New tools like Amora AI transform static menus into AI-powered ordering agents via QR code in 60 seconds
- Guest sentiment mixed: some prefer efficiency, others find it impersonal
- Best adoption in fast-casual and QSR; full-service guests still prefer human interaction

### Contactless Payment

- 86% of global consumers use contactless in 2025
- US: 58-65% of in-store digital transactions are contactless
- Tap-to-pay 60% faster than chip-based payments
- 97% of new smartphones in 2025 have NFC
- 75%+ of retailers upgraded to NFC terminals; expected 93%+ by 2026
- 5.3 billion people globally use Apple Pay/Google Pay
- Contactless market projected at $69.7B, growing at 19.2% CAGR
- 81%+ of consumer credit cards will have contactless by 2026

Sources: [Coinlaw Contactless Stats](https://coinlaw.io/contactless-payment-statistics/), [Mastercard Contactless 2025](https://www.mastercard.com/us/en/news-and-trends/stories/2025/contactless-payments-2025.html), [Cheqly US Contactless](https://cheqly.com/us-contactless-payments-2025/)

### Ghost Kitchens / Virtual Brands

- Global ghost kitchen market: $88.42B in 2025, projected $196.69B by 2032
- AI-powered robotics for food prep
- Multiple virtual brands from single kitchen facility
- Delivery-only operations with lower overhead

### Subscription/Membership Dining

- Subscriber counts across industries growing 15.4% YoY
- 44% of diners order takeout/delivery weekly
- Success stories: Panera "Unlimited Sip Club", Pret A Manger "Club Pret" (10% growth in Q3 2025)
- Benefits: predictable revenue streams, higher customer lifetime value, repeat visits
- 2026: More coffee shop subscriptions expected; dining memberships expanding beyond food to "community engagement"

Sources: [Getcraver Restaurant Tech Trends](https://www.getcraver.com/blog/restaurant-technology-trends/), [Restolabs Food Subscription](https://www.restolabs.com/blog/food-subscription-service-restaurants), [OpenTable 2026 Dining Trends](https://www.opentable.com/c/top-restaurants/dining-trends/)

### Sustainability Tracking

- US restaurants discard 11.4M tons of food annually
- Every $1 invested in food waste reduction = ~$14 return
- POS systems can track carbon footprint of menu items by analyzing ingredient sourcing
- AI waste tracking (cameras + AI categorize discarded food): Leanpath cuts waste 50%
- 91% of customers prefer businesses actively reducing food waste
- Methods: manual logging, weighing scales, waste tracking apps, automated sensors, POS integration

Sources: [Toast Sustainable Tech](https://pos.toasttab.com/blog/on-the-line/sustainable-restaurant-technology), [KitchenHub POS Sustainability](https://www.trykitchenhub.com/post/the-role-of-pos-systems-in-reducing-food-waste-and-improving-sustainability), [Leanpath AI Waste Prevention](https://www.leanpath.com/)

### Reservation + Waitlist Integration with POS

- OpenTable and Resy integrations becoming standard -- POS knows who's coming, party size, preferences
- Waitlist management merging with POS for real-time table/capacity tracking

### Handheld Ordering Devices

- No longer a trend -- becoming standard in modern restaurant operations
- Toast Go 2 is the "gold standard" (waterproof, purpose-built)
- Benefits: faster order entry, 20-30% higher check averages (upselling), fewer errors, instant kitchen routing
- 2026 requirements: strong WiFi, integrated payments, durable build, live reporting, offline capability, contactless payment support

Sources: [Foodhub Handheld POS](https://foodhubforbusiness.com/blogs/best-handheld-pos-systems-for-restaurants/), [Flipdish Handheld Features](https://www.flipdish.com/resources/blog/handheld-pos-features-restaurants), [Chowbus POS Trends](https://www.chowbus.com/blog/pos-trends)

---

That concludes the exhaustive research across all seven areas. All findings are sourced from current (2024-2026) industry data. The specialist agents can now reference any section for their work.


---


# Part 3: User Personas & Requirements

## 3.1 Persona: Small Restaurant Owner (1-3 Locations)

*Based on 18 years of operating a neighborhood bistro (45 seats), a fast-casual sandwich shop, and a food truck. Experience with Square, Toast, Clover, and MICROS.*




# Everything a Small Restaurant Owner Needs You to Know About POS Systems

I'm going to lay this out the way I'd tell it to a friend at the bar after close. Eighteen years, three concepts, four POS systems, and more gray hairs than I can count.

---

## 1. Onboarding & Setup

**How long should setup take?**

Realistically? A full menu build for a 45-seat bistro with 80-100 items, modifiers, coursing, and kitchen routing should take a dedicated owner about 6-8 hours spread over 2-3 days. That's if the interface isn't fighting you. Toast took me almost two full weeks because their "onboarding specialist" was a 22-year-old who'd never worked in a restaurant, and I had to keep scheduling calls around service. If you can get a restaurant owner from "I just signed up" to "I'm running a test service" in under 48 hours of actual work time, you'll win.

Here's the thing nobody tells you: the menu isn't the hard part. It's the modifiers. I had a burger with 6 protein temps, 14 toppings, 3 bun options, and "make it a combo" with 8 sides and 6 drinks. That single item had hundreds of possible permutations. If your modifier system is clunky, if I have to re-enter the same modifier group for every item individually instead of creating it once and attaching it to multiple items, I'm already regretting my decision.

What I want: let me upload a spreadsheet. Seriously. I already have my menu in Excel or Google Sheets. Every restaurant owner does. Let me import that, then fine-tune modifiers and pricing in the UI. Toast actually does this reasonably well with their menu import. Don't make me type "Side Caesar Salad $4.50" into a form field 50 times across different categories.

**Data migration from an old POS?**

This is where every new POS company fails. They say "we'll migrate your data!" and then you realize they mean "we'll import your menu items but not your historical sales data, employee records, customer database, or gift card balances." The gift card thing is a landmine. I had $3,200 in outstanding gift cards when I switched from Clover to Toast. Clover wouldn't export the card numbers and balances in any usable format. I ended up honoring them manually with a printed spreadsheet behind the bar for three months.

If you can actually migrate gift card balances, customer loyalty data, and at least 12 months of sales history, you'll eliminate the single biggest switching barrier.

**Staff training**

Here's what's real: your average server is 19-26 years old, grew up on smartphones, and will figure out a tablet-based POS in about 20 minutes IF the interface looks like something they've used before. The buttons need to be big, the flow needs to be obvious, and they need to be able to ring in a 4-top in under 90 seconds. I can usually get a new server functional on Toast in about 30 minutes of shadowing. That's the benchmark.

The people who struggle are the 50-year-old bartender who's been writing tickets by hand for 20 years, and the kitchen staff who have to read the tickets. Keep it simple. Big text. High contrast. No mystery icons.

**Hardware reality**

By now most owners have iPads lying around. I have three iPad 9th gens from my last setup. What I DON'T have and will need to buy: a cash drawer, receipt printer, kitchen display screens (or kitchen printers), and a card reader. This is where you can either be heroes or villains. Toast makes you buy their proprietary hardware at insane markups. A receipt printer that costs $180 on Amazon is $400 through Toast. If you let me use my own Star Micronics or Epson printers, my own cash drawer, and any Bluetooth card reader, I'll love you forever.

But here's the catch: you MUST have a recommended hardware list with confirmed compatibility. "Should work with most printers" is a nightmare. I need to know "buy this exact Star TSP143IV from Amazon for $179 and it works." Tested. Confirmed. Done.

**First-day anxiety**

Everything goes wrong on day one. Everything. Here's what actually happens:

- The kitchen printer loses connection during the first rush and tickets stop printing. Kitchen falls behind. Customers wait 45 minutes for food. You lose $500 in walkouts and comps.
- A server doesn't know how to split a check four ways and there's a line at the register.
- The modifier for "no onions" didn't get programmed and the kitchen puts onions on a dish for someone with an allergy. Lawsuit territory.
- The payment terminal freezes mid-transaction and you don't know if the card was charged.
- Someone tries to use a gift card and you realize you never set up gift cards.

The POS should handle all of this gracefully. A persistent banner that says "Kitchen Printer 2 is offline" — not a silent failure. A check-splitting function that's obvious, not buried three taps deep. A transaction recovery system that tells you "this card was charged $47.82 at 7:14 PM — print receipt again?" when the terminal glitches.

---

## 2. Daily Operations — The Full Day

### 6:00 AM — Open

Manager walks in, turns on lights, starts ovens. First thing on the POS: **open the day**. This should be one button. Not a wizard. Not a "are you sure?" dialog. One button: "Start Day."

Cash drawer count. The POS needs a cash count screen where you tap denominations. How many twenties, tens, fives, ones, quarters, dimes, nickels, pennies. It calculates the total. Compares it to last night's closing count. Flags any discrepancy. This should take under 2 minutes.

The manager also needs to see: are there any open checks from last night that didn't get closed? This happens more than you'd think. Someone walks out, or a server forgot to close a tab before clocking out. These ghost checks need to be visible and resolvable.

### 10:00 AM — Pre-Service Prep

The 86 list is critical. The chef walks the walk-in, realizes you're out of salmon and almost out of the soup special. The POS needs to let someone 86 an item in about 3 taps: find item, mark unavailable, done. Every server's screen should immediately show that item grayed out or with a line through it. No server should be able to order 86'd items. Period.

Reservations: honestly, most small restaurants use Resy, OpenTable, or Yelp reservations separately from the POS. If you can integrate with those, great. But don't build your own reservation system. Nobody will trust it and nobody wants to pay for another one.

Daily specials: I need to add a temporary menu item fast. "Pan-Seared Halibut, $34, fires on Grill station." Under 60 seconds to create and it should appear on all terminals immediately.

### 11:00 AM - 2:00 PM — Lunch Rush

This is where the POS earns its money. Here's what matters:

**Speed of input.** A server walks up to the terminal with 4 tables' worth of orders in their head (or on a notepad). They need to bang those in FAST. The flow is: select table → seat 1 → items → modifiers → seat 2 → items → modifiers → send to kitchen. That entire process for a 4-top ordering appetizers, entrees, and drinks should take under 2 minutes.

**Favorites / quick buttons.** Lunch has maybe 10 items that account for 70% of orders. Those should be on the first screen, big buttons, no scrolling.

**Kitchen Display System (KDS) or ticket printing.** Orders need to route correctly. Apps and salads go to cold station. Burgers go to grill. Fryer items go to fry station. If you make me route items manually, I will lose my mind. Item routing should be baked into menu setup — this item goes to this station, every time.

**Coursing.** "Fire apps first, hold entrees until I say." The server needs a "hold" or "course" button. When apps are almost done, they hit "fire course 2" and entrees start. This isn't optional for a real sit-down restaurant.

**Modifications need to be LOUD on the kitchen ticket.** "NO PEANUTS - ALLERGY" should be in red, bold, all caps. Not in 8-point font at the bottom of the ticket. Someone could die. I'm not exaggerating.

**Check management during rush.** A table wants to split the check. Two couples, separate checks. One person wants to pay their portion in cash, the other with a card. One person wants to buy everyone's drinks on their card. This is the real world. If splitting checks is painful, servers will hate the POS and I will hear about it every single shift.

**Voids and comps during rush.** The kitchen made the wrong dish. I need a manager to void the item, comp a dessert, and move on in 15 seconds. Not navigate three menus and enter a reason code from a dropdown. Quick void. Reason later.

### 2:00 PM - 4:00 PM — Dead Period

This is when I actually look at the POS as a business tool. I want to see:

- **Today's sales so far.** Total revenue, number of covers, average check size.
- **Labor cost right now.** Who's on the clock, what am I paying per hour in labor, what's my labor percentage against today's revenue? This is the number that determines whether I make money this month.
- **Item mix.** What sold today? Did the special move? Should I 86 the soup because I only sold 3 bowls and it's not worth keeping it hot for dinner?
- **Yesterday's full report.** Sales by category, food vs beverage split, discounts given, comps, voids. If I see a server gave 8 discounts yesterday, I want to know why.

Menu updates happen during this window. Pricing changes, adding seasonal items, removing things that don't sell. This should be doable from a tablet or from my laptop — ideally a web dashboard. I don't want to be standing at the POS terminal in the dining room making edits while servers are trying to ring in checks.

### 4:00 PM — Shift Change

Servers clock out. Cash servers need to be cashed out. The POS should show: Server A had $340 in cash sales, $45 in cash tips, owes the house $295. Server A counts their bank, confirms, done. This should take 2 minutes per server, max.

New dinner servers clock in. They should see their table assignments. In a small restaurant, table assignment is usually verbal — "you've got the patio and tables 10-15." But if the POS has a floor plan, it's nice to drag-and-drop assign sections.

Shift notes: "We're low on the merlot, push the cab instead. Table 7 is a VIP regular, take care of them. The ice machine is acting up, call the repair guy tomorrow." A simple text field that the closing manager writes and the opening manager reads. Basic but hugely useful.

### 5:00 PM - 9:00 PM — Dinner Rush

Everything from the lunch rush section, but add:

**Bar tabs.** Customer walks up, opens a tab with a credit card. That card needs to be authorized quickly and the tab stays open. At any point, the customer can add items, close out, or transfer their tab to a table if they sit down. Pre-authorization hold should be configurable — I typically do $50 holds.

**Multiple payment types on one check.** "Put $30 on this card, $25 on this card, and I'll pay the rest in cash." This is Friday night. This is every Friday night.

**Auto-gratuity for large parties.** If the table has 6+ guests, the POS should prompt: "Apply 20% auto-gratuity?" Configurable threshold and percentage.

**Real-time ticket times.** How long has table 12's food been in the kitchen? If a ticket is over 15 minutes, it should turn red on the KDS. The expo needs to see this. The manager needs to see this. If you integrate a notification to the manager's phone when a ticket hits 20 minutes, you'll prevent one bad Yelp review per week.

**Online orders.** If you integrate with DoorDash, UberEats, Grubhub — those orders need to come into the SAME kitchen queue as dine-in orders. Not on a separate tablet. I had three delivery tablets plus my POS on the expo line at one point. It was chaos. Toast handles this pretty well with their online ordering integration. This is table stakes now.

### 9:00 PM - 10:00 PM — Close

**End-of-day is where owners make or lose money on labor.** Every minute you're open past close, you're paying staff to stand around.

The POS needs:
- **Quick close-out for all remaining tabs.** Show me every open check. Let me close them in bulk if needed. If someone walked out (it happens), let me flag it.
- **Server checkout reports.** For each server: total sales, tips collected (cash + credit), tip-out owed to bussers/barbacks/kitchen. Net cash owed to house. Print a slip, server signs, done.
- **End-of-day cash count.** Count the drawer again. Compare to expected cash (starting bank + cash sales - cash payouts). Show me the over/short. If it's more than $5, I want to know why.
- **Daily summary report.** One page. Total sales, broken down by: food, beverage, retail/merch. Total discounts. Total comps. Total voids. Net revenue. Labor cost (hours × rates for everyone who worked today). Credit card tips to be paid out. Theoretical food cost if you're fancy. Average check. Covers. Revenue per seat. Compare to same day last week.

This report should auto-email to the owner. I don't want to generate it. It should just appear in my inbox at 10:15 PM.

### 10:00 PM — Owner Checks Phone

I'm at home. I'm exhausted. I open the app. I want to see:

1. **Today's total revenue.** One big number.
2. **Today vs. same day last week.** Up or down and by how much.
3. **Labor cost percentage.** If it's over 30%, I'm grimacing.
4. **Any alerts.** Voids over $50. Cash drawer discrepancy. Employee overtime. Failed transactions.
5. **Weather forecast for tomorrow** — this sounds stupid but I swear by it. Rain on a Tuesday means I can cut a server. Beautiful Saturday means I need an extra bartender. If your app showed me tomorrow's weather next to my staffing level, I'd show every restaurant owner I know.

That's it. Five things. Don't give me 47 dashboard widgets. I'm tired and I have to do this again in 8 hours.

---

## 3. Pain Points with Existing Systems

### Toast

**The good:** Toast actually works. The kitchen display system is solid. Online ordering integration is good. The reporting is genuinely useful. The hardware (when it works) is purpose-built for restaurants — grease-resistant, drop-tested. Their menu management is decent once you learn it.

**The bad:** They have become the very thing they set out to destroy. Toast started as the anti-Micros, the scrappy startup that understood small restaurants. Now they're a publicly traded company that has to grow revenue every quarter, and they do it by nickel-and-diming their existing customers.

Here's my actual monthly Toast bill from the bistro:
- Software subscription: $75/terminal × 3 = $225/month
- Online ordering module: $75/month
- Toast Payroll: $50/month + $6/employee (12 employees = $122/month)
- Marketing module (email/text campaigns): $50/month
- Gift cards: $50/month setup + per-card fee
- Payment processing: 2.49% + $0.15 per transaction (they own the processing, you can't change it)

Total software: ~$522/month BEFORE processing fees. Processing on $80K/month in credit card revenue was another $2,100/month. So Toast was costing me roughly $2,600/month all-in.

And the hardware. I spent $4,200 upfront on three terminals, two kitchen printers, and two card readers. All proprietary. When I canceled Toast, that hardware became paperweights. Expensive, greasy paperweights.

**What's overpriced:** Everything add-on. Payroll, online ordering, marketing, gift cards — these should be either included or reasonably priced, not $50-75/month each. Their processing rate isn't terrible but you can't shop around, and that lack of choice burns me.

**The real killer:** Toast's contract terms. I was locked into a 2-year agreement with an early termination fee of several thousand dollars. When I wanted to switch, I had to time it perfectly or eat the fee. A POS company that makes its money by trapping you is telling you something about how confident they are you'd stay voluntarily.

### Square

**The good:** Square is free to start. The card reader is like $50. The interface is clean and simple. For my food truck, it was perfect. Tap a few items, swipe a card, done. Their reporting is clean. The ecosystem (Square Online, Square Loyalty, Square Payroll) all talks to each other seamlessly. Deposits hit your bank account fast — next business day, sometimes same day.

**What's missing for a real restaurant:** Coursing. Table management. Kitchen routing to multiple stations. Meaningful modifier management. Server checkout flows. Tip pooling. Bar tab management. Basically everything that separates a restaurant from a retail store. Square for Restaurants exists now but it's a layer of paint on a retail POS. It doesn't think like a restaurant.

The other thing: Square's flat 2.6% + $0.10 is great when you're doing $5,000/month on a food truck. When you're doing $80,000/month in a restaurant, that rate is uncompetitive. You can negotiate better with a traditional processor, but you can't use a different processor with Square.

### Clover

**What works:** Clover hardware is actually nice. The Clover Station looks good on a counter. The app marketplace was interesting in theory — you could add features through third-party apps.

**What doesn't:** Oh god, the app marketplace. You'd install a reservation app and it didn't talk to your POS data. You'd install a loyalty app from a different company and it had its own separate customer database. Nothing integrated properly. It felt like a smartphone app store, not a business tool. I spent hours troubleshooting why my inventory app wasn't syncing with my sales data and it turned out they were made by different developers who never coordinated.

Clover is also sold through resellers (banks and payment companies), and the experience varies wildly depending on who sold it to you. My reseller had support hours of 9-5 Eastern. I close at 10 PM Pacific. When my terminal froze during Saturday dinner service, I couldn't reach anyone until Monday.

### Features that should be included but are charged extra

- Online ordering. This is 2026. It's not a premium feature, it's table stakes.
- Basic loyalty (buy 10 get 1 free). Not complicated enough to justify $50/month.
- Gift cards. The markup on digital gift cards is absurd.
- Employee scheduling. Basic scheduling is not hard. Don't charge me $50/month for a calendar.
- Multi-location management. If I have 2 locations, I shouldn't need to pay 2× for every module.
- Basic text/email marketing to my own customer list.

### Features that are just marketing fluff

- "AI-powered menu optimization." No. I know what sells because I've been doing this for 18 years.
- "Dynamic pricing." I'm not Uber. I'm not surge-pricing my cheeseburger on a Saturday night.
- "Blockchain-verified supply chain." Come on.
- "Social media integration." Nobody's ordering food from their POS's Instagram widget.
- "Gamified employee performance dashboards." My servers don't need a leaderboard. They need to make rent.

### The #1 thing that makes me want to throw the POS through the window

The POS freezing, crashing, or going unresponsive during a rush. Nothing else comes close. I have 15 tables waiting, a line out the door, three servers trying to ring in orders, and the screen is frozen on a spinning wheel. Every second costs me money and reputation. There is no number two on this list that matters even a fraction as much.

Second worst: processing a payment and getting an ambiguous error. "Transaction failed." Did the card get charged? I don't know. The customer doesn't know. Now I have to run it again and hope I didn't double-charge them, or call the processor and wait on hold for 20 minutes while the customer stares at me. This should never happen. Give me a definitive answer: charged or not charged.

---

## 4. Financial Concerns

**Reasonable monthly cost:**

For a single-location, 2-3 terminal restaurant, here's what I'd consider fair:
- Base software: $100-150/month total (not per terminal)
- Each additional terminal: $25-50/month
- Include: basic online ordering, loyalty, gift cards, employee scheduling, reporting
- Payment processing: pass-through at cost or let me choose my processor

Total for a typical small restaurant: $150-250/month all-in for software. That's my ceiling. If you're over $300/month before processing, you'd better be doing something incredible.

For processing: I want the cheapest possible effective rate. My current rate through a local bank is 2.2% + $0.10 for card-present and 2.7% + $0.10 for card-not-present. I save about $2,400/year vs. Toast's locked-in rate.

> **[Sear editorial note]:** Sear's Valor 4% Dual Pricing eliminates this entire concern. The restaurant's processing cost is $0 — the card-paying customer absorbs a 4% fee. That's not "cheaper processing" — it's NO processing cost. Compare: this owner was paying $2,100/month to Toast for processing. With Sear, that drops to $0. And the software is $23-49/month instead of $522/month. Total savings: ~$2,500/month or $30,000/year.

**Hidden fees that burned me:**

- PCI compliance fees: $99/year that showed up unannounced on my Toast bill.
- "Equipment protection plan": $25/month auto-enrolled on Clover hardware.
- Statement fees: $10/month for a paper statement I never asked for (payment processor).
- Batch processing fees: $0.25 per batch settlement. Every single night.
- "Technology fee": a $4.95/month charge from my processor that had no description and they couldn't explain it when I called.
- Annual rate increases buried in the contract fine print: "rates may increase by up to 0.5% with 30 days notice."

**Contract terms that trapped me:**

- 2-year commitment with Toast. Early termination fee.
- Auto-renewal clauses: if you don't cancel 60 days before your term ends, you're locked in for another year. Who remembers to cancel 60 days out? Nobody. They're counting on that.
- Hardware lease vs. purchase confusion: one owner I know thought he bought his Clover terminal, but the reseller had him sign a lease. He was paying $89/month for 48 months for hardware worth $1,200. That's $4,272 for something he could've bought outright.

**What this POS should do:** Month-to-month. No contract. No early termination fee. If your product is good, I'll stay. If it's not, I should be able to leave. This single policy will generate more word-of-mouth referrals than any marketing campaign.

**Financial reports I actually use:**

- Daily sales summary (every night)
- Weekly labor report (every Monday morning)
- Monthly P&L by category (food sales, bar sales, food cost, labor cost, overhead)
- Product mix report (what sold, what didn't — drives menu changes)
- Server performance (sales per labor hour, average check, upsell performance)
- Year-over-year comparison (this March vs. last March)

**Reports I ignore:** Anything with more than 2 pages. Anything that requires an MBA to interpret. Anything that doesn't directly tell me where my money went.

**Tax reporting:** I need the POS to separate taxable and non-taxable sales, calculate sales tax correctly for my jurisdiction (which may include city + county + state taxes that add up differently), and generate a tax summary I can hand to my accountant. If you handle multiple tax rates (food at 0%, alcohol at 8.5%, prepared food at 10.25%), that's not a nice-to-have, it's mandatory.

**Accounting:** QuickBooks Online. I want a direct integration that syncs daily sales into QBO as a sales receipt, broken down by category. If I have to manually enter daily sales into QuickBooks, you've added 30 minutes to my day. Toast does this integration. Square does it too. It's expected.

---

## 5. Staff Management Reality

**Scheduling:**

I've used everything. Currently 7shifts, which costs $35/month and is the best scheduling tool I've found. Don't try to build a 7shifts competitor into your POS. Integrate with 7shifts and let me keep using it. Also integrate with Homebase, HotSchedules, and When I Work. Cover the big four and you're fine.

If you DO build scheduling: the minimum is drag-and-drop shifts on a calendar, availability tracking, shift swaps that employees can request from their phone, and automatic labor cost forecasting based on the schedule. Push notifications to staff when the schedule is posted. That's it.

**Time theft:**

It's real and it's constant. Early clock-ins (10 minutes early every shift = 50 minutes/week of paid time I didn't get). Buddy punching (one person clocking in for another). Late clock-outs (hanging around after close "cleaning" but actually on their phone).

What would help:
- Geo-fencing: can only clock in when physically at the restaurant. GPS on their phone confirms location.
- Manager approval for early clock-ins more than 5 minutes before scheduled shift.
- Automatic clock-out warning: "You were scheduled until 10 PM. It's 10:15. Do you have manager approval for overtime?"
- Photo verification on clock-in (the phone takes a selfie). This alone eliminated buddy punching at my sandwich shop.

**Tip distribution:**

This is a legal and emotional minefield. Every restaurant handles it differently, and the laws vary by state.

What I've done:
- Bistro: servers keep their own tips, tip out 3% of sales to bussers, 1% to bar. Calculated by the POS at checkout.
- Sandwich shop: tip pool, split equally among all front-of-house staff by hours worked.
- Food truck: single tip jar, split between the two people working.

The POS needs to support all of these models and let me configure the rules. Tip pooling, tip-out by percentage of sales, tip-out by percentage of tips, manual tip distribution. And it needs to track it all for tax reporting because tipped income is reported to the IRS.

**Employee turnover:**

In a restaurant? Constant. I add or remove 1-2 employees per month. Adding someone to the POS should take 2 minutes: name, role, PIN code, permissions. Done. When they quit (often without notice), I need to deactivate them instantly. One tap. Their PIN stops working immediately.

**Training new servers:**

If it takes more than one shift of shadowing to learn the POS, the POS is too complicated. A server should be able to ring in an order, send it to the kitchen, process a payment, and close a check by the end of their first training shift. Advanced stuff (voids, comps, transfers, split checks) can come in the second shift.

**Permissions I care about:**

- Server: ring orders, process payments, clock in/out. That's it.
- Bartender: same as server plus open/close bar tabs, apply bar comps up to $20.
- Shift manager: all server functions plus voids, comps, discounts, cash drawer access, 86 items, clock out other employees.
- General manager: everything the owner can do except change pricing, add/remove employees, or access financial reports.
- Owner: everything. Including the ability to see activity logs of who did what and when. If a manager comped $200 in food on Saturday, I want to see that with one tap.

---

## 6. Technology Comfort Level

**Average restaurant owner's tech savviness:**

Low to medium. I'm probably in the top 20% because I'm under 45 and comfortable with technology. But many restaurant owners are 50-65, came up in the industry when tickets were handwritten, and view technology as a necessary evil. Your interface needs to be learnable by someone who uses an iPhone but has never heard of a spreadsheet formula.

Don't make me "configure webhook endpoints." Don't show me a settings page with 200 options. Give me sensible defaults and let me change the 5 things that actually matter.

**WiFi in restaurants:**

It's terrible. Commercial kitchens are full of metal (stainless steel walls, walk-in coolers, commercial ovens) that kills WiFi signals. I've had to install three access points in a 2,000 square foot restaurant to get reliable coverage. The POS terminal at the server station near the kitchen? Always the weakest signal.

Tips:
- Your app should show WiFi signal strength on screen at all times. A little icon in the corner. When it drops below usable, warn me.
- Better yet: support a hardwired ethernet connection as primary, WiFi as backup. I'll run a cable if it means reliability.

**Offline mode — this is non-negotiable:**

My internet goes down at least once a month. Sometimes it's Comcast, sometimes it's my router, sometimes a truck hits a utility pole. When this happens, the POS MUST continue to function:

- Must still accept orders and send them to the kitchen (via local network, not cloud)
- Must still process card payments (store-and-forward, settle when connection returns)
- Must still open and close checks
- Must still print tickets
- Must still clock people in and out

When connectivity returns, everything syncs. No lost data. No duplicate transactions. No conflicts.

If your POS just shows a "No Internet Connection" error and becomes a brick, I will return it the next day. This is the one thing I will ask about in the demo, and if you hesitate or say "we're working on it," I'm walking.

Toast handles offline mode reasonably well. Square does too, for basic functions. This is solved technology. Don't ship without it.

**iPad vs. Android:**

iPad. Not even close. Here's why:
- Consistent hardware. An iPad is an iPad. I don't have to worry about which Android manufacturer, which screen size, which OS version.
- Durability. iPads with a good case (like an OtterBox Defender) survive restaurant abuse — grease, drops, spills.
- Resale value. When I'm done, I can sell the iPad. A restaurant-specific Android tablet is worthless.
- Staff familiarity. Everyone's used an iPad. Not everyone's comfortable with Android.

Support Android too, because some owners prefer it, but optimize for iPad first.

**QR code ordering:**

As a concept, it's here to stay for certain situations. As a replacement for table service, it's a terrible customer experience for sit-down restaurants.

Where it works: fast-casual. Order at the counter, scan a QR code, order from your phone, food comes to you. My sandwich shop would have benefited from this.

Where it fails: full-service restaurants. Customers feel ignored. Older customers can't figure it out. Groups of 6 don't want to each be on their phones ordering separately. It makes the dining experience feel transactional and cold.

What I want: the OPTION to enable QR ordering per-table or per-section. Maybe the bar has QR ordering but the dining room has full service. Let me choose.

From a staff perspective: servers hate QR ordering because it cuts their tips. If the customer never interacts with a human, they don't feel the social pressure to tip 20%. Tips drop 30-40% with QR-only ordering. Your servers will quit.

**Online ordering & delivery:**

I use DoorDash and UberEats reluctantly. They take 25-30% commission, which is my entire margin on most items. But they drive volume and some customers only order delivery.

What I actually want: my OWN online ordering through my own website, with no commission, and the ability to use DoorDash's driver network (DoorDash Drive) for delivery at a flat per-order fee. Toast does this. It's one of their best features.

Your POS should support: direct online ordering (commission-free, I pay a flat monthly fee), integration with DoorDash/UberEats/Grubhub as order sources, and all orders flowing into the same kitchen queue.

**Customer data & loyalty:**

I want to know who my regulars are. I want to know that Mike comes in every Thursday, orders the salmon, spends about $45, and has been a customer for 3 years. If Mike stops coming for a month, I want the system to flag it so I can reach out with a "we miss you" email.

Simple loyalty: points-based. $1 = 1 point. 200 points = $10 off. That's all I need. Don't make it complicated. Let customers enroll at checkout with just their phone number. No app download required — nobody downloads a loyalty app for a neighborhood restaurant.

---

## 7. Growth & Multi-Location

**When do you need multi-location?**

The moment you sign a lease for location #2. And here's what catches people off guard: you need multi-location features BEFORE you open #2, because you're building the menu, training staff, and setting up the POS weeks in advance while still running #1.

**What changes with location #2:**

- Central menu management: I want to update a price once and have it propagate to both locations. But I also need location-specific items (maybe location #2 has a beer selection that #1 doesn't).
- Consolidated reporting: I want to see both locations' numbers in one dashboard. Total revenue across all locations, then drill down by location.
- Employee management across locations: some staff work at both locations. One employee record, two locations.
- Inventory: separate tracking per location (obviously), but ability to compare food costs across locations to identify problems.
- Centralized online ordering: one website, customer picks the location.

**What I'd pay:** For a second location, I'd expect to pay maybe 50-75% of the first location's monthly fee. Not double. The second location uses the same cloud infrastructure, the same menu template, the same reporting engine. Don't charge me full price twice.

---

## 8. Features Wishlist

**Dream POS:**

- Blazing fast. Sub-500ms response on every tap. Non-negotiable.
- Offline-capable. Works without internet for basic operations.
- Bring your own hardware. Integrated Valor Payments with Dual Pricing to potentially eliminate processing fees.
- Month-to-month pricing, under $200/month for a standard setup.
- Beautiful, intuitive interface a new server learns in 30 minutes.
- Rock-solid kitchen display system with ticket timers and routing.
- One-tap 86 with instant sync across all terminals.
- Built-in online ordering with no commission.
- DoorDash/UberEats/Grubhub integration into one queue.
- QuickBooks Online integration that actually works and syncs automatically every night.
- An owner's app that shows me today's sales, labor cost, and alerts in under 5 seconds.
- Smart check splitting that handles every weird scenario.
- Automatic end-of-day reports emailed to me.
- 24/7 support from people who've actually worked in restaurants.

**What would make me switch from Toast TODAY:**

1. Lower processing costs: eliminate or drastically reduce the ~$2,400/year I'm losing on Toast's locked-in processing rate.
2. No contract: month-to-month.
3. Lower total cost: under $200/month vs Toast's $500+.
4. Feature parity on the stuff that matters (KDS, online ordering, reporting, kitchen routing, offline mode).
5. Works on hardware I already own (iPads).

If you can deliver those five things, I'll switch tomorrow and bring five friends with me.

> **[Sear editorial note]:** Item #1 is addressed through Valor's 4% Dual Pricing — the card-paying customer absorbs the processing fee, not the restaurant. Restaurant's processing cost: $0/month. Combined with Sear's software at $23-49/month (2/3 less than Toast), a typical small restaurant's annual cost drops from ~$9,744 (Toast) to ~$276-588 (Sear) — a savings of $9,000+/year. Sear earns its revenue from the 1.9% it keeps from each card transaction.

**What would make me recommend to other owners:**

Reliability. If I run your POS for 6 months and it never crashes during a rush, I will tell every restaurant owner I know. We all talk. Industry events, Facebook groups, standing in line at Restaurant Depot. Word of mouth is everything in this industry. Nobody trusts ads. We trust other owners.

Second: responsive support. When I call at 8 PM on a Saturday because something's broken, I talk to a human in under 5 minutes who understands restaurant terminology. Not a tier-1 agent reading from a script who asks me to "power cycle the device." I already did that. Fix my problem.

**Owner's phone app should show:**

1. Today's revenue (live updating)
2. Comparison to same day last week / same day last year
3. Current labor cost and percentage
4. Active alerts (high void count, cash discrepancy, overtime, offline terminal)
5. Hourly sales chart (am I trending toward a good night or a slow one?)
6. Open checks count and total value
7. Quick access to camera feeds if integrated (would love this)

---

## 9. Deal Breakers

**What would make me NOT buy this POS:**

- Requires proprietary hardware. Instant no.
- Locks me into a specific payment processor. No.
- Requires a multi-year contract. No.
- No offline mode. Absolutely not.
- Can't print to standard kitchen printers. No.
- Doesn't support coursing and kitchen routing. Not ready for real restaurants.
- Web-based with no native app (too slow, browser crashes). Needs to at minimum be a PWA that feels native.
- Built by people who've never worked in a restaurant. I can tell in 5 minutes of using it.

**Minimum features for day 1:**

- Order entry with modifiers, coursing, and kitchen routing
- Table management (floor plan, open/close/transfer tables)
- Check management (split, merge, move items between checks)
- Payment processing (card, cash, gift card, split payments)
- Kitchen ticket printing or KDS
- Cash drawer management (open, count, close)
- Employee clock in/out with basic roles/permissions
- Basic reporting (daily sales, product mix, labor)
- 86 functionality
- Receipt printing (and email receipts)
- Offline mode

Everything else can come in month 2 or month 3, but those are non-negotiable on day 1.

**Reliability expectations:**

Zero crashes per month during service hours. Zero. Not one. Not "rarely." Zero. If the POS crashes during a Saturday dinner rush, I will lose hundreds of dollars in revenue, piss off dozens of customers, and probably lose at least one good server who decides this job isn't worth the stress.

I understand bugs happen. Fix them fast. But the POS should never become completely non-functional. If one terminal crashes, the others keep working. If the app crashes, it restarts in under 10 seconds with the current state preserved. No lost orders.

**Support expectations:**

- Phone support: 7 days a week, at least 8 AM to midnight in my time zone. I don't care if it's a skeleton crew on Christmas. Restaurants are open on Christmas.
- Response time: under 5 minutes for critical issues (system down, can't process payments). Under 2 hours for non-critical issues.
- Chat support is fine for non-urgent stuff.
- Email support is useless for urgent problems. Don't even mention it.
- A knowledge base with actual articles and video walkthroughs for common tasks. This is where your support costs drop — most questions are "how do I do X" and a 2-minute video answers it.
- In-app chat with screen sharing. If I can share my screen with support while I'm standing at the terminal, we solve problems 10x faster.

**What makes me trust a POS company:**

- Transparent pricing on the website. No "call for a quote."
- Month-to-month contracts. You believe in your product.
- The founder or leadership has restaurant experience. Or at minimum, they've spent real time in real restaurants watching real people use their product.
- They respond to negative reviews on G2/Capterra with real solutions, not corporate speak.
- Other restaurant owners I know use it and haven't complained.
- They have a public product roadmap so I can see what's coming.

**What makes me distrust a POS company:**

- "Schedule a demo" as the only way to see the product. Let me see it. Let me try it. If you're hiding it, it's because it's not ready.
- Pricing that requires talking to a salesperson. You're going to upsell me.
- Aggressive salespeople who call me four times after I download a whitepaper.
- Case studies that only feature restaurants with 200+ seats. You don't care about me.
- A support page that's just a contact form. Where's the phone number?
- Any mention of "minimum 2-year commitment."

---

## The 2 AM Thought

You asked about the 2 AM moment. Here it is.

It's 2 AM. I can't sleep because Saturday night's numbers aren't adding up. The POS shows $8,400 in sales but the cash drawer was short $63 and one server's credit card tips don't match what the POS says they should be. I need to figure out if it's a POS error, an employee stealing, or my own mistake in the setup. I open the app on my phone, and I need to see every single transaction, every void, every comp, every cash drop, timestamped and associated with an employee. I need to be able to trace that $63 discrepancy to a specific moment in the night.

If your POS can give me that audit trail at 2 AM from my phone, you understand my life.

If your POS shows me a "daily summary" with no drill-down capability and tells me to "check the back office terminal for details," you don't understand my life at all.

---

## Final Thought

The restaurant industry runs on razor-thin margins — 3-9% net profit for most independent restaurants. Every dollar your POS costs me, every minute of downtime, every hour of training — that comes directly out of my pocket and my family's quality of life. I'm not asking for perfection. I'm asking for reliability, honesty, and a fair price. Toast lost sight of that. There's a massive opportunity here if you don't make the same mistake.

Build something that respects the operator. Price it fairly. Make it work when the internet goes down. Answer the phone when I call. That's all most of us need.


---

## 3.2 Persona: Enterprise Restaurant Group Operator (45+ Locations)

*Based on operating a 45-location restaurant group across 8 states and 5 brands. Experience with Aloha, Toast Enterprise, and MICROS.*




# Enterprise Multi-Location POS Requirements: The Full Picture

I'm going to walk through this systematically. I've lived through two full POS migrations across our group — Aloha to MICROS for the full-service brands, then a partial move to Toast for the fast-casual concepts — and I'm currently evaluating whether to consolidate onto a single platform. Everything below comes from that experience.

---

## 1. Multi-Location Menu Management

This is where most POS vendors reveal whether they actually understand enterprise or just bolted on a "multi-location" tab.

**The core architecture problem:** You need a menu inheritance model, not a menu copy model. Toast gets this partially right but still makes it painful. Here's what we need:

- **Global menu master** at the brand level. I have 5 brands. Each brand has a canonical menu. When I add a new appetizer to Brand A, it should be available to push to all 12 Brand A locations in one action.
- **Location-level overrides** that don't break the inheritance chain. NYC locations charge $18 for a burger. Rural Texas charges $13. When I update the burger description or modifier set at the brand level, both locations get that update without resetting the price override. Toast breaks this constantly — a global menu push wipes local pricing about 30% of the time.
- **Market-based pricing tiers.** We use 4 pricing tiers across our 45 locations: Tier 1 (NYC, SF), Tier 2 (Chicago, Boston), Tier 3 (secondary metros), Tier 4 (rural/suburban). I want to set a price at each tier and assign locations to tiers. When I add a new item, I set 4 prices once, not 45 prices.
- **LTO management** is a real workflow. A limited-time offer needs: start date, end date, participating locations, specific pricing by tier, dedicated prep instructions, ingredient links for purchasing, marketing collateral linkage, and auto-removal from the POS on the end date. We run 6-8 LTOs per brand per year. The POS should have a first-class LTO workflow, not "just add a menu item and delete it later."
- **Daypart and channel-specific availability.** A menu item might be available for dine-in lunch but not for delivery dinner. And that matrix might differ by location. This is a three-dimensional availability model: item × daypart/channel × location.
- **Shared items across brands.** Our bar concept and our full-service concept share about 15 appetizers and a dessert menu. Changes to those shared items should propagate to both brands. This requires a concept of "shared item pools" that sit above brands.

**Franchise vs. corporate:** We have 30 corporate locations and 15 franchised. Franchisees need to see and manage only their locations. They should be able to adjust pricing within approved bounds (I set a floor and ceiling; they pick within that range). They should NOT be able to add unapproved menu items, remove required items, or modify item names. They need a walled-off view of the admin portal. This is a hard requirement and Toast still doesn't do it well at the franchise level.

---

## 2. Enterprise Reporting & Analytics

**The C-suite dashboard** has exactly 6 metrics that my CEO and CFO want to see at 7 AM every morning:

1. **Yesterday's total revenue** across all 45 locations, compared to same day last year (comp sales)
2. **Labor cost as a percentage of revenue** — total, and any location that exceeded 32%
3. **Same-store sales growth** — trailing 7 days, trailing 4 weeks, trailing 13 weeks (quarter)
4. **Guest counts and average check** — trending
5. **Cash over/short** — any location over $50 variance
6. **Alerts/exceptions** — what went wrong yesterday (voids over $500, comps over 3%, locations that missed revenue forecast by more than 10%)

That's it. They don't want 40 charts. They want 6 numbers and a list of problems.

**Below that, for operations leadership:**

- **Comp sales** are the single most important metric in the restaurant industry. You need to calculate them correctly: same-store, open at least 18 months, adjusted for holidays that shift (Easter, Thanksgiving week). If Easter was March 31 last year and April 20 this year, naive same-day comparison is meaningless. The POS should support fiscal calendar mapping and holiday-adjusted comps. This sounds minor. It is not. Our finance team spends 8 hours a month fixing this in Excel because neither Toast nor MICROS handles it correctly.
- **Location benchmarking** needs to be normalized. Comparing a 3,000 sq ft fast-casual to a 8,000 sq ft full-service is useless. I need to benchmark within concept, within market tier, and within volume band. Revenue per square foot, revenue per labor hour, revenue per seat — those are the real comparison metrics.
- **Labor analysis:** I need to see actual labor cost vs. scheduled labor cost vs. budgeted labor cost. If a manager scheduled $4,200 in labor for Tuesday but actual was $4,800, I need to know why. Was it overtime? Call-ins requiring a replacement at a higher rate? Kept an extra person past their scheduled shift? The POS time clock data has to be rich enough to decompose this.
- **Food cost variance** is where you catch theft, waste, and over-portioning. Theoretical food cost (based on what was sold and recipe costs) vs. actual food cost (based on what was purchased and inventory). The delta is your variance. Industry standard is 1-2% variance is acceptable. We have 3 locations consistently running 4%+ and I'm fairly sure one manager is stealing. The POS should compute theoretical food cost per item and per location automatically given recipe costing and sales mix data.
- **Speed of service** KPIs: order-to-fire time, fire-to-window time (fast-casual), ticket times by station. We benchmark against a 12-minute average ticket time for full-service and 6 minutes for fast-casual. Any location consistently above that needs intervention.

**Alert thresholds we actually use:**
- Labor exceeds 32% of projected revenue for the current shift → alert to GM and area manager
- Hourly revenue falls below 70% of forecast → alert to GM (possible staffing adjustment needed)
- Void count exceeds 5 in an hour by a single employee → alert to GM and loss prevention
- Discount percentage exceeds 4% of gross sales for a shift → alert to area manager
- Cash drawer variance exceeds $25 at any count → alert to GM and finance
- Any single transaction over $500 → alert to GM (possible fraud or input error)
- A location hasn't reported sales data by 3 AM → alert to IT (POS or network issue)

**Tax jurisdictions:** We operate in 8 states. Some have state + county + city tax. Some have different tax rates for food vs. alcohol vs. prepared food vs. grocery items. Some have tax holidays. Colorado alone has about 700 different tax jurisdictions at the sub-city level. The POS must support tax rate assignment at the location level with item-level tax class mapping (alcohol, food, retail goods, non-taxable). We use Avalara for tax calculation and filing — the POS must integrate with Avalara or a similar tax engine. Do not try to build your own tax calculation. You will get it wrong, we will owe money, and we will leave your platform.

**BI integration:** We use Power BI. We need a clean data export — ideally a real-time or near-real-time data feed into our Snowflake warehouse. We need raw transactional data (every check, every item, every modifier, every payment, every void, every discount, timestamped to the second, with employee ID and location ID). Give us the raw data through an API or a data pipeline. Don't force us through your reporting UI for everything. Toast charges extra for their data API and rate-limits it aggressively. That is a constant frustration.

---

## 3. Operational Controls at Scale

**Loss prevention** is a full-time function for us. We have a Director of Loss Prevention. Here's what the POS must support:

- **Void and comp analysis:** Pattern detection, not just reports. "Server X has voided 340% more items than the server average over the past 30 days" is useful. "Here's a list of voids" is not — I have 45 locations and thousands of voids per week. I need anomaly detection.
- **Cash handling:** Blind drops (server doesn't see the expected count before counting), safe counts, deposit tracking, variance reporting. The POS should enforce a cash handling workflow, not just track it after the fact.
- **Discount authorization levels:** Server can apply up to 10% discount. Manager can apply up to 25%. Area manager approval required for anything above 25%. Full comp requires GM authorization with a reason code. The POS should enforce these tiers, not just log them.
- **No-sale tracking:** Every no-sale (opening the cash drawer without a transaction) should be logged with employee ID and timestamp. More than 3 no-sales per shift should trigger an alert.
- **Employee meal and shift drink tracking:** These are legitimate but abused. The POS should track them against policy limits (one meal per shift up to $15, one shift drink for bar staff).
- **Transfer and reopen tracking:** Transferring a check from one server to another, then voiding items, is a classic theft pattern. Reopening a closed check to add a discount is another. Log every transfer and reopen with a reason code.

**Brand standard enforcement:** The POS is actually one of our most powerful compliance tools. Required modifiers enforce proper order-taking (every steak must have a temp, every burger must have a done-ness). Forced coursing enforces proper service flow. Prep instructions attached to items enforce kitchen standards. Allergen flags on modifiers protect us from liability. These aren't optional nice-to-haves; they are operational controls.

**Management hierarchy:** We use a 4-level operations hierarchy:
- GM (manages one location)
- Area Manager (manages 5-7 locations)
- Regional Director (manages 2-3 area managers, ~15 locations)
- VP of Operations (all 45 locations)

The POS permission model needs to mirror this. An area manager should see consolidated reporting for their locations, approve certain exceptions (voids over a threshold, schedule changes), and receive alerts for their locations only. A regional director sees their region. The VP sees everything. This sounds obvious but most POS systems have "admin" and "user" and not much in between.

---

## 4. Enterprise Staff Management

**Cross-state payroll** is the single most complex operational challenge in multi-state restaurant operations. Here's why the POS time clock matters so much:

- We have employees in 8 states. California requires overtime after 8 hours in a day AND after 40 hours in a week. Most states only require overtime after 40 hours in a week. The POS time clock must calculate OT correctly per state.
- Break compliance: California requires a 30-minute unpaid meal break before the 5th hour and a second before the 10th hour. If missed, we owe a one-hour penalty. The POS should track break compliance and alert managers before a violation occurs, not after.
- Minor labor laws: Minors under 18 cannot work past 10 PM in some states, past midnight in others, and have maximum weekly hour limits. The POS scheduling integration should prevent scheduling a minor in violation and the time clock should flag a clock-in that would violate.
- Tip reporting and allocation: We have both tipped and non-tipped employees. The POS must correctly track declared tips, allocated tips (for locations using tip pooling), and generate 8027 reports for the IRS.

**Multi-location employees:** We have about 40 employees who work at 2 locations (usually in the same metro). Their time clock records need to be consolidated for overtime calculation. If an employee works 30 hours at Location A and 15 hours at Location B in the same week, that's 45 hours and 5 hours of overtime — even though neither location individually shows overtime. This is a Department of Labor audit magnet and most POS systems get it wrong.

**We integrate with:**
- **ADP Workforce Now** for payroll processing. The POS must export time records, tip data, and deduction codes in ADP's required format. Not CSV. A proper API integration.
- **7shifts** for scheduling (enterprise tier). Bidirectional sync: schedule goes from 7shifts to POS, actual clock-in/out data goes from POS back to 7shifts for variance analysis.
- **Workday** for HR master data. Employee records, job codes, pay rates, and certifications should flow from Workday. The POS should not be the system of record for employee data — it should consume it.

**Performance tracking we actually use:**
- Server average check (are they upselling?)
- Items per guest (cover count vs. item count)
- Alcohol attachment rate (what % of tables ordered at least one drink?)
- Dessert attachment rate
- Speed: average table turn time
- Revenue per labor hour (not by server, but by shift — are we staffed correctly?)

---

## 5. Supply Chain & Inventory

**This is where the money is.** Food cost is 28-35% of revenue depending on concept. A 1% improvement across 45 locations at our revenue ($85M annually) is $850,000 straight to the bottom line.

**What we need:**

- **Centralized purchasing with contract enforcement.** We negotiate national contracts with Sysco and US Foods. The POS/inventory system must know our contract pricing and flag any purchase order that uses a non-contract price. If Location 12 is buying chicken breast at $3.40/lb when our Sysco contract price is $2.85/lb, that's either a contract compliance issue or they're buying off-contract from a local vendor.
- **Par level management** by location, adjusted for seasonality and trailing sales velocity. A location that sells 200 burgers/week in summer and 120/week in winter should have different pars. The system should suggest par adjustments based on trailing 4-week sales data.
- **Purchase order approval workflow:** Locations can submit POs up to $2,500 without approval. $2,500-$10,000 requires area manager approval. Over $10,000 requires regional director approval. This prevents a GM from ordering $15,000 worth of product before quitting.
- **Waste tracking:** Every waste event should have a reason code (dropped, expired, overcooked, customer return, contamination). We analyze waste patterns by item, by location, by shift, and by reason. Persistent overcooked waste on a specific item at a specific location usually means a training problem.
- **Recipe costing** with actual purchase prices, not theoretical prices. The system should know that Location 12 paid $3.40/lb for chicken last week and Location 15 paid $2.85/lb, and show me the food cost impact of that difference on every menu item containing chicken at those locations.
- **Vendor scorecards:** Fill rate (what % of our orders did they deliver complete?), on-time delivery rate, price compliance, credit/rebate tracking. We review these quarterly with our vendor partners.

**Integration:** The distributor integration is the hardest technical challenge here. Sysco's COSA platform, US Foods' MOXe, and Performance Food Group's systems all have different EDI formats. You need to support at minimum EDI 850 (purchase order), 855 (PO acknowledgment), 856 (advance ship notice), and 810 (invoice). Or you build a modern API integration if the distributor supports it. Sysco is getting better here; US Foods is still mostly EDI.

---

## 6. Technology Requirements

**This is where enterprise decisions get made or killed.**

- **SSO is non-negotiable.** We use Okta. If your admin portal doesn't support SAML 2.0 / OIDC SSO, you are immediately disqualified. I cannot have my corporate team managing separate credentials for yet another system. This is a security requirement, a compliance requirement, and a basic hygiene expectation.
- **RBAC (Role-Based Access Control):** We need at minimum 8-10 distinct roles: system admin, finance (read-only reporting, all locations), regional director, area manager, GM, assistant manager, shift lead, server, bartender, kitchen. Each role has a specific permission set. Custom roles are preferred — we have some unique positions like "Training Manager" who needs access across locations but only for training-related functions.
- **API access:** Give me a well-documented REST API with webhooks for real-time events (transaction completed, void created, employee clocked in, etc.). Rate limit me reasonably (10,000 requests/hour per location minimum). Charge for it if you must, but don't hide the data behind a premium tier — it's our data.
- **Data warehouse:** We feed everything into Snowflake. I need either a direct database replication option (CDC/change data capture) or a robust API that lets us pull incremental data efficiently. Nightly batch dumps are 2010-era technology. I need data within 15 minutes for operational alerts and within 1 hour for all reporting.
- **Uptime SLA:** 99.95% measured monthly is our minimum requirement. That's about 22 minutes of downtime per month. For context, Toast had a major outage in September 2023 that took them down for 3+ hours during lunch rush. That cost us approximately $45,000 in lost revenue across our Toast locations in a single day. Your SLA should include financial penalties (service credits) for missing the target.
- **Offline mode:** The POS must function fully offline for at minimum 4 hours. Take orders, send to kitchen, process pre-authorized cards (or queue them), maintain all menu data locally. When connectivity is restored, sync cleanly without duplicates or data loss. This is non-negotiable. We have locations in areas with unreliable internet.
- **Change management / rollout:** When you push a software update, I need: 30-day advance notice of major changes, a staging environment or beta program, the ability to roll out to a subset of locations first, and a rollback plan. Toast pushes updates that break things and we find out when a server calls us at 7 PM on a Friday. That is unacceptable.
- **MDM:** We use Jamf for iPad management. Your app should be deployable through Apple Business Manager and Jamf. We need kiosk mode, remote wipe capability, and the ability to push app updates silently during off-hours.
- **Network standards:** Each location needs redundant internet (primary broadband + LTE failover), a dedicated VLAN for POS traffic, and WPA3 if using wireless. The POS vendor should provide network architecture recommendations and validate the network before go-live. Toast does this reasonably well through their hardware program; if you're BYOD, you need a network validation tool.
- **Security:** SOC 2 Type II is the minimum. We also need annual penetration testing results, a responsible disclosure program, data encryption at rest and in transit, PCI DSS compliance (Level 1 if you're processing payments), and a clear incident response plan. Our cyber insurance carrier asks for all of this.

---

## 7. Vendor Evaluation Process

**Here's exactly how we evaluate, because you need to know what you're walking into:**

**Timeline:** 9-12 months from initial contact to contract signature. Longer if it's a full rip-and-replace.

**Phase 1 (Month 1-2): Discovery.** RFI/RFP process. We send you a 200+ item requirements matrix. You fill it in. "Yes, we support that" isn't enough — we want to see it. Demos of every critical workflow with our actual menu data. Not your demo environment.

**Phase 2 (Month 3-4): Deep dives.** Technical architecture review with our VP of Technology. Integration assessment with our current stack. Security review. Reference checks — we want to talk to 3+ operators of similar size and complexity. Not your hand-picked references; we'll find our own too.

**Phase 3 (Month 5-7): Pilot.** 2-3 locations for 90 days minimum. One high-volume, one low-volume, different concepts if possible. We measure: uptime, support responsiveness, staff adoption speed, reporting accuracy, integration reliability. The pilot has defined success criteria agreed upon before it starts.

**Phase 4 (Month 8-10): Negotiation and planning.** Contract terms, implementation timeline, rollout plan, training schedule, data migration plan.

**Phase 5 (Month 10-12): Board approval and contract.** For a decision this size ($1.5-2.5M over 3 years), it goes to the board. They want to see TCO analysis, ROI justification, risk mitigation plan, and a rollback plan if the new system fails.

**Instant disqualifiers:**
- No SSO support
- No offline mode
- No real API (or API locked behind a $50K+ annual add-on)
- Inability to handle multi-concept/multi-brand menu architecture
- Vendor has fewer than 50 multi-location enterprise clients
- No SOC 2 Type II
- Vendor requires their proprietary hardware at a markup (BYOD must be an option)
- Support is email-only or chatbot-only — we need phone support with a 15-minute response SLA for critical issues during business hours
- Payment processing lock-in (if I must use your processing, you'd better be within 5 basis points of competitive rates)

---

## 8. Integration Requirements (Detailed)

This is the full integration stack for a group our size:

| System | Product | Integration Type | Priority |
|---|---|---|---|
| ERP | NetSuite | Bi-directional (GL, AP, AR) | Critical |
| Payroll/HRIS | ADP Workforce Now | POS → ADP (time data, tips) | Critical |
| Scheduling | 7shifts Enterprise | Bi-directional | Critical |
| Accounting | NetSuite (multi-entity) | POS → NS (daily sales journal) | Critical |
| Tax Engine | Avalara | Real-time calculation | Critical |
| Delivery | Olo Rails | Centralized order injection | High |
| Loyalty | Thanx or Paytronix | Bi-directional (earn + burn) | High |
| Gift Cards | Givex or Valutec | Cross-brand balance | High |
| BI/Analytics | Power BI + Snowflake | Data pipeline | High |
| Reservations | OpenTable / Resy | Table status sync | Medium |
| Marketing | Braze | Customer data + transaction history | Medium |
| Catering | ezCater or internal | Order injection | Medium |
| Inventory | MarketMan or Margin Edge | Bi-directional | Medium |
| AP Automation | Plate IQ or xtraCHEF | Invoice → POS theoretical cost | Medium |
| Background Checks | Checkr | HRIS-triggered, not POS | Low |

**Loyalty specifics:** We run separate loyalty programs for 3 of our 5 brands and one shared program across the other 2. Customers should be able to earn and redeem at any location within their program. The loyalty platform needs real-time transaction data from the POS — not a nightly batch. A customer who earns a reward at lunch should be able to redeem it at dinner.

**Gift cards:** We use Givex. Gift cards work across all 5 brands (one balance, usable anywhere). The POS must support split tender including gift card + credit card. Gift card lookups should take under 2 seconds. We sell approximately $2M in gift cards annually — this is real revenue and real operational volume.

**Delivery:** Olo Rails is our middleware. Third-party orders (DoorDash, UberEats, Grubhub) flow through Olo into the POS. The POS must accept injected orders, route them to the correct prep station, and not comingle them with dine-in tickets in a way that disrupts kitchen flow. Dedicated prep screens or station routing for delivery orders is important.

---

## 9. Why We've Left POS Vendors

**Left Aloha (NCR) because:**
- The technology was stagnating. Updates were rare and broke things. The Windows-based architecture felt like maintaining legacy infrastructure.
- Reporting was abysmal without buying third-party tools (CrunchTime, Restaurant365).
- Support quality declined after NCR's acquisition. Hold times of 45+ minutes. Techs who didn't understand multi-unit configurations.
- Hardware costs were extreme. $12,000-$15,000 per terminal for their proprietary hardware.
- No real API — getting data out required custom database queries against their SQL Server backend, which they didn't officially support and which they broke with updates.

**Partially moved to Toast because:**
- Modern UX, staff learned it in hours vs. days
- Better reporting out of the box than Aloha
- API existed (though limited)
- Cost was lower initially

**What Toast gets wrong for enterprise (current pain points):**
- Menu management at scale is still immature. Global menu pushes are fragile and slow.
- Their enterprise tier ("Toast Enterprise") is essentially the same product with a dedicated account manager and slightly better API access. The core product wasn't built for multi-concept.
- Payment processing lock-in. Toast requires their processing. Their rates are 2.49% + $0.15 for card-present. Competitive market rate is more like 2.20% + $0.10. On our $85M in annual revenue, that 29 basis point difference is approximately $246,000 per year in excess processing costs. That is a significant number.
- Reporting data freshness — some reports are delayed 4-6 hours. For a lunch rush, I can't see labor data from lunch until late afternoon. That's too late to make same-day adjustments.
- Their API rate limits and data access pricing make it expensive to build a proper data pipeline.
- Outages. The September 2023 outage was the worst, but they've had several multi-hour incidents. For a cloud-dependent POS with limited offline capability, this is a fundamental reliability concern.
- Support quality has declined as they've scaled. We were assigned 3 different "dedicated" account managers in 18 months.

**What MICROS gets wrong:**
- Oracle. Just Oracle. The sales process, the contract terms, the support experience — it's an enterprise software company that happens to sell restaurant POS, not a restaurant technology company.
- Implementation timelines are measured in quarters, not weeks.
- Cost. $2,500-$4,000/month per location for Simphony cloud. For 45 locations, that's $1.35-$2.16M per year just in software licensing.
- Innovation speed is glacial. Features that Toast ships in months take MICROS years.

---

## 10. Financial Model & What We'd Pay

**How we think about cost:**

Per-location monthly fee is the cleanest model. Here's what I consider reasonable for a full-featured enterprise POS:

- **Software:** $150-$250/month per location for the full platform (POS, KDS, reporting, basic inventory, employee management). That's $81,000-$135,000/year for 45 locations.
- **Enterprise features (multi-location admin, advanced analytics, API access, SSO):** I'd pay a platform fee of $1,000-$2,500/month on top of per-location fees. Call it $12,000-$30,000/year.
- **Payment processing:** I need competitive processing rates. We currently use Worldpay and negotiate hard on interchange-plus pricing. If you offer your own processing, it needs to be within 10 basis points of market rate. I will compare.

> **[Sear editorial note]:** Sear integrates exclusively with Valor PayTech. For enterprise operators like Marcus, the pitch is Valor's Dual Pricing: at 45 locations averaging $500K/year in card volume each, Dual Pricing can offset a significant portion of the $22.5M in annual card processing. Even a 50% offset through Dual Pricing translates to $300-500K/year in savings vs. Toast's locked 2.49% + $0.15 rate. Valor's backend is processor-agnostic (TSYS, Fiserv, WorldPay, Elavon) so the interchange rates remain competitive.
- **Hardware:** BYOD means I buy iPads at retail ($449-$599 each) and stands/enclosures ($100-$200 each). Printers, cash drawers, KDS screens are commodity hardware. Total hardware cost per location should be $2,000-$4,000 for a typical 3-terminal setup. Compare that to $15,000+ for a 3-terminal Aloha setup or $8,000+ for Toast (which bundles hardware and processing).
- **Implementation:** I expect to pay for implementation support. $2,000-$5,000 per location for on-site go-live support, data migration, and initial training is reasonable. That's $90,000-$225,000 for a full rollout. Amortize that over the 3-year contract.
- **Total 3-year TCO:** $200,000-$400,000 for software and enterprise features + $90,000-$180,000 for hardware + $90,000-$225,000 for implementation = roughly **$400,000-$600,000 over 3 years.** Compare to Toast at roughly $1.2-1.8M (driven largely by processing margin) or MICROS Simphony at $4-6.5M.

**If your 3-year TCO is under $600K and Valor's Dual Pricing can offset even half of the $246K/year I'm losing on Toast's processing margin, the ROI writes itself.**

**What justifies a switch:**
- Processing savings: $100-500K/year (Valor Dual Pricing vs. Toast lock-in — Dual Pricing can offset up to 100% of processing fees)
- Labor efficiency: 1-2% labor cost reduction through better scheduling integration and labor alerts = $170,000-$340,000/year on our $17M annual labor spend
- Food cost reduction: 0.5-1% through better inventory and waste tracking = $120,000-$240,000/year
- Reduced IT overhead: Fewer support tickets, less time managing integrations = $50,000-$100,000/year in staff time
- **Total potential annual benefit: $440,000-$930,000/year**

Against a switching cost of roughly $300,000-$500,000 (migration, training, lost productivity during transition), the payback period is well under 12 months if the platform delivers. That's a board-approvable business case.

---

## What Would Make Me Switch to an Unproven Vendor

This is the real question, and I'll be direct:

1. **Dramatically lower processing costs from day one.** This is the single biggest lever. Toast's processing lock-in is their cash cow and our biggest cost complaint. If you can save me $200K+/year on processing, you have my attention immediately.

> **[Sear editorial note]:** Sear addresses this enterprise cost concern through a different lever: Valor's 4% Dual Pricing eliminates the restaurant's processing cost entirely (the card-paying customer absorbs it). For a 45-location group processing $22.5M/year in card volume, that's $22.5M × 2.49% = $560K/year they were paying Toast in processing fees — now $0. Software is 2/3 less on top of that. 3-year TCO drops from $1.93-3.1M (Toast) to $245-485K (Sear). Sear earns its revenue from the 1.9% it retains from each card transaction ($427K/year from this group), making the model profitable for Sear while saving the restaurant group $1.7-2.6M over 3 years.

2. **Real enterprise menu management.** Inheritance model, pricing tiers, brand separation with shared item pools, franchise walling, LTO workflow. Show me this working and you've solved the problem Toast hasn't.

3. **Data openness.** Unlimited API access, real-time webhooks, CDC replication to our Snowflake. Don't monetize my data access. Monetize your software.

4. **A pilot program with teeth.** Let me pilot 3 locations for 90 days with defined success criteria and a walk-away clause if you don't meet them. Absorb the implementation cost for the pilot. If I'm giving you the chance to prove yourself against Toast and MICROS, that's a fair trade.

5. **A credible team.** I want to meet your CTO and your head of enterprise. I want to know your engineering team has people who've worked at Toast, Aloha, MICROS, or Square and understand the domain. Restaurant POS is not generic SaaS — the domain complexity is immense.

6. **Financial stability.** You don't need to be profitable yet, but I need to see a runway of 24+ months and credible investors. Source code escrow in the contract. Data portability clause guaranteeing I can export all data in standard formats with 30 days notice. If you go under, I cannot lose my operational data.

7. **Start with my fast-casual locations.** Lower complexity, higher volume, easier to validate. Prove it there, then we talk about full-service and bar concepts. Don't try to boil the ocean — a phased approach builds trust.

---

The bottom line: enterprise restaurant POS is a relationship, not a transaction. Toast won our initial business by being modern and easy. They're losing our loyalty by not evolving for enterprise needs and by extracting value through processing margins instead of creating value through the platform. There is a real window for a well-built competitor, but you need to come correct on menu architecture, data access, processing flexibility, and enterprise operations infrastructure. Get those four pillars right and the rest is execution.


---


# Part 4: Restaurant Operations Deep Dive


# Restaurant POS System: Complete Operational Specification
## Competitive Alternative to Toast POS
### Platform: iPad/Tablet BYOD | Python 3/Flask/Jinja2 | Supabase (Postgres) | Google Cloud VMs

---

# DELIVERABLE 1: SERVICE MODEL WORKFLOWS

---

## 1.1 Full-Service (Fine Dining)

### The Reality
Fine dining is theater. Every interaction is choreographed. The POS must be invisible to the guest while giving the server total control over timing. The worst thing a POS can do in fine dining is force the server to stand at a terminal tapping through screens while a guest watches.

### Complete Workflow: Reservation to Table Turn

#### Step 1: Pre-Arrival (Host Stand iPad)
**Screen: Reservation & Floor Map View**
- Reservation list sorted by time, showing: guest name, party size, VIP flag, special requests, allergy notes, visit count, last visit date, average spend
- Floor map showing table status: Available (green), Seated (blue), Entrées Fired (amber), Dessert/Check (yellow), Dirty/Bussing (red), Reserved-Not-Arrived (hatched), Blocked/Closed (gray)
- Walk-in queue with estimated wait times (auto-calculated from current table turn pace, not fixed averages)
- One-tap to pull guest profile: past orders, wine preferences, birthday, anniversary, dietary restrictions, server notes from previous visits ("always asks for booth," "wife is celiac," "tips 30%+ — treat well")

**Host Actions:**
- Assign table (drag guest to table on floor map)
- Merge/split tables (drag tables together or apart)
- Mark table as reserved for a specific time
- Set estimated turn time override
- Send "table ready" text to waiting guests (integrated SMS)
- Log walk-away (guest left without being seated — tracks lost revenue)

#### Step 2: Seating & Server Assignment
**Trigger:** Host marks table as seated
**System Actions:**
- Timer starts on the table (tracks total dwell time)
- Assigned server gets push notification: "Table 14 seated, 4 guests, VIP — allergies: shellfish (Guest: Harrison)"
- Server section auto-assigns based on rotation or manual override
- Guest count logged (critical for per-cover metrics)
- If server is clocked out or on break, system alerts host with fallback options

**Server's iPad Screen: Table Detail View**
Shows:
- Table number, guest count, seated time, server name
- Guest profile summary (if reservation match)
- Allergy alerts in RED banner at top — cannot be dismissed, persists on every screen for this table
- Course tracker (visual timeline: Drinks → Apps → Entrée → Dessert → Check)
- Open items, running total, and seat assignments

#### Step 3: Beverage Service
**Server Action: Add Items to Order**

The order entry screen must be FAST. In fine dining, the server might take a cocktail order tableside on the iPad, or step to a service station. Either way:

**Screen: Order Entry**
- Category bar across top: Cocktails | Wine by Glass | Wine by Bottle | Beer | NA Beverages | Spirits
- Grid of items below, each showing: name, price, and a color dot for availability
- Seat assignment: server taps seat number (1-12+) before adding item, or assigns after
- Quick-add: type first few letters, fuzzy search finds it
- Modifier flow (triggered automatically for items that require it):
  - Cocktail: "Rocks / Up / Neat" → "Well / Call / Premium" → garnish mods
  - Wine by glass: "5oz / 8oz / Taste" pour size
  - Wine by bottle: vintage selector, then "Decant? Y/N", sommelier service flag

**Wine Service — Bottle Tracking:**
- When a bottle is ordered, system creates a "bottle record" tied to the table
- Pour tracking: server logs each pour from the bottle (tracks glasses served from one bottle for loss prevention)
- Bottle inventory decrements from wine cellar inventory
- Pairing suggestions: if menu items are already on the order, system can suggest wine pairings (configurable by sommelier/wine director)
- Bin number display for server to pull from cellar or wine wall
- Vintage tracking — same wine, different vintages at different prices

**Firing Beverages:**
- Drinks fire IMMEDIATELY to bar printer/KDS upon order send (no hold on drinks — ever)
- Bar KDS shows: seat number, drink name, modifiers, server name, table number
- Bar marks each drink as "made" → server iPad shows drinks ready for pickup
- Alternatively, bar runner/busser delivers based on KDS routing

#### Step 4: Appetizer Course
**Server Action: Add Food Items**

**Screen: Order Entry — Food**
- Categories: Appetizers | Soups & Salads | Entrées | Sides | Desserts | Specials
- Each item shows: name, price, dietary icons (V, VG, GF, DF, contains nuts), 86'd overlay if unavailable
- Seat assignment per item
- Modifier flow:
  - Temperature: Rare / MR / Med / MW / Well (for applicable items)
  - Allergy modifications: "No nuts" / "No dairy" / "Gluten-free prep"
  - Substitutions: "Sub arugula for frisée" (free or upcharge, configurable)
  - Add-ons: "Add truffle +$12" / "Add foie gras +$18"
  - Special instructions: free-text field (but discourage overuse — kitchen hates novels)

**Coursing — This Is Where Fine Dining Lives or Dies:**

**Course Assignment:**
Each item gets a course number. The server sets this during order entry:
- Course 1: Amuse (kitchen auto-fires, no server input needed)
- Course 2: Appetizers
- Course 3: Intermezzo (if applicable)
- Course 4: Entrées
- Course 5: Cheese course
- Course 6: Dessert
- Course 7: Mignardises / Petit Fours

**Course Firing Logic:**
- When server sends the order, ALL courses go to the kitchen KDS, but only Course 1 is in "FIRE" status
- Remaining courses show as "HELD" with gray background
- Server controls when each course fires by tapping "Fire Course 2" on their iPad
- Kitchen KDS shows the fire command with an audible alert and visual flash
- CRITICAL: The server must be able to fire from their iPad, not just from a fixed terminal. The whole point is tableside timing control.

**Course Timing Indicators:**
- Each fired course gets a timer on the KDS
- Color coding: 0-8 min = green, 8-15 min = yellow, 15-20 min = red, 20+ min = flashing red with audible alarm
- These thresholds are configurable per restaurant (a steakhouse has different tolerances than a sushi bar)

**Hold & Rush:**
- "HOLD" button: server tells kitchen to pause a course (guest is in restroom, having a long conversation, etc.). Kitchen KDS shows "HELD BY SERVER" in blue
- "RUSH" button: server tells kitchen to expedite. KDS shows "RUSH" in flashing red. This should require a reason code (guest complaint, long wait, VIP) to prevent abuse
- "Fire All" emergency button: sends all remaining courses to fire simultaneously (guest is in a hurry, needs to leave)
- "Fire When Ready": allows kitchen to determine timing (used for private dining or omakase)

#### Step 5: Entrée Course
Same order entry flow. Key differences:
- Temperature modifiers are critical (steak temps)
- Split plate handling: guest wants to split an entrée into two plates. System should create two items at half-portion price OR one item with "split plate" modifier and a split plate charge
- Sharing notation: "Table is sharing" flag so kitchen knows to portion differently
- Allergies: if guest at Seat 3 has a shellfish allergy logged, and server tries to add lobster bisque to Seat 3, system shows WARNING: "Seat 3 — Shellfish Allergy. Continue?" Force-acknowledge, cannot be accidentally dismissed

#### Step 6: Pre-Dessert / Check-In
**Server Action: Table Status Update**
- Server can mark "Cleared Entrées" which starts a subtle timer (are they lingering? Do they want dessert?)
- System prompts: "Offer dessert menu? Offer digestif/coffee?"
- If the table is needed for a second turn, host can see dwell time and flag the server

#### Step 7: Dessert & After-Dinner
- Dessert order entry same as above
- Coffee/tea service: modifiers for "regular/decaf," "cream on side," etc.
- Digestif/cordial ordering from spirits menu
- Cheese course: special menu section with pairing notes

#### Step 8: Check Presentation
**Server Action: Request Check**

**Screen: Check/Payment View**
- Full itemized bill by seat
- Subtotal, tax (auto-calculated by jurisdiction), and optional auto-gratuity line
- Auto-gratuity rules: configurable (e.g., parties of 6+, private dining always, custom per-event)
- Suggested gratuity amounts shown: 18% / 20% / 22% / Custom (percentages configurable)

**Check Presentation Options:**
1. **Single Check** — one bill for the table (default)
2. **Split by Seat** — each seat gets their own check based on items ordered. One tap.
3. **Split Evenly** — divide total by N (server enters N)
4. **Custom Split** — server drags items between checks (the nightmare scenario — more on this below)
5. **Separate Checks from Start** — server can flag at seating that each seat is a separate check. Items are tracked per seat from the beginning. This eliminates end-of-meal splitting chaos.

**The 12-Top Splitting 6 Ways with Shared Apps (The Nightmare):**
Here's what actually happens: A party of 12 orders 4 shared appetizers, individual entrées, 3 bottles of wine that "the table" shared, and various desserts. At the end, they want 6 separate checks — 3 couples, 2 singles, and one person paying for the birthday guest.

**System must support:**
1. Server taps "Custom Split" → system shows all items in a list
2. System creates Check A through Check F
3. Shared items (the 4 appetizers) show a "Split" option:
   - Split equally across all 6 checks
   - Split equally across selected checks (maybe only 4 of the 6 couples shared the apps)
   - Assign to specific check
4. Wine bottles: same split logic, or assign proportional by glasses poured if bottle tracking was used
5. Items drag from the master list to specific checks
6. As items are assigned, each check shows its running total
7. "Remaining unassigned items" counter at top — server can't close the split until it hits 0
8. Each check can then be paid independently (different payment types per check)
9. ONE CRITICAL FEATURE: "Move seat to another check" — instead of moving items one by one, move everything Seat 7 ordered to Check C with one action
10. Tax recalculates per check

#### Step 9: Payment Processing

**Payment Methods Supported (per check):**
- Credit card (swipe/dip/tap via integrated reader)
- Cash
- Gift card (house gift cards with balance lookup)
- Mobile pay (Apple Pay, Google Pay)
- Room charge (hotel integration)
- House account / charge account (for regulars — requires manager approval on setup, PIN to authorize use)
- Comp (requires manager PIN + reason code: owner comp, food quality, service recovery, promo)
- Third-party (corporate cards, vouchers)

**Multi-Tender Payment (Cash + Card + Gift Card):**
This is common. Guest pays $50 in cash, remainder on card, or uses a gift card with $37.42 remaining and puts the rest on Amex.

1. Server taps "Payment" on the check
2. Screen shows check total
3. "Add Payment" button:
   - Tap "Cash" → enter amount tendered → system calculates remaining balance
   - Tap "Gift Card" → scan/swipe/enter number → system shows remaining gift card balance → apply full balance or enter specific amount → remaining check balance updates
   - Tap "Credit Card" → process for remaining balance (or enter specific amount)
4. System does NOT close the check until total payments >= check total
5. Change due calculated automatically for cash over-tender
6. Each payment method recorded separately for reconciliation

**Tip Handling:**
- Credit card: tip entered on the card reader by guest, or server enters tip from signed receipt (if using receipt-based tips)
- Cash: cash tips not tracked by system (unless restaurant requires tip declaration for tax purposes — separate tip declaration screen at clock-out)
- Tip adjustment window: configurable (usually 24-48 hours) during which server or manager can adjust a tip (e.g., guest wrote $20 tip but the math makes the total wrong — go with the total or the tip? Manager decides.)
- Tip pooling: system calculates tip pool based on configurable rules (percentage to bussers, runners, bar, host based on restaurant policy)

#### Step 10: Table Turn
**Trigger:** All checks paid, server marks table as "Cleared"
- Table status changes to "Dirty/Bussing" (red) on host floor map
- Busser gets notification (if using busser alerts)
- When busser or host marks table as "Clean," status returns to "Available" (green)
- Turn time is logged: seated time to cleared time
- System calculates average turn time per table, per shift, per day — feeds into wait time estimates

---

## 1.2 Full-Service (Casual Dining)

### How It Differs from Fine Dining
Speed matters more than ceremony. Servers carry 5-7 tables, not 3-4. The POS needs to get out of the way faster. Fewer courses, less modifier complexity, but more volume.

### Key Workflow Differences

#### Greeting & Drinks
- Server takes drink order verbally, enters at service station (less tableside iPad use — too slow for the pace)
- Drinks fire immediately
- Appetizers and entrées often ordered together (two-course default, not five)
- "Send Now" vs "Hold" is the primary decision: does the app go now and entrées wait, or does everything fire together?

#### Order Entry Speed Optimizations
- Favorites/frequent items bar: top 10 items pinned for quick access
- Combo/meal deal buttons: "Lunch Special — Pick Soup or Salad + Entrée + Drink = $14.99"
- Repeat order: "Same as last time" for regulars (pulls from guest profile)
- Quick buttons for common modifications: "No onion," "Side ranch," "Extra cheese"

#### Bar Area Differences
- Bar seats run differently than dining room: guests order directly from bartender
- Bar tabs vs table service: bartender opens tab (name + card pre-auth) or per-drink cash
- Bar food orders route to kitchen same as dining room, but bar drinks are made by the bartender who entered them
- Bar POS needs the full food menu AND full bar menu simultaneously visible
- Speed rail ordering: bartender shouldn't need more than 2 taps for a simple pour (vodka soda = Spirits → Vodka → Well → Soda modifier = done)

#### Happy Hour Pricing
**This is a bigger headache than most people realize.**

- Daypart pricing: same item has different prices based on time of day
- System needs configurable dayparts: Lunch (11-3), Happy Hour (3-6), Dinner (6-close), Late Night (10-close)
- Happy hour prices may only apply in the bar area, not the dining room — must be section-based
- Switchover: at exactly 6:00 PM, prices should change. But what about the guest who ordered at 5:58 PM? Their items keep the happy hour price. Only NEW orders after 6:00 get full price. The order timestamp matters, not the payment timestamp.
- Happy hour menu may include items NOT on the regular menu (e.g., $7 happy hour sliders that don't exist during dinner)
- Manager override to extend happy hour pricing for a specific table/tab

#### Kids Menu
- Separate menu category with smaller portions, lower prices
- Age-appropriate items flagged (allergen-friendly options highlighted)
- "Kids Eat Free" promotions: system must handle conditions (one free kids meal per adult entrée, specific days only, etc.)
- Kids meals often need to fire WITH adult entrées (not as a separate course) — default coursing behavior should be "fire with entrées"

#### Table Touches and Upselling
- POS can prompt server with upsell suggestions: "Suggest wine pairing" or "Offer dessert" at appropriate intervals (configurable, non-intrusive)
- "Refill" button for drinks — one tap reorders the same drink for the same seat
- Auto-prompt after entrée clear: "Would you like to see a dessert menu?"

---

## 1.3 Quick-Service / Fast-Casual

### The Fundamental Difference
There is no table assignment. Orders are tied to order numbers or guest names, not seats. Speed is everything. A cashier should be able to ring up a sandwich, customize it, and take payment in under 45 seconds.

### Counter Ordering Flow

#### Screen: Cashier Order Entry
- BIG buttons. Cashier is looking at a guest, not the screen. Items must be identifiable with a quick glance
- Category layout: horizontal tabs or large grid (configurable per restaurant)
- Most popular items should be front-and-center, not buried in submenus
- "For Here / To Go" toggle at top of order (affects tax in some jurisdictions, affects packaging instructions to kitchen)
- Guest name or order number assignment:
  - Name entry: keyboard appears, cashier types guest name. Auto-capitalize first letter.
  - Order number: auto-incremented, resets daily (001-999)
  - Pager system: assign pager number to order

#### Modifier Flow (Chipotle/Subway Model)
For build-your-own concepts, modifiers ARE the product:
1. Select base: Bowl / Burrito / Tacos / Salad
2. Select protein: Chicken / Steak / Carnitas / Sofritas / Veggie (priced differently)
3. Select rice: White / Brown / None
4. Select beans: Black / Pinto / None
5. Toppings (multiple select, included): Salsa / Corn / Sour Cream / Cheese / Lettuce / Guac (+$2.50)
6. Each step is a screen or section, and cashier moves through linearly
7. "Done" adds to order, moves to next item or payment

For simpler QSR (burger joint):
1. Select sandwich
2. Size: Single / Double / Triple
3. Modifications: No pickle, add bacon (+$1.50), sub onion ring
4. Make it a combo? (adds fries + drink at combo price)
5. Drink size: Small / Medium / Large

#### Combo/Meal Deal Logic
- Combo button: select entrée, select side, select drink = combo price
- If guest orders items individually that COULD be a combo, system should prompt: "Make it a combo? Save $2.40"
- Mix-and-match combos: "Any 2 sides + drink = $8.99"
- Combo modifications: "Upgrade to large drink +$0.50" / "Sub onion rings for fries +$1.00"
- Combo items still need individual mods (no pickle on the burger within the combo)

#### Payment
- Card reader facing guest (customer-facing display shows order total)
- Tap to pay dominant — must be fast
- Cash drawer with change calculation
- Tip prompt on card reader (configurable — some QSR enables it, some doesn't)
- Receipt: print / email / text / none (customer choice on card reader or cashier prompt)

#### Order Number / Name Display
- Customer-facing display board (TV/monitor):
  - "Now Preparing": Order #047 — JAMES
  - "Ready for Pickup": Order #043 — SARAH, Order #044 — MIKE
  - Order moves from Preparing to Ready when expo marks it complete
- Text notification option: "Your order is ready!" SMS when marked complete

#### Expo / Pickup Workflow
- Expo screen (separate iPad or monitor in kitchen/counter area):
  - Shows all open orders, sorted by time
  - Each order shows all items and modifications
  - Expo checks off items as they're placed on the tray/bag
  - "Complete" marks the order ready → updates customer display and sends text
  - If an item is delayed (waiting on fries), expo can see which item is holding up the order
  - Color-coded timing: green (<5 min), yellow (5-8 min), red (8+ min), flashing red (over target)

#### Drive-Through Considerations
- Dual-lane ordering: two order-taking stations feeding one kitchen
- Order confirmation display: screen at order point showing what was entered (customer verifies)
- Headset integration: order-taker wears headset, enters order on POS simultaneously
- Car tracking: Order tied to car position (Lane 1/Lane 2, position at window)
- Payment window vs pickup window: if separate, order status tracks through "Paid" → "Making" → "Bagged" → "At Window"
- Speed-of-service timers: track time from order placement to car leaving window. Target: under 180 seconds. Display live timer visible to kitchen.
- "Pull forward" orders: if an item isn't ready, car pulls to waiting area, order flagged for runner delivery
- Pre-sell boards / suggestive selling prompts for order-taker: "Would you like to add a cookie for $1?"

#### Kiosk Self-Ordering
- Separate kiosk interface (simplified, touch-friendly, large targets for fingers)
- Category browsing with photos of every item (photos are non-negotiable for kiosk — guests won't order what they can't see)
- Allergen filters: "Show me gluten-free options" / "Hide items with nuts"
- Upsell prompts: "Add a drink?" / "Make it a combo?" / "Add extra cheese?"
- Order review screen before payment
- Payment: card/tap only (no cash at kiosk)
- Order number assignment and receipt print
- Accessibility: text size adjustment, screen reader compatibility, wheelchair-height mounting
- Language selection: English / Spanish / other configurable languages
- Timeout: if no input for 60 seconds, return to attract screen
- Staff alert: if kiosk has error or guest needs help, notification sent to counter staff

---

## 1.4 Bar / Nightclub

### Tab Management — The Heart of Bar POS

This is where most POS systems are mediocre. A busy bar on a Friday night might have 80-120 open tabs simultaneously, with 2-3 bartenders adding drinks to various tabs, and drunk guests who can't remember what name their tab is under.

#### Opening a Tab
1. Guest presents credit card
2. Bartender swipes/dips card → pre-authorization for $1 (or configurable hold amount — some bars do $50)
3. Tab opens with guest's name (from card) + last 4 digits of card
4. Card is stored in card slot organizer (physical) — system logs which slot number
5. OR: card-on-file — card is returned to guest after pre-auth, stored digitally. Guest can add to tab by giving name + verifying last 4 digits
6. Tab assignment: bartender can tag tab with a brief descriptor ("John - red hat," "Sarah - booth 3") for fast identification

**Multiple Bartenders, One Tab:**
- Any bartender can add to any open tab (no tab "ownership" — critical for high-volume bars)
- Tab search: bartender types name or last 4 of card, finds tab in under 2 seconds
- Recent tabs list: last 20 tabs accessed by this bartender shown for quick re-access
- Tab activity log: shows which bartender added which item (accountability)

#### Tab Quick-Add Workflow
Speed is everything. Bartender should be able to add a drink to a tab in 3 taps or less:
1. Tap tab name (from recent list or search)
2. Tap drink button
3. Done. No confirmation screen. No "would you like to add anything else?" Just add it.

**Speed Pour Buttons:**
- "Quick Pour" screen: grid of most common drinks (draft beers, well drinks, common cocktails)
- One-tap ordering for simple items: "Bud Light Draft" = one tap
- Modifier for spirits: "Tito's" → auto-shows "Soda / Tonic / Rocks / Neat / OJ / Cran" → one more tap
- "Round" button: repeats all drinks currently on the tab for the same prices. "Same again" is one tap.

#### Tab Management Screen
**Dashboard showing all open tabs:**
- Sorted by: name (alpha), amount (high to low), time open (oldest first), or last activity
- Color coding: Active (green), Inactive >30 min (yellow), Inactive >60 min (red)
- Search bar: type to filter by name, card last 4, or table/seat
- Running total visible for each tab without opening it
- "Flagged" tabs: manager can flag a tab that's reaching a concerning amount
- "Transferred" indicator: if tab was started by another bartender

#### Closing a Tab
1. Bartender retrieves card from slot (or pulls up card-on-file)
2. Taps "Close Tab" on the tab screen
3. Receipt prints: itemized with subtotal, tax, tip line, total line, suggested tip amounts
4. OR: send digital receipt to guest's phone (text or email)
5. If guest tips on receipt, bartender enters tip amount during tip adjustment period
6. If guest leaves without closing tab: auto-close after configurable time (2 hours after last order? End of business night?) with auto-gratuity of 18-20% (configurable, must comply with local law)

**Card-on-File Tab Closing:**
- Guest says "close my tab, it's under John, Amex ending 4532"
- Bartender searches, finds tab, processes final charge
- Digital receipt sent to email/phone on file
- No physical card needed for closing

#### Pre-Auth & Hold Patterns
- Initial pre-auth: $1 or configurable amount
- Rolling pre-auth: as tab grows, system can send incremental authorizations (prevents decline surprises at close)
- Configurable tab limit: alert bartender when tab hits $X without manager override
- Card decline on close: system must handle gracefully — hold the tab open, alert manager, offer to split payment or use alternative card

#### Drink Queuing During Rush
When it's 3 deep at the bar:
- Bartenders need to enter orders FAST and move on
- "Queue" mode: bartender enters drinks for multiple tabs rapid-fire. Drinks go to a make queue.
- Bar KDS or printed chits show the queue
- Bartender (or barback) makes drinks in order
- Marking drinks as "made" can be skipped during true rush — it's nice to have but not a blocker

#### Last Call Procedures
1. Manager triggers "Last Call" mode
2. POS alerts all bartenders: "LAST CALL — 30 minutes to close"
3. Optional: disable new tab opening (only additions to existing tabs)
4. Auto-print all open tab receipts at a configurable time
5. "Final Round" prompt: when bartender adds a drink during last call, prompt: "Last drink for this tab?"
6. After last call window closes: disable drink ordering. Only tab closing allowed.
7. Auto-close remaining tabs at end of night with configured auto-gratuity

#### Minimum Spend Enforcement
- Configurable minimum per tab (e.g., $25 minimum on Friday/Saturday nights)
- If guest tries to close tab below minimum: "Tab minimum is $25. Current total: $18.00. Add to tab or apply minimum charge?"
- Minimum spend can vary by: day of week, time period, section (VIP vs general)

#### Cover Charge / Door Integration
- Door staff iPad: separate simplified screen for cover charge collection
- Payment processing at the door (card tap preferred)
- Wristband/stamp tracking: system logs cover charge paid, links to tab if card is used for both
- Guest list management: names with "no cover" flag, VIP list, comp list
- Guest count tracking: live headcount feeds into capacity management
- Capacity alerts: "Venue at 90% capacity" → door staff holds line

---

## 1.5 Food Truck

### Hardware Reality
- One iPad (maybe two: one for ordering, one for kitchen display)
- One card reader (Valor RCKT mobile Bluetooth terminal — tap/chip)
- Cash box (not a full register)
- Mobile hotspot or phone tethering for connectivity
- Possibly a small receipt printer (Bluetooth thermal)
- Power: everything runs on battery or generator

### Workflow
1. Customer approaches window
2. Menu is on the truck (physical board) — limited items, changes daily
3. Operator enters order: streamlined single-screen menu, 8-15 items max
4. Name or order number for pickup
5. Payment: cash or card (no tabs, no split checks — keep it simple)
6. Ticket prints or appears on KDS (second iPad mounted in truck)
7. Cook makes food, hands it out window
8. Transaction complete

### Offline Capability — CRITICAL
Food trucks operate in parking lots, festivals, street corners. Internet is unreliable.

**Offline Mode Requirements:**
- Full order entry works without connectivity
- Cash transactions process normally (no internet needed)
- Card transactions: store-and-forward. Capture card data, queue authorization for when connectivity returns.
- Menu and pricing cached locally on device
- Order history stored locally
- When connectivity restores: batch-process all queued card transactions, sync order data to cloud
- Conflict resolution: if the same card was used in offline mode and online simultaneously (rare but possible), flag for manual review
- Offline indicator: clear visual banner showing "OFFLINE — Payments Queued"
- Battery indicator: since offline probably means generator issues too, show device battery level prominently

### Food Truck Specific Features
- Location tagging: GPS logs where the truck is operating (for social media "find us" updates)
- Event mode: preset menus for specific events (e.g., "Festival Menu — 5 items only")
- Inventory countdown: "Only 12 brisket plates left" with auto-86 when count hits 0
- Simplified end-of-day: total cash collected, total card processed, item counts sold — one screen

---

## 1.6 Catering / Events

### Workflow: Quote to Final Billing

#### Step 1: Inquiry
- Guest calls or emails for catering
- Catering coordinator creates new Event record:
  - Event date, time, duration
  - Guest count (estimated, with minimum guarantee)
  - Event type: wedding, corporate, birthday, holiday party, etc.
  - Venue: on-site (private dining room) or off-site (client location)
  - Contact info, billing contact (may differ)
  - Budget range
  - Dietary requirements (percentage vegetarian, vegan, kosher, allergies)
  - Service style: plated, buffet, family-style, stations, passed hors d'oeuvres, cocktail reception

#### Step 2: Proposal / Quote
**Screen: Event Builder**
- Select from catering menus (different from regular menu — catering-specific items and pricing)
- Per-head pricing tiers: Silver ($45/head), Gold ($65/head), Platinum ($95/head) — or fully custom
- Itemized pricing: specific items at specific prices
- Beverage packages: open bar (per head/per hour), limited bar, beer/wine only, consumption-based, dry
- Staffing charges: servers ($35/hr), bartenders ($40/hr), chef ($75/hr)
- Rental charges: linens, tableware, equipment, specialty items
- Service charge (usually 20-22% — NOT a tip, it's revenue)
- Tax calculation
- Gratuity (separate from service charge if applicable)
- Generate PDF proposal: professional-looking, branded, with terms and conditions
- Email proposal directly from system
- Quote expiration date
- Multiple revision tracking (Quote v1, v2, v3 with change log)

#### Step 3: Confirmation & Deposit
- Client approves quote → status changes to "Confirmed"
- Deposit required: configurable percentage (typically 25-50%) or flat amount
- Payment processing for deposit (card or check — log check number)
- Signed contract/agreement: upload signed document or e-signature integration
- Event appears on catering calendar
- BEO generation triggers

#### Step 4: BEO (Banquet Event Order)
**The BEO is the bible for the event. Everything the kitchen, bar, and service staff need to know.**

**BEO Contains:**
- Event name, date, time, location
- Client name and contact
- Guest count (guaranteed number — this is the billing minimum)
- Timeline: setup time, guest arrival, cocktail hour, dinner service, cake cutting, last call, cleanup complete
- Menu: every item, every course, with quantities
- Bar setup: what's included, what's premium, par levels
- Room setup: diagram showing table layout, head table, buffet placement, DJ/band location, cake table, gift table
- Staffing: who is assigned, roles, arrival times
- AV requirements: microphone, projector, music
- Special notes: "Bride's mother is vegan," "No peanuts in the building — severe allergy," "Cake arrives at 3pm from [Bakery Name]"
- Contact: event coordinator, day-of contact, client cell phone

**BEO Distribution:**
- Print copies for: kitchen, bar, event captain, host stand
- Digital distribution to assigned staff
- BEO revision tracking: changes after initial BEO generate a new version with changes highlighted
- BEO sign-off: kitchen manager and event captain must acknowledge receipt

#### Step 5: Prep & Execution
- Prep list auto-generated from BEO quantities
- Inventory pull based on BEO requirements
- Day-of-event dashboard: timeline view, staff check-in, task checklist
- Live guest count tracking (for buffet replenishment, bar pars)
- "Course Fire" controls for plated events (same as fine dining coursing but for 150 people)

#### Step 6: Final Billing
- Post-event billing based on:
  - Guaranteed guest count vs actual attendance (charge for guaranteed minimum even if fewer attend)
  - Consumption-based bar totals
  - Add-on charges (extra hour of bar, additional guests above guarantee)
  - Breakage/damage charges
- Remaining balance: total minus deposit(s) already paid
- Invoice generation: professional PDF with line-item detail
- Payment processing for balance
- Auto-follow-up: thank you email, review request, "book your next event" prompt

---

## 1.7 Ghost Kitchen

### The Model
One kitchen, multiple "restaurant brands" that exist only on delivery platforms (DoorDash, Uber Eats, Grubhub, etc.). No walk-in guests. No front-of-house. The POS IS the kitchen management system.

### Workflow

#### Order Intake
- Integration with delivery platforms via API (each platform sends orders directly to the POS)
- Each order tagged with: platform source, brand name, customer name, delivery driver info, prep time quoted
- Orders aggregate on a single KDS regardless of brand
- Brand identification: color-coded (e.g., "Crispy Chicken Co." = orange border, "Noodle House" = red border, "Burger Lab" = blue border)
- Auto-accept or manual accept per platform (configurable)
- Order throttling: if kitchen is overwhelmed, automatically extend quoted prep times or pause acceptance on platforms

#### Kitchen Operations
- Single KDS showing all brands, all orders
- Station routing: same physical station might cook for multiple brands (the fryer station makes Crispy Chicken Co. tenders AND Burger Lab fries)
- Packaging instructions per brand (different bags, different labels, different insert cards)
- Label printing: each order gets a label with brand name, customer name, order contents, platform, special instructions

#### Order Completion & Handoff
- When order is complete, system marks "Ready for Pickup" → delivery platform notifies driver
- Driver arrival tracking: driver ETA shown, order held in hot/cold holding until driver arrives
- Driver verification: order code or driver name match
- Mark as "Picked Up" → order complete
- Photo capture of packaged order before handoff (quality assurance, dispute evidence)

#### Ghost Kitchen Specifics
- Multi-brand menu management: separate menus per brand, single ingredient inventory
- Brand performance dashboards: which brand is performing (order volume, revenue, avg ticket, platform ratings)
- Platform commission tracking: each platform takes a different cut (DoorDash 15-30%, Uber Eats 15-30%)
- True profitability per brand after commissions
- Menu optimization: which items sell, which don't, which have best margins after platform fees
- Platform-specific pricing: same item can be priced differently on different platforms
- Promotion management per platform: "Free delivery on DoorDash this weekend"

---

# DELIVERABLE 2: STAFF ROLES & PERMISSIONS MATRIX

---

## Role Definitions and Access Rights

### Owner / Admin
**The person who writes the checks and loses sleep over the P&L.**

| Category | Access |
|----------|--------|
| **Dashboard** | Full access to all dashboards, all locations |
| **Sales Data** | Real-time and historical sales, all reports, export capability |
| **Labor** | View/edit all employee records, set pay rates, approve overtime, view full labor cost |
| **Menu Management** | Full CRUD on all menu items, pricing, categories, modifiers |
| **Financial** | View P&L, cost of goods, profit margins, bank reconciliation |
| **Settings** | All system settings: tax rates, payment processing config, integrations, hardware setup |
| **User Management** | Create/edit/delete ALL user accounts, assign roles, reset PINs |
| **Reporting** | Access every report, schedule automated reports, create custom reports |
| **Voids/Comps** | Unlimited void/comp authority, no approval needed |
| **Discounts** | Create/apply any discount, no limits |
| **Cash Management** | View all cash drawers, perform audits, adjust over/short |
| **Inventory** | Full access to inventory management, vendor management, purchase orders |
| **Floor Plan** | Edit floor plan layout, add/remove tables, change sections |
| **Catering/Events** | Full access to catering module |
| **Multi-Location** | Switch between and manage all locations |
| **Payroll Integration** | View/export payroll data, manage tip distribution rules |
| **Audit Trail** | View all audit logs (who did what, when) |
| **Delete Records** | Can delete historical records (with confirmation and audit trail) |

### General Manager (GM)
**Runs the restaurant day-to-day. Needs almost everything the owner has, minus some financial and system-level controls.**

| Category | Access |
|----------|--------|
| **Dashboard** | Full dashboard for their location |
| **Sales Data** | Real-time and historical for their location |
| **Labor** | Hire/fire, set schedules, approve time-off, edit timecards. CANNOT set pay rates above a threshold without owner approval |
| **Menu Management** | Full menu editing for their location. Can add daily specials, 86 items, adjust pricing within approved ranges |
| **Financial** | View daily/weekly P&L summaries. Cannot see owner distributions or bank account details |
| **Settings** | Location-specific settings: hours, tax, local promos. Cannot change payment processor or system integrations |
| **User Management** | Create/edit staff accounts at their location. Cannot create other GM or Owner accounts |
| **Reporting** | All operational reports. Cannot see multi-location aggregate unless granted |
| **Voids/Comps** | Full void/comp authority for their location. All voids/comps logged to their name |
| **Discounts** | Apply any configured discount. Can create location-specific promos |
| **Cash Management** | Full cash drawer management, perform counts, investigate discrepancies |
| **Inventory** | Place orders, receive shipments, adjust counts, run variance reports |
| **Floor Plan** | Modify sections, server assignments. Cannot restructure physical layout without owner approval |
| **Scheduling** | Full scheduling authority: create, publish, manage shift swaps |

### Assistant Manager (AGM)
**The GM's right hand. Handles shift-level management, fills in where needed.**

| Category | Access |
|----------|--------|
| **Dashboard** | Current shift dashboard |
| **Sales Data** | Real-time sales for current shift. Historical limited to 30 days |
| **Labor** | View schedules, approve clock-in/out adjustments, cannot edit pay rates |
| **Menu Management** | Can 86/un-86 items. Cannot change prices or add new menu items |
| **Voids/Comps** | Can void items up to $X (configurable, e.g., $50). Can comp with reason code. All logged |
| **Discounts** | Can apply pre-configured discounts only (cannot create new ones) |
| **Cash Management** | Perform drawer counts, process safe drops, investigate basic discrepancies |
| **User Management** | Can reset server PINs, cannot create or delete accounts |
| **Reporting** | Shift-level reports only |
| **Floor Plan** | Can reassign server sections, move tables |
| **Inventory** | Can mark items as 86'd, cannot place vendor orders |

### Shift Lead / MOD (Manager on Duty)
**A senior server or hourly employee with limited management authority during their shift.**

| Category | Access |
|----------|--------|
| **Voids** | Can void items up to $25 (configurable). Anything higher requires manager PIN |
| **Discounts** | Can apply standard discounts (military, senior, employee). Cannot create custom discounts |
| **Table Management** | Can reassign tables, manage wait list |
| **Cash** | Can count their own drawer. Cannot access other drawers or the safe |
| **86 Items** | Can mark items as 86'd |
| **Comps** | Limited comp authority (e.g., free dessert for service recovery, up to $15 value) |
| **Server Functions** | All server functions (they're also serving tables typically) |
| **Clock Management** | Can approve late clock-ins for their shift |

### Server
**The front line. Needs fast access to order entry and table management. Nothing else.**

| Category | Access |
|----------|--------|
| **Order Entry** | Full access to enter orders, modify items, assign seats, manage coursing |
| **Table Management** | View own tables, request table transfer, mark table status |
| **Check Management** | Split checks, present checks, process payments on OWN tables only |
| **Menu View** | View full menu with pricing, see 86'd items, view allergen info |
| **Guest Profiles** | View guest profile on seated tables. Cannot edit guest profiles |
| **Tip Tracking** | View own tips for current shift. Cannot see other servers' tips |
| **Void/Comp** | Can void an item NOT yet sent to kitchen (pre-send void). Post-send void requires manager PIN |
| **Pre-Auth Discount** | CANNOT apply any discount without manager override |
| **Clock In/Out** | Own timecard only |
| **Cash Drawer** | Own drawer only (if applicable), cannot access others |
| **Transfers** | Can request table transfer to another server (both must confirm, or manager approves) |
| **RESTRICTED** | Cannot access reports, labor data, menu editing, inventory, settings, cash management, other servers' tables/data |

### Bartender
**Hybrid role: server + order-maker. Needs tab management plus everything a server needs.**

| Category | Access |
|----------|--------|
| **All Server Functions** | Everything a server can do |
| **Tab Management** | Open, add to, search, and close tabs. View all open tabs (not just own) |
| **Drink Making** | Mark drinks as "made" on bar KDS |
| **Pour Tracking** | Log pours from open bottles (wine, premium spirits) |
| **Last Call** | Initiate last call process (with manager approval or on schedule) |
| **Inventory** | Can mark bar items as 86'd. View par levels. Cannot place orders |
| **Cash Drawer** | Own bar drawer. Bar register functions |
| **Speed Rail Config** | Can suggest changes to quick-pour button layout (manager approves) |
| **Pre-Auth** | Can run pre-authorizations on cards for tab opening |

### Host / Hostess
**The traffic controller. Needs floor map, reservation, and wait list management.**

| Category | Access |
|----------|--------|
| **Floor Map** | Full view and interaction with floor map |
| **Reservations** | Create, edit, cancel, confirm reservations. View guest profiles for seated guests |
| **Wait List** | Manage walk-in queue, assign estimated wait times, send "table ready" notifications |
| **Table Assignment** | Seat guests, assign server sections (within rules set by manager) |
| **Guest Count** | Track and update live guest counts |
| **Server Status** | View which servers are on floor, their current table counts (for rotation equity) |
| **RESTRICTED** | Cannot access order entry, payment processing, reports, menu management, labor, cash, inventory. Cannot see financial data |
| **Clock In/Out** | Own timecard |

### Busser
**Minimal POS interaction. Primarily table status updates.**

| Category | Access |
|----------|--------|
| **Table Status** | Mark tables as "cleared" / "clean" / "reset" |
| **Notifications** | Receive table-clear alerts from servers |
| **Clock In/Out** | Own timecard |
| **RESTRICTED** | No order entry, no payments, no menu, no reports, no anything else |

### Kitchen Manager / Executive Chef
**Runs the kitchen. Needs kitchen-specific data and some management functions.**

| Category | Access |
|----------|--------|
| **KDS** | Full kitchen display access, all stations |
| **Menu Management** | Full menu editing: items, recipes, modifiers, allergen tags, prep procedures |
| **86 Management** | 86/un-86 any item, with cascade logic |
| **Inventory** | Full food inventory access: counts, orders, receiving, waste tracking, variance reports |
| **Prep Lists** | Generate and manage prep lists |
| **Food Cost** | View food cost reports, recipe costing, plate cost analysis |
| **Labor (Kitchen Only)** | Schedule kitchen staff, approve clock-in adjustments for kitchen team |
| **Vendor Management** | Manage vendor relationships, place purchase orders, track deliveries |
| **Reports** | Kitchen-specific reports: speed of service, ticket times, waste reports, item mix |
| **Quality Alerts** | Set and manage timing thresholds, temperature alerts (IoT integration if available) |
| **RESTRICTED** | Cannot access FOH operations, payment processing, server management, financial reports beyond food cost |

### Line Cook
**Eyes on the KDS, hands on the food. Absolute minimum POS interaction.**

| Category | Access |
|----------|--------|
| **KDS (Own Station)** | View tickets for their assigned station. Mark items as complete ("bumped") |
| **86 Alert** | Can flag an item as "running low" (sends alert to kitchen manager). Cannot 86 without kitchen manager approval |
| **Clock In/Out** | Own timecard |
| **RESTRICTED** | Everything else. A line cook should never need to touch anything besides their station's KDS |

### Expo (Expeditor)
**The bridge between kitchen and dining room.**

| Category | Access |
|----------|--------|
| **Expo Screen** | Full expo display: all tickets, all stations, running times |
| **Ticket Management** | Mark orders as complete, hold orders, flag issues |
| **Course Fire** | Can fire courses (backup to server firing) |
| **Quality Check** | "Return to kitchen" function with reason code (wrong temp, wrong item, presentation issue) |
| **Table Info** | View table number, seat assignments, allergen alerts, VIP flags |
| **Communication** | Send messages to servers ("Table 7 food ready," "Re-fire salmon seat 2") |
| **RESTRICTED** | Cannot modify orders, process payments, or access management functions |

### Cashier (QSR)
**Handles ordering and payment at the counter. No table management needed.**

| Category | Access |
|----------|--------|
| **Order Entry** | Full access to create orders, apply modifiers, build combos |
| **Payment Processing** | Process all payment types: card, cash, gift card, mobile pay |
| **Cash Drawer** | Own drawer, with opening count and closing count |
| **Refunds** | Can process refunds up to $X (configurable, e.g., $20). Larger refunds need manager PIN |
| **Order Status** | View open orders, mark as picked up |
| **Discounts** | Apply pre-configured discounts with valid reason |
| **RESTRICTED** | Cannot access reports (except own shift summary), inventory, menu management, labor management |

### Delivery Driver
**Minimal system access. Needs to see their orders and mark deliveries.**

| Category | Access |
|----------|--------|
| **Order View** | See assigned delivery orders: customer name, address, items, special instructions |
| **Status Updates** | Mark as: "Picked up from restaurant," "En route," "Delivered" |
| **Navigation** | One-tap to open address in maps app |
| **Delivery Notes** | Add delivery notes ("left at door," "handed to customer") |
| **Clock In/Out** | Own timecard |
| **Mileage/Trip Log** | Log mileage or trip info (for reimbursement/tax purposes) |
| **RESTRICTED** | No access to POS functions, pricing, customer payment info, reports |

### Catering Coordinator
**Manages catering and events. Specialized role.**

| Category | Access |
|----------|--------|
| **Event Management** | Full CRUD on events, proposals, BEOs |
| **Catering Menu** | Edit catering-specific menus and pricing |
| **Client Management** | Manage catering client profiles, communication log |
| **Deposit Processing** | Process catering deposits and final payments |
| **Calendar** | View and manage catering calendar |
| **Reporting** | Catering-specific reports: bookings pipeline, revenue forecast, event P&L |
| **Inventory** | View food inventory levels (for event feasibility). Cannot modify |
| **Staff Assignment** | Assign event staff from available pool |
| **RESTRICTED** | Cannot manage daily restaurant operations, regular menu, non-event staff |

### Manager PIN Override System
Certain actions across all roles require a manager PIN:
- Post-send voids (item already in kitchen)
- Discounts above a threshold
- Price overrides
- Time card adjustments
- Cash drawer access (not own drawer)
- Refunds above threshold
- Reopening closed checks
- Deleting orders
- Changing table's assigned server
- No-sale (opening cash drawer without a transaction)

The system logs WHICH manager PIN was used, creating accountability. A shift lead's PIN is logged differently from a GM's PIN.

---

# DELIVERABLE 3: CRITICAL OPERATIONAL SCENARIOS

---

## Scenario 1: Server Drops an iPad Mid-Service

**The Reality:** A server's iPad gets knocked off a service station into a bus tub of water. It's 7:30 PM on a Saturday. They have 6 tables with open orders.

**System Response:**
1. **All data is server-side (Supabase) and synced in real-time.** Nothing is lost. The iPad is a window into the system, not the system itself. This is a fundamental architecture decision.
2. **Immediate Recovery Steps:**
   - Manager grabs a spare iPad (every restaurant should have 1-2 backups)
   - Server logs in with their PIN on the backup device
   - All their tables, open orders, and check status appear instantly (pulled from the server)
   - They continue service with zero data loss
3. **If No Spare iPad:**
   - Server's tables can be temporarily accessed by any other logged-in server (manager grants access by transferring tables)
   - Or: server uses the fixed POS station (every restaurant should have at least one wall-mounted terminal as backup)
4. **Session Management:**
   - The dead iPad's session expires after configurable timeout (5 minutes of no heartbeat)
   - System does NOT allow two devices to be logged in as the same user simultaneously (prevents stale data issues)
   - If the dead iPad somehow comes back to life, it forces a fresh login

**What the system should NEVER do:** Lose an order. Period. Orders are persisted to the database the moment they're sent. If an iPad dies between order entry and send, the un-sent order should be recoverable from local cache on next login (if the device survives) or re-entered manually (if it doesn't).

---

## Scenario 2: Internet Goes Down During Dinner Rush

**The Reality:** Your ISP goes out at 8 PM on Friday. You have 40 tables seated, kitchen is firing, bar is slammed. This is a genuine emergency.

**Offline Mode Requirements:**

### Immediate Detection
- System detects loss of connectivity within 5 seconds
- Prominent banner across all devices: "OFFLINE MODE — Data syncing paused" (red banner, persistent)
- Audible alert to manager device

### What Must Continue Working
1. **Order Entry:** Servers can still enter orders. Orders cache locally on the iPad.
2. **Kitchen Display:** KDS continues to display. Orders sent from iPads transmit via LOCAL NETWORK (Wi-Fi between devices) not internet. If the router is still on (just internet is down), intra-network communication continues.
3. **Cash Payments:** Process normally. No internet needed.
4. **Card Payments:**
   - Store-and-forward mode: capture card data encrypted locally, queue for processing when internet returns
   - Most payment processors support offline authorization up to configurable limits ($50-$100 per transaction)
   - For amounts over offline limit: accept at risk or request cash/alternative payment
   - Risk tolerance is configurable by restaurant
5. **Receipt Printing:** Local printers work without internet
6. **Table Management:** Floor map and table status sync via local network between devices

### What Stops Working
1. **Online ordering / delivery platform integration** — orders stop coming in from external platforms
2. **Cloud reporting** — no real-time dashboard for remote owners
3. **Gift card validation** — if gift card balance is stored cloud-only, cannot validate. Mitigation: cache last-known balances locally
4. **Loyalty program lookups** — if cloud-dependent
5. **SMS/email receipts** — queue for later delivery

### Recovery (Internet Returns)
1. System detects connectivity restoration
2. **Sync queue processes:** all cached orders, payments, and status changes sync to Supabase in chronological order
3. **Card authorizations process:** queued transactions run. If any decline, system flags them for manager review with table/time info for follow-up
4. **Conflict resolution:** if somehow the cloud state and local state conflict (rare but possible), system flags conflicts for manual review rather than auto-overwriting
5. Banner changes to "SYNCING..." then disappears when complete

### Architectural Decision: Local-First
The system should be designed "local-first" with cloud sync, not "cloud-first" with local cache. This means:
- The iPad app works primarily with a local SQLite database
- Changes sync to Supabase when connected
- Offline mode is not a "degraded state" — it's the normal state without internet
- This is a fundamental architectural choice that affects everything

---

## Scenario 3: Guest Claims Double Charge

**The Reality:** Guest calls Monday morning: "I was charged twice for dinner on Saturday." Could be a legit system error, a pre-auth that looks like a charge, or a server mistake.

**Investigation Workflow:**

### Step 1: Find the Transaction
- Manager opens "Transaction Lookup" screen
- Search by: guest name, last 4 of card, date range, amount, server name, table number
- System displays all matching transactions with: time, amount, payment method, items ordered, server name, check number, authorization code

### Step 2: Analyze
- System flags potential duplicates automatically: same card, similar amount, within 60-minute window
- Show all authorizations against that card number (last 4) for that date, including:
  - Pre-authorization holds (from tab opening)
  - Incremental authorizations
  - Final charge
  - Tip adjustment
- Differentiate between pending authorizations (which will drop off) and completed charges

### Step 3: Common Causes and Resolution
1. **Pre-auth hasn't dropped off:** Not a real charge. Explain to guest that the hold will release in 2-5 business days. Log the call.
2. **Server rang wrong table, voided, re-rang correctly:** Two authorizations may appear. Confirm the void processed. If not, process a refund for the voided amount.
3. **Genuine double charge (system error or server mistake):** Process refund immediately. Document with: reason code, who authorized, which transaction refunded, reference number.
4. **Tip adjustment created a second-looking charge:** The original auth was for subtotal, adjusted charge is subtotal + tip. These appear as two line items on some card statements. Explain to guest.

### Step 4: Resolution
- Process refund if warranted (amount, reason code, manager approval)
- System sends digital refund confirmation to guest (email/text)
- Incident logged in system: date, guest, description, resolution, refund amount, authorizing manager
- If pattern detected (same server with multiple double-charge complaints), flag for management review

---

## Scenario 4: Kitchen Runs Out of Salmon — 86 Process

**The Reality:** At 7:15 PM, the last salmon portion is plated. The kitchen needs to 86 salmon immediately, and it appears in 4 different dishes.

**86 Process:**

### Step 1: Kitchen Manager 86's the Ingredient
- Kitchen manager taps "86 Manager" on KDS or management iPad
- Searches or selects: "Atlantic Salmon"
- System shows ALL menu items containing salmon as an ingredient:
  - Grilled Salmon Entrée ($34)
  - Salmon Caesar Salad ($22)
  - Salmon Tartare Appetizer ($18)
  - Kids Salmon Fingers ($12)
  - Seafood Tower (contains salmon component) ($65)

### Step 2: Cascading 86
- Kitchen manager selects which items to 86 (might keep Seafood Tower if salmon is a minor component that can be subbed):
  - [x] Grilled Salmon Entrée — 86
  - [x] Salmon Caesar Salad — 86
  - [x] Salmon Tartare — 86
  - [x] Kids Salmon Fingers — 86
  - [ ] Seafood Tower — keep available (sub shrimp for salmon component)
- "Apply 86" → confirmation

### Step 3: System-Wide Update
- ALL server iPads update within 3 seconds
- 86'd items show RED "86" overlay on menu — still visible but cannot be ordered
- Audible notification on all server devices: "Salmon has been 86'd"
- If a server has an unsent order containing a 86'd item: ALERT — "Salmon Entrée on Table 7 has been 86'd. Remove or substitute."
- Floor map view shows which tables have already been served salmon (no action needed) vs. which tables have salmon on order but not yet fired (needs server intervention)

### Step 4: Existing Orders
- Orders already fired and in-progress: kitchen fulfills (they still have those portions plated/cooking)
- Orders entered but not yet sent: server is alerted and must remove or substitute
- Orders in queue (sent but not started): kitchen manager decides — fulfill if ingredient is available for that ticket, or bump back to server

### Step 5: Un-86
- When new salmon arrives (next morning or mid-service if emergency delivery):
- Kitchen manager taps item → "Restore" → all cascaded items return to available
- Server devices update immediately

### Step 6: 86 Tracking
- System logs: what was 86'd, when, who did it, when it was restored
- End-of-night report shows all 86'd items and estimated lost revenue (count of guests who asked for 86'd items if server logs the inquiry)

---

## Scenario 5: Large Party Splits Check 8 Ways with Shared Items

**Detailed above in Fine Dining workflow (Section 1.1, Step 8). Here's the technical implementation:**

### The Setup
- 16-person birthday dinner
- 3 shared appetizer platters ($18, $22, $16)
- 2 bottles of wine ($65 each)
- Individual entrées per person
- 4 desserts shared among various people
- Birthday person's meal is being covered by 3 other guests
- 8 checks requested

### System Workflow
1. Server taps "Split Check" → "Custom Split"
2. System asks: "How many checks?" → Server enters 8
3. Screen shows: Left panel = all unassigned items. Right panel = 8 check columns (scrollable)

#### Assigning Individual Items
4. Server taps "Seat 1-2 → Check A" (all items from seats 1-2 move to Check A — this couple is together)
5. Server taps "Seat 3 → Check B" (solo guest)
6. Server taps "Seat 4 → Check C" (solo guest)
7. Continue for remaining seats/checks

#### Handling Shared Appetizers
8. Server taps shared appetizer ($18) → options appear:
   - "Assign to one check" → pick which check
   - "Split equally" → across all 8 checks ($2.25 each) or select which checks
   - "Split custom" → enter specific amounts per check
9. Server chooses "Split equally across all 8" for appetizers

#### Handling Shared Wine
10. Two bottles ($65 each = $130 total)
11. "Split equally across Check A, B, C, D, E" (only 5 of the 8 groups drank wine)
12. $130 / 5 = $26.00 per check

#### Handling Birthday Person
13. Birthday person is on Check F
14. Server taps Check F → "Transfer items to..." → splits birthday person's entrée across Check A, Check C, Check G (the 3 friends paying)
15. Birthday person's entrée ($38) splits 3 ways: $12.67 each added to those checks
16. Check F now has $0 (or just their share of shared items)

#### Handling Shared Desserts
17. 4 desserts, each shared differently
18. Server assigns each dessert to the relevant checks using split or assign

#### Final Verification
19. All items show as assigned (unassigned counter = 0)
20. Each check shows its total with tax calculated individually
21. Server reviews, adjusts if needed
22. "Confirm Split" → 8 separate checks generated
23. Each check can be paid independently with different payment methods

### Edge Case: Guest Disputes Their Share
- Server can reopen the split view
- Move items between checks
- Recalculate
- This MUST be possible even after initial split is confirmed, as long as no checks have been paid yet
- Once a check is paid, it's locked. Remaining unpaid checks can still be adjusted.

---

## Scenario 6: Multi-Tender Payment (Part Cash, Part Card, Part Gift Card)

**Covered in detail in Section 1.1, Step 9. Key technical points:**

1. Check total: $127.43
2. Guest hands server a gift card
3. Server taps Payment → Gift Card → scans/enters card → Balance: $45.00
4. Apply full balance → $45.00 applied → Remaining: $82.43
5. Guest hands over $40 cash
6. Server taps "Cash" → enters $40.00 → Remaining: $42.43
7. Guest hands over Visa
8. Server taps "Credit Card" → processes $42.43 on card reader
9. Check closed. Receipt shows all three payment methods.
10. If guest wants to tip: tip goes on the credit card payment (most common) or cash tip is separate

**The tricky bit:** What if the gift card has an unknown balance? System must be able to query balance. If balance query fails (offline, system issue), server enters the gift card amount to try. If it declines for insufficient funds, system shows available balance and lets server apply that amount, then collect the rest via another method.

---

## Scenario 7: Server Transfers Tables Mid-Shift

**The Reality:** Server A's shift ends at 9 PM. They have 3 tables still dining. Server B is taking over their section.

### Transfer Workflow
1. Server A taps "Transfer Tables" on their iPad
2. Selects tables to transfer: Table 4, Table 9, Table 11
3. Selects recipient: Server B (from list of clocked-in servers)
4. Server B receives notification: "Server A wants to transfer Tables 4, 9, 11 to you. Accept?"
5. Server B accepts → tables move to Server B's section
6. All open orders, check status, guest notes, allergy alerts transfer with the table
7. Tip handling for transferred tables:
   - Option A: Tips on transferred tables go to Server B (whoever closes gets the tip)
   - Option B: Tips are split based on time served (Server A had the table for 80% of the visit)
   - Option C: Manager decides manually
   - This is configurable by restaurant policy
8. System logs the transfer: time, from whom, to whom, which tables

### Partial Shift Transfers
- Server A can transfer some tables and keep others (if they're staying late for a few tables)
- Manager can force-transfer tables (no acceptance needed from receiving server)

### Complications
- What if a check was already started on Server A's login and payment is processed by Server B? System must track BOTH servers on the transaction for tip reporting and sales attribution
- If Server A already ran a credit card but hasn't entered the tip: Server B must be able to enter the tip during tip adjustment period
- Transfer audit trail: for tip disputes, system shows exactly when transfer occurred and which server had the table for how long

---

## Scenario 8: Manager Voids an Item Sent 20 Minutes Ago

**The Reality:** A guest received their steak 20 minutes ago, ate half of it, and is now complaining it was overcooked. The server needs a manager to void or comp the item.

### Void vs Comp Decision
- **Void:** Item is removed from the check entirely. Used when the item was genuinely wrong (wrong item sent, never received, sent to wrong table). Removes revenue.
- **Comp:** Item remains on the check at $0.00. Used for service recovery, quality issues, or guest relations. Shows as comp in reporting (important for tracking food cost vs. service recovery costs).

### Workflow
1. Server selects the steak on Table 7's check
2. Taps "Void" or "Comp"
3. System prompts: "This item was sent 20 minutes ago and has been marked as served. Manager approval required."
4. Manager enters their PIN
5. **Reason Code Required** (cannot proceed without one):
   - Food Quality (overcooked, undercooked, cold, wrong temp)
   - Wrong Item Sent
   - Never Received (kitchen lost the ticket)
   - Guest Changed Mind (before item arrived — should've been caught sooner)
   - Allergy Concern
   - Service Recovery (long wait, bad experience)
   - Manager Comp (owner/manager decision for guest relations)
   - Other (free text, but discouraged)
6. Optional: free-text notes for context
7. System asks: "Re-fire replacement? (Y/N)"
   - If yes: new item goes to kitchen as "RE-FIRE" with priority flag
   - If no: just remove/comp the item
8. Check updates immediately
9. Server's iPad confirms the void/comp

### Void/Comp Audit Trail
- Transaction ID, table, seat, item, original price, void/comp type, reason code, notes, manager PIN used, timestamp
- End-of-day void/comp report shows all voids/comps sorted by manager, by server, by reason code
- Trending: if Server X has a void rate 3x the average, flag for review (could indicate honest mistakes or theft)
- Threshold alerts: if total void/comp value exceeds $X in a shift, notify GM

---

## Scenario 9: Customer Disputes Auto-Gratuity

**The Reality:** A party of 8 receives their check with 20% auto-gratuity. One guest objects: "I never agreed to this. Remove it."

### Legal and Operational Context
- Auto-gratuity on large parties is legally considered a service charge (not a tip) in most US jurisdictions since IRS Revenue Ruling 2012-18
- This means it's treated as restaurant revenue, not server income, for tax purposes
- Restaurants CAN enforce it, but alienating guests is a business decision
- The POS must support the manager's decision either way

### Workflow
1. Guest objects to auto-gratuity
2. Server escalates to manager (server should NEVER adjust auto-gratuity without manager involvement)
3. Manager approaches table
4. **Manager decision: Keep or Remove**

**If Keeping:**
5. Manager explains the policy (posted on menu/signage — POS should have a note about where auto-grat policy is disclosed)
6. Check remains as-is
7. No system action needed

**If Removing:**
5. Manager enters PIN on the check
6. Taps auto-gratuity line → "Remove Auto-Gratuity"
7. System prompts: "Removing auto-gratuity of $XX.XX. Reason?"
   - Guest objection
   - Manager discretion
   - Policy exception
8. Auto-gratuity removed. Check recalculates.
9. Suggested voluntary tip amounts still display on receipt
10. Log entry: who removed it, why, which table, party size, check total

### Auto-Gratuity Configuration
- Rules engine: applies automatically based on configurable conditions:
  - Party size >= X (default: 6 or 8)
  - Private dining: always
  - Banquet/event: always
  - Specific day/time: e.g., NYE, always
- Percentage: configurable (18%, 20%, 22%)
- Display: must show on check as "Service Charge" or "Gratuity" — wording matters legally
- Can be set to "suggested" (guest can modify) vs "mandatory" (requires manager to remove)

---

## Scenario 10: Power Outage — What Data Must Survive

**The Reality:** Transformer blows. Everything goes dark. Literally everything — POS, KDS, printers, lights, kitchen equipment.

### What Must Survive (Data Persistence)
The iPad batteries will keep devices alive for 30-120 minutes depending on charge level. During this window:

1. **All open orders** — persisted in local storage on each iPad + Supabase (if synced before outage)
2. **All open tabs/checks** — same as above
3. **Card pre-authorizations** — processor has these regardless of our system state
4. **Employee clock-in/out records** — must not lose timecard data
5. **Cash drawer counts** — last known count before outage
6. **86'd item status** — what's available, what isn't
7. **Table status** — who's seated where
8. **Pending card transactions** — any card payments in the queue that haven't been settled

### System Behavior During Power Outage
1. iPads continue operating on battery — they become the ONLY interface
2. KDS screens go dark — kitchen is now flying blind. iPads can display a simplified "kitchen view" if any iPads are available for kitchen use
3. Printers are down — no chits. Kitchen works from verbal communication or iPad display
4. Card readers may continue on battery for a period
5. Internet likely goes down (router is dead) — system enters offline mode (see Scenario 2)
6. Cellular hotspot becomes the connectivity lifeline if available

### Recovery Procedure
1. Power returns
2. KDS stations reboot — should auto-reconnect to system and display all current orders
3. Printers come back — queue of pending prints may process (or system asks: "Print queued tickets? Y/N")
4. Internet restores — sync cycle begins (see Scenario 2 recovery)
5. Manager should verify: all open checks are intact, all tables show correct status, all payments processed correctly

### Data Architecture Decision
**Critical Principle: The single source of truth for active service data must be BOTH local (iPad) and cloud (Supabase), with real-time bidirectional sync. If either one fails, the other has a complete copy.**

- iPads hold a complete local database (SQLite) of all active orders, checks, tables, menu, and settings
- Supabase holds the master database with all historical data plus active state
- Sync is continuous when connected
- Conflict resolution follows "last write wins" for most fields, with manual review for payment data conflicts

---

## Scenario 11: Guest Has Severe Allergy

**The Reality:** A guest with a severe peanut allergy sits down. If a peanut product touches their food, they could die. This is not a preference. This is life-threatening.

### Allergen Flagging Workflow

#### Step 1: Capture the Allergy
- Server enters allergy when taking the order OR when greeting the table
- On the table view, server taps "Add Alert" → "Allergy"
- Select from common allergens (pre-defined list):
  - **The 14 EU Allergens:** Celery, Cereals (gluten), Crustaceans, Eggs, Fish, Lupin, Milk, Molluscs, Mustard, Tree Nuts, Peanuts, Sesame, Soy, Sulphur Dioxide/Sulphites
  - **Additional US Common:** Coconut (tree nut subcategory), Shellfish, Corn, Latex-fruit cross-reactive
  - **Other:** Free text for uncommon allergies
- Severity: "Preference/Intolerance" vs "Allergy" vs "Severe/Anaphylaxis"
- Seat assignment: which guest has the allergy

#### Step 2: Visual Alerts — Everywhere, All the Time
- Table view: RED ALLERGY BANNER at top, cannot be dismissed. Shows: "SEAT 3: PEANUT ALLERGY — SEVERE"
- Order entry: when server adds items for Seat 3, every item that CONTAINS peanuts or MAY CONTAIN peanuts (cross-contamination risk) shows a RED WARNING
- KDS: every ticket for this table shows allergy alert in large red text. Kitchen staff cannot miss it.
- Kitchen chit (if printed): "*** ALLERGY ALERT: PEANUTS — SEAT 3 ***" printed in oversized text
- Expo screen: allergy flag visible when assembling the order

#### Step 3: Menu Filtering
- Every menu item should be tagged with allergen data (setup during menu configuration)
- When an allergy is active on a table, server can toggle "Safe items only" which filters the menu to show only items that don't contain the allergen
- Items with cross-contamination risk show a yellow warning: "Prepared in facility that processes peanuts"
- Server can still order a flagged item (maybe it's for a different seat) but must confirm: "This item contains PEANUTS. Seat 3 has a PEANUT ALLERGY. Are you ordering for a DIFFERENT seat?"

#### Step 4: Kitchen Protocol
- Ticket prints/displays with allergy alert
- Kitchen manager or lead cook must acknowledge the allergy ticket (tap to confirm "allergy protocol followed")
- This acknowledgment is logged (liability protection)
- Separate prep area, clean utensils, allergy-specific plating — these are physical procedures, but the POS drives awareness

#### Step 5: Guest Profile
- If the guest is a known customer (reservation or loyalty), allergy is stored in their profile
- Next visit: system auto-populates allergy alert when they're seated
- "Last time, Seat 3 (Guest: Harrison) had a peanut allergy flagged. Apply same alert?"

---

## Scenario 12: Wrong Food Sent to Wrong Table

**The Reality:** Expo calls "Table 12" and the runner takes food to Table 12, but it was actually for Table 21 (tickets got mixed up). Table 12 has already started eating it. Table 21 is still waiting.

### Correction Workflow

#### Step 1: Identify the Error
- Server for Table 21 notices food hasn't arrived. Checks iPad — ticket was fired 18 minutes ago.
- Server for Table 12 may not have noticed (if the wrong food happened to look right)
- Expo or manager identifies the mixup

#### Step 2: System Actions
1. Manager opens Table 21's order on the POS
2. Taps the missing items → "Re-Fire" with reason: "Sent to wrong table"
3. Items go to kitchen KDS as "RE-FIRE — RUSH" with a different color/indicator so kitchen knows this is a correction, not a new order
4. Table 21's check: items remain as ordered, no price change (they're getting what they ordered, just late)

#### Step 3: Handle Table 12
- If Table 12 received food they didn't order AND their actual order hasn't been made yet:
  - They keep what was delivered (you can't take food back once served for health code reasons)
  - Their actual order fires as normal
  - Manager decides: comp the incorrect food on Table 12's check, or charge them for what they received instead of what they ordered
  - Usually: if they ate it and liked it, charge for what was delivered. If they didn't eat it, comp it.
  - Manager processes void/comp with reason code "Wrong table delivery"

- If Table 12 received food they didn't order AND already had their correct order:
  - Comp the extra food on Table 12
  - They got a free dish

#### Step 4: Prevent Recurrence
- System should support runner confirmation: runner taps "Delivering to Table X" and system verifies the items match that table's order
- If mismatch: "These items are for Table 21, not Table 12. Verify table number."
- This adds a step to the workflow but prevents expensive mistakes

---

## Scenario 13: Customer Walks Out Without Paying

**The Reality:** You turn around and the guests at Table 6 are gone. Check is $187. No payment.

### Walkout Procedure

#### Step 1: Verify
- Server confirms the table is actually empty (guests didn't just step outside for a call)
- Check the restrooms
- Ask host if they saw anyone leave

#### Step 2: Secure Evidence
- System captures the check: all items, time seated, time of last activity
- If any card was on file (pre-auth from drinks, reservation card): the restaurant MAY be able to charge the card — consult with payment processor and legal counsel
- Security cameras: note the time for footage review

#### Step 3: Process in POS
1. Manager opens the check for Table 6
2. Taps "Walkout" (specific status, not a void or comp)
3. Manager PIN required
4. Reason: "Walkout — dine and dash"
5. System prompts: "Assign to server or house loss?"
   - **This is important:** Some restaurants make servers pay for walkouts. This is illegal in many jurisdictions (California, New York, etc.). The system should NOT have a "deduct from server paycheck" function. Instead:
   - "House Loss" (restaurant absorbs it — recommended and legally safe)
   - "Log for investigation" (track which server was responsible, but for coaching, not payroll deduction)
6. Check marked as "Walkout" — appears in loss prevention reports
7. Dollar amount tracked separately from voids/comps

#### Step 4: Reporting
- Walkout report: date, time, table, server, amount, notes
- Trending: if walkouts increase on specific days/shifts, investigate
- Server walkout frequency: for coaching purposes (are they attentive to their tables?)

---

## Scenario 14: Happy Hour Pricing Change Mid-Week

**The Reality:** Manager realizes they need to change Happy Hour from 4-6 PM to 5-7 PM starting Wednesday. It's Monday afternoon.

### Daypart Pricing Management

#### Administrative Workflow
1. Manager opens "Dayparts" in menu management
2. Current daypart schedule shows:
   - Breakfast: 6 AM - 11 AM
   - Lunch: 11 AM - 3 PM
   - Happy Hour: 4 PM - 6 PM ← needs to change
   - Dinner: 6 PM - Close
   - Late Night: 10 PM - Close
3. Manager edits "Happy Hour": 5 PM - 7 PM
4. System asks: "Effective immediately or schedule for future date?"
5. Manager selects: "Wednesday, March 22"
6. System shows affected items and their price changes:
   - Well Drinks: $5 (HH) / $9 (regular) — no price change, just timing
   - Draft Beer: $4 (HH) / $7 (regular) — same
   - Appetizer Sampler: $8 (HH) / $14 (regular) — same
7. Confirm → scheduled change saved
8. Wednesday at 5 PM, Happy Hour pricing activates automatically

#### Considerations
- What about the Tuesday-to-Wednesday transition? Tuesday still uses 4-6 PM. Wednesday switches to 5-7 PM. System must handle date-specific daypart schedules, not just global time slots.
- Overlap handling: what if Dinner pricing and Happy Hour overlap (HH now ends at 7 PM, dinner starts at 6 PM)? Items can have both a dinner price and a happy hour price. Happy hour price takes precedence during the HH window. At 7:01 PM, dinner price applies.
- Section-based pricing: if HH only applies at the bar, confirm the section assignment doesn't change with timing

---

## Scenario 15: New Menu Item Added During Service

**The Reality:** Chef creates a special using today's fish delivery. It's 4 PM, dinner service starts at 5 PM. The item needs to be orderable NOW.

### Quick-Add Menu Item Workflow

1. Kitchen manager or GM opens "Menu Management" → "Add Item"
2. Enters:
   - Name: "Pan-Seared Branzino"
   - Description: "Mediterranean sea bass, lemon caper butter, roasted fingerlings, broccolini"
   - Category: Entrées → Seafood (or "Tonight's Specials" category)
   - Price: $38
   - Cost: $12.50 (for food cost tracking — optional during rush add, can be updated later)
   - Station routing: Sauté station
   - Prep time estimate: 18 minutes
   - Allergens: Fish, Dairy (butter)
   - Modifiers: Temperature (Rare to Well — but fish, so probably just "as prepared"), Substitutions
   - Photo: skip for now (or snap a quick photo with iPad camera)
   - Availability: "Tonight Only" or "Until 86'd"
   - Quantity limit: "Only 24 portions" (auto-86 when count reaches 0)
3. "Save and Publish" → item immediately appears on all server iPads
4. Servers get a notification: "NEW SPECIAL: Pan-Seared Branzino $38 — Fish, Dairy allergens — 24 available"
5. If using customer-facing kiosks or online ordering: option to publish there too, or keep POS-only

### The Fast Version
For a truly quick add (daily soup, for example):
- "Quick Special" button: Name, Price, Station, Category — 4 fields, done
- Allergens and modifiers can inherit from category defaults
- Under 30 seconds to add an item

### Mid-Service Pricing Adjustment
- Similar workflow: find item → edit price → save
- System prompts: "Apply new price to existing open orders?" Usually NO — you honor the price at time of order
- New orders get new price

---

# DELIVERABLE 4: END-OF-DAY / REPORTING NEEDS

---

## What a Restaurant Manager Actually Looks At

### Daily Reports (Reviewed Every Night)

#### 1. Daily Sales Summary
**This is the first thing pulled up. Every single night.**
- Total gross sales
- Total net sales (after discounts, voids, comps)
- Sales by revenue center: Food / Beverage / Alcohol / Merchandise / Catering
- Sales by daypart: Breakfast / Lunch / Happy Hour / Dinner / Late Night
- Sales by payment type: Cash / Credit / Debit / Gift Card / House Account / Comp
- Comparison: today vs same day last week, vs same day last year, vs budget
- Guest count and average check size
- Covers (number of guests served)
- Per-cover average

#### 2. Labor Report
- Total labor hours worked today
- Total labor cost today (hourly wages)
- Labor cost as percentage of sales (THE number — target varies: 25-35% depending on concept)
- Overtime alerts: any employee approaching 40 hours this week
- Break compliance: did everyone take required breaks? (Critical in CA, NY, and other states with strict break laws)
- Staffing efficiency: sales per labor hour
- Scheduled vs actual hours (did someone clock in early? Stay late? No-show?)

#### 3. Void / Comp / Discount Report (Loss Prevention)
**Managers review this EVERY NIGHT to catch theft or training issues.**
- Every void: item, amount, server, manager who approved, reason code, time
- Every comp: same detail
- Every discount: what discount, amount, server, authorization
- Total void value, total comp value, total discount value
- Void/comp as percentage of sales (anything over 2-3% raises eyebrows)
- Server-by-server breakdown (Server A voided $210 worth of food — why?)
- Pattern detection: same server voiding the same item repeatedly = possible theft (ordering food for themselves, voiding it, taking the food)

#### 4. Cash Report
- Opening cash drawer count (beginning of shift)
- Cash sales during shift
- Cash payments received (sum of all cash tendered)
- Cash tips declared
- Cash payouts (vendor payments, employee advance, etc.)
- Safe drops during shift
- Expected cash in drawer
- Actual cash in drawer (closing count)
- Over/Short: the difference. Anything over $5 either way warrants investigation
- By-employee breakdown if using individual drawers

#### 5. Speed of Service
- Average ticket time: order sent to kitchen → order completed
- By station: grill avg 14 min, sauté avg 11 min, fry avg 7 min
- By daypart: lunch speed vs dinner speed
- Outliers: any ticket over 25 minutes — what happened?
- Drive-through: order-to-window time (for QSR)

#### 6. Server Performance Summary
- Per-server metrics:
  - Total sales
  - Number of covers served
  - Average check size
  - Average tip percentage
  - Upsell rate (drinks per cover, appetizers per table, desserts per table)
  - Table turn time average
  - Void/comp count and value
- Ranked by: total sales, tip percentage, or average check
- This is for coaching, not punishment. Server with lowest appetizer attachment rate needs a conversation, not a write-up.

### Weekly Reports

#### 7. Food Cost Report
- Theoretical food cost (based on recipes and sales mix) vs actual food cost (based on inventory)
- Variance analysis: if theoretical is 28% and actual is 33%, there's 5% unaccounted food
- Cost by category: proteins, produce, dairy, dry goods, beverages
- Waste log: what was wasted, why (spoilage, prep error, returned by guest, dropped)
- Inventory valuation: current on-hand value

#### 8. Product Mix (PMIX)
- Every menu item: quantity sold, revenue, food cost percentage, gross profit
- Sorted by: profit contribution (not just quantity — the $12 item sold 200 times might be more profitable than the $38 item sold 40 times)
- Underperformers: items selling fewer than X per week — consider removing
- Stars: high-profit, high-volume items — promote these
- Menu engineering matrix: Stars / Plowhorses / Puzzles / Dogs (standard menu engineering framework)

#### 9. Tip Distribution Summary
- Total tips collected (credit card tips + declared cash tips)
- Tip pool calculations (if applicable)
- Tip-out amounts: to bussers, runners, bar, host
- Individual tip summaries per employee (for tax reporting)
- Credit card processing fee deduction from tips (if restaurant passes this through — legal in most states, check local law)

#### 10. Reservation & Wait Times
- Reservations: total, no-shows, cancellations, walk-ins vs reservations
- Average wait time by day/time
- Table utilization: how many table-hours were available vs occupied
- Peak and off-peak patterns
- No-show rate and trend

### Monthly Reports

#### 11. P&L Summary
- Revenue breakdown by category
- COGS (food cost + beverage cost)
- Gross profit margin
- Labor cost (fully burdened: wages + taxes + benefits)
- Operating expenses: rent, utilities, insurance, supplies, marketing, technology, credit card processing fees
- Net operating income
- Comparison: budget vs actual, this month vs last month, this month vs same month last year

#### 12. Trend Analysis
- Sales trends: 13-week rolling average
- Guest count trends
- Average check trends
- Daypart shift analysis (is lunch growing? Is late night dying?)
- Category trends: is alcohol sales declining? Is food cost creeping up?

#### 13. Employee Performance Reviews Data
- Aggregate server metrics for performance review periods
- Attendance records: lates, no-shows, shift swaps
- Training completion
- Customer complaint association (if guest complaints are logged with table/server)

### What Owners Check on Their Phone at 11 PM

**The "Owner Dashboard" — mobile-optimized, real-time.**

This is someone lying in bed, unable to sleep, wanting to know how tonight went:

1. **Today's total sales** — big number, front and center
2. **vs. same day last week** — up or down arrow with percentage
3. **Current labor %** — green if under target, red if over
4. **Open checks count** — how many tables are still dining (is the restaurant going to close on time?)
5. **Cash over/short** — did drawers balance?
6. **Void/comp total** — any red flags?
7. **Guest count** — how many people came through the door?
8. **Tomorrow's reservations** — how busy will it be?
9. **Any alerts:** equipment alarms, critical 86 events, employee no-shows, payment processing errors

**Pull-to-refresh. No login required if on their personal device (biometric auth). Loads in under 2 seconds.**

---

# DELIVERABLE 5: MENU ARCHITECTURE REQUIREMENTS

---

## How Menus Are Actually Structured

### The Hierarchy

```
Restaurant
└── Menu (e.g., "Dinner Menu", "Lunch Menu", "Brunch Menu", "Bar Menu", "Catering Menu")
    └── Category (e.g., "Appetizers", "Entrées", "Desserts")
        └── Subcategory (optional, e.g., "Seafood", "Pasta", "Steaks")
            └── Menu Item (e.g., "Grilled Salmon")
                └── Modifier Group (e.g., "Temperature", "Side Choice", "Add-Ons")
                    └── Modifier (e.g., "Medium Rare", "Mashed Potatoes", "Add Bacon +$3")
```

### Menu Types
1. **Dine-In Menu** — the main menu
2. **Lunch Menu** — different items and/or prices from dinner
3. **Brunch Menu** — weekend specific
4. **Happy Hour Menu** — limited items at reduced prices (may include items NOT on the dinner menu)
5. **Bar Menu** — available only at bar seats (late-night bites, etc.)
6. **Kids Menu** — smaller portions, lower prices, age-appropriate
7. **Catering Menu** — per-head or per-platter pricing
8. **Takeout Menu** — may exclude items that don't travel well (soufflé isn't going in a box)
9. **Delivery Menu** — may further restrict from takeout menu (nothing with ice cream unless you have insulated packaging)
10. **Kiosk Menu** — simplified for self-ordering
11. **Seasonal Menu** — rotates quarterly or monthly, overlays on base menu
12. **Prix Fixe Menu** — fixed price for a set number of courses with choices per course

### The Problem Software Engineers Create
Engineers want clean hierarchies. Restaurants don't have them. Real examples:

- The "Soup du Jour" exists on the lunch menu AND dinner menu but at different prices
- The "Grilled Chicken" exists as an entrée ($24), as a salad protein add-on ($8), as a kids menu item ($10), and as a catering option ($18/person). It's the same chicken from the same prep, but it's FOUR different menu items with different pricing, different modifiers, and different station routing.
- Happy Hour "Sliders" don't exist on ANY other menu. They only appear during happy hour. But they use the same burger patties as the regular burger.
- The prix fixe menu includes a choice of appetizer (from a restricted list of 4 from the regular appetizer menu), entrée (from a restricted list of 5), and dessert (from a restricted list of 3). The items are the same as à la carte, but pricing is different.

**The system must support: the same base ingredient/recipe appearing across multiple menus and categories at different prices with different modifiers.**

### Menu Item Data Model
Each menu item needs:
- **ID** (unique)
- **Name** (display name)
- **Short Name** (for KDS/printer — "Grl Slmn" instead of "Pan-Seared Grilled Atlantic Salmon")
- **Description** (for customer-facing displays, kiosks, online ordering)
- **Category / Subcategory** assignment (can be in multiple categories)
- **Price** (base price — can be overridden by daypart, menu, or location)
- **Price Type**: Fixed, Market Price, Open Price (server enters price), Weight-Based (per lb/oz), Size-Based
- **Tax Class**: Food, Alcohol, Non-Taxable (gift cards), etc.
- **Revenue Class**: Food, Beverage, Alcohol, Merchandise (for reporting)
- **Station Routing**: which kitchen station(s) this item routes to
- **Prep Time**: estimated minutes (for timing and speed of service tracking)
- **Recipe Link**: link to recipe record (for cost calculation)
- **Ingredient List**: for allergen and 86 cascade logic
- **Allergen Tags**: from predefined list
- **Dietary Tags**: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, Halal, Kosher, etc.
- **Photo**: display image
- **Modifier Groups**: ordered list of modifier groups that apply to this item
- **Availability**: Always, Specific Dayparts, Specific Days, Date Range, Until 86'd, Quantity Limited
- **Sort Order**: position within its category
- **Active/Inactive**: toggle to hide without deleting
- **PLU / SKU**: for inventory integration
- **Barcode**: for scanning (retail items)
- **Online Ordering Visible**: Y/N
- **Kiosk Visible**: Y/N

---

## Modifier Complexity: Real-World Examples

### Example 1: Starbucks-Level Modifier Tree

**Item: Caramel Macchiato**

```
Modifier Group 1: SIZE (Forced — must select one)
├── Short (8oz) — $4.25
├── Tall (12oz) — $4.75 [DEFAULT]
├── Grande (16oz) — $5.45
└── Venti (20oz) — $5.95

Modifier Group 2: MILK (Forced — must select one)
├── Whole Milk [DEFAULT]
├── 2% Milk
├── Nonfat Milk
├── Oat Milk (+$0.80)
├── Almond Milk (+$0.80)
├── Soy Milk (+$0.80)
├── Coconut Milk (+$0.80)
└── Heavy Cream (+$0.80)

Modifier Group 3: ESPRESSO SHOTS (Optional — default is standard for size)
├── Add Extra Shot (+$1.20) [can select multiple]
├── Sub Decaf (no charge — replaces default)
├── Half-Caf (no charge)
└── Blonde Espresso (no charge — replaces default)

Modifier Group 4: SYRUP (Optional — vanilla is default for this drink)
├── Vanilla [DEFAULT — included]
├── Extra Vanilla (+$0.60)
├── Sub Caramel (no charge — replaces vanilla)
├── Sub Hazelnut (no charge)
├── Sub Toffee Nut (no charge)
├── Add [Any Syrup] (+$0.60 each)
├── Sugar-Free Vanilla (no charge — replaces vanilla)
└── No Vanilla (removes default)

Modifier Group 5: TEMPERATURE (Forced — must select one)
├── Hot [DEFAULT]
├── Iced (+$0.00 or +$0.50 depending on location)
└── Blended (Frappuccino-style, +$1.00)

Modifier Group 6: WHIPPED CREAM (Optional)
├── With Whip [DEFAULT for this drink]
├── No Whip
├── Extra Whip
└── Whip on Bottom

Modifier Group 7: DRIZZLE (Optional)
├── Caramel Drizzle [DEFAULT for this drink]
├── Extra Caramel Drizzle
├── No Drizzle
└── Mocha Drizzle (add/sub)

Modifier Group 8: TOPPINGS (Optional — multiple select)
├── Cinnamon Powder
├── Nutmeg
├── Vanilla Powder
├── Cookie Crumbles (+$0.50)
└── Caramel Crunch (+$0.50)

Modifier Group 9: CUSTOMIZATIONS (Optional)
├── Extra Hot
├── Warm (kids temp)
├── Light Ice / No Ice (for iced)
├── Extra Ice
├── In a Venti Cup (for smaller drinks with room)
├── Double-Cupped
└── Water (add, for tea-style dilution)
```

**Total possible combinations for this ONE drink: approximately 50,000+**

### Example 2: Burger Restaurant

**Item: Build Your Own Burger**

```
Modifier Group 1: PATTY (Forced, select one)
├── Single (6oz) — included in base price
├── Double (12oz) — +$4.00
├── Triple (18oz) — +$7.00
├── Beyond Burger (plant-based) — +$3.00
├── Turkey Patty — +$0.00
└── Black Bean Patty — +$0.00

Modifier Group 2: TEMPERATURE (Forced for beef patties, hidden for others)
├── Rare
├── Medium Rare
├── Medium [DEFAULT]
├── Medium Well
└── Well Done

Modifier Group 3: BUN (Forced, select one)
├── Brioche [DEFAULT]
├── Sesame
├── Pretzel (+$1.50)
├── Lettuce Wrap (no charge — GF option)
├── Gluten-Free Bun (+$2.00)
└── No Bun (protein style)

Modifier Group 4: CHEESE (Optional, select up to 2 included, additional +$1.00 each)
├── American
├── Cheddar
├── Swiss
├── Pepper Jack
├── Blue Cheese
├── Provolone
├── No Cheese
└── Extra Cheese (+$1.00 per additional slice)

Modifier Group 5: INCLUDED TOPPINGS (Optional, pre-selected defaults, deselect to remove)
├── [x] Lettuce [DEFAULT ON]
├── [x] Tomato [DEFAULT ON]
├── [x] Onion [DEFAULT ON]
├── [x] Pickle [DEFAULT ON]
├── [ ] Jalapeños
├── [ ] Banana Peppers
├── [ ] Mushrooms
├── [ ] Roasted Red Pepper
└── [ ] Avocado (+$2.50)

Modifier Group 6: SAUCES (Optional, select up to 2 included)
├── Ketchup
├── Mustard
├── Mayo
├── Special Sauce
├── BBQ
├── Ranch
├── Hot Sauce
├── Garlic Aioli
├── Chipotle Mayo
└── No Sauce

Modifier Group 7: PREMIUM ADD-ONS (Optional, each priced)
├── Bacon (+$2.50)
├── Fried Egg (+$2.00)
├── Onion Rings (+$2.00)
├── Guacamole (+$2.50)
├── Chili (+$3.00)
└── Mac & Cheese Topping (+$3.50)
```

### Example 3: Sushi Restaurant

**Item: Custom Roll**

```
Modifier Group 1: ROLL STYLE (Forced)
├── Traditional (seaweed outside)
├── Inside-Out (rice outside) (+$1.00)
├── Hand Roll (cone)
├── Soy Paper Wrap (+$1.00)
└── Cucumber Wrap (+$2.00) [GF]

Modifier Group 2: PROTEIN (Forced, select 1-3)
├── Tuna — included (1) / +$3 (additional)
├── Salmon — included (1) / +$3
├── Yellowtail — +$2 (1) / +$4 (additional)
├── Eel — +$3
├── Shrimp Tempura — +$2
├── Crab (real) — +$4
├── Crab (imitation) — included
├── Spicy Tuna — +$1
├── Tofu — included
└── No Protein

Modifier Group 3: FILLINGS (Optional, select up to 4, included)
├── Avocado
├── Cucumber
├── Mango
├── Cream Cheese
├── Tempura Flakes
├── Scallion
├── Asparagus
├── Sweet Potato
└── Jalapeño

Modifier Group 4: SAUCE (Optional, multiple)
├── Soy Sauce (on side)
├── Spicy Mayo (on/drizzle)
├── Eel Sauce (drizzle)
├── Ponzu
├── Wasabi (extra)
└── No Sauce

Modifier Group 5: TOPPINGS (Optional, priced)
├── Tobiko (+$2)
├── Masago (+$1.50)
├── Sesame Seeds (no charge)
├── Torched/Seared (+$3)
├── Tempura-Style (whole roll deep fried) (+$4)
└── Crunch Topping (+$1)
```

---

## Forced vs Optional Modifiers

### Forced Modifiers
The order CANNOT be sent to the kitchen without selecting from this group.
- Temperature on steaks/burgers
- Size on drinks
- Side choice on combo meals
- Bread type on sandwiches
- Cooking method: "Fried / Grilled / Blackened" for protein options

**POS behavior:** If server tries to send order without completing a forced modifier, system blocks with: "Please select [Temperature] for [Ribeye Steak]"

### Optional Modifiers
The order CAN be sent without any selection — defaults apply.
- Add-ons
- Toppings (beyond defaults)
- Extra sauces
- Special instructions

### Default Modifiers
Some modifiers have a default selection that applies if the server doesn't change it:
- Burger comes with "Lettuce, Tomato, Onion, Pickle" by default → server only needs to note removals
- Pasta comes with "Penne" by default → server only changes if guest wants spaghetti

### Modifier Pricing Models
1. **Included:** No additional charge (choosing between included toppings)
2. **Upcharge:** Fixed additional cost (+$2.50 for bacon)
3. **Replacement:** Swap one included item for another at no charge (sub sweet potato fries for regular fries)
4. **Replacement with Upcharge:** Swap with price difference (sub truffle fries +$3.00)
5. **Quantity-Based:** First N included, additional at cost (first 2 cheeses free, additional $1.00 each)
6. **Percentage-Based:** rare, but some modify price by percentage (extra portion = +50%)

---

## Combo / Meal Deal Logic

### Combo Structure
```
Combo: "Lunch Special" — $14.99
├── Step 1: Choose Entrée (from restricted list)
│   ├── Club Sandwich
│   ├── Caesar Salad
│   ├── Soup & Half Sandwich
│   └── Daily Pasta
├── Step 2: Choose Side (included)
│   ├── Fries
│   ├── Side Salad
│   ├── Fruit Cup
│   └── Onion Rings (+$1.50 upcharge)
└── Step 3: Choose Drink (included)
    ├── Fountain Drink (any size)
    ├── Iced Tea
    ├── Coffee
    └── Juice (+$1.00 upcharge)
```

### Combo System Requirements
- Each combo step can have its own modifier requirements (burger in the combo still needs temperature)
- Combo pricing replaces individual item pricing (don't show individual prices within combo)
- "Make it a combo" prompt: if guest orders items individually that match a combo, system suggests the combo if it saves money
- Combo modification: guest wants to "upgrade" a combo item (larger drink, premium side). System calculates upcharge from combo price.
- Combo voiding: if one item in a combo is voided, entire combo should revert to individual pricing for remaining items. Or: void the voided item and keep combo pricing on the rest. Configurable by restaurant.
- Multiple combos per order: family of 4 each gets a combo — 4 separate combo instances on one check

---

## Happy Hour / Daypart Pricing

### Configuration
```
Daypart: "Happy Hour"
├── Time: Monday-Friday, 4:00 PM - 6:00 PM (or whatever)
├── Applicable Sections: Bar Only (or All — configurable)
├── Pricing Rules:
│   ├── Well Cocktails: $5.00 (regular: $9.00)
│   ├── Draft Beer: $4.00 (regular: $7.00)
│   ├── House Wine: $6.00 (regular: $11.00)
│   ├── Selected Appetizers: 50% off
│   └── HH-Only Items: Sliders ($8), Wings ($7) — not available outside HH
├── Exclusions: Premium spirits, bottle service, wine bottles
└── Auto-Switch: prices change automatically at start/end time
```

### Pricing Priority (when conflicts exist)
1. Manual price override (manager-applied)
2. Promotion/coupon pricing
3. Daypart pricing (happy hour)
4. Menu-specific pricing (lunch vs dinner menu)
5. Base item price

### Edge Cases
- Guest orders at 5:58 PM during happy hour. Happy hour ends at 6:00 PM. They get happy hour pricing. The ORDER TIMESTAMP determines pricing, not the payment time.
- Guest is seated during happy hour but doesn't order until 6:15 PM. They get dinner pricing. Unless manager overrides.
- Happy hour pricing on a holiday: system needs holiday override capability (no happy hour on Thanksgiving, or special holiday happy hour times)

---

## Seasonal Menu Rotation

### How It Works
- "Seasonal" is a menu overlay, not a replacement
- Base menu stays the same year-round (core items)
- Seasonal items are added with start/end dates
- When a seasonal item's end date passes, it auto-deactivates (doesn't delete — keeps history for next year's planning)
- Seasonal items can replace base items or supplement them:
  - "Summer Gazpacho" replaces "Winter Butternut Squash Soup" (same slot, different item)
  - "Pumpkin Cheesecake" is added to desserts in fall (additional item)

### Management Interface
- Calendar view showing active items by date range
- "Clone from last year" for seasonal rotation planning
- Inventory alerts: seasonal items may need ingredient orders placed weeks in advance

---

## Multi-Location Menu Variations

### The Problem
A restaurant group with 5 locations. 80% of the menu is the same. But:
- Location A is near a college — needs cheaper options and late-night menu
- Location B is in a wealthy suburb — has premium items the others don't
- Location C is in a state with different alcohol laws — different drink menu
- Location D has a smaller kitchen — can't do some complex dishes
- Location E is seasonal (beach town) — different menu summer vs winter

### Solution: Menu Inheritance
```
Master Menu (corporate-defined)
├── All locations inherit this by default
├── Location A overrides:
│   ├── Added: "Late Night Menu" (11 PM - 2 AM)
│   ├── Added: "Value Combos" category
│   └── Price adjustments: 10% lower on 12 items
├── Location B overrides:
│   ├── Added: "Premium Cuts" category (wagyu, dry-aged)
│   ├── Added: "Sommelier Selections" (high-end wines)
│   └── Price adjustments: 15% higher on 8 items
├── Location C overrides:
│   ├── Removed: "Happy Hour Drink Specials" (state prohibits)
│   └── Modified: beer/wine only (no cocktails — different license)
├── Location D overrides:
│   └── Removed: 6 items kitchen can't produce
└── Location E overrides:
    ├── Summer Menu: full menu + seafood specials
    └── Winter Menu: reduced menu, comfort food focus
```

### How Corporate Controls This
- "Locked" items: corporate mandates these exist at all locations, cannot be removed or price-changed locally
- "Flexible" items: locations can modify pricing within approved range (e.g., +/- 15%)
- "Local" items: locations can add their own items (requires corporate approval or not, configurable)
- Menu change propagation: corporate changes master menu → pushes to all locations → locations see what changed and can accept or flag conflicts with their overrides

---

## 86 Cascade Logic

### Ingredient-Level 86
The system needs an ingredient database linked to menu items. When an ingredient is 86'd, all items using that ingredient are affected.

```
Ingredient 86'd: "Chicken Breast"

Cascading Impact:
├── Grilled Chicken Entrée — 86'd
├── Chicken Caesar Salad — 86'd (or available if chicken can be subbed/removed)
├── Chicken Tenders (Kids) — 86'd
├── Chicken Sandwich — 86'd
├── Chicken Quesadilla (Bar Menu) — 86'd
├── Cobb Salad — PARTIALLY affected (chicken is optional topping) → show warning, offer without chicken
├── Chicken Stock (used in French Onion Soup) — alert kitchen manager (stock is already made, so not an immediate issue, but flag for next prep)
└── Chicken Wing Appetizer — uses wings, not breast → NOT affected (different ingredient)
```

### The Important Distinction
86 can happen at two levels:
1. **Ingredient 86** — the raw ingredient is gone. All items using it cascade.
2. **Item 86** — a specific finished dish is unavailable, but the ingredient may be fine. Example: the fryer is broken, so all fried items are 86'd, but the chicken breast is still available for grilled preparations.

The system must support both.

### 86 Quantity Tracking
- "Running Low" status: 5 portions of salmon left. Server sees "LOW" indicator. Can still order, but server should verbally manage expectations: "We have a few of those left tonight."
- "86'd" status: 0 portions. Cannot order.
- Auto-86: item has a quantity count that decrements with each order. When it hits 0, auto-86. (Used heavily for specials and food trucks.)
- Manual 86: kitchen manager manually 86's regardless of theoretical count (they know the quality of remaining product, system doesn't)

---

## Pricing Models

### Fixed Price
- Standard: $24.00 for the Grilled Salmon
- Most items use this

### Market Price (MP)
- Display shows "MP" or "Market Price" instead of a dollar amount
- Server must enter price at time of order (open price entry)
- Manager can set a price range to prevent errors: "Lobster MP — acceptable range: $38-$65"
- Common for: lobster, oysters, seasonal fish, truffles

### Open Price
- No predetermined price — server enters at order time
- Used for: special requests, off-menu items, negotiated pricing
- Usually requires manager approval

### Size-Based Pricing
```
Item: "House Salad"
├── Side — $7
├── Half — $10
└── Full — $14
```
Size is a forced modifier that changes the base price.

### Weight-Based Pricing
- Item priced per pound or per ounce
- Server enters weight at order time
- System calculates price: weight x price-per-unit
- Used for: deli items, butcher cuts, bulk seafood, buffet by-the-pound
- Scale integration: if a connected scale is available, weight auto-populates

### Time-Based Pricing
- Price changes based on when ordered (daypart pricing covered above)
- Also: "Early Bird Special" — full dinner menu at discount before 5:30 PM

### Volume/Tier Pricing
- "Buy 2 get 1 free" — system auto-applies when 3 of the same item are ordered
- "10% off orders over $100" — automatic discount trigger
- Bulk catering pricing: per-head cost decreases with larger groups

---

## Dietary & Allergen Tagging

### The 14 EU Allergens (Required in EU, Best Practice Everywhere)
1. Celery (including celeriac)
2. Cereals containing gluten (wheat, rye, barley, oats, spelt, kamut)
3. Crustaceans (crab, lobster, crayfish, shrimp, prawn)
4. Eggs
5. Fish
6. Lupin
7. Milk (including lactose)
8. Molluscs (mussels, oysters, squid, snails)
9. Mustard
10. Tree Nuts (almonds, hazelnuts, walnuts, cashews, pecans, brazils, pistachios, macadamia)
11. Peanuts
12. Sesame
13. Soy (soybeans)
14. Sulphur dioxide / sulphites (at concentration of more than 10mg/kg or 10mg/litre)

### Additional US Common Allergens
15. Coconut (FDA classifies as tree nut)
16. Shellfish (overlaps with crustaceans/molluscs but listed separately in US)
17. Corn
18. Latex-cross-reactive fruits (banana, avocado, kiwi, chestnut)

### Dietary Tags
- Vegetarian (no meat/fish)
- Vegan (no animal products)
- Gluten-Free (or "can be prepared GF" with modifications)
- Dairy-Free
- Nut-Free
- Keto-Friendly
- Paleo-Friendly
- Halal
- Kosher
- Low-Sodium
- Heart-Healthy
- Raw

### How Tagging Works
- Each menu item is tagged at setup with CONTAINS and MAY CONTAIN for each allergen
- Tags inherit from recipe/ingredients: if the recipe includes "soy sauce," item is auto-tagged with Soy
- Override capability: kitchen manager can add/remove tags (e.g., "we use tamari now, which is soy but GF" — still tagged Soy, but can add GF tag)
- Cross-contamination warnings: "Prepared in a kitchen that processes nuts" — blanket warning vs item-specific
- Customer-facing display: allergen icons shown on kiosks, online ordering, and can be printed on menus

---

# DELIVERABLE 6: KITCHEN OPERATIONS DEEP DIVE

---

## How KDS Routing Actually Works

### Station-Based Kitchen Architecture
A typical full-service kitchen has 5-8 stations. Each station has its own KDS screen (or section of a shared screen). The POS must route each item on a ticket to the correct station(s).

**Typical Stations:**
```
Station 1: GRILL / BROILER
  - Steaks, burgers, grilled chicken, grilled fish, lamb chops

Station 2: SAUTÉ
  - Pasta dishes, pan-seared fish, risotto, sautéed vegetables

Station 3: FRY
  - French fries, fried calamari, fish & chips, chicken tenders, onion rings

Station 4: SALAD / COLD
  - Salads, cold appetizers, tartare, carpaccio, cheese plates

Station 5: PANTRY / GARDE MANGER
  - Charcuterie boards, oyster platters, cold soups, pâtés

Station 6: PIZZA / OVEN
  - Pizzas, flatbreads, baked dishes, roasted items

Station 7: DESSERT / PASTRY
  - Desserts, pastries, bread service

Station 8: EXPO (not a cooking station — the assembly and quality check point)
  - Sees ALL items from ALL stations
  - Orchestrates timing
```

### Routing Logic
When a server sends an order for Table 7:
- Seat 1: Caesar Salad (Starter), Ribeye Steak Medium Rare (Entrée)
- Seat 2: French Onion Soup (Starter), Seared Salmon (Entrée)
- Seat 3: Calamari (Starter), Pasta Carbonara (Entrée)

**System routes:**
```
SALAD STATION KDS:      Table 7, Seat 1: Caesar Salad [COURSE 1 — FIRE]
SAUTÉ STATION KDS:      Table 7, Seat 2: French Onion Soup [COURSE 1 — FIRE]
                         Table 7, Seat 2: Seared Salmon [COURSE 2 — HOLD]
                         Table 7, Seat 3: Pasta Carbonara [COURSE 2 — HOLD]
FRY STATION KDS:        Table 7, Seat 3: Calamari [COURSE 1 — FIRE]
GRILL STATION KDS:      Table 7, Seat 1: Ribeye MR [COURSE 2 — HOLD]
EXPO KDS:               Table 7 — FULL TICKET (all items, all courses, all stations)
```

Course 1 items fire immediately. Course 2 items show on the station KDS but are grayed out / marked HOLD until the server (or expo) fires Course 2.

### Multi-Station Items
Some items require work from multiple stations:
- "Steak Frites": Grill station (steak) + Fry station (frites) — both stations see the item
- "Seafood Tower": Cold station (oysters, shrimp) + Pantry (pâté, accompaniments) — both see it
- System must coordinate: both stations mark their component as "done," and only when ALL components are done does the item show as complete on expo

### KDS Display Per Station
Each station screen shows:
```
┌─────────────────────────────────────────────────────────┐
│ GRILL STATION                        3 tickets | 7 items│
├─────────────────────────────────────────────────────────┤
│ TABLE 4          │ TABLE 7          │ TABLE 12         │
│ 12:03 [GREEN]    │ 14:22 [GREEN]    │ 08:45 [YELLOW]   │
│                  │                  │                   │
│ 1x Ribeye MR     │ 1x Ribeye MR     │ 2x NY Strip MW   │
│ 1x Burger Med    │                  │ 1x Filet Rare     │
│ 1x Chicken Grl   │ [HOLD - Course2] │ 1x Burger Well    │
│                  │                  │                   │
│ [BUMP]           │                  │ *** RUSH ***       │
│                  │                  │ [BUMP]             │
└─────────────────────────────────────────────────────────┘
```

- Tickets ordered left-to-right by time (oldest left, newest right)
- Timer shows elapsed time since fired (not since ordered — since FIRED to that station)
- Color coding on timer: Green < 10 min, Yellow 10-15 min, Red 15-20 min, Flashing Red > 20 min
- "BUMP" button: cook taps when their station's items for that ticket are done
- Items scroll if ticket has many items
- Allergy alerts show in RED block: "*** PEANUT ALLERGY ***"
- Course status: FIRE or HOLD clearly indicated
- Rush/VIP flags prominently displayed
- Modifications in bold or highlighted color under the item name

### All-Day Counts
**What the kitchen REALLY needs to know: how many of each item they're cooking RIGHT NOW.**

At the bottom of the KDS (or on a dedicated "All Day" screen):
```
ALL DAY — GRILL STATION
Ribeye:    3 (1 Rare, 1 MR, 1 Med)
NY Strip:  2 (both MW)
Filet:     1 (Rare)
Burger:    4 (1 Med, 2 MW, 1 Well)
Chicken:   2 (both as-is)
────────────────────
Total Items: 12
```

All-day counts update in real-time as new orders come in and items are bumped. This tells the grill cook at a glance: "I need 12 things on my grill right now."

---

## Expo Screen Requirements

The expo is the conductor of the kitchen orchestra. Their screen is different from station screens.

### Expo Screen Layout
```
┌────────────────────────────────────────────────────────────────────┐
│ EXPO                                          Active Tickets: 14  │
├────────────────────────────────────────────────────────────────────┤
│ TABLE 4 [12:03]   │ TABLE 7 [02:15]   │ TABLE 12 [08:45]         │
│ Server: Maria      │ Server: Jake       │ Server: Sarah            │
│ Course 1 — ACTIVE  │ Course 1 — ACTIVE  │ Course 2 — ACTIVE        │
│ ✓ Caesar Salad     │ ○ Caesar Salad     │ ✓ NY Strip MW [Grill]    │
│ ✓ Onion Soup       │ ○ Onion Soup       │ ✓ NY Strip MW [Grill]    │
│ ✓ Calamari         │ ○ Calamari         │ ○ Filet Rare [Grill]     │
│ — READY TO RUN —   │                    │ ○ Burger Well [Grill]    │
│                    │                    │ ○ Mac&Cheese [Sauté]     │
│ Course 2 — HOLD    │ Course 2 — HOLD    │ *** PEANUT ALLERGY S3 ***│
│ Ribeye MR [Grill]  │ Ribeye MR [Grill]  │                          │
│ Burger Med [Grill] │ Salmon [Sauté]     │                          │
│ Chicken [Grill]    │ Carbonara [Sauté]  │                          │
│ [FIRE COURSE 2]    │                    │                          │
└────────────────────────────────────────────────────────────────────┘

Legend: ✓ = Station completed  ○ = Still cooking  ● = Not started
```

### Expo Functions
1. **See all tickets at once** — the expo needs the big picture
2. **Track item status from all stations** — when grill bumps the steak, expo sees ✓ on that line
3. **Identify the bottleneck** — if Table 12's ticket has 3 items done and 2 still cooking, the 2 are the bottleneck. Expo can call out to the lagging station.
4. **"Ready to Run" indicator** — when all items for a course are complete, the ticket highlights with "READY TO RUN" or flashes. Expo calls the runner.
5. **Fire courses** — expo can fire the next course (backup to server)
6. **Re-fire items** — if an item is wrong (came up overcooked), expo sends it back: "RE-FIRE Filet Rare — Table 12" → appears on grill station as priority
7. **Communication to servers** — "Food up for Table 4" notification pushed to server's iPad
8. **Hold tickets** — "Don't plate Table 7 yet, they're not ready for their next course"
9. **Timing overview** — which tickets are in danger of going over time thresholds

### What Expo Screen Should NOT Have
- Payment info (expo doesn't need to know prices)
- Guest personal details (beyond allergy alerts and VIP flags)
- Management functions
- Anything that clutters the view — expo needs CLARITY above all

---

## Ticket Timing and Aging

### Color Coding System (Configurable)
| Time Since Fire | Color | Meaning |
|---|---|---|
| 0-8 minutes | Green | On track |
| 8-12 minutes | Yellow | Watch it |
| 12-18 minutes | Orange | Falling behind |
| 18-25 minutes | Red | Problem — expo should investigate |
| 25+ minutes | Flashing Red + Audible | Emergency — food is extremely late |

### Timing Starts When
- **Station timer:** starts when item is FIRED to that station (not when the order was entered)
- **Table timer:** starts when the course is FIRED (tracks total wait from guest perspective)
- **Order timer:** starts when order is entered (total time from order to delivery)

### These Are Different and All Matter
- A steak might show 14 minutes on the grill station timer (from fire to bump — that's fine for a well-done steak)
- But the table timer might show 22 minutes (because the server waited 8 minutes before firing) — that's too long
- The order timer might show 25 minutes (because the server entered the order 3 minutes before firing course 2) — that's useful for speed-of-service reporting

### Configurable Thresholds
Different restaurants have different tolerances:
- Fine dining: 25 minutes for entrées is acceptable
- Casual dining: 18 minutes is the target, 25 is too long
- QSR: 5 minutes is the target, 8 is too long
- Bar food: 12 minutes is the target

System must allow per-restaurant, per-category, or per-item timing thresholds.

---

## Prep List Generation

### How It Should Work
1. **Reservation forecast:** tomorrow has 180 covers reserved (plus typical walk-in pattern = estimated 220 total covers)
2. **Historical data:** last 4 Saturdays averaged 215 covers with this sales mix:
   - 40% ordered an appetizer
   - 15% ordered soup
   - 25% ordered salad
   - 35% ordered steak
   - 20% ordered fish
   - 25% ordered pasta
   - 30% ordered dessert
3. **System calculates:** for 220 covers with historical mix:
   - Need ~35 portions of soup base
   - Need ~55 salad portions prepped
   - Need ~77 steaks broken down and portioned
   - Need ~44 fish portions prepped
   - Need ~66 desserts prepped (pastry section)
4. **Subtract current inventory:** already have 20 salad portions from lunch prep → need 35 more
5. **Generate prep list by station:**

```
PREP LIST — Saturday March 22
Generated: Friday 4:30 PM
Based on: 220 estimated covers

GRILL PREP:
- Ribeye (14oz): portion 30, current stock: 12, NEED: 18
- NY Strip (12oz): portion 20, current stock: 8, NEED: 12
- Filet (8oz): portion 15, current stock: 5, NEED: 10
- Burger patties (6oz): form 25, current stock: 10, NEED: 15
- Chicken breast: marinate 20, current stock: 0, NEED: 20

SAUTÉ PREP:
- Salmon portions: cut 22, current stock: 4, NEED: 18
- Pasta dough: make 8 lbs, current stock: 2 lbs, NEED: 6 lbs
- Risotto base: prep 3 hotel pans, current stock: 0, NEED: 3

COLD PREP:
- Salad mix: prep 55 portions, current: 20, NEED: 35
- Caesar dressing: make 2 quarts, current: 0.5 qt, NEED: 1.5 qt
- Vinaigrette: make 1 quart, current: 0.75 qt, NEED: 0.25 qt
...
```

### Prep List Features
- Printable and viewable on kitchen KDS
- Assignable: kitchen manager assigns prep tasks to specific cooks
- Checkoff: cooks mark tasks complete as they finish
- Adjustment: if reservation count changes, prep list updates
- Historical accuracy tracking: how accurate were our prep lists? Too much waste = over-prepping. Too many 86s = under-prepping.

---

## Kitchen Printer vs KDS: Decision Factors

### When to Use Kitchen Printers (Chit Printers)
- Small, simple operation (food truck, small bar, pizza shop)
- Kitchen staff resistant to technology
- Backup to KDS (always have a printer as fallback)
- Cost constraint (thermal printers are $200, KDS screens are $500-1000+)
- Environments where screens don't survive (extreme heat, grease, cramped quarters)
- Kitchens with no good mounting location for screens

### When to Use KDS
- Any restaurant doing 100+ covers/day
- Multi-station kitchens where timing coordination matters
- When you want speed-of-service data
- When you want all-day counts
- When coursing and fire timing are important
- When you want to reduce paper waste
- When you want real-time status updates to servers/expo

### Hybrid Approach (Most Common)
- KDS as primary for all stations
- Printer as backup (if KDS goes down, orders auto-print)
- Printer for specific use cases:
  - Bar chits (bartenders often prefer paper they can stick on the bar rail)
  - To-go labels (print label that goes ON the food container)
  - Runner chits (small ticket that runner carries to the table to verify delivery)

---

## Rush Management — Kitchen Communication

### The Problem
At 7:30 PM on Saturday, the kitchen has 22 tickets on the board. The grill cook has 14 steaks working. The sauté station has 8 pans going. The expo is getting backed up. The kitchen is "in the weeds."

### How the POS Helps

#### Kitchen Load Indicator
A live metric visible to management and host stand:
```
KITCHEN STATUS: ██████████████░░░░░ 72% CAPACITY
Average ticket time: 16 min (target: 12)
Tickets on board: 22
Items in progress: 47
Longest active ticket: Table 8 — 24 minutes ← ALERT
```

#### Threshold Actions (Configurable)
- **Green (0-60% capacity):** Normal operations
- **Yellow (60-80%):** Host stand sees "MODERATE WAIT — quote 45-60 min for walk-ins." Kiosk/online ordering shows "Longer than usual wait times."
- **Red (80-95%):** Host stops seating new walk-ins temporarily. Online ordering shows extended delivery times. Manager alerted.
- **Critical (95%+):** Kitchen manager can trigger "SLOW SEAT" — host seats one table at a time, spaced by X minutes. Or: "PAUSE NEW ORDERS" for online/delivery.

#### Communication Tools
1. **Station-to-Expo messaging:** Cook can tap a button: "Grill needs 3 more minutes on Table 8" — expo sees this and can manage runner/server expectations
2. **Expo-to-Server alerts:** "Table 8 food is delayed — please inform guests. ETA: 5 minutes." Server sees notification on iPad.
3. **"86 Imminent" alert:** "Only 3 portions of salmon left" — gives servers advance warning before formal 86
4. **"Kitchen Closed" function:** At the end of the night, kitchen manager marks kitchen as closed. Servers cannot send new food orders (drinks only). Affects the entire system.

#### Ticket Priority Management
- Normal tickets in standard queue
- **RUSH** tickets (server requested or manager assigned) jump to priority
- **VIP** tickets (auto-flagged from guest profile) highlighted
- **RE-FIRE** tickets (corrections) highest priority — these represent a guest already waiting, already unhappy
- **Allergy** tickets get special handling — cannot be rushed through (safety protocol)

Priority order on KDS: RE-FIRE → RUSH → VIP → Normal (within each category, sorted by time)

---

## Course Fire Timing

### The Choreography
For a 4-top at a fine dining restaurant:

**Timeline:**
```
0:00  — Guests seated
0:03  — Server greets, takes drink order
0:05  — Drinks fired to bar
0:08  — Drinks served. Server takes food order.
0:12  — Order entered. Course 1 (apps) AUTO-FIRED to kitchen.
0:13  — Kitchen begins apps.
0:20  — Apps plated, expo calls "Table 7 apps ready."
0:22  — Apps delivered to table.
0:30  — Server checks in. Guests are finishing apps.
0:35  — Server fires Course 2 (entrées) from iPad.
0:35  — Kitchen begins entrées.
0:37  — Busser clears app plates.
0:48  — Entrées plated.
0:50  — Entrées delivered.
1:05  — Server checks in. Guests finishing entrées.
1:08  — Server offers dessert. Guests order.
1:10  — Server fires Course 3 (desserts) from iPad.
1:10  — Dessert station begins.
1:17  — Desserts plated and delivered.
1:30  — Server presents check.
1:38  — Payment processed.
1:40  — Table cleared.
```

### What the POS Tracks
- Time between courses (should be 8-15 minutes depending on restaurant pace)
- Alert if course gap exceeds threshold: "Table 7 — 20 minutes since apps cleared, entrées not yet fired. Check with server."
- Alert if fired course is taking too long: "Table 7 entrées fired 18 minutes ago, still not at expo."
- Table dwell time: total time from seated to check paid

### Course Fire Timing Intelligence
The system can learn from historical data:
- "Average time between app clear and entrée fire for Server Jake: 12 minutes" (he's good)
- "Average time between app clear and entrée fire for Server New Hire: 22 minutes" (needs coaching)
- "Average grill time for Ribeye Medium Rare: 11 minutes" → when Server fires Course 2 and it includes a Ribeye MR, system knows food should be at expo in ~11 minutes
- Stagger awareness: if Table 7 and Table 8 both fire entrées at the same time, and both have grilled items, the grill station gets 6 steaks at once. System can warn expo: "Heavy grill load incoming — Tables 7 & 8 both fired. Consider stagger."

---

## Summary of Kitchen KDS Features Checklist

1. Station-based routing (configurable per menu item)
2. Multi-station item coordination
3. Course management (FIRE / HOLD / RUSH)
4. All-day counts per station
5. Ticket aging with color-coded timers
6. Configurable time thresholds
7. Expo screen with full-ticket view
8. Item completion tracking (bump per station, aggregate on expo)
9. Re-fire workflow with reason codes
10. Allergy alerts (prominent, cannot be dismissed)
11. VIP and special request flags
12. "Ready to run" notification to servers
13. Kitchen load/capacity indicator
14. Station-to-expo messaging
15. Prep list generation from forecast
16. Historical speed-of-service data
17. Printer fallback for KDS failure
18. "86 Imminent" and formal 86 alerts
19. Kitchen close function
20. Multi-brand support (ghost kitchen)
21. Ticket priority management
22. Seat/position awareness (plating order)
23. Order modification alerts (item changed after initial send)
24. Temperature/cook preference display
25. Audio alerts for new tickets, rush items, timing warnings

---

# APPENDIX A: System-Wide Technical Requirements

## Real-Time Sync
- Changes on any device must reflect on all other devices within 3 seconds under normal connectivity
- Supabase Realtime (WebSocket) for live subscription to order changes, table status, 86 updates, and kitchen status
- Optimistic UI: show the change locally immediately, sync in background

## Multi-Device Session Management
- Each employee has a unique PIN (4-6 digit, configurable)
- Session timeout: configurable (server might auto-lock after 5 minutes idle, cashier might never auto-lock)
- Device assignment: iPads can be "floating" (any employee logs in) or "fixed" (assigned to a station)
- Simultaneous session prevention: one employee cannot be logged into two devices (prevents order confusion)
- Quick-switch: in high-volume environments, a "fast user switch" where one employee can quickly switch to another without full logout/login (PIN swap)

## Hardware Integration Requirements
- Card readers: Valor PayTech terminals (VP800, VP550, VP300 Pro, RCKT for mobile/Bluetooth)
- Receipt printers: Bluetooth and Wi-Fi thermal printers (Star Micronics TSP100, Epson TM-T88 series)
- Kitchen printers: Ethernet thermal printers with autocutter
- Cash drawers: connected via printer (standard kick cable)
- KDS displays: any iPad or Android tablet, or dedicated KDS hardware
- Barcode scanners: Bluetooth (for inventory management, gift card scanning)
- Scales: Bluetooth or USB (for weight-based pricing)
- Customer-facing displays: secondary iPad or monitor for order confirmation

## Security
- PCI DSS compliance for card data (handled by payment processor SDK — never store full card numbers)
- End-to-end encryption for card transactions
- PIN security: hashed and salted, no plain text storage
- Audit trail: every action logged with user, timestamp, device, IP
- Role-based access control (defined in Deliverable 2)
- Data retention policies: configurable per jurisdiction
- GDPR / CCPA compliance for guest data

## Localization
- Multi-language UI support (English, Spanish minimum)
- Multi-currency support
- Tax calculation by jurisdiction (US state/county/city, international VAT)
- Tip regulations by jurisdiction (some states prohibit tip credit, some allow it)
- Receipt legal requirements by jurisdiction (some require specific verbiage)

---

# APPENDIX B: Integration Points

## Required Integrations
1. **Payment Processor** — Valor PayTech (Sear's exclusive integrated payment processor)
2. **Accounting** — QuickBooks, Xero (auto-export daily sales journal entries)
3. **Payroll** — ADP, Gusto, Paychex (export timecards, tip summaries)
4. **Reservation System** — OpenTable, Resy, direct booking (bidirectional sync)
5. **Delivery Platforms** — DoorDash, Uber Eats, Grubhub (receive orders, update status, sync menus)
6. **Inventory/Supply** — Sysco, US Foods ordering integration
7. **Loyalty Program** — built-in (Sear loyalty module)
8. **Gift Cards** — built-in gift card system with balance management
9. **Email/SMS** — for receipts, marketing, wait-list notifications
10. **Calendar** — for catering/event scheduling
11. **Reporting/BI** — export to Google Sheets, Excel, or BI tools

## Optional Integrations
12. **Security Cameras** — time-sync POS transactions with video footage
13. **Music/Atmosphere** — time-based playlist management
14. **Smart Kitchen Equipment** — IoT temperature probes, hood systems
15. **Digital Signage** — menu boards, order status displays
16. **Review Platforms** — Google, Yelp (post-visit review solicitation)
17. **CRM** — Salesforce, HubSpot (for larger operations)
18. **HR/Scheduling** — 7shifts, HotSchedules, Homebase

---

*This specification represents the operational reality of running restaurants across every service model. It was built from the perspective of the humans who use these systems under pressure — not from a software requirements document. Every feature described addresses a real problem that occurs in real restaurants, often multiple times per shift.*



---


# Part 5: System Architecture


# Restaurant POS System — Complete Architecture Specification

**Version:** 1.0
**Date:** 2026-03-20
**Status:** Design Phase

---

## Table of Contents

1. [Multi-Tenant Architecture](#1-multi-tenant-architecture)
2. [Hot-Swappable Module System](#2-hot-swappable-module-system)
3. [Database Schema Design](#3-database-schema-design)
4. [API Architecture](#4-api-architecture)
5. [Offline-First Architecture](#5-offline-first-architecture)
6. [Real-Time Communication](#6-real-time-communication)
7. [Infrastructure & Deployment](#7-infrastructure--deployment)
8. [Security Architecture](#8-security-architecture)
9. [Performance Requirements](#9-performance-requirements)
10. [Frontend Architecture](#10-frontend-architecture)

---

## 1. Multi-Tenant Architecture

### Recommendation: Shared-Schema with `org_id` (tenant_id)

Schema-per-tenant sounds clean on paper. In practice it becomes a migration nightmare at 200+ tenants. Every DDL change has to run against hundreds of schemas, connection pooling gets complicated, and Supabase's RLS is purpose-built for shared-schema isolation anyway.

**Decision: Shared schema, all tables carry `org_id`, enforced via RLS.**

For the rare case where a tenant truly needs data isolation (enterprise contract, regulatory requirement), we can spin up a dedicated Supabase project. That's a business decision, not an architecture one.

### Tenant Hierarchy

```
Organization (org)
  "Danny's Restaurant Group"
  ├── Location 1: "Danny's Downtown"
  │   ├── Terminal A (iPad - Host Stand)
  │   ├── Terminal B (iPad - Bar)
  │   └── Terminal C (iPad - Server Station)
  ├── Location 2: "Danny's Uptown"
  │   ├── Terminal A
  │   └── Terminal B
  └── Location 3: "Danny's Airport"
      └── Terminal A (Kiosk)
```

**Three-level hierarchy:**
- **Organization** — billing entity, owns the subscription, manages global settings (branding, default menu templates, consolidated reporting)
- **Location** — physical restaurant, has its own menu, staff, floor plan, hours, tax rates. This is the primary operational boundary.
- **Terminal** — a device (iPad) registered to a location. Has a role (server station, bar, host, kiosk, KDS).

### Why This Works for Multi-Location

A 45-location restaurant group operates at the org level for:
- Consolidated reporting across all locations
- Shared menu templates (push menu changes to all locations)
- Staff who float between locations
- Gift card balances that work across locations
- Centralized user/role management

But each location has full autonomy for:
- Local menu pricing/availability
- Local staff scheduling
- Local floor plan / table management
- Local tax configuration
- Local hours of operation

### RLS Policy Pattern

Every table with tenant data includes `org_id`. The JWT from Supabase Auth carries custom claims:

```json
{
  "sub": "user-uuid",
  "org_id": "org-uuid",
  "location_ids": ["loc-uuid-1", "loc-uuid-2"],
  "role": "manager",
  "permissions": ["orders.create", "orders.void", "reports.view"]
}
```

Base RLS policy (applied to every tenant-scoped table):

```sql
-- Read: user can see rows for their org
CREATE POLICY "tenant_isolation_select" ON orders
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- Write: user can insert only for their org
CREATE POLICY "tenant_isolation_insert" ON orders
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- Update: user can update only their org's rows
CREATE POLICY "tenant_isolation_update" ON orders
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- Delete: user can delete only their org's rows
CREATE POLICY "tenant_isolation_delete" ON orders
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
```

Location-scoped policies (for tables like orders, shifts):

```sql
CREATE POLICY "location_scoped_select" ON orders
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
    AND (
      -- Org-level users (owner/admin) see all locations
      (current_setting('request.jwt.claims', true)::json->>'role') IN ('owner', 'admin')
      OR
      -- Location-scoped users see only their assigned locations
      location_id = ANY(
        ARRAY(SELECT json_array_elements_text(
          current_setting('request.jwt.claims', true)::json->'location_ids'
        ))::uuid[]
      )
    )
  );
```

### Platform Admin Access (Our Internal Admin)

A separate `platform_admin` role bypasses tenant RLS entirely. Used only for support, debugging, and platform management. Heavily audited.

```sql
CREATE POLICY "platform_admin_bypass" ON orders
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::json->>'platform_role') = 'platform_admin'
  );
```

---

## 2. Hot-Swappable Module System

### Module Classification

**Core Modules (always active, cannot disable):**
| Module | Purpose |
|--------|---------|
| `core.pos` | Order entry, checkout, payments |
| `core.menu` | Menu categories, items, modifiers |
| `core.staff` | Users, roles, permissions, basic time tracking |
| `core.reports` | Daily sales, basic reporting |
| `core.settings` | Location config, tax rates, printers |

**Optional Modules:**
| Module ID | Name | Dependencies | Monthly Price |
|-----------|------|-------------|--------------|
| `mod.online_ordering` | Online Ordering | core.menu | $99 |
| `mod.kds` | Kitchen Display System | core.pos | $49/screen |
| `mod.inventory` | Inventory Management | core.menu | $79 |
| `mod.loyalty` | Loyalty & Rewards | core.pos | $69 |
| `mod.marketing` | Marketing & Campaigns | mod.loyalty | $49 |
| `mod.scheduling` | Staff Scheduling | core.staff | $59 |
| `mod.payroll` | Payroll Integration | core.staff, mod.scheduling | $39 |
| `mod.catering` | Catering Management | core.menu, mod.online_ordering | $49 |
| `mod.analytics` | Advanced Analytics | core.reports | $89 |
| `mod.gift_cards` | Gift Cards | core.pos | $29 |
| `mod.reservations` | Reservations & Waitlist | — | $59 |
| `mod.customer_display` | Customer-Facing Display | core.pos | $19/screen |
| `mod.kiosk` | Self-Service Kiosk | core.menu, core.pos | $79/kiosk |
| `mod.delivery` | Delivery Management | mod.online_ordering | $69 |
| `mod.tables` | Table Management & Floor Plan | — | $39 |

### Module Architecture

```
pos_system/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── extensions.py            # Flask extensions (db, cache, etc.)
│   ├── module_registry.py       # Module discovery and registration
│   │
│   ├── core/                    # Core modules (always loaded)
│   │   ├── pos/
│   │   │   ├── __init__.py      # Blueprint registration
│   │   │   ├── routes.py        # API endpoints
│   │   │   ├── models.py        # SQLAlchemy models (optional, we may use raw SQL)
│   │   │   ├── services.py      # Business logic
│   │   │   ├── templates/       # Jinja2 templates
│   │   │   │   ├── pos/
│   │   │   │   │   ├── order_entry.html
│   │   │   │   │   └── checkout.html
│   │   │   └── migrations/      # Module-specific migrations
│   │   │       ├── 001_create_orders.sql
│   │   │       └── 002_add_order_notes.sql
│   │   ├── menu/
│   │   ├── staff/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── modules/                 # Optional modules (loaded conditionally)
│   │   ├── kds/
│   │   │   ├── __init__.py      # Module manifest
│   │   │   ├── routes.py
│   │   │   ├── services.py
│   │   │   ├── hooks.py         # Event hooks this module listens to
│   │   │   ├── templates/
│   │   │   └── migrations/
│   │   ├── online_ordering/
│   │   ├── inventory/
│   │   ├── loyalty/
│   │   └── ...
│   │
│   ├── shared/                  # Shared utilities
│   │   ├── auth.py
│   │   ├── permissions.py
│   │   ├── events.py            # Event bus
│   │   ├── db.py                # Database helpers
│   │   └── module_hooks.py      # Hook point definitions
│   │
│   └── templates/               # Base templates
│       ├── base.html
│       ├── layouts/
│       └── components/
│
├── static/
│   ├── css/
│   ├── js/
│   └── modules/                 # Module-specific static assets
│       ├── kds/
│       └── inventory/
│
├── migrations/                  # Core schema migrations
│   ├── 001_initial.sql
│   └── ...
│
└── config.py
```

### Module Manifest (`__init__.py` for each module)

```python
from app.module_registry import ModuleManifest

manifest = ModuleManifest(
    id="mod.kds",
    name="Kitchen Display System",
    version="1.0.0",
    description="Real-time kitchen order display with bump-bar support",
    dependencies=["core.pos"],

    # Database migrations this module needs
    migrations_path="migrations/",

    # Flask blueprint for API routes
    blueprint_name="kds",
    url_prefix="/api/v1/kds",

    # Template directory for UI pages
    templates_path="templates/",

    # Event hooks this module subscribes to
    event_hooks={
        "order.created": "hooks.on_order_created",
        "order.updated": "hooks.on_order_updated",
        "order.item_fired": "hooks.on_item_fired",
        "menu.item_86d": "hooks.on_item_86d",
    },

    # Nav items this module adds to the UI
    nav_items=[
        {
            "label": "Kitchen Display",
            "icon": "kitchen",
            "url": "/kds",
            "position": "main_nav",
            "required_permission": "kds.view",
        }
    ],

    # Settings page sections
    settings_sections=[
        {
            "label": "KDS Configuration",
            "url": "/settings/kds",
            "required_permission": "kds.configure",
        }
    ],

    # Dashboard widgets
    dashboard_widgets=[
        {
            "id": "kds_avg_ticket_time",
            "label": "Avg Ticket Time",
            "component": "widgets/avg_ticket_time.html",
            "size": "small",
            "refresh_interval": 30,
        }
    ],

    # Permissions this module defines
    permissions=[
        "kds.view",
        "kds.bump",
        "kds.configure",
        "kds.recall",
    ],

    # Background tasks
    celery_tasks=[
        "tasks.calculate_ticket_times",
    ],
)
```

### Module Registry

```python
# app/module_registry.py

from dataclasses import dataclass, field
from typing import Callable
import importlib
import logging

logger = logging.getLogger(__name__)

@dataclass
class ModuleManifest:
    id: str
    name: str
    version: str
    description: str
    dependencies: list[str] = field(default_factory=list)
    migrations_path: str = ""
    blueprint_name: str = ""
    url_prefix: str = ""
    templates_path: str = ""
    event_hooks: dict[str, str] = field(default_factory=dict)
    nav_items: list[dict] = field(default_factory=list)
    settings_sections: list[dict] = field(default_factory=list)
    dashboard_widgets: list[dict] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    celery_tasks: list[str] = field(default_factory=list)


class ModuleRegistry:
    def __init__(self):
        self._manifests: dict[str, ModuleManifest] = {}
        self._loaded: dict[str, bool] = {}
        self._hooks: dict[str, list[Callable]] = {}

    def discover_modules(self) -> list[ModuleManifest]:
        """Scan the modules/ directory for valid module packages."""
        # Each module package must have a manifest in __init__.py
        ...

    def load_module_for_tenant(self, module_id: str, org_id: str, app) -> bool:
        """
        Register a module's blueprint, hooks, and nav items.
        Modules are loaded at app startup for all tenants that have them enabled.
        Tenant-level enable/disable is checked at request time, not load time.
        """
        if module_id in self._loaded:
            return True

        manifest = self._manifests.get(module_id)
        if not manifest:
            logger.error(f"Module {module_id} not found")
            return False

        # Check dependencies
        for dep in manifest.dependencies:
            if dep not in self._loaded and not dep.startswith("core."):
                logger.error(f"Module {module_id} requires {dep}")
                return False

        # Register Flask blueprint
        if manifest.blueprint_name:
            module_pkg = importlib.import_module(f"app.modules.{manifest.blueprint_name}")
            bp = getattr(module_pkg, "bp")
            app.register_blueprint(bp, url_prefix=manifest.url_prefix)

        # Register event hooks
        for event_name, handler_path in manifest.event_hooks.items():
            module_pkg = importlib.import_module(
                f"app.modules.{manifest.blueprint_name}.{handler_path.rsplit('.', 1)[0]}"
            )
            handler = getattr(module_pkg, handler_path.rsplit('.', 1)[1])
            self.register_hook(event_name, handler)

        self._loaded[module_id] = True
        return True

    def register_hook(self, event_name: str, handler: Callable):
        if event_name not in self._hooks:
            self._hooks[event_name] = []
        self._hooks[event_name].append(handler)

    async def emit_event(self, event_name: str, payload: dict):
        """Fire all registered hooks for an event."""
        handlers = self._hooks.get(event_name, [])
        for handler in handlers:
            try:
                await handler(payload)
            except Exception as e:
                logger.error(f"Hook error in {handler.__module__}: {e}")

    def get_nav_items_for_tenant(self, org_id: str) -> list[dict]:
        """Return nav items only for modules enabled for this tenant."""
        items = []
        enabled = self._get_enabled_modules(org_id)
        for module_id in enabled:
            manifest = self._manifests.get(module_id)
            if manifest:
                items.extend(manifest.nav_items)
        return items

    def _get_enabled_modules(self, org_id: str) -> list[str]:
        """Query the org_modules table to see which modules are active."""
        # SELECT module_id FROM org_modules
        # WHERE org_id = :org_id AND is_enabled = true
        ...


# Singleton
registry = ModuleRegistry()
```

### Tenant-Level Module Enable/Disable

All modules are loaded into the Flask app at startup (blueprints registered, routes available). The tenant-level gate happens via a **middleware decorator**:

```python
# app/shared/module_guard.py

from functools import wraps
from flask import g, abort

def require_module(module_id: str):
    """Decorator for routes that require a specific module."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # g.tenant is set by auth middleware
            if not g.tenant.has_module(module_id):
                abort(403, description=f"Module '{module_id}' is not enabled")
            return f(*args, **kwargs)
        return wrapped
    return decorator

# Usage in a module's routes:
@bp.route("/stations", methods=["GET"])
@require_auth
@require_module("mod.kds")
def list_stations():
    ...
```

### Module Database Migrations

Each module owns its own migration files. A migration runner tracks what's been applied per-org:

```sql
-- Core table tracking module migrations
CREATE TABLE module_migrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    module_id text NOT NULL,
    migration_name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, module_id, migration_name)
);
```

When a module is enabled for a tenant, we run any pending migrations for that module. Module tables always include `org_id` and follow the same RLS pattern.

### Module Dependency Resolution

```python
def resolve_dependencies(module_id: str) -> list[str]:
    """Topological sort of module dependencies."""
    visited = set()
    order = []

    def visit(mid: str):
        if mid in visited:
            return
        visited.add(mid)
        manifest = registry._manifests.get(mid)
        if manifest:
            for dep in manifest.dependencies:
                visit(dep)
        order.append(mid)

    visit(module_id)
    return order
```

When enabling `mod.marketing` (depends on `mod.loyalty`), the system auto-enables `mod.loyalty` first. When disabling `mod.loyalty`, it checks if any active modules depend on it and blocks the disable or cascades.

### Event Bus (Module Communication)

Modules communicate through events, never by importing each other directly.

```
Core POS creates order
  → emits "order.created"
    → KDS module receives → displays on kitchen screen
    → Loyalty module receives → awards points
    → Inventory module receives → decrements stock
    → Analytics module receives → updates real-time dashboard
```

```python
# app/shared/events.py

class EventBus:
    """In-process event bus. For cross-process events, use Supabase Realtime / Redis pub/sub."""

    _handlers: dict[str, list[Callable]] = {}

    @classmethod
    def subscribe(cls, event: str, handler: Callable):
        cls._handlers.setdefault(event, []).append(handler)

    @classmethod
    def emit(cls, event: str, payload: dict):
        for handler in cls._handlers.get(event, []):
            try:
                handler(payload)
            except Exception as e:
                logger.error(f"Event handler error: {event} -> {handler}: {e}")

    @classmethod
    def emit_async(cls, event: str, payload: dict):
        """Queue event for background processing via Celery."""
        from app.tasks import process_event
        process_event.delay(event, payload)
```

---

## 3. Database Schema Design

### Design Principles

- **All IDs are UUIDv7** (time-sortable, no sequential leak). Generated in the application layer using `uuid7()`.
- **All timestamps are `timestamptz`**, stored in UTC. Display timezone comes from `locations.timezone`.
- **Soft deletes** on reference data (menu items, staff, customers). Column: `deleted_at timestamptz`. Hard deletes on transactional data older than retention period.
- **`org_id`** on every tenant-scoped table. Indexed. RLS enforced.
- **JSONB** for flexible/extensible data: modifier configs, receipt metadata, integration-specific payloads.
- **Enum types** for state machines via PostgreSQL `CREATE TYPE`.
- **Created/updated tracking**: `created_at`, `updated_at`, `created_by`, `updated_by` on every table.

### Enum Types

```sql
-- Order lifecycle
CREATE TYPE order_status AS ENUM (
    'draft',          -- Being built on terminal, not yet sent
    'open',           -- Sent to kitchen/bar, actively being worked
    'fired',          -- Kitchen has started preparing
    'ready',          -- Ready for pickup/serve
    'served',         -- Delivered to guest
    'closed',         -- Fully paid and complete
    'voided',         -- Cancelled entirely
    'refunded'        -- Closed then refunded
);

-- Order type
CREATE TYPE order_type AS ENUM (
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
    'pending',        -- Payment initiated
    'authorized',     -- Card authorized, not yet captured
    'captured',       -- Card charged
    'settled',        -- Funds transferred (end of day batch)
    'declined',       -- Card declined
    'voided',         -- Authorization voided before capture
    'refunded',       -- Partial or full refund
    'failed'          -- Processing error
);

CREATE TYPE payment_method AS ENUM (
    'cash', 'credit_card', 'debit_card', 'gift_card', 'house_account',
    'apple_pay', 'google_pay', 'external'  -- external = third-party app
);

-- Staff role levels
CREATE TYPE user_role AS ENUM (
    'platform_admin',  -- Our internal admin
    'owner',           -- Restaurant owner
    'admin',           -- Restaurant admin/GM
    'manager',         -- Shift manager
    'server',          -- Front of house
    'bartender',       -- Bar
    'host',            -- Host/hostess
    'kitchen',         -- Back of house
    'cashier',         -- Cashier-only access
    'kiosk',           -- Kiosk device account
    'readonly'         -- View-only (accountant, etc.)
);

CREATE TYPE terminal_type AS ENUM (
    'server_station', 'bar', 'host', 'cashier', 'kds', 'kiosk', 'customer_display'
);

CREATE TYPE discount_type AS ENUM (
    'percentage', 'fixed_amount', 'bogo', 'free_item'
);

CREATE TYPE comp_reason AS ENUM (
    'manager_comp', 'quality_issue', 'service_issue', 'birthday',
    'vip', 'employee_meal', 'promotional', 'other'
);

CREATE TYPE void_reason AS ENUM (
    'customer_request', 'kitchen_error', 'server_error', 'wrong_item',
    'quality_issue', '86d', 'duplicate', 'other'
);

CREATE TYPE cash_drawer_event_type AS ENUM (
    'open_shift', 'close_shift', 'cash_sale', 'cash_refund',
    'paid_in', 'paid_out', 'tip_payout', 'no_sale', 'count'
);
```

### Core Tables

```sql
-- ============================================================
-- ORGANIZATIONS & LOCATIONS
-- ============================================================

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,           -- URL-friendly identifier

    -- Subscription/billing
    plan text NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
    subscription_status text NOT NULL DEFAULT 'trialing',
    trial_ends_at timestamptz,

    -- Branding
    logo_url text,
    primary_color text DEFAULT '#1a1a2e',

    -- Contact
    owner_name text,
    owner_email text,
    owner_phone text,

    -- Settings (org-wide defaults)
    settings jsonb NOT NULL DEFAULT '{}',
    -- settings contains: default_currency, default_timezone,
    -- receipt_header, receipt_footer, tip_percentages, etc.

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Downtown Location"
    slug text NOT NULL,                  -- "downtown"

    -- Address
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'US',
    latitude numeric(10, 7),
    longitude numeric(10, 7),

    -- Contact
    phone text,
    email text,

    -- Operations
    timezone text NOT NULL DEFAULT 'America/New_York',
    currency text NOT NULL DEFAULT 'USD',

    -- Business hours: JSONB array
    -- [{"day": "monday", "open": "11:00", "close": "22:00"}, ...]
    business_hours jsonb NOT NULL DEFAULT '[]',

    -- Location-specific settings (overrides org defaults)
    settings jsonb NOT NULL DEFAULT '{}',
    -- settings contains: auto_gratuity_pct, auto_gratuity_party_size,
    -- default_tax_rate_id, receipt_printer_ip, kitchen_printer_ip,
    -- order_number_prefix, require_table_for_dine_in, etc.

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    UNIQUE(org_id, slug)
);

CREATE INDEX idx_locations_org ON locations(org_id);

CREATE TABLE terminals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Bar iPad 1"
    terminal_type terminal_type NOT NULL,
    device_id text,                      -- Browser fingerprint or assigned ID

    -- Current state
    is_online boolean NOT NULL DEFAULT false,
    last_heartbeat_at timestamptz,
    current_user_id uuid REFERENCES users(id),

    settings jsonb NOT NULL DEFAULT '{}',
    -- settings: assigned_sections, default_order_type, printer_ip, etc.

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_terminals_location ON terminals(location_id);

-- ============================================================
-- MODULE MANAGEMENT
-- ============================================================

CREATE TABLE org_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    module_id text NOT NULL,             -- 'mod.kds', 'mod.inventory', etc.
    is_enabled boolean NOT NULL DEFAULT true,
    enabled_at timestamptz NOT NULL DEFAULT now(),
    disabled_at timestamptz,

    -- Module-specific configuration
    config jsonb NOT NULL DEFAULT '{}',

    -- Which locations have this module (null = all locations)
    location_ids uuid[] DEFAULT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(org_id, module_id)
);

CREATE INDEX idx_org_modules_org ON org_modules(org_id);

-- ============================================================
-- USERS & PERMISSIONS
-- ============================================================

CREATE TABLE users (
    id uuid PRIMARY KEY,                 -- Matches Supabase Auth user ID
    org_id uuid NOT NULL REFERENCES organizations(id),

    -- Profile
    email text,
    phone text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    display_name text,                   -- What shows on receipts/orders
    avatar_url text,

    -- POS-specific
    pin_hash text,                       -- 4-6 digit PIN for quick clock-in / POS login
    role user_role NOT NULL DEFAULT 'server',

    -- Which locations this user can access
    location_ids uuid[] NOT NULL DEFAULT '{}',

    -- Employment
    hire_date date,
    hourly_rate numeric(8, 2),
    is_active boolean NOT NULL DEFAULT true,

    settings jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_pin ON users(org_id, pin_hash) WHERE pin_hash IS NOT NULL;

-- Granular permissions beyond role-based defaults
CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,           -- 'orders.void', 'reports.payroll', 'menu.edit'
    module_id text NOT NULL,             -- Which module defines this permission
    description text,
    category text                        -- Grouping for settings UI
);

CREATE TABLE role_permissions (
    role user_role NOT NULL,
    permission_id uuid NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role, permission_id)
);

-- Per-user permission overrides (grant/deny beyond role defaults)
CREATE TABLE user_permission_overrides (
    user_id uuid NOT NULL REFERENCES users(id),
    permission_id uuid NOT NULL REFERENCES permissions(id),
    granted boolean NOT NULL,            -- true = explicitly grant, false = explicitly deny
    PRIMARY KEY (user_id, permission_id)
);

-- ============================================================
-- MENU MANAGEMENT
-- ============================================================

CREATE TABLE menu_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),  -- NULL = org-wide template

    name text NOT NULL,
    description text,
    sort_order int NOT NULL DEFAULT 0,

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    available_start_time time,           -- Category only shows during these hours
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday

    -- Display
    color text,                          -- Hex color for POS button
    image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_menu_categories_org ON menu_categories(org_id);
CREATE INDEX idx_menu_categories_location ON menu_categories(location_id);

CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    category_id uuid NOT NULL REFERENCES menu_categories(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide

    name text NOT NULL,
    short_name text,                     -- Abbreviated for kitchen tickets
    description text,

    -- Pricing
    price numeric(10, 2) NOT NULL,
    cost numeric(10, 2),                 -- Food cost for margin tracking

    -- Tax
    tax_rate_id uuid REFERENCES tax_rates(id),
    is_taxable boolean NOT NULL DEFAULT true,

    -- Prep
    prep_station text,                   -- 'grill', 'fryer', 'cold', 'bar', 'expo'
    prep_time_minutes int,
    course text,                         -- 'appetizer', 'entree', 'dessert', 'drink'

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    is_86d boolean NOT NULL DEFAULT false,       -- Temporarily unavailable
    available_start_time time,
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}',

    -- Display
    color text,
    image_url text,
    sort_order int NOT NULL DEFAULT 0,

    -- Modifiers
    -- (linked via menu_item_modifier_groups join table)

    -- Nutrition/allergens (optional, for online ordering)
    nutrition jsonb,
    allergens text[],                    -- ['gluten', 'dairy', 'nuts', ...]

    -- PLU / barcode
    plu_code text,
    barcode text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_menu_items_org ON menu_items(org_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_location ON menu_items(location_id);
CREATE INDEX idx_menu_items_plu ON menu_items(org_id, plu_code) WHERE plu_code IS NOT NULL;

CREATE TABLE modifier_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Temperature", "Sides", "Add-ons"

    -- Selection rules
    min_selections int NOT NULL DEFAULT 0,  -- 0 = optional
    max_selections int NOT NULL DEFAULT 1,  -- 1 = pick one, >1 = pick many

    -- If true, server must actively choose (even if 0 min_selections)
    is_required_prompt boolean NOT NULL DEFAULT false,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_modifier_groups_org ON modifier_groups(org_id);

CREATE TABLE modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),

    name text NOT NULL,
    short_name text,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0, -- Additional cost

    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_modifiers_group ON modifiers(modifier_group_id);

-- Join table: which modifier groups apply to which menu items
CREATE TABLE menu_item_modifier_groups (
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),
    sort_order int NOT NULL DEFAULT 0,
    PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- ============================================================
-- TAX CONFIGURATION
-- ============================================================

CREATE TABLE tax_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide default

    name text NOT NULL,                  -- "State Sales Tax", "City Tax", "Alcohol Tax"
    rate numeric(6, 4) NOT NULL,         -- 0.0825 = 8.25%
    is_inclusive boolean NOT NULL DEFAULT false, -- VAT-style (price includes tax)
    is_default boolean NOT NULL DEFAULT false,

    -- Applicability
    applies_to text[] DEFAULT '{}',      -- Empty = all items; ['alcohol', 'food', 'merchandise']

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rates_org ON tax_rates(org_id);
CREATE INDEX idx_tax_rates_location ON tax_rates(location_id);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    -- Order identification
    order_number int NOT NULL,           -- Sequential per-location, per-day
    display_number text NOT NULL,        -- "A-042" (prefix + number, shown to customer)

    -- Type and status
    order_type order_type NOT NULL DEFAULT 'dine_in',
    status order_status NOT NULL DEFAULT 'draft',

    -- Assignments
    server_id uuid REFERENCES users(id),
    table_id uuid REFERENCES tables(id),
    customer_id uuid REFERENCES customers(id),

    -- Guest info (for dine-in without customer record)
    guest_count int,
    guest_name text,                     -- For takeout / delivery
    guest_phone text,

    -- Financials (denormalized for fast reads -- authoritative values come from line items)
    subtotal numeric(10, 2) NOT NULL DEFAULT 0,
    discount_total numeric(10, 2) NOT NULL DEFAULT 0,
    tax_total numeric(10, 2) NOT NULL DEFAULT 0,
    tip_total numeric(10, 2) NOT NULL DEFAULT 0,
    total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Payment state
    amount_paid numeric(10, 2) NOT NULL DEFAULT 0,
    balance_due numeric(10, 2) NOT NULL DEFAULT 0,

    -- Timing
    opened_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,                 -- When first sent to kitchen
    closed_at timestamptz,

    -- Delivery/takeout
    scheduled_for timestamptz,           -- Scheduled pickup/delivery time
    delivery_address jsonb,              -- {line1, line2, city, state, zip}

    -- Coursing
    fire_course_2_at timestamptz,        -- When to fire entrees (manual or auto)

    -- Notes
    notes text,                          -- Internal notes for kitchen/staff

    -- Metadata
    source text DEFAULT 'pos',           -- 'pos', 'online', 'kiosk', 'phone', 'catering'
    metadata jsonb NOT NULL DEFAULT '{}',
    -- metadata: { online_order_id, delivery_partner, catering_event_id, etc. }

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id),
    updated_by uuid REFERENCES users(id)
);

CREATE INDEX idx_orders_org ON orders(org_id);
CREATE INDEX idx_orders_location ON orders(location_id);
CREATE INDEX idx_orders_status ON orders(location_id, status);
CREATE INDEX idx_orders_server ON orders(server_id);
CREATE INDEX idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_opened ON orders(location_id, opened_at);
CREATE INDEX idx_orders_number ON orders(location_id, order_number);

-- Order number sequence per location (reset daily via application logic)
-- We use a helper function rather than a sequence to handle daily resets:
CREATE OR REPLACE FUNCTION next_order_number(p_location_id uuid)
RETURNS int AS $$
DECLARE
    v_next int;
BEGIN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
    FROM orders
    WHERE location_id = p_location_id
      AND opened_at::date = CURRENT_DATE;
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    menu_item_id uuid REFERENCES menu_items(id),  -- NULL for open/custom items

    -- Snapshot of item at time of order (menu can change, order record shouldn't)
    name text NOT NULL,
    short_name text,

    quantity int NOT NULL DEFAULT 1,
    unit_price numeric(10, 2) NOT NULL,

    -- Modifiers affect the price
    modifier_total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Line total = (unit_price + modifier_total) * quantity - discount
    discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
    line_total numeric(10, 2) NOT NULL,

    -- Kitchen routing
    prep_station text,
    course int DEFAULT 1,                -- 1 = first course, 2 = entree, etc.
    seat_number int,                     -- Which seat at the table

    -- Status
    is_sent boolean NOT NULL DEFAULT false,   -- Has been sent to kitchen
    is_fired boolean NOT NULL DEFAULT false,  -- Kitchen has started making it
    is_ready boolean NOT NULL DEFAULT false,  -- Ready to serve
    is_served boolean NOT NULL DEFAULT false,
    is_voided boolean NOT NULL DEFAULT false,
    void_reason void_reason,
    voided_by uuid REFERENCES users(id),
    voided_at timestamptz,

    -- Comps
    is_comped boolean NOT NULL DEFAULT false,
    comp_reason comp_reason,
    comp_amount numeric(10, 2),
    comped_by uuid REFERENCES users(id),

    notes text,                          -- "No onions", "Extra sauce", etc.

    sent_at timestamptz,
    fired_at timestamptz,
    ready_at timestamptz,
    served_at timestamptz,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_org ON order_items(org_id);
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX idx_order_items_status ON order_items(order_id, is_sent, is_voided);

CREATE TABLE order_item_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,

    modifier_id uuid REFERENCES modifiers(id),   -- NULL for custom modifiers
    modifier_group_id uuid REFERENCES modifier_groups(id),

    -- Snapshot
    name text NOT NULL,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0,
    quantity int NOT NULL DEFAULT 1,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);

-- Track modifications to orders after they've been sent
CREATE TABLE order_modifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),

    modification_type text NOT NULL,     -- 'add_item', 'remove_item', 'modify_item',
                                         -- 'change_quantity', 'void_item', 'comp_item',
                                         -- 'change_table', 'change_server', 'apply_discount'

    description text NOT NULL,           -- Human-readable: "Voided 1x Burger (wrong item)"

    -- Before/after state for the modified field
    previous_value jsonb,
    new_value jsonb,

    performed_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),  -- Manager approval if required

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_mods_order ON order_modifications(order_id);
CREATE INDEX idx_order_mods_org ON order_modifications(org_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    -- Payment details
    payment_method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',

    amount numeric(10, 2) NOT NULL,       -- Amount applied to this order
    tip_amount numeric(10, 2) NOT NULL DEFAULT 0,
    total_amount numeric(10, 2) NOT NULL, -- amount + tip

    -- Card payments
    processor_transaction_id text,        -- From payment processor
    card_brand text,                      -- 'visa', 'mastercard', 'amex'
    card_last_four text,                  -- '4242'
    auth_code text,

    -- Gift card payments
    gift_card_id uuid REFERENCES gift_cards(id),

    -- Cash payments
    cash_tendered numeric(10, 2),
    change_due numeric(10, 2),

    -- Split payment tracking
    split_index int,                     -- 1, 2, 3... for split payments

    -- Refund tracking
    refund_amount numeric(10, 2),
    refund_reason text,
    refunded_by uuid REFERENCES users(id),
    refunded_at timestamptz,
    original_payment_id uuid REFERENCES payments(id), -- For refund records

    processed_by uuid NOT NULL REFERENCES users(id),
    processed_at timestamptz NOT NULL DEFAULT now(),

    -- Processor response data
    processor_response jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_org ON payments(org_id);
CREATE INDEX idx_payments_processor_txn ON payments(processor_transaction_id)
    WHERE processor_transaction_id IS NOT NULL;

-- Tip adjustments (post-close tip changes, common with card tips)
CREATE TABLE tip_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    payment_id uuid NOT NULL REFERENCES payments(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    server_id uuid NOT NULL REFERENCES users(id),

    original_tip numeric(10, 2) NOT NULL,
    adjusted_tip numeric(10, 2) NOT NULL,
    reason text,

    adjusted_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DISCOUNTS
-- ============================================================

CREATE TABLE discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Happy Hour", "Employee 50%", "Senior 10%"
    discount_type discount_type NOT NULL,

    -- Value
    percentage numeric(5, 2),            -- For percentage type
    fixed_amount numeric(10, 2),         -- For fixed_amount type

    -- Applicability
    applies_to text NOT NULL DEFAULT 'order', -- 'order', 'item', 'category'
    category_ids uuid[],                 -- If applies_to = 'category'
    item_ids uuid[],                     -- If applies_to specific items

    -- Rules
    requires_manager_approval boolean NOT NULL DEFAULT false,
    max_discount_amount numeric(10, 2),  -- Cap for percentage discounts
    min_order_amount numeric(10, 2),     -- Minimum order to apply

    -- Scheduling
    is_active boolean NOT NULL DEFAULT true,
    start_date date,
    end_date date,
    available_days int[],
    available_start_time time,
    available_end_time time,

    -- Tracking
    promo_code text,                     -- Optional promo code

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_discounts_org ON discounts(org_id);

CREATE TABLE order_discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id),
    discount_id uuid REFERENCES discounts(id),   -- NULL for custom/manual discounts
    order_item_id uuid REFERENCES order_items(id), -- NULL if order-level discount

    name text NOT NULL,
    discount_type discount_type NOT NULL,
    value numeric(10, 2) NOT NULL,       -- The percentage or fixed amount
    applied_amount numeric(10, 2) NOT NULL, -- Actual dollar amount removed

    applied_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLES & FLOOR PLAN
-- ============================================================

CREATE TABLE floor_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Main Dining", "Patio", "Bar Area"
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,

    -- Canvas dimensions for the visual editor
    canvas_width int NOT NULL DEFAULT 1200,
    canvas_height int NOT NULL DEFAULT 800,
    background_image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    floor_plan_id uuid NOT NULL REFERENCES floor_plans(id),

    name text NOT NULL,                  -- "T1", "B3", "P12"
    capacity int NOT NULL DEFAULT 4,
    shape text NOT NULL DEFAULT 'rectangle', -- 'rectangle', 'circle', 'square'

    -- Position on floor plan canvas
    pos_x int NOT NULL DEFAULT 0,
    pos_y int NOT NULL DEFAULT 0,
    width int NOT NULL DEFAULT 80,
    height int NOT NULL DEFAULT 80,
    rotation int NOT NULL DEFAULT 0,     -- Degrees

    -- Current state (denormalized for fast floor plan rendering)
    status text NOT NULL DEFAULT 'available',
    -- 'available', 'seated', 'ordered', 'served', 'check_presented', 'dirty'
    current_order_id uuid,
    current_server_id uuid REFERENCES users(id),
    seated_at timestamptz,

    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    -- Section assignment (for server sections)
    section text,                        -- "A", "B", "Patio", "Bar"

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_location ON tables(location_id);
CREATE INDEX idx_tables_floor_plan ON tables(floor_plan_id);
CREATE INDEX idx_tables_status ON tables(location_id, status);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    first_name text,
    last_name text,
    email text,
    phone text,

    -- Preferences
    notes text,                          -- "Allergic to shellfish", "Prefers booth"
    tags text[],                         -- ['vip', 'regular', 'food-allergy']

    -- Stats (denormalized, updated async)
    total_visits int NOT NULL DEFAULT 0,
    total_spent numeric(12, 2) NOT NULL DEFAULT 0,
    average_check numeric(10, 2) NOT NULL DEFAULT 0,
    last_visit_at timestamptz,

    -- Marketing
    marketing_opt_in boolean NOT NULL DEFAULT false,
    birthday date,
    anniversary date,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_customers_phone ON customers(org_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_email ON customers(org_id, email) WHERE email IS NOT NULL;

CREATE TABLE customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id),

    label text DEFAULT 'home',           -- 'home', 'work', 'other'
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,

    is_default boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STAFF / TIME TRACKING
-- ============================================================

CREATE TABLE shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    -- Shift definition
    name text,                           -- "Lunch", "Dinner", "All Day"
    shift_date date NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz,                -- NULL = still open

    -- Manager on duty
    manager_id uuid REFERENCES users(id),

    -- Summary (populated on close)
    total_sales numeric(12, 2),
    total_labor_cost numeric(10, 2),
    total_comps numeric(10, 2),
    total_voids numeric(10, 2),

    is_closed boolean NOT NULL DEFAULT false,
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_location_date ON shifts(location_id, shift_date);

CREATE TABLE time_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    user_id uuid NOT NULL REFERENCES users(id),
    shift_id uuid REFERENCES shifts(id),

    clock_in timestamptz NOT NULL,
    clock_out timestamptz,

    role_during_shift user_role,         -- Role worked (might differ from primary role)
    hourly_rate numeric(8, 2),           -- Rate during this shift

    -- Calculated
    regular_hours numeric(5, 2),
    overtime_hours numeric(5, 2),
    total_pay numeric(10, 2),

    -- Tips
    cash_tips numeric(10, 2) NOT NULL DEFAULT 0,
    credit_tips numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_given numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_received numeric(10, 2) NOT NULL DEFAULT 0,

    notes text,

    -- Approval
    is_approved boolean NOT NULL DEFAULT false,
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_location_date ON time_entries(location_id, clock_in);

CREATE TABLE break_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id uuid NOT NULL REFERENCES time_entries(id),

    break_type text NOT NULL DEFAULT 'unpaid', -- 'paid', 'unpaid'
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    duration_minutes int,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CASH DRAWER
-- ============================================================

CREATE TABLE cash_drawers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    name text NOT NULL DEFAULT 'Main Drawer',

    -- Current state
    is_open boolean NOT NULL DEFAULT false,
    opened_by uuid REFERENCES users(id),
    opened_at timestamptz,

    starting_cash numeric(10, 2),
    current_cash numeric(10, 2),

    -- Close-out
    expected_cash numeric(10, 2),
    actual_cash numeric(10, 2),
    over_short numeric(10, 2),
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cash_drawer_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_drawer_id uuid NOT NULL REFERENCES cash_drawers(id),

    event_type cash_drawer_event_type NOT NULL,
    amount numeric(10, 2) NOT NULL,
    running_total numeric(10, 2) NOT NULL,

    -- Context
    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),
    description text,

    performed_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_events_drawer ON cash_drawer_events(cash_drawer_id);

-- ============================================================
-- GIFT CARDS
-- ============================================================

CREATE TABLE gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    card_number text NOT NULL,           -- Unique card number (masked in API responses)
    card_number_hash text NOT NULL,      -- For lookups
    pin_hash text,                       -- Optional PIN

    initial_balance numeric(10, 2) NOT NULL,
    current_balance numeric(10, 2) NOT NULL,

    -- Purchaser
    purchased_by_customer_id uuid REFERENCES customers(id),
    purchased_at timestamptz NOT NULL DEFAULT now(),
    purchase_order_id uuid REFERENCES orders(id),

    -- Recipient
    recipient_name text,
    recipient_email text,
    recipient_phone text,
    message text,

    -- Status
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_cards_org ON gift_cards(org_id);
CREATE INDEX idx_gift_cards_number ON gift_cards(card_number_hash);

CREATE TABLE gift_card_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id uuid NOT NULL REFERENCES gift_cards(id),

    transaction_type text NOT NULL,      -- 'purchase', 'reload', 'redeem', 'refund', 'adjustment'
    amount numeric(10, 2) NOT NULL,      -- Positive for loads, negative for redemptions
    balance_after numeric(10, 2) NOT NULL,

    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),

    performed_by uuid REFERENCES users(id),
    notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),

    -- Who
    user_id uuid REFERENCES users(id),
    user_name text,                      -- Denormalized for readability
    user_role user_role,

    -- What
    action text NOT NULL,                -- 'order.void', 'menu.price_change', 'user.login', etc.
    entity_type text NOT NULL,           -- 'order', 'payment', 'menu_item', 'user'
    entity_id uuid,

    -- Details
    description text NOT NULL,
    previous_state jsonb,                -- Before the change
    new_state jsonb,                     -- After the change

    -- Context
    ip_address inet,
    user_agent text,
    terminal_id uuid,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Partitioned by month for performance (audit logs grow fast)
-- In practice, use Supabase's table partitioning or archive old entries
CREATE INDEX idx_audit_org_date ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### Order State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │ ← Order being built on iPad
                    │  (unsent)   │
                    └──────┬──────┘
                           │ Server taps "Send"
                           ▼
                    ┌─────────────┐
                    │    OPEN     │ ← Sent to kitchen, items routing to stations
                    │  (in queue) │
                    └──────┬──────┘
                           │ Kitchen starts cooking
                           ▼
                    ┌─────────────┐
                    │   FIRED     │ ← Actively being prepared
                    │ (cooking)   │    (per-item fire is tracked on order_items)
                    └──────┬──────┘
                           │ Kitchen bumps "Ready"
                           ▼
                    ┌─────────────┐
                    │   READY     │ ← Food in window / ready for pickup
                    └──────┬──────┘
                           │ Server picks up food
                           ▼
                    ┌─────────────┐
                    │   SERVED    │ ← Food delivered to table
                    └──────┬──────┘
                           │ Payment completed
                           ▼
                    ┌─────────────┐
                    │   CLOSED    │ ← Fully paid, done
                    └─────────────┘

    At any point before CLOSED:
    ┌─────────────┐
    │   VOIDED    │ ← Manager voided entire order
    └─────────────┘

    After CLOSED:
    ┌─────────────┐
    │  REFUNDED   │ ← Full or partial refund processed
    └─────────────┘
```

**Item-level status tracking:** Individual items on the order have their own flags (`is_sent`, `is_fired`, `is_ready`, `is_served`, `is_voided`). The order-level status is a rollup. An order is "fired" when the first item fires. An order is "ready" when all non-voided items are ready.

**Adding items after send:** When a server adds items to an already-sent order, the new items have `is_sent = false`. The server can continue adding and then hit "Send" again, which sends only the unsent items to the kitchen. An `order_modifications` record is created.

### Payment State Machine

```
    ┌───────────┐
    │  PENDING   │ ← Payment initiated
    └─────┬─────┘
          │
    ┌─────┴──────┐
    │             │
    ▼             ▼
┌────────┐  ┌──────────┐
│DECLINED│  │AUTHORIZED│ ← Card approved, hold placed
└────────┘  └────┬─────┘
                 │
           ┌─────┴──────┐
           │             │
           ▼             ▼
      ┌────────┐   ┌────────┐
      │ VOIDED │   │CAPTURED│ ← Charge submitted
      └────────┘   └───┬────┘
      (before           │
       capture)         ▼
                   ┌────────┐
                   │SETTLED │ ← Funds received (batch)
                   └───┬────┘
                       │
                       ▼
                   ┌────────┐
                   │REFUNDED│ ← Partial or full refund
                   └────────┘
```

**Cash flow:** For cash payments, the flow is `pending → captured → settled` immediately (no auth step).

**Split payments:** An order can have multiple payment records. `balance_due` on the order is recalculated after each payment. Order closes when `balance_due = 0`.

### Module-Specific Tables

**mod.kds (Kitchen Display System):**
```sql
CREATE TABLE kds_stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,                  -- "Grill", "Fryer", "Cold", "Bar", "Expo"
    station_type text NOT NULL,          -- 'prep', 'expo'
    prep_stations text[],               -- Which prep_station values route here
    terminal_id uuid,                    -- Assigned display device
    display_settings jsonb DEFAULT '{}', -- font_size, columns, sound, color_coding
    sort_order int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE kds_ticket_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    station_id uuid NOT NULL REFERENCES kds_stations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),
    event_type text NOT NULL,            -- 'received', 'started', 'bumped', 'recalled', 'all_day_updated'
    performed_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);
```

**mod.inventory:**
```sql
CREATE TABLE inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    category text,
    unit_of_measure text NOT NULL,       -- 'oz', 'lb', 'each', 'case', 'gal'
    par_level numeric(10, 3),
    reorder_point numeric(10, 3),
    current_quantity numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4),
    vendor_id uuid REFERENCES vendors(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    transaction_type text NOT NULL,      -- 'receive', 'waste', 'transfer', 'count', 'sale_deduction'
    quantity_change numeric(10, 3) NOT NULL,
    quantity_after numeric(10, 3) NOT NULL,
    unit_cost numeric(10, 4),
    reference_id uuid,                   -- order_id for sale deductions, PO id for receives
    notes text,
    performed_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    quantity_used numeric(10, 4) NOT NULL,
    unit_of_measure text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address jsonb,
    payment_terms text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    vendor_id uuid NOT NULL REFERENCES vendors(id),
    po_number text NOT NULL,
    status text NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'partial', 'received', 'cancelled'
    total_amount numeric(12, 2),
    ordered_at timestamptz,
    expected_at timestamptz,
    received_at timestamptz,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    quantity_ordered numeric(10, 3) NOT NULL,
    quantity_received numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4) NOT NULL,
    line_total numeric(10, 2) NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**mod.loyalty:**
```sql
CREATE TABLE loyalty_programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    program_type text NOT NULL,          -- 'points', 'visits', 'spend_based'
    points_per_dollar numeric(6, 2) DEFAULT 1,
    points_per_visit int DEFAULT 0,
    redemption_threshold int,            -- Points needed to redeem
    reward_value numeric(10, 2),         -- Dollar value of reward
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE loyalty_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    customer_id uuid NOT NULL REFERENCES customers(id),
    program_id uuid NOT NULL REFERENCES loyalty_programs(id),
    points_balance int NOT NULL DEFAULT 0,
    lifetime_points int NOT NULL DEFAULT 0,
    tier text DEFAULT 'bronze',          -- 'bronze', 'silver', 'gold', 'platinum'
    enrolled_at timestamptz DEFAULT now(),
    last_activity_at timestamptz
);

CREATE TABLE loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    loyalty_account_id uuid NOT NULL REFERENCES loyalty_accounts(id),
    transaction_type text NOT NULL,      -- 'earn', 'redeem', 'adjustment', 'expire'
    points int NOT NULL,
    balance_after int NOT NULL,
    order_id uuid REFERENCES orders(id),
    description text,
    created_at timestamptz DEFAULT now()
);
```

**mod.online_ordering:**
```sql
CREATE TABLE online_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,                  -- Public URL slug
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',         -- theme, colors, logo, min_order, delivery_fee, etc.
    created_at timestamptz DEFAULT now()
);

CREATE TABLE online_menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    online_menu_id uuid NOT NULL REFERENCES online_menus(id),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    is_available boolean DEFAULT true,
    sort_order int DEFAULT 0,
    online_price numeric(10, 2),         -- Override price for online (NULL = use menu_item price)
    online_description text,             -- Extended description for online
    created_at timestamptz DEFAULT now()
);

CREATE TABLE online_order_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES orders(id),
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'preparing'
    estimated_ready_minutes int,
    accepted_by uuid REFERENCES users(id),
    accepted_at timestamptz,
    customer_notified_at timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**mod.reservations:**
```sql
CREATE TABLE reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,

    customer_id uuid REFERENCES customers(id),
    guest_name text NOT NULL,
    guest_phone text,
    guest_email text,
    party_size int NOT NULL,

    reservation_date date NOT NULL,
    reservation_time time NOT NULL,
    duration_minutes int DEFAULT 90,

    table_id uuid REFERENCES tables(id),

    status text NOT NULL DEFAULT 'confirmed',
    -- 'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'

    notes text,
    special_requests text,

    confirmation_sent_at timestamptz,
    reminder_sent_at timestamptz,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE waitlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,

    guest_name text NOT NULL,
    guest_phone text,
    party_size int NOT NULL,

    quoted_wait_minutes int,
    position int NOT NULL,

    status text NOT NULL DEFAULT 'waiting',
    -- 'waiting', 'notified', 'seated', 'cancelled', 'no_show'

    notified_at timestamptz,
    seated_at timestamptz,
    table_id uuid REFERENCES tables(id),

    notes text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**mod.scheduling:**
```sql
CREATE TABLE schedule_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,                  -- "Default Week", "Holiday Week"
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE scheduled_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    template_id uuid REFERENCES schedule_templates(id),

    user_id uuid NOT NULL REFERENCES users(id),
    role user_role NOT NULL,

    shift_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    status text NOT NULL DEFAULT 'scheduled',
    -- 'scheduled', 'confirmed', 'swap_requested', 'swapped', 'called_out', 'no_show'

    notes text,
    published_at timestamptz,            -- NULL = draft, not visible to staff

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE shift_swap_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    scheduled_shift_id uuid NOT NULL REFERENCES scheduled_shifts(id),
    requested_by uuid NOT NULL REFERENCES users(id),
    swap_with_user_id uuid REFERENCES users(id), -- NULL = open swap (anyone can take)
    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'approved', 'denied', 'taken'
    approved_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id),
    day_of_week int NOT NULL,            -- 0=Sunday
    start_time time,
    end_time time,
    is_available boolean NOT NULL DEFAULT true,
    effective_date date,
    expiration_date date,
    created_at timestamptz DEFAULT now()
);
```

**mod.marketing (depends on mod.loyalty):**
```sql
CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    campaign_type text NOT NULL,         -- 'email', 'sms', 'push', 'email_sms'
    status text NOT NULL DEFAULT 'draft',
    -- 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'

    subject text,                        -- Email subject
    body_html text,                      -- Email body
    sms_body text,                       -- SMS body

    -- Targeting
    target_segment jsonb NOT NULL,       -- Filter criteria
    -- { "min_visits": 5, "last_visit_within_days": 30, "tags": ["vip"] }
    target_count int,                    -- Estimated recipients

    -- Scheduling
    scheduled_for timestamptz,
    sent_at timestamptz,

    -- Stats
    recipients_count int DEFAULT 0,
    opened_count int DEFAULT 0,
    clicked_count int DEFAULT 0,
    redeemed_count int DEFAULT 0,

    -- Attached offer
    discount_id uuid REFERENCES discounts(id),

    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    channel text NOT NULL,               -- 'email', 'sms'
    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'
    sent_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**mod.delivery:**
```sql
CREATE TABLE delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    -- GeoJSON polygon defining the zone
    zone_polygon jsonb NOT NULL,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    min_order_amount numeric(10, 2),
    estimated_minutes int DEFAULT 30,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES orders(id),

    driver_id uuid REFERENCES users(id),

    pickup_time timestamptz,
    delivery_time timestamptz,
    estimated_delivery_at timestamptz,
    actual_delivery_at timestamptz,

    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'failed'

    delivery_address jsonb NOT NULL,
    delivery_instructions text,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    driver_tip numeric(10, 2) DEFAULT 0,

    -- Tracking
    driver_lat numeric(10, 7),
    driver_lng numeric(10, 7),
    last_location_at timestamptz,

    proof_of_delivery_url text,          -- Photo
    signature_url text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**mod.analytics:**
```sql
-- Pre-aggregated daily metrics for fast dashboard queries
CREATE TABLE daily_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    metric_date date NOT NULL,

    -- Sales
    total_revenue numeric(12, 2) DEFAULT 0,
    net_revenue numeric(12, 2) DEFAULT 0,     -- After discounts/comps/voids
    order_count int DEFAULT 0,
    average_check numeric(10, 2) DEFAULT 0,
    covers int DEFAULT 0,                      -- Guest count
    revenue_per_cover numeric(10, 2) DEFAULT 0,

    -- By type
    dine_in_revenue numeric(12, 2) DEFAULT 0,
    takeout_revenue numeric(12, 2) DEFAULT 0,
    delivery_revenue numeric(12, 2) DEFAULT 0,
    online_revenue numeric(12, 2) DEFAULT 0,

    -- Payment mix
    cash_total numeric(12, 2) DEFAULT 0,
    card_total numeric(12, 2) DEFAULT 0,
    gift_card_total numeric(12, 2) DEFAULT 0,

    -- Labor
    labor_cost numeric(12, 2) DEFAULT 0,
    labor_hours numeric(8, 2) DEFAULT 0,
    labor_percentage numeric(5, 2) DEFAULT 0,

    -- Food cost
    food_cost numeric(12, 2) DEFAULT 0,
    food_cost_percentage numeric(5, 2) DEFAULT 0,

    -- Discounts/comps/voids
    discount_total numeric(12, 2) DEFAULT 0,
    comp_total numeric(12, 2) DEFAULT 0,
    void_total numeric(12, 2) DEFAULT 0,
    refund_total numeric(12, 2) DEFAULT 0,

    -- Tips
    tip_total numeric(12, 2) DEFAULT 0,

    -- Timing
    avg_ticket_time_seconds int DEFAULT 0,
    avg_table_turn_minutes int DEFAULT 0,

    -- Hourly breakdown (for heatmap)
    hourly_revenue jsonb DEFAULT '{}',    -- {"10": 450.00, "11": 1200.00, ...}
    hourly_covers jsonb DEFAULT '{}',

    calculated_at timestamptz DEFAULT now(),

    UNIQUE(location_id, metric_date)
);

CREATE INDEX idx_daily_metrics_location_date ON daily_metrics(location_id, metric_date DESC);

-- Product mix report data
CREATE TABLE daily_item_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    metric_date date NOT NULL,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),

    quantity_sold int DEFAULT 0,
    gross_revenue numeric(10, 2) DEFAULT 0,
    food_cost numeric(10, 2) DEFAULT 0,
    margin_percentage numeric(5, 2) DEFAULT 0,

    UNIQUE(location_id, metric_date, menu_item_id)
);
```

---

## 4. API Architecture

### Flask Blueprint Structure

```python
# app/__init__.py

from flask import Flask
from app.module_registry import registry

def create_app(config_name: str = "production") -> Flask:
    app = Flask(__name__)
    app.config.from_object(f"config.{config_name}")

    # Initialize extensions
    from app.extensions import init_extensions
    init_extensions(app)

    # Register core blueprints
    from app.core.auth import bp as auth_bp
    from app.core.pos import bp as pos_bp
    from app.core.menu import bp as menu_bp
    from app.core.staff import bp as staff_bp
    from app.core.reports import bp as reports_bp
    from app.core.settings import bp as settings_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(pos_bp, url_prefix="/api/v1/orders")
    app.register_blueprint(menu_bp, url_prefix="/api/v1/menu")
    app.register_blueprint(staff_bp, url_prefix="/api/v1/staff")
    app.register_blueprint(reports_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(settings_bp, url_prefix="/api/v1/settings")

    # Register page-serving blueprints (Jinja2 HTML pages)
    from app.core.pages import bp as pages_bp
    app.register_blueprint(pages_bp)

    # Discover and load optional modules
    registry.discover_modules()
    registry.load_all_enabled_modules(app)

    # Register middleware
    from app.shared.middleware import register_middleware
    register_middleware(app)

    return app
```

### API Versioning

URL-based versioning: `/api/v1/...`. When v2 is needed, both versions run simultaneously. Old versions get a deprecation header and sunset date.

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐
│  iPad    │────▶│  Flask   │────▶│ Supabase Auth│────▶│ PostgreSQL│
│ Browser  │     │   API    │     │  (JWT issuer)│     │ (RLS)    │
└──────────┘     └──────────┘     └──────────────┘     └──────────┘
     │                │                    │
     │  1. Login      │                    │
     │  (email+pwd    │                    │
     │   or PIN)      │                    │
     │───────────────▶│                    │
     │                │  2. Authenticate   │
     │                │───────────────────▶│
     │                │                    │
     │                │  3. JWT + Refresh  │
     │                │◀───────────────────│
     │                │                    │
     │  4. Set custom │                    │
     │     claims     │                    │
     │                │──(set org_id,      │
     │                │   role, perms      │
     │                │   in JWT claims)──▶│
     │                │                    │
     │  5. JWT token  │                    │
     │◀───────────────│                    │
     │                │                    │
     │  6. Subsequent │                    │
     │     requests   │                    │
     │  (Bearer JWT)  │                    │
     │───────────────▶│  7. Verify JWT     │
     │                │  8. Extract claims │
     │                │  9. Set RLS vars   │
     │                │───────────────────▶│ 10. RLS enforced
```

**POS-specific auth considerations:**

- **Quick PIN Login:** Servers don't enter email/password every time. A 4-6 digit PIN is used for fast login/clock-in. The PIN authenticates within the context of an already-authenticated terminal.
- **Terminal Sessions:** The iPad itself has a long-lived session (terminal auth). Individual server sessions within the terminal are shorter and PIN-gated.
- **Manager Override:** Certain actions (voids, comps over threshold, discounts) trigger a manager PIN prompt without logging out the current user.

```python
# app/shared/auth.py

from functools import wraps
from flask import request, g, abort, jsonify
from app.shared.supabase_client import supabase

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            abort(401, description="Missing authentication token")

        try:
            # Verify JWT with Supabase
            user = supabase.auth.get_user(token)
            claims = decode_jwt_claims(token)

            g.user_id = user.id
            g.org_id = claims["org_id"]
            g.location_ids = claims.get("location_ids", [])
            g.role = claims["role"]
            g.permissions = claims.get("permissions", [])

            # Set RLS variables for any direct Supabase queries
            supabase.rpc("set_request_context", {
                "p_org_id": g.org_id,
                "p_user_id": g.user_id,
                "p_role": g.role
            })

        except Exception as e:
            abort(401, description="Invalid or expired token")

        return f(*args, **kwargs)
    return decorated


def require_permission(permission: str):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if permission not in g.permissions and g.role not in ("owner", "admin", "platform_admin"):
                abort(403, description=f"Missing permission: {permission}")
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_manager_approval(f):
    """For actions that need manager PIN confirmation."""
    @wraps(f)
    def decorated(*args, **kwargs):
        manager_pin = request.headers.get("X-Manager-PIN")
        if not manager_pin:
            return jsonify({"error": "manager_approval_required",
                          "message": "This action requires manager approval"}), 403

        # Verify manager PIN
        if not verify_manager_pin(g.org_id, manager_pin):
            abort(403, description="Invalid manager PIN")

        return f(*args, **kwargs)
    return decorated
```

### Rate Limiting

```python
# Using Flask-Limiter with Redis backend
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379/1",
    default_limits=["200 per minute", "5000 per hour"],
)

# Specific limits for sensitive endpoints
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    ...

@reports_bp.route("/generate", methods=["POST"])
@limiter.limit("5 per minute")
def generate_report():
    ...
```

### API Endpoint Groups

**Authentication (`/api/v1/auth/`)**
```
POST   /login                    Email/password login → JWT
POST   /login/pin                PIN-based quick login (terminal context)
POST   /refresh                  Refresh JWT token
POST   /logout                   Invalidate session
POST   /forgot-password          Send password reset email
POST   /reset-password           Reset password with token
GET    /me                       Current user profile
PUT    /me                       Update current user profile
POST   /verify-manager-pin       Verify a manager PIN (for overrides)
```

**Menu Management (`/api/v1/menu/`)**
```
GET    /categories               List categories (filtered by location)
POST   /categories               Create category
PUT    /categories/:id           Update category
DELETE /categories/:id           Soft-delete category
PATCH  /categories/reorder       Reorder categories

GET    /items                    List items (filtered by category, location)
POST   /items                    Create item
GET    /items/:id                Get item with modifier groups
PUT    /items/:id                Update item
DELETE /items/:id                Soft-delete item
PATCH  /items/:id/86             Toggle 86 status
PATCH  /items/reorder            Reorder items within category

GET    /modifier-groups          List modifier groups
POST   /modifier-groups          Create modifier group
PUT    /modifier-groups/:id      Update modifier group
DELETE /modifier-groups/:id      Delete modifier group

GET    /modifiers                List modifiers (filtered by group)
POST   /modifiers                Create modifier
PUT    /modifiers/:id            Update modifier
DELETE /modifiers/:id            Delete modifier
```

**Orders (`/api/v1/orders/`)**
```
GET    /                         List orders (filtered: status, date, server, table)
POST   /                         Create new order (draft)
GET    /:id                      Get order with items, modifiers, payments
PUT    /:id                      Update order (add/remove items, change table, etc.)
DELETE /:id                      Void order (requires manager PIN if sent)

POST   /:id/send                 Send order to kitchen
POST   /:id/fire-course          Fire next course
POST   /:id/items                Add items to existing order
PUT    /:id/items/:item_id       Update order item (quantity, modifiers, notes)
DELETE /:id/items/:item_id       Void individual item

POST   /:id/transfer             Transfer to another server
POST   /:id/move-table           Move to different table
POST   /:id/split                Split order into multiple checks
POST   /:id/merge                Merge with another order
POST   /:id/reopen               Reopen a closed order (manager only)

GET    /:id/modifications        Get modification history

POST   /:id/discount             Apply discount
DELETE /:id/discount/:disc_id    Remove discount
POST   /:id/items/:item_id/comp  Comp an item

GET    /open                     List all open orders for location
GET    /by-table/:table_id       Get orders for a specific table
```

**Payments (`/api/v1/payments/`)**
```
POST   /                         Process payment (cash, card, gift card)
GET    /:id                      Get payment details
POST   /:id/capture              Capture authorized payment
POST   /:id/void                 Void payment
POST   /:id/refund               Process refund (full or partial)
POST   /:id/adjust-tip           Adjust tip amount

POST   /preauth                  Pre-authorize a card (bar tabs)
GET    /settlement-report        End-of-day settlement
```

**Tables (`/api/v1/tables/`)**
```
GET    /                         List tables with current status
GET    /floor-plans              List floor plans
GET    /floor-plans/:id          Get floor plan with tables
PUT    /floor-plans/:id          Update floor plan layout
POST   /floor-plans              Create floor plan

POST   /:id/seat                 Seat guests at table
POST   /:id/clear                Clear table (mark available)
PUT    /:id/status               Update table status
GET    /:id/history              Get table turn history
GET    /sections                 Get server section assignments
PUT    /sections                 Update section assignments
```

**Staff (`/api/v1/staff/`)**
```
GET    /                         List staff members
POST   /                         Create staff member
GET    /:id                      Get staff member
PUT    /:id                      Update staff member
DELETE /:id                      Deactivate staff member

POST   /clock-in                 Clock in (via PIN)
POST   /clock-out                Clock out
POST   /break/start              Start break
POST   /break/end                End break
GET    /time-entries             List time entries (date range)
PUT    /time-entries/:id         Edit time entry (manager)
POST   /time-entries/:id/approve Approve time entry

GET    /on-duty                  List currently clocked-in staff
GET    /tips                     Tip report for period
POST   /tip-pool/distribute      Distribute tip pool
```

**Reports (`/api/v1/reports/`)**
```
GET    /sales/daily              Daily sales summary
GET    /sales/weekly             Weekly sales summary
GET    /sales/monthly            Monthly sales summary
GET    /sales/custom             Custom date range
GET    /sales/hourly             Hourly breakdown (heatmap)

GET    /product-mix              Product mix report
GET    /category-mix             Category sales breakdown
GET    /server-performance       Sales by server
GET    /labor                    Labor cost report
GET    /discount-summary         Discount/comp/void summary
GET    /payment-summary          Payment method breakdown
GET    /tax-report               Tax liability report

POST   /export                   Export report as CSV/PDF (returns job ID)
GET    /export/:job_id           Check export status / download
```

**Customers (`/api/v1/customers/`)**
```
GET    /                         Search/list customers
POST   /                         Create customer
GET    /:id                      Get customer with history
PUT    /:id                      Update customer
GET    /:id/orders               Customer order history
GET    /:id/loyalty              Loyalty account details
POST   /lookup                   Lookup by phone/email
POST   /merge                    Merge duplicate customer records
```

**Settings (`/api/v1/settings/`)**
```
GET    /organization             Get org settings
PUT    /organization             Update org settings
GET    /location/:id             Get location settings
PUT    /location/:id             Update location settings

GET    /tax-rates                List tax rates
POST   /tax-rates                Create tax rate
PUT    /tax-rates/:id            Update tax rate

GET    /terminals                List terminals
POST   /terminals                Register terminal
PUT    /terminals/:id            Update terminal
DELETE /terminals/:id            Deactivate terminal

GET    /printers                 List configured printers
POST   /printers                 Add printer
PUT    /printers/:id             Update printer config
POST   /printers/:id/test        Send test print

GET    /modules                  List available/enabled modules
POST   /modules/:id/enable       Enable module
POST   /modules/:id/disable      Disable module
PUT    /modules/:id/config       Update module config

GET    /roles                    List roles and permissions
PUT    /roles/:role/permissions  Update role permissions
```

**KDS (`/api/v1/kds/`)** — Module: mod.kds
```
GET    /stations                 List KDS stations
POST   /stations                 Create station
PUT    /stations/:id             Update station config
GET    /stations/:id/tickets     Get active tickets for station

POST   /tickets/:item_id/bump    Bump item (mark complete)
POST   /tickets/:order_id/bump-all  Bump entire order
POST   /tickets/:item_id/recall  Recall bumped item
GET    /metrics                  KDS performance metrics (avg times)
```

**Inventory (`/api/v1/inventory/`)** — Module: mod.inventory
```
GET    /items                    List inventory items
POST   /items                    Create inventory item
PUT    /items/:id                Update inventory item
POST   /items/:id/count          Record inventory count
POST   /items/:id/adjust         Manual adjustment
GET    /items/low-stock          Items below par level

GET    /vendors                  List vendors
POST   /vendors                  Create vendor
GET    /purchase-orders          List POs
POST   /purchase-orders          Create PO
POST   /purchase-orders/:id/receive  Receive PO items

GET    /recipes                  List recipes (item-to-ingredient mapping)
POST   /recipes                  Create recipe
GET    /waste-log                Waste report
POST   /waste                    Record waste
```

**Reservations (`/api/v1/reservations/`)** — Module: mod.reservations
```
GET    /                         List reservations (date, status)
POST   /                         Create reservation
PUT    /:id                      Update reservation
DELETE /:id                      Cancel reservation
POST   /:id/seat                 Mark as seated
POST   /:id/no-show              Mark as no-show
POST   /:id/confirm              Send confirmation (SMS/email)

GET    /waitlist                 Current waitlist
POST   /waitlist                 Add to waitlist
PUT    /waitlist/:id             Update waitlist entry
POST   /waitlist/:id/notify      Notify guest (table ready)
POST   /waitlist/:id/seat        Seat from waitlist
GET    /availability             Check available slots
```

### Real-Time Subscriptions

For endpoints that need live updates, clients subscribe via Supabase Realtime or SSE:

```
SSE    /api/v1/events/orders     Order status changes (for all terminals)
SSE    /api/v1/events/kds        Kitchen ticket feed
SSE    /api/v1/events/tables     Table status changes
SSE    /api/v1/events/86         86 notifications
```

---

## 5. Offline-First Architecture

### Why This Matters

Restaurants lose internet regularly. A POS that stops working when the internet drops is unacceptable. The system must handle:
- Complete internet outage (still take orders, accept cash)
- Intermittent connectivity (sync when possible)
- Local network still working (terminals can talk to each other and to local KDS)

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUD LAYER                              │
│                    (Supabase + GCP VM)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Flask API │  │ Supabase │  │ Supabase │  │ Payment  │       │
│  │          │  │   DB     │  │ Realtime │  │Processor │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Internet (may be down)
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   LOCAL NETWORK LAYER                            │
│              (Restaurant's local WiFi/LAN)                      │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Local Relay     │    │  Receipt Printer  │                   │
│  │  (Raspberry Pi   │    │  Kitchen Printer  │                   │
│  │   or mini-PC)    │    └──────────────────┘                   │
│  │                  │                                           │
│  │  - Local Flask   │    ┌──────────────────┐                   │
│  │  - SQLite cache  │    │  KDS Display     │                   │
│  │  - Print server  │    │  (local network) │                   │
│  │  - mDNS/Bonjour  │    └──────────────────┘                   │
│  └────────┬─────────┘                                           │
│           │ Local WiFi                                          │
│  ┌────────┴─────────┐                                           │
│  │                  │                                           │
│  ▼                  ▼                                           │
│ ┌────────┐    ┌────────┐                                       │
│ │ iPad 1 │    │ iPad 2 │    ...                                │
│ │(Server)│    │ (Bar)  │                                       │
│ └────────┘    └────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Service Worker Strategy

```javascript
// sw.js - Service Worker

const CACHE_NAME = 'pos-v1';
const STATIC_ASSETS = [
    '/',
    '/static/css/app.css',
    '/static/js/app.js',
    '/static/js/pos.js',
    '/static/js/offline-sync.js',
    '/offline.html',
    // Menu data cached separately
];

// Cache static assets on install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Network-first for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/api/')) {
        // API calls: try network, fall back to queuing
        event.respondWith(handleApiRequest(event.request));
    } else {
        // Static assets: cache-first
        event.respondWith(
            caches.match(event.request).then(cached => cached || fetch(event.request))
        );
    }
});

async function handleApiRequest(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (err) {
        // Offline: queue mutations, return cached data for reads
        if (request.method === 'GET') {
            return caches.match(request) || new Response(
                JSON.stringify({ offline: true, error: 'No cached data' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            // Queue the mutation for later sync
            await queueOfflineMutation(request);
            return new Response(
                JSON.stringify({ offline: true, queued: true }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
}
```

### IndexedDB Schema (Client-Side)

```javascript
// offline-db.js

const DB_NAME = 'pos_offline';
const DB_VERSION = 1;

const STORES = {
    // Current menu (synced from server)
    menu_categories: { keyPath: 'id', indexes: ['sort_order'] },
    menu_items: { keyPath: 'id', indexes: ['category_id', 'is_active'] },
    modifier_groups: { keyPath: 'id' },
    modifiers: { keyPath: 'id', indexes: ['modifier_group_id'] },

    // Active orders (working copies)
    orders: { keyPath: 'id', indexes: ['status', 'table_id', 'server_id'] },
    order_items: { keyPath: 'id', indexes: ['order_id'] },

    // Tables and floor plan
    tables: { keyPath: 'id', indexes: ['status'] },
    floor_plans: { keyPath: 'id' },

    // Staff (for PIN lookup)
    staff: { keyPath: 'id', indexes: ['pin_hash'] },

    // Offline mutation queue
    sync_queue: { keyPath: 'id', autoIncrement: true, indexes: ['timestamp', 'synced'] },

    // Tax rates and discounts
    tax_rates: { keyPath: 'id' },
    discounts: { keyPath: 'id' },
};
```

### Sync Protocol

```
┌──────────┐                              ┌──────────┐
│  iPad    │                              │  Server  │
│(offline) │                              │  (API)   │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  [OFFLINE MODE]                         │
     │  Create order → IndexedDB               │
     │  Generate temp UUID                      │
     │  Add to sync_queue                       │
     │                                         │
     │  ... internet returns ...               │
     │                                         │
     │  POST /api/v1/sync/push                 │
     │  {                                      │
     │    "device_id": "...",                   │
     │    "mutations": [                       │
     │      {                                  │
     │        "id": "queue-item-uuid",         │
     │        "type": "order.create",          │
     │        "timestamp": "2026-03-20T...",   │
     │        "payload": { order data },       │
     │        "temp_id": "offline-uuid-1"      │
     │      },                                 │
     │      {                                  │
     │        "type": "order.add_items",       │
     │        "timestamp": "...",              │
     │        "payload": { items },            │
     │        "ref_temp_id": "offline-uuid-1"  │
     │      }                                  │
     │    ]                                    │
     │  }                                      │
     │─────────────────────────────────────────▶│
     │                                         │  Process mutations
     │                                         │  in timestamp order
     │                                         │  Map temp_ids to real IDs
     │                                         │
     │  Response:                              │
     │  {                                      │
     │    "results": [                         │
     │      {"queue_id": "...",                │
     │       "status": "applied",              │
     │       "temp_id": "offline-uuid-1",      │
     │       "real_id": "server-uuid-1"},      │
     │      ...                                │
     │    ],                                   │
     │    "server_changes": [                  │
     │      // Changes from other devices      │
     │      // since last sync                 │
     │    ]                                    │
     │  }                                      │
     │◀─────────────────────────────────────────│
     │                                         │
     │  Update IndexedDB with real IDs         │
     │  Apply server_changes                    │
     │  Clear synced items from queue           │
```

### Conflict Resolution

**Order number conflicts:** Offline orders get a temporary order number (e.g., `OFF-001`). On sync, the server assigns the real sequential number. The display number updates.

**Same table claimed by two terminals offline:** Last-write-wins at the order level. The server detects the conflict and merges: both orders exist, table gets the most recent one. Staff see an alert: "Table 5 has two orders from offline mode — please merge or reassign."

**Menu item 86'd while terminal was offline:** If a terminal creates an order with an 86'd item, the sync response flags it: "Item X was 86'd at [time]. Order was accepted but item flagged for review." The server-side handler marks the item with a warning rather than rejecting the entire sync.

**Rule of thumb:** Accept the order data, flag conflicts for human resolution. Never lose a sale.

### What Works Offline

| Function | Offline Status | Notes |
|----------|---------------|-------|
| Order entry | FULL | Stored in IndexedDB |
| Kitchen send | LOCAL ONLY | Via local relay device |
| Kitchen printing | LOCAL ONLY | Direct to network printer |
| Cash payments | FULL | Calculated locally, synced later |
| Card payments | BLOCKED | Cannot authorize without internet* |
| Menu browsing | FULL | Cached in IndexedDB |
| Table management | FULL | Local state, synced later |
| Clock in/out | FULL | Stored locally, synced later |
| Reports | BLOCKED | Need server data |
| Customer lookup | PARTIAL | Cached recent customers only |
| Online orders | BLOCKED | Requires internet by definition |

*Card payments: We could implement store-and-forward for known cards (capture later), but the liability risk usually isn't worth it. Cash-only during outages is the standard approach. If needed, we'd partner with a processor that supports offline capture.

### Local Relay Device

A small always-on device on the local network (Raspberry Pi 4 or mini-PC running Linux):

- Runs a lightweight Flask server
- Acts as print server (receives print jobs, routes to network printers)
- Acts as message relay between tablets on local network (order → kitchen)
- Discovered via mDNS/Bonjour (no hardcoded IPs)
- Maintains a local SQLite database as a sync buffer
- When internet is up, continuously syncs with cloud

```python
# Local relay discovery from iPad
# The PWA finds the local relay via mDNS: pos-relay.local

async function findLocalRelay() {
    const relayUrls = [
        'https://pos-relay.local:8443',
        'https://192.168.1.100:8443',  // Fallback static IP
    ];

    for (const url of relayUrls) {
        try {
            const resp = await fetch(`${url}/health`, { timeout: 2000 });
            if (resp.ok) return url;
        } catch {}
    }
    return null;
}
```

---

## 6. Real-Time Communication

### Implementation: Hybrid Approach

Use **Supabase Realtime** as the primary mechanism when internet is available, and **local WebSocket relay** for intra-restaurant communication.

### Supabase Realtime Channels

```javascript
// Real-time subscriptions via Supabase JS client

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Channel: Order updates for this location
const orderChannel = supabase
    .channel(`orders:${locationId}`)
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `location_id=eq.${locationId}`
    }, (payload) => {
        handleOrderUpdate(payload);
    })
    .subscribe();

// Channel: 86 notifications (broadcast, not DB-backed)
const eightySixChannel = supabase
    .channel(`86:${locationId}`)
    .on('broadcast', { event: '86_update' }, (payload) => {
        handleEightySix(payload);
    })
    .subscribe();

// Channel: Table status changes
const tableChannel = supabase
    .channel(`tables:${locationId}`)
    .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tables',
        filter: `location_id=eq.${locationId}`
    }, (payload) => {
        updateTableStatus(payload);
    })
    .subscribe();
```

### KDS Real-Time Flow

```
Server iPad                  Supabase                    KDS Display
    │                            │                           │
    │  POST /orders              │                           │
    │  (with items)              │                           │
    │───────────────────────────▶│                           │
    │                            │  INSERT order + items     │
    │                            │  (triggers Realtime)      │
    │                            │                           │
    │                            │  postgres_changes event   │
    │                            │──────────────────────────▶│
    │                            │                           │  Display ticket
    │                            │                           │  Start timer
    │                            │                           │
    │                            │         [Kitchen bumps]   │
    │                            │◀──────────────────────────│
    │                            │  UPDATE order_items       │
    │                            │  is_ready = true          │
    │                            │                           │
    │  Realtime: item ready      │                           │
    │◀───────────────────────────│                           │
    │  Show "Ready" indicator    │                           │
```

### 86 Notification System

When a menu item is 86'd:

```python
# In the menu service
async def mark_item_86d(item_id: str, org_id: str, location_id: str):
    # Update database
    supabase.table("menu_items").update({"is_86d": True}).eq("id", item_id).execute()

    # Broadcast to all terminals at this location
    supabase.channel(f"86:{location_id}").send({
        "type": "broadcast",
        "event": "86_update",
        "payload": {
            "item_id": item_id,
            "item_name": item_name,
            "is_86d": True,
            "timestamp": datetime.utcnow().isoformat()
        }
    })

    # Also update IndexedDB on all connected terminals
    # (handled by the broadcast listener on each terminal)
```

### Server-Sent Events (SSE) Fallback

For environments where WebSocket connections are problematic, SSE provides a reliable fallback:

```python
# app/core/events/routes.py

from flask import Response, stream_with_context
import json, time

@bp.route("/stream", methods=["GET"])
@require_auth
def event_stream():
    def generate():
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f"events:{g.location_id}")

        # Send heartbeat every 30 seconds to keep connection alive
        last_heartbeat = time.time()

        for message in pubsub.listen():
            if message["type"] == "message":
                yield f"data: {message['data'].decode()}\n\n"

            if time.time() - last_heartbeat > 30:
                yield f": heartbeat\n\n"
                last_heartbeat = time.time()

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
```

### Local Network Communication (No Internet)

When the internet is down, terminals communicate via the local relay:

```
iPad (Server)                 Local Relay               iPad (KDS)
    │                        (Raspberry Pi)                  │
    │  POST /local/orders         │                          │
    │  (over local WiFi)          │                          │
    │────────────────────────────▶│                           │
    │                             │  Store in SQLite         │
    │                             │  Route to KDS printer    │
    │                             │                          │
    │                             │  WebSocket push          │
    │                             │─────────────────────────▶│
    │                             │                          │  Display ticket
    │                             │                          │
    │     [Internet returns]      │                          │
    │                             │  Sync SQLite → Cloud     │
    │                             │                          │
```

---

## 7. Infrastructure & Deployment

### GCP Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Cloud Load Balancer (L7)                 │       │
│  │              + Cloud Armor (WAF/DDoS)                 │       │
│  │              + Managed SSL Certificate                │       │
│  └───────────────────────┬──────────────────────────────┘       │
│                          │                                      │
│  ┌───────────────────────┴──────────────────────────────┐       │
│  │          Managed Instance Group (MIG)                 │       │
│  │                                                       │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │       │
│  │  │ VM: Web 1   │  │ VM: Web 2   │  │ VM: Web 3   │  │       │
│  │  │ e2-standard │  │ e2-standard │  │ (auto-scale) │  │       │
│  │  │ -4          │  │ -4          │  │             │  │       │
│  │  │             │  │             │  │             │  │       │
│  │  │ Gunicorn    │  │ Gunicorn    │  │ Gunicorn    │  │       │
│  │  │ (4 workers) │  │ (4 workers) │  │ (4 workers) │  │       │
│  │  │ Flask app   │  │ Flask app   │  │ Flask app   │  │       │
│  │  │ Nginx       │  │ Nginx       │  │ Nginx       │  │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                          │                                      │
│  ┌───────────────────────┴──────────────────────────────┐       │
│  │                    Internal                           │       │
│  │                                                       │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │       │
│  │  │ Redis       │  │ Celery      │  │ Celery Beat  │  │       │
│  │  │ (Memorystore│  │ Worker VM   │  │ (Scheduler)  │  │       │
│  │  │  or VM)     │  │ e2-standard │  │              │  │       │
│  │  │             │  │ -2          │  │              │  │       │
│  │  │ Cache +     │  │             │  │              │  │       │
│  │  │ Sessions +  │  │ Report gen  │  │ Cron jobs    │  │       │
│  │  │ Pub/Sub     │  │ Email/SMS   │  │ Daily agg    │  │       │
│  │  └─────────────┘  │ Sync tasks  │  │ Cleanup      │  │       │
│  │                    └─────────────┘  └─────────────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                          │                                      │
│  ┌───────────────────────┴──────────────────────────────┐       │
│  │                   Storage                             │       │
│  │                                                       │       │
│  │  ┌─────────────┐  ┌─────────────┐                    │       │
│  │  │ Cloud        │  │ Cloud       │                    │       │
│  │  │ Storage     │  │ CDN         │                    │       │
│  │  │ (backups,   │  │ (static     │                    │       │
│  │  │  exports)   │  │  assets)    │                    │       │
│  │  └─────────────┘  └─────────────┘                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴──────┐
                    │  Supabase  │
                    │  (hosted)  │
                    │            │
                    │ PostgreSQL │
                    │ Auth       │
                    │ Realtime   │
                    │ Storage    │
                    └────────────┘
```

### VM Sizing

| Component | Instance Type | vCPUs | Memory | Count | Monthly Cost (est) |
|-----------|--------------|-------|--------|-------|--------------------|
| Web Server | e2-standard-4 | 4 | 16 GB | 2 (min) | ~$200/ea |
| Celery Worker | e2-standard-2 | 2 | 8 GB | 1 | ~$100 |
| Redis | Memorystore Basic | — | 5 GB | 1 | ~$150 |
| Load Balancer | Cloud LB | — | — | 1 | ~$20 + per-GB |

**Auto-scaling:** MIG scales from 2 to 6 web VMs based on CPU utilization (target: 60%) and request count.

### Gunicorn Configuration

```python
# gunicorn.conf.py

bind = "0.0.0.0:8000"
workers = 4                    # 2 * CPU cores + 1
worker_class = "gevent"        # Async workers for SSE/WebSocket
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Preloading
preload_app = True

# Graceful restart
graceful_timeout = 30
max_requests = 1000
max_requests_jitter = 50
```

### Nginx Configuration (per VM)

```nginx
upstream flask_app {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name _;

    # Health check for load balancer
    location /health {
        proxy_pass http://flask_app;
    }

    # Static files (served by Nginx directly)
    location /static/ {
        alias /opt/pos/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API and pages
    location / {
        proxy_pass http://flask_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # WebSocket support (for Supabase Realtime proxy if needed)
    location /ws/ {
        proxy_pass http://flask_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Request size limit (for image uploads)
    client_max_body_size 10M;
}
```

### Redis Usage

```
Redis Instance
├── DB 0: Application cache
│   ├── menu:{location_id}          # Cached menu (TTL: 5min)
│   ├── floor_plan:{location_id}    # Cached floor plan (TTL: 1min)
│   ├── org_modules:{org_id}        # Enabled modules (TTL: 5min)
│   └── daily_metrics:{loc}:{date}  # Report cache (TTL: 10min)
│
├── DB 1: Rate limiting
│   └── ratelimit:{ip}:{endpoint}   # Flask-Limiter storage
│
├── DB 2: Sessions
│   └── session:{session_id}        # Terminal session data
│
├── DB 3: Celery broker
│   └── celery task queue
│
└── DB 4: Pub/Sub
    ├── events:{location_id}        # Real-time events
    └── 86:{location_id}            # 86 notifications
```

### Celery Tasks

```python
# app/tasks.py

from celery import Celery
from celery.schedules import crontab

celery = Celery("pos", broker="redis://redis:6379/3")

celery.conf.beat_schedule = {
    # Daily metrics aggregation (runs at 4 AM for each location's timezone)
    "aggregate-daily-metrics": {
        "task": "tasks.aggregate_daily_metrics",
        "schedule": crontab(minute=0, hour=4),
    },
    # Stale session cleanup
    "cleanup-stale-sessions": {
        "task": "tasks.cleanup_stale_sessions",
        "schedule": crontab(minute="*/30"),
    },
    # Sync offline relay data
    "sync-offline-relays": {
        "task": "tasks.sync_offline_relays",
        "schedule": crontab(minute="*/5"),
    },
    # Gift card expiration check
    "check-gift-card-expiry": {
        "task": "tasks.check_gift_card_expiry",
        "schedule": crontab(minute=0, hour=6),
    },
    # Inventory low-stock alerts
    "check-low-stock": {
        "task": "tasks.check_low_stock",
        "schedule": crontab(minute=0, hour="*/4"),
    },
}

@celery.task
def send_receipt_email(order_id: str, email: str):
    """Send email receipt via SendGrid."""
    ...

@celery.task
def send_sms_notification(phone: str, message: str):
    """Send SMS via Twilio."""
    ...

@celery.task
def generate_report(report_type: str, params: dict, requesting_user_id: str):
    """Generate report async, store result, notify user."""
    ...

@celery.task
def aggregate_daily_metrics(location_id: str, date: str):
    """Roll up order/payment/labor data into daily_metrics table."""
    ...

@celery.task
def process_event(event_name: str, payload: dict):
    """Process async event hooks from modules."""
    ...

@celery.task
def sync_online_order(order_data: dict):
    """Process incoming online order, create POS order, notify staff."""
    ...
```

### Database Connection Pooling

Supabase includes PgBouncer. Configure the Flask app to use the pooler connection string:

```python
# config.py

SUPABASE_DB_URL = "postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres"
# Port 6543 = PgBouncer pooler (transaction mode)
# Port 5432 = direct connection (avoid for app traffic)

# For SQLAlchemy (if used alongside direct Supabase client):
SQLALCHEMY_POOL_SIZE = 10
SQLALCHEMY_MAX_OVERFLOW = 20
SQLALCHEMY_POOL_TIMEOUT = 30
SQLALCHEMY_POOL_RECYCLE = 1800
```

### Supabase Storage

```
Supabase Storage Buckets:
├── menu-images/            # Menu item photos
│   └── {org_id}/{item_id}.jpg
├── receipts/               # Stored receipt PDFs
│   └── {org_id}/{date}/{order_id}.pdf
├── logos/                  # Organization logos
│   └── {org_id}/logo.png
├── exports/                # Generated reports
│   └── {org_id}/{report_id}.csv
└── floor-plans/            # Floor plan background images
    └── {org_id}/{location_id}/{plan_id}.png
```

### Monitoring & Logging

**Application Monitoring:** Google Cloud Monitoring + custom metrics via OpenTelemetry.

```python
# app/shared/monitoring.py

from opentelemetry import trace, metrics
from opentelemetry.instrumentation.flask import FlaskInstrumentor

def init_monitoring(app):
    FlaskInstrumentor().instrument_app(app)

    meter = metrics.get_meter("pos-system")

    # Custom metrics
    order_counter = meter.create_counter("orders.created", description="Orders created")
    payment_counter = meter.create_counter("payments.processed")
    order_latency = meter.create_histogram("orders.send_latency_ms",
                                           description="Time from send to kitchen display")
```

**Structured Logging:**

```python
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
)

logger = structlog.get_logger()

# Usage
logger.info("order.created",
    order_id=order.id,
    org_id=org_id,
    location_id=location_id,
    total=order.total,
    item_count=len(order.items))
```

**Log aggregation:** Google Cloud Logging (built-in with GCP VMs). Logs exported to BigQuery for long-term analysis if needed.

### Backup Strategy

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| Supabase DB | Supabase managed backups (Pro plan: daily PITR) | Continuous WAL archiving | 7 days PITR |
| DB Logical Backup | `pg_dump` via Celery task → Cloud Storage | Daily at 3 AM UTC | 30 days |
| Supabase Storage | Cross-region replication (Supabase managed) | Continuous | N/A |
| Redis | RDB snapshots (Memorystore managed) | Hourly | 24 hours |
| App Config | Git repository | On every change | Permanent |
| VM Images | Instance template snapshots | Weekly | 4 weeks |

### CI/CD Pipeline

```
GitHub repo
    │
    ▼
GitHub Actions
    │
    ├── On PR: Run tests, lint, type check
    │
    ├── On merge to main:
    │   ├── Run full test suite
    │   ├── Build Docker image (or deploy artifact)
    │   ├── Push to Artifact Registry
    │   ├── Run Supabase migrations (staging)
    │   ├── Deploy to staging MIG (rolling update)
    │   └── Run smoke tests against staging
    │
    └── On release tag:
        ├── Run Supabase migrations (production)
        ├── Deploy to production MIG (rolling update)
        ├── Run smoke tests against production
        └── Notify Slack on success/failure
```

```yaml
# .github/workflows/deploy.yml (simplified)
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v
      - run: ruff check app/
      - run: mypy app/ --ignore-missing-imports

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - run: |
          gcloud compute instance-groups managed rolling-action restart \
            pos-web-mig-staging \
            --zone=us-east1-b \
            --max-surge=1 \
            --max-unavailable=0
```

---

## 8. Security Architecture

### Authentication Layers

```
Layer 1: Terminal Authentication
  - Terminal registers with the system (device fingerprint + registration code)
  - Gets a long-lived terminal token (refreshed weekly)
  - Stored in HttpOnly secure cookie
  - This proves "this is an authorized iPad for this location"

Layer 2: User Authentication
  - Server enters PIN on the terminal
  - PIN verified against users table (bcrypt hashed)
  - Issues a user session token (JWT, 8-hour expiry)
  - User sessions are scoped to the terminal session

Layer 3: Manager Override
  - Sensitive actions prompt for manager PIN
  - Manager PIN is verified as a one-time check
  - Action is logged with both the user and approving manager
  - No separate session created — just authorization for that action
```

### PCI Compliance

We never touch card numbers. The payment flow:

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  iPad    │────▶│  Payment │────▶│   Payment    │────▶│  Card        │
│  POS     │     │  Form    │     │  Processor   │     │  Networks    │
│          │     │ (iframe/ │     │  (Valor      │     │  (Visa, MC)  │
│          │     │  SDK)    │     │   PayTech)   │     │              │
└──────────┘     └──────────┘     └──────────────┘     └──────────────┘
                      │
                      │ Card data NEVER touches our servers
                      │ Only tokenized reference comes back
                      ▼
              ┌──────────────┐
              │ Our Flask API│ ← Receives token only
              │ stores:      │    (e.g. "tok_abc123")
              │ - token      │
              │ - last 4     │
              │ - brand      │
              │ - auth code  │
              └──────────────┘
```

**PCI SAQ-A eligible** because:
- Card data enters directly into the processor's iframe/SDK
- Our servers never see, process, or store card numbers
- We store only processor tokens and masked card info
- All communication over TLS 1.3

### Data Encryption

- **In transit:** TLS 1.3 everywhere. HSTS headers. No HTTP fallback.
- **At rest:** Supabase encrypts data at rest by default (AES-256). Sensitive columns (PIN hashes, gift card numbers) are additionally hashed/encrypted at the application level.
- **API keys and secrets:** Stored in Google Secret Manager, injected via environment variables at deploy time. Never in code or config files.

### API Security Headers

```python
# app/shared/middleware.py

from flask import Flask

def register_middleware(app: Flask):
    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # CSP — allow Supabase, payment processor iframe, and our CDN
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://js.stripe.com; "
            "frame-src https://js.stripe.com; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co; "
            "img-src 'self' https://*.supabase.co data:; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self';"
        )
        return response
```

### CSRF Protection

```python
# For API endpoints: JWT in Authorization header = no CSRF risk (not cookie-based)
# For form submissions (Jinja2 pages): use Flask-WTF CSRF tokens

from flask_wtf.csrf import CSRFProtect
csrf = CSRFProtect(app)

# Exempt API endpoints from CSRF (they use Bearer tokens)
csrf.exempt(api_v1_blueprint)
```

### Audit Logging

Every sensitive action is logged:

```python
# app/shared/audit.py

def audit_log(
    action: str,
    entity_type: str,
    entity_id: str,
    description: str,
    previous_state: dict | None = None,
    new_state: dict | None = None,
):
    supabase.table("audit_log").insert({
        "org_id": g.org_id,
        "location_id": g.get("location_id"),
        "user_id": g.user_id,
        "user_name": g.user_display_name,
        "user_role": g.role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "previous_state": previous_state,
        "new_state": new_state,
        "ip_address": request.remote_addr,
        "user_agent": request.user_agent.string,
        "terminal_id": g.get("terminal_id"),
    }).execute()
```

**Audited actions include:**
- All voids and comps
- Price overrides
- Discount applications
- Cash drawer opens (no-sale)
- Time entry modifications
- User role/permission changes
- Menu price changes
- Failed login attempts
- Module enable/disable
- Report exports

### Two-Factor Authentication

Required for `owner` and `admin` roles accessing the management dashboard (not required for POS terminal operations — that would be insane in a restaurant).

Implemented via Supabase Auth MFA (TOTP). Enrolled during first admin login.

### IP Allowlisting

Optional per-organization setting for admin dashboard access. POS terminal access is not IP-restricted (tablets move around).

```python
@bp.before_request
def check_ip_allowlist():
    if request.path.startswith("/admin"):
        org = get_org(g.org_id)
        allowed_ips = org.settings.get("admin_allowed_ips", [])
        if allowed_ips and request.remote_addr not in allowed_ips:
            abort(403, description="IP not allowed for admin access")
```

---

## 9. Performance Requirements

### Targets and How to Hit Them

| Metric | Target | Strategy |
|--------|--------|----------|
| Order entry → kitchen display | < 500ms | Supabase Realtime (PostgreSQL NOTIFY triggers on INSERT). Direct path: INSERT → trigger → NOTIFY → WebSocket → KDS. No polling. |
| Payment processing | < 3s | Async Valor API call via Valor Connect (MQTT) or REST. Show "Processing..." immediately. Valor terminal handles card interaction. |
| Menu load | < 200ms | Redis cache per location. Invalidate on menu change. Pre-warm cache on location settings save. |
| Floor plan render | < 300ms | Cached table states in Redis. Single query for all tables in location. Canvas rendering is client-side. |
| Daily report | < 5s | Pre-aggregated `daily_metrics` table. Query is a single row lookup. |
| Monthly report | < 30s | Aggregate from `daily_metrics` (30 rows max). Heavy reports (product mix breakdown) are generated async via Celery. |
| Page load (HTML) | < 1s | Server-side rendering with Jinja2. CDN for static assets. Minimal JS bundle (htmx + Alpine = ~30KB gzipped). |
| Concurrent terminals/location | 20+ | Stateless Flask workers behind load balancer. WebSocket connections via Supabase (they handle the scaling). |
| Orders/hour/location | 1000+ | At 1000 orders/hour, that's ~17 orders/second. Each order is 1 INSERT + 3-5 item INSERTs = ~100 queries/second. Well within PostgreSQL capacity with connection pooling. |

### Database Query Optimization

```sql
-- Most critical query: get all open orders for a location with items
-- This query runs on every POS screen refresh

-- Use a composite index
CREATE INDEX idx_orders_location_status_open ON orders(location_id, status)
    WHERE status IN ('draft', 'open', 'fired', 'ready', 'served');

-- The query (executed via Python):
SELECT o.*,
    json_agg(json_build_object(
        'id', oi.id,
        'name', oi.name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'is_sent', oi.is_sent,
        'is_voided', oi.is_voided,
        'notes', oi.notes,
        'modifiers', (
            SELECT json_agg(json_build_object('name', m.name, 'price', m.price_adjustment))
            FROM order_item_modifiers m WHERE m.order_item_id = oi.id
        )
    )) as items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id AND NOT oi.is_voided
WHERE o.location_id = :location_id
    AND o.status IN ('draft', 'open', 'fired', 'ready', 'served')
GROUP BY o.id
ORDER BY o.opened_at;
```

### Caching Strategy

```python
# app/shared/cache.py

import json
from app.extensions import redis_client

def cache_menu(location_id: str, menu_data: dict, ttl: int = 300):
    key = f"menu:{location_id}"
    redis_client.setex(key, ttl, json.dumps(menu_data))

def get_cached_menu(location_id: str) -> dict | None:
    key = f"menu:{location_id}"
    data = redis_client.get(key)
    return json.loads(data) if data else None

def invalidate_menu(location_id: str):
    redis_client.delete(f"menu:{location_id}")

# Cache invalidation on menu changes:
# Every menu edit endpoint calls invalidate_menu() after the DB update.
# Clients re-fetch on next request (or via Realtime event if subscribed).
```

### Load Testing Targets

Before launch, validate with load tests simulating:
- 50 locations, each with 10 terminals
- Each terminal creates 2 orders/minute during peak
- = 1000 orders/minute system-wide
- Each order has 4 items average
- Mix: 70% dine-in, 20% takeout, 10% online
- Payment: 80% card, 15% cash, 5% gift card
- Concurrent report generation: 10 locations pulling daily reports simultaneously

Tools: Locust (Python-based, fits our stack).

---

## 10. Frontend Architecture

### Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| HTML rendering | Jinja2 (server-side) | Matches Flask backend. Fast initial render. SEO irrelevant for POS. |
| Interactivity | htmx + Alpine.js | htmx handles server-driven updates without writing API fetch code. Alpine handles client-side state (cart, modifiers, UI toggles). ~35KB combined, gzipped. No build step. |
| CSS | Tailwind CSS | Utility-first, great for rapid prototyping. Custom POS-specific components on top. |
| Icons | Heroicons (SVG) | Matches Tailwind ecosystem. Inline SVGs, no icon font load. |
| Charts | Chart.js | Lightweight, touch-friendly, good for reports dashboard. |
| Printing | Direct ESC/POS or browser print | Network printers via ESC/POS commands through local relay. Browser print for backup. |

### Why Not React/Vue/Angular?

For a POS system rendered with Jinja2 and enhanced with htmx + Alpine:

1. **No build step.** Change a template, reload. No webpack, no bundler, no 60-second compile.
2. **Server-side rendering is fast.** POS pages aren't complex SPAs. They're forms, grids, and buttons.
3. **Offline works with Service Worker + IndexedDB**, regardless of framework.
4. **htmx gives us partial page updates** (swap table status, update order list) without a full SPA framework.
5. **Alpine.js handles local interactivity** (modifier selection modal, quantity steppers, tab switching) in a few lines of inline JS.
6. **Total JS payload: ~35KB gzipped** vs 200KB+ for React.

### PWA Configuration

```json
// manifest.json
{
    "name": "POS System",
    "short_name": "POS",
    "start_url": "/pos",
    "display": "standalone",
    "orientation": "landscape",
    "background_color": "#ffffff",
    "theme_color": "#1a1a2e",
    "icons": [
        { "src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
}
```

```html
<!-- base.html -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="manifest" href="/manifest.json">
```

### Touch-Optimized UI Principles

```css
/* Minimum tap target: 44x44 points (Apple HIG) — we go 48px for comfort */
.pos-button {
    min-height: 48px;
    min-width: 48px;
    padding: 12px 16px;
    font-size: 16px; /* Prevents iOS zoom on focus */
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation; /* Disable double-tap zoom */
    user-select: none;
}

/* Menu item grid buttons — larger for fast tapping */
.menu-item-button {
    min-height: 72px;
    min-width: 100px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
}

/* Prevent pull-to-refresh in iOS Safari standalone mode */
html, body {
    overscroll-behavior: none;
    overflow: hidden; /* POS is full-screen, no scroll on body */
}

/* Swipe gestures handled by Alpine.js + touch events */
```

### Screen Layout (iPad Landscape — Primary)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌───────┐                                            ┌──────────┐  │
│ │ Logo  │  Server: Maria  │  Table: T5  │  3 guests  │ 12:45 PM │  │
│ └───────┘                                            └──────────┘  │
├────────────────────────────────┬────────────────────────────────────┤
│                                │                                    │
│    MENU CATEGORIES             │         CURRENT ORDER              │
│  ┌─────┐ ┌─────┐ ┌─────┐     │                                    │
│  │Apps │ │Entree│ │Sides│ ... │  ┌──────────────────────────────┐  │
│  └─────┘ └─────┘ └─────┘     │  │ 1x  Burger          $14.00  │  │
│                                │  │     - No onions              │  │
│  ┌────────────────────────┐   │  │     - Cheddar      + $1.50  │  │
│  │                        │   │  │ 2x  Caesar Salad     $24.00  │  │
│  │   MENU ITEMS GRID      │   │  │ 1x  IPA Draft        $7.00  │  │
│  │                        │   │  │ 1x  Kids Mac          $8.00  │  │
│  │  ┌──────┐ ┌──────┐    │   │  │                              │  │
│  │  │Burger│ │Cheese│    │   │  │                              │  │
│  │  │$14   │ │burger│    │   │  │                              │  │
│  │  │      │ │$16   │    │   │  │                              │  │
│  │  └──────┘ └──────┘    │   │  └──────────────────────────────┘  │
│  │  ┌──────┐ ┌──────┐    │   │                                    │
│  │  │Fish &│ │Pasta │    │   │  Subtotal:         $54.50          │
│  │  │Chips │ │Primav│    │   │  Tax (8.25%):       $4.50          │
│  │  │$18   │ │$15   │    │   │  ─────────────────────────         │
│  │  └──────┘ └──────┘    │   │  Total:            $59.00          │
│  │                        │   │                                    │
│  │  ┌──────┐ ┌──────┐    │   │  ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │  │Steak │ │Salmon│    │   │  │ SEND │ │ HOLD │ │  PAY     │  │
│  │  │$32   │ │$28   │    │   │  │      │ │      │ │          │  │
│  │  └──────┘ └──────┘    │   │  └──────┘ └──────┘ └──────────┘  │
│  │                        │   │                                    │
│  └────────────────────────┘   │                                    │
│                                │                                    │
├────────────────────────────────┴────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │Orders│ │Tables│ │Menu  │ │Staff │ │ KDS  │ │Report│ │ More ││
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### htmx Integration Pattern

```html
<!-- Order entry: tapping a menu item adds it to the order -->
<!-- The server renders the updated order panel and swaps it in -->

<button
    class="menu-item-button"
    hx-post="/pos/order/{{ order.id }}/add-item"
    hx-vals='{"menu_item_id": "{{ item.id }}"}'
    hx-target="#order-panel"
    hx-swap="innerHTML"
    hx-indicator="#order-loading"
>
    <span class="font-semibold">{{ item.name }}</span>
    <span class="text-sm">${{ item.price }}</span>
</button>

<!-- Order panel (replaced by htmx on every change) -->
<div id="order-panel">
    {% include "pos/partials/_order_items.html" %}
</div>
```

```html
<!-- Modifier selection modal (Alpine.js handles local state) -->
<div x-data="modifierModal()" x-show="isOpen" class="modal-overlay">
    <div class="modal-content">
        <h3 x-text="groupName" class="text-lg font-semibold mb-4"></h3>

        <template x-for="mod in modifiers" :key="mod.id">
            <button
                @click="toggleModifier(mod)"
                :class="{'bg-blue-500 text-white': isSelected(mod.id)}"
                class="modifier-button"
            >
                <span x-text="mod.name"></span>
                <span x-show="mod.price > 0" x-text="'+$' + mod.price"></span>
            </button>
        </template>

        <div class="mt-4 flex gap-2">
            <button @click="cancel()" class="btn-secondary">Cancel</button>
            <button @click="confirm()" class="btn-primary"
                    :disabled="!meetsMinimum">
                Confirm
            </button>
        </div>
    </div>
</div>
```

### Print Handling

**Receipt Printing (Thermal Printers):**

Thermal receipt printers speak ESC/POS (a binary command language). We send print jobs to the local relay, which formats and sends to the printer.

```python
# Local relay: print service

from escpos.printer import Network

def print_receipt(printer_ip: str, order: dict):
    p = Network(printer_ip)

    p.set(align="center", bold=True, double_height=True)
    p.text(order["location_name"] + "\n")
    p.set(align="center", bold=False, double_height=False)
    p.text(order["location_address"] + "\n")
    p.text("─" * 42 + "\n")

    p.set(align="left")
    p.text(f"Order: {order['display_number']}\n")
    p.text(f"Server: {order['server_name']}\n")
    p.text(f"Table: {order['table_name']}\n")
    p.text(f"Date: {order['date']}\n")
    p.text("─" * 42 + "\n")

    for item in order["items"]:
        p.text(f"{item['qty']}x {item['name']}")
        p.text(f"{'':>30}${item['total']:>8.2f}\n")
        for mod in item.get("modifiers", []):
            p.text(f"   {mod['name']}\n")
        if item.get("notes"):
            p.text(f"   ** {item['notes']}\n")

    p.text("─" * 42 + "\n")
    p.text(f"{'Subtotal:':<30}${order['subtotal']:>8.2f}\n")
    p.text(f"{'Tax:':<30}${order['tax']:>8.2f}\n")
    if order.get("discount"):
        p.text(f"{'Discount:':<30}-${order['discount']:>8.2f}\n")
    p.set(bold=True)
    p.text(f"{'TOTAL:':<30}${order['total']:>8.2f}\n")
    p.set(bold=False)

    if order.get("tip"):
        p.text(f"{'Tip:':<30}${order['tip']:>8.2f}\n")
        p.text(f"{'Total + Tip:':<30}${order['total'] + order['tip']:>8.2f}\n")

    p.text("\n")
    p.text(order.get("receipt_footer", "Thank you!") + "\n")
    p.cut()
```

**Kitchen Ticket Printing:**

Same mechanism, different format: larger font, item-focused, no prices. Routed to the correct kitchen printer based on `prep_station`.

**Browser Print Fallback:**

If network printers aren't configured, use `window.print()` with a print-specific CSS stylesheet:

```css
@media print {
    /* Hide everything except the receipt */
    body > *:not(#print-area) { display: none !important; }

    #print-area {
        width: 80mm; /* Standard thermal receipt width */
        font-family: 'Courier New', monospace;
        font-size: 12px;
    }
}
```

### Responsive Breakpoints

```
iPad Landscape (primary):     1024px × 768px  (iPad) to 1366px × 1024px (iPad Pro)
iPad Portrait (supported):    768px × 1024px  to 1024px × 1366px
Large tablet (Samsung Tab):   1280px × 800px
Phone (emergency fallback):   375px width (limited functionality: view orders only)
Desktop (admin dashboard):    1440px+ (full management UI)
```

```css
/* Tailwind breakpoints customized for POS */
/* sm: 640px — phone */
/* md: 768px — iPad portrait */
/* lg: 1024px — iPad landscape (primary) */
/* xl: 1280px — large tablet / desktop */
/* 2xl: 1536px — desktop admin */
```

### Offline UI States

```html
<!-- Connection status indicator (always visible) -->
<div x-data="connectionStatus()" class="fixed top-0 right-0 z-50">
    <div x-show="!isOnline"
         class="bg-amber-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
        OFFLINE — Orders saving locally
    </div>
    <div x-show="isSyncing"
         class="bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
        Syncing... (<span x-text="queueSize"></span> pending)
    </div>
</div>
```

---

## Appendix A: Data Flow Diagrams

### Order Lifecycle (Happy Path)

```
Server taps         htmx POST            Flask API           Supabase DB
menu item       ───────────────▶      creates order_item   ────────────▶
on iPad              /add-item          returns updated       INSERT
                                        order HTML
                ◀───────────────       (partial render)
                  HTML fragment
                  swaps into
                  #order-panel

Server taps         htmx POST           Flask API           Supabase DB
"SEND"          ───────────────▶      updates order         ────────────▶
                    /send              status = 'open'        UPDATE
                                      sets sent_at            + NOTIFY
                                      fires event bus
                                                              │
                ◀───────────────                              │
                  "Order Sent"                                │
                  confirmation                                ▼
                                                         Realtime
                                                         event fires
                                                              │
Kitchen                                                       │
Display (KDS)  ◀──────────────────── WebSocket ◀──────────────┘
renders ticket
starts timer

Cook prepares,      KDS POST           Flask API           Supabase DB
taps "BUMP"     ───────────────▶    update order_item     ────────────▶
                   /bump              is_ready = true        UPDATE
                                     check if all items      + NOTIFY
                                     ready → update order
                                     status = 'ready'
                                                              │
Server iPad    ◀──────────────────── WebSocket ◀──────────────┘
shows "READY"
indicator

Server delivers     htmx POST          Flask API           Supabase DB
food, taps       ──────────────▶    update order          ────────────▶
"SERVED"            /serve           status = 'served'      UPDATE

Guest pays,         htmx POST          Flask API          Payment
server taps      ──────────────▶    create payment       Processor
"PAY"               /pay             call processor  ────────────▶
                                                     ◀────────────
                                     store result        auth_code
                                     update order
                                     status = 'closed'
                ◀──────────────
                 receipt rendered
```

### End-of-Day Settlement Flow

```
Manager opens          Flask API              Supabase DB
settlement page   ────────────▶         Query all payments
                                        for today's shift
                  ◀────────────
                  Settlement report:
                  - Cash expected: $X
                  - Card total: $Y
                  - Gift cards: $Z
                  - Tips: $W

Manager counts         htmx POST           Flask API         Supabase DB
cash drawer       ────────────▶       Record actual count  ────────────▶
                      /close-drawer    Calculate over/short   INSERT
                                       Close cash drawer    cash_drawer_events

Manager closes         htmx POST          Flask API          Celery Task
shift             ────────────▶       Close shift record   ────────────▶
                      /close-shift     Trigger reports      - Daily aggregation
                                                            - Tip distribution calc
                  ◀────────────                             - Email summary to owner
                  Shift summary                             - Archive to daily_metrics
```

---

## Appendix B: Module Enable/Disable Flow

```
Owner opens            Flask API             Supabase DB
Module Settings   ────────────▶        Get org_modules
                  ◀────────────        with status
                  Shows available
                  modules with
                  toggle switches

Owner enables          htmx POST           Flask API            Supabase DB
"KDS" module      ────────────▶       1. Check deps OK       ────────────▶
                     /enable           2. Run migrations       Run KDS DDL
                                       3. Insert org_module
                                       4. Cache invalidate
                                       5. Register routes     ◀────────────
                                          (if not already)

                  ◀────────────
                  "KDS Enabled"
                  Nav now shows
                  "Kitchen Display"
                  menu item

Owner disables         htmx POST          Flask API            Supabase DB
"KDS" module      ────────────▶       1. Check no deps     ────────────▶
                     /disable          2. Mark disabled       UPDATE
                                       3. Cache invalidate    org_modules
                                       4. Routes still exist  is_enabled=false
                                          but return 403
                  ◀────────────
                  "KDS Disabled"
                  Nav item hidden
                  Data preserved
```

---

## Appendix C: Technology Decision Summary

| Decision | Choice | Rejected Alternatives | Reason |
|----------|--------|----------------------|--------|
| Multi-tenancy | Shared schema + RLS | Schema-per-tenant, DB-per-tenant | Migration simplicity, Supabase RLS support, connection pooling efficiency |
| Frontend framework | htmx + Alpine.js | React, Vue, Angular, Svelte | No build step, tiny bundle, SSR-first matches Flask/Jinja2, sufficient for POS UI complexity |
| CSS | Tailwind CSS | Bootstrap, custom CSS | Utility-first speed, good touch component ecosystem, tree-shaking for small bundles |
| Real-time | Supabase Realtime | Socket.IO, Pusher, Firebase | Already using Supabase, PostgreSQL NOTIFY integration, no additional service |
| Task queue | Celery + Redis | RQ, Dramatiq, Huey | Battle-tested, periodic task support, good monitoring tools |
| Caching | Redis (GCP Memorystore) | Memcached, in-process | Pub/sub, data structures, persistence, session storage — Redis does it all |
| Payment processing | Valor PayTech (ISV partnership) | Direct processor integration, PayFac | Never touch card data, PCI SAQ B-IP, REST API + Valor Connect (MQTT), Dual Pricing built-in |
| Auth | Supabase Auth + custom claims | Auth0, Firebase Auth, roll-own | Unified with database, JWT with RLS integration, no additional service |
| IDs | UUIDv7 | UUIDv4, sequential int, ULID | Time-sortable (good for indexes), globally unique, no enumeration risk |
| Offline sync | Service Worker + IndexedDB + local relay | CouchDB/PouchDB, Firebase offline | Full control over sync logic, no vendor lock-in for critical offline path |
| Monitoring | OpenTelemetry + GCP Cloud Monitoring | Datadog, New Relic | Cost-effective at scale, GCP-native integration, open standard |

---

## Appendix D: Estimated Infrastructure Costs (Monthly)

| Component | Specification | Monthly Cost |
|-----------|--------------|-------------|
| Supabase Pro | Pro plan (8GB DB, 250GB bandwidth) | $25 |
| GCP VMs (2x web) | e2-standard-4, sustained use | ~$200 each = $400 |
| GCP VM (1x worker) | e2-standard-2 | ~$100 |
| GCP Memorystore (Redis) | Basic, 5GB | ~$150 |
| GCP Load Balancer | Standard + bandwidth | ~$50 |
| GCP Cloud CDN | Static asset delivery | ~$20 |
| Google Cloud Monitoring | Included tier + custom metrics | ~$30 |
| Valor processing fees | Interchange + Valor margin | Pass through to merchant (offset by Dual Pricing) |
| Twilio (SMS) | ~$0.01/message | Variable |
| SendGrid | Pro plan (100K emails/month) | $90 |
| Domain + SSL | Managed certificate (free with GCP LB) | $15 (domain) |
| **Total platform cost** | | **~$880/month** |

This supports roughly 100-200 active locations before needing to scale up VMs. At $149-299/month per location, break-even is 3-6 paying customers. Costs scale sub-linearly — adding 10 more locations doesn't double infra costs.

---

*End of architecture specification. This document serves as the technical blueprint for implementation. Start building with core modules first (POS, Menu, Staff, Reports), then add optional modules one at a time.*



---


# Part 6: Payment Processing Architecture


# Restaurant POS Payment Processing Architecture
## Complete Technical Specification

---

# 1. VALOR PAYMENT INTEGRATION LAYER

## Processor Comparison Matrix (Market Reference)

> **Note:** Sear integrates exclusively with Valor PayTech. This comparison matrix is retained for market context. Valor's backend routes to the optimal processor (TSYS, Fiserv, WorldPay, Elavon) automatically.

```
+------------------+----------+----------+----------+---------+---------+---------+-----------+
| Feature          | Stripe   | Square   | Heart-   | World-  | TSYS/   | Elavon  | Fiserv/   |
|                  | Terminal |          | land     | pay/FIS | Global  |         | Clover    |
+------------------+----------+----------+----------+---------+---------+---------+-----------+
| EMV Chip         | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| NFC/Contactless  | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Mag Stripe       | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Pre-Auth         | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Tip Adjust       | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Split Tender     | App-lvl  | App-lvl  | Yes      | Yes     | Yes     | Yes     | Yes       |
| iOS SDK          | Yes      | Yes      | No*      | No*     | No*     | No*     | Yes       |
| REST API         | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| P2PE Certified   | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Batch Auto-Close | Config   | Auto     | Config   | Config  | Config  | Config  | Config    |
| Next-Day Funding | Yes      | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
| Same-Day Funding | Stripe+  | Sq Inst  | Yes      | Yes     | Yes     | Yes     | Yes       |
| Surcharge API    | No       | No       | Yes      | Yes     | Yes     | Yes     | Yes       |
| Gift Card Native | No       | Yes      | Yes      | Yes     | Yes     | Yes     | Yes       |
+------------------+----------+----------+----------+---------+---------+---------+-----------+
* These processors require gateway-level integration via semi-integrated
  devices (Ingenico, Verifone) that handle card interaction independently.
  iPad communicates with device over local network, not direct SDK.
```

## Processor Deep Dive

### Valor PayTech (Sear's Integrated Processor)
- **Company**: Founded 2019, headquartered in Jericho, NY. ~264 employees, ~$15M revenue, 250K+ connected devices.
- **API Model**: REST API (valorapi.readme.io) + **Valor Connect** (MQTT-based cloud protocol for POS-to-terminal communication). Supports Direct Sale, Auth, Incremental Auth, Void, Refund, Tip Adjust, Settlement, Tokenization, Webhooks.
- **iOS Integration**: No native iOS SDK, but Sear's lightweight iOS wrapper app connects to Valor terminals via Bluetooth (RCKT) or local network (VP800/VP550). Communication uses Valor Connect (MQTT) or REST APIs. Card data never touches Sear's servers.
- **Hardware**: VP800 (dual-display countertop, customer-facing + merchant screen), VP550 (countertop, compact), VP300 Pro (PIN pad, customer-facing input), RCKT (mobile Bluetooth, pairs with iOS/Android — ideal for tableside), VL500 (versatile terminal). ValorPay App available on iOS and Android.
- **Pre-Auth**: Auth endpoint with `capture: false`. Incremental Auth supported (re-authorize for higher amount when bar tab exceeds initial hold). Capture with tip adjustment at tab close.
- **Tip Adjust**: Tip Adjust endpoint on authorized transactions before batch settlement.
- **Settlement**: Configurable batch close. Settlement endpoint for manual batch processing.
- **Dual Pricing**: Valor's key differentiator. Shows both cash price and card price. Menu prices reflect the card price; cash customers pay a lower (discounted) price. Potentially offsets 100% of processing fees for the restaurant. Legal in all 50 states (structured as a cash discount, not a surcharge). Built into Sear's menu management — each item shows both cash and card prices.
- **Pricing**: Competitive interchange-plus rates. Valor works with TSYS, Fiserv, WorldPay, Elavon, EPX, Priority, Repay on the backend, so interchange rates are market-competitive.
- **Restaurant Features**: On-terminal tipping (VP800 customer-facing screen), tokenization for repeat customers, webhooks for real-time transaction status, LitePOS (basic menu/inventory available on terminals as fallback).
- **Key Advantage**: Single integration point that provides access to multiple backend processors. Dual Pricing is a genuine differentiator that no other POS competitor offers as a built-in feature. Sear earns ISV revenue share on processing volume.
- **ISV Relationship**: Sear is an Independent Software Vendor (ISV) partner of Valor. Sear's Flask web app communicates with Valor terminals via Valor Connect (MQTT) or REST APIs. Sear earns a margin on processing volume as part of the ISV partnership.

> **Note:** The processors below are documented for market context and competitive analysis. Sear does NOT integrate with these processors directly — all payment processing flows through Valor PayTech, which routes to the optimal backend processor (TSYS, Fiserv, WorldPay, Elavon, etc.) on behalf of the merchant.

### Stripe Terminal (Market Reference)
- **API Model**: RESTful + WebSocket for real-time reader events
- **Hardware**: BBPOS WisePad 3 (Bluetooth, $59), WisePOS E (countertop, WiFi/Ethernet, $249), Stripe Reader S700 (Android-based, touchscreen, $349)
- **Pricing**: 2.6% + 10c card-present. Custom rates for volume.
- **Restaurant Features**: On-reader tipping, receipt forwarding, offline mode, update amounts after auth.

### Square (Market Reference)
- **Hardware**: Square Reader (contactless+chip, $49), Square Terminal ($299), Square Stand ($149)
- **Pricing**: 2.6% + 10c card-present. Custom rates for $250K+/year.
- **Restaurant Features**: Built-in gift cards, loyalty program hooks, kitchen display API.

### Other Processors (Market Reference)
- **Heartland (Global Payments)**: Restaurant-focused, interchange-plus pricing, native gift/loyalty.
- **Worldpay/FIS**: Enterprise-grade, largest acquirer globally, best for multi-location chains.
- **TSYS/Global Payments**: TransIT gateway, competitive for high-volume restaurants.
- **Elavon (US Bancorp)**: Competitive hospitality pricing, bank relationship advantages.
- **Fiserv/First Data/Clover Connect**: ISV/POS integration-focused, CardPointe API.

## Valor Integration Layer

Sear integrates exclusively with Valor PayTech. Rather than an abstract multi-processor interface, the payment layer is a single, purpose-built Valor integration that communicates via Valor Connect (MQTT) and REST APIs.

```python
# pos/payments/valor.py
# Single Valor PayTech integration — no multi-processor abstraction needed.

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from datetime import datetime
from typing import Optional
import aiohttp  # For Valor REST API calls
# import paho.mqtt.client as mqtt  # For Valor Connect MQTT (optional)


class PaymentMethod(Enum):
    CARD_EMV = "card_emv"          # Chip insert
    CARD_NFC = "card_nfc"          # Contactless tap
    CARD_SWIPE = "card_swipe"      # Magnetic stripe
    CARD_MANUAL = "card_manual"    # Keyed entry (CNP)
    CARD_ONLINE = "card_online"    # E-commerce
    CARD_TOKEN = "card_token"      # Saved card (tokenized)
    CASH = "cash"
    GIFT_CARD = "gift_card"
    HOUSE_ACCOUNT = "house_account"


class TransactionStatus(Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"       # Auth obtained, not yet captured
    CAPTURED = "captured"           # Captured, will settle
    SETTLED = "settled"             # Funds have moved
    VOIDED = "voided"               # Auth reversed before settlement
    REFUNDED = "refunded"           # Credit issued after settlement
    PARTIALLY_REFUNDED = "partial_refund"
    DECLINED = "declined"
    ERROR = "error"
    TIMED_OUT = "timed_out"


class CardBrand(Enum):
    VISA = "visa"
    MASTERCARD = "mastercard"
    AMEX = "amex"
    DISCOVER = "discover"
    DINERS = "diners"
    JCB = "jcb"
    UNIONPAY = "unionpay"
    UNKNOWN = "unknown"


@dataclass
class CardInfo:
    """Masked card info returned from processor. NEVER contains full PAN."""
    last_four: str
    brand: CardBrand
    entry_mode: PaymentMethod
    cardholder_name: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_debit: Optional[bool] = None
    token: Optional[str] = None          # Processor token for this card
    card_id: Optional[str] = None        # Processor's card identifier


@dataclass
class AuthorizationResult:
    success: bool
    transaction_id: str                   # Our internal ID
    processor_transaction_id: str         # Processor's reference
    authorization_code: str               # 6-digit auth code from issuer
    status: TransactionStatus
    authorized_amount: Decimal
    card_info: Optional[CardInfo] = None
    avs_result: Optional[str] = None
    cvv_result: Optional[str] = None
    decline_code: Optional[str] = None
    decline_reason: Optional[str] = None
    error_message: Optional[str] = None
    processor_response_code: Optional[str] = None
    raw_response: Optional[dict] = None   # Full processor response for debugging


@dataclass
class CaptureResult:
    success: bool
    transaction_id: str
    processor_transaction_id: str
    captured_amount: Decimal
    tip_amount: Decimal
    status: TransactionStatus
    error_message: Optional[str] = None


@dataclass
class RefundResult:
    success: bool
    refund_id: str
    processor_refund_id: str
    refund_amount: Decimal
    status: TransactionStatus
    error_message: Optional[str] = None


@dataclass
class VoidResult:
    success: bool
    transaction_id: str
    processor_transaction_id: str
    status: TransactionStatus
    error_message: Optional[str] = None


@dataclass
class BatchResult:
    success: bool
    batch_id: str
    processor_batch_id: str
    transaction_count: int
    total_amount: Decimal
    net_amount: Decimal              # After fees
    status: str
    settled_at: Optional[datetime] = None
    error_message: Optional[str] = None


@dataclass
class ReaderDevice:
    device_id: str
    serial_number: str
    model: str
    status: str                      # "online", "offline", "busy"
    battery_level: Optional[int] = None
    firmware_version: Optional[str] = None
    connection_type: str = "bluetooth"  # "bluetooth", "usb", "network"


@dataclass
class GiftCardResult:
    success: bool
    card_number_masked: str
    balance: Decimal
    amount_applied: Optional[Decimal] = None
    error_message: Optional[str] = None


class ValorPaymentProcessor:
    """
    Valor PayTech integration layer. Sear's exclusive payment processor.
    Communicates with Valor terminals via Valor Connect (MQTT) or REST API.
    Card data never touches Sear's servers.
    """

    def __init__(self, config: dict):
        """
        config contains Valor ISV credentials and settings.
        e.g., {"api_key": "valor_...", "app_id": "...", "epi": "...", "location_id": "loc_123", ...}
        """
        self.config = config
        self.processor_name: str = "valor"
        self.valor_api_base = config.get("api_base", "https://api.valorpaytech.com")
        self.mqtt_broker = config.get("mqtt_broker", "connect.valorpaytech.com")

    # ── Reader/Device Management ────────────────────────────────

    async def discover_readers(self) -> list[ReaderDevice]:
        """Find available Valor terminals (via Valor Connect MQTT discovery or network scan)."""
        ...

    async def connect_reader(self, device_id: str) -> bool:
        """Establish connection to a Valor terminal via MQTT or Bluetooth."""
        ...

    async def disconnect_reader(self, device_id: str) -> bool:
        """Disconnect from Valor terminal."""
        ...

    async def get_reader_status(self, device_id: str) -> ReaderDevice:
        """Get current status of connected Valor terminal."""
        ...

    # ── Authorization ───────────────────────────────────────────

    async def authorize(
        self,
        amount: Decimal,
        device_id: str,
        order_id: str,
        *,
        capture: bool = False,            # True = sale (auth+capture). False = auth only.
        metadata: Optional[dict] = None,
    ) -> AuthorizationResult:
        """
        Present payment on reader and obtain authorization.
        If capture=True, this is a sale (auth + capture in one step).
        If capture=False, this is auth-only (must capture later -- used for bar tabs, tip adjust).
        """
        ...

    async def authorize_manual(
        self,
        amount: Decimal,
        card_token: str,
        order_id: str,
        *,
        capture: bool = False,
        metadata: Optional[dict] = None,
    ) -> AuthorizationResult:
        """
        Authorize using a saved card token (for online orders, repeat charges).
        No physical reader involved.
        """
        ...

    # ── Capture / Tip Adjustment ────────────────────────────────

    async def capture(
        self,
        processor_transaction_id: str,
        amount: Decimal,
        tip_amount: Decimal = Decimal("0"),
    ) -> CaptureResult:
        """
        Capture a previously authorized transaction.
        amount = subtotal + tax (original auth amount).
        tip_amount = tip to add on top.
        Total captured = amount + tip_amount.

        This is how tip adjustment works:
        1. Server runs card for $50 (auth only)
        2. Customer writes $10 tip on receipt
        3. Server enters tip in POS
        4. POS calls capture($50, tip=$10) -> captures $60
        """
        ...

    async def adjust_tip(
        self,
        processor_transaction_id: str,
        new_tip_amount: Decimal,
    ) -> CaptureResult:
        """
        Adjust tip on an already-captured transaction (if processor supports it).
        Some processors allow tip adjustment on captured-but-unsettled transactions.
        """
        ...

    # ── Incremental Authorization ───────────────────────────────

    async def incremental_auth(
        self,
        processor_transaction_id: str,
        additional_amount: Decimal,
    ) -> AuthorizationResult:
        """
        Increase an existing authorization (for bar tabs where spend exceeds initial auth).
        Not all processors support this. Fallback: void and re-auth at higher amount.
        """
        ...

    # ── Void / Refund ───────────────────────────────────────────

    async def void(
        self,
        processor_transaction_id: str,
    ) -> VoidResult:
        """
        Void an authorized or captured transaction BEFORE settlement.
        Releases the hold on the customer's card immediately.
        """
        ...

    async def refund(
        self,
        processor_transaction_id: str,
        amount: Optional[Decimal] = None,   # None = full refund
    ) -> RefundResult:
        """
        Refund a settled transaction. If amount is None, refund full amount.
        If amount is specified, partial refund.
        """
        ...

    async def unlinked_refund(
        self,
        amount: Decimal,
        card_token: str,
        reason: str,
    ) -> RefundResult:
        """
        Refund to a different card than the original transaction.
        Requires card token (from a new card read or saved token).
        Higher risk -- requires manager approval in our system.
        """
        ...

    # ── Settlement / Batch ──────────────────────────────────────

    async def close_batch(self) -> BatchResult:
        """
        Manually close the current batch and initiate settlement.
        Some processors auto-close at a configured time.
        """
        ...

    async def get_batch_status(self, batch_id: str) -> BatchResult:
        """Get status of a specific batch."""
        ...

    async def get_settlement_report(
        self, start_date: datetime, end_date: datetime
    ) -> list[dict]:
        """Get settled transactions for reconciliation."""
        ...

    # ── Gift Cards ──────────────────────────────────────────────

    async def gift_card_balance(
        self, card_number: Optional[str] = None, device_id: Optional[str] = None
    ) -> GiftCardResult:
        """Check gift card balance. Either by number or by swiping on reader."""
        ...

    async def gift_card_activate(
        self, amount: Decimal, device_id: str
    ) -> GiftCardResult:
        """Activate a new gift card with initial balance."""
        ...

    async def gift_card_redeem(
        self, amount: Decimal, card_number: Optional[str] = None,
        device_id: Optional[str] = None
    ) -> GiftCardResult:
        """Redeem (debit) from gift card. Returns remaining balance."""
        ...

    async def gift_card_reload(
        self, amount: Decimal, card_number: Optional[str] = None,
        device_id: Optional[str] = None
    ) -> GiftCardResult:
        """Add funds to existing gift card."""
        ...

    # ── Tokenization ────────────────────────────────────────────

    async def save_card(
        self, device_id: str, customer_id: str
    ) -> CardInfo:
        """
        Read a card and store a reusable token for future charges.
        Used for: repeat customers, online ordering saved cards, house accounts.
        """
        ...

    async def charge_saved_card(
        self,
        card_token: str,
        amount: Decimal,
        order_id: str,
        *,
        capture: bool = True,
    ) -> AuthorizationResult:
        """Charge a previously saved card token."""
        ...

    # ── Surcharging ─────────────────────────────────────────────

    async def apply_surcharge(
        self,
        subtotal: Decimal,
        card_brand: CardBrand,
        is_debit: bool,
    ) -> dict:
        """
        Calculate surcharge based on card type and jurisdiction.
        Returns: {"surcharge_amount": Decimal, "surcharge_rate": Decimal,
                  "is_allowed": bool, "reason": str}
        Debit cards CANNOT be surcharged (federal law).
        """
        ...

    # ── Health / Status ─────────────────────────────────────────

    async def health_check(self) -> dict:
        """
        Check Valor API connectivity and terminal status.
        Returns: {"status": "ok"|"degraded"|"down", "latency_ms": int}
        """
        ...
```

## Valor Processor Initialization

Since Sear uses a single processor (Valor PayTech), there is no multi-processor registry or factory pattern. The Valor processor is instantiated directly with location-specific credentials.

```python
# pos/payments/init.py

from pos.payments.valor import ValorPaymentProcessor


def get_processor(config: dict) -> ValorPaymentProcessor:
    """Initialize the Valor payment processor for a location."""
    return ValorPaymentProcessor(config)


# config structure per location:
# {
#     "api_key": "valor_live_...",
#     "app_id": "sear_pos",
#     "epi": "...",              # Valor endpoint identifier
#     "location_id": "loc_123",
#     "mqtt_broker": "connect.valorpaytech.com",
#     "api_base": "https://api.valorpaytech.com",
#     "dual_pricing_enabled": True,
#     "cash_discount_rate": "3.00",  # Dual pricing percentage
# }
```

## Valor REST API Integration Examples

```python
# pos/payments/valor_api.py
# Valor PayTech API integration for Sear POS.
# API reference: valorapi.readme.io

import aiohttp
from decimal import Decimal
from pos.payments.valor import *


class ValorAPIClient:
    """
    Communicates with Valor PayTech via REST API and Valor Connect (MQTT).
    Card data never touches Sear servers — Valor terminals handle all
    PCI-sensitive operations.
    """

    def __init__(self, config: dict):
        self.api_key = config["api_key"]
        self.app_id = config["app_id"]
        self.epi = config["epi"]
        self.api_base = config.get("api_base", "https://api.valorpaytech.com")
        self.dual_pricing_enabled = config.get("dual_pricing_enabled", True)

    async def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make authenticated request to Valor API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-App-Id": self.app_id,
        }
        async with aiohttp.ClientSession() as session:
            url = f"{self.api_base}{endpoint}"
            async with session.request(method, url, json=data, headers=headers) as resp:
                return await resp.json()

    async def direct_sale(
        self,
        amount: Decimal,
        epi: str,
        order_id: str,
        tip_amount: Decimal = Decimal("0"),
    ) -> AuthorizationResult:
        """Direct Sale — auth + capture in one step. Used for counter-service."""
        amount_cents = int(amount * 100)
        tip_cents = int(tip_amount * 100)
        result = await self._request("POST", "/v1/sale", {
            "epi": epi,
            "amount": amount_cents,
            "tip": tip_cents,
            "order_id": order_id,
            "surchargeIndicator": "dual_pricing" if self.dual_pricing_enabled else "none",
        })
        return self._parse_auth_result(result, order_id, amount)

    async def auth_only(
        self,
        amount: Decimal,
        epi: str,
        order_id: str,
    ) -> AuthorizationResult:
        """Auth only — used for bar tabs, tip-adjust flow."""
        amount_cents = int(amount * 100)
        result = await self._request("POST", "/v1/auth", {
            "epi": epi,
            "amount": amount_cents,
            "order_id": order_id,
        })
        return self._parse_auth_result(result, order_id, amount)

    async def incremental_auth(
        self,
        transaction_id: str,
        additional_amount: Decimal,
    ) -> AuthorizationResult:
        """Increase existing auth — for bar tabs exceeding initial hold."""
        additional_cents = int(additional_amount * 100)
        result = await self._request("POST", "/v1/incremental-auth", {
            "transaction_id": transaction_id,
            "additional_amount": additional_cents,
        })
        return self._parse_auth_result(result, "", additional_amount)

    async def capture_with_tip(
        self,
        transaction_id: str,
        amount: Decimal,
        tip_amount: Decimal = Decimal("0"),
    ) -> CaptureResult:
        """Capture a previously authorized transaction with tip adjustment."""
        total_cents = int((amount + tip_amount) * 100)
        tip_cents = int(tip_amount * 100)
        result = await self._request("POST", "/v1/capture", {
            "transaction_id": transaction_id,
            "amount": total_cents,
            "tip": tip_cents,
        })
        return CaptureResult(
            success=result.get("status") == "approved",
            transaction_id="",  # filled by caller
            processor_transaction_id=result.get("transaction_id", ""),
            captured_amount=amount + tip_amount,
            tip_amount=tip_amount,
            status=TransactionStatus.CAPTURED,
        )

    async def tip_adjust(
        self,
        transaction_id: str,
        new_tip_amount: Decimal,
    ) -> CaptureResult:
        """Adjust tip on captured-but-unsettled transaction."""
        tip_cents = int(new_tip_amount * 100)
        result = await self._request("POST", "/v1/tip-adjust", {
            "transaction_id": transaction_id,
            "tip": tip_cents,
        })
        return CaptureResult(
            success=result.get("status") == "approved",
            transaction_id="",
            processor_transaction_id=result.get("transaction_id", ""),
            captured_amount=Decimal(result.get("total_amount", 0)) / 100,
            tip_amount=new_tip_amount,
            status=TransactionStatus.CAPTURED,
        )

    async def void_transaction(self, transaction_id: str) -> VoidResult:
        result = await self._request("POST", "/v1/void", {
            "transaction_id": transaction_id,
        })
        return VoidResult(
            success=result.get("status") == "approved",
            transaction_id="",
            processor_transaction_id=transaction_id,
            status=TransactionStatus.VOIDED,
        )

    async def refund_transaction(
        self,
        transaction_id: str,
        amount: Decimal | None = None,
    ) -> RefundResult:
        data = {"transaction_id": transaction_id}
        if amount is not None:
            data["amount"] = int(amount * 100)
        result = await self._request("POST", "/v1/refund", data)
        return RefundResult(
            success=result.get("status") == "approved",
            refund_id="",
            processor_refund_id=result.get("refund_id", ""),
            refund_amount=Decimal(result.get("amount", 0)) / 100,
            status=TransactionStatus.REFUNDED,
        )

    async def settle_batch(self) -> BatchResult:
        """Manually close batch and initiate settlement."""
        result = await self._request("POST", "/v1/settlement", {
            "epi": self.epi,
        })
        return BatchResult(
            success=result.get("status") == "approved",
            batch_id=result.get("batch_id", ""),
            transaction_count=result.get("transaction_count", 0),
            net_amount=Decimal(result.get("net_amount", 0)) / 100,
        )

    def _parse_auth_result(self, result: dict, order_id: str, amount: Decimal) -> AuthorizationResult:
        return AuthorizationResult(
            success=result.get("status") == "approved",
            transaction_id=order_id,
            processor_transaction_id=result.get("transaction_id", ""),
            authorization_code=result.get("auth_code", ""),
            status=(
                TransactionStatus.AUTHORIZED if result.get("capture_status") == "pending"
                else TransactionStatus.CAPTURED if result.get("status") == "approved"
                else TransactionStatus.DECLINED
            ),
            authorized_amount=amount,
            card_info=self._extract_card_info(result) if result.get("card") else None,
            raw_response=result,
        )

    def _extract_card_info(self, result: dict) -> CardInfo:
        card = result.get("card", {})
        return CardInfo(
            last_four=card.get("last4", ""),
            brand=CardBrand(card.get("brand", "unknown")),
            entry_mode=PaymentMethod.CARD_EMV,
            cardholder_name=card.get("cardholder_name"),
            exp_month=card.get("exp_month"),
            exp_year=card.get("exp_year"),
        )
```

## Valor Connect Integration Pattern

Sear communicates with Valor terminals via Valor Connect, an MQTT-based cloud protocol. The POS never handles card data directly.

```
iPad (Sear POS)  <--MQTT/REST-->  Valor Terminal  <--Valor Network-->  Backend Processor
   |                                    |                                (TSYS/Fiserv/
   |  1. Send amount via                |                                 WorldPay/etc.)
   |     Valor Connect (MQTT)           |
   |----------------------------------->|
   |                                    | 2. Customer inserts/taps card
   |                                    | 3. Terminal encrypts (P2PE)
   |                                    | 4. Valor routes to optimal backend processor
   |                                    | 5. Backend processor returns auth
   |  6. Auth result via webhook/MQTT   |
   |<-----------------------------------|
```

Supported terminal hardware:
- **VP800** (dual display, countertop) — customer-facing screen shows amount + Dual Pricing
- **VP550** (countertop, compact)
- **VP300 Pro** (PIN pad)
- **RCKT** (mobile Bluetooth) — pairs with iOS wrapper app for tableside payments
- **VL500** (versatile terminal)

```python
# pos/payments/valor_connect.py

import asyncio
import aiohttp
from decimal import Decimal
from pos.payments.valor import *


class ValorConnectClient:
    """
    Communicates with Valor terminals via Valor Connect (MQTT-based cloud protocol).
    The terminal handles all card interaction and PCI-sensitive operations.
    Sear's server sends transaction requests; Valor terminal handles the rest.
    """

    def __init__(self, config: dict):
        self.api_key = config["api_key"]
        self.app_id = config["app_id"]
        self.epi = config["epi"]
        self.mqtt_broker = config.get("mqtt_broker", "connect.valorpaytech.com")
        self.api_base = config.get("api_base", "https://api.valorpaytech.com")
        self.dual_pricing_enabled = config.get("dual_pricing_enabled", True)

    async def _send_via_valor_connect(self, command: dict) -> dict:
        """Send command to Valor terminal via Valor Connect MQTT protocol."""
        # Valor Connect uses MQTT for POS-to-terminal communication
        # The terminal subscribes to a topic; POS publishes transaction requests
        async with aiohttp.ClientSession() as session:
            url = f"{self.api_base}/v1/connect/transaction"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "X-App-Id": self.app_id,
            }
            async with session.post(url, json=command, headers=headers, timeout=120) as resp:
                return await resp.json()

    async def authorize(
        self,
        amount: Decimal,
        device_id: str,
        order_id: str,
        *,
        capture: bool = False,
        metadata: Optional[dict] = None,
    ) -> AuthorizationResult:
        command = {
            "transaction_type": "SALE" if capture else "AUTH_ONLY",
            "amount": str(amount),
            "invoice_number": order_id,
            "terminal_id": device_id,
        }

        # This blocks until customer interacts with Valor terminal
        result = await self._send_via_valor_connect(command)

        return AuthorizationResult(
            success=result["response_code"] == "00",
            transaction_id=order_id,
            processor_transaction_id=result["transaction_id"],
            authorization_code=result.get("auth_code", ""),
            status=(
                TransactionStatus.CAPTURED if capture and result["response_code"] == "00"
                else TransactionStatus.AUTHORIZED if result["response_code"] == "00"
                else TransactionStatus.DECLINED
            ),
            authorized_amount=Decimal(result["authorized_amount"]),
            card_info=CardInfo(
                last_four=result.get("masked_pan", "")[-4:],
                brand=self._map_brand(result.get("card_type", "")),
                entry_mode=self._map_entry_mode(result.get("entry_mode", "")),
            ),
            decline_code=result.get("response_code") if result["response_code"] != "00" else None,
            decline_reason=result.get("response_text") if result["response_code"] != "00" else None,
        )

    async def capture(
        self,
        processor_transaction_id: str,
        amount: Decimal,
        tip_amount: Decimal = Decimal("0"),
    ) -> CaptureResult:
        # Capture/tip-adjust goes through Valor REST API, not terminal
        # Terminal is only needed when a physical card is present
        result = await self._valor_api_request("capture", {
            "transaction_id": processor_transaction_id,
            "amount": str(amount + tip_amount),
            "tip_amount": str(tip_amount),
        })
        return CaptureResult(
            success=result["status"] == "approved",
            transaction_id="",
            processor_transaction_id=processor_transaction_id,
            captured_amount=amount + tip_amount,
            tip_amount=tip_amount,
            status=TransactionStatus.CAPTURED,
        )

    async def _valor_api_request(self, action: str, params: dict) -> dict:
        """Send request to Valor REST API (server-to-server)."""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "X-App-Id": self.app_id,
            }
            async with session.post(
                f"{self.api_base}/v1/{action}",
                json=params,
                headers=headers,
            ) as resp:
                return await resp.json()
```

---

# 2. PAYMENT FLOW ARCHITECTURE

## 2.1 Standard Payment Flow (Dine-In)

```
  SERVER                    POS (iPad)                 PROCESSOR                CARD READER
    |                          |                          |                         |
    |  1. "Table 5 ready"      |                          |                         |
    |------------------------->|                          |                         |
    |                          |  2. Present check         |                         |
    |                          |     ($85.42 + $7.26 tax) |                         |
    |                          |     = $92.68              |                         |
    |                          |                          |                         |
    |  3. Guest pays by card   |                          |                         |
    |------------------------->|                          |                         |
    |                          |  4. authorize(            |                         |
    |                          |     amount=$92.68,        |                         |
    |                          |     capture=False)        |                         |
    |                          |------------------------->|                         |
    |                          |                          |  5. "Present card"       |
    |                          |                          |------------------------>|
    |                          |                          |                         |
    |                          |                          |  6. Card data (encrypted)|
    |                          |                          |<------------------------|
    |                          |                          |                         |
    |                          |  7. AuthResult            |                         |
    |                          |     auth_code="A12345"    |                         |
    |                          |     status=AUTHORIZED     |                         |
    |                          |<-------------------------|                         |
    |                          |                          |                         |
    |                          |  8. Print merchant receipt|                         |
    |                          |     (with tip line)       |                         |
    |                          |                          |                         |
    |  9. Guest writes tip     |                          |                         |
    |     ($18.00)             |                          |                         |
    |------------------------->|                          |                         |
    |                          |                          |                         |
    |                          |  10. capture(             |                         |
    |                          |      pi_xxx,              |                         |
    |                          |      amount=$92.68,       |                         |
    |                          |      tip=$18.00)          |                         |
    |                          |  -> Total: $110.68        |                         |
    |                          |------------------------->|                         |
    |                          |                          |                         |
    |                          |  11. CaptureResult        |                         |
    |                          |      status=CAPTURED      |                         |
    |                          |<-------------------------|                         |
    |                          |                          |                         |
    ============================  END OF DAY  =====================================
    |                          |                          |                         |
    |                          |  12. close_batch()        |                         |
    |                          |------------------------->|                         |
    |                          |                          |                         |
    |                          |  13. BatchResult          |                         |
    |                          |      settled=$X,XXX.XX    |                         |
    |                          |<-------------------------|                         |
```

### Data Model for Transactions

```sql
-- Core transaction table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    check_id UUID NOT NULL REFERENCES checks(id),

    -- Processor info
    processor_name TEXT NOT NULL DEFAULT 'valor',  -- Always 'valor' (Valor PayTech)
    processor_transaction_id TEXT,           -- Processor's reference ID
    processor_batch_id TEXT,                 -- Which batch this settled in
    authorization_code TEXT,                 -- 6-digit auth code

    -- Amounts (all in cents to avoid floating point)
    authorized_amount_cents INTEGER NOT NULL,
    captured_amount_cents INTEGER,
    tip_amount_cents INTEGER DEFAULT 0,
    surcharge_amount_cents INTEGER DEFAULT 0,
    refunded_amount_cents INTEGER DEFAULT 0,

    -- Card info (masked/tokenized only -- NEVER full PAN)
    payment_method TEXT NOT NULL,            -- 'card_emv', 'card_nfc', 'cash', etc.
    card_brand TEXT,                         -- 'visa', 'mastercard', etc.
    card_last_four TEXT,                     -- '4242'
    card_entry_mode TEXT,                    -- 'emv', 'nfc', 'swipe', 'manual'
    card_token TEXT,                         -- Processor token for this card
    is_debit BOOLEAN,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending',  -- See TransactionStatus enum
    authorized_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,

    -- Split payment tracking
    split_group_id UUID,                     -- Links split payments together
    split_sequence INTEGER,                  -- 1st, 2nd, 3rd split payment

    -- Staff
    server_id UUID REFERENCES staff(id),
    manager_approval_id UUID,                -- If manager override was needed
    device_id TEXT,                           -- Which iPad/reader

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processor_raw_response JSONB,            -- Full processor response
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_txn_order ON payment_transactions(order_id);
CREATE INDEX idx_txn_check ON payment_transactions(check_id);
CREATE INDEX idx_txn_restaurant_date ON payment_transactions(restaurant_id, created_at);
CREATE INDEX idx_txn_status ON payment_transactions(status);
CREATE INDEX idx_txn_batch ON payment_transactions(processor_batch_id);
CREATE INDEX idx_txn_split_group ON payment_transactions(split_group_id);
```

## 2.2 Bar Tab Flow

```
  BARTENDER               POS (iPad)                 PROCESSOR
    |                        |                          |
    |  1. Open tab           |                          |
    |  "Customer: John"      |                          |
    |  "Hold card"           |                          |
    |----------------------->|                          |
    |                        |  2. authorize(            |
    |                        |     amount=$50.00,        |  <-- Initial hold amount (configurable)
    |                        |     capture=False)        |
    |                        |------------------------->|
    |                        |  3. AuthResult            |
    |                        |     AUTHORIZED $50.00     |
    |                        |<-------------------------|
    |                        |                          |
    |  4. Add: IPA $8        |                          |
    |  5. Add: Wings $14     |                          |
    |  6. Add: Margarita $12 |                          |
    |  (Running total: $34)  |                          |
    |                        |                          |
    |  7. Add: 2x shots $20  |                          |
    |  (Running total: $54)  |                          |
    |  EXCEEDS $50 AUTH!     |                          |
    |                        |  8. incremental_auth(     |
    |                        |     additional=$50.00)    |  <-- Double the headroom
    |                        |------------------------->|
    |                        |  9. New auth: $100.00     |
    |                        |<-------------------------|
    |                        |                          |
    |  10. Close tab         |                          |
    |  Total: $54.00         |                          |
    |  + Tax: $4.59          |                          |
    |  + Tip: $12.00         |                          |
    |  = $70.59              |                          |
    |                        |  11. capture(             |
    |                        |      amount=$58.59,       |
    |                        |      tip=$12.00)          |
    |                        |  -> Total: $70.59         |
    |                        |------------------------->|
    |                        |  12. CAPTURED $70.59      |
    |                        |<-------------------------|
```

### Bar Tab Edge Cases

```python
# pos/payments/flows/bar_tab.py

from decimal import Decimal
from datetime import datetime, timedelta


class BarTabManager:
    """Handles the lifecycle of bar tabs with all edge cases."""

    # Configurable per restaurant
    DEFAULT_HOLD_AMOUNT = Decimal("50.00")
    MAX_HOLD_AMOUNT = Decimal("500.00")
    AUTO_CLOSE_HOURS = 4           # Auto-close idle tabs after 4 hours
    PRE_AUTH_EXPIRY_DAYS = 7       # Visa/MC pre-auths expire after 7 days
    HEADROOM_MULTIPLIER = 1.5      # When tab exceeds auth, re-auth at 1.5x current total

    async def open_tab(
        self,
        processor: ValorPaymentProcessor,
        device_id: str,
        customer_name: str,
        hold_amount: Decimal | None = None,
    ) -> dict:
        """Open a new bar tab with initial pre-authorization."""
        hold = hold_amount or self.DEFAULT_HOLD_AMOUNT

        result = await processor.authorize(
            amount=hold,
            device_id=device_id,
            order_id=f"tab_{customer_name}_{datetime.now().isoformat()}",
            capture=False,
        )

        if not result.success:
            return {"error": "Card declined", "details": result.decline_reason}

        # Store tab state
        tab = {
            "customer_name": customer_name,
            "processor_txn_id": result.processor_transaction_id,
            "auth_amount": hold,
            "running_total": Decimal("0"),
            "items": [],
            "opened_at": datetime.now(),
            "card_info": result.card_info,
            "status": "open",
        }
        # Save to database...
        return tab

    async def add_item_to_tab(self, tab_id: str, item_amount: Decimal) -> dict:
        """Add item to tab. Check if we need to increase authorization."""
        tab = await self._get_tab(tab_id)
        new_total = tab["running_total"] + item_amount

        # Check if running total exceeds current auth (with buffer for tax+tip)
        estimated_final = new_total * Decimal("1.30")  # 30% buffer for tax + tip

        if estimated_final > tab["auth_amount"]:
            # Need more authorization
            new_auth_target = new_total * self.HEADROOM_MULTIPLIER
            additional = new_auth_target - tab["auth_amount"]

            try:
                result = await self.processor.incremental_auth(
                    tab["processor_txn_id"],
                    additional_amount=additional,
                )
                tab["auth_amount"] = new_auth_target
            except NotImplementedError:
                # Processor doesn't support incremental auth.
                # Strategy: void original auth and create new one at higher amount.
                # Problem: we don't have the card anymore.
                # Solution: use the card token from initial auth.
                if tab["card_info"] and tab["card_info"].token:
                    await self.processor.void(tab["processor_txn_id"])
                    result = await self.processor.authorize_manual(
                        amount=new_auth_target,
                        card_token=tab["card_info"].token,
                        order_id=tab_id,
                        capture=False,
                    )
                    tab["processor_txn_id"] = result.processor_transaction_id
                    tab["auth_amount"] = new_auth_target
                else:
                    # Can't increase auth and don't have token.
                    # Allow the charge but flag for manager attention.
                    tab["over_auth"] = True
                    tab["over_auth_amount"] = estimated_final - tab["auth_amount"]

        tab["running_total"] = new_total
        tab["items"].append({"amount": item_amount, "added_at": datetime.now()})
        return tab

    async def close_tab(
        self,
        tab_id: str,
        tip_amount: Decimal = Decimal("0"),
        tax_amount: Decimal = Decimal("0"),
    ) -> dict:
        """Close tab: calculate final amount and capture."""
        tab = await self._get_tab(tab_id)
        subtotal = tab["running_total"]
        total = subtotal + tax_amount

        result = await self.processor.capture(
            processor_transaction_id=tab["processor_txn_id"],
            amount=total,
            tip_amount=tip_amount,
        )

        if result.success:
            tab["status"] = "closed"
            tab["final_amount"] = total + tip_amount
            tab["tip_amount"] = tip_amount
        else:
            # Card declined on capture -- rare but possible
            # (e.g., card reported lost between auth and capture)
            tab["status"] = "capture_failed"
            tab["capture_error"] = result.error_message
            # Manager must handle: try different card, comp the tab, etc.

        return tab

    async def handle_walkout(self, tab_id: str) -> dict:
        """
        Customer left without closing tab.
        Strategy: capture at running total + auto-gratuity (configurable).
        """
        tab = await self._get_tab(tab_id)
        subtotal = tab["running_total"]
        tax = subtotal * Decimal("0.085")  # Calculate tax
        auto_grat = subtotal * Decimal("0.20")  # 20% auto-gratuity for walkouts

        result = await self.processor.capture(
            processor_transaction_id=tab["processor_txn_id"],
            amount=subtotal + tax,
            tip_amount=auto_grat,
        )

        tab["status"] = "walkout"
        tab["auto_gratuity_applied"] = True
        tab["auto_gratuity_amount"] = auto_grat
        return tab

    async def auto_close_stale_tabs(self):
        """
        Cron job: find tabs open longer than AUTO_CLOSE_HOURS and close them.
        Also find tabs approaching pre-auth expiry (7 days) and alert manager.
        """
        cutoff = datetime.now() - timedelta(hours=self.AUTO_CLOSE_HOURS)
        stale_tabs = await self._get_tabs_opened_before(cutoff)

        for tab in stale_tabs:
            if tab["running_total"] > 0:
                await self.close_tab(tab["id"])
            else:
                # Empty tab -- just void the auth
                await self.processor.void(tab["processor_txn_id"])
                tab["status"] = "voided"

        # Check for pre-auth expiry approaching
        expiry_cutoff = datetime.now() - timedelta(days=self.PRE_AUTH_EXPIRY_DAYS - 1)
        expiring_tabs = await self._get_tabs_opened_before(expiry_cutoff)
        for tab in expiring_tabs:
            # Alert manager: this tab's auth will expire tomorrow
            await self._alert_manager(
                f"Tab for {tab['customer_name']} will expire. "
                f"Running total: ${tab['running_total']}. Close immediately."
            )
```

## 2.3 Split Payment Flow

```python
# pos/payments/flows/split_payment.py

import uuid
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass


@dataclass
class SplitPortion:
    """One portion of a split payment."""
    portion_id: str
    amount: Decimal
    tax: Decimal
    payment_method: str      # "card", "cash", "gift_card"
    items: list[str]         # Item IDs assigned to this portion (for split-by-item)
    paid: bool = False
    transaction_id: str | None = None


class SplitPaymentManager:

    async def split_equal(
        self,
        check_total: Decimal,
        check_tax: Decimal,
        num_ways: int,
    ) -> list[SplitPortion]:
        """
        Split check equally N ways.
        Handle penny rounding: first portion absorbs remainder.
        """
        per_person_subtotal = (check_total / num_ways).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        per_person_tax = (check_tax / num_ways).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        portions = []
        running_total = Decimal("0")
        running_tax = Decimal("0")

        for i in range(num_ways):
            if i == num_ways - 1:
                # Last person gets remainder to ensure exact total
                amount = check_total - running_total
                tax = check_tax - running_tax
            else:
                amount = per_person_subtotal
                tax = per_person_tax

            portions.append(SplitPortion(
                portion_id=str(uuid.uuid4()),
                amount=amount,
                tax=tax,
                payment_method="card",
                items=[],
            ))
            running_total += amount
            running_tax += tax

        return portions

    async def split_by_item(
        self,
        check_items: list[dict],     # [{"id": "x", "name": "Steak", "price": 42.00, "tax": 3.57}]
        assignments: dict[str, list[str]],  # {"guest_1": ["item_1", "item_3"], "guest_2": ["item_2"]}
    ) -> list[SplitPortion]:
        """Split by assigning specific items to each guest."""
        item_lookup = {item["id"]: item for item in check_items}
        portions = []

        for guest_id, item_ids in assignments.items():
            amount = sum(Decimal(str(item_lookup[iid]["price"])) for iid in item_ids)
            tax = sum(Decimal(str(item_lookup[iid]["tax"])) for iid in item_ids)
            portions.append(SplitPortion(
                portion_id=guest_id,
                amount=amount,
                tax=tax,
                payment_method="card",
                items=item_ids,
            ))

        return portions

    async def split_custom_amounts(
        self,
        check_total: Decimal,
        check_tax: Decimal,
        amounts: list[Decimal],
    ) -> list[SplitPortion]:
        """
        Split by custom dollar amounts.
        Tax is distributed proportionally.
        Validates total matches check total.
        """
        if sum(amounts) != check_total:
            raise ValueError(
                f"Split amounts ({sum(amounts)}) don't equal check total ({check_total})"
            )

        portions = []
        for i, amount in enumerate(amounts):
            proportion = amount / check_total
            tax = (check_tax * proportion).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            portions.append(SplitPortion(
                portion_id=str(uuid.uuid4()),
                amount=amount,
                tax=tax,
                payment_method="card",
                items=[],
            ))

        return portions

    async def process_split_portions(
        self,
        portions: list[SplitPortion],
        processor: "ValorPaymentProcessor",
        device_id: str,
        check_id: str,
    ) -> dict:
        """
        Process each portion sequentially. Each gets its own auth.
        Mixed tender: some portions may be cash, some card, some gift card.
        """
        split_group_id = str(uuid.uuid4())
        results = []

        for i, portion in enumerate(portions):
            total = portion.amount + portion.tax

            if portion.payment_method == "cash":
                # Cash doesn't need processor auth
                results.append({
                    "portion_id": portion.portion_id,
                    "method": "cash",
                    "amount": total,
                    "status": "paid",
                })
                portion.paid = True
                continue

            if portion.payment_method == "gift_card":
                gc_result = await processor.gift_card_redeem(
                    amount=total,
                    device_id=device_id,
                )
                if gc_result.success:
                    if gc_result.amount_applied < total:
                        # Partial gift card -- remainder needs another payment
                        remainder = total - gc_result.amount_applied
                        results.append({
                            "portion_id": portion.portion_id,
                            "method": "gift_card",
                            "amount": gc_result.amount_applied,
                            "status": "partial",
                            "remainder": remainder,
                        })
                    else:
                        results.append({
                            "portion_id": portion.portion_id,
                            "method": "gift_card",
                            "amount": total,
                            "status": "paid",
                        })
                        portion.paid = True
                continue

            # Card payment
            auth_result = await processor.authorize(
                amount=total,
                device_id=device_id,
                order_id=f"{check_id}_split_{i+1}",
                capture=False,  # Auth only -- tip will be added later
            )

            results.append({
                "portion_id": portion.portion_id,
                "method": "card",
                "amount": total,
                "status": "authorized" if auth_result.success else "declined",
                "processor_txn_id": auth_result.processor_transaction_id,
                "card_info": auth_result.card_info,
                "split_group_id": split_group_id,
                "split_sequence": i + 1,
            })

            if auth_result.success:
                portion.paid = True
                portion.transaction_id = auth_result.processor_transaction_id
            else:
                # One split declined -- ask for different card
                # Don't void the others yet
                results[-1]["action_needed"] = "present_different_card"

        return {
            "split_group_id": split_group_id,
            "portions": results,
            "all_paid": all(p.paid for p in portions),
        }
```

## 2.4 Cash Payment Flow

```python
# pos/payments/flows/cash.py

from decimal import Decimal, ROUND_HALF_UP


class CashPaymentManager:

    async def process_cash_payment(
        self,
        check_total: Decimal,
        cash_tendered: Decimal,
    ) -> dict:
        """Process cash payment and calculate change."""
        if cash_tendered < check_total:
            return {
                "success": False,
                "error": "Insufficient cash",
                "short_by": check_total - cash_tendered,
            }

        change = cash_tendered - check_total

        return {
            "success": True,
            "check_total": check_total,
            "cash_tendered": cash_tendered,
            "change_due": change,
            "denomination_suggestion": self._suggest_change(change),
            "open_drawer": True,  # Signal to kick cash drawer
        }

    def _suggest_change(self, amount: Decimal) -> dict:
        """Suggest optimal change denomination breakdown."""
        cents = int(amount * 100)
        denominations = {
            "twenties": 0, "tens": 0, "fives": 0, "ones": 0,
            "quarters": 0, "dimes": 0, "nickels": 0, "pennies": 0,
        }

        for name, value in [
            ("twenties", 2000), ("tens", 1000), ("fives", 500), ("ones", 100),
            ("quarters", 25), ("dimes", 10), ("nickels", 5), ("pennies", 1),
        ]:
            denominations[name] = cents // value
            cents %= value

        return denominations

    async def cash_drawer_reconciliation(
        self,
        expected_cash: Decimal,     # POS-calculated cash total for shift
        counted_cash: Decimal,      # Actual cash counted in drawer
        starting_bank: Decimal,     # Opening cash amount
    ) -> dict:
        """End-of-shift cash drawer reconciliation."""
        expected_in_drawer = starting_bank + expected_cash
        variance = counted_cash - expected_in_drawer

        return {
            "starting_bank": starting_bank,
            "cash_sales": expected_cash,
            "expected_total": expected_in_drawer,
            "actual_count": counted_cash,
            "variance": variance,
            "over_short": "over" if variance > 0 else "short" if variance < 0 else "balanced",
            "requires_manager_review": abs(variance) > Decimal("5.00"),
        }
```

## 2.5 Gift Card System

Decision: **Build our own gift card system** managed entirely within Sear's platform.

Why: Gift cards are a Sear-managed feature, independent of Valor's payment processing. This means gift card balances, activations, and redemptions are stored in Sear's database and work across all locations. Payment flows for purchasing gift cards go through Valor, but the gift card ledger itself is Sear's.

```sql
-- Gift card tables
CREATE TABLE gift_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    card_number TEXT NOT NULL UNIQUE,       -- Unique identifier (printed on card)
    card_number_hash TEXT NOT NULL,         -- SHA-256 hash for lookups
    pin TEXT,                               -- Optional PIN (hashed)
    balance_cents INTEGER NOT NULL DEFAULT 0,
    initial_load_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active, frozen, expired, redeemed_full

    -- Physical vs digital
    card_type TEXT NOT NULL DEFAULT 'physical',  -- 'physical', 'digital'

    -- Purchased by
    purchased_by_customer_id UUID,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purchased_order_id UUID,               -- The order where this was sold

    -- Recipient
    recipient_name TEXT,
    recipient_email TEXT,                   -- For digital cards
    recipient_phone TEXT,

    -- Expiration (varies by state law -- some states prohibit expiration)
    expires_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id),
    transaction_type TEXT NOT NULL,         -- 'activation', 'redemption', 'reload', 'adjustment', 'expiration'
    amount_cents INTEGER NOT NULL,          -- Positive for loads, negative for redemptions
    balance_after_cents INTEGER NOT NULL,
    order_id UUID,                          -- Associated POS order
    performed_by UUID REFERENCES staff(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gc_number ON gift_cards(card_number_hash);
CREATE INDEX idx_gc_restaurant ON gift_cards(restaurant_id);
CREATE INDEX idx_gct_card ON gift_card_transactions(gift_card_id);
```

```python
# pos/payments/gift_cards.py

import hashlib
import secrets
from decimal import Decimal


class GiftCardSystem:
    """
    Sear's own gift card system -- managed independently from Valor payment processing.
    Gift card balances live in Sear's database. Payment for purchasing gift cards
    flows through Valor. Redemptions are applied as a Sear-side balance deduction.
    """

    def generate_card_number(self) -> str:
        """Generate a unique 16-digit gift card number."""
        # Format: XXXX-XXXX-XXXX-XXXX
        digits = ''.join(str(secrets.randbelow(10)) for _ in range(16))
        return f"{digits[:4]}-{digits[4:8]}-{digits[8:12]}-{digits[12:]}"

    async def activate(
        self,
        restaurant_id: str,
        amount: Decimal,
        card_type: str = "physical",
        recipient_email: str | None = None,
    ) -> dict:
        """
        Activate a new gift card with initial balance.
        For physical: associate number printed on card.
        For digital: generate number and email to recipient.
        """
        card_number = self.generate_card_number()

        card = await self.db.insert("gift_cards", {
            "restaurant_id": restaurant_id,
            "card_number": card_number,
            "card_number_hash": hashlib.sha256(card_number.encode()).hexdigest(),
            "balance_cents": int(amount * 100),
            "initial_load_cents": int(amount * 100),
            "card_type": card_type,
            "recipient_email": recipient_email,
            "status": "active",
        })

        await self.db.insert("gift_card_transactions", {
            "gift_card_id": card["id"],
            "transaction_type": "activation",
            "amount_cents": int(amount * 100),
            "balance_after_cents": int(amount * 100),
        })

        if card_type == "digital" and recipient_email:
            await self._send_digital_card_email(recipient_email, card_number, amount)

        return card

    async def check_balance(self, card_number: str) -> Decimal:
        """Look up gift card balance."""
        card = await self._find_card(card_number)
        if not card:
            raise ValueError("Gift card not found")
        if card["status"] != "active":
            raise ValueError(f"Gift card is {card['status']}")
        return Decimal(card["balance_cents"]) / 100

    async def redeem(
        self,
        card_number: str,
        amount: Decimal,
        order_id: str,
    ) -> dict:
        """
        Redeem from gift card. Supports partial redemption.
        Returns amount applied and remaining balance.
        """
        card = await self._find_card(card_number)
        if not card or card["status"] != "active":
            return {"success": False, "error": "Card not active"}

        balance = Decimal(card["balance_cents"]) / 100
        amount_to_apply = min(amount, balance)
        new_balance = balance - amount_to_apply

        # Update balance
        await self.db.update("gift_cards", card["id"], {
            "balance_cents": int(new_balance * 100),
            "status": "redeemed_full" if new_balance == 0 else "active",
        })

        await self.db.insert("gift_card_transactions", {
            "gift_card_id": card["id"],
            "transaction_type": "redemption",
            "amount_cents": -int(amount_to_apply * 100),
            "balance_after_cents": int(new_balance * 100),
            "order_id": order_id,
        })

        return {
            "success": True,
            "amount_applied": amount_to_apply,
            "remaining_balance": new_balance,
            "fully_redeemed": new_balance == 0,
            "remaining_on_check": amount - amount_to_apply if amount_to_apply < amount else Decimal("0"),
        }

    async def reload(self, card_number: str, amount: Decimal) -> dict:
        """Add funds to existing gift card."""
        card = await self._find_card(card_number)
        if not card:
            return {"success": False, "error": "Card not found"}

        new_balance = Decimal(card["balance_cents"]) / 100 + amount

        await self.db.update("gift_cards", card["id"], {
            "balance_cents": int(new_balance * 100),
            "status": "active",
        })

        await self.db.insert("gift_card_transactions", {
            "gift_card_id": card["id"],
            "transaction_type": "reload",
            "amount_cents": int(amount * 100),
            "balance_after_cents": int(new_balance * 100),
        })

        return {"success": True, "new_balance": new_balance}
```

## 2.6 Refund/Void Flow

```python
# pos/payments/flows/refunds.py

from decimal import Decimal
from datetime import datetime


class RefundManager:

    # Business rules
    REQUIRE_MANAGER_FOR_REFUND_OVER = Decimal("50.00")
    REQUIRE_MANAGER_FOR_UNLINKED_REFUND = True
    MAX_REFUND_DAYS = 120  # Don't allow refunds older than 120 days

    async def void_transaction(
        self,
        transaction_id: str,
        staff_id: str,
        reason: str,
        manager_pin: str | None = None,
    ) -> dict:
        """
        Void a transaction BEFORE batch settlement.
        Releases hold immediately. No interchange cost.
        """
        txn = await self._get_transaction(transaction_id)

        # Can only void before settlement
        if txn["status"] == "settled":
            return {
                "success": False,
                "error": "Transaction already settled. Use refund instead.",
            }

        # Manager approval for voids over threshold
        if Decimal(str(txn["captured_amount_cents"])) / 100 > self.REQUIRE_MANAGER_FOR_REFUND_OVER:
            if not manager_pin:
                return {"success": False, "error": "Manager approval required", "needs_manager": True}
            if not await self._verify_manager_pin(manager_pin):
                return {"success": False, "error": "Invalid manager PIN"}

        processor = self._get_processor(txn["processor_name"], txn["restaurant_id"])
        result = await processor.void(txn["processor_transaction_id"])

        if result.success:
            await self._update_transaction(transaction_id, {
                "status": "voided",
                "voided_at": datetime.now(),
                "void_reason": reason,
                "voided_by": staff_id,
            })

            # Log for audit trail
            await self._log_action("void", transaction_id, staff_id, reason)

        return {
            "success": result.success,
            "original_amount": Decimal(str(txn["captured_amount_cents"])) / 100,
            "void_reason": reason,
        }

    async def refund_transaction(
        self,
        transaction_id: str,
        amount: Decimal | None,    # None = full refund
        staff_id: str,
        reason: str,
        manager_pin: str | None = None,
        refund_to_different_card: bool = False,
        new_card_device_id: str | None = None,
    ) -> dict:
        """
        Refund a settled transaction. Creates a new credit transaction.

        Business rules:
        - Full refunds: credit back the full captured amount
        - Partial refunds: credit specified amount (tip excluded or included based on config)
        - Unlinked refunds (different card): always require manager approval
        - Refunds generate interchange cost to the restaurant (they eat the fees both ways)
        """
        txn = await self._get_transaction(transaction_id)

        # Validation
        if txn["status"] not in ("captured", "settled", "partially_refunded"):
            return {"success": False, "error": f"Cannot refund transaction in status: {txn['status']}"}

        original_amount = Decimal(str(txn["captured_amount_cents"])) / 100
        already_refunded = Decimal(str(txn.get("refunded_amount_cents", 0))) / 100
        max_refundable = original_amount - already_refunded
        refund_amount = amount or max_refundable

        if refund_amount > max_refundable:
            return {
                "success": False,
                "error": f"Max refundable: ${max_refundable}. Already refunded: ${already_refunded}.",
            }

        # Age check
        txn_date = txn["captured_at"] or txn["created_at"]
        days_old = (datetime.now() - txn_date).days
        if days_old > self.MAX_REFUND_DAYS:
            return {
                "success": False,
                "error": f"Transaction is {days_old} days old. Max refund window: {self.MAX_REFUND_DAYS} days.",
            }

        # Manager approval
        needs_manager = (
            refund_amount > self.REQUIRE_MANAGER_FOR_REFUND_OVER
            or refund_to_different_card
        )
        if needs_manager:
            if not manager_pin:
                return {"success": False, "error": "Manager approval required", "needs_manager": True}
            if not await self._verify_manager_pin(manager_pin):
                return {"success": False, "error": "Invalid manager PIN"}

        processor = self._get_processor(txn["processor_name"], txn["restaurant_id"])

        if refund_to_different_card:
            # Unlinked refund -- need to read a new card
            result = await processor.unlinked_refund(
                amount=refund_amount,
                card_token="",  # Will be obtained by reading card on reader
                reason=reason,
            )
        else:
            # Standard linked refund -- credits back to original card
            result = await processor.refund(
                processor_transaction_id=txn["processor_transaction_id"],
                amount=refund_amount if amount else None,
            )

        if result.success:
            new_refunded_total = already_refunded + refund_amount
            new_status = (
                "refunded" if new_refunded_total >= original_amount
                else "partially_refunded"
            )
            await self._update_transaction(transaction_id, {
                "status": new_status,
                "refunded_amount_cents": int(new_refunded_total * 100),
            })
            await self._log_action("refund", transaction_id, staff_id, reason, {
                "refund_amount": str(refund_amount),
                "refund_id": result.refund_id,
            })

        return {
            "success": result.success,
            "refund_amount": refund_amount,
            "remaining_refundable": max_refundable - refund_amount,
            "error": result.error_message if not result.success else None,
        }
```

## 2.7 Surcharging / Cash Discount

```python
# pos/payments/surcharge.py

from decimal import Decimal


# States that PROHIBIT surcharging as of 2026
# (Check periodically -- this list changes as laws evolve)
SURCHARGE_PROHIBITED_STATES = {
    "CT",  # Connecticut
    "MA",  # Massachusetts
    "PR",  # Puerto Rico
}

# States with specific surcharge cap (most cap at 3% or the merchant's cost, whichever is lower)
# Federal cap via card network rules: 3% for Visa, 4% for Mastercard
SURCHARGE_CAPS = {
    "CO": Decimal("2.00"),   # Colorado caps at 2%
    # Most other states follow card network rules: min(merchant_discount_rate, 3%)
    "_default": Decimal("3.00"),
}

# Visa and Mastercard rules (as of 2025):
# - Surcharge cannot exceed merchant's cost of acceptance
# - Surcharge cannot exceed 3% (Visa) or 4% (Mastercard)
# - Debit cards CANNOT be surcharged (federal Durbin Amendment)
# - Prepaid cards CANNOT be surcharged
# - Must disclose at point of entry (signage) AND point of sale (receipt)
# - Must register surcharge program with card networks (30-day notice for Visa)


class SurchargeCalculator:

    def __init__(self, restaurant_config: dict):
        """
        restaurant_config includes:
        - state: str (2-letter)
        - surcharge_enabled: bool
        - surcharge_rate: Decimal (e.g., 0.03 for 3%)
        - merchant_discount_rate: Decimal (their actual processing cost)
        - program_type: "surcharge" or "cash_discount"
        """
        self.config = restaurant_config

    def calculate_surcharge(
        self,
        subtotal: Decimal,
        card_brand: str,
        is_debit: bool,
    ) -> dict:
        """
        Calculate surcharge for a card transaction.
        Returns surcharge amount and whether it's allowed.
        """
        state = self.config["state"]

        # Check state prohibition
        if state in SURCHARGE_PROHIBITED_STATES:
            return {
                "surcharge_amount": Decimal("0"),
                "surcharge_rate": Decimal("0"),
                "is_allowed": False,
                "reason": f"Surcharging prohibited in {state}",
            }

        # Debit cards cannot be surcharged (Durbin Amendment)
        if is_debit:
            return {
                "surcharge_amount": Decimal("0"),
                "surcharge_rate": Decimal("0"),
                "is_allowed": False,
                "reason": "Debit cards cannot be surcharged (federal law)",
            }

        # Calculate allowed rate
        merchant_rate = self.config["merchant_discount_rate"]
        state_cap = SURCHARGE_CAPS.get(state, SURCHARGE_CAPS["_default"])

        # Network caps
        network_cap = Decimal("3.00") if card_brand == "visa" else Decimal("4.00")

        # Effective cap: lowest of merchant rate, state cap, network cap
        effective_rate = min(merchant_rate, state_cap, network_cap)

        # Restaurant may set rate lower than cap
        applied_rate = min(self.config["surcharge_rate"], effective_rate)

        surcharge = (subtotal * applied_rate / 100).quantize(Decimal("0.01"))

        return {
            "surcharge_amount": surcharge,
            "surcharge_rate": applied_rate,
            "is_allowed": True,
            "reason": f"Surcharge of {applied_rate}% applied",
            "must_display": True,                  # Must show on receipt as separate line
            "receipt_text": f"Credit Card Surcharge ({applied_rate}%): ${surcharge}",
        }

    def calculate_cash_discount(
        self,
        menu_price: Decimal,
        discount_rate: Decimal | None = None,
    ) -> dict:
        """
        Cash discount (dual pricing) model — powered by Valor PayTech's Dual Pricing.
        Menu prices are the CARD price. Cash customers get a discount.

        This is Valor's key differentiator and Sear's primary cost advantage:
        1. Not technically a surcharge (it's a discount for cash)
        2. Legal in all 50 states
        3. Easier compliance (no card network registration)
        4. Can offset up to 100% of processing fees for the restaurant

        How it works:
        - Menu shows: "Burger $15.00 (cash price: $14.55)"
        - Valor VP800 dual display shows both prices to customer
        - Sear's menu management auto-calculates both prices
        """
        rate = discount_rate or self.config.get("cash_discount_rate", Decimal("3.00"))
        discount = (menu_price * rate / 100).quantize(Decimal("0.01"))
        cash_price = menu_price - discount

        return {
            "card_price": menu_price,       # What they pay with card
            "cash_price": cash_price,       # What they pay with cash
            "discount_amount": discount,
            "discount_rate": rate,
            # Compliance requirements:
            "signage_required": True,        # Must post at entrance and at register
            "receipt_must_show": True,       # Receipt must show cash discount as line item
            "receipt_text": f"Cash Discount ({rate}%): -${discount}",
        }
```

### Compliance Requirements for Surcharging

```
SIGNAGE REQUIREMENTS (if surcharging):
1. Point of entry: "We impose a surcharge of X% on credit card transactions.
   This surcharge is not greater than our cost of acceptance."
2. Point of sale: Terminal/receipt display showing surcharge amount
3. Receipt: Surcharge must appear as separate line item

REGISTRATION:
- Visa: Must notify Visa 30 days before implementing surcharge
  (via acquirer/processor)
- Mastercard: Must register through processor
- Both: Must re-register annually

CASH DISCOUNT (dual pricing) -- simpler:
1. Signage at entrance: "We offer a X% discount for cash payments"
2. All advertised prices must be the HIGHER (card) price
3. Discount shown as line item on receipt
4. No card network registration required
```

---

# 3. PCI COMPLIANCE ARCHITECTURE

## PCI Scope Analysis

```
OUR GOAL: SAQ B-IP (or SAQ A if using hosted payment page for online)

SAQ B-IP requirements:
- Standalone, IP-connected POI terminals (P2PE validated)
- No electronic cardholder data storage
- No connection between POI device and other systems that store CHD

HOW WE ACHIEVE THIS:

+-------------------+     +-----------------+     +------------------+
|   iPad (POS App)  |     | Valor Terminal  |     | Valor PayTech    |
|                   |     | (P2PE Device)   |     | (routes to TSYS/ |
| - Sends amount    |---->| - Collects card |---->|  Fiserv/WorldPay)|
| - Receives token  |     | - Encrypts at   |     | - Decrypts       |
| - Receives last4  |<----| - hardware level|<----| - Authorizes     |
| - NEVER sees PAN  |     | - PCI P2PE      |     | - Returns token  |
+-------------------+     +-----------------+     +------------------+
         |
         v
+-------------------+
| Our Server        |
| (Flask/Supabase)  |
| - Stores tokens   |
| - Stores last4    |
| - Stores auth code|
| - NEVER stores:   |
|   - Full PAN      |
|   - CVV           |
|   - Track data    |
|   - PIN blocks    |
+-------------------+
```

## What We CAN Store

```
SAFE TO STORE (not considered CHD):
- Truncated PAN (first 6 + last 4, or just last 4)
- Cardholder name
- Expiration date (after authorization)
- Processor tokens (opaque strings that map to cards)
- Authorization codes
- Transaction IDs

NEVER STORE (brings you into full PCI DSS scope):
- Full PAN (primary account number)
- CVV/CVC/CVV2
- Full magnetic stripe data (track 1, track 2)
- PIN or PIN block
- Card verification values from chip
```

## PCI DSS 4.0 Requirements That Apply to Us

Even at SAQ B-IP level, we must comply with:

```
REQUIREMENT 1: Network Security Controls
- Firewall between our systems and internet: YES (GCP VPC firewall)
- No direct internet access to database: YES (Supabase handles this)
- Our action: Configure GCP firewall rules. Document network diagram.

REQUIREMENT 2: Secure Configurations
- Change default passwords on all systems: YES
- Remove unnecessary services: YES
- Our action: Hardened GCP VM, no unnecessary ports, SSH key-only.

REQUIREMENT 3: Protect Stored Account Data
- We don't store CHD, so most of Req 3 is N/A.
- We DO store tokens/truncated PAN -- must protect with access controls.
- Our action: Encrypt tokens at rest in Supabase. Row-level security.

REQUIREMENT 4: Encrypt Transmission
- All transmission over TLS 1.2+: YES
- iPad to reader: Bluetooth encrypted (handled by SDK)
- iPad to server: HTTPS with TLS 1.3
- Server to processor: HTTPS with TLS 1.2+ (processor requirement)
- Our action: Enforce TLS 1.2 minimum. HSTS headers. Certificate monitoring.

REQUIREMENT 5: Anti-Malware
- Applicable to our server: YES
- Our action: ClamAV or similar on GCP VM. Automated scans.

REQUIREMENT 6: Secure Development
- Secure SDLC: YES
- Code reviews, vulnerability remediation, web app protection
- Our action: GitHub PR reviews. Dependency scanning. WAF on GCP.
- PCI DSS 4.0 NEW: Script integrity for payment pages (CSP headers)

REQUIREMENT 7: Restrict Access
- Need-to-know access to payment systems: YES
- Our action: Role-based access in Supabase. Minimum privilege.

REQUIREMENT 8: Authentication
- Unique IDs for all users: YES
- MFA for admin access: YES (PCI 4.0 requires MFA for ALL access to CDE)
- Our action: Individual accounts for staff. MFA for manager/admin.
- Password policy: 12+ chars, complexity requirements.

REQUIREMENT 9: Physical Security
- Protect card readers from tampering: YES
- Our action: Inspect readers regularly. Tamper-evident stickers.
            Train staff to recognize skimmers.

REQUIREMENT 10: Logging & Monitoring
- Log all access to payment systems: YES
- Retain logs 12 months (3 months immediately available)
- Our action: Supabase audit logs. GCP Cloud Logging.
            Alert on unusual transaction patterns.

REQUIREMENT 11: Security Testing
- Quarterly network vulnerability scans by ASV: YES
- Annual penetration test: YES
- Our action: Engage PCI ASV (like Qualys, SecurityMetrics).
            Budget ~$500-2000/year for ASV scans.
            Budget ~$5,000-15,000/year for annual pentest.

REQUIREMENT 12: Security Policy
- Information security policy: YES
- Incident response plan: YES
- Our action: Document policies. Annual staff security training.
```

## P2PE Device Strategy

```
P2PE (Point-to-Point Encryption) is the KEY to minimal PCI scope.

How P2PE works:
1. Card reader encrypts card data at the hardware level (in the reader's secure element)
2. Encrypted data passes through our iPad app as opaque blob
3. Our app NEVER sees the decrypted card data
4. Only the processor can decrypt (using HSM on their end)
5. This means our iPad app and server are OUT of PCI CDE scope

P2PE-validated terminals for Sear POS:
- Valor PayTech: VP800, VP550, VP300 Pro, RCKT, VL500 (Valor-managed P2PE)
- All Valor terminals encrypt at the hardware level before any data leaves the device
- Valor routes encrypted data to backend processor (TSYS, Fiserv, WorldPay, Elavon, etc.)

CRITICAL: Use ONLY P2PE-validated readers. This is the single most
important architectural decision for PCI compliance.
```

## Annual Compliance Calendar

```
MONTHLY:
- Review access logs for payment systems
- Check for security patches on all systems
- Verify reader firmware is current

QUARTERLY:
- ASV vulnerability scan (external network scan)
- Review firewall rules
- Review user access lists (remove terminated employees)

ANNUALLY:
- Complete SAQ B-IP self-assessment questionnaire
- Penetration test (or every 6 months for Level 1/2 merchants)
- Staff security awareness training
- Review and update security policies
- Attest compliance to processor/acquirer
- Review incident response plan
- Review and update network diagram

COSTS (annual):
- ASV scanning: $500-1,500/year
- Penetration test: $5,000-15,000/year
- PCI compliance fee (processor): $0-100/year
- Our time: ~40 hours/year for documentation, reviews, testing
- Total: ~$6,000-17,000/year (we should build this into software pricing)
```

---

# 4. TIPPING ARCHITECTURE

## Tip Flow

```
TWO TIP COLLECTION MODELS:

MODEL A: "Tip on Receipt" (traditional full-service)
1. Auth for check amount (subtotal + tax)
2. Print receipt with tip line
3. Customer writes tip + signs
4. Server enters tip amount in POS
5. POS calls capture(auth_amount, tip_amount) -> captures total
6. Tip stored separately for reporting

MODEL B: "Tip on Screen" (counter-service / fast-casual)
1. Customer order totaled
2. Before card collection, iPad shows tip prompt:
   [15%] [18%] [20%] [Custom] [No Tip]
3. Customer selects tip on iPad
4. POS creates auth for total (subtotal + tax + tip) as a sale (auth+capture)
5. Tip stored separately for reporting

Valor terminals support "on-reader tipping" where the tip prompt
appears on the terminal's customer-facing screen (VP800 dual display,
VP550). The RCKT mobile terminal also supports on-device tipping.
```

## Tip Calculation Engine

```python
# pos/payments/tips.py

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


class TipCalculator:
    """
    Configurable tip calculator.
    Key decision: pre-tax vs post-tax tip calculation.
    Most restaurants calculate suggested tips on pre-tax amount,
    but some (especially in NYC) calculate on post-tax.
    """

    def __init__(self, config: dict):
        self.calculate_on = config.get("tip_calculate_on", "pre_tax")  # "pre_tax" or "post_tax"
        self.suggested_percentages = config.get("tip_percentages", [18, 20, 22])
        self.default_percentage = config.get("default_tip_percentage", 20)
        self.auto_gratuity_threshold = config.get("auto_gratuity_party_size", 6)
        self.auto_gratuity_percentage = config.get("auto_gratuity_percentage", 20)

    def calculate_suggested_tips(
        self,
        subtotal: Decimal,
        tax: Decimal,
    ) -> list[dict]:
        """Generate tip suggestions for customer-facing display."""
        base_amount = subtotal if self.calculate_on == "pre_tax" else subtotal + tax

        suggestions = []
        for pct in self.suggested_percentages:
            tip_amount = (base_amount * Decimal(pct) / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            total = subtotal + tax + tip_amount
            suggestions.append({
                "percentage": pct,
                "tip_amount": tip_amount,
                "total_with_tip": total,
                "label": f"{pct}%",
            })

        return suggestions

    def calculate_auto_gratuity(
        self,
        subtotal: Decimal,
        party_size: int,
    ) -> dict:
        """
        Auto-gratuity for large parties.
        Applied before card is run -- added to the check as a line item.
        Must be clearly disclosed on menu/receipt.

        IRS treats auto-gratuity as SERVICE CHARGE (not tip):
        - Subject to payroll tax
        - Restaurant must pay it out (cannot be withheld)
        - Must be reported as wages, not tips
        - This matters for payroll!
        """
        if party_size < self.auto_gratuity_threshold:
            return {"applies": False}

        gratuity = (subtotal * Decimal(self.auto_gratuity_percentage) / 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        return {
            "applies": True,
            "party_size": party_size,
            "percentage": self.auto_gratuity_percentage,
            "gratuity_amount": gratuity,
            "is_service_charge": True,  # IRS classification
            "receipt_label": f"Gratuity ({self.auto_gratuity_percentage}%) - Party of {party_size}",
            "additional_tip_allowed": True,  # Customer can still add more
        }
```

## Tip Distribution Models

```python
# pos/payments/tip_distribution.py

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass


@dataclass
class TipShare:
    staff_id: str
    staff_name: str
    role: str
    amount: Decimal
    source: str           # "direct", "pool", "tipout"


class TipDistributor:
    """
    Handles all tip distribution models.
    Restaurants configure their model per-location.
    """

    async def distribute_direct(
        self,
        server_id: str,
        tip_amount: Decimal,
        tipout_rules: list[dict] | None = None,
    ) -> list[TipShare]:
        """
        Direct tipping: server keeps their tips, minus tipouts.

        tipout_rules example:
        [
            {"role": "busser", "type": "percentage", "value": 3},    # 3% of sales
            {"role": "bartender", "type": "percentage", "value": 5}, # 5% of sales
            {"role": "food_runner", "type": "percentage", "value": 2}, # 2% of sales
        ]

        Important: tipouts are usually calculated on SALES, not on tips.
        This means if a server sells $1000 and gets $200 in tips:
        - Busser tipout = $1000 * 3% = $30 (from sales, NOT from tips)
        """
        shares = []
        total_tipout = Decimal("0")

        if tipout_rules:
            for rule in tipout_rules:
                # Tipout percentages are on sales, calculated elsewhere
                # Here we just deduct from the tip pool
                tipout_amount = rule.get("calculated_amount", Decimal("0"))
                total_tipout += tipout_amount
                shares.append(TipShare(
                    staff_id=rule["staff_id"],
                    staff_name=rule["staff_name"],
                    role=rule["role"],
                    amount=tipout_amount,
                    source="tipout",
                ))

        # Server gets remainder
        server_amount = tip_amount - total_tipout
        shares.insert(0, TipShare(
            staff_id=server_id,
            staff_name="",  # Filled from DB
            role="server",
            amount=server_amount,
            source="direct",
        ))

        return shares

    async def distribute_pool(
        self,
        total_tips: Decimal,
        participating_staff: list[dict],
        method: str = "hours_worked",
    ) -> list[TipShare]:
        """
        Tip pool: all tips go into pool, distributed by hours worked or points.

        participating_staff example:
        [
            {"staff_id": "abc", "name": "Alice", "role": "server", "hours": 8.0, "points": None},
            {"staff_id": "def", "name": "Bob", "role": "server", "hours": 6.0, "points": None},
            {"staff_id": "ghi", "name": "Carol", "role": "bartender", "hours": 7.0, "points": None},
        ]

        method options:
        - "hours_worked": proportional to hours worked
        - "equal": equal split regardless of hours
        - "points": custom point system (e.g., server=2pts/hr, busser=1pt/hr)
        """
        shares = []

        if method == "hours_worked":
            total_hours = sum(Decimal(str(s["hours"])) for s in participating_staff)
            running_total = Decimal("0")

            for i, staff in enumerate(participating_staff):
                hours = Decimal(str(staff["hours"]))
                if i == len(participating_staff) - 1:
                    # Last person gets remainder (penny rounding)
                    amount = total_tips - running_total
                else:
                    proportion = hours / total_hours
                    amount = (total_tips * proportion).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                    running_total += amount

                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount=amount,
                    source="pool",
                ))

        elif method == "equal":
            n = len(participating_staff)
            per_person = (total_tips / n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            running_total = Decimal("0")

            for i, staff in enumerate(participating_staff):
                amount = per_person if i < n - 1 else total_tips - running_total
                running_total += amount
                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount=amount,
                    source="pool",
                ))

        elif method == "points":
            points_per_role = {
                "server": Decimal("2.0"),
                "bartender": Decimal("2.0"),
                "busser": Decimal("1.0"),
                "food_runner": Decimal("1.0"),
                "host": Decimal("0.5"),
            }
            total_points = sum(
                points_per_role.get(s["role"], Decimal("1.0")) * Decimal(str(s["hours"]))
                for s in participating_staff
            )
            running_total = Decimal("0")

            for i, staff in enumerate(participating_staff):
                staff_points = points_per_role.get(staff["role"], Decimal("1.0")) * Decimal(str(staff["hours"]))
                if i == len(participating_staff) - 1:
                    amount = total_tips - running_total
                else:
                    proportion = staff_points / total_points
                    amount = (total_tips * proportion).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    running_total += amount

                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount=amount,
                    source="pool",
                ))

        return shares
```

## Tip Reporting (IRS Compliance)

```python
# pos/payments/tip_reporting.py

from decimal import Decimal


class TipReporter:
    """
    IRS requires restaurants with 10+ employees to file Form 8027
    (Employer's Annual Information Return of Tip Income and Allocated Tips).

    Key concepts:
    - Reported tips: tips employees report to employer (usually through POS)
    - Allocated tips: if reported tips < 8% of gross receipts, employer must
      allocate the difference to employees
    - Credit card tips: automatically reported (POS has exact amounts)
    - Cash tips: employees are supposed to self-report, but often under-report
    """

    MINIMUM_TIP_RATE = Decimal("0.08")  # 8% IRS threshold

    async def generate_8027_data(
        self,
        restaurant_id: str,
        year: int,
    ) -> dict:
        """Generate data needed for IRS Form 8027."""

        # Gather from POS data
        gross_receipts = await self._get_gross_receipts(restaurant_id, year)

        # Credit card tips are automatically tracked
        cc_tips = await self._get_cc_tips(restaurant_id, year)

        # Cash tips as reported by employees (self-reported through POS)
        reported_cash_tips = await self._get_reported_cash_tips(restaurant_id, year)

        total_reported_tips = cc_tips + reported_cash_tips

        # Service charges (auto-gratuity) -- NOT tips for 8027 purposes
        service_charges = await self._get_service_charges(restaurant_id, year)

        # Check if allocation is needed
        tippable_receipts = gross_receipts - service_charges  # Exclude takeout, etc.
        minimum_tips = tippable_receipts * self.MINIMUM_TIP_RATE

        needs_allocation = total_reported_tips < minimum_tips
        allocation_amount = minimum_tips - total_reported_tips if needs_allocation else Decimal("0")

        return {
            "form": "8027",
            "year": year,
            "establishment_name": "",  # From restaurant record
            "ein": "",                 # Employer ID number

            "line_1_total_charged_tips": cc_tips,
            "line_2_total_charge_receipts": gross_receipts,  # Charged receipts (not cash sales)
            "line_3_total_gross_receipts": gross_receipts,
            "line_4_cash_tips_reported": reported_cash_tips,
            "line_5_total_tips_reported": total_reported_tips,
            "line_6_gross_receipts_for_calc": tippable_receipts,
            "line_7_eight_percent": minimum_tips,
            "line_8_allocation_required": needs_allocation,
            "line_9_allocation_amount": allocation_amount,

            # Per-employee breakdown (needed for W-2 reporting)
            "employee_tip_detail": await self._get_employee_tip_detail(restaurant_id, year),
        }

    async def _get_employee_tip_detail(self, restaurant_id: str, year: int) -> list[dict]:
        """Per-employee tip totals for W-2 box 7 (social security tips) and box 8 (allocated tips)."""
        # Query from tip_distributions table, grouped by employee
        employees = await self._query_employee_tips(restaurant_id, year)

        return [
            {
                "employee_id": emp["id"],
                "name": emp["name"],
                "ssn_last4": emp["ssn_last4"],
                "cc_tips": emp["cc_tips"],
                "cash_tips_reported": emp["cash_tips_reported"],
                "total_tips": emp["cc_tips"] + emp["cash_tips_reported"],
                "allocated_tips": emp.get("allocated_tips", Decimal("0")),
                "hours_worked": emp["total_hours"],
                "gross_receipts_served": emp["gross_receipts"],
            }
            for emp in employees
        ]
```

## State-Specific Tip Laws

```
KEY STATE VARIATIONS:

FEDERAL (FLSA):
- Tip credit: employers can pay $2.13/hr + tips, as long as total >= $7.25/hr
- Employers CANNOT keep any portion of employee tips
- Tip pools must only include "customarily tipped" employees
  (2024 update: back-of-house CAN be in pool if employer pays full minimum wage)

CALIFORNIA:
- NO tip credit. Must pay full state minimum wage ($16.50/hr as of 2025) PLUS tips
- Tips belong entirely to employees
- Employers cannot deduct credit card processing fees from tips
- Tip pooling allowed but management CANNOT participate

NEW YORK:
- Limited tip credit ($5.00/hr for food service workers)
- Tip threshold for credit: $7.50/hr in tips
- Separate rules for NYC vs rest of state

WASHINGTON:
- No tip credit. Full minimum wage plus tips.

OREGON:
- No tip credit. Full minimum wage plus tips.

IMPLICATIONS FOR OUR POS:
- Tip credit calculation must be configurable by state
- Some states: cannot deduct CC fees from tips
- Must track tip amounts separately for each employee for payroll
- Auto-gratuity = service charge = wages (not tips) -- different payroll treatment
- POS must make it easy for employees to report cash tips
```

```sql
-- Tip tracking tables
CREATE TABLE tip_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    shift_date DATE NOT NULL,

    -- Source transaction
    transaction_id UUID REFERENCES payment_transactions(id),
    check_id UUID REFERENCES checks(id),

    -- Tip info
    tip_amount_cents INTEGER NOT NULL,
    tip_type TEXT NOT NULL,               -- 'credit_card', 'cash_reported', 'auto_gratuity'

    -- Distribution
    staff_id UUID NOT NULL REFERENCES staff(id),
    distribution_method TEXT NOT NULL,     -- 'direct', 'pool', 'tipout'
    amount_cents INTEGER NOT NULL,         -- Amount this staff member receives

    -- For tipout tracking
    tipout_from_staff_id UUID,            -- Who they received tipout from
    tipout_percentage Decimal,            -- What percentage

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tips_staff_date ON tip_distributions(staff_id, shift_date);
CREATE INDEX idx_tips_restaurant_date ON tip_distributions(restaurant_id, shift_date);

-- Cash tip self-reporting
CREATE TABLE cash_tip_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    shift_date DATE NOT NULL,
    reported_amount_cents INTEGER NOT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(staff_id, shift_date)
);
```

---

# 5. FINANCIAL RECONCILIATION

## Daily Settlement Flow

```
END OF DAY PROCESS (typically 2-4 AM or when last manager closes):

1. CLOSE ALL OPEN CHECKS
   - Alert: "3 checks still open. Close before settling?"
   - Auto-close option with configured rules

2. ENTER CASH TIPS (if not already entered)
   - Prompt servers to enter tips for credit card receipts
   - Timeout: tips not entered within X hours -> flag for manager

3. CLOSE BATCH
   - Send batch close command to processor
   - Record batch ID, transaction count, total amount
   - Some processors auto-close at configured time

4. RECONCILE CASH
   - Each drawer: counted cash vs expected cash
   - Record over/short
   - Manager sign-off required for variance > $5

5. GENERATE DAILY REPORT
   - Gross sales by category
   - Discounts, comps, voids
   - Credit card transactions by card type
   - Cash sales
   - Gift card sales and redemptions
   - Tips by server
   - Labor cost for the day
   - Net revenue

6. POST TO ACCOUNTING
   - Daily journal entry to accounting system
   - Revenue recognition
   - Tips payable accrual
```

```python
# pos/payments/reconciliation.py

from decimal import Decimal
from datetime import date, datetime, timedelta
from dataclasses import dataclass


@dataclass
class DailyReconciliation:
    """Comprehensive daily financial reconciliation."""
    business_date: date
    restaurant_id: str

    # Revenue
    gross_sales: Decimal = Decimal("0")
    discounts: Decimal = Decimal("0")
    comps: Decimal = Decimal("0")
    net_sales: Decimal = Decimal("0")
    tax_collected: Decimal = Decimal("0")

    # Payment breakdown
    credit_card_total: Decimal = Decimal("0")
    cash_total: Decimal = Decimal("0")
    gift_card_total: Decimal = Decimal("0")
    house_account_total: Decimal = Decimal("0")

    # Credit card detail
    visa_total: Decimal = Decimal("0")
    mastercard_total: Decimal = Decimal("0")
    amex_total: Decimal = Decimal("0")
    discover_total: Decimal = Decimal("0")

    # Tips
    credit_card_tips: Decimal = Decimal("0")
    cash_tips_reported: Decimal = Decimal("0")
    auto_gratuity: Decimal = Decimal("0")
    total_tips: Decimal = Decimal("0")

    # Adjustments
    voids: Decimal = Decimal("0")
    refunds: Decimal = Decimal("0")
    surcharges_collected: Decimal = Decimal("0")

    # Cash drawer
    cash_expected: Decimal = Decimal("0")
    cash_counted: Decimal = Decimal("0")
    cash_over_short: Decimal = Decimal("0")

    # Batch info
    batch_id: str = ""
    batch_transaction_count: int = 0
    batch_total: Decimal = Decimal("0")

    # Processing fees (estimated -- actual fees come from processor statement)
    estimated_processing_fees: Decimal = Decimal("0")
    net_after_fees: Decimal = Decimal("0")


class ReconciliationEngine:

    async def generate_daily_reconciliation(
        self,
        restaurant_id: str,
        business_date: date,
    ) -> DailyReconciliation:
        """Build complete daily reconciliation from POS transaction data."""

        recon = DailyReconciliation(
            business_date=business_date,
            restaurant_id=restaurant_id,
        )

        # Pull all transactions for the business date
        txns = await self._get_transactions(restaurant_id, business_date)

        for txn in txns:
            amount = Decimal(str(txn["captured_amount_cents"])) / 100
            tip = Decimal(str(txn.get("tip_amount_cents", 0))) / 100

            if txn["status"] == "voided":
                recon.voids += amount
                continue

            if txn["status"] in ("refunded", "partially_refunded"):
                recon.refunds += Decimal(str(txn.get("refunded_amount_cents", 0))) / 100

            if txn["payment_method"] in ("card_emv", "card_nfc", "card_swipe"):
                recon.credit_card_total += amount
                recon.credit_card_tips += tip

                brand = txn.get("card_brand", "unknown")
                if brand == "visa":
                    recon.visa_total += amount
                elif brand == "mastercard":
                    recon.mastercard_total += amount
                elif brand == "amex":
                    recon.amex_total += amount
                elif brand == "discover":
                    recon.discover_total += amount

            elif txn["payment_method"] == "cash":
                recon.cash_total += amount

            elif txn["payment_method"] == "gift_card":
                recon.gift_card_total += amount

            recon.surcharges_collected += Decimal(str(txn.get("surcharge_amount_cents", 0))) / 100

        # Calculate totals
        recon.gross_sales = await self._get_gross_sales(restaurant_id, business_date)
        recon.discounts = await self._get_discounts(restaurant_id, business_date)
        recon.comps = await self._get_comps(restaurant_id, business_date)
        recon.net_sales = recon.gross_sales - recon.discounts - recon.comps
        recon.tax_collected = await self._get_tax(restaurant_id, business_date)

        # Cash tips
        recon.cash_tips_reported = await self._get_cash_tips(restaurant_id, business_date)
        recon.auto_gratuity = await self._get_auto_gratuity(restaurant_id, business_date)
        recon.total_tips = recon.credit_card_tips + recon.cash_tips_reported + recon.auto_gratuity

        # Processing fee estimate
        # Actual fees come from processor statement, but we estimate for dashboard
        recon.estimated_processing_fees = self._estimate_processing_fees(
            recon.credit_card_total,
            recon.visa_total,
            recon.mastercard_total,
            recon.amex_total,
            recon.discover_total,
        )
        recon.net_after_fees = (
            recon.credit_card_total
            + recon.cash_total
            + recon.gift_card_total
            - recon.refunds
            - recon.estimated_processing_fees
        )

        return recon

    def _estimate_processing_fees(
        self,
        total: Decimal,
        visa: Decimal,
        mc: Decimal,
        amex: Decimal,
        discover: Decimal,
    ) -> Decimal:
        """
        Estimate processing fees. Actual fees depend on interchange category,
        card type (reward vs non-reward, debit vs credit), etc.
        This is a rough estimate for the dashboard.
        """
        # Average effective rates (card-present restaurant):
        # Visa/MC: ~1.8-2.2% + per-txn
        # Amex: ~2.5-3.0%
        # Discover: ~1.8-2.2%
        estimated = (
            (visa + mc + discover) * Decimal("0.022")  # 2.2% average
            + amex * Decimal("0.028")                    # 2.8% average
        )
        return estimated.quantize(Decimal("0.01"))

    async def reconcile_processor_deposit(
        self,
        restaurant_id: str,
        deposit_date: date,
        deposit_amount: Decimal,
        processor_name: str,
    ) -> dict:
        """
        Match processor bank deposit against POS transactions.
        Deposits typically arrive T+1 or T+2.

        Common mismatches:
        - Chargebacks deducted from deposit
        - Processing fees deducted
        - Timing differences (batch closed after midnight)
        - Refunds processed
        """
        # Find batch(es) that would have settled on this deposit date
        # T+1 processor: batch from deposit_date - 1 day
        # T+2 processor: batch from deposit_date - 2 days

        possible_batch_dates = [
            deposit_date - timedelta(days=1),
            deposit_date - timedelta(days=2),
            deposit_date - timedelta(days=3),  # Weekend delay
        ]

        batches = []
        for bd in possible_batch_dates:
            batch = await self._get_batch_for_date(restaurant_id, processor_name, bd)
            if batch:
                batches.append(batch)

        if not batches:
            return {
                "matched": False,
                "error": "No matching batch found",
                "deposit_amount": deposit_amount,
            }

        # Sum batch totals
        batch_gross = sum(b["total_amount"] for b in batches)

        # Difference = fees + chargebacks + adjustments
        difference = batch_gross - deposit_amount

        # Try to account for the difference
        chargebacks = await self._get_chargebacks(restaurant_id, processor_name, deposit_date)
        chargeback_total = sum(c["amount"] for c in chargebacks)

        fees_estimate = batch_gross * Decimal("0.025")  # Rough fee estimate

        unaccounted = difference - chargeback_total - fees_estimate

        return {
            "matched": abs(unaccounted) < Decimal("1.00"),  # Within $1 tolerance
            "deposit_amount": deposit_amount,
            "batch_gross": batch_gross,
            "difference": difference,
            "chargebacks": chargeback_total,
            "estimated_fees": fees_estimate,
            "unaccounted_difference": unaccounted,
            "batches": batches,
            "chargebacks_detail": chargebacks,
        }
```

## Chargeback Handling

```python
# pos/payments/chargebacks.py

class ChargebackManager:
    """
    Chargebacks happen when a customer disputes a charge with their bank.

    Restaurant chargebacks are usually:
    1. Fraud (stolen card used at restaurant -- rare for card-present)
    2. Service dispute (customer unhappy, goes to bank instead of restaurant)
    3. "Friendly fraud" (customer disputes legitimate charge)
    4. Tip amount dispute (customer claims tip was altered)

    POS role: provide documentation for representment (fighting the chargeback).
    """

    async def handle_chargeback_notification(
        self,
        processor_chargeback_id: str,
        original_transaction_id: str,
        reason_code: str,
        amount: Decimal,
        respond_by: date,
    ) -> dict:
        """
        Process incoming chargeback notification.
        Create case record and gather evidence.
        """
        # Look up original transaction
        txn = await self._get_transaction(original_transaction_id)

        # Gather evidence automatically from POS data
        evidence = {
            "transaction_receipt": await self._get_receipt(txn["check_id"]),
            "itemized_check": await self._get_check_detail(txn["check_id"]),
            "entry_mode": txn["card_entry_mode"],   # EMV = strong evidence
            "authorization_code": txn["authorization_code"],
            "server_name": await self._get_server_name(txn["server_id"]),
            "signed_receipt_on_file": txn.get("signature_captured", False),
        }

        # Tip-related chargebacks: show signed receipt with tip amount
        if "tip" in reason_code.lower() or txn["tip_amount_cents"] > 0:
            evidence["tip_receipt"] = await self._get_tip_receipt(txn["check_id"])
            evidence["tip_entry_timestamp"] = txn.get("tip_entered_at")

        case = {
            "id": processor_chargeback_id,
            "original_transaction": txn,
            "amount": amount,
            "reason_code": reason_code,
            "reason_description": self._translate_reason_code(reason_code),
            "respond_by": respond_by,
            "evidence": evidence,
            "recommended_action": self._recommend_action(reason_code, txn),
            "status": "open",
        }

        # Save and alert manager
        await self._save_chargeback_case(case)
        await self._notify_manager(case)

        return case

    def _recommend_action(self, reason_code: str, txn: dict) -> str:
        """Recommend whether to fight or accept the chargeback."""
        # EMV transactions are very hard for customers to dispute
        if txn["card_entry_mode"] == "emv":
            return "FIGHT -- EMV chip read provides strong evidence of card-present transaction"

        # Small amounts may not be worth fighting
        amount = Decimal(str(txn["captured_amount_cents"])) / 100
        if amount < Decimal("25.00"):
            return "ACCEPT -- amount likely not worth the effort to fight"

        return "REVIEW -- gather signed receipt and prepare representment"
```

## Valor Settlement & Reconciliation

```
SCENARIO: All payment processing flows through Valor PayTech.
Single settlement source simplifies reconciliation.

Daily reconciliation:
1. Pull settlement data from Valor API
2. Match Valor's deposit to bank deposits
3. Unified reporting — single processor, single deposit stream
4. Track Dual Pricing savings (cash vs card breakdown)

+----------------------------------------------+
| Valor PayTech                                |
| Dine-in + Online + All channels              |
| $7,000 gross                                 |
| - $184 fees (before Dual Pricing offset)     |
| - Dual Pricing offset: $120 (recovered via   |
|   card price differential)                   |
| = $6,936 net deposit                         |
+----------------------------------------------+
         |
         v
    +------------------------------------+
    | Bank Account                       |
    | Deposit: $6,936 (Valor)            |
    +------------------------------------+
         |
         v
    +------------------------------------+
    | POS Reconciliation Report          |
    | Gross sales: $7,000                |
    | Processing fees: $184              |
    | Dual Pricing offset: $120          |
    | Effective fees: $64 (0.91%)        |
    | Net deposits: $6,936              |
    | Variance: $0.00                    |
    +------------------------------------+

ADVANTAGE: Single processor = simpler reconciliation.
No need to match deposits from multiple sources.
Dual Pricing offset reduces effective processing cost dramatically.
```

---

# 6. HARDWARE INTEGRATION

## iPad + Valor Terminal Architecture

```
+---------------------------------------------------+
|                    iPad (BYOD)                     |
|                                                    |
|  +---------------------------------------------+  |
|  |           POS Web App (Safari)               |  |
|  |                                              |  |
|  |  Flask/Jinja2 served pages                   |  |
|  |  JS bridge to native layer for terminal comm |  |
|  +-----+------+------+------------------------+  |
|         |      |      |                           |
+---------+------+------+---------------------------+
          |      |      |
    Bluetooth  USB-C  Network (Valor Connect/MQTT)
          |      |      |
+---------+------+------+---------------------------+
|            Valor Payment Terminals                 |
|                                                    |
|  Option A: Valor RCKT (Bluetooth, mobile)          |
|  Option B: Valor VP800 (Network, dual display)     |
|  Option C: Valor VP550 (Network, countertop)       |
|  Option D: Valor VP300 Pro (Network, PIN pad)      |
|  Option E: Valor VL500 (Network, versatile)        |
+---------------------------------------------------+
```

## Critical Architecture Decision: Native App vs Web App

```
OUR STACK: Flask/Jinja2 = Server-rendered web pages.
iPad accesses POS via Safari browser.

PROBLEM: The Valor RCKT mobile terminal uses Bluetooth, which
requires NATIVE iOS capabilities to communicate. Web browsers cannot
access Bluetooth devices. Network-connected Valor terminals (VP800, VP550)
can be reached via Valor Connect (MQTT) from the server side, but
Bluetooth (RCKT) needs a native layer.

SOLUTIONS:

OPTION 1: Lightweight native iOS wrapper (RECOMMENDED)
- Thin Swift/SwiftUI app that wraps WKWebView
- Web app loads inside the native wrapper
- Native layer handles ONLY: Bluetooth communication with Valor RCKT,
  receipt printing, cash drawer kick
- Minimal App Store review friction (it's essentially a browser)
- Valor Connect communication for network terminals goes through server
- JavaScript bridge (postMessage) between web app and native layer

OPTION 2: Network-connected Valor terminals only
- Use ONLY WiFi/Ethernet Valor terminals (VP800, VP550, VP300 Pro)
- iPad communicates with Sear server, which sends transaction requests
  to Valor via Valor Connect (MQTT) or REST API
- Terminal communicates with Valor over its own network connection
- NO native app needed -- pure web
- Downside: no portable Bluetooth RCKT terminal support

OPTION 3: Progressive Web App (PWA) with Web Bluetooth (RISKY)
- Web Bluetooth API exists but is NOT supported in Safari on iOS
- Only works in Chrome on Android
- NOT viable for iPad

RECOMMENDATION: Option 1 (native wrapper) for full flexibility,
with Option 2 as fallback for restaurants that don't want to install an app.
The ValorPay App (available on iOS and Android) also provides a fallback
for processing payments directly on a phone/tablet if the POS is down.
```

## Native Wrapper Architecture

```swift
// Simplified architecture of the native iOS wrapper

import UIKit
import WebKit
// Valor RCKT Bluetooth communication handled via CoreBluetooth
import CoreBluetooth

class POSViewController: UIViewController, WKScriptMessageHandler {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Configure JavaScript bridge
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "posNative")

        webView = WKWebView(frame: view.bounds, configuration: config)
        view.addSubview(webView)

        // Load web POS
        let url = URL(string: "https://pos.yourapp.com")!
        webView.load(URLRequest(url: url))
    }

    // Receive messages from JavaScript
    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "discoverReaders":
            discoverReaders()
        case "connectReader":
            let readerId = body["readerId"] as! String
            connectReader(readerId)
        case "collectPayment":
            let amount = body["amount"] as! Int  // cents
            let orderId = body["orderId"] as! String
            collectPayment(amount: amount, orderId: orderId)
        case "printReceipt":
            let receiptData = body["receiptHtml"] as! String
            printReceipt(receiptData)
        case "openCashDrawer":
            openCashDrawer()
        default:
            break
        }
    }

    // Send results back to JavaScript
    func sendToWeb(_ event: String, data: [String: Any]) {
        let json = try! JSONSerialization.data(withJSONObject: data)
        let jsonStr = String(data: json, encoding: .utf8)!
        webView.evaluateJavaScript(
            "window.posNativeCallback('\(event)', \(jsonStr))"
        )
    }
}
```

```javascript
// JavaScript side (in web app)
// pos/static/js/native_bridge.js

class NativeBridge {
    constructor() {
        // Register callback handler
        window.posNativeCallback = (event, data) => {
            this.handleNativeEvent(event, data);
        };
    }

    // Send command to native layer
    send(action, params = {}) {
        if (window.webkit?.messageHandlers?.posNative) {
            // Running inside native wrapper
            window.webkit.messageHandlers.posNative.postMessage({
                action: action,
                ...params,
            });
        } else {
            // Running in plain browser -- use network readers via server API
            this.fallbackToServerAPI(action, params);
        }
    }

    // Commands
    discoverReaders() { this.send('discoverReaders'); }

    connectReader(readerId) { this.send('connectReader', { readerId }); }

    collectPayment(amountCents, orderId) {
        this.send('collectPayment', { amount: amountCents, orderId });
    }

    printReceipt(receiptHtml) { this.send('printReceipt', { receiptHtml }); }

    openCashDrawer() { this.send('openCashDrawer'); }

    // Handle responses from native layer
    handleNativeEvent(event, data) {
        switch (event) {
            case 'readersDiscovered':
                // Update UI with available readers
                break;
            case 'readerConnected':
                // Update reader status indicator
                break;
            case 'paymentComplete':
                // data = { success, transactionId, cardLast4, cardBrand, authCode }
                // Update order status, print receipt
                break;
            case 'paymentFailed':
                // Show error to user
                break;
        }
    }

    async fallbackToServerAPI(action, params) {
        // For network-connected Valor terminals, commands go through our server via Valor Connect
        const response = await fetch('/api/payment/reader-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...params }),
        });
        const data = await response.json();
        this.handleNativeEvent(data.event, data.data);
    }
}
```

## Receipt Printing

```
RECEIPT PRINTING OPTIONS FOR iPad:

1. Network receipt printer (Star Micronics, Epson TM-T88)
   - iPad sends print job over WiFi/Ethernet
   - Use StarIO SDK (native) or Star CloudPRNT (web-based)
   - Star TSP143IV supports direct web printing via Star CloudPRNT
   - RECOMMENDED: Star TSP143IV WiFi ($400) + CloudPRNT

2. Bluetooth receipt printer
   - Star SM-L200 ($350), Star SM-T300 ($400)
   - Requires native SDK
   - Good for tableside checkout

3. AirPrint
   - Works from Safari, but NOT designed for receipt printers
   - Only works with AirPrint-compatible printers (mostly office printers)
   - NOT suitable for thermal receipt printers

4. Valor terminal receipt capabilities
   - Valor VP800 dual display shows transaction details on customer screen
   - Valor terminals do NOT have built-in receipt printers — use Star/Epson printer
   - Digital receipts (email/SMS) available through Sear's receipt system

CASH DRAWER:
- Cash drawers connect to receipt printer via RJ12 cable
- Printer sends 12V kick signal to open drawer
- When you "print a receipt," you also send drawer-kick command
- No direct iPad-to-drawer connection exists
- This means: receipt printer is REQUIRED for cash drawer operation
```

## Hardware Recommendations by Price Point

```
BUDGET ($500-$800 per station):
- iPad (BYOD or refurbished): $0-350
- Valor RCKT (Bluetooth mobile terminal): provided through Valor partnership
- Star TSP143IV receipt printer: $400
- Cash drawer (Vasario VB320): $100
- iPad stand (generic): $30
Total: ~$530-880 (terminal hardware through Valor)

MID-RANGE ($800-$1,500 per station):
- iPad 10th gen: $449
- Valor VP550 (countertop, WiFi): provided through Valor partnership
- Star TSP143IV receipt printer: $400
- Cash drawer: $100
- iPad stand (Heckler): $150
Total: ~$1,099 (terminal hardware through Valor)

PREMIUM ($1,500-$2,500 per station):
- iPad Pro: $799
- Valor VP800 (dual display, countertop): provided through Valor partnership
- Star mC-Print3 receipt printer: $500
- Cash drawer: $150
- Heckler WindFall Stand: $250
- Customer-facing display (2nd iPad or purpose-built): $300-500
Total: ~$1,999-2,199 (terminal hardware through Valor)
```

---

# 7. ONLINE / CARD-NOT-PRESENT PAYMENTS

## Online Ordering Payment Flow

```
CUSTOMER                  WEB/APP              OUR SERVER              VALOR PAYTECH
   |                        |                      |                      |
   |  1. Place order        |                      |                      |
   |  Enter card details    |                      |                      |
   |----------------------->|                      |                      |
   |                        |  2. Tokenize card    |                      |
   |                        |  (Valor tokenization |                      |
   |                        |   API / hosted page) |                      |
   |                        |--------------------->|                      |
   |                        |                      |                      |
   |                        |  3. Token returned   |                      |
   |                        |  (valor_tok_xxxx)    |                      |
   |                        |<---------------------|                      |
   |                        |                      |                      |
   |                        |  4. Submit order      |                      |
   |                        |  with token          |                      |
   |                        |--------------------->|                      |
   |                        |                      |  5. Charge token     |
   |                        |                      |--------------------->|
   |                        |                      |  6. Auth result      |
   |                        |                      |<---------------------|
   |                        |  7. Order confirmed   |                      |
   |                        |<---------------------|                      |
   |  8. Confirmation       |                      |                      |
   |<-----------------------|                      |                      |
```

Key point: Our server NEVER sees the raw card number. For online orders, the card is tokenized via Valor's hosted payment page or tokenization API. Our server only receives an opaque token.

```python
# pos/payments/flows/online.py

from decimal import Decimal


class OnlinePaymentManager:
    """Handle card-not-present transactions for online ordering."""

    async def process_online_order(
        self,
        processor: "ValorPaymentProcessor",
        card_token: str,           # Token from Valor tokenization API
        order_id: str,
        amount: Decimal,
        customer_id: str | None = None,
        save_card: bool = False,
    ) -> dict:
        """
        Process an online order payment.

        Key differences from card-present:
        - Higher interchange rates (card-not-present = more fraud risk)
        - 3D Secure may be required (SCA in EU, trending in US)
        - No chip/PIN verification
        - Higher chargeback risk
        """
        result = await processor.authorize_manual(
            amount=amount,
            card_token=card_token,
            order_id=order_id,
            capture=True,  # Online orders: auth+capture immediately
        )

        if result.success and save_card and customer_id:
            # Save card token for future orders
            await self._save_customer_card(
                customer_id=customer_id,
                token=result.card_info.token,
                last_four=result.card_info.last_four,
                brand=result.card_info.brand,
                exp_month=result.card_info.exp_month,
                exp_year=result.card_info.exp_year,
            )

        return {
            "success": result.success,
            "transaction_id": result.processor_transaction_id,
            "order_id": order_id,
        }

    async def collect_deposit(
        self,
        processor: "ValorPaymentProcessor",
        card_token: str,
        amount: Decimal,
        event_name: str,
        event_date: str,
        customer_id: str,
        refundable: bool = True,
    ) -> dict:
        """
        Collect deposit for catering/events/large party reservations.

        Two models:
        1. Auth-only (hold): place hold, capture when event occurs.
           Risk: auth expires after 7 days. For future events, must use...
        2. Sale (auth+capture): charge immediately.
           More common for deposits. Refund if cancelled per policy.
        """
        result = await processor.authorize_manual(
            amount=amount,
            card_token=card_token,
            order_id=f"deposit_{event_name}_{event_date}",
            capture=True,  # Charge immediately
            metadata={
                "type": "deposit",
                "event": event_name,
                "event_date": event_date,
                "refundable": refundable,
            },
        )

        return {
            "success": result.success,
            "deposit_amount": amount,
            "refundable": refundable,
            "transaction_id": result.processor_transaction_id,
        }
```

## Saved Cards (Tokenized)

```sql
-- Saved payment methods (tokens only -- NO raw card data)
CREATE TABLE customer_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- Processor info
    processor_name TEXT NOT NULL,
    processor_customer_id TEXT,       -- Valor customer reference ID
    processor_card_token TEXT NOT NULL, -- Processor's token for this card

    -- Display info (safe to store)
    card_brand TEXT NOT NULL,
    card_last_four TEXT NOT NULL,
    exp_month INTEGER,
    exp_year INTEGER,
    cardholder_name TEXT,

    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_cpm_customer ON customer_payment_methods(customer_id);
```

## 3D Secure

```
3D Secure (3DS) is becoming more important even in the US:

- Currently REQUIRED in EU/UK (Strong Customer Authentication)
- OPTIONAL in US but provides liability shift (chargeback protection)
- Visa Secure, Mastercard Identity Check, Amex SafeKey

When to use 3DS:
- Online orders over $100 (configurable)
- First-time online customers
- High-risk transactions (different billing/shipping, international cards)
- When processor recommends it (risk scoring)

Implementation:
- Valor: 3DS handled via Valor's tokenization API for card-not-present
  transactions. Valor routes 3DS challenges through backend processor.

Impact on conversion:
- 3DS adds friction (extra step for customer)
- ~5-10% cart abandonment increase
- But: dramatically reduces chargebacks
- Recommendation: use for orders over $50, skip for smaller orders
```

---

# 8. ECONOMICS & REVENUE MODEL

## How Toast Makes Money (For Comparison)

```
Toast's revenue breakdown (2024):
1. Payment processing: ~70% of revenue
   - Forces restaurants onto Toast Processing
   - Charges ~2.99% + 15c (card-present)
   - Their cost: ~1.8% (interchange + assessment + acquirer markup)
   - Their margin: ~1.2% per transaction (massive)
   - A restaurant doing $1M in card sales = ~$12,000/year to Toast just in processing margin

2. Software subscription: ~20% of revenue
   - $69-165/month per terminal
   - Additional modules: online ordering, loyalty, marketing, etc.

3. Hardware: ~10% of revenue
   - Proprietary terminals ($700-1,200 each)
   - Financing/leasing programs
   - Hardware lock-in (Toast hardware only works with Toast)

WHY RESTAURANTS HATE THIS:
- Can't negotiate processing rates
- Can't use a cheaper processor
- Can't keep existing processor relationships
- Total cost: often $2,000-5,000/month for a mid-size restaurant
```

## Sear Revenue Model: Software (2/3 Less) + Processing (1.9% of 4%)

```
Sear earns revenue from two streams:

1. SOFTWARE SUBSCRIPTION (Customer Acquisition Hook)
   Every price point is 2/3 less than Toast's equivalent.

   Pricing:
   - Starter: $23/month (Toast Core: $69 — 2/3 less)
   - Professional: $49/month (Toast Core + add-ons: ~$194 — 2/3 less)
   - Enterprise: $65-99/location (Toast Enterprise: $200+ — 2/3 less)
   - Additional terminals: $9/month each
   - Additional KDS: $15/month each
   - Module add-ons: $9-29/month per module (each 2/3 less than Toast equivalent)

2. PAYMENT PROCESSING (Primary Revenue — The Real Money)
   Sear is an ISV partner of Valor PayTech. All processing runs through Valor.

   THE 4% DUAL PRICING MODEL:
   - Card-paying customers are charged a 4% fee (shown as card price vs cash price)
   - Sear keeps 1.9% of that 4%
   - Valor keeps 2.1% (covers interchange, network fees, their margin)
   - The restaurant pays $0 in processing fees — the customer absorbs the cost
   - Legal in all 50 states (structured as cash discount, not surcharge)

   Revenue math on $80K/month card volume:
   ┌─────────────────────────────────────────────┐
   │ 4% charged to card customers:  $3,200/month │
   │ Sear's 1.9% cut:              $1,520/month  │
   │ Valor's 2.5% cut:             $2,000/month  │
   │ Restaurant's processing cost:  $0/month      │
   └─────────────────────────────────────────────┘

COMBINED REVENUE PER RESTAURANT ($80K card volume, Professional plan):
   Software: $49/month
   Processing (1.9% of card volume): $1,520/month
   TOTAL: $1,569/month per restaurant

RESTAURANT'S TOTAL COST:
   Software: $23-49/month
   Processing: $0/month (customer pays via Dual Pricing)
   TOTAL: $23-49/month vs Toast's $800-3,800/month

The software subscription is the hook. Processing is the engine.
```

### Revenue Model — Restaurant Savings vs Toast

```
TOAST'S ALL-IN COSTS (for comparison):
  Small cafe ($25K/mo sales):      ~$812/month
  Fast-casual ($60K/mo sales):     ~$1,945/month
  Full-service w/ bar ($120K/mo):  ~$3,795/month

SEAR'S COST TO RESTAURANT:
  Small cafe:      $23/month software + $0 processing = $23/month
  Fast-casual:     $49/month software + $0 processing = $49/month
  Full-service:    $49/month software + $0 processing = $49/month

SEAR'S REVENUE (what we earn):
  Small cafe ($20K card vol):     $23 software + $380 processing (1.9%) = $403/month
  Fast-casual ($48K card vol):    $49 software + $912 processing = $961/month
  Full-service ($100K card vol):  $49 software + $1,900 processing = $1,949/month

AT SCALE (500 restaurants, avg $80K/month card volume):

                              Sear              Toast
────────────────────────────────────────────────────────────
Software/mo per restaurant    $49               $165
Processing revenue to us      $1,520 (1.9%)     $960 (1.2% margin)
Hardware revenue               $0               $50
────────────────────────────────────────────────────────────
Our revenue/restaurant/mo     $1,569            $1,175
x 500 restaurants/mo          $784,500          $587,500
Annual revenue                $9.41M            $7.05M

KEY INSIGHT: Sear earns 34% MORE per restaurant than Toast
because our 1.9% cut of 4% ($1,520/mo) exceeds Toast's ~1.2% hidden
margin ($960/mo) — yet the restaurant's cost drops from $2,600/mo
to $49/mo. The card-paying CUSTOMER funds the difference.

Restaurant annual savings vs Toast: $9,500-$45,000/year depending on size
SALES PITCH: "Your software costs 2/3 less. Your processing costs $0.
Your customers pay the card fee, not you."
```

## Valor ISV Partnership Details

```
Sear operates as an ISV (Independent Software Vendor) partner of Valor PayTech.
This is simpler than becoming a PayFac and avoids $500K+ in PayFac setup costs.

HOW THE ISV MODEL WORKS:
- Sear registers as a Valor ISV partner
- Valor handles: merchant underwriting, KYC, risk, chargebacks, compliance
- Sear handles: POS software, merchant onboarding UX, terminal provisioning
- Revenue share: Sear earns a per-transaction margin on processing volume
- Valor provides: API access, Valor Connect (MQTT), terminal hardware, Dual Pricing

ADVANTAGES OF VALOR ISV vs BECOMING A PAYFAC:
- No $500K+ PayFac setup cost
- No PCI burden as payment facilitator (Valor handles PCI)
- No underwriting or risk management responsibility
- No chargeback liability
- Fast to implement — API integration, not regulatory setup
- Valor's backend processor-agnostic infrastructure means competitive
  interchange rates without Sear needing to negotiate with each processor

VALOR'S DUAL PRICING (KEY DIFFERENTIATOR):
- Included at no additional cost to the restaurant
- Menu management in Sear shows both cash price and card price
- VP800 dual-display terminal shows customer the card price and cash price
- Cash discount is applied automatically at checkout
- Signage requirements handled by Sear's compliance module
- Receipt formatting includes required cash discount disclosure

IMPLEMENTATION:
- Phase 1: Valor REST API + Valor Connect (MQTT) for terminal communication
- Phase 2: Webhooks for real-time transaction status and settlement notifications
- Phase 3: Advanced features (tokenization for repeat customers, incremental auth for bar tabs)
```

---

# APPENDIX A: COMPLETE DATABASE SCHEMA FOR PAYMENTS

```sql
-- Payment processor configuration per restaurant
CREATE TABLE restaurant_processors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    processor_name TEXT NOT NULL DEFAULT 'valor',  -- Always 'valor' (Valor PayTech)
    is_primary BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Encrypted credentials (use Supabase Vault or app-level encryption)
    credentials_encrypted JSONB NOT NULL,  -- API keys, merchant IDs, etc.

    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,      -- Location IDs, terminal IPs, etc.

    -- Processing settings
    auto_batch_close_time TIME,            -- e.g., '02:00:00' for 2 AM
    batch_close_timezone TEXT DEFAULT 'America/New_York',

    -- Rate info (for reconciliation estimates)
    effective_rate_percent DECIMAL(5,3),   -- e.g., 2.350 for 2.35%
    per_transaction_fee_cents INTEGER,     -- e.g., 10 for $0.10

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rp_restaurant_processor
    ON restaurant_processors(restaurant_id, processor_name);

-- Payment devices/readers per station
CREATE TABLE payment_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    processor_id UUID NOT NULL REFERENCES restaurant_processors(id),

    device_serial TEXT NOT NULL,
    device_model TEXT NOT NULL,             -- 'bbpos_wisepad_3', 'stripe_s700', etc.
    device_label TEXT,                      -- 'Bar Reader', 'Station 1', etc.
    connection_type TEXT NOT NULL,          -- 'bluetooth', 'wifi', 'ethernet', 'usb'

    -- For network-connected devices
    ip_address TEXT,
    port INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    firmware_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Batch settlement records
CREATE TABLE settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    processor_name TEXT NOT NULL,
    processor_batch_id TEXT,

    -- Batch totals
    transaction_count INTEGER NOT NULL,
    gross_amount_cents INTEGER NOT NULL,
    refund_amount_cents INTEGER DEFAULT 0,
    net_amount_cents INTEGER NOT NULL,

    -- Timing
    batch_opened_at TIMESTAMPTZ,
    batch_closed_at TIMESTAMPTZ NOT NULL,
    expected_deposit_date DATE,
    actual_deposit_date DATE,
    actual_deposit_amount_cents INTEGER,

    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    variance_cents INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_restaurant_date ON settlement_batches(restaurant_id, batch_closed_at);

-- Chargeback/dispute tracking
CREATE TABLE chargebacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    transaction_id UUID REFERENCES payment_transactions(id),
    processor_name TEXT NOT NULL,
    processor_dispute_id TEXT NOT NULL,

    -- Dispute details
    reason_code TEXT NOT NULL,
    reason_description TEXT,
    amount_cents INTEGER NOT NULL,

    -- Deadlines
    received_at TIMESTAMPTZ NOT NULL,
    respond_by TIMESTAMPTZ NOT NULL,

    -- Our response
    status TEXT NOT NULL DEFAULT 'open', -- open, evidence_submitted, won, lost, expired
    evidence_submitted_at TIMESTAMPTZ,
    evidence JSONB,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution TEXT,                     -- 'won', 'lost', 'accepted'

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Surcharge configuration per restaurant
CREATE TABLE surcharge_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),

    program_type TEXT NOT NULL DEFAULT 'none',  -- 'none', 'surcharge', 'cash_discount'
    surcharge_rate DECIMAL(4,2),               -- e.g., 3.00 for 3%
    cash_discount_rate DECIMAL(4,2),           -- e.g., 3.00 for 3%
    merchant_discount_rate DECIMAL(4,2),       -- Their actual processing cost rate
    state TEXT NOT NULL,                        -- For legal validation

    -- Compliance tracking
    card_network_registered BOOLEAN DEFAULT FALSE,
    registration_date DATE,
    signage_confirmed BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tip configuration per restaurant
CREATE TABLE tip_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),

    -- Calculation
    calculate_on TEXT DEFAULT 'pre_tax',     -- 'pre_tax' or 'post_tax'
    suggested_percentages INTEGER[] DEFAULT ARRAY[18, 20, 22],
    default_percentage INTEGER DEFAULT 20,

    -- Auto-gratuity
    auto_grat_enabled BOOLEAN DEFAULT TRUE,
    auto_grat_party_size INTEGER DEFAULT 6,
    auto_grat_percentage INTEGER DEFAULT 20,

    -- Distribution
    distribution_model TEXT DEFAULT 'direct', -- 'direct', 'pool', 'hybrid'

    -- Tipout rules (for direct model)
    tipout_rules JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"role":"busser","percentage":3,"based_on":"sales"},
    --           {"role":"bartender","percentage":5,"based_on":"sales"}]

    -- Pool rules (for pool model)
    pool_method TEXT DEFAULT 'hours_worked',  -- 'hours_worked', 'equal', 'points'
    pool_point_values JSONB DEFAULT '{}'::jsonb,
    -- Example: {"server":2,"bartender":2,"busser":1,"food_runner":1}

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily reconciliation snapshots
CREATE TABLE daily_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    business_date DATE NOT NULL,

    -- Revenue
    gross_sales_cents INTEGER NOT NULL,
    discount_cents INTEGER DEFAULT 0,
    comp_cents INTEGER DEFAULT 0,
    net_sales_cents INTEGER NOT NULL,
    tax_collected_cents INTEGER NOT NULL,

    -- Payment breakdown
    credit_card_cents INTEGER DEFAULT 0,
    cash_cents INTEGER DEFAULT 0,
    gift_card_cents INTEGER DEFAULT 0,
    house_account_cents INTEGER DEFAULT 0,

    -- Card brand breakdown
    visa_cents INTEGER DEFAULT 0,
    mastercard_cents INTEGER DEFAULT 0,
    amex_cents INTEGER DEFAULT 0,
    discover_cents INTEGER DEFAULT 0,

    -- Tips
    cc_tips_cents INTEGER DEFAULT 0,
    cash_tips_reported_cents INTEGER DEFAULT 0,
    auto_gratuity_cents INTEGER DEFAULT 0,

    -- Adjustments
    void_cents INTEGER DEFAULT 0,
    refund_cents INTEGER DEFAULT 0,
    surcharge_cents INTEGER DEFAULT 0,

    -- Cash drawer
    cash_expected_cents INTEGER DEFAULT 0,
    cash_counted_cents INTEGER,
    cash_variance_cents INTEGER,

    -- Processing
    estimated_fee_cents INTEGER DEFAULT 0,

    -- Manager sign-off
    closed_by UUID REFERENCES staff(id),
    closed_at TIMESTAMPTZ,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, business_date)
);
```

# APPENDIX B: IMPLEMENTATION PRIORITY

```
PHASE 1 (MVP -- Weeks 1-6):
1. Valor PayTech integration (auth, capture, void, refund via REST API)
2. Valor Connect (MQTT) setup for terminal communication
3. Standard payment flow (auth -> tip adjust -> capture)
4. Cash payment flow
5. Basic split payment (equal split, 2-3 ways)
6. Receipt printing (Star CloudPRNT)
7. Daily reconciliation report
8. Native iOS wrapper for Valor RCKT Bluetooth terminal

PHASE 2 (Core -- Weeks 7-12):
9. Bar tab flow (open, add items, close, walkout handling)
10. Full split payment (by item, custom amounts, mixed tender)
11. Tip configuration and distribution
12. Void/refund workflow with manager approval
13. Batch settlement and deposit reconciliation (Valor settlement API)
14. Gift card system (Sear-managed)
15. Dual Pricing integration (menu management shows cash + card prices)

PHASE 3 (Growth -- Weeks 13-20):
16. Online ordering payments (Valor tokenization API)
17. Saved cards / repeat customers (Valor tokenization)
18. Dual Pricing compliance module (signage, receipts, state rules)
19. Surcharging / cash discount configuration
20. Chargeback management (Valor webhooks)
21. IRS tip reporting (Form 8027)
22. Processing fee analysis dashboard (with Dual Pricing savings tracking)

PHASE 4 (Scale -- Weeks 21+):
23. Multi-location Valor terminal management
24. Advanced reconciliation (auto-match Valor deposits to bank)
25. Dual Pricing optimization analytics (cash vs card ratio tracking)
```



---


# Part 7: UI/UX Design System


# Restaurant POS Design System & Screen Specifications

Complete design specification for a tablet-first, web-based restaurant POS system.
Built for Flask/Jinja2 + htmx + Alpine.js. Designed for iPad Safari/Chrome BYOD.

---

## 1. DESIGN SYSTEM

### 1.1 Color Palette

#### Brand Primary (choose one)

| Option | Name | Hex | Use Case |
|--------|------|-----|----------|
| **A (Recommended)** | Midnight Teal | `#0F766E` | Professional, calm, high contrast. Works across dining and QSR. |
| B | Slate Navy | `#1E3A5F` | Conservative, suits fine dining and upscale casual. |
| C | Espresso | `#4A3728` | Warm, earthy. Works well for farm-to-table and bakery concepts. |

**Proceeding with Option A: Midnight Teal `#0F766E`**

#### Primary Scale
```
primary-50:  #F0FDFA
primary-100: #CCFBF1
primary-200: #99F6E4
primary-300: #5EEAD4
primary-400: #2DD4BF
primary-500: #14B8A6
primary-600: #0D9488
primary-700: #0F766E  ← brand primary
primary-800: #115E59
primary-900: #134E4A
primary-950: #042F2E
```

#### Secondary / Accent
```
accent:      #F59E0B  (amber-500 — used for highlights, active states, badges)
accent-light:#FEF3C7  (amber-100 — background tints)
accent-dark: #D97706  (amber-600 — hover state)
```

#### Semantic Colors
```
Success:
  success-50:  #F0FDF4
  success-100: #DCFCE7
  success-500: #22C55E  ← primary success
  success-600: #16A34A  ← hover
  success-700: #15803D  ← text on light bg

Warning:
  warning-50:  #FFFBEB
  warning-100: #FEF3C7
  warning-500: #F59E0B  ← primary warning
  warning-600: #D97706  ← hover
  warning-700: #B45309  ← text on light bg

Error:
  error-50:  #FEF2F2
  error-100: #FEE2E2
  error-500: #EF4444  ← primary error
  error-600: #DC2626  ← hover
  error-700: #B91C1C  ← text on light bg

Info:
  info-50:  #EFF6FF
  info-100: #DBEAFE
  info-500: #3B82F6  ← primary info
  info-600: #2563EB  ← hover
  info-700: #1D4ED8  ← text on light bg
```

#### Neutrals (Gray Scale)
```
gray-0:   #FFFFFF  ← page background
gray-25:  #FCFCFD  ← card surface
gray-50:  #F9FAFB  ← secondary background, alternating rows
gray-100: #F3F4F6  ← input background, divider bg
gray-200: #E5E7EB  ← borders, dividers
gray-300: #D1D5DB  ← disabled borders, placeholder
gray-400: #9CA3AF  ← placeholder text, disabled text
gray-500: #6B7280  ← secondary text, labels
gray-600: #4B5563  ← body text
gray-700: #374151  ← headings
gray-800: #1F2937  ← primary text
gray-900: #111827  ← high-emphasis text
gray-950: #030712  ← maximum contrast
```

#### Order/Table Status Colors
```
Available:       #E5E7EB (gray-200) with white fill
Seated:          #3B82F6 (info-500) — blue
Ordered:         #F59E0B (warning-500) — amber
Entrees Served:  #22C55E (success-500) — green
Check Presented: #F97316 (orange-500)
Needs Attention: #EF4444 (error-500) — red, with pulse animation
Reserved:        #8B5CF6 (violet-500) — purple
```

#### KDS Ticket Aging
```
Fresh (0-5 min):     #FFFFFF white bg, gray-200 border
Aging (5-10 min):    #FEF3C7 amber-100 bg, warning-500 border
Late (10-15 min):    #FEE2E2 error-100 bg, error-500 border
Critical (15+ min):  #EF4444 error-500 bg, white text — fully red
```

---

### 1.2 Typography

#### Font Family
```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```

Inter is the primary typeface. Load from Google Fonts: weights 400, 500, 600, 700.
Rationale: Outstanding legibility at all sizes, tabular numbers built in, free, widely supported.

#### Font Size Scale (rem-based, 16px root)
```
text-xs:    12px / 0.75rem   — badges, timestamps, fine print
text-sm:    14px / 0.875rem  — secondary labels, helper text (MINIMUM body size)
text-base:  16px / 1rem      — body text, menu item names, input text
text-lg:    18px / 1.125rem  — section labels, sub-headings
text-xl:    20px / 1.25rem   — card titles, category tabs
text-2xl:   24px / 1.5rem    — screen titles, prices on order summary
text-3xl:   30px / 1.875rem  — KDS ticket numbers, large prices
text-4xl:   36px / 2.25rem   — total due on payment screen
text-5xl:   48px / 3rem      — PIN entry display, kiosk headings
text-6xl:   64px / 4rem      — customer-facing display total
```

#### Font Weights
```
regular:  400  — body text, descriptions
medium:   500  — labels, secondary emphasis, menu item names
semibold: 600  — subheadings, prices, buttons, active tabs
bold:     700  — screen titles, totals, KDS item names, alerts
```

#### Line Heights
```
tight:    1.25  — headings, large text
snug:     1.375 — subheadings
normal:   1.5   — body text, paragraphs
relaxed:  1.625 — small text for readability
loose:    2.0   — widely spaced lists
```

#### Letter Spacing
```
tight:   -0.025em  — large headings (24px+)
normal:   0        — body text
wide:     0.025em  — all-caps labels, badges
wider:    0.05em   — button text (uppercase only)
```

---

### 1.3 Spacing & Layout

#### Base Unit: 8px

All spacing derives from an 8px grid.

```
space-0:   0px
space-0.5: 2px   — tight gaps (badge padding)
space-1:   4px   — minimal gap
space-2:   8px   — tight padding, icon gaps
space-3:   12px  — compact padding
space-4:   16px  — standard padding, gaps between elements
space-5:   20px  — comfortable padding
space-6:   24px  — card padding, section spacing
space-8:   32px  — large section spacing
space-10:  40px  — screen section gaps
space-12:  48px  — major layout gaps
space-16:  64px  — page-level spacing
```

#### Touch Target Minimums (Apple HIG)
```
Minimum tappable area: 44 x 44px
Recommended button size: 48 x 48px
Large action button: 56 x 56px
Menu item grid button: minimum 80 x 80px (recommended 96-120px tall)
Gap between tappable elements: minimum 8px
```

#### Screen Layout Constants
```
Sidebar width (collapsed): 64px
Sidebar width (expanded): 240px
Top bar height: 56px
Bottom bar height: 64px
Order panel width: 360px (iPad 12.9"), 320px (iPad 10.x"), 280px (iPad mini)
Content area: remaining width after sidebar + order panel
Modal max width: 560px
Modal padding: 24px
Page margin (landscape): 16px
Page margin (portrait): 12px
Card border radius: 12px
Button border radius: 8px
Input border radius: 8px
Badge border radius: 9999px (pill)
```

#### Z-Index Scale
```
z-base:      0
z-dropdown:  10
z-sticky:    20
z-overlay:   30
z-modal:     40
z-popover:   50
z-toast:     60
z-tooltip:   70
```

---

### 1.4 Shadows

```
shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05)
shadow:      0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)
shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)
shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)
shadow-xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)
```

Cards use `shadow-sm`. Modals use `shadow-xl`. Dropdowns use `shadow-lg`.

---

### 1.5 Component Specifications

#### 1.5.1 Buttons

**Primary Button**
```
Background: primary-700 (#0F766E)
Text: white, 16px semibold
Padding: 12px 24px
Height: 48px
Border radius: 8px
Hover: primary-800 (#115E59)
Active: primary-900 (#134E4A), scale(0.98)
Disabled: gray-300 bg, gray-500 text
Focus ring: 2px solid primary-400, 2px offset
```

**Secondary Button**
```
Background: white
Border: 1px solid gray-300
Text: gray-700, 16px semibold
Padding: 12px 24px
Height: 48px
Border radius: 8px
Hover: gray-50 bg, gray-400 border
Active: gray-100 bg, scale(0.98)
```

**Ghost Button**
```
Background: transparent
Text: gray-600, 16px medium
Padding: 12px 24px
Height: 48px
Hover: gray-100 bg
Active: gray-200 bg
```

**Danger Button**
```
Background: error-500 (#EF4444)
Text: white, 16px semibold
Hover: error-600
Active: error-700, scale(0.98)
```

**Button Sizes**
```
Small:  36px height, 10px 16px padding, 14px text
Medium: 48px height, 12px 24px padding, 16px text (default)
Large:  56px height, 16px 32px padding, 18px text
XL:     64px height, 16px 40px padding, 20px text (payment actions)
```

**Icon Button**
```
Size: 44x44px (sm: 36x36, lg: 48x48)
Border radius: 8px (or 9999px for circle)
Icon size: 20px (sm: 16px, lg: 24px)
Background: transparent
Hover: gray-100
```

#### 1.5.2 Input Fields

**Text Input**
```
Height: 48px
Padding: 12px 16px
Background: white
Border: 1px solid gray-300
Border radius: 8px
Font: 16px regular (16px minimum prevents Safari zoom on focus)
Placeholder color: gray-400
Focus: border primary-500, ring 2px primary-100
Error: border error-500, ring 2px error-100, error message below in error-600 14px
Disabled: gray-100 bg, gray-400 text
Label: 14px medium gray-700, 4px margin-bottom
Helper text: 14px regular gray-500, 4px margin-top
```

**Search Input**
```
Same as text input, with:
Left icon: magnifying glass, gray-400, 20px
Right icon: X clear button when has value
Background: gray-50 (subtle differentiation)
```

**Currency Input**
```
Same as text input, with:
Left adornment: "$" in gray-500
Text alignment: right
Font: 20px semibold (emphasis on amount)
Tabular numbers enabled (font-variant-numeric: tabular-nums)
```

**Number Input / Quantity**
```
Height: 48px
Width: 120px
Center-aligned text, 18px semibold
- button on left, + button on right (each 48x48px)
Buttons: gray-100 bg, gray-700 icon, 8px border-radius
Long press: rapid increment
```

#### 1.5.3 Select / Dropdown

```
Trigger: identical to text input styling, with chevron-down icon right
Dropdown panel:
  Background: white
  Border: 1px solid gray-200
  Border radius: 12px
  Shadow: shadow-lg
  Max height: 320px (scrollable)
  Padding: 4px
Option:
  Height: 44px
  Padding: 12px 16px
  Font: 16px regular
  Hover: gray-50 bg
  Selected: primary-50 bg, primary-700 text, check icon right
  Border radius: 8px (within the panel padding)
```

#### 1.5.4 Toggle Switch

```
Track: 52px wide, 28px tall, border-radius 9999px
  Off: gray-200 bg
  On: primary-700 bg
Thumb: 24px circle, white, shadow-sm
  Position: 2px from edge
Transition: 150ms ease
Label: 16px regular gray-700, 12px gap from toggle
```

#### 1.5.5 Checkbox

```
Size: 24x24px (tappable area: 44x44)
Border radius: 6px
Off: white bg, gray-300 border, 2px
On: primary-700 bg, white checkmark icon
Indeterminate: primary-700 bg, white dash
Focus ring: 2px primary-400
Label: 16px regular gray-700, 12px gap
```

#### 1.5.6 Radio Button

```
Size: 24x24px (tappable area: 44x44)
Border radius: 9999px
Off: white bg, gray-300 border, 2px
On: primary-700 border, inner dot 10px primary-700
Label: 16px regular gray-700, 12px gap
```

#### 1.5.7 Modal / Dialog

```
Overlay: rgba(0, 0, 0, 0.5) — covers full screen
Container:
  Background: white
  Border radius: 16px
  Shadow: shadow-xl
  Width: 480px (sm), 560px (md), 720px (lg), 90vw (full)
  Max height: 85vh
  Padding: 24px
Header:
  Title: 20px semibold gray-900
  Close button: top-right, 44x44 icon button
  Bottom border: 1px gray-200
  Padding bottom: 16px
Body:
  Padding: 24px 0
  Scrollable if content overflows
Footer:
  Top border: 1px gray-200
  Padding top: 16px
  Buttons right-aligned, 12px gap
  Primary action on right, secondary on left
Animation: fade in overlay 150ms, slide up + fade container 200ms
```

#### 1.5.8 Toast Notification

```
Position: top-center, 16px from top
Width: 400px max, auto
Height: auto, min 48px
Border radius: 12px
Shadow: shadow-lg
Padding: 16px 20px
Font: 14px medium
Auto-dismiss: 4 seconds (configurable)
Swipe to dismiss: yes

Variants:
  Success: success-50 bg, success-700 border-left 4px, success icon
  Error: error-50 bg, error-700 border-left 4px, error icon
  Warning: warning-50 bg, warning-700 border-left 4px, warning icon
  Info: info-50 bg, info-700 border-left 4px, info icon

Animation: slide down from top, 200ms ease-out
Dismiss: slide up + fade, 150ms
Stack: multiple toasts stack downward, 8px gap
```

#### 1.5.9 Sidebar Navigation

```
Width: 64px collapsed, 240px expanded
Background: gray-900
Height: 100vh, fixed left
Transition: width 200ms ease

Logo area:
  Height: 56px
  Centered icon (collapsed) or logo wordmark (expanded)
  Background: gray-950

Nav items:
  Height: 48px
  Icon: 24px, centered (collapsed) or left-aligned with 16px padding (expanded)
  Label: 15px medium, white, appears when expanded
  Icon color: gray-400 default, white active
  Hover: gray-800 bg
  Active: primary-700 bg with left 3px border primary-400
  Active icon: white
  Border radius: 0 (full-width highlight)
  Padding: 12px 16px (expanded)

Bottom section:
  User avatar/initials: 36px circle
  Settings gear icon
  Clock in/out indicator (green dot = clocked in)

Collapse toggle:
  Arrow icon at bottom of sidebar, 44x44
  Tooltip on hover when collapsed
```

#### 1.5.10 Tab Bar

```
Container:
  Height: 48px
  Background: white
  Border bottom: 1px gray-200
  Padding: 0 16px
  Overflow-x: scroll (hidden scrollbar), snap to tab

Tab:
  Padding: 12px 20px
  Font: 15px medium gray-500
  Height: 100%
  Border bottom: 2px transparent
  Min width: fit-content
  Active: gray-900 text, primary-700 border-bottom 2px
  Hover: gray-700 text
  Transition: color 150ms, border 150ms
```

#### 1.5.11 Badge / Chip

**Badge (count)**
```
Height: 22px
Min width: 22px
Border radius: 9999px
Padding: 0 6px
Font: 12px semibold white
Background: error-500 (notifications), primary-700 (count), gray-500 (neutral)
Position: absolute, top-right of parent, offset -4px -4px
```

**Chip (selectable)**
```
Height: 36px
Padding: 8px 16px
Border radius: 9999px
Font: 14px medium
Background: gray-100, gray-700 text
Selected: primary-100 bg, primary-800 text
Hover: gray-200
Border: 1px solid gray-200 (unselected), primary-300 (selected)
With icon: 16px icon, 6px gap before text
Removable: X icon right, 6px gap
```

#### 1.5.12 Avatar / Initials

```
Sizes: 28px (xs), 32px (sm), 40px (md), 48px (lg), 64px (xl)
Border radius: 9999px
Background: generated from name hash (use 8 preset colors)
Text: white, initials (first + last), font size = diameter * 0.4
Border: 2px white (when overlapping in a group)

Preset colors for initials:
  #0F766E, #1E3A5F, #7C3AED, #DB2777, #EA580C, #CA8A04, #16A34A, #6366F1
```

#### 1.5.13 Data Table

```
Container: white bg, 1px gray-200 border, 12px border-radius, shadow-sm
Header row:
  Background: gray-50
  Font: 13px semibold gray-500, uppercase, letter-spacing 0.05em
  Height: 44px
  Padding: 12px 16px
  Border bottom: 1px gray-200
Body row:
  Height: 52px
  Padding: 12px 16px
  Font: 15px regular gray-700
  Border bottom: 1px gray-100
  Hover: gray-50 bg
  Active/selected: primary-50 bg
Alternating rows: optional, use gray-50
Pagination: bottom of table, 56px height, centered controls
Sort indicator: chevron icon after sortable column header
Responsive: horizontal scroll on smaller screens, sticky first column
```

#### 1.5.14 Card

```
Background: white
Border: 1px gray-200
Border radius: 12px
Shadow: shadow-sm
Padding: 20px (content area)
Header: 16px semibold gray-800, optional subtitle 14px gray-500
Footer: border-top 1px gray-100, padding-top 16px
Hover (if interactive): shadow-md, border gray-300
Active (if interactive): shadow-sm, scale(0.99)
```

#### 1.5.15 Order Ticket / Receipt Card

```
Width: 100% of order panel (360px)
Background: white
Border: 1px gray-200
Border radius: 12px
Shadow: shadow-sm

Header:
  Padding: 12px 16px
  Background: gray-50
  Border-bottom: 1px gray-200
  Top-left: Order type badge (Dine-in/Takeout/Delivery)
  Top-right: Table number or order number in 18px bold
  Second row: Server name (14px gray-500), guest count, time

Items list:
  Padding: 8px 16px
  Each item row:
    Quantity: 16px semibold gray-900, 28px wide
    Name: 16px medium gray-800, flex-grow
    Price: 16px regular gray-600, right-aligned
    Modifier: indented 28px, 14px regular gray-500, "  + modifier name"
    Special instruction: 14px italic warning-700, full width, indented
    Tap target: full row, 44px min height
    Swipe left: reveals delete (red) and edit (blue) actions

Totals section:
  Border-top: 1px gray-200
  Padding: 12px 16px
  Subtotal: 15px regular gray-600, right-aligned
  Tax: 15px regular gray-600
  Total: 20px bold gray-900
  Spacing: 8px between lines

Action bar:
  Padding: 12px 16px
  Border-top: 1px gray-200
  Send button: primary, full width, 48px
  Secondary actions: row of icon buttons (hold, fire, rush, print)
```

#### 1.5.16 Menu Item Button

```
Standard Grid (4-column layout):
  Width: calculated (fill grid with 8px gaps)
  Height: 96px
  Border radius: 12px
  Padding: 12px
  Background: white
  Border: 1px gray-200
  Shadow: shadow-sm

  Name: 15px semibold gray-800, top-left, max 2 lines, ellipsis
  Price: 14px medium gray-500, bottom-left
  Color indicator: 4px left border in category color
  Image: optional, 40x40 rounded-8 thumbnail top-right

  Hover: shadow-md, border gray-300
  Active: scale(0.97), shadow-sm, 100ms spring
  Out of stock: gray-100 bg, gray-400 text, diagonal "86'd" stamp overlay
  86'd badge: red, rotated -12deg, 12px bold, semi-transparent

Compact Grid (5-column):
  Height: 72px
  Font: 14px
  No image

Large Grid (3-column):
  Height: 120px
  Image: 56x56
  Description: 13px gray-500, 1 line
```

#### 1.5.17 Modifier Selection Button

```
Height: 48px
Padding: 12px 16px
Border radius: 8px
Background: white
Border: 1px gray-200
Font: 15px medium gray-700

Selected: primary-50 bg, primary-700 border, primary-800 text, check icon left
Price addon: 14px regular gray-500, right-aligned ("+ $1.50")
Disabled: gray-100 bg, gray-400 text

Quantity modifier (when quantity > 0):
  Shows quantity badge on right: 28px circle, primary-700 bg, white text
  + and - stepper buttons appear flanking the badge
```

#### 1.5.18 Numpad

```
Container: 280px wide, white bg, 12px border-radius, shadow-md
Grid: 4 columns x 4 rows (standard), 8px gap
Buttons: 64px x 56px, 12px border-radius

Number keys (1-9, 0):
  Background: white
  Border: 1px gray-200
  Font: 24px semibold gray-800
  Active: gray-100 bg, scale(0.95)

Special keys:
  00: same as number
  Backspace: gray-100 bg, delete icon
  Clear: gray-100 bg, "C" text
  Enter/Done: primary-700 bg, white text, spans 2 rows tall (optional)

Layout:
  Row 1: 7  8  9  [backspace]
  Row 2: 4  5  6  [clear]
  Row 3: 1  2  3  [enter
  Row 4: 00 0  .   enter]

Display (above numpad):
  Height: 56px
  Font: 36px bold gray-900, right-aligned
  Prefix: "$" in 24px gray-500
  Background: gray-50
  Border-bottom: 2px primary-700
  Padding: 8px 16px
```

#### 1.5.19 Swipe Actions

```
Row height: matches content row
Swipe threshold: 80px to reveal
Snap: auto-snap to revealed or closed

Left swipe reveals right-side actions:
  Delete/Void: error-500 bg, white trash icon, 80px wide
  Edit: info-500 bg, white pencil icon, 80px wide

Right swipe reveals left-side actions:
  Mark done: success-500 bg, white check icon, 80px wide

Animation: spring physics, 200ms settle
Haptic: light impact feedback on threshold cross (via navigator.vibrate)
```

#### 1.5.20 Bottom Sheet

```
Overlay: rgba(0, 0, 0, 0.3)
Container:
  Background: white
  Border radius: 16px 16px 0 0
  Max height: 90vh
  Shadow: shadow-xl
  Padding: 16px 20px 34px (extra bottom for home indicator)

Handle bar: 36px wide, 4px tall, gray-300, centered, 8px from top
Header: 18px semibold gray-900, 16px below handle

Sizes:
  Peek: 30% of screen height (shows header + first few items)
  Half: 50% of screen height
  Full: 90% of screen height
  Snap points: can drag between sizes

Animation: spring, 250ms, slight overshoot
Gesture: drag handle or swipe down to dismiss
```

#### 1.5.21 Status Indicator

**Dot**
```
Size: 10px (sm: 8px, lg: 12px)
Border radius: 9999px
Colors: success-500, warning-500, error-500, gray-400, info-500
Pulse animation (for "needs attention"): scale 1→1.5→1, opacity 1→0.5→1, 2s loop
```

**Status Badge**
```
Height: 24px
Padding: 4px 10px
Border radius: 9999px
Font: 12px semibold, uppercase, letter-spacing 0.05em

Variants:
  Active/Open:   success-100 bg, success-700 text
  Pending:       warning-100 bg, warning-700 text
  Closed:        gray-100 bg, gray-600 text
  Error/Void:    error-100 bg, error-700 text
  Info:          info-100 bg, info-700 text
  VIP:           violet-100 bg, violet-700 text
```

#### 1.5.22 Progress Bar

```
Container: 8px tall, gray-200 bg, 9999px border-radius
Fill: primary-700, 9999px border-radius, width = percentage
Transition: width 300ms ease
Label (optional): 14px medium gray-600, above or right
Sizes: sm (4px), md (8px), lg (12px)
```

#### 1.5.23 Skeleton Loader

```
Background: gray-200
Shimmer: gradient animation left-to-right, 1.5s loop
  transparent → gray-300 → transparent
Border radius: matches the element it replaces
Shapes: rect (text lines), circle (avatar), card (full card)
No border or shadow — flat shapes only
```

#### 1.5.24 Empty State

```
Container: centered in parent, max-width 400px
Illustration: 120px icon or illustration, gray-300
Heading: 18px semibold gray-700
Description: 15px regular gray-500, max-width 300px, centered
Action button: primary, below description, 16px margin-top
Total padding: 48px vertical
```

---

## 2. SCREEN-BY-SCREEN SPECIFICATIONS

### 2.1 Login / Terminal Setup

#### 2.1.1 PIN Login Screen

**Layout:** Full screen, centered content, light gray-50 background

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│               [Restaurant Logo - 80px]                 │
│               "Restaurant Name" 24px bold              │
│               "Terminal 2 - Bar" 14px gray-500         │
│                                                        │
│        ┌──────────────────────────────────┐            │
│        │  Staff Carousel / Grid           │            │
│        │  ┌──────┐ ┌──────┐ ┌──────┐     │            │
│        │  │ JD   │ │ SM   │ │ AK   │     │            │
│        │  │ John │ │Sarah │ │Alex  │     │            │
│        │  └──────┘ └──────┘ └──────┘     │            │
│        │  ┌──────┐ ┌──────┐ ┌──────┐     │            │
│        │  │ MR   │ │ TC   │ │ BW   │     │            │
│        │  │Maria │ │Tom   │ │Beth  │     │            │
│        │  └──────┘ └──────┘ └──────┘     │            │
│        └──────────────────────────────────┘            │
│                                                        │
│              ● ● ● ● ○ ○  (PIN dots)                  │
│                                                        │
│        ┌─────┬─────┬─────┐                             │
│        │  1  │  2  │  3  │                             │
│        ├─────┼─────┼─────┤                             │
│        │  4  │  5  │  6  │                             │
│        ├─────┼─────┼─────┤                             │
│        │  7  │  8  │  9  │                             │
│        ├─────┼─────┼─────┤                             │
│        │     │  0  │  ⌫  │                             │
│        └─────┴─────┴─────┘                             │
│                                                        │
│        [Clock In]  [Manager Login →]                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Specifications:**
- Staff grid: 3-column grid of avatar circles (64px) with names below (14px medium)
- Tapping a staff member highlights them (primary ring) and shows numpad
- PIN dots: 6 circles, 14px each, 12px gap, gray-300 empty, gray-900 filled
- Numpad keys: 72x72px, 20px semibold text, 8px gap
- Error: dots shake (CSS keyframe, 3 oscillations, 300ms), turn red, clear
- Success: all dots turn primary-700, 200ms delay, then navigate
- Clock-in mode: after PIN, show clock-in/out prompt instead of POS
- "Manager Login" link: opens full username/password form for back-office access

#### 2.1.2 Terminal Setup (first-time or admin)

**Layout:** Full screen, centered card (480px wide)

- Terminal name input field
- Terminal type dropdown: POS, KDS, Kiosk, Customer Display
- Printer assignment: multi-select list of discovered printers
- Payment reader: select paired reader
- Default order type: radio buttons
- "Save & Activate" primary button

#### 2.1.3 Clock In/Out

**Layout:** Full screen after PIN entry

```
┌────────────────────────────────────────┐
│                                        │
│    Welcome, Sarah                      │
│                                        │
│    Current Status: Clocked Out         │
│    Last shift: Mar 19, 4:30 PM         │
│                                        │
│    ┌──────────────────────────┐        │
│    │                          │        │
│    │     CLOCK IN             │        │
│    │     12:04 PM             │        │
│    │                          │        │
│    └──────────────────────────┘        │
│                                        │
│    [View My Hours]  [Go to POS →]      │
│                                        │
└────────────────────────────────────────┘
```

- Clock in button: 200px wide, 80px tall, primary, large text
- Shows current time ticking in 36px
- After clock in: button changes to "Clock Out" (secondary style)
- "Go to POS" appears only after clock in confirmed

#### 2.1.4 Cash Drawer Count (Start of Shift)

**Layout:** Centered card, numpad on right

- List of denominations: $100, $50, $20, $10, $5, $1, quarters, dimes, nickels, pennies
- Quantity input for each
- Running total calculated
- Expected starting amount shown
- Discrepancy highlighted if difference > $5
- "Confirm & Start Shift" button
- Manager approval required if discrepancy (PIN prompt)

---

### 2.2 Main POS - Order Entry (PRIMARY SCREEN)

**This is the most critical screen. Staff spend 80%+ of their time here.**

#### Layout: 12.9" iPad Landscape (1366 x 1024 viewport)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [≡]  Dine-In ▾  Table 14  │  Server: Sarah M.  │  Guests: 4  │ ⚙ │  ← Top Bar (56px)
├──────────┬───────────────────────────────────────────────────────────┤
│          │  Appetizers │ Entrees │ Sides │ Drinks │ Desserts │ Bar  │  ← Category Tabs (48px)
│  ORDER   ├──────────────────────────────────────────────────────────┤
│  PANEL   │                                                          │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│ (360px)  │  │ Caesar  │ │ Calamari│ │ Brusc-  │ │ Soup of │       │
│          │  │ Salad   │ │         │ │ hetta   │ │ the Day │       │
│  ┌────┐  │  │ $14.00  │ │ $16.00  │ │ $12.00  │ │ $9.00   │       │
│  │ 1x │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  │Caes│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │$14 │  │  │ Shrimp  │ │ Cheese  │ │ Wings   │ │ Oysters │       │  ← Menu Item Grid
│  ├────┤  │  │ Cocktail│ │ Board   │ │ (6pc)   │ │ (6)     │       │
│  │ 2x │  │  │ $18.00  │ │ $22.00  │ │ $15.00  │ │ $24.00  │       │
│  │Burg│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  │ med│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │+che│  │  │ Tuna    │ │ Crab    │ │ Edamame │ │ Hummus  │       │
│  │$19 │  │  │ Tartare │ │ Cakes   │ │         │ │ Plate   │       │
│  ├────┤  │  │ $21.00  │ │ $19.00  │ │ $8.00   │ │ $13.00  │       │
│  │    │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  │    │  │                                                          │
│  │    │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │    │  │  │ Loaded  │ │ Spring  │ │ Beef    │ │ Charcute│       │
│  │    │  │  │ Nachos  │ │ Rolls   │ │ Carpac- │ │ -rie    │       │
│  │    │  │  │ $16.00  │ │ $11.00  │ │ $20.00  │ │ $28.00  │       │
│  │    │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  ├────┤  │                                                          │
│  │Sub: │  │ ┌──────────────────────────────────────────────────┐    │
│  │$84  │  │ │ 🔍  Search menu items...                        │    │
│  │Tax: │  │ └──────────────────────────────────────────────────┘    │
│  │$7.56│  ├──────────────────────────────────────────────────────────┤
│  │Total│  │  [Hold] [Fire Course] [Rush] [Discount] [Print]        │  ← Quick Actions (56px)
│  │$91  │  │                                                          │
│  ├────┤  │                                                          │
│  │SEND │  │                                                          │
│  └────┘  │                                                          │
└──────────┴───────────────────────────────────────────────────────────┘
```

#### Top Bar (56px height)
```
Left side:
  Hamburger menu icon: 44x44, opens sidebar overlay
  Order type: dropdown chip — "Dine-In" | "Takeout" | "Delivery" | "Bar"
    Chip: 36px height, primary-100 bg, primary-700 text, semibold
    Dropdown shows options with icons
  Table number: "Table 14" in 18px semibold gray-800, tappable to change

Right side:
  Server: avatar (28px) + "Sarah M." 14px medium gray-600
  Guests: person icon + "4" — tappable to change
  Settings gear: 44x44 icon button

Background: white
Border bottom: 1px gray-200
Padding: 0 16px
```

#### Order Panel (Left side, 360px wide)
```
Background: white
Border right: 1px gray-200

Header (56px):
  "Current Order" 16px semibold gray-700
  Order # if assigned: "#1247" badge, gray
  Seat selector: row of numbered circles (1, 2, 3, 4) — 28px each
    Active seat: primary-700 bg, white text
    Inactive: gray-100 bg, gray-600 text
    "All" option at start

Items list (scrollable, flex-grow):
  Each item row (min 52px):
    Left: Quantity in 15px semibold gray-800, 24px wide
    Center:
      Item name: 15px medium gray-800
      Modifiers (below name): 13px regular gray-500, each on new line, prefixed "  + "
      Special instructions: 13px italic warning-700
      Seat indicator: tiny "#2" badge if seat assignment active
    Right: price 15px regular gray-600, right-aligned
    Bottom border: 1px gray-100
    Tappable: opens item detail/edit popover

  Empty state: centered, "Tap a menu item to start" 15px gray-400

Totals section (fixed bottom, above send button):
  Border top: 1px gray-200
  Padding: 12px 16px
  Subtotal: "Subtotal" left, "$84.00" right, 15px gray-600
  Discounts (if any): "Discount" left, "-$8.40" right, 15px success-600
  Tax: "Tax" left, "$7.56" right, 15px gray-600
  Total: "Total" left, "$91.56" right, 20px bold gray-900
  Line spacing: 6px

Send button (fixed at very bottom):
  Full width minus 16px each side
  Height: 52px
  Primary button: "Send to Kitchen" if new, "Update Order" if modifying
  Green variant (success-500) when items are unsent
  Margin: 12px 16px 16px
```

#### Category Tabs (48px height, above menu grid)
```
Horizontal scrollable tab bar
Background: gray-50
Each tab: see Tab Bar component spec
Category color dot: 8px, left of tab text, matches category color
Active tab: bold bottom border in category color
Scroll behavior: smooth, momentum, no scrollbar visible
Right edge: subtle gradient fade indicating more tabs available
```

#### Menu Item Grid
```
Container: padding 12px, flex-grow, scrollable vertically
Grid: 4 columns on 12.9", 3 columns on 10.x", 2 columns on mini
Gap: 8px
Items: see Menu Item Button component (96px height, 4-column)

Behavioral:
  Tap item (no required modifiers): adds to order immediately, brief scale animation
  Tap item (has required modifiers): opens modifier panel
  Long press: shows item detail tooltip (description, allergens)
  Out-of-stock items: visible but grayed, tapping shows "86'd" toast
  Search: search bar at bottom of grid, full width, always visible
    Typing filters items across ALL categories
    Results replace grid in real-time (debounce 150ms)
```

#### Quick Actions Bar (56px height, bottom of menu area)
```
Background: white
Border top: 1px gray-200
Padding: 8px 12px
Horizontal row of secondary buttons, 12px gap:

  [Hold] — pause icon, "Hold" — secondary button, 36px
  [Fire Course] — flame icon, "Fire" — secondary button
  [Rush] — lightning icon, "Rush" — accent button (amber)
  [Discount] — percent icon, "Discount" — secondary button
  [Print] — printer icon — ghost button
  [Void] — X icon — danger ghost button (requires manager PIN)

Buttons: icon + text, 14px medium, 36px height, 12px 16px padding
Overflow: scroll if needed on smaller screens
```

#### Item Edit Popover (when tapping an item in the order list)
```
Appears anchored to the tapped item, pointing right
Width: 280px
Background: white
Border radius: 12px
Shadow: shadow-lg
Border: 1px gray-200

Contents:
  Item name: 16px semibold gray-800
  Quantity: stepper (- [qty] +) — 48px tall
  Edit modifiers: button → opens modifier panel
  Add special instructions: text input, 48px
  Seat assignment: dropdown or number buttons
  ──────
  Repeat item: ghost button
  Void item: danger ghost button (may require manager PIN)
  Remove: text button, error-600

Dismiss: tap outside, or press X
```

---

### 2.3 Modifier Selection Screen

**Layout:** Right-side slide-over panel (takes over menu grid area) or modal

```
┌──────────────────────────────────────────────────┐
│  ← Back    Cheeseburger - Modifiers       [Done] │  ← Header
├──────────────────────────────────────────────────┤
│                                                    │
│  TEMPERATURE *Required — Choose 1                  │  ← Modifier Group
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Rare    │ │Med Rare  │ │ Medium ✓ │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐                        │
│  │Med Well  │ │Well Done │                        │
│  └──────────┘ └──────────┘                        │
│                                                    │
│  CHEESE *Required — Choose 1                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │American ✓│ │ Cheddar  │ │  Swiss   │          │
│  │          │ │  +$1.00  │ │  +$1.00  │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐                        │
│  │Blue Chz  │ │ No Chz   │                        │
│  │  +$2.00  │ │          │                        │
│  └──────────┘ └──────────┘                        │
│                                                    │
│  TOPPINGS — Choose up to 4 (2 selected)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Lettuce ✓ │ │Tomato ✓  │ │  Onion   │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Pickles  │ │ Bacon    │ │Jalapeños │          │
│  │          │ │  +$2.50  │ │  +$0.75  │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                    │
│  SPECIAL INSTRUCTIONS                              │
│  ┌──────────────────────────────────────────┐     │
│  │ e.g., "no salt, extra crispy"            │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  Quantity:  [ - ]  1  [ + ]                        │
│                                                    │
├──────────────────────────────────────────────────┤
│           [ Add to Order — $18.50 ]               │  ← Footer
└──────────────────────────────────────────────────┘
```

**Specifications:**

```
Panel: slide-over from right, width = menu grid area (100% - 360px order panel)
  Or on smaller screens: full-width modal, 90vh height bottom sheet
Background: white
Animation: slide in from right, 250ms ease-out

Header (56px):
  Back arrow: 44x44 icon button
  Item name: 18px semibold gray-800
  Done button: primary, right-aligned, 36px height
  Border-bottom: 1px gray-200

Scrollable content area:

Modifier Group:
  Label: 16px semibold gray-800
  "Required" badge: error chip, "REQUIRED" 11px
  Instruction: 14px regular gray-500 ("Choose 1", "Choose up to 3")
  Margin bottom: 8px
  Selected count: shown inline with instruction
  Group spacing: 24px between groups
  Validation indicator:
    Required group incomplete: left 3px border error-500
    Required group complete: left 3px border success-500
    Optional: left 3px border gray-200

Modifier buttons:
  Grid: 3 columns, 8px gap
  Each: see Modifier Selection Button component
  Selected: primary-50 bg, primary-700 border, check icon
  With price: "  +$1.00" right-aligned, 14px gray-500

  If radio-style (choose exactly 1):
    Selecting one deselects others in group
  If checkbox-style (choose up to N):
    Toggle on/off independently
    Disable unselected when max reached (gray-200 bg, gray-400 text)

Special Instructions:
  Text input, full width, 48px height
  Placeholder: "e.g., allergy - no nuts, extra sauce on side"
  Character limit: 200

Quantity:
  Stepper: 48px height, centered
  Default: 1, min: 1, max: 99

Footer (72px):
  Fixed at bottom
  "Add to Order" primary button, full width
  Shows calculated price including modifiers: "Add to Order — $18.50"
  Disabled (gray-300) until all required modifiers selected
  Success animation on press: button turns success-500, check icon, then closes
```

---

### 2.4 Table Management / Floor Plan

**Layout:** Full screen with sidebar collapsed (64px)

```
┌────┬──────────────────────────────────────────────────────────────┐
│    │  Floor Plan  │  List View  │                    [Edit Mode] │
│ S  ├──────────────────────────────────────────────────────────────┤
│ I  │                                                              │
│ D  │        ┌─────┐                    ┌─────┐                   │
│ E  │        │ T1  │                    │ T5  │                   │
│ B  │        │ 4/4 │                    │ 2/2 │                   │
│ A  │        │ 25m │                    │ 10m │                   │
│ R  │        └─────┘       ┌───────────┐└─────┘                   │
│    │                      │   T3      │                          │
│    │   ┌─────┐            │   6/8     │       ┌─────┐           │
│    │   │ T2  │            │   45m     │       │ T6  │           │
│    │   │ 0/4 │            └───────────┘       │ 0/2 │           │
│    │   │     │                                │     │           │
│    │   └─────┘    ┌─────┐                     └─────┘           │
│    │              │ T4  │                                        │
│    │              │ 4/4 │          ┌──────────────────────┐      │
│    │              │ 52m │          │  BAR  B1 B2 B3 B4 B5 │      │
│    │              └─────┘          │       ○  ●  ○  ●  ○  │      │
│    │                               └──────────────────────┘      │
│    │                                                              │
│    ├──────────────────────────────────────────────────────────────┤
│    │  Waitlist: 3 parties  │  Next Reservation: 7:30 PM (Chen)  │
└────┴──────────────────────────────────────────────────────────────┘
```

**Table Icon Specifications:**

```
Shape variants:
  Square: 80x80px, 8px border-radius
  Rectangle: 120x80px, 8px border-radius
  Round: 80x80px, 9999px border-radius
  Booth: 100x60px, rounded on one side (16px), flat on other
  Bar seat: 36px circle

Content (inside table icon):
  Table number: 16px bold, centered top
  Guest count: "4/6" (current/capacity) 13px medium, centered
  Time seated: "25m" 12px regular gray-500, centered bottom

State colors (background of table icon):
  Available:       white bg, gray-200 border (2px)
  Seated:          info-100 bg, info-500 border
  Ordered:         warning-100 bg, warning-500 border
  Entrees Served:  success-100 bg, success-500 border
  Check Presented: orange-100 bg, orange-500 border
  Needs Attention: error-100 bg, error-500 border, pulse animation
  Reserved (upcoming): violet-100 bg, violet-400 border, dashed

Drag: tables are draggable in edit mode (manager only)
Tap: opens table detail popover
Long press: context menu (assign server, transfer, merge)

Server sections:
  Background tint per section, very subtle (5% opacity of server color)
  Server name label at section edge, 12px, rotated vertically
  Colors: each server assigned from preset palette
```

**Table Detail Popover (on tap):**
```
Width: 320px
Anchored to table icon
Background: white, shadow-lg, 16px border-radius

Header:
  "Table 14" 20px bold
  Status badge: see Status Badge component
  Time: "Seated 45 min ago" 14px gray-500

Server: avatar + name, 15px
Guests: 4 guests, 15px

Current Check:
  Items summary (first 3 items, then "+N more")
  Subtotal: 18px semibold
  Last activity: "Entrees fired 12 min ago" 13px gray-500

Actions (grid of icon buttons, 2 columns):
  [Open Check] — primary, go to order
  [Add Items] — secondary
  [Print Check] — ghost
  [Transfer] — ghost
  [Move] — ghost
  [Close Table] — ghost

Close: tap outside or X button
```

**Bottom Status Bar (48px):**
```
Left: "Waitlist: 3 parties" — tappable, opens waitlist panel
Center: reservation alerts
Right: "7 / 12 tables occupied" capacity indicator
Background: gray-50
Border top: 1px gray-200
```

---

### 2.5 Check Management

**Layout:** Full screen with sidebar, tab navigation

```
┌────┬──────────────────────────────────────────────────────────────┐
│    │  Open Checks (14)  │  By Server  │  By Type  │   [Search]  │
│ S  ├──────────────────────────────────────────────────────────────┤
│ I  │                                                              │
│ D  │  ┌─────────────────────────────────────────────────────────┐ │
│ E  │  │ Table 14 │ Sarah M. │ 4 guests │ 52 min │    $187.40  │ │
│ B  │  ├─────────────────────────────────────────────────────────┤ │
│ A  │  │ Table 3  │ John D.  │ 6 guests │ 1h 15m │    $342.80  │ │
│ R  │  ├─────────────────────────────────────────────────────────┤ │
│    │  │ Bar 2    │ Alex K.  │ 1 guest  │ 28 min │     $46.50  │ │
│    │  ├─────────────────────────────────────────────────────────┤ │
│    │  │ TO #1248 │ Sarah M. │ Takeout  │ 5 min  │     $32.00  │ │
│    │  ├─────────────────────────────────────────────────────────┤ │
│    │  │ ...                                                     │ │
│    │  └─────────────────────────────────────────────────────────┘ │
│    │                                                              │
└────┴──────────────────────────────────────────────────────────────┘
```

**Check Detail View (tapping a check opens this):**

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Checks    Table 14 — Check #1247                  [Actions ▾]│
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│  ITEMS   │  Seat 1                                              │
│          │  1x  Caesar Salad ...................... $14.00       │
│  ┌────┐  │  1x  Ribeye (medium) .................. $42.00       │
│  │Seat│  │       + mashed potatoes                              │
│  │ 1  │  │       + creamed spinach                              │
│  ├────┤  │                                                       │
│  │Seat│  │  Seat 2                                              │
│  │ 2  │  │  1x  Burrata Salad .................... $16.00       │
│  ├────┤  │  1x  Salmon (rare) .................... $36.00       │
│  │Seat│  │       + asparagus                                    │
│  │ 3  │  │       + rice pilaf                                   │
│  ├────┤  │                                                       │
│  │Seat│  │  Seat 3                                              │
│  │ 4  │  │  1x  French Onion Soup ................ $12.00       │
│  ├────┤  │  1x  Chicken Parm ..................... $28.00       │
│  │All │  │                                                       │
│  └────┘  │  Seat 4                                              │
│          │  1x  Calamari (shared) ................. $16.00      │
│          │  1x  Lobster Tail ...................... $52.00       │
│          │                                                       │
│          ├───────────────────────────────────────────────────────┤
│          │  Subtotal ............................ $216.00        │
│          │  Happy Hour Discount (-10%) ........... -$21.60       │
│          │  Tax .................................. $17.50         │
│          │  ─────────────────────────────────                    │
│          │  Total ................................ $211.90       │
│          │                                                       │
│          │  ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│          │  │ Add Items │ │Split Check│ │  Pay Now  │          │
│          │  └───────────┘ └───────────┘ └───────────┘          │
└──────────┴───────────────────────────────────────────────────────┘
```

**Check Detail Specifications:**
```
Left panel (80px):
  Seat filter buttons, vertically stacked
  "All" shows all seats
  Tapping a seat filters items to that seat only

Items area:
  Grouped by seat
  Seat header: "Seat 1" 14px semibold gray-500, bottom border
  Item rows: same styling as order panel items
  Dotted leader between name and price for readability
  Voided items: strikethrough text, gray-400, "VOID" badge

Totals: same as order panel totals, 16px right padding

Actions dropdown [Actions ▾]:
  Apply discount → opens discount modal
  Transfer check → server/table picker
  Void item → tap items to void (manager PIN)
  Comp item → similar to void, tracked separately
  Add gratuity → manual tip entry
  Reprint → sends to printer
  Reopen (if closed) → manager PIN required

Bottom buttons: 3 equal-width primary/secondary buttons, 48px height, 12px gap
```

#### Split Check Interface

**Layout:** Full screen modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Split Check — Table 14                                    [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Split Method:  [By Seat]  [Equal Split]  [Custom]              │
│                                                                  │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ Check A  │ Check B  │ Check C  │ Check D  │  + Add Check        │
│ (Seat 1) │ (Seat 2) │ (Seat 3) │ (Seat 4) │                    │
│ $56.00   │ $52.00   │ $40.00   │ $68.00   │                    │
├──────────┼──────────┼──────────┼──────────┤                    │
│ Caesar   │ Burrata  │ Fr.Onion │ Calamari │                    │
│ Ribeye   │ Salmon   │ Chk Parm │ Lobster  │                    │
│          │          │          │          │                    │
│          │          │          │          │                    │
│          │          │          │          │                    │
├──────────┴──────────┴──────────┴──────────┴─────────────────────┤
│                                                                  │
│  Drag items between checks to reassign                           │
│                                                                  │
│  [Cancel]                             [Confirm Split & Pay All] │
└──────────────────────────────────────────────────────────────────┘
```

**Split Check Specs:**
```
By Seat: auto-splits by seat assignment, each seat becomes a check
Equal Split: divide total by N, show N identical amount checks
Custom: start with all items in Check A, drag to new checks

Check columns:
  Width: equal distribution, scrollable if > 4
  Header: "Check A" 16px semibold, seat assignment 13px gray-500
  Total: 18px bold primary-700
  Items: draggable list, 14px
  Drag handle: 6-dot grip icon on left of each item

Drag behavior:
  Grab: item lifts with shadow-lg, slight scale(1.05)
  Drag: follows finger, target column highlights (primary-100 bg)
  Drop: item animates into position, totals recalculate
  Haptic: light feedback on grab and drop

"Confirm Split & Pay All": opens payment screen cycling through each check
```

---

### 2.6 Payment Screen

**Layout:** Full screen, focused on payment flow

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Check    Payment — Table 14           Check 1 of 1   │
├─────────────────────────────┬────────────────────────────────────┤
│                             │                                    │
│  CHECK SUMMARY              │  PAYMENT METHOD                    │
│                             │                                    │
│  1x Caesar Salad    $14.00  │  ┌────────────┐ ┌────────────┐   │
│  1x Ribeye          $42.00  │  │    💳       │ │    💵       │   │
│     + mashed potato         │  │   CARD      │ │   CASH      │   │
│     + creamed spinach       │  │             │ │             │   │
│  2x Glass Cab Sav   $32.00  │  └────────────┘ └────────────┘   │
│                             │  ┌────────────┐ ┌────────────┐   │
│                             │  │    🎁       │ │    🏠       │   │
│                             │  │ GIFT CARD   │ │HOUSE ACCT   │   │
│                             │  │             │ │             │   │
│                             │  └────────────┘ └────────────┘   │
│                             │                                    │
│  ──────────────────         │  ┌────────────────────────────┐   │
│  Subtotal       $88.00     │  │  Or split payment:          │   │
│  Tax             $7.92     │  │  [Partial Card] [Partial $] │   │
│  ──────────────────         │  └────────────────────────────┘   │
│                             │                                    │
│  TOTAL          $95.92     │                                    │
│  (large, 36px, bold)       │                                    │
│                             │                                    │
│                             │  Remaining due: $95.92            │
│                             │                                    │
└─────────────────────────────┴────────────────────────────────────┘
```

**Payment Method Buttons:**
```
Size: 140x100px
Border radius: 16px
Background: white
Border: 2px gray-200
Shadow: shadow-sm
Icon: 32px, centered top
Label: 16px semibold gray-700, centered bottom
Hover: primary-50 bg, primary-200 border
Active: primary-100 bg, primary-700 border, scale(0.97)
```

#### Card Payment Flow
```
1. Tap "Card" → screen shows:
   "Insert, tap, or swipe card on the reader"
   Large card reader icon, animated pulse
   Amount: $95.92 in 48px bold
   [Cancel] button below

2. Card detected → "Processing..." spinner
3. Approved → green check animation, "Approved" text

4. Tip prompt (server-side or customer-facing):
   ┌─────────────────────────────┐
   │  Add a tip?                 │
   │                             │
   │  ┌──────┐ ┌──────┐ ┌────┐ │
   │  │ 18%  │ │ 20%  │ │22% │ │
   │  │$17.27│ │$19.18│ │$21.│ │
   │  └──────┘ └──────┘ └────┘ │
   │                             │
   │  ┌──────┐ ┌──────────────┐ │
   │  │Custom│ │   No Tip     │ │
   │  └──────┘ └──────────────┘ │
   │                             │
   │  Pre-tax subtotal: $88.00   │
   │                             │
   └─────────────────────────────┘

   Tip buttons: 80x72px, 16px border-radius
   Percentage: 18px bold
   Dollar amount: 14px gray-500
   Selected: primary-700 bg, white text

5. Receipt prompt:
   [Print] [Email] [Text] [No Receipt]
   If email/text: input field appears

6. Done → "Thank you!" screen, 2 second display, auto-return
```

#### Cash Payment Flow
```
1. Tap "Cash" → shows numpad with amount tendered
   ┌─────────────────────────────────┐
   │  Total Due: $95.92              │
   │                                 │
   │  Amount Tendered:               │
   │  ┌─────────────────────┐       │
   │  │            $100.00  │       │
   │  └─────────────────────┘       │
   │                                 │
   │  Quick amounts:                 │
   │  [$96] [$100] [$120] [Exact]   │
   │                                 │
   │  ┌─────┬─────┬─────┐          │
   │  │  1  │  2  │  3  │          │
   │  ├─────┼─────┼─────┤          │
   │  │  4  │  5  │  6  │          │
   │  ├─────┼─────┼─────┤          │
   │  │  7  │  8  │  9  │          │
   │  ├─────┼─────┼─────┤          │
   │  │  00 │  0  │  .  │          │
   │  └─────┴─────┴─────┘          │
   │                                 │
   │  [Clear]         [Tender Cash] │
   └─────────────────────────────────┘

   Quick amount buttons: nearest round-up amounts, 48px height
   "Exact" fills in exact total

2. After tender:
   ┌─────────────────────────────────┐
   │                                 │
   │  CHANGE DUE                     │
   │                                 │
   │        $4.08                    │
   │     (64px bold, success-600)    │
   │                                 │
   │  Open cash drawer               │
   │  (auto-fires drawer kick)       │
   │                                 │
   │  [Print Receipt]  [Done]        │
   │                                 │
   └─────────────────────────────────┘

   Change amount: massive, impossible to miss
   Cash drawer opens automatically
```

---

### 2.7 Kitchen Display System (KDS)

**Layout:** Full screen, no sidebar, no chrome — maximum ticket space

```
┌──────────────────────────────────────────────────────────────────────────┐
│ KDS — Grill Station │ All Day: 4 Ribeye, 3 Salmon, 2 Burger │ [Recall] │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────┤
│ #1244    │ #1245    │ #1246    │ #1247    │ #1248    │ #1249    │      │
│ T8 Dine  │ T3 Dine  │ TO       │ T14 Dine │ DEL      │ T6 Dine  │      │
│ Sarah    │ John     │ Alex     │ Sarah    │ Maria    │ Tom      │      │
│ 12:32    │ 8:45     │ 3:21     │ 1:15     │ 0:45     │ 0:12     │      │
│ ──────── │ ──────── │ ──────── │ ──────── │ ──────── │ ──────── │      │
│ 2 Ribeye │ 1 Salmon │ 1 Burger │ 1 Ribeye │ 2 Burger │ 1 Salmon │      │
│   MR     │   Rare   │   Med    │   Med    │   MW     │   MR     │      │
│   mash   │   rice   │   fries  │   mash   │   fries  │   aspara │      │
│ 1 Salmon │ 1 Chick  │   +bacon │   spin   │ 1 Chick  │ 1 Ribeye │      │
│   MR     │   xtra   │   NO     │ 1 Salmon │          │   Rare   │      │
│   aspara │   sauce   │   PICKLE│   Rare   │          │   mash   │      │
│          │ ⚠ NUT    │          │   aspara │          │          │      │
│          │  ALLERGY │          │          │          │          │      │
│          │          │          │          │          │          │      │
│ ──────── │ ──────── │ ──────── │ ──────── │ ──────── │ ──────── │      │
│ [BUMP]   │ [BUMP]   │ [BUMP]   │ [BUMP]   │ [BUMP]   │ [BUMP]   │      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────┘
```

**KDS Ticket Specifications:**

```
Layout: horizontal scroll, newest tickets on RIGHT (configurable LTR or RTL)
Tickets visible: 6 on 12.9" iPad, 5 on 10.x", 4 on mini
Ticket width: equal division of screen width (with 8px gaps)
Ticket margin: 8px

Header bar (top of screen, 48px):
  Left: "KDS — [Station Name]" 18px bold white on gray-900
  Center: All-Day summary: "4 Ribeye, 3 Salmon, 2 Burger" — scrollable
    Each item: 15px medium, quantity in bold
  Right: [Recall] button — shows recently bumped tickets

Ticket card:
  Background: white (aging changes this)
  Border-radius: 12px
  Shadow: shadow-md
  Full height of content area minus header

  Ticket header (48px):
    Order number: 20px bold gray-900, "#1244"
    Order type + table: 14px, badge style
      Dine-In: info badge, "T8"
      Takeout: accent badge, "TO"
      Delivery: violet badge, "DEL"
    Server: 13px gray-500
    Timer: 16px semibold, top-right
      Running timer from when ticket was fired
      Color follows aging rules

  Items area (scrollable):
    Item name: 18px bold gray-900
    Quantity: preceding the name
    Modifier: 16px regular gray-700, indented 16px
    Course indicator: "═══ COURSE 2 ═══" divider, 14px semibold gray-500
    "NO [item]" removals: 16px bold error-600, prefixed "NO "
    Special instructions: 16px medium warning-700 on warning-50 bg, full-width banner
    Allergen alert:
      FULL-WIDTH BANNER, error-500 bg, white text
      "⚠ NUT ALLERGY" or "⚠ GLUTEN FREE"
      18px bold, icon left, padding 8px 12px
      CANNOT BE MISSED — most important visual element on ticket

  Aging colors (applied to ticket background):
    0-5 min:   white bg, gray-200 border
    5-10 min:  warning-50 bg, warning-300 border
    10-15 min: error-50 bg, error-300 border, timer turns red
    15+ min:   error-100 bg, error-500 border, entire header red bg white text

  Rush indicator:
    "🔥 RUSH" banner across top of ticket, error-500 bg, white text
    Or lightning bolt icon + "RUSH" in ticket header

  BUMP button:
    Full width at bottom of ticket
    48px height
    success-500 bg, white text, "BUMP" 18px bold
    Tap: ticket slides up and fades out (300ms)
    Double-tap protection: 500ms cooldown

  Course fire buttons:
    When coursing is active, show "FIRE COURSE 2" button between courses
    Primary button style

Sound:
  New ticket: chime sound (configurable)
  Late ticket crossing threshold: alert tone
  Volume controllable from settings

All-Day Panel (expandable):
  Tapping "All Day" in header expands to full-width overlay
  Shows aggregate count per item across all open tickets
  Sorted by quantity descending
  4-column table: Item | Count | Mods breakdown | Stations

Recall:
  Tapping [Recall] shows last 10 bumped tickets in a bottom sheet
  Can un-bump (restore) any ticket
  Tickets auto-clear from recall after 2 hours
```

---

### 2.8 Reports Dashboard

**Layout:** Full screen, sidebar expanded (240px), responsive

```
┌──────────────┬───────────────────────────────────────────────────────┐
│              │  Dashboard                    Today │ This Week │ ▾  │
│  REPORTS     ├───────────────────────────────────────────────────────┤
│              │                                                       │
│  ○ Dashboard │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────┐│
│  ○ Sales     │  │Total Sales│ │  Orders   │ │ Avg Check │ │Labor%││
│  ○ Labor     │  │ $8,432    │ │   127     │ │  $66.39   │ │ 24%  ││
│  ○ Menu Mix  │  │ ↑ 12%     │ │ ↑ 8%     │ │ ↑ 3%     │ │ ↓ 2% ││
│  ○ Servers   │  └───────────┘ └───────────┘ └───────────┘ └──────┘│
│  ○ Voids     │                                                       │
│  ○ Cash      │  ┌─────────────────────────────────────────────────┐ │
│  ○ Speed     │  │  Hourly Sales                                   │ │
│              │  │  $1200 ┤                                         │ │
│              │  │  $1000 ┤         ╭─╮                             │ │
│              │  │   $800 ┤      ╭──╯ ╰──╮     ╭─╮                 │ │
│              │  │   $600 ┤   ╭──╯       ╰──╮╭─╯ ╰──╮             │ │
│              │  │   $400 ┤╭──╯              ╰╯      ╰──╮          │ │
│              │  │   $200 ┤╯                             ╰──       │ │
│              │  │        └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──       │ │
│              │  │         10 11 12  1  2  3  4  5  6  7  8       │ │
│              │  └─────────────────────────────────────────────────┘ │
│              │                                                       │
│              │  ┌────────────────────┐ ┌────────────────────────┐  │
│              │  │ Sales by Category  │ │ Payment Methods        │  │
│              │  │    [pie chart]     │ │    [donut chart]       │  │
│              │  └────────────────────┘ └────────────────────────┘  │
│              │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

**Dashboard Specifications:**

```
Sidebar (240px, light variant for reports):
  Background: white
  Border right: 1px gray-200
  Nav items: 48px height, 16px icon + 15px medium text
  Active: primary-50 bg, primary-700 text, left 3px border primary-700
  Icon: 20px, gray-400 default, primary-700 active

KPI Cards (top row):
  Grid: 4 columns equal width, 12px gap
  Height: 96px
  Background: white, shadow-sm, 12px border-radius
  Padding: 16px
  Label: 13px medium gray-500, uppercase
  Value: 28px bold gray-900
  Comparison: 14px medium + arrow icon
    Positive: success-600 text, up arrow
    Negative: error-600 text, down arrow
    Neutral: gray-500 text

Charts:
  Hourly sales: area chart, primary-200 fill, primary-700 line
  Category breakdown: horizontal bar chart or pie chart
  Payment methods: donut chart
  Chart library: Chart.js or lightweight SVG
  Axes: 13px gray-500
  Grid lines: gray-100
  Tooltips: white bg, shadow-md, 14px, on hover/touch

Date range selector (top right):
  Chip group: "Today" | "This Week" | "This Month" | "Custom"
  Custom: opens date range picker modal
  Comparison toggle: "vs. Last Week" checkbox

Export buttons:
  [Export CSV] [Export PDF] — secondary buttons, top right
  14px, icon + text
```

**Report Subpages (accessed from sidebar):**

**Sales Report:**
```
- Summary cards: gross sales, net sales, discounts, refunds, tax collected
- Breakdown table: by hour, by category, by order type, by server
- Sortable columns, filterable
- Chart + table combo view
```

**Labor Report:**
```
- Employee list with: name, role, hours, overtime, tips, labor cost
- Labor cost as % of sales (gauge chart, target line)
- Overtime alerts: yellow highlight for approaching overtime, red for over
- Clock-in/out detail: expandable rows showing punch times
```

**Menu Mix:**
```
- Every item: quantity sold, gross sales, % of total, food cost %, profit
- Sortable by any column
- "Stars, Puzzles, Plowhorses, Dogs" matrix visualization (optional)
- Filter by category, daypart
```

**Server Performance:**
```
- Each server: checks, average check, covers, sales, tips, tip %
- Speed metrics: avg time to first item sent, avg table turn time
- Comparison bar chart across servers
```

**Voids/Comps/Discounts:**
```
- Each transaction: who, what, when, why (reason code), manager who approved
- Totals per category
- Flag unusual patterns (highlight if server's void rate > 2x average)
```

**Cash Management:**
```
- Expected vs actual drawer balance
- Cash in/out log (each event with timestamp, employee, amount, reason)
- Drawer count detail (start of shift, end of shift)
- Overages/shortages highlighted
```

**Speed of Service:**
```
- Average ticket time (fire to bump) per station
- Distribution chart (histogram of ticket times)
- Slowest tickets table
- Trend over time
```

---

### 2.9 Menu Management (Back Office)

**Layout:** Full screen, sidebar navigation, three-panel view

```
┌──────────┬─────────────┬─────────────────────────────────────────┐
│          │ MENU TREE   │ ITEM EDITOR                             │
│ BACK     │             │                                         │
│ OFFICE   │ ▾ Lunch     │ Ribeye Steak                           │
│          │   ▾ Apps    │ ┌─────────────────────────────────────┐ │
│ ○ Menu   │     Caesar  │ │ Name: [Ribeye Steak              ] │ │
│ ○ Staff  │     Calama  │ │                                     │ │
│ ○ Settng │   ▾ Entrees │ │ Description:                        │ │
│          │     Ribeye ←│ │ [14oz prime ribeye, charbroiled   ] │ │
│          │     Salmon  │ │                                     │ │
│          │     Chicken │ │ Price: [$42.00      ]               │ │
│          │   ▾ Sides   │ │ Happy Hour: [$36.00 ]               │ │
│          │   ▾ Drinks  │ │                                     │ │
│          │ ▾ Dinner    │ │ Category: [Entrees         ▾]      │ │
│          │ ▾ Bar       │ │ Tax Class: [Food           ▾]      │ │
│          │             │ │                                     │ │
│          │ [+ Category]│ │ Modifiers:                           │ │
│          │ [+ Item]    │ │ ☑ Temperature (required)            │ │
│          │             │ │ ☑ Side Choice (required)             │ │
│          │             │ │ ☐ Add-Ons (optional)                │ │
│          │             │ │ [Manage Modifier Groups →]          │ │
│          │             │ │                                     │ │
│          │             │ │ Dietary: [GF] [DF] [ ] [ ]         │ │
│          │             │ │ Image: [Upload] [photo preview]     │ │
│          │             │ │                                     │ │
│          │             │ │ Availability:                        │ │
│          │             │ │ ☑ Lunch  ☑ Dinner  ☐ Late Night    │ │
│          │             │ │ ☑ Mon-Fri  ☑ Sat-Sun               │ │
│          │             │ │                                     │ │
│          │             │ │ [Save Changes]  [86 This Item]      │ │
│          │             │ └─────────────────────────────────────┘ │
└──────────┴─────────────┴─────────────────────────────────────────┘
```

**Menu Tree Panel (280px):**
```
Background: gray-50
Border right: 1px gray-200
Scrollable

Tree nodes:
  Menu level: 16px semibold gray-700, collapsible triangle icon
  Category level: 15px medium gray-600, indented 16px, drag handle
  Item level: 14px regular gray-700, indented 32px, drag handle
  Active item: primary-50 bg, primary-700 text, right arrow indicator

Drag-and-drop:
  Grab: item lifts (shadow-lg)
  Drop targets: between items (blue insertion line), or onto categories
  Reorder within category or move between categories

Bottom actions:
  [+ New Category] — secondary button, full width
  [+ New Item] — primary button, full width
  8px gap between buttons
  Padding: 12px
```

**Item Editor Panel (remaining width):**
```
Background: white
Padding: 24px
Scrollable

Form layout: single column, max-width 640px, centered

Fields:
  Name: text input, 48px height, full width
  Description: textarea, 3 rows, full width
  Price: currency input, 200px wide
  Happy Hour/Alternate price: currency input, appears when toggled
  Category: select dropdown
  Tax class: select dropdown
  Modifiers: checkbox list of modifier groups, with "Manage" link
  Dietary tags: chip group, multi-select (GF, DF, V, VG, Spicy, Nuts, Shellfish)
  Image: file upload with preview thumbnail (120x120)
  Availability: checkbox groups for dayparts and days

  86 toggle: prominent switch at top-right of form
    "86'd (Out of Stock)" — when on, turns red, disables item on POS immediately

Save: primary button, 48px
Cancel: secondary button
Delete: danger ghost button at very bottom with confirmation dialog
```

**Modifier Group Editor (modal):**
```
Width: 640px modal

Group name: text input
Type: radio — "Choose Exactly 1" | "Choose Up To N" | "Choose At Least N"
Min/Max: number steppers (shown based on type)

Modifier options list:
  Each row: drag handle | name input | price input | [delete]
  [+ Add Option] button at bottom
  Drag to reorder

[Save Group] [Cancel]
```

---

### 2.10 Staff Management (Back Office)

**Layout:** Data table view with side detail panel

**Employee List:**
```
Table columns: Name | Role | Status | Phone | PIN | Last Clock-In | Actions
Row height: 56px
Tapping a row: opens detail panel on right (400px)
[+ Add Employee] primary button top right
Search/filter bar: by name, role

Role badges: Manager (violet), Server (info), Bartender (accent), Host (gray), Cook (warning)
Status: active (green dot), inactive (gray dot)
```

**Employee Detail Panel:**
```
Header: full name, 24px bold, role badge
Avatar: 64px initials circle

Fields:
  First name, last name: text inputs
  Role: select (Manager, Server, Bartender, Host, Cook, Busser, Custom)
  PIN: 4-6 digit field (masked, reveal button)
  Phone: phone input
  Email: email input
  Pay rate: currency input + select (hourly/salary)
  Locations: multi-select (for multi-location)

Permissions (checkboxes by category):
  Orders: create, modify, void (manager), apply discount (manager)
  Payments: process, refund (manager), no-sale drawer open (manager)
  Reports: view own stats, view all (manager), export (manager)
  Menu: view, edit (manager), 86 items
  Staff: view, edit (manager)
  Settings: access (admin only)

[Save] [Deactivate Employee]
```

**Time Clock Report:**
```
Date range selector at top
Table: Date | Clock In | Clock Out | Hours | Overtime | Break | Tips
  Total row at bottom: bold, gray-50 bg
  Overtime cells: warning-100 bg when approaching, error-100 when over
  Missing punch: error indicator, editable by manager

Export: [Export to CSV] [Print]
```

---

### 2.11 Settings

**Layout:** Settings list (left panel, 300px) + detail form (right panel)

**Settings Categories:**
```
Location:
  - Restaurant name, address, phone
  - Timezone picker
  - Tax rates table (rate name, percentage, applies to)
  - Receipt header (textarea, 4 lines) and footer (textarea, 2 lines)
  - Logo upload

Terminal:
  - Terminal name
  - Assigned printers (multi-select from discovered)
  - Payment reader assignment
  - Default order type
  - Auto-lock timeout

Orders:
  - Enabled order types: checkboxes (dine-in, takeout, delivery, bar)
  - Auto-gratuity: toggle + rules (party size >= N, percentage)
  - Default tip suggestions: 3 percentage inputs
  - Require seat numbers: toggle
  - Coursing enabled: toggle
  - Course names: editable list

Notifications:
  - KDS new order sound: select + volume slider
  - KDS aging alert sound: select + threshold (minutes)
  - Order update push notifications: toggle

Integrations:
  - Online ordering: toggle + configuration
  - Payment processor: select + credentials
  - Accounting: QuickBooks/Xero connection
  - Delivery: DoorDash, UberEats toggles + API keys

Modules:
  - Toggle switches for: Online Ordering, Kiosk, Customer Display,
    Reservations, Inventory, Loyalty, Gift Cards
  - Each module: toggle + [Configure] button
```

---

### 2.12 Online Ordering (Module — Customer-Facing)

**Layout:** Responsive web page, phone-first design

```
Mobile (375px):                        Tablet/Desktop (768px+):
┌─────────────────┐                   ┌────────────────┬──────────┐
│ [Logo] Menu  🛒3│                   │                │          │
├─────────────────┤                   │   Menu Grid    │  Cart    │
│ [Hero Image]    │                   │   (3 columns)  │  Panel   │
│ "Order Online"  │                   │                │  (320px) │
├─────────────────┤                   │  [items...]    │  [items] │
│ Apps│Mains│Sides│                   │                │  [total] │
├─────────────────┤                   │                │  [check] │
│ ┌──────────────┐│                   │                │          │
│ │ [img] Caesar │││                   └────────────────┴──────────┘
│ │ $14.00  [+] │││
│ └──────────────┘│
│ ┌──────────────┐│
│ │ [img] Calama │││
│ │ $16.00  [+] │││
│ └──────────────┘│
│ ...             │
├─────────────────┤
│ Cart: 3 items   │
│ $52.00 [View →] │
└─────────────────┘
```

**Specifications:**
```
Mobile-first, responsive breakpoints at 640px, 768px, 1024px

Header: sticky, 56px, logo left, "Menu" center link, cart icon right with badge
Hero: restaurant image, 200px tall on mobile, 300px on desktop, overlay text
Categories: horizontal scroll tabs, sticky below header

Menu items:
  Mobile: full-width cards, image left (80x80), text right, [+] button
  Desktop: 3-column grid cards, image top (160px), text below
  Card: 12px radius, shadow-sm, white bg
  Name: 16px semibold
  Description: 14px gray-500, 2 lines max
  Price: 16px semibold primary-700
  [+] button: 44x44, primary, plus icon

Item detail (tapping item): bottom sheet (mobile) or modal (desktop)
  Full image: 240px tall
  Name: 20px bold
  Description: 15px gray-600
  Modifiers: same as POS modifier selection (bigger touch targets)
  Quantity stepper
  [Add to Cart — $16.00] button, full width, primary, 52px

Cart:
  Mobile: bottom sheet, peek shows item count + total
  Desktop: right sidebar, 320px, sticky
  Items: name, qty, price, swipe to remove
  Promo code: text input + [Apply]
  Subtotal, tax, total

Checkout:
  Order type: Pickup / Delivery toggle
  Delivery: address input with autocomplete
  Pickup time: select available time slots (15-min increments)
  Customer info: name, phone, email
  Payment: Valor hosted payment form (tokenized card entry)
  Tip: 15% | 18% | 20% | Custom | No tip
  [Place Order — $68.42] button

  Confirmation: order number, estimated time, animated check
  Tracking page: status steps (Received → Preparing → Ready → Picked Up)
```

---

### 2.13 Customer-Facing Display

**Layout:** Full screen, landscape, on second iPad or screen facing customer

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│                    [Restaurant Logo]                               │
│                    "Welcome!"                                      │
│                                                                    │
│     ┌────────────────────────────────────────────────────┐        │
│     │                                                      │        │
│     │  1x  Caesar Salad ........................ $14.00    │        │
│     │  1x  Ribeye Steak ....................... $42.00    │        │
│     │       + mashed potatoes                              │        │
│     │                                                      │        │
│     │                                                      │        │
│     │  ─────────────────────────────                       │        │
│     │  Subtotal ............................ $56.00        │        │
│     │  Tax .................................. $5.04         │        │
│     │  ─────────────────────────────                       │        │
│     │  Total ................................ $61.04       │        │
│     │                                                      │        │
│     └────────────────────────────────────────────────────┘        │
│                                                                    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Specs:**
```
Background: configurable (white default, or restaurant brand color)
Logo: centered top, max 120px height
Items: appear with slide-in animation as they're added on server POS
Prices: right-aligned, tabular numbers
Total: 36px bold
Font sizes: 20-30% larger than POS (customer viewing from 2-3 feet away)

When payment initiated, screen transitions to:
  Tip selection screen (same as payment flow tip screen but LARGER)
  Tip buttons: 120x100px, 24px text
  Then: "Thank you!" with optional promotional message
  Returns to welcome/idle screen after 5 seconds

Idle screen: slideshow of restaurant images, or logo + "Welcome" static
```

---

### 2.14 Kiosk Mode (Module)

**Layout:** Full screen, portrait orientation (iPad on stand)

```
┌───────────────────────┐
│     [Restaurant Logo] │
│                       │
│  ORDER HERE            │
│                       │
│  ┌─────────────────┐ │
│  │   DINE IN       │ │
│  └─────────────────┘ │
│  ┌─────────────────┐ │
│  │   TAKE OUT      │ │
│  └─────────────────┘ │
│                       │
│  [Loyalty? Tap here] │
└───────────────────────┘
```

Flows through: Order Type → Category browsing → Item detail → Cart → Payment

**Specifications:**
```
Everything oversized for public self-service:
  Buttons: 64px height minimum
  Font: 20px body, 28px headings, 40px prices
  Images: large, appetizing (200px+ per item)
  Touch targets: 56px minimum

Navigation: large back button, progress indicator (step 1 of 4)
Categories: full-width buttons with images, vertical list or 2-column grid
Items: large cards with full-bleed images, name overlay, price
Modifiers: same flow as POS but larger
Cart: always visible as bottom bar showing item count + total
  Expands on tap to show full cart

Upsell prompt:
  After adding an entree: "Add a side?" with 2-3 options
  After cart review: "Add a drink?" with popular options
  Non-intrusive: can skip with "No thanks" button

Payment: integrated card reader
  "Insert or tap card below" with arrow pointing to reader
  Large tip buttons
  Receipt: print or email

Accessibility:
  Optional "Accessibility Mode" button in corner
  Increases all text sizes, adds voice readback
  Wheelchair-height considerations (put primary actions in lower 60% of screen)

Timeout: after 2 minutes of inactivity, show "Are you still there?" modal
  10 second countdown, then reset to welcome screen
```

---

## 3. NAVIGATION ARCHITECTURE

### Primary Navigation Model: Sidebar + Contextual Top Bar

```
Sidebar (always present, collapsible):
  - Orders (POS entry screen) — home/default
  - Tables (floor plan)
  - Checks (open check list)
  - KDS (kitchen display — typically on dedicated terminal)
  - Reports (manager only — PIN gate)
  - Back Office (menu, staff, settings — PIN gate)

Top bar (contextual per screen):
  - Left: sidebar toggle + screen title
  - Center: contextual tabs or info (order type, table number)
  - Right: user info, notifications bell, settings shortcut

Quick-switch:
  Swipe from left edge opens sidebar overlay (on collapsed state)
  Bottom of sidebar: quick-switch icons for Orders / Tables / Checks (always visible even collapsed)
  These three are the fastest-access screens

Manager functions:
  Reports and Back Office nav items show lock icon
  Tapping prompts for manager PIN (4-6 digit numpad)
  Manager session: stays unlocked for configurable duration (default 15 min)
  Visual indicator when in manager mode (subtle gold/amber top bar accent)
```

### Keyboard Shortcuts (Bluetooth keyboard)

```
Global:
  Cmd+1: Orders screen
  Cmd+2: Tables screen
  Cmd+3: Checks screen
  Cmd+K: Search (menu items, checks, anything)
  Cmd+N: New order
  Escape: Close modal/popover, back

Order Entry:
  Tab: cycle through menu categories
  Enter: send order
  /: focus search
  Numbers 1-9: quantity for next item tapped

Payment:
  C: cash
  D: card
  G: gift card
  Enter: confirm payment
```

---

## 4. ANIMATION & FEEDBACK

### Touch Feedback
```
Button press: scale(0.97), 100ms ease, immediate on touchstart
Menu item tap: scale(0.96), 120ms spring
  If item added: brief green flash (success-200 overlay, 200ms)
Toggle: 150ms ease-in-out
Haptic: navigator.vibrate(10) on button press (if supported)
```

### Confirmations
```
Order sent to kitchen:
  Send button turns success-500, check icon replaces text
  Hold for 400ms, then restore
  Optional: confetti particles from button (subtle, 300ms)
  Sound: soft "sent" chime

Item added to order:
  Item slides into order panel from right
  Order total pulses (scale 1→1.05→1, 200ms)

Payment approved:
  Large animated checkmark (Lottie animation or CSS)
  Green circle expands from center
  "Approved" text fades in below
  Duration: 1.5 seconds
```

### Error Feedback
```
PIN wrong:
  Dots shake horizontally (3 oscillations, 300ms, CSS keyframes)
  Dots flash red, then clear
  Subtle red screen flash (border pulse)

Validation error:
  Input border turns error-500
  Error message slides in below (height animation, 200ms)
  Field label turns error-600

Network error:
  Toast notification (error variant)
  Retry button in toast
  Offline indicator: amber banner at top of screen, "Offline — Orders will sync when reconnected"
```

### Loading States
```
Page transitions: instant swap, no page-level loading
Data loading: skeleton screens matching exact layout of content
  Shimmer animation: 1.5s linear infinite
  Color: gray-200 with gray-300 highlight sweep
Avoid: spinning indicators, full-screen loaders, progress bars for fast operations
Use spinners ONLY for: payment processing, printer communication (> 1 second operations)
```

### Page Transitions
```
Screen changes (nav): instant, no transition (speed > aesthetics)
Modal open: overlay fades in 150ms, content slides up 200ms ease-out
Modal close: content slides down 150ms, overlay fades 100ms
Side panel open: slides from right, 200ms ease-out
Side panel close: slides to right, 150ms ease-in
Bottom sheet: spring animation, 250ms, slight overshoot
```

---

## 5. ACCESSIBILITY

### WCAG 2.1 AA Compliance

**Color Contrast:**
```
Normal text (< 18px): minimum 4.5:1 contrast ratio
Large text (>= 18px bold or >= 24px): minimum 3:1 contrast ratio
UI components and graphical objects: minimum 3:1

Verified combinations:
  gray-800 on white: 12.6:1 ✓ (primary text)
  gray-600 on white: 5.9:1 ✓ (body text)
  gray-500 on white: 4.6:1 ✓ (secondary text — meets AA)
  primary-700 on white: 4.8:1 ✓ (brand links/buttons)
  white on primary-700: 4.8:1 ✓ (button text)
  white on error-500: 4.6:1 ✓ (error buttons)
  error-700 on white: 6.1:1 ✓ (error text)
  warning-700 on white: 5.0:1 ✓ (warning text)
  gray-400 on white: 2.7:1 ✗ (placeholder only — acceptable per WCAG)
```

**Focus Indicators:**
```
All interactive elements: 2px solid primary-400, 2px offset
Focus visible only on keyboard navigation (`:focus-visible`)
Tab order: logical, follows visual layout left-to-right, top-to-bottom
Skip links: hidden "Skip to main content" link, visible on focus
Focus trap: modals and dialogs trap focus within
```

**Screen Reader:**
```
All images: descriptive alt text
Icon buttons: aria-label (e.g., aria-label="Delete item")
Status changes: aria-live="polite" for order updates, "assertive" for errors
Table numbers: announced as "Table 14, 4 guests, seated 25 minutes"
Order items: quantity, name, modifiers, price read in sequence
Modals: role="dialog", aria-modal="true", aria-labelledby
Tabs: role="tablist", role="tab", aria-selected
```

**Font Size:**
```
Settings option: "Large Text Mode"
  Increases all text by 25% (body becomes 20px)
  Adjusts layout: menu grid drops to 3 columns, order panel widens
  Touch targets remain above 44px minimum (they get larger too)

System text scaling: respect iOS Dynamic Type via rem units
```

**High Contrast Mode:**
```
Settings option: "High Contrast"
  Increases all borders to 2px
  Uses gray-900/gray-950 for all text (no gray-500/gray-600)
  Status colors become more saturated
  Removes subtle background tints (everything on pure white)
  Adds text labels to all icon-only buttons
```

**Motor Accessibility:**
```
All touch targets >= 44x44px (Apple HIG)
No time-sensitive interactions (except payment timeout, which has extend option)
No drag-and-drop required — always an alternative button/menu option
  Floor plan: edit via form instead of drag
  Split check: "Move to Check B" button instead of drag
  Menu reorder: up/down arrows instead of drag
```

---

## 6. RESPONSIVE BEHAVIOR

### Breakpoints

```
iPad 12.9" landscape: 1366 x 1024 (or 1194 x 834 for 11")
iPad 10.9" landscape: 1180 x 820
iPad 10.2" landscape: 1080 x 810
iPad mini 8.3" landscape: 1133 x 744
iPad portrait (any): width 768-1024, height 1024-1366
Phone (reports only): 375-428 width
Android tablet: 1280 x 800 typical
```

### Layout Adaptations

**iPad 12.9" Landscape (Primary target):**
```
Full layout as designed:
  Sidebar: 64px (collapsed) or 240px (expanded)
  Order panel: 360px
  Menu grid: 4 columns
  All content visible, no scrolling needed for primary flows
  KDS: 6 tickets visible
```

**iPad 10.2" / 10.9" Landscape:**
```
  Sidebar: 64px (always collapsed, expand as overlay)
  Order panel: 320px
  Menu grid: 4 columns (slightly smaller items, 88px height)
  Category tabs: scrollable (some hidden)
  KDS: 5 tickets visible
```

**iPad mini 8.3" Landscape:**
```
  Sidebar: 64px (always collapsed, expand as overlay)
  Order panel: 280px
  Menu grid: 3 columns (items 80px height)
  Quick actions bar: scrollable, only icons (no text labels)
  Modifier panel: full-screen modal instead of side panel
  KDS: 4 tickets visible
  Table detail: bottom sheet instead of popover
```

**iPad Portrait (any size):**
```
  Sidebar: hidden, accessible via hamburger menu (overlay)
  Order panel: full width, bottom 40% of screen (slides up from bottom)
    Or toggle: menu grid takes full screen, order panel as bottom sheet
  Menu grid: 3 columns on 12.9", 2 columns on smaller
  Two-mode toggle: "Menu" (full screen grid) / "Order" (full screen order list)
  Payment: full screen, single column
  KDS: vertical ticket stack instead of horizontal
  Reports: single column, cards stack vertically
```

**Phone (375-428px — Reports ONLY):**
```
  Single column layout
  Sidebar: bottom tab bar (5 icons max)
  KPI cards: 2 columns or full-width stacked
  Charts: full width, horizontal scroll for wide charts
  Tables: horizontal scroll with sticky first column
  Date picker: full-screen modal
  No order entry or POS functions on phone
```

**Android Tablet (Samsung Galaxy Tab, etc.):**
```
  Same breakpoints as iPad based on screen width
  Test with Chrome Android
  Adjust for: no safe area insets, different scrollbar behavior
  Ensure touch-action: manipulation to prevent double-tap zoom
  No iOS-specific APIs (haptic — fall back gracefully)
```

### Orientation Lock Recommendation
```
POS terminals: landscape only (show "Please rotate" message in portrait if not adaptable)
Kiosk: portrait only
Customer display: landscape only
Reports on phone: allow both
```

---

## 7. IMPLEMENTATION NOTES FOR FLASK/JINJA2

### Tech Stack
```
Backend: Flask + Jinja2 templates
Frontend interactivity: htmx (server-driven updates) + Alpine.js (client-side state)
CSS: Tailwind CSS (utility-first, matches this spec closely)
Icons: Heroicons (by Tailwind team) or Lucide
Charts: Chart.js (lightweight) or Apache ECharts
Animations: CSS transitions + keyframes (no heavy JS animation libraries)
Real-time: Server-Sent Events (SSE) via htmx for KDS updates, order status
Touch: Hammer.js for swipe gestures, or native touch events
Drag-and-drop: SortableJS (for menu reorder, table drag)
```

### Template Structure
```
templates/
├── base.html                 # html shell, head, scripts, sidebar
├── components/
│   ├── _button.html          # {% macro button(text, variant, size) %}
│   ├── _input.html
│   ├── _modal.html
│   ├── _toast.html
│   ├── _card.html
│   ├── _badge.html
│   ├── _table.html
│   ├── _numpad.html
│   ├── _order_item.html
│   ├── _menu_item.html
│   └── _kds_ticket.html
├── pos/
│   ├── order_entry.html      # main POS screen
│   ├── modifier_panel.html   # htmx partial
│   ├── item_edit.html        # htmx partial (popover content)
│   └── payment.html
├── tables/
│   ├── floor_plan.html
│   └── table_detail.html     # htmx partial
├── checks/
│   ├── check_list.html
│   ├── check_detail.html
│   └── split_check.html
├── kds/
│   └── display.html          # standalone KDS page
├── reports/
│   ├── dashboard.html
│   ├── sales.html
│   ├── labor.html
│   └── ... (one per report)
├── backoffice/
│   ├── menu_manager.html
│   ├── staff_manager.html
│   └── settings.html
├── auth/
│   ├── pin_login.html
│   └── clock_in.html
├── online/
│   ├── menu.html             # customer-facing online ordering
│   ├── cart.html
│   ├── checkout.html
│   └── tracking.html
├── kiosk/
│   └── kiosk.html            # self-service kiosk
└── customer_display/
    └── display.html           # customer-facing screen
```

### CSS Custom Properties (map to Tailwind config)
```css
:root {
  --color-primary-50: #F0FDFA;
  --color-primary-100: #CCFBF1;
  --color-primary-200: #99F6E4;
  --color-primary-300: #5EEAD4;
  --color-primary-400: #2DD4BF;
  --color-primary-500: #14B8A6;
  --color-primary-600: #0D9488;
  --color-primary-700: #0F766E;
  --color-primary-800: #115E59;
  --color-primary-900: #134E4A;
  --color-primary-950: #042F2E;

  --color-accent: #F59E0B;
  --color-accent-light: #FEF3C7;
  --color-accent-dark: #D97706;

  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

  --topbar-height: 56px;
  --sidebar-collapsed: 64px;
  --sidebar-expanded: 240px;
  --order-panel-width: 360px;
  --bottombar-height: 64px;
}
```

### htmx Patterns
```
Menu item tap → POST to /order/add-item with hx-target="#order-panel"
  Returns updated order panel HTML fragment
  If modifiers required: returns modifier panel partial, swapped into menu area

Modifier submit → POST to /order/confirm-item with hx-target="#order-panel"
  Returns updated order panel

Order send → POST to /order/send with hx-target="#order-panel"
  Returns confirmation state, then resets after delay

KDS updates → SSE connection to /kds/stream
  Each event pushes a ticket partial or bump confirmation

Table status → SSE connection to /tables/stream
  Each event updates individual table icons via hx-swap-oob

Real-time sync → All terminals subscribe to SSE channels
  Orders, table status, 86'd items broadcast to all connected clients
```

---

## 8. DESIGN DECISION RATIONALE

**Why light theme, not dark?**
Restaurants have varying ambient light. Light themes maintain readability in bright front-of-house conditions. KDS in kitchen can optionally use dark mode (bright screens in dim kitchens), but the toggle should exist per-terminal, not globally.

**Why Inter font?**
Tested at 14px+ on iPad retina, Inter has outstanding legibility. Tabular number support means prices align perfectly. Widely cached, fast loading. The alternative was SF Pro (system font on iOS) which also works but isn't available on Android tablets.

**Why 4-column menu grid default?**
At 96px item height on a 12.9" iPad, 4 columns with 8px gaps fills the space well, showing 16-20 items without scrolling. 3-column feels sparse (too much whitespace). 5-column works for text-only items but breaks if images are used.

**Why order panel on the LEFT?**
Most servers are right-handed and hold the iPad in the left hand or on a surface. The right hand naturally reaches the menu grid. The order summary needs to be visible but not the primary interaction target — it's reference information. Left placement also mirrors the physical receipt that sits to the left of the register in traditional setups. This matches Toast's layout, which servers are already trained on.

**Why sidebar navigation instead of bottom tabs?**
Bottom tabs consume 64px of vertical space on every screen. On a landscape iPad, vertical space is precious (only 1024px or less). A 64px collapsed sidebar uses horizontal space, which is abundant. The sidebar also allows more nav items without feeling cramped, and expandable labels aid discoverability for new staff.

---

*End of design specification. Every screen, component, color, and pixel value documented for developer implementation.*



---


# Part 8: Module Catalog

## Core Modules (Always Active)

| Module | ID | Purpose |
|--------|----|---------|
| POS | `core.pos` | Order entry, checkout, payments — the heartbeat of the system |
| Menu | `core.menu` | Menu categories, items, modifiers, pricing, dayparts |
| Staff | `core.staff` | Users, roles, permissions, PIN login, basic time tracking |
| Reports | `core.reports` | Daily sales, labor cost, product mix, end-of-day summaries |
| Settings | `core.settings` | Location config, tax rates, printer setup, terminal management |

Core modules cannot be disabled. They represent the minimum viable restaurant POS.

## Optional Modules

| Module ID | Name | Dependencies | Monthly Price | Description |
|-----------|------|-------------|--------------|-------------|
| `mod.kds` | Kitchen Display System | core.pos | $49/screen | Real-time kitchen order display with bump-bar support, station routing, ticket timers, color-coded alerts |
| `mod.online_ordering` | Online Ordering | core.menu | $99 | Commission-free online ordering through restaurant's own website. Menu auto-syncs. |
| `mod.inventory` | Inventory Management | core.menu | $79 | Par levels, purchase orders, waste tracking, vendor management, food cost calculation |
| `mod.loyalty` | Loyalty & Rewards | core.pos | $69 | Points-based loyalty (phone number enrollment), reward tiers, customer profiles |
| `mod.marketing` | Marketing & Campaigns | mod.loyalty | $49 | Email/SMS campaigns via SendGrid and Twilio, targeted promotions, automated "we miss you" outreach |
| `mod.scheduling` | Staff Scheduling | core.staff | $59 | Drag-and-drop scheduling, availability tracking, shift swaps, labor cost forecasting |
| `mod.payroll` | Payroll Integration | core.staff, mod.scheduling | $39 | Integration with Gusto, ADP, Paychex. Syncs hours, tips, overtime. |
| `mod.catering` | Catering Management | core.menu, mod.online_ordering | $49 | Catering-specific menus, event management, delivery scheduling, deposit tracking |
| `mod.analytics` | Advanced Analytics | core.reports | $89 | Trend analysis, predictive forecasting, year-over-year comparisons, custom dashboards |
| `mod.gift_cards` | Gift Cards | core.pos | $29 | Physical and digital gift cards, balance tracking, cross-location redemption |
| `mod.reservations` | Reservations & Waitlist | — | $59 | Built-in reservations (or integration with OpenTable/Resy), waitlist management with SMS notifications |
| `mod.customer_display` | Customer-Facing Display | core.pos | $19/screen | Order review, tip prompts, loyalty enrollment on secondary screen |
| `mod.kiosk` | Self-Service Kiosk | core.menu, core.pos | $79/kiosk | Guest-facing self-order kiosk mode for fast-casual and QSR |
| `mod.delivery` | Delivery Management | mod.online_ordering | $69 | DoorDash Drive integration, in-house driver dispatch, delivery zone management |
| `mod.tables` | Table Management & Floor Plan | — | $39 | Visual floor plan editor, table status tracking, section assignment, server rotation |

### Module Architecture

Modules follow a strict isolation pattern. Each module:

- Lives in its own directory under `app/modules/`
- Has a `ModuleManifest` declaring its ID, dependencies, routes, hooks, permissions, and UI elements
- Registers a Flask Blueprint for its API routes
- Subscribes to events via the EventBus (never imports other modules directly)
- Owns its own database migrations (run per-tenant when module is activated)
- Adds navigation items, settings pages, and dashboard widgets dynamically

Modules communicate exclusively through events:
```
Core POS creates order
  -> emits "order.created"
    -> KDS module receives -> displays on kitchen screen
    -> Loyalty module receives -> awards points
    -> Inventory module receives -> decrements stock
    -> Analytics module receives -> updates real-time dashboard
```

### Module Dependency Resolution

When enabling a module that has dependencies, the system uses topological sort to enable prerequisites first. When disabling a module, it checks for dependents and either blocks the disable or cascades.

Example: Enabling `mod.marketing` (depends on `mod.loyalty`) auto-enables `mod.loyalty` first. Disabling `mod.loyalty` when `mod.marketing` is active blocks the disable or cascades deactivation.

---


# Part 9: Integration Ecosystem

## Tier 1 — Critical (Must-Have at Launch)

### 1. Payment Processing
- **Valor PayTech** — Sear's exclusive integrated payment processor. REST API + Valor Connect (MQTT) for terminal communication. Hardware: VP800 (dual display), VP550, VP300 Pro, RCKT (mobile Bluetooth), VL500.
- **Dual Pricing** — Built-in Valor feature that shows cash and card prices. Potentially offsets 100% of processing fees. Legal in all 50 states.
- Valor's processor-agnostic backend routes to TSYS, Fiserv, WorldPay, Elavon, EPX, Priority, or Repay for optimal interchange rates.
- Sear earns ISV revenue share on all processing volume.

### 2. Delivery Platforms
- **DoorDash** — Including DoorDash Drive for restaurants with their own online ordering
- **Uber Eats**
- **Grubhub**
- All orders flow into the same kitchen queue as dine-in orders (no separate tablet chaos)
- Middleware options: Chowly, Cuboh, Deliverect, KitchenHub for aggregation

### 3. Accounting
- **QuickBooks Online** — Primary. Auto-sync daily sales as sales receipts, broken down by category (food, beverage, retail). Labor cost sync.
- **Xero** — Secondary. International coverage.

### 4. Employee Scheduling / Labor
- **7shifts** — Restaurant industry leader. Syncs with payroll, labor cost management.
- **HotSchedules (Fourth)**
- **When I Work**
- **Homebase**

## Tier 2 — High Priority (Within 6 Months)

### 5. Payroll
- **Gusto** — Popular for SMB. Integrates with scheduling tools.
- **ADP** — Enterprise. Multi-state payroll.
- **Paychex** — Enterprise alternative.

### 6. Reservations
- **OpenTable** — Seats 1.6B diners/year at 60,000 restaurants
- **Resy**
- **Yelp Reservations**

### 7. Inventory / Food Cost
- **MarketMan** — Integrates with DoorDash, Uber Eats, Grubhub, OpenTable, 7shifts
- **BlueCart** — Procurement automation
- **Restaurant365** — All-in-one back office
- **MarginEdge** — Invoice processing, recipe costing

### 8. Loyalty
- Built-in via `mod.loyalty` module (preferred)
- External: Paytronix, FiveStars/SumUp for restaurants wanting standalone

## Tier 3 — Nice to Have

### 9. Review Management
- Yelp, Google Business Profile monitoring and response

### 10. Music
- Rockbot, Soundtrack Your Brand (licensed background music)

### 11. Food Waste Tracking
- Leanpath — AI waste prevention, sustainability reporting

### 12. Supply Chain (Enterprise)
- EDI integration with Sysco, US Foods for centralized purchasing
- Purchase order automation

### 13. Identity / SSO (Enterprise)
- Okta — SSO for multi-location corporate staff
- RBAC with granular permission sets

### 14. MDM (Enterprise)
- Jamf — iPad fleet management, kiosk mode, remote wipe

## Integration Architecture

All integrations use the same pattern:

1. **Adapter interface** — Abstract base class defining the integration contract
2. **Concrete adapter** — Implementation for each vendor (e.g., `QuickBooksAdapter`, `SevenShiftsAdapter`)
3. **Webhook receiver** — Inbound events from the integration partner
4. **Sync engine** — Handles reconciliation, retry logic, conflict resolution
5. **Configuration UI** — Settings page where the restaurant connects their account (OAuth where available)

Integrations are treated as modules (`mod.integration_qbo`, `mod.integration_7shifts`, etc.) and follow the same enable/disable, per-tenant activation pattern.

---


# Part 10: Implementation Roadmap

## Phase 1: Foundation (Months 1-3)

### Month 1: Core Infrastructure
- Supabase project setup, multi-tenant schema, RLS policies
- Flask application factory, module registry, event bus
- User authentication (Supabase Auth), PIN login system
- Base UI framework (Tailwind + htmx + Alpine.js)
- Terminal registration and heartbeat system

### Month 2: Core POS
- Menu management (categories, items, modifiers, modifier groups)
- Order entry screen (the most critical screen in the system)
- Kitchen ticket printing (Star Micronics, Epson printer support)
- Basic payment flow (cash + Valor PayTech integration via Valor Connect and REST API)
- Check management (open, close, void)
- Cash drawer management (open shift, close shift, count)

### Month 3: Core Completion
- Split checks (by item, by seat, equal split, custom split)
- Discount and comp system (percentage, fixed, manager comp)
- Basic reporting (daily sales, product mix, labor)
- End-of-day workflow (Z report, cash reconciliation, auto-email)
- Receipt printing and email receipts
- Staff clock in/out with PIN, basic roles and permissions
- 86 functionality with instant sync across terminals

**Milestone: Minimum viable POS — can run a restaurant.**

## Phase 2: Restaurant Essentials (Months 4-6)

### Month 4: Kitchen Display System (mod.kds)
- KDS screen with station-based routing
- Ticket timers with color-coded alerts (green/yellow/red)
- Bump bar support
- Coursing (hold courses, fire on demand)
- Average ticket time tracking

### Month 5: Table Management & Floor Plan (mod.tables)
- Visual floor plan editor (drag-and-drop table placement)
- Table status indicators (available, seated, ordering, eating, check dropped, dirty)
- Section assignment and server rotation
- Table transfer and merge
- Bar tab management (pre-auth, open/close, transfer to table)

### Month 6: Online Ordering (mod.online_ordering)
- Commission-free ordering through restaurant's website
- Menu auto-sync (POS menu = online menu)
- Order flow into main kitchen queue
- Customer notifications (SMS via Twilio, email via SendGrid)
- Pickup time estimation

**Milestone: Feature parity with Toast Core on the capabilities that matter.**

## Phase 3: Growth Modules (Months 7-9)

### Month 7: Loyalty & Gift Cards
- `mod.loyalty` — Points-based loyalty (phone number enrollment, no app download)
- `mod.gift_cards` — Physical and digital gift cards, cross-location balance
- Customer profiles with order history, visit frequency, lifetime value

### Month 8: Integrations
- QuickBooks Online integration (auto-sync daily sales)
- 7shifts integration (scheduling sync)
- DoorDash, Uber Eats, Grubhub order ingestion
- Gusto payroll integration

### Month 9: Advanced Reporting & Analytics
- `mod.analytics` — Trend analysis, year-over-year, predictive forecasting
- Owner mobile app (PWA) — today's sales, labor %, alerts
- Automated daily/weekly report emails
- Comp/void/discount audit trail

**Milestone: Full-featured POS competing with Toast Professional.**

## Phase 4: Enterprise & Scale (Months 10-12)

### Month 10: Multi-Location Features
- Menu inheritance (template -> location override)
- Consolidated reporting (org-level dashboards)
- Cross-location staff management
- Cross-location gift card redemption
- Centralized settings with per-location overrides

### Month 11: Enterprise Features
- `mod.inventory` — Par levels, purchase orders, food cost, vendor management
- `mod.scheduling` — Drag-and-drop scheduling with labor forecasting
- SSO via Okta
- MDM integration (Jamf)
- SLA monitoring and uptime guarantees

### Month 12: Polish & Scale
- `mod.kiosk` — Self-service kiosk mode
- `mod.customer_display` — Customer-facing display
- `mod.catering` — Catering management
- Performance optimization (sub-200ms response times)
- Load testing for 100+ concurrent terminal support
- Security audit and PCI DSS 4.0 compliance validation

**Milestone: Enterprise-ready. Can serve 45-location restaurant groups.**

## Ongoing

- Offline mode hardening (Service Worker, IndexedDB, store-and-forward payments via Valor)
- Valor integration deepening (advanced features, new terminal hardware support)
- Additional delivery platform integrations
- Additional scheduling/payroll integrations
- Customer feedback incorporation
- Platform admin tools for support team

---


# Appendix A: Complete Database Schema

*All schema definitions from the System Architecture specification. Every table includes `org_id` for tenant isolation via Supabase RLS. All IDs are UUIDv7. All timestamps are `timestamptz` in UTC.*


## 3. Database Schema Design

### Design Principles

- **All IDs are UUIDv7** (time-sortable, no sequential leak). Generated in the application layer using `uuid7()`.
- **All timestamps are `timestamptz`**, stored in UTC. Display timezone comes from `locations.timezone`.
- **Soft deletes** on reference data (menu items, staff, customers). Column: `deleted_at timestamptz`. Hard deletes on transactional data older than retention period.
- **`org_id`** on every tenant-scoped table. Indexed. RLS enforced.
- **JSONB** for flexible/extensible data: modifier configs, receipt metadata, integration-specific payloads.
- **Enum types** for state machines via PostgreSQL `CREATE TYPE`.
- **Created/updated tracking**: `created_at`, `updated_at`, `created_by`, `updated_by` on every table.

### Enum Types

```sql
-- Order lifecycle
CREATE TYPE order_status AS ENUM (
    'draft',          -- Being built on terminal, not yet sent
    'open',           -- Sent to kitchen/bar, actively being worked
    'fired',          -- Kitchen has started preparing
    'ready',          -- Ready for pickup/serve
    'served',         -- Delivered to guest
    'closed',         -- Fully paid and complete
    'voided',         -- Cancelled entirely
    'refunded'        -- Closed then refunded
);

-- Order type
CREATE TYPE order_type AS ENUM (
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
    'pending',        -- Payment initiated
    'authorized',     -- Card authorized, not yet captured
    'captured',       -- Card charged
    'settled',        -- Funds transferred (end of day batch)
    'declined',       -- Card declined
    'voided',         -- Authorization voided before capture
    'refunded',       -- Partial or full refund
    'failed'          -- Processing error
);

CREATE TYPE payment_method AS ENUM (
    'cash', 'credit_card', 'debit_card', 'gift_card', 'house_account',
    'apple_pay', 'google_pay', 'external'  -- external = third-party app
);

-- Staff role levels
CREATE TYPE user_role AS ENUM (
    'platform_admin',  -- Our internal admin
    'owner',           -- Restaurant owner
    'admin',           -- Restaurant admin/GM
    'manager',         -- Shift manager
    'server',          -- Front of house
    'bartender',       -- Bar
    'host',            -- Host/hostess
    'kitchen',         -- Back of house
    'cashier',         -- Cashier-only access
    'kiosk',           -- Kiosk device account
    'readonly'         -- View-only (accountant, etc.)
);

CREATE TYPE terminal_type AS ENUM (
    'server_station', 'bar', 'host', 'cashier', 'kds', 'kiosk', 'customer_display'
);

CREATE TYPE discount_type AS ENUM (
    'percentage', 'fixed_amount', 'bogo', 'free_item'
);

CREATE TYPE comp_reason AS ENUM (
    'manager_comp', 'quality_issue', 'service_issue', 'birthday',
    'vip', 'employee_meal', 'promotional', 'other'
);

CREATE TYPE void_reason AS ENUM (
    'customer_request', 'kitchen_error', 'server_error', 'wrong_item',
    'quality_issue', '86d', 'duplicate', 'other'
);

CREATE TYPE cash_drawer_event_type AS ENUM (
    'open_shift', 'close_shift', 'cash_sale', 'cash_refund',
    'paid_in', 'paid_out', 'tip_payout', 'no_sale', 'count'
);
```

### Core Tables

```sql
-- ============================================================
-- ORGANIZATIONS & LOCATIONS
-- ============================================================

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,           -- URL-friendly identifier

    -- Subscription/billing
    plan text NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
    subscription_status text NOT NULL DEFAULT 'trialing',
    trial_ends_at timestamptz,

    -- Branding
    logo_url text,
    primary_color text DEFAULT '#1a1a2e',

    -- Contact
    owner_name text,
    owner_email text,
    owner_phone text,

    -- Settings (org-wide defaults)
    settings jsonb NOT NULL DEFAULT '{}',
    -- settings contains: default_currency, default_timezone,
    -- receipt_header, receipt_footer, tip_percentages, etc.

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Downtown Location"
    slug text NOT NULL,                  -- "downtown"

    -- Address
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'US',
    latitude numeric(10, 7),
    longitude numeric(10, 7),

    -- Contact
    phone text,
    email text,

    -- Operations
    timezone text NOT NULL DEFAULT 'America/New_York',
    currency text NOT NULL DEFAULT 'USD',

    -- Business hours: JSONB array
    -- [{"day": "monday", "open": "11:00", "close": "22:00"}, ...]
    business_hours jsonb NOT NULL DEFAULT '[]',

    -- Location-specific settings (overrides org defaults)
    settings jsonb NOT NULL DEFAULT '{}',
    -- settings contains: auto_gratuity_pct, auto_gratuity_party_size,
    -- default_tax_rate_id, receipt_printer_ip, kitchen_printer_ip,
    -- order_number_prefix, require_table_for_dine_in, etc.

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    UNIQUE(org_id, slug)
);

CREATE INDEX idx_locations_org ON locations(org_id);

CREATE TABLE terminals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Bar iPad 1"
    terminal_type terminal_type NOT NULL,
    device_id text,                      -- Browser fingerprint or assigned ID

    -- Current state
    is_online boolean NOT NULL DEFAULT false,
    last_heartbeat_at timestamptz,
    current_user_id uuid REFERENCES users(id),

    settings jsonb NOT NULL DEFAULT '{}',
    -- settings: assigned_sections, default_order_type, printer_ip, etc.

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_terminals_location ON terminals(location_id);

-- ============================================================
-- MODULE MANAGEMENT
-- ============================================================

CREATE TABLE org_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    module_id text NOT NULL,             -- 'mod.kds', 'mod.inventory', etc.
    is_enabled boolean NOT NULL DEFAULT true,
    enabled_at timestamptz NOT NULL DEFAULT now(),
    disabled_at timestamptz,

    -- Module-specific configuration
    config jsonb NOT NULL DEFAULT '{}',

    -- Which locations have this module (null = all locations)
    location_ids uuid[] DEFAULT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(org_id, module_id)
);

CREATE INDEX idx_org_modules_org ON org_modules(org_id);

-- ============================================================
-- USERS & PERMISSIONS
-- ============================================================

CREATE TABLE users (
    id uuid PRIMARY KEY,                 -- Matches Supabase Auth user ID
    org_id uuid NOT NULL REFERENCES organizations(id),

    -- Profile
    email text,
    phone text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    display_name text,                   -- What shows on receipts/orders
    avatar_url text,

    -- POS-specific
    pin_hash text,                       -- 4-6 digit PIN for quick clock-in / POS login
    role user_role NOT NULL DEFAULT 'server',

    -- Which locations this user can access
    location_ids uuid[] NOT NULL DEFAULT '{}',

    -- Employment
    hire_date date,
    hourly_rate numeric(8, 2),
    is_active boolean NOT NULL DEFAULT true,

    settings jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_pin ON users(org_id, pin_hash) WHERE pin_hash IS NOT NULL;

-- Granular permissions beyond role-based defaults
CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,           -- 'orders.void', 'reports.payroll', 'menu.edit'
    module_id text NOT NULL,             -- Which module defines this permission
    description text,
    category text                        -- Grouping for settings UI
);

CREATE TABLE role_permissions (
    role user_role NOT NULL,
    permission_id uuid NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role, permission_id)
);

-- Per-user permission overrides (grant/deny beyond role defaults)
CREATE TABLE user_permission_overrides (
    user_id uuid NOT NULL REFERENCES users(id),
    permission_id uuid NOT NULL REFERENCES permissions(id),
    granted boolean NOT NULL,            -- true = explicitly grant, false = explicitly deny
    PRIMARY KEY (user_id, permission_id)
);

-- ============================================================
-- MENU MANAGEMENT
-- ============================================================

CREATE TABLE menu_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),  -- NULL = org-wide template

    name text NOT NULL,
    description text,
    sort_order int NOT NULL DEFAULT 0,

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    available_start_time time,           -- Category only shows during these hours
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday

    -- Display
    color text,                          -- Hex color for POS button
    image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_menu_categories_org ON menu_categories(org_id);
CREATE INDEX idx_menu_categories_location ON menu_categories(location_id);

CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    category_id uuid NOT NULL REFERENCES menu_categories(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide

    name text NOT NULL,
    short_name text,                     -- Abbreviated for kitchen tickets
    description text,

    -- Pricing
    price numeric(10, 2) NOT NULL,
    cost numeric(10, 2),                 -- Food cost for margin tracking

    -- Tax
    tax_rate_id uuid REFERENCES tax_rates(id),
    is_taxable boolean NOT NULL DEFAULT true,

    -- Prep
    prep_station text,                   -- 'grill', 'fryer', 'cold', 'bar', 'expo'
    prep_time_minutes int,
    course text,                         -- 'appetizer', 'entree', 'dessert', 'drink'

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    is_86d boolean NOT NULL DEFAULT false,       -- Temporarily unavailable
    available_start_time time,
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}',

    -- Display
    color text,
    image_url text,
    sort_order int NOT NULL DEFAULT 0,

    -- Modifiers
    -- (linked via menu_item_modifier_groups join table)

    -- Nutrition/allergens (optional, for online ordering)
    nutrition jsonb,
    allergens text[],                    -- ['gluten', 'dairy', 'nuts', ...]

    -- PLU / barcode
    plu_code text,
    barcode text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_menu_items_org ON menu_items(org_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_location ON menu_items(location_id);
CREATE INDEX idx_menu_items_plu ON menu_items(org_id, plu_code) WHERE plu_code IS NOT NULL;

CREATE TABLE modifier_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Temperature", "Sides", "Add-ons"

    -- Selection rules
    min_selections int NOT NULL DEFAULT 0,  -- 0 = optional
    max_selections int NOT NULL DEFAULT 1,  -- 1 = pick one, >1 = pick many

    -- If true, server must actively choose (even if 0 min_selections)
    is_required_prompt boolean NOT NULL DEFAULT false,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_modifier_groups_org ON modifier_groups(org_id);

CREATE TABLE modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),

    name text NOT NULL,
    short_name text,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0, -- Additional cost

    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_modifiers_group ON modifiers(modifier_group_id);

-- Join table: which modifier groups apply to which menu items
CREATE TABLE menu_item_modifier_groups (
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),
    sort_order int NOT NULL DEFAULT 0,
    PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- ============================================================
-- TAX CONFIGURATION
-- ============================================================

CREATE TABLE tax_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide default

    name text NOT NULL,                  -- "State Sales Tax", "City Tax", "Alcohol Tax"
    rate numeric(6, 4) NOT NULL,         -- 0.0825 = 8.25%
    is_inclusive boolean NOT NULL DEFAULT false, -- VAT-style (price includes tax)
    is_default boolean NOT NULL DEFAULT false,

    -- Applicability
    applies_to text[] DEFAULT '{}',      -- Empty = all items; ['alcohol', 'food', 'merchandise']

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rates_org ON tax_rates(org_id);
CREATE INDEX idx_tax_rates_location ON tax_rates(location_id);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    -- Order identification
    order_number int NOT NULL,           -- Sequential per-location, per-day
    display_number text NOT NULL,        -- "A-042" (prefix + number, shown to customer)

    -- Type and status
    order_type order_type NOT NULL DEFAULT 'dine_in',
    status order_status NOT NULL DEFAULT 'draft',

    -- Assignments
    server_id uuid REFERENCES users(id),
    table_id uuid REFERENCES tables(id),
    customer_id uuid REFERENCES customers(id),

    -- Guest info (for dine-in without customer record)
    guest_count int,
    guest_name text,                     -- For takeout / delivery
    guest_phone text,

    -- Financials (denormalized for fast reads -- authoritative values come from line items)
    subtotal numeric(10, 2) NOT NULL DEFAULT 0,
    discount_total numeric(10, 2) NOT NULL DEFAULT 0,
    tax_total numeric(10, 2) NOT NULL DEFAULT 0,
    tip_total numeric(10, 2) NOT NULL DEFAULT 0,
    total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Payment state
    amount_paid numeric(10, 2) NOT NULL DEFAULT 0,
    balance_due numeric(10, 2) NOT NULL DEFAULT 0,

    -- Timing
    opened_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,                 -- When first sent to kitchen
    closed_at timestamptz,

    -- Delivery/takeout
    scheduled_for timestamptz,           -- Scheduled pickup/delivery time
    delivery_address jsonb,              -- {line1, line2, city, state, zip}

    -- Coursing
    fire_course_2_at timestamptz,        -- When to fire entrees (manual or auto)

    -- Notes
    notes text,                          -- Internal notes for kitchen/staff

    -- Metadata
    source text DEFAULT 'pos',           -- 'pos', 'online', 'kiosk', 'phone', 'catering'
    metadata jsonb NOT NULL DEFAULT '{}',
    -- metadata: { online_order_id, delivery_partner, catering_event_id, etc. }

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id),
    updated_by uuid REFERENCES users(id)
);

CREATE INDEX idx_orders_org ON orders(org_id);
CREATE INDEX idx_orders_location ON orders(location_id);
CREATE INDEX idx_orders_status ON orders(location_id, status);
CREATE INDEX idx_orders_server ON orders(server_id);
CREATE INDEX idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_opened ON orders(location_id, opened_at);
CREATE INDEX idx_orders_number ON orders(location_id, order_number);

-- Order number sequence per location (reset daily via application logic)
-- We use a helper function rather than a sequence to handle daily resets:
CREATE OR REPLACE FUNCTION next_order_number(p_location_id uuid)
RETURNS int AS $$
DECLARE
    v_next int;
BEGIN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
    FROM orders
    WHERE location_id = p_location_id
      AND opened_at::date = CURRENT_DATE;
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    menu_item_id uuid REFERENCES menu_items(id),  -- NULL for open/custom items

    -- Snapshot of item at time of order (menu can change, order record shouldn't)
    name text NOT NULL,
    short_name text,

    quantity int NOT NULL DEFAULT 1,
    unit_price numeric(10, 2) NOT NULL,

    -- Modifiers affect the price
    modifier_total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Line total = (unit_price + modifier_total) * quantity - discount
    discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
    line_total numeric(10, 2) NOT NULL,

    -- Kitchen routing
    prep_station text,
    course int DEFAULT 1,                -- 1 = first course, 2 = entree, etc.
    seat_number int,                     -- Which seat at the table

    -- Status
    is_sent boolean NOT NULL DEFAULT false,   -- Has been sent to kitchen
    is_fired boolean NOT NULL DEFAULT false,  -- Kitchen has started making it
    is_ready boolean NOT NULL DEFAULT false,  -- Ready to serve
    is_served boolean NOT NULL DEFAULT false,
    is_voided boolean NOT NULL DEFAULT false,
    void_reason void_reason,
    voided_by uuid REFERENCES users(id),
    voided_at timestamptz,

    -- Comps
    is_comped boolean NOT NULL DEFAULT false,
    comp_reason comp_reason,
    comp_amount numeric(10, 2),
    comped_by uuid REFERENCES users(id),

    notes text,                          -- "No onions", "Extra sauce", etc.

    sent_at timestamptz,
    fired_at timestamptz,
    ready_at timestamptz,
    served_at timestamptz,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_org ON order_items(org_id);
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX idx_order_items_status ON order_items(order_id, is_sent, is_voided);

CREATE TABLE order_item_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,

    modifier_id uuid REFERENCES modifiers(id),   -- NULL for custom modifiers
    modifier_group_id uuid REFERENCES modifier_groups(id),

    -- Snapshot
    name text NOT NULL,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0,
    quantity int NOT NULL DEFAULT 1,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);

-- Track modifications to orders after they've been sent
CREATE TABLE order_modifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),

    modification_type text NOT NULL,     -- 'add_item', 'remove_item', 'modify_item',
                                         -- 'change_quantity', 'void_item', 'comp_item',
                                         -- 'change_table', 'change_server', 'apply_discount'

    description text NOT NULL,           -- Human-readable: "Voided 1x Burger (wrong item)"

    -- Before/after state for the modified field
    previous_value jsonb,
    new_value jsonb,

    performed_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),  -- Manager approval if required

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_mods_order ON order_modifications(order_id);
CREATE INDEX idx_order_mods_org ON order_modifications(org_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    -- Payment details
    payment_method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',

    amount numeric(10, 2) NOT NULL,       -- Amount applied to this order
    tip_amount numeric(10, 2) NOT NULL DEFAULT 0,
    total_amount numeric(10, 2) NOT NULL, -- amount + tip

    -- Card payments
    processor_transaction_id text,        -- From payment processor
    card_brand text,                      -- 'visa', 'mastercard', 'amex'
    card_last_four text,                  -- '4242'
    auth_code text,

    -- Gift card payments
    gift_card_id uuid REFERENCES gift_cards(id),

    -- Cash payments
    cash_tendered numeric(10, 2),
    change_due numeric(10, 2),

    -- Split payment tracking
    split_index int,                     -- 1, 2, 3... for split payments

    -- Refund tracking
    refund_amount numeric(10, 2),
    refund_reason text,
    refunded_by uuid REFERENCES users(id),
    refunded_at timestamptz,
    original_payment_id uuid REFERENCES payments(id), -- For refund records

    processed_by uuid NOT NULL REFERENCES users(id),
    processed_at timestamptz NOT NULL DEFAULT now(),

    -- Processor response data
    processor_response jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_org ON payments(org_id);
CREATE INDEX idx_payments_processor_txn ON payments(processor_transaction_id)
    WHERE processor_transaction_id IS NOT NULL;

-- Tip adjustments (post-close tip changes, common with card tips)
CREATE TABLE tip_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    payment_id uuid NOT NULL REFERENCES payments(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    server_id uuid NOT NULL REFERENCES users(id),

    original_tip numeric(10, 2) NOT NULL,
    adjusted_tip numeric(10, 2) NOT NULL,
    reason text,

    adjusted_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DISCOUNTS
-- ============================================================

CREATE TABLE discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Happy Hour", "Employee 50%", "Senior 10%"
    discount_type discount_type NOT NULL,

    -- Value
    percentage numeric(5, 2),            -- For percentage type
    fixed_amount numeric(10, 2),         -- For fixed_amount type

    -- Applicability
    applies_to text NOT NULL DEFAULT 'order', -- 'order', 'item', 'category'
    category_ids uuid[],                 -- If applies_to = 'category'
    item_ids uuid[],                     -- If applies_to specific items

    -- Rules
    requires_manager_approval boolean NOT NULL DEFAULT false,
    max_discount_amount numeric(10, 2),  -- Cap for percentage discounts
    min_order_amount numeric(10, 2),     -- Minimum order to apply

    -- Scheduling
    is_active boolean NOT NULL DEFAULT true,
    start_date date,
    end_date date,
    available_days int[],
    available_start_time time,
    available_end_time time,

    -- Tracking
    promo_code text,                     -- Optional promo code

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_discounts_org ON discounts(org_id);

CREATE TABLE order_discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id),
    discount_id uuid REFERENCES discounts(id),   -- NULL for custom/manual discounts
    order_item_id uuid REFERENCES order_items(id), -- NULL if order-level discount

    name text NOT NULL,
    discount_type discount_type NOT NULL,
    value numeric(10, 2) NOT NULL,       -- The percentage or fixed amount
    applied_amount numeric(10, 2) NOT NULL, -- Actual dollar amount removed

    applied_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLES & FLOOR PLAN
-- ============================================================

CREATE TABLE floor_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Main Dining", "Patio", "Bar Area"
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,

    -- Canvas dimensions for the visual editor
    canvas_width int NOT NULL DEFAULT 1200,
    canvas_height int NOT NULL DEFAULT 800,
    background_image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    floor_plan_id uuid NOT NULL REFERENCES floor_plans(id),

    name text NOT NULL,                  -- "T1", "B3", "P12"
    capacity int NOT NULL DEFAULT 4,
    shape text NOT NULL DEFAULT 'rectangle', -- 'rectangle', 'circle', 'square'

    -- Position on floor plan canvas
    pos_x int NOT NULL DEFAULT 0,
    pos_y int NOT NULL DEFAULT 0,
    width int NOT NULL DEFAULT 80,
    height int NOT NULL DEFAULT 80,
    rotation int NOT NULL DEFAULT 0,     -- Degrees

    -- Current state (denormalized for fast floor plan rendering)
    status text NOT NULL DEFAULT 'available',
    -- 'available', 'seated', 'ordered', 'served', 'check_presented', 'dirty'
    current_order_id uuid,
    current_server_id uuid REFERENCES users(id),
    seated_at timestamptz,

    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    -- Section assignment (for server sections)
    section text,                        -- "A", "B", "Patio", "Bar"

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_location ON tables(location_id);
CREATE INDEX idx_tables_floor_plan ON tables(floor_plan_id);
CREATE INDEX idx_tables_status ON tables(location_id, status);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    first_name text,
    last_name text,
    email text,
    phone text,

    -- Preferences
    notes text,                          -- "Allergic to shellfish", "Prefers booth"
    tags text[],                         -- ['vip', 'regular', 'food-allergy']

    -- Stats (denormalized, updated async)
    total_visits int NOT NULL DEFAULT 0,
    total_spent numeric(12, 2) NOT NULL DEFAULT 0,
    average_check numeric(10, 2) NOT NULL DEFAULT 0,
    last_visit_at timestamptz,

    -- Marketing
    marketing_opt_in boolean NOT NULL DEFAULT false,
    birthday date,
    anniversary date,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_customers_phone ON customers(org_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_email ON customers(org_id, email) WHERE email IS NOT NULL;

CREATE TABLE customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id),

    label text DEFAULT 'home',           -- 'home', 'work', 'other'
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,

    is_default boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STAFF / TIME TRACKING
-- ============================================================

CREATE TABLE shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    -- Shift definition
    name text,                           -- "Lunch", "Dinner", "All Day"
    shift_date date NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz,                -- NULL = still open

    -- Manager on duty
    manager_id uuid REFERENCES users(id),

    -- Summary (populated on close)
    total_sales numeric(12, 2),
    total_labor_cost numeric(10, 2),
    total_comps numeric(10, 2),
    total_voids numeric(10, 2),

    is_closed boolean NOT NULL DEFAULT false,
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_location_date ON shifts(location_id, shift_date);

CREATE TABLE time_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    user_id uuid NOT NULL REFERENCES users(id),
    shift_id uuid REFERENCES shifts(id),

    clock_in timestamptz NOT NULL,
    clock_out timestamptz,

    role_during_shift user_role,         -- Role worked (might differ from primary role)
    hourly_rate numeric(8, 2),           -- Rate during this shift

    -- Calculated
    regular_hours numeric(5, 2),
    overtime_hours numeric(5, 2),
    total_pay numeric(10, 2),

    -- Tips
    cash_tips numeric(10, 2) NOT NULL DEFAULT 0,
    credit_tips numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_given numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_received numeric(10, 2) NOT NULL DEFAULT 0,

    notes text,

    -- Approval
    is_approved boolean NOT NULL DEFAULT false,
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_location_date ON time_entries(location_id, clock_in);

CREATE TABLE break_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id uuid NOT NULL REFERENCES time_entries(id),

    break_type text NOT NULL DEFAULT 'unpaid', -- 'paid', 'unpaid'
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    duration_minutes int,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CASH DRAWER
-- ============================================================

CREATE TABLE cash_drawers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    name text NOT NULL DEFAULT 'Main Drawer',

    -- Current state
    is_open boolean NOT NULL DEFAULT false,
    opened_by uuid REFERENCES users(id),
    opened_at timestamptz,

    starting_cash numeric(10, 2),
    current_cash numeric(10, 2),

    -- Close-out
    expected_cash numeric(10, 2),
    actual_cash numeric(10, 2),
    over_short numeric(10, 2),
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cash_drawer_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_drawer_id uuid NOT NULL REFERENCES cash_drawers(id),

    event_type cash_drawer_event_type NOT NULL,
    amount numeric(10, 2) NOT NULL,
    running_total numeric(10, 2) NOT NULL,

    -- Context
    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),
    description text,

    performed_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_events_drawer ON cash_drawer_events(cash_drawer_id);

-- ============================================================
-- GIFT CARDS
-- ============================================================

CREATE TABLE gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    card_number text NOT NULL,           -- Unique card number (masked in API responses)
    card_number_hash text NOT NULL,      -- For lookups
    pin_hash text,                       -- Optional PIN

    initial_balance numeric(10, 2) NOT NULL,
    current_balance numeric(10, 2) NOT NULL,

    -- Purchaser
    purchased_by_customer_id uuid REFERENCES customers(id),
    purchased_at timestamptz NOT NULL DEFAULT now(),
    purchase_order_id uuid REFERENCES orders(id),

    -- Recipient
    recipient_name text,
    recipient_email text,
    recipient_phone text,
    message text,

    -- Status
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_cards_org ON gift_cards(org_id);
CREATE INDEX idx_gift_cards_number ON gift_cards(card_number_hash);

CREATE TABLE gift_card_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id uuid NOT NULL REFERENCES gift_cards(id),

    transaction_type text NOT NULL,      -- 'purchase', 'reload', 'redeem', 'refund', 'adjustment'
    amount numeric(10, 2) NOT NULL,      -- Positive for loads, negative for redemptions
    balance_after numeric(10, 2) NOT NULL,

    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),

    performed_by uuid REFERENCES users(id),
    notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),

    -- Who
    user_id uuid REFERENCES users(id),
    user_name text,                      -- Denormalized for readability
    user_role user_role,

    -- What
    action text NOT NULL,                -- 'order.void', 'menu.price_change', 'user.login', etc.
    entity_type text NOT NULL,           -- 'order', 'payment', 'menu_item', 'user'
    entity_id uuid,

    -- Details
    description text NOT NULL,
    previous_state jsonb,                -- Before the change
    new_state jsonb,                     -- After the change

    -- Context
    ip_address inet,
    user_agent text,
    terminal_id uuid,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Partitioned by month for performance (audit logs grow fast)
-- In practice, use Supabase's table partitioning or archive old entries
CREATE INDEX idx_audit_org_date ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### Order State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │ ← Order being built on iPad
                    │  (unsent)   │
                    └──────┬──────┘
                           │ Server taps "Send"
                           ▼
                    ┌─────────────┐
                    │    OPEN     │ ← Sent to kitchen, items routing to stations
                    │  (in queue) │
                    └──────┬──────┘
                           │ Kitchen starts cooking
                           ▼
                    ┌─────────────┐
                    │   FIRED     │ ← Actively being prepared
                    │ (cooking)   │    (per-item fire is tracked on order_items)
                    └──────┬──────┘
                           │ Kitchen bumps "Ready"
                           ▼
                    ┌─────────────┐
                    │   READY     │ ← Food in window / ready for pickup
                    └──────┬──────┘
                           │ Server picks up food
                           ▼
                    ┌─────────────┐
                    │   SERVED    │ ← Food delivered to table
                    └──────┬──────┘
                           │ Payment completed
                           ▼
                    ┌─────────────┐
                    │   CLOSED    │ ← Fully paid, done
                    └─────────────┘

    At any point before CLOSED:
    ┌─────────────┐
    │   VOIDED    │ ← Manager voided entire order
    └─────────────┘

    After CLOSED:
    ┌─────────────┐
    │  REFUNDED   │ ← Full or partial refund processed
    └─────────────┘
```

**Item-level status tracking:** Individual items on the order have their own flags (`is_sent`, `is_fired`, `is_ready`, `is_served`, `is_voided`). The order-level status is a rollup. An order is "fired" when the first item fires. An order is "ready" when all non-voided items are ready.

**Adding items after send:** When a server adds items to an already-sent order, the new items have `is_sent = false`. The server can continue adding and then hit "Send" again, which sends only the unsent items to the kitchen. An `order_modifications` record is created.

### Payment State Machine

```
    ┌───────────┐
    │  PENDING   │ ← Payment initiated
    └─────┬─────┘
          │
    ┌─────┴──────┐
    │             │
    ▼             ▼
┌────────┐  ┌──────────┐
│DECLINED│  │AUTHORIZED│ ← Card approved, hold placed
└────────┘  └────┬─────┘
                 │
           ┌─────┴──────┐
           │             │
           ▼             ▼
      ┌────────┐   ┌────────┐
      │ VOIDED │   │CAPTURED│ ← Charge submitted
      └────────┘   └───┬────┘
      (before           │
       capture)         ▼
                   ┌────────┐
                   │SETTLED │ ← Funds received (batch)
                   └───┬────┘
                       │
                       ▼
                   ┌────────┐
                   │REFUNDED│ ← Partial or full refund
                   └────────┘
```

**Cash flow:** For cash payments, the flow is `pending → captured → settled` immediately (no auth step).

**Split payments:** An order can have multiple payment records. `balance_due` on the order is recalculated after each payment. Order closes when `balance_due = 0`.

### Module-Specific Tables

**mod.kds (Kitchen Display System):**
```sql
CREATE TABLE kds_stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,                  -- "Grill", "Fryer", "Cold", "Bar", "Expo"
    station_type text NOT NULL,          -- 'prep', 'expo'
    prep_stations text[],               -- Which prep_station values route here
    terminal_id uuid,                    -- Assigned display device
    display_settings jsonb DEFAULT '{}', -- font_size, columns, sound, color_coding
    sort_order int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE kds_ticket_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    station_id uuid NOT NULL REFERENCES kds_stations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),
    event_type text NOT NULL,            -- 'received', 'started', 'bumped', 'recalled', 'all_day_updated'
    performed_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);
```

**mod.inventory:**
```sql
CREATE TABLE inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    category text,
    unit_of_measure text NOT NULL,       -- 'oz', 'lb', 'each', 'case', 'gal'
    par_level numeric(10, 3),
    reorder_point numeric(10, 3),
    current_quantity numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4),
    vendor_id uuid REFERENCES vendors(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    transaction_type text NOT NULL,      -- 'receive', 'waste', 'transfer', 'count', 'sale_deduction'
    quantity_change numeric(10, 3) NOT NULL,
    quantity_after numeric(10, 3) NOT NULL,
    unit_cost numeric(10, 4),
    reference_id uuid,                   -- order_id for sale deductions, PO id for receives
    notes text,
    performed_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    quantity_used numeric(10, 4) NOT NULL,
    unit_of_measure text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address jsonb,
    payment_terms text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    vendor_id uuid NOT NULL REFERENCES vendors(id),
    po_number text NOT NULL,
    status text NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'partial', 'received', 'cancelled'
    total_amount numeric(12, 2),
    ordered_at timestamptz,
    expected_at timestamptz,
    received_at timestamptz,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
    quantity_ordered numeric(10, 3) NOT NULL,
    quantity_received numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4) NOT NULL,
    line_total numeric(10, 2) NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**mod.loyalty:**
```sql
CREATE TABLE loyalty_programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    program_type text NOT NULL,          -- 'points', 'visits', 'spend_based'
    points_per_dollar numeric(6, 2) DEFAULT 1,
    points_per_visit int DEFAULT 0,
    redemption_threshold int,            -- Points needed to redeem
    reward_value numeric(10, 2),         -- Dollar value of reward
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE loyalty_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    customer_id uuid NOT NULL REFERENCES customers(id),
    program_id uuid NOT NULL REFERENCES loyalty_programs(id),
    points_balance int NOT NULL DEFAULT 0,
    lifetime_points int NOT NULL DEFAULT 0,
    tier text DEFAULT 'bronze',          -- 'bronze', 'silver', 'gold', 'platinum'
    enrolled_at timestamptz DEFAULT now(),
    last_activity_at timestamptz
);

CREATE TABLE loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    loyalty_account_id uuid NOT NULL REFERENCES loyalty_accounts(id),
    transaction_type text NOT NULL,      -- 'earn', 'redeem', 'adjustment', 'expire'
    points int NOT NULL,
    balance_after int NOT NULL,
    order_id uuid REFERENCES orders(id),
    description text,
    created_at timestamptz DEFAULT now()
);
```

**mod.online_ordering:**
```sql
CREATE TABLE online_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,                  -- Public URL slug
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',         -- theme, colors, logo, min_order, delivery_fee, etc.
    created_at timestamptz DEFAULT now()
);

CREATE TABLE online_menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    online_menu_id uuid NOT NULL REFERENCES online_menus(id),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    is_available boolean DEFAULT true,
    sort_order int DEFAULT 0,
    online_price numeric(10, 2),         -- Override price for online (NULL = use menu_item price)
    online_description text,             -- Extended description for online
    created_at timestamptz DEFAULT now()
);

CREATE TABLE online_order_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES orders(id),
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'preparing'
    estimated_ready_minutes int,
    accepted_by uuid REFERENCES users(id),
    accepted_at timestamptz,
    customer_notified_at timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**mod.reservations:**
```sql
CREATE TABLE reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,

    customer_id uuid REFERENCES customers(id),
    guest_name text NOT NULL,
    guest_phone text,
    guest_email text,
    party_size int NOT NULL,

    reservation_date date NOT NULL,
    reservation_time time NOT NULL,
    duration_minutes int DEFAULT 90,

    table_id uuid REFERENCES tables(id),

    status text NOT NULL DEFAULT 'confirmed',
    -- 'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'

    notes text,
    special_requests text,

    confirmation_sent_at timestamptz,
    reminder_sent_at timestamptz,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE waitlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,

    guest_name text NOT NULL,
    guest_phone text,
    party_size int NOT NULL,

    quoted_wait_minutes int,
    position int NOT NULL,

    status text NOT NULL DEFAULT 'waiting',
    -- 'waiting', 'notified', 'seated', 'cancelled', 'no_show'

    notified_at timestamptz,
    seated_at timestamptz,
    table_id uuid REFERENCES tables(id),

    notes text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**mod.scheduling:**
```sql
CREATE TABLE schedule_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,                  -- "Default Week", "Holiday Week"
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE scheduled_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    template_id uuid REFERENCES schedule_templates(id),

    user_id uuid NOT NULL REFERENCES users(id),
    role user_role NOT NULL,

    shift_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    status text NOT NULL DEFAULT 'scheduled',
    -- 'scheduled', 'confirmed', 'swap_requested', 'swapped', 'called_out', 'no_show'

    notes text,
    published_at timestamptz,            -- NULL = draft, not visible to staff

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE shift_swap_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    scheduled_shift_id uuid NOT NULL REFERENCES scheduled_shifts(id),
    requested_by uuid NOT NULL REFERENCES users(id),
    swap_with_user_id uuid REFERENCES users(id), -- NULL = open swap (anyone can take)
    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'approved', 'denied', 'taken'
    approved_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id),
    day_of_week int NOT NULL,            -- 0=Sunday
    start_time time,
    end_time time,
    is_available boolean NOT NULL DEFAULT true,
    effective_date date,
    expiration_date date,
    created_at timestamptz DEFAULT now()
);
```

**mod.marketing (depends on mod.loyalty):**
```sql
CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    name text NOT NULL,
    campaign_type text NOT NULL,         -- 'email', 'sms', 'push', 'email_sms'
    status text NOT NULL DEFAULT 'draft',
    -- 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'

    subject text,                        -- Email subject
    body_html text,                      -- Email body
    sms_body text,                       -- SMS body

    -- Targeting
    target_segment jsonb NOT NULL,       -- Filter criteria
    -- { "min_visits": 5, "last_visit_within_days": 30, "tags": ["vip"] }
    target_count int,                    -- Estimated recipients

    -- Scheduling
    scheduled_for timestamptz,
    sent_at timestamptz,

    -- Stats
    recipients_count int DEFAULT 0,
    opened_count int DEFAULT 0,
    clicked_count int DEFAULT 0,
    redeemed_count int DEFAULT 0,

    -- Attached offer
    discount_id uuid REFERENCES discounts(id),

    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    channel text NOT NULL,               -- 'email', 'sms'
    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'
    sent_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**mod.delivery:**
```sql
CREATE TABLE delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    name text NOT NULL,
    -- GeoJSON polygon defining the zone
    zone_polygon jsonb NOT NULL,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    min_order_amount numeric(10, 2),
    estimated_minutes int DEFAULT 30,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES orders(id),

    driver_id uuid REFERENCES users(id),

    pickup_time timestamptz,
    delivery_time timestamptz,
    estimated_delivery_at timestamptz,
    actual_delivery_at timestamptz,

    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'failed'

    delivery_address jsonb NOT NULL,
    delivery_instructions text,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    driver_tip numeric(10, 2) DEFAULT 0,

    -- Tracking
    driver_lat numeric(10, 7),
    driver_lng numeric(10, 7),
    last_location_at timestamptz,

    proof_of_delivery_url text,          -- Photo
    signature_url text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**mod.analytics:**
```sql
-- Pre-aggregated daily metrics for fast dashboard queries
CREATE TABLE daily_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    metric_date date NOT NULL,

    -- Sales
    total_revenue numeric(12, 2) DEFAULT 0,
    net_revenue numeric(12, 2) DEFAULT 0,     -- After discounts/comps/voids
    order_count int DEFAULT 0,
    average_check numeric(10, 2) DEFAULT 0,
    covers int DEFAULT 0,                      -- Guest count
    revenue_per_cover numeric(10, 2) DEFAULT 0,

    -- By type
    dine_in_revenue numeric(12, 2) DEFAULT 0,
    takeout_revenue numeric(12, 2) DEFAULT 0,
    delivery_revenue numeric(12, 2) DEFAULT 0,
    online_revenue numeric(12, 2) DEFAULT 0,

    -- Payment mix
    cash_total numeric(12, 2) DEFAULT 0,
    card_total numeric(12, 2) DEFAULT 0,
    gift_card_total numeric(12, 2) DEFAULT 0,

    -- Labor
    labor_cost numeric(12, 2) DEFAULT 0,
    labor_hours numeric(8, 2) DEFAULT 0,
    labor_percentage numeric(5, 2) DEFAULT 0,

    -- Food cost
    food_cost numeric(12, 2) DEFAULT 0,
    food_cost_percentage numeric(5, 2) DEFAULT 0,

    -- Discounts/comps/voids
    discount_total numeric(12, 2) DEFAULT 0,
    comp_total numeric(12, 2) DEFAULT 0,
    void_total numeric(12, 2) DEFAULT 0,
    refund_total numeric(12, 2) DEFAULT 0,

    -- Tips
    tip_total numeric(12, 2) DEFAULT 0,

    -- Timing
    avg_ticket_time_seconds int DEFAULT 0,
    avg_table_turn_minutes int DEFAULT 0,

    -- Hourly breakdown (for heatmap)
    hourly_revenue jsonb DEFAULT '{}',    -- {"10": 450.00, "11": 1200.00, ...}
    hourly_covers jsonb DEFAULT '{}',

    calculated_at timestamptz DEFAULT now(),

    UNIQUE(location_id, metric_date)
);

CREATE INDEX idx_daily_metrics_location_date ON daily_metrics(location_id, metric_date DESC);

-- Product mix report data
CREATE TABLE daily_item_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    location_id uuid NOT NULL,
    metric_date date NOT NULL,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),

    quantity_sold int DEFAULT 0,
    gross_revenue numeric(10, 2) DEFAULT 0,
    food_cost numeric(10, 2) DEFAULT 0,
    margin_percentage numeric(5, 2) DEFAULT 0,

    UNIQUE(location_id, metric_date, menu_item_id)
);
```

---




---


# Appendix B: API Reference

*All API endpoints from the System Architecture specification.*


## 4. API Architecture

### Flask Blueprint Structure

```python
# app/__init__.py

from flask import Flask
from app.module_registry import registry

def create_app(config_name: str = "production") -> Flask:
    app = Flask(__name__)
    app.config.from_object(f"config.{config_name}")

    # Initialize extensions
    from app.extensions import init_extensions
    init_extensions(app)

    # Register core blueprints
    from app.core.auth import bp as auth_bp
    from app.core.pos import bp as pos_bp
    from app.core.menu import bp as menu_bp
    from app.core.staff import bp as staff_bp
    from app.core.reports import bp as reports_bp
    from app.core.settings import bp as settings_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(pos_bp, url_prefix="/api/v1/orders")
    app.register_blueprint(menu_bp, url_prefix="/api/v1/menu")
    app.register_blueprint(staff_bp, url_prefix="/api/v1/staff")
    app.register_blueprint(reports_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(settings_bp, url_prefix="/api/v1/settings")

    # Register page-serving blueprints (Jinja2 HTML pages)
    from app.core.pages import bp as pages_bp
    app.register_blueprint(pages_bp)

    # Discover and load optional modules
    registry.discover_modules()
    registry.load_all_enabled_modules(app)

    # Register middleware
    from app.shared.middleware import register_middleware
    register_middleware(app)

    return app
```

### API Versioning

URL-based versioning: `/api/v1/...`. When v2 is needed, both versions run simultaneously. Old versions get a deprecation header and sunset date.

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐
│  iPad    │────▶│  Flask   │────▶│ Supabase Auth│────▶│ PostgreSQL│
│ Browser  │     │   API    │     │  (JWT issuer)│     │ (RLS)    │
└──────────┘     └──────────┘     └──────────────┘     └──────────┘
     │                │                    │
     │  1. Login      │                    │
     │  (email+pwd    │                    │
     │   or PIN)      │                    │
     │───────────────▶│                    │
     │                │  2. Authenticate   │
     │                │───────────────────▶│
     │                │                    │
     │                │  3. JWT + Refresh  │
     │                │◀───────────────────│
     │                │                    │
     │  4. Set custom │                    │
     │     claims     │                    │
     │                │──(set org_id,      │
     │                │   role, perms      │
     │                │   in JWT claims)──▶│
     │                │                    │
     │  5. JWT token  │                    │
     │◀───────────────│                    │
     │                │                    │
     │  6. Subsequent │                    │
     │     requests   │                    │
     │  (Bearer JWT)  │                    │
     │───────────────▶│  7. Verify JWT     │
     │                │  8. Extract claims │
     │                │  9. Set RLS vars   │
     │                │───────────────────▶│ 10. RLS enforced
```

**POS-specific auth considerations:**

- **Quick PIN Login:** Servers don't enter email/password every time. A 4-6 digit PIN is used for fast login/clock-in. The PIN authenticates within the context of an already-authenticated terminal.
- **Terminal Sessions:** The iPad itself has a long-lived session (terminal auth). Individual server sessions within the terminal are shorter and PIN-gated.
- **Manager Override:** Certain actions (voids, comps over threshold, discounts) trigger a manager PIN prompt without logging out the current user.

```python
# app/shared/auth.py

from functools import wraps
from flask import request, g, abort, jsonify
from app.shared.supabase_client import supabase

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            abort(401, description="Missing authentication token")

        try:
            # Verify JWT with Supabase
            user = supabase.auth.get_user(token)
            claims = decode_jwt_claims(token)

            g.user_id = user.id
            g.org_id = claims["org_id"]
            g.location_ids = claims.get("location_ids", [])
            g.role = claims["role"]
            g.permissions = claims.get("permissions", [])

            # Set RLS variables for any direct Supabase queries
            supabase.rpc("set_request_context", {
                "p_org_id": g.org_id,
                "p_user_id": g.user_id,
                "p_role": g.role
            })

        except Exception as e:
            abort(401, description="Invalid or expired token")

        return f(*args, **kwargs)
    return decorated


def require_permission(permission: str):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if permission not in g.permissions and g.role not in ("owner", "admin", "platform_admin"):
                abort(403, description=f"Missing permission: {permission}")
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_manager_approval(f):
    """For actions that need manager PIN confirmation."""
    @wraps(f)
    def decorated(*args, **kwargs):
        manager_pin = request.headers.get("X-Manager-PIN")
        if not manager_pin:
            return jsonify({"error": "manager_approval_required",
                          "message": "This action requires manager approval"}), 403

        # Verify manager PIN
        if not verify_manager_pin(g.org_id, manager_pin):
            abort(403, description="Invalid manager PIN")

        return f(*args, **kwargs)
    return decorated
```

### Rate Limiting

```python
# Using Flask-Limiter with Redis backend
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379/1",
    default_limits=["200 per minute", "5000 per hour"],
)

# Specific limits for sensitive endpoints
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    ...

@reports_bp.route("/generate", methods=["POST"])
@limiter.limit("5 per minute")
def generate_report():
    ...
```

### API Endpoint Groups

**Authentication (`/api/v1/auth/`)**
```
POST   /login                    Email/password login → JWT
POST   /login/pin                PIN-based quick login (terminal context)
POST   /refresh                  Refresh JWT token
POST   /logout                   Invalidate session
POST   /forgot-password          Send password reset email
POST   /reset-password           Reset password with token
GET    /me                       Current user profile
PUT    /me                       Update current user profile
POST   /verify-manager-pin       Verify a manager PIN (for overrides)
```

**Menu Management (`/api/v1/menu/`)**
```
GET    /categories               List categories (filtered by location)
POST   /categories               Create category
PUT    /categories/:id           Update category
DELETE /categories/:id           Soft-delete category
PATCH  /categories/reorder       Reorder categories

GET    /items                    List items (filtered by category, location)
POST   /items                    Create item
GET    /items/:id                Get item with modifier groups
PUT    /items/:id                Update item
DELETE /items/:id                Soft-delete item
PATCH  /items/:id/86             Toggle 86 status
PATCH  /items/reorder            Reorder items within category

GET    /modifier-groups          List modifier groups
POST   /modifier-groups          Create modifier group
PUT    /modifier-groups/:id      Update modifier group
DELETE /modifier-groups/:id      Delete modifier group

GET    /modifiers                List modifiers (filtered by group)
POST   /modifiers                Create modifier
PUT    /modifiers/:id            Update modifier
DELETE /modifiers/:id            Delete modifier
```

**Orders (`/api/v1/orders/`)**
```
GET    /                         List orders (filtered: status, date, server, table)
POST   /                         Create new order (draft)
GET    /:id                      Get order with items, modifiers, payments
PUT    /:id                      Update order (add/remove items, change table, etc.)
DELETE /:id                      Void order (requires manager PIN if sent)

POST   /:id/send                 Send order to kitchen
POST   /:id/fire-course          Fire next course
POST   /:id/items                Add items to existing order
PUT    /:id/items/:item_id       Update order item (quantity, modifiers, notes)
DELETE /:id/items/:item_id       Void individual item

POST   /:id/transfer             Transfer to another server
POST   /:id/move-table           Move to different table
POST   /:id/split                Split order into multiple checks
POST   /:id/merge                Merge with another order
POST   /:id/reopen               Reopen a closed order (manager only)

GET    /:id/modifications        Get modification history

POST   /:id/discount             Apply discount
DELETE /:id/discount/:disc_id    Remove discount
POST   /:id/items/:item_id/comp  Comp an item

GET    /open                     List all open orders for location
GET    /by-table/:table_id       Get orders for a specific table
```

**Payments (`/api/v1/payments/`)**
```
POST   /                         Process payment (cash, card, gift card)
GET    /:id                      Get payment details
POST   /:id/capture              Capture authorized payment
POST   /:id/void                 Void payment
POST   /:id/refund               Process refund (full or partial)
POST   /:id/adjust-tip           Adjust tip amount

POST   /preauth                  Pre-authorize a card (bar tabs)
GET    /settlement-report        End-of-day settlement
```

**Tables (`/api/v1/tables/`)**
```
GET    /                         List tables with current status
GET    /floor-plans              List floor plans
GET    /floor-plans/:id          Get floor plan with tables
PUT    /floor-plans/:id          Update floor plan layout
POST   /floor-plans              Create floor plan

POST   /:id/seat                 Seat guests at table
POST   /:id/clear                Clear table (mark available)
PUT    /:id/status               Update table status
GET    /:id/history              Get table turn history
GET    /sections                 Get server section assignments
PUT    /sections                 Update section assignments
```

**Staff (`/api/v1/staff/`)**
```
GET    /                         List staff members
POST   /                         Create staff member
GET    /:id                      Get staff member
PUT    /:id                      Update staff member
DELETE /:id                      Deactivate staff member

POST   /clock-in                 Clock in (via PIN)
POST   /clock-out                Clock out
POST   /break/start              Start break
POST   /break/end                End break
GET    /time-entries             List time entries (date range)
PUT    /time-entries/:id         Edit time entry (manager)
POST   /time-entries/:id/approve Approve time entry

GET    /on-duty                  List currently clocked-in staff
GET    /tips                     Tip report for period
POST   /tip-pool/distribute      Distribute tip pool
```

**Reports (`/api/v1/reports/`)**
```
GET    /sales/daily              Daily sales summary
GET    /sales/weekly             Weekly sales summary
GET    /sales/monthly            Monthly sales summary
GET    /sales/custom             Custom date range
GET    /sales/hourly             Hourly breakdown (heatmap)

GET    /product-mix              Product mix report
GET    /category-mix             Category sales breakdown
GET    /server-performance       Sales by server
GET    /labor                    Labor cost report
GET    /discount-summary         Discount/comp/void summary
GET    /payment-summary          Payment method breakdown
GET    /tax-report               Tax liability report

POST   /export                   Export report as CSV/PDF (returns job ID)
GET    /export/:job_id           Check export status / download
```

**Customers (`/api/v1/customers/`)**
```
GET    /                         Search/list customers
POST   /                         Create customer
GET    /:id                      Get customer with history
PUT    /:id                      Update customer
GET    /:id/orders               Customer order history
GET    /:id/loyalty              Loyalty account details
POST   /lookup                   Lookup by phone/email
POST   /merge                    Merge duplicate customer records
```

**Settings (`/api/v1/settings/`)**
```
GET    /organization             Get org settings
PUT    /organization             Update org settings
GET    /location/:id             Get location settings
PUT    /location/:id             Update location settings

GET    /tax-rates                List tax rates
POST   /tax-rates                Create tax rate
PUT    /tax-rates/:id            Update tax rate

GET    /terminals                List terminals
POST   /terminals                Register terminal
PUT    /terminals/:id            Update terminal
DELETE /terminals/:id            Deactivate terminal

GET    /printers                 List configured printers
POST   /printers                 Add printer
PUT    /printers/:id             Update printer config
POST   /printers/:id/test        Send test print

GET    /modules                  List available/enabled modules
POST   /modules/:id/enable       Enable module
POST   /modules/:id/disable      Disable module
PUT    /modules/:id/config       Update module config

GET    /roles                    List roles and permissions
PUT    /roles/:role/permissions  Update role permissions
```

**KDS (`/api/v1/kds/`)** — Module: mod.kds
```
GET    /stations                 List KDS stations
POST   /stations                 Create station
PUT    /stations/:id             Update station config
GET    /stations/:id/tickets     Get active tickets for station

POST   /tickets/:item_id/bump    Bump item (mark complete)
POST   /tickets/:order_id/bump-all  Bump entire order
POST   /tickets/:item_id/recall  Recall bumped item
GET    /metrics                  KDS performance metrics (avg times)
```

**Inventory (`/api/v1/inventory/`)** — Module: mod.inventory
```
GET    /items                    List inventory items
POST   /items                    Create inventory item
PUT    /items/:id                Update inventory item
POST   /items/:id/count          Record inventory count
POST   /items/:id/adjust         Manual adjustment
GET    /items/low-stock          Items below par level

GET    /vendors                  List vendors
POST   /vendors                  Create vendor
GET    /purchase-orders          List POs
POST   /purchase-orders          Create PO
POST   /purchase-orders/:id/receive  Receive PO items

GET    /recipes                  List recipes (item-to-ingredient mapping)
POST   /recipes                  Create recipe
GET    /waste-log                Waste report
POST   /waste                    Record waste
```

**Reservations (`/api/v1/reservations/`)** — Module: mod.reservations
```
GET    /                         List reservations (date, status)
POST   /                         Create reservation
PUT    /:id                      Update reservation
DELETE /:id                      Cancel reservation
POST   /:id/seat                 Mark as seated
POST   /:id/no-show              Mark as no-show
POST   /:id/confirm              Send confirmation (SMS/email)

GET    /waitlist                 Current waitlist
POST   /waitlist                 Add to waitlist
PUT    /waitlist/:id             Update waitlist entry
POST   /waitlist/:id/notify      Notify guest (table ready)
POST   /waitlist/:id/seat        Seat from waitlist
GET    /availability             Check available slots
```

### Real-Time Subscriptions

For endpoints that need live updates, clients subscribe via Supabase Realtime or SSE:

```
SSE    /api/v1/events/orders     Order status changes (for all terminals)
SSE    /api/v1/events/kds        Kitchen ticket feed
SSE    /api/v1/events/tables     Table status changes
SSE    /api/v1/events/86         86 notifications
```

---




---


# Appendix C: Regulatory Compliance Reference

*Regulatory and compliance information compiled from market research.*

This appendix consolidates all regulatory requirements relevant to Sear POS: PCI DSS 4.0, state sales tax rules, tip credit laws, ADA accessibility, GDPR/CCPA, alcohol service laws, EMV liability, and surcharging/cash discount legality.

The detailed compliance information is included in Part 2 (Market Research & Competitive Analysis), Section 2: Regulatory & Compliance. Key highlights for implementation:

### PCI DSS 4.0 Compliance Summary for Sear POS

- **Target SAQ Level:** SAQ B-IP (semi-integrated, P2PE payment terminals)
- **MFA Required:** For all access to cardholder data environment
- **Passwords:** Minimum 12 characters
- **Penetration Testing:** Required after significant changes
- **Real-Time Monitoring:** Mandatory
- **Quarterly Scans:** Required

### Sear's Approach to PCI Compliance

Sear never touches raw card data. The Valor payment terminal (VP800, VP550, VP300 Pro, RCKT) encrypts card data at the point of capture using P2PE. Sear's backend receives only tokens via Valor Connect or REST API. This dramatically reduces PCI scope.

```
Card Data Flow:
Physical Card -> Valor Terminal (P2PE encrypts) -> Valor PayTech (decrypts, routes to backend processor, authorizes) -> Token returned to Sear

Sear POS NEVER sees: card number, CVV, track data, PIN
Sear POS DOES see: token, last 4 digits, card brand, authorization code, transaction amount
```

### State-Specific Configuration

The `locations` table stores state-specific tax rates, tip credit rules, surcharging rules, and happy hour restrictions. The system enforces these per-location.

Key state-specific features:
- **Sales tax:** Configurable multi-rate tax (city + county + state, food vs alcohol vs prepared food)
- **Surcharging:** Enabled/disabled per state; capped at Visa 3% / Mastercard 4%; debit cards excluded
- **Tip credit:** Configurable per state (no tip credit states like California auto-configured)
- **Happy hour:** Time/duration restrictions configurable per state rules
- **Alcohol age verification:** Mandatory ID prompt, configurable age threshold

---


# Appendix D: Hardware Compatibility Guide

## Tablets (POS Terminals)

### Recommended iPad Models
| Model | Screen | Use Case | Notes |
|-------|--------|----------|-------|
| iPad 10th Gen (2022+) | 10.9" | Primary POS terminal, countertop | Best value. A14 chip. USB-C. |
| iPad Air (2024+) | 11" / 13" | Primary POS terminal | M2 chip. Good for high-volume. |
| iPad mini (A17 Pro) | 8.3" | Handheld/tableside ordering | Compact. Fits in apron pocket with case. |
| iPad Pro (2024+) | 11" / 13" | KDS display, high-volume terminal | Overkill for POS but maximum performance. |

**Minimum requirements:** iPad 9th Gen or later, iPadOS 16+, WiFi (802.11ac or better).

### Android Tablets (Supported)
| Model | Notes |
|-------|-------|
| Samsung Galaxy Tab Active 3 | Durable, water-resistant. Popular for restaurant POS. |
| Lenovo Tab P12 | Good performance for commercial use. |
| Samsung Galaxy Tab A8/A9 | Budget option for less demanding use cases. |

**Minimum requirements:** Android 12+, 4GB RAM, WiFi (802.11ac or better).

### Device Management
- **Guided Access** (iOS built-in) — Locks iPad to Sear POS app. No MDM required for single devices.
- **Single App Mode via MDM** — For managed deployments. Jamf, SimpleMDM, Hexnode supported.
- **Kiosk mode** — Full lockdown for guest-facing kiosks.

## Receipt Printers

### Recommended Models
| Printer | Connection | Compatible With | Price Range |
|---------|-----------|----------------|-------------|
| Star Micronics mPOP | Bluetooth (MFi) | iPad, Android | ~$400 (includes cash drawer) |
| Star Micronics TSP143IV | Ethernet/WiFi/USB | All platforms | ~$350 |
| Star Micronics TSP143III LAN | Ethernet | All platforms | ~$180-250 |
| Epson TM-82II | USB/Ethernet | All platforms | ~$200-300 |
| Epson TM-T88VII | USB/Ethernet/WiFi | All platforms | ~$350-450 |

**Key requirement:** Star Micronics printers with Apple MFi certification are recommended for iPad deployments. The SteadyLAN feature provides Ethernet pass-through to iOS devices.

### Kitchen Printers
Same models as receipt printers. Kitchen printers should use Ethernet connections for reliability (WiFi in commercial kitchens is unreliable due to metal surfaces). One printer per kitchen station.

## Cash Drawers

| Model | Connection | Notes |
|-------|-----------|-------|
| Star Micronics mPOP | Integrated with mPOP printer | Compact "Flat Bill" till design |
| APG Vasario Series | RJ12 cable to receipt printer | Standard full-size drawer. Printer-driven kick. |
| APG Series 4000 | RJ12 cable to receipt printer | Heavy-duty. Multiple till configurations. |

Cash drawers connect to the receipt printer via RJ12 cable. When a cash receipt prints, the drawer kicks open automatically.

## Payment Terminals

### Valor PayTech Hardware (Sear's Integrated Terminal Options)
| Terminal | Type | Features | Use Case |
|----------|------|----------|----------|
| Valor VP800 | Countertop (dual display) | Customer-facing screen + merchant screen, chip/swipe/tap, WiFi + Ethernet. Shows Dual Pricing on customer display. | Primary countertop terminal. Best for full-service and fast-casual. |
| Valor VP550 | Countertop (compact) | Chip/swipe/tap, WiFi + Ethernet. Compact footprint. | Smaller countertops, space-constrained setups. |
| Valor VP300 Pro | PIN pad | Customer-facing PIN/input device. Pairs with POS. | PIN-entry scenarios, customer-facing input. |
| Valor RCKT | Mobile (Bluetooth) | Pairs with iOS/Android. Chip + tap. Portable. | Tableside payments, food trucks, outdoor seating, events. |
| Valor VL500 | Versatile terminal | Multi-purpose terminal. | Flexible deployment scenarios. |

All Valor terminals support: EMV chip, contactless (NFC), magnetic stripe, end-to-end encryption (P2PE), tokenization. Connected via Valor Connect (MQTT cloud protocol) or local network. Dual Pricing display supported on VP800 customer-facing screen.

Sear integrates exclusively with Valor PayTech terminals. No other card reader hardware is supported.

## Kitchen Display System Hardware

| Option | Setup | Price Range | Notes |
|--------|-------|------------|-------|
| iPad (wall-mounted) | iPad in enclosure + KDS app | $350-500 + mount | Good for 1-2 station kitchens |
| Commercial touchscreen + Android | 15-22" heat-rated display | $600-1,200/station | Recommended for high-volume kitchens |
| Monitor + bump bar | Standard display + programmable keypad | $500-900/station | Traditional setup. Cooks don't touch screen. |

## Network Requirements

- **Primary:** Hardwired Ethernet for POS terminals and printers where possible
- **Secondary:** Dual-band WiFi (2.4GHz for range, 5GHz for speed)
- **Backup:** Cellular failover (mobile hotspot) for internet loss
- **Local network:** Must remain operational even when internet is down (for offline mode, device-to-device communication)
- **Access points:** Commercial kitchens typically need 2-3 access points per 2,000 sq ft due to metal interference

### Star SteadyLAN
Star Micronics printers with SteadyLAN provide Ethernet connectivity to an iPad via the USB-C/Lightning cable. The iPad gets power and a wired network connection through the printer. This eliminates WiFi dependency for the primary POS terminal.

---


# Appendix E: Financial Model & Pricing

## Sear POS Pricing Philosophy

1. **Transparent** — All prices on the website. No "call for a quote."
2. **Month-to-month** — Cancel anytime. No termination fees.
3. **2/3 less than Toast on all software** — Every software price point is 1/3 of Toast's equivalent.
4. **$0 processing cost to restaurant** — Valor's 4% Dual Pricing passes the card fee to the customer. The restaurant pays nothing.
5. **Sear keeps 1.9% of every card transaction** — That's where the real revenue is. Software is the hook; processing is the engine.

## The Economics: How the 4% Dual Pricing Works

```
CARD-PAYING CUSTOMER'S EXPERIENCE:
  Menu shows two prices:
    Burger (cash): $15.00
    Burger (card): $15.60 (+4%)

  Customer pays with Visa → charged $15.60
  Customer pays with cash → charged $15.00

WHERE THE 4% GOES:
  ┌──────────────────────────────────────┐
  │  Customer pays:        $15.60       │
  │  Cash price:           $15.00       │
  │  Card fee (4%):         $0.60       │
  │                                      │
  │  Sear keeps (1.9%):    $0.285       │
  │  Valor keeps (2.1%):   $0.315       │
  │  Restaurant keeps:     $15.00       │
  │  Restaurant pays:      $0.00        │
  └──────────────────────────────────────┘
```

## Software Pricing: 2/3 Less Than Toast

### Starter — $23/month (Toast Core: $69 — 2/3 less)
- 2 terminals included
- Core modules: POS, Menu Management, Staff/Time Clock, Basic Reporting, Settings
- Valor payment processing with Dual Pricing included
- Email receipts
- 86 management
- Cash drawer management

### Professional — $49/month (Toast Core + add-ons: $194+ — 2/3 less)
- 4 terminals included
- Everything in Starter, plus:
- Online ordering (commission-free)
- Basic loyalty program
- Gift cards
- Kitchen Display System (KDS)
- Advanced reporting & daily email summaries
- Table management & floor plan

### Enterprise — $65-99/location (Toast Enterprise: $200+ — 2/3 less)
- Unlimited terminals
- All modules included
- Dedicated account manager
- SLA (99.95% uptime guarantee)
- SSO integration
- API access
- Custom integrations
- Priority support (< 5 min response for critical issues)

### Add-On Pricing (each 2/3 less than Toast equivalent)
| Item | Sear Price | Toast Equivalent |
|------|-----------|-----------------|
| Additional terminal | $9/month | ~$25-75/month |
| Additional KDS screen | $15/month per screen | ~$50/month |
| Self-service kiosk | $19/month per kiosk | ~$50/month |
| Customer-facing display | $5/month per screen | ~$15/month |
| Advanced analytics module | $29/month | ~$89/month |
| Inventory management module | $19/month | ~$79/month |
| Delivery management module | $15/month | ~$50/month |
| Catering module | $15/month | ~$50/month |
| Marketing & campaigns module | $15/month | ~$50/month |
| Payroll integration module | $9/month | ~$30/month |

### Second Location
60% of primary location price.

## Revenue Model: Software Hook + Processing Engine

```
SEAR'S TWO REVENUE STREAMS:

1. SOFTWARE (the hook — gets them in the door)
   Starter: $23/month | Professional: $49/month | Enterprise: $65-99/location

2. PROCESSING (the engine — where the money is)
   Sear keeps 1.9% of all card transaction volume
   On $80K/month card volume = $1,520/month to Sear

COMBINED REVENUE PER RESTAURANT:
┌──────────────────────────────────────────────────────────┐
│  Restaurant Size     │ Software │ Processing │  Total   │
│                      │  /month  │ (1.9%)     │  /month  │
│──────────────────────│──────────│────────────│──────────│
│  Small ($20K cards)  │   $23    │    $380    │   $403   │
│  Mid ($48K cards)    │   $49    │    $912    │   $961   │
│  Large ($100K cards) │   $49    │  $1,900    │ $1,949   │
│  Enterprise (per loc)│   $80    │  $1,520    │ $1,600   │
└──────────────────────────────────────────────────────────┘
```

## Cost Comparison: What the RESTAURANT Pays

### Small Cafe (1 location, 2 terminals, $25K/month in sales)

| Cost Category | Toast | Sear (Starter) |
|--------------|-------|----------------|
| Software subscription | $138/month (2 × $69) | **$23/month** |
| Online ordering module | $75/month | Not included (Starter) |
| Payment processing (card sales ~$20K/mo) | ~$513/month (2.49% + $0.15) | **$0/month** (4% Dual Pricing — customer pays) |
| KDS | ~$50/month | Not included (Starter) |
| **Monthly cost to restaurant** | **~$812** | **$23** |
| **Annual cost to restaurant** | **~$9,744** | **$276** |
| **Annual savings** | — | **$9,468/year** |

### Fast-Casual (1 location, 3 terminals, $60K/month in sales)

| Cost Category | Toast | Sear (Professional) |
|--------------|-------|-------------------|
| Software subscription | $225/month (3 × $75) | **$49/month** + $9 (extra terminal) = **$58** |
| Online ordering | $75/month | Included |
| Gift cards | $50/month | Included |
| Loyalty | $50/month | Included |
| KDS (2 screens) | ~$100/month | Included (1) + $15 extra = **$15** |
| Payment processing (card sales ~$48K/mo) | ~$1,210/month (2.49% + $0.15) | **$0/month** (Dual Pricing) |
| **Monthly cost to restaurant** | **~$1,945** | **$73** |
| **Annual cost to restaurant** | **~$23,340** | **$876** |
| **Annual savings** | — | **$22,464/year** |

### Full-Service with Bar (1 location, 4 terminals, $120K/month in sales)

| Cost Category | Toast | Sear (Professional) |
|--------------|-------|-------------------|
| Software subscription | $300/month (4 × $75) | **$49/month** |
| Online ordering | $75/month | Included |
| Gift cards + Loyalty + Scheduling | $150/month | Included |
| KDS (3 screens) | ~$150/month | Included (1) + $30 (2 extra) = **$30** |
| Payment processing (card sales ~$100K/mo) | ~$2,505/month (2.49% + $0.15) | **$0/month** (Dual Pricing) |
| **Monthly cost to restaurant** | **~$3,795** | **$79** |
| **Annual cost to restaurant** | **~$45,540** | **$948** |
| **Annual savings** | — | **$44,592/year** |

### What Sear EARNS on that same full-service restaurant:
- Software: $79/month
- Processing (1.9% of $100K): $1,900/month
- **Total Sear revenue: $1,979/month ($23,748/year)**

### Hardware Comparison

| Item | Toast (Proprietary) | Sear (BYOD + Valor) |
|------|-------------------|---------------------|
| 3 terminals | $4,200 (Toast hardware) | $0 (existing iPads) or ~$1,050 (3 x iPad 10th Gen) |
| 2 kitchen printers | $800 (Toast pricing) | $400 (Star TSP143III x 2) |
| 2 payment terminals | Included with Toast hardware | Valor VP800 or VP550 (provided through Valor partnership) |
| Cash drawer | $200 (Toast) | $100 (APG Vasario) |
| **Total hardware** | **$5,200** | **$500-$1,550** |

After canceling Toast, all their hardware is worthless. After canceling Sear, the iPads, printers, and cash drawers work with any other system.

### Enterprise Group (45 locations, 3-year TCO)

| | Toast Enterprise | Sear Enterprise |
|---|----------------|----------------|
| 3-year software | $580K-$1.05M | $105K-$160K (2/3 less) |
| Hardware | $150K-$250K | $50K-$100K |
| Processing cost to restaurant | $1.2-1.8M (locked at 2.49%+$0.15) | **$0** (Dual Pricing) |
| Implementation | Included (sort of) | $90K-$225K |
| **3-year TCO to restaurant** | **$1.93-3.1M** | **$245-485K** |
| **3-year savings** | — | **$1.7-2.6M** |

Sear's revenue from that same 45-location group (3 years):
- Software: $105-160K
- Processing (1.9% × avg $80K/loc × 45 × 36 months): **$2.46M**
- **Total 3-year Sear revenue: ~$2.6M**

### At Scale: 500 Restaurants

```
Assuming average $80K/month card volume per restaurant:

                              Per Restaurant    × 500       Annual
──────────────────────────────────────────────────────────────────
Software revenue              $49/month         $24,500     $294,000
Processing revenue (1.9%)     $1,520/month      $760,000    $9,120,000
──────────────────────────────────────────────────────────────────
Total revenue                 $1,569/month      $784,500    $9,414,000

For comparison, Toast at 500 restaurants:
Software: ~$82,500/month ($165 × 500)
Processing margin (~1.2%): ~$480,000/month
Total: ~$562,500/month = $6.75M/year

Sear earns MORE per restaurant ($1,249 vs $1,125) while the
restaurant pays LESS ($49 vs $2,600+). The customer funds the gap.
```

## What Small Owners Consider Fair

Based on persona research:
- Base software for a standard 2-3 terminal restaurant: $50-100/month total (not per terminal)
- **Sear delivers: $23-49/month — well below their ceiling**
- Processing: the dream is $0 — Dual Pricing delivers exactly that
- **Total cost to restaurant: $23-49/month vs their $200-300 ceiling**
- Word-of-mouth will be explosive when an owner tells other owners they pay $49/month total

## The Sales Pitch

> "Your software is 2/3 cheaper than Toast. Your processing costs you nothing — the card-paying customer covers it. You keep your own iPads. Cancel anytime. What's your excuse for staying on Toast?"

---

*End of document.*
