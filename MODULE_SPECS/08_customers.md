# Module 08: Customer Relationship Management

## Overview

The Customers module manages guest profiles, order history, preferences, and VIP identification. It enables personalized service by giving servers access to a guest's history, dietary restrictions, and visit frequency at the point of order. It serves as the foundation for the Loyalty and Marketing modules.

**Who uses it:** Servers look up customers at checkout or when seating regulars. Managers review customer analytics and merge duplicates. The Loyalty module reads/writes customer data. The Marketing module segments customers for campaigns.

**Why it matters:** Repeat customers drive restaurant profitability. Knowing that a guest is allergic to shellfish, prefers a window booth, and visits weekly transforms service quality. Customer data also feeds marketing, loyalty, and reporting.

---

## Database Tables

- **`customers`** — Customer profiles. Fields: `first_name`, `last_name`, `email`, `phone`, `notes` (free text: allergies, preferences), `tags[]` (vip, regular, food-allergy, etc.), stats (`total_visits`, `total_spent`, `average_check`, `last_visit_at`), `marketing_opt_in`, `birthday`, `anniversary`, `deleted_at`.
- **`customer_addresses`** — Delivery addresses. Fields: `customer_id`, `label` (home, work, other), `line1`, `line2`, `city`, `state`, `zip`, `is_default`.
- **`orders`** — (Shared) Orders linked via `customer_id`.
- **`loyalty_accounts`** — (Shared with Loyalty module) Loyalty membership linked to customer.

---

## API Routes

### Blueprint: `/api/v1/customers/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Search/list customers (filter: name, phone, email, tags) | Yes |
| POST | `/` | Create customer | Yes |
| GET | `/:id` | Get customer with full profile and stats | Yes |
| PUT | `/:id` | Update customer | Yes |
| DELETE | `/:id` | Soft-delete customer | Manager+ |
| GET | `/:id/orders` | Customer order history (paginated) | Yes |
| GET | `/:id/loyalty` | Loyalty account details | Yes |
| POST | `/lookup` | Quick lookup by phone or email (returns match or null) | Yes |
| POST | `/merge` | Merge duplicate customer records | Manager+ |

---

## UI Pages / Components

### Customer Lookup (POS component)
- Quick search bar (phone number or name)
- Typeahead results showing name, phone, last visit, tags
- Tap to attach customer to current order
- "New Customer" button if no match
- VIP badge and allergen warnings displayed prominently

### Customer Detail Panel (slide-over or modal)
- **Header:** Name, phone, email, VIP badge, allergen warning icon
- **Stats row:** Total visits, total spent, average check, last visit date
- **Tags:** Editable tag pills (vip, regular, food-allergy, birthday-month)
- **Notes:** Free-text preferences and dietary restrictions
- **Order history:** Recent orders with date, total, items ordered (scrollable list)
- **Loyalty:** Points balance, tier, recent activity (if loyalty module enabled)
- **Addresses:** Saved delivery addresses (add/edit/delete)
- **Birthday/Anniversary:** Date fields for special occasion tracking
- **Marketing opt-in:** Toggle for email/SMS consent

### Customer List (Back Office) — `/admin/customers`
- Searchable, sortable table: Name, phone, email, visits, total spent, last visit, tags
- Filter by tags, visit frequency, spend range
- Export to CSV
- Merge duplicates: Select 2 records, preview merge, confirm
- Bulk tag management

---

## Business Rules

1. **Customer linkage:** A customer can be attached to an order at any point (at seating, during order entry, or at payment). The `customer_id` on the order links them. Stats are updated asynchronously after order close.

2. **Stat denormalization:** `total_visits`, `total_spent`, `average_check`, and `last_visit_at` are denormalized on the customer record. They are updated via a background job after each order close, not in the payment transaction path.

3. **Phone lookup:** The primary lookup method at POS. Servers enter a phone number, system finds the match. Phone is indexed with a partial index (`WHERE phone IS NOT NULL`).

4. **Duplicate detection:** When creating a customer, the system checks for existing records with the same phone or email. If a match is found, the user is prompted to use the existing record or create a new one.

