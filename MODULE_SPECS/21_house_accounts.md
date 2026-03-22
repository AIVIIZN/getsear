# Module 21: House Accounts & Corporate Billing

## Overview

The House Accounts module enables restaurants to offer charge-to-account billing for trusted customers, corporate clients, and staff. Instead of paying at the time of service, the charge is recorded to the account and billed periodically (weekly, biweekly, or monthly). The module includes account creation with credit limits, charge-to-account at POS, monthly statement generation, payment posting, account history, and auto-billing.

**Who uses it:** Servers charge orders to house accounts at POS. Managers create and manage accounts, set credit limits, and approve charges. Accounts receivable staff generate statements and post payments. Account holders receive statements and make payments.

**Why it matters:** House accounts are a key differentiator from Toast and Square (neither offers native house accounts). R Power's house account feature is heavily used by country clubs, corporate dining, and restaurants with regular corporate clients. Monthly billing simplifies payment for repeat business customers and increases visit frequency.

---

## Database Tables

### New Tables

- **`house_accounts`** — Account records. Fields: `id`, `org_id`, `account_name` (company or individual name), `account_number` (auto-generated, sequential), `account_type` (corporate, individual, staff, vip), `contact_name`, `contact_email`, `contact_phone`, `billing_address` (jsonb: {line1, line2, city, state, zip}), `credit_limit` (numeric 10,2), `current_balance` (numeric 10,2 — positive = owes money), `payment_terms` (net_15, net_30, net_60, on_statement), `tax_exempt` (boolean), `tax_exempt_number`, `auto_billing_enabled`, `auto_billing_method` (card_on_file, ach), `card_token` (Valor token for auto-billing), `is_active`, `approved_by` (user_id), `notes`, `created_at`, `updated_at`.
- **`house_account_transactions`** — Charge/payment ledger. Fields: `id`, `org_id`, `house_account_id`, `transaction_type` (charge, payment, credit, adjustment, statement_fee, late_fee), `amount` (positive for charges, negative for payments), `balance_after`, `order_id` (for charges), `payment_id` (for payments), `invoice_id` (for statement-linked transactions), `description`, `reference_number`, `performed_by`, `created_at`.
- **`house_account_statements`** — Monthly/periodic statements. Fields: `id`, `org_id`, `house_account_id`, `statement_number`, `statement_date`, `period_start`, `period_end`, `beginning_balance`, `charges_total`, `payments_total`, `adjustments_total`, `ending_balance`, `amount_due`, `due_date`, `status` (generated, sent, paid, partial, overdue), `pdf_url`, `sent_at`, `paid_at`, `created_at`.
- **`house_account_authorizations`** — Who can charge to which accounts. Fields: `id`, `house_account_id`, `authorized_name`, `authorized_phone`, `authorized_email`, `is_active`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/house-accounts/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List house accounts (filter: status, type, balance) | Manager+ |
| POST | `/` | Create house account | Manager+ |
| GET | `/:id` | Get account detail with balance and recent transactions | Yes |
| PUT | `/:id` | Update account | Manager+ |
| DELETE | `/:id` | Deactivate account | Admin+ |
| GET | `/:id/transactions` | Get transaction history (paginated) | Manager+ |
| POST | `/:id/charge` | Record a charge (from POS payment flow) | Yes |
| POST | `/:id/payment` | Post a payment received | Manager+ |
| POST | `/:id/credit` | Apply a credit to account | Manager+ |
| POST | `/:id/adjust` | Manual balance adjustment | Admin+ |
| GET | `/:id/statements` | List statements for account | Manager+ |
| POST | `/statements/generate` | Generate statements for a period | Manager+ |
| GET | `/statements/:id` | Get statement detail | Manager+ |
| POST | `/statements/:id/send` | Send statement to customer (email) | Manager+ |
| POST | `/statements/:id/mark-paid` | Mark statement as paid | Manager+ |
| GET | `/:id/authorizations` | List authorized signers | Manager+ |
| POST | `/:id/authorizations` | Add authorized signer | Manager+ |
| DELETE | `/:id/authorizations/:auth_id` | Remove authorized signer | Manager+ |
| POST | `/lookup` | Lookup account by name, number, or phone | Yes |
| GET | `/aging` | Aging report (30/60/90/120+ days) | Manager+ |
| POST | `/auto-bill` | Run auto-billing for accounts with card on file | Admin+ |

