# Module 16: Email & SMS Marketing

## Overview

The Marketing module enables restaurants to create and send targeted email and SMS campaigns to their customer base. It includes customer segmentation, automated triggers, campaign analytics (opens, clicks, redemptions), A/B testing, and compliance management (opt-in/opt-out, CAN-SPAM, TCPA).

**Who uses it:** Managers create and schedule campaigns. Owners review campaign performance. The system sends automated trigger-based messages. Customers receive marketing messages and can unsubscribe.

**Why it matters:** Acquiring a new customer costs 5-7x more than retaining one. Targeted marketing drives repeat visits. A "We miss you" campaign to lapsed guests with 10% off typically generates 15-25% redemption rates. Toast charges $75+/month for marketing tools.

---

## Database Tables

### Existing Tables

- **`campaigns`** — Campaign records. Fields: `name`, `campaign_type` (email, sms, email_sms), `status` (draft, scheduled, sending, sent, paused, cancelled), `subject` (email), `body_html` (email), `sms_body`, `target_segment` (jsonb filter criteria), `target_count`, `scheduled_for`, `sent_at`, stats (`recipients_count`, `opened_count`, `clicked_count`, `redeemed_count`), `discount_id` (attached offer), `created_by`.
- **`campaign_recipients`** — Per-recipient tracking. Fields: `campaign_id`, `customer_id`, `channel` (email, sms), `status` (pending, sent, delivered, opened, clicked, bounced, unsubscribed), `sent_at`, `opened_at`, `clicked_at`.
- **`customers`** — (Shared) Customer data with `marketing_opt_in`, `email`, `phone`, `tags`, `total_visits`, `last_visit_at`, `birthday`.
- **`discounts`** — (Shared) Discount definitions for campaign offers.

### New Tables

- **`marketing_automations`** — Automated trigger rules. Fields: `id`, `org_id`, `name` (Welcome, Win-Back, Birthday, Post-Visit), `trigger_type` (enrollment, lapsed_days, birthday, post_visit_hours), `trigger_config` (jsonb: {days: 30} for lapsed, {hours: 24} for post-visit), `campaign_template_id`, `is_active`, `total_triggered`, `created_at`.
- **`ab_test_variants`** — A/B test variants. Fields: `id`, `campaign_id`, `variant_name` (A, B), `subject`, `body_html`, `sms_body`, `recipient_percentage`, `opened_count`, `clicked_count`, `redeemed_count`, `created_at`.
- **`unsubscribe_log`** — Unsubscribe tracking. Fields: `id`, `org_id`, `customer_id`, `channel` (email, sms), `campaign_id`, `reason`, `unsubscribed_at`.

---

## API Routes

### Blueprint: `/api/v1/marketing/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/campaigns` | List campaigns (filter: status, type, date range) | Manager+ |
| POST | `/campaigns` | Create campaign | Manager+ |
| GET | `/campaigns/:id` | Get campaign with stats | Manager+ |
| PUT | `/campaigns/:id` | Update campaign | Manager+ |
| DELETE | `/campaigns/:id` | Delete draft campaign | Manager+ |
| POST | `/campaigns/:id/send` | Send or schedule campaign | Manager+ |
| POST | `/campaigns/:id/pause` | Pause sending campaign | Manager+ |
| POST | `/campaigns/:id/resume` | Resume paused campaign | Manager+ |
| GET | `/campaigns/:id/recipients` | Get recipient list with status | Manager+ |
| POST | `/campaigns/:id/test` | Send test to specific email/phone | Manager+ |
| GET | `/segments` | Preview segment with filter criteria | Manager+ |
| POST | `/segments/count` | Count matching customers for segment | Manager+ |
| GET | `/automations` | List automation rules | Manager+ |
| POST | `/automations` | Create automation | Manager+ |
| PUT | `/automations/:id` | Update automation | Manager+ |
| DELETE | `/automations/:id` | Delete automation | Manager+ |
| GET | `/analytics` | Campaign performance analytics | Manager+ |
| GET | `/unsubscribes` | Unsubscribe log | Manager+ |

