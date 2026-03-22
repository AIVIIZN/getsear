# Module 12: Loyalty Program

## Overview

The Loyalty module enables restaurants to build repeat business through points-based, visit-based, or spend-based reward programs. Customers earn loyalty currency on every purchase and redeem it for rewards. The module supports tiered programs, welcome bonuses, birthday rewards, and cross-location accrual.

**Who uses it:** Customers earn and redeem at checkout (transparent to them — server handles it). Servers attach customers and apply rewards at POS. Managers configure programs, set reward rules, and review program analytics. Online ordering and kiosk auto-earn loyalty points.

**Why it matters:** Loyalty programs increase visit frequency by 20-35% and average check by 10-15%. Toast charges $75+/month for loyalty. Sear includes it at the Professional tier. The key differentiator is seamless POS integration — no separate app or card required.

---

## Database Tables

### Existing Tables

- **`loyalty_programs`** — Program definitions. Fields: `name`, `program_type` (points, visits, spend_based), `points_per_dollar`, `points_per_visit`, `redemption_threshold` (points needed), `reward_value` (dollar value), `is_active`, `settings` (jsonb: welcome_bonus, birthday_bonus, tier_thresholds, expiration_days).
- **`loyalty_accounts`** — Customer loyalty membership. Fields: `customer_id`, `program_id`, `points_balance`, `lifetime_points`, `tier` (bronze, silver, gold, platinum), `enrolled_at`, `last_activity_at`.
- **`loyalty_transactions`** — Points ledger. Fields: `loyalty_account_id`, `transaction_type` (earn, redeem, adjustment, expire, welcome_bonus, birthday_bonus), `points`, `balance_after`, `order_id`, `description`.
- **`customers`** — (Shared) Customer profiles.

### New Tables

- **`loyalty_tiers`** — Tier definitions. Fields: `id`, `org_id`, `program_id`, `tier_name` (bronze, silver, gold, platinum), `min_lifetime_points`, `points_multiplier` (e.g., 1.5x for gold), `perks` (jsonb: free_delivery, birthday_double_points, priority_seating), `sort_order`, `created_at`.
- **`loyalty_rewards`** — Reward catalog. Fields: `id`, `org_id`, `program_id`, `name` (Free Appetizer, $5 Off, Free Drink), `reward_type` (discount_fixed, discount_percentage, free_item), `value` (dollar or percentage), `points_cost`, `menu_item_id` (for free item rewards), `is_active`, `created_at`.
- **`loyalty_redemptions`** — Redemption records. Fields: `id`, `loyalty_account_id`, `reward_id`, `order_id`, `points_spent`, `discount_applied`, `redeemed_at`.

---

## API Routes

### Blueprint: `/api/v1/loyalty/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/programs` | List loyalty programs for org | Manager+ |
| POST | `/programs` | Create loyalty program | Owner+ |
| PUT | `/programs/:id` | Update loyalty program | Owner+ |
| GET | `/programs/:id` | Get program details with tiers and rewards | Manager+ |
| POST | `/enroll` | Enroll a customer in a program | Yes |
| GET | `/account/:customer_id` | Get loyalty account for a customer | Yes |
| POST | `/earn` | Award points for an order | Yes |
| POST | `/redeem` | Redeem points for a reward | Yes |
| GET | `/rewards` | List available rewards for a program | Yes |
| POST | `/rewards` | Create reward | Manager+ |
| PUT | `/rewards/:id` | Update reward | Manager+ |
| DELETE | `/rewards/:id` | Deactivate reward | Manager+ |
| GET | `/tiers` | List tier definitions | Manager+ |
| POST | `/tiers` | Create tier | Owner+ |
| PUT | `/tiers/:id` | Update tier | Owner+ |
| GET | `/transactions/:customer_id` | Point transaction history | Yes |
| GET | `/analytics` | Program performance analytics | Manager+ |

---

## UI Pages / Components

### Loyalty at POS (component)
- When a customer is attached to an order, loyalty info appears:
  - Points balance
  - Current tier badge
  - Available rewards with "Redeem" button
  - Points to be earned for this order (preview)
- "Enroll" button if customer is not yet enrolled
- Quick enroll: Phone number is sufficient
- Redeem flow: Select reward, confirm, discount applied to order

### Loyalty Program Manager (Back Office) — `/admin/loyalty`
- **Program setup:**
  - Name, type (points/visits/spend)
  - Earn rate: points per dollar, per visit, or per qualifying purchase
  - Redemption: Points needed per reward, reward catalog
  - Welcome bonus: Points awarded on enrollment
  - Birthday bonus: Points or reward on birthday month
  - Expiration: Points expire after N days of inactivity (0 = never)
- **Tier configuration:**
  - Tier names and thresholds (lifetime points)
  - Per-tier perks (multiplier, free delivery, priority seating)
  - Tier upgrade notifications
- **Reward catalog:**
  - List of available rewards with name, type, value, points cost
  - Add/edit/deactivate rewards