---

## UI Pages / Components

### House Accounts List — `/admin/house-accounts`
- Searchable table: Account name, number, type, balance, credit limit, utilization %, status
- Color coding: Green (< 50% utilized), Yellow (50-80%), Red (> 80% or overdue)
- Filter by type, status, overdue
- Quick search by name or account number
- "+ New Account" button

### Account Detail — `/admin/house-accounts/:id`
- **Header:** Account name, number, type badge, balance/limit display, status
- **Tabs:** Transactions, Statements, Authorizations, Settings
- **Transactions tab:** Chronological ledger showing charges, payments, credits, adjustments with running balance. Each entry links to source (order, payment, statement).
- **Statements tab:** List of generated statements with date, amount, status. Send/resend actions.
- **Authorizations tab:** List of authorized signers with add/remove.
- **Settings tab:** Credit limit, payment terms, auto-billing config, tax exempt status, notes.
- **Quick actions:** Post payment, apply credit, generate statement

### Charge at POS (component within Payment module)
- In payment method selection, "House Account" option appears
- Account lookup: Search by name, number, or authorized signer phone
- Verification: Show account name, available credit, authorized signers
- Charge confirmation: Order total charged to account, receipt shows "CHARGE TO ACCOUNT: [name]"
- Credit limit enforcement: If charge would exceed limit, warn and require manager override

### Statement Generation — `/admin/house-accounts/statements`
- Period selector (monthly, custom date range)
- "Generate All" or select specific accounts
- Preview before generation
- Bulk send via email
- Statement PDF includes: Account info, period dates, beginning balance, itemized charges with dates and order details, payments received, ending balance, amount due, payment terms

### Aging Report — `/admin/house-accounts/aging`
- Table: Account, current, 30 days, 60 days, 90 days, 120+ days, total
- Summary totals at bottom
- Color-coded severity
- Drill-down to account detail from any row
- Export to CSV

---

## Business Rules

1. **Credit limit enforcement:** Before charging to an account, the system checks: `current_balance + charge_amount <= credit_limit`. If exceeded, the charge is blocked unless a manager overrides. Managers can approve over-limit charges with PIN.

2. **Account types:**
   - **Corporate:** Company accounts with billing address and authorized signers list
   - **Individual:** Personal accounts for regular guests
   - **Staff:** Employee house accounts (may integrate with payroll deduction)
   - **VIP:** Special accounts for VIP guests with custom terms

3. **Authorized signers:** Corporate accounts can have multiple authorized individuals. At POS charge time, the system can verify the person charging is authorized (by name or phone lookup). This prevents unauthorized charges.

4. **Statement generation:** Statements are generated for a period, listing all charges and payments. The `amount_due` is the ending balance. Statements can be auto-generated on a schedule (e.g., 1st of each month for the prior month).

5. **Payment posting:** When a payment is received (check, wire, cash), the manager posts it to the account. The `current_balance` decreases. Payment can be linked to a specific statement.

6. **Auto-billing:** If the account has a card on file (Valor token), the system can auto-charge the statement balance on the due date. Requires explicit opt-in from the account holder. Creates a payment record linked to the Valor transaction.

7. **Tax exemption:** Some corporate and government accounts are tax-exempt. If `tax_exempt = true`, orders charged to this account have tax removed (requires valid `tax_exempt_number`).

8. **Aging report:** Balances are categorized by age: Current (0-30 days), 30 days, 60 days, 90 days, 120+ days. This is standard accounts receivable reporting.

9. **Late fees:** Configurable late fee policy (e.g., 1.5% per month on overdue balance). Late fees are added as `house_account_transactions` of type `late_fee`. Auto-applied by background job.