5. **Merge duplicates:** Manager can merge two customer records. The merge:
   - Keeps the "primary" record (user chooses which)
   - Combines `total_visits`, `total_spent`
   - Recalculates `average_check`
   - Moves all order references from secondary to primary
   - Moves loyalty accounts, addresses, and tags
   - Soft-deletes the secondary record
   - Creates audit log entry

6. **VIP flagging:** The `vip` tag triggers a visual indicator on the POS. VIP guests can be auto-identified by visit count or total spend thresholds (configurable per org).

7. **Allergen display:** If `notes` or `tags` contain allergen information, a warning icon appears next to the customer name on the POS order screen and KDS tickets. This is a safety feature.

8. **Birthday tracking:** Customers with `birthday` set appear in a daily birthday report. If the Loyalty module is enabled, birthday rewards are auto-triggered.

9. **Marketing opt-in:** Defaults to `false`. Must be explicitly opted in. Required for GDPR/CCPA compliance. The Marketing module respects this flag.

10. **Cross-location:** Customer records are org-wide (`org_id` scoped). A customer at one location is recognized at any other location in the same organization.

11. **Privacy:** Customer phone numbers and emails are never exposed in reports without manager permission. POS lookup shows minimal info needed for service.

---

## Dependencies

- **01_auth** — Authentication for all routes; manager+ for merge/delete
- **03_orders** — Order linkage and history
- **12_loyalty** — (Optional) Loyalty account linked to customer
- **16_marketing** — (Optional) Reads customer data for segmentation

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `customer.created` | Internal | `{customer_id, name}` | New customer record |
| `customer.updated` | Internal | `{customer_id, changes}` | Profile updated |
| `customer.merged` | Internal | `{primary_id, secondary_id}` | Duplicate merged |
| `customer.vip_triggered` | Internal | `{customer_id, reason}` | Auto-VIP threshold met |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.closed` | Trigger async stat recalculation for attached customer |
| `loyalty.tier_changed` | Update customer tags with new tier info |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `customer_stats_update` | On-demand (Celery task) | Recalculate stats for a customer after order close |
| `birthday_report` | Daily at 6 AM | Generate list of customers with birthdays today/this week |
| `auto_vip_check` | Weekly | Check customers against VIP thresholds, auto-tag qualifying customers |
| `duplicate_detection` | Weekly | Scan for potential duplicates (same phone/email, fuzzy name match) |

---

## Acceptance Criteria

### Customer CRUD
- [ ] User can create a customer with name, phone, email
- [ ] User can edit customer profile fields
- [ ] Manager can soft-delete a customer
- [ ] Customer creation checks for duplicates by phone/email

### Customer Lookup
- [ ] Server can look up a customer by phone number at POS
- [ ] Typeahead results show name, phone, last visit
- [ ] Tapping a result attaches customer to the current order
- [ ] "New Customer" option available when no match found

### Order History
- [ ] Customer detail shows paginated order history
- [ ] Each order shows date, total, items ordered
- [ ] History is accessible from POS and back-office

### Stats
- [ ] Total visits, total spent, and average check are calculated
- [ ] Stats update after order close (async)
- [ ] Last visit date tracks most recent closed order

### Tags and Notes
- [ ] Tags can be added/removed on customer profiles
- [ ] VIP tag shows visual badge on POS
- [ ] Allergen info in notes/tags shows warning icon
- [ ] Tags are searchable and filterable

### Merge
- [ ] Manager can select two customer records to merge
- [ ] Merge preview shows what data will be combined
- [ ] After merge, all orders and loyalty data transfer to primary record
- [ ] Secondary record is soft-deleted
- [ ] Audit log entry created

### Birthday / Anniversary
- [ ] Birthday and anniversary dates can be set on customer profile
- [ ] Daily birthday report lists customers with birthdays today/this week

### Privacy
- [ ] Marketing opt-in defaults to false
- [ ] Customer phone/email not exposed in reports without authorization
- [ ] Customer records scoped to org_id (cross-location within org)