- **Analytics dashboard:**
  - Total enrolled members
  - Active members (transacted in last 30 days)
  - Points issued vs redeemed
  - Redemption rate
  - Revenue from loyalty members vs non-members
  - Tier distribution pie chart

### Customer-Facing (Online/Kiosk)
- Points balance displayed after login/lookup
- Available rewards shown at checkout
- Earn preview: "You'll earn X points on this order"
- Tier progress bar: "50 more points to reach Gold"

---

## Business Rules

1. **Earn calculation:**
   - Points-based: `points = order_subtotal * points_per_dollar` (rounded down)
   - Visit-based: `points = points_per_visit` per qualifying order (regardless of amount)
   - Spend-based: `points = 1 per qualifying dollar spent`
   - Tier multiplier applied: Gold tier with 1.5x multiplier earns 1.5x base points

2. **Earn timing:** Points are awarded when the order is closed (fully paid), not at creation. This prevents earning on voided/refunded orders.

3. **Redemption rules:**
   - Customer must have sufficient points balance
   - Only one reward per order (configurable — can allow multiple)
   - Redemption creates a discount on the order (via `order_discounts`)
   - Points deducted atomically with order discount application

4. **Tier advancement:**
   - Based on `lifetime_points` (never decreases, even after redemption)
   - Tier thresholds: Bronze (0), Silver (500), Gold (2000), Platinum (5000) — configurable
   - Tier upgrades are immediate when threshold is crossed
   - Tier downgrades: Configurable — annual review or never downgrade

5. **Welcome bonus:** Configurable points awarded immediately on enrollment. Creates a `loyalty_transactions` record of type `welcome_bonus`.

6. **Birthday rewards:** During the customer's birthday month, a special reward or bonus points are automatically credited. Requires `birthday` field set on the customer record.

7. **Points expiration:** If configured, points expire after N days of account inactivity (`last_activity_at`). Expiration runs as a background job. Expired points create a `loyalty_transactions` record of type `expire`.

8. **Cross-location:** Loyalty accounts are org-wide. Points earned at one location can be redeemed at any other location in the organization.

9. **Enrollment:** Enrollment requires a customer record with at least a phone number. Auto-enrollment at checkout is configurable (first purchase auto-enrolls).

10. **Void/refund handling:** If an order is voided or refunded after points were earned, the earned points are clawed back via a negative `adjustment` transaction.

---

## Dependencies

- **01_auth** — Authentication
- **03_orders** — Order close triggers earn, redemption creates discount
- **04_payments** — Order must be fully paid before earn
- **08_customers** — Customer records, birthday data
- **10_settings** — Module enable/disable

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `loyalty.points_earned` | Internal | `{customer_id, points, balance, order_id}` | Points awarded |
| `loyalty.points_redeemed` | Internal | `{customer_id, points, reward_name, order_id}` | Reward redeemed |
| `loyalty.tier_changed` | Internal | `{customer_id, old_tier, new_tier}` | Tier promotion |
| `loyalty.enrolled` | Internal | `{customer_id, program_id}` | New enrollment |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.closed` | Calculate and award loyalty points |
| `order.voided` | Claw back earned points |
| `payment.refunded` | Claw back proportional points |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `loyalty_points_expiration` | Daily at midnight | Expire points for inactive accounts past threshold |
| `birthday_bonus_credit` | Daily at 6 AM | Credit birthday bonuses for customers with birthdays today |
| `tier_review` | Monthly | Review and adjust tiers (if downgrade policy is annual review) |
| `loyalty_analytics_refresh` | Daily at 4 AM | Refresh loyalty analytics dashboard data |

---

## Acceptance Criteria

### Enrollment
- [ ] Customer can be enrolled in loyalty program at POS
- [ ] Auto-enrollment on first purchase works (if configured)
- [ ] Welcome bonus points credited immediately on enrollment
- [ ] Enrollment requires minimum of phone number

### Earning
- [ ] Points earned when order is closed (not at creation)
- [ ] Earn rate respects program type (points/visits/spend)
- [ ] Tier multiplier applied correctly (e.g., Gold earns 1.5x)
- [ ] Points preview shown at checkout before payment

### Redemption
- [ ] Available rewards listed when customer attached to order
- [ ] Selecting a reward deducts points and applies discount
- [ ] Insufficient points shows error
- [ ] Redemption creates `order_discounts` record

### Tiers
- [ ] Tier advances automatically when lifetime points cross threshold
- [ ] Tier badge displays on POS and customer detail
- [ ] Tier perks (multiplier, etc.) applied correctly
- [ ] Tier progress shown to customer (points needed for next tier)

### Birthday Rewards
- [ ] Birthday bonus credited during birthday month
- [ ] Requires birthday field set on customer record

### Cross-Location
- [ ] Points earned at location A can be redeemed at location B
- [ ] Loyalty account is org-wide

### Void/Refund Handling
- [ ] Voided orders claw back earned points
- [ ] Refunded orders claw back proportional points

### Analytics
- [ ] Enrolled member count displayed
- [ ] Redemption rate calculated
- [ ] Revenue comparison: loyalty vs non-loyalty members