10. **Cross-location:** House accounts are org-wide. A corporate account can be charged at any location within the organization. Statements show charges from all locations.

11. **Integration with POS payments:** Charging to a house account is a `payment_method = 'house_account'` on the `payments` table. The payment record links to the `house_account_transactions` entry. The order `balance_due` is reduced just like any other payment.

12. **Refunds to house account:** If an order charged to a house account is refunded, a credit is applied to the account (negative transaction), reducing the balance.

---

## Dependencies

- **01_auth** — Authentication, manager PIN for over-limit charges
- **03_orders** — Order linkage for charges
- **04_payments** — Payment method integration, Valor token for auto-billing
- **10_settings** — Tax exempt handling, location config
- **External: SendGrid** — Statement email delivery
- **External: Valor PayTech** — Auto-billing card charges

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `house_account.charged` | Internal | `{account_id, order_id, amount, balance}` | Charge posted |
| `house_account.payment_received` | Internal | `{account_id, amount, balance}` | Payment posted |
| `house_account.over_limit` | Internal | `{account_id, balance, limit}` | Account exceeded credit limit |
| `house_account.statement_sent` | Internal | `{account_id, statement_id}` | Statement emailed |
| `house_account.overdue` | Internal | `{account_id, amount_overdue, days_overdue}` | Statement past due |

### Subscribed Events
| Event | Action |
|-------|--------|
| `payment.completed` (house_account method) | Create house_account_transaction charge |
| `payment.refunded` (house_account method) | Create house_account_transaction credit |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `statement_generation` | Monthly (1st at 6 AM) | Auto-generate statements for all active accounts |
| `statement_delivery` | Monthly (2nd at 9 AM) | Email generated statements to account contacts |
| `auto_billing` | Monthly (due date) | Charge card on file for auto-billing accounts |
| `late_fee_assessment` | Monthly (15th) | Apply late fees to overdue accounts |
| `aging_report_refresh` | Daily at 6 AM | Refresh aging report data |
| `overdue_reminder` | Weekly | Send reminder emails for overdue accounts |

---

## Acceptance Criteria

### Account Management
- [ ] Manager can create house account with name, type, credit limit, payment terms
- [ ] Account number auto-generated
- [ ] Manager can edit account details (limit, terms, contact)
- [ ] Admin can deactivate accounts
- [ ] Account list shows balance, utilization, status

### Charge at POS
- [ ] "House Account" appears as payment method option
- [ ] Account lookup by name, number, or authorized phone
- [ ] Charge amount validated against credit limit
- [ ] Over-limit charges blocked unless manager overrides
- [ ] Charge creates transaction with order linkage
- [ ] Account balance updates immediately
- [ ] Receipt shows "CHARGE TO ACCOUNT: [name]"

### Payments
- [ ] Manager can post payments received (check, wire, cash)
- [ ] Payment reduces account balance
- [ ] Payment linked to statement (if applicable)
- [ ] Auto-billing charges card on file for statement balance

### Statements
- [ ] Statements auto-generated monthly (or manually)
- [ ] Statement includes: period, beginning balance, charges, payments, ending balance
- [ ] Statement sent via email as PDF
- [ ] Statement status tracks: generated, sent, paid, overdue

### Authorized Signers
- [ ] Manager can add authorized signers to corporate accounts
- [ ] POS charge verifies against authorized signer list (if configured)
- [ ] Authorized signers can be removed

### Aging Report
- [ ] Aging report shows balances by 30/60/90/120+ day buckets
- [ ] Summary totals displayed
- [ ] Exportable to CSV

### Tax Exemption
- [ ] Tax-exempt accounts skip tax calculation on charges
- [ ] Tax exempt number required and displayed on receipts

### Cross-Location
- [ ] Account charges work at any location in the org
- [ ] Statements show charges from all locations
- [ ] Balance is org-wide, not per-location

### Late Fees
- [ ] Late fees auto-applied per configurable policy
- [ ] Late fee transactions appear in account ledger