### Public Routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/unsubscribe/:token` | Unsubscribe page |
| POST | `/unsubscribe/:token` | Process unsubscribe |
| GET | `/track/open/:token` | Track email open (1x1 pixel) |
| GET | `/track/click/:token` | Track link click (redirect) |

---

## UI Pages / Components

### Campaign Builder — `/admin/marketing/campaigns/new`
- **Step 1 — Audience:** Segment builder with filter rules:
  - Visit frequency (e.g., visited 3+ times in last 60 days)
  - Spend range (e.g., average check $30+)
  - Last visit (e.g., hasn't visited in 30+ days)
  - Tags (e.g., VIP, birthday-month)
  - Location (specific or all)
  - Loyalty tier (bronze, silver, gold, platinum)
  - Live count preview: "This segment has 247 customers"
- **Step 2 — Content:**
  - Email: Subject line, HTML body with rich text editor, merge tags ({first_name}, {points_balance})
  - SMS: Message body (160 char limit display), merge tags
  - A/B test toggle: Create variant B with different subject/body
  - Attach offer: Select existing discount or create new one
- **Step 3 — Schedule:**
  - Send now or schedule for future date/time
  - Preview send (test email/SMS)
- **Step 4 — Review & Send:**
  - Summary of audience, content, schedule
  - Confirm and send/schedule

### Campaign List — `/admin/marketing`
- Table: Name, type, status, recipients, open rate, click rate, redemptions, sent date
- Status badges: Draft, Scheduled, Sending, Sent, Paused
- Quick actions: Edit, Duplicate, Pause, Delete

### Campaign Analytics — `/admin/marketing/campaigns/:id`
- Stats cards: Sent, Delivered, Opened, Clicked, Redeemed
- Funnel visualization: Sent → Delivered → Opened → Clicked → Redeemed
- A/B test comparison (if applicable): Side-by-side variant performance
- Recipient list with individual status
- Revenue attributed to campaign (orders using attached discount)

### Automations — `/admin/marketing/automations`
- List of automation rules with trigger type, status, total triggered
- Create/edit: Select trigger type, configure timing, select template
- Enable/disable toggle

### Unsubscribe Page (public)
- Clean, branded page confirming unsubscribe
- Optional reason selection (too frequent, not relevant, no longer a customer)
- Confirmation message
- Re-subscribe option

---

## Business Rules

1. **Opt-in required:** Campaigns are only sent to customers with `marketing_opt_in = true`. This is enforced at send time — the segment filter automatically excludes opted-out customers.

2. **CAN-SPAM compliance (email):**
   - Every email includes physical mailing address
   - Every email includes unsubscribe link
   - Unsubscribe requests processed within 10 business days (system processes immediately)
   - No misleading subject lines

3. **TCPA compliance (SMS):**
   - SMS only sent to customers who explicitly opted in
   - Every SMS includes opt-out instructions ("Reply STOP to unsubscribe")
   - STOP replies processed automatically via Twilio webhook
   - SMS sent only during business hours (9 AM - 9 PM recipient's timezone)

4. **Segmentation criteria:** Segments are defined by jsonb filter objects combining any customer fields. Multiple criteria are AND-combined. Example: `{"min_visits": 5, "last_visit_within_days": 30, "tags": ["vip"]}`.

5. **A/B testing:** Campaigns can have two variants (A and B). Each variant gets a configurable percentage of recipients (e.g., 50/50 or 10/10/80 where 80% gets the winner). After a test period, the winning variant (higher open or click rate) can be sent to the remaining recipients.

6. **Automated triggers:**
   - **Welcome:** Sent N hours after loyalty enrollment
   - **Win-back:** Sent when customer hasn't visited in N days
   - **Birthday:** Sent on birthday (or N days before)
   - **Post-visit:** Sent N hours after a closed order (thank you + review request)

7. **Merge tags:** Templates support merge tags: `{first_name}`, `{last_name}`, `{points_balance}`, `{tier}`, `{last_visit_date}`, `{discount_code}`. Tags are resolved per-recipient at send time.

8. **Send rate limiting:** Bulk sends are throttled to comply with SendGrid/Twilio rate limits. Large campaigns are queued and sent in batches over time.

9. **Open tracking:** Email opens tracked via a 1x1 transparent pixel. Not 100% reliable (some email clients block images) but industry standard.

10. **Click tracking:** Links in emails are wrapped with tracking redirects. Click creates `campaign_recipients` update and redirects to the original URL.

11. **Revenue attribution:** When a campaign includes a discount, orders using that discount within 30 days of send are attributed to the campaign. This enables ROI calculation.

---

## Dependencies

- **01_auth** — Authentication for management routes
- **08_customers** — Customer data, opt-in status, segmentation fields
- **12_loyalty** — (Optional) Loyalty data for segmentation and merge tags
- **10_settings** — Org settings (mailing address for CAN-SPAM)
- **External: SendGrid** — Email delivery
- **External: Twilio** — SMS delivery
- **External: Redis DB 0** — Celery queue for async send

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `campaign.sent` | Internal | `{campaign_id, recipients_count}` | Campaign send completed |
| `campaign.opened` | Internal | `{campaign_id, customer_id}` | Recipient opened email |
| `campaign.clicked` | Internal | `{campaign_id, customer_id}` | Recipient clicked link |
| `campaign.unsubscribed` | Internal | `{customer_id, channel}` | Recipient unsubscribed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `loyalty.enrolled` | Trigger welcome automation |
| `order.closed` | Trigger post-visit automation, check win-back reset |
| `customer.birthday_today` | Trigger birthday automation |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `campaign_send_queue` | Continuous | Process queued campaign sends in batches |
| `automation_trigger_check` | Every 15 minutes | Check for customers matching automation trigger conditions |
| `birthday_campaign_trigger` | Daily at 6 AM | Trigger birthday automations |
| `winback_check` | Daily at 10 AM | Check for lapsed customers matching win-back criteria |
| `campaign_analytics_refresh` | Every hour | Update campaign stats (opens, clicks, redemptions) |
| `unsubscribe_webhook_processor` | On webhook receipt | Process Twilio STOP replies |

---

## Acceptance Criteria

### Campaign Creation
- [ ] Manager can create email campaign with subject, body, and audience segment
- [ ] Manager can create SMS campaign with message body and audience segment
- [ ] Segment preview shows matching customer count
- [ ] Merge tags resolve correctly in preview
- [ ] A/B test variants can be created

### Sending
- [ ] Campaign can be sent immediately or scheduled
- [ ] Only opted-in customers receive messages
- [ ] Test send delivers to specified email/phone
- [ ] Large campaigns are queued and throttled

### Tracking
- [ ] Email opens tracked via pixel
- [ ] Link clicks tracked via redirect
- [ ] Campaign analytics show sent/delivered/opened/clicked/redeemed
- [ ] A/B test comparison shows variant performance

### Compliance
- [ ] Every email includes unsubscribe link
- [ ] Unsubscribe processes immediately
- [ ] SMS includes STOP instructions
- [ ] Twilio STOP replies processed automatically
- [ ] Unsubscribed customers excluded from future sends
- [ ] SMS sent only during business hours

### Automations
- [ ] Welcome automation triggers on loyalty enrollment
- [ ] Win-back automation triggers on lapsed customer threshold
- [ ] Birthday automation triggers on birthday
- [ ] Post-visit automation triggers after order close
- [ ] Automations can be enabled/disabled

### Revenue Attribution
- [ ] Orders using campaign discount tracked as attributed revenue
- [ ] Campaign ROI calculated from attributed revenue vs send cost
